import { useState, useRef, useEffect } from 'react';
import { useStudioAI, type StudioChatMessage } from '../../hooks/useStudioAI';
import { useStudioState } from '../../hooks/useStudioState';
import {
  PaperAirplaneIcon, SparklesIcon,
  CheckIcon, XMarkIcon, TrashIcon,
} from '@heroicons/react/24/outline';

const QUICK_PROMPTS = [
  'Generate a hero section',
  'Add a contact form',
  'Improve the color scheme',
  'Make it responsive',
  'Add an FAQ section',
  'Review accessibility',
];

export default function StudioAIPanel() {
  const { state } = useStudioState();
  const {
    messages, loading, pendingActions,
    sendMessage, approveAction, rejectAction, clearChat,
  } = useStudioAI();

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    sendMessage(text, {
      siteId: state.site?.id,
      viewport: state.viewport,
      selectedComponent: state.selectedComponent || undefined,
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <SparklesIcon className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-medium">AI Assistant</span>
        </div>
        <button
          onClick={clearChat}
          className="p-1 text-gray-500 hover:text-red-400 transition-colors"
          title="Clear chat"
        >
          <TrashIcon className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-4">
            <SparklesIcon className="w-8 h-8 text-indigo-400/30 mx-auto mb-2" />
            <p className="text-xs text-gray-500 mb-3">Ask your AI assistant to help build this site</p>
            <div className="grid grid-cols-2 gap-1.5">
              {QUICK_PROMPTS.map(p => (
                <button
                  key={p}
                  onClick={() => { setInput(p); }}
                  className="text-[10px] px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-gray-400 hover:text-white hover:border-indigo-500 transition-colors text-left"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}

        {/* Pending actions */}
        {pendingActions.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">Pending Actions</p>
            {pendingActions.map((action, i) => (
              <div key={i} className="bg-gray-800 border border-indigo-500/30 rounded-lg p-2">
                <p className="text-xs text-gray-300 mb-1.5">
                  <span className="text-indigo-400 font-medium">{action.type}</span>
                  {action.target && <span className="text-gray-500"> → {action.target}</span>}
                </p>
                {action.description && (
                  <p className="text-[10px] text-gray-500 mb-2">{action.description}</p>
                )}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => approveAction(i)}
                    className="flex items-center gap-1 px-2 py-0.5 bg-green-600/20 text-green-400 rounded text-[10px] hover:bg-green-600/30"
                  >
                    <CheckIcon className="w-3 h-3" /> Apply
                  </button>
                  <button
                    onClick={() => rejectAction(i)}
                    className="flex items-center gap-1 px-2 py-0.5 bg-red-600/20 text-red-400 rounded text-[10px] hover:bg-red-600/30"
                  >
                    <XMarkIcon className="w-3 h-3" /> Skip
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <div className="animate-spin w-3 h-3 border border-indigo-400 border-t-transparent rounded-full" />
            Thinking...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-2 border-t border-gray-800 shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
            }}
            placeholder="Ask AI to build, edit, or improve..."
            rows={2}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-200 resize-none focus:border-indigo-500 focus:outline-none"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="p-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 rounded-lg transition-colors"
          >
            <PaperAirplaneIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: StudioChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[90%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
          isUser
            ? 'bg-indigo-600/20 text-indigo-200'
            : 'bg-gray-800 text-gray-300'
        }`}
      >
        <div className="whitespace-pre-wrap">{message.content}</div>
      </div>
    </div>
  );
}
