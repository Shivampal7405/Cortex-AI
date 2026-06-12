import { Provider } from '../../shared/types'

interface CompareToolbarProps {
  leftProvider:  Provider
  rightProvider: Provider
  onClose:       () => void
}

const PROVIDER_NAMES: Record<Provider, string> = {
  claude:  'Claude',
  chatgpt: 'ChatGPT',
  gemini:  'Gemini',
  grok:    'Grok',
}

const PROVIDER_COLORS: Record<Provider, string> = {
  claude:  '#D97706',
  chatgpt: '#10A37F',
  gemini:  '#4285F4',
  grok:    '#6B7280',
}

export function CompareToolbar({ leftProvider, rightProvider, onClose }: CompareToolbarProps) {
  return (
    <div className="flex items-center justify-between px-6 h-14 border-b border-gray-200 dark:border-gray-800 shrink-0 bg-[#f9f9f9] dark:bg-[#1a1a1a] text-gray-900 dark:text-gray-100 rounded-t-xl">
      <div className="flex items-center gap-3">
        <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">Compare</span>
        <div className="h-4 w-px bg-gray-300 dark:bg-gray-700" />
        
        <div className="flex items-center gap-2 bg-white dark:bg-gray-800 px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PROVIDER_COLORS[leftProvider] }} />
            <span className="text-sm font-semibold">{PROVIDER_NAMES[leftProvider]}</span>
          </div>
          
          <span className="text-gray-400 font-bold mx-1">⇄</span>
          
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PROVIDER_COLORS[rightProvider] }} />
            <span className="text-sm font-semibold">{PROVIDER_NAMES[rightProvider]}</span>
          </div>
        </div>
      </div>

      <button
        onClick={onClose}
        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-all focus:outline-none focus:ring-2 focus:ring-purple-500/50"
        aria-label="Close"
      >
        <span className="text-xl font-bold leading-none mb-0.5">×</span>
      </button>
    </div>
  )
}
