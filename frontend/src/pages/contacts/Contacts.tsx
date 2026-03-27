import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  PlusIcon, PencilIcon, TrashIcon, UserIcon, BuildingOfficeIcon, PhoneIcon,
  EnvelopeIcon, ReceiptPercentIcon, EyeIcon, ChatBubbleLeftRightIcon,
  GlobeAltIcon, CheckCircleIcon, SignalIcon, SparklesIcon, PauseCircleIcon,
  NoSymbolIcon, ClockIcon, DocumentTextIcon, ArrowPathIcon,
  RocketLaunchIcon, ExclamationTriangleIcon, ClipboardDocumentIcon,
  XMarkIcon, PaperAirplaneIcon, UserCircleIcon, CodeBracketIcon, CheckIcon,
  DocumentMagnifyingGlassIcon, Cog6ToothIcon, ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { ColumnDef } from '@tanstack/react-table';
import { ContactModel, AdminClientModel, AdminEnterpriseModel, AdminAIOverviewModel } from '../../models';
import { useAppStore } from '../../store';
import { Contact } from '../../types';
import { Input, Select, Textarea, Button, Card, DataTable, BackButton } from '../../components/UI';
import Can from '../../components/Can';
import Swal from 'sweetalert2';
import { API_BASE_URL } from '../../services/api';

type TabKey = 'customers' | 'suppliers' | 'assistants' | 'landing-pages' | 'enterprise-endpoints';

// ── Status Badge ──────────────────────────────────────────────────────────
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, { cls: string; icon: React.ComponentType<{ className?: string }> }> = {
    active:     { cls: 'bg-green-100 text-green-800', icon: CheckCircleIcon },
    deployed:   { cls: 'bg-green-100 text-green-800', icon: RocketLaunchIcon },
    paused:     { cls: 'bg-yellow-100 text-yellow-800', icon: PauseCircleIcon },
    suspended:  { cls: 'bg-red-100 text-red-800', icon: NoSymbolIcon },
    disabled:   { cls: 'bg-red-100 text-red-800', icon: NoSymbolIcon },
    draft:      { cls: 'bg-gray-100 text-gray-600', icon: DocumentTextIcon },
    generating: { cls: 'bg-blue-100 text-blue-800', icon: ArrowPathIcon },
    generated:  { cls: 'bg-indigo-100 text-indigo-800', icon: CheckCircleIcon },
    failed:     { cls: 'bg-red-100 text-red-800', icon: ExclamationTriangleIcon },
  };
  const s = map[status] || { cls: 'bg-gray-100 text-gray-600', icon: ClockIcon };
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>
      <Icon className="w-3 h-3" />{status}
    </span>
  );
};

