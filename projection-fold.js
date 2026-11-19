/**
 * Mission Control — the log-derived per-session counters the dashboard shows.
 *
 * This module is the whole computation: a pure, synchronous fold over committed
 * Session events, plus the two value validators the projection registry asks
 * for. The Host half registers it with `ctx.sessionProjections`; the Browser
 * half reads the published value and never folds events itself.
 *
 * Every number here counts something the Harness actually logged:
 * - `toolCalls` / `failedToolCalls` count `tool/call` and failed `tool/result`
 *   events.
 * - `turnsCompleted` / `turnsFailed` count `turn/end` records by the reason the
 *   loop recorded, not by an inference.
 * - `runMs`, `lastTurnRunMs`, `openTurnStartedAt` are differences between the
 *   `time` fields of `turn/start` and `turn/end`.
 * - `lastError` is the message of the failed turn's own `LlmFailure`.
 * - `recent` holds the last few activity entries with their event seq and time.
 *
 * There is no progress percentage and no synthesized agent state: the dashboard
 * derives its execution state from these counters plus the Session Controller's
 * own `running` / `pendingInteraction` / `completionUnread` facts.
 *
 * The fold must be pure and synchronous, must return the same state reference
 * for events it does not describe, and must keep its state plain JSON so the
 * projection cache can checkpoint it.
 *
 * @module dsh-mission-control/projection-fold
 */

/** Projection key owned by this plugin. Custom keys are client-visible through `wire`. */
export const MISSION_CONTROL_KEY = 'missionControl'

/** Persisted-cache invalidation version; bump whenever fields or fold semantics change. */
export const PROJECTION_STATE_VERSION = 1

/** How many activity entries one Session keeps for the dashboard feed. */
export const RECENT_LIMIT = 8

const PROMPT_LABEL_LIMIT = 64
const TOOL_LABEL_LIMIT = 40
const ERROR_LABEL_LIMIT = 160

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function nonNegativeInteger(value) {
  const number = finiteNumber(value)
  if (number <= 0) return 0
  return Math.trunc(number)
}

function textOfContent(content) {
  if (!Array.isArray(content)) return ''
  let text = ''
  for (const block of content) {
    if (isRecord(block) && block.type === 'text' && typeof block.text === 'string') text += block.text
  }
  return text
}

/** Flatten whitespace and bound one label for the activity feed. */
function clip(text, limit) {
  const flat = String(text).replace(/\s+/gu, ' ').trim()
  if (flat.length <= limit) return flat
  return `${flat.slice(0, Math.max(0, limit - 1))}…`
}

/** A failure's own message or reason, or its code, never a synthesized description. */
function failureText(failure) {
  if (typeof failure === 'string') return clip(failure, ERROR_LABEL_LIMIT)
  if (!isRecord(failure)) return ''
  const message = typeof failure.message === 'string' ? failure.message : ''
  if (message !== '') return clip(message, ERROR_LABEL_LIMIT)
  const reason = typeof failure.reason === 'string' ? failure.reason : ''
  if (reason !== '') return clip(reason, ERROR_LABEL_LIMIT)
  const code = typeof failure.code === 'string' ? failure.code : ''
  return clip(code, ERROR_LABEL_LIMIT)
}

function pushRecent(recent, entry) {
  const next = [entry, ...recent]
  return next.length > RECENT_LIMIT ? next.slice(0, RECENT_LIMIT) : next
}

/** The empty-log state. */
export function emptyState() {
  return {
    toolCalls: 0,
    failedToolCalls: 0,
    turnsCompleted: 0,
    turnsFailed: 0,
    runMs: 0,
    lastTurnRunMs: 0,
    lastTurnOutcome: '',
    lastTurnEndedAt: 0,
    openTurn: 0,
    openTurnStartedAt: 0,
    lastError: '',
    lastErrorAt: 0,
    recent: [],
  }
}

/**
 * State for one Session's empty log.
 * @returns {ReturnType<typeof emptyState>} the initial state.
 */
export function initState() {
  return emptyState()
}

/**
 * Fold one committed Session event into the counters.
 * @param {ReturnType<typeof emptyState>} state - state covering all earlier events.
 * @param {{ type?: string, seq?: number, time?: number, data?: unknown }} event - the next committed event.
 * @returns {ReturnType<typeof emptyState>} the next state, or `state` itself when the event is not ours.
 */
