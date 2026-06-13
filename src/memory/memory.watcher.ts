/**
 * memory.watcher.ts
 * Watches conversation DOM for user messages to extract facts from.
 * Runs as part of claude.content.ts.
 * Extracts facts from USER messages only (not AI responses).
 */

import { extractFacts } from './memory.extractor'
import type { Provider } from '../shared/types'

export function watchForFacts(
  provider: Provider,
  getConversationId: () => string | null
): void {
  const processedMessages = new Set<string>()

  const observer = new MutationObserver(async () => {
    // Stop the orphaned observer after an extension reload
    if (!chrome.runtime?.id) { observer.disconnect(); return }
    // Find user message elements
    const userMessages = document.querySelectorAll(
      '[data-testid="user-message"], .human-turn, [data-role="user"]'
    )

    for (const el of userMessages) {
      const text = el.textContent?.trim() ?? ''
      if (!text || processedMessages.has(text)) continue
      processedMessages.add(text)

      const conversationId = getConversationId() ?? 'unknown'
      const facts = extractFacts(text, provider, conversationId)

      for (const fact of facts) {
        console.log('[Cortex] Fact extracted:', fact.content)

        // Route through background: saves to chrome.storage and notifies popup
        try {
          chrome.runtime.sendMessage({ type: 'SAVE_FACT', fact }).catch(() => {})
        } catch { /* context invalidated */ }
      }
    }
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  })
}
