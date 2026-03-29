import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { StudioModel, type StudioSite } from '../../models/StudioModels';
import { StudioProvider, useStudioState } from '../../hooks/useStudioState';
import StudioToolbar from '../../components/Studio/StudioToolbar';
import StudioSidebar from '../../components/Studio/StudioSidebar';
import StudioCanvas from '../../components/Studio/StudioCanvas';
import StudioRightPanel from '../../components/Studio/StudioRightPanel';
import StudioAIPanel from '../../components/Studio/StudioAIPanel';
import StickyNotesPanel from '../../components/Studio/StickyNotesPanel';
import StudioDataManager from '../../components/Studio/StudioDataManager';
import CodeEditorPanel from '../../components/Studio/CodeEditorPanel';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

function WorkspaceInner() {
  const { siteId } = useParams<{ siteId: string }>();
  const navigate = useNavigate();
  const { state, dispatch } = useStudioState();
  const [loadError, setLoadError] = useState('');
  const isNew = siteId === 'new';

  // ── New-site creation state ──
  const [newForm, setNewForm] = useState({ clientId: '', businessName: '', tagline: '', about: '', services: '', primaryColor: '#6366f1', fontFamily: 'Inter' });
  const [creating, setCreating] = useState(false);
  const [clients, setClients] = useState<{ id: string; name: string; email: string }[]>([]);

  // Load client list for the selector when creating a new site
  useEffect(() => {
    if (!isNew) return;
    import('../../services/api').then(({ default: api }) => {
      api.get<{ success: boolean; clients: { id: string; name: string; email: string }[] }>('/v1/admin/clients')
        .then(res => setClients(res.data.clients || []))
        .catch(() => {});
    });
  }, [isNew]);

  const handleCreateSite = async () => {
    if (!newForm.businessName.trim()) return;
    setCreating(true);
    try {
      const result = await StudioModel.createSite({
        clientId: newForm.clientId,
        businessName: newForm.businessName.trim(),
        tagline: newForm.tagline.trim() || undefined,
        about: newForm.about.trim() || undefined,
        services: newForm.services.trim() || undefined,
        primaryColor: newForm.primaryColor,
        fontFamily: newForm.fontFamily,
      });
      navigate(`/studio/${result.siteId}`, { replace: true });
    } catch (err) {
      console.error('[Studio] Create failed:', err);
      setLoadError('Failed to create site');
    } finally {
      setCreating(false);
    }
  };

  const loadSite = useCallback(async () => {
    if (!siteId || isNew) return;
    try {
      const result = await StudioModel.getSite(siteId);
      const site = { ...result.site, pages: result.pages };
      dispatch({ type: 'SET_SITE', site });
      if (result.pages && result.pages.length > 0) {
        dispatch({ type: 'SET_CURRENT_PAGE', pageId: result.pages[0].id });
      }
    } catch (err) {
      console.error('[Studio] Failed to load site:', err);
      setLoadError('Failed to load site');
    }
  }, [siteId, dispatch, isNew]);

  useEffect(() => { loadSite(); }, [loadSite]);

  if (loadError) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-lg mb-4">{loadError}</p>
          <button onClick={() => navigate('/studio')} className="text-indigo-400 hover:underline">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ── New site creation form ──
  if (isNew) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 w-full max-w-lg">
          <button onClick={() => navigate('/studio')} className="text-gray-500 hover:text-white text-sm mb-4 flex items-center gap-1">
            <ArrowLeftIcon className="w-4 h-4" /> Back
          </button>
          <h2 className="text-2xl font-bold mb-1 bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            Create New Site
          </h2>
          <p className="text-sm text-gray-500 mb-6">Set up a new site for a client</p>

          <div className="space-y-4">
            {clients.length > 0 && (
              <div>
                <label className="text-xs text-gray-400 block mb-1">Client</label>
                <select
                  value={newForm.clientId}
                  onChange={e => setNewForm(f => ({ ...f, clientId: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">Select a client (optional)</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name || c.email}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="text-xs text-gray-400 block mb-1">Business Name *</label>
              <input
                type="text"
                value={newForm.businessName}
                onChange={e => setNewForm(f => ({ ...f, businessName: e.target.value }))}
                placeholder="e.g. Coastal Café"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Tagline</label>
              <input
                type="text"
                value={newForm.tagline}
                onChange={e => setNewForm(f => ({ ...f, tagline: e.target.value }))}
                placeholder="Fresh food, ocean views"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">About the Business</label>
              <textarea
                value={newForm.about}
                onChange={e => setNewForm(f => ({ ...f, about: e.target.value }))}
                placeholder="Brief description of the business..."
                rows={3}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm resize-none focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Services / Products</label>
              <input
                type="text"
                value={newForm.services}
                onChange={e => setNewForm(f => ({ ...f, services: e.target.value }))}
                placeholder="Coffee, breakfast, lunch, events"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Primary Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={newForm.primaryColor}
                    onChange={e => setNewForm(f => ({ ...f, primaryColor: e.target.value }))}
                    className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
                  />
                  <input
                    type="text"
                    value={newForm.primaryColor}
                    onChange={e => setNewForm(f => ({ ...f, primaryColor: e.target.value }))}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Font</label>
                <select
                  value={newForm.fontFamily}
                  onChange={e => setNewForm(f => ({ ...f, fontFamily: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                >
                  {['Inter', 'Roboto', 'Poppins', 'Open Sans', 'Montserrat', 'Playfair Display', 'Lato'].map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={handleCreateSite}
              disabled={!newForm.businessName.trim() || creating}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded-lg font-medium transition-colors mt-2"
            >
              {creating ? 'Creating...' : 'Create Site'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!state.site) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-950 text-white flex flex-col overflow-hidden">
      {/* Top Toolbar */}
      <div className="flex items-center gap-2 px-3 h-12 bg-gray-900 border-b border-gray-800 shrink-0">
        <button
          onClick={() => navigate('/studio')}
          className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors"
          title="Back to Dashboard"
        >
          <ArrowLeftIcon className="w-4 h-4 text-gray-400" />
        </button>
        <StudioToolbar />
      </div>

      {/* Main workspace area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <div className="w-60 bg-gray-900 border-r border-gray-800 overflow-y-auto shrink-0">
          <StudioSidebar />
        </div>

        {/* Center canvas */}
        <div className="flex-1 relative overflow-hidden bg-gray-950">
          <StudioCanvas />
          {state.showNotes && <StickyNotesPanel />}
        </div>

        {/* Right panel — context-sensitive */}
        <div className="w-72 bg-gray-900 border-l border-gray-800 overflow-y-auto shrink-0">
          {state.activePanel === 'ai' && <StudioAIPanel />}
          {state.activePanel === 'properties' && <StudioRightPanel />}
          {state.activePanel === 'data' && <StudioDataManager />}
          {state.activePanel === 'code' && <CodeEditorPanel />}
          {!state.activePanel && <StudioRightPanel />}
        </div>
      </div>
    </div>
  );
}

export default function StudioWorkspace() {
  return (
    <StudioProvider>
      <WorkspaceInner />
    </StudioProvider>
  );
}
