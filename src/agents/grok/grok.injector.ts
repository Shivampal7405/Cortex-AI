/**
 * grok.injector.ts
 * Handles DOM injection specifically for x.com (Grok).
 */

const INPUT_SELECTORS = [
  '[data-testid="tweetTextarea_0"]',
  '.r-30o5oe',
]

export function findGrokInputArea(): HTMLElement | null {
  for (const selector of INPUT_SELECTORS) {
    const el = document.querySelector(selector)
    if (el) return el as HTMLElement
  }
  return null
}

export function insertTokenBarContainer(inputArea: HTMLElement): HTMLElement {
  const existing = document.getElementById('cortex-token-bar')
  if (existing) return existing

  const container = document.createElement('div')
  container.id = 'cortex-token-bar'
  container.style.cssText =
    'width: 100%; z-index: 1000; font-family: inherit; flex-shrink: 0;'

  const target =
    (inputArea.closest('.r-30o5oe') as HTMLElement | null) ?? inputArea

  if (target.parentElement) {
    target.parentElement.insertBefore(container, target)
  }

  return container
}
