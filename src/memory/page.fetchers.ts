/**
 * page.fetchers.ts
 * Self-contained function injected into provider tabs via chrome.scripting.
 * Fetches conversation history using the page's own session/cookies.
 * MUST remain self-contained — no imports, no external closures.
 */

type PageMessage = { role: string; content: string; timestamp: number }

// Injected into the provider's own tab (MAIN world).
// Runs with valid session context so credentials work automatically.
export function fetchConversationFromPage(
  provider: string
): Promise<PageMessage[]> {

  function getCookie(name: string): string | null {
    const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
    return m?.[1] !== undefined ? decodeURIComponent(m[1]) : null
  }

  function getConvId(): string | null {
    const p = window.location.pathname
    return (
      p.match(/\/chat\/([a-zA-Z0-9-]+)/)?.[1]   ??   // Claude
      p.match(/\/(?:c|g)\/([a-zA-Z0-9-]+)/)?.[1] ??   // ChatGPT (/c/ standard, /g/ GPT routes)
      p.match(/\/app\/([a-zA-Z0-9_-]+)/)?.[1]   ??   // Gemini
      null
    )
  }

  async function fetchClaude(): Promise<PageMessage[]> {
    const orgId  = getCookie('lastActiveOrg')
    const convId = getConvId()
    if (!orgId || !convId) {
      console.warn('[Cortex] Claude: missing orgId or convId', { orgId, convId, path: window.location.pathname })
      return []
    }
    const url = `https://claude.ai/api/organizations/${orgId}` +
                `/chat_conversations/${convId}` +
                `?tree=true&rendering_mode=messages&render_all_tools=true`
    const res = await fetch(url, { credentials: 'include' })
    if (!res.ok) { console.warn('[Cortex] Claude fetch failed:', res.status); return [] }
    const data = await res.json()
    return ((data?.chat_messages ?? []) as Array<{
      role: string
      content: Array<{ type: string; text?: string }>
      created_at: string
    }>)
      .map(msg => ({
        role:      msg.role === 'human' ? 'user' : 'assistant',
        content:   (msg.content ?? []).filter(c => c.type === 'text').map(c => c.text ?? '').join('').trim(),
        timestamp: new Date(msg.created_at).getTime(),
      }))
      .filter(m => m.content.length > 0)
  }

  async function fetchChatGPT(): Promise<PageMessage[]> {
    const convId = getConvId()
    if (!convId) return []
    const res = await fetch(`https://chatgpt.com/backend-api/conversation/${convId}`, { credentials: 'include' })
    if (!res.ok) return []
    const data = await res.json()
    const msgs: PageMessage[] = []
    for (const node of Object.values(data?.mapping ?? {}) as Array<{
      message?: { author?: { role: string }; content?: { parts?: string[] }; create_time?: number }
    }>) {
      const role    = node.message?.author?.role
      const content = (node.message?.content?.parts ?? []).filter(Boolean).join('').trim()
      if (!content || (role !== 'user' && role !== 'assistant')) continue
      msgs.push({ role, content, timestamp: (node.message?.create_time ?? 0) * 1000 })
    }
    return msgs.sort((a, b) => a.timestamp - b.timestamp)
  }

  function fetchGemini(): Promise<PageMessage[]> {
    const msgs: PageMessage[] = []
    const USER_SEL = '.user-query-text,[data-message-author-role="user"],' +
                     '.query-text,user-query,[class*="UserMessage"]'
    const ASST_SEL = '.model-response-text,[data-message-author-role="model"],' +
                     '.response-content,model-response,[class*="ModelResponse"]'
    const all = [
      ...Array.from(document.querySelectorAll(USER_SEL)).map(el => ({ role: 'user',      el })),
      ...Array.from(document.querySelectorAll(ASST_SEL)).map(el => ({ role: 'assistant', el })),
    ].sort((a, b) =>
      a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
    )
    for (const { role, el } of all) {
      const content = el.textContent?.trim()
      if (content) msgs.push({ role, content, timestamp: Date.now() })
    }
    if (msgs.length === 0) console.warn('[Cortex:Gemini] fetchGemini: no messages found in DOM')
    return Promise.resolve(msgs)
  }

  function fetchGrok(): Promise<PageMessage[]> {
    const msgs: PageMessage[] = []
    const GROK_SEL = '[data-testid="grok-message"],[class*="GrokMessage"],' +
                     '[class*="ChatMessage"],[class*="MessageBubble"],' +
                     '[class*="ConversationTurn"],article'
    document.querySelectorAll(GROK_SEL).forEach(el => {
      const isUser  = !!el.querySelector('[data-testid="user-message"],[class*="UserMessage"]')
      const content = el.textContent?.trim()
      if (content) msgs.push({ role: isUser ? 'user' : 'assistant', content, timestamp: Date.now() })
    })
    return Promise.resolve(msgs)
  }

  switch (provider) {
    case 'claude':  return fetchClaude()
    case 'chatgpt': return fetchChatGPT()
    case 'gemini':  return fetchGemini()
    case 'grok':    return fetchGrok()
    default:        return Promise.resolve([])
  }
}
