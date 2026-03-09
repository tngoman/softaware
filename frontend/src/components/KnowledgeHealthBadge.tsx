import React, { useState, useEffect } from 'react';
import api from '../services/api';

interface HealthSummary {
  score: number;
  pagesIndexed: number;
  pageLimit: number;
  satisfied: number;
  total: number;
}

interface KnowledgeHealthBadgeProps {
  assistantId: string;
}

/**
 * Compact knowledge-health indicator for assistant cards.
 * Shows a small progress ring with score %, pages count, and checklist tally.
 */
export const KnowledgeHealthBadge: React.FC<KnowledgeHealthBadgeProps> = ({ assistantId }) => {
  const [data, setData] = useState<HealthSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: res } = await api.get(`/assistants/${assistantId}/knowledge-health`);
        if (!cancelled && res.success) {
          const checklist: { satisfied: boolean }[] = res.checklist || [];
          setData({
            score: res.score ?? 0,
            pagesIndexed: res.pagesIndexed ?? 0,
            pageLimit: res.pageLimit ?? 50,
            satisfied: checklist.filter((c) => c.satisfied).length,
            total: checklist.length,
          });
        }
      } catch {
        // Silently fail — badge just won't render
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [assistantId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 animate-pulse">
        <div className="w-9 h-9 rounded-full bg-gray-100" />
        <div className="h-3 w-16 bg-gray-100 rounded" />
      </div>
    );
  }

  if (!data) return null;

  /* Mini ring */
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (data.score / 100) * circumference;

  const ringColor =
    data.score >= 80 ? 'stroke-emerald-500'
    : data.score >= 60 ? 'stroke-yellow-500'
    : data.score >= 40 ? 'stroke-orange-500'
    : 'stroke-red-500';

  const textColor =
    data.score >= 80 ? 'text-emerald-600'
    : data.score >= 60 ? 'text-yellow-600'
    : data.score >= 40 ? 'text-orange-600'
    : 'text-red-600';

  return (
    <div className="flex items-center gap-2.5 mt-1">
      {/* Mini progress ring */}
      <div className="relative w-9 h-9 flex-shrink-0">
        <svg className="w-9 h-9 -rotate-90" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r={radius} strokeWidth="3" fill="none" className="stroke-gray-100" />
          <circle
            cx="18" cy="18" r={radius} strokeWidth="3" fill="none" strokeLinecap="round"
            className={ringColor}
            style={{
              strokeDasharray: circumference,
              strokeDashoffset: offset,
              transition: 'stroke-dashoffset 0.8s ease-in-out',
            }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-[9px] font-bold ${textColor}`}>{data.score}%</span>
        </div>
      </div>

      {/* Labels */}
      <div className="min-w-0">
        <p className={`text-[11px] font-semibold ${textColor} leading-tight`}>
          Knowledge {data.score >= 80 ? 'Healthy' : data.score >= 40 ? 'Partial' : 'Low'}
        </p>
        <p className="text-[10px] text-gray-400 leading-tight">
          {data.satisfied}/{data.total} topics · {data.pagesIndexed} pages
        </p>
      </div>
    </div>
  );
};

export default KnowledgeHealthBadge;
