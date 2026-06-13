/**
 * compare.selectors.ts
 * Per-provider DOM selectors for the cross-LLM compare feature.
 * innerText is used everywhere — it pierces open shadow roots (Gemini/Grok use
 * custom elements) and trims invisible whitespace that textContent leaves in.
 *
 * Fallback order in getComparePrompt:
 *   1. Typed input (provider-specific)
 *   2. Last user message (provider-specific)
 *   3. Universal selectors that work across all providers
 */

import type { Provider } from '../../shared/types'

// Last assistant response — used by source overlay and background scraper.
export const RESPONSE_SELECTORS: Record<Provider, string[]> = {
  claude:  [
    '[data-testid="assistant-message"]',
    '.font-claude-message',
    '.font-claude-response',
    '[data-is-streaming="false"]',
  ],
  chatgpt: [
    '[data-message-author-role="assistant"]',
    '.markdown.prose',
    '[class*="assistant"] .markdown',
  ],
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
  grok:    [
    '[data-testid="grok-message"]',
    '[class*="ChatMessage"]',
    '[class*="message-bubble"]',
    'article',
  ],
}

// Composer input — checked first (user might be mid-typing).
const INPUT_SELECTORS: Record<Provider, string[]> = {
  claude:  ['.ProseMirror[contenteditable="true"]', '[contenteditable="true"].ProseMirror'],
  chatgpt: ['#prompt-textarea'],
  gemini:  ['rich-textarea .ql-editor', '.ql-editor', 'rich-textarea [contenteditable="true"]'],
  grok:    ['textarea[placeholder]', 'div[contenteditable="true"][class*="editor"]'],
}

// Last user message in conversation — fallback when input is empty.
const USER_SELECTORS: Record<Provider, string[]> = {
  claude:  [
    '[data-testid="user-message"]',
    '[data-testid="human-turn"]',
    '.font-user-message',
    '.human-turn',
    '[class*="HumanTurn"]',
    '[class*="human-turn"]',
    '[class*="user-message"]',
  ],
  chatgpt: [
    '[data-message-author-role="user"]',
    '[data-testid*="conversation-turn"] [class*="whitespace-pre"]',
    '.text-message',
  ],
  gemini:  [
    'user-query',
    '[data-test-id="user-query"]',
    '.user-query-bubble-with-background',
    '.user-query-text',
    '.query-text',
  ],
  grok:    [
    '[data-testid="user-message"]',
    '[class*="UserMessage"]',
    '[class*="user-message"]',
    '[class*="HumanMessage"]',
    '[class*="MessageBubble"]',
  ],
}

// Universal selectors tried as last resort when provider-specific ones fail.
const UNIVERSAL_USER_SELECTORS = [
  '[data-message-author-role="user"]',
  '[data-message-role="user"]',
  '[data-author-role="user"]',
  '[role="region"][aria-label*="You"]',
  '[class*="user-turn"]',
  '[class*="human-turn"]',
  '[class*="human-message"]',
  '[class*="user-message"]',
  'user-query',
]

function lastText(selectors: string[]): string {
  for (const sel of selectors) {
    try {
      const els  = document.querySelectorAll(sel)
      const last = els[els.length - 1] as HTMLElement | undefined
      const text = last?.innerText?.trim()
      if (text && text.length > 1) return text
    } catch { /* invalid selector — skip */ }
  }
  return ''
}

export function getLastResponse(provider: Provider): string {
  return lastText(RESPONSE_SELECTORS[provider])
}

/**
 * Returns the prompt to compare: prefers what the user is currently typing,
 * falls back to the last user message in the conversation.
 */
export function getComparePrompt(provider: Provider): string {
  // 1. Typed input
  for (const sel of INPUT_SELECTORS[provider]) {
    try {
      const el = document.querySelector(sel) as HTMLElement | null
      if (!el) continue
      const value = el instanceof HTMLTextAreaElement ? el.value
                  : el instanceof HTMLInputElement    ? el.value
                  : el.innerText
      const text = (value ?? '').replace(/^\s+|\s+$/g, '')
      if (text.length > 1) return text   // >1 skips lone newlines
    } catch { /* skip */ }
  }

  // 2. Provider-specific last user message
  const fromProvider = lastText(USER_SELECTORS[provider])
  if (fromProvider) return fromProvider

  // 3. Universal fallback — catches DOM changes across all providers
  return lastText(UNIVERSAL_USER_SELECTORS)
}
