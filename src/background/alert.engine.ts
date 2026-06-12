/**
 * alert.engine.ts
 * Monitors provider usage and fires browser notifications at thresholds.
 * 80% (configurable) = warning, 100% = critical.
 * 30-minute cooldown prevents alert spam.
 * Updates extension badge color automatically.
 */

import type { Provider } from '../shared/types'

const COOLDOWN_MS = 30 * 60 * 1000
const STATE_KEY   = 'cortex_alert_state'
const HISTORY_KEY = 'cortex_alert_history'

interface AlertState {
  lastFiredAt: Record<string, number>
}

type ProviderData = { data: Record<string, number> | null } | undefined

async function getAlertState(): Promise<AlertState> {
  const r = await chrome.storage.local.get(STATE_KEY)
  return (r[STATE_KEY] as AlertState) ?? { lastFiredAt: {} }
}

async function fireAlert(
  provider: Provider,
  metric:   string,
  pct:      number,
  level:    'warning' | 'critical'
): Promise<void> {
  const key   = `${provider}_${metric}_${level}`
  const state = await getAlertState()
  const now   = Date.now()

  if (state.lastFiredAt[key] && now - state.lastFiredAt[key] < COOLDOWN_MS) return

  // Respect quiet mode
  const qr = await chrome.storage.local.get('alert_quiet_mode')
  if (qr['alert_quiet_mode']) {
    state.lastFiredAt[key] = now
    await chrome.storage.local.set({ [STATE_KEY]: state })
    return
  }

  chrome.notifications.create(key, {
    type:    'basic',
    iconUrl: level === 'critical' ? 'icons/icon-error-48.png' : 'icons/icon-warn-48.png',
    title:   level === 'critical'
      ? `${provider} limit reached`
      : `${provider} at ${pct}% — approaching limit`,
    message: level === 'critical'
      ? `Your ${metric} limit is exhausted. Consider switching providers.`
      : `You've used ${pct}% of your ${metric} limit.`,
  })

  state.lastFiredAt[key] = now
  await chrome.storage.local.set({ [STATE_KEY]: state })

  // Append to alert history (keep last 50)
  const hr      = await chrome.storage.local.get(HISTORY_KEY)
  const history = (hr[HISTORY_KEY] as object[]) ?? []
  history.push({ id: `${key}_${now}`, provider, metric, pct, level, fired_at: now, dismissed: false })
  await chrome.storage.local.set({ [HISTORY_KEY]: history.slice(-50) })
}

export async function updateBadge(): Promise<void> {
  const r = await chrome.storage.local.get(['provider:claude', 'provider:chatgpt', 'provider:grok'])
  const pcts: number[] = []

  const claude  = (r['provider:claude']  as ProviderData)?.data
  const chatgpt = (r['provider:chatgpt'] as ProviderData)?.data
  const grok    = (r['provider:grok']    as ProviderData)?.data

  if (claude?.['pct_5hr'])    pcts.push(claude['pct_5hr'])
  if (claude?.['pct_7day'])   pcts.push(claude['pct_7day'])
  if (chatgpt?.['pct_used'])  pcts.push(chatgpt['pct_used'])
  if (grok?.['pct_used'])     pcts.push(grok['pct_used'])

  const max = pcts.length > 0 ? Math.max(...pcts) : 0
  let color = '#10B981'
  let text  = ''

  if (max >= 90)      { color = '#EF4444'; text = '!' }
  else if (max >= 70) { color = '#F59E0B'; text = String(Math.round(max)) }

  chrome.action.setBadgeBackgroundColor({ color })
  chrome.action.setBadgeText({ text })
}

export async function checkAlerts(): Promise<void> {
  const r = await chrome.storage.local.get([
    'provider:claude', 'provider:chatgpt', 'provider:grok', 'alert_warn_threshold',
    'cortex_monthly_budget', 'cortex_monthly_cost'
  ])
  const threshold = (r['alert_warn_threshold'] as number) ?? 80

  const checks: Array<{ provider: Provider; metric: string; pct: number }> = []

  const claude  = (r['provider:claude']  as ProviderData)?.data
  const chatgpt = (r['provider:chatgpt'] as ProviderData)?.data
  const grok    = (r['provider:grok']    as ProviderData)?.data

  if (claude?.['pct_5hr'])    checks.push({ provider: 'claude',  metric: '5-hour window',  pct: claude['pct_5hr']    })
  if (claude?.['pct_7day'])   checks.push({ provider: 'claude',  metric: '7-day window',   pct: claude['pct_7day']   })
  if (chatgpt?.['pct_used'])  checks.push({ provider: 'chatgpt', metric: 'daily messages', pct: chatgpt['pct_used']  })
  if (grok?.['pct_used'])     checks.push({ provider: 'grok',    metric: 'message limit',  pct: grok['pct_used']     })

  const budget = (r['cortex_monthly_budget'] as number) || 0
  const cost   = (r['cortex_monthly_cost'] as number) || 0

  if (budget > 0) {
    const costPct = (cost / budget) * 100
    if (costPct >= 100) await fireAlert('budget' as Provider, 'monthly cost', costPct, 'critical')
    else if (costPct >= threshold) await fireAlert('budget' as Provider, 'monthly cost', costPct, 'warning')
  }

  for (const c of checks) {
    if (c.pct >= 100)            await fireAlert(c.provider, c.metric, c.pct, 'critical')
    else if (c.pct >= threshold) await fireAlert(c.provider, c.metric, c.pct, 'warning')
  }

  await updateBadge()
}

export function initAlertEngine(): void {
  chrome.storage.onChanged.addListener((changes) => {
    const watched = ['provider:claude', 'provider:chatgpt', 'provider:grok', 'cortex_monthly_cost', 'cortex_monthly_budget']
    if (Object.keys(changes).some(k => watched.includes(k))) checkAlerts()
  })
  checkAlerts()
}
