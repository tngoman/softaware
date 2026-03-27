import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { 
  UserIcon, 
  EnvelopeIcon, 
  PhoneIcon,
  CheckCircleIcon,
  EyeIcon,
  BellIcon,
  DevicePhoneMobileIcon,
  ComputerDesktopIcon,
  SparklesIcon,
  TrashIcon,
  PencilIcon,
  PlusIcon,
  ClipboardDocumentListIcon,
  ChatBubbleLeftRightIcon,
  CurrencyDollarIcon,
  CalendarDaysIcon,
  UserGroupIcon,
  ShieldCheckIcon,
  GlobeAltIcon,
  BoltIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  LightBulbIcon,
  RocketLaunchIcon,
  InformationCircleIcon,
  WrenchScrewdriverIcon,
  BugAntIcon,
  CommandLineIcon,
  CogIcon,
  PaperAirplaneIcon,
  UserCircleIcon,
  XMarkIcon,
  ClockIcon,
  Bars3Icon,
  MicrophoneIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  StopCircleIcon,
  PlayIcon,
  PaperClipIcon,
  PhotoIcon,
} from '@heroicons/react/24/outline';
import { useAppStore } from '../../store';
import { AuthModel } from '../../models';
import { StaffAssistantModel, MobileModel, type StaffAssistant, type StaffAssistantCreate, type MobileConversation } from '../../models/SystemModels';
import { WebmailAccountModel } from '../../models/WebmailModel';
import type { MailboxAccount, CreateMailboxInput, ConnectionTestResult } from '../../models/WebmailModel';
import Swal from 'sweetalert2';
import { notify } from '../../utils/notify';
import { getViewAsRole, setViewAsRole, getEffectiveRole, getRoleLabel } from '../../utils/workflowPermissions';
import RichTextEditor from '../../components/RichTextEditor';
import PayrollTab from '../../components/Profile/PayrollTab';
import LeaveTab from '../../components/Profile/LeaveTab';

interface ProfileFormData {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  notifications_enabled?: boolean;
  push_notifications_enabled?: boolean;
  web_notifications_enabled?: boolean;
}

type ProfileTab = 'profile' | 'assistant' | 'mailboxes' | 'payroll' | 'leave';

// ============================================================================
// Staff Assistant Tab Component
// ============================================================================

const PERSONALITY_OPTIONS = [
  { value: 'professional', label: 'Professional', desc: 'Formal, business-oriented responses' },
  { value: 'friendly', label: 'Friendly', desc: 'Warm, approachable tone' },
  { value: 'expert', label: 'Expert', desc: 'Authoritative, detailed answers' },
  { value: 'casual', label: 'Casual', desc: 'Relaxed, conversational style' },
];

const VOICE_STYLE_OPTIONS = [
  { value: 'concise', label: 'Concise' },
  { value: 'detailed', label: 'Detailed' },
  { value: 'conversational', label: 'Conversational' },
  { value: 'formal', label: 'Formal' },
];

const TTS_VOICE_OPTIONS = [
  { value: 'nova', label: 'Nova', desc: 'Warm & friendly female voice' },
  { value: 'alloy', label: 'Alloy', desc: 'Neutral & balanced' },
  { value: 'echo', label: 'Echo', desc: 'Smooth & clear male voice' },
  { value: 'fable', label: 'Fable', desc: 'Expressive British accent' },
  { value: 'onyx', label: 'Onyx', desc: 'Deep & authoritative male voice' },
  { value: 'shimmer', label: 'Shimmer', desc: 'Bright & upbeat female voice' },
];

const STAFF_TOOL_CATEGORIES = [
  {
    name: 'Task Management',
    icon: ClipboardDocumentListIcon,
    color: 'bg-blue-500',
    lightColor: 'bg-blue-50 text-blue-700 ring-blue-200',
    tools: ['List Tasks', 'Get Task', 'Create Task', 'Update Task', 'Delete Task', 'Comments', 'Bookmark', 'Priority', 'Tags', 'Colors', 'Start/Complete/Approve', 'Stats', 'Pending Approvals', 'Sync', 'Invoice Staging'],
    description: 'Full task lifecycle — CRUD, workflow, local enhancements, sync & invoicing',
  },
  {
    name: 'Client Admin',
    icon: ShieldCheckIcon,
    color: 'bg-indigo-500',
    lightColor: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
    tools: ['Search Clients', 'Suspend Accounts', 'Health Check', 'Generate Endpoints'],
    description: 'Manage client accounts and system health',
  },
  {
    name: 'Support Cases',
    icon: WrenchScrewdriverIcon,
    color: 'bg-amber-500',
    lightColor: 'bg-amber-50 text-amber-700 ring-amber-200',
    tools: ['List Cases', 'Case Details', 'Update Cases', 'Add Comments'],
    description: 'Handle support tickets and escalations',
  },
  {
    name: 'CRM & Contacts',
    icon: UserGroupIcon,
    color: 'bg-green-500',
    lightColor: 'bg-green-50 text-green-700 ring-green-200',
    tools: ['List Contacts', 'Contact Details', 'Create Contact'],
    description: 'Manage your contact database',
  },
  {
    name: 'Finance',
    icon: CurrencyDollarIcon,
    color: 'bg-emerald-500',
    lightColor: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    tools: ['Quotations', 'Invoices', 'Search Pricing'],
    description: 'Access financial documents and pricing',
  },
  {
    name: 'Scheduling',
    icon: CalendarDaysIcon,
    color: 'bg-purple-500',
    lightColor: 'bg-purple-50 text-purple-700 ring-purple-200',
    tools: ['List Calls', 'Schedule Calls'],
    description: 'Manage scheduled calls and meetings',
  },
  {
    name: 'Chat & Messaging',
    icon: ChatBubbleLeftRightIcon,
    color: 'bg-pink-500',
    lightColor: 'bg-pink-50 text-pink-700 ring-pink-200',
    tools: ['List Conversations', 'Send Messages'],
    description: 'Internal team communication',
  },
  {
    name: 'Bug Tracking',
    icon: BugAntIcon,
    color: 'bg-red-500',
    lightColor: 'bg-red-50 text-red-700 ring-red-200',
    tools: ['List Bugs', 'Bug Details', 'Create Bug', 'Update Bug', 'Add Comment', 'Workflow Phase', 'Bug Stats'],
    description: 'Report, triage, and track bugs through Intake → QA → Development',
  },
  {
    name: 'Lead Management',
    icon: BoltIcon,
    color: 'bg-orange-500',
    lightColor: 'bg-orange-50 text-orange-700 ring-orange-200',
    tools: ['List Leads', 'Lead Details', 'Update Status', 'Lead Stats'],
    description: 'Track and manage sales leads',
  },
  {
    name: 'Email Automation',
    icon: EnvelopeIcon,
    color: 'bg-cyan-500',
    lightColor: 'bg-cyan-50 text-cyan-700 ring-cyan-200',
    tools: ['Follow-up Emails', 'Info Emails'],
    description: 'Send automated follow-up emails',
  },
  {
    name: 'Site Builder',
    icon: GlobeAltIcon,
    color: 'bg-teal-500',
    lightColor: 'bg-teal-50 text-teal-700 ring-teal-200',
    tools: ['List Sites', 'Site Details', 'Update Fields', 'Regenerate', 'Deploy'],
    description: 'Manage client websites and deployments',
  },
];

