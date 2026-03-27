import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon,
  SparklesIcon,
  ArrowDownTrayIcon,
  RocketLaunchIcon,
  EyeIcon,
  XMarkIcon,
  ArrowPathIcon,
  PhotoIcon,
  CheckCircleIcon,
  ChatBubbleLeftRightIcon,
  InformationCircleIcon,
  ArrowTopRightOnSquareIcon,
  GlobeAltIcon,
  PlusIcon,
  TrashIcon,
  EnvelopeIcon,
} from '@heroicons/react/24/outline';
import Swal from 'sweetalert2';
import { getApiBaseUrl, getBaseUrl } from '../../config/app';
import { useTierLimits } from '../../hooks/useTierLimits';

interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'textarea' | 'select';
  required: boolean;
  placeholder: string;
  options?: string[];
}

const SiteBuilderEditor: React.FC = () => {
  const { siteId } = useParams<{ siteId: string }>();
  const navigate = useNavigate();
  const isEdit = !!siteId;
  const apiBase = getApiBaseUrl();   // e.g. https://api.softaware.net.za/api
  const assetBase = getBaseUrl();    // e.g. https://api.softaware.net.za (for images)
  const { canCreate, limits, loading: limitsLoading } = useTierLimits();

  // Redirect if user navigated directly to /portal/sites/new while at limit
  useEffect(() => {
    if (!isEdit && !limitsLoading && !canCreate('sites')) {
      Swal.fire({
        icon: 'warning',
        title: 'Site Limit Reached',
        html: `<p>Your <strong>${limits.tier}</strong> plan allows <strong>${limits.sites.limit}</strong> site(s). Upgrade your plan to create more.</p>`,
        confirmButtonColor: '#38bdf8',
      }).then(() => navigate('/portal/sites'));
    }
  }, [isEdit, limitsLoading, canCreate, limits, navigate]);

  // Form state
  const [businessName, setBusinessName] = useState('');
  const [tagline, setTagline] = useState('');
  const [aboutText, setAboutText] = useState('');
  const [services, setServices] = useState('');

  // Image state
  const [logoUrl, setLogoUrl] = useState('');
  const [heroImageUrl, setHeroImageUrl] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingHero, setUploadingHero] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const heroInputRef = useRef<HTMLInputElement>(null);

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [generatedHtml, setGeneratedHtml] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  // Deploy modal state
  const [showDeployForm, setShowDeployForm] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [ftpServer, setFtpServer] = useState('');
  const [ftpProtocol, setFtpProtocol] = useState<'sftp' | 'ftp'>('sftp');
  const [ftpPort, setFtpPort] = useState(22);
  const [ftpUsername, setFtpUsername] = useState('');
  const [ftpPassword, setFtpPassword] = useState('');
  const [ftpDirectory, setFtpDirectory] = useState('/public_html');

  // Assistant state
  const [assistants, setAssistants] = useState<{ id: number; name: string; description?: string }[]>([]);
  const [selectedAssistantId, setSelectedAssistantId] = useState<string>('');
  const [loadingAssistants, setLoadingAssistants] = useState(true);

  // Saved site ID (after first save)
  const [savedSiteId, setSavedSiteId] = useState<string | null>(siteId || null);

  // Save state
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(!isEdit);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  // Form inclusion state
  const [includeForm, setIncludeForm] = useState(true);
  const [includeAssistant, setIncludeAssistant] = useState(false);
  const [formFields, setFormFields] = useState<FormField[]>([
    { name: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Your Name' },
    { name: 'email', label: 'Email', type: 'email', required: true, placeholder: 'Email Address' },
    { name: 'message', label: 'Message', type: 'textarea', required: true, placeholder: 'Tell us about your project...' },
  ]);
  const [destinationEmail, setDestinationEmail] = useState('');
  const [autoReplyMessage, setAutoReplyMessage] = useState('');

  const getHeaders = (): Record<string, string> => {
    const token = localStorage.getItem('jwt_token');
    return token
      ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      : { 'Content-Type': 'application/json' };
  };

  // Load existing site if editing
  useEffect(() => {
    if (isEdit && siteId) loadSite(siteId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  // Load user's assistants
  useEffect(() => {
    const fetchAssistants = async () => {
      try {
        const res = await fetch(`${apiBase}/assistants`, { headers: getHeaders() });
        const data = await res.json();
        if (data.assistants && data.assistants.length > 0) {
          setAssistants(data.assistants);
          setSelectedAssistantId(data.assistants[0].id.toString());
        }
      } catch (err) {
        console.error('Failed to load assistants:', err);
      } finally {
        setLoadingAssistants(false);
      }
    };
    fetchAssistants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSite = async (id: string) => {
    try {
      const res = await fetch(`${apiBase}/v1/sites/${id}`, { headers: getHeaders() });
      const data = await res.json();
      const s = data.site;
      if (s) {
        setBusinessName(s.business_name || '');
        setTagline(s.tagline || '');
        setAboutText(s.about_us || '');
        setServices(s.services || '');
        setLogoUrl(s.logo_url || '');
        setHeroImageUrl(s.hero_image_url || '');
        setFtpServer(s.ftp_server || '');
        setFtpProtocol(s.ftp_protocol || 'sftp');
        setFtpPort(s.ftp_port || 22);
        setFtpUsername(s.ftp_username || '');
        setFtpDirectory(s.ftp_directory || '/public_html');
        if (s.generated_html) {
          setGeneratedHtml(s.generated_html);
          setShowPreview(true);
        }
        if (s.widget_client_id) {
          setSelectedAssistantId(s.widget_client_id);
        }
        // Load form/assistant options
        setIncludeForm(s.include_form !== 0);
        setIncludeAssistant(s.include_assistant === 1);
        if (s.form_config) {
          try {
            const fc = typeof s.form_config === 'string' ? JSON.parse(s.form_config) : s.form_config;
            if (fc.fields?.length) setFormFields(fc.fields);
            if (fc.destinationEmail) setDestinationEmail(fc.destinationEmail);
            if (fc.autoReplyMessage) setAutoReplyMessage(fc.autoReplyMessage);
          } catch {}
        }
        // Just loaded — no unsaved changes
        setTimeout(() => setHasUnsavedChanges(false), 0);
      }
    } catch (err) {
      console.error('Failed to load site:', err);
    }
  };

  // ─── Track unsaved changes ────────────────────────────────────
  useEffect(() => {
    if (isEdit) setHasUnsavedChanges(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessName, tagline, aboutText, services, logoUrl, heroImageUrl, selectedAssistantId, includeForm, includeAssistant, formFields, destinationEmail, autoReplyMessage]);

  // ─── Save / Create Site (no generation) ───────────────────────
  const handleSave = async () => {
    if (!businessName.trim()) {
      Swal.fire({ icon: 'warning', title: 'Required', text: 'Please enter a business name.' });
      return;
    }

    setSaving(true);
    try {
      let currentSiteId = savedSiteId;
      const formConfigPayload = includeForm ? {
        fields: formFields,
        destinationEmail,
        autoReplyMessage: autoReplyMessage || undefined,
      } : undefined;

      if (!currentSiteId) {
        // Create new site
        const createRes = await fetch(`${apiBase}/v1/sites`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            businessName, tagline, aboutUs: aboutText, services,
            logoUrl, heroImageUrl,
            widgetClientId: includeAssistant ? (selectedAssistantId || undefined) : undefined,
            includeForm: includeForm ? 1 : 0,
            includeAssistant: includeAssistant ? 1 : 0,
            formConfig: formConfigPayload ? JSON.stringify(formConfigPayload) : undefined,
          }),
        });
        const createData = await createRes.json();
        if (!createRes.ok) throw new Error(createData.error || 'Failed to save site');
        currentSiteId = createData.site?.id?.toString();
        if (currentSiteId) {
          setSavedSiteId(currentSiteId);
          // Update URL to edit mode without full reload
          window.history.replaceState(null, '', `/portal/sites/${currentSiteId}/edit`);
        }
      } else {
        // Update existing site
        const updateRes = await fetch(`${apiBase}/v1/sites/${currentSiteId}`, {
          method: 'PUT',
          headers: getHeaders(),
          body: JSON.stringify({
            businessName, tagline, aboutUs: aboutText, services,
            logoUrl, heroImageUrl,
            widgetClientId: includeAssistant ? (selectedAssistantId || undefined) : undefined,
            includeForm: includeForm ? 1 : 0,
            includeAssistant: includeAssistant ? 1 : 0,
            formConfig: formConfigPayload ? JSON.stringify(formConfigPayload) : undefined,
          }),
        });
        const updateData = await updateRes.json();
        if (!updateRes.ok) throw new Error(updateData.error || 'Failed to update site');
      }

      setHasUnsavedChanges(false);
      setLastSavedAt(new Date().toLocaleTimeString());
      Swal.fire({
        icon: 'success',
        title: generatedHtml ? 'Settings Saved' : 'Draft Saved',
        html: generatedHtml 
          ? 'Your configuration has been saved.<br/><br/><span style="color:#d97706; font-size:14px; font-weight:500;">Note: You must click <strong>Regenerate with AI</strong> to apply structural changes (like enabling a form) to the website.</span>'
          : 'Your changes have been saved.',
        timer: generatedHtml ? undefined : 1500,
        showConfirmButton: !!generatedHtml,
        confirmButtonText: 'Got it',
        toast: !generatedHtml,
        position: generatedHtml ? 'center' : 'top-end',
      });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Save Failed', text: err.message || 'Could not save site.' });
    } finally {
      setSaving(false);
    }
  };

  // ─── Image Upload ─────────────────────────────────────────────
  const handleImageUpload = async (type: 'logo' | 'hero') => {
    const inputRef = type === 'logo' ? logoInputRef : heroInputRef;
    const file = inputRef.current?.files?.[0];
    if (!file) return;

    const setUploading = type === 'logo' ? setUploadingLogo : setUploadingHero;
    const setUrl = type === 'logo' ? setLogoUrl : setHeroImageUrl;
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append(type, file);
      const token = localStorage.getItem('jwt_token');
      const res = await fetch(`${apiBase}/v1/sites/upload/${type}`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      if (data.url) setUrl(data.url);
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Upload Failed', text: err.message || `Could not upload ${type}.` });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  // ─── Generate with AI ─────────────────────────────────────────
  const handleGenerate = async (tier: 'free' | 'paid' = 'free') => {
    if (!businessName.trim()) {
      Swal.fire({ icon: 'warning', title: 'Required', text: 'Please enter a business name.' });
      return;
    }
    if (!aboutText.trim()) {
      Swal.fire({ icon: 'warning', title: 'Required', text: 'Please describe your business.' });
      return;
    }
    const servicesList = services.split(/[,\n]+/).map((s) => s.trim()).filter(Boolean);
    if (servicesList.length === 0) {
      Swal.fire({ icon: 'warning', title: 'Required', text: 'Please list at least one service.' });
      return;
    }

    setGenerating(true);
    setGeneratedHtml('');

    try {
      // ── Step 1: Save / create the site record first ──
      let currentSiteId = savedSiteId;
      const formConfigPayloadGen = includeForm ? {
        fields: formFields,
        destinationEmail,
        autoReplyMessage: autoReplyMessage || undefined,
      } : undefined;

      if (!currentSiteId) {
        const createRes = await fetch(`${apiBase}/v1/sites`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            businessName, tagline, aboutUs: aboutText, services, logoUrl, heroImageUrl,
            widgetClientId: includeAssistant ? (selectedAssistantId || undefined) : undefined,
            includeForm: includeForm ? 1 : 0,
            includeAssistant: includeAssistant ? 1 : 0,
            formConfig: formConfigPayloadGen ? JSON.stringify(formConfigPayloadGen) : undefined,
          }),
        });
        const createData = await createRes.json();
        if (!createRes.ok) throw new Error(createData.error || 'Failed to save site');
        currentSiteId = createData.site?.id?.toString();
        if (currentSiteId) setSavedSiteId(currentSiteId);
      } else {
        await fetch(`${apiBase}/v1/sites/${currentSiteId}`, {
          method: 'PUT',
          headers: getHeaders(),
          body: JSON.stringify({
            businessName, tagline, aboutUs: aboutText, services, logoUrl, heroImageUrl,
            widgetClientId: includeAssistant ? (selectedAssistantId || undefined) : undefined,
            includeForm: includeForm ? 1 : 0,
            includeAssistant: includeAssistant ? 1 : 0,
            formConfig: formConfigPayloadGen ? JSON.stringify(formConfigPayloadGen) : undefined,
          }),
        });
      }

      setHasUnsavedChanges(false);
      setLastSavedAt(new Date().toLocaleTimeString());

      // ── Step 2: Start async AI generation ──
      const res = await fetch(`${apiBase}/v1/sites/generate-ai`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          siteId: currentSiteId,
          businessName,
          tagline: tagline || businessName,
          aboutText,
          services: servicesList,
          logoUrl: logoUrl || undefined,
          heroImageUrl: heroImageUrl || undefined,
          clientId: includeAssistant ? (selectedAssistantId || currentSiteId || 'preview') : '',
          includeForm,
          includeAssistant,
          formConfig: formConfigPayloadGen,
          tier,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'AI generation failed');

      const queuePos: number = data.queuePosition ?? 0;
      const activeTier: string = data.tier || tier;

      // ── Step 3: Navigate to sites list — it auto-polls for generation status ──
      setGenerating(false);

      if (activeTier === 'paid') {
        Swal.fire({
          icon: 'info',
          title: '⚡ Priority Build Started',
          html: '<p class="text-sm text-gray-600">Your site is being built with enhanced AI. You\'ll see the result on the dashboard shortly.</p>',
          timer: 3500,
          timerProgressBar: true,
          showConfirmButton: true,
          confirmButtonText: 'Go to Dashboard',
          confirmButtonColor: '#7c3aed',
        }).then(() => {
          navigate('/portal/sites');
        });
      } else {
        // Free tier — queued. Offer trial to skip the queue.
        const result = await Swal.fire({
          icon: 'info',
          title: '📋 Queued for Generation',
          html: `<p class="text-sm text-gray-600 mb-3">Your project is in the queue (position #${queuePos || 1}). You'll be able to preview it once it's ready.</p>
                 <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 text-left">
                   <p class="text-sm font-semibold text-blue-800">⚡ Want to skip the queue?</p>
                   <p class="text-xs text-blue-600 mt-1">Start a free 14-day Starter trial for priority builds, 3 sites, and 2,000 AI messages/month. No credit card needed.</p>
                 </div>`,
          showCancelButton: true,
          confirmButtonText: 'Start Free Trial & Skip Queue',
          cancelButtonText: 'Stay in Queue',
          confirmButtonColor: '#38bdf8',
          cancelButtonColor: '#6b7280',
        });

        if (result.isConfirmed) {
          try {
            const API_BASE = getApiBaseUrl();
            const token = localStorage.getItem('accessToken');
            const trialRes = await fetch(`${API_BASE}/billing/start-trial`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            });
            const trialData = await trialRes.json();
            if (trialData.success) {
              await Swal.fire({
                icon: 'success',
                title: '🎉 Trial Activated!',
                html: '<p class="text-sm text-gray-600">You\'re now on the Starter plan. Your site will be built with priority.</p>',
                timer: 3000,
                timerProgressBar: true,
                confirmButtonColor: '#38bdf8',
              });
            } else {
              await Swal.fire({ icon: 'info', title: 'Trial Unavailable', text: trialData.error || 'You may have already used your trial.' });
            }
          } catch {
            // Trial activation failed silently — user still goes to sites page
          }
        }

        navigate('/portal/sites');
      }

    } catch (err: any) {
      setGenerating(false);
      Swal.close();
      Swal.fire({ icon: 'error', title: 'Generation Failed', text: err.message || 'Could not generate website.' });
    }
  };

  // ─── Download as HTML ─────────────────────────────────────────
  const handleDownload = () => {
    if (!generatedHtml) return;
    const blob = new Blob([generatedHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${businessName.replace(/\s+/g, '-').toLowerCase() || 'landing-page'}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ─── Deploy via FTP ───────────────────────────────────────────
  const handleDeploy = async () => {
    if (!savedSiteId) {
      Swal.fire({ icon: 'info', text: 'Generate your site first.' });
      return;
    }
    if (!ftpServer || !ftpUsername || !ftpPassword) {
      Swal.fire({ icon: 'warning', text: 'Please fill in all FTP fields.' });
      return;
    }

    setDeploying(true);
    try {
      // Save FTP creds
      await fetch(`${apiBase}/v1/sites/${savedSiteId}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ ftpServer, ftpProtocol, ftpPort, ftpUsername, ftpPassword, ftpDirectory }),
      });
      // Generate static files on disk
      const genRes = await fetch(`${apiBase}/v1/sites/${savedSiteId}/generate`, {
        method: 'POST',
        headers: getHeaders(),
      });
      if (!genRes.ok) { const d = await genRes.json(); throw new Error(d.error || 'Generation failed'); }
      // Deploy via FTP
      const depRes = await fetch(`${apiBase}/v1/sites/${savedSiteId}/deploy`, {
        method: 'POST',
        headers: getHeaders(),
      });
      const depData = await depRes.json();
      if (!depRes.ok) throw new Error(depData.error || 'Deployment failed');

      setShowDeployForm(false);
      Swal.fire({ icon: 'success', title: 'Deployed!', text: 'Your website has been uploaded.', timer: 3000, showConfirmButton: false });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Deploy Failed', text: err.message });
    } finally {
      setDeploying(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/portal/sites" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeftIcon className="h-5 w-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEdit ? 'Edit Landing Page' : 'Create Landing Page'}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Describe your business and let AI build your website
          </p>
        </div>
      </div>

      {/* Business Info Form */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Business Name *</label>
          <input
            type="text"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="e.g. Acme Solutions"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-picton-blue/30 focus:border-picton-blue transition-colors"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tagline</label>
          <input
            type="text"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="e.g. Your trusted partner in technology"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-picton-blue/30 focus:border-picton-blue transition-colors"
          />
        </div>

        {/* Image Uploads */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Images</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Logo */}
            <div>
              <input ref={logoInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={() => handleImageUpload('logo')} />
              {logoUrl ? (
                <div className="relative group rounded-lg border border-emerald-200 bg-emerald-50/50 overflow-hidden">
                  <img
                    src={logoUrl.startsWith('http') ? logoUrl : `${assetBase}${logoUrl}`}
                    alt="Logo"
                    className="w-full h-28 object-contain p-3"
                  />
                  <div className="absolute top-2 right-2 flex items-center gap-1 bg-emerald-100 text-emerald-700 text-xs font-medium px-2 py-0.5 rounded-full">
                    <CheckCircleIcon className="h-3.5 w-3.5" />
                    Logo uploaded
                  </div>
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-all flex items-center justify-center opacity-0 hover:opacity-100 text-white text-sm font-medium rounded-lg"
                  >
                    Replace Logo
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploadingLogo}
                  className="w-full h-28 border-2 border-dashed border-gray-300 rounded-lg hover:border-picton-blue/50 transition-colors flex flex-col items-center justify-center gap-1.5 text-gray-400 hover:text-picton-blue disabled:opacity-50"
                >
                  {uploadingLogo ? (
                    <>
                      <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      <span className="text-xs font-medium">Uploading…</span>
                    </>
                  ) : (
                    <>
                      <PhotoIcon className="h-6 w-6" />
                      <span className="text-xs font-medium">Upload Logo</span>
                      <span className="text-[10px] text-gray-300">PNG, JPG, WEBP · 5MB max</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Hero / Banner */}
            <div>
              <input ref={heroInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={() => handleImageUpload('hero')} />
              {heroImageUrl ? (
                <div className="relative group rounded-lg border border-emerald-200 bg-emerald-50/50 overflow-hidden">
                  <img
                    src={heroImageUrl.startsWith('http') ? heroImageUrl : `${assetBase}${heroImageUrl}`}
                    alt="Hero"
                    className="w-full h-28 object-cover"
                  />
                  <div className="absolute top-2 right-2 flex items-center gap-1 bg-emerald-100 text-emerald-700 text-xs font-medium px-2 py-0.5 rounded-full">
                    <CheckCircleIcon className="h-3.5 w-3.5" />
                    Banner uploaded
                  </div>
                  <button
                    type="button"
                    onClick={() => heroInputRef.current?.click()}
                    className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-all flex items-center justify-center opacity-0 hover:opacity-100 text-white text-sm font-medium rounded-lg"
                  >
                    Replace Banner
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => heroInputRef.current?.click()}
                  disabled={uploadingHero}
                  className="w-full h-28 border-2 border-dashed border-gray-300 rounded-lg hover:border-picton-blue/50 transition-colors flex flex-col items-center justify-center gap-1.5 text-gray-400 hover:text-picton-blue disabled:opacity-50"
                >
                  {uploadingHero ? (
                    <>
                      <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      <span className="text-xs font-medium">Uploading…</span>
                    </>
                  ) : (
                    <>
                      <PhotoIcon className="h-6 w-6" />
                      <span className="text-xs font-medium">Upload Banner Image</span>
                      <span className="text-[10px] text-gray-300">PNG, JPG, WEBP · 5MB max</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">About Your Business *</label>
          <textarea
            value={aboutText}
            onChange={(e) => setAboutText(e.target.value)}
            rows={4}
            placeholder="Describe what your business does, your mission, and what makes you unique…"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-picton-blue/30 focus:border-picton-blue transition-colors resize-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Services / Products *</label>
          <textarea
            value={services}
            onChange={(e) => setServices(e.target.value)}
            rows={3}
            placeholder={"List your services, one per line or comma-separated:\nWeb Development\nIT Support\nCloud Hosting"}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-picton-blue/30 focus:border-picton-blue transition-colors resize-none"
          />
          <p className="text-xs text-gray-400 mt-1">Separate with commas or new lines</p>
        </div>

        {/* AI Chat Assistant Widget */}
        <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <ChatBubbleLeftRightIcon className="h-5 w-5 text-violet-500" />
              <label className="text-sm font-medium text-gray-700">AI Chat Assistant</label>
            </div>
            <button
              type="button"
              onClick={() => setIncludeAssistant(!includeAssistant)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                includeAssistant ? 'bg-violet-600' : 'bg-gray-300'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                includeAssistant ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Embed an AI chat widget on your site so visitors can interact with your assistant in real time.
          </p>

          {includeAssistant && (
            <>
              {loadingAssistants ? (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Loading assistants…
                </div>
              ) : assistants.length === 0 ? (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <InformationCircleIcon className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-amber-800 font-medium">No assistants found</p>
                    <p className="text-xs text-amber-600 mt-0.5">
                      You need to create an AI assistant first before you can embed one on your site.
                    </p>
                    <Link
                      to="/portal/assistants/new"
                      className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-violet-600 hover:text-violet-700"
                    >
                      <SparklesIcon className="h-3.5 w-3.5" />
                      Create an Assistant
                    </Link>
                  </div>
                </div>
              ) : (
                <>
                  <select
                    value={selectedAssistantId}
                    onChange={(e) => setSelectedAssistantId(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-colors bg-white text-sm"
                  >
                    <option value="">Select an assistant…</option>
                    {assistants.map((a) => (
                      <option key={a.id} value={a.id.toString()}>
                        {a.name}{a.description ? ` — ${a.description}` : ''}
                      </option>
                    ))}
                  </select>
                  {selectedAssistantId && (
                    <p className="text-xs text-green-600 mt-1.5 flex items-center gap-1">
                      <CheckCircleIcon className="h-3.5 w-3.5" />
                      The chat widget for this assistant will be embedded on your generated site.
                    </p>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* Contact Form Options */}
        <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <EnvelopeIcon className="h-5 w-5 text-emerald-500" />
              <label className="text-sm font-medium text-gray-700">Contact Form</label>
            </div>
            <button
              type="button"
              onClick={() => setIncludeForm(!includeForm)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                includeForm ? 'bg-emerald-600' : 'bg-gray-300'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                includeForm ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Add a contact form so visitors can reach you. Submissions are delivered to your email and viewable in the dashboard.
          </p>

          {includeForm && (
            <div className="space-y-4 pt-2 border-t border-gray-200">
              {/* Destination Email */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Destination Email *</label>
                <input
                  type="email"
                  value={destinationEmail}
                  onChange={(e) => setDestinationEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
                <p className="text-[11px] text-gray-400 mt-1">Form submissions will be emailed to this address.</p>
              </div>

              {/* Auto-Reply Message */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Auto-Reply Message (Optional)</label>
                <textarea
                  value={autoReplyMessage}
                  onChange={(e) => setAutoReplyMessage(e.target.value)}
                  rows={2}
                  placeholder="Thank you for contacting us. We'll get back to you within 24 hours."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 resize-none"
                />
              </div>

              {/* Form Fields Builder */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-600">Form Fields</label>
                  <button
                    type="button"
                    onClick={() => setFormFields([...formFields, {
                      name: `field_${formFields.length + 1}`,
                      label: '',
                      type: 'text',
                      required: false,
                      placeholder: '',
                    }])}
                    className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700"
                  >
                    <PlusIcon className="h-3.5 w-3.5" />
                    Add Field
                  </button>
                </div>

                <div className="space-y-2">
                  {formFields.map((field, idx) => (
                    <div key={idx} className="flex items-start gap-2 p-2.5 bg-white rounded-lg border border-gray-200">
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={field.label}
                          onChange={(e) => {
                            const updated = [...formFields];
                            updated[idx] = {
                              ...updated[idx],
                              label: e.target.value,
                              name: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_') || `field_${idx + 1}`,
                              placeholder: e.target.value || updated[idx].placeholder,
                            };
                            setFormFields(updated);
                          }}
                          placeholder="Field label (e.g. Phone Number)"
                          className="px-2.5 py-1.5 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-emerald-400 focus:border-emerald-400"
                        />
                        <select
                          value={field.type}
                          onChange={(e) => {
                            const updated = [...formFields];
                            updated[idx] = { ...updated[idx], type: e.target.value as FormField['type'] };
                            setFormFields(updated);
                          }}
                          className="px-2.5 py-1.5 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-emerald-400 bg-white"
                        >
                          <option value="text">Text</option>
                          <option value="email">Email</option>
                          <option value="tel">Phone</option>
                          <option value="textarea">Text Area</option>
                        </select>
                      </div>
                      <label className="flex items-center gap-1 text-xs text-gray-500 whitespace-nowrap pt-1.5">
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={(e) => {
                            const updated = [...formFields];
                            updated[idx] = { ...updated[idx], required: e.target.checked };
                            setFormFields(updated);
                          }}
                          className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5"
                        />
                        Required
                      </label>
                      <button
                        type="button"
                        onClick={() => setFormFields(formFields.filter((_, i) => i !== idx))}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        title="Remove field"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {formFields.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    Add at least one field. Default fields (Name, Email, Message) will be used if none are configured.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Unsaved changes indicator */}
        {hasUnsavedChanges && savedSiteId && (
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-xs text-amber-700 font-medium">You have unsaved changes</span>
            {lastSavedAt && (
              <span className="text-xs text-amber-500 ml-auto">Last saved at {lastSavedAt}</span>
            )}
          </div>
        )}

        {/* Save & Generate Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch gap-3">
          <button
            onClick={handleSave}
            disabled={saving || generating}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Saving…
              </>
            ) : (
              <>
                <CheckCircleIcon className="h-5 w-5" />
                {savedSiteId ? 'Save Configuration' : 'Save Draft'}
              </>
            )}
          </button>
          <button
            onClick={() => handleGenerate()}
            disabled={generating || saving}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-picton-blue hover:from-violet-700 hover:to-picton-blue/90 rounded-xl transition-all shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {generating ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                AI is generating…
              </>
            ) : (
              <>
                <SparklesIcon className="h-5 w-5" />
                {generatedHtml ? 'Regenerate with AI' : 'Generate with AI'}
              </>
            )}
          </button>
        </div>
        {!savedSiteId && (
          <p className="text-xs text-gray-400 text-center -mt-2">
            Save your draft first, then generate when you're ready.
          </p>
        )}
        {savedSiteId && hasUnsavedChanges && generatedHtml && (
          <p className="text-xs text-amber-600 text-center -mt-2">
            Note: Saving only updates configuration. You must <strong>Regenerate with AI</strong> to apply structural changes (like enabling a form) to the actual website.
          </p>
        )}
      </div>

      {/* Generated Result */}
      {generatedHtml && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-sm font-semibold text-gray-900">Website Ready</span>
            </div>
            <div className="flex items-center gap-2">
              {savedSiteId && (
                <a
                  href={`${apiBase}/v1/sites/${savedSiteId}/preview?token=${encodeURIComponent(localStorage.getItem('jwt_token') || '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <GlobeAltIcon className="h-4 w-4" />
                  Open Live Preview
                </a>
              )}
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="flex items-center gap-1.5 text-xs font-medium text-picton-blue hover:text-picton-blue/80 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
              >
                <EyeIcon className="h-4 w-4" />
                {showPreview ? 'Hide Preview' : 'Show Preview'}
              </button>
            </div>
          </div>

          {showPreview && (
            <div className="border-b border-slate-100">
              <iframe
                srcDoc={generatedHtml}
                title="Website Preview"
                className="w-full bg-white"
                style={{ height: '500px' }}
                sandbox="allow-scripts"
              />
            </div>
          )}

          {/* Assistant selector — change the chat widget embedded on the site */}
          {includeAssistant && (
          <div className="px-6 py-4 border-b border-slate-100 bg-violet-50/50">
            <div className="flex items-center gap-2 mb-2">
              <ChatBubbleLeftRightIcon className="h-4 w-4 text-violet-500" />
              <span className="text-xs font-semibold text-gray-700">AI Chat Assistant</span>
            </div>
            {assistants.length === 0 ? (
              <div className="flex items-center gap-2 text-xs text-amber-600">
                <InformationCircleIcon className="h-4 w-4" />
                <span>No assistants found. <Link to="/portal/assistants/new" className="underline text-violet-600 font-medium">Create one</Link></span>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <select
                  value={selectedAssistantId}
                  onChange={async (e) => {
                    setSelectedAssistantId(e.target.value);
                    // Persist the assistant change immediately
                    if (savedSiteId) {
                      try {
                        await fetch(`${apiBase}/v1/sites/${savedSiteId}`, {
                          method: 'PUT',
                          headers: getHeaders(),
                          body: JSON.stringify({ widgetClientId: e.target.value || null }),
                        });
                      } catch (err) {
                        console.error('Failed to update assistant:', err);
                      }
                    }
                  }}
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 bg-white"
                >
                  <option value="">None — no chat widget</option>
                  {assistants.map((a) => (
                    <option key={a.id} value={a.id.toString()}>
                      {a.name}{a.description ? ` — ${a.description}` : ''}
                    </option>
                  ))}
                </select>
                {selectedAssistantId && (
                  <span className="text-xs text-green-600 flex items-center gap-1 whitespace-nowrap">
                    <CheckCircleIcon className="h-3.5 w-3.5" />
                    Widget active
                  </span>
                )}
              </div>
            )}
            <p className="text-[11px] text-gray-400 mt-1.5">
              Changing the assistant requires regeneration to take effect on the site.
            </p>
          </div>
          )}

          <div className="px-6 py-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              onClick={handleDownload}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              Download HTML
            </button>
            <button
              onClick={() => setShowDeployForm(true)}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
            >
              <RocketLaunchIcon className="h-4 w-4" />
              Deploy via FTP
            </button>
            <button
              onClick={() => handleGenerate()}
              disabled={generating}
              className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-violet-600 bg-violet-50 hover:bg-violet-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <ArrowPathIcon className="h-4 w-4" />
              Regenerate
            </button>
          </div>
        </div>
      )}

      {/* FTP Deploy Modal */}
      {showDeployForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Deploy via FTP</h2>
              <button onClick={() => setShowDeployForm(false)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <XMarkIcon className="h-5 w-5 text-gray-400" />
              </button>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
              🔒 Your credentials are encrypted with AES-256-GCM and never stored in plain text.
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Server *</label>
                  <input type="text" value={ftpServer} onChange={(e) => setFtpServer(e.target.value)} placeholder="ftp.yourdomain.com"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Protocol</label>
                  <select value={ftpProtocol} onChange={(e) => { setFtpProtocol(e.target.value as 'sftp' | 'ftp'); setFtpPort(e.target.value === 'sftp' ? 22 : 21); }}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 bg-white">
                    <option value="sftp">SFTP</option>
                    <option value="ftp">FTP</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Username *</label>
                  <input type="text" value={ftpUsername} onChange={(e) => setFtpUsername(e.target.value)} placeholder="ftp_user"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Port</label>
                  <input type="number" value={ftpPort} onChange={(e) => setFtpPort(parseInt(e.target.value) || 22)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Password *</label>
                <input type="password" value={ftpPassword} onChange={(e) => setFtpPassword(e.target.value)} placeholder="Enter FTP password"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Remote Directory</label>
                <input type="text" value={ftpDirectory} onChange={(e) => setFtpDirectory(e.target.value)} placeholder="/public_html"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500" />
              </div>
            </div>
            <button onClick={handleDeploy} disabled={deploying}
              className="w-full flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors disabled:opacity-60">
              {deploying ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  Deploying…
                </>
              ) : (
                <>
                  <RocketLaunchIcon className="h-4 w-4" />
                  Deploy Now
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SiteBuilderEditor;
