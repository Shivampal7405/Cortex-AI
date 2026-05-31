interface UsageBarProps {
  label: string;
  percentage: number;
  subInfo?: string;
  colorHex: string;
}

export function UsageBar({ label, percentage, subInfo, colorHex }: UsageBarProps) {
  // Determine fill color
  let fillClass = '';
  let customStyle = {};

  if (percentage >= 90) {
    fillClass = 'bg-red-500';
  } else if (percentage >= 80) {
    fillClass = 'bg-amber-500';
  } else {
    customStyle = { backgroundColor: colorHex };
  }

  // Clamp percentage between 0 and 100 for display
  const displayPct = Math.min(Math.max(percentage, 0), 100);

  return (
    <div className="flex items-center gap-2 text-sm my-1">
      <span className="w-16 flex-none text-gray-500 dark:text-gray-400">{label}</span>
      
      <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden flex">
        <div 
          className={`h-full rounded-full transition-all duration-600 ease-out ${fillClass}`}
          style={{ width: `${displayPct}%`, ...customStyle }}
        />
      </div>
      
      <div className="w-24 flex-none flex justify-between items-center text-xs">
        <span className="font-semibold text-gray-700 dark:text-gray-300">{Math.round(percentage)}%</span>
        {subInfo && <span className="text-gray-400 dark:text-gray-500">{subInfo}</span>}
      </div>
    </div>
  );
}
