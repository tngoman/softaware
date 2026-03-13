import React from 'react';
import {
  MagnifyingGlassIcon,
  Bars3Icon,
  ViewColumnsIcon,
  BookmarkIcon,
  ArrowPathIcon,
  PlusIcon,
  BanknotesIcon,
  AdjustmentsHorizontalIcon,
  ClipboardDocumentCheckIcon,
  CloudArrowDownIcon,
  SignalIcon,
  SignalSlashIcon,
} from '@heroicons/react/24/outline';

export type ViewMode = 'list' | 'kanban';
export type TaskFontSize = 'sm' | 'md' | 'lg';

interface TaskToolbarProps {
  search: string;
  onSearchChange: (v: string) => void;
  viewMode: ViewMode;
  onViewModeChange: (v: ViewMode) => void;
  statusFilter: string;
  onStatusFilterChange: (v: string) => void;
  priorityFilter: string;
  onPriorityFilterChange: (v: string) => void;
  bookmarkFilter: boolean;
  onBookmarkFilterToggle: () => void;
  onRefresh: () => void;
  onNewTask: () => void;
  onSync: () => void;
  syncing: boolean;
  billingMode: boolean;
  onBillingModeToggle: () => void;
  loading: boolean;
  showAdvancedFilters: boolean;
  onToggleAdvancedFilters: () => void;
  /** Render slot for expanded advanced filter controls */
  advancedFilters?: React.ReactNode;
  /** Number of tasks staged for invoicing */
  stagedInvoiceCount: number;
  /** Whether we're in invoice review mode */
  invoiceReviewMode: boolean;
  /** Toggle invoice review mode */
  onInvoiceReviewToggle: () => void;
  /** Whether sync is currently enabled */
  syncEnabled: boolean;
  /** Called when user clicks the sync status indicator */
  onSyncStatusToggle: () => void;
  /** Current font size for the task list */
  taskFontSize: TaskFontSize;
  /** Called when user changes the font size */
  onTaskFontSizeChange: (size: TaskFontSize) => void;
}

const FONT_SIZE_OPTIONS: { value: TaskFontSize; label: string; icon: string }[] = [
  { value: 'sm', label: 'Small', icon: 'A' },
  { value: 'md', label: 'Medium', icon: 'A' },
  { value: 'lg', label: 'Large', icon: 'A' },
];

