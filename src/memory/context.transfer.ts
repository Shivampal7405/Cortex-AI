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
  grok:    'https://grok.com/',
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

async function injectWithRetry(
  tabId:     number,
  formatted: string,
  selectors: string[],
  maxTries:  number = 3
): Promise<void> {
  for (let i = 0; i < maxTries; i++) {
    await new Promise(r => setTimeout(r, 1500 * (i + 1)))
    try {
      const result = await chrome.scripting.executeScript({
        target: { tabId },
        func:   injectConversationIntoPage,
        args:   [formatted, selectors],
        world:  'MAIN',
      })
      // Check if injection succeeded
      if (result?.[0]?.result === true) {
        console.log('[Cortex] Injection succeeded on attempt', i + 1)
        return
      }
    } catch (err) {
      console.warn(`[Cortex] Inject attempt ${i + 1} failed:`, err)
    }
  }
  console.error('[Cortex] All injection attempts failed')
}

export async function transferContext(
  from: Provider,
  to:   Provider
): Promise<void> {
  console.log('[Cortex] Transfer started:', from, '→', to)

  const messages = await forceFreshHistory(from)
  console.log('[Cortex] Messages fetched:', messages.length)

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
    void injectWithRetry(tabId, formatted, selectors)
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
