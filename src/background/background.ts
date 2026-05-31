/**
 * background.ts
 * Background service worker.
 */
import { initMessageRouter } from './message.router'

console.log('[Cortex] background running')
initMessageRouter()

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return
  const url = tab.url ?? ''

  try {
    // Claude no longer needs MAIN world injection, it intercepts its own same-origin fetch from content script.

    if (url.startsWith('https://chatgpt.com')) {
      await chrome.scripting.executeScript({
        target: { tabId, allFrames: false },
        files: ['agents/chatgpt/chatgpt.injected.js'],
        world: 'MAIN',
      })
    }

    if (url.startsWith('https://gemini.google.com')) {
      await chrome.scripting.executeScript({
        target: { tabId, allFrames: false },
        files: ['agents/gemini/gemini.injected.js'],
        world: 'MAIN',
      })
    }

    if (url.startsWith('https://x.com')) {
      await chrome.scripting.executeScript({
        target: { tabId, allFrames: false },
        files: ['agents/grok/grok.injected.js'],
        world: 'MAIN',
      })
    }
  } catch (err) {
    console.error('[Cortex] executeScript failed:', err)
  }
})
