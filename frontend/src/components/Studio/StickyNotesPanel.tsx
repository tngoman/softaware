import { useState, useEffect, useCallback } from 'react';
import { useStudioState } from '../../hooks/useStudioState';
import { StudioModel, type StickyNote, type NoteReply } from '../../models/StudioModels';
import {
  PlusIcon, ChatBubbleOvalLeftEllipsisIcon,
  XMarkIcon, TrashIcon, PaperAirplaneIcon,
} from '@heroicons/react/24/outline';

const NOTE_COLORS = [
  { value: 'yellow', bg: 'bg-yellow-200', text: 'text-yellow-900', border: 'border-yellow-400' },
  { value: 'pink', bg: 'bg-pink-200', text: 'text-pink-900', border: 'border-pink-400' },
  { value: 'blue', bg: 'bg-blue-200', text: 'text-blue-900', border: 'border-blue-400' },
  { value: 'green', bg: 'bg-green-200', text: 'text-green-900', border: 'border-green-400' },
  { value: 'purple', bg: 'bg-purple-200', text: 'text-purple-900', border: 'border-purple-400' },
];

export default function StickyNotesPanel() {
  const { state } = useStudioState();
  const [notes, setNotes] = useState<StickyNote[]>([]);
  const [expandedNote, setExpandedNote] = useState<string | null>(null);
  const [newContent, setNewContent] = useState('');
  const [newColor, setNewColor] = useState('yellow');
  const [showCreate, setShowCreate] = useState(false);
  const [replyText, setReplyText] = useState('');

  const siteId = state.site?.id;

  const loadNotes = useCallback(async () => {
    if (!siteId) return;
    try {
      const result = await StudioModel.listNotes(siteId);
      setNotes(result);
    } catch (err) {
      console.error('[StickyNotes] Load failed:', err);
    }
  }, [siteId]);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  const createNote = async () => {
    if (!siteId || !newContent.trim()) return;
    try {
      await StudioModel.createNote(siteId, {
        content: newContent.trim(),
        color: newColor,
        pageId: state.currentPage || undefined,
      });
      setNewContent('');
      setShowCreate(false);
      loadNotes();
    } catch (err) {
      console.error('[StickyNotes] Create failed:', err);
    }
  };

  const deleteNote = async (noteId: string) => {
    if (!siteId) return;
    try {
      await StudioModel.deleteNote(siteId, noteId);
      setNotes(prev => prev.filter(n => n.id !== noteId));
    } catch (err) {
      console.error('[StickyNotes] Delete failed:', err);
    }
  };

  const addReply = async (noteId: string) => {
    if (!siteId || !replyText.trim()) return;
    try {
      await StudioModel.addNoteReply(siteId, noteId, replyText.trim());
      setReplyText('');
      loadNotes();
    } catch (err) {
      console.error('[StickyNotes] Reply failed:', err);
    }
  };

  const getColorStyle = (color: string) => NOTE_COLORS.find(c => c.value === color) || NOTE_COLORS[0];

  return (
    <div className="absolute right-4 top-4 w-72 max-h-[80vh] bg-gray-900 border border-gray-700 rounded-xl shadow-xl flex flex-col z-20">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <ChatBubbleOvalLeftEllipsisIcon className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-medium">Notes</span>
          <span className="text-[10px] text-gray-500">({notes.length})</span>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="p-1 text-gray-400 hover:text-amber-400"
        >
          <PlusIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="p-3 border-b border-gray-800 space-y-2">
          <textarea
            value={newContent}
            onChange={e => setNewContent(e.target.value)}
            placeholder="Write a note..."
            rows={3}
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 resize-none focus:outline-none focus:border-amber-500"
          />
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              {NOTE_COLORS.map(c => (
                <button
                  key={c.value}
                  onClick={() => setNewColor(c.value)}
                  className={`w-5 h-5 rounded-full ${c.bg} ${newColor === c.value ? 'ring-2 ring-white ring-offset-1 ring-offset-gray-900' : ''}`}
                />
              ))}
            </div>
            <button
              onClick={createNote}
              disabled={!newContent.trim()}
              className="px-2 py-1 bg-amber-600 hover:bg-amber-500 rounded text-[10px] font-medium disabled:opacity-30"
            >
              Add Note
            </button>
          </div>
        </div>
      )}

      {/* Note list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {notes.length === 0 ? (
          <p className="text-xs text-gray-600 text-center py-6">No notes yet</p>
        ) : (
          notes.map(note => {
            const cs = getColorStyle(note.color);
            const expanded = expandedNote === note.id;
            return (
              <div
                key={note.id}
                className={`rounded-lg border ${cs.border} overflow-hidden`}
              >
                <div
                  className={`${cs.bg} ${cs.text} p-2 cursor-pointer`}
                  onClick={() => setExpandedNote(expanded ? null : note.id)}
                >
                  <div className="flex items-start justify-between gap-1">
                    <p className="text-xs leading-relaxed flex-1">{note.content}</p>
                    <button
                      onClick={e => { e.stopPropagation(); deleteNote(note.id); }}
                      className="p-0.5 opacity-40 hover:opacity-100"
                    >
                      <TrashIcon className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[9px] opacity-50">
                      {note.created_by_name || 'Staff'}
                    </span>
                    {note.replies && note.replies.length > 0 && (
                      <span className="text-[9px] opacity-50">{note.replies.length} replies</span>
                    )}
                  </div>
                </div>

                {/* Expanded: replies */}
                {expanded && (
                  <div className="bg-gray-800 p-2 space-y-1.5">
                    {note.replies?.map((reply: NoteReply) => (
                      <div key={reply.id} className="text-[10px] text-gray-400">
                        <span className="text-gray-300 font-medium">{reply.created_by_name || 'Staff'}: </span>
                        {reply.content}
                      </div>
                    ))}
                    <div className="flex items-center gap-1 mt-1">
                      <input
                        type="text"
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') addReply(note.id); }}
                        placeholder="Reply..."
                        className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-0.5 text-[10px] text-gray-300 focus:outline-none"
                      />
                      <button
                        onClick={() => addReply(note.id)}
                        className="p-0.5 text-gray-500 hover:text-amber-400"
                      >
                        <PaperAirplaneIcon className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
