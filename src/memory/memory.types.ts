/**
 * memory.types.ts
 * All types for the 3-layer memory system.
 * Layer 1: MemoryFact — explicit identity facts
 * Layer 2: ProjectProfile — structured project context
 * Layer 3: Active conversation — handled by trackers
 */

import type { Provider } from '../shared/types'

export interface MemoryFact {
  id:                     string
  content:                string
  source_provider:        Provider
  source_conversation_id: string
  extracted_at:           number
  tags:                   string[]
  pinned:                 boolean
  confirmed:              boolean
}

export interface ProjectProfile {
  id:          string
  name:        string
  description: string
  stack:       string[]
  status:      string
  goals:       string[]
  notes:       string
  created_at:  number
  updated_at:  number
}

// LLM-extracted project shape — no timestamps (added on save)
export interface MemoryJSONProject {
  id:          string
  name:        string
  description: string
  stack:       string[]
  status:      string
  goals:       string[]
  notes:       string
}

export interface MemoryJSON {
  identity: {
    name:        string | null
    role:        string | null
    location:    string | null
    background?: string | null
  }
  projects: MemoryJSONProject[]
  preferences: {
    languages:  string[]
    frameworks: string[]
    tools:      string[]
    patterns?:  string[]
    style?:     string | null
  }
  decisions: Array<{
    topic:      string
    decision:   string
    reasoning:  string | null
    date?:      string | null
  }>
  interests?:       string[]
  open_questions:   string[]
  context_summary?: string
}

export interface MemoryExtractionResult {
  facts:        MemoryFact[]
  raw_response: string
}
