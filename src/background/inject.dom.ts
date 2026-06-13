/**
 * inject.dom.ts
 * Self-contained function injected into provider tabs via
 * chrome.scripting.executeScript. It must NOT reference any outer scope
 * (it is serialised and run in the page's MAIN world).
 *
 * Used by: compare (submit=true), prompt-library inject and memory inject
 * (submit=false). Finds the composer even inside open shadow roots, retries
 * for slow/new tabs, types the text, and optionally submits.
 */

export function injectComposer(text: string, prov: string, submit: boolean): void {
  const selectors: Record<string, string[]> = {
    claude:  ['.ProseMirror', 'div[contenteditable="true"]'],
    chatgpt: ['#prompt-textarea', 'textarea[data-id]', 'textarea'],
    gemini:  ['rich-textarea textarea', 'textarea', '.ql-editor', '[contenteditable="true"]'],
    grok:    ['textarea', 'div[contenteditable="true"]', '[contenteditable="true"]', '[role="textbox"]'],
  }
  const submitSelectors = [
    '[data-testid="send-button"]', '[data-testid*="send" i]',
    'button[aria-label*="Send" i]', 'button[aria-label*="submit" i]',
    'button[jsaction*="send" i]', 'button.send-button',
    'button[type="submit"]', 'form button[type="submit"]',
  ].join(',')

  const isVisible = (e: Element): boolean =>
    !!(e as HTMLElement).offsetParent || e.getClientRects().length > 0

  const findInput = (): HTMLElement | null => {
    for (const sel of selectors[prov] ?? []) {
      const els = Array.from(document.querySelectorAll(sel)).filter(isVisible) as HTMLElement[]
      if (els.length) return els[els.length - 1] ?? null
    }
    const found: HTMLElement[] = []
    const walk = (root: Document | ShadowRoot): void => {
      root.querySelectorAll('textarea, [contenteditable="true"], [role="textbox"]').forEach(e => {
        if (isVisible(e)) found.push(e as HTMLElement)
      })
      root.querySelectorAll('*').forEach(e => {
        const sr = (e as HTMLElement).shadowRoot
        if (sr) walk(sr)
      })
    }
    walk(document)
    return found.length ? (found[found.length - 1] ?? null) : null
  }

  let tries = 0
  const run = (): void => {
    const el = findInput()
    if (!el) {
      if (++tries < 40) { setTimeout(run, 300); return }
      console.warn('[Cortex] inject: input not found for', prov)
      return
    }
    el.focus()   // do NOT click - clicking the composer can open site menus

    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
      const existing = submit ? '' : el.value
      setter?.call(el, text + existing)
      el.dispatchEvent(new Event('input',  { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    } else {
      // contenteditable: replace on submit, prepend otherwise
      if (submit) {
        document.execCommand('selectAll', false, undefined)
      } else {
        const sel = window.getSelection()
        const range = document.createRange()
        range.setStart(el, 0); range.collapse(true)
        sel?.removeAllRanges(); sel?.addRange(range)
      }
      const ok = document.execCommand('insertText', false, text)
      if (!ok) {
        el.textContent = text + (submit ? '' : (el.textContent ?? ''))
      }
      // Always notify the editor framework that content changed.
      el.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' }))
    }

    if (submit) {
      // The send button is disabled until the editor registers the text, so retry
      // clicking it for a few seconds before falling back to an Enter keypress.
      let st = 0
      const trySubmit = (): void => {
        const btn = document.querySelector(submitSelectors) as HTMLButtonElement | null
        if (btn && !btn.disabled && btn.offsetParent) { btn.click(); return }
        if (++st < 12) { setTimeout(trySubmit, 400); return }
        for (const type of ['keydown', 'keypress', 'keyup']) {
          el.dispatchEvent(new KeyboardEvent(type, { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }))
        }
      }
      setTimeout(trySubmit, 500)
    }
  }
  run()
}
