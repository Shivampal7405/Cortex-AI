import { Bell } from 'lucide-react';

export function AlertsView() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 gap-2">
      <Bell size={24} className="opacity-50" />
      <span>No alerts yet</span>
    </div>
  );
}
