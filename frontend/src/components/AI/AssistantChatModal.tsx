import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  SparklesIcon,
  UserCircleIcon,
  XMarkIcon,
  PaperAirplaneIcon,
  PlusIcon,
  TrashIcon,
  ChatBubbleLeftRightIcon,
  Bars3Icon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { API_BASE_URL } from '../../services/api';

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ConversationSummary {
  id: string;
  role: string;
  assistant_id: string | null;
  created_at: string;
  updated_at: string;
  preview: string | null;
}

export interface AssistantChatTarget {
  id: string;
  name: string;
}

interface AssistantChatModalProps {
  assistant: AssistantChatTarget;
  onClose: () => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */
const authHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('jwt_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

function formatRelativeDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/* ================================================================== */
/*  AssistantChatModal                                                  */
/* ================================================================== */
export default function AssistantChatModal({ assistant, onClose }: AssistantChatModalProps) {
  /* ---- message state ---- */
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);

  /* ---- conversation history sidebar ---- */
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarSearch, setSidebarSearch] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /* ---- load conversations ---- */
  const loadConversations = useCallback(async () => {
    try {
      setLoadingConvs(true);
      const res = await fetch(`${API_BASE_URL}/v1/mobile/conversations`, {
        headers: authHeaders(),
      });
      const data = await res.json();
      if (data.success && data.conversations) {
        const filtered = data.conversations.filter(
          (c: ConversationSummary) => c.assistant_id === assistant.id,
        );
        setConversations(filtered);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setLoadingConvs(false);
    }
  }, [assistant.id]);

  useEffect(() => {
    loadConversations();
    setTimeout(() => inputRef.current?.focus(), 150);
  }, [loadConversations]);

  /* ---- load messages for a conversation ---- */
  const loadConversation = useCallback(async (convId: string) => {
    try {
      setLoadingMessages(true);
      setActiveConvId(convId);
      const res = await fetch(
        `${API_BASE_URL}/v1/mobile/conversations/${encodeURIComponent(convId)}/messages`,
        { headers: authHeaders() },
      );
      const data = await res.json();
      if (data.success && data.messages) {
        setMessages(
          data.messages
            .filter((m: any) => m.role === 'user' || m.role === 'assistant')
            .map((m: any) => ({
              id: m.id,
              role: m.role as 'user' | 'assistant',
              content: m.content,
            })),
        );
      }
    } catch (err) {
      console.error('Failed to load conversation messages:', err);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  /* ---- delete a conversation ---- */
  const deleteConversation = async (convId: string) => {
    try {
      await fetch(
        `${API_BASE_URL}/v1/mobile/conversations/${encodeURIComponent(convId)}`,
        { method: 'DELETE', headers: authHeaders() },
      );
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (activeConvId === convId) {
        setActiveConvId(null);
        setMessages([]);
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  /* ---- new chat ---- */
  const startNewChat = () => {
    setActiveConvId(null);
    setMessages([]);
    inputRef.current?.focus();
  };

  /* ---- auto-scroll ---- */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /* ---- send message ---- */
  const sendMessage = async () => {
    const text = input.trim();
    if (!text || streaming) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
    };
    const assistantMsgId = `assistant-${Date.now()}`;

    setMessages((prev) => [...prev, userMsg, { id: assistantMsgId, role: 'assistant', content: '' }]);
    setInput('');
    setStreaming(true);

    try {
      const res = await fetch(`${API_BASE_URL}/v1/mobile/intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          text,
          conversationId: activeConvId || undefined,
          assistantId: assistant.id,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || `Server error (${res.status})`);
      }

      const data = await res.json();
      const reply = data.reply || data.response || data.message || 'No response';

      // Backend creates a new conversation if none existed
      if (data.conversationId && !activeConvId) {
        setActiveConvId(data.conversationId);
      }

      setMessages((prev) =>
        prev.map((m) => (m.id === assistantMsgId ? { ...m, content: reply } : m)),
      );

      // Refresh sidebar
      loadConversations();
    } catch (err) {
      console.error('Chat error:', err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? { ...m, content: err instanceof Error ? err.message : 'Sorry, I encountered an error. Please try again.' }
            : m,
        ),
      );
    } finally {
      setStreaming(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  /* ---- filtered sidebar list ---- */
  const filteredConvs = sidebarSearch
    ? conversations.filter((c) =>
        (c.preview || '').toLowerCase().includes(sidebarSearch.toLowerCase()),
      )
    : conversations;

  /* ================================================================== */
  /*  Render                                                             */
  /* ================================================================== */
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] max-h-[800px] border border-slate-200 flex overflow-hidden">
        {/* ========================================================== */}
        {/*  Sidebar — Conversation History                             */}
        {/* ========================================================== */}
        <div
          className={`${
            sidebarOpen ? 'w-72' : 'w-0'
          } flex-shrink-0 transition-all duration-200 overflow-hidden border-r border-gray-200 bg-gray-50`}
        >
          <div className="flex flex-col h-full w-72">
            {/* Sidebar header */}
            <div className="p-3 border-b border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-gray-900">History</h4>
                <button
                  onClick={startNewChat}
                  className="p-1.5 rounded-lg text-picton-blue hover:bg-picton-blue/10 transition-colors"
                  title="New conversation"
                >
                  <PlusIcon className="w-4 h-4" />
                </button>
              </div>
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search…"
                  value={sidebarSearch}
                  onChange={(e) => setSidebarSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-picton-blue focus:border-transparent bg-white"
                />
              </div>
            </div>

            {/* Conversation list */}
            <div className="flex-1 overflow-y-auto">
              {loadingConvs ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 border-2 border-picton-blue border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filteredConvs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                  <ChatBubbleLeftRightIcon className="w-8 h-8 mb-1.5" />
                  <p className="text-xs">{sidebarSearch ? 'No matches' : 'No conversations yet'}</p>
                </div>
              ) : (
                filteredConvs.map((conv) => {
                  const isActive = conv.id === activeConvId;
                  return (
                    <div
                      key={conv.id}
                      className={`group flex items-start gap-2.5 px-3 py-2.5 cursor-pointer border-b border-gray-100 transition-colors ${
                        isActive
                          ? 'bg-picton-blue/10 border-l-2 border-l-picton-blue'
                          : 'hover:bg-gray-100 border-l-2 border-l-transparent'
                      }`}
                      onClick={() => loadConversation(conv.id)}
                    >
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-picton-blue/10 flex items-center justify-center mt-0.5">
                        <SparklesIcon className="w-3.5 h-3.5 text-picton-blue" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className={`text-xs truncate ${isActive ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                            {conv.preview
                              ? conv.preview.length > 28
                                ? conv.preview.slice(0, 28) + '…'
                                : conv.preview
                              : 'New conversation'}
                          </span>
                          <span className="text-[10px] text-gray-400 flex-shrink-0 ml-1.5">
                            {formatRelativeDate(conv.updated_at)}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteConversation(conv.id);
                        }}
                        className="flex-shrink-0 p-0.5 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                        title="Delete"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ========================================================== */}
        {/*  Main Chat Area                                              */}
        {/* ========================================================== */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title={sidebarOpen ? 'Hide history' : 'Show history'}
            >
              <Bars3Icon className="h-5 w-5" />
            </button>
            <div className="w-9 h-9 rounded-xl bg-picton-blue/10 flex items-center justify-center">
              <SparklesIcon className="h-5 w-5 text-picton-blue" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-gray-900 truncate">{assistant.name}</h3>
              <p className="text-xs text-gray-400">
                AI Assistant{activeConvId ? '' : ' • New Chat'}
              </p>
            </div>
            {activeConvId && (
              <button
                onClick={startNewChat}
                className="p-1.5 text-gray-400 hover:text-picton-blue hover:bg-picton-blue/10 rounded-lg transition-colors"
                title="New conversation"
              >
                <PlusIcon className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {loadingMessages ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-7 h-7 border-2 border-picton-blue border-t-transparent rounded-full animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-12">
                <SparklesIcon className="h-12 w-12 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">Send a message to start chatting with {assistant.name}</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} px-1`}
                >
                  {/* Assistant avatar */}
                  {msg.role === 'assistant' && (
                    <div className="flex-shrink-0 mr-2 mt-5">
                      <div className="w-7 h-7 rounded-full bg-picton-blue/10 flex items-center justify-center">
                        <SparklesIcon className="h-3.5 w-3.5 text-picton-blue" />
                      </div>
                    </div>
                  )}

                  <div className="relative max-w-[75%]">
                    {/* Sender label */}
                    <p
                      className={`text-[11px] font-medium mb-0.5 ${
                        msg.role === 'user' ? 'text-right text-gray-400 mr-1' : 'text-picton-blue ml-1'
                      }`}
                    >
                      {msg.role === 'user' ? 'You' : assistant.name}
                    </p>

                    {/* Bubble */}
                    <div
                      className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                        msg.role === 'user'
                          ? 'bg-picton-blue text-white rounded-br-md'
                          : 'bg-gray-100 text-gray-800 rounded-bl-md'
                      }`}
                    >
                      {msg.content || (
                        <span className="inline-flex gap-1">
                          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </span>
                      )}
                    </div>
                  </div>

                  {/* User avatar */}
                  {msg.role === 'user' && (
                    <div className="flex-shrink-0 ml-2 mt-5">
                      <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center">
                        <UserCircleIcon className="h-4 w-4 text-gray-500" />
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-slate-100 p-4">
            <div className="flex items-end gap-3">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message…"
                rows={1}
                className="flex-1 resize-none px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-picton-blue focus:border-picton-blue transition-all"
                disabled={streaming}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || streaming}
                className="p-2.5 bg-picton-blue text-white rounded-xl hover:bg-picton-blue/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <PaperAirplaneIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
