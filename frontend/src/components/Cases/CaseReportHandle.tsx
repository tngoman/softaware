/**
 * CaseReportHandle — Floating slide-out panel for reporting issues
 *
 * Renders a persistent "handle" tab on the right-hand edge of the
 * screen. Clicking it opens an off-canvas panel containing the
 * case-creation form. The panel auto-populates context (current URL,
 * page path, browser info) and wires into the AI component-analysis
 * endpoint for smart routing.
 */

import React, { useState, useEffect, Fragment } from 'react';
import { Transition } from '@headlessui/react';
import { useLocation } from 'react-router-dom';
import {
  FlagIcon,
  XMarkIcon,
  BugAntIcon,
  ExclamationTriangleIcon,
  LightBulbIcon,
  ShieldExclamationIcon,
  SparklesIcon,
  CheckCircleIcon,
  PaperAirplaneIcon,
} from '@heroicons/react/24/outline';
import { CaseModel } from '../../models/CaseModel';
import { CaseCategory, CaseSeverity } from '../../types/cases';
import Swal from 'sweetalert2';

const CATEGORIES: { value: CaseCategory; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'bug', label: 'Bug', icon: <BugAntIcon className="h-5 w-5" />, color: 'text-red-500' },
  { value: 'performance', label: 'Performance', icon: <ExclamationTriangleIcon className="h-5 w-5" />, color: 'text-orange-500' },
  { value: 'ui_issue', label: 'UI Issue', icon: <ExclamationTriangleIcon className="h-5 w-5" />, color: 'text-yellow-500' },
  { value: 'data_issue', label: 'Data Issue', icon: <ShieldExclamationIcon className="h-5 w-5" />, color: 'text-purple-500' },
  { value: 'security', label: 'Security', icon: <ShieldExclamationIcon className="h-5 w-5" />, color: 'text-red-700' },
  { value: 'feature_request', label: 'Feature Request', icon: <LightBulbIcon className="h-5 w-5" />, color: 'text-blue-500' },
  { value: 'other', label: 'Other', icon: <FlagIcon className="h-5 w-5" />, color: 'text-gray-500' },
];

