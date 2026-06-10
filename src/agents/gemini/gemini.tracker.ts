/**
 * gemini.tracker.ts
 * Invisible content script for gemini.google.com
 * Tracks active conversation and caches message history.
 * Gemini has no clean REST API — uses DOM scraping as fallback.
 * Zero UI. Runs silently at document_idle.
 */

export {}

const STORAGE_KEYS = {
  convId:   'gemini_conv_id',
  history:  'gemini_conv_history',
  lastSeen: 'gemini_last_seen',
} as const

// Extract conversation ID from Gemini URL
// Pattern: gemini.google.com/app/{conversationId}
function getConversationId(): string | null {
  const match = window.location.pathname.match(/\/app\/([a-zA-Z0-9_-]+)/)
  return match ? (match[1] ?? null) : null
}

async function saveConversationId(id: string): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.convId]:   id,
    [STORAGE_KEYS.lastSeen]: Date.now(),
  })
  console.log('[Cortex:Gemini] Conversation ID saved:', id)
}

function interceptGeminiFetch(): void {
  const originalFetch = window.fetch.bind(window)

  window.fetch = async function(input, init) {
    const response = await originalFetch(input, init)

    const url = typeof input === 'string' ? input
              : input instanceof URL      ? input.href
              : (input as Request).url

    // Gemini API patterns
    const isGeminiAPI = url.includes('/_/BardChatUi/data/') ||
                        url.includes('/api/batchexecute')

    if (!isGeminiAPI) return response

    try {
      const clone = response.clone()
      const text  = await clone.text()

      // Try to extract conversation data from batchexecute response
      // Format is complex nested arrays — extract readable text
      const messages = parseGeminiBatchExecute(text)

      if (messages.length > 0) {
        await chrome.storage.local.set({
          [STORAGE_KEYS.history]: messages,
        })
        console.log(
          '[Cortex:Gemini] History cached via API:',
          messages.length,
          'messages'
        )
      }
    } catch {
      // Fall through to DOM scraping
    }

    return response
  }
}

interface ChatMessage {
  role:      'user' | 'assistant' | 'system'
  content:   string
  timestamp: number
}

function parseGeminiBatchExecute(text: string): ChatMessage[] {
  const messages: ChatMessage[] = []

  try {
    // batchexecute responses start with )]}'\n
    // followed by JSON arrays
    const cleaned = text.replace(/^\)]\}'\n/, '').trim()

    // Extract quoted strings that look like conversation content
    // This is intentionally loose — catches most cases
    const jsonStr = JSON.parse(cleaned)
    const outer   = JSON.parse(jsonStr[0][2])

    if (!Array.isArray(outer)) return messages

    // Walk nested arrays looking for message content
    // Gemini format: [[[[userMsg], [assistantMsg]], ...]]
    const conversations = outer[0]?.[0] ?? []

    for (const turn of conversations) {
      const userContent      = turn?.[0]?.[0]?.trim()
      const assistantContent = turn?.[1]?.[0]?.[0]?.trim()

      if (userContent) {
        messages.push({
          role:      'user',
          content:   userContent,
          timestamp: Date.now(),
        })
      }
      if (assistantContent) {
        messages.push({
          role:      'assistant',
          content:   assistantContent,
          timestamp: Date.now(),
        })
      }
    }
  } catch {
    // batchexecute format changed — fall back to DOM
  }

  return messages
}

async function scrapeHistoryFromDOM(): Promise<void> {
  const messages: ChatMessage[] = []

  const userMsgs = document.querySelectorAll(
    '.user-query-text,[data-message-author-role="user"],' +
    '.query-text,user-query,[class*="UserMessage"]'
  )
  const asstMsgs = document.querySelectorAll(
    '.model-response-text,[data-message-author-role="model"],' +
    '.response-content,model-response,[class*="ModelResponse"]'
  )

  const allEls = [
    ...Array.from(userMsgs).map(el => ({
      role: 'user' as const,
      el,
      top:  el.getBoundingClientRect().top,
    })),
    ...Array.from(asstMsgs).map(el => ({
      role: 'assistant' as const,
      el,
      top:  el.getBoundingClientRect().top,
    })),
  ].sort((a, b) => a.top - b.top)

  for (const { role, el } of allEls) {
    const content = el.textContent?.trim()
    if (!content) continue
    messages.push({ role, content, timestamp: Date.now() })
  }

  if (messages.length === 0) { console.warn('[Cortex:Gemini] No messages found — selectors may need update'); return }

  await chrome.storage.local.set({
    [STORAGE_KEYS.history]: messages,
  })

  console.log(
    '[Cortex:Gemini] History cached via DOM:',
    messages.length,
    'messages'
  )
}

function watchURLChanges(): void {
  let lastUrl = window.location.href
  new MutationObserver(async () => {
    if (window.location.href === lastUrl) return
    lastUrl = window.location.href
    const convId = getConversationId()
    if (convId) await saveConversationId(convId)
    setTimeout(() => scrapeHistoryFromDOM(), 2000)
  }).observe(document.body, { childList: true, subtree: true })
}

function watchForNewMessages(): void {
  let debounce: ReturnType<typeof setTimeout>
  new MutationObserver(() => {
    clearTimeout(debounce)
    debounce = setTimeout(() => scrapeHistoryFromDOM(), 1000)
  }).observe(document.body, { childList: true, subtree: true, characterData: true })
}

function init(): void {
  console.log('[Cortex:Gemini] Tracker initialized')
  interceptGeminiFetch()
  const convId = getConversationId()
  if (convId) saveConversationId(convId)
  setTimeout(() => scrapeHistoryFromDOM(), 2000)
  watchURLChanges()
  watchForNewMessages()
}

init()
