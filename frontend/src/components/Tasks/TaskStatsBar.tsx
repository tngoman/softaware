import React from 'react';
import {
  CheckCircleIcon,
  RocketLaunchIcon,
  InboxIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

interface TaskStatsBarProps {
  tasks: any[];
  remoteStats?: any;
}

const TaskStatsBar: React.FC<TaskStatsBarProps> = ({ tasks }) => {
  const newCount = tasks.filter(t => t.status === 'new').length;
  const inProgressCount = tasks.filter(t => t.status === 'in-progress' || t.status === 'progress').length;
  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const pendingCount = tasks.filter(t => t.status === 'pending').length;

  const stats = [
    { label: 'New', value: newCount, icon: InboxIcon, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10' },
    { label: 'Active', value: inProgressCount, icon: RocketLaunchIcon, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10' },
    { label: 'Completed', value: completedCount, icon: CheckCircleIcon, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
    ...(pendingCount > 0 ? [{ label: 'Pending', value: pendingCount, icon: ClockIcon, color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-dark-700' }] : []),
  ];

  return (
    <div className="flex items-center gap-2 overflow-x-auto">
      {stats.map(stat => (
        <div
          key={stat.label}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${stat.bg} border border-transparent dark:border-dark-600 min-w-fit`}
        >
          <stat.icon className={`w-4 h-4 ${stat.color}`} />
          <div className="flex items-baseline gap-1">
            <span className={`text-sm font-bold leading-none ${stat.color}`}>{stat.value}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default TaskStatsBar;