const SEVERITIES: { value: CaseSeverity; label: string; color: string; bg: string }[] = [
  { value: 'low', label: 'Low', color: 'text-green-700', bg: 'bg-green-50 border-green-200 hover:bg-green-100' },
  { value: 'medium', label: 'Medium', color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100' },
  { value: 'high', label: 'High', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200 hover:bg-orange-100' },
  { value: 'critical', label: 'Critical', color: 'text-red-700', bg: 'bg-red-50 border-red-200 hover:bg-red-100' },
];

const CaseReportHandle: React.FC = () => {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'category' | 'form' | 'success'>('category');
  const [submitting, setSubmitting] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);

  // Form state
  const [category, setCategory] = useState<CaseCategory>('bug');
  const [severity, setSeverity] = useState<CaseSeverity>('medium');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [createdCase, setCreatedCase] = useState<any>(null);

  // Auto-capture context
  const [pageContext, setPageContext] = useState({
    url: '',
    path: '',
    browser: '',
  });

  useEffect(() => {
    setPageContext({
      url: window.location.href,
      path: location.pathname,
      browser: navigator.userAgent,
    });
  }, [location]);

  const resetForm = () => {
    setStep('category');
    setCategory('bug');
    setSeverity('medium');
    setTitle('');
    setScreenshots([]);
    setDescription('');
    setErrorMessage('');
    setAiAnalysis(null);
    setCreatedCase(null);
  };

  const handleOpen = () => {
    resetForm();
    setPageContext({
      url: window.location.href,
      path: location.pathname,
      browser: navigator.userAgent,
    });
    setOpen(true);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Swal.fire({ icon: 'warning', title: 'Title Required', text: 'Please enter a title for your report.' });
      return;
    }
    if (title.trim().length < 5) {
      Swal.fire({ icon: 'warning', title: 'Title Too Short', text: 'Title must be at least 5 characters long.' });
      return;
    }
    if (!description.trim()) {
      Swal.fire({ icon: 'warning', title: 'Description Required', text: 'Please describe the issue you encountered.' });
      return;
    }

    setSubmitting(true);
    try {
      const result = await CaseModel.create({
        title: title.trim(),
        description: description.trim(),
        category,
        severity,
        page_url: pageContext.url,
        page_path: pageContext.path,
        error_message: errorMessage.trim() || undefined,
        browser_info: {
          user_agent: pageContext.browser,
          screen: { width: window.screen.width, height: window.screen.height },
          viewport: { width: window.innerWidth, height: window.innerHeight },
        },
      });

      setCreatedCase(result);
      setStep('success');
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Submission Failed',
        text: err?.response?.data?.error || 'Could not submit your report. Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* ─── Floating Handle Tab ─────────────────────────────── */}
      <button
        onClick={handleOpen}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-50
                   flex items-center gap-1.5 px-2 py-4
                   bg-gradient-to-b from-red-500 to-red-600
                   text-white text-xs font-semibold
                   rounded-l-lg shadow-lg
                   hover:from-red-600 hover:to-red-700
                   hover:px-3 hover:shadow-xl
                   transition-all duration-300 ease-in-out
                   writing-mode-vertical"
        style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
        title="Report an issue"
      >
        <FlagIcon className="h-4 w-4 rotate-90" />
        <span>Report Issue</span>
      </button>

      {/* ─── Backdrop + Slide-out Panel ──────────────────────── */}
      <Transition show={open} as={Fragment}>
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div
              className="absolute inset-0 bg-black/30 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
          </Transition.Child>

          {/* Panel */}
          <Transition.Child
            as={Fragment}
            enter="transform transition ease-out duration-300"
            enterFrom="translate-x-full"
            enterTo="translate-x-0"
            leave="transform transition ease-in duration-200"
            leaveFrom="translate-x-0"
            leaveTo="translate-x-full"
          >
            <div className="absolute inset-y-0 right-0 flex max-w-full pl-10">
              <div className="w-screen max-w-md">
                <div className="flex h-full flex-col bg-white shadow-2xl">
                  {/* ─── Header ─────────────────────────────── */}
                  <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-lg">
                          <FlagIcon className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <h2 className="text-lg font-bold text-white">Report an Issue</h2>
                          <p className="text-red-100 text-xs mt-0.5">
                            AI-assisted issue identification
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setOpen(false)}
                        className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                      >
                        <XMarkIcon className="h-5 w-5 text-white" />
                      </button>
                    </div>

                    {/* Context indicator */}
                    <div className="mt-3 flex items-center gap-2 text-xs text-red-100 bg-white/10 rounded-lg px-3 py-2">
                      <SparklesIcon className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">
                        Capturing context from: <span className="font-medium text-white">{pageContext.path}</span>
                      </span>
                    </div>
                  </div>

                  {/* ─── Body ───────────────────────────────── */}
                  <div className="flex-1 overflow-y-auto">
                    {step === 'category' && (
                      <div className="p-6 space-y-6">
                        {/* Category Selection */}
                        <div>
                          <label className="block text-sm font-semibold text-gray-900 mb-3">
                            What kind of issue?
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            {CATEGORIES.map((cat) => (
                              <button
                                key={cat.value}
                                onClick={() => setCategory(cat.value)}
                                className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-all duration-200 ${
                                  category === cat.value
                                    ? 'border-red-500 bg-red-50 shadow-sm'
                                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                }`}
                              >
                                <span className={cat.color}>{cat.icon}</span>
                                <span className="text-sm font-medium text-gray-800">{cat.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Severity Selection */}
                        <div>
                          <label className="block text-sm font-semibold text-gray-900 mb-3">
                            How severe is this?
                          </label>
                          <div className="flex gap-2">
                            {SEVERITIES.map((sev) => (
                              <button
                                key={sev.value}
                                onClick={() => setSeverity(sev.value)}
                                className={`flex-1 px-3 py-2.5 rounded-xl border-2 text-sm font-medium text-center transition-all duration-200 ${
                                  severity === sev.value
                                    ? 'border-red-500 bg-red-50 text-red-700 shadow-sm'
                                    : `${sev.bg} ${sev.color} border`
                                }`}
                              >
                                {sev.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Screenshots (optional) */}
                        <div>
                          <label className="block text-sm font-semibold text-gray-900 mb-3">
                            Screenshots <span className="text-gray-400 text-xs font-normal">(optional)</span>
                          </label>
                          <div className="space-y-2">
                            <div
                              className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center hover:border-red-300 hover:bg-red-50/30 transition-colors cursor-pointer"
                              onPaste={async (e) => {
                                const items = e.clipboardData?.items;
                                if (!items) return;
                                for (let i = 0; i < items.length; i++) {
                                  if (items[i].type.indexOf('image') !== -1) {
                                    e.preventDefault();
                                    const blob = items[i].getAsFile();
                                    if (blob) {
                                      const reader = new FileReader();
                                      reader.onload = (ev) => {
                                        const dataUrl = ev.target?.result as string;
                                        setScreenshots(prev => [...prev, dataUrl]);
                                      };
                                      reader.readAsDataURL(blob);
                                    }
                                    break;
                                  }
                                }
                              }}
                              tabIndex={0}
                            >
                              <p className="text-sm text-gray-500">Click here &amp; press <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs font-mono">Ctrl+V</kbd> to paste a screenshot</p>
                            </div>
                            {screenshots.length > 0 && (
                              <div className="grid grid-cols-3 gap-2">
                                {screenshots.map((url, idx) => (
                                  <div key={idx} className="relative group">
                                    <img
                                      src={url}
                                      alt={`Screenshot ${idx + 1}`}
                                      className="w-full h-20 object-cover rounded-lg border border-gray-200"
                                    />
                                    <button
                                      onClick={() => setScreenshots(prev => prev.filter((_, i) => i !== idx))}
                                      className="absolute top-1 right-1 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                      <XMarkIcon className="h-3 w-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => setStep('form')}
                          className="w-full py-3 bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold rounded-xl hover:from-red-600 hover:to-red-700 transition-all duration-200 shadow-sm hover:shadow-md flex items-center justify-center gap-2"
                        >
                          Continue
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>
                    )}

                    {step === 'form' && (
                      <div className="p-6 space-y-5">
                        {/* Title */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            Title <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Brief summary of the issue..."
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all text-sm"
                            autoFocus
                          />
                        </div>

                        {/* Description */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            Description <span className="text-red-500">*</span>
                          </label>
                          <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={5}
                            placeholder="Describe what happened, steps to reproduce, and what you expected..."
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all text-sm resize-none"
                          />
                        </div>

                        {/* Error message (optional) */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            Error Message <span className="text-gray-400">(optional)</span>
                          </label>
                          <textarea
                            value={errorMessage}
                            onChange={(e) => setErrorMessage(e.target.value)}
                            rows={2}
                            placeholder="Paste any error message you saw..."
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all text-sm font-mono text-xs resize-none"
                          />
                        </div>

                        {/* Context summary */}
                        <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Auto-captured context
                          </h4>
                          <div className="space-y-1.5 text-xs text-gray-600">
                            <div className="flex justify-between">
                              <span className="text-gray-500">Page:</span>
                              <span className="font-mono truncate ml-2 max-w-[250px]">{pageContext.path}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">Category:</span>
                              <span className="font-medium capitalize">{category.replace('_', ' ')}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">Severity:</span>
                              <span className={`font-medium capitalize ${
                                severity === 'critical' ? 'text-red-600' :
                                severity === 'high' ? 'text-orange-600' :
                                severity === 'medium' ? 'text-yellow-600' : 'text-green-600'
                              }`}>{severity}</span>
                            </div>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-3">
                          <button
                            onClick={() => setStep('category')}
                            className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                          >
                            Back
                          </button>
                          <button
                            onClick={handleSubmit}
                            disabled={submitting}
                            className="flex-1 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold rounded-xl hover:from-red-600 hover:to-red-700 transition-all duration-200 shadow-sm hover:shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {submitting ? (
                              <>
                                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                Analyzing & Submitting…
                              </>
                            ) : (
                              <>
                                <PaperAirplaneIcon className="h-4 w-4" />
                                Submit Report
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    {step === 'success' && createdCase && (
                      <div className="p-6 flex flex-col items-center text-center space-y-5">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                          <CheckCircleIcon className="h-8 w-8 text-green-600" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">Report Submitted</h3>
                          <p className="text-sm text-gray-500 mt-1">
                            Your issue has been logged and assigned for review.
                          </p>
                        </div>

                        <div className="w-full bg-gray-50 rounded-xl p-4 text-left space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Case Number:</span>
                            <span className="font-mono font-bold text-gray-900">{createdCase.case_number}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Status:</span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              Open
                            </span>
                          </div>
                          {createdCase.component_name && (
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-500">Component:</span>
                              <span className="font-medium text-purple-700">{createdCase.component_name}</span>
                            </div>
                          )}
                        </div>

                        {createdCase.component_name && (
                          <div className="w-full bg-purple-50 border border-purple-200 rounded-xl p-4 text-left">
                            <div className="flex items-center gap-2 mb-2">
                              <SparklesIcon className="h-4 w-4 text-purple-500" />
                              <span className="text-xs font-semibold text-purple-700 uppercase tracking-wider">AI Analysis</span>
                            </div>
                            <p className="text-sm text-purple-800">
                              Identified component: <span className="font-bold">{createdCase.component_name}</span>
                              {createdCase.component_path && (
                                <span className="block text-xs font-mono text-purple-600 mt-1">{createdCase.component_path}</span>
                              )}
                            </p>
                          </div>
                        )}

                        <div className="flex gap-3 w-full">
                          <button
                            onClick={() => {
                              resetForm();
                              setOpen(false);
                            }}
                            className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors text-sm"
                          >
                            Close
                          </button>
                          <button
                            onClick={() => {
                              window.location.href = `/cases/${createdCase.id}`;
                            }}
                            className="flex-1 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all text-sm"
                          >
                            View Case
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Transition.Child>
        </div>
      </Transition>
    </>
  );
};

export default CaseReportHandle;
