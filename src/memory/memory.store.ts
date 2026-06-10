/**
 * memory.store.ts
 * Memory fact storage via chrome.storage.local.
 * All reads/writes go through chrome.storage — never IndexedDB.
 * This ensures popup and content scripts share the same data.
 * IndexedDB is origin-scoped — chrome.storage is extension-scoped.
 */

import type { MemoryFact, ProjectProfile } from './memory.types'

const STORAGE_KEY = 'cortex_memory_facts'

export async function getAllFacts(): Promise<MemoryFact[]> {
  const result = await chrome.storage.local.get(STORAGE_KEY)
  const data   = result[STORAGE_KEY]
  if (!Array.isArray(data)) return []
  return data as MemoryFact[]
}

export async function saveFact(fact: MemoryFact): Promise<void> {
  const existing = await getAllFacts()

  // Skip if same content already stored (case-insensitive)
  const isDuplicate = existing.some(
    f => f.content.toLowerCase() === fact.content.toLowerCase()
  )
  if (isDuplicate) return

  await chrome.storage.local.set({
    [STORAGE_KEY]: [...existing, fact],
  })
}

export async function updateFact(
  id: string,
  updates: Partial<MemoryFact>
): Promise<void> {
  const existing = await getAllFacts()
  const updated  = existing.map(f =>
    f.id === id ? { ...f, ...updates } : f
  )
  await chrome.storage.local.set({ [STORAGE_KEY]: updated })
}

export async function deleteFact(id: string): Promise<void> {
  const existing = await getAllFacts()
  const filtered = existing.filter(f => f.id !== id)
  await chrome.storage.local.set({ [STORAGE_KEY]: filtered })
}

export async function getPinnedFacts(): Promise<MemoryFact[]> {
  const facts = await getAllFacts()
  return facts.filter(f => f.pinned && f.confirmed)
}

export async function getUnconfirmedFacts(): Promise<MemoryFact[]> {
  const facts = await getAllFacts()
  return facts.filter(f => !f.confirmed)
}

export async function clearAllFacts(): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: [] })
}

// ─── Project profile storage ─────────────────────────────

const PROJECTS_KEY = 'cortex_memory_projects'

export async function getAllProjects(): Promise<ProjectProfile[]> {
  const result = await chrome.storage.local.get(PROJECTS_KEY)
  const data   = result[PROJECTS_KEY]
  if (!Array.isArray(data)) return []
  return data as ProjectProfile[]
}

export async function saveProject(project: ProjectProfile): Promise<void> {
  const existing = await getAllProjects()
  const index    = existing.findIndex(p => p.id === project.id)

  if (index >= 0) {
    existing[index] = { ...project, updated_at: Date.now() }
  } else {
    existing.push(project)
  }

  await chrome.storage.local.set({ [PROJECTS_KEY]: existing })
}

export async function deleteProject(id: string): Promise<void> {
  const existing = await getAllProjects()
  await chrome.storage.local.set({
    [PROJECTS_KEY]: existing.filter(p => p.id !== id),
  })
}
