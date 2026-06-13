/**
 * compare.scraper.ts
 * Background-driven scraping of a compare target tab. Polls the target via
 * chrome.scripting.executeScript (a fresh injection each tick), so it does NOT
 * depend on the target tab's content script being loaded or fresh after an
 * extension reload. Streams response deltas to the source tab.
 *
 * Robustness: tries provider selectors first (innerText pierces open shadow
 * roots); otherwise falls back to the delta of the whole page's innerText since
 * BEFORE the prompt was submitted, with the echoed prompt stripped out. The
 * baseline is captured immediately so fast replies are not missed.
 */
import type { Provider } from '../shared/types'

const RESPONSE_SELECTORS: Record<Provider, string[]> = {
  claude:  ['.font-claude-message', '.font-claude-response', '[data-testid="assistant-message"]'],
  chatgpt: ['[data-message-author-role="assistant"]', '.markdown.prose'],
  gemini:  [
    'model-response .markdown',
    'model-response .message-text',
    '.response-container .markdown',
    'message-content .markdown',
    'model-response',
    '.message-text',
    '.model-response-text',
    '.assistant-messages-primary-container',
  ],
  grok:    ['[data-testid="grok-message"]', '.message-bubble', '[class*="response-content"]', '[class*="markdown"]', '.prose', 'article'],
}

// Injected into the target tab - must be fully self-contained.
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

async function scrapeOnce(tabId: number, selectors: string[]): Promise<{ text: string; body: string } | null> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func:   scrapeResponse,
      args:   [selectors],
    })
    return (results?.[0]?.result as { text: string; body: string } | undefined) ?? null
  } catch {
    return null  // tab closed or navigated
  }
}

export async function streamTargetResponse(
  tabId:       number,
  sourceTabId: number,
  provider:    Provider,
  prompt:      string,
): Promise<void> {
  const selectors = RESPONSE_SELECTORS[provider] ?? []
  let lastSent = 0
  let stable   = 0
  let mode: '' | 'sel' | 'body' = ''

  // Baseline NOW, before the prompt is echoed and the reply renders.
  const first = await scrapeOnce(tabId, selectors)
  const baseline = first ? first.body.length : 0

  for (let i = 0; i < 90; i++) {          // up to ~36s
    await delay(400)
    const scrape = await scrapeOnce(tabId, selectors)
    if (!scrape) break

    // Strip UI noise that any provider might prepend to their responses.
    const stripNoise = (t: string): string =>
      t.replace(/^Gemini\s+said[\s:.]*\n*/i, '')
       .replace(/^(Gemini|ChatGPT|Grok|Claude)[\s:.]+/i, '')
       .replace(/⇄\s*Compare/g, '')
       .replace(/^\s*Compare\s*/im, '')
       .trim()

    // Selector text is cleanest — ignore only if it exactly equals the echoed prompt.
    let selText  = scrape.text && scrape.text !== prompt ? stripNoise(scrape.text) : ''
    let bodyText = scrape.body.length > baseline ? scrape.body.slice(baseline).trim() : ''
    if (bodyText && prompt) bodyText = bodyText.replace(prompt, '').trim()
    if (bodyText) bodyText = stripNoise(bodyText)

    let current = ''
    if (mode === 'sel')        current = selText
    else if (mode === 'body')  current = bodyText
    else if (selText)          { mode = 'sel';  current = selText }
    // Give the real assistant selector ~4s before falling back to page text.
    else if (i >= 10 && bodyText) { mode = 'body'; current = bodyText }

    if (current.length > lastSent) {
      const chunk = current.slice(lastSent)
      if (lastSent === 0) console.log('[Cortex] compare capture via', mode, 'for', provider)
      lastSent = current.length
      chrome.tabs.sendMessage(sourceTabId, { type: 'COMPARE_RESULT', chunk, provider }).catch(() => {})
      stable = 0
    } else if (lastSent > 50 && ++stable >= 10) {
      // Require >50 chars AND 10 stable ticks (4s) before declaring done.
      // This avoids quitting on a UI label or mid-stream pause.
      break
    }
  }

  if (lastSent === 0) console.warn('[Cortex] compare: no response captured from', provider)
  chrome.tabs.sendMessage(sourceTabId, { type: 'COMPARE_DONE', provider }).catch(() => {})
  await chrome.storage.local.remove('compare_mode').catch(() => {})
}
