import { useStudioState } from '../../hooks/useStudioState';
import { useStudioHistory } from '../../hooks/useStudioHistory';
import {
  DevicePhoneMobileIcon, ComputerDesktopIcon, DeviceTabletIcon,
  ArrowUturnLeftIcon, ArrowUturnRightIcon,
  PlusIcon, MinusIcon,
  Squares2X2Icon, ChatBubbleLeftRightIcon,
  CodeBracketIcon, CircleStackIcon,
  ChatBubbleOvalLeftEllipsisIcon,
  EyeIcon, RocketLaunchIcon,
} from '@heroicons/react/24/outline';

const VIEWPORTS = [
  { key: 'desktop' as const, icon: ComputerDesktopIcon, label: 'Desktop' },
  { key: 'tablet' as const, icon: DeviceTabletIcon, label: 'Tablet' },
  { key: 'mobile' as const, icon: DevicePhoneMobileIcon, label: 'Mobile' },
];

export default function StudioToolbar() {
  const { state, dispatch } = useStudioState();
  const { canUndo, canRedo, undo, redo } = useStudioHistory();

  return (
    <div className="flex items-center justify-between flex-1 gap-4 text-sm">
      {/* Left: site name + page */}
      <div className="flex items-center gap-3 min-w-0">
        <span className="font-semibold text-white truncate max-w-[180px]">
          {state.site?.business_name || 'Untitled'}
        </span>
        {state.currentPage && (
          <span className="text-gray-500 truncate max-w-[120px]">
            / {state.pages.find(p => p.id === state.currentPage)?.name || ''}
          </span>
        )}
        {state.isDirty && (
          <span className="w-2 h-2 bg-amber-400 rounded-full" title="Unsaved changes" />
        )}
      </div>

      {/* Center: Viewport + Zoom + Undo/Redo */}
      <div className="flex items-center gap-1">
        {/* Viewport */}
        <div className="flex items-center bg-gray-800 rounded-lg p-0.5 mr-2">
          {VIEWPORTS.map(v => (
            <button
              key={v.key}
              onClick={() => dispatch({ type: 'SET_VIEWPORT', viewport: v.key })}
              className={`p-1.5 rounded-md transition-colors ${
                state.viewport === v.key ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
              title={v.label}
            >
              <v.icon className="w-4 h-4" />
            </button>
          ))}
        </div>

        {/* Zoom */}
        <button
          onClick={() => dispatch({ type: 'SET_ZOOM', zoom: Math.max(25, state.zoom - 25) })}
          className="p-1.5 text-gray-400 hover:text-white"
          title="Zoom out"
        >
          <MinusIcon className="w-4 h-4" />
        </button>
        <span className="text-xs text-gray-400 w-10 text-center">{state.zoom}%</span>
        <button
          onClick={() => dispatch({ type: 'SET_ZOOM', zoom: Math.min(200, state.zoom + 25) })}
          className="p-1.5 text-gray-400 hover:text-white"
          title="Zoom in"
        >
          <PlusIcon className="w-4 h-4" />
        </button>

        {/* Divider */}
        <div className="w-px h-5 bg-gray-700 mx-1" />

        {/* Undo / Redo */}
        <button
          onClick={undo}
          disabled={!canUndo}
          className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30"
          title="Undo"
        >
          <ArrowUturnLeftIcon className="w-4 h-4" />
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30"
          title="Redo"
        >
          <ArrowUturnRightIcon className="w-4 h-4" />
        </button>

        {/* Grid toggle */}
        <button
          onClick={() => dispatch({ type: 'TOGGLE_GRID' })}
          className={`p-1.5 rounded transition-colors ${state.showGrid ? 'text-indigo-400' : 'text-gray-400 hover:text-white'}`}
          title="Toggle grid"
        >
          <Squares2X2Icon className="w-4 h-4" />
        </button>
      </div>

      {/* Right: Panel toggles + actions */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => dispatch({ type: 'SET_ACTIVE_PANEL', panel: state.activePanel === 'ai' ? null : 'ai' })}
          className={`p-1.5 rounded transition-colors ${state.activePanel === 'ai' ? 'text-indigo-400 bg-indigo-400/10' : 'text-gray-400 hover:text-white'}`}
          title="AI Assistant"
        >
          <ChatBubbleLeftRightIcon className="w-4 h-4" />
        </button>
        <button
          onClick={() => dispatch({ type: 'SET_ACTIVE_PANEL', panel: state.activePanel === 'code' ? null : 'code' })}
          className={`p-1.5 rounded transition-colors ${state.activePanel === 'code' ? 'text-indigo-400 bg-indigo-400/10' : 'text-gray-400 hover:text-white'}`}
          title="Code Editor"
        >
          <CodeBracketIcon className="w-4 h-4" />
        </button>
        <button
          onClick={() => dispatch({ type: 'SET_ACTIVE_PANEL', panel: state.activePanel === 'data' ? null : 'data' })}
          className={`p-1.5 rounded transition-colors ${state.activePanel === 'data' ? 'text-indigo-400 bg-indigo-400/10' : 'text-gray-400 hover:text-white'}`}
          title="Data Manager"
        >
          <CircleStackIcon className="w-4 h-4" />
        </button>
        <button
          onClick={() => dispatch({ type: 'TOGGLE_NOTES' })}
          className={`p-1.5 rounded transition-colors ${state.showNotes ? 'text-amber-400 bg-amber-400/10' : 'text-gray-400 hover:text-white'}`}
          title="Sticky Notes"
        >
          <ChatBubbleOvalLeftEllipsisIcon className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-gray-700 mx-1" />

        <button className="p-1.5 text-gray-400 hover:text-white" title="Preview">
          <EyeIcon className="w-4 h-4" />
        </button>
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 rounded-lg text-xs font-medium transition-colors"
          title="Deploy"
        >
          <RocketLaunchIcon className="w-3.5 h-3.5" />
          Deploy
        </button>
      </div>
    </div>
  );
}
