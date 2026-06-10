/**
 * context.transfer.ts
 * N-way context transfer between all 4 AI providers.
 * Reads conversation from tracker cache (fresh fetch preferred).
 * Opens a new tab in the target provider and injects the transcript.
 * Retries injection up to 3 times for slow-loading SPAs.
 */

import { forceFreshHistory } from './conversation.fetcher'
import type { Provider }     from '../shared/types'

export interface TransferMessage {
  role:      'user' | 'assistant'
  content:   string
  timestamp: number
}

const TARGET_URLS: Record<Provider, string> = {
  claude:  'https://claude.ai/new',
  chatgpt: 'https://chatgpt.com/',
  gemini:  'https://gemini.google.com/',
  grok:    'https://x.com/i/grok',
}

const INPUT_SELECTORS: Record<Provider, string[]> = {
  claude:  ['.ProseMirror', '[contenteditable="true"]'],
  chatgpt: ['#prompt-textarea', '[contenteditable="true"][role="textbox"]', 'textarea'],
  gemini:  ['.ql-editor', 'rich-textarea', '[contenteditable="true"]', 'textarea'],
  grok:    ['textarea', '[contenteditable="true"]'],
}

function formatConversation(
  messages: TransferMessage[],
  from:     Provider
): string {
  const header = `[Conversation continued from ${from} via Cortex]\n\n`
  const body   = messages
    .filter(m => m.content.trim().length > 0)
    .map(m => `${m.role === 'user' ? 'Human' : 'Assistant'}: ${m.content.trim()}`)
    .join('\n\n')
  const footer = '\n\nHuman: '
  return header + body + footer
}

// Returns true if a matching input was found and filled, false if no selector matched.
// Must remain a standalone serialisable function (injected into MAIN world).
function injectConversationIntoPage(
  text:      string,
  selectors: string[]
): boolean {
  for (const sel of selectors) {
    const el = document.querySelector(sel) as HTMLElement | null
    if (!el) continue

    el.focus()

    if (el instanceof HTMLTextAreaElement) {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype, 'value'
      )?.set
      if (setter) {
        setter.call(el, text)
        el.dispatchEvent(new Event('input',  { bubbles: true }))
        el.dispatchEvent(new Event('change', { bubbles: true }))
        return true
      }
    }

    if (el.isContentEditable) {
      el.focus()
      document.execCommand('selectAll', false, undefined)
      document.execCommand('insertText', false, text)
      return true
    }
  }
  return false
}

// Retry injection up to 3 times — target SPAs need time to render the input.
// Delays: 1.5 s, then 2 s more, then 3 s more (cumulative: 1.5 / 3.5 / 6.5 s).
async function tryInject(
  tabId:    number,
  text:     string,
  sels:     string[],
  attempt = 1
): Promise<void> {
  try {
    const res = await chrome.scripting.executeScript({
      target: { tabId },
      func:   injectConversationIntoPage,
      args:   [text, sels],
      world:  'MAIN',
    })
    const succeeded = (res?.[0]?.result as boolean | undefined) === true
    console.log(`[Cortex] Inject attempt ${attempt}: ${succeeded ? 'success' : 'input not ready'}`)
    if (!succeeded && attempt < 3) {
      setTimeout(() => void tryInject(tabId, text, sels, attempt + 1), attempt * 2000)
    }
  } catch (err) {
    console.warn(`[Cortex] Inject attempt ${attempt} threw:`, err)
    if (attempt < 3) setTimeout(() => void tryInject(tabId, text, sels, attempt + 1), attempt * 2000)
  }
}

export async function transferContext(
  from: Provider,
  to:   Provider
): Promise<void> {
  console.log('[Cortex] Transfer started:', from, '→', to)

  const messages = await forceFreshHistory(from)
  console.log('[Cortex] Messages fetched:', messages.length,
    messages[0] ? `— first: "${messages[0].content.slice(0, 60)}"` : '')

  if (messages.length === 0) {
    console.warn(`[Cortex] No history for ${from}. Visit the provider page first.`)
    chrome.runtime.sendMessage({
      type:     'TRANSFER_FAILED',
      provider: from,
      reason:   'No conversation history found. Make sure you have an active conversation open.',
    }).catch(() => {})
    return
  }

  const formatted = formatConversation(messages, from)
  const selectors = INPUT_SELECTORS[to]
  let   injected  = false
  let   resolvedTabId: number | null = null

  // Register before tabs.create to avoid the race where a fast-loading
  // tab fires 'complete' before the listener is attached.
  const listener = (tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
    if (tabId !== resolvedTabId || changeInfo.status !== 'complete') return
    if (injected) return
    injected = true
    chrome.tabs.onUpdated.removeListener(listener)
    setTimeout(() => void tryInject(tabId, formatted, selectors), 1500)
  }
  chrome.tabs.onUpdated.addListener(listener)

  const tab = await chrome.tabs.create({ url: TARGET_URLS[to], active: true })
  resolvedTabId = tab.id ?? null

  if (!resolvedTabId) {
    chrome.tabs.onUpdated.removeListener(listener)
    return
  }

  // Safety: remove listener after 30 s if tab never completed
  setTimeout(() => {
    if (!injected) chrome.tabs.onUpdated.removeListener(listener)
  }, 30_000)
}
