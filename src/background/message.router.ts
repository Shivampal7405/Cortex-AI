/**
 * message.router.ts
 * Central message hub for the background service worker.
 * Routes messages between content scripts, popup, and storage.
 * Compare + Prompts logic lives in feature.handlers.ts.
 */

import { handleUsageUpdate }     from './usage.aggregator'
import { transferContext }       from '../memory/context.transfer'
import { buildContextBlock }     from '../memory/memory.injector'
import { saveFact, getAllFacts } from '../memory/memory.store'
import {
  handleCompareStart, handleCompareResult,
  getPrompts, savePrompt, deletePrompt, injectPrompt,
} from './feature.handlers'
import type { Provider, SavedPrompt } from '../shared/types'
import type { MemoryFact }            from '../memory/memory.types'

export type RouterMessage =
  | { type: 'USAGE_UPDATE';     provider: string; data: unknown }
  | { type: 'SWITCH_MODEL';     provider: string; from_model: string; to_model: string }
  | { type: 'GET_STATE';        provider: string }
  | { type: 'SAVE_FACT';        fact: MemoryFact }
  | { type: 'INJECT_MEMORY';    provider: string }
  | { type: 'TRANSFER_CONTEXT'; from: Provider; to: Provider }
  | { type: 'ACTIVE_REBUILD' }
  | { type: 'GET_MEMORY_JSON' }
  | { type: 'SAVE_API_KEY';     provider: string; key: string }
  | { type: 'GET_HEATMAP';      provider: string }
  | { type: 'COMPARE_START';    prompt: string; targetProvider: Provider; claudeResponse: string }
  | { type: 'COMPARE_RESULT';   chunk: string; done: boolean; provider: Provider }
  | { type: 'GET_PROMPTS' }
  | { type: 'SAVE_PROMPT';      prompt: SavedPrompt }
  | { type: 'DELETE_PROMPT';    id: string }
  | { type: 'INJECT_PROMPT';    content: string; provider: string }

export function initMessageRouter(): void {
  chrome.runtime.onMessage.addListener(
    (message: RouterMessage, sender, sendResponse) => {

      switch (message.type) {

        case 'USAGE_UPDATE':
          handleUsageUpdate(message.provider, message.data)
          chrome.runtime.sendMessage({
            type: 'STATE_UPDATED', provider: message.provider,
          }).catch(() => {})
          return false

        case 'SWITCH_MODEL':
          console.log(`[Cortex] Model switch: ${message.from_model} → ${message.to_model}`)
          return false

        case 'GET_STATE':
          chrome.storage.local.get(
            `provider:${message.provider}`,
            (result) => sendResponse(result)
          )
          return true

        case 'SAVE_FACT':
          saveFact(message.fact)
            .then(() => getAllFacts())
            .then(facts => {
              chrome.runtime.sendMessage({
                type: 'MEMORY_UPDATED', count: facts.length,
              }).catch(() => {})
            })
            .catch(err => console.warn('[Cortex] SAVE_FACT failed:', err))
          return false

        case 'INJECT_MEMORY': {
          const provider = message.provider
          const urlMap: Record<string, string> = {
            claude:  'https://claude.ai/*',
            chatgpt: 'https://chatgpt.com/*',
            gemini:  'https://gemini.google.com/*',
            grok:    'https://x.com/*',
          }
          ;(async () => {
            const tabs = await chrome.tabs.query({ url: urlMap[provider] ?? '' })
            if (!tabs[0]?.id) {
              sendResponse({ ok: false, error: `Open ${provider} in a tab first` })
              return
            }
            const contextBlock = await buildContextBlock()
            if (!contextBlock) {
              sendResponse({ ok: false, error: 'No pinned facts to inject — pin some memory first' })
              return
            }
            await chrome.scripting.executeScript({
              target: { tabId: tabs[0].id },
              func:   (block: string, prov: string) => {
                window.postMessage({ type: 'CORTEX_INJECT_MEMORY', block, provider: prov }, '*')
              },
              args: [contextBlock, provider],
            })
            const factCount = (contextBlock.match(/^- /gm) ?? []).length
            sendResponse({ ok: true, factCount })
          })().catch(err => sendResponse({ ok: false, error: String(err) }))
          return true   // keep channel open for async sendResponse
        }

        case 'TRANSFER_CONTEXT':
          transferContext(message.from, message.to)
            .catch(err => console.warn('[Cortex] TRANSFER_CONTEXT failed:', err))
          return false

        case 'ACTIVE_REBUILD':
          ;(async () => {
            const { activeRebuild } = await import('../memory/llm.rebuilder')
            const result = await activeRebuild()
            sendResponse(result)
          })().catch(err => { console.warn('[Cortex] ACTIVE_REBUILD failed:', err); sendResponse({ success: false, message: String(err), factCount: 0 }) })
          return true

        case 'GET_MEMORY_JSON':
          chrome.storage.local.get('cortex_memory_json', (r) => sendResponse(r['cortex_memory_json'] ?? null))
          return true

        case 'SAVE_API_KEY':
          chrome.storage.local.set({ [`api_key_${message.provider}`]: message.key }, () => sendResponse({ success: true }))
          return true

        case 'GET_HEATMAP':
          ;(async () => {
            const { getHeatmapData } = await import('./history.recorder')
            const data = await getHeatmapData(message.provider)
            sendResponse(data)
          })().catch(() => sendResponse({}))
          return true

        case 'COMPARE_START': {
          const tabId = sender?.tab?.id
          if (!tabId) return false
          handleCompareStart(message.prompt, message.targetProvider, tabId)
            .catch(err => console.warn('[Cortex] COMPARE_START failed:', err))
          return false
        }

        case 'COMPARE_RESULT':
          handleCompareResult(message.chunk, message.done, message.provider)
            .catch(err => console.warn('[Cortex] COMPARE_RESULT failed:', err))
          return false

        case 'GET_PROMPTS':
          getPrompts().then(sendResponse).catch(() => sendResponse([]))
          return true

        case 'SAVE_PROMPT':
          savePrompt(message.prompt)
            .then(() => sendResponse({ success: true }))
            .catch(() => sendResponse({ success: false }))
          return true

        case 'DELETE_PROMPT':
          deletePrompt(message.id)
            .then(() => sendResponse({ success: true }))
            .catch(() => sendResponse({ success: false }))
          return true

        case 'INJECT_PROMPT':
          injectPrompt(message.content, message.provider)
            .catch(err => console.warn('[Cortex] INJECT_PROMPT failed:', err))
          return false

        default:
          return false
      }
    }
  )
}
