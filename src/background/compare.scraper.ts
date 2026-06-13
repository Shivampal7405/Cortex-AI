/**
 * compare.scraper.ts
 * Background-driven scraping of a compare target tab. Polls the target via
 * chrome.scripting.executeScript (a fresh injection each tick), so it does NOT
 * depend on the target tab's content script being loaded or fresh after an
 * extension reload. Streams response deltas to the source tab. innerText is used
 * because it pierces open shadow roots (Gemini/Grok custom elements).
 */
import type { Provider } from '../shared/types'

const RESPONSE_SELECTORS: Record<Provider, string[]> = {
  claude:  ['.font-claude-message', '[data-testid="assistant-message"]'],
  chatgpt: ['[data-message-author-role="assistant"]', '.markdown.prose'],
  gemini:  ['model-response', '.model-response-text', 'message-content'],
  grok:    ['[data-testid="grok-message"]', '[class*="ChatMessage"]', 'article'],
}

// Injected into the target tab — must be fully self-contained.
function scrapeLastResponse(selectors: string[]): string {
  for (const sel of selectors) {
    const els = document.querySelectorAll(sel)
    if (els.length > 0) {
      const t = (els[els.length - 1] as HTMLElement).innerText
      if (t && t.trim()) return t.trim()
    }
  }
  return ''
}

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

export async function streamTargetResponse(
  tabId:       number,
  sourceTabId: number,
  provider:    Provider,
): Promise<void> {
  const selectors = RESPONSE_SELECTORS[provider] ?? []
  let lastSent = 0
  let stable   = 0

  await delay(1500)  // allow the prompt to submit and the reply to begin

  for (let i = 0; i < 80; i++) {          // up to ~32s
    await delay(400)
    let text = ''
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func:   scrapeLastResponse,
        args:   [selectors],
      })
      text = (results?.[0]?.result as string | undefined) ?? ''
    } catch {
      break  // target tab closed or navigated away
    }

    if (text.length > lastSent) {
      const chunk = text.slice(lastSent)
      lastSent = text.length
      chrome.tabs.sendMessage(sourceTabId, { type: 'COMPARE_RESULT', chunk, provider }).catch(() => {})
      stable = 0
    } else if (lastSent > 0 && ++stable >= 6) {
      break  // ~2.4s with no growth = response finished
    }
  }

  chrome.tabs.sendMessage(sourceTabId, { type: 'COMPARE_DONE', provider }).catch(() => {})
  await chrome.storage.local.remove('compare_mode').catch(() => {})
}
