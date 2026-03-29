import { useState, useEffect, useCallback } from 'react';
import { useStudioState } from '../../hooks/useStudioState';
import { StudioModel, type SiteCollection } from '../../models/StudioModels';
import {
  PlusIcon, TrashIcon, PencilSquareIcon,
  CircleStackIcon, ChevronRightIcon, ChevronDownIcon,
  DocumentPlusIcon,
} from '@heroicons/react/24/outline';

export default function StudioDataManager() {
  const { state } = useStudioState();
  const [collections, setCollections] = useState<SiteCollection[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [items, setItems] = useState<Record<string, any[]>>({});
  const [newCollName, setNewCollName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(false);

  const siteId = state.site?.id;

  const loadCollections = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    try {
      const result = await StudioModel.listCollections(siteId);
      setCollections(result);
    } catch (err) {
      console.error('[DataManager] Load failed:', err);
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => { loadCollections(); }, [loadCollections]);

  const loadItems = async (collectionName: string) => {
    if (!siteId) return;
    try {
      const result = await StudioModel.getCollection(siteId, collectionName);
      setItems(prev => ({ ...prev, [collectionName]: result }));
    } catch (err) {
      console.error('[DataManager] Load items failed:', err);
    }
  };

  const toggleCollection = (name: string) => {
    if (expanded === name) {
      setExpanded(null);
    } else {
      setExpanded(name);
      if (!items[name]) loadItems(name);
    }
  };

  const createCollection = async () => {
    if (!siteId || !newCollName.trim()) return;
    try {
      await StudioModel.createCollection(siteId, newCollName.trim(), {});
      setNewCollName('');
      setShowCreate(false);
      loadCollections();
    } catch (err) {
      console.error('[DataManager] Create failed:', err);
    }
  };

  const deleteItem = async (collectionName: string, itemId: string) => {
    if (!siteId) return;
    try {
      await StudioModel.deleteCollectionItem(siteId, collectionName, itemId);
      setItems(prev => ({
        ...prev,
        [collectionName]: (prev[collectionName] || []).filter((i: any) => i.id !== itemId),
      }));
    } catch (err) {
      console.error('[DataManager] Delete item failed:', err);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <CircleStackIcon className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-medium">Data</span>
          <span className="text-[10px] text-gray-500">({collections.length})</span>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="p-1 text-gray-400 hover:text-purple-400"
        >
          <PlusIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="p-3 border-b border-gray-800 space-y-2">
          <input
            type="text"
            value={newCollName}
            onChange={e => setNewCollName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') createCollection(); }}
            placeholder="Collection name (e.g. blog_posts)"
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-purple-500"
          />
          <button
            onClick={createCollection}
            disabled={!newCollName.trim()}
            className="w-full px-2 py-1 bg-purple-600 hover:bg-purple-500 rounded text-xs font-medium disabled:opacity-30"
          >
            Create Collection
          </button>
        </div>
      )}

      {/* Collection list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {loading && collections.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin w-4 h-4 border border-purple-400 border-t-transparent rounded-full" />
          </div>
        ) : collections.length === 0 ? (
          <div className="text-center py-8">
            <CircleStackIcon className="w-8 h-8 text-gray-700 mx-auto mb-2" />
            <p className="text-xs text-gray-600">No collections yet</p>
          </div>
        ) : (
          collections.map(coll => (
            <div key={coll.collection_name} className="border border-gray-800 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleCollection(coll.collection_name)}
                className="flex items-center gap-2 w-full px-2 py-1.5 text-left hover:bg-gray-800 transition-colors"
              >
                {expanded === coll.collection_name ? (
                  <ChevronDownIcon className="w-3 h-3 text-gray-500" />
                ) : (
                  <ChevronRightIcon className="w-3 h-3 text-gray-500" />
                )}
                <span className="text-xs text-gray-300 flex-1 truncate">{coll.collection_name}</span>
                <span className="text-[10px] text-gray-600">{coll.item_count ?? 0}</span>
              </button>

              {expanded === coll.collection_name && (
                <div className="border-t border-gray-800 p-2 space-y-1">
                  {!items[coll.collection_name] ? (
                    <div className="animate-pulse text-[10px] text-gray-600 py-2 text-center">Loading...</div>
                  ) : items[coll.collection_name].length === 0 ? (
                    <p className="text-[10px] text-gray-600 text-center py-2">Empty collection</p>
                  ) : (
                    items[coll.collection_name].map((item: any) => (
                      <div key={item.id} className="flex items-center gap-1.5 bg-gray-800 rounded px-2 py-1 group">
                        <span className="text-[10px] text-gray-400 flex-1 truncate">
                          {item.data_key || item.id}
                        </span>
                        <button
                          onClick={() => deleteItem(coll.collection_name, item.id)}
                          className="p-0.5 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100"
                        >
                          <TrashIcon className="w-3 h-3" />
                        </button>
                      </div>
                    ))
                  )}
                  <button className="flex items-center gap-1 w-full px-2 py-1 text-[10px] text-purple-400 hover:bg-gray-800 rounded">
                    <DocumentPlusIcon className="w-3 h-3" /> Add item
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
