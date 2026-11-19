/**
 * Mission Control — Browser half.
 *
 * The sidebar entry "Mission Control" opens a global panel (`main` key
 * `mission-control`) that supervises every Session the Host lists.
 *
 * Data comes only from facts the Harness already publishes to the Web Client:
 * - `useSessions()` — the Session Controller's live catalog: display title, cwd,
 *   running flag, updated-at, and every client-visible projection value the
 *   Stream/control baseline delivered (`title`, `modelSelection`, `tokenUsage`,
 *   `todos`, `inbox`, and this plugin's own `missionControl` counters folded
 *   from the event log by the Host half).
 * - `useSessionStatus()` — running, the highest-precedence pending interaction
 *   (approval / plan review / question), and unread completion.
 *
 * Nothing here polls, folds events, guesses progress, or sends a prompt: the
 * panel re-renders when those framework sources change, and its only timer is a
 * local clock used to display elapsed time.
 */
window.__ModuleLoader__.load({
  id: 'dsh-mission-control',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    /** Locale namespace owned by this plugin. */
    const NS = 'missionControl'
    /** The id shared by the sidebar entry and the main panel it opens. */
    const PANEL_ID = 'mission-control'
    /** Projection key registered by the Host half. */
    const PROJECTION_KEY = 'missionControl'
    /** Display preferences: this browser's visual configuration. */
    const PREFS_KEY = 'dsh.mission-control.prefs.v1'
    /** Sidebar row order: after Plugins (0), before Schedules (20). */
    const SIDEBAR_ORDER = 10

    const FILTERS = ['all', 'working', 'waiting', 'completed', 'error', 'idle']
    const SORTS = ['runtime', 'pending', 'recent', 'title']

    // ---------------------------------------------------------------------
    // Dictionaries
    // ---------------------------------------------------------------------

    const en = {
      panel: 'Mission Control',
      title: 'Mission Control',
      subtitle: 'Every session, its current task, and what needs you — from the session registry and its event log.',
      live: 'Updating automatically',
      'sessions': 'Sessions',
      'settings': 'Display settings',
      'language.label': 'Panel language',
      'language.en': 'English',
      'language.es': 'Spanish',
      'settings.dense': 'Compact cards',
      'settings.prices': 'Token prices (USD per 1M tokens)',
      'settings.input': 'Input',
      'settings.output': 'Output',
      'settings.cacheRead': 'Cache read',
      'settings.cacheWrite': 'Cache write',
      'settings.pricesHint': 'Harness publishes token counts, not prices. Fill these in to see an estimate per card; leave them empty and the cost stays hidden.',
      'settings.reset': 'Reset display preferences',
      'filter.label': 'Filter by state',
      'filter.all': 'All',
      'filter.working': 'Working',
      'filter.waiting': 'Waiting',
      'filter.completed': 'Completed',
      'filter.error': 'Error',
      'filter.idle': 'Idle',
      'state.working': 'Working',
      'state.waiting': 'Waiting for you',
      'state.completed': 'Completed',
      'state.error': 'Error',
      'state.idle': 'Idle',
      'need.approval': 'Approval needed',
      'need.question': 'Answer needed',
      'need.plan': 'Plan review',
      'need.other': 'Needs you',
      'sort.label': 'Sort',
      'sort.runtime': 'Runtime',
      'sort.pending': 'Pending tasks',
      'sort.recent': 'Recent activity',
      'sort.title': 'Name',
      'stat.tools': 'Tools',
      'stat.tasks': 'Tasks',
      'stat.pending': 'Pending',
      'tooltip.tools': 'Tool calls recorded in this session log',
      'tooltip.tasks': 'Completed turns recorded in this session log',
      'tooltip.pending': 'Pending todos + queued messages + a request waiting for you',
      'tooltip.tokens': 'Tokens reported by the provider for this session',
      'tooltip.cost': 'Estimate: this session’s tokens × your configured prices',
      'model.unknown': 'No model selected',
      'timer.running': 'Running · {value}',
      'timer.waiting': 'Waiting · {value}',
      'timer.lastTask': 'Last task · {value}',
      'timer.ended': 'Ended · {value} ago',
      'timer.idle': 'Idle · {value}',
      'timer.noActivity': 'No activity yet',
      'outcome.completed': 'completed',
      'outcome.error': 'failed',
      'outcome.blocked': 'blocked',
      'outcome.aborted': 'cancelled',
      'outcome.interrupted': 'interrupted',
      'outcome.max-tokens': 'token limit',
      'outcome.forked': 'forked',
      'outcome.unknown': 'ended',
      'activity.title': 'Recent activity',
      'activity.subtitle': 'From the sessions’ own logs',
      'activity.empty': 'No activity recorded yet.',
      'feed.tool': 'used {name}',
      'feed.toolError': 'tool failed: {name}',
      'feed.prompt': 'prompt: {text}',
      'feed.turnEnd': 'turn {outcome}',
      'needsBanner': '{count} session(s) need your intervention',
      'seeWaiting': 'Show them',
      'openSession': 'Open this session',
      'error.navigate': 'Could not open this session.',
      'subagent': 'subagent',
      'empty.filtered': 'No session matches this filter.',
      'empty.none': 'No sessions yet. Start one from the sidebar.',
      'loading': 'Reading the session registry…',
      'unavailable': 'This page needs the session services of the Harness Web Client.',
      'footnote': 'Counters are folded from each session’s committed event log; states come from the Session Controller. Nothing is simulated, and no prompt is sent.',
    }

    const es = {
      panel: 'Mission Control',
      title: 'Mission Control',
      subtitle: 'Todas tus sesiones, su tarea actual y lo que te espera — desde el registro de sesiones y su registro de eventos.',
      live: 'Actualización automática',
      sessions: 'Sesiones',
      settings: 'Ajustes de vista',
      'language.label': 'Idioma del panel',
      'language.en': 'Inglés',
      'language.es': 'Español',
      'settings.dense': 'Tarjetas compactas',
      'settings.prices': 'Precios de tokens (USD por 1M de tokens)',
      'settings.input': 'Entrada',
      'settings.output': 'Salida',
      'settings.cacheRead': 'Lectura de caché',
      'settings.cacheWrite': 'Escritura de caché',
      'settings.pricesHint': 'Harness publica recuentos de tokens, no tarifas. Completa los precios para ver una estimación por tarjeta; si los dejas vacíos, el coste queda oculto.',
      'settings.reset': 'Restablecer preferencias de vista',
      'filter.label': 'Filtrar por estado',
      'filter.all': 'Todas',
      'filter.working': 'Trabajando',
      'filter.waiting': 'Esperando',
      'filter.completed': 'Completadas',
      'filter.error': 'Con error',
      'filter.idle': 'Inactivas',
      'state.working': 'Trabajando',
      'state.waiting': 'Te espera',
      'state.completed': 'Completada',
      'state.error': 'Error',
      'state.idle': 'Inactiva',
      'need.approval': 'Falta tu aprobación',
      'need.question': 'Falta tu respuesta',
      'need.plan': 'Revisión de plan',
      'need.other': 'Te necesita',
      'sort.label': 'Ordenar',
      'sort.runtime': 'Tiempo de ejecución',
      'sort.pending': 'Tareas pendientes',
      'sort.recent': 'Actividad reciente',
      'sort.title': 'Nombre',
      'stat.tools': 'Herramientas',
      'stat.tasks': 'Tareas',
      'stat.pending': 'Pendientes',
      'tooltip.tools': 'Llamadas a herramientas registradas en el log de la sesión',
      'tooltip.tasks': 'Turnos completados registrados en el log de la sesión',
      'tooltip.pending': 'Tareas pendientes + mensajes en cola + una petición esperándote',
      'tooltip.tokens': 'Tokens informados por el proveedor para esta sesión',
      'tooltip.cost': 'Estimación: tokens de la sesión × tus precios configurados',
      'model.unknown': 'Sin modelo seleccionado',
      'timer.running': 'En curso · {value}',
      'timer.waiting': 'Esperando · {value}',
      'timer.lastTask': 'Última tarea · {value}',
      'timer.ended': 'Terminó · hace {value}',
      'timer.idle': 'Inactiva · {value}',
      'timer.noActivity': 'Sin actividad todavía',
      'outcome.completed': 'completado',
      'outcome.error': 'falló',
      'outcome.blocked': 'bloqueado',
      'outcome.aborted': 'cancelado',
      'outcome.interrupted': 'interrumpido',
      'outcome.max-tokens': 'límite de tokens',
      'outcome.forked': 'bifurcado',
      'outcome.unknown': 'terminado',
      'activity.title': 'Actividad reciente',
      'activity.subtitle': 'De los logs de las sesiones',
      'activity.empty': 'Todavía no hay actividad registrada.',
      'feed.tool': 'usó {name}',
      'feed.toolError': 'herramienta falló: {name}',
      'feed.prompt': 'petición: {text}',
      'feed.turnEnd': 'turno {outcome}',
      'needsBanner': '{count} sesión(es) necesitan tu intervención',
      'seeWaiting': 'Verlas',
      'openSession': 'Abrir esta sesión',
      'error.navigate': 'No se pudo abrir esta sesión.',
      'subagent': 'subagente',
      'empty.filtered': 'Ninguna sesión coincide con este filtro.',
      'empty.none': 'Todavía no hay sesiones. Inicia una desde la barra lateral.',
      'loading': 'Leyendo el registro de sesiones…',
      'unavailable': 'Esta página necesita los servicios de sesiones del cliente web de Harness.',
      'footnote': 'Los contadores se pliegan desde el registro de eventos de cada sesión; los estados vienen del Session Controller. Nada se simula y no se envía ninguna petición.',
    }

    /**
     * Translate one key for the panel's selected language, with the same
     * `{name}` interpolation the Harness locale service uses. The sidebar
     * label keeps following the app locale; the panel text follows this
     * toggle so the two can differ.
     */
    function translateFor(language) {
      const dict = language === 'es' ? es : en
      return (key, params) => {
        const template = typeof dict[key] === 'string'
          ? dict[key]
          : (typeof en[key] === 'string' ? en[key] : key)
        if (params === undefined) return template
        return template.replace(/\{(\w+)\}/gu, (match, name) => (name in params ? String(params[name]) : match))
      }
    }

    // ---------------------------------------------------------------------
    // Formatting helpers
    // ---------------------------------------------------------------------

    function isRecord(value) {
      return typeof value === 'object' && value !== null && !Array.isArray(value)
    }

    function finite(value) {
      return typeof value === 'number' && Number.isFinite(value) ? value : 0
    }

    function formatDuration(ms) {
      const total = Math.max(0, Math.round(finite(ms) / 1000))
      if (total < 60) return `${total}s`
      const minutes = Math.floor(total / 60)
      if (minutes < 60) return `${minutes}m ${String(total % 60).padStart(2, '0')}s`
      const hours = Math.floor(minutes / 60)
      return `${hours}h ${String(minutes % 60).padStart(2, '0')}m`
    }

    function formatCount(count) {
      return String(Math.round(finite(count)))
    }

    function formatTokens(count) {
      const value = finite(count)
      if (value <= 0) return '0'
      if (value < 1000) return String(Math.round(value))
      if (value < 1000000) return `${(value / 1000).toFixed(value < 10000 ? 1 : 0)}k`
      return `${(value / 1000000).toFixed(value < 10000000 ? 1 : 0)}M`
    }

    function formatCost(usd) {
      if (typeof usd !== 'number' || !Number.isFinite(usd)) return ''
      if (usd === 0) return '$0'
      if (usd < 0.01) return `$${usd.toFixed(4)}`
      if (usd < 1) return `$${usd.toFixed(3)}`
      return `$${usd.toFixed(2)}`
    }

    const relativeFormatters = new Map()

    function relativeFormatter(locale) {
      const key = typeof locale === 'string' && locale !== '' ? locale : 'en'
      let formatter = relativeFormatters.get(key)
      if (formatter === undefined) {
        try {
          formatter = new Intl.RelativeTimeFormat(key, { numeric: 'auto', style: 'short' })
        } catch {
          formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto', style: 'short' })
        }
        relativeFormatters.set(key, formatter)
      }
      return formatter
    }

    function relativeTime(at, now, locale) {
      const atMs = finite(at)
      if (atMs <= 0) return ''
      const diff = atMs - now
      const abs = Math.abs(diff)
      const formatter = relativeFormatter(locale)
      if (abs < 45000) return formatter.format(Math.round(diff / 1000), 'second')
      if (abs < 2700000) return formatter.format(Math.round(diff / 60000), 'minute')
      if (abs < 79200000) return formatter.format(Math.round(diff / 3600000), 'hour')
      return formatter.format(Math.round(diff / 86400000), 'day')
    }

    const clockFormatters = new Map()

    function clockTime(at, locale) {
      const atMs = finite(at)
      if (atMs <= 0) return ''
      const key = typeof locale === 'string' && locale !== '' ? locale : 'en'
      let formatter = clockFormatters.get(key)
      if (formatter === undefined) {
        try {
          formatter = new Intl.DateTimeFormat(key, { hour: '2-digit', minute: '2-digit' })
        } catch {
          formatter = new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit' })
        }
        clockFormatters.set(key, formatter)
      }
      return formatter.format(new Date(atMs))
    }

    function needLabel(kind, t) {
      const value = typeof kind === 'string' ? kind : ''
      if (/approval/i.test(value)) return t('need.approval')
      if (/question|answer|ask/i.test(value)) return t('need.question')
      if (/plan/i.test(value)) return t('need.plan')
      return t('need.other')
    }

    function outcomeLabel(outcome, t) {
      if (typeof outcome !== 'string' || outcome === '') return t('outcome.unknown')
      const key = `outcome.${outcome}`
      const label = t(key)
      return label === key ? outcome : label
    }

    // ---------------------------------------------------------------------
    // Display preferences (this browser only)
    // ---------------------------------------------------------------------

    const DEFAULT_PRICES = { input: '', output: '', cacheRead: '', cacheWrite: '' }
    /** Panel languages the toggle offers; English is the default. */
    const LANGUAGES = ['en', 'es']

    function defaultPrefs() {
      return {
        language: 'en',
        filter: 'all',
        sort: 'runtime',
        dense: false,
        settingsOpen: false,
        prices: { ...DEFAULT_PRICES },
      }
    }

    function normalizePriceText(value) {
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return String(value)
      if (typeof value !== 'string') return ''
      const stripped = value.replace(/[^0-9.,]/gu, '').slice(0, 12)
      return stripped.replace(/,/gu, '.')
    }

    function normalizePrefs(input) {
      const prefs = defaultPrefs()
      if (!isRecord(input)) return prefs
      if (LANGUAGES.includes(input.language)) prefs.language = input.language
      if (FILTERS.includes(input.filter)) prefs.filter = input.filter
      if (SORTS.includes(input.sort)) prefs.sort = input.sort
      prefs.dense = input.dense === true
      prefs.settingsOpen = input.settingsOpen === true
      if (isRecord(input.prices)) {
        for (const key of Object.keys(DEFAULT_PRICES)) prefs.prices[key] = normalizePriceText(input.prices[key])
      }
      return prefs
    }

    function loadPrefs() {
      try {
        const raw = window.localStorage.getItem(PREFS_KEY)
        if (raw === null) return defaultPrefs()
        return normalizePrefs(JSON.parse(raw))
      } catch {
        return defaultPrefs()
      }
    }

    function savePrefs(prefs) {
      try {
        window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
      } catch {
        // A storage that refuses the write (private mode, quota) keeps the
        // in-memory selection; the dashboard still works.
      }
    }

    function priceOf(raw) {
      if (typeof raw !== 'string' || raw.trim() === '') return undefined
      const value = Number(raw)
      return Number.isFinite(value) && value >= 0 ? value : undefined
    }

    function pricesOf(prefs) {
      const prices = {
        input: priceOf(prefs.prices.input),
        output: priceOf(prefs.prices.output),
        cacheRead: priceOf(prefs.prices.cacheRead),
        cacheWrite: priceOf(prefs.prices.cacheWrite),
      }
      const usable = Object.values(prices).some((value) => typeof value === 'number')
      return usable ? prices : null
    }

    // ---------------------------------------------------------------------
    // Row derivation
    // ---------------------------------------------------------------------

    function pendingInteractions(status) {
      if (!isRecord(status)) return undefined
      const pending = status.pendingInteraction
      return pending === undefined || pending === null ? undefined : pending
    }

    function estimateCost(usage, prices) {
      if (!isRecord(usage) || prices === null) return null
      const parts = [
        [finite(usage.uncachedInputTokens), prices.input],
        [finite(usage.outputTokens), prices.output],
        [finite(usage.cacheReadTokens), prices.cacheRead],
        [finite(usage.cacheWriteTokens), prices.cacheWrite],
      ]
      let total = 0
      let priced = false
      for (const [tokens, price] of parts) {
        if (typeof price !== 'number' || tokens <= 0) continue
        total += (tokens / 1000000) * price
        priced = true
      }
      return priced ? total : null
    }

    function tokenTotal(usage) {
      if (!isRecord(usage)) return null
      const total = finite(usage.uncachedInputTokens)
        + finite(usage.outputTokens)
        + finite(usage.cacheReadTokens)
        + finite(usage.cacheWriteTokens)
      return total
    }

    function modelName(values) {
      const selection = values !== null && isRecord(values.modelSelection) ? values.modelSelection : null
      if (selection === null) return ''
      const chosen = isRecord(selection.next) ? selection.next : isRecord(selection.lastUsed) ? selection.lastUsed : null
      if (chosen === null) return ''
      const provider = typeof chosen.provider === 'string' ? chosen.provider : ''
      const model = typeof chosen.model === 'string' ? chosen.model : ''
      if (model === '') return provider
      return provider === '' ? model : `${model} · ${provider}`
    }

    function subagentModeOf(id, parentId, projectionsBySession) {
      if (typeof parentId !== 'string' || parentId === '') return undefined
      const parent = projectionsBySession[parentId]
      const values = parent !== undefined && isRecord(parent.values) ? parent.values : null
      const catalog = values !== null && Array.isArray(values.subagentCatalog) ? values.subagentCatalog : []
      for (const entry of catalog) {
        if (isRecord(entry) && entry.id === id && typeof entry.mode === 'string') return entry.mode
      }
      return undefined
    }

    function deriveRow(input) {
      const { id, summary, values, status, projectionsBySession, nowMs, prices } = input
      const counters = values !== null && isRecord(values[PROJECTION_KEY]) ? values[PROJECTION_KEY] : null
      const pending = pendingInteractions(status)
      const statusRunning = isRecord(status) && status.running === true
      const running = summary.running === true || statusRunning
      const outcome = counters !== null && typeof counters.lastTurnOutcome === 'string' ? counters.lastTurnOutcome : ''
      const state = pending !== undefined
        ? 'waiting'
        : running
          ? 'working'
          : outcome === 'error' || outcome === 'blocked'
            ? 'error'
            : outcome === 'completed'
              ? 'completed'
              : 'idle'

      const todos = values !== null && Array.isArray(values.todos) ? values.todos : []
      let pendingTodos = 0
      for (const item of todos) {
        if (isRecord(item) && item.status !== 'completed') pendingTodos += 1
      }
      let queued = 0
      if (values !== null && isRecord(values.inbox)) {
        if (Array.isArray(values.inbox['next-turn'])) queued += values.inbox['next-turn'].length
        if (Array.isArray(values.inbox['next-step'])) queued += values.inbox['next-step'].length
      }

      const usage = values !== null && isRecord(values.tokenUsage) ? values.tokenUsage : null
      const openStartedAt = counters !== null ? finite(counters.openTurnStartedAt) : 0
      const closedRunMs = counters !== null ? finite(counters.runMs) : 0
      const openRunMs = openStartedAt > 0 ? Math.max(0, nowMs - openStartedAt) : 0

      const parentId = typeof summary.parentId === 'string' ? summary.parentId : undefined
      return {
        id,
        title: typeof summary.title === 'string' && summary.title !== '' ? summary.title : summary.displayTitle,
        cwd: typeof summary.cwd === 'string' ? summary.cwd : '',
        model: modelName(values),
        agentPreset: values !== null && typeof values.agentPreset === 'string' ? values.agentPreset : '',
        parentId,
        subagent: summary.origin === 'subagent' || parentId !== undefined,
        subagentMode: subagentModeOf(id, parentId, projectionsBySession),
        state,
        needsYou: pending !== undefined,
        needKind: pending !== undefined && isRecord(pending) ? pending.kind : undefined,
        running,
        unread: isRecord(status) && status.completionUnread === true,
        updatedAt: finite(summary.updatedAt),
        toolCalls: counters !== null ? finite(counters.toolCalls) : null,
        failedToolCalls: counters !== null ? finite(counters.failedToolCalls) : 0,
        turnsCompleted: counters !== null ? finite(counters.turnsCompleted) : null,
        turnsFailed: counters !== null ? finite(counters.turnsFailed) : 0,
        openTurn: counters !== null ? finite(counters.openTurn) : 0,
        openStartedAt,
        closedRunMs,
        lastTurnRunMs: counters !== null ? finite(counters.lastTurnRunMs) : 0,
        lastTurnEndedAt: counters !== null ? finite(counters.lastTurnEndedAt) : 0,
        lastTurnOutcome: outcome,
        lastError: counters !== null && typeof counters.lastError === 'string' ? counters.lastError : '',
        tokens: tokenTotal(usage),
        usage,
        cost: estimateCost(usage, prices),
        pendingTodos,
        todoTotal: todos.length,
        queued,
        pendingCount: pendingTodos + queued + (pending !== undefined ? 1 : 0),
        recent: counters !== null && Array.isArray(counters.recent) ? counters.recent : [],
        runtimeMs: closedRunMs + openRunMs,
        blank: summary.blank === true,
      }
    }

    function buildRows(input) {
      const { ids, byId, projectionsBySession, statusMap, nowMs, prices } = input
      const rows = []
      for (const id of ids) {
        const summary = byId[id]
        if (!isRecord(summary)) continue
        const projection = projectionsBySession[id]
        const values = projection !== undefined && isRecord(projection.values) ? projection.values : null
        const status = statusMap instanceof Map ? statusMap.get(id) : undefined
        rows.push(deriveRow({ id, summary, values, status, projectionsBySession, nowMs, prices }))
      }
      return rows
    }

    function compareRows(sort) {
      switch (sort) {
        case 'pending':
          return (left, right) => (right.pendingCount - left.pendingCount) || (right.runtimeMs - left.runtimeMs)
        case 'recent':
          return (left, right) => right.updatedAt - left.updatedAt
        case 'title':
          return (left, right) => left.title.localeCompare(right.title)
        case 'runtime':
        default:
          return (left, right) => (right.runtimeMs - left.runtimeMs) || (right.updatedAt - left.updatedAt)
      }
    }

    function selectRows(rows, prefs) {
      const filtered = prefs.filter === 'all' ? rows.slice() : rows.filter((row) => row.state === prefs.filter)
      filtered.sort(compareRows(prefs.sort))
      return filtered
    }

    function countByState(rows) {
      const counts = { all: rows.length, working: 0, waiting: 0, completed: 0, error: 0, idle: 0 }
      for (const row of rows) counts[row.state] += 1
      return counts
    }

    function buildFeed(rows) {
      const items = []
      for (const row of rows) {
        for (const entry of row.recent) {
          if (!isRecord(entry)) continue
          const at = finite(entry.at)
          if (at <= 0) continue
          items.push({
            key: `${row.id}:${finite(entry.seq)}:${at}`,
            sessionId: row.id,
            title: row.title,
            kind: typeof entry.kind === 'string' ? entry.kind : '',
            label: typeof entry.label === 'string' ? entry.label : '',
            at,
          })
        }
      }
      items.sort((left, right) => right.at - left.at)
      return items.slice(0, 40)
    }

    function feedText(item, t) {
      if (item.kind === 'tool') return t('feed.tool', { name: item.label })
      if (item.kind === 'tool-error') return t('feed.toolError', { name: item.label })
      if (item.kind === 'prompt') return t('feed.prompt', { text: item.label })
      if (item.kind === 'turn-end') return t('feed.turnEnd', { outcome: outcomeLabel(item.label, t) })
      return item.label
    }

    function timerText(row, now, t, locale) {
      switch (row.state) {
        case 'working':
          return row.openStartedAt > 0
            ? t('timer.running', { value: formatDuration(now - row.openStartedAt) })
            : t('timer.running', { value: formatDuration(row.runtimeMs) })
        case 'waiting':
          return row.openStartedAt > 0
            ? t('timer.waiting', { value: formatDuration(now - row.openStartedAt) })
            : t('state.waiting')
        case 'completed':
          return row.lastTurnRunMs > 0
            ? t('timer.lastTask', { value: formatDuration(row.lastTurnRunMs) })
            : t('state.completed')
        case 'error':
          return row.lastTurnEndedAt > 0
            ? t('timer.ended', { value: relativeTime(row.lastTurnEndedAt, now, locale) })
            : t('state.error')
        default:
          return row.updatedAt > 0
            ? t('timer.idle', { value: relativeTime(row.updatedAt, now, locale) })
            : t('timer.noActivity')
      }
    }

    // ---------------------------------------------------------------------
    // Icons
    // ---------------------------------------------------------------------

    function radarGlyph(size, strokeWidth) {
      return [
        h('circle', {
          key: 'ring',
          cx: 18,
          cy: 18,
          r: 10.5,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth,
          opacity: 0.5,
        }),
        h('path', {
          key: 'needle',
          d: 'M18 18 L25 11',
          stroke: 'currentColor',
          strokeWidth,
          strokeLinecap: 'round',
        }),
        h('circle', { key: 'core', cx: 18, cy: 18, r: 2.5, fill: 'currentColor' }),
        h('circle', { key: 'blip', cx: 22.6, cy: 22.4, r: 1.6, fill: 'currentColor', opacity: 0.75 }),
      ]
    }

    function PanelIcon(props) {
      const size = typeof props.size === 'number' && props.size > 0 ? props.size : 16
      return h('svg', {
        width: size,
        height: size,
        viewBox: '0 0 36 36',
        role: 'img',
        'aria-hidden': 'true',
        focusable: 'false',
        style: { display: 'block' },
      }, radarGlyph(size, 2.2))
    }

    function SettingsIcon() {
      return h('svg', {
        width: 16,
        height: 16,
        viewBox: '0 0 20 20',
        'aria-hidden': 'true',
        focusable: 'false',
        style: { display: 'block' },
      },
      h('circle', { cx: 10, cy: 10, r: 3, fill: 'none', stroke: 'currentColor', strokeWidth: 1.6 }),
      h('path', {
        d: 'M10 1.8v2.4M10 15.8v2.4M1.8 10h2.4M15.8 10h2.4M4.2 4.2l1.7 1.7M14.1 14.1l1.7 1.7M15.8 4.2l-1.7 1.7M5.9 14.1l-1.7 1.7',
        stroke: 'currentColor',
        strokeWidth: 1.6,
        strokeLinecap: 'round',
      }))
    }

    // ---------------------------------------------------------------------
    // Components
    // ---------------------------------------------------------------------

    function StateDot(props) {
      return h('span', {
        className: 'dsh-mc-dot',
        'data-state': props.state,
        'aria-hidden': 'true',
      })
    }

    function SessionCard(props) {
      const { row, now, prefs, t, locale, onOpen } = props
      const timer = timerText(row, now, t, locale)
      const tools = row.toolCalls === null ? '—' : formatCount(row.toolCalls)
      const tasks = row.turnsCompleted === null ? '—' : formatCount(row.turnsCompleted)
      const pending = formatCount(row.pendingCount)
      const cost = row.cost === null ? '' : formatCost(row.cost)

      const stats = [
        h('span', { key: 'tools', className: 'dsh-mc-stat', title: t('tooltip.tools') },
          h('b', null, tools), h('span', null, t('stat.tools'))),
        h('span', { key: 'tasks', className: 'dsh-mc-stat', title: t('tooltip.tasks') },
          h('b', null, tasks), h('span', null, t('stat.tasks'))),
        h('span', { key: 'pending', className: 'dsh-mc-stat', title: t('tooltip.pending') },
          h('b', null, pending), h('span', null, t('stat.pending'))),
      ]

      const foot = []
      if (row.tokens !== null) {
        foot.push(h('span', { key: 'tokens', className: 'dsh-mc-chip', title: t('tooltip.tokens') },
          `${formatTokens(row.tokens)} tok`))
      }
      if (row.cost !== null) {
        foot.push(h('span', { key: 'cost', className: 'dsh-mc-chip dsh-mc-chip-cost', title: t('tooltip.cost') }, `≈ ${cost}`))
      }
      if (row.failedToolCalls > 0) {
        foot.push(h('span', { key: 'failed', className: 'dsh-mc-chip dsh-mc-chip-warn' },
          `${formatTokens(row.failedToolCalls)} ✕`))
      }

      const meta = row.model === '' ? t('model.unknown') : row.model

      return h('button', {
        type: 'button',
        className: 'dsh-mc-card',
        'data-state': row.state,
        'data-needs': row.needsYou ? 'true' : 'false',
        'data-unread': row.unread ? 'true' : 'false',
        onClick: () => onOpen(row),
        title: t('openSession'),
      },
      h('span', { className: 'dsh-mc-card-top' },
        h(StateDot, { state: row.state }),
        h('span', { className: 'dsh-mc-state' }, t(`state.${row.state}`)),
        row.needsYou ? h('span', { className: 'dsh-mc-need' }, needLabel(row.needKind, t)) : null,
        row.subagent && !prefs.dense ? h('span', { className: 'dsh-mc-tag' }, t('subagent')) : null,
        h('span', { className: 'dsh-mc-spacer' }),
        h('span', { className: 'dsh-mc-timer' }, timer)),
      h('span', { className: 'dsh-mc-card-title' }, row.title),
      prefs.dense ? null : h('span', { className: 'dsh-mc-card-meta' },
        h('span', { className: 'dsh-mc-model' }, meta),
        row.agentPreset !== '' ? h('span', { className: 'dsh-mc-preset' }, row.agentPreset) : null),
      h('span', { className: 'dsh-mc-stats' }, stats),
      foot.length > 0 ? h('span', { className: 'dsh-mc-foot' }, foot) : null)
    }

    function FeedRow(props) {
      const { item, t, locale, onOpen } = props
      return h('li', { className: 'dsh-mc-feed-item' },
        h('button', {
          type: 'button',
          className: 'dsh-mc-feed-row',
          onClick: () => onOpen(item.sessionId),
          title: item.title,
        },
        h('span', { className: 'dsh-mc-feed-time' }, clockTime(item.at, locale)),
        h('span', { className: 'dsh-mc-feed-main' },
          h('span', { className: 'dsh-mc-feed-title' }, item.title),
          h('span', { className: 'dsh-mc-feed-label' }, feedText(item, t)))))
    }

    function SettingsPanel(props) {
      const { prefs, t, onChange, onReset } = props
      const fields = [
        ['input', 'settings.input'],
        ['output', 'settings.output'],
        ['cacheRead', 'settings.cacheRead'],
        ['cacheWrite', 'settings.cacheWrite'],
      ]
      return h('div', { className: 'dsh-mc-settings', role: 'group', 'aria-label': t('settings') },
        h('label', { className: 'dsh-mc-check' },
          h('input', {
            type: 'checkbox',
            checked: prefs.dense,
            onChange: (event) => onChange({ dense: event.target.checked }),
          }),
          h('span', null, t('settings.dense'))),
        h('p', { className: 'dsh-mc-settings-title' }, t('settings.prices')),
        h('p', { className: 'dsh-mc-hint' }, t('settings.pricesHint')),
        h('div', { className: 'dsh-mc-prices' },
          fields.map(([key, labelKey]) => h('label', { key, className: 'dsh-mc-price' },
            h('span', { className: 'dsh-mc-price-label' }, t(labelKey)),
            h('input', {
              type: 'text',
              inputMode: 'decimal',
              value: prefs.prices[key],
              placeholder: '—',
              onChange: (event) => onChange({ prices: { ...prefs.prices, [key]: normalizePriceText(event.target.value) } }),
            })))),
        h('button', { type: 'button', className: 'dsh-mc-text-btn', onClick: onReset }, t('settings.reset')))
    }

    // Stable empty values keep the selector snapshots identical before the
    // standard props exist (this page always has them; the constants only
    // protect a degraded composition).
    const EMPTY_IDS = []
    const EMPTY_BY_ID = {}
    const EMPTY_PROJECTIONS = {}
    const EMPTY_STATUS = new Map()
    const EMPTY_LIST_STATE = {
      ids: EMPTY_IDS,
      byId: EMPTY_BY_ID,
      phase: 'ready',
      projectionsBySession: EMPTY_PROJECTIONS,
    }
    /** Fallback selectors: props never change identity, so hook order stays stable. */
    const useNoSessions = (selector) => selector(EMPTY_LIST_STATE)
    const useNoStatus = (selector) => selector(EMPTY_STATUS)

    function MissionControlPanel(props) {
      const { useSessions, useSessionStatus, openSession } = props
      const [prefs, setPrefs] = React.useState(loadPrefs)
      const [now, setNow] = React.useState(() => Date.now())
      const [navigationError, setNavigationError] = React.useState('')
      const language = prefs.language === 'es' ? 'es' : 'en'
      const t = React.useMemo(() => translateFor(language), [language])

      const hooksReady = typeof useSessions === 'function' && typeof useSessionStatus === 'function'
      const selectSessions = typeof useSessions === 'function' ? useSessions : useNoSessions
      const selectStatus = typeof useSessionStatus === 'function' ? useSessionStatus : useNoStatus
      const ids = selectSessions((state) => state.ids)
      const byId = selectSessions((state) => state.byId)
      const projectionsBySession = selectSessions((state) => state.projectionsBySession)
      const phase = selectSessions((state) => state.phase)
      const statusMap = selectStatus((state) => state)

      const update = React.useCallback((patch) => {
        setPrefs((previous) => {
          const next = { ...previous, ...patch }
          savePrefs(next)
          return next
        })
      }, [])

      const prices = React.useMemo(() => pricesOf(prefs), [prefs.prices])
      const rows = React.useMemo(
        () => (hooksReady ? buildRows({ ids, byId, projectionsBySession, statusMap, nowMs: Date.now(), prices }) : []),
        [hooksReady, ids, byId, projectionsBySession, statusMap, prices],
      )
      const filtered = React.useMemo(() => selectRows(rows, prefs), [rows, prefs.filter, prefs.sort])
      const counts = React.useMemo(() => countByState(rows), [rows])
      const feed = React.useMemo(() => buildFeed(rows), [rows])

      const needsRows = rows.filter((row) => row.needsYou)
      const anyLive = rows.some((row) => row.state === 'working' || row.state === 'waiting')

      React.useEffect(() => {
        const delay = anyLive ? 1000 : 15000
        const handle = window.setInterval(() => setNow(Date.now()), delay)
        return () => window.clearInterval(handle)
      }, [anyLive])

      const locale = language
      const openRow = React.useCallback((row) => {
        if (typeof openSession !== 'function' || row === null || typeof row !== 'object') return
        setNavigationError('')
        try {
          if (typeof row.parentId === 'string' && row.parentId !== '') {
            openSession({
              kind: 'subagent',
              parentSessionId: row.parentId,
              childSessionId: row.id,
              mode: row.subagentMode === undefined ? 'unknown' : row.subagentMode,
            })
            return
          }
          openSession(row.id)
        } catch (error) {
          setNavigationError(t('error.navigate'))
          console.error('[mission-control] open session failed', error)
        }
      }, [openSession, t])

      const openSessionId = React.useCallback((sessionId) => {
        const row = rows.find((candidate) => candidate.id === sessionId)
        if (row === undefined) {
          if (typeof openSession === 'function') openSession(sessionId)
          return
        }
        openRow(row)
      }, [rows, openRow, openSession])

      if (!hooksReady) {
        return h('div', { className: 'dsh-mc-page' },
          h('style', { key: 'styles' }, CSS),
          h('div', { className: 'dsh-mc-head' }, h('h1', { className: 'dsh-mc-title' }, t('title'))),
          h('p', { className: 'dsh-mc-empty' }, t('unavailable')))
      }

      const loading = phase === 'pending' && rows.length === 0
      const body = loading
        ? h('p', { className: 'dsh-mc-empty' }, t('loading'))
        : filtered.length === 0
          ? h('p', { className: 'dsh-mc-empty' }, counts.all === 0 ? t('empty.none') : t('empty.filtered'))
          : h('div', { className: 'dsh-mc-grid', 'data-dense': prefs.dense ? 'true' : 'false' },
            filtered.map((row) => h(SessionCard, {
              key: row.id,
              row,
              now,
              prefs,
              t,
              locale,
              onOpen: openRow,
            })))

      return h('div', { className: 'dsh-mc-page' },
        h('style', { key: 'styles' }, CSS),
        h('header', { className: 'dsh-mc-head' },
          h('div', { className: 'dsh-mc-heading' },
            h('h1', { className: 'dsh-mc-title' }, t('title')),
            h('p', { className: 'dsh-mc-subtitle' }, t('subtitle'))),
          h('div', { className: 'dsh-mc-head-actions' },
            h('span', { className: 'dsh-mc-live' },
              h('span', { className: 'dsh-mc-live-dot', 'aria-hidden': 'true' }),
              t('live')),
            h('div', { className: 'dsh-mc-lang', role: 'group', 'aria-label': t('language.label') },
              LANGUAGES.map((code) => h('button', {
                key: code,
                type: 'button',
                className: 'dsh-mc-lang-btn',
                'aria-pressed': language === code ? 'true' : 'false',
                'aria-label': t(`language.${code}`),
                title: t(`language.${code}`),
                onClick: () => update({ language: code }),
              }, code.toUpperCase()))),
            h('button', {
              type: 'button',
              className: 'dsh-mc-icon-btn',
              'aria-expanded': prefs.settingsOpen ? 'true' : 'false',
              'aria-label': t('settings'),
              title: t('settings'),
              onClick: () => update({ settingsOpen: !prefs.settingsOpen }),
            }, h(SettingsIcon)))),
        prefs.settingsOpen ? h(SettingsPanel, {
          prefs,
          t,
          onChange: update,
          onReset: () => {
            const reset = defaultPrefs()
            savePrefs(reset)
            setPrefs(reset)
          },
        }) : null,
        h('div', { className: 'dsh-mc-scroll' },
          h('div', { className: 'dsh-mc-toolbar' },
            h('div', { className: 'dsh-mc-chips', role: 'group', 'aria-label': t('filter.label') },
              FILTERS.map((filter) => h('button', {
                key: filter,
                type: 'button',
                className: 'dsh-mc-chip-btn',
                'aria-pressed': prefs.filter === filter ? 'true' : 'false',
                onClick: () => update({ filter }),
              },
              t(`filter.${filter}`),
              h('span', { className: 'dsh-mc-chip-count' }, String(counts[filter]))))),
            h('label', { className: 'dsh-mc-sort' },
              h('span', { className: 'dsh-mc-sort-label' }, t('sort.label')),
              h('select', {
                className: 'dsh-mc-select',
                value: prefs.sort,
                'aria-label': t('sort.label'),
                onChange: (event) => update({ sort: event.target.value }),
              }, SORTS.map((sort) => h('option', { key: sort, value: sort }, t(`sort.${sort}`)))))),
          needsRows.length > 0
            ? h('div', { className: 'dsh-mc-alert', role: 'status' },
              h('span', { className: 'dsh-mc-alert-dot', 'aria-hidden': 'true' }),
              h('div', { className: 'dsh-mc-alert-body' },
                h('span', { className: 'dsh-mc-alert-text' }, t('needsBanner', { count: needsRows.length })),
                h('span', { className: 'dsh-mc-alert-names' }, needsRows.map((row) => row.title).join(' · '))),
              h('button', {
                type: 'button',
                className: 'dsh-mc-text-btn',
                onClick: () => update({ filter: 'waiting' }),
              }, t('seeWaiting')))
            : null,
          navigationError !== '' ? h('p', { className: 'dsh-mc-error' }, navigationError) : null,
          h('div', { className: 'dsh-mc-body' },
            h('section', { className: 'dsh-mc-main', 'aria-label': t('sessions') }, body),
            h('aside', { className: 'dsh-mc-side' },
              h('div', { className: 'dsh-mc-side-head' },
                h('h2', { className: 'dsh-mc-side-title' }, t('activity.title')),
                h('span', { className: 'dsh-mc-side-sub' }, t('activity.subtitle'))),
              feed.length === 0
                ? h('p', { className: 'dsh-mc-empty dsh-mc-empty-side' }, t('activity.empty'))
                : h('ul', { className: 'dsh-mc-feed' },
                  feed.map((item) => h(FeedRow, {
                    key: item.key,
                    item,
                    t,
                    locale,
                    onOpen: openSessionId,
                  }))))),
          h('p', { className: 'dsh-mc-footnote' }, t('footnote'))))
    }

    // ---------------------------------------------------------------------
    // Styles
    // ---------------------------------------------------------------------

    const CSS = `
.dsh-mc-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  box-sizing: border-box;
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-base);
}
.dsh-mc-head {
  display: flex;
  flex: none;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  box-sizing: border-box;
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
  padding: 28px 32px 12px;
}
[data-platform='darwin'] .dsh-mc-head {
  padding-top: calc(28px + var(--dsh-frame-top-clearance, 0px));
}
.dsh-mc-heading { min-width: 0; }
.dsh-mc-title {
  margin: 0;
  font-size: 20px;
  line-height: 28px;
  font-weight: 500;
}
.dsh-mc-subtitle {
  margin: 4px 0 0;
  max-width: 68ch;
  font-size: 13px;
  line-height: 20px;
  color: var(--dsw-alias-label-secondary);
  overflow-wrap: anywhere;
}
.dsh-mc-head-actions {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 12px;
}
.dsh-mc-live {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary);
  white-space: nowrap;
}
.dsh-mc-live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--dsw-alias-state-success-primary);
  animation: dsh-mc-pulse 2.4s ease-in-out infinite;
}
@keyframes dsh-mc-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.45; }
}
@media (prefers-reduced-motion: reduce) {
  .dsh-mc-live-dot { animation: none; }
}
.dsh-mc-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: var(--dsw-radius-sm, 6px);
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
}
.dsh-mc-icon-btn:hover { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
.dsh-mc-icon-btn:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: 1px;
}
.dsh-mc-lang {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border: 0.5px solid var(--dsw-alias-border-l1);
  border-radius: 999px;
  background: var(--dsw-alias-bg-layer-1);
}
.dsh-mc-lang-btn {
  min-width: 26px;
  height: 20px;
  padding: 0 6px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.02em;
  line-height: 20px;
  cursor: pointer;
}
.dsh-mc-lang-btn:hover { color: var(--dsw-alias-label-primary); }
.dsh-mc-lang-btn[aria-pressed='true'] {
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 14%, transparent);
  color: var(--dsw-alias-brand-primary);
}
.dsh-mc-lang-btn:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: 1px;
}
.dsh-mc-settings {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 12px 24px;
  box-sizing: border-box;
  width: calc(100% - 64px);
  max-width: 1116px;
  margin: 0 auto 8px;
  padding: 14px 16px;
  border: 0.5px solid var(--dsw-alias-border-l1);
  border-radius: var(--dsw-radius-lg, 10px);
  background: var(--dsw-alias-bg-layer-1);
}
.dsh-mc-settings-title {
  flex-basis: 100%;
  margin: 0;
  font-size: 13px;
  line-height: 20px;
  font-weight: 500;
}
.dsh-mc-hint {
  flex-basis: 100%;
  margin: 0;
  max-width: 76ch;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary);
}
.dsh-mc-check {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  line-height: 20px;
  cursor: pointer;
}
.dsh-mc-check input { accent-color: var(--dsw-alias-brand-primary); width: 15px; height: 15px; margin: 0; }
.dsh-mc-prices {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.dsh-mc-price {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary);
}
.dsh-mc-price input {
  width: 96px;
  height: 30px;
  box-sizing: border-box;
  padding: 0 9px;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: var(--dsw-radius-md, 8px);
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
.dsh-mc-price input:focus {
  outline: none;
  border-color: var(--dsw-alias-brand-primary);
  box-shadow: inset 0 0 0 0.5px var(--dsw-alias-brand-primary);
}
@media (pointer: coarse) {
  .dsh-mc-price input { font-size: 16px; }
}
.dsh-mc-text-btn {
  padding: 0;
  border: 0;
  background: none;
  color: var(--dsw-alias-brand-primary);
  font: inherit;
  font-size: 13px;
  line-height: 20px;
  cursor: pointer;
}
.dsh-mc-text-btn:hover { text-decoration: underline; text-underline-offset: 3px; }
.dsh-mc-text-btn:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 2px; }
.dsh-mc-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  box-sizing: border-box;
  width: 100%;
  padding: 0 32px 40px;
}
.dsh-mc-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 16px;
  max-width: 1116px;
  margin: 0 auto 12px;
}
.dsh-mc-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.dsh-mc-chip-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  border: 0.5px solid var(--dsw-alias-border-l1);
  border-radius: 999px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 12.5px;
  line-height: 18px;
  cursor: pointer;
}
.dsh-mc-chip-btn:hover { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
.dsh-mc-chip-btn[aria-pressed='true'] {
  border-color: var(--dsw-alias-brand-primary);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, transparent);
  color: var(--dsw-alias-label-primary);
}
.dsh-mc-chip-btn:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
.dsh-mc-chip-count {
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-secondary);
  opacity: 0.85;
}
.dsh-mc-sort {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary);
}
.dsh-mc-select {
  height: 28px;
  padding: 0 8px;
  border: 0.5px solid var(--dsw-alias-border-l1);
  border-radius: var(--dsw-radius-md, 8px);
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12.5px;
}
.dsh-mc-select:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
.dsh-mc-alert {
  display: flex;
  align-items: center;
  gap: 10px;
  box-sizing: border-box;
  max-width: 1116px;
  margin: 0 auto 12px;
  padding: 10px 14px;
  border: 0.5px solid color-mix(in srgb, var(--dsw-alias-state-warn-primary) 45%, transparent);
  border-radius: var(--dsw-radius-lg, 10px);
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 10%, transparent);
}
.dsh-mc-alert-dot {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--dsw-alias-state-warn-primary);
}
.dsh-mc-alert-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.dsh-mc-alert-text { font-size: 13px; line-height: 20px; font-weight: 500; }
.dsh-mc-alert-names {
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh-mc-alert .dsh-mc-text-btn { margin-left: auto; flex: none; }
.dsh-mc-error {
  max-width: 1116px;
  margin: 0 auto 12px;
  font-size: 12.5px;
  line-height: 18px;
  color: var(--dsw-alias-state-error-primary);
}
.dsh-mc-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 24px;
  align-items: start;
  max-width: 1116px;
  margin: 0 auto;
}
.dsh-mc-main { min-width: 0; }
.dsh-mc-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(268px, 1fr));
  gap: 12px;
}
.dsh-mc-grid[data-dense='true'] { grid-template-columns: repeat(auto-fill, minmax(232px, 1fr)); gap: 8px; }
.dsh-mc-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-sizing: border-box;
  min-width: 0;
  padding: 12px 14px;
  border: 0.5px solid var(--dsw-alias-border-l1);
  border-radius: var(--dsw-radius-lg, 10px);
  background: var(--dsw-alias-bg-layer-1);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.dsh-mc-grid[data-dense='true'] .dsh-mc-card { padding: 9px 11px; gap: 6px; }
.dsh-mc-card:hover { background: var(--dsw-alias-bg-layer-2); }
.dsh-mc-card:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: 2px;
}
.dsh-mc-card[data-needs='true'] {
  border-color: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 55%, transparent);
  box-shadow: inset 3px 0 0 var(--dsw-alias-state-warn-primary);
}
.dsh-mc-card[data-unread='true'] .dsh-mc-card-title { font-weight: 600; }
.dsh-mc-card-top {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 11.5px;
  line-height: 16px;
  color: var(--dsw-alias-label-secondary);
}
.dsh-mc-dot {
  flex: none;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--dsw-alias-state-idle-primary);
}
.dsh-mc-dot[data-state='working'] { background: var(--dsw-alias-brand-primary); }
.dsh-mc-dot[data-state='waiting'] { background: var(--dsw-alias-state-warn-primary); }
.dsh-mc-dot[data-state='completed'] { background: var(--dsw-alias-state-success-primary); }
.dsh-mc-dot[data-state='error'] { background: var(--dsw-alias-state-error-primary); }
.dsh-mc-state { font-weight: 500; color: var(--dsw-alias-label-primary); }
.dsh-mc-card[data-state='waiting'] .dsh-mc-state { color: var(--dsw-alias-state-warn-primary); }
.dsh-mc-card[data-state='error'] .dsh-mc-state { color: var(--dsw-alias-state-error-primary); }
.dsh-mc-need {
  flex: none;
  padding: 0 6px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 16%, transparent);
  color: var(--dsw-alias-label-primary);
  white-space: nowrap;
}
.dsh-mc-tag {
  flex: none;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary);
}
.dsh-mc-spacer { flex: 1; }
.dsh-mc-timer {
  flex: none;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-secondary);
  white-space: nowrap;
}
.dsh-mc-card-title {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  overflow-wrap: anywhere;
}
.dsh-mc-card-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary);
}
.dsh-mc-model {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh-mc-preset {
  flex: none;
  padding: 0 6px;
  border-radius: 4px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
}
.dsh-mc-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary);
}
.dsh-mc-stat { display: inline-flex; align-items: baseline; gap: 4px; }
.dsh-mc-stat b {
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-primary);
}
.dsh-mc-foot { display: flex; flex-wrap: wrap; gap: 6px; }
.dsh-mc-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  line-height: 16px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.dsh-mc-chip-cost { color: var(--dsw-alias-label-primary); }
.dsh-mc-chip-warn { color: var(--dsw-alias-state-warn-primary); }
.dsh-mc-side {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  padding: 12px 14px;
  border: 0.5px solid var(--dsw-alias-border-l1);
  border-radius: var(--dsw-radius-lg, 10px);
  background: var(--dsw-alias-bg-layer-1);
}
.dsh-mc-side-head { display: flex; flex-direction: column; gap: 2px; }
.dsh-mc-side-title { margin: 0; font-size: 14px; line-height: 20px; font-weight: 500; }
.dsh-mc-side-sub { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }
.dsh-mc-feed { display: flex; flex-direction: column; gap: 1px; margin: 0; padding: 0; list-style: none; }
.dsh-mc-feed-item { min-width: 0; }
.dsh-mc-feed-row {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  gap: 8px;
  width: 100%;
  box-sizing: border-box;
  padding: 6px 6px;
  margin: 0 -6px;
  border: 0;
  border-radius: var(--dsw-radius-sm, 6px);
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.dsh-mc-feed-row:hover { background: var(--dsw-alias-bg-layer-2); }
.dsh-mc-feed-row:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -2px; }
.dsh-mc-feed-time {
  font-size: 11px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary);
  font-variant-numeric: tabular-nums;
}
.dsh-mc-feed-main { display: flex; flex-direction: column; min-width: 0; }
.dsh-mc-feed-title {
  font-size: 12.5px;
  line-height: 18px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh-mc-feed-label {
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh-mc-empty {
  margin: 24px 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--dsw-alias-label-secondary);
}
.dsh-mc-empty-side { margin: 8px 0 4px; font-size: 12.5px; }
.dsh-mc-footnote {
  max-width: 1116px;
  margin: 24px auto 0;
  font-size: 11.5px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary);
  opacity: 0.9;
}
@media (max-width: 1100px) {
  .dsh-mc-body { grid-template-columns: minmax(0, 1fr); }
  .dsh-mc-head { padding-inline: 24px; }
  .dsh-mc-scroll { padding-inline: 24px; }
  .dsh-mc-settings { width: calc(100% - 48px); }
}
@media (max-width: 640px) {
  .dsh-mc-head { flex-wrap: wrap; }
  .dsh-mc-grid { grid-template-columns: minmax(0, 1fr); }
}
`

    // ---------------------------------------------------------------------
    // Plugin
    // ---------------------------------------------------------------------

    return {
      inject: ['slots', 'locale', 'uiWorkspace'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { en, es }), 'mission-control: dictionaries')
        const t = ctx.locale.bind(NS)

        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: PANEL_ID,
          locale: NS,
          inject: () => ({
            openSession: (target) => ctx.uiWorkspace.openSession(target),
          }),
        }, MissionControlPanel))

        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: SIDEBAR_ORDER,
          label: () => t('panel'),
          locale: NS,
        }, PanelIcon))
      },
    }
  },
})
