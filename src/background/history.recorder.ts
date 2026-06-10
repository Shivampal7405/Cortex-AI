/**
 * history.recorder.ts
 * Persists usage snapshots to extension-origin IndexedDB.
 * Powers the 52-week heatmap in HistoryView.
 * Runs in background service worker only — never from content scripts.
 */

import { openDB } from 'idb'

const DB_NAME    = 'cortex-history'
const DB_VERSION = 1
const STORE      = 'snapshots'

export interface UsageSnapshot {
  id:        string
  provider:  string
  pct:       number
  tokens:    number
  cost_usd:  number
  date:      string    // YYYY-MM-DD
  timestamp: number
}

async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const store = db.createObjectStore(STORE, { keyPath: 'id' })
      store.createIndex('provider',  'provider')
      store.createIndex('date',      'date')
      store.createIndex('timestamp', 'timestamp')
    },
  })
}

export async function recordSnapshot(snapshot: UsageSnapshot): Promise<void> {
  const db = await getDB()
  await db.put(STORE, snapshot)
}

export async function getHeatmapData(provider: string): Promise<Record<string, number>> {
  const db      = await getDB()
  const all     = await db.getAll(STORE)
  const heatmap: Record<string, number> = {}

  for (const snap of all) {
    const s = snap as UsageSnapshot
    if (s.provider !== provider) continue
    heatmap[s.date] = Math.max(heatmap[s.date] ?? 0, s.pct)
  }

  return heatmap
}

export async function pruneOldSnapshots(): Promise<void> {
  const db     = await getDB()
  const all    = await db.getAll(STORE)
  const cutoff = Date.now() - 365 * 24 * 60 * 60 * 1000

  for (const snap of all) {
    const s = snap as UsageSnapshot
    if (s.timestamp < cutoff) await db.delete(STORE, s.id)
  }
}
