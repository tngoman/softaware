import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  SparklesIcon,
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  XMarkIcon,
  CloudArrowUpIcon,
  LinkIcon,
  PencilIcon,
} from '@heroicons/react/24/outline';
import api from '../../services/api';
import Swal from 'sweetalert2';

interface IngestSource {
  type: 'url' | 'file' | 'text';
  label: string;
  file?: File;
  content?: string; // For pasted text
  category?: string; // ties to a checklist bucket
}

interface JobResult {
  jobId: string;
  source: string;
  queuePosition: number;
  tier: 'free' | 'paid';
}

interface IngestionJob {
  id: string;
  url?: string;
  filePath?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  pagesFound?: number;
  pagesIndexed?: number;
  error?: string;
  originalContent?: string;
}

interface KnowledgeHealth {
  score: number;
  checklist: Array<{
    key: string;
    label: string;
    satisfied: boolean;
    type: 'url' | 'file';
  }>;
  missing: string[];
  pagesIndexed: number;
  tier: 'free' | 'paid';
  pageLimit: number;
  storageFull: boolean;
}

/* Knowledge category definitions matching the backend persona templates */
const KNOWLEDGE_CATEGORIES = [
  { key: 'pricing_info',      emoji: '💰', label: 'Pricing / Rates',      hint: 'Pricing page, rate sheets, packages',        type: 'url' as const },
  { key: 'contact_details',   emoji: '📞', label: 'Contact Details',      hint: 'Contact page, business hours, location',      type: 'url' as const },
  { key: 'services_products', emoji: '🛒', label: 'Services / Products',  hint: 'Service descriptions, product catalog',       type: 'url' as const },
  { key: 'about_company',     emoji: '🏢', label: 'About / Company Info', hint: 'About page, team, company story',             type: 'url' as const },
];

interface FormData {
  name: string;
  description: string;
  businessType: string;
  personality: string;
  primaryGoal: string;
  website: string;
}

const steps = [
  { label: 'Details', icon: SparklesIcon },
  { label: 'Personality', icon: ChatBubbleLeftRightIcon },
  { label: 'Knowledge', icon: DocumentTextIcon },
  { label: 'Status', icon: CheckIcon },
];

const CreateAssistant: React.FC = () => {
  const { assistantId } = useParams<{ assistantId: string }>();
  const navigate = useNavigate();
  const isEdit = !!assistantId;
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [createdAssistantId, setCreatedAssistantId] = useState<string | null>(null); // Track created assistant
  const [form, setForm] = useState<FormData>({
    name: '',
    description: '',
    businessType: '',
    personality: 'professional',
    primaryGoal: 'customer_support',
    website: '',
  });

  // Knowledge base state
  const [sources, setSources] = useState<IngestSource[]>([]);
  const [ingestResults, setIngestResults] = useState<JobResult[]>([]);
  const [ingestionJobs, setIngestionJobs] = useState<IngestionJob[]>([]);
  const [knowledgeHealth, setKnowledgeHealth] = useState<KnowledgeHealth | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [activeInputTab, setActiveInputTab] = useState<'url' | 'text' | 'file'>('url');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEdit) loadAssistant();
  }, [assistantId]);

  const loadAssistant = async () => {
    try {
      const res = await api.get(`/assistants/${assistantId}`);
      const a = res.data.assistant || res.data;
      if (a) {
        setForm({
          name: a.name || '',
          description: a.description || '',
          businessType: a.businessType || '',
          personality: a.personality || 'professional',
          primaryGoal: a.primaryGoal || 'customer_support',
          website: a.website || '',
        });
      }

      // Load existing ingestion jobs/sources
      try {
        const jobsRes = await api.get(`/assistants/${assistantId}/ingest/status`);
        const jobs = (jobsRes.data.jobs || []).map((j: any) => ({
          id: j.id,
          url: j.job_type === 'url' ? j.source : undefined,
          filePath: j.job_type === 'file' ? j.source : undefined,
          status: j.status,
          pagesIndexed: j.chunks_created || 0,
          error: j.error_message || undefined,
          originalContent: j.original_content || undefined,
        }));
        
        // Convert jobs to sources for editing
        const existingSources: IngestSource[] = jobs.map((j: IngestionJob) => {
          if (j.url) {
            return { type: 'url', label: j.url };
          } else if (j.filePath) {
            // Distinguish between uploaded files and pasted text
            // Text content uploaded as files typically have simple names without extensions
            const isLikelyText = j.filePath && !j.filePath.match(/\.(pdf|docx?|txt)$/i) && !j.filePath.includes('/');
            return {
              type: isLikelyText ? 'text' : 'file',
              label: j.filePath,
              // Note: We can't recover the original text content from completed jobs
            };
          }
          return { type: 'file', label: 'Unknown' };
        });
        
        setSources(existingSources);
        setIngestionJobs(jobs);
      } catch (err) {
        console.log('No existing ingestion jobs found');
      }
    } catch (err) {
      console.error('Failed to load assistant:', err);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const categorySelect = document.getElementById('file-upload-category') as HTMLSelectElement;
    const category = categorySelect?.value || '';
    
    for (const file of files) {
      if (sources.find((s) => s.label === file.name)) continue;
      setSources((prev) => [...prev, { type: 'file', label: file.name, file, category }]);
    }
    e.target.value = '';
    if (categorySelect) categorySelect.value = '';
  };

  const removeSource = async (label: string) => {
    // Check if this is an existing job that needs to be deleted from backend
    const existingJob = ingestionJobs.find(j => (j.url === label || j.filePath === label));
    
    if (existingJob && (assistantId || createdAssistantId)) {
      const currentAssistantId = assistantId || createdAssistantId;
      try {
        await api.delete(`/assistants/${currentAssistantId}/ingest/job/${existingJob.id}`);
        setIngestionJobs(prev => prev.filter(j => j.id !== existingJob.id));
      } catch (err) {
        console.error('Failed to delete job from backend:', err);
        Swal.fire({ icon: 'error', title: 'Delete Failed', text: 'Could not remove this source from the knowledge base', timer: 2000 });
        return;
      }
    }
    
    setSources((prev) => prev.filter((s) => s.label !== label));
  };

  const canProceed = () => {
    if (step === 0) return form.name.trim().length > 0 && form.description.trim().length > 0;
    return true;
  };

  // Incremental save on "Next" button
  const handleNext = async () => {
    if (!canProceed()) return;
    
    setSaving(true);
    try {
      const currentAssistantId = assistantId || createdAssistantId;

      // Full payload used for both create and update
      const fullPayload = {
        name: form.name,
        description: form.description,
        businessType: form.businessType || 'other',
        personality: form.personality,
        primaryGoal: form.primaryGoal,
        website: form.website,
      };

      // Step 0 -> 1: Create/update assistant with details
      if (step === 0) {
        if (isEdit && assistantId) {
          await api.put(`/assistants/${assistantId}/update`, fullPayload);
        } else if (createdAssistantId) {
          await api.put(`/assistants/${createdAssistantId}/update`, fullPayload);
        } else {
          const res = await api.post('/assistants/create', fullPayload);
          const newId = res.data.assistantId || res.data.assistant?.id || res.data.id;
          setCreatedAssistantId(newId);
        }
      }

      // Step 1 -> 2: Update personality settings
      if (step === 1 && currentAssistantId) {
        await api.put(`/assistants/${currentAssistantId}/update`, fullPayload);
      }

      // Step 2 -> 3: Ensure assistant exists, then submit ingestion jobs
      if (step === 2) {
        let ingestAssistantId = currentAssistantId;
        if (!ingestAssistantId) {
          // Assistant wasn't created yet (user may have jumped tabs) — create now
          const res = await api.post('/assistants/create', fullPayload);
          ingestAssistantId = res.data.assistantId || res.data.assistant?.id || res.data.id;
          setCreatedAssistantId(ingestAssistantId);
        }

        if (ingestAssistantId && sources.length > 0) {
          const results: JobResult[] = [];
          for (const src of sources) {
            try {
              if (src.type === 'url') {
                const r = await api.post(`/assistants/${ingestAssistantId}/ingest/url`, { 
                  url: src.label, 
                  tier: 'free' 
                });
                results.push({
                  jobId: r.data.jobId,
                  source: src.label,
                  queuePosition: r.data.queuePosition,
                  tier: 'free',
                });
              } else if (src.type === 'text' && src.content) {
                // Create a text file blob and submit as file upload
                const textBlob = new Blob([src.content], { type: 'text/plain' });
                const textFile = new File([textBlob], src.label, { type: 'text/plain' });
                const fd = new FormData();
                fd.append('file', textFile);
                fd.append('tier', 'free');
                const r = await api.post(`/assistants/${ingestAssistantId}/ingest/file`, fd, {
                  headers: { 'Content-Type': 'multipart/form-data' },
                });
                results.push({
                  jobId: r.data.jobId,
                  source: src.label,
                  queuePosition: r.data.queuePosition,
                  tier: 'free',
                });
              } else if (src.file) {
                const fd = new FormData();
                fd.append('file', src.file);
                fd.append('tier', 'free');
                const r = await api.post(`/assistants/${ingestAssistantId}/ingest/file`, fd, {
                  headers: { 'Content-Type': 'multipart/form-data' },
                });
                results.push({
                  jobId: r.data.jobId,
                  source: src.label,
                  queuePosition: r.data.queuePosition,
                  tier: 'free',
                });
              }
            } catch (e) {
              console.warn('Ingest job failed for', src.label, e);
            }
          }
          setIngestResults(results);
          // Load status immediately after submitting jobs
          await loadAssistantStatus();
        }
      }

      setStep(s => Math.min(steps.length - 1, s + 1));
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to save progress.';
      Swal.fire({ icon: 'error', title: 'Error', text: msg });
    } finally {
      setSaving(false);
    }
  };

  // Load assistant status (ingestion jobs + knowledge health)
  const loadAssistantStatus = async () => {
    const currentAssistantId = assistantId || createdAssistantId;
    if (!currentAssistantId) return;

    // Only show spinner on initial load, not on subsequent polls
    if (ingestionJobs.length === 0 && !knowledgeHealth) {
      setLoadingStatus(true);
    }
    try {
      // Fetch ingestion jobs via the ingest status endpoint
      const jobsRes = await api.get(`/assistants/${currentAssistantId}/ingest/status`);
      const jobs = (jobsRes.data.jobs || []).map((j: any) => ({
        id: j.id,
        url: j.job_type === 'url' ? j.source : undefined,
        filePath: j.job_type === 'file' ? j.source : undefined,
        status: j.status,
        pagesIndexed: j.chunks_created || 0,
        error: j.error_message || undefined,
      }));
      setIngestionJobs(jobs);

      // Fetch knowledge health
      try {
        const healthRes = await api.get(`/assistants/${currentAssistantId}/knowledge-health`);
        setKnowledgeHealth(healthRes.data);
      } catch {
        // knowledge-health may not return data yet, that's ok
      }
    } catch (err) {
      console.error('Failed to load status:', err);
    } finally {
      setLoadingStatus(false);
    }
  };

  // Poll status when on step 3
  useEffect(() => {
    if (step === 3) {
      loadAssistantStatus();
      const interval = setInterval(loadAssistantStatus, 5000); // Poll every 5s
      return () => clearInterval(interval);
    }
  }, [step]);

  const inputClass =
    'w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-picton-blue focus:border-picton-blue transition-all text-sm';

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Back */}
      <Link
        to="/portal/assistants"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back to Assistants
      </Link>

      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {isEdit ? 'Edit Assistant' : 'Create Assistant'}
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {isEdit
            ? 'Update your assistant\'s details and knowledge base'
            : 'Set up a new AI chatbot for your business in a few steps'}
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1">
        {steps.map((s, i) => (
          <React.Fragment key={s.label}>
            <button
              onClick={() => setStep(i)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                i === step
                  ? 'bg-picton-blue text-white'
                  : i < step
                  ? 'bg-picton-blue/10 text-picton-blue hover:bg-picton-blue/20'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <s.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{s.label}</span>
            </button>
            {i < steps.length - 1 && <div className="flex-1 h-px bg-gray-200" />}
          </React.Fragment>
        ))}
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        {/* Step 0: Details */}
        {step === 0 && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Assistant Name *</label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="e.g. Sales Bot, Support Agent"
                className={inputClass}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Description *</label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="What does this assistant do? What business is it for?"
                rows={3}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Business Type</label>
              <select name="businessType" value={form.businessType} onChange={handleChange} className={inputClass}>
                <option value="">Select your business type</option>
                <option value="ecommerce">E-commerce</option>
                <option value="service">Service Business</option>
                <option value="saas">SaaS / Software</option>
                <option value="restaurant">Restaurant / Food</option>
                <option value="healthcare">Healthcare</option>
                <option value="education">Education</option>
                <option value="real_estate">Real Estate</option>
                <option value="other">Other</option>
              </select>
              {form.businessType && (
                <p className="mt-1.5 text-xs text-picton-blue/70">
                  ✨ We&apos;ll create a tailored knowledge checklist for your {form.businessType.replace('_', ' ')} assistant
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Website URL</label>
              <input
                name="website"
                value={form.website}
                onChange={handleChange}
                placeholder="https://yourwebsite.com"
                className={inputClass}
              />
            </div>
          </div>
        )}

        {/* Step 1: Personality */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Personality Style</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { id: 'professional', name: 'Professional', desc: 'Formal, business-oriented tone' },
                  { id: 'friendly', name: 'Friendly', desc: 'Warm, approachable, conversational' },
                  { id: 'expert', name: 'Expert', desc: 'Technical, knowledgeable, precise' },
                  { id: 'casual', name: 'Casual', desc: 'Relaxed, informal, easy-going' },
                ].map((p) => (
                  <div
                    key={p.id}
                    onClick={() => setForm((prev) => ({ ...prev, personality: p.id }))}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      form.personality === p.id
                        ? 'border-picton-blue bg-picton-blue/5'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <h4 className="font-semibold text-gray-900 text-sm">{p.name}</h4>
                    <p className="text-xs text-gray-500 mt-0.5">{p.desc}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Primary Goal</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { id: 'customer_support', name: 'Support', desc: 'Help customers with questions' },
                  { id: 'lead_generation', name: 'Lead Gen', desc: 'Qualify and capture leads' },
                  { id: 'information', name: 'Info', desc: 'Provide business information' },
                ].map((g) => (
                  <div
                    key={g.id}
                    onClick={() => setForm((prev) => ({ ...prev, primaryGoal: g.id }))}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      form.primaryGoal === g.id
                        ? 'border-picton-blue bg-picton-blue/5'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <h4 className="font-semibold text-gray-900 text-sm">{g.name}</h4>
                    <p className="text-xs text-gray-500 mt-0.5">{g.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Knowledge Base */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900">Knowledge Base</h3>
              <p className="text-sm text-gray-500 mt-1">
                Add information via URLs, pasted text, or uploaded files
              </p>
            </div>

            {/* Input Tabs */}
            <div className="flex items-center gap-2 border-b border-gray-200">
              {(['url', 'text', 'file'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveInputTab(tab)}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    activeInputTab === tab
                      ? 'border-picton-blue text-picton-blue'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab === 'url' && '🔗 URLs'}
                  {tab === 'text' && '📝 Paste Text'}
                  {tab === 'file' && '📎 Upload Files'}
                </button>
              ))}
            </div>

            {/* URL Input */}
            {activeInputTab === 'url' && (
              <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Add Single URL</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="url"
                        placeholder="https://yoursite.com/page"
                        className="w-full pl-10 pr-3 py-2.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-picton-blue focus:border-picton-blue"
                        id="single-url-input"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const input = e.target as HTMLInputElement;
                            const val = input.value.trim();
                            if (!val) return;
                            try { new URL(val); } catch { 
                              Swal.fire({ icon: 'warning', title: 'Invalid URL', text: 'Please enter a valid URL', timer: 2000 });
                              return; 
                            }
                            if (sources.find(s => s.label === val)) {
                              Swal.fire({ icon: 'info', title: 'Already Added', text: 'This URL is already in your list', timer: 2000 });
                              return;
                            }
                            setSources(prev => [...prev, { type: 'url', label: val }]);
                            input.value = '';
                          }
                        }}
                      />
                    </div>
                    <button
                      onClick={() => {
                        const input = document.getElementById('single-url-input') as HTMLInputElement;
                        const val = input?.value.trim();
                        if (!val) return;
                        try { new URL(val); } catch { 
                          Swal.fire({ icon: 'warning', title: 'Invalid URL', text: 'Please enter a valid URL', timer: 2000 });
                          return; 
                        }
                        if (sources.find(s => s.label === val)) {
                          Swal.fire({ icon: 'info', title: 'Already Added', text: 'This URL is already in your list', timer: 2000 });
                          return;
                        }
                        setSources(prev => [...prev, { type: 'url', label: val }]);
                        input.value = '';
                      }}
                      className="px-4 py-2.5 bg-picton-blue text-white text-sm font-medium rounded-lg hover:bg-picton-blue/90 transition-all"
                    >
                      Add
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Or Paste Multiple URLs (one per line)</label>
                  <select
                    id="bulk-url-category"
                    className="w-full px-3 py-2.5 mb-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-picton-blue focus:border-picton-blue"
                  >
                    <option value="">Select Category (applied to all)</option>
                    {KNOWLEDGE_CATEGORIES.map(cat => (
                      <option key={cat.key} value={cat.key}>
                        {cat.emoji} {cat.label}
                      </option>
                    ))}
                  </select>
                  <textarea
                    placeholder={'https://yoursite.com/pricing\nhttps://yoursite.com/contact\nhttps://yoursite.com/services'}
                    className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-picton-blue focus:border-picton-blue font-mono"
                    rows={5}
                    id="bulk-url-textarea"
                  />
                  <button
                    onClick={() => {
                      const textarea = document.getElementById('bulk-url-textarea') as HTMLTextAreaElement;
                      const categorySelect = document.getElementById('bulk-url-category') as HTMLSelectElement;
                      const category = categorySelect.value;
                      
                      if (!category) {
                        Swal.fire({ icon: 'warning', title: 'Select Category', text: 'Please select a category for these URLs', timer: 2000 });
                        return;
                      }
                      
                      const urls = textarea.value.split('\n').map(line => line.trim()).filter(line => line.length > 0);
                      
                      const validUrls: string[] = [];
                      const invalidUrls: string[] = [];
                      
                      urls.forEach(url => {
                        try {
                          new URL(url);
                          if (!sources.find(s => s.label === url)) {
                            validUrls.push(url);
                          }
                        } catch {
                          invalidUrls.push(url);
                        }
                      });
                      
                      if (validUrls.length > 0) {
                        setSources(prev => [...prev, ...validUrls.map(url => ({ type: 'url' as const, label: url, category }))]);
                        textarea.value = '';
                        categorySelect.value = '';
                        Swal.fire({ 
                          icon: 'success', 
                          title: 'URLs Added', 
                          text: `${validUrls.length} URL(s) added${invalidUrls.length > 0 ? ` (${invalidUrls.length} invalid)` : ''}`,
                          timer: 2000,
                          showConfirmButton: false
                        });
                      } else if (invalidUrls.length > 0) {
                        Swal.fire({ icon: 'warning', title: 'Invalid URLs', text: 'Please check your URLs and try again' });
                      }
                    }}
                    className="mt-2 w-full px-4 py-2.5 bg-picton-blue text-white text-sm font-medium rounded-lg hover:bg-picton-blue/90 transition-all"
                  >
                    Add All URLs
                  </button>
                </div>
              </div>
            )}

            {/* Text Input */}
            {activeInputTab === 'text' && (
              <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Paste Content (pricing, FAQ, policies, etc.)
                  </label>
                  <select
                    id="text-content-category"
                    className="w-full px-3 py-2.5 mb-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-picton-blue focus:border-picton-blue"
                  >
                    <option value="">Select Category</option>
                    {KNOWLEDGE_CATEGORIES.map(cat => (
                      <option key={cat.key} value={cat.key}>
                        {cat.emoji} {cat.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Give this content a name (e.g., 'Pricing Info')"
                    className="w-full px-3 py-2.5 mb-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-picton-blue focus:border-picton-blue"
                    id="text-content-name"
                  />
                  <textarea
                    placeholder="Paste your content here... This can be pricing information, FAQs, company policies, or any text you want your assistant to know about."
                    className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-picton-blue focus:border-picton-blue"
                    rows={10}
                    id="text-content-textarea"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    💡 Paste content you don&apos;t have on a website or don&apos;t want to upload as a file
                  </p>
                  <button
                    onClick={() => {
                      const categorySelect = document.getElementById('text-content-category') as HTMLSelectElement;
                      const nameInput = document.getElementById('text-content-name') as HTMLInputElement;
                      const textarea = document.getElementById('text-content-textarea') as HTMLTextAreaElement;
                      const category = categorySelect.value;
                      const name = nameInput.value.trim();
                      const content = textarea.value.trim();
                      
                      if (!category) {
                        Swal.fire({ icon: 'warning', title: 'Select Category', text: 'Please select a category for this content', timer: 2000 });
                        return;
                      }
                      if (!name) {
                        Swal.fire({ icon: 'warning', title: 'Name Required', text: 'Please give this content a name', timer: 2000 });
                        return;
                      }
                      if (!content || content.length < 20) {
                        Swal.fire({ icon: 'warning', title: 'Content Too Short', text: 'Please paste at least 20 characters of content', timer: 2000 });
                        return;
                      }
                      if (sources.find(s => s.label === name)) {
                        Swal.fire({ icon: 'info', title: 'Name Exists', text: 'Please use a different name', timer: 2000 });
                        return;
                      }
                      
                      setSources(prev => [...prev, { type: 'text', label: name, content, category }]);
                      categorySelect.value = '';
                      nameInput.value = '';
                      textarea.value = '';
                      Swal.fire({ 
                        icon: 'success', 
                        title: 'Text Added', 
                        text: `"${name}" added successfully (${content.length} characters)`,
                        timer: 2000,
                        showConfirmButton: false
                      });
                    }}
                    className="mt-2 w-full px-4 py-2.5 bg-picton-blue text-white text-sm font-medium rounded-lg hover:bg-picton-blue/90 transition-all"
                  >
                    Add Text Content
                  </button>
                </div>
              </div>
            )}

            {/* File Upload */}
            {activeInputTab === 'file' && (
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Upload Files (PDF, TXT, DOC, DOCX)</label>
                <select
                  id="file-upload-category"
                  className="w-full px-3 py-2.5 mb-3 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-picton-blue focus:border-picton-blue"
                >
                  <option value="">Select Category (applied to all files)</option>
                  {KNOWLEDGE_CATEGORIES.map(cat => (
                    <option key={cat.key} value={cat.key}>
                      {cat.emoji} {cat.label}
                    </option>
                  ))}
                </select>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.txt,.doc,.docx"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => {
                    const categorySelect = document.getElementById('file-upload-category') as HTMLSelectElement;
                    if (!categorySelect.value) {
                      Swal.fire({ icon: 'warning', title: 'Select Category', text: 'Please select a category before uploading files', timer: 2000 });
                      return;
                    }
                    fileInputRef.current?.click();
                  }}
                  className="w-full px-6 py-8 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-picton-blue hover:text-picton-blue hover:bg-picton-blue/5 transition-all text-sm flex flex-col items-center justify-center gap-2"
                >
                  <CloudArrowUpIcon className="h-8 w-8" />
                  <span className="font-medium">Click to upload documents</span>
                  <span className="text-xs text-gray-400">Support for PDF, TXT, DOC, DOCX • Max 10MB</span>
                </button>
              </div>
            )}

            {/* Sources List */}
            {sources.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-900">
                    Knowledge Sources ({sources.length})
                  </h4>
                  <button
                    onClick={() => {
                      Swal.fire({
                        title: 'Clear All Sources?',
                        text: 'This will remove all added sources from the list',
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonColor: '#00A4EE',
                        cancelButtonColor: '#gray',
                        confirmButtonText: 'Yes, clear all'
                      }).then((result) => {
                        if (result.isConfirmed) {
                          setSources([]);
                        }
                      });
                    }}
                    className="text-xs text-red-500 hover:text-red-700 font-medium"
                  >
                    Clear All
                  </button>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {sources.map((src, idx) => {
                    const categoryInfo = KNOWLEDGE_CATEGORIES.find(c => c.key === src.category);
                    const isExisting = ingestionJobs.find(j => j.url === src.label || j.filePath === src.label);
                    const jobStatus = isExisting?.status;
                    
                    return (
                      <div
                        key={`${src.type}-${src.label}-${idx}`}
                        className="flex items-center justify-between px-3 py-2.5 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <span className={`flex-shrink-0 px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                            src.type === 'url' ? 'bg-blue-100 text-blue-700' : 
                            src.type === 'text' ? 'bg-green-100 text-green-700' : 
                            'bg-purple-100 text-purple-700'
                          }`}>
                            {src.type}
                          </span>
                          {isExisting && (
                            <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded font-medium ${
                              jobStatus === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                              jobStatus === 'failed' ? 'bg-red-100 text-red-700' :
                              jobStatus === 'processing' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-gray-200 text-gray-700'
                            }`}>
                              {jobStatus === 'completed' ? '✓ Indexed' :
                               jobStatus === 'failed' ? '✗ Failed' :
                               jobStatus === 'processing' ? '⟳ Processing' :
                               '⏳ Pending'}
                            </span>
                          )}
                          {categoryInfo && (
                            <span className="flex-shrink-0 text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded">
                              {categoryInfo.emoji} {categoryInfo.label}
                            </span>
                          )}
                          <span className="text-sm text-gray-700 truncate">{src.label}</span>
                          {src.content && (
                            <span className="text-xs text-gray-400">({src.content.length} chars)</span>
                          )}
                          {isExisting && (isExisting.pagesIndexed ?? 0) > 0 && (
                            <span className="text-xs text-gray-500">• {isExisting.pagesIndexed} chunks</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {src.type === 'text' && isExisting && (
                            <button
                              onClick={async () => {
                                const originalText = isExisting.originalContent || '';
                                const result = await Swal.fire({
                                  title: `Edit "${src.label}"`,
                                  html: `
                                    <div class="text-left space-y-3">
                                      ${!originalText ? '<p class="text-sm text-gray-600 mb-3">The original text content was not stored. Please paste the content below:</p>' : ''}
                                      <label class="block text-sm font-medium text-gray-700 mb-1">Category</label>
                                      <select id="edit-category" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-3">
                                        <option value="">Select Category</option>
                                        ${KNOWLEDGE_CATEGORIES.map(cat => 
                                          `<option value="${cat.key}" ${cat.key === src.category ? 'selected' : ''}>${cat.emoji} ${cat.label}</option>`
                                        ).join('')}
                                      </select>
                                      <label class="block text-sm font-medium text-gray-700 mb-1">Content</label>
                                      <textarea id="edit-text" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" rows="10" placeholder="Paste content here...">${originalText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                                    </div>
                                  `,
                                  showCancelButton: true,
                                  confirmButtonText: 'Update & Re-index',
                                  confirmButtonColor: '#00A4EE',
                                  width: '650px',
                                  preConfirm: () => {
                                    const category = (document.getElementById('edit-category') as HTMLSelectElement).value;
                                    const text = (document.getElementById('edit-text') as HTMLTextAreaElement).value.trim();
                                    if (!category) {
                                      Swal.showValidationMessage('Please select a category');
                                      return false;
                                    }
                                    if (!text || text.length < 20) {
                                      Swal.showValidationMessage('Please enter at least 20 characters');
                                      return false;
                                    }
                                    return { category, text };
                                  }
                                });
                                
                                if (result.isConfirmed && result.value) {
                                  // Remove old source and add updated one
                                  await removeSource(src.label);
                                  setSources(prev => [...prev, { 
                                    type: 'text', 
                                    label: src.label, 
                                    content: result.value.text,
                                    category: result.value.category
                                  }]);
                                  Swal.fire({ 
                                    icon: 'success', 
                                    title: 'Content Updated', 
                                    text: 'Click "Next" to re-index the updated content',
                                    timer: 3000 
                                  });
                                }
                              }}
                              className="flex-shrink-0 text-gray-400 hover:text-picton-blue transition-colors"
                              title="Edit text content"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => removeSource(src.label)}
                            className="flex-shrink-0 text-gray-400 hover:text-red-500 transition-colors"
                            title={isExisting ? "Delete from knowledge base" : "Remove"}
                          >
                            <XMarkIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Empty State */}
            {sources.length === 0 && (
              <div className="text-center py-8 text-sm text-gray-400">
                <p>No sources added yet</p>
                <p className="text-xs mt-1">You can add knowledge sources now or skip and add them later</p>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Status */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900">Assistant Status</h3>
              <p className="text-sm text-gray-500 mt-1">
                {isEdit ? 'Your assistant has been updated' : 'Your assistant has been created'} — {form.name}
              </p>
            </div>

            {/* Assistant Info */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 font-medium">Name:</span>
                  <p className="text-gray-900 mt-0.5">{form.name}</p>
                </div>
                <div>
                  <span className="text-gray-500 font-medium">Personality:</span>
                  <p className="text-gray-900 mt-0.5 capitalize">{form.personality.replace('_', ' ')}</p>
                </div>
                <div>
                  <span className="text-gray-500 font-medium">Primary Goal:</span>
                  <p className="text-gray-900 mt-0.5 capitalize">{form.primaryGoal.replace('_', ' ')}</p>
                </div>
                <div>
                  <span className="text-gray-500 font-medium">Business Type:</span>
                  <p className="text-gray-900 mt-0.5 capitalize">{form.businessType || 'Not specified'}</p>
                </div>
              </div>
            </div>

            {/* Knowledge Health Score */}
            {knowledgeHealth && (
              <div className="bg-gradient-to-br from-picton-blue/5 to-picton-blue/10 border border-picton-blue/20 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-900">Knowledge Health Score</h4>
                  <div className="text-2xl font-bold text-picton-blue">{knowledgeHealth.score}%</div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                  <div 
                    className="bg-picton-blue h-2 rounded-full transition-all duration-500"
                    style={{ width: `${knowledgeHealth.score}%` }}
                  />
                </div>
                <p className="text-xs text-gray-600">
                  {knowledgeHealth.checklist.filter(c => c.satisfied).length} of {knowledgeHealth.checklist.length} knowledge categories completed
                </p>
              </div>
            )}

            {/* Knowledge Checklist */}
            {knowledgeHealth && knowledgeHealth.checklist && knowledgeHealth.checklist.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Knowledge Categories</h4>
                <div className="space-y-2">
                  {knowledgeHealth.checklist.map((item, idx) => (
                    <div 
                      key={item.key || idx}
                      className={`flex items-start gap-3 p-3 rounded-lg border ${
                        item.satisfied
                          ? 'bg-emerald-50 border-emerald-200' 
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        {item.satisfied ? (
                          <CheckIcon className="h-5 w-5 text-emerald-600" />
                        ) : (
                          <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {item.label || 'Unknown Category'}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {item.type === 'url' ? '🔗' : '📄'} {item.type}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Knowledge Base Activity */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-gray-900">Knowledge Base</h4>
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-picton-blue opacity-50"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-picton-blue"></span>
                  </span>
                  <span className="text-xs text-gray-400">Live</span>
                </div>
              </div>

              {/* Summary stats row */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="text-center p-2.5 bg-gray-50 rounded-lg">
                  <p className="text-lg font-bold text-gray-900">{sources.length + ingestionJobs.length}</p>
                  <p className="text-xs text-gray-500">Total Sources</p>
                </div>
                <div className="text-center p-2.5 bg-gray-50 rounded-lg">
                  <p className="text-lg font-bold text-emerald-600">
                    {ingestionJobs.filter(j => j.status === 'completed').reduce((sum, j) => sum + (j.pagesIndexed || 0), 0)}
                  </p>
                  <p className="text-xs text-gray-500">Pages Indexed</p>
                </div>
                <div className="text-center p-2.5 bg-gray-50 rounded-lg">
                  <p className="text-lg font-bold text-picton-blue">
                    {ingestionJobs.filter(j => j.status === 'pending' || j.status === 'processing').length}
                  </p>
                  <p className="text-xs text-gray-500">Processing</p>
                </div>
              </div>

              {/* Job list */}
              {ingestionJobs.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {ingestionJobs.map((job) => (
                    <div 
                      key={job.id}
                      className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50 border border-gray-100"
                    >
                      <div className="flex-shrink-0">
                        {job.status === 'completed' && (
                          <CheckIcon className="h-4 w-4 text-emerald-600" />
                        )}
                        {job.status === 'processing' && (
                          <svg className="animate-spin h-4 w-4 text-picton-blue" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                        )}
                        {job.status === 'pending' && (
                          <div className="h-4 w-4 rounded-full border-2 border-amber-400 bg-amber-50" />
                        )}
                        {job.status === 'failed' && (
                          <XMarkIcon className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-700 truncate">{job.url || job.filePath || 'Source'}</p>
                        <p className={`text-xs mt-0.5 ${
                          job.status === 'completed' ? 'text-emerald-600' :
                          job.status === 'processing' ? 'text-picton-blue' :
                          job.status === 'failed' ? 'text-red-500' :
                          'text-amber-600'
                        }`}>
                          {job.status === 'completed' && `${job.pagesIndexed || 0} page${(job.pagesIndexed || 0) !== 1 ? 's' : ''} indexed`}
                          {job.status === 'processing' && 'Processing…'}
                          {job.status === 'pending' && 'Waiting in queue…'}
                          {job.status === 'failed' && (job.error || 'Failed to index')}
                        </p>
                      </div>
                      <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                        job.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                        job.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                        job.status === 'failed' ? 'bg-red-100 text-red-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {job.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : sources.length > 0 ? (
                <div className="text-center py-4 text-sm text-gray-500">
                  <p>{sources.length} source{sources.length !== 1 ? 's' : ''} queued for indexing</p>
                  <p className="text-xs text-gray-400 mt-1">Processing will begin shortly…</p>
                </div>
              ) : (
                <div className="text-center py-4 text-sm text-gray-400">
                  No knowledge sources added. You can add them later from your dashboard.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back
        </button>

        {step < steps.length - 1 ? (
          <button
            onClick={handleNext}
            disabled={!canProceed() || saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-picton-blue text-white text-sm font-semibold rounded-lg hover:bg-picton-blue/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {saving ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Saving...
              </>
            ) : (
              <>
                Next
                <ArrowRightIcon className="h-4 w-4" />
              </>
            )}
          </button>
        ) : (
          <button
            onClick={() => navigate('/portal/assistants')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-picton-blue text-white text-sm font-semibold rounded-lg hover:bg-picton-blue/90 transition-all"
          >
            <CheckIcon className="h-4 w-4" />
            Done
          </button>
        )}
      </div>
    </div>
  );
};

export default CreateAssistant;
