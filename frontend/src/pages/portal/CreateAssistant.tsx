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
} from '@heroicons/react/24/outline';
import api from '../../services/api';
import Swal from 'sweetalert2';

interface IngestSource {
  type: 'url' | 'file';
  label: string;
  file?: File;
}

interface JobResult {
  jobId: string;
  source: string;
  queuePosition: number;
  tier: 'free' | 'paid';
}

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
  { label: 'Review', icon: CheckIcon },
];

const CreateAssistant: React.FC = () => {
  const { assistantId } = useParams<{ assistantId: string }>();
  const navigate = useNavigate();
  const isEdit = !!assistantId;
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormData>({
    name: '',
    description: '',
    businessType: '',
    personality: 'professional',
    primaryGoal: 'customer_support',
    website: '',
  });

  // Knowledge base state
  const [urlInput, setUrlInput] = useState('');
  const [sources, setSources] = useState<IngestSource[]>([]);
  const [tier, setTier] = useState<'free' | 'paid'>('free');
  const [ingestResults, setIngestResults] = useState<JobResult[]>([]);
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
    } catch (err) {
      console.error('Failed to load assistant:', err);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const addURL = () => {
    const u = urlInput.trim();
    if (!u) return;
    try {
      new URL(u);
    } catch {
      Swal.fire({ icon: 'warning', title: 'Invalid URL', text: 'Please enter a valid URL' });
      return;
    }
    if (sources.find((s) => s.label === u)) return;
    setSources((prev) => [...prev, { type: 'url', label: u }]);
    setUrlInput('');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    for (const file of files) {
      if (sources.find((s) => s.label === file.name)) continue;
      setSources((prev) => [...prev, { type: 'file', label: file.name, file }]);
    }
    e.target.value = '';
  };

  const removeSource = (label: string) => {
    setSources((prev) => prev.filter((s) => s.label !== label));
  };

  const canProceed = () => {
    if (step === 0) return form.name.trim().length > 0 && form.description.trim().length > 0;
    return true;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description,
        businessType: form.businessType,
        personality: form.personality,
        primaryGoal: form.primaryGoal,
        website: form.website,
      };

      let savedId = assistantId;

      if (isEdit) {
        await api.put(`/assistants/${assistantId}/update`, payload);
      } else {
        const res = await api.post('/assistants/create', payload);
        savedId = res.data.assistantId || res.data.assistant?.id || res.data.id;
      }

      // Submit all ingest sources
      if (sources.length > 0 && savedId) {
        const results: JobResult[] = [];
        for (const src of sources) {
          try {
            if (src.type === 'url') {
              const r = await api.post(`/assistants/${savedId}/ingest/url`, { url: src.label, tier });
              results.push({
                jobId: r.data.jobId,
                source: src.label,
                queuePosition: r.data.queuePosition,
                tier,
              });
            } else if (src.file) {
              const fd = new FormData();
              fd.append('file', src.file);
              fd.append('tier', tier);
              const r = await api.post(`/assistants/${savedId}/ingest/file`, fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
              });
              results.push({
                jobId: r.data.jobId,
                source: src.label,
                queuePosition: r.data.queuePosition,
                tier,
              });
            }
          } catch (e) {
            console.warn('Ingest job failed for', src.label, e);
          }
        }
        setIngestResults(results);
      }

      // Show success with ingest info
      const ingestMsg =
        sources.length > 0
          ? `\n\n${sources.length} source(s) queued for processing.`
          : '';

      Swal.fire({
        icon: 'success',
        title: isEdit ? 'Updated!' : 'Created!',
        text: `Assistant "${form.name}" has been ${isEdit ? 'updated' : 'created'} successfully.${ingestMsg}`,
        confirmButtonColor: '#00A4EE',
      }).then(() => navigate('/portal/assistants'));
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to save assistant.';
      Swal.fire({ icon: 'error', title: 'Error', text: msg });
    } finally {
      setSaving(false);
    }
  };

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
              onClick={() => i <= step && setStep(i)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                i === step
                  ? 'bg-picton-blue text-white'
                  : i < step
                  ? 'bg-picton-blue/10 text-picton-blue cursor-pointer'
                  : 'bg-gray-100 text-gray-400'
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
          <div className="space-y-6">
            <div className="text-center mb-2">
              <h3 className="text-lg font-semibold text-gray-900">Knowledge Base</h3>
              <p className="text-sm text-gray-500">
                Add web pages or files your assistant should know about{' '}
                <span className="text-gray-400">(optional — you can add more later)</span>
              </p>
            </div>

            {/* Tier selector */}
            <div className="grid grid-cols-2 gap-4">
              <div
                onClick={() => setTier('free')}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  tier === 'free'
                    ? 'border-picton-blue bg-picton-blue/5'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-semibold text-gray-900 text-sm">Free</h4>
                  <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-600">Queued</span>
                </div>
                <p className="text-xs text-gray-500">
                  Processed in order using local AI. May take a few minutes depending on queue length.
                </p>
              </div>
              <div
                onClick={() => setTier('paid')}
                className={`p-4 rounded-xl border cursor-pointer transition-all relative overflow-hidden ${
                  tier === 'paid'
                    ? 'border-amber-500 bg-amber-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-semibold text-gray-900 text-sm">Paid</h4>
                  <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">Priority</span>
                </div>
                <p className="text-xs text-gray-500">
                  Jumps to front of queue. Processed instantly via cloud AI.
                </p>
              </div>
            </div>

            {/* URL input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Add Web Pages</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addURL())}
                    placeholder="https://yourwebsite.com/about"
                    className={`${inputClass} pl-9`}
                  />
                </div>
                <button
                  onClick={addURL}
                  className="px-4 py-2.5 bg-picton-blue hover:bg-picton-blue/90 text-white rounded-lg transition-all text-sm font-medium whitespace-nowrap"
                >
                  Add URL
                </button>
              </div>
            </div>

            {/* File upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Upload Files</label>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.txt,.doc,.docx"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full px-4 py-4 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-picton-blue/50 hover:text-picton-blue transition-all text-sm flex items-center justify-center gap-2"
              >
                <CloudArrowUpIcon className="h-5 w-5" />
                Click to upload PDF, TXT, DOC, or DOCX files
              </button>
            </div>

            {/* Source list */}
            {sources.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-gray-600 font-medium">
                  {sources.length} source{sources.length !== 1 ? 's' : ''} queued
                </p>
                {sources.map((src) => (
                  <div
                    key={src.label}
                    className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`flex-shrink-0 text-xs px-1.5 py-0.5 rounded font-mono uppercase ${
                          src.type === 'url'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-purple-100 text-purple-700'
                        }`}
                      >
                        {src.type}
                      </span>
                      <span className="text-sm text-gray-700 truncate">{src.label}</span>
                    </div>
                    <button
                      onClick={() => removeSource(src.label)}
                      className="flex-shrink-0 ml-2 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {sources.length === 0 && (
              <p className="text-center text-sm text-gray-400 py-4">
                No sources added yet — you can skip this and add knowledge later from the assistant settings.
              </p>
            )}
          </div>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-gray-900">Review Your Assistant</h3>
            <div className="divide-y divide-slate-100">
              {[
                ['Name', form.name],
                ['Description', form.description],
                ['Business Type', form.businessType || '—'],
                ['Personality', form.personality.replace('_', ' ')],
                ['Primary Goal', form.primaryGoal.replace('_', ' ')],
                ['Website', form.website || '—'],
                [
                  'Knowledge Sources',
                  sources.length > 0
                    ? `${sources.length} source(s) (${tier === 'paid' ? 'Priority' : 'Queued'})`
                    : 'None',
                ],
              ].map(([label, value]) => (
                <div key={label} className="flex py-3">
                  <span className="text-sm font-medium text-gray-500 w-36 flex-shrink-0">{label}</span>
                  <span className="text-sm text-gray-900 capitalize">{value}</span>
                </div>
              ))}
            </div>

            {sources.length > 0 && (
              <div className="bg-picton-blue/5 border border-picton-blue/20 rounded-lg p-4 mt-4">
                <p className="text-xs text-picton-blue">
                  <strong>Note:</strong> Your {sources.length} knowledge source(s) will be processed{' '}
                  {tier === 'paid' ? 'immediately (Priority)' : 'in queue order (Free tier)'}.
                  Pages indexed will appear in your dashboard metrics once processing completes.
                </p>
              </div>
            )}
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
            onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
            disabled={!canProceed()}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-picton-blue text-white text-sm font-semibold rounded-lg hover:bg-picton-blue/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            Next
            <ArrowRightIcon className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-picton-blue text-white text-sm font-semibold rounded-lg hover:bg-picton-blue/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
                Processing…
              </>
            ) : (
              <>
                <CheckIcon className="h-4 w-4" />
                {isEdit ? 'Save Changes' : 'Create Assistant'}
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default CreateAssistant;
