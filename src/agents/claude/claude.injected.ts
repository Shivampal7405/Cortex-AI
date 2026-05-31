/**
 * claude.injected.ts
 * Injected into the MAIN world to intercept claude.ai's own fetch calls.
 * This is necessary because content scripts run in an isolated world and
 * cannot intercept the main page's fetch.
 */

function initInterceptor() {
  const originalFetch = window.fetch.bind(window)

  window.fetch = async function(input, init) {
    const response = await originalFetch(input, init)
    
    const url = typeof input === 'string' ? input
              : input instanceof URL ? input.href
              : (input as Request).url

    if (!url.includes('claude.ai/api/organizations')) return response

    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('text/event-stream')) return response

    const clone = response.clone()
    readSSEForUsage(clone).catch(() => {})

    return response
  }
}

async function readSSEForUsage(response: Response): Promise<void> {
  const reader = response.body?.getReader()
  if (!reader) return

  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const raw = line.slice(6).trim()
        if (raw === '[DONE]') continue

        try {
          const event = JSON.parse(raw)

          if (event.type === 'message_limit') {
            console.log('[Cortex] message_limit event in MAIN world:', event)
            window.postMessage({
              type: 'CORTEX_MESSAGE_LIMIT',
              data: event.message_limit
            }, '*')
          }
        } catch { /* skip non-JSON */ }
      }
    }
  } catch (err) {
    console.warn('[Cortex] SSE read error:', err)
  } finally {
    reader.releaseLock()
  }
}

initInterceptor()
