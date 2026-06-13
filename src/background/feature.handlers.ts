/**
 * feature.handlers.ts
 * Handlers for Compare mode and the Prompts library,
 * extracted from message.router.ts to stay under the 200-line limit.
 * All handlers run in the background service worker.
 */

import type { Provider, SavedPrompt } from '../shared/types'
import { streamTargetResponse } from './compare.scraper'

const PROMPTS_KEY = 'cortex_prompts'

const TAB_URL_PATTERNS: Record<string, string> = {
  claude:  'https://claude.ai/*',
  chatgpt: 'https://chatgpt.com/*',
  gemini:  'https://gemini.google.com/*',
  grok:    'https://grok.com/*',
}

const OPEN_URLS: Record<string, string> = {
  chatgpt: 'https://chatgpt.com/',
  gemini:  'https://gemini.google.com/',
  grok:    'https://grok.com/',
}

// Patterns to find an existing target tab. Grok lives on both domains.
function queryPatternsFor(provider: string): string[] {
  if (provider === 'grok') return ['https://grok.com/*', 'https://x.com/*']
  return [TAB_URL_PATTERNS[provider] ?? '']
}

// Injected into the compare target tab (MAIN world) - must stay self-contained.
// Retries finding the input so it works on freshly opened / slow-rendering tabs.
function injectAndSubmitPrompt(promptText: string, prov: string): void {
  const selectors: Record<string, string[]> = {
    claude:  ['.ProseMirror', 'div[contenteditable="true"]'],
    chatgpt: ['#prompt-textarea', 'textarea[data-id]', 'textarea'],
    gemini:  ['rich-textarea textarea', 'textarea', '.ql-editor', '[contenteditable="true"]'],
    grok:    ['textarea', 'div[contenteditable="true"]', '[contenteditable="true"]'],
  }
  const submitSelectors = [
    '[data-testid="send-button"]', '[data-testid*="send" i]',
    'button[aria-label*="Send" i]', 'button[aria-label*="submit" i]',
    'button[jsaction*="send" i]', 'button.send-button',
    'button[type="submit"]', 'form button[type="submit"]',
  ].join(',')

  const findInput = (): HTMLElement | null => {
    for (const sel of selectors[prov] ?? []) {
      const e = document.querySelector(sel) as HTMLElement | null
      if (e) return e
    }
    return null
  }

  let tries = 0
  const attempt = (): void => {
    const el = findInput()
    if (!el) {
      if (++tries < 40) setTimeout(attempt, 300)   // retry up to ~12s for new/slow tabs
      return
    }
    el.focus()
    if (el instanceof HTMLTextAreaElement) {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
      setter?.call(el, promptText)
      el.dispatchEvent(new Event('input',  { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    } else if (el.isContentEditable) {
      // ProseMirror (Claude) ignores direct innerText - use execCommand for real input events.
      document.execCommand('selectAll', false, undefined)
      document.execCommand('insertText', false, promptText)
      el.dispatchEvent(new InputEvent('input', { bubbles: true, data: promptText }))
    }
    setTimeout(() => {
      const btn = document.querySelector(submitSelectors) as HTMLButtonElement | null
      if (btn && !btn.disabled) { btn.click(); return }
      for (const type of ['keydown', 'keypress', 'keyup']) {
        el.dispatchEvent(new KeyboardEvent(type, { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }))
      }
    }, 900)
  }
  attempt()
}

export async function handleCompareStart(
  prompt:         string,
  targetProvider: Provider,
  sourceTabId:    number
): Promise<void> {
  await chrome.storage.local.set({
    compare_mode: { active: true, prompt, target: targetProvider, sourceTabId },
  })

  let targetTabs = await chrome.tabs.query({ url: queryPatternsFor(targetProvider) })

  if (targetTabs.length === 0) {
    const newTab = await chrome.tabs.create({ url: OPEN_URLS[targetProvider] ?? '', active: false })
    // Wait for load, but never hang: resolve on complete or after 6s.
    await new Promise<void>((resolve) => {
      let done = false
      const finish = () => {
        if (done) return
        done = true
        chrome.tabs.onUpdated.removeListener(listener)
        resolve()
      }
      const listener = (id: number, info: chrome.tabs.TabChangeInfo) => {
        if (id === newTab.id && info.status === 'complete') setTimeout(finish, 1200)
      }
      chrome.tabs.onUpdated.addListener(listener)
      setTimeout(finish, 6000)
    })
    targetTabs = [newTab]
  }

  // Prefer the active / most-recently-used matching tab.
  const target = [...targetTabs].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1
    return (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0)
  })[0]
  const targetTabId = target?.id
  if (!targetTabId) { console.warn('[Cortex] compare: no target tab for', targetProvider); return }

  console.log('[Cortex] compare: injecting into', targetProvider, 'tab', targetTabId)
  await chrome.scripting.executeScript({
    target: { tabId: targetTabId },
    func:   injectAndSubmitPrompt,
    args:   [prompt, targetProvider],
    world:  'MAIN',
  }).catch(err => console.warn('[Cortex] Compare inject failed:', err))

  // Scrape the target tab from the background - independent of its content script.
  void streamTargetResponse(targetTabId, sourceTabId, targetProvider, prompt)
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
  const tabs = await chrome.tabs.query({ url: queryPatternsFor(provider) })
  if (!tabs[0]?.id) return
  await chrome.scripting.executeScript({
    target: { tabId: tabs[0].id },
    func:   (text: string, prov: string) => {
      window.postMessage({ type: 'CORTEX_INJECT_MEMORY', block: text, provider: prov }, '*')
    },
    args: [content, provider],
  }).catch(err => console.warn('[Cortex] Prompt inject failed:', err))
}