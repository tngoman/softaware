/**
 * ChatHeader — header bar with group info and search.
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  MagnifyingGlassIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import type { UnifiedGroup } from './chatTypes';
import { getInitials } from './chatTypes';

interface ChatHeaderProps {
  selectedGroup: UnifiedGroup;
  socketConnected: boolean;
  // Search
  searchQuery: string;
  onSearchQueryChange: (val: string) => void;
  searchResults: { messageId: string; index: number }[];
  currentSearchIdx: number;
  onSearchNext: () => void;
  onSearchPrev: () => void;
  onClearSearch: () => void;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({
  selectedGroup,
  socketConnected,
  searchQuery,
  onSearchQueryChange,
  searchResults,
  currentSearchIdx,
  onSearchNext,
  onSearchPrev,
  onClearSearch,
}) => {
  const [showSearch, setShowSearch] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showSearch) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [showSearch]);

  const toggleSearch = () => {
    if (showSearch) {
      onClearSearch();
      setShowSearch(false);
    } else {
      setShowSearch(true);
    }
  };

  const clearAndClose = () => {
    onClearSearch();
    setShowSearch(false);
  };

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-full flex items-center justify-center text-white font-semibold text-sm bg-gradient-to-br from-picton-blue to-indigo-500">
          {getInitials(selectedGroup.name)}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
            {selectedGroup.name}
            <span className="text-[10px] font-normal text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full">
              External
            </span>
          </h3>
          <p className="text-xs text-gray-500">
            {socketConnected ? 'Connected' : 'Reconnecting…'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {/* Search bar */}
        {showSearch && (
          <div
            className="flex items-center gap-1.5 rounded-lg border bg-white px-2 py-1 shadow-sm"
            style={{ maxWidth: 300 }}
          >
            <MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              className="flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-gray-400 min-w-[100px]"
              placeholder="Search in chat…"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onSearchNext();
                }
                if (e.key === 'Escape') clearAndClose();
              }}
            />
            {searchResults.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <span>
                  {currentSearchIdx + 1}/{searchResults.length}
                </span>
                <button onClick={onSearchPrev} className="rounded p-0.5 hover:bg-gray-100">
                  <ChevronUpIcon className="h-3.5 w-3.5" />
                </button>
                <button onClick={onSearchNext} className="rounded p-0.5 hover:bg-gray-100">
                  <ChevronDownIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <button onClick={clearAndClose} className="rounded p-0.5 hover:bg-gray-100">
              <XMarkIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <button
          onClick={toggleSearch}
          className={`p-2 rounded-lg transition-colors ${
            showSearch ? 'bg-picton-blue text-white' : 'hover:bg-gray-100 text-gray-400'
          }`}
          title="Search in chat"
        >
          <MagnifyingGlassIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default React.memo(ChatHeader);
