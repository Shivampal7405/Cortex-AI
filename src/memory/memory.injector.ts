/**
 * memory.injector.ts
 * Builds context block from memory facts + project profiles.
 * Injects into any AI's input field on user request.
 * User always controls injection — never automatic.
 */

import { getPinnedFacts, getAllProjects } from './memory.store'
import type { Provider } from '../shared/types'

// Build full context block from all memory layers
export async function buildContextBlock(): Promise<string> {
  const facts    = await getPinnedFacts()
  const projects = await getAllProjects()
  const parts: string[] = []

  if (facts.length > 0) {
    const lines = facts.map(f => `- ${f.content}`).join('\n')
    parts.push(`[About me]\n${lines}`)
  }

  if (projects.length > 0) {
    const projectLines = projects.map(p => {
      const lines = [
        `${p.name}: ${p.description}`,
        p.stack.length > 0  && `  Stack: ${p.stack.join(', ')}`,
        p.status            && `  Status: ${p.status}`,
        p.goals.length > 0  && `  Goals: ${p.goals.join(', ')}`,
        p.notes             && `  Notes: ${p.notes}`,
      ].filter(Boolean)
      return lines.join('\n')
    }).join('\n\n')

    parts.push(`[My projects]\n${projectLines}`)
  }

  if (parts.length === 0) return ''
  return parts.join('\n\n') + '\n\n'
}

// Inject context block into target AI's input field.
// Called from the CORTEX_INJECT_MEMORY postMessage handler
// in the target page's content script.
export function injectIntoInput(
  contextBlock: string,
  provider: Provider
): boolean {
  const selectors: Record<string, string[]> = {
    claude:  ['.ProseMirror', '[contenteditable="true"]'],
    chatgpt: ['#prompt-textarea', '[contenteditable="true"][role="textbox"]', 'textarea'],
    gemini:  ['.ql-editor', '[contenteditable="true"]', 'textarea'],
    grok:    ['textarea', '[contenteditable="true"]'],
  }

  const providerSelectors = selectors[provider] ?? []

  for (const sel of providerSelectors) {
    const el = document.querySelector(sel) as HTMLElement | null
    if (!el) continue

    el.focus()
    const existing   = el.innerText ?? ''
    const newContent = contextBlock + existing

    if (el instanceof HTMLTextAreaElement) {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype, 'value'
      )?.set
      setter?.call(el, newContent)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    } else if (el.isContentEditable) {
      document.execCommand('selectAll', false, undefined)
      document.execCommand('insertText', false, newContent)
    }

    console.log('[Cortex] Memory injected into', provider)
    return true
  }

  console.warn('[Cortex] Could not find input for', provider)
  return false
}