const StaffAssistantTab: React.FC = () => {
  const [assistant, setAssistant] = useState<StaffAssistant | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showCapabilities, setShowCapabilities] = useState(false);

  // Chat state
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<{id: string; role: 'user'|'assistant'; content: string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<MobileConversation[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  // Image attachment state
  const [attachedImage, setAttachedImage] = useState<string | null>(null); // base64 data-URI
  const [attachedImageName, setAttachedImageName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Voice state
  const [isListening, setIsListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const lastSpokenMsgRef = useRef<string | null>(null);

  // Check browser support once
  const speechSupported = typeof window !== 'undefined' && !!(
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  );
  const ttsSupported = true; // Server-side TTS via OpenAI — always available
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [ttsLoading, setTtsLoading] = useState<string | null>(null); // msgId being generated
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null); // voice being previewed
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Form state
  const [formData, setFormData] = useState<StaffAssistantCreate>({
    name: '',
    description: '',
    personality: 'professional',
    personality_flare: '',
    primary_goal: '',
    custom_greeting: '',
    voice_style: 'concise',
    tts_voice: 'nova',
    preferred_model: '',
  });

  const loadAssistant = useCallback(async () => {
    setLoading(true);
    try {
      const data = await StaffAssistantModel.get();
      setAssistant(data);
      if (data) {
        setFormData({
          name: data.name || '',
          description: data.description || '',
          personality: data.personality || 'professional',
          personality_flare: data.personality_flare || '',
          primary_goal: data.primary_goal || '',
          custom_greeting: data.custom_greeting || '',
          voice_style: data.voice_style || 'concise',
          tts_voice: data.tts_voice || 'nova',
          preferred_model: data.preferred_model || '',
        });
      }
    } catch (err) {
      console.error('Failed to load staff assistant:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAssistant();
  }, [loadAssistant]);

  // ── Chat auto-scroll & focus ───────────────────────────────────────────
  useEffect(() => {
    if (showChat) setTimeout(() => chatInputRef.current?.focus(), 100);
  }, [showChat]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Auto-speak latest assistant message when voiceEnabled
  useEffect(() => {
    if (!voiceEnabled || chatMessages.length === 0) return;
    const last = chatMessages[chatMessages.length - 1];
    if (last.role === 'assistant' && last.content && last.id !== lastSpokenMsgRef.current) {
      lastSpokenMsgRef.current = last.id;
      speakText(last.content, last.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatMessages, voiceEnabled]);

  // Cleanup on modal close
  useEffect(() => {
    if (!showChat) {
      stopListening();
      stopSpeaking();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showChat]);

  // ── Voice helpers ───────────────────────────────────────────────────
  const startListening = () => {
    if (!speechSupported) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SR();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setChatInput(transcript);
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
      // Auto-focus input after recording
      setTimeout(() => chatInputRef.current?.focus(), 50);
    };

    recognition.onerror = (event: any) => {
      console.warn('[Voice] Recognition error:', event.error);
      setIsListening(false);
      recognitionRef.current = null;
      if (event.error === 'not-allowed') {
        notify.error('Microphone access denied. Please allow mic access in your browser.');
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      // Stop any TTS playback when starting to record
      stopSpeaking();
      startListening();
    }
  };

  const speakText = async (text: string, msgId?: string) => {
    // Stop any current playback
    stopSpeaking();

    // Strip markdown for cleaner speech
    const clean = text
      .replace(/```[\s\S]*?```/g, ' code block ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/#{1,6}\s/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\n{2,}/g, '. ')
      .replace(/\n/g, ' ')
      .trim();

    if (!clean) return;

    if (msgId) setTtsLoading(msgId);
    setSpeakingMsgId(msgId || null);

    try {
      const token = localStorage.getItem('jwt_token');
      const res = await fetch('/api/v1/mobile/tts', {
        method: 'POST',
        credentials: 'include', // send HTTP-only auth cookie
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ text: clean, voice: formData.tts_voice || assistant?.tts_voice || 'nova' }),
      });

      if (!res.ok) throw new Error(`TTS failed: ${res.status}`);

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onplay = () => {
        setIsSpeaking(true);
        setTtsLoading(null);
      };
      audio.onended = () => {
        setIsSpeaking(false);
        setSpeakingMsgId(null);
        URL.revokeObjectURL(url);
        audioRef.current = null;
      };
      audio.onerror = () => {
        setIsSpeaking(false);
        setSpeakingMsgId(null);
        setTtsLoading(null);
        URL.revokeObjectURL(url);
        audioRef.current = null;
      };

      await audio.play();
    } catch (err) {
      console.error('[TTS] Error:', err);
      setIsSpeaking(false);
      setSpeakingMsgId(null);
      setTtsLoading(null);
    }
  };

  const stopSpeaking = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setIsSpeaking(false);
    setSpeakingMsgId(null);
    setTtsLoading(null);
  };

  // ── Voice preview for voice picker ─────────────────────────────────
  const stopPreview = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
      previewAudioRef.current = null;
    }
    setPreviewingVoice(null);
  };

  const previewVoice = async (voiceName: string) => {
    // If same voice is already playing, stop it
    if (previewingVoice === voiceName) {
      stopPreview();
      return;
    }
    stopPreview();
    setPreviewingVoice(voiceName);

    try {
      const token = localStorage.getItem('jwt_token');
      const res = await fetch('/api/v1/mobile/tts/preview', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ voice: voiceName }),
      });

      if (!res.ok) throw new Error(`Preview failed: ${res.status}`);

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      previewAudioRef.current = audio;

      audio.onended = () => {
        setPreviewingVoice(null);
        URL.revokeObjectURL(url);
        previewAudioRef.current = null;
      };
      audio.onerror = () => {
        setPreviewingVoice(null);
        URL.revokeObjectURL(url);
        previewAudioRef.current = null;
      };

      await audio.play();
    } catch (err) {
      console.error('[Voice Preview] Error:', err);
      setPreviewingVoice(null);
    }
  };

  const toggleSpeakMessage = (msgId: string, content: string) => {
    if (speakingMsgId === msgId) {
      stopSpeaking();
    } else {
      speakText(content, msgId);
    }
  };

  // ── Image attachment handlers ──────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    if (!file.type.startsWith('image/')) {
      notify.error('Only image files are supported (PNG, JPG, GIF, WebP).');
      return;
    }
    // Validate size (~10MB)
    if (file.size > 10 * 1024 * 1024) {
      notify.error('Image too large. Maximum size is 10MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAttachedImage(reader.result as string);
      setAttachedImageName(file.name);
    };
    reader.readAsDataURL(file);

    // Reset the input so the same file can be re-selected
    e.target.value = '';
  };

  const removeAttachedImage = () => {
    setAttachedImage(null);
    setAttachedImageName('');
  };

  const sendChatMessage = async (overrideText?: string) => {
    const text = overrideText || chatInput.trim();
    if ((!text && !attachedImage) || chatLoading || !assistant) return;

    // Stop any voice activity
    stopListening();
    stopSpeaking();

    // Capture image before clearing
    const imageToSend = attachedImage;
    const displayContent = imageToSend
      ? (text ? `📎 ${attachedImageName}\n${text}` : `📎 ${attachedImageName}`)
      : text;

    const userMsg = { id: `u-${Date.now()}`, role: 'user' as const, content: displayContent };
    const aId = `a-${Date.now()}`;
    const assistantMsg = { id: aId, role: 'assistant' as const, content: '' };

    setChatMessages(prev => [...prev, userMsg, assistantMsg]);
    if (!overrideText) setChatInput('');
    removeAttachedImage();
    setChatLoading(true);

    try {
      const isNew = !conversationId;
      const result = await MobileModel.sendIntent({
        text: text || 'What is in this image?',
        conversationId: conversationId || undefined,
        assistantId: assistant.id,
        ...(imageToSend ? { image: imageToSend } : {}),
      });
      setConversationId(result.conversationId);
      setChatMessages(prev =>
        prev.map(m => m.id === aId ? { ...m, content: result.reply } : m)
      );
      // Refresh sidebar when a new conversation was just created
      if (isNew) loadConversations();
    } catch {
      setChatMessages(prev =>
        prev.map(m => m.id === aId ? { ...m, content: 'Sorry, something went wrong. Please try again.' } : m)
      );
    } finally {
      setChatLoading(false);
      chatInputRef.current?.focus();
    }
  };

  const handleChatKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  };

  // ── Chat history helpers ─────────────────────────────────────────────
  const loadConversations = useCallback(async () => {
    try {
      setLoadingHistory(true);
      const all = await MobileModel.getConversations();
      // Filter to conversations for this assistant (or show all if no assistant filter)
      const filtered = assistant
        ? all.filter(c => c.assistant_id === assistant.id || !c.assistant_id)
        : all;
      setConversations(filtered);
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, [assistant]);

  const selectConversation = async (conv: MobileConversation) => {
    if (conv.id === conversationId) return; // already selected
    try {
      setChatLoading(true);
      const messages = await MobileModel.getMessages(conv.id);
      const mapped = messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));
      setChatMessages(mapped);
      setConversationId(conv.id);
      setChatInput('');
    } catch (err) {
      console.error('Failed to load conversation messages:', err);
    } finally {
      setChatLoading(false);
    }
  };

  const handleDeleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirm = await Swal.fire({
      title: 'Delete conversation?',
      text: 'This cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      confirmButtonColor: '#ef4444',
    });
    if (!confirm.isConfirmed) return;
    try {
      await MobileModel.deleteConversation(convId);
      setConversations(prev => prev.filter(c => c.id !== convId));
      if (conversationId === convId) {
        setChatMessages([]);
        setConversationId(null);
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
      notify.error('Failed to delete conversation.');
    }
  };

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
  };

  const openFlareHelper = () => {
    setShowChat(true);
    setChatMessages([]);
    setConversationId(null);
    loadConversations();
    setTimeout(() => {
      sendChatMessage(
        `Help me write a personality flare for my AI assistant named "${formData.name || assistant?.name || 'my assistant'}". ` +
        `The personality is "${formData.personality || 'professional'}" with a "${formData.voice_style || 'concise'}" voice style. ` +
        `${formData.primary_goal ? `The primary goal is: ${formData.primary_goal}. ` : ''}` +
        `Please suggest a personality flare text that shapes how the assistant speaks — things like tone, formatting preferences, language style, and any special instructions. Keep it to 2-3 sentences.`
      );
    }, 100);
  };

  const openChat = () => {
    setShowChat(true);
    loadConversations();
  };

  const clearChat = () => {
    setChatMessages([]);
    setChatInput('');
    setConversationId(null);
    // Refresh sidebar to pick up any new conversations
    loadConversations();
  };

  const renderChatModal = () => {
    if (!showChat || !assistant) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[80vh] max-h-[750px] border border-slate-200 flex flex-row overflow-hidden">

          {/* ── Sidebar: Chat History ─────────────────────────────── */}
          {sidebarOpen && (
            <div className="w-64 min-w-[256px] border-r border-slate-200 flex flex-col bg-slate-50">
              {/* Sidebar header */}
              <div className="flex items-center justify-between px-3 py-3 border-b border-slate-200">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">History</span>
                <button
                  onClick={() => { setChatMessages([]); setChatInput(''); setConversationId(null); }}
                  title="New Chat"
                  className="flex items-center gap-1 text-xs font-medium text-picton-blue hover:bg-picton-blue/10 px-2 py-1 rounded-md transition-colors"
                >
                  <PlusIcon className="h-3.5 w-3.5" />
                  New
                </button>
              </div>

              {/* Conversation list */}
              <div className="flex-1 overflow-y-auto">
                {loadingHistory && conversations.length === 0 && (
                  <div className="p-4 text-center">
                    <div className="w-5 h-5 border-2 border-gray-300 border-t-picton-blue rounded-full animate-spin mx-auto" />
                    <p className="text-xs text-gray-400 mt-2">Loading…</p>
                  </div>
                )}
                {!loadingHistory && conversations.length === 0 && (
                  <div className="p-4 text-center">
                    <ChatBubbleLeftRightIcon className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                    <p className="text-xs text-gray-400">No previous chats</p>
                  </div>
                )}
                {conversations.map(conv => (
                  <button
                    key={conv.id}
                    onClick={() => selectConversation(conv)}
                    className={`w-full text-left px-3 py-2.5 border-b border-slate-100 hover:bg-white transition-colors group ${
                      conversationId === conv.id ? 'bg-white border-l-2 border-l-picton-blue' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <p className="text-xs font-medium text-gray-700 truncate flex-1 leading-snug">
                        {conv.preview
                          ? (conv.preview.length > 60 ? conv.preview.slice(0, 60) + '…' : conv.preview)
                          : 'New conversation'}
                      </p>
                      <button
                        onClick={(e) => handleDeleteConversation(conv.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-300 hover:text-red-500 transition-all flex-shrink-0"
                        title="Delete"
                      >
                        <TrashIcon className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <ClockIcon className="h-3 w-3 text-gray-300" />
                      <span className="text-[10px] text-gray-400">{formatRelativeTime(conv.updated_at)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Main Chat Area ────────────────────────────────────── */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b border-slate-100">
              <button
                onClick={() => setSidebarOpen(prev => !prev)}
                title={sidebarOpen ? 'Hide history' : 'Show history'}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Bars3Icon className="h-5 w-5" />
              </button>
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-picton-blue to-indigo-500 flex items-center justify-center">
                <SparklesIcon className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-gray-900 truncate">{assistant.name}</h3>
                <p className="text-xs text-gray-400">Staff Assistant • Chat</p>
              </div>
              {/* Voice output toggle */}
              {ttsSupported && (
                <button
                  onClick={() => { setVoiceEnabled(v => !v); if (voiceEnabled) stopSpeaking(); }}
                  title={voiceEnabled ? 'Disable auto-speak' : 'Enable auto-speak'}
                  className={`p-2 rounded-lg transition-colors ${
                    voiceEnabled
                      ? 'text-picton-blue bg-blue-50 hover:bg-blue-100'
                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {voiceEnabled ? <SpeakerWaveIcon className="h-4 w-4" /> : <SpeakerXMarkIcon className="h-4 w-4" />}
                </button>
              )}
              {chatMessages.length > 0 && (
                <button
                  onClick={clearChat}
                  title="New Chat"
                  className="p-2 text-gray-400 hover:text-picton-blue hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <PlusIcon className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => setShowChat(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatMessages.length === 0 && (
                <div className="text-center py-12">
                  <SparklesIcon className="h-12 w-12 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">Send a message to start chatting with your assistant</p>
                  <p className="text-gray-300 text-xs mt-1">Your assistant has access to 67 tools across 11 categories</p>
                </div>
              )}

              {chatMessages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex gap-3 group/msg ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-picton-blue to-indigo-500 flex items-center justify-center flex-shrink-0">
                      <SparklesIcon className="h-4 w-4 text-white" />
                    </div>
                  )}
                  <div className="flex flex-col max-w-[75%] gap-1">
                    <div
                      className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                        msg.role === 'user'
                          ? 'bg-picton-blue text-white rounded-br-md'
                          : 'bg-gray-100 text-gray-800 rounded-bl-md'
                      }`}
                    >
                      {msg.content ? (
                        msg.role === 'user' && msg.content.startsWith('📎') ? (
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-1.5 text-xs opacity-80">
                              <PhotoIcon className="h-3.5 w-3.5" />
                              <span>{msg.content.split('\n')[0].replace('📎 ', '')}</span>
                            </div>
                            {msg.content.includes('\n') && (
                              <span>{msg.content.split('\n').slice(1).join('\n')}</span>
                            )}
                          </div>
                        ) : msg.content
                      ) : (
                        <span className="inline-flex gap-1">
                          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </span>
                      )}
                    </div>
                    {/* TTS play/stop button on assistant messages */}
                    {msg.role === 'assistant' && msg.content && (
                      <button
                        onClick={() => toggleSpeakMessage(msg.id, msg.content)}
                        disabled={ttsLoading === msg.id}
                        className={`self-start flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all ${
                          speakingMsgId === msg.id || ttsLoading === msg.id
                            ? 'bg-picton-blue/10 text-picton-blue'
                            : 'opacity-0 group-hover/msg:opacity-100 bg-gray-50 text-gray-400 hover:text-gray-600'
                        }`}
                        title={speakingMsgId === msg.id ? 'Stop speaking' : 'Read aloud'}
                      >
                        {ttsLoading === msg.id ? (
                          <><span className="w-3 h-3 border border-picton-blue border-t-transparent rounded-full animate-spin" /> Generating…</>
                        ) : speakingMsgId === msg.id ? (
                          <><StopCircleIcon className="h-3 w-3" /> Stop</>
                        ) : (
                          <><PlayIcon className="h-3 w-3" /> Listen</>
                        )}
                      </button>
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

            {/* Input */}
            <div className="border-t border-slate-100 p-4">
              {/* Hidden file input for image attachment */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />

              {/* Image preview */}
              {attachedImage && (
                <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-blue-50 rounded-xl border border-blue-100">
                  <img
                    src={attachedImage}
                    alt={attachedImageName}
                    className="h-12 w-12 object-cover rounded-lg border border-blue-200"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-blue-700 truncate">{attachedImageName}</p>
                    <p className="text-[10px] text-blue-500">Image attached — ready to send</p>
                  </div>
                  <button
                    onClick={removeAttachedImage}
                    className="p-1 text-blue-400 hover:text-red-500 transition-colors"
                    title="Remove image"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Listening indicator */}
              {isListening && (
                <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-red-50 rounded-xl border border-red-100">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                  </span>
                  <span className="text-xs text-red-600 font-semibold">Listening… speak now</span>
                  <button
                    onClick={() => { stopListening(); if (chatInput.trim()) sendChatMessage(); }}
                    className="ml-auto text-xs font-medium text-picton-blue hover:text-indigo-600 px-2 py-0.5 bg-white rounded-md border border-blue-200"
                  >Send</button>
                  <button
                    onClick={stopListening}
                    className="text-xs text-gray-400 hover:text-gray-600 px-2 py-0.5"
                  >Cancel</button>
                </div>
              )}
              <div className="flex items-end gap-2">
                {/* Mic / Speak button — always visible */}
                <button
                  onClick={() => {
                    if (!speechSupported) {
                      notify.error('Voice input not supported in this browser. Use Chrome or Edge.');
                      return;
                    }
                    toggleListening();
                  }}
                  disabled={chatLoading}
                  title={!speechSupported ? 'Voice input (requires Chrome/Edge)' : isListening ? 'Stop listening' : 'Speak to assistant'}
                  className={`p-2.5 rounded-xl transition-all flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${
                    isListening
                      ? 'bg-red-500 text-white shadow-lg shadow-red-500/30 hover:bg-red-600 animate-pulse'
                      : speechSupported
                        ? 'bg-gradient-to-br from-picton-blue to-indigo-500 text-white shadow-md shadow-picton-blue/20 hover:shadow-lg hover:shadow-picton-blue/30'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <MicrophoneIcon className="h-5 w-5" />
                </button>
                {/* Attach image button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={chatLoading}
                  title="Attach an image"
                  className={`p-2.5 rounded-xl transition-all flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${
                    attachedImage
                      ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                  }`}
                >
                  <PaperClipIcon className="h-5 w-5" />
                </button>
                <textarea
                  ref={chatInputRef}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={handleChatKeyDown}
                  placeholder={isListening ? 'Listening…' : attachedImage ? 'Add a message about this image…' : 'Type, 🎤 speak, or 📎 attach…'}
                  rows={1}
                  className={`flex-1 resize-none px-4 py-2.5 bg-white border rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-picton-blue focus:border-picton-blue transition-all ${
                    isListening ? 'border-red-300 ring-1 ring-red-200' : 'border-gray-300'
                  }`}
                  disabled={chatLoading}
                />
                {/* Send button */}
                <button
                  onClick={() => sendChatMessage()}
                  disabled={(!chatInput.trim() && !attachedImage) || chatLoading}
                  className="p-2.5 bg-gradient-to-r from-picton-blue to-indigo-500 text-white rounded-xl hover:from-picton-blue/90 hover:to-indigo-500/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md shadow-picton-blue/20"
                >
                  <PaperAirplaneIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const handleInputChange = (field: keyof StaffAssistantCreate, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      notify.warning('Please give your assistant a name.');
      return;
    }
    setSaving(true);
    try {
      const created = await StaffAssistantModel.create(formData);
      setAssistant(created);
      setIsEditing(false);
      notify.success(`"${created.name}" is ready to use on mobile.`);
    } catch (err: any) {
      console.error('Create assistant error:', err);
      notify.error(err.response?.data?.error || 'Failed to create assistant.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!formData.name.trim()) {
      notify.warning('Please give your assistant a name.');
      return;
    }
    setSaving(true);
    try {
      const updated = await StaffAssistantModel.update(formData);
      setAssistant(updated);
      setIsEditing(false);
      notify.success('Your changes have been saved.');
    } catch (err: any) {
      console.error('Update assistant error:', err);
      notify.error(err.response?.data?.error || 'Failed to update assistant.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const result = await Swal.fire({
      title: 'Delete Assistant?',
      text: 'This will permanently delete your AI assistant and all its configuration.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Yes, delete it',
      cancelButtonText: 'Cancel',
      focusCancel: true,
    });
    if (!result.isConfirmed) return;

    setSaving(true);
    try {
      await StaffAssistantModel.delete();
      setAssistant(null);
      setIsEditing(false);
      setFormData({
        name: '',
        description: '',
        personality: 'professional',
        personality_flare: '',
        primary_goal: '',
        custom_greeting: '',
        voice_style: 'concise',
        tts_voice: 'nova',
        preferred_model: '',
      });
      notify.success('Your assistant has been removed.');
    } catch (err: any) {
      console.error('Delete assistant error:', err);
      notify.error(err.response?.data?.error || 'Failed to delete assistant.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12">
        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-picton-blue to-indigo-500 flex items-center justify-center animate-pulse">
            <SparklesIcon className="h-6 w-6 text-white" />
          </div>
          <span className="text-sm text-gray-500">Loading assistant…</span>
        </div>
      </div>
    );
  }

  // ── No assistant yet → show create card ────────────────────────────────
  if (!assistant && !isEditing) {
    return (
      <div className="space-y-6">
        {/* Hero create card */}
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-800 via-indigo-900 to-slate-800 rounded-2xl shadow-lg p-8">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')] opacity-50" />
          <div className="relative text-center max-w-lg mx-auto">
            <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-picton-blue to-indigo-500 flex items-center justify-center mb-5 shadow-lg shadow-picton-blue/25">
              <SparklesIcon className="h-10 w-10 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">Create Your Staff AI Assistant</h3>
            <p className="text-indigo-200 mb-6 leading-relaxed">
              Set up a personal AI assistant with a custom personality, voice style, and greeting.
              Access 67 tools across 11 categories — from task management to bug tracking — all via voice on mobile.
            </p>
            <button
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-slate-900 text-sm font-semibold rounded-xl hover:bg-gray-100 transition-all shadow-lg"
            >
              <RocketLaunchIcon className="h-5 w-5" />
              Get Started
            </button>
          </div>
        </div>

        {/* How it works */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <LightBulbIcon className="h-4 w-4 text-amber-500" />
            How It Works
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { step: '1', title: 'Customize', desc: 'Set a name, personality, and voice style' },
              { step: '2', title: 'Connect', desc: 'Open the mobile app and start a conversation' },
              { step: '3', title: 'Automate', desc: 'Manage tasks, cases, leads, and more by voice' },
            ].map(s => (
              <div key={s.step} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-picton-blue text-white text-xs font-bold flex items-center justify-center">
                  {s.step}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{s.title}</p>
                  <p className="text-xs text-gray-500">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Capabilities preview */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <CommandLineIcon className="h-4 w-4 text-picton-blue" />
            Available Capabilities
            <span className="ml-auto text-xs font-normal text-gray-400">67 tools • 11 categories</span>
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {STAFF_TOOL_CATEGORIES.map(cat => (
              <div key={cat.name} className="text-center p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                <div className={`mx-auto w-9 h-9 rounded-lg ${cat.color} flex items-center justify-center mb-2`}>
                  <cat.icon className="h-4.5 w-4.5 text-white" />
                </div>
                <p className="text-xs font-medium text-gray-700">{cat.name}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Assistant exists (view mode) ───────────────────────────────────────
  if (assistant && !isEditing) {
    const totalTools = STAFF_TOOL_CATEGORIES.reduce((sum, c) => sum + c.tools.length, 0);

    return (
      <div className="space-y-6">
        {/* ── Main Assistant Card ─────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Gradient header */}
          <div className="relative bg-gradient-to-r from-slate-800 via-indigo-900 to-slate-800 p-6">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')] opacity-50" />
            <div className="relative flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-picton-blue to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-picton-blue/25">
                  <SparklesIcon className="h-7 w-7" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">{assistant.name}</h3>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      assistant.status === 'active'
                        ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30'
                        : 'bg-gray-500/20 text-gray-300 ring-1 ring-gray-500/30'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${assistant.status === 'active' ? 'bg-emerald-400' : 'bg-gray-400'}`} />
                      {assistant.status === 'active' ? 'Active' : assistant.status}
                    </span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/10 text-indigo-200 ring-1 ring-white/10">
                      {assistant.personality || 'professional'}
                    </span>
                    {assistant.voice_style && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/10 text-purple-200 ring-1 ring-white/10">
                        {assistant.voice_style}
                      </span>
                    )}
                    {assistant.tts_voice && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/30">
                        <SpeakerWaveIcon className="h-3 w-3" />
                        {assistant.tts_voice}
                      </span>
                    )}
                    {assistant.tier && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/30">
                        {assistant.tier}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={openChat}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-picton-blue/30 rounded-xl hover:bg-picton-blue/50 transition-colors ring-1 ring-picton-blue/40"
                >
                  <ChatBubbleLeftRightIcon className="h-4 w-4" />
                  Chat
                </button>
                <button
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-white/10 rounded-xl hover:bg-white/20 transition-colors ring-1 ring-white/10"
                >
                  <PencilIcon className="h-4 w-4" />
                  Edit
                </button>
                <button
                  onClick={handleDelete}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-red-300 bg-red-500/10 rounded-xl hover:bg-red-500/20 transition-colors ring-1 ring-red-500/20 disabled:opacity-50"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Quick stats strip */}
          <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
            <div className="p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{totalTools}</p>
              <p className="text-xs text-gray-500 mt-0.5">Tools Available</p>
            </div>
            <div className="p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{STAFF_TOOL_CATEGORIES.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Categories</p>
            </div>
            <div className="p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">
                {assistant.pages_indexed ?? 0}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">Pages Indexed</p>
            </div>
          </div>

          {/* Details section */}
          <div className="p-6 space-y-4">
            {assistant.description && (
              <div>
                <dt className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Description</dt>
                <dd className="mt-1 text-sm text-gray-700 leading-relaxed">{assistant.description}</dd>
              </div>
            )}
            {assistant.primary_goal && (
              <div>
                <dt className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Primary Goal</dt>
                <dd className="mt-1 text-sm text-gray-700 leading-relaxed">{assistant.primary_goal}</dd>
              </div>
            )}
            {assistant.custom_greeting && (
              <div>
                <dt className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Custom Greeting</dt>
                <dd className="mt-1 text-sm text-gray-700 italic bg-gray-50 rounded-lg p-3 border-l-4 border-picton-blue">
                  "{assistant.custom_greeting}"
                </dd>
              </div>
            )}
            {assistant.personality_flare && (
              <div>
                <dt className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Personality Flare</dt>
                <dd className="mt-1 text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{assistant.personality_flare}</dd>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 pt-2">
              {assistant.preferred_model && (
                <div>
                  <dt className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Model</dt>
                  <dd className="mt-1 text-sm text-gray-700 font-mono bg-gray-50 rounded-md px-2 py-1 inline-block">{assistant.preferred_model}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Created</dt>
                <dd className="mt-1 text-sm text-gray-700">
                  {new Date(assistant.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                </dd>
              </div>
            </div>
          </div>
        </div>

        {/* ── Capabilities Panel ──────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <button
            onClick={() => setShowCapabilities(!showCapabilities)}
            className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-picton-blue to-indigo-500 flex items-center justify-center">
                <CommandLineIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-900">Available Capabilities</h4>
                <p className="text-xs text-gray-500">{totalTools} tools across {STAFF_TOOL_CATEGORIES.length} categories</p>
              </div>
            </div>
            {showCapabilities ? (
              <ChevronUpIcon className="h-5 w-5 text-gray-400" />
            ) : (
              <ChevronDownIcon className="h-5 w-5 text-gray-400" />
            )}
          </button>

          {showCapabilities && (
            <div className="border-t border-gray-100 p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {STAFF_TOOL_CATEGORIES.map(cat => (
                  <div key={cat.name} className="flex items-start gap-3 p-3.5 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className={`flex-shrink-0 w-9 h-9 rounded-lg ${cat.color} flex items-center justify-center`}>
                      <cat.icon className="h-4.5 w-4.5 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900">{cat.name}</p>
                      <p className="text-xs text-gray-500 mb-1.5">{cat.description}</p>
                      <div className="flex flex-wrap gap-1">
                        {cat.tools.map(tool => (
                          <span key={tool} className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium ring-1 ${cat.lightColor}`}>
                            {tool}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pro tip */}
              <div className="mt-4 flex items-start gap-3 p-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60">
                <LightBulbIcon className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-900">Pro Tip</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Use natural language on mobile — say things like "create a task for John" or "show me this month's invoices".
                    Your assistant understands context and can chain multiple tools together.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Webhook / Integration Info ──────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0">
              <CogIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-900">Webhooks & Integrations</h4>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                Enterprise webhook endpoints can be generated through the AI assistant using the
                "Generate Endpoint" tool. Webhooks support inbound data from external services like
                payment gateways, form providers, and monitoring tools. Ask your assistant to
                <span className="font-medium text-gray-700"> "generate an enterprise endpoint for [service]"</span> to get started.
              </p>
              <div className="flex items-center gap-3 mt-3">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                  <CheckCircleIcon className="h-3.5 w-3.5" /> Inbound Webhooks
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                  <CheckCircleIcon className="h-3.5 w-3.5" /> Auto-Processing
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                  <CheckCircleIcon className="h-3.5 w-3.5" /> Field Mapping
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Chat Modal */}
        {renderChatModal()}
      </div>
    );
  }

  // ── Create / Edit form ─────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Form header */}
        <div className="bg-gradient-to-r from-slate-50 to-gray-50 border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-picton-blue to-indigo-500 flex items-center justify-center">
              <SparklesIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {assistant ? 'Edit Assistant' : 'Create Your AI Assistant'}
              </h2>
              <p className="text-xs text-gray-500">
                {assistant ? 'Update your assistant\'s personality and behavior' : 'Customize how your assistant thinks and speaks'}
              </p>
            </div>
          </div>
          {(assistant || isEditing) && (
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                if (assistant) {
                  setFormData({
                    name: assistant.name || '',
                    description: assistant.description || '',
                    personality: assistant.personality || 'professional',
                    personality_flare: assistant.personality_flare || '',
                    primary_goal: assistant.primary_goal || '',
                    custom_greeting: assistant.custom_greeting || '',
                    voice_style: assistant.voice_style || 'concise',
                    tts_voice: assistant.tts_voice || 'nova',
                    preferred_model: assistant.preferred_model || '',
                  });
                }
              }}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>

        <div className="p-6 space-y-8">
          {/* ── Section: Identity ─────────────────────────────── */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <UserIcon className="h-4 w-4 text-picton-blue" />
              <h3 className="text-sm font-semibold text-gray-900">Identity</h3>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assistant Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="block w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-picton-blue/20 focus:border-picton-blue text-sm transition-colors"
                  placeholder="e.g. My Work Assistant"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={formData.description || ''}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  className="block w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-picton-blue/20 focus:border-picton-blue text-sm transition-colors"
                  placeholder="Short description of what this assistant does"
                />
              </div>

              {/* Primary Goal */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Primary Goal</label>
                <input
                  type="text"
                  value={formData.primary_goal || ''}
                  onChange={(e) => handleInputChange('primary_goal', e.target.value)}
                  className="block w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-picton-blue/20 focus:border-picton-blue text-sm transition-colors"
                  placeholder="e.g. Help me manage tasks and answer technical questions"
                />
              </div>
            </div>
          </div>

          {/* ── Section: Personality & Voice ──────────────────── */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <ChatBubbleLeftRightIcon className="h-4 w-4 text-purple-500" />
              <h3 className="text-sm font-semibold text-gray-900">Personality & Voice</h3>
              <div className="flex-1 h-px bg-gray-100" />
            </div>

            {/* Personality cards */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Personality</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {PERSONALITY_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleInputChange('personality', opt.value)}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      formData.personality === opt.value
                        ? 'border-picton-blue bg-picton-blue/5 ring-2 ring-picton-blue/20'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <p className={`text-sm font-semibold ${formData.personality === opt.value ? 'text-picton-blue' : 'text-gray-900'}`}>
                      {opt.label}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Voice Style cards */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Voice Style</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {VOICE_STYLE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleInputChange('voice_style', opt.value)}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${
                      formData.voice_style === opt.value
                        ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-500/20'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <p className={`text-sm font-semibold ${formData.voice_style === opt.value ? 'text-purple-600' : 'text-gray-900'}`}>
                      {opt.label}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* TTS Voice Picker */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">TTS Voice</label>
              <p className="text-xs text-gray-500 mb-2">Choose the voice for text-to-speech playback. Click the play button to preview each voice.</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {TTS_VOICE_OPTIONS.map(opt => (
                  <div
                    key={opt.value}
                    className={`relative p-3 rounded-xl border-2 transition-all cursor-pointer ${
                      formData.tts_voice === opt.value
                        ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                    onClick={() => handleInputChange('tts_voice', opt.value)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-semibold ${formData.tts_voice === opt.value ? 'text-emerald-700' : 'text-gray-900'}`}>
                          {opt.label}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); previewVoice(opt.value); }}
                        className={`ml-2 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                          previewingVoice === opt.value
                            ? 'bg-emerald-500 text-white'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                        }`}
                        title={previewingVoice === opt.value ? 'Stop preview' : `Preview ${opt.label}`}
                      >
                        {previewingVoice === opt.value ? (
                          <StopCircleIcon className="h-4 w-4" />
                        ) : (
                          <PlayIcon className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {formData.tts_voice === opt.value && (
                      <div className="absolute top-1.5 right-1.5">
                        <CheckCircleIcon className="h-4 w-4 text-emerald-500" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Personality Flare */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Personality Flare
              </label>
              <p className="text-xs text-gray-500 mb-1.5">
                Custom tone instructions that shape how your assistant speaks. This is stitched into the AI prompt at runtime.
              </p>
              <textarea
                value={formData.personality_flare || ''}
                onChange={(e) => handleInputChange('personality_flare', e.target.value)}
                rows={3}
                className="block w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-picton-blue/20 focus:border-picton-blue text-sm transition-colors"
                placeholder="e.g. Always use bullet points. Keep answers under 3 sentences. Use South African English."
              />
              {assistant && (
                <button
                  type="button"
                  onClick={openFlareHelper}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-picton-blue hover:text-picton-blue/80 transition-colors"
                >
                  <SparklesIcon className="h-3.5 w-3.5" />
                  Help me write this with AI
                </button>
              )}
            </div>
          </div>

          {/* ── Section: Greeting & Model ─────────────────────── */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <CogIcon className="h-4 w-4 text-emerald-500" />
              <h3 className="text-sm font-semibold text-gray-900">Greeting & Model</h3>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
            <div className="space-y-4">
              {/* Custom Greeting */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Custom Greeting</label>
                <input
                  type="text"
                  value={formData.custom_greeting || ''}
                  onChange={(e) => handleInputChange('custom_greeting', e.target.value)}
                  className="block w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-picton-blue/20 focus:border-picton-blue text-sm transition-colors"
                  placeholder="e.g. Hey there! What can I help you with today?"
                />
                <p className="text-xs text-gray-400 mt-1">First message your assistant sends when starting a conversation</p>
              </div>

              {/* Preferred Model */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Model</label>
                <p className="text-xs text-gray-500 mb-1.5">
                  Leave blank to use the system default.
                </p>
                <input
                  type="text"
                  value={formData.preferred_model || ''}
                  onChange={(e) => handleInputChange('preferred_model', e.target.value)}
                  className="block w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-picton-blue/20 focus:border-picton-blue text-sm font-mono transition-colors"
                  placeholder="e.g. deepseek-r1:8b"
                />
              </div>
            </div>
          </div>

          {/* ── Actions ───────────────────────────────────────── */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <InformationCircleIcon className="h-4 w-4" />
              Changes take effect on your next mobile conversation
            </div>
            <button
              type="button"
              onClick={assistant ? handleUpdate : handleCreate}
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-picton-blue to-indigo-500 text-white text-sm font-semibold rounded-xl hover:from-picton-blue/90 hover:to-indigo-500/90 transition-all shadow-md shadow-picton-blue/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Saving…
                </>
              ) : assistant ? (
                'Save Changes'
              ) : (
                <>
                  <SparklesIcon className="h-4 w-4" />
                  Create Assistant
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Chat Modal */}
      {renderChatModal()}
    </div>
  );
};

// ============================================================================
// Profile Page (with Tabs)
// ============================================================================

// ============================================================================
// Mailboxes Tab Component
// ============================================================================

const MailboxesTab: React.FC = () => {
  const { user } = useAppStore();
  const [mailboxes, setMailboxes] = useState<MailboxAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [testing, setTesting] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [signatureMode, setSignatureMode] = useState<'visual' | 'code'>('visual');
  const [formData, setFormData] = useState<CreateMailboxInput>({
    display_name: '', email_address: '',
    password: '',
    signature: '',
    is_default: false,
  });

  const loadMailboxes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await WebmailAccountModel.list();
      setMailboxes(data);
    } catch (err) {
      console.error('Failed to load mailboxes:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMailboxes(); }, [loadMailboxes]);

  const resetForm = () => {
    setFormData({
      display_name: '', email_address: '',
      password: '',
      signature: '',
      is_default: false,
    });
    setEditingId(null);
    setShowForm(false);
    setTestResult(null);
  };

  const handleEdit = (m: MailboxAccount) => {
    setFormData({
      display_name: m.display_name, email_address: m.email_address,
      password: '',
      signature: m.signature || '',
      is_default: m.is_default,
    });
    setEditingId(m.id);
    setShowForm(true);
    setTestResult(null);
  };

  const handleSave = async () => {
    if (!formData.display_name || !formData.email_address) {
      notify.warning('Display name and email are required.');
      return;
    }
    try {
      if (editingId) {
        const updates: any = { display_name: formData.display_name, email_address: formData.email_address, is_default: !!formData.is_default, signature: formData.signature ?? '' };
        if (formData.password) updates.password = formData.password;
        await WebmailAccountModel.update(editingId, updates);
      } else {
        if (!formData.password) {
          notify.warning('Password is required for new mailbox.');
          return;
        }
        await WebmailAccountModel.create(formData);
      }
      notify.success('Saved');
      resetForm();
      loadMailboxes();
    } catch (err: any) {
      notify.error(err.response?.data?.error || 'Save failed');
    }
  };

  const handleDelete = async (id: number) => {
    const r = await Swal.fire({
      title: 'Remove Mailbox?', text: 'This only removes the connection. Your emails on the server are unaffected.',
      icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Remove',
    });
    if (!r.isConfirmed) return;
    try {
      await WebmailAccountModel.delete(id);
      loadMailboxes();
    } catch (err: any) {
      notify.error(err.response?.data?.error || 'Delete failed');
    }
  };

  const handleTest = async (id: number) => {
    setTesting(id);
    setTestResult(null);
    try {
      const result = await WebmailAccountModel.testConnection(id);
      setTestResult(result);
      if (result.imap.connected && result.smtp.connected) {
        notify.success('IMAP and SMTP connected successfully.');
      } else {
        notify.warning(
          `IMAP: ${result.imap.connected ? '✅' : '❌ ' + result.imap.message} | ` +
          `SMTP: ${result.smtp.connected ? '✅' : '❌ ' + result.smtp.message}`
        );
      }
    } catch (err: any) {
      notify.error(err.response?.data?.error || err.message);
    } finally {
      setTesting(null);
      loadMailboxes();
    }
  };

  const handleSetDefault = async (id: number) => {
    try {
      await WebmailAccountModel.setDefault(id);
      loadMailboxes();
    } catch (err: any) {
      notify.error('Failed to set default');
    }
  };

  const handleFieldChange = (field: keyof CreateMailboxInput, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-picton-blue" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Mailbox list */}
      {mailboxes.length > 0 && !showForm && (
        <div className="bg-white shadow rounded-lg divide-y">
          {mailboxes.map(m => (
            <div key={m.id} className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-picton-blue/10 flex items-center justify-center flex-shrink-0">
                <EnvelopeIcon className="w-5 h-5 text-picton-blue" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 truncate">{m.display_name}</span>
                  {!!m.is_default && <span className="text-xs bg-picton-blue/10 text-picton-blue px-2 py-0.5 rounded-full font-medium">Default</span>}
                  {!m.is_active && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Disabled</span>}
                </div>
                <p className="text-sm text-gray-500 truncate">{m.email_address}</p>
                {m.connection_error && <p className="text-xs text-red-500 mt-0.5 truncate">{m.connection_error}</p>}
                {m.last_connected_at && !m.connection_error && <p className="text-xs text-green-600 mt-0.5">Last connected: {new Date(m.last_connected_at).toLocaleDateString()}</p>}
                {m.signature && <p className="text-xs text-gray-400 mt-0.5">✏️ Signature configured</p>}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {!m.is_default && (
                  <button onClick={() => handleSetDefault(m.id)} className="p-1.5 text-xs text-gray-400 hover:text-picton-blue rounded" title="Set as default">
                    <CheckCircleIcon className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => handleTest(m.id)}
                  disabled={testing === m.id}
                  className="p-1.5 text-xs text-gray-400 hover:text-green-600 rounded disabled:opacity-50"
                  title="Test connection"
                >
                  {testing === m.id ? <span className="animate-spin inline-block w-4 h-4 border-2 border-gray-300 border-t-green-500 rounded-full" /> : <CheckCircleIcon className="w-4 h-4" />}
                </button>
                <button onClick={() => handleEdit(m)} className="p-1.5 text-xs text-gray-400 hover:text-picton-blue rounded" title="Edit">
                  <PencilIcon className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(m.id)} className="p-1.5 text-xs text-gray-400 hover:text-red-600 rounded" title="Remove">
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit form */}
      {showForm ? (
        <div className="bg-white shadow rounded-lg p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">{editingId ? 'Edit Mailbox' : 'Add Email Account'}</h3>
          <p className="text-sm text-gray-500">Add your email account. Server settings are managed by your administrator.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
              <input type="text" value={formData.display_name} onChange={e => handleFieldChange('display_name', e.target.value)}
                placeholder="e.g. Work Email" className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-picton-blue focus:border-picton-blue" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input type="email" value={formData.email_address} onChange={e => handleFieldChange('email_address', e.target.value)}
                placeholder="user@domain.com" className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-picton-blue focus:border-picton-blue" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password {editingId && <span className="text-gray-400">(leave blank to keep current)</span>}
            </label>
            <input type="password" value={formData.password} onChange={e => handleFieldChange('password', e.target.value)}
              placeholder="••••••••" className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-picton-blue focus:border-picton-blue" />
            <p className="text-xs text-gray-400 mt-1">Your email account password for IMAP/SMTP access</p>
          </div>

          {/* Default checkbox */}
          <div className="border-t pt-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={formData.is_default || false} onChange={e => handleFieldChange('is_default', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-picton-blue focus:ring-picton-blue" />
              <span className="text-sm text-gray-700">Set as default sending account</span>
            </label>
          </div>

          {/* Email Signature */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">
                Email Signature
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'Name';
                    const email = formData.email_address || user?.email || 'your_email@softaware.co.za';
                    const phone = (user as any)?.phone || '000000';
                    const tpl = `<table border="0">\n<tbody>\n<tr>\n<td style="padding-right: 10px;"><img src="https://softaware.co.za/assets/images/logo_small.png" /></td>\n<td style="border-left: 1px solid #666; padding-left: 10px;"><strong>${name}</strong><br /><strong>E:</strong> ${email}<br /><strong>P:</strong> ${phone}</td>\n</tr>\n</tbody>\n</table>`;
                    handleFieldChange('signature', tpl);
                    setSignatureMode('code');
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-picton-blue border border-picton-blue/30 rounded hover:bg-picton-blue/5 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /></svg>
                  Insert Template
                </button>
                <button
                  type="button"
                  onClick={() => setSignatureMode(signatureMode === 'visual' ? 'code' : 'visual')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded transition-colors ${signatureMode === 'code' ? 'text-white bg-gray-600' : 'text-gray-600 border border-gray-300 hover:bg-gray-50'}`}
                >
                  {signatureMode === 'code' ? '<>' : '</>'} {signatureMode === 'code' ? 'HTML Source' : 'View Source'}
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-400 mb-2">This HTML signature will be appended automatically to all outgoing emails from this account.</p>
            {signatureMode === 'code' ? (
              <div className="space-y-2">
                <textarea
                  value={formData.signature || ''}
                  onChange={(e) => handleFieldChange('signature', e.target.value)}
                  placeholder="Paste or edit raw HTML here…"
                  className="w-full h-40 px-3 py-2 text-sm font-mono bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-picton-blue focus:border-transparent resize-y"
                  spellCheck={false}
                />
                {formData.signature && (
                  <div className="border border-gray-200 rounded-lg p-3 bg-white">
                    <p className="text-xs text-gray-400 mb-1.5">Preview:</p>
                    <div dangerouslySetInnerHTML={{ __html: formData.signature }} />
                  </div>
                )}
              </div>
            ) : (
              <RichTextEditor
                value={formData.signature || ''}
                onChange={(val) => handleFieldChange('signature', val)}
                placeholder="Compose your email signature…"
              />
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 border-t pt-4">
            <button onClick={resetForm} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
            <button onClick={handleSave} className="px-5 py-2 text-sm font-medium text-white bg-picton-blue rounded-lg hover:bg-picton-blue/90">
              {editingId ? 'Update Mailbox' : 'Add Mailbox'}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-picton-blue border-2 border-dashed border-picton-blue/30 rounded-lg hover:bg-picton-blue/5 w-full justify-center"
        >
          <PlusIcon className="w-4 h-4" />
          Add Email Account
        </button>
      )}
    </div>
  );
};

// ============================================================================
// Profile Component
// ============================================================================

const Profile: React.FC = () => {
  const { user, setUser } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [viewAsRole, setViewAsRoleState] = useState<string>(getViewAsRole() || '');
  const [activeTab, setActiveTab] = useState<ProfileTab>('profile');

  const isStaffOrAdmin = user?.is_staff || user?.is_admin;
  const isStaff = !!user?.is_staff;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<ProfileFormData>();

  useEffect(() => {
    if (user) {
      reset({
        username: user.username || '',
        email: user.email || '',
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        phone: (user as any).phone || '',
        notifications_enabled: (user as any).notifications_enabled ?? true,
        push_notifications_enabled: (user as any).push_notifications_enabled ?? true,
        web_notifications_enabled: (user as any).web_notifications_enabled ?? true,
      });
    }
  }, [user, reset]);

  const onSubmit = async (data: ProfileFormData) => {
    setLoading(true);
    setSaved(false);

    try {
      // Update user profile via API
      const response = await AuthModel.updateProfile(data);
      
      if (response.success) {
        // Re-fetch the complete user from the server so is_admin, role,
        // permissions etc. are all present, then persist to localStorage
        // so Zustand and localStorage stay in sync (prevents logout).
        try {
          const token = AuthModel.getToken();
          const fresh = await AuthModel.me();
          if (token && fresh.user) {
            AuthModel.storeAuth(token, fresh.user);
            setUser(fresh.user);
          }
        } catch {
          // Fallback: merge form data into existing user in both stores
          const merged = { ...user!, ...data };
          const token = AuthModel.getToken();
          if (token) AuthModel.storeAuth(token, merged as any);
          setUser(merged as any);
        }

        setSaved(true);
        setTimeout(() => setSaved(false), 3000);

        notify.success('Profile updated successfully');
      }
    } catch (error: any) {
      console.error('Failed to update profile:', error);
      notify.error(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const getUserInitials = () => {
    if (user?.first_name && user?.last_name) {
      return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
    } else if (user?.username) {
      return user.username.substring(0, 2).toUpperCase();
    }
    return 'U';
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-picton-blue to-picton-blue/80 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center space-x-4">
          {/* Avatar */}
          <div className="flex-shrink-0">
            {(user as any)?.avatar ? (
              <img
                src={(user as any).avatar}
                alt={user?.username}
                className="h-20 w-20 rounded-full object-cover border-4 border-white/20"
              />
            ) : (
              <div className="h-20 w-20 rounded-full bg-white/20 text-white flex items-center justify-center text-2xl font-bold border-4 border-white/20 backdrop-blur-sm">
                {getUserInitials()}
              </div>
            )}
          </div>

          {/* User Info */}
          <div className="flex-1">
            <h1 className="text-3xl font-bold mb-2">
              {user?.first_name && user?.last_name
                ? `${user.first_name} ${user.last_name}`
                : user?.username}
            </h1>
            <p className="text-white/90">{user?.email}</p>
            {user?.role && (
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-white/20 backdrop-blur-sm">
                  {user.role.name}
                </span>
                {(user?.is_staff || user?.is_admin) && viewAsRole && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/90 backdrop-blur-sm">
                    <EyeIcon className="h-3 w-3" /> Viewing as {getRoleLabel(viewAsRole)}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs (only show if staff/admin) */}
      {isStaffOrAdmin && (
        <div className="bg-white shadow rounded-lg">
          <nav className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('profile')}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'profile'
                  ? 'border-picton-blue text-picton-blue'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <UserIcon className="h-4 w-4" />
              Profile
            </button>
            <button
              onClick={() => setActiveTab('assistant')}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'assistant'
                  ? 'border-picton-blue text-picton-blue'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <SparklesIcon className="h-4 w-4" />
              AI Assistant
            </button>
            <button
              onClick={() => setActiveTab('mailboxes')}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'mailboxes'
                  ? 'border-picton-blue text-picton-blue'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <EnvelopeIcon className="h-4 w-4" />
              Mailboxes
            </button>
            {isStaff && (
              <button
                onClick={() => setActiveTab('payroll')}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'payroll'
                    ? 'border-picton-blue text-picton-blue'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <CurrencyDollarIcon className="h-4 w-4" />
                Payroll
              </button>
            )}
            {isStaff && (
              <button
                onClick={() => setActiveTab('leave')}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'leave'
                    ? 'border-picton-blue text-picton-blue'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <CalendarDaysIcon className="h-4 w-4" />
                Leave
              </button>
            )}
          </nav>
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'leave' && isStaff ? (
        <LeaveTab />
      ) : activeTab === 'payroll' && isStaff ? (
        <PayrollTab />
      ) : activeTab === 'mailboxes' && isStaffOrAdmin ? (
        <MailboxesTab />
      ) : activeTab === 'assistant' && isStaffOrAdmin ? (
        <StaffAssistantTab />
      ) : (
        /* Profile Form */
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Profile Information</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <UserIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  {...register('username', { required: 'Username is required' })}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-picton-blue focus:border-picton-blue"
                  placeholder="Enter username"
                />
              </div>
              {errors.username && (
                <p className="mt-1 text-sm text-red-600">{errors.username.message}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <EnvelopeIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  {...register('email', { 
                    required: 'Email is required',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Invalid email address'
                    }
                  })}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-picton-blue focus:border-picton-blue"
                  placeholder="Enter email address"
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            {/* First Name & Last Name */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name
                </label>
                <input
                  type="text"
                  {...register('first_name')}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-picton-blue focus:border-picton-blue"
                  placeholder="Enter first name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name
                </label>
                <input
                  type="text"
                  {...register('last_name')}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-picton-blue focus:border-picton-blue"
                  placeholder="Enter last name"
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <PhoneIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="tel"
                  {...register('phone')}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-picton-blue focus:border-picton-blue"
                  placeholder="Enter phone number"
                />
              </div>
            </div>

            {/* Notification Settings */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-4">
              <div className="flex items-start gap-3">
                <BellIcon className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">Notification Preferences</h3>
                  <p className="text-xs text-gray-600 mb-4">
                    Control how you receive task assignment and system notifications
                  </p>

                  <div className="space-y-3">
                    {/* Master Toggle */}
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        {...register('notifications_enabled')}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex items-center gap-2 flex-1">
                        <BellIcon className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium text-gray-900">Enable all notifications</span>
                      </div>
                    </label>

                    {/* Web Notifications */}
                    <label className="flex items-center gap-3 cursor-pointer group ml-7">
                      <input
                        type="checkbox"
                        {...register('web_notifications_enabled')}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex items-center gap-2 flex-1">
                        <ComputerDesktopIcon className="h-4 w-4 text-gray-500" />
                        <span className="text-sm text-gray-700">Web in-app notifications</span>
                      </div>
                    </label>

                    {/* Push Notifications */}
                    <label className="flex items-center gap-3 cursor-pointer group ml-7">
                      <input
                        type="checkbox"
                        {...register('push_notifications_enabled')}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex items-center gap-2 flex-1">
                        <DevicePhoneMobileIcon className="h-4 w-4 text-gray-500" />
                        <span className="text-sm text-gray-700">Push notifications (mobile & web)</span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* View As Role (Staff Only) */}
            {(user?.is_staff || user?.is_admin) && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <EyeIcon className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-amber-900 mb-1">Staff: View As Role</h3>
                    <p className="text-xs text-amber-700 mb-3">
                      Override your role temporarily to test workflow permissions from different user perspectives. 
                      This affects task assignment permissions and filters.
                    </p>
                    <div className="flex items-center gap-3">
                      <select
                        value={viewAsRole}
                        onChange={(e) => {
                          const newRole = e.target.value;
                          setViewAsRoleState(newRole);
                          setViewAsRole(newRole || null);
                          if (newRole) {
                            Swal.fire({
                              icon: 'info',
                              title: 'View As Role Active',
                              text: `You are now viewing as ${getRoleLabel(newRole)}. Refresh the page to see changes.`,
                              timer: 3000,
                              showConfirmButton: false
                            });
                          } else {
                            Swal.fire({
                              icon: 'info',
                              title: 'View As Role Disabled',
                              text: 'Viewing with your actual role. Refresh the page to see changes.',
                              timer: 3000,
                              showConfirmButton: false
                            });
                          }
                        }}
                        className="block px-3 py-2 border border-amber-300 rounded-lg text-sm focus:ring-amber-500 focus:border-amber-500 bg-white"
                      >
                        <option value="">Use My Actual Role</option>
                        <option value="client_manager">Client Manager</option>
                        <option value="qa_specialist">QA Specialist</option>
                        <option value="developer">Developer</option>
                      </select>
                      {viewAsRole && (
                        <button
                          type="button"
                          onClick={() => {
                            setViewAsRoleState('');
                            setViewAsRole(null);
                            Swal.fire({
                              icon: 'success',
                              title: 'Cleared',
                              text: 'View As Role has been cleared. Refresh to see changes.',
                              timer: 2000,
                              showConfirmButton: false
                            });
                          }}
                          className="px-3 py-2 text-xs font-medium text-amber-700 hover:text-amber-900 hover:bg-amber-100 rounded-lg transition-colors"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    {viewAsRole && (
                      <p className="text-xs text-amber-600 mt-2 font-medium">
                        Active: Viewing as {getRoleLabel(viewAsRole)} • Refresh the page to apply
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t">
              {saved && (
                <div className="flex items-center text-green-600 text-sm">
                  <CheckCircleIcon className="h-5 w-5 mr-1" />
                  Profile updated successfully
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center px-6 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-picton-blue hover:bg-picton-blue/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-picton-blue disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all duration-200"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Profile;
