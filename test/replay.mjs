/**
 * Replays real Session logs from this machine through the Mission Control fold
 * and compares the counters with an independent scan of the same decoded log.
 *
 * Usage:
 *   node test/replay.mjs [sessionsDirectory] [sessionsToCheck]
 *
 * The logs are `session.v4.jsonl.zstd`, one zstd frame per record, so the script
 * scans frame magics and decodes each frame on its own. This is a development
 * verification aid, not a runtime dependency.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import zlib from 'node:zlib'

import { applyEvent, initState, viewOf } from '../projection-fold.js'

const MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])

function decodeRecords(path) {
  const buffer = readFileSync(path)
  const offsets = []
  let index = buffer.indexOf(MAGIC, 0)
  while (index >= 0) {
    offsets.push(index)
    index = buffer.indexOf(MAGIC, index + 4)
  }
  const records = []
  for (const offset of offsets) {
    let out
    try {
      out = zlib.zstdDecompressSync(buffer.subarray(offset))
    } catch {
      continue
    }
    for (const line of out.toString('utf8').split('\n')) {
      if (line.trim() === '') continue
      try {
        records.push(JSON.parse(line))
      } catch {
        // A candidate magic inside compressed bytes is not a record boundary.
      }
    }
  }
  return records
}

function sessionLogs(root) {
  const found = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const directory = join(root, entry.name)
    for (const file of readdirSync(directory)) {
      if (!file.startsWith('session.v') || !file.endsWith('.jsonl.zstd')) continue
      const path = join(directory, file)
      found.push({ directory: entry.name, path, size: statSync(path).size, mtime: statSync(path).mtimeMs })
    }
  }
  found.sort((left, right) => right.mtime - left.mtime)
  return found
}

function foldSession(records) {
  const header = records.find((record) => (record.event ?? record).type === 'session')
  const events = records
    .map((record) => record.event ?? record)
    .filter((event) => event.type !== 'session')
  const state = events.reduce((current, event) => applyEvent(current, event), initState())
  return { header: header ?? {}, events, state, view: viewOf(state) }
}

function independentCounts(events) {
  let toolCalls = 0
  let failedTools = 0
  let completed = 0
  let failed = 0
  let openTurn = 0
  let runMs = 0
  let openAt = 0
  for (const event of events) {
    if (event.type === 'tool/call') toolCalls += 1
    if (event.type === 'tool/result' && event.data?.message?.isError === true) failedTools += 1
    if (event.type === 'turn/start') {
      openTurn += 1
      openAt = event.time
    }
    if (event.type === 'turn/end') {
      openTurn -= 1
      if (event.data?.reason?.kind === 'completed') completed += 1
      if (event.data?.reason?.kind === 'error' || event.data?.reason?.kind === 'blocked') failed += 1
      if (openAt > 0) runMs += Math.max(0, event.time - openAt)
      openAt = 0
    }
  }
  return { toolCalls, failedTools, completed, failed, openTurns: openTurn, runMs }
}

const root = process.argv[2] ?? 'C:\\Users\\Lucio\\.dsh\\sessions\\--C-Proyectos--'
const wanted = Number(process.argv[3] ?? 3)
const logs = sessionLogs(root).slice(0, wanted)

if (logs.length === 0) {
  console.error(`no session logs under ${root}`)
  process.exit(1)
}

let failures = 0
for (const log of logs) {
  const records = decodeRecords(log.path)
  if (records.length === 0) {
    console.error(`!! ${log.directory}: no decodable records`)
    failures += 1
    continue
  }
  const { header, events, state, view } = foldSession(records)
  const counts = independentCounts(events)

  const problems = []
  if (view.toolCalls !== counts.toolCalls) problems.push(`toolCalls ${view.toolCalls} !== ${counts.toolCalls}`)
  if (view.failedToolCalls !== counts.failedTools) problems.push(`failedToolCalls ${view.failedToolCalls} !== ${counts.failedTools}`)
  if (view.turnsCompleted !== counts.completed) problems.push(`turnsCompleted ${view.turnsCompleted} !== ${counts.completed}`)
  if (view.turnsFailed !== counts.failed) problems.push(`turnsFailed ${view.turnsFailed} !== ${counts.failed}`)
  if (view.runMs !== counts.runMs) problems.push(`runMs ${view.runMs} !== ${counts.runMs}`)
  if ((view.openTurnStartedAt > 0 ? 1 : 0) !== (counts.openTurns > 0 ? 1 : 0)) {
    problems.push(`open turn mismatch ${view.openTurnStartedAt} vs ${counts.openTurns}`)
  }
  if (problems.length > 0) failures += 1

  console.log(`\n=== ${log.directory} (${(log.size / 1024).toFixed(0)} KiB, ${records.length} records) ===`)
  console.log(`title       ${header.id ?? '?'}  preset=${header.agentPreset ?? '-'}  cwd=${header.cwd ?? '-'}`)
  console.log(`toolCalls   ${view.toolCalls} (failed ${view.failedToolCalls})  turns ${view.turnsCompleted} completed / ${view.turnsFailed} failed`)
  console.log(`lastTurn    ${view.lastTurnOutcome || '(none)'}  runMs=${view.runMs} lastRunMs=${view.lastTurnRunMs} openTurn=${view.openTurn}`)
  console.log(`error       ${view.lastError || '(none)'}  recent=${view.recent.length}`)
  console.log(`stateRef    ${state.recent.length} recent entries kept`)
  console.log(problems.length === 0 ? 'result      OK' : `result      MISMATCH: ${problems.join('; ')}`)
}

console.log(`\nchecked ${logs.length} sessions, ${failures} mismatch(es)`)
process.exit(failures === 0 ? 0 : 1)
