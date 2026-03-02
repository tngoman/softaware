import React, { useState, useEffect } from 'react';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  PlusIcon,
  GlobeAltIcon,
  DocumentTextIcon,
  SparklesIcon,
  ArrowTrendingUpIcon,
  LockClosedIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import api from '../services/api';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface ChecklistItem {
  key: string;
  label: string;
  satisfied: boolean;
  type: 'url' | 'file';
  custom?: boolean;
}

interface KnowledgeHealthData {
  score: number;
  checklist: ChecklistItem[];
  missing: string[];
  recommendations: {
    key: string;
    label: string;
    action: string;
    type: 'url' | 'file';
  }[];
  pagesIndexed: number;
  tier: 'free' | 'paid';
  pageLimit: number;
  storageFull: boolean;
  pointsPerItem: number;
}

interface KnowledgeHealthProps {
  assistantId: string;
  tier?: 'free' | 'paid' | string;
  onAddUrl?: () => void;
  onUploadFile?: () => void;
  onUpgrade?: () => void;
}

/* ------------------------------------------------------------------ */
/* Emoji map — maps common checklist keys to emoji                     */
/* ------------------------------------------------------------------ */

const KEY_EMOJI: Record<string, string> = {
  pricing_info: '💰', pricing_plans: '💰', pricing_fees: '💰', menu_prices: '💰',
  contact_details: '📞', contact_hours: '📞',
  services_offered: '🛒', services_products: '🛒', products_catalog: '🛒', features: '🛒',
  return_policy: '↩️', shipping_info: '🚚', delivery_info: '🚚',
  about_company: '🏢', about_team: '🏢', about_restaurant: '🏢', about_practice: '🏢',
  about_institution: '🏢', about_agency: '🏢',
  testimonials: '⭐', faq: '❓', integrations: '🔗', onboarding_docs: '📖',
  courses_programs: '🎓', enrollment_info: '📝', practitioners: '👨‍⚕️',
  insurance_info: '🏥', listings: '🏠', area_info: '📍', location: '📍',
};

