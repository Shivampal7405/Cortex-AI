import { AlertTriangle, ExternalLink } from 'lucide-react';
import { UsageBar } from './UsageBar';
import { TransferButton } from './TransferButton';
import { ProviderState, Provider, ClaudeUsage, ChatGPTUsage, GeminiUsage, GrokUsage } from '../../shared/types';
import { PROVIDER_COLORS } from '../../shared/constants';
import { formatTimeAgo, formatTimeRemaining } from '../../shared/utils';

type AnyUsage = ClaudeUsage | ChatGPTUsage | GeminiUsage | GrokUsage

interface ProviderCardProps {
  provider: Provider;
  displayName: string;
  state: ProviderState<AnyUsage>;
}

export function ProviderCard({ provider, displayName, state }: ProviderCardProps) {
  const brandColor = PROVIDER_COLORS[provider] || '#000000';
  // Accessor for polymorphic optional fields (plan, tier) not shared by all providers
  const d = state.data as (AnyUsage & { plan?: string; tier?: string }) | null

  // Determine max percentage for styling
  let maxPct = 0;
  if (state.data) {
    if (provider === 'claude') {
      maxPct = Math.max((state.data as ClaudeUsage).pct_5hr, (state.data as ClaudeUsage).pct_7day);
    } else if (provider === 'chatgpt') {
      maxPct = (state.data as ChatGPTUsage).pct_used;
    } else if (provider === 'grok') {
      maxPct = (state.data as GrokUsage).pct_used;
    }
  }

  const isWarning = maxPct >= 80 && maxPct < 90;
  const isCritical = maxPct >= 90;

  // Background tint classes
  let bgClass = 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800';
  let stripeClass = '';
  let stripeStyle = {};

  if (state.status === 'not_detected') {
    bgClass = 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800 opacity-80';
    stripeClass = 'bg-gray-300 dark:bg-gray-700';
  } else if (isCritical) {
    bgClass = 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30';
    stripeClass = 'bg-red-500';
  } else if (isWarning) {
    bgClass = 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30';
    stripeClass = 'bg-amber-500';
  } else {
    stripeStyle = { backgroundColor: brandColor };
  }

  // Helper to render provider-specific content
  const renderContent = () => {
    if (state.status === 'not_detected') {
      const urls: Record<string, string> = {
        claude: 'https://claude.ai',
        chatgpt: 'https://chatgpt.com',
        gemini: 'https://gemini.google.com',
        grok: 'https://grok.com'
      };
      
      return (
        <div className="py-2 flex items-center justify-between">
          <span className="text-sm text-gray-500 dark:text-gray-400">Open {displayName} to activate</span>
          <a 
            href={urls[provider as string] || '#'} 
            target="_blank" 
            rel="noreferrer"
            className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            Visit {displayName} <ExternalLink size={12} />
          </a>
        </div>
      );
    }

    if (state.status === 'error') {
      return <div className="py-2 text-sm text-red-500">Error loading data: {state.error}</div>;
    }

    if (!state.data) return null;

    if (provider === 'claude') {
      const data = state.data as ClaudeUsage;
      return (
        <div className="py-1">
          <UsageBar
            label="5-hour"
            percentage={data.pct_5hr}
            subInfo={formatTimeRemaining(data.reset_5hr_at)}
            colorHex={brandColor}
          />
          <UsageBar
            label="7-day"
            percentage={data.pct_7day}
            subInfo={formatTimeRemaining(data.reset_7day_at)}
            colorHex={brandColor}
          />
        </div>
      );
    }

    if (provider === 'chatgpt') {
      const data = state.data as ChatGPTUsage;
      return (
        <div className="py-1">
          <UsageBar
            label="Messages"
            percentage={data.pct_used}
            subInfo={formatTimeRemaining(data.reset_at)}
            colorHex={brandColor}
          />
        </div>
      );
    }

    if (provider === 'gemini') {
      return (
        <div className="py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-sm text-gray-600 dark:text-gray-300">Active</span>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400 italic">No limits on personal</span>
        </div>
      );
    }

    if (provider === 'grok') {
      const data = state.data as GrokUsage;
      return (
        <div className="py-1">
          <UsageBar
            label="Messages"
            percentage={data.pct_used}
            subInfo={formatTimeRemaining(data.reset_at)}
            colorHex={brandColor}
          />
        </div>
      );
    }

    return null;
  };

  return (
    <div className={`relative rounded-lg border shadow-sm overflow-hidden flex flex-col ${bgClass}`}>
      {/* Left colored stripe */}
      <div 
        className={`absolute left-0 top-0 bottom-0 w-1 ${stripeClass}`} 
        style={stripeStyle}
      />
      
      <div className="pl-4 pr-3 py-2.5">
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <a 
              href={
                provider === 'claude' ? 'https://claude.ai' :
                provider === 'chatgpt' ? 'https://chatgpt.com' :
                provider === 'gemini' ? 'https://gemini.google.com' :
                'https://grok.com'
              }
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-gray-900 dark:text-gray-100 hover:underline hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              {displayName}
            </a>
            {d?.plan && (
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                {d.plan === 'payg' ? 'PAYG' : d.plan}
              </span>
            )}
            {d?.tier && (
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                {d.tier}
              </span>
            )}
            {state.data?.model && (
              <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                {state.data.model.replace(/^(claude-|gpt-|gemini-)/, '')}
              </span>
            )}
          </div>
          {isCritical && (
            <AlertTriangle size={16} className="text-red-500" />
          )}
        </div>

        {/* Content bars */}
        {renderContent()}

        {/* Footer */}
        {state.status === 'active' && state.last_updated && (
          <div className="mt-1 flex justify-between items-center text-[10px] text-gray-400 dark:text-gray-500">
            <span>Updated {formatTimeAgo(state.last_updated)}</span>
            <TransferButton fromProvider={provider} />
          </div>
        )}
      </div>
    </div>
  );
}

