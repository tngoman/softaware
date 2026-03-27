import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowDownTrayIcon, 
  PencilIcon, 
  DocumentTextIcon,
  DocumentDuplicateIcon,
  UserIcon,
  BuildingOfficeIcon,
  EnvelopeIcon,
  PhoneIcon,
  MapPinIcon,
  ReceiptPercentIcon,
  BanknotesIcon,
  ClockIcon,
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  GlobeAltIcon,
  CheckCircleIcon,
  NoSymbolIcon,
  ExclamationTriangleIcon,
  ArrowRightOnRectangleIcon,
  SparklesIcon,
  RocketLaunchIcon,
  PauseCircleIcon,
  ClipboardDocumentIcon,
  XMarkIcon,
  PaperAirplaneIcon,
  UserCircleIcon,
  CodeBracketIcon,
  CheckIcon,
  TrashIcon,
  EyeIcon,
  DocumentMagnifyingGlassIcon,
  ShieldCheckIcon,
  DocumentChartBarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { ContactModel, InvoiceModel, QuotationModel } from '../../models';
import { AdminClientModel } from '../../models';
import { AuthModel } from '../../models';
import { useAppStore } from '../../store';
import { Contact, Invoice, Quotation } from '../../types';
import { BackButton, Card, DataTable } from '../../components/UI';
import { PaymentStatusBadge } from '../../components/Invoices';
import { QuotationStatusBadge } from '../../components/Quotations';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { API_BASE_URL } from '../../services/api';
import Swal from 'sweetalert2';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Transaction {
  type: 'invoice' | 'payment';
  date: string;
  due_date?: string;
  description: string;
  invoice_id?: number;
  amount: number;
  balance: number;
  payment_status?: number;
  days_overdue?: number;
}

interface StatementData {
  contact: Contact;
  transactions: Transaction[];
  closing_balance: number;
  aging: {
    current: number;
    '30_days': number;
    '60_days': number;
    '90_days': number;
    total: number;
  };
}

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, { cls: string; icon: React.ComponentType<{ className?: string }> }> = {
    active: { cls: 'bg-green-100 text-green-800', icon: CheckCircleIcon },
    suspended: { cls: 'bg-red-100 text-red-800', icon: NoSymbolIcon },
    demo_expired: { cls: 'bg-amber-100 text-amber-800', icon: ExclamationTriangleIcon },
  };
  const s = map[status] || map['active'];
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>
      <Icon className="w-3 h-3" />{status}
    </span>
  );
};

const ContactDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, setUser, setIsAuthenticated } = useAppStore();
  
  const [contact, setContact] = useState<Contact | null>(null);
  const [statementData, setStatementData] = useState<StatementData | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'invoices' | 'quotations' | 'statement' | 'assistants' | 'landing-pages' | 'documentation' | 'expenses'>('overview');
  
  // AI/Client Manager state
  const [clientDetail, setClientDetail] = useState<any>(null);
  const [linkedUserId, setLinkedUserId] = useState<string | null>(null);

  // Chat modal state
  const [chatModal, setChatModal] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<{ id: string; role: 'user' | 'assistant'; content: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatStreaming, setChatStreaming] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const chatHistoryRef = useRef<Record<string, { id: string; role: 'user' | 'assistant'; content: string }[]>>({});
  const prevChatIdRef = useRef<string | null>(null);

  // Embed modal state
  const [embedModal, setEmbedModal] = useState<any>(null);
  const [embedCopied, setEmbedCopied] = useState(false);

  // Chat history / analytics log state (developer only)
  const [chatLogModal, setChatLogModal] = useState<{ assistantId: string; assistantName: string } | null>(null);
  const [chatLogs, setChatLogs] = useState<any[]>([]);
  const [chatLogsPagination, setChatLogsPagination] = useState<{ total: number; limit: number; offset: number; hasMore: boolean } | null>(null);
  const [chatLogsLoading, setChatLogsLoading] = useState(false);

  // Documentation tab state
  const [docContent, setDocContent] = useState<string | null>(null);
  const [docLoading, setDocLoading] = useState(false);
  const [docFiles, setDocFiles] = useState<Array<{ filename: string; size: number; modified: string }>>([]);
  const [docActiveFile, setDocActiveFile] = useState('Api.md');
  const [docAvailable, setDocAvailable] = useState(false);

  // Supplier expense state
  const [supplierExpenses, setSupplierExpenses] = useState<any[]>([]);
  const [supplierExpenseSummary, setSupplierExpenseSummary] = useState<{ total_expenses: number; total_vat: number; total_exclusive: number; count: number }>({ total_expenses: 0, total_vat: 0, total_exclusive: 0, count: 0 });

  // Developer role check
  const hasDeveloperAccess = useCallback(() => {
    if (!user) return false;
    return !!(user.is_admin || (user as any).role?.slug === 'developer' || (user as any).roles?.some((r: any) => r.slug === 'developer'));
  }, [user]);

  const isCustomer = contact?.contact_type === 1;
  const isSupplier = contact?.contact_type === 2;
  const contactTypeLabel = isCustomer ? 'Customer' : 'Supplier';

  useEffect(() => {
    if (id) {
      loadContactData();
    }
  }, [id]);

  const loadContactData = async () => {
    try {
      setLoading(true);
      
      // Load contact details
      const contactData = await ContactModel.getById(parseInt(id!));
      setContact(contactData);

      // Check for linked user IDs (returned from backend)
      if (contactData.linked_user_ids) {
        const userIds = contactData.linked_user_ids.split(',');
        if (userIds.length > 0) {
          setLinkedUserId(userIds[0]);
          // Load client detail from admin client manager
          try {
            const detail = await AdminClientModel.getClient(userIds[0]);
            setClientDetail(detail);
          } catch (err) {
            console.log('No AI client detail available for this contact');
          }
        }
      }

      // Check for documentation files
      try {
        const docList = await AdminClientModel.getDocumentationList(id!);
        if (docList.files && docList.files.length > 0) {
          setDocFiles(docList.files);
          setDocAvailable(true);
        }
      } catch (err) {
        // No documentation folder — that's fine
      }

      // Load invoices if customer
      if (contactData.contact_type === 1) {
        loadInvoices(parseInt(id!));
        loadQuotations(parseInt(id!));
        loadStatementData(parseInt(id!));
      }

      // Load expenses if supplier
      if (contactData.contact_type === 2) {
        loadSupplierExpenses(parseInt(id!));
      }
    } catch (error) {
      console.error('Error loading contact:', error);
      Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to load client details' });
      navigate('/contacts');
    } finally {
      setLoading(false);
    }
  };

  const loadChatLogs = async (userId: string, offset = 0) => {
    try {
      setChatLogsLoading(true);
      const result = await AdminClientModel.getChatLogs(userId, { limit: 20, offset });
      setChatLogs(result.data);
      setChatLogsPagination(result.pagination);
    } catch (error) {
      console.error('Error loading chat logs:', error);
      Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to load chat history' });
    } finally {
      setChatLogsLoading(false);
    }
  };

  const openChatLogModal = (assistantId: string, assistantName: string) => {
    if (!linkedUserId) return;
    setChatLogModal({ assistantId, assistantName });
    setChatLogs([]);
    setChatLogsPagination(null);
    loadChatLogs(linkedUserId, 0);
  };

  const loadDocumentation = useCallback(async (filename = 'Api.md') => {
    if (!id) return;
    try {
      setDocLoading(true);
      setDocActiveFile(filename);
      const result = await AdminClientModel.getDocumentation(id, filename);
      setDocContent(result.content);
    } catch (error) {
      console.error('Error loading documentation:', error);
      setDocContent(null);
    } finally {
      setDocLoading(false);
    }
  }, [id]);

  // Load documentation content when the tab is activated
  useEffect(() => {
    if (activeTab === 'documentation' && docContent === null && !docLoading && docAvailable) {
      loadDocumentation(docActiveFile);
    }
  }, [activeTab, docContent, docLoading, docAvailable, docActiveFile, loadDocumentation]);

  const loadInvoices = async (contactId: number) => {
    try {
      const data = await InvoiceModel.getAll({ limit: 100 });
      const contactInvoices = Array.isArray(data) 
        ? data.filter((inv: Invoice) => inv.invoice_contact_id === contactId)
        : data.data.filter((inv: Invoice) => inv.invoice_contact_id === contactId);
      setInvoices(contactInvoices);
    } catch (error) {
      console.error('Error loading invoices:', error);
    }
  };

  const loadQuotations = async (contactId: number) => {
    try {
      const data = await QuotationModel.getAll({ limit: 100 });
      const contactQuotations = Array.isArray(data)
        ? data.filter((quo: Quotation) => quo.quotation_contact_id === contactId)
        : data.data.filter((quo: Quotation) => quo.quotation_contact_id === contactId);
      setQuotations(contactQuotations);
    } catch (error) {
      console.error('Error loading quotations:', error);
    }
  };

  const loadStatementData = async (contactId: number) => {
    try {
      const data = await ContactModel.getStatementData(contactId);
      setStatementData(data);
    } catch (error) {
      console.error('Error loading statement:', error);
    }
  };

  const loadSupplierExpenses = async (contactId: number) => {
    try {
      const result = await ContactModel.getExpenses(contactId);
      setSupplierExpenses(result.data || []);
      if (result.summary) {
        setSupplierExpenseSummary(result.summary);
      }
    } catch (error) {
      console.error('Error loading supplier expenses:', error);
    }
  };

  const handleEdit = () => {
    navigate(`/contacts?edit=${id}`);
  };

  // ── AI / Client Manager actions ────────────────────────────────────────
  const handleAssistantStatus = async (assistantId: string, newStatus: string) => {
    try {
      await AdminClientModel.setAssistantStatus(assistantId, newStatus);
      Swal.fire({ icon: 'success', title: 'Updated', timer: 1200, showConfirmButton: false });
      if (linkedUserId) {
        const detail = await AdminClientModel.getClient(linkedUserId);
        setClientDetail(detail);
      }
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.response?.data?.error || 'Failed' });
    }
  };

  const handleMasquerade = async () => {
    if (!linkedUserId || !clientDetail?.user) return;
    const result = await Swal.fire({
      title: 'Login as User?',
      html: `You will be logged in as <strong>${clientDetail.user.email}</strong>.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#7C3AED',
      confirmButtonText: 'Login as User',
    });
    if (!result.isConfirmed) return;
    try {
      const response = await AdminClientModel.masquerade(linkedUserId);
      if (response.success && response.data) {
        const { token, user: masqUser, adminRestoreToken, adminId } = response.data;
        AuthModel.startMasquerade(token, masqUser, adminRestoreToken, adminId);
        try {
          const permissions = await AuthModel.getUserPermissions();
          masqUser.permissions = permissions;
          AuthModel.storeAuth(token, masqUser);
        } catch { masqUser.permissions = []; }
        setUser(masqUser);
        setIsAuthenticated(true);
        navigate('/dashboard');
      }
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Masquerade Failed', text: err.response?.data?.error || 'Failed' });
    }
  };

  const downloadStatement = async () => {
    if (id) {
      try {
        const response = await ContactModel.downloadStatement(parseInt(id));
        
        if (response.success && response.path) {
          // Open the PDF in a new tab
          const pdfUrl = `${API_BASE_URL}/${response.path}`;
          window.open(pdfUrl, '_blank');
          Swal.fire({ 
            icon: 'success', 
            title: 'Success!', 
            text: 'Statement generated successfully', 
            timer: 2000, 
            showConfirmButton: false 
          });
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Failed',
            text: 'Failed to generate statement'
          });
        }
      } catch (error: any) {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: error.message || 'Failed to download statement'
        });
      }
    }
  };

  const calculateTotals = () => {
    const totalInvoiced = invoices.reduce((sum, inv) => sum + (inv.invoice_total || 0), 0);
    
    // Calculate actual outstanding based on payments
    const totalOutstanding = invoices.reduce((sum, inv) => {
      const amountPaid = (inv as any).amount_paid || 0;
      const outstanding = (inv.invoice_total || 0) - amountPaid;
      return sum + Math.max(0, outstanding);
    }, 0);
    
    // Calculate actual paid based on payments
    const totalPaid = invoices.reduce((sum, inv) => {
      return sum + ((inv as any).amount_paid || 0);
    }, 0);
    
    return { totalInvoiced, totalOutstanding, totalPaid };
  };

  // ── Chat modal effects & helpers ─────────────────────────────────────
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

  const getEmbedCode = (assistantId: string) => `<script src="${window.location.origin}/widget.js" data-assistant-id="${assistantId}"></script>`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setEmbedCopied(true);
    setTimeout(() => setEmbedCopied(false), 2000);
  };

  // ── Knowledge helpers ────────────────────────────────────────────────
  const parseKnowledgeCategories = (raw: any) => {
    try {
      const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (data?.checklist && Array.isArray(data.checklist)) return data.checklist;
    } catch {}
    return [];
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  // Invoice columns for DataTable
  const invoiceColumns: any[] = [
    {
      accessorKey: 'invoice_id',
      header: 'Invoice #',
      cell: ({ getValue }: any) => (
        <span className="font-semibold text-picton-blue">
          INV-{String(getValue()).padStart(5, '0')}
        </span>
      )
    },
    {
      accessorKey: 'invoice_date',
      header: 'Date',
      cell: ({ getValue }: any) => formatDate(getValue())
    },
    {
      accessorKey: 'invoice_due_date',
      header: 'Due Date',
      cell: ({ getValue }: any) => formatDate(getValue())
    },
    {
      accessorKey: 'invoice_total',
      header: 'Amount',
      cell: ({ getValue }: any) => (
        <span className="font-semibold">{formatCurrency(getValue())}</span>
      )
    },
    {
      accessorKey: 'invoice_payment_status',
      header: 'Status',
      cell: ({ getValue }: any) => <PaymentStatusBadge status={getValue()} />
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }: any) => (
        <button
          onClick={() => navigate(`/invoices/${row.original.invoice_id}`)}
          className="text-picton-blue hover:text-picton-blue/80 text-sm font-medium"
        >
          View
        </button>
      )
    }
  ];

  // Quotation columns for DataTable
  const quotationColumns: any[] = [
    {
      accessorKey: 'quotation_id',
      header: 'Quote #',
      cell: ({ getValue }: any) => (
        <span className="font-semibold text-picton-blue">
          QUO-{String(getValue()).padStart(5, '0')}
        </span>
      )
    },
    {
      accessorKey: 'quotation_date',
      header: 'Date',
      cell: ({ getValue }: any) => formatDate(getValue())
    },
    {
      accessorKey: 'quotation_valid_until',
      header: 'Valid Until',
      cell: ({ getValue }: any) => formatDate(getValue())
    },
    {
      accessorKey: 'quotation_total',
      header: 'Amount',
      cell: ({ getValue }: any) => (
        <span className="font-semibold">{formatCurrency(getValue())}</span>
      )
    },
    {
      accessorKey: 'quotation_status',
      header: 'Status',
      cell: ({ getValue }: any) => <QuotationStatusBadge status={getValue()} />
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }: any) => (
        <button
          onClick={() => navigate(`/quotations/${row.original.quotation_id}`)}
          className="text-picton-blue hover:text-picton-blue/80 text-sm font-medium"
        >
          View
        </button>
      )
    }
  ];

  // Expense columns for supplier DataTable
  const expenseColumns: any[] = [
    {
      accessorKey: 'transaction_date',
      header: 'Date',
      cell: ({ getValue }: any) => formatDate(getValue())
    },
    {
      accessorKey: 'invoice_number',
      header: 'Invoice #',
      cell: ({ getValue }: any) => (
        <span className="font-semibold text-gray-900">{getValue() || '—'}</span>
      )
    },
    {
      accessorKey: 'category_name',
      header: 'Category',
      cell: ({ getValue }: any) => getValue() || <span className="text-gray-400">—</span>
    },
    {
      accessorKey: 'exclusive_amount',
      header: 'Excl. Amount',
      cell: ({ getValue }: any) => formatCurrency(getValue())
    },
    {
      accessorKey: 'vat_amount',
      header: 'VAT',
      cell: ({ getValue }: any) => formatCurrency(getValue())
    },
    {
      accessorKey: 'total_amount',
      header: 'Total',
      cell: ({ getValue }: any) => (
        <span className="font-semibold">{formatCurrency(getValue())}</span>
      )
    },
    {
      accessorKey: 'vat_type',
      header: 'VAT Type',
      cell: ({ getValue }: any) => {
        const vt = getValue() as string;
        const colors: Record<string, string> = {
          standard: 'bg-green-100 text-green-800',
          zero: 'bg-blue-100 text-blue-800',
          exempt: 'bg-amber-100 text-amber-800',
          'non-vat': 'bg-gray-100 text-gray-600',
        };
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[vt] || 'bg-gray-100 text-gray-600'}`}>
            {vt || 'non-vat'}
          </span>
        );
      }
    },
  ];

  if (loading || !contact) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-picton-blue"></div>
      </div>
    );
  }

  const totals = calculateTotals();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-picton-blue to-picton-blue/80 rounded-xl shadow-lg p-6 text-white">
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
              {isCustomer ? (
                <UserIcon className="h-8 w-8 text-white" />
              ) : (
                <BuildingOfficeIcon className="h-8 w-8 text-white" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold">{contact.contact_name}</h1>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-white/20 backdrop-blur-sm">
                  {contactTypeLabel}
                </span>
              </div>
              {contact.contact_person && (
                <p className="text-white/90 text-lg">{contact.contact_person}</p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handleEdit}
              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-picton-blue bg-white hover:bg-gray-50 shadow-md transition-all"
            >
              <PencilIcon className="h-4 w-4 mr-2" />
              Edit Client
            </button>
            {linkedUserId && user?.is_admin && (
              <button
                onClick={handleMasquerade}
                className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-purple-700 bg-white hover:bg-gray-50 shadow-md transition-all"
              >
                <ArrowRightOnRectangleIcon className="h-4 w-4 mr-2" />
                Login as User
              </button>
            )}
            <BackButton to="/contacts" />
          </div>
        </div>

        {/* Contact Information in Header */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-white/20">
          {contact.contact_email && (
            <div className="flex items-start gap-2">
              <EnvelopeIcon className="h-5 w-5 text-white/80 mt-0.5" />
              <div>
                <p className="text-xs text-white/70 mb-0.5">Email</p>
                <a href={`mailto:${contact.contact_email}`} className="text-white hover:text-white/80 text-sm font-medium">
                  {contact.contact_email}
                </a>
              </div>
            </div>
          )}

          {contact.contact_phone && (
            <div className="flex items-start gap-2">
              <PhoneIcon className="h-5 w-5 text-white/80 mt-0.5" />
              <div>
                <p className="text-xs text-white/70 mb-0.5">Phone</p>
                <a href={`tel:${contact.contact_phone}`} className="text-white text-sm font-medium">
                  {contact.contact_phone}
                </a>
              </div>
            </div>
          )}

          {contact.contact_vat && (
            <div className="flex items-start gap-2">
              <ReceiptPercentIcon className="h-5 w-5 text-white/80 mt-0.5" />
              <div>
                <p className="text-xs text-white/70 mb-0.5">VAT Number</p>
                <p className="text-white text-sm font-medium">{contact.contact_vat}</p>
              </div>
            </div>
          )}

          {contact.contact_address && (
            <div className="flex items-start gap-2">
              <MapPinIcon className="h-5 w-5 text-white/80 mt-0.5" />
              <div>
                <p className="text-xs text-white/70 mb-0.5">Address</p>
                <p className="text-white text-sm font-medium whitespace-pre-line">{contact.contact_address}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs for Client Details */}
      {isCustomer && (
        <>
          {/* Tab Navigation */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 overflow-x-auto">
              <button
                onClick={() => setActiveTab('overview')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                  activeTab === 'overview'
                    ? 'border-picton-blue text-picton-blue'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <ChartBarIcon className="h-5 w-5 inline mr-2" />
                Overview
              </button>
              <button
                onClick={() => setActiveTab('invoices')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                  activeTab === 'invoices'
                    ? 'border-picton-blue text-picton-blue'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <DocumentDuplicateIcon className="h-5 w-5 inline mr-2" />
                Invoices ({invoices.length})
              </button>
              <button
                onClick={() => setActiveTab('quotations')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                  activeTab === 'quotations'
                    ? 'border-picton-blue text-picton-blue'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <DocumentTextIcon className="h-5 w-5 inline mr-2" />
                Quotations ({quotations.length})
              </button>
              <button
                onClick={() => setActiveTab('statement')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                  activeTab === 'statement'
                    ? 'border-picton-blue text-picton-blue'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <BanknotesIcon className="h-5 w-5 inline mr-2" />
                Statement
              </button>
              <button
                onClick={() => setActiveTab('assistants')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                  activeTab === 'assistants'
                    ? 'border-purple-600 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <ChatBubbleLeftRightIcon className="h-5 w-5 inline mr-2" />
                Assistants ({clientDetail?.assistants?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('landing-pages')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                  activeTab === 'landing-pages'
                    ? 'border-purple-600 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <GlobeAltIcon className="h-5 w-5 inline mr-2" />
                Landing Pages ({clientDetail?.landingPages?.length || 0})
              </button>
              {docAvailable && (
                <button
                  onClick={() => setActiveTab('documentation')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                    activeTab === 'documentation'
                      ? 'border-emerald-600 text-emerald-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <DocumentTextIcon className="h-5 w-5 inline mr-2" />
                  Documentation
                </button>
              )}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="mt-6">
            {activeTab === 'overview' && (
              invoices.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Summary Stats */}
                <Card>
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Financial Summary</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                      <span className="text-sm text-gray-600">Total Invoiced</span>
                      <span className="text-lg font-bold text-gray-900">{formatCurrency(totals.totalInvoiced)}</span>
                    </div>
                    <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                      <span className="text-sm text-gray-600">Outstanding</span>
                      <span className="text-lg font-bold text-scarlet">{formatCurrency(totals.totalOutstanding)}</span>
                    </div>
                    <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                      <span className="text-sm text-gray-600">Paid</span>
                      <span className="text-lg font-bold text-green-600">{formatCurrency(totals.totalPaid)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Total Invoices</span>
                      <span className="text-lg font-bold text-gray-900">{invoices.length}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Total Quotes</span>
                      <span className="text-lg font-bold text-gray-900">{quotations.length}</span>
                    </div>
                  </div>
                </Card>

                {/* Recent Invoices */}
                <Card className="lg:col-span-2">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Invoices</h3>
                  <div className="space-y-3">
                    {invoices.slice(0, 5).map((invoice) => (
                      <div 
                        key={invoice.invoice_id} 
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                        onClick={() => navigate(`/invoices/${invoice.invoice_id}`)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full flex items-center justify-center bg-blue-100">
                            <DocumentDuplicateIcon className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              Invoice #{String(invoice.invoice_id).padStart(5, '0')}
                            </p>
                            <p className="text-sm text-gray-500">{formatDate(invoice.invoice_date)}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-gray-900">
                            {formatCurrency(invoice.invoice_total)}
                          </p>
                          <PaymentStatusBadge status={invoice.invoice_payment_status} />
                        </div>
                      </div>
                    ))}
                    {invoices.length > 5 && (
                      <button
                        onClick={() => setActiveTab('invoices')}
                        className="w-full mt-2 text-sm text-picton-blue hover:text-picton-blue/80 font-medium"
                      >
                        View all {invoices.length} invoices →
                      </button>
                    )}
                  </div>
                </Card>
              </div>
              ) : (
                <Card>
                  <div className="text-center py-12">
                    <ChartBarIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Activity Data</h3>
                    <p className="text-gray-500">
                      Customer activity and aging analysis will appear here once invoices are created.
                    </p>
                  </div>
                </Card>
              )
            )}

            {/* AI Telemetry Consent Info — Developer Only */}
            {activeTab === 'overview' && hasDeveloperAccess() && clientDetail?.user && (
              <Card className="mt-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-indigo-50 rounded-lg">
                    <ShieldCheckIcon className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">AI Telemetry Consent</h3>
                    <p className="text-xs text-gray-400">Developer-only visibility</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <p className="text-xs text-gray-500 font-medium mb-1">Consent Accepted</p>
                    <div className="flex items-center gap-2">
                      {clientDetail.user.telemetry_consent_accepted ? (
                        <>
                          <CheckCircleIcon className="h-5 w-5 text-emerald-500" />
                          <span className="text-sm font-semibold text-emerald-700">Yes</span>
                        </>
                      ) : (
                        <>
                          <NoSymbolIcon className="h-5 w-5 text-gray-400" />
                          <span className="text-sm font-semibold text-gray-500">No</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <p className="text-xs text-gray-500 font-medium mb-1">Opted Out</p>
                    <div className="flex items-center gap-2">
                      {clientDetail.user.telemetry_opted_out ? (
                        <>
                          <ExclamationTriangleIcon className="h-5 w-5 text-amber-500" />
                          <span className="text-sm font-semibold text-amber-700">Yes — Opted Out</span>
                        </>
                      ) : (
                        <>
                          <CheckCircleIcon className="h-5 w-5 text-emerald-500" />
                          <span className="text-sm font-semibold text-emerald-700">Active</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <p className="text-xs text-gray-500 font-medium mb-1">Consent Date</p>
                    <div className="flex items-center gap-2">
                      <ClockIcon className="h-5 w-5 text-gray-400" />
                      <span className="text-sm font-semibold text-gray-700">
                        {clientDetail.user.telemetry_consent_date
                          ? new Date(clientDetail.user.telemetry_consent_date).toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' })
                          : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {activeTab === 'invoices' && (
              <Card>
                <DataTable
                  data={invoices}
                  columns={invoiceColumns}
                  searchable={true}
                  emptyMessage="No invoices found for this customer."
                />
              </Card>
            )}

            {activeTab === 'quotations' && (
              <Card>
                <DataTable
                  data={quotations}
                  columns={quotationColumns}
                  searchable={true}
                  emptyMessage="No quotations found for this customer."
                />
              </Card>
            )}

            {activeTab === 'statement' && (
              invoices.length > 0 && statementData && statementData.transactions ? (
              <Card>
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-bold text-gray-900">Account Statement</h3>
                  <button
                    onClick={downloadStatement}
                    className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold text-white bg-picton-blue hover:bg-picton-blue/90 transition-colors"
                  >
                    <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                    Download PDF
                  </button>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Debit</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Credit</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {statementData.transactions.map((transaction, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatDate(transaction.date)}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {transaction.description}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                            {transaction.type === 'invoice' && formatCurrency(transaction.amount)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600">
                            {transaction.type === 'payment' && formatCurrency(transaction.amount)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                            {formatCurrency(transaction.balance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50">
                      <tr>
                        <td colSpan={4} className="px-6 py-4 text-sm font-bold text-gray-900 text-right">
                          Closing Balance:
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-right text-picton-blue">
                          {formatCurrency(statementData.closing_balance)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </Card>
              ) : (
                <Card>
                  <div className="text-center py-12">
                    <ClockIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Statement Loading...</h3>
                    <p className="text-gray-500 mb-4">
                      The detailed account statement with payment history is being prepared.
                    </p>
                    <p className="text-sm text-gray-400">
                      You can view individual invoices in the "Invoices" tab above.
                    </p>
                  </div>
                </Card>
              )
            )}

            {activeTab === 'assistants' && (
              <div>
                {(!clientDetail?.assistants || clientDetail.assistants.length === 0) ? (
                  <div className="text-center py-12 text-gray-500">
                    <SparklesIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="font-medium">No assistants found</p>
                    <p className="text-sm text-gray-400 mt-1">This client hasn't created any AI assistants yet.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {clientDetail.assistants.map((a: any) => {
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
                                  <select
                                    value={a.status || 'active'}
                                    onChange={(e) => handleAssistantStatus(a.id, e.target.value)}
                                    className="text-xs border rounded-lg px-2 py-1 bg-white border-gray-200 ml-auto"
                                  >
                                    <option value="active">Active</option>
                                    <option value="suspended">Suspended</option>
                                  </select>
                                </div>
                              </div>
                            </div>
                            <p className="text-sm text-gray-500 line-clamp-2 mb-3">{a.description || 'No description'}</p>

                            {/* Assistant Info Grid */}
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

                            {/* Meta */}
                            <div className="space-y-1.5 text-xs text-gray-400">
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
                            {hasDeveloperAccess() && (
                              <button
                                onClick={() => openChatLogModal(a.id, a.name)}
                                className="flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-colors ml-auto"
                                title="View sanitized chat history (Developer)"
                              >
                                <DocumentChartBarIcon className="h-3.5 w-3.5" />
                                History
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'landing-pages' && (
              <div>
                {(!clientDetail?.landingPages || clientDetail.landingPages.length === 0) ? (
                  <div className="text-center py-12 text-gray-500">
                    <GlobeAltIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="font-medium">No landing pages found</p>
                    <p className="text-sm text-gray-400 mt-1">This client hasn't created any landing pages yet.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {clientDetail.landingPages.map((lp: any) => (
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
                              {lp.contact_email && (
                                <div>
                                  <span className="text-gray-500 font-medium text-xs">Contact</span>
                                  <p className="text-gray-900 mt-0.5 truncate text-xs">{lp.contact_email}</p>
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
                          <div className="flex items-center gap-1.5 text-xs text-gray-400">
                            <ClockIcon className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>Created {lp.created_at ? new Date(lp.created_at).toLocaleDateString() : '—'}</span>
                            {lp.last_deployed_at && (
                              <span className="ml-1">• Deployed {new Date(lp.last_deployed_at).toLocaleDateString()}</span>
                            )}
                          </div>
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
                )}
              </div>
            )}

            {activeTab === 'documentation' && docAvailable && (
              <div>
                {/* File selector if multiple docs */}
                {docFiles.length > 1 && (
                  <div className="flex items-center gap-2 mb-4 flex-wrap">
                    {docFiles.map((f) => (
                      <button
                        key={f.filename}
                        onClick={() => {
                          if (f.filename !== docActiveFile) {
                            setDocContent(null);
                            loadDocumentation(f.filename);
                          }
                        }}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                          f.filename === docActiveFile
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
                        }`}
                      >
                        {f.filename.replace('.md', '')}
                      </button>
                    ))}
                  </div>
                )}

                {/* Loading state */}
                {docLoading && (
                  <div className="text-center py-16">
                    <div className="inline-flex items-center gap-2 text-gray-400">
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span className="text-sm">Loading documentation…</span>
                    </div>
                  </div>
                )}

                {/* No content */}
                {!docLoading && !docContent && (
                  <div className="text-center py-16">
                    <DocumentTextIcon className="h-12 w-12 text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">No documentation content found.</p>
                  </div>
                )}

                {/* Rendered markdown */}
                {!docLoading && docContent && (
                  <Card>
                    <article className="prose prose-sm sm:prose max-w-none
                      prose-headings:text-gray-900 dark:prose-headings:text-gray-100 prose-headings:font-bold
                      prose-h1:text-2xl prose-h1:border-b prose-h1:border-gray-200 dark:prose-h1:border-dark-600 prose-h1:pb-3 prose-h1:mb-6
                      prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-4
                      prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-3
                      prose-p:text-gray-700 dark:prose-p:text-gray-300 prose-p:leading-relaxed
                      prose-a:text-picton-blue prose-a:no-underline hover:prose-a:underline
                      prose-strong:text-gray-900 dark:prose-strong:text-white
                      prose-code:text-sm prose-code:bg-gray-100 dark:prose-code:bg-dark-900 prose-code:text-rose-600 dark:prose-code:text-rose-400 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:font-mono prose-code:before:content-none prose-code:after:content-none
                      prose-pre:bg-gray-900 dark:prose-pre:bg-dark-950 prose-pre:text-gray-100 prose-pre:rounded-xl prose-pre:overflow-x-auto
                      prose-table:border prose-table:border-gray-200 dark:prose-table:border-dark-600 prose-table:rounded-lg
                      prose-th:bg-gray-50 dark:prose-th:bg-dark-700 prose-th:text-left prose-th:px-4 prose-th:py-2 prose-th:text-xs prose-th:font-semibold prose-th:text-gray-600 dark:prose-th:text-gray-300 prose-th:uppercase prose-th:tracking-wide prose-th:border-b prose-th:border-gray-200 dark:prose-th:border-dark-600
                      prose-td:px-4 prose-td:py-2 prose-td:text-sm prose-td:border-b prose-td:border-gray-100 dark:prose-td:border-dark-700 dark:prose-td:text-gray-300
                      prose-blockquote:border-l-4 prose-blockquote:border-emerald-400 prose-blockquote:bg-emerald-50 dark:prose-blockquote:bg-emerald-900/20 prose-blockquote:text-emerald-800 dark:prose-blockquote:text-emerald-300 prose-blockquote:rounded-r-lg prose-blockquote:py-1 prose-blockquote:px-4
                      prose-hr:border-gray-200 dark:prose-hr:border-dark-600
                      prose-li:text-gray-700 dark:prose-li:text-gray-300 prose-li:marker:text-gray-400 dark:prose-li:marker:text-gray-500
                      prose-img:rounded-lg prose-img:shadow-md
                    ">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{docContent}</ReactMarkdown>
                    </article>
                  </Card>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Supplier Tabs */}
      {isSupplier && (
        <>
          {/* Tab Navigation */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 overflow-x-auto">
              <button
                onClick={() => setActiveTab('overview')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                  activeTab === 'overview'
                    ? 'border-picton-blue text-picton-blue'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <ChartBarIcon className="h-5 w-5 inline mr-2" />
                Overview
              </button>
              <button
                onClick={() => setActiveTab('expenses')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                  activeTab === 'expenses'
                    ? 'border-picton-blue text-picton-blue'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <ReceiptPercentIcon className="h-5 w-5 inline mr-2" />
                Expenses ({supplierExpenseSummary.count})
              </button>
              {docAvailable && (
                <button
                  onClick={() => setActiveTab('documentation')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                    activeTab === 'documentation'
                      ? 'border-emerald-600 text-emerald-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <DocumentTextIcon className="h-5 w-5 inline mr-2" />
                  Documentation
                </button>
              )}
            </nav>
          </div>

          {/* Supplier Tab Content */}
          <div className="mt-6">
            {activeTab === 'overview' && (
              supplierExpenses.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Summary Stats */}
                  <Card>
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Expense Summary</h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                        <span className="text-sm text-gray-600">Total Expenses (Incl.)</span>
                        <span className="text-lg font-bold text-gray-900">{formatCurrency(supplierExpenseSummary.total_expenses)}</span>
                      </div>
                      <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                        <span className="text-sm text-gray-600">Total Excl. VAT</span>
                        <span className="text-lg font-bold text-gray-900">{formatCurrency(supplierExpenseSummary.total_exclusive)}</span>
                      </div>
                      <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                        <span className="text-sm text-gray-600">VAT Claimed</span>
                        <span className="text-lg font-bold text-green-600">{formatCurrency(supplierExpenseSummary.total_vat)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Total Transactions</span>
                        <span className="text-lg font-bold text-gray-900">{supplierExpenseSummary.count}</span>
                      </div>
                    </div>
                  </Card>

                  {/* Recent Expenses */}
                  <Card className="lg:col-span-2">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Expenses</h3>
                    <div className="space-y-3">
                      {supplierExpenses.slice(0, 5).map((expense: any) => (
                        <div
                          key={expense.transaction_id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full flex items-center justify-center bg-orange-100">
                              <ReceiptPercentIcon className="h-5 w-5 text-orange-600" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">
                                {expense.invoice_number || `EXP-${expense.transaction_id}`}
                              </p>
                              <p className="text-sm text-gray-500">
                                {formatDate(expense.transaction_date)}
                                {expense.category_name && (
                                  <span className="ml-2 text-xs text-gray-400">• {expense.category_name}</span>
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-gray-900">
                              {formatCurrency(expense.total_amount)}
                            </p>
                            {expense.vat_type && expense.vat_type !== 'non-vat' && (
                              <span className="text-xs text-green-600">VAT: {formatCurrency(expense.vat_amount)}</span>
                            )}
                          </div>
                        </div>
                      ))}
                      {supplierExpenses.length > 5 && (
                        <button
                          onClick={() => setActiveTab('expenses')}
                          className="w-full mt-2 text-sm text-picton-blue hover:text-picton-blue/80 font-medium"
                        >
                          View all {supplierExpenses.length} expenses →
                        </button>
                      )}
                    </div>
                  </Card>
                </div>
              ) : (
                <Card>
                  <div className="text-center py-12">
                    <ChartBarIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Expense Data</h3>
                    <p className="text-gray-500">
                      Expense transactions for this supplier will appear here once captured.
                    </p>
                  </div>
                </Card>
              )
            )}

            {activeTab === 'expenses' && (
              <Card>
                <DataTable
                  data={supplierExpenses}
                  columns={expenseColumns}
                  searchable={true}
                  emptyMessage="No expense transactions found for this supplier."
                />
              </Card>
            )}

            {activeTab === 'documentation' && docAvailable && (
              <div>
                {/* File selector if multiple docs */}
                {docFiles.length > 1 && (
                  <div className="flex items-center gap-2 mb-4 flex-wrap">
                    {docFiles.map((f) => (
                      <button
                        key={f.filename}
                        onClick={() => {
                          if (f.filename !== docActiveFile) {
                            setDocContent(null);
                            loadDocumentation(f.filename);
                          }
                        }}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                          f.filename === docActiveFile
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
                        }`}
                      >
                        {f.filename.replace('.md', '')}
                      </button>
                    ))}
                  </div>
                )}

                {docLoading && (
                  <div className="text-center py-16">
                    <div className="inline-flex items-center gap-2 text-gray-400">
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span className="text-sm">Loading documentation…</span>
                    </div>
                  </div>
                )}

                {!docLoading && !docContent && (
                  <div className="text-center py-16">
                    <DocumentTextIcon className="h-12 w-12 text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">No documentation content found.</p>
                  </div>
                )}

                {!docLoading && docContent && (
                  <Card>
                    <article className="prose prose-sm sm:prose max-w-none
                      prose-headings:text-gray-900 prose-headings:font-bold
                      prose-h1:text-2xl prose-h1:border-b prose-h1:border-gray-200 prose-h1:pb-3 prose-h1:mb-6
                      prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-4
                      prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-3
                      prose-p:text-gray-700 prose-p:leading-relaxed
                      prose-a:text-picton-blue prose-a:no-underline hover:prose-a:underline
                      prose-strong:text-gray-900
                      prose-code:text-sm prose-code:bg-gray-100 prose-code:text-rose-600 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:font-mono prose-code:before:content-none prose-code:after:content-none
                      prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-pre:rounded-xl prose-pre:overflow-x-auto
                      prose-table:border prose-table:border-gray-200 prose-table:rounded-lg
                      prose-th:bg-gray-50 prose-th:text-left prose-th:px-4 prose-th:py-2 prose-th:text-xs prose-th:font-semibold prose-th:text-gray-600 prose-th:uppercase prose-th:tracking-wide prose-th:border-b prose-th:border-gray-200
                      prose-td:px-4 prose-td:py-2 prose-td:text-sm prose-td:border-b prose-td:border-gray-100
                    ">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{docContent}</ReactMarkdown>
                    </article>
                  </Card>
                )}
              </div>
            )}
          </div>
        </>
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
                <p className="text-xs text-gray-400">AI Assistant • Test Chat</p>
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

      {/* ── Chat History Modal (Developer Only) ── */}
      {chatLogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl h-[85vh] max-h-[800px] border border-slate-200 flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-3 p-5 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                <DocumentChartBarIcon className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-gray-900">Sanitized Chat History</h3>
                <p className="text-xs text-gray-400">{chatLogModal.assistantName} • {chatLogsPagination?.total ?? 0} total logs</p>
              </div>
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-700 text-xs font-medium rounded-full border border-amber-200">
                <ShieldCheckIcon className="h-3 w-3" />
                Developer
              </span>
              <button
                onClick={() => { setChatLogModal(null); setChatLogs([]); setChatLogsPagination(null); }}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {chatLogsLoading && chatLogs.length === 0 && (
                <div className="text-center py-12">
                  <div className="inline-flex items-center gap-2 text-gray-400">
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span className="text-sm">Loading chat logs…</span>
                  </div>
                </div>
              )}

              {!chatLogsLoading && chatLogs.length === 0 && (
                <div className="text-center py-12">
                  <DocumentChartBarIcon className="h-12 w-12 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">No chat logs found for this client</p>
                </div>
              )}

              {chatLogs.map((log) => (
                <div key={log.id} className="bg-slate-50 rounded-xl border border-slate-100 overflow-hidden">
                  {/* Log Header */}
                  <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-100/50 border-b border-slate-100">
                    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${
                      log.source === 'assistant' ? 'bg-picton-blue/10 text-picton-blue' :
                      log.source === 'widget' ? 'bg-violet-100 text-violet-700' :
                      'bg-emerald-100 text-emerald-700'
                    }`}>
                      {log.source}
                    </span>
                    {log.model && (
                      <span className="text-xs text-gray-400">
                        {log.provider && <>{log.provider} / </>}{log.model}
                      </span>
                    )}
                    {log.duration_ms && (
                      <span className="text-xs text-gray-400">{log.duration_ms}ms</span>
                    )}
                    <span className="text-xs text-gray-400 ml-auto">
                      {new Date(log.created_at).toLocaleString('en-ZA')}
                    </span>
                  </div>
                  {/* Prompt & Response */}
                  <div className="p-4 space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Prompt (Sanitized)</p>
                      <p className="text-sm text-gray-700 bg-white rounded-lg border border-gray-200 p-3 whitespace-pre-wrap leading-relaxed">
                        {log.sanitized_prompt || <span className="text-gray-300 italic">Empty prompt</span>}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Response (Sanitized)</p>
                      <p className="text-sm text-gray-700 bg-white rounded-lg border border-gray-200 p-3 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                        {log.sanitized_response || <span className="text-gray-300 italic">Empty response</span>}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer with Pagination */}
            <div className="border-t border-slate-100 px-5 py-3 flex items-center justify-between">
              <p className="text-xs text-gray-400">
                Showing {chatLogs.length} of {chatLogsPagination?.total ?? 0} logs
              </p>
              <div className="flex items-center gap-2">
                {chatLogsPagination && chatLogsPagination.offset > 0 && (
                  <button
                    onClick={() => linkedUserId && loadChatLogs(linkedUserId, Math.max(0, (chatLogsPagination?.offset ?? 0) - 20))}
                    disabled={chatLogsLoading}
                    className="flex items-center gap-1 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <ChevronLeftIcon className="h-3.5 w-3.5" />
                    Previous
                  </button>
                )}
                {chatLogsPagination?.hasMore && (
                  <button
                    onClick={() => linkedUserId && loadChatLogs(linkedUserId, (chatLogsPagination?.offset ?? 0) + 20)}
                    disabled={chatLogsLoading}
                    className="flex items-center gap-1 text-xs font-medium text-picton-blue bg-picton-blue/10 hover:bg-picton-blue/20 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Next
                    <ChevronRightIcon className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContactDetails;
