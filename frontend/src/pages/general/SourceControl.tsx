import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  ArrowPathIcon,
  ArrowUpTrayIcon,
  ArrowDownTrayIcon,
  CheckCircleIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  PlusIcon,
  MinusIcon,
  TrashIcon,
  EyeIcon,
  ChatBubbleLeftEllipsisIcon,
  InformationCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  SparklesIcon,
  PaperAirplaneIcon,
  ClockIcon,
  ArrowUturnLeftIcon,
  ArchiveBoxIcon,
  CloudArrowUpIcon,
  CloudArrowDownIcon,
  ShieldExclamationIcon,
  FolderIcon,
  DocumentDuplicateIcon,
  QuestionMarkCircleIcon,
  CheckIcon,
  XCircleIcon,
  CommandLineIcon,
} from '@heroicons/react/24/outline';
import { notify } from '../../utils/notify';
import Swal from 'sweetalert2';
import api from '../../services/api';
import { useAppStore } from '../../store';
import { GitModel } from '../../models/GitModel';
import AiMarkdown from '../../components/AI/AiMarkdown';

/* ─────────────────────────────────────────────────────────────
   TYPES
   ───────────────────────────────────────────────────────────── */
interface GitFile {
  path: string;
  type: string;
  staged: boolean;
  unstaged: boolean;
  status: string;
}
interface CommitInfo {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  email: string;
  date: string;
  timestamp: number;
}
interface BranchInfo {
  name: string;
  hash: string;
  current: boolean;
  upstream: string | null;
  ahead: number;
  behind: number;
}
interface AiMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/* ─────────────────────────────────────────────────────────────
   FILE TYPE HELPERS
   ───────────────────────────────────────────────────────────── */
const FILE_TYPE_META: Record<string, { label: string; color: string; bg: string; icon: React.FC<any> }> = {
  modified:  { label: 'Modified',  color: 'text-amber-600',   bg: 'bg-amber-50',   icon: DocumentDuplicateIcon },
  added:     { label: 'New',       color: 'text-emerald-600', bg: 'bg-emerald-50',  icon: PlusIcon },
  deleted:   { label: 'Deleted',   color: 'text-red-600',     bg: 'bg-red-50',      icon: MinusIcon },
  renamed:   { label: 'Renamed',   color: 'text-blue-600',    bg: 'bg-blue-50',     icon: ArrowPathIcon },
  untracked: { label: 'New File',  color: 'text-purple-600',  bg: 'bg-purple-50',   icon: PlusIcon },
  copied:    { label: 'Copied',    color: 'text-cyan-600',    bg: 'bg-cyan-50',     icon: DocumentDuplicateIcon },
  unknown:   { label: 'Changed',   color: 'text-gray-600',    bg: 'bg-gray-50',     icon: DocumentTextIcon },
};

function getFileName(path: string): string {
  return path.split('/').pop() || path;
}

