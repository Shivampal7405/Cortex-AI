/**
 * compare.selectors.ts
 * Per-provider DOM selectors for the cross-LLM compare feature.
 * Used to read the current prompt, the last user message, and the last
 * assistant response. innerText is used everywhere because it pierces open
 * shadow roots (Gemini/Grok render inside custom elements) — textContent does not.
 */

import type { Provider } from '../../shared/types'

// Last assistant response — read by the source overlay and the target streamer.
export const RESPONSE_SELECTORS: Record<Provider, string[]> = {
  claude:  ['.font-claude-message', '[data-testid="assistant-message"]', '[data-is-streaming="false"]'],
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
  grok:    ['[data-testid="grok-message"]', '[class*="ChatMessage"]', 'article'],
}

// Current input field — primary source of the prompt to compare.
const INPUT_SELECTORS: Record<Provider, string[]> = {
  claude:  ['.ProseMirror', '[contenteditable="true"]'],
  chatgpt: ['#prompt-textarea', '[contenteditable="true"]', 'textarea'],
  gemini:  ['.ql-editor', 'rich-textarea textarea', '[contenteditable="true"]', 'textarea'],
  grok:    ['textarea', '[contenteditable="true"]'],
}

// Last user message — fallback prompt when the input box is empty.
const USER_SELECTORS: Record<Provider, string[]> = {
  claude:  [
    '[data-testid="user-message"]',
    '.font-user-message',
    '[data-testid="human-turn"]',
    '.human-turn',
    '[class*="user-message"]',
    '[class*="human-turn"]',
  ],
  chatgpt: ['[data-message-author-role="user"]'],
  gemini:  [
    'user-query',
    '[data-test-id="user-query"]',
    '.user-query-bubble-with-background',
    '.user-query-text',
    '.query-text',
    '[data-message-author-role="user"]',
  ],
  grok:    ['[data-testid="user-message"]', '[class*="UserMessage"]'],
}

function lastText(selectors: string[]): string {
  for (const sel of selectors) {
    const els  = document.querySelectorAll(sel)
    const last = els[els.length - 1] as HTMLElement | undefined
    const text = last?.innerText?.trim()
    if (text) return text
  }
  return ''
}

export function getLastResponse(provider: Provider): string {
  return lastText(RESPONSE_SELECTORS[provider])
}

// Prompt to compare: prefer typed input, fall back to the last user message.
export function getComparePrompt(provider: Provider): string {
  for (const sel of INPUT_SELECTORS[provider]) {
    const el = document.querySelector(sel) as HTMLElement | null
    if (!el) continue
    const value = el instanceof HTMLTextAreaElement ? el.value : el.innerText
    const text  = (value ?? '').trim()
    if (text) return text
  }
  return lastText(USER_SELECTORS[provider])
}
