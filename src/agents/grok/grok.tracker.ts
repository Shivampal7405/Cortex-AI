/**
 * grok.tracker.ts
 * Invisible content script for x.com/grok
 * Tracks active Grok conversation and caches message history.
 * Grok embeds conversation in GraphQL responses.
 * Zero UI. Runs silently at document_idle.
 */

export {}

const STORAGE_KEYS = {
  convId:   'grok_conv_id',
  history:  'grok_conv_history',
  lastSeen: 'grok_last_seen',
} as const

// Grok conversation IDs appear in URLs and API responses
// Pattern: x.com/i/grok?conversation={id}
// Or extracted from GraphQL response
function getConversationIdFromURL(): string | null {
  const params = new URLSearchParams(window.location.search)
  return params.get('conversation') ??
         params.get('conversationId') ??
         null
}

async function saveConversationId(id: string): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.convId]:   id,
    [STORAGE_KEYS.lastSeen]: Date.now(),
  })
  console.log('[Cortex:Grok] Conversation ID saved:', id)
}

// Intercept Grok's GraphQL and REST API calls
function interceptGrokFetch(): void {
  const originalFetch = window.fetch.bind(window)

  window.fetch = async function(input, init) {
    const response = await originalFetch(input, init)

    const url = typeof input === 'string' ? input
              : input instanceof URL      ? input.href
              : (input as Request).url

    const isGrokAPI = url.includes('/i/api/graphql') ||
                      url.includes('/2/grok/') ||
                      url.includes('api.x.com/2/grok')

    if (!isGrokAPI) return response

    try {
      const clone = response.clone()
      const body  = await clone.json()

      // Extract conversation ID from response
      const convId = extractGrokConvId(body)
      if (convId) await saveConversationId(convId)

      // Extract message history
      const messages = extractGrokHistory(body)
      if (messages.length > 0) {
        await chrome.storage.local.set({
          [STORAGE_KEYS.history]: messages,
        })
        console.log(
          '[Cortex:Grok] History cached:',
          messages.length,
          'messages'
        )
      }
    } catch {
      // Never break the page
    }

    return response
  }
}

interface ChatMessage {
  role:      'user' | 'assistant' | 'system'
  content:   string
  timestamp: number
}

// Extract conversation ID from Grok GraphQL response
function extractGrokConvId(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>

  const d = b['data'] as Record<string, unknown> | undefined
  const paths: unknown[] = [
    (d?.['conversation'] as Record<string, unknown> | undefined)?.['conversationId'],
    (d?.['grokConversation'] as Record<string, unknown> | undefined)?.['conversationId'],
    b['conversationId'],
    ((d?.['addGrokMessage'] as Record<string, unknown> | undefined)
      ?.['conversation'] as Record<string, unknown> | undefined)
      ?.['conversationId'],
  ]

  for (const path of paths) {
    if (typeof path === 'string' && path.length > 0) return path
  }

  return null
}

// Extract message history from Grok GraphQL response
function extractGrokHistory(body: unknown): ChatMessage[] {
  const messages: ChatMessage[] = []
  if (!body || typeof body !== 'object') return messages

  const b = body as Record<string, unknown>
  const d = b['data'] as Record<string, unknown> | undefined

  const rawMessages =
    (d?.['conversation'] as Record<string, unknown> | undefined)?.['messages'] ??
    d?.['grokMessages'] ??
    null

  if (!Array.isArray(rawMessages)) return messages

  for (const msg of rawMessages) {
    const role    = msg?.sender === 'human' ? 'user' : 'assistant'
    const content = msg?.message ?? msg?.text ?? msg?.content ?? ''

    if (!content.trim()) continue

    messages.push({
      role:      role as 'user' | 'assistant',
      content:   content.trim(),
      timestamp: msg?.createdAt
                   ? new Date(msg.createdAt).getTime()
                   : Date.now(),
    })
  }

  return messages
}

async function scrapeHistoryFromDOM(): Promise<void> {
  const messages: ChatMessage[] = []

  const allMessages = document.querySelectorAll(
    '[data-testid="grok-message"],.grok-message,' +
    '[class*="GrokMessage"],[class*="ChatMessage"],' +
    '[class*="MessageBubble"],[class*="ConversationTurn"],article'
  )

  for (const el of allMessages) {
    const isUser    = el.querySelector('[data-testid="user-message"]') !== null
                   || el.classList.contains('human')
    const content   = el.textContent?.trim()
    if (!content) continue

    messages.push({
      role:      isUser ? 'user' : 'assistant',
      content,
      timestamp: Date.now(),
    })
  }

  if (messages.length === 0) return

  await chrome.storage.local.set({
    [STORAGE_KEYS.history]: messages,
  })

  console.log(
    '[Cortex:Grok] History cached via DOM:',
    messages.length,
    'messages'
  )
}

function watchURLChanges(): void {
  let lastUrl = window.location.href
  new MutationObserver(async () => {
    if (window.location.href === lastUrl) return
    lastUrl = window.location.href
    const convId = getConversationIdFromURL()
    if (convId) await saveConversationId(convId)
    setTimeout(() => scrapeHistoryFromDOM(), 1500)
  }).observe(document.body, { childList: true, subtree: true })
}

function init(): void {
  console.log('[Cortex:Grok] Tracker initialized')
  interceptGrokFetch()
  const convId = getConversationIdFromURL()
  if (convId) saveConversationId(convId)
  setTimeout(() => scrapeHistoryFromDOM(), 2000)
  watchURLChanges()
}

init()
