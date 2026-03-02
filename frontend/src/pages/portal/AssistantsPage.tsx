import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  PlusIcon,
  SparklesIcon,
  TrashIcon,
  PencilSquareIcon,
  ChatBubbleLeftRightIcon,
  CodeBracketIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  XMarkIcon,
  PaperAirplaneIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import api, { API_BASE_URL } from '../../services/api';
import Swal from 'sweetalert2';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface Assistant {
  id: string;
  name: string;
  description: string;
  businessType?: string;
  personality?: string;
  primaryGoal?: string;
  website?: string;
  status?: string;
}

const AssistantsPage: React.FC = () => {
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [loading, setLoading] = useState(true);
  const [embedModal, setEmbedModal] = useState<Assistant | null>(null);
  const [chatModal, setChatModal] = useState<Assistant | null>(null);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  const loadAssistants = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/assistants');
      setAssistants(res.data.assistants || []);
    } catch (err) {
      console.error('Failed to load assistants:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAssistants();
  }, [loadAssistants]);

  // Auto-scroll and focus when chat modal opens
  useEffect(() => {
    if (chatModal) {
      setMessages([]);
      setChatInput('');
      setTimeout(() => chatInputRef.current?.focus(), 100);
    }
  }, [chatModal]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Chat functionality
  const sendMessage = async () => {
    if (!chatInput.trim() || streaming || !chatModal) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: chatInput.trim(),
    };
    const assistantMsgId = `assistant-${Date.now()}`;
    const assistantMsg: ChatMessage = { id: assistantMsgId, role: 'assistant', content: '' };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setChatInput('');
    setStreaming(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/assistants/chat`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assistantId: chatModal.id, message: userMsg.content }),
        }
      );

      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('text/event-stream') || contentType.includes('text/plain')) {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let fullText = '';

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.done) continue;
                  fullText += parsed.token || parsed.content || parsed.text || '';
                } catch {
                  fullText += data;
                }
              } else if (line.trim() && !line.startsWith(':')) {
                fullText += line;
              }
            }
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantMsgId ? { ...m, content: fullText } : m))
            );
          }
        }
      } else {
        const data = await response.json();
        const reply = data.response || data.message || data.content || 'No response';
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMsgId ? { ...m, content: reply } : m))
        );
      }
    } catch (err) {
      console.error('Chat error:', err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? { ...m, content: 'Sorry, I encountered an error. Please try again.' }
            : m
        )
      );
    } finally {
      setStreaming(false);
      chatInputRef.current?.focus();
    }
  };

  const handleChatKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const result = await Swal.fire({
      title: 'Delete Assistant?',
      text: `"${name}" and all its knowledge base data will be permanently deleted.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Delete',
    });
    if (!result.isConfirmed) return;

    try {
      await api.delete(`/assistants/${id}`);
      setAssistants((prev) => prev.filter((a) => a.id !== id));
      Swal.fire({ icon: 'success', title: 'Deleted', timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to delete assistant.' });
    }
  };

  const getEmbedCode = (assistantId: string) => {
    const origin = window.location.origin;
    return `<script src="${origin}/widget.js" data-assistant-id="${assistantId}"></script>`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-32 bg-white rounded-xl border border-slate-200" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Assistants</h1>
          <p className="text-gray-500 text-sm mt-1">
            Create and manage AI chatbots for your websites
          </p>
        </div>
        <Link
          to="/portal/assistants/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-picton-blue text-white text-sm font-semibold rounded-lg hover:bg-picton-blue/90 transition-all shadow-sm"
        >
          <PlusIcon className="h-4 w-4" />
          New Assistant
        </Link>
      </div>

      {/* Empty State */}
      {assistants.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
          <SparklesIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No assistants yet</h3>
          <p className="text-gray-500 mb-6 max-w-sm mx-auto">
            Create your first AI-powered chatbot to help answer questions, capture leads, and support customers on your website.
          </p>
          <Link
            to="/portal/assistants/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-picton-blue text-white font-semibold rounded-lg hover:bg-picton-blue/90 transition-all"
          >
            <PlusIcon className="h-4 w-4" />
            Create Your First Assistant
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {assistants.map((a) => (
            <div
              key={a.id}
              className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg transition-all group"
            >
              {/* Card Header */}
              <div className="p-5 pb-3">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-11 h-11 rounded-xl bg-picton-blue/10 flex items-center justify-center flex-shrink-0">
                    <SparklesIcon className="h-6 w-6 text-picton-blue" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-gray-900 truncate">{a.name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="inline-flex items-center text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                        Active
                      </span>
                      {a.businessType && (
                        <span className="text-xs text-gray-400">{a.businessType}</span>
                      )}
                    </div>
                  </div>
                </div>
                <p className="text-sm text-gray-500 line-clamp-2">{a.description || 'No description'}</p>
              </div>

              {/* Card Actions */}
              <div className="border-t border-slate-100 px-5 py-3 flex items-center gap-2">
                <button
                  onClick={() => setChatModal(a)}
                  className="flex items-center gap-1.5 text-xs font-medium text-picton-blue bg-picton-blue/10 hover:bg-picton-blue/20 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <ChatBubbleLeftRightIcon className="h-3.5 w-3.5" />
                  Chat
                </button>
                <button
                  onClick={() => setEmbedModal(a)}
                  className="flex items-center gap-1.5 text-xs font-medium text-violet-600 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <CodeBracketIcon className="h-3.5 w-3.5" />
                  Embed
                </button>
                <button
                  onClick={() => navigate(`/portal/assistants/${a.id}/edit`)}
                  className="flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <PencilSquareIcon className="h-3.5 w-3.5" />
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(a.id, a.name)}
                  className="ml-auto text-xs font-medium text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Embed Code Modal */}
      {embedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="text-lg font-semibold text-gray-900">Embed {embedModal.name}</h3>
              <button
                onClick={() => { setEmbedModal(null); setCopied(false); }}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-500">
                Paste this snippet into your website's HTML, just before the closing <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">&lt;/body&gt;</code> tag:
              </p>
              <div className="relative">
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs text-gray-700 overflow-x-auto">
                  {getEmbedCode(embedModal.id)}
                </pre>
                <button
                  onClick={() => copyToClipboard(getEmbedCode(embedModal.id))}
                  className="absolute top-2 right-2 p-1.5 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                >
                  {copied ? (
                    <CheckIcon className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <ClipboardDocumentIcon className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
              <div className="bg-picton-blue/5 border border-picton-blue/20 rounded-lg p-3">
                <p className="text-xs text-picton-blue">
                  <strong>Chat URL:</strong>{' '}
                  <a
                    href={`${window.location.origin}/chat/${embedModal.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    {window.location.origin}/chat/{embedModal.id}
                  </a>
                </p>
              </div>
            </div>
            <div className="flex justify-end p-5 border-t border-slate-100">
              <button
                onClick={() => { setEmbedModal(null); setCopied(false); }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Modal */}
      {chatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl h-[80vh] max-h-[700px] border border-slate-200 flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center gap-3 p-4 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-picton-blue/10 flex items-center justify-center">
                <SparklesIcon className="h-5 w-5 text-picton-blue" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-gray-900">{chatModal.name}</h3>
                <p className="text-xs text-gray-400">AI Assistant • Test Chat</p>
              </div>
              <button
                onClick={() => { setChatModal(null); setMessages([]); setChatInput(''); }}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="text-center py-12">
                  <SparklesIcon className="h-12 w-12 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">Send a message to start chatting</p>
                </div>
              )}

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-picton-blue/10 flex items-center justify-center flex-shrink-0">
                      <SparklesIcon className="h-4 w-4 text-picton-blue" />
                    </div>
                  )}
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
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
                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                      <UserCircleIcon className="h-5 w-5 text-gray-500" />
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-slate-100 p-4">
              <div className="flex items-end gap-3">
                <textarea
                  ref={chatInputRef}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={handleChatKeyDown}
                  placeholder="Type your message…"
                  rows={1}
                  className="flex-1 resize-none px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-picton-blue focus:border-picton-blue transition-all"
                  disabled={streaming}
                />
                <button
                  onClick={sendMessage}
                  disabled={!chatInput.trim() || streaming}
                  className="p-2.5 bg-picton-blue text-white rounded-xl hover:bg-picton-blue/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <PaperAirplaneIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssistantsPage;