function getFileDir(path: string): string {
  const parts = path.split('/');
  parts.pop();
  return parts.join('/');
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

/* ─────────────────────────────────────────────────────────────
   BRANCH STATUS BANNER
   ───────────────────────────────────────────────────────────── */
const BranchBanner: React.FC<{
  currentBranch: string;
  allowedBranch: string;
  isOnAllowed: boolean;
  ahead: number;
  behind: number;
  branches: BranchInfo[];
  onCheckout: (branch: string) => void;
}> = ({ currentBranch, allowedBranch, isOnAllowed, ahead, behind, branches, onCheckout }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [dropdownOpen]);

  const otherBranches = branches.filter(b => b.name !== currentBranch);

  const branchSelector = (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setDropdownOpen(o => !o)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
      >
        <ChevronDownIcon className={`w-4 h-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
        Switch Branch
      </button>
      {dropdownOpen && otherBranches.length > 0 && (
        <div className="absolute right-0 mt-1 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-50 py-1 max-h-64 overflow-y-auto">
          {otherBranches.map(b => (
            <button
              key={b.name}
              onClick={() => { setDropdownOpen(false); onCheckout(b.name); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
            >
              <span className="font-mono text-xs truncate flex-1">{b.name}</span>
              {b.name === allowedBranch && (
                <span className="text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded">write</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  if (isOnAllowed) {
    return (
      <div className="flex items-center gap-3 px-4 py-2.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
        <CheckCircleIcon className="w-5 h-5 text-emerald-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
            On branch <code className="font-mono font-bold bg-emerald-100 dark:bg-emerald-800 px-1.5 py-0.5 rounded text-xs">{currentBranch}</code>
          </span>
          {(ahead > 0 || behind > 0) && (
            <span className="ml-3 text-xs text-emerald-600 dark:text-emerald-400">
              {ahead > 0 && <span>↑ {ahead} to push</span>}
              {ahead > 0 && behind > 0 && <span className="mx-1">·</span>}
              {behind > 0 && <span>↓ {behind} to pull</span>}
            </span>
          )}
        </div>
        {otherBranches.length > 0 && branchSelector}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
      <ExclamationTriangleIcon className="w-5 h-5 text-amber-500 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
          You're on branch <code className="font-mono font-bold bg-amber-100 dark:bg-amber-800 px-1.5 py-0.5 rounded text-xs">{currentBranch}</code> — write operations are only allowed on <code className="font-mono font-bold bg-amber-100 dark:bg-amber-800 px-1.5 py-0.5 rounded text-xs">{allowedBranch}</code>
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => onCheckout(allowedBranch)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors shadow-sm"
        >
          Switch to {allowedBranch}
        </button>
        {otherBranches.length > 1 && branchSelector}
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   WORKING TREE STATUS CARD
   ───────────────────────────────────────────────────────────── */
const StatusHealthCard: React.FC<{
  clean: boolean;
  totalChanges: number;
  stagedCount: number;
  unstagedCount: number;
  untrackedCount: number;
  hasConflicts: boolean;
}> = ({ clean, totalChanges, stagedCount, unstagedCount, untrackedCount, hasConflicts }) => {
  if (hasConflicts) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
        <ShieldExclamationIcon className="w-6 h-6 text-red-500" />
        <div>
          <p className="text-sm font-bold text-red-800 dark:text-red-300">Merge Conflicts Detected</p>
          <p className="text-xs text-red-600 dark:text-red-400">You need to resolve conflicts before you can continue. Use the AI assistant for help!</p>
        </div>
      </div>
    );
  }

  if (clean) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/50 rounded-xl">
        <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-800 flex items-center justify-center">
          <CheckCircleIcon className="w-6 h-6 text-emerald-500" />
        </div>
        <div>
          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">All Clean!</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400">No uncommitted changes — your working directory matches the last commit.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 px-4 py-3 bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/50 rounded-xl">
      <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-800 flex items-center justify-center flex-shrink-0">
        <ExclamationTriangleIcon className="w-5 h-5 text-amber-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
          {totalChanges} Uncommitted Change{totalChanges !== 1 ? 's' : ''}
        </p>
        <p className="text-xs text-amber-600 dark:text-amber-400">
          {stagedCount > 0 && <span className="text-emerald-600 dark:text-emerald-400 font-medium">{stagedCount} ready to commit</span>}
          {stagedCount > 0 && unstagedCount > 0 && <span> · </span>}
          {unstagedCount > 0 && <span>{unstagedCount} modified</span>}
          {untrackedCount > 0 && <span> · {untrackedCount} new</span>}
        </p>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   FILE LIST ITEM
   ───────────────────────────────────────────────────────────── */
const FileListItem: React.FC<{
  file: GitFile;
  selected: boolean;
  onToggle: () => void;
  onStage?: () => void;
  onUnstage?: () => void;
  onDiscard?: () => void;
  onViewDiff?: () => void;
  isStaged: boolean;
  disabled?: boolean;
}> = ({ file, selected, onToggle, onStage, onUnstage, onDiscard, onViewDiff, isStaged, disabled }) => {
  const meta = FILE_TYPE_META[file.type] || FILE_TYPE_META.unknown;
  const FileIcon = meta.icon;

  return (
    <div
      className={`group flex items-center gap-2 px-3 py-2 rounded-lg border transition-all cursor-pointer
        ${selected ? 'border-purple-300 dark:border-purple-600 bg-purple-50/50 dark:bg-purple-900/20' : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-800/50'}
        ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
      onClick={onToggle}
    >
      {/* Selection checkbox */}
      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors
        ${selected ? 'bg-purple-500 border-purple-500' : 'border-gray-300 dark:border-gray-600'}`}>
        {selected && <CheckIcon className="w-3 h-3 text-white" />}
      </div>

      {/* File type badge */}
      <div className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 ${meta.bg} dark:bg-opacity-30`}>
        <FileIcon className={`w-3.5 h-3.5 ${meta.color}`} />
      </div>

      {/* File path */}
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate block">{getFileName(file.path)}</span>
        {getFileDir(file.path) && (
          <span className="text-[11px] text-gray-400 dark:text-gray-500 truncate block">{getFileDir(file.path)}/</span>
        )}
      </div>

      {/* Status badge */}
      <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${meta.bg} ${meta.color} flex-shrink-0`}>
        {meta.label}
      </span>

      {/* Actions */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" onClick={e => e.stopPropagation()}>
        {onViewDiff && (
          <button onClick={onViewDiff} title="View changes" className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30">
            <EyeIcon className="w-3.5 h-3.5" />
          </button>
        )}
        {!isStaged && onStage && (
          <button onClick={onStage} title="Stage this file" className="p-1 rounded text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30">
            <PlusIcon className="w-3.5 h-3.5" />
          </button>
        )}
        {isStaged && onUnstage && (
          <button onClick={onUnstage} title="Unstage this file" className="p-1 rounded text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30">
            <MinusIcon className="w-3.5 h-3.5" />
          </button>
        )}
        {!isStaged && onDiscard && (
          <button onClick={onDiscard} title="Discard changes" className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30">
            <TrashIcon className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   COMMIT HISTORY ITEM
   ───────────────────────────────────────────────────────────── */
const CommitItem: React.FC<{
  commit: CommitInfo;
  isLatest: boolean;
  onClick: () => void;
}> = ({ commit, isLatest, onClick }) => (
  <button
    onClick={onClick}
    className="w-full text-left flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group"
  >
    <div className="relative flex-shrink-0 mt-0.5">
      <div className={`w-3 h-3 rounded-full border-2 ${isLatest ? 'bg-purple-500 border-purple-500' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600'}`} />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate group-hover:text-purple-700 dark:group-hover:text-purple-400 transition-colors">
        {commit.message}
      </p>
      <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
        <span className="font-mono text-gray-500 dark:text-gray-400">{commit.shortHash}</span>
        <span className="mx-1.5">·</span>
        {commit.author}
        <span className="mx-1.5">·</span>
        {relativeTime(commit.date)}
      </p>
    </div>
  </button>
);

/* ─────────────────────────────────────────────────────────────
   DIFF VIEWER
   ───────────────────────────────────────────────────────────── */
const DiffViewer: React.FC<{ diff: string; file?: string; onClose: () => void }> = ({ diff, file, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-5xl mx-4 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between px-5 py-3 border-b dark:border-gray-700">
        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <DocumentTextIcon className="w-4 h-4 text-purple-500" />
          {file ? `Changes in ${file}` : 'Diff View'}
        </h3>
        <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"><XMarkIcon className="w-5 h-5" /></button>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <pre className="bg-[#0f172a] text-slate-50 rounded-lg p-4 overflow-x-auto text-[13px] leading-relaxed font-mono whitespace-pre">
          {diff.split('\n').map((line, i) => {
            let cls = 'text-slate-300';
            if (line.startsWith('+') && !line.startsWith('+++')) cls = 'text-emerald-400';
            else if (line.startsWith('-') && !line.startsWith('---')) cls = 'text-red-400';
            else if (line.startsWith('@@')) cls = 'text-cyan-400 font-semibold';
            else if (line.startsWith('diff') || line.startsWith('index')) cls = 'text-slate-500';
            return <span key={i} className={cls}>{line}{'\n'}</span>;
          })}
        </pre>
      </div>
    </div>
  </div>
);

/* ─────────────────────────────────────────────────────────────
   AI GIT ASSISTANT PANEL
   ───────────────────────────────────────────────────────────── */
const AiGitPanel: React.FC<{
  onRefreshStatus: () => void;
}> = ({ onRefreshStatus }) => {
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [assistant, setAssistant] = useState<{ id: string; name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load assistant — endpoint returns { assistants: [...] }, pick primary or first
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/v1/mobile/my-assistant');
        const list = res.data?.assistants;
        if (Array.isArray(list) && list.length > 0) {
          const primary = list.find((a: any) => a.is_primary) || list[0];
          setAssistant({ id: primary.id, name: primary.name });
        }
      } catch { /* no assistant */ }
      finally { setLoading(false); }
    })();
  }, []);

  // Scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || !assistant || sending) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setSending(true);

    try {
      const res = await api.post('/v1/mobile/intent', {
        text: msg,
        conversationId: conversationId || undefined,
        assistantId: assistant.id,
      });

      if (res.data?.conversationId) setConversationId(res.data.conversationId);

      const reply = res.data?.reply || res.data?.message || 'No response';
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);

      // Auto-refresh status after AI operations
      onRefreshStatus();
    } catch (err: any) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `⚠️ Error: ${err.response?.data?.message || err.message || 'Something went wrong'}`
      }]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const quickActions = [
    { label: '📥 Pull latest changes', prompt: 'Pull the latest changes from the remote repository. If there are conflicts, explain what happened and help me resolve them.' },
    { label: '📊 Explain current status', prompt: 'Check the git status and explain what changed files mean in simple terms. Tell me if anything needs attention.' },
    { label: '💾 Commit my changes', prompt: 'Look at the current changes, stage all modified files, and create a descriptive commit message based on what was changed. Then commit.' },
    { label: '🚀 Push to remote', prompt: 'Push the current commits to the remote repository. If there are issues, explain them clearly.' },
    { label: '🧹 Clean up conflicts', prompt: 'Check for any merge conflicts. If found, show me the conflicted files and help me understand what each conflict is about. Suggest the safest resolution.' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400">
        <ArrowPathIcon className="w-5 h-5 animate-spin mr-2" /> Loading AI assistant…
      </div>
    );
  }

  if (!assistant) {
    return (
      <div className="text-center py-12 px-6">
        <SparklesIcon className="w-10 h-10 text-purple-300 mx-auto mb-3" />
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">No AI Assistant Available</h4>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Set up your personal AI assistant in the AI section to get intelligent help with git operations.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b dark:border-gray-700 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20">
        <SparklesIcon className="w-5 h-5 text-purple-500" />
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">{assistant.name}</h4>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">Your AI assistant for source control</p>
        </div>
        {conversationId && (
          <button
            onClick={() => { setMessages([]); setConversationId(null); }}
            className="text-xs text-purple-600 dark:text-purple-400 hover:underline"
          >
            New Chat
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="space-y-3">
            <div className="text-center py-4">
              <SparklesIcon className="w-8 h-8 text-purple-200 mx-auto mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Ask me anything about your code changes, or use a quick action below.
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                I can pull updates, resolve conflicts, commit changes, and explain everything in plain language.
              </p>
            </div>

            {/* Quick Actions */}
            <div className="space-y-1.5">
              {quickActions.map((action, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(action.prompt)}
                  className="w-full text-left px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600 hover:bg-purple-50/50 dark:hover:bg-purple-900/20 transition-colors text-gray-700 dark:text-gray-300"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 ${
              msg.role === 'user'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            }`}>
              {msg.role === 'user' ? (
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              ) : (
                <AiMarkdown content={msg.content} />
              )}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-xs text-gray-400">Thinking…</span>
              </div>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your changes…"
            rows={1}
            className="flex-1 resize-none px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-700 bg-white dark:bg-gray-800 dark:text-gray-100"
            disabled={sending}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || sending}
            className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          >
            <PaperAirplaneIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   MAIN PAGE
   ───────────────────────────────────────────────────────────── */
const SourceControlPage: React.FC = () => {
  const { user } = useAppStore();

  // ── State ─────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Config
  const [config, setConfig] = useState<{ allowedBranch: string; currentBranch: string; isOnAllowedBranch: boolean } | null>(null);

  // Status
  const [statusData, setStatusData] = useState<{
    branch: string; ahead: number; behind: number; clean: boolean;
    files: GitFile[];
    summary: { total: number; staged: number; unstaged: number; untracked: number };
  } | null>(null);

  // Branches
  const [branches, setBranches] = useState<BranchInfo[]>([]);

  // Commits
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [selectedCommit, setSelectedCommit] = useState<any>(null);

  // File management
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [commitMessage, setCommitMessage] = useState('');
  const [committing, setCommitting] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [pulling, setPulling] = useState(false);

  // Diff
  const [diffData, setDiffData] = useState<{ diff: string; file?: string } | null>(null);

  // Stash
  const [stashes, setStashes] = useState<any[]>([]);

  // Conflicts
  const [hasConflicts, setHasConflicts] = useState(false);

  // Sections
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [expandedSections, setExpandedSections] = useState({ staged: true, unstaged: true, history: true });

  const toggleSection = (key: keyof typeof expandedSections) =>
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));

  // ── Load Data ─────────────────────────────────────────────
  const loadAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [configRes, statusRes, logRes, branchRes] = await Promise.all([
        GitModel.getConfig(),
        GitModel.getStatus(),
        GitModel.getLog(30),
        GitModel.getBranches().catch(() => ({ local: [] })),
      ]);
      setConfig(configRes);
      setStatusData(statusRes);
      setCommits(logRes?.commits || []);
      setBranches(branchRes?.local || []);

      // Check for conflicts
      const conflictFiles = (statusRes?.files || []).filter((f: GitFile) => f.status?.includes('U'));
      setHasConflicts(conflictFiles.length > 0);

      // Load stash list
      GitModel.getStashList().then(r => setStashes(r?.entries || [])).catch(() => {});
    } catch (err: any) {
      notify.error('Failed to load repository status');
      console.error('[SourceControl]', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Computed ──────────────────────────────────────────────
  const stagedFiles = useMemo(() =>
    (statusData?.files || []).filter(f => f.staged), [statusData]);
  const unstagedFiles = useMemo(() =>
    (statusData?.files || []).filter(f => f.unstaged || f.type === 'untracked'), [statusData]);
  const isOnAllowed = config?.isOnAllowedBranch ?? false;

  // ── Actions ───────────────────────────────────────────────
  const handleCheckout = async (branch: string) => {
    try {
      await GitModel.checkout(branch);
      notify.success(`Switched to ${branch}`);
      loadAll(true);
    } catch (err: any) {
      if (err.response?.data?.error === 'UNCOMMITTED_CHANGES') {
        notify.error('You have uncommitted changes. Stash or commit them first.');
      } else {
        notify.error(err.response?.data?.message || 'Failed to switch branch');
      }
    }
  };

  const handleStage = async (files?: string[]) => {
    try {
      await GitModel.stage(files);
      loadAll(true);
    } catch (err: any) {
      notify.error(err.response?.data?.message || 'Failed to stage files');
    }
  };

  const handleUnstage = async (files?: string[]) => {
    try {
      await GitModel.unstage(files);
      loadAll(true);
    } catch (err: any) {
      notify.error(err.response?.data?.message || 'Failed to unstage files');
    }
  };

  const handleDiscard = async (files?: string[]) => {
    const result = await Swal.fire({
      title: 'Discard Changes?',
      text: files ? `Discard changes to ${files.length} file(s)? This cannot be undone.` : 'Discard ALL uncommitted changes? This cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Discard',
    });
    if (!result.isConfirmed) return;

    try {
      await GitModel.discard(files);
      notify.success('Changes discarded');
      loadAll(true);
    } catch (err: any) {
      notify.error(err.response?.data?.message || 'Failed to discard');
    }
  };

  const handleCommit = async () => {
    if (!commitMessage.trim()) { notify.error('Please enter a commit message'); return; }
    setCommitting(true);
    try {
      const res = await GitModel.commit(commitMessage.trim());
      notify.success(`Committed: ${res.hash}`);
      setCommitMessage('');
      loadAll(true);
    } catch (err: any) {
      if (err.response?.data?.error === 'NOTHING_STAGED') {
        notify.error('No files are staged. Stage some files first.');
      } else if (err.response?.data?.error === 'BRANCH_RESTRICTED') {
        notify.error(err.response.data.message);
      } else {
        notify.error(err.response?.data?.message || 'Commit failed');
      }
    } finally { setCommitting(false); }
  };

  const handlePush = async () => {
    setPushing(true);
    try {
      const res = await GitModel.push();
      notify.success(res.message || 'Push successful');
      loadAll(true);
    } catch (err: any) {
      notify.error(err.response?.data?.message || 'Push failed');
    } finally { setPushing(false); }
  };

  const handlePull = async () => {
    setPulling(true);
    try {
      const res = await GitModel.pull();
      if (res.error === 'MERGE_CONFLICT') {
        notify.error('Merge conflicts detected — see the AI assistant for help');
        setHasConflicts(true);
      } else {
        notify.success(res.message || 'Pull successful');
      }
      loadAll(true);
    } catch (err: any) {
      if (err.response?.status === 409) {
        notify.error('Merge conflicts! Use the AI assistant to resolve them.');
        setHasConflicts(true);
        loadAll(true);
      } else {
        notify.error(err.response?.data?.message || 'Pull failed');
      }
    } finally { setPulling(false); }
  };

  const handleStash = async () => {
    try {
      const res = await GitModel.stash();
      notify.success(res.message || 'Changes stashed');
      loadAll(true);
    } catch (err: any) {
      notify.error(err.response?.data?.message || 'Stash failed');
    }
  };

  const handleStashPop = async () => {
    try {
      const res = await GitModel.stashPop();
      notify.success(res.message || 'Stash applied');
      loadAll(true);
    } catch (err: any) {
      if (err.response?.status === 409) {
        notify.error('Applying stash caused conflicts — check the AI assistant');
        setHasConflicts(true);
      } else {
        notify.error(err.response?.data?.message || 'Stash pop failed');
      }
      loadAll(true);
    }
  };

  const handleViewDiff = async (file?: string) => {
    try {
      const res = await GitModel.getDiff(false, file);
      if (!res.diff) {
        // Try staged diff
        const stagedRes = await GitModel.getDiff(true, file);
        if (!stagedRes.diff) {
          notify.error('No changes to show');
          return;
        }
        setDiffData({ diff: stagedRes.diff, file });
      } else {
        setDiffData({ diff: res.diff, file });
      }
    } catch (err: any) {
      notify.error('Failed to load diff');
    }
  };

  const handleViewCommit = async (hash: string) => {
    try {
      const detail = await GitModel.getCommit(hash);
      setSelectedCommit(detail);
    } catch {
      notify.error('Failed to load commit details');
    }
  };

  const handleResolveConflicts = async (strategy: 'ours' | 'theirs') => {
    const label = strategy === 'ours' ? 'your local version' : 'the remote version';
    const result = await Swal.fire({
      title: 'Resolve All Conflicts',
      text: `This will resolve all conflicted files using ${label}. Continue?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: `Use ${label}`,
    });
    if (!result.isConfirmed) return;

    try {
      await GitModel.resolveConflicts(strategy);
      notify.success('Conflicts resolved');
      setHasConflicts(false);
      loadAll(true);
    } catch (err: any) {
      notify.error(err.response?.data?.message || 'Failed to resolve conflicts');
    }
  };

  const handleAbortMerge = async () => {
    const result = await Swal.fire({
      title: 'Abort Merge?',
      text: 'This will cancel the in-progress merge and restore the previous state.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Abort Merge',
    });
    if (!result.isConfirmed) return;

    try {
      await GitModel.abortMerge();
      notify.success('Merge aborted');
      setHasConflicts(false);
      loadAll(true);
    } catch (err: any) {
      notify.error(err.response?.data?.message || 'Failed to abort merge');
    }
  };

  const handleFetch = async () => {
    try {
      await GitModel.fetch();
      notify.success('Fetched latest from remote');
      loadAll(true);
    } catch (err: any) {
      notify.error(err.response?.data?.message || 'Fetch failed');
    }
  };

  // ── File selection helpers ────────────────────────────────
  const toggleFileSelection = (path: string) => {
    setSelectedFiles(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const selectAllUnstaged = () => {
    setSelectedFiles(new Set(unstagedFiles.map(f => f.path)));
  };

  const stageSelected = () => {
    if (selectedFiles.size === 0) { notify.error('Select files to stage'); return; }
    handleStage(Array.from(selectedFiles));
    setSelectedFiles(new Set());
  };

  // ── Render ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center mx-auto mb-3">
            <ArrowPathIcon className="h-6 w-6 animate-spin text-purple-400" />
          </div>
          <p className="text-sm text-gray-400 dark:text-gray-500">Loading source control…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* ── Header ────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border dark:border-gray-800 px-5 py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-sm">
              <CommandLineIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Source Control</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500">Manage code changes for Silulumanzi</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleFetch}
              title="Fetch latest from remote"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-300"
            >
              <CloudArrowDownIcon className="w-4 h-4" /> Fetch
            </button>
            <button
              onClick={handlePull}
              disabled={pulling || !isOnAllowed}
              title={!isOnAllowed ? 'Switch to Bugfix branch first' : 'Pull latest changes'}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-700 transition-colors text-gray-600 dark:text-gray-300 disabled:opacity-40"
            >
              <ArrowDownTrayIcon className={`w-4 h-4 ${pulling ? 'animate-bounce' : ''}`} /> Pull
            </button>
            <button
              onClick={handlePush}
              disabled={pushing || !isOnAllowed || (statusData?.ahead || 0) === 0}
              title={(statusData?.ahead || 0) === 0 ? 'Nothing to push' : 'Push commits to remote'}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-40 transition-colors shadow-sm"
            >
              <CloudArrowUpIcon className={`w-4 h-4 ${pushing ? 'animate-bounce' : ''}`} /> Push
              {(statusData?.ahead || 0) > 0 && (
                <span className="bg-white/20 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{statusData?.ahead}</span>
              )}
            </button>

            <div className="w-px h-8 bg-gray-200 dark:bg-gray-700" />

            <button
              onClick={() => setShowAiPanel(!showAiPanel)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg transition-colors shadow-sm ${
                showAiPanel
                  ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-600'
                  : 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white hover:from-purple-600 hover:to-indigo-700'
              }`}
            >
              <SparklesIcon className="w-4 h-4" /> AI Assistant
            </button>

            <button
              onClick={() => loadAll(true)}
              disabled={refreshing}
              title="Refresh"
              className="w-9 h-9 inline-flex items-center justify-center border border-gray-200 dark:border-gray-700 rounded-lg text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              <ArrowPathIcon className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Branch Banner ─────────────────────────────────── */}
      {config && (
        <BranchBanner
          currentBranch={config.currentBranch}
          allowedBranch={config.allowedBranch}
          isOnAllowed={config.isOnAllowedBranch}
          ahead={statusData?.ahead || 0}
          behind={statusData?.behind || 0}
          branches={branches}
          onCheckout={handleCheckout}
        />
      )}

      {/* ── Main Grid ─────────────────────────────────────── */}
      <div className={`grid gap-4 ${showAiPanel ? 'grid-cols-1 lg:grid-cols-5' : 'grid-cols-1 lg:grid-cols-3'}`}>

        {/* Left: Changes + Commit */}
        <div className={`space-y-4 ${showAiPanel ? 'lg:col-span-3' : 'lg:col-span-2'}`}>

          {/* Status Health */}
          <StatusHealthCard
            clean={statusData?.clean ?? true}
            totalChanges={statusData?.summary?.total || 0}
            stagedCount={statusData?.summary?.staged || 0}
            unstagedCount={statusData?.summary?.unstaged || 0}
            untrackedCount={statusData?.summary?.untracked || 0}
            hasConflicts={hasConflicts}
          />

          {/* Conflict Resolution */}
          {hasConflicts && (
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-red-200 dark:border-red-800 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <ShieldExclamationIcon className="w-5 h-5 text-red-500" />
                <h3 className="text-sm font-bold text-red-800 dark:text-red-300">Resolve Merge Conflicts</h3>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Choose how to resolve the conflicts. <strong>"Keep mine"</strong> keeps your local changes. <strong>"Use theirs"</strong> accepts the remote version.
                You can also use the <strong>AI assistant</strong> for a smarter resolution.
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => handleResolveConflicts('ours')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  <CheckIcon className="w-4 h-4" /> Keep Mine
                </button>
                <button onClick={() => handleResolveConflicts('theirs')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors">
                  <ArrowDownTrayIcon className="w-4 h-4" /> Use Theirs
                </button>
                <button onClick={handleAbortMerge}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                  <XCircleIcon className="w-4 h-4" /> Abort Merge
                </button>
                <button onClick={() => setShowAiPanel(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg hover:from-purple-600 hover:to-indigo-700 transition-colors">
                  <SparklesIcon className="w-4 h-4" /> Ask AI
                </button>
              </div>
            </div>
          )}

          {/* Staged Changes */}
          {stagedFiles.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border dark:border-gray-800 overflow-hidden">
              <button
                onClick={() => toggleSection('staged')}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {expandedSections.staged ? <ChevronDownIcon className="w-4 h-4 text-gray-400" /> : <ChevronRightIcon className="w-4 h-4 text-gray-400" />}
                  <CheckCircleIcon className="w-4 h-4 text-emerald-500" />
                  <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Ready to Commit</h3>
                  <span className="text-xs bg-emerald-100 dark:bg-emerald-800/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full font-bold">{stagedFiles.length}</span>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); handleUnstage(); }}
                  className="text-xs text-gray-500 hover:text-amber-600 dark:hover:text-amber-400"
                >
                  Unstage All
                </button>
              </button>
              {expandedSections.staged && (
                <div className="px-3 pb-3 space-y-0.5">
                  {stagedFiles.map(f => (
                    <FileListItem
                      key={'s-' + f.path}
                      file={f}
                      selected={false}
                      onToggle={() => {}}
                      onUnstage={() => handleUnstage([f.path])}
                      onViewDiff={() => handleViewDiff(f.path)}
                      isStaged={true}
                      disabled={!isOnAllowed}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Unstaged Changes */}
          {unstagedFiles.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border dark:border-gray-800 overflow-hidden">
              <button
                onClick={() => toggleSection('unstaged')}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {expandedSections.unstaged ? <ChevronDownIcon className="w-4 h-4 text-gray-400" /> : <ChevronRightIcon className="w-4 h-4 text-gray-400" />}
                  <ExclamationTriangleIcon className="w-4 h-4 text-amber-500" />
                  <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Changed Files</h3>
                  <span className="text-xs bg-amber-100 dark:bg-amber-800/40 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full font-bold">{unstagedFiles.length}</span>
                </div>
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  <button onClick={selectAllUnstaged} className="text-xs text-gray-500 hover:text-purple-600 dark:hover:text-purple-400">Select All</button>
                  <button
                    onClick={stageSelected}
                    disabled={selectedFiles.size === 0}
                    className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline disabled:opacity-40"
                  >
                    Stage Selected
                  </button>
                  <button
                    onClick={() => handleStage()}
                    className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
                  >
                    Stage All
                  </button>
                </div>
              </button>
              {expandedSections.unstaged && (
                <div className="px-3 pb-3 space-y-0.5">
                  {unstagedFiles.map(f => (
                    <FileListItem
                      key={'u-' + f.path}
                      file={f}
                      selected={selectedFiles.has(f.path)}
                      onToggle={() => toggleFileSelection(f.path)}
                      onStage={() => handleStage([f.path])}
                      onDiscard={() => handleDiscard([f.path])}
                      onViewDiff={() => handleViewDiff(f.path)}
                      isStaged={false}
                      disabled={!isOnAllowed}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Commit Box */}
          {isOnAllowed && stagedFiles.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border dark:border-gray-800 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <ChatBubbleLeftEllipsisIcon className="w-4 h-4 text-purple-500" />
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Commit Message</h3>
              </div>
              <textarea
                value={commitMessage}
                onChange={e => setCommitMessage(e.target.value)}
                placeholder="Describe what you changed…"
                rows={3}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-700 bg-white dark:bg-gray-800 dark:text-gray-100 resize-none"
              />
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-gray-400">
                  {stagedFiles.length} file{stagedFiles.length !== 1 ? 's' : ''} ready to commit
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCommit}
                    disabled={committing || !commitMessage.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-40 transition-colors shadow-sm"
                  >
                    <CheckIcon className="w-4 h-4" />
                    {committing ? 'Committing…' : 'Commit'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Quick Actions Bar */}
          {!statusData?.clean && isOnAllowed && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleStash}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors"
              >
                <ArchiveBoxIcon className="w-3.5 h-3.5" /> Stash Changes
              </button>
              {stashes.length > 0 && (
                <button
                  onClick={handleStashPop}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors"
                >
                  <ArrowUturnLeftIcon className="w-3.5 h-3.5" /> Pop Stash ({stashes.length})
                </button>
              )}
              <button
                onClick={() => handleDiscard()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors"
              >
                <TrashIcon className="w-3.5 h-3.5" /> Discard All
              </button>
            </div>
          )}
          {statusData?.clean && stashes.length > 0 && isOnAllowed && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleStashPop}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors"
              >
                <ArrowUturnLeftIcon className="w-3.5 h-3.5" /> Pop Stash ({stashes.length} saved)
              </button>
            </div>
          )}
        </div>

        {/* Right: AI Panel or History */}
        <div className={showAiPanel ? 'lg:col-span-2' : 'lg:col-span-1'}>
          {showAiPanel ? (
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border dark:border-gray-800 overflow-hidden h-[calc(100vh-240px)] min-h-[500px] flex flex-col">
              <AiGitPanel onRefreshStatus={() => loadAll(true)} />
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border dark:border-gray-800 overflow-hidden">
              <button
                onClick={() => toggleSection('history')}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {expandedSections.history ? <ChevronDownIcon className="w-4 h-4 text-gray-400" /> : <ChevronRightIcon className="w-4 h-4 text-gray-400" />}
                  <ClockIcon className="w-4 h-4 text-purple-500" />
                  <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Recent Commits</h3>
                  <span className="text-xs text-gray-400 dark:text-gray-500">{commits.length}</span>
                </div>
              </button>
              {expandedSections.history && (
                <div className="px-2 pb-2 max-h-[500px] overflow-y-auto">
                  {commits.length === 0 ? (
                    <p className="text-sm text-gray-400 px-3 py-4 text-center">No commits yet</p>
                  ) : (
                    <div className="space-y-0.5">
                      {commits.map((c, i) => (
                        <CommitItem
                          key={c.hash}
                          commit={c}
                          isLatest={i === 0}
                          onClick={() => handleViewCommit(c.hash)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Diff Viewer Modal ─────────────────────────────── */}
      {diffData && (
        <DiffViewer
          diff={diffData.diff}
          file={diffData.file}
          onClose={() => setDiffData(null)}
        />
      )}

      {/* ── Commit Detail Modal ───────────────────────────── */}
      {selectedCommit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSelectedCommit(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b dark:border-gray-700">
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <ClockIcon className="w-4 h-4 text-purple-500" />
                Commit Details
              </h3>
              <button onClick={() => setSelectedCommit(null)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"><XMarkIcon className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{selectedCommit.message}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  <span className="font-mono">{selectedCommit.shortHash}</span> · {selectedCommit.author} · {relativeTime(selectedCommit.date)}
                </p>
              </div>
              {selectedCommit.stats && (
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-gray-500">{selectedCommit.stats.filesChanged} file{selectedCommit.stats.filesChanged !== 1 ? 's' : ''}</span>
                  <span className="text-emerald-600">+{selectedCommit.stats.additions}</span>
                  <span className="text-red-500">-{selectedCommit.stats.deletions}</span>
                </div>
              )}
              {selectedCommit.files && selectedCommit.files.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Changed Files</p>
                  {selectedCommit.files.map((f: any, i: number) => {
                    const meta = FILE_TYPE_META[f.status] || FILE_TYPE_META.unknown;
                    return (
                      <div key={i} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 py-1">
                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${meta.bg} ${meta.color}`}>{meta.label}</span>
                        <span className="font-mono text-xs truncate">{f.path}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SourceControlPage;
