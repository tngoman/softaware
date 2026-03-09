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
  LightBulbIcon,
  GlobeAltIcon,
  UserGroupIcon,
  DocumentMagnifyingGlassIcon,
  EnvelopeIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  RocketLaunchIcon,
  ArrowPathIcon,
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

  // Chat state — persisted per assistant until user clears
  const chatHistoryRef = useRef<Record<string, ChatMessage[]>>({});
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const [showCapabilities, setShowCapabilities] = useState(false);

  const CAPABILITIES = [
    { icon: ChatBubbleLeftRightIcon, title: 'AI-Powered Chat', desc: 'Your assistant answers visitor questions 24/7 using your knowledge base content.', color: 'text-blue-600 bg-blue-50' },
    { icon: UserGroupIcon, title: 'Lead Capture', desc: 'Automatically captures visitor details and sends lead notifications to your email.', color: 'text-emerald-600 bg-emerald-50' },
    { icon: GlobeAltIcon, title: 'Website Embed', desc: 'Add a chat widget to any website with a single line of code — or share a direct chat link.', color: 'text-violet-600 bg-violet-50' },
    { icon: DocumentMagnifyingGlassIcon, title: 'Knowledge Base', desc: 'Train your assistant with URLs, documents, or pasted text so it speaks your business language.', color: 'text-amber-600 bg-amber-50' },
    { icon: EnvelopeIcon, title: 'Email Notifications', desc: 'Get email alerts when visitors chat, submit forms, or become new leads.', color: 'text-pink-600 bg-pink-50' },
    { icon: RocketLaunchIcon, title: 'Site Builder', desc: 'Build a landing page with your assistant embedded — manage content and deploy from your dashboard.', color: 'text-indigo-600 bg-indigo-50' },
  ];

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

  // Restore saved messages when opening a chat modal (or start empty)
  const prevChatModalId = useRef<string | null>(null);
  useEffect(() => {
    if (chatModal) {
      // Save previous assistant's messages before switching
      if (prevChatModalId.current && prevChatModalId.current !== chatModal.id) {
        chatHistoryRef.current[prevChatModalId.current] = messages;
      }
      prevChatModalId.current = chatModal.id;
      // Restore this assistant's history or start fresh
      setMessages(chatHistoryRef.current[chatModal.id] || []);
      setTimeout(() => chatInputRef.current?.focus(), 100);
    } else if (prevChatModalId.current) {
      // Modal closing — save current messages
      chatHistoryRef.current[prevChatModalId.current] = messages;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatModal]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    // Keep per-assistant history in sync
    if (chatModal) chatHistoryRef.current[chatModal.id] = messages;
  }, [messages, chatModal]);

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
      // Build conversation history from previous messages for context
      const history = messages
        .filter(m => m.content)
        .map(m => ({ role: m.role, content: m.content }));

      const response = await fetch(
        `${API_BASE_URL}/assistants/chat`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assistantId: chatModal.id,
            message: userMsg.content,
            conversationHistory: history.slice(-10),
          }),
        }
      );

      // Handle HTTP errors before attempting to stream
      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || `Server error (${response.status})`);
      }

      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('text/event-stream') || contentType.includes('text/plain')) {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let fullText = '';
        let lineBuffer = '';

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            lineBuffer += decoder.decode(value, { stream: true });
            const lines = lineBuffer.split('\n');
            lineBuffer = lines.pop() ?? '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.done) continue;
                  if (parsed.error) {
                    fullText += `\n⚠️ ${parsed.error}`;
                    continue;
                  }
                  fullText += parsed.token || parsed.content || parsed.text || '';
                } catch {
                  // Skip malformed JSON fragments
                }
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
            ? { ...m, content: err instanceof Error ? err.message : 'Sorry, I encountered an error. Please try again.' }
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCapabilities(!showCapabilities)}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-picton-blue bg-picton-blue/10 rounded-lg hover:bg-picton-blue/20 transition-all"
          >
            <LightBulbIcon className="h-4 w-4" />
            What Can My Assistant Do?
            {showCapabilities ? <ChevronUpIcon className="h-3.5 w-3.5" /> : <ChevronDownIcon className="h-3.5 w-3.5" />}
          </button>
          <Link
            to="/portal/assistants/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-picton-blue text-white text-sm font-semibold rounded-lg hover:bg-picton-blue/90 transition-all shadow-sm"
          >
            <PlusIcon className="h-4 w-4" />
            New Assistant
          </Link>
        </div>
      </div>

      {/* Capabilities Helper Panel */}
      {showCapabilities && (
        <div className="bg-gradient-to-br from-picton-blue/5 via-white to-violet-50 rounded-xl border border-picton-blue/20 p-6 animate-in fade-in duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-picton-blue/10 flex items-center justify-center">
                <SparklesIcon className="h-4.5 w-4.5 text-picton-blue" />
              </div>
              <h3 className="text-base font-semibold text-gray-900">What Your Assistant Can Do</h3>
            </div>
            <button onClick={() => setShowCapabilities(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {CAPABILITIES.map((cap) => (
              <div key={cap.title} className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-100 hover:shadow-sm transition-all">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${cap.color}`}>
                  <cap.icon className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{cap.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{cap.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
            <LightBulbIcon className="h-4 w-4 text-amber-600 flex-shrink-0" />
            <p className="text-xs text-amber-800">
              <strong>Pro tip:</strong> Add more knowledge sources (URLs, documents, text) to make your assistant smarter. The more it knows about your business, the better it helps your visitors.
            </p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {assistants.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-12 text-center">
            <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-picton-blue/10 to-violet-100 flex items-center justify-center mb-5">
              <SparklesIcon className="h-10 w-10 text-picton-blue" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Create Your First AI Assistant</h3>
            <p className="text-gray-500 mb-8 max-w-md mx-auto">
              Set up an AI-powered chatbot in minutes. It will answer visitor questions, capture leads, and support your customers 24/7.
            </p>
            <Link
              to="/portal/assistants/new"
              className="inline-flex items-center gap-2 px-6 py-3 bg-picton-blue text-white font-semibold rounded-lg hover:bg-picton-blue/90 transition-all shadow-sm"
            >
              <PlusIcon className="h-4 w-4" />
              Get Started
            </Link>
          </div>
          {/* Quick overview */}
          <div className="border-t border-slate-100 bg-slate-50/50 px-8 py-6">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">How it works</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { step: '1', title: 'Describe Your Business', desc: 'Tell us your business type and set a personality style.' },
                { step: '2', title: 'Add Knowledge', desc: 'Upload docs, paste text, or share website URLs to train your assistant.' },
                { step: '3', title: 'Embed & Go Live', desc: 'Copy one line of code to your website or share a direct chat link.' },
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-picton-blue text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {item.step}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
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
              {messages.length > 0 && (
                <button
                  onClick={() => { setMessages([]); setChatInput(''); if (chatModal) chatHistoryRef.current[chatModal.id] = []; }}
                  title="New Chat"
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => setChatModal(null)}
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
