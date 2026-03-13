import React, { useState, useRef, useEffect } from 'react';
import { XMarkIcon, PlusIcon } from '@heroicons/react/24/outline';

interface TagInputProps {
  tags: string[];
  allTags?: string[];
  onChange: (tags: string[]) => void;
  compact?: boolean;
}

const TAG_COLORS = [
  'bg-indigo-100 text-indigo-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
  'bg-violet-100 text-violet-700',
  'bg-lime-100 text-lime-700',
  'bg-fuchsia-100 text-fuchsia-700',
];

function tagColor(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = ((hash << 5) - hash + tag.charCodeAt(i)) | 0;
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

const TagInput: React.FC<TagInputProps> = ({ tags, allTags = [], onChange, compact }) => {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setEditing(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleInputChange = (val: string) => {
    setInput(val);
    if (val.trim()) {
      const filtered = allTags.filter(t => t.toLowerCase().includes(val.toLowerCase()) && !tags.includes(t));
      setSuggestions(filtered.slice(0, 5));
    } else {
      setSuggestions([]);
    }
  };

  const addTag = (tag: string) => {
    const trimmed = tag.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInput('');
    setSuggestions([]);
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter(t => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (input.trim()) addTag(input);
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    } else if (e.key === 'Escape') {
      setEditing(false);
    }
  };

  if (compact && !editing) {
    return (
      <div className="flex items-center gap-1 flex-wrap">
        {tags.map(tag => (
          <span key={tag} className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full font-medium ${tagColor(tag)}`}>
            {tag}
          </span>
        ))}
        <button
          onClick={() => setEditing(true)}
          className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors"
          title="Add tag"
        >
          <PlusIcon className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        className={`flex items-center gap-1 flex-wrap min-h-[28px] px-2 py-1 border rounded-lg bg-white ${editing ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-gray-200'}`}
        onClick={() => setEditing(true)}
      >
        {tags.map(tag => (
          <span key={tag} className={`inline-flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full font-medium ${tagColor(tag)}`}>
            {tag}
            <button onClick={(e) => { e.stopPropagation(); removeTag(tag); }} className="hover:opacity-70">
              <XMarkIcon className="w-3 h-3" />
            </button>
          </span>
        ))}
        {editing && (
          <input
            ref={inputRef}
            value={input}
            onChange={e => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 min-w-[60px] text-xs outline-none bg-transparent"
            placeholder={tags.length === 0 ? 'Add tags...' : ''}
          />
        )}
        {!editing && tags.length === 0 && (
          <span className="text-xs text-gray-400">Add tags...</span>
        )}
      </div>
      {suggestions.length > 0 && editing && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg py-1">
          {suggestions.map(s => (
            <button
              key={s}
              onClick={() => addTag(s)}
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-indigo-50 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default TagInput;
export { tagColor };
