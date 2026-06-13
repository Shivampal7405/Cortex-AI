/**
 * compare.scraper.ts
 * Background-driven scraping of a compare target tab. Polls the target via
 * chrome.scripting.executeScript (a fresh injection each tick), so it does NOT
 * depend on the target tab's content script being loaded or fresh after an
 * extension reload. Streams response deltas to the source tab.
 *
 * Robustness: tries provider-specific selectors first (innerText pierces open
 * shadow roots), and falls back to the delta of the whole page's innerText since
 * scraping began, so capture still works when a site changes its DOM classes.
 */
import type { Provider } from '../shared/types'

const RESPONSE_SELECTORS: Record<Provider, string[]> = {
  claude:  ['.font-claude-message', '.font-claude-response', '[data-testid="assistant-message"]', '[data-is-streaming]'],
  chatgpt: ['[data-message-author-role="assistant"]', '.markdown.prose'],
  gemini:  ['model-response', '.model-response-text', 'message-content'],
  grok:    ['[data-testid="grok-message"]', '[class*="ChatMessage"]', 'article'],
}

// Injected into the target tab - must be fully self-contained. Returns both the
// best selector match and the full page text so the caller can fall back.
function scrapeResponse(selectors: string[]): { text: string; body: string } {
  let text = ''
  for (const sel of selectors) {
    const els = document.querySelectorAll(sel)
    if (els.length > 0) {
      const t = (els[els.length - 1] as HTMLElement).innerText
      if (t && t.trim()) { text = t.trim(); break }
    }
  }
  return { text, body: document.body.innerText }
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
  let baseline = -1
  let mode: '' | 'sel' | 'body' = ''   // commit to one source to avoid garbled deltas

  await delay(1500)  // allow the prompt to submit and the reply to begin

  for (let i = 0; i < 80; i++) {          // up to ~32s
    await delay(400)

    let scrape: { text: string; body: string } | undefined
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func:   scrapeResponse,
        args:   [selectors],
      })
      scrape = results?.[0]?.result as { text: string; body: string } | undefined
    } catch {
      break  // target tab closed or navigated away
    }
    if (!scrape) continue
    if (baseline < 0) baseline = scrape.body.length

    // Decide once where the response text comes from. Prefer the selector; if it
    // produces nothing within the first ~2s, fall back to page-text delta.
    let current = ''
    if (mode === 'sel')       current = scrape.text
    else if (mode === 'body') current = scrape.body.length > baseline ? scrape.body.slice(baseline).trim() : ''
    else if (scrape.text)     { mode = 'sel';  current = scrape.text }
    else if (i >= 5 && scrape.body.length > baseline) { mode = 'body'; current = scrape.body.slice(baseline).trim() }

    if (current.length > lastSent) {
      const chunk = current.slice(lastSent)
      lastSent = current.length
      if (lastSent === chunk.length) console.log('[Cortex] compare capture started via', mode, 'for', provider)
      chrome.tabs.sendMessage(sourceTabId, { type: 'COMPARE_RESULT', chunk, provider }).catch(() => {})
      stable = 0
    } else if (lastSent > 0 && ++stable >= 6) {
      break  // ~2.4s with no growth = response finished
    }
  }

  if (lastSent === 0) console.warn('[Cortex] compare: no response captured from', provider)
  chrome.tabs.sendMessage(sourceTabId, { type: 'COMPARE_DONE', provider }).catch(() => {})
  await chrome.storage.local.remove('compare_mode').catch(() => {})
}
