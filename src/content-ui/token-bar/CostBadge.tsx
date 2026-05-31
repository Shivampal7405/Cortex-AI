/**
 * CostBadge.tsx
 * Displays session cost in USD.
 * Color: green (<$0.10), amber ($0.10-$1.00), red (>$1.00)
 */

interface CostBadgeProps {
  costUsd: number
}

export function CostBadge({ costUsd }: CostBadgeProps) {
  const color = costUsd > 1.0  ? '#EF4444'
              : costUsd > 0.10 ? '#F59E0B'
              : '#6B7280'

  const formatted = costUsd < 0.001
    ? '$0.00'
    : costUsd < 0.01
      ? `$${costUsd.toFixed(4)}`
      : `$${costUsd.toFixed(3)}`

  return (
    <span style={{
      color,
      fontSize: '11px',
      fontVariantNumeric: 'tabular-nums',
      whiteSpace: 'nowrap',
    }}>
      {formatted}
    </span>
  )
}