const TaskToolbar: React.FC<TaskToolbarProps> = ({
  search,
  onSearchChange,
  viewMode,
  onViewModeChange,
  statusFilter,
  onStatusFilterChange,
  priorityFilter,
  onPriorityFilterChange,
  bookmarkFilter,
  onBookmarkFilterToggle,
  onRefresh,
  onNewTask,
  onSync,
  syncing,
  billingMode,
  onBillingModeToggle,
  loading,
  showAdvancedFilters,
  onToggleAdvancedFilters,
  advancedFilters,
  stagedInvoiceCount,
  invoiceReviewMode,
  onInvoiceReviewToggle,
  syncEnabled,
  onSyncStatusToggle,
  taskFontSize,
  onTaskFontSizeChange,
}) => {
  return (
    <div className="space-y-3">
      {/* Main toolbar row */}
      <div className="flex items-center gap-2.5 flex-wrap">
        {/* New Task */}
        <button
          onClick={onNewTask}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <PlusIcon className="w-4 h-4" />
          New Task
        </button>

        {/* Sync & refresh — grouped button bar */}
        <div className="inline-flex items-center bg-white dark:bg-dark-800 border border-gray-300 dark:border-dark-600 rounded-lg overflow-hidden divide-x divide-gray-200 dark:divide-dark-600">
          <button
            onClick={onSyncStatusToggle}
            title={syncEnabled ? 'Sync is active — click to disable' : 'Sync is paused — click to re-enable'}
            className={`inline-flex items-center justify-center w-8 h-8 transition-colors ${
              syncEnabled
                ? 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
                : 'text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/15'
            }`}
          >
            {syncEnabled
              ? <SignalIcon className="w-4 h-4" />
              : <SignalSlashIcon className="w-4 h-4" />
            }
          </button>
          <button
            onClick={onSync}
            disabled={syncing || !syncEnabled}
            title={syncEnabled ? 'Sync from external source' : 'Sync is disabled'}
            className="inline-flex items-center justify-center w-8 h-8 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-dark-700 hover:text-gray-700 dark:hover:text-gray-200 transition-colors disabled:opacity-50"
          >
            <CloudArrowDownIcon className={`w-4 h-4 ${syncing ? 'animate-pulse' : ''}`} />
          </button>
          <button
            onClick={onRefresh}
            disabled={loading}
            title="Refresh tasks"
            className="inline-flex items-center justify-center w-8 h-8 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-dark-700 hover:text-gray-700 dark:hover:text-gray-200 transition-colors disabled:opacity-50"
          >
            <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-gray-200 dark:bg-dark-600" />

        {/* Search — slightly wider */}
        <div className="relative flex-1 min-w-[180px] max-w-[300px]">
          <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search…"
            className="w-full pl-8 pr-6 py-2 text-sm border border-gray-200 dark:border-dark-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-500/20 focus:border-indigo-400 dark:focus:border-indigo-500/40 bg-white dark:bg-dark-800 dark:text-gray-100 dark:placeholder-gray-500"
          />
          {search && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            >
              ×
            </button>
          )}
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-gray-200 dark:bg-dark-600" />

        {/* Status filter */}
        {viewMode === 'list' && (
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className="text-sm border border-gray-300 dark:border-dark-600 rounded-lg px-3 py-2 bg-white dark:bg-dark-800 dark:text-gray-200 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-500/20"
          >
            <option value="all">All Statuses</option>
            <option value="new">New</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
          </select>
        )}

        {/* Priority filter */}
        <select
          value={priorityFilter}
          onChange={(e) => onPriorityFilterChange(e.target.value)}
          className="text-sm border border-gray-300 dark:border-dark-600 rounded-lg px-3 py-2 bg-white dark:bg-dark-800 dark:text-gray-200 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-500/20"
        >
          <option value="all">All Priorities</option>
          <option value="urgent">🔴 Urgent</option>
          <option value="high">🟠 High</option>
          <option value="normal">🔵 Normal</option>
          <option value="low">⚪ Low</option>
        </select>

        {/* Bookmark filter */}
        <button
          onClick={onBookmarkFilterToggle}
          className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border transition-colors
            ${bookmarkFilter
              ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/25 text-amber-700 dark:text-amber-400'
              : 'bg-white dark:bg-dark-800 border-gray-300 dark:border-dark-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-700'}`}
        >
          <BookmarkIcon className="w-4 h-4" />
          Bookmarked
        </button>

        {/* Billing mode */}
        <button
          onClick={onBillingModeToggle}
          className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border transition-colors
            ${billingMode
              ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/25 text-emerald-700 dark:text-emerald-400'
              : 'bg-white dark:bg-dark-800 border-gray-300 dark:border-dark-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-700'}`}
        >
          <BanknotesIcon className="w-4 h-4" />
          Billing
        </button>

        {/* Invoice Review — only shown when there are staged invoices */}
        {stagedInvoiceCount > 0 && (
          <button
            onClick={onInvoiceReviewToggle}
            className={`relative inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border transition-colors
              ${invoiceReviewMode
                ? 'bg-orange-50 dark:bg-orange-500/10 border-orange-300 dark:border-orange-500/25 text-orange-700 dark:text-orange-400'
                : 'bg-white dark:bg-dark-800 border-gray-300 dark:border-dark-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-700'}`}
          >
            <ClipboardDocumentCheckIcon className="w-4 h-4" />
            Invoice Review
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold rounded-full bg-orange-500 text-white">
              {stagedInvoiceCount}
            </span>
          </button>
        )}

        {/* Filters toggle */}
        <button
          onClick={onToggleAdvancedFilters}
          className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border transition-colors
            ${showAdvancedFilters
              ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-300 dark:border-indigo-500/25 text-indigo-700 dark:text-indigo-400'
              : 'bg-white dark:bg-dark-800 border-gray-300 dark:border-dark-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-700'}`}
        >
          <AdjustmentsHorizontalIcon className="w-4 h-4" />
          Filters
        </button>

        {/* Font size picker */}
        <div className="inline-flex items-center bg-white dark:bg-dark-800 border border-gray-300 dark:border-dark-600 rounded-lg overflow-hidden divide-x divide-gray-200 dark:divide-dark-600" title="Task list font size">
          {FONT_SIZE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => onTaskFontSizeChange(opt.value)}
              title={opt.label}
              className={`inline-flex items-center justify-center w-7 h-8 font-serif transition-colors ${
                taskFontSize === opt.value
                  ? 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 font-bold'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-dark-700 hover:text-gray-700 dark:hover:text-gray-200'
              } ${opt.value === 'sm' ? 'text-[10px]' : opt.value === 'md' ? 'text-xs' : 'text-sm'}`}
            >
              {opt.icon}
            </button>
          ))}
        </div>
      </div>

      {/* Expanded advanced filters row — only when toggled */}
      {showAdvancedFilters && advancedFilters && (
        <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-gray-100 dark:border-dark-700">
          {advancedFilters}
        </div>
      )}
    </div>
  );
};

export default TaskToolbar;
