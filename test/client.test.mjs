/**
 * Renders the Browser half in Node with a minimal React and fake slot inputs.
 *
 * The test loads the real `client.js`, runs its `apply` against a recording
 * context, and calls the registered panel component with the same props the
 * Web Client builds (standard selector hooks plus the registration's inject
 * face). It exercises the real derivation, formatting, and tree structure.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'

const CLIENT_PATH = fileURLToPath(new URL('../client.js', import.meta.url))
const CLIENT_URL = pathToFileURL(CLIENT_PATH).href
const PREFS_KEY = 'dsh.mission-control.prefs.v1'

const storage = new Map()

function createReact(onState) {
  return {
    createElement(type, props, ...children) {
      return {
        type,
        props: props ?? {},
        children: children.flat(Infinity).filter((child) => child !== null && child !== undefined && child !== false && child !== true),
      }
    },
    useState(initial) {
      let value = typeof initial === 'function' ? initial() : initial
      const set = (next) => {
        value = typeof next === 'function' ? next(value) : next
        onState(value)
      }
      return [value, set]
    },
    useCallback(callback) {
      return callback
    },
    useMemo(factory) {
      return factory()
    },
    useEffect() {},
  }
}

const stateUpdates = []
const react = createReact((value) => stateUpdates.push(value))

let loaded
globalThis.window = {
  __ModuleLoader__: {
    load(module) {
      loaded = module
    },
  },
  localStorage: {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
  },
  setInterval: () => 0,
  clearInterval: () => {},
}

await import(CLIENT_URL)

function createPlugin() {
  assert.equal(loaded.id, 'dsh-mission-control')
  return loaded.factory((id) => {
    if (id === 'react') return react
    throw new Error(`unexpected require: ${id}`)
  })
}

const registrations = []
const opened = []
let dictionaries = {}

function translate(locale, key, params) {
  const dict = dictionaries[locale] ?? dictionaries.en ?? {}
  let text = typeof dict[key] === 'string' ? dict[key] : key
  if (params !== undefined) {
    text = text.replace(/\{(\w+)\}/gu, (match, name) => (name in params ? String(params[name]) : match))
  }
  return text
}

function createContext() {
  return {
    effect(factory) {
      factory()
      return () => {}
    },
    locale: {
      register(_ns, value) {
        dictionaries = value
        return () => {}
      },
      bind() {
        return (key, params) => translate('es', key, params)
      },
      getLocale() {
        return { active: 'es' }
      },
    },
    slots: {
      inject(key, callback) {
        registrations.push({ key, registration: callback() })
        return () => {}
      },
      register(options, component) {
        return { options, component }
      },
    },
    uiWorkspace: {
      openSession(target) {
        opened.push(target)
      },
    },
  }
}

const plugin = createPlugin()
assert.deepEqual(plugin.inject, ['slots', 'locale', 'uiWorkspace'])
plugin.apply(createContext())

function registrationFor(slotName) {
  const found = registrations.find((entry) => entry.registration.options.name === slotName)
  assert.ok(found, `a registration for ${slotName}`)
  return found.registration
}

const NOW = Date.now()

function counters(overrides) {
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
    ...overrides,
  }
}

function sessionState() {
  return {
    ids: ['session-one', 'session-two', 'session-three', 'session-four', 'session-five'],
    byId: {
      'session-one': {
        id: 'session-one',
        displayTitle: 'Mission Control build',
        title: 'Mission Control build',
        cwd: 'C:\\Proyectos',
        running: true,
        blank: false,
        updatedAt: NOW - 30000,
      },
      'session-two': {
        id: 'session-two',
        displayTitle: 'deploy notes',
        cwd: 'C:\\Projects\\notes',
        running: false,
        blank: false,
        updatedAt: NOW - 600000,
      },
      'session-three': {
        id: 'session-three',
        displayTitle: 'release check',
        cwd: 'C:\\Projects\\release',
        running: false,
        blank: false,
        updatedAt: NOW - 500000,
      },
      'session-four': {
        id: 'session-four',
        displayTitle: 'rate limit probe',
        cwd: 'C:\\Projects\\probe',
        running: false,
        blank: false,
        updatedAt: NOW - 400000,
      },
      'session-five': {
        id: 'session-five',
        displayTitle: 'cold investigation',
        running: false,
        blank: false,
        updatedAt: NOW - 900000,
      },
    },
    phase: 'ready',
    projectionsBySession: {
      'session-one': {
        state: 'idle',
        error: null,
        values: {
          title: 'Mission Control build',
          modelSelection: { next: { provider: 'deepseek', model: 'deepseek-chat' }, lastUsed: null },
          tokenUsage: { uncachedInputTokens: 40000, outputTokens: 5200, cacheReadTokens: 0, cacheWriteTokens: 0 },
          todos: [
            { content: 'write the host fold', status: 'completed' },
            { content: 'wire the panel', status: 'in_progress' },
            { content: 'verify', status: 'pending' },
          ],
          inbox: { 'next-turn': [{ id: 'm1' }], 'next-step': [] },
          agentPreset: 'standard',
          missionControl: counters({
            toolCalls: 12,
            failedToolCalls: 1,
            turnsCompleted: 3,
            runMs: 300000,
            lastTurnRunMs: 120000,
            lastTurnOutcome: 'completed',
            lastTurnEndedAt: NOW - 240000,
            openTurn: 4,
            openTurnStartedAt: NOW - 65000,
            recent: [
              { seq: 30, at: NOW - 5000, kind: 'tool', label: 'read' },
              { seq: 28, at: NOW - 9000, kind: 'prompt', label: 'revisa el README' },
            ],
          }),
        },
      },
      'session-two': {
        state: 'idle',
        error: null,
        values: {
          title: 'deploy notes',
          modelSelection: { next: null, lastUsed: { provider: 'deepseek', model: 'deepseek-reasoner' } },
          tokenUsage: null,
          todos: [
            { content: 'a', status: 'pending' },
            { content: 'b', status: 'pending' },
            { content: 'c', status: 'pending' },
            { content: 'd', status: 'in_progress' },
            { content: 'e', status: 'pending' },
          ],
          inbox: { 'next-turn': [], 'next-step': [] },
          missionControl: counters({
            toolCalls: 4,
            turnsCompleted: 0,
            turnsFailed: 1,
            runMs: 90000,
            lastTurnRunMs: 45000,
            lastTurnOutcome: 'blocked',
            lastTurnEndedAt: NOW - 200000,
            recent: [{ seq: 12, at: NOW - 200000, kind: 'turn-end', label: 'blocked' }],
          }),
        },
      },
      'session-three': {
        state: 'idle',
        error: null,
        values: {
          title: 'release check',
          modelSelection: { next: { provider: 'deepseek', model: 'deepseek-chat' }, lastUsed: null },
          tokenUsage: { uncachedInputTokens: 1200, outputTokens: 300, cacheReadTokens: 0, cacheWriteTokens: 0 },
          missionControl: counters({
            toolCalls: 6,
            turnsCompleted: 2,
            runMs: 60000,
            lastTurnRunMs: 20000,
            lastTurnOutcome: 'completed',
            lastTurnEndedAt: NOW - 120000,
            recent: [{ seq: 20, at: NOW - 120000, kind: 'turn-end', label: 'completed' }],
          }),
        },
      },
      'session-four': {
        state: 'idle',
        error: null,
        values: {
          title: 'rate limit probe',
          tokenUsage: { uncachedInputTokens: 900, outputTokens: 100, cacheReadTokens: 0, cacheWriteTokens: 0 },
          missionControl: counters({
            toolCalls: 2,
            turnsCompleted: 0,
            turnsFailed: 1,
            runMs: 30000,
            lastTurnRunMs: 30000,
            lastTurnOutcome: 'error',
            lastTurnEndedAt: NOW - 300000,
            lastError: 'provider is rate limited',
            lastErrorAt: NOW - 300000,
            recent: [{ seq: 9, at: NOW - 300000, kind: 'turn-end', label: 'error' }],
          }),
        },
      },
      'session-five': { state: 'idle', error: null, values: { title: 'cold investigation' } },
    },
  }
}

function statusState() {
  return new Map([
    ['session-one', { running: true, pendingInteraction: undefined, completionUnread: false }],
    ['session-two', { running: false, pendingInteraction: { key: 'a1', kind: 'approval', sessionId: 'session-two' }, completionUnread: false }],
    ['session-three', { running: false, pendingInteraction: undefined, completionUnread: true }],
    ['session-four', { running: false, pendingInteraction: undefined, completionUnread: false }],
    ['session-five', { running: false, pendingInteraction: undefined, completionUnread: false }],
  ])
}

function renderPanel(prefs) {
  if (prefs !== undefined) storage.set(PREFS_KEY, JSON.stringify(prefs))
  const main = registrationFor('main')
  const sessions = sessionState()
  const statuses = statusState()
  const injected = main.options.inject()
  return main.component({
    useSessions: (selector) => selector(sessions),
    useSessionStatus: (selector) => selector(statuses),
    ...injected,
  })
}

function walk(node, visit) {
  if (node === null || node === undefined) return
  if (typeof node === 'string' || typeof node === 'number') return
  const current = node
  if (typeof current.type === 'function') {
    const rendered = current.type({ ...current.props, children: current.children })
    walk(rendered, visit)
    return
  }
  visit(current)
  for (const child of current.children ?? []) walk(child, visit)
}

function collect(tree, predicate) {
  const found = []
  walk(tree, (node) => {
    if (predicate(node)) found.push(node)
  })
  return found
}

function textOf(node) {
  let text = ''
  walk(node, (current) => {
    if (current.type === 'style') return
    for (const child of current.children ?? []) {
      if (typeof child === 'string' || typeof child === 'number') text += ` ${String(child)}`
    }
  })
  return text.replace(/\s+/gu, ' ').trim()
}

function titleOf(card) {
  const match = textOf(card).match(/Mission Control build|deploy notes|release check|rate limit probe|cold investigation/)
  return match === null ? '' : match[0]
}

function cardsOf(tree) {
  return collect(tree, (node) => node.props.className === 'dsh-mc-card')
}

test('registers the sidebar entry and the global panel it opens', () => {
  const panellist = registrationFor('sidebar.panellist')
  assert.equal(panellist.options.id, 'mission-control')
  assert.equal(panellist.options.order, 10)
  assert.equal(panellist.options.label(), 'Mission Control')
  assert.equal(typeof panellist.component, 'function')

  const main = registrationFor('main')
  assert.equal(main.options.key, 'mission-control')
  assert.equal(main.options.locale, 'missionControl')
  assert.equal(typeof main.component, 'function')
  assert.equal(registrations[0].key, 'main')
  assert.equal(registrations[1].key, 'sidebar.panellist')
})

test('renders one card per session with the official facts', () => {
  const tree = renderPanel({ filter: 'all', sort: 'runtime' })
  const cards = cardsOf(tree)
  assert.equal(cards.length, 5)
  assert.deepEqual(
    cards.map((card) => card.props['data-state']),
    ['working', 'waiting', 'completed', 'error', 'idle'],
  )

  const first = cards[0]
  const firstText = textOf(first)
  assert.match(firstText, /Working/)
  assert.match(firstText, /Running · /)
  assert.match(firstText, /Mission Control build/)
  assert.match(firstText, /deepseek-chat · deepseek/)
  assert.match(firstText, /12 Tools/)
  assert.match(firstText, /3 Tasks/)
  assert.match(firstText, /3 Pending/)
  assert.match(firstText, /45k tok/)

  assert.equal(cards[1].props['data-needs'], 'true')
  assert.match(textOf(cards[1]), /Approval needed/)
  assert.match(textOf(cards[1]), /deepseek-reasoner · deepseek/)

  assert.equal(cards[2].props['data-unread'], 'true')
  assert.match(textOf(cards[2]), /Last task · /)

  assert.match(textOf(cards[3]), /Ended · /)

  // A cold session has no projection counters yet: the card says so instead of guessing.
  assert.match(textOf(cards[4]), /— Tools/)
  assert.match(textOf(cards[4]), /Idle · /)
})

test('sorts by runtime and by pending tasks', () => {
  const byRuntime = cardsOf(renderPanel({ filter: 'all', sort: 'runtime' })).map(titleOf)
  assert.deepEqual(byRuntime, ['Mission Control build', 'deploy notes', 'release check', 'rate limit probe', 'cold investigation'])

  const byPending = cardsOf(renderPanel({ filter: 'all', sort: 'pending' })).map(titleOf)
  // deploy notes holds five pending todos plus a waiting request.
  assert.deepEqual(byPending, ['deploy notes', 'Mission Control build', 'release check', 'rate limit probe', 'cold investigation'])
})

test('counts every state in the filter chips and filters by one', () => {
  const tree = renderPanel({ filter: 'all', sort: 'runtime' })
  const chips = collect(tree, (node) => node.props.className === 'dsh-mc-chip-btn')
  assert.equal(chips.length, 6)
  const counts = chips.map((chip) => textOf(chip)).join(' | ')
  for (const expected of ['All 5', 'Working 1', 'Waiting 1', 'Completed 1', 'Error 1', 'Idle 1']) {
    assert.ok(counts.includes(expected), `${expected} in ${counts}`)
  }

  const error = cardsOf(renderPanel({ filter: 'error', sort: 'runtime' }))
  assert.equal(error.length, 1)
  assert.equal(error[0].props['data-state'], 'error')
  assert.match(textOf(error[0]), /rate limit probe/)
})

test('highlights the session that needs the user and offers to show it', () => {
  const tree = renderPanel({ filter: 'all', sort: 'runtime' })
  const alerts = collect(tree, (node) => node.props.className === 'dsh-mc-alert')
  assert.equal(alerts.length, 1)
  const alertText = textOf(alerts[0])
  assert.match(alertText, /1 session\(s\) need your intervention/)
  assert.match(alertText, /deploy notes/)
  assert.match(alertText, /Show them/)

  const waiting = cardsOf(renderPanel({ filter: 'waiting', sort: 'runtime' }))
  assert.equal(waiting.length, 1)
  assert.equal(waiting[0].props['data-state'], 'waiting')
})

test('shows the recent activity feed from the sessions’ own logs', () => {
  const tree = renderPanel({ filter: 'all', sort: 'runtime' })
  const rows = collect(tree, (node) => node.props.className === 'dsh-mc-feed-row')
  assert.equal(rows.length, 5)
  const labels = rows.map((row) => textOf(row)).join(' | ')
  assert.match(labels, /used read/)
  assert.match(labels, /prompt: revisa el README/)
  assert.match(labels, /turn blocked/)
  assert.match(labels, /turn failed/)
  // Newest first: the current session's tool call leads the feed.
  assert.match(textOf(rows[0]), /Mission Control build/)
})

test('opens the matching session when a card or a feed row is clicked', () => {
  opened.length = 0
  const tree = renderPanel({ filter: 'all', sort: 'runtime' })
  cardsOf(tree)[0].props.onClick()
  assert.deepEqual(opened, ['session-one'])

  const rows = collect(tree, (node) => node.props.className === 'dsh-mc-feed-row')
  rows[1].props.onClick()
  assert.deepEqual(opened, ['session-one', 'session-one'])
})

test('restores persisted visual preferences and writes changes back', () => {
  const restored = renderPanel({ filter: 'error', sort: 'title', dense: true, prices: { input: '0.5', output: '1.5' } })
  const cards = cardsOf(restored)
  assert.equal(cards.length, 1, 'the restored error filter keeps only the failed session')
  assert.equal(cards[0].props['data-state'], 'error')
  const grid = collect(restored, (node) => node.props.className === 'dsh-mc-grid')
  assert.equal(grid[0].props['data-dense'], 'true')

  stateUpdates.length = 0
  const chips = collect(restored, (node) => node.props.className === 'dsh-mc-chip-btn')
  const allChip = chips.find((chip) => textOf(chip).startsWith('All'))
  allChip.props.onClick()
  assert.equal(stateUpdates.length, 1)
  const saved = JSON.parse(storage.get(PREFS_KEY))
  assert.equal(saved.filter, 'all')
  assert.equal(saved.sort, 'title')
  assert.equal(saved.dense, true)
  assert.equal(saved.language, 'en')
  assert.equal(saved.prices.input, '0.5')
})

test('estimates cost only when prices are configured', () => {
  const withoutPrices = renderPanel({ filter: 'all', sort: 'runtime' })
  assert.equal(collect(withoutPrices, (node) => node.props.className === 'dsh-mc-chip dsh-mc-chip-cost').length, 0)

  const withPrices = renderPanel({ filter: 'all', sort: 'runtime', prices: { input: '1', output: '2', cacheRead: '', cacheWrite: '' } })
  const priced = collect(withPrices, (node) => node.props.className === 'dsh-mc-chip dsh-mc-chip-cost')
  assert.equal(priced.length, 3)
  // 40k input tokens at $1/1M + 5.2k output tokens at $2/1M = 0.0504 USD.
  assert.match(textOf(priced[0]), /≈ \$0\.050/)
})

test('both dictionaries carry the same keys, and every key the panel uses exists', async () => {
  const enKeys = Object.keys(dictionaries.en).sort()
  const esKeys = Object.keys(dictionaries.es).sort()
  assert.deepEqual(esKeys, enKeys)
  assert.equal(enKeys.length > 40, true)

  const dynamic = {
    filter: ['all', 'working', 'waiting', 'completed', 'error', 'idle'],
    sort: ['runtime', 'pending', 'recent', 'title'],
    state: ['working', 'waiting', 'completed', 'error', 'idle'],
    outcome: ['completed', 'error', 'blocked', 'aborted', 'interrupted', 'max-tokens', 'forked', 'unknown'],
    language: ['label', 'en', 'es'],
  }
  for (const [prefix, values] of Object.entries(dynamic)) {
    for (const value of values) {
      assert.equal(`${prefix}.${value}` in dictionaries.en, true, `en ${prefix}.${value}`)
      assert.equal(`${prefix}.${value}` in dictionaries.es, true, `es ${prefix}.${value}`)
    }
  }

  const source = await readFile(CLIENT_PATH, 'utf8')
  const used = new Set()
  for (const match of source.matchAll(/\bt\('([^'{}$]+)'\)/gu)) used.add(match[1])
  const missing = [...used].filter((key) => !(key in dictionaries.en))
  assert.deepEqual(missing, [])
})

test('defaults to English and switches the whole panel to Spanish', () => {
  const english = renderPanel({ filter: 'all', sort: 'runtime' })
  const englishChips = collect(english, (node) => node.props.className === 'dsh-mc-chip-btn').map((node) => textOf(node))
  assert.deepEqual(englishChips, ['All 5', 'Working 1', 'Waiting 1', 'Completed 1', 'Error 1', 'Idle 1'])
  assert.match(textOf(cardsOf(english)[0]), /Working/)
  assert.match(textOf(cardsOf(english)[0]), /Tools/)

  const swatches = collect(english, (node) => node.props.className === 'dsh-mc-lang-btn')
  assert.deepEqual(swatches.map((node) => textOf(node)), ['EN', 'ES'])
  assert.equal(swatches[0].props['aria-pressed'], 'true')
  assert.equal(swatches[1].props['aria-pressed'], 'false')

  const spanish = renderPanel({ language: 'es', filter: 'all', sort: 'runtime' })
  const spanishChips = collect(spanish, (node) => node.props.className === 'dsh-mc-chip-btn').map((node) => textOf(node))
  assert.deepEqual(spanishChips, ['Todas 5', 'Trabajando 1', 'Esperando 1', 'Completadas 1', 'Con error 1', 'Inactivas 1'])
  assert.match(textOf(cardsOf(spanish)[0]), /Trabajando/)
  assert.match(textOf(cardsOf(spanish)[0]), /Herramientas/)

  const spanishSwatches = collect(spanish, (node) => node.props.className === 'dsh-mc-lang-btn')
  assert.equal(spanishSwatches[0].props['aria-pressed'], 'false')
  assert.equal(spanishSwatches[1].props['aria-pressed'], 'true')

  // Toggling writes the choice to the same preference store the panel restores.
  stateUpdates.length = 0
  const englishSwatches = collect(english, (node) => node.props.className === 'dsh-mc-lang-btn')
  englishSwatches[1].props.onClick()
  const saved = JSON.parse(storage.get(PREFS_KEY))
  assert.equal(saved.language, 'es')
  assert.equal(stateUpdates.at(-1).language, 'es')
})
