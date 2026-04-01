import { createContext, useContext, useReducer, type ReactNode } from 'react';
import type { StudioSite, StudioPage, StickyNote, StudioAction } from '../models/StudioModels';

// ─── Types ───────────────────────────────────────────────────────────────

export type Viewport = 'desktop' | 'tablet' | 'mobile';
export type ActivePanel = 'properties' | 'ai' | 'code' | 'data' | null;

export interface StudioState {
  site: StudioSite | null;
  pages: StudioPage[];
  currentPage: string | null;
  viewport: Viewport;
  zoom: number;
  showGrid: boolean;
  showNotes: boolean;
  selectedComponent: string | null;
  activePanel: ActivePanel;
  notes: StickyNote[];
  pendingActions: StudioAction[];
  isDirty: boolean;
  codeEditorOpen: boolean;
  componentStyles: Record<string, Record<string, string>>;
}

// ─── Actions ─────────────────────────────────────────────────────────────

type StudioAction_ =
  | { type: 'SET_SITE'; site: StudioSite }
  | { type: 'SET_PAGES'; pages: StudioPage[] }
  | { type: 'SET_CURRENT_PAGE'; pageId: string }
  | { type: 'SET_VIEWPORT'; viewport: Viewport }
  | { type: 'SET_ZOOM'; zoom: number }
  | { type: 'TOGGLE_GRID' }
  | { type: 'TOGGLE_NOTES' }
  | { type: 'SELECT_COMPONENT'; componentId: string | null }
  | { type: 'SET_ACTIVE_PANEL'; panel: ActivePanel }
  | { type: 'SET_NOTES'; notes: StickyNote[] }
  | { type: 'ADD_PENDING_ACTION'; action: StudioAction }
  | { type: 'REMOVE_PENDING_ACTION'; index: number }
  | { type: 'SET_DIRTY'; dirty: boolean }
  | { type: 'TOGGLE_CODE_EDITOR' }
  | { type: 'UPDATE_PAGE'; pageId: string; updates: Partial<StudioPage> }
  | { type: 'UPDATE_COMPONENT_STYLE'; componentId: string; property: string; value: string };

const initialState: StudioState = {
  site: null,
  pages: [],
  currentPage: null,
  viewport: 'desktop',
  zoom: 100,
  showGrid: false,
  showNotes: true,
  selectedComponent: null,
  activePanel: 'properties',
  notes: [],
  pendingActions: [],
  isDirty: false,
  codeEditorOpen: false,
  componentStyles: {},
};

function studioReducer(state: StudioState, action: StudioAction_): StudioState {
  switch (action.type) {
    case 'SET_SITE':
      return { ...state, site: action.site, pages: action.site.pages || [], isDirty: false };
    case 'SET_PAGES':
      return { ...state, pages: action.pages };
    case 'SET_CURRENT_PAGE':
      return { ...state, currentPage: action.pageId, selectedComponent: null };
    case 'SET_VIEWPORT':
      return { ...state, viewport: action.viewport };
    case 'SET_ZOOM':
      return { ...state, zoom: action.zoom };
    case 'TOGGLE_GRID':
      return { ...state, showGrid: !state.showGrid };
    case 'TOGGLE_NOTES':
      return { ...state, showNotes: !state.showNotes };
    case 'SELECT_COMPONENT':
      return { ...state, selectedComponent: action.componentId };
    case 'SET_ACTIVE_PANEL':
      return { ...state, activePanel: action.panel };
    case 'SET_NOTES':
      return { ...state, notes: action.notes };
    case 'ADD_PENDING_ACTION':
      return { ...state, pendingActions: [...state.pendingActions, action.action] };
    case 'REMOVE_PENDING_ACTION':
      return { ...state, pendingActions: state.pendingActions.filter((_, i) => i !== action.index) };
    case 'SET_DIRTY':
      return { ...state, isDirty: action.dirty };
    case 'TOGGLE_CODE_EDITOR':
      return { ...state, codeEditorOpen: !state.codeEditorOpen };
    case 'UPDATE_PAGE':
      return {
        ...state,
        pages: state.pages.map(p => p.id === action.pageId ? { ...p, ...action.updates } : p),
        isDirty: true,
      };
    case 'UPDATE_COMPONENT_STYLE':
      return {
        ...state,
        componentStyles: {
          ...state.componentStyles,
          [action.componentId]: {
            ...(state.componentStyles[action.componentId] || {}),
            [action.property]: action.value,
          },
        },
        isDirty: true,
      };
    default:
      return state;
  }
}

// ─── Context ─────────────────────────────────────────────────────────────

interface StudioContextValue {
  state: StudioState;
  dispatch: React.Dispatch<StudioAction_>;
}

const StudioContext = createContext<StudioContextValue | null>(null);

export function StudioProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(studioReducer, initialState);

  return (
    <StudioContext.Provider value={{ state, dispatch }}>
      {children}
    </StudioContext.Provider>
  );
}

export function useStudioState() {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error('useStudioState must be used within a StudioProvider');
  return ctx;
}
