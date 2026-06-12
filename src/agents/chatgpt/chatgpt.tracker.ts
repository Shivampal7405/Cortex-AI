/**
 * chatgpt.tracker.ts
 * Invisible content script for chatgpt.com
 * Tracks active conversation ID and caches message history.
 * Zero UI. Runs silently at document_idle.
 */

export {}

// Storage keys
const STORAGE_KEYS = {
  convId:   'chatgpt_conv_id',
  history:  'chatgpt_conv_history',
  lastSeen: 'chatgpt_last_seen',
} as const

// Extract conversation ID from ChatGPT URL
// Handles both /c/{id} (standard) and /g/{id} (GPT model routes)
function getConversationId(): string | null {
  const match = window.location.pathname
    .match(/\/(?:c|g)\/([a-zA-Z0-9-]+)/)
  return match ? (match[1] ?? null) : null
}

// Save conversation ID to storage
async function saveConversationId(id: string): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.convId]:   id,
    [STORAGE_KEYS.lastSeen]: Date.now(),
  })
  console.log('[Cortex:ChatGPT] Conversation ID saved:', id)
}

// Intercept fetch to capture conversation history
// ChatGPT loads history via:
// GET /backend-api/conversation/{id}
function interceptConversationFetch(): void {
  const originalFetch = window.fetch.bind(window)

  window.fetch = async function(input, init) {
    const response = await originalFetch(input, init)

    const url = typeof input === 'string' ? input
              : input instanceof URL      ? input.href
              : (input as Request).url

    // Intercept conversation history endpoint
    if (!url.includes('/backend-api/conversation/')) return response

    try {
      const clone = response.clone()
      const body  = await clone.json()

      if (body?.mapping) {
        // ChatGPT conversation format:
        // { mapping: { [nodeId]: { message: { role, content } } } }
        const messages = parseChattGPTHistory(body.mapping)

        await chrome.storage.local.set({
          [STORAGE_KEYS.history]: messages,
        })

        console.log(
          '[Cortex:ChatGPT] History cached:',
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

// Parse ChatGPT's mapping format into flat message array
interface ChatMessage {
  role:      'user' | 'assistant' | 'system'
  content:   string
  timestamp: number
}

interface ChatGPTNode {
  message?: {
    author?:      { role: string }
    content?:     { parts?: string[] }
    create_time?: number
  }
  children?: string[]
  parent?:   string
}

function parseChattGPTHistory(
  mapping: Record<string, ChatGPTNode>
): ChatMessage[] {
  const messages: ChatMessage[] = []

  // Walk the tree in order
  for (const node of Object.values(mapping)) {
    const msg = node.message
    if (!msg?.content?.parts) continue

    const role    = msg.author?.role
    // Skip system, tool, multimodal_text roles:
    if (!['user', 'assistant'].includes(role ?? '')) continue

    const content = msg.content.parts
                      .filter(Boolean)
                      .join('')
                      .trim()

    if (!content) continue

    messages.push({
      role:      role as 'user' | 'assistant',
      content,
      timestamp: (msg.create_time ?? 0) * 1000,
    })
  }

  // Sort by timestamp
  return messages.sort((a, b) => a.timestamp - b.timestamp)
}

// Watch for URL changes (ChatGPT is a SPA)
function watchURLChanges(): void {
  let lastUrl = window.location.href

  new MutationObserver(() => {
    if (window.location.href === lastUrl) return
    lastUrl = window.location.href

    const convId = getConversationId()
    if (convId) saveConversationId(convId)
  }).observe(document.body, {
    childList: true,
    subtree:   true,
  })
}

async function checkAndHandleCompareMode(
  responseText: string,
  isDone: boolean
): Promise<boolean> {
  const storage = await chrome.storage.local.get('compare_mode')
  const mode = storage['compare_mode'] as {
    active: boolean
    target: string
  } | null

  const thisProvider = 'chatgpt'

  if (!mode?.active || mode.target !== thisProvider) return false

  chrome.runtime.sendMessage({
    type:     'COMPARE_RESULT',
    provider: thisProvider,
    chunk:    responseText,
    done:     isDone,
  }).catch(() => {})

  if (isDone) {
    chrome.storage.local.remove('compare_mode')
  }
  return true
}

let compareObserver: MutationObserver | null = null

function watchForCompareMode(): void {
  // We use DOM polling since fetching SSE text is complex
  setInterval(async () => {
    const storage = await chrome.storage.local.get('compare_mode')
    const mode = storage['compare_mode'] as { active: boolean; target: string } | null
    if (mode?.active && mode.target === 'chatgpt') {
      if (!compareObserver) {
        let lastSentLength = 0
        compareObserver = new MutationObserver(() => {
          const msgs = document.querySelectorAll('.markdown.prose, [data-message-author-role="assistant"]')
          const lastMsg = msgs[msgs.length - 1]
          if (lastMsg) {
            const text = lastMsg.textContent || ''
            const newText = text.slice(lastSentLength)
            if (newText) {
              lastSentLength = text.length
              const isStreaming = document.querySelector('.result-streaming') !== null
              checkAndHandleCompareMode(newText, false)
              
              if (!isStreaming) {
                // Done!
                setTimeout(() => {
                  checkAndHandleCompareMode('', true)
                }, 500)
                compareObserver?.disconnect()
                compareObserver = null
              }
            }
          }
        })
        compareObserver.observe(document.body, { childList: true, subtree: true, characterData: true })
      }
    }
  }, 1000)
}

// Entry point
function init(): void {
  console.log('[Cortex:ChatGPT] Tracker initialized')

  // Intercept fetch FIRST before any page scripts run
  interceptConversationFetch()

  // Save current conversation ID
  const convId = getConversationId()
  if (convId) saveConversationId(convId)

  // Watch for navigation to new conversations
  watchURLChanges()

  watchForCompareMode()
}

init()
