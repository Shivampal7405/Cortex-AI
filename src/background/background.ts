import { initMessageRouter } from './message.router'
import { pollChatGPT, initChatGPTPoller } from '../agents/chatgpt/chatgpt.poller'
import { pollGemini, initGeminiPoller } from '../agents/gemini/gemini.poller'
import { pollGrok, initGrokPoller } from '../agents/grok/grok.poller'
import { initAlertEngine, updateBadge } from './alert.engine'

console.log('[Cortex] background running')
initMessageRouter()
initAlertEngine()
updateBadge()

// Initialize pollers (creates alarms)
initChatGPTPoller()
initGeminiPoller()
initGrokPoller()

// Passive extraction: check every 2 min, trigger if 5+ new messages
chrome.alarms.create('passive-extraction', { periodInMinutes: 2 })

// Route alarms to poller functions
chrome.alarms.onAlarm.addListener(async (alarm) => {
  switch (alarm.name) {
    case 'poll-chatgpt': pollChatGPT(); break;
    case 'poll-gemini':  pollGemini(); break;
    case 'poll-grok':    pollGrok();   break;
    case 'passive-extraction': {
      const r = await chrome.storage.local.get([
        'claude_conv_history', 'last_extraction_count', 'claude_conv_id',
      ])
      const history   = (r['claude_conv_history'] ?? []) as unknown[]
      const lastCount = (r['last_extraction_count'] ?? 0) as number
      if (history.length - lastCount >= 5) {
        const { passiveExtraction } = await import('../memory/llm.extractor')
        const convId = (r['claude_conv_id'] as string) ?? 'unknown'
        await passiveExtraction(history as never, 'claude', convId)
        await chrome.storage.local.set({ last_extraction_count: history.length })
      }
      break
    }
  }
})

// Trigger initial poll on startup
chrome.runtime.onStartup.addListener(() => {
  pollChatGPT()
  pollGemini()
  pollGrok()
  updateBadge()
})

// Poll when user visits domains
chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return
  const url = tab.url ?? ''

  if (url.startsWith('https://chatgpt.com')) pollChatGPT()
  if (url.startsWith('https://gemini.google.com')) pollGemini()
  if (url.startsWith('https://grok.com')) pollGrok()
})