export function applyEvent(state, event) {
  if (!isRecord(event)) return state
  const time = finiteNumber(event.time)
  const seq = finiteNumber(event.seq)
  const data = isRecord(event.data) ? event.data : {}

  switch (event.type) {
    case 'turn/start': {
      const turn = nonNegativeInteger(data.turn)
      return {
        ...state,
        openTurn: turn,
        openTurnStartedAt: time,
      }
    }
    case 'turn/end': {
      const reason = isRecord(data.reason) ? data.reason : {}
      const kind = typeof reason.kind === 'string' && reason.kind !== '' ? reason.kind : 'unknown'
      const startedAt = state.openTurnStartedAt
      const runMs = startedAt > 0 && time >= startedAt ? time - startedAt : 0
      const failed = kind === 'error' || kind === 'blocked'
      const errorMessage = kind === 'error' ? failureText(reason.error) : ''
      return {
        ...state,
        turnsCompleted: state.turnsCompleted + (kind === 'completed' ? 1 : 0),
        turnsFailed: state.turnsFailed + (failed ? 1 : 0),
        runMs: state.runMs + runMs,
        lastTurnRunMs: runMs,
        lastTurnOutcome: kind,
        lastTurnEndedAt: time,
        openTurn: 0,
        openTurnStartedAt: 0,
        lastError: errorMessage !== '' ? errorMessage : state.lastError,
        lastErrorAt: errorMessage !== '' ? time : state.lastErrorAt,
        recent: pushRecent(state.recent, { seq, at: time, kind: 'turn-end', label: kind }),
      }
    }
    case 'tool/call': {
      const name = typeof data.name === 'string' && data.name !== '' ? data.name : 'tool'
      return {
        ...state,
        toolCalls: state.toolCalls + 1,
        recent: pushRecent(state.recent, { seq, at: time, kind: 'tool', label: clip(name, TOOL_LABEL_LIMIT) }),
      }
    }
    case 'tool/result': {
      const message = isRecord(data.message) ? data.message : null
      if (message === null || message.isError !== true) return state
      const failure = isRecord(data.error) ? data.error : null
      const detail = failure === null ? '' : failureText(failure)
      const callId = typeof message.toolCallId === 'string' ? message.toolCallId : ''
      return {
        ...state,
        failedToolCalls: state.failedToolCalls + 1,
        recent: pushRecent(state.recent, {
          seq,
          at: time,
          kind: 'tool-error',
          label: detail !== '' ? detail : clip(callId, TOOL_LABEL_LIMIT),
        }),
      }
    }
    case 'user/message': {
      const source = isRecord(data.source) ? data.source : {}
      // Only a direct human prompt: `inject()` context and goal rounds share the
      // same event type and are not the person's activity.
      if (source.kind !== 'user') return state
      const text = textOfContent(data.content)
      if (text.trim() === '') return state
      return {
        ...state,
        recent: pushRecent(state.recent, { seq, at: time, kind: 'prompt', label: clip(text, PROMPT_LABEL_LIMIT) }),
      }
    }
    default:
      return state
  }
}

/**
 * Normalize a stored or published value; throws only when the value is not an object.
 * @param {unknown} value - candidate state or view.
 * @returns {ReturnType<typeof emptyState>} a detached plain-JSON value.
 */
function normalizeValue(value) {
  if (!isRecord(value)) throw new TypeError('Mission Control projection value must be an object')
  const recent = Array.isArray(value.recent)
    ? value.recent.filter(isRecord).slice(0, RECENT_LIMIT).map((record) => ({
      seq: finiteNumber(record.seq),
      at: finiteNumber(record.at),
      kind: typeof record.kind === 'string' ? record.kind : '',
      label: typeof record.label === 'string' ? record.label : '',
    }))
    : []
  return {
    toolCalls: nonNegativeInteger(value.toolCalls),
    failedToolCalls: nonNegativeInteger(value.failedToolCalls),
    turnsCompleted: nonNegativeInteger(value.turnsCompleted),
    turnsFailed: nonNegativeInteger(value.turnsFailed),
    runMs: nonNegativeInteger(value.runMs),
    lastTurnRunMs: nonNegativeInteger(value.lastTurnRunMs),
    lastTurnOutcome: typeof value.lastTurnOutcome === 'string' ? value.lastTurnOutcome : '',
    lastTurnEndedAt: nonNegativeInteger(value.lastTurnEndedAt),
    openTurn: nonNegativeInteger(value.openTurn),
    openTurnStartedAt: nonNegativeInteger(value.openTurnStartedAt),
    lastError: typeof value.lastError === 'string' ? value.lastError : '',
    lastErrorAt: nonNegativeInteger(value.lastErrorAt),
    recent,
  }
}

/**
 * State validator for persisted checkpoints. The registry only needs `parse`.
 * @type {{ parse(value: unknown): ReturnType<typeof emptyState> }}
 */
export const stateSchema = { parse: normalizeValue }

/**
 * Client-view validator. The view carries exactly the persisted state's shape,
 * so it reuses the same normalization.
 * @type {{ parse(value: unknown): ReturnType<typeof emptyState> }}
 */
export const viewSchema = { parse: normalizeValue }

/**
 * Project the state to the value the Browser half receives.
 * @param {ReturnType<typeof emptyState>} state - current state.
 * @returns {ReturnType<typeof emptyState>} the whole current value.
 */
export function viewOf(state) {
  return normalizeValue(state)
}
