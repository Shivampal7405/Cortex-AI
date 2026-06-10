/**
 * HistoryView.tsx
 * 52-week GitHub-style activity heatmap per AI provider.
 * Data fetched from IndexedDB via GET_HEATMAP background message.
 */

import { useEffect, useState } from 'react'

const PROVIDERS = ['claude', 'chatgpt', 'gemini', 'grok'] as const
const COLORS: Record<string, string> = {
  claude: '#7C3AED', chatgpt: '#10A37F', gemini: '#4285F4', grok: '#6B7280',
}

function generateWeeks(): string[][] {
  const weeks: string[][] = []
  const today  = new Date()
  const cursor = new Date(today)
  cursor.setDate(cursor.getDate() - 364)
  cursor.setDate(cursor.getDate() - cursor.getDay()) // align to Sunday

  while (cursor <= today) {
    const week: string[] = []
    for (let d = 0; d < 7; d++) {
      week.push(cursor.toISOString().slice(0, 10))
      cursor.setDate(cursor.getDate() + 1)
    }
    weeks.push(week)
  }
  return weeks
}

export function HistoryView() {
  const [heatmap,  setHeatmap]  = useState<Record<string, number>>({})
  const [provider, setProvider] = useState<string>('claude')

  useEffect(() => {
    chrome.runtime.sendMessage(
      { type: 'GET_HEATMAP', provider },
      (data: Record<string, number> | undefined) => setHeatmap(data ?? {})
    )
  }, [provider])

  const weeks = generateWeeks()
  const color = COLORS[provider] ?? '#7C3AED'

  return (
    <div className="p-3 flex flex-col gap-3">

      {/* Provider filter */}
      <div className="flex gap-1.5 flex-wrap">
        {PROVIDERS.map(p => (
          <button
            key={p}
            onClick={() => setProvider(p)}
            className="text-[10px] px-2.5 py-1 rounded-full capitalize transition-colors"
            style={{
              backgroundColor: provider === p ? COLORS[p] : 'rgba(255,255,255,0.06)',
              color: provider === p ? 'white' : 'inherit',
              border: 'none',
            }}
          >
            {p}
          </button>
        ))}
      </div>

      {/* 52-week heatmap */}
      <div className="flex gap-0.5 overflow-x-auto pb-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-0.5 shrink-0">
            {week.map(date => {
              const pct     = heatmap[date] ?? 0
              const opacity = pct === 0 ? 0.08 : 0.2 + (pct / 100) * 0.8
              return (
                <div
                  key={date}
                  title={`${date}: ${pct}%`}
                  className="rounded-sm cursor-default"
                  style={{ width: 10, height: 10, backgroundColor: color, opacity }}
                />
              )
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1 text-[10px] text-gray-500">
        <span>Less</span>
        {[0.1, 0.3, 0.5, 0.7, 0.9].map(o => (
          <div
            key={o}
            className="rounded-sm"
            style={{ width: 10, height: 10, backgroundColor: color, opacity: o }}
          />
        ))}
        <span>More</span>
      </div>

      {Object.keys(heatmap).length === 0 && (
        <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-xs opacity-60">
          No history yet — start using {provider} to see your activity
        </div>
      )}
    </div>
  )
}
