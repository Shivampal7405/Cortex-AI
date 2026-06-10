/**
 * memory.extractor.ts
 * Extracts facts from conversation text using pattern matching.
 * No LLM call needed — uses regex + heuristics.
 * Runs in background service worker.
 */

import type { MemoryFact } from './memory.types'
import type { Provider } from '../shared/types'

// Patterns that indicate personal facts worth remembering
const FACT_PATTERNS = [
  // Identity
  /my name is ([A-Z][a-z]+ ?[A-Z]?[a-z]*)/i,
  /i(?:'m| am) ([A-Z][a-z]+ ?[A-Z]?[a-z]*)/i,
  /call me ([A-Z][a-z]+)/i,

  // Professional
  /i work at ([A-Za-z\s]+)/i,
  /i(?:'m| am) a(?:n)? ([A-Za-z\s]+(?:engineer|developer|designer|manager|founder|CEO|CTO))/i,
  /i(?:'m| am) building ([A-Za-z\s]+)/i,
  /my (?:project|app|startup|company) is ([A-Za-z\s]+)/i,

  // Technical
  /i use ([A-Za-z\s,]+) (?:for|as my|as the)/i,
  /my (?:stack|tech stack) is ([A-Za-z\s,+]+)/i,
  /i prefer ([A-Za-z\s]+) (?:over|to|vs)/i,

  // Preferences
  /i(?:'m| am) based in ([A-Za-z\s,]+)/i,
  /i live in ([A-Za-z\s,]+)/i,
  /my (?:language|timezone|country) is ([A-Za-z\s/+]+)/i,
]

export function generateId(): string {
  return `fact_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function autoTag(content: string): string[] {
  const tags: string[] = []
  const lower = content.toLowerCase()
  if (/name|call me/.test(lower))                    tags.push('identity')
  if (/work|company|startup|founder|job/.test(lower)) tags.push('work')
  if (/build|project|app|stack/.test(lower))          tags.push('project')
  if (/prefer|use|language|framework/.test(lower))    tags.push('preference')
  if (/live|based|timezone|country/.test(lower))      tags.push('location')
  return tags
}

export function extractFacts(
  text: string,
  provider: Provider,
  conversationId: string
): MemoryFact[] {
  const facts: MemoryFact[] = []
  const seen = new Set<string>()

  for (const pattern of FACT_PATTERNS) {
    const match = text.match(pattern)
    if (!match) continue

    // Get the full sentence containing the match
    const sentences = text.split(/[.!?]+/)
    const sentence = sentences.find(s =>
      s.toLowerCase().includes(match[0].toLowerCase())
    )?.trim()

    if (!sentence || seen.has(sentence)) continue
    seen.add(sentence)

    const fact: MemoryFact = {
      id:                    generateId(),
      content:               sentence,
      source_provider:       provider,
      source_conversation_id: conversationId,
      extracted_at:          Date.now(),
      tags:                  autoTag(sentence),
      pinned:                false,
      confirmed:             false,   // requires user confirmation
    }
    facts.push(fact)
  }

  return facts
}
