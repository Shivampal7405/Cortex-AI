import { Provider } from '../../shared/types'

interface ComparePaneProps {
  provider:   Provider
  response:   string
  streaming:  boolean
  tokens:     number
  cost:       number
  onCopy:     () => void
  onContinue: () => void
}

const PROVIDER_COLORS: Record<Provider, string> = {
  claude:  '#D97706',
  chatgpt: '#10A37F',
  gemini:  '#4285F4',
  grok:    '#6B7280',
}

const PROVIDER_NAMES: Record<Provider, string> = {
  claude:  'Claude',
  chatgpt: 'ChatGPT',
  gemini:  'Gemini',
  grok:    'Grok',
}

export function ComparePane({
  provider,
  response,
  streaming,
  tokens,
  cost,
  onCopy,
  onContinue,
}: ComparePaneProps) {
  const color = PROVIDER_COLORS[provider]
  const name  = PROVIDER_NAMES[provider]

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 overflow-hidden text-gray-900 dark:text-gray-100">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 shrink-0">
        <div className="flex items-center gap-2">
          <div
            className={`w-2.5 h-2.5 rounded-full ${streaming ? 'animate-pulse' : ''}`}
            style={{ backgroundColor: color }}
          />
          <span className="font-semibold text-[15px]">{name}</span>
          <span className="text-xs text-gray-500 ml-2 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
            {streaming ? 'streaming...' : 'done'}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 text-[15px] leading-relaxed whitespace-pre-wrap font-sans prose dark:prose-invert max-w-none">
        {response}
        {streaming && (
          <span className="inline-block w-1.5 h-4 ml-1 bg-gray-400 animate-pulse align-middle" />
        )}
      </div>

      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-800 shrink-0 bg-gray-50 dark:bg-gray-800/50">
        <div className="text-xs font-medium text-gray-500 bg-white dark:bg-gray-900 px-2.5 py-1 rounded-md border border-gray-200 dark:border-gray-700">
          {tokens.toLocaleString()} tokens <span className="mx-1">·</span> ${cost.toFixed(4)}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onCopy}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 rounded shadow-sm transition-colors"
          >
            Copy
          </button>
          <button
            onClick={onContinue}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded shadow-sm hover:opacity-90 transition-all active:scale-95"
            style={{ backgroundColor: color }}
          >
            Continue here <span className="text-[14px]">→</span>
          </button>
        </div>
      </div>
    </div>
  )
}