const Contacts: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { customers, suppliers, setCustomers, setSuppliers, user } = useAppStore();
  
  // Get edit ID from URL query params
  const [searchParams] = React.useState(() => new URLSearchParams(window.location.search));
  const editId = searchParams.get('edit');
  
  const [activeTab, setActiveTab] = useState<TabKey>('customers');
  const [showForm, setShowForm] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 0, limit: 25, total: 0 });
  const [search, setSearch] = useState('');

  // Overview data from admin API
  const [overviewData, setOverviewData] = useState<any>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);

  // Separate totals for each contact tab (from server pagination)
  const [customerTotal, setCustomerTotal] = useState(0);
  const [supplierTotal, setSupplierTotal] = useState(0);

  // Chat modal state
  const [chatModal, setChatModal] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<{ id: string; role: 'user' | 'assistant'; content: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatStreaming, setChatStreaming] = useState(false);
  const chatEndRef = React.useRef<HTMLDivElement>(null);
  const chatInputRef = React.useRef<HTMLTextAreaElement>(null);
  const chatHistoryRef = React.useRef<Record<string, { id: string; role: 'user' | 'assistant'; content: string }[]>>({});

  // Embed modal state
  const [embedModal, setEmbedModal] = useState<any>(null);
  const [embedCopied, setEmbedCopied] = useState(false);

  const [formData, setFormData] = useState<Partial<Contact>>({
    contact_name: '',
    contact_type: 1,
    contact_person: '',
    contact_email: '',
    contact_phone: '',
    contact_alt_phone: '',
    contact_address: '',
    contact_vat: '',
    contact_notes: '',
  });

  // Load contacts when on customer/supplier tabs
  useEffect(() => {
    if (activeTab === 'customers' || activeTab === 'suppliers') {
      loadContacts();
    }
  }, [activeTab, pagination.page, pagination.limit, search]);

  // Update tab counts from overview stats when available
  useEffect(() => {
    if (overviewData?.stats) {
      setCustomerTotal(overviewData.stats.totalClients ?? 0);
      setSupplierTotal(overviewData.stats.totalSuppliers ?? 0);
    }
  }, [overviewData]);

  // Load admin overview data for AI tabs + stats
  useEffect(() => {
    if (user?.is_admin || user?.is_staff) {
      setOverviewLoading(true);
      AdminClientModel.getOverview()
        .then(res => setOverviewData(res))
        .catch(() => {})
        .finally(() => setOverviewLoading(false));
    }
  }, [user]);

  // Chat modal effects
  const prevChatIdRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (chatModal) {
      if (prevChatIdRef.current && prevChatIdRef.current !== chatModal.id) {
        chatHistoryRef.current[prevChatIdRef.current] = chatMessages;
      }
      prevChatIdRef.current = chatModal.id;
      setChatMessages(chatHistoryRef.current[chatModal.id] || []);
      setTimeout(() => chatInputRef.current?.focus(), 100);
    } else if (prevChatIdRef.current) {
      chatHistoryRef.current[prevChatIdRef.current] = chatMessages;
    }
  }, [chatModal]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (chatModal) chatHistoryRef.current[chatModal.id] = chatMessages;
  }, [chatMessages, chatModal]);

  const sendChatMessage = async () => {
    if (!chatInput.trim() || chatStreaming || !chatModal) return;
    const userMsg = { id: `user-${Date.now()}`, role: 'user' as const, content: chatInput.trim() };
    const asstMsgId = `assistant-${Date.now()}`;
    const asstMsg = { id: asstMsgId, role: 'assistant' as const, content: '' };
    setChatMessages(prev => [...prev, userMsg, asstMsg]);
    setChatInput('');
    setChatStreaming(true);
    try {
      const history = chatMessages.filter(m => m.content).map(m => ({ role: m.role, content: m.content }));
      const response = await fetch(`${API_BASE_URL}/assistants/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assistantId: chatModal.id, message: userMsg.content, conversationHistory: history.slice(-10) }),
      });
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
                  if (parsed.error) { fullText += `\n⚠️ ${parsed.error}`; continue; }
                  if (parsed.toolExecuted) { fullText = parsed.replace ?? ''; continue; }
                  if (parsed.toolCall?.message) { fullText = parsed.toolCall.message; continue; }
                  fullText += parsed.token || parsed.content || parsed.text || '';
                } catch { /* skip malformed */ }
              }
            }
            setChatMessages(prev => prev.map(m => m.id === asstMsgId ? { ...m, content: fullText } : m));
          }
        }
      } else {
        const data = await response.json();
        const reply = data.response || data.message || data.content || 'No response';
        setChatMessages(prev => prev.map(m => m.id === asstMsgId ? { ...m, content: reply } : m));
      }
    } catch (err) {
      setChatMessages(prev => prev.map(m => m.id === asstMsgId ? { ...m, content: err instanceof Error ? err.message : 'Sorry, an error occurred.' } : m));
    } finally {
      setChatStreaming(false);
      chatInputRef.current?.focus();
    }
  };

  const handleChatKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }
  };

  const getEmbedCode = (id: string) => `<script src="${window.location.origin}/widget.js" data-assistant-id="${id}"></script>`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setEmbedCopied(true);
    setTimeout(() => setEmbedCopied(false), 2000);
  };

  useEffect(() => {
    // Handle edit from URL parameter
    if (editId) {
      const allContacts = [...customers, ...suppliers];
      const contact = allContacts.find(c => c.contact_id === parseInt(editId));
      if (contact) {
        setEditingContact(contact);
        setFormData(contact);
        setActiveTab(contact.contact_type === 1 ? 'customers' : 'suppliers');
        setShowForm(true);
      }
    } else if (id) {
      // Handle legacy edit from route parameter
      const allContacts = [...customers, ...suppliers];
      const contact = allContacts.find(c => c.contact_id === parseInt(id));
      if (contact) {
        setEditingContact(contact);
        setFormData(contact);
        setActiveTab(contact.contact_type === 1 ? 'customers' : 'suppliers');
        setShowForm(true);
      }
    }
  }, [editId, id, customers, suppliers]);

  const loadContacts = async () => {
    try {
      setLoading(true);
      const data = await ContactModel.getAll(activeTab as 'customers' | 'suppliers', {
        page: pagination.page,
        limit: pagination.limit,
        search: search
      });
      
      if (Array.isArray(data)) {
        if (activeTab === 'customers') {
          setCustomers(data);
        } else {
          setSuppliers(data);
        }
      } else {
        const result = data as any;
        if (activeTab === 'customers') {
          setCustomers(result.data);
          if (result.pagination) setCustomerTotal(result.pagination.total);
        } else {
          setSuppliers(result.data);
          if (result.pagination) setSupplierTotal(result.pagination.total);
        }
        if (result.pagination) {
          setPagination(prev => ({ 
            ...prev, 
            total: result.pagination.total 
          }));
        }
      }
    } catch (error) {
      console.error('Error loading contacts:', error);
      Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to load contacts' });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      contact_name: '',
      contact_type: activeTab === 'customers' ? 1 : 2,
      contact_person: '',
      contact_email: '',
      contact_phone: '',
      contact_alt_phone: '',
      contact_address: '',
      contact_vat: '',
      contact_notes: '',
    });
    setEditingContact(null);
    setShowForm(false);
    if (id) {
      navigate('/contacts');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      
      const selectedContactType = formData.contact_type ?? (activeTab === 'customers' ? 1 : 2);

      if (editingContact) {
        await ContactModel.update(editingContact.contact_id!, {
          ...formData,
          contact_type: selectedContactType
        });
        Swal.fire({ icon: 'success', title: 'Success!', text: 'Contact updated successfully', timer: 2000, showConfirmButton: false });
      } else {
        await ContactModel.create({
          ...formData,
          contact_type: selectedContactType
        });
        Swal.fire({ icon: 'success', title: 'Success!', text: 'Contact created successfully', timer: 2000, showConfirmButton: false });
      }
      
      resetForm();
      loadContacts();
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to save contact' });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (contact: Contact) => {
    setEditingContact(contact);
    setFormData(contact);
    setShowForm(true);
  };

  const handleDelete = async (contactId: number) => {
    if (!window.confirm('Are you sure you want to delete this contact?')) {
      return;
    }

    try {
      setLoading(true);
      await ContactModel.delete(contactId);
      Swal.fire({ icon: 'success', title: 'Success!', text: 'Contact deleted successfully', timer: 2000, showConfirmButton: false });
      loadContacts();
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to delete contact' });
    } finally {
      setLoading(false);
    }
  };

  const currentContacts = activeTab === 'customers' ? customers : suppliers;

  // Table columns configuration
  const columns = useMemo<ColumnDef<Contact>[]>(() => [
    {
      accessorKey: 'contact_name',
      header: 'Name',
      cell: ({ row }) => (
        <div className="flex items-center">
          <div className="flex-shrink-0 h-10 w-10">
            <div className="h-10 w-10 rounded-full bg-picton-blue/10 flex items-center justify-center">
              {row.original.contact_type === 1 ? (
                <UserIcon className="h-5 w-5 text-picton-blue" />
              ) : (
                <BuildingOfficeIcon className="h-5 w-5 text-green-600" />
              )}
            </div>
          </div>
          <div className="ml-4">
            <div className="text-sm font-medium text-gray-900">
              {row.original.contact_name}
            </div>
            {row.original.contact_person && (
              <div className="text-sm text-gray-500">
                {row.original.contact_person}
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'contact_email',
      header: 'Email',
      cell: ({ getValue }) => {
        const email = getValue() as string;
        return email ? (
          <a href={`mailto:${email}`} className="text-picton-blue hover:text-picton-blue/80">
            {email}
          </a>
        ) : (
          <span className="text-gray-400">-</span>
        );
      },
    },
    {
      accessorKey: 'contact_phone',
      header: 'Phone',
      cell: ({ getValue }) => {
        const phone = getValue() as string;
        return phone ? (
          <a href={`tel:${phone}`} className="text-picton-blue hover:text-picton-blue/80">
            {phone}
          </a>
        ) : (
          <span className="text-gray-400">-</span>
        );
      },
    },
    {
      accessorKey: 'contact_vat',
      header: 'VAT Number',
      cell: ({ getValue }) => {
        const vat = getValue() as string;
        return vat || <span className="text-gray-400">-</span>;
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Can permission="contacts.view">
            <button
              onClick={() => navigate(`/contacts/${row.original.contact_id}`)}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-picton-blue hover:bg-picton-blue/90 rounded-lg transition-colors"
            >
              <EyeIcon className="h-3.5 w-3.5 mr-1" />
              View Client
            </button>
          </Can>
          <Can permission="contacts.edit">
            <button
              onClick={() => handleEdit(row.original)}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-picton-blue bg-picton-blue/10 hover:bg-picton-blue/20 rounded-lg transition-colors"
            >
              <PencilIcon className="h-3.5 w-3.5 mr-1" />
              Edit
            </button>
          </Can>
          <Can permission="contacts.delete">
            <button
              onClick={() => handleDelete(row.original.contact_id!)}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-scarlet hover:bg-scarlet/90 rounded-lg transition-colors"
            >
              <TrashIcon className="h-3.5 w-3.5 mr-1" />
              Delete
            </button>
          </Can>
        </div>
      ),
    },
  ], []);

  // ── Enterprise Endpoint helpers ──
  const copyWebhookUrl = (epId: string) => {
    const url = `${window.location.origin}/api/v1/webhook/${epId}`;
    navigator.clipboard.writeText(url);
    Swal.fire({ icon: 'success', title: 'Copied!', text: url, timer: 2000, showConfirmButton: false });
  };

  const handleEndpointStatusToggle = async (ep: any) => {
    const nextStatus = ep.status === 'active' ? 'paused' : 'active';
    const result = await Swal.fire({
      title: `${nextStatus === 'paused' ? 'Pause' : 'Activate'} endpoint?`,
      text: `Client: ${ep.client_name}`, icon: 'question', showCancelButton: true,
      confirmButtonText: nextStatus === 'paused' ? 'Pause' : 'Activate',
      confirmButtonColor: nextStatus === 'paused' ? '#F59E0B' : '#10B981',
    });
    if (!result.isConfirmed) return;
    try {
      await AdminEnterpriseModel.setStatus(ep.id, nextStatus);
      const res = await AdminClientModel.getOverview();
      setOverviewData(res);
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.response?.data?.error || 'Failed' });
    }
  };

  // ── Tab definitions ──
  const tabs: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }>; count: number }[] = [
    { key: 'customers', label: 'Clients', icon: UserIcon, count: customerTotal },
    { key: 'suppliers', label: 'Suppliers', icon: BuildingOfficeIcon, count: supplierTotal },
    { key: 'assistants', label: 'Assistants', icon: ChatBubbleLeftRightIcon, count: overviewData?.stats?.totalAssistants ?? 0 },
    { key: 'landing-pages', label: 'Landing Pages', icon: GlobeAltIcon, count: overviewData?.stats?.totalLandingPages ?? 0 },
    { key: 'enterprise-endpoints', label: 'Enterprise Endpoints', icon: SignalIcon, count: overviewData?.stats?.totalEndpoints ?? 0 },
  ];

  // ── Assistants rich card grid ──
  const renderAssistants = () => {
    const assistants = overviewData?.assistants || [];
    if (overviewLoading) return <div className="flex justify-center py-12"><ArrowPathIcon className="w-8 h-8 text-indigo-500 animate-spin" /></div>;
    if (!assistants.length) return (
      <div className="text-center py-12 text-gray-500">
        <SparklesIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
        <p className="font-medium">No assistants found</p>
      </div>
    );

    // Helper: parse knowledge categories from JSON
    const parseKnowledgeCategories = (raw: any) => {
      try {
        const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (data?.checklist && Array.isArray(data.checklist)) return data.checklist;
      } catch {}
      return [];
    };

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {assistants.map((a: any) => {
          const checklist = parseKnowledgeCategories(a.knowledge_categories);
          const satisfiedCount = checklist.filter((c: any) => c.satisfied).length;
          const healthScore = checklist.length > 0 ? Math.round((satisfiedCount / checklist.length) * 100) : 0;
          const totalSources = a.knowledge_source_count ?? 0;
          const totalChunks = a.knowledge_chunk_count ?? 0;

          return (
          <div key={a.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg transition-all group">
            {/* Card Header */}
            <div className="p-5 pb-3">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-11 h-11 rounded-xl bg-picton-blue/10 flex items-center justify-center flex-shrink-0">
                  <SparklesIcon className="h-6 w-6 text-picton-blue" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-gray-900 truncate">{a.name}</h3>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <StatusBadge status={a.status || 'active'} />
                    {a.tier && <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium">{a.tier}</span>}
                  </div>
                </div>
              </div>
              <p className="text-sm text-gray-500 line-clamp-2 mb-3">{a.description || 'No description'}</p>

              {/* Assistant Info Grid (matches portal) */}
              <div className="bg-white border border-gray-200 rounded-xl p-3 mb-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500 font-medium text-xs">Personality</span>
                    <p className="text-gray-900 mt-0.5 capitalize">{(a.personality || '—').replace('_', ' ')}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 font-medium text-xs">Primary Goal</span>
                    <p className="text-gray-900 mt-0.5 capitalize">{(a.primary_goal || '—').replace('_', ' ')}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 font-medium text-xs">Business Type</span>
                    <p className="text-gray-900 mt-0.5 capitalize">{(a.business_type || '—').replace('_', ' ')}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 font-medium text-xs">Pages Indexed</span>
                    <p className="text-gray-900 mt-0.5">{a.pages_indexed ?? 0}</p>
                  </div>
                </div>
              </div>

              {/* Knowledge Health Score */}
              {checklist.length > 0 && (
                <div className="bg-gradient-to-br from-picton-blue/5 to-picton-blue/10 border border-picton-blue/20 rounded-xl p-3 mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold text-gray-900">Knowledge Health Score</h4>
                    <div className="text-lg font-bold text-picton-blue">{healthScore}%</div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2">
                    <div
                      className="bg-picton-blue h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${healthScore}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-600 mb-2">
                    {satisfiedCount} of {checklist.length} knowledge categories
                  </p>
                  <div className="space-y-1">
                    {checklist.map((item: any, idx: number) => (
                      <div key={item.key || idx} className={`flex items-center gap-2 p-1.5 rounded-md text-xs ${
                        item.satisfied ? 'bg-emerald-50 border border-emerald-200' : 'bg-gray-50 border border-gray-200'
                      }`}>
                        {item.satisfied ? (
                          <CheckCircleIcon className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                        ) : (
                          <div className="h-4 w-4 rounded-full border-2 border-gray-300 flex-shrink-0" />
                        )}
                        <span className="text-gray-700">{item.label || 'Unknown'}</span>
                        <span className="text-gray-400 ml-auto">{item.type === 'url' ? '🔗' : '📄'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Knowledge Base Stats */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="text-center p-2 bg-slate-50 rounded-lg">
                  <p className="text-sm font-bold text-gray-900">{totalSources}</p>
                  <p className="text-xs text-gray-500">Sources</p>
                </div>
                <div className="text-center p-2 bg-slate-50 rounded-lg">
                  <p className="text-sm font-bold text-emerald-600">{a.pages_indexed ?? 0}</p>
                  <p className="text-xs text-gray-500">Pages</p>
                </div>
                <div className="text-center p-2 bg-slate-50 rounded-lg">
                  <p className="text-sm font-bold text-picton-blue">{totalChunks}</p>
                  <p className="text-xs text-gray-500">Chunks</p>
                </div>
              </div>

              {/* Owner & Meta */}
              <div className="space-y-1.5 text-xs text-gray-400">
                <div className="flex items-center gap-1.5">
                  <EnvelopeIcon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{a.owner_email || 'Unknown owner'}</span>
                  {a.owner_account_status && a.owner_account_status !== 'active' && (
                    <span className="ml-auto text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full">{a.owner_account_status}</span>
                  )}
                </div>
                {a.website && (
                  <div className="flex items-center gap-1.5">
                    <GlobeAltIcon className="w-3.5 h-3.5 flex-shrink-0" />
                    <a href={a.website.startsWith('http') ? a.website : `https://${a.website}`} target="_blank" rel="noopener noreferrer" className="truncate text-picton-blue hover:underline">{a.website}</a>
                  </div>
                )}
                {a.lead_capture_email && (
                  <div className="flex items-center gap-1.5">
                    <DocumentMagnifyingGlassIcon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">Leads → {a.lead_capture_email}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <ClockIcon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Created {a.created_at ? new Date(a.created_at).toLocaleDateString() : '—'}</span>
                  {a.updated_at && <span className="ml-1">• Updated {new Date(a.updated_at).toLocaleDateString()}</span>}
                </div>
              </div>
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
                onClick={() => loadAssistantLogs(a.id, a.name)}
                className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
              >
                <ClockIcon className="h-3.5 w-3.5" />
                Logs
              </button>
              <button
                onClick={() => setEmbedModal(a)}
                className="flex items-center gap-1.5 text-xs font-medium text-violet-600 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg transition-colors"
              >
                <CodeBracketIcon className="h-3.5 w-3.5" />
                Embed
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/chat/${a.id}`);
                  Swal.fire({ icon: 'success', title: 'Copied!', text: 'Chat link copied to clipboard', timer: 1500, showConfirmButton: false });
                }}
                className="flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors"
              >
                <ClipboardDocumentIcon className="h-3.5 w-3.5" />
                Link
              </button>
            </div>
          </div>
          );
        })}
      </div>
    );
  };

  // ── Landing Pages rich card grid ──
  const renderLandingPages = () => {
    const pages = overviewData?.landingPages || [];
    if (overviewLoading) return <div className="flex justify-center py-12"><ArrowPathIcon className="w-8 h-8 text-indigo-500 animate-spin" /></div>;
    if (!pages.length) return (
      <div className="text-center py-12 text-gray-500">
        <GlobeAltIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
        <p className="font-medium">No landing pages found</p>
      </div>
    );

    const formatSize = (bytes: number) => {
      if (!bytes) return '0 B';
      if (bytes < 1024) return `${bytes} B`;
      return `${(bytes / 1024).toFixed(1)} KB`;
    };

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {pages.map((lp: any) => (
          <div key={lp.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg transition-all group">
            {/* Hero / Thumbnail */}
            {lp.hero_image_url ? (
              <div className="h-36 bg-gray-100 overflow-hidden relative">
                <img src={lp.hero_image_url} alt={lp.business_name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                <div className="absolute bottom-3 left-3 right-3">
                  <h3 className="text-base font-semibold text-white truncate">{lp.business_name || 'Untitled'}</h3>
                </div>
              </div>
            ) : (
              <div className="h-20 flex items-center justify-center" style={{ backgroundColor: lp.theme_color || '#0044cc' }}>
                <h3 className="text-base font-semibold text-white truncate px-5">{lp.business_name || 'Untitled'}</h3>
              </div>
            )}

            <div className="p-4">
              {/* Status & Badges */}
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <StatusBadge status={lp.status || 'draft'} />
                {lp.theme_color && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                    <span className="w-3 h-3 rounded-full border border-gray-200 flex-shrink-0" style={{ backgroundColor: lp.theme_color }} />
                    {lp.theme_color}
                  </span>
                )}
                {lp.owner_account_status && lp.owner_account_status !== 'active' && (
                  <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full">Owner: {lp.owner_account_status}</span>
                )}
              </div>

              {lp.tagline && <p className="text-sm text-gray-500 line-clamp-2 mb-3">{lp.tagline}</p>}
              {!lp.tagline && lp.about_us && <p className="text-sm text-gray-500 line-clamp-2 mb-3">{lp.about_us}</p>}

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="text-center p-2 bg-slate-50 rounded-lg">
                  <p className="text-sm font-bold text-gray-900">{lp.has_html ? formatSize(lp.html_size) : '—'}</p>
                  <p className="text-xs text-gray-500">HTML Size</p>
                </div>
                <div className="text-center p-2 bg-slate-50 rounded-lg">
                  <p className="text-sm font-bold text-gray-900">{lp.services ? lp.services.split('\n').filter((s: string) => s.trim()).length : 0}</p>
                  <p className="text-xs text-gray-500">Services</p>
                </div>
                <div className="text-center p-2 bg-slate-50 rounded-lg">
                  <p className="text-sm font-bold text-gray-900">{lp.last_deployed_at ? '✓' : '✗'}</p>
                  <p className="text-xs text-gray-500">Deployed</p>
                </div>
              </div>

              {/* Info Grid */}
              <div className="bg-white border border-gray-200 rounded-xl p-3 mb-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {(lp.contact_email || lp.owner_email) && (
                    <div>
                      <span className="text-gray-500 font-medium text-xs">Contact</span>
                      <p className="text-gray-900 mt-0.5 truncate text-xs">{lp.contact_email || lp.owner_email}</p>
                    </div>
                  )}
                  {lp.contact_phone && (
                    <div>
                      <span className="text-gray-500 font-medium text-xs">Phone</span>
                      <p className="text-gray-900 mt-0.5 text-xs">{lp.contact_phone}</p>
                    </div>
                  )}
                  {lp.ftp_server && (
                    <div className="col-span-2">
                      <span className="text-gray-500 font-medium text-xs">Deployment</span>
                      <p className="text-gray-900 mt-0.5 text-xs truncate">
                        {lp.ftp_protocol?.toUpperCase() || 'SFTP'} → {lp.ftp_server}{lp.ftp_directory || ''}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Timestamps */}
              <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
                <ClockIcon className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Created {lp.created_at ? new Date(lp.created_at).toLocaleDateString() : '—'}</span>
                {lp.last_deployed_at && (
                  <span className="ml-1">• Deployed {new Date(lp.last_deployed_at).toLocaleDateString()}</span>
                )}
              </div>
              {lp.owner_email && (
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <UserIcon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{lp.owner_name || lp.owner_email}</span>
                </div>
              )}
            </div>

            {/* Card Actions */}
            <div className="border-t border-slate-100 px-4 py-3 flex items-center gap-2">
              {lp.has_html ? (
                <button
                  onClick={() => {
                    const token = localStorage.getItem('jwt_token') || '';
                    window.open(`${API_BASE_URL}/v1/sites/${lp.id}/preview?token=${encodeURIComponent(token)}`, '_blank');
                  }}
                  className="flex items-center gap-1.5 text-xs font-medium text-picton-blue bg-picton-blue/10 hover:bg-picton-blue/20 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <EyeIcon className="h-3.5 w-3.5" />
                  Preview
                </button>
              ) : (
                <span className="flex items-center gap-1.5 text-xs font-medium text-gray-400 bg-gray-100 px-3 py-1.5 rounded-lg cursor-not-allowed">
                  <EyeIcon className="h-3.5 w-3.5" />
                  No HTML
                </span>
              )}
              {lp.ftp_server && lp.status === 'deployed' && (
                <button
                  onClick={() => {
                    const url = lp.ftp_server.includes('.') ? `https://${lp.ftp_server}` : '';
                    if (url) window.open(url, '_blank');
                  }}
                  className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <RocketLaunchIcon className="h-3.5 w-3.5" />
                  Live Site
                </button>
              )}
              <button
                onClick={() => {
                  navigator.clipboard.writeText(lp.id);
                  Swal.fire({ icon: 'success', title: 'Copied!', text: 'Site ID copied to clipboard', timer: 1500, showConfirmButton: false });
                }}
                className="flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors"
              >
                <ClipboardDocumentIcon className="h-3.5 w-3.5" />
                ID
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ── Assistant Logs ──
  const [assistantLogs, setAssistantLogs] = useState<any[]>([]);
  const [assistantLogsLoading, setAssistantLogsLoading] = useState(false);
  const [assistantLogsId, setAssistantLogsId] = useState<string | null>(null);
  const [assistantLogsName, setAssistantLogsName] = useState('');

  const loadAssistantLogs = async (id: string, name: string) => {
    setAssistantLogsId(id);
    setAssistantLogsName(name);
    setAssistantLogsLoading(true);
    try {
      const result = await AdminAIOverviewModel.getAssistantLogs(id, 50);
      setAssistantLogs(result.data);
    } catch { setAssistantLogs([]); }
    finally { setAssistantLogsLoading(false); }
  };

  // ── Enterprise Endpoints rich card grid ──
  const [expandedEndpoint, setExpandedEndpoint] = useState<string | null>(null);
  const [endpointLogs, setEndpointLogs] = useState<any[]>([]);
  const [endpointLogsLoading, setEndpointLogsLoading] = useState(false);
  const [endpointLogsId, setEndpointLogsId] = useState<string | null>(null);

  // Config modal state
  const [configEndpoint, setConfigEndpoint] = useState<any | null>(null);
  const [configIps, setConfigIps] = useState('');
  const [configSaving, setConfigSaving] = useState(false);

  const loadEndpointLogs = async (id: string) => {
    setEndpointLogsId(id);
    setEndpointLogsLoading(true);
    try {
      const data = await AdminEnterpriseModel.getLogs(id, 20);
      setEndpointLogs(data);
    } catch { setEndpointLogs([]); }
    finally { setEndpointLogsLoading(false); }
  };

  const renderEndpoints = () => {
    const endpoints = overviewData?.enterpriseEndpoints || [];
    if (overviewLoading) return <div className="flex justify-center py-12"><ArrowPathIcon className="w-8 h-8 text-indigo-500 animate-spin" /></div>;
    if (!endpoints.length) return (
      <div className="text-center py-12 text-gray-500">
        <SignalIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
        <p className="font-medium">No enterprise endpoints found</p>
      </div>
    );
    return (
      <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {endpoints.map((ep: any) => (
          <div key={ep.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg transition-all">
            {/* Card Header */}
            <div className="p-5 pb-3">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-11 h-11 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <SignalIcon className="h-6 w-6 text-purple-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-gray-900 truncate">{ep.client_name}</h3>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <StatusBadge status={ep.status || 'active'} />
                    <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-full font-medium capitalize">
                      {(ep.inbound_provider || 'custom_rest').replace('_', ' ')}
                    </span>
                    {ep.allowed_ips && (() => { try { return JSON.parse(ep.allowed_ips).length > 0; } catch { return false; } })() && (
                      <span className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-full font-medium flex items-center gap-0.5">
                        <ShieldCheckIcon className="w-3 h-3" /> IP Restricted
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setConfigEndpoint(ep);
                    try {
                      const ips = ep.allowed_ips ? JSON.parse(ep.allowed_ips) : [];
                      setConfigIps(ips.join('\n'));
                    } catch { setConfigIps(''); }
                  }}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                  title="Endpoint configuration"
                >
                  <Cog6ToothIcon className="w-5 h-5" />
                </button>
              </div>

              {/* LLM Info */}
              <div className="bg-white border border-gray-200 rounded-xl p-3 mb-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500 font-medium text-xs">LLM Routing</span>
                    <p className="text-emerald-700 mt-0.5 text-xs font-medium">GLM → OpenRouter → Ollama</p>
                  </div>
                  <div>
                    <span className="text-gray-500 font-medium text-xs">Fallback Model</span>
                    <p className="text-gray-900 mt-0.5 truncate text-xs">{ep.llm_model || '—'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 font-medium text-xs">Temperature</span>
                    <p className="text-gray-900 mt-0.5">{ep.llm_temperature ?? 0.3}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 font-medium text-xs">Max Tokens</span>
                    <p className="text-gray-900 mt-0.5">{ep.llm_max_tokens ?? 1024}</p>
                  </div>
                </div>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="text-center p-2 bg-slate-50 rounded-lg">
                  <p className="text-sm font-bold text-gray-900">{(ep.total_requests ?? 0).toLocaleString()}</p>
                  <p className="text-xs text-gray-500">Requests</p>
                </div>
                <div className="text-center p-2 bg-slate-50 rounded-lg">
                  <p className="text-sm font-bold text-emerald-600">{ep.target_api_url ? '✓' : '✗'}</p>
                  <p className="text-xs text-gray-500">Target API</p>
                </div>
                <div className="text-center p-2 bg-slate-50 rounded-lg">
                  <p className="text-sm font-bold text-purple-600">{ep.llm_tools_config ? (() => { try { return JSON.parse(ep.llm_tools_config).length; } catch { return 0; } })() : 0}</p>
                  <p className="text-xs text-gray-500">Tools</p>
                </div>
              </div>

              {/* Webhook URL */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 mb-3">
                <p className="text-xs text-emerald-700 font-medium mb-0.5">Webhook URL</p>
                <code className="text-xs text-emerald-800 font-mono block truncate">POST /api/v1/webhook/{ep.id}</code>
              </div>

              {/* Meta */}
              <div className="space-y-1.5 text-xs text-gray-400">
                {ep.target_api_url && (
                  <div className="flex items-center gap-1.5">
                    <GlobeAltIcon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{ep.target_api_url}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <ClockIcon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Created {ep.created_at ? new Date(ep.created_at).toLocaleDateString() : '—'}</span>
                  {ep.last_request_at && <span className="ml-1">• Last active {new Date(ep.last_request_at).toLocaleDateString()}</span>}
                </div>
              </div>
            </div>

            {/* Expandable System Prompt */}
            {expandedEndpoint === ep.id && (
              <div className="px-5 pb-3 border-t border-slate-100 pt-3">
                <div className="grid grid-cols-1 md:grid-cols-1 gap-3">
                  <div>
                    <p className="text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1">
                      <ChatBubbleLeftRightIcon className="w-3.5 h-3.5 text-purple-500" /> System Prompt
                    </p>
                    <pre className="bg-gray-50 border border-gray-200 p-3 rounded-lg max-h-32 overflow-y-auto whitespace-pre-wrap text-xs text-gray-600 font-mono leading-relaxed">
                      {ep.llm_system_prompt || 'No system prompt'}
                    </pre>
                  </div>
                  {ep.target_api_url && (
                    <div className="p-2 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-xs font-semibold text-gray-700 mb-0.5">Target API Auth</p>
                      <p className="text-xs text-gray-600 capitalize">{ep.target_api_auth_type || 'none'}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Card Actions */}
            <div className="border-t border-slate-100 px-5 py-3 flex items-center gap-2">
              <button
                onClick={() => copyWebhookUrl(ep.id)}
                className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors"
              >
                <ClipboardDocumentIcon className="h-3.5 w-3.5" />
                Webhook
              </button>
              <button
                onClick={() => loadEndpointLogs(ep.id)}
                className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
              >
                <ClockIcon className="h-3.5 w-3.5" />
                Logs
              </button>
              <button
                onClick={() => handleEndpointStatusToggle(ep)}
                className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                  ep.status === 'active'
                    ? 'text-amber-600 bg-amber-50 hover:bg-amber-100'
                    : 'text-green-600 bg-green-50 hover:bg-green-100'
                }`}
              >
                {ep.status === 'active' ? <PauseCircleIcon className="h-3.5 w-3.5" /> : <CheckCircleIcon className="h-3.5 w-3.5" />}
                {ep.status === 'active' ? 'Pause' : 'Activate'}
              </button>
              <button
                onClick={() => setExpandedEndpoint(expandedEndpoint === ep.id ? null : ep.id)}
                className="flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors ml-auto"
              >
                <EyeIcon className="h-3.5 w-3.5" />
                {expandedEndpoint === ep.id ? 'Less' : 'More'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Endpoint Logs Modal */}
      {endpointLogsId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <ClockIcon className="w-5 h-5 text-indigo-500" />
                Request Logs
              </h2>
              <button onClick={() => setEndpointLogsId(null)} className="p-1 rounded-lg hover:bg-gray-100">
                <XMarkIcon className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-5">
              {endpointLogsLoading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <ArrowPathIcon className="w-8 h-8 text-emerald-500 animate-spin mb-3" />
                  <p className="text-sm text-gray-500">Loading logs...</p>
                </div>
              ) : endpointLogs.length === 0 ? (
                <div className="text-center py-16">
                  <ClockIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-500">No request logs yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {endpointLogs.map((log: any) => (
                    <div key={log.id} className={`p-4 rounded-xl border text-sm ${
                      log.status === 'error'
                        ? 'border-red-200 bg-red-50'
                        : 'border-gray-200 bg-white'
                    }`}>
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-mono text-xs text-gray-500">{new Date(log.timestamp).toLocaleString()}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-500 font-mono">{log.duration_ms}ms</span>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            log.status === 'success'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {log.status}
                          </span>
                        </div>
                      </div>
                      {log.error_message && <p className="text-sm text-red-600 mb-2 font-medium">Error: {log.error_message}</p>}

                      {/* Inbound Payload */}
                      <div className="mt-2">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Inbound Payload</p>
                        <pre className="p-3 bg-gray-50 rounded-lg text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap max-h-40 overflow-y-auto font-mono border border-gray-200">
                          {(() => { try { return JSON.stringify(JSON.parse(log.inbound_payload || '{}'), null, 2); } catch { return log.inbound_payload || '—'; } })()}
                        </pre>
                      </div>

                      {/* AI Response */}
                      {log.ai_response && (
                        <div className="mt-2">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">AI Response</p>
                          <pre className="p-3 bg-emerald-50 rounded-lg text-xs text-emerald-800 overflow-x-auto whitespace-pre-wrap max-h-40 overflow-y-auto font-mono border border-emerald-200">
                            {(() => { try { return JSON.stringify(JSON.parse(log.ai_response), null, 2); } catch { return log.ai_response; } })()}
                          </pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Endpoint Config Modal */}
      {configEndpoint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Cog6ToothIcon className="w-5 h-5 text-purple-500" />
                Endpoint Configuration
              </h2>
              <button onClick={() => setConfigEndpoint(null)} className="p-1 rounded-lg hover:bg-gray-100">
                <XMarkIcon className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-5 space-y-5">
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <p className="text-sm font-medium text-gray-900">{configEndpoint.client_name}</p>
                <code className="text-xs text-gray-500 font-mono">{configEndpoint.id}</code>
              </div>

              {/* IP Restriction */}
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                  <ShieldCheckIcon className="w-4 h-4 text-blue-500" />
                  Allowed IP Addresses
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  Enter one IP per line. Only these IPs will be allowed to call this webhook. CIDR notation supported (e.g. 10.0.0.0/8). Leave empty to allow all IPs.
                </p>
                <textarea
                  rows={5}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-mono text-gray-800 placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
                  placeholder={"e.g.\n41.185.22.100\n196.207.47.0/24"}
                  value={configIps}
                  onChange={(e) => setConfigIps(e.target.value)}
                />
                {configIps.trim() && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {configIps.trim().split('\n').filter(Boolean).map((ip, i) => (
                      <span key={i} className="inline-flex items-center px-2 py-0.5 text-xs font-mono bg-blue-50 text-blue-700 rounded-full border border-blue-200">
                        {ip.trim()}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setConfigEndpoint(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={configSaving}
                type="button"
                onClick={async () => {
                  setConfigSaving(true);
                  try {
                    const ipList = configIps.trim().split('\n').map(s => s.trim()).filter(Boolean);
                    const allowed_ips = ipList.length > 0 ? JSON.stringify(ipList) : null;
                    if (typeof AdminEnterpriseModel.updateConfig === 'function') {
                      await AdminEnterpriseModel.updateConfig(configEndpoint.id, { allowed_ips });
                    } else {
                      await AdminEnterpriseModel.update(configEndpoint.id, { allowed_ips } as any);
                    }
                    // Refresh overview data to reflect the change
                    const res = await AdminClientModel.getOverview();
                    setOverviewData(res);
                    setConfigEndpoint(null);
                    Swal.fire({ icon: 'success', title: 'Saved', text: ipList.length ? `${ipList.length} IP(s) configured` : 'IP restriction removed', timer: 2000, showConfirmButton: false });
                  } catch (err: any) {
                    console.error('Config save error:', err);
                    Swal.fire({ icon: 'error', title: 'Error', text: err?.response?.data?.error || err?.message || 'Failed to save configuration' });
                  } finally {
                    setConfigSaving(false);
                  }
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {configSaving && <ArrowPathIcon className="w-4 h-4 animate-spin" />}
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}
      </>
    );
  };

  if (showForm) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {editingContact ? 'Edit' : 'Add New'} {activeTab === 'customers' ? 'Client' : 'Supplier'}
            </h1>
            <p className="text-gray-600">
              {editingContact ? 'Update' : 'Create'} client information
            </p>
          </div>
          <BackButton onClick={resetForm} />
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Input
                label="Contact Name"
                type="text"
                required
                value={formData.contact_name || ''}
                onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                placeholder="Enter company or person name"
                startIcon={<BuildingOfficeIcon />}
              />

              <Input
                label="Contact Person"
                type="text"
                value={formData.contact_person || ''}
                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                placeholder="Enter contact person name"
                startIcon={<UserIcon />}
              />

              <Select
                label="Contact Type"
                required
                value={String(formData.contact_type ?? (activeTab === 'customers' ? 1 : 2))}
                onChange={(e) => setFormData({ ...formData, contact_type: parseInt(e.target.value, 10) })}
                helperText="Determines whether this record is treated as a customer or supplier."
              >
                <option value="1">Customer</option>
                <option value="2">Supplier</option>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Email"
                type="email"
                value={formData.contact_email || ''}
                onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                placeholder="Enter email address"
                startIcon={<EnvelopeIcon />}
              />

              <Input
                label="Phone"
                type="tel"
                value={formData.contact_phone}
                onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                placeholder="Enter phone number"
                startIcon={<PhoneIcon />}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Alternative Phone"
                type="tel"
                value={formData.contact_alt_phone}
                onChange={(e) => setFormData({ ...formData, contact_alt_phone: e.target.value })}
                placeholder="Enter alternative phone"
                startIcon={<PhoneIcon />}
                helperText="Alternative contact number"
              />

              <Input
                label="VAT Number"
                type="text"
                value={formData.contact_vat}
                onChange={(e) => setFormData({ ...formData, contact_vat: e.target.value })}
                placeholder="Enter VAT registration number"
                startIcon={<ReceiptPercentIcon />}
                helperText="Tax identification number"
              />
            </div>

            <Textarea
              label="Address"
              value={formData.contact_address}
              onChange={(e) => setFormData({ ...formData, contact_address: e.target.value })}
              placeholder="Enter complete address..."
              rows={3}
              helperText="Complete business or residential address"
            />

            <Textarea
              label="Notes"
              value={formData.contact_notes}
              onChange={(e) => setFormData({ ...formData, contact_notes: e.target.value })}
              placeholder="Additional notes or comments..."
              rows={3}
              helperText="Any additional information about this contact"
            />

          <div className="flex justify-end space-x-4 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={resetForm}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={loading}
              disabled={loading}
            >
              {editingContact ? 'Update Client' : 'Create Client'}
            </Button>
          </div>
        </form>
      </Card>
      </div>
    );
  }

  return (
    <Can 
      permission="contacts.view"
      fallback={
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-md p-8 text-center">
            <svg className="h-12 w-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Access Restricted</h3>
            <p className="text-gray-500">You don't have permission to view clients.</p>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
      {/* Header with gradient background */}
      <div className="bg-gradient-to-r from-picton-blue to-picton-blue/80 rounded-xl shadow-lg p-6 text-white">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Clients</h1>
            <p className="text-white/90">Manage your clients and suppliers</p>
          </div>
          <div className="flex items-center gap-3">
            {(activeTab === 'customers' || activeTab === 'suppliers') && (
              <>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search clients..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-64 pl-10 pr-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50 backdrop-blur-sm"
                  />
                  <svg className="absolute left-3 top-2.5 h-5 w-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <Can permission="contacts.create">
                  <button
                    onClick={() => setShowForm(true)}
                    className="inline-flex items-center px-5 py-2.5 rounded-lg text-sm font-semibold text-picton-blue bg-white hover:bg-gray-50 shadow-md transition-all hover:shadow-lg"
                  >
                    <PlusIcon className="h-5 w-5 mr-2" />
                    Add New Client
                  </button>
                </Can>
              </>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-white/20">
          <nav className="-mb-px flex space-x-6 overflow-x-auto">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              // Only show AI tabs to admin/staff
              if (['assistants', 'landing-pages', 'enterprise-endpoints'].includes(tab.key) && !(user?.is_admin || user?.is_staff)) return null;
              return (
                <button
                  key={tab.key}
                  onClick={() => { setActiveTab(tab.key); setPagination(prev => ({ ...prev, page: 0 })); setSearch(''); }}
                  className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap flex items-center gap-2 ${
                    isActive ? 'border-white text-white' : 'border-transparent text-white/70 hover:text-white hover:border-white/50'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20' : 'bg-white/10'}`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      {(activeTab === 'customers' || activeTab === 'suppliers') && (
        <DataTable
          data={currentContacts}
          columns={columns}
          loading={loading}
          searchable={false}
          emptyMessage={`No ${activeTab === 'customers' ? 'clients' : 'suppliers'} found. Click "Add New Client" to get started.`}
          pageSize={pagination.limit}
          serverSide={true}
          currentPage={pagination.page}
          totalItems={pagination.total}
          onPageChange={(page: number) => setPagination(prev => ({ ...prev, page }))}
          onPageSizeChange={(size: number) => setPagination(prev => ({ ...prev, limit: size, page: 0 }))}
          onSearch={(query: string) => {
            setSearch(query);
            setPagination(prev => ({ ...prev, page: 0 }));
          }}
        />
      )}

      {activeTab === 'assistants' && renderAssistants()}

      {activeTab === 'landing-pages' && (
        <Card>{renderLandingPages()}</Card>
      )}

      {activeTab === 'enterprise-endpoints' && (
        <Card>{renderEndpoints()}</Card>
      )}

      {/* ── Assistant Logs Modal ── */}
      {assistantLogsId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <ClockIcon className="w-5 h-5 text-indigo-500" />
                Chat Logs — {assistantLogsName}
              </h2>
              <button onClick={() => setAssistantLogsId(null)} className="p-1 rounded-lg hover:bg-gray-100">
                <XMarkIcon className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-5">
              {assistantLogsLoading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <ArrowPathIcon className="w-8 h-8 text-emerald-500 animate-spin mb-3" />
                  <p className="text-sm text-gray-500">Loading logs...</p>
                </div>
              ) : assistantLogs.length === 0 ? (
                <div className="text-center py-16">
                  <ClockIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-500">No chat logs yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {assistantLogs.map((log: any) => (
                    <div key={log.id} className="p-4 rounded-xl border border-gray-200 bg-white text-sm">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-mono text-xs text-gray-500">{new Date(log.created_at).toLocaleString()}</span>
                        <div className="flex items-center gap-3">
                          {log.duration_ms && <span className="text-xs text-gray-500 font-mono">{log.duration_ms}ms</span>}
                          {log.provider && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">{log.provider}</span>
                          )}
                          {log.model && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{log.model}</span>
                          )}
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            log.source === 'widget' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                          }`}>{log.source}</span>
                        </div>
                      </div>

                      {/* User Prompt */}
                      <div className="mb-2">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">User Prompt</p>
                        <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-800 whitespace-pre-wrap max-h-32 overflow-y-auto border border-gray-200">
                          {log.sanitized_prompt || '—'}
                        </div>
                      </div>

                      {/* AI Response */}
                      {log.sanitized_response && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">AI Response</p>
                          <div className="p-3 bg-emerald-50 rounded-lg text-sm text-emerald-900 whitespace-pre-wrap max-h-40 overflow-y-auto border border-emerald-200">
                            {log.sanitized_response}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Chat Modal ── */}
      {chatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl h-[80vh] max-h-[700px] border border-slate-200 flex flex-col">
            <div className="flex items-center gap-3 p-4 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-picton-blue/10 flex items-center justify-center">
                <SparklesIcon className="h-5 w-5 text-picton-blue" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-gray-900">{chatModal.name}</h3>
                <p className="text-xs text-gray-400">AI Assistant • Test Chat{chatModal.owner_email ? ` • ${chatModal.owner_email}` : ''}</p>
              </div>
              {chatMessages.length > 0 && (
                <button
                  onClick={() => { setChatMessages([]); setChatInput(''); if (chatModal) chatHistoryRef.current[chatModal.id] = []; }}
                  title="New Chat"
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              )}
              <button onClick={() => setChatModal(null)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatMessages.length === 0 && (
                <div className="text-center py-12">
                  <SparklesIcon className="h-12 w-12 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">Send a message to start chatting</p>
                </div>
              )}
              {chatMessages.map(msg => (
                <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-picton-blue/10 flex items-center justify-center flex-shrink-0">
                      <SparklesIcon className="h-4 w-4 text-picton-blue" />
                    </div>
                  )}
                  <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === 'user' ? 'bg-picton-blue text-white rounded-br-md' : 'bg-gray-100 text-gray-800 rounded-bl-md'
                  }`}>
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
              <div ref={chatEndRef} />
            </div>
            <div className="border-t border-slate-100 p-4">
              <div className="flex items-end gap-3">
                <textarea
                  ref={chatInputRef}
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={handleChatKeyDown}
                  placeholder="Type your message…"
                  rows={1}
                  className="flex-1 resize-none px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-picton-blue focus:border-picton-blue transition-all"
                  disabled={chatStreaming}
                />
                <button
                  onClick={sendChatMessage}
                  disabled={!chatInput.trim() || chatStreaming}
                  className="p-2.5 bg-picton-blue text-white rounded-xl hover:bg-picton-blue/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <PaperAirplaneIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Embed Code Modal ── */}
      {embedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="text-lg font-semibold text-gray-900">Embed {embedModal.name}</h3>
              <button onClick={() => { setEmbedModal(null); setEmbedCopied(false); }} className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
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
                  {embedCopied ? <CheckIcon className="h-4 w-4 text-emerald-500" /> : <ClipboardDocumentIcon className="h-4 w-4 text-gray-400" />}
                </button>
              </div>
              <div className="bg-picton-blue/5 border border-picton-blue/20 rounded-lg p-3">
                <p className="text-xs text-picton-blue">
                  <strong>Chat URL:</strong>{' '}
                  <a href={`${window.location.origin}/chat/${embedModal.id}`} target="_blank" rel="noopener noreferrer" className="underline">
                    {window.location.origin}/chat/{embedModal.id}
                  </a>
                </p>
              </div>
            </div>
            <div className="flex justify-end p-5 border-t border-slate-100">
              <button onClick={() => { setEmbedModal(null); setEmbedCopied(false); }} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </Can>
  );
};

export default Contacts;