import React, { useState, useRef, useEffect } from 'react';
import {
  BookmarkIcon as BookmarkOutline,
  ClockIcon,
  ChatBubbleLeftIcon,
  UserIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  PlayIcon,
  CheckCircleIcon,
  ArrowsRightLeftIcon,
  LinkIcon,
  CubeIcon,
  ShieldCheckIcon,
  ShieldExclamationIcon,
  ArrowRightIcon,
  FlagIcon,
} from '@heroicons/react/24/outline';
import { BookmarkIcon as BookmarkSolid } from '@heroicons/react/24/solid';
import { Task } from '../../types';
import PriorityBadge from './PriorityBadge';
import { tagColor } from './TagInput';
import TaskAttachmentsInline from '../TaskAttachmentsInline';

const STATUS_DOT: Record<string, string> = {
  new: 'bg-blue-500', 'in-progress': 'bg-amber-500', progress: 'bg-amber-500',
  completed: 'bg-emerald-500', pending: 'bg-gray-400',
};

const STATUS_LABEL: Record<string, string> = {
  new: 'New', 'in-progress': 'In Progress', progress: 'In Progress',
  completed: 'Completed', pending: 'Pending',
};

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700 border-blue-200',
  'in-progress': 'bg-amber-100 text-amber-700 border-amber-200',
  progress: 'bg-amber-100 text-amber-700 border-amber-200',
  completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  pending: 'bg-gray-100 text-gray-600 border-gray-200',
};

const PHASE_LABELS: Record<string, string> = {
  intake: 'Intake', quality_review: 'QA Review', triage: 'Triage',
  development: 'Development', verification: 'Verification', resolution: 'Resolution',
};

const COLOR_LABEL_BORDER: Record<string, string> = {
  red: 'border-l-red-500',
  orange: 'border-l-orange-500',
  yellow: 'border-l-yellow-500',
  green: 'border-l-green-500',
  blue: 'border-l-blue-500',
  purple: 'border-l-purple-500',
  pink: 'border-l-pink-500',
};

function timeToDecimal(t: string | number): number {
  if (!t) return 0;
  const s = String(t).trim();
  if (!s.includes(':')) return parseFloat(s) || 0;
  const p = s.split(':');
  return (parseInt(p[0]) || 0) + (parseInt(p[1]) || 0) / 60;
}

const STATUS_PHASE: Record<string, string> = {
  new: 'Intake', 'in-progress': 'Development', progress: 'Development',
  completed: 'Resolution', pending: 'Triage',
};

function derivePhase(task: any): string {
  if (task.workflow_phase) return PHASE_LABELS[task.workflow_phase.toLowerCase()] || task.workflow_phase;
  return STATUS_PHASE[task.status] || 'Intake';
}

function relativeDate(d?: string | null): string {
  if (!d) return '';
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(d).toLocaleDateString();
}

interface TaskCardProps {
  task: Task;
  variant?: 'list' | 'kanban';
  fontSize?: 'sm' | 'md' | 'lg';
  onView: (task: Task) => void;
  onBookmark: (task: Task) => void;
  onEdit?: (task: Task) => void;
  onDelete?: (task: Task) => void;
  onStatusChange?: (task: Task, status: string) => void;
  onPriorityChange?: (task: Task, priority: string) => void;
  onAssign?: (task: Task) => void;
  onLink?: (task: Task) => void;
  lastComment?: { text: string; author: string; date: string | null };
  isDragging?: boolean;
  apiUrl?: string;
  softwareId?: number;
  onImageClick?: (url: string) => void;
  onGalleryOpen?: (images: { url: string; name?: string }[], index: number) => void;
}

const PRIORITY_OPTIONS = [
  { value: 'urgent', label: '🔴 Urgent', color: 'text-red-600' },
  { value: 'high', label: '🟠 High', color: 'text-orange-600' },
  { value: 'normal', label: '🔵 Normal', color: 'text-blue-600' },
  { value: 'low', label: '⚪ Low', color: 'text-gray-500' },
];

const PriorityPicker: React.FC<{
  task: Task;
  onPriorityChange: (task: Task, priority: string) => void;
  size?: 'sm' | 'md';
}> = ({ task, onPriorityChange, size = 'sm' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const isSm = size === 'sm';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className={`inline-flex items-center gap-0.5 border rounded hover:bg-gray-50 dark:border-dark-600 dark:hover:bg-dark-700 ${isSm ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-[11px]'} text-gray-600 dark:text-gray-400`}
        title="Set priority"
      >
        <FlagIcon className={`${isSm ? 'w-3 h-3' : 'w-3 h-3'}`} />
        {!isSm && ' Priority'}
      </button>
      {open && (
        <div className="absolute left-0 bottom-full mb-1 bg-white dark:bg-dark-800 border dark:border-dark-600 rounded-lg shadow-lg z-50 py-1 min-w-[120px]"
          onClick={(e) => e.stopPropagation()}>
          {PRIORITY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={(e) => {
                e.stopPropagation();
                onPriorityChange(task, opt.value);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-dark-700 flex items-center gap-1.5 ${
                task.priority === opt.value ? 'bg-indigo-50 dark:bg-indigo-500/10 font-medium' : ''
              } ${opt.color}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// Font size style maps for list variant (inline styles to avoid Tailwind purge issues)
const FS_TITLE: Record<string, React.CSSProperties> = {
  sm: { fontSize: '0.8125rem', lineHeight: '1.25rem' },   // 13px
  md: { fontSize: '1rem', lineHeight: '1.5rem' },          // 16px
  lg: { fontSize: '1.25rem', lineHeight: '1.75rem' },      // 20px
};
const FS_META: Record<string, React.CSSProperties> = {
  sm: { fontSize: '0.6875rem', lineHeight: '1rem' },       // 11px
  md: { fontSize: '0.8125rem', lineHeight: '1.25rem' },    // 13px
  lg: { fontSize: '0.9375rem', lineHeight: '1.375rem' },   // 15px
};
const FS_BADGE: Record<string, React.CSSProperties> = {
  sm: { fontSize: '9px' },
  md: { fontSize: '11px' },
  lg: { fontSize: '13px' },
};
const FS_DESC: Record<string, React.CSSProperties> = {
  sm: { fontSize: '0.6875rem', lineHeight: '1rem' },       // 11px
  md: { fontSize: '0.8125rem', lineHeight: '1.25rem' },    // 13px
  lg: { fontSize: '0.9375rem', lineHeight: '1.375rem' },   // 15px
};
const FS_ACTION: Record<string, React.CSSProperties> = {
  sm: { fontSize: '10px' },
  md: { fontSize: '12px' },
  lg: { fontSize: '13px' },
};
const FS_PAD: Record<string, React.CSSProperties> = {
  sm: { padding: '0.625rem 0.875rem' },    // ~py-2.5 px-3.5
  md: { padding: '0.75rem 1rem' },          // py-3 px-4
  lg: { padding: '1rem 1.25rem' },           // py-4 px-5
};

const TaskCard: React.FC<TaskCardProps> = ({
  task,
  variant = 'list',
  fontSize = 'sm',
  onView,
  onBookmark,
  onEdit,
  onDelete,
  onStatusChange,
  onPriorityChange,
  onAssign,
  onLink,
  lastComment,
  isDragging,
  apiUrl,
  softwareId,
  onImageClick,
  onGalleryOpen,
}) => {
  const hours = timeToDecimal(task.hours || '0');
  const colorBorder = task.color_label ? COLOR_LABEL_BORDER[task.color_label] || '' : '';
  const tags = Array.isArray(task.local_tags) ? task.local_tags : [];
  const isBookmarked = !!task.is_bookmarked;
  const fs = fontSize;

  if (variant === 'kanban') {
    return (
      <div
        className={`bg-white dark:bg-dark-800 rounded-lg border dark:border-dark-700 shadow-sm hover:shadow-md transition-all cursor-pointer group
          ${colorBorder ? `border-l-4 ${colorBorder}` : ''}
          ${isDragging ? 'shadow-xl ring-2 ring-indigo-300 rotate-2 opacity-90' : ''}
          ${isBookmarked ? 'ring-1 ring-amber-200' : ''}`}
        onClick={() => onView(task)}
      >
        <div className="p-3 space-y-1.5">
          {/* Header: priority + title + bookmark */}
          <div className="flex items-start justify-between gap-1">
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              {task.priority && task.priority !== 'normal' && (
                <PriorityBadge priority={task.priority} showLabel={false} size="sm" />
              )}
              <h4 className="font-medium text-gray-900 dark:text-gray-100 line-clamp-2" style={FS_TITLE[fs]}>
                {task.title}
              </h4>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onBookmark(task); }}
              className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              {isBookmarked
                ? <BookmarkSolid className="w-4 h-4 text-amber-500" />
                : <BookmarkOutline className="w-4 h-4 text-gray-400 hover:text-amber-500" />}
            </button>
          </div>

          {/* Badges row: type, status context, approval, phase */}
          <div className="flex items-center gap-1 flex-wrap">
            {task.type && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded border dark:border-dark-600 bg-gray-50 dark:bg-dark-700 text-gray-600 dark:text-gray-400" style={FS_BADGE[fs]}>
                {task.type}
              </span>
            )}
            {task.approval_required === 1 && (
              <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border ${
                task.approved_by ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
              }`} style={FS_BADGE[fs]}>
                {task.approved_by ? <><ShieldCheckIcon className="h-3 w-3" /> OK</> : <><ShieldExclamationIcon className="h-3 w-3" /> Pending</>}
              </span>
            )}
            <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 dark:border-purple-500/20" style={FS_BADGE[fs]}>
              {derivePhase(task)}
            </span>
            {task.module_name && (
              <span className="flex items-center gap-0.5 text-gray-500" style={FS_BADGE[fs]}>
                <CubeIcon className="w-3 h-3" />{task.module_name}
              </span>
            )}
          </div>

          {/* Description preview */}
          {task.description && (
            <div className="text-gray-500 line-clamp-2 [&_img]:hidden [&_table]:hidden" style={FS_DESC[fs]}
              dangerouslySetInnerHTML={{ __html: task.description }} />
          )}

          {/* Inline attachment thumbnails */}
          {apiUrl && (
            <TaskAttachmentsInline
              taskId={task.id}
              apiUrl={apiUrl}
              softwareId={softwareId}
              onImageClick={onImageClick ? (url) => { onImageClick(url); } : undefined}
              onGalleryOpen={onGalleryOpen}
            />
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              {tags.slice(0, 3).map(tag => (
                <span key={tag} className={`px-1.5 py-0.5 rounded-full font-medium ${tagColor(tag)}`} style={FS_BADGE[fs]}>
                  {tag}
                </span>
              ))}
              {tags.length > 3 && (
                <span className="text-gray-400" style={FS_BADGE[fs]}>+{tags.length - 3}</span>
              )}
            </div>
          )}

          {/* Last comment */}
          {lastComment && (
            <div className="mt-1 border-l-2 border-indigo-300 dark:border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-500/5 rounded-r-md px-2.5 py-1.5">
              <div className="flex items-center justify-between gap-1 mb-0.5" style={FS_BADGE[fs]}>
                <div className="flex items-center gap-1">
                  <ChatBubbleLeftIcon className="w-3 h-3 text-indigo-400 dark:text-indigo-400/60" />
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400/80">{lastComment.author}</span>
                </div>
                {lastComment.date && (
                  <span className="text-gray-400 dark:text-gray-500 tabular-nums">{relativeDate(lastComment.date)}</span>
                )}
              </div>
              <p className="text-gray-700 dark:text-gray-400 line-clamp-2 leading-snug m-0" style={FS_DESC[fs]}>{lastComment.text}</p>
            </div>
          )}

          {/* Footer: hours, assignee, id */}
          <div className="flex items-center justify-between text-gray-400" style={FS_META[fs]}>
            <div className="flex items-center gap-2">
              {hours > 0 && (
                <span className="flex items-center gap-0.5 font-medium text-indigo-500">
                  <ClockIcon className="w-3 h-3" />
                  {hours.toFixed(1)}h
                </span>
              )}
              {task.assigned_to_name && (
                <span className="flex items-center gap-0.5 truncate max-w-[80px]">
                  <UserIcon className="w-3 h-3" />
                  {task.assigned_to_name.split(' ')[0]}
                </span>
              )}
            </div>
            <span className="font-mono text-gray-300">#{task.id}</span>
          </div>

          {/* Action buttons - shown on hover */}
          <div className="flex items-center gap-1 pt-1 border-t border-gray-100 dark:border-dark-700 opacity-0 group-hover:opacity-100 transition-opacity flex-wrap">
            <button onClick={(e) => { e.stopPropagation(); onView(task); }}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 border dark:border-dark-600 rounded hover:bg-gray-50 dark:hover:bg-dark-700 text-gray-600 dark:text-gray-400" style={FS_ACTION[fs]}>
              <EyeIcon className="w-3 h-3" /> View
            </button>
            {onEdit && (
              <button onClick={(e) => { e.stopPropagation(); onEdit(task); }}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 border dark:border-dark-600 rounded hover:bg-gray-50 dark:hover:bg-dark-700 text-gray-600 dark:text-gray-400" style={FS_ACTION[fs]}>
                <PencilIcon className="w-3 h-3" /> Edit
              </button>
            )}
            {onPriorityChange && (
              <PriorityPicker task={task} onPriorityChange={onPriorityChange} size="sm" />
            )}
            {onAssign && (
              <button onClick={(e) => { e.stopPropagation(); onAssign(task); }}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 border dark:border-dark-600 rounded text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-500/10" style={FS_ACTION[fs]}>
                <ArrowsRightLeftIcon className="w-3 h-3" /> Assign
              </button>
            )}
            {onLink && (
              <button onClick={(e) => { e.stopPropagation(); onLink(task); }}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 border dark:border-dark-600 rounded text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10" style={FS_ACTION[fs]}>
                <LinkIcon className="w-3 h-3" /> Link
              </button>
            )}
            {onStatusChange && (task.status === 'new' || task.status === 'pending') && (
              <button onClick={(e) => { e.stopPropagation(); onStatusChange(task, 'in-progress'); }}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 border dark:border-dark-600 rounded text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10" style={FS_ACTION[fs]}>
                <PlayIcon className="w-3 h-3" /> Start
              </button>
            )}
            {onStatusChange && (task.status === 'in-progress' || task.status === 'progress') && (
              <button onClick={(e) => { e.stopPropagation(); onStatusChange(task, 'completed'); }}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 border dark:border-dark-600 rounded text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10" style={FS_ACTION[fs]}>
                <CheckCircleIcon className="w-3 h-3" /> Done
              </button>
            )}
            {onDelete && (
              <button onClick={(e) => { e.stopPropagation(); onDelete(task); }}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 border dark:border-dark-600 rounded text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10" style={FS_ACTION[fs]}>
                <TrashIcon className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── List variant ───
  return (
    <div
      className={`bg-white dark:bg-dark-800 rounded-lg border dark:border-dark-700 hover:shadow-md transition-all group overflow-hidden
        ${colorBorder ? `border-l-4 ${colorBorder}` : ''}
        ${isBookmarked ? 'ring-1 ring-amber-200' : ''}`}
    >
      <div style={FS_PAD[fs]}>
        <div className="flex items-start gap-3">
          {/* Bookmark */}
          <button
            onClick={(e) => { e.stopPropagation(); onBookmark(task); }}
            className="flex-shrink-0 mt-0.5"
          >
            {isBookmarked
              ? <BookmarkSolid className="w-4 h-4 text-amber-500" />
              : <BookmarkOutline className="w-4 h-4 text-gray-300 dark:text-gray-600 hover:text-amber-500 transition-colors" />}
          </button>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Title row */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[task.status] || 'bg-gray-400'}`} />
              {task.priority && task.priority !== 'normal' && (
                <PriorityBadge priority={task.priority} showLabel={false} size="sm" />
              )}
              <h4
                className="font-medium text-gray-900 dark:text-gray-100 truncate cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400"
                style={FS_TITLE[fs]}
                onClick={() => onView(task)}
              >
                {task.title}
              </h4>
              {tags.length > 0 && (
                <div className="hidden sm:flex items-center gap-1">
                  {tags.slice(0, 2).map(tag => (
                    <span key={tag} className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${tagColor(tag)}`}>
                      {tag}
                    </span>
                  ))}
                  {tags.length > 2 && <span className="text-[10px] text-gray-400">+{tags.length - 2}</span>}
                </div>
              )}
            </div>

            {/* Meta row */}
            <div className="flex items-center gap-2 mt-1 text-gray-400 flex-wrap" style={FS_META[fs]}>
              <span className="font-mono">#{task.id}</span>
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-medium border ${STATUS_COLORS[task.status] || 'bg-gray-100 text-gray-600 border-gray-200'}`} style={FS_BADGE[fs]}>
                <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[task.status]}`} />
                {STATUS_LABEL[task.status] || task.status}
              </span>
              {task.type && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded border dark:border-dark-600 text-[10px] text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-dark-700">
                  {task.type}
                </span>
              )}
              {task.approval_required === 1 && (
                <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] border ${
                  task.approved_by ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  {task.approved_by
                    ? <><ShieldCheckIcon className="h-3 w-3" /> Approved</>
                    : <><ShieldExclamationIcon className="h-3 w-3" /> Pending</>}
                </span>
              )}
              <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 text-[10px] border border-purple-200 dark:border-purple-500/20">
                {derivePhase(task)}
              </span>
              {task.module_name && (
                <span className="flex items-center gap-0.5 text-gray-500">
                  <CubeIcon className="w-3 h-3" />{task.module_name}
                </span>
              )}
              {task.assigned_to_name && (
                <span className="flex items-center gap-0.5 text-gray-500">
                  <UserIcon className="w-3 h-3" />{task.assigned_to_name}
                </span>
              )}
              {task.parent_task_id && (
                <span className="flex items-center gap-0.5 text-gray-500">
                  <ArrowRightIcon className="w-3 h-3" />{task.association_type || 'related'} of #{task.parent_task_id}
                </span>
              )}
              {hours > 0 && (
                <span className="flex items-center gap-0.5 font-medium text-indigo-500">
                  <ClockIcon className="w-3 h-3" />{hours.toFixed(2)}h
                </span>
              )}
              {task.created_by_name && <span>{task.created_by_name}</span>}
              <span>{relativeDate(task.start || task.created_at || task.time || task.date)}</span>
            </div>

            {/* Description preview */}
            {task.description && (
              <div className="mt-1.5 text-gray-500 dark:text-gray-400 line-clamp-1 [&_img]:hidden [&_table]:hidden" style={FS_DESC[fs]}
                dangerouslySetInnerHTML={{ __html: task.description }} />
            )}

            {/* Inline attachment thumbnails */}
            {apiUrl && (
              <TaskAttachmentsInline
                taskId={task.id}
                apiUrl={apiUrl}
                softwareId={softwareId}
                onImageClick={onImageClick ? (url) => { onImageClick(url); } : undefined}
                onGalleryOpen={onGalleryOpen}
              />
            )}

            {/* Last comment */}
            {lastComment && (
              <div className="mt-1.5 border-l-2 border-indigo-300 dark:border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-500/5 rounded-r-md px-2.5 py-1.5">
                <div className="flex items-center justify-between gap-1 mb-0.5" style={FS_BADGE[fs]}>
                  <div className="flex items-center gap-1">
                    <ChatBubbleLeftIcon className="w-3 h-3 text-indigo-400 dark:text-indigo-400/60" />
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400/80">{lastComment.author}</span>
                  </div>
                  {lastComment.date && (
                    <span className="text-gray-400 dark:text-gray-500 tabular-nums">{relativeDate(lastComment.date)}</span>
                  )}
                </div>
                <p className="text-gray-700 dark:text-gray-400 line-clamp-2 leading-snug m-0" style={FS_DESC[fs]}>{lastComment.text}</p>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity flex-wrap">
              <button onClick={() => onView(task)} style={FS_ACTION[fs]}
                className="inline-flex items-center gap-1 px-2 py-1 border rounded-md hover:bg-gray-50 text-gray-600 dark:border-dark-600 dark:text-gray-400 dark:hover:bg-dark-700 dark:hover:text-gray-200">
                <EyeIcon className="w-3 h-3" /> View
              </button>
              {onEdit && (
                <button onClick={() => onEdit(task)} style={FS_ACTION[fs]}
                  className="inline-flex items-center gap-1 px-2 py-1 border rounded-md hover:bg-gray-50 text-gray-600 dark:border-dark-600 dark:text-gray-400 dark:hover:bg-dark-700 dark:hover:text-gray-200">
                  <PencilIcon className="w-3 h-3" /> Edit
                </button>
              )}
              {onPriorityChange && (
                <PriorityPicker task={task} onPriorityChange={onPriorityChange} size="md" />
              )}
              {onAssign && (
                <button onClick={() => onAssign(task)} style={FS_ACTION[fs]}
                  className="inline-flex items-center gap-1 px-2 py-1 border rounded-md text-purple-600 hover:bg-purple-50 dark:border-dark-600 dark:text-purple-400 dark:hover:bg-dark-700">
                  <ArrowsRightLeftIcon className="w-3 h-3" /> Assign
                </button>
              )}
              {onLink && (
                <button onClick={() => onLink(task)} style={FS_ACTION[fs]}
                  className="inline-flex items-center gap-1 px-2 py-1 border rounded-md text-blue-600 hover:bg-blue-50 dark:border-dark-600 dark:text-blue-400 dark:hover:bg-dark-700">
                  <LinkIcon className="w-3 h-3" /> Link
                </button>
              )}
              {onStatusChange && (task.status === 'new' || task.status === 'pending') && (
                <button onClick={() => onStatusChange(task, 'in-progress')} style={FS_ACTION[fs]}
                  className="inline-flex items-center gap-1 px-2 py-1 border rounded-md text-emerald-600 hover:bg-emerald-50 dark:border-dark-600 dark:text-emerald-400 dark:hover:bg-dark-700">
                  <PlayIcon className="w-3 h-3" /> Start
                </button>
              )}
              {onStatusChange && (task.status === 'in-progress' || task.status === 'progress') && (
                <button onClick={() => onStatusChange(task, 'completed')} style={FS_ACTION[fs]}
                  className="inline-flex items-center gap-1 px-2 py-1 border rounded-md text-emerald-600 hover:bg-emerald-50 dark:border-dark-600 dark:text-emerald-400 dark:hover:bg-dark-700">
                  <CheckCircleIcon className="w-3 h-3" /> Complete
                </button>
              )}
              {onDelete && (
                <button onClick={() => onDelete(task)} style={FS_ACTION[fs]}
                  className="inline-flex items-center gap-1 px-2 py-1 border rounded-md text-red-500 hover:bg-red-50 dark:border-dark-600 dark:text-red-400 dark:hover:bg-dark-700">
                  <TrashIcon className="w-3 h-3" /> Delete
                </button>
              )}
            </div>
          </div>

          {/* Right side: assignee avatar */}
          {task.assigned_to_name && (
            <div className="hidden md:flex items-center flex-shrink-0">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-[11px] font-bold"
                title={task.assigned_to_name}>
                {task.assigned_to_name.charAt(0).toUpperCase()}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskCard;
