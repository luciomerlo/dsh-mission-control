/**
 * Mission Control — Host half.
 *
 * The dashboard's per-session counters are a `sessionProjections` unit: the
 * framework drives the fold over committed Session events, checkpoints it, and
 * publishes the client view through the Session Controller's existing control
 * stream. Nothing here subscribes to events, polls an agent, or adds a Session
 * event type, and no prompt is sent on the dashboard's behalf.
 *
 * The Browser half (./client.js) reads the published value from
 * `useSessions().projectionsBySession`; it already receives every live Session's
 * full projection set from the control baseline, so this plugin adds no Remote
 * method and no HTTP route.
 *
 * `wire.summary` is false: Session list rows keep their documented summary key
 * set, so the dashboard's counters ride only the control/follow baselines of
 * Sessions that are live in the Host.
 */
import {
  MISSION_CONTROL_KEY,
  PROJECTION_STATE_VERSION,
  applyEvent,
  initState,
  stateSchema,
  viewOf,
  viewSchema,
} from './projection-fold.js'

export const inject = ['sessionProjections']

/**
 * Register the projection unit for the lifetime of this plugin.
 * @param {import('@deepseek-ai/cordis').Context} ctx - Host plugin context.
 */
export function apply(ctx) {
  void ctx.sessionProjections.register({
    key: MISSION_CONTROL_KEY,
    stateVersion: PROJECTION_STATE_VERSION,
    stateSchema,
    init: initState,
    apply: applyEvent,
    wire: {
      viewSchema,
      view: viewOf,
      summary: false,
    },
  })
}
