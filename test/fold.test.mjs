import assert from 'node:assert/strict'
import test from 'node:test'

import {
  MISSION_CONTROL_KEY,
  PROJECTION_STATE_VERSION,
  RECENT_LIMIT,
  applyEvent,
  emptyState,
  initState,
  stateSchema,
  viewOf,
  viewSchema,
} from '../projection-fold.js'

const T0 = 1795130000000

function fold(events) {
  return events.reduce((state, event) => applyEvent(state, event), initState())
}

test('key and version are the documented ones', () => {
  assert.equal(MISSION_CONTROL_KEY, 'missionControl')
  assert.equal(PROJECTION_STATE_VERSION, 1)
})

test('the empty state is plain JSON with no recent entries', () => {
  const state = emptyState()
  assert.deepEqual(state.recent, [])
  assert.equal(state.toolCalls, 0)
  assert.equal(JSON.parse(JSON.stringify(state)).toolCalls, 0)
})

test('counts tool calls and a completed turn from the recorded events', () => {
  const state = fold([
    { type: 'turn/start', seq: 1, time: T0, data: { turn: 1 } },
    { type: 'tool/call', seq: 2, time: T0 + 1000, data: { turn: 1, step: 1, callId: 'a', name: 'read', arguments: '{}' } },
    { type: 'tool/result', seq: 3, time: T0 + 1500, data: { message: { role: 'tool', toolCallId: 'a', content: [] } } },
    { type: 'tool/call', seq: 4, time: T0 + 2000, data: { turn: 1, step: 1, callId: 'b', name: 'grep', arguments: '{}' } },
    { type: 'tool/result', seq: 5, time: T0 + 2100, data: { message: { role: 'tool', toolCallId: 'b', isError: true, content: [] }, error: { name: 'ToolError', code: 'invalid-arguments', reason: 'bad pattern' } } },
    { type: 'turn/end', seq: 6, time: T0 + 5000, data: { turn: 1, reason: { kind: 'completed' } } },
  ])

  assert.equal(state.toolCalls, 2)
  assert.equal(state.failedToolCalls, 1)
  assert.equal(state.turnsCompleted, 1)
  assert.equal(state.turnsFailed, 0)
  assert.equal(state.runMs, 5000)
  assert.equal(state.lastTurnRunMs, 5000)
  assert.equal(state.lastTurnOutcome, 'completed')
  assert.equal(state.openTurnStartedAt, 0)
  assert.equal(state.openTurn, 0)
  assert.equal(state.recent.length, 4)
  assert.deepEqual(
    state.recent.map((entry) => entry.kind),
    ['turn-end', 'tool-error', 'tool', 'tool'],
  )
  assert.equal(state.recent[1].label, 'bad pattern')
})

test('a failed turn records the failure message and keeps the open turn closed', () => {
  const state = fold([
    { type: 'turn/start', seq: 1, time: T0, data: { turn: 3 } },
    { type: 'turn/end', seq: 2, time: T0 + 1200, data: { turn: 3, reason: { kind: 'error', error: { code: 'rate-limited', message: 'provider is rate limited' } } } },
  ])
  assert.equal(state.turnsFailed, 1)
  assert.equal(state.turnsCompleted, 0)
  assert.equal(state.lastTurnOutcome, 'error')
  assert.equal(state.lastError, 'provider is rate limited')
  assert.equal(state.lastErrorAt, T0 + 1200)
})

test('a blocked turn counts as failed without inventing an error message', () => {
  const state = fold([
    { type: 'turn/start', seq: 1, time: T0, data: { turn: 1 } },
    { type: 'turn/end', seq: 2, time: T0 + 300, data: { turn: 1, reason: { kind: 'blocked' } } },
  ])
  assert.equal(state.turnsFailed, 1)
  assert.equal(state.lastError, '')
  assert.equal(state.lastTurnOutcome, 'blocked')
})

test('keeps only human prompts in the activity feed', () => {
  const base = fold([{ type: 'turn/start', seq: 1, time: T0, data: { turn: 1 } }])
  const prompt = applyEvent(base, {
    type: 'user/message',
    seq: 2,
    time: T0 + 10,
    data: { role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: '  Revisa   el README  ' }] },
  })
  assert.equal(prompt.recent[0].kind, 'prompt')
  assert.equal(prompt.recent[0].label, 'Revisa el README')

  const injected = applyEvent(prompt, {
    type: 'user/message',
    seq: 3,
    time: T0 + 20,
    data: { role: 'user', source: { kind: 'agent' }, content: [{ type: 'text', text: 'file changed' }] },
  })
  assert.equal(injected, prompt, 'a non-human user message leaves the state reference untouched')
})

test('an unrelated event returns the same state reference', () => {
  const state = fold([{ type: 'turn/start', seq: 1, time: T0, data: { turn: 1 } }])
  assert.equal(applyEvent(state, { type: 'assistant/message', seq: 2, time: T0, data: {} }), state)
  assert.equal(applyEvent(state, { type: 'session/title', seq: 3, time: T0, data: {} }), state)
  assert.equal(applyEvent(state, { type: 'tool/result', seq: 4, time: T0, data: { message: { role: 'tool', content: [] } } }), state)
})

test('the recent feed keeps its bound and stays newest first', () => {
  const events = [{ type: 'turn/start', seq: 0, time: T0, data: { turn: 1 } }]
  for (let index = 0; index < RECENT_LIMIT + 5; index += 1) {
    events.push({ type: 'tool/call', seq: index + 1, time: T0 + index, data: { turn: 1, name: `tool-${index}` } })
  }
  const state = fold(events)
  assert.equal(state.toolCalls, RECENT_LIMIT + 5)
  assert.equal(state.recent.length, RECENT_LIMIT)
  assert.equal(state.recent[0].label, `tool-${RECENT_LIMIT + 4}`)
})

test('the published view is the normalized whole value', () => {
  const state = fold([
    { type: 'turn/start', seq: 1, time: T0, data: { turn: 1 } },
    { type: 'turn/end', seq: 2, time: T0 + 900, data: { turn: 1, reason: { kind: 'max-tokens' } } },
  ])
  const view = viewOf(state)
  assert.equal(view.lastTurnOutcome, 'max-tokens')
  assert.equal(view.lastTurnRunMs, 900)
  assert.equal(view.turnsCompleted, 0)
  assert.equal(view.turnsFailed, 0)
  assert.deepEqual(view, viewSchema.parse(view))
})

test('stateSchema repairs a stale checkpoint and rejects a non-object', () => {
  const parsed = stateSchema.parse({ toolCalls: 7, recent: [{ seq: 1, at: T0, kind: 'tool', label: 'read' }, null] })
  assert.equal(parsed.toolCalls, 7)
  assert.equal(parsed.turnsCompleted, 0)
  assert.equal(parsed.recent.length, 1)
  assert.throws(() => stateSchema.parse(null), /must be an object/)
  assert.throws(() => viewSchema.parse('nope'), /must be an object/)
})

test('an open turn is reported so the dashboard can time it', () => {
  const state = fold([{ type: 'turn/start', seq: 1, time: T0, data: { turn: 4 } }])
  assert.equal(state.openTurn, 4)
  assert.equal(state.openTurnStartedAt, T0)
  assert.equal(state.runMs, 0)
})
