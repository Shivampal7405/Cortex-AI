/**
 * claude.model-switcher.ts
 * Triggers Claude's native model selector from our token bar.
 * Finds and clicks Claude's own model button.
 * Watches for model changes and reports back.
 */

// Claude model selector button — try in priority order
const MODEL_BUTTON_SELECTORS = [
  '[data-testid="model-selector-dropdown"]',
  'button[aria-label*="model" i]',
  'button[aria-label*="Model" i]',
  '.model-selector button',
  '[data-testid*="model"] button',
]

// Display name keyword → canonical model ID
const MODEL_NAME_MAP: Record<string, string> = {
  'opus':    'claude-opus-4-5',
  'sonnet':  'claude-sonnet-4-5',
  'haiku':   'claude-haiku-4-5',
}

export function findModelButton(): HTMLElement | null {
  for (const sel of MODEL_BUTTON_SELECTORS) {
    const el = document.querySelector(sel)
    if (el) return el as HTMLElement
  }
  return null
}

export function getCurrentModel(): string {
  const btn = findModelButton()
  if (!btn) return 'claude-sonnet-4-5'

  const text = (btn.textContent ?? '').toLowerCase()
  for (const [name, id] of Object.entries(MODEL_NAME_MAP)) {
    if (text.includes(name)) return id
  }
  return 'claude-sonnet-4-5'
}

export function openModelSelector(): void {
  const btn = findModelButton()
  if (!btn) {
    console.warn('[Cortex] Model selector button not found')
    return
  }
  btn.click()
  console.log('[Cortex] Opened native model selector')
}

// Watch Claude's model button for text changes.
// Fires callback whenever user switches model natively.
export function watchModelChanges(
  callback: (model: string) => void
): MutationObserver {
  const observer = new MutationObserver(() => {
    callback(getCurrentModel())
  })

  const btn = findModelButton()
  if (btn) {
    observer.observe(btn, {
      childList:     true,
      subtree:       true,
      characterData: true,
    })
  }

  return observer
}
