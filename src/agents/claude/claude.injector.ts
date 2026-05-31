/**
 * claude.injector.ts
 * Handles DOM injection specifically for claude.ai.
 * Finds the right insertion point in claude.ai's DOM
 * and keeps the token bar positioned correctly as the UI updates.
 */

const INPUT_SELECTORS = [
  'fieldset',
  '[data-testid="composer-container"]'
]

export function findClaudeInputArea(): HTMLElement | null {
  for (const selector of INPUT_SELECTORS) {
    const el = document.querySelector(selector)
    if (el) return el as HTMLElement
  }
  return null
}

// Insert token bar container above the input area
export function insertTokenBarContainer(inputArea: HTMLElement): HTMLElement {
  const existing = document.getElementById('cortex-token-bar')
  if (existing) return existing

  const container = document.createElement('div')
  container.id = 'cortex-token-bar'
  container.style.cssText = `
    width: 100%;
    z-index: 1000;
    font-family: inherit;
    flex-shrink: 0;
  `

  let target = inputArea
  const fieldset = inputArea.closest('fieldset') as HTMLElement | null
  const composer = inputArea.closest('[data-testid="composer-container"]') as HTMLElement | null

  if (fieldset) {
    target = fieldset
  } else if (composer) {
    target = composer
  }

  // Insert above the target
  if (target.parentElement) {
    target.parentElement.insertBefore(container, target)
  }

  return container
}
