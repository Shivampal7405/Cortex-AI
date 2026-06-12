

export interface SavedPrompt {
  id:        string
  title:     string
  content:   string
  tags:      string[]
  use_count: number
  created_at:number
  pinned:    boolean
}

interface PromptCardProps {
  prompt:    SavedPrompt
  onInject:  (id: string) => void
  onCopy:    (id: string) => void
  onPin:     (id: string) => void
  onDelete:  (id: string) => void
}

export function PromptCard({ prompt, onInject, onCopy, onPin, onDelete }: PromptCardProps) {
  return (
    <div className="flex flex-col p-3 border-l-4 border-l-purple-500 bg-white dark:bg-gray-800 border-y border-r border-gray-200 dark:border-gray-700 rounded-r-md shadow-sm">
      <div className="flex items-start justify-between mb-1.5">
        <h3 className="font-semibold text-sm text-gray-900 dark:text-white truncate pr-2">
          {prompt.title}
        </h3>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onPin(prompt.id)}
            className={`p-1 rounded transition-colors ${prompt.pinned ? 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
            title={prompt.pinned ? "Unpin" : "Pin"}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill={prompt.pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="17" x2="12" y2="22"></line>
              <path d="M5 17h14v-1.5c0-1.5-2-3.5-2-5.5v-3c0-2-2-4-5-4s-5 2-5 4v3c0 2-2 4-2 5.5z"></path>
            </svg>
          </button>
          <button
            onClick={() => onDelete(prompt.id)}
            className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            title="Delete"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18"></path>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-3 h-8">
        {prompt.content}
      </p>

      <div className="flex items-center justify-between mt-auto">
        <div className="flex items-center gap-2 overflow-hidden mr-2">
          {prompt.tags.map(tag => (
            <span key={tag} className="px-1.5 py-0.5 rounded-sm bg-gray-100 dark:bg-gray-700 text-[10px] font-medium text-gray-600 dark:text-gray-300 truncate">
              {tag}
            </span>
          ))}
          <span className="text-[10px] text-gray-400 shrink-0">
            {prompt.use_count} uses
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => onCopy(prompt.id)}
            className="px-2 py-1 text-[11px] font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          >
            Copy
          </button>
          <button
            onClick={() => onInject(prompt.id)}
            className="px-2 py-1 text-[11px] font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/40 rounded transition-colors flex items-center gap-1"
          >
            Inject <span className="text-[10px]">▶</span>
          </button>
        </div>
      </div>
    </div>
  )
}
