import React from 'react';

const PRIORITY_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  urgent: { label: 'Urgent', color: 'bg-red-100 text-red-700 border-red-300 ring-red-200', icon: '🔴' },
  high:   { label: 'High',   color: 'bg-orange-100 text-orange-700 border-orange-300 ring-orange-200', icon: '🟠' },
  normal: { label: 'Normal', color: 'bg-blue-100 text-blue-700 border-blue-300 ring-blue-200', icon: '🔵' },
  low:    { label: 'Low',    color: 'bg-gray-100 text-gray-500 border-gray-300 ring-gray-200', icon: '⚪' },
};

interface PriorityBadgeProps {
  priority: string;
  size?: 'sm' | 'md';
  showLabel?: boolean;
  onClick?: () => void;
}

const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority, size = 'sm', showLabel = true, onClick }) => {
  const config = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.normal;
  const sizeClass = size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-sm px-2 py-1';

  return (
    <span
      className={`inline-flex items-center gap-1 font-medium rounded-full border ${config.color} ${sizeClass} ${onClick ? 'cursor-pointer hover:ring-2 transition-all' : ''}`}
      onClick={onClick}
      title={`Priority: ${config.label}`}
    >
      <span className="text-[10px]">{config.icon}</span>
      {showLabel && <span>{config.label}</span>}
    </span>
  );
};

export default PriorityBadge;
export { PRIORITY_CONFIG };
