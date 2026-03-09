import React, { useState, useCallback, useRef } from 'react';
import {
  MagnifyingGlassIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { StaffChatModel, type SearchResult } from '../../../models/StaffChatModel';
import { renderMarkdown, getInitials, formatMessageTime, getFileUrl } from './chatHelpers';

interface GlobalSearchPanelProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (conversationId: number, messageId: number) => void;
}

export default function GlobalSearchPanel({
  open,
  onClose,
  onNavigate,
}: GlobalSearchPanelProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const data = await StaffChatModel.searchGlobal(q.trim(), 30);
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 400);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      doSearch(query);
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  // Group results by conversation
  const grouped = results.reduce<Map<string, { convId: number; convName: string; convType: string; messages: SearchResult[] }>>(
    (acc, r) => {
      const key = String(r.conversation_id);
      if (!acc.has(key)) {
        acc.set(key, {
          convId: r.conversation_id,
          convName: r.conversation_name || 'Direct message',
          convType: r.conversation_type || 'direct',
          messages: [],
        });
      }
      acc.get(key)!.messages.push(r);
      return acc;
    },
    new Map()
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-[420px] max-w-full bg-white shadow-xl flex flex-col h-full">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MagnifyingGlassIcon className="w-5 h-5 text-blue-500" />
              <h3 className="text-lg font-semibold text-gray-900">Search Messages</h3>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Search input */}
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder="Search across all conversations..."
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
              autoFocus
            />
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-blue-300 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !searched ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <MagnifyingGlassIcon className="w-10 h-10 mb-3" />
              <p className="text-sm">Type to search across all your conversations</p>
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <p className="text-sm font-medium">No results found</p>
              <p className="text-xs mt-1">Try different keywords</p>
            </div>
          ) : (
            <div>
              <p className="px-4 py-2 text-xs font-medium text-gray-400">
                {results.length} result{results.length !== 1 ? 's' : ''} in {grouped.size} conversation{grouped.size !== 1 ? 's' : ''}
              </p>

              {Array.from(grouped.values()).map((group) => (
                <div key={group.convId}>
                  {/* Conversation header */}
                  <div className="px-4 py-1.5 bg-gray-50 border-y border-gray-100">
                    <p className="text-xs font-semibold text-gray-500">
                      {group.convName}
                    </p>
                  </div>

                  {/* Messages in this conversation */}
                  {group.messages.map((msg) => (
                    <button
                      key={msg.id}
                      onClick={() => {
                        onNavigate(msg.conversation_id, msg.id);
                        onClose();
                      }}
                      className="w-full px-4 py-2.5 text-left hover:bg-gray-50 border-b border-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="text-xs font-medium text-gray-600">{msg.sender_name}</p>
                        <p className="text-[10px] text-gray-400">{formatMessageTime(msg.created_at)}</p>
                      </div>
                      {msg.content ? (
                        <p
                          className="text-sm text-gray-700 line-clamp-2"
                          dangerouslySetInnerHTML={{
                            __html: highlightQuery(msg.content, query),
                          }}
                        />
                      ) : (
                        <p className="text-sm text-gray-400 italic">📎 Media</p>
                      )}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Highlight matching text */
function highlightQuery(text: string, query: string): string {
  if (!query) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(
    new RegExp(`(${escaped})`, 'gi'),
    '<mark class="bg-yellow-200 rounded px-0.5">$1</mark>'
  );
}
