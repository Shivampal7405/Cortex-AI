/**
 * compareHost.ts
 * Shared compare wiring used by every provider's content script.
 *  - initCompareSource: when THIS tab starts a compare, mount the overlay and
 *    relay streamed chunks (from the background) into it.
 *  - initCompareTarget: when THIS tab is the compare target, scrape its
 *    streaming response and stream deltas back to the background.
 * innerText is used for scraping because it pierces open shadow roots.
 */

import type { Provider } from '../../shared/types'
import { mountCompareOverlay } from './mount'
import { getLastResponse, RESPONSE_SELECTORS } from './compare.selectors'

// SOURCE role — launch the overlay and feed it streamed chunks.
export function initCompareSource(sourceProvider: Provider): void {
  window.addEventListener('message', (event: MessageEvent) => {
    if (event.source !== window) return
    if (event.data?.type !== 'CORTEX_COMPARE_START') return

    const targetProvider = event.data.targetProvider as Provider
    const prompt         = String(event.data.prompt ?? '')
    const lastResponse   = getLastResponse(sourceProvider)

    mountCompareOverlay(sourceProvider, lastResponse, targetProvider)
    chrome.runtime.sendMessage({
      type: 'COMPARE_START', prompt, targetProvider, claudeResponse: lastResponse,
    }).catch(() => {})
  })

  chrome.runtime.onMessage.addListener((msg: { type?: string; chunk?: string }) => {
    if (msg?.type === 'COMPARE_RESULT') {
      window.postMessage({ type: 'CORTEX_COMPARE_CHUNK', chunk: msg.chunk ?? '' }, '*')
    } else if (msg?.type === 'COMPARE_DONE') {
      window.postMessage({ type: 'CORTEX_COMPARE_DONE' }, '*')
    }
  })
}

// TARGET role — stream this tab's response back while it is the compare target.
export function initCompareTarget(provider: Provider): void {
  let poller: ReturnType<typeof setInterval> | null = null

  setInterval(async () => {
    const storage = await chrome.storage.local.get('compare_mode')
    const mode    = storage['compare_mode'] as { active: boolean; target: string } | null

    if (mode?.active && mode.target === provider && !poller) {
      const baseline  = document.body.innerText.length
      let lastSentLen = 0
      let doneTimer: ReturnType<typeof setTimeout> | null = null

      poller = setInterval(() => {
        let responseText = ''
        for (const sel of RESPONSE_SELECTORS[provider]) {
          const els = document.querySelectorAll(sel)
          if (els.length > 0) {
            responseText = (els[els.length - 1] as HTMLElement).innerText?.trim() || ''
            if (responseText) break
          }
        }
        // Fallback: delta of full-page innerText since the poller started.
        if (!responseText) {
          const cur = document.body.innerText
          if (cur.length > baseline) responseText = cur.slice(baseline)
        }

        const newText = responseText.slice(lastSentLen)
        if (newText.trim()) {
          lastSentLen = responseText.length
          chrome.runtime.sendMessage({
            type: 'COMPARE_RESULT', provider, chunk: newText, done: false,
          }).catch(() => {})

          if (doneTimer) clearTimeout(doneTimer)
          doneTimer = setTimeout(() => {
            chrome.runtime.sendMessage({
              type: 'COMPARE_RESULT', provider, chunk: '', done: true,
            }).catch(() => {})
            chrome.storage.local.remove('compare_mode')
            if (poller) { clearInterval(poller); poller = null }
          }, 3000)
        }
      }, 400)

    } else if (!mode?.active && poller) {
      clearInterval(poller)
      poller = null
    }
  }, 1000)
}
