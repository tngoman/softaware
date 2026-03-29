import { useState } from 'react';
import {
  MagnifyingGlassIcon,
  ChevronRightIcon, ChevronDownIcon,
  Squares2X2Icon,
} from '@heroicons/react/24/outline';

interface ComponentDef {
  id: string;
  name: string;
  icon: string;
  preview?: string;
}

interface ComponentCategory {
  name: string;
  items: ComponentDef[];
}

const LIBRARY: ComponentCategory[] = [
  {
    name: 'Layout',
    items: [
      { id: 'section', name: 'Section', icon: '▢' },
      { id: 'container', name: 'Container', icon: '⊡' },
      { id: 'grid-2', name: '2 Column Grid', icon: '▥' },
      { id: 'grid-3', name: '3 Column Grid', icon: '⋮⋮⋮' },
      { id: 'flex-row', name: 'Flex Row', icon: '↔' },
      { id: 'flex-col', name: 'Flex Column', icon: '↕' },
      { id: 'divider', name: 'Divider', icon: '—' },
      { id: 'spacer', name: 'Spacer', icon: '⋅' },
    ],
  },
  {
    name: 'Typography',
    items: [
      { id: 'heading-1', name: 'Heading 1', icon: 'H1' },
      { id: 'heading-2', name: 'Heading 2', icon: 'H2' },
      { id: 'heading-3', name: 'Heading 3', icon: 'H3' },
      { id: 'paragraph', name: 'Paragraph', icon: '¶' },
      { id: 'blockquote', name: 'Blockquote', icon: '"' },
      { id: 'list', name: 'List', icon: '≡' },
    ],
  },
  {
    name: 'Content Blocks',
    items: [
      { id: 'hero', name: 'Hero', icon: '🏠' },
      { id: 'feature-grid', name: 'Features', icon: '✦' },
      { id: 'card', name: 'Card', icon: '☐' },
      { id: 'testimonial', name: 'Testimonial', icon: '💬' },
      { id: 'pricing-table', name: 'Pricing', icon: '💰' },
      { id: 'cta-banner', name: 'CTA Banner', icon: '📣' },
      { id: 'faq', name: 'FAQ', icon: '❓' },
      { id: 'timeline', name: 'Timeline', icon: '📅' },
      { id: 'stats', name: 'Stats', icon: '📊' },
    ],
  },
  {
    name: 'Media',
    items: [
      { id: 'image', name: 'Image', icon: '🖼' },
      { id: 'gallery', name: 'Gallery', icon: '🏞' },
      { id: 'video', name: 'Video', icon: '▶' },
      { id: 'carousel', name: 'Carousel', icon: '⟲' },
      { id: 'icon', name: 'Icon', icon: '★' },
      { id: 'avatar', name: 'Avatar', icon: '👤' },
    ],
  },
  {
    name: 'Forms & Input',
    items: [
      { id: 'contact-form', name: 'Contact Form', icon: '✉' },
      { id: 'newsletter', name: 'Newsletter', icon: '📮' },
      { id: 'search-bar', name: 'Search Bar', icon: '🔍' },
      { id: 'button', name: 'Button', icon: '⬜' },
      { id: 'input', name: 'Input Field', icon: '▁' },
    ],
  },
  {
    name: 'Navigation',
    items: [
      { id: 'navbar', name: 'Navbar', icon: '☰' },
      { id: 'footer', name: 'Footer', icon: '⏨' },
      { id: 'breadcrumb', name: 'Breadcrumb', icon: '>' },
      { id: 'pagination', name: 'Pagination', icon: '⟨⟩' },
      { id: 'tabs', name: 'Tabs', icon: '⊟' },
      { id: 'sidebar-nav', name: 'Sidebar Nav', icon: '☰' },
    ],
  },
];

interface ComponentLibraryProps {
  onDragStart?: (componentId: string) => void;
}

export default function ComponentLibrary({ onDragStart }: ComponentLibraryProps) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set(LIBRARY.map(c => c.name)));

  const toggleCategory = (cat: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  const filtered = search.trim()
    ? LIBRARY.map(cat => ({
        ...cat,
        items: cat.items.filter(i => i.name.toLowerCase().includes(search.toLowerCase())),
      })).filter(cat => cat.items.length > 0)
    : LIBRARY;

  return (
    <div className="p-2">
      <div className="flex items-center gap-2 mb-2">
        <Squares2X2Icon className="w-4 h-4 text-gray-400" />
        <span className="text-xs font-medium text-gray-300">Components</span>
      </div>

      {/* Search */}
      <div className="relative mb-2">
        <MagnifyingGlassIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-600" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search components..."
          className="w-full bg-gray-800 border border-gray-700 rounded pl-6 pr-2 py-1 text-[10px] text-gray-300 focus:outline-none focus:border-indigo-500"
        />
      </div>

      {/* Categories */}
      <div className="space-y-1">
        {filtered.map(cat => (
          <div key={cat.name}>
            <button
              onClick={() => toggleCategory(cat.name)}
              className="flex items-center gap-1 w-full px-1 py-1 text-[10px] text-gray-400 hover:text-white font-medium"
            >
              {expanded.has(cat.name) ? (
                <ChevronDownIcon className="w-3 h-3" />
              ) : (
                <ChevronRightIcon className="w-3 h-3" />
              )}
              {cat.name}
              <span className="text-gray-600 ml-auto">{cat.items.length}</span>
            </button>
            {expanded.has(cat.name) && (
              <div className="grid grid-cols-2 gap-1 pl-3 pr-1 mb-1">
                {cat.items.map(item => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={() => onDragStart?.(item.id)}
                    className="flex flex-col items-center gap-0.5 bg-gray-800 border border-gray-700 rounded p-1.5 cursor-grab hover:border-indigo-500 hover:text-white text-gray-400 transition-colors"
                  >
                    <span className="text-base leading-none">{item.icon}</span>
                    <span className="text-[9px] truncate w-full text-center">{item.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
