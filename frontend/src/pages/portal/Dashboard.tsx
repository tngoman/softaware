import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  SparklesIcon,
  GlobeAltIcon,
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  PlusIcon,
  ArrowTrendingUpIcon,
  BoltIcon,
  RocketLaunchIcon,
  XMarkIcon,
  PaperAirplaneIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import api, { API_BASE_URL } from '../../services/api';
import KnowledgeHealthScore from '../../components/KnowledgeHealthScore';

interface DashboardMetrics {
  messages: { used: number; limit: number };
  pagesIndexed: { used: number; limit: number };
  assistants: { count: number; limit: number };
  tier: string;
}

interface AssistantSummary {
  id: string;
  name: string;
  description: string;
  status?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const PortalDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [assistants, setAssistants] = useState<AssistantSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Chat modal state
  const [chatModal, setChatModal] = useState<AssistantSummary | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  // Chat modal effects
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

  const loadData = async () => {
    setLoading(true);
    try {
      const [metricsRes, assistantsRes] = await Promise.all([
        api.get('/dashboard/metrics'),
        api.get('/assistants'),
      ]);
      setMetrics(metricsRes.data);
      setAssistants(assistantsRes.data.assistants || []);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const usagePercent = (used: number, limit: number) =>
    limit > 0 ? Math.min(Math.round((used / limit) * 100), 100) : 0;

  const barColor = (pct: number) =>
    pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-picton-blue';

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-white rounded-xl border border-slate-200" />
          ))}
        </div>
        <div className="h-48 bg-white rounded-xl border border-slate-200" />
      </div>
    );
  }

  const tier = metrics?.tier || 'free';
  const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);

  return (
    <div className="space-y-8">
      {/* Tier + Usage Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome to your portal</h1>
          <p className="text-gray-500 text-sm mt-1">
            You're on the <span className="font-semibold text-picton-blue">{tierLabel}</span> plan
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

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Assistants */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">AI Assistants</span>
            <SparklesIcon className="h-5 w-5 text-picton-blue" />
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {metrics?.assistants.count ?? 0}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            of {metrics?.assistants.limit ?? 5} allowed
          </p>
        </div>

        {/* Messages */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">Messages</span>
            <ChatBubbleLeftRightIcon className="h-5 w-5 text-emerald-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{metrics?.messages.used ?? 0}</p>
          <div className="mt-2">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>{metrics?.messages.used ?? 0} / {metrics?.messages.limit ?? 500}</span>
              <span>{usagePercent(metrics?.messages.used ?? 0, metrics?.messages.limit ?? 500)}%</span>
            </div>
            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${barColor(usagePercent(metrics?.messages.used ?? 0, metrics?.messages.limit ?? 500))}`}
                style={{ width: `${usagePercent(metrics?.messages.used ?? 0, metrics?.messages.limit ?? 500)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Pages Indexed */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">Pages Indexed</span>
            <DocumentTextIcon className="h-5 w-5 text-violet-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{metrics?.pagesIndexed.used ?? 0}</p>
          <div className="mt-2">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>{metrics?.pagesIndexed.used ?? 0} / {metrics?.pagesIndexed.limit ?? 50}</span>
              <span>{usagePercent(metrics?.pagesIndexed.used ?? 0, metrics?.pagesIndexed.limit ?? 50)}%</span>
            </div>
            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${barColor(usagePercent(metrics?.pagesIndexed.used ?? 0, metrics?.pagesIndexed.limit ?? 50))}`}
                style={{ width: `${usagePercent(metrics?.pagesIndexed.used ?? 0, metrics?.pagesIndexed.limit ?? 50)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Plan */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-500">Current Plan</span>
            <BoltIcon className="h-5 w-5 text-amber-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{tierLabel}</p>
          <Link
            to="/portal/settings"
            className="text-xs text-picton-blue hover:text-picton-blue/80 font-medium mt-1 inline-block transition-colors"
          >
            Manage plan →
          </Link>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            to="/portal/assistants/new"
            className="group bg-white rounded-xl border-2 border-dashed border-slate-200 hover:border-picton-blue/40 p-6 text-center transition-all hover:shadow-md"
          >
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-picton-blue/10 flex items-center justify-center group-hover:bg-picton-blue/20 transition-colors">
              <SparklesIcon className="h-6 w-6 text-picton-blue" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900">New AI Assistant</h3>
            <p className="text-xs text-gray-500 mt-1">
              Create a custom chatbot for your business
            </p>
          </Link>

          <Link
            to="/portal/sites"
            className="group bg-white rounded-xl border-2 border-dashed border-slate-200 hover:border-emerald-400/40 p-6 text-center transition-all hover:shadow-md"
          >
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
              <GlobeAltIcon className="h-6 w-6 text-emerald-600" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900">Create Landing Page</h3>
            <p className="text-xs text-gray-500 mt-1">
              Build and deploy a website in minutes
            </p>
          </Link>

          <Link
            to="/portal/assistants"
            className="group bg-white rounded-xl border-2 border-dashed border-slate-200 hover:border-violet-400/40 p-6 text-center transition-all hover:shadow-md"
          >
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-violet-50 flex items-center justify-center group-hover:bg-violet-100 transition-colors">
              <RocketLaunchIcon className="h-6 w-6 text-violet-600" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900">Train Knowledge Base</h3>
            <p className="text-xs text-gray-500 mt-1">
              Feed your assistant with website data
            </p>
          </Link>
        </div>
      </div>

      {/* Active Assistants */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Your Assistants</h2>
          {assistants.length > 0 && (
            <Link
              to="/portal/assistants"
              className="text-sm text-picton-blue hover:text-picton-blue/80 font-medium transition-colors"
            >
              View all →
            </Link>
          )}
        </div>

        {assistants.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
            <SparklesIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-1">No assistants yet</h3>
            <p className="text-sm text-gray-500 mb-4">
              Create your first AI assistant to start engaging visitors on your website.
            </p>
            <Link
              to="/portal/assistants/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-picton-blue text-white text-sm font-semibold rounded-lg hover:bg-picton-blue/90 transition-all"
            >
              <PlusIcon className="h-4 w-4" />
              Create Assistant
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {assistants.slice(0, 6).map((a) => (
              <div
                key={a.id}
                className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-picton-blue/10 flex items-center justify-center">
                      <SparklesIcon className="h-5 w-5 text-picton-blue" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900">{a.name}</h4>
                      <span className="inline-flex items-center text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                        Active
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-500 line-clamp-2 mb-4">
                  {a.description || 'No description'}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setChatModal(a)}
                    className="flex-1 text-center text-xs font-medium text-picton-blue bg-picton-blue/10 hover:bg-picton-blue/20 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Test Chat
                  </button>
                  <Link
                    to={`/portal/assistants/${a.id}/edit`}
                    className="flex-1 text-center text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Edit
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Knowledge Health Score - shows for first assistant */}
      {assistants.length > 0 && (
        <KnowledgeHealthScore 
          assistantId={assistants[0].id} 
          tier={metrics?.tier || 'free'}
        />
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

export default PortalDashboard;
