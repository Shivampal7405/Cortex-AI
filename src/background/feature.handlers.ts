/**
 * feature.handlers.ts
 * Handlers for Compare mode and the Prompts library,
 * extracted from message.router.ts to stay under the 200-line limit.
 * All handlers run in the background service worker.
 */

import type { Provider, SavedPrompt } from '../shared/types'

const PROMPTS_KEY = 'cortex_prompts'

const TAB_URL_PATTERNS: Record<string, string> = {
  claude:  'https://claude.ai/*',
  chatgpt: 'https://chatgpt.com/*',
  gemini:  'https://gemini.google.com/*',
  grok:    'https://x.com/*',
}

const OPEN_URLS: Record<string, string> = {
  chatgpt: 'https://chatgpt.com/',
  gemini:  'https://gemini.google.com/',
  grok:    'https://x.com/i/grok',
}

// Injected into the compare target tab (MAIN world) — must stay self-contained
function injectAndSubmitPrompt(promptText: string, prov: string): void {
  const selectors: Record<string, string[]> = {
    claude:  ['.ProseMirror', 'div[contenteditable="true"]'],
    chatgpt: ['#prompt-textarea', 'textarea[data-id]', 'textarea'],
    // Gemini uses a <rich-textarea> custom element; its inner textarea is accessible
    gemini:  ['rich-textarea textarea', 'textarea', '.ql-editor', '[contenteditable="true"]'],
    grok:    ['[data-testid="tweetTextarea_0"]', 'textarea', '[contenteditable="true"]'],
  }
  const submitSelectors = [
    '[data-testid="send-button"]',
    'button[aria-label*="Send" i]',
    'button[aria-label*="send" i]',
    'button[jsaction*="send" i]',
    'button.send-button',
    'form button[type="submit"]',
  ].join(',')

  for (const sel of selectors[prov] ?? []) {
    const el = document.querySelector(sel) as HTMLElement | null
    if (!el) continue
    el.focus()
    if (el instanceof HTMLTextAreaElement) {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
      setter?.call(el, promptText)
      el.dispatchEvent(new Event('input',  { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    } else if (el.isContentEditable) {
      el.innerText = promptText
      el.dispatchEvent(new InputEvent('input', { bubbles: true, data: promptText }))
    }
    setTimeout(() => {
      const btn = document.querySelector(submitSelectors) as HTMLButtonElement | null
      if (btn) { btn.click() }
      else { el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true })) }
    }, 500)
    return
  }
}

export async function handleCompareStart(
  prompt:         string,
  targetProvider: Provider,
  sourceTabId:    number
): Promise<void> {
  await chrome.storage.local.set({
    compare_mode: { active: true, prompt, target: targetProvider, sourceTabId },
  })

  let targetTabs = await chrome.tabs.query({ url: TAB_URL_PATTERNS[targetProvider] ?? '' })

  if (targetTabs.length === 0) {
    const newTab = await chrome.tabs.create({ url: OPEN_URLS[targetProvider] ?? '', active: false })
    await new Promise<void>((resolve) => {
      const listener = (id: number, changeInfo: chrome.tabs.TabChangeInfo) => {
        if (id === newTab.id && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener)
          setTimeout(resolve, 1000)
        }
      }
      chrome.tabs.onUpdated.addListener(listener)
    })
    targetTabs = [newTab]
  }

  const targetTabId = targetTabs[0]?.id
  if (!targetTabId) return

  await chrome.scripting.executeScript({
    target: { tabId: targetTabId },
    func:   injectAndSubmitPrompt,
    args:   [prompt, targetProvider],
    world:  'MAIN',
  }).catch(err => console.warn('[Cortex] Compare inject failed:', err))
}

export async function handleCompareResult(
  chunk:    string,
  done:     boolean,
  provider: Provider
): Promise<void> {
  const storage = await chrome.storage.local.get('compare_mode')
  const mode    = storage['compare_mode'] as { sourceTabId: number } | undefined
  if (!mode?.sourceTabId) return

  chrome.tabs.sendMessage(mode.sourceTabId, {
    type: done ? 'COMPARE_DONE' : 'COMPARE_RESULT',
    chunk,
    provider,
  }).catch(() => {})

  if (done) await chrome.storage.local.remove('compare_mode')
}

export async function getPrompts(): Promise<SavedPrompt[]> {
  const result = await chrome.storage.local.get(PROMPTS_KEY)
  const data   = result[PROMPTS_KEY]
  return Array.isArray(data) ? (data as SavedPrompt[]) : []
}

export async function savePrompt(prompt: SavedPrompt): Promise<void> {
  const prompts = await getPrompts()
  const idx     = prompts.findIndex(p => p.id === prompt.id)
  if (idx >= 0) prompts[idx] = prompt
  else          prompts.push(prompt)
  await chrome.storage.local.set({ [PROMPTS_KEY]: prompts })
}

export async function deletePrompt(id: string): Promise<void> {
  const prompts = await getPrompts()
  await chrome.storage.local.set({ [PROMPTS_KEY]: prompts.filter(p => p.id !== id) })
}

export async function injectPrompt(content: string, provider: string): Promise<void> {
  const tabs = await chrome.tabs.query({ url: TAB_URL_PATTERNS[provider] ?? 'https://claude.ai/*' })
  if (!tabs[0]?.id) return
  await chrome.scripting.executeScript({
    target: { tabId: tabs[0].id },
    func:   (text: string, prov: string) => {
      window.postMessage({ type: 'CORTEX_INJECT_MEMORY', block: text, provider: prov }, '*')
    },
    args: [content, provider],
  }).catch(err => console.warn('[Cortex] Prompt inject failed:', err))
}
