/**
 * AlertsView.tsx
 * Alerts engine UI — configurable thresholds and alert history.
 * Reads history written by alert.engine.ts in the background.
 */

import { useEffect, useState } from 'react'

interface AlertRecord {
  id:        string
  provider:  string
  metric:    string
  pct:       number
  level:     'warning' | 'critical'
  fired_at:  number
  dismissed: boolean
}

export function AlertsView() {
  const [alerts,    setAlerts]    = useState<AlertRecord[]>([])
  const [threshold, setThreshold] = useState(80)
  const [quiet,     setQuiet]     = useState(false)
  const [budget,    setBudget]    = useState(0)

  useEffect(() => {
    chrome.storage.local.get(
      ['cortex_alert_history', 'alert_warn_threshold', 'alert_quiet_mode', 'cortex_monthly_budget'],
      (r) => {
        setAlerts((r['cortex_alert_history'] as AlertRecord[]) ?? [])
        setThreshold((r['alert_warn_threshold'] as number) ?? 80)
        setQuiet((r['alert_quiet_mode'] as boolean) ?? false)
        setBudget((r['cortex_monthly_budget'] as number) ?? 0)
      }
    )
  }, [])

  const saveThreshold = (v: number) => {
    setThreshold(v)
    chrome.storage.local.set({ alert_warn_threshold: v })
  }

  const saveQuiet = (v: boolean) => {
    setQuiet(v)
    chrome.storage.local.set({ alert_quiet_mode: v })
  }

  const saveBudget = (v: number) => {
    setBudget(v)
    chrome.storage.local.set({ cortex_monthly_budget: v })
  }

  return (
    <div className="p-3 flex flex-col gap-3">

      {/* Settings */}
      <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-800">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Alert Settings</div>

        <div className="flex justify-between items-center mb-3 text-sm">
          <span>Warning threshold</span>
          <select
            value={threshold}
            onChange={e => saveThreshold(Number(e.target.value))}
            className="text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-transparent cursor-pointer"
          >
            {[50, 60, 70, 80, 90].map(v => <option key={v} value={v}>{v}%</option>)}
          </select>
        </div>

        <div className="flex justify-between items-center mb-3 text-sm">
          <span>Monthly Budget (USD)</span>
          <input
            type="number"
            min="0"
            step="1"
            value={budget || ''}
            onChange={e => saveBudget(Number(e.target.value))}
            placeholder="No limit"
            className="text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-transparent text-right w-24 outline-none focus:border-purple-500 transition-colors"
          />
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={quiet}
            onChange={e => saveQuiet(e.target.checked)}
            className="rounded"
          />
          Quiet mode (no notifications)
        </label>
      </div>

      {/* Alert history */}
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Alert History</div>

      {alerts.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">🔔 No alerts yet</div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {[...alerts].reverse().map(alert => (
            <div
              key={alert.id}
              style={{ opacity: alert.dismissed ? 0.4 : 1 }}
              className={`p-2.5 rounded-lg border text-xs ${
                alert.level === 'critical'
                  ? 'border-red-500/30 bg-red-500/5'
                  : 'border-amber-500/30 bg-amber-500/5'
              }`}
            >
              <div className="font-semibold mb-0.5 capitalize">
                {alert.provider} — {alert.metric} at {alert.pct}%
              </div>
              <div className="opacity-60">{new Date(alert.fired_at).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
