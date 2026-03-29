import { useState } from 'react';
import { useStudioState } from '../../hooks/useStudioState';
import {
  DocumentIcon, PlusIcon, ChevronRightIcon, ChevronDownIcon,
  TrashIcon, PencilSquareIcon,
  Squares2X2Icon, SwatchIcon,
  Square3Stack3DIcon,
} from '@heroicons/react/24/outline';

type SidebarTab = 'pages' | 'components' | 'layers' | 'styles';

const TABS: { key: SidebarTab; icon: typeof DocumentIcon; label: string }[] = [
  { key: 'pages', icon: DocumentIcon, label: 'Pages' },
  { key: 'components', icon: Squares2X2Icon, label: 'Components' },
  { key: 'layers', icon: Square3Stack3DIcon, label: 'Layers' },
  { key: 'styles', icon: SwatchIcon, label: 'Styles' },
];

const COMPONENT_LIBRARY = [
  { category: 'Layout', items: ['Header', 'Footer', 'Section', 'Container', 'Grid', 'Sidebar'] },
  { category: 'Content', items: ['Hero', 'Card', 'Testimonial', 'Feature', 'Pricing', 'CTA'] },
  { category: 'Media', items: ['Image', 'Gallery', 'Video', 'Carousel', 'Icon'] },
  { category: 'Forms', items: ['Contact Form', 'Newsletter', 'Login', 'Search'] },
  { category: 'Navigation', items: ['Navbar', 'Breadcrumb', 'Pagination', 'Tabs'] },
];

export default function StudioSidebar() {
  const { state, dispatch } = useStudioState();
  const [tab, setTab] = useState<SidebarTab>('pages');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['Layout', 'Content']));

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b border-gray-800 shrink-0">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex flex-col items-center py-2 text-[10px] transition-colors ${
              tab === t.key ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <t.icon className="w-4 h-4 mb-0.5" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {/* Pages tab */}
        {tab === 'pages' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Pages</span>
              <button
                className="p-1 text-gray-500 hover:text-indigo-400"
                title="Add page"
              >
                <PlusIcon className="w-3.5 h-3.5" />
              </button>
            </div>
            {state.pages.length === 0 ? (
              <p className="text-xs text-gray-600 text-center py-4">No pages yet</p>
            ) : (
              <ul className="space-y-0.5">
                {state.pages.map(page => (
                  <li
                    key={page.id}
                    onClick={() => dispatch({ type: 'SET_CURRENT_PAGE', pageId: page.id })}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm transition-colors ${
                      state.currentPage === page.id
                        ? 'bg-indigo-600/20 text-indigo-300'
                        : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                    }`}
                  >
                    <DocumentIcon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate flex-1">{page.name}</span>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                      <button className="p-0.5 hover:text-indigo-400">
                        <PencilSquareIcon className="w-3 h-3" />
                      </button>
                      <button className="p-0.5 hover:text-red-400">
                        <TrashIcon className="w-3 h-3" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Components tab */}
        {tab === 'components' && (
          <div>
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wide block mb-2">
              Component Library
            </span>
            {COMPONENT_LIBRARY.map(cat => (
              <div key={cat.category} className="mb-1">
                <button
                  onClick={() => toggleCategory(cat.category)}
                  className="flex items-center gap-1 w-full px-1 py-1 text-xs text-gray-400 hover:text-white"
                >
                  {expandedCategories.has(cat.category) ? (
                    <ChevronDownIcon className="w-3 h-3" />
                  ) : (
                    <ChevronRightIcon className="w-3 h-3" />
                  )}
                  <span className="font-medium">{cat.category}</span>
                  <span className="text-gray-600 ml-auto">{cat.items.length}</span>
                </button>
                {expandedCategories.has(cat.category) && (
                  <div className="grid grid-cols-2 gap-1 pl-4 pr-1 mb-1">
                    {cat.items.map(item => (
                      <div
                        key={item}
                        draggable
                        className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-300 cursor-grab hover:border-indigo-500 hover:text-white transition-colors text-center"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Layers tab */}
        {tab === 'layers' && (
          <div>
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wide block mb-2">
              Layer Tree
            </span>
            <p className="text-xs text-gray-600 text-center py-8">
              Select a page to view its layer tree
            </p>
          </div>
        )}

        {/* Styles tab */}
        {tab === 'styles' && (
          <div>
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wide block mb-2">
              Global Styles
            </span>
            <div className="space-y-3">
              {/* Primary color */}
              <div>
                <label className="text-xs text-gray-500 block mb-1">Primary Color</label>
                <div className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded border border-gray-700"
                    style={{ backgroundColor: state.site?.primary_color || '#6366f1' }}
                  />
                  <span className="text-xs text-gray-400">{state.site?.primary_color || '#6366f1'}</span>
                </div>
              </div>

              {/* Font family */}
              <div>
                <label className="text-xs text-gray-500 block mb-1">Font Family</label>
                <select className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300">
                  <option>Inter</option>
                  <option>Roboto</option>
                  <option>Poppins</option>
                  <option>Open Sans</option>
                  <option>Montserrat</option>
                  <option>Playfair Display</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
