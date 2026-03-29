import { useState } from 'react';
import { useStudioState } from '../../hooks/useStudioState';
import {
  Square3Stack3DIcon, EyeIcon, EyeSlashIcon,
  LockClosedIcon, LockOpenIcon,
  ChevronRightIcon, ChevronDownIcon,
} from '@heroicons/react/24/outline';

interface LayerNode {
  id: string;
  tag: string;
  label: string;
  depth: number;
  children: LayerNode[];
  visible: boolean;
  locked: boolean;
}

// Parse a flat HTML-like tree for layers (in production, this comes from the iframe DOM)
function buildMockLayers(): LayerNode[] {
  return [
    {
      id: 'header', tag: 'header', label: 'Header', depth: 0, visible: true, locked: false,
      children: [
        { id: 'nav', tag: 'nav', label: 'Navbar', depth: 1, visible: true, locked: false, children: [] },
        { id: 'logo', tag: 'img', label: 'Logo', depth: 1, visible: true, locked: false, children: [] },
      ],
    },
    {
      id: 'hero', tag: 'section', label: 'Hero Section', depth: 0, visible: true, locked: false,
      children: [
        { id: 'hero-title', tag: 'h1', label: 'Heading', depth: 1, visible: true, locked: false, children: [] },
        { id: 'hero-sub', tag: 'p', label: 'Subtitle', depth: 1, visible: true, locked: false, children: [] },
        { id: 'hero-cta', tag: 'button', label: 'CTA Button', depth: 1, visible: true, locked: false, children: [] },
      ],
    },
    {
      id: 'content', tag: 'main', label: 'Main Content', depth: 0, visible: true, locked: false,
      children: [],
    },
    {
      id: 'footer', tag: 'footer', label: 'Footer', depth: 0, visible: true, locked: false,
      children: [],
    },
  ];
}

export default function LayersPanel() {
  const { state, dispatch } = useStudioState();
  const [layers] = useState<LayerNode[]>(buildMockLayers);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['header', 'hero']));

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectLayer = (id: string) => {
    dispatch({ type: 'SELECT_COMPONENT', componentId: id });
  };

  const renderNode = (node: LayerNode) => {
    const hasChildren = node.children.length > 0;
    const isExpanded = expanded.has(node.id);
    const isSelected = state.selectedComponent === node.id;

    return (
      <div key={node.id}>
        <div
          className={`flex items-center gap-1 px-1 py-0.5 rounded cursor-pointer group text-xs ${
            isSelected ? 'bg-indigo-600/20 text-indigo-300' : 'text-gray-400 hover:bg-gray-800'
          }`}
          style={{ paddingLeft: `${node.depth * 12 + 4}px` }}
          onClick={() => selectLayer(node.id)}
        >
          {/* Expand toggle */}
          {hasChildren ? (
            <button onClick={e => { e.stopPropagation(); toggleExpand(node.id); }} className="p-0.5">
              {isExpanded ? <ChevronDownIcon className="w-3 h-3" /> : <ChevronRightIcon className="w-3 h-3" />}
            </button>
          ) : (
            <span className="w-4" />
          )}

          {/* Tag badge */}
          <span className="text-[9px] text-gray-600 bg-gray-800 px-1 rounded font-mono">{node.tag}</span>

          {/* Label */}
          <span className="flex-1 truncate">{node.label}</span>

          {/* Visibility toggle */}
          <button
            onClick={e => { e.stopPropagation(); }}
            className="p-0.5 opacity-0 group-hover:opacity-100 text-gray-600 hover:text-gray-300"
          >
            {node.visible ? <EyeIcon className="w-3 h-3" /> : <EyeSlashIcon className="w-3 h-3" />}
          </button>

          {/* Lock toggle */}
          <button
            onClick={e => { e.stopPropagation(); }}
            className="p-0.5 opacity-0 group-hover:opacity-100 text-gray-600 hover:text-gray-300"
          >
            {node.locked ? <LockClosedIcon className="w-3 h-3" /> : <LockOpenIcon className="w-3 h-3" />}
          </button>
        </div>

        {hasChildren && isExpanded && (
          <div>
            {node.children.map(child => renderNode({ ...child, depth: node.depth + 1 }))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-2">
      <div className="flex items-center gap-2 mb-2">
        <Square3Stack3DIcon className="w-4 h-4 text-gray-400" />
        <span className="text-xs font-medium text-gray-300">Layers</span>
      </div>
      <div className="space-y-0.5">
        {layers.map(node => renderNode(node))}
      </div>
    </div>
  );
}
