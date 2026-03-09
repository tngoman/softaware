import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { StaffChatModel, GifResult } from '../../../models/StaffChatModel';

interface GifPickerProps {
  onSelect: (gif: GifResult) => void;
  onClose: () => void;
}

export default function GifPicker({ onSelect, onClose }: GifPickerProps) {
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(false);
  const searchTimer = useRef<NodeJS.Timeout | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Load trending on mount
  useEffect(() => {
    loadGifs();
  }, []);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const loadGifs = useCallback(async (searchQuery?: string) => {
    try {
      setLoading(true);
      const results = await StaffChatModel.searchGifs(searchQuery || undefined, 30);
      setGifs(results);
    } catch {
      // Silently fail — user can retry
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = (value: string) => {
    setQuery(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      loadGifs(value.trim() || undefined);
    }, 400);
  };

  return (
    <div
      ref={panelRef}
      className="bg-white rounded-xl shadow-2xl border border-gray-200 w-80 max-h-96 flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
        <h4 className="text-sm font-semibold text-gray-700">GIFs</h4>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-gray-100">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search GIFs..."
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            autoFocus
          />
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : gifs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-400">
            <p className="text-sm">{query ? 'No GIFs found' : 'Loading...'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            {gifs.map((gif) => (
              <button
                key={gif.id}
                onClick={() => onSelect(gif)}
                className="relative group rounded-lg overflow-hidden bg-gray-100 hover:ring-2 hover:ring-blue-400 transition-all"
                style={{ aspectRatio: `${gif.width}/${gif.height}`, minHeight: '80px', maxHeight: '140px' }}
              >
                <img
                  src={gif.preview}
                  alt={gif.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tenor attribution */}
      <div className="px-3 py-1.5 border-t border-gray-100 text-center">
        <span className="text-[10px] text-gray-400">Powered by Tenor</span>
      </div>
    </div>
  );
}