function emojiFor(key: string): string {
  return KEY_EMOJI[key] || '📋';
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function KnowledgeHealthScore({
  assistantId,
  onAddUrl,
  onUploadFile,
  onUpgrade,
}: KnowledgeHealthProps) {
  const [health, setHealth] = useState<KnowledgeHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recategorizing, setRecategorizing] = useState(false);

  useEffect(() => {
    if (assistantId) fetchHealth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assistantId]);

  const fetchHealth = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await api.get(`/assistants/${assistantId}/knowledge-health`);
      if (data.success) {
        setHealth(data);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const handleRecategorize = async () => {
    try {
      setRecategorizing(true);
      await api.post(`/assistants/${assistantId}/recategorize`);
      await fetchHealth();
    } catch {
      // silent fail — the health will refresh anyway
    } finally {
      setRecategorizing(false);
    }
  };

  /* ---------- Loading / Error states ---------- */

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm animate-pulse">
        <div className="h-32 bg-gray-100 rounded-full w-32 mx-auto mb-4" />
        <div className="h-4 bg-gray-100 rounded w-3/4 mx-auto" />
      </div>
    );
  }

  if (error || !health) {
    return (
      <div className="bg-white rounded-xl border border-red-200 p-6 text-center shadow-sm">
        <ExclamationCircleIcon className="w-8 h-8 text-red-400 mx-auto mb-2" />
        <p className="text-red-500 text-sm">{error || 'Failed to load knowledge health'}</p>
      </div>
    );
  }

  /* ---------- Score colours ---------- */

  const scoreColor =
    health.score >= 80 ? 'text-emerald-500'
    : health.score >= 60 ? 'text-yellow-500'
    : health.score >= 40 ? 'text-orange-500'
    : 'text-red-500';

  const ringStroke =
    health.score >= 80 ? 'stroke-emerald-500'
    : health.score >= 60 ? 'stroke-yellow-500'
    : health.score >= 40 ? 'stroke-orange-500'
    : 'stroke-red-500';

  const circumference = 2 * Math.PI * 58;
  const strokeDashoffset = circumference - (health.score / 100) * circumference;
  const pointsPerItem = health.pointsPerItem || (health.checklist.length > 0 ? Math.round(100 / health.checklist.length) : 0);

  /* ---------- Render ---------- */

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <SparklesIcon className="h-5 w-5 text-picton-blue" />
          Knowledge Health
        </h2>
        <button
          onClick={handleRecategorize}
          disabled={recategorizing}
          className="text-xs text-gray-400 hover:text-picton-blue flex items-center gap-1 transition-colors disabled:opacity-50"
          title="Re-analyze all content"
        >
          <ArrowPathIcon className={`h-3.5 w-3.5 ${recategorizing ? 'animate-spin' : ''}`} />
          Re-scan
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        {/* Top: Progress ring + checklist side-by-side */}
        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* Animated SVG Progress Ring */}
          <div className="relative w-36 h-36 flex-shrink-0">
            <svg className="w-36 h-36 -rotate-90" viewBox="0 0 144 144">
              <circle cx="72" cy="72" r="58" strokeWidth="8" fill="none" className="stroke-gray-100" />
              <circle
                cx="72" cy="72" r="58" strokeWidth="8" fill="none" strokeLinecap="round"
                className={ringStroke}
                style={{
                  strokeDasharray: circumference,
                  strokeDashoffset,
                  transition: 'stroke-dashoffset 1s ease-in-out',
                }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-3xl font-bold ${scoreColor}`}>{health.score}%</span>
              <span className="text-[11px] text-gray-400">Health Score</span>
            </div>
          </div>

          {/* Dynamic Checklist */}
          <div className="flex-1 w-full space-y-2">
            {health.checklist.map((item) => {
              const emoji = emojiFor(item.key);
              return (
                <div
                  key={item.key}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                    item.satisfied
                      ? 'bg-emerald-50 border border-emerald-200'
                      : 'bg-gray-50 border border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base flex-shrink-0">{emoji}</span>
                    <span className={`text-sm truncate ${
                      item.satisfied ? 'text-emerald-700 font-medium' : 'text-gray-500'
                    }`}>
                      {item.label}
                      {item.custom && (
                        <span className="ml-1.5 text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-600 rounded-full font-medium">
                          CUSTOM
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {item.satisfied ? (
                      <CheckCircleIcon className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <>
                        <span className="text-xs text-gray-400 font-medium">+{pointsPerItem}%</span>
                        <button
                          onClick={() => item.type === 'url' ? onAddUrl?.() : onUploadFile?.()}
                          className="text-xs px-2 py-1 bg-picton-blue/10 text-picton-blue rounded-md hover:bg-picton-blue/20 transition-colors font-medium"
                        >
                          {item.type === 'url' ? 'Add URL' : 'Upload'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Add Custom Requirement — Upsell for free, functional for paid */}
            {health.tier === 'paid' ? (
              <button
                onClick={() => {
                  // For now, just trigger the onUpgrade or a prompt
                  const label = prompt('Enter the name of your custom knowledge requirement:');
                  if (label) {
                    const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
                    api.post(`/assistants/${assistantId}/checklist/add`, {
                      key,
                      label,
                      type: 'url',
                    }).then(() => fetchHealth());
                  }
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 border-2 border-dashed border-picton-blue/30 rounded-lg text-picton-blue text-sm font-medium hover:border-picton-blue/50 hover:bg-picton-blue/5 transition-all"
              >
                <PlusIcon className="w-4 h-4" />
                Add Custom Requirement
              </button>
            ) : (
              <button
                onClick={onUpgrade}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 border-2 border-dashed border-gray-300 rounded-lg text-gray-400 text-sm font-medium hover:border-amber-400 hover:text-amber-500 transition-all group"
              >
                <LockClosedIcon className="w-4 h-4 group-hover:text-amber-500" />
                <span>Add Custom Requirement</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-600 rounded-full font-semibold ml-1">
                  PRO
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Pages Indexed Bar */}
        <div className="mt-5">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
            <span className="flex items-center gap-1">
              <DocumentTextIcon className="w-3.5 h-3.5" />
              {health.pagesIndexed} / {health.pageLimit} pages indexed
            </span>
            <span>{Math.min(Math.round((health.pagesIndexed / health.pageLimit) * 100), 100)}%</span>
          </div>
          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${health.storageFull ? 'bg-red-500' : 'bg-picton-blue'}`}
              style={{ width: `${Math.min((health.pagesIndexed / health.pageLimit) * 100, 100)}%` }}
            />
          </div>
        </div>

        {/* Upsell: storage full + low score */}
        {health.storageFull && health.score < 80 && health.tier === 'free' && (
          <div className="mt-5 p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl">
            <div className="flex items-start gap-3">
              <ArrowTrendingUpIcon className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-gray-900 font-medium mb-1">
                  Your AI&apos;s knowledge is incomplete ({health.score}%)
                </h4>
                <p className="text-sm text-amber-700/80 mb-3">
                  Free storage is full but your assistant is missing key information.
                  Upgrade to unlock more storage and custom requirements.
                </p>
                <button
                  onClick={onUpgrade}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-lg hover:shadow-md transition-all text-sm"
                >
                  Upgrade to Starter →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Perfect score celebration */}
        {health.score === 100 && (
          <div className="mt-5 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl text-center">
            <span className="text-2xl mb-2 block">🎉</span>
            <h4 className="text-emerald-700 font-medium">Perfect Knowledge Health!</h4>
            <p className="text-sm text-emerald-600/70 mt-1">
              Your AI assistant has all the key business information it needs.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default KnowledgeHealthScore;
