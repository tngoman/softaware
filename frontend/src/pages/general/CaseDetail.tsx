/**
 * CaseDetail — Single case view with comments, activity, and rating
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FlagIcon, ArrowLeftIcon, ChatBubbleLeftIcon,
  ClockIcon, CheckCircleIcon, ArrowPathIcon,
  ExclamationTriangleIcon, BugAntIcon, SparklesIcon,
  PaperAirplaneIcon, StarIcon, UserCircleIcon,
  LightBulbIcon, ShieldExclamationIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import { Card } from '../../components/UI';
import { CaseModel } from '../../models/CaseModel';
import { Case, CaseComment, CaseActivity } from '../../types/cases';
import { notify } from '../../utils/notify';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  open: { label: 'Open', color: 'text-blue-700', bg: 'bg-blue-100' },
  in_progress: { label: 'In Progress', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  waiting: { label: 'Waiting', color: 'text-purple-700', bg: 'bg-purple-100' },
  resolved: { label: 'Resolved', color: 'text-green-700', bg: 'bg-green-100' },
  closed: { label: 'Closed', color: 'text-gray-700', bg: 'bg-gray-100' },
};

const SEVERITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  low: { label: 'Low', color: 'text-green-700', bg: 'bg-green-100' },
  medium: { label: 'Medium', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  high: { label: 'High', color: 'text-orange-700', bg: 'bg-orange-100' },
  critical: { label: 'Critical', color: 'text-red-700', bg: 'bg-red-100' },
};

const CATEGORY_ICON: Record<string, React.ReactNode> = {
  bug: <BugAntIcon className="h-5 w-5 text-red-500" />,
  performance: <ExclamationTriangleIcon className="h-5 w-5 text-orange-500" />,
  ui_issue: <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />,
  data_issue: <ShieldExclamationIcon className="h-5 w-5 text-purple-500" />,
  security: <ShieldExclamationIcon className="h-5 w-5 text-red-700" />,
  feature_request: <LightBulbIcon className="h-5 w-5 text-blue-500" />,
  other: <FlagIcon className="h-5 w-5 text-gray-500" />,
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

const CaseDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [caseData, setCaseData] = useState<Case | null>(null);
  const [comments, setComments] = useState<CaseComment[]>([]);
  const [activity, setActivity] = useState<CaseActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);
  const [activeTab, setActiveTab] = useState<'comments' | 'activity'>('comments');

  const loadCase = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const result = await CaseModel.getById(id);
      setCaseData(result.case);
      setComments(result.comments || []);
      setActivity(result.activity || []);
      if (result.case.user_rating) {
        setRating(result.case.user_rating);
      }
    } catch (err: any) {
      notify.error('Failed to load case details.');
      navigate('/cases');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    loadCase();
  }, [loadCase]);

  const handleAddComment = async () => {
    if (!id || !newComment.trim()) return;
    setSubmittingComment(true);
    try {
      const comment = await CaseModel.addComment(id, newComment.trim());
      setComments((prev) => [...prev, comment]);
      setNewComment('');
    } catch (err: any) {
      notify.error('Failed to add comment.');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleRate = async () => {
    if (!id || rating === 0) return;
    setSubmittingRating(true);
    try {
      await CaseModel.rate(id, rating, feedback || undefined);
      notify.success('Your rating has been recorded.');
      loadCase();
    } catch (err: any) {
      notify.error('Failed to submit rating.');
    } finally {
      setSubmittingRating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-3 border-red-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!caseData) return null;

  const status = STATUS_CONFIG[caseData.status] || STATUS_CONFIG.open;
  const severity = SEVERITY_CONFIG[caseData.severity] || SEVERITY_CONFIG.medium;
  const canRate = (caseData.status === 'resolved' || caseData.status === 'closed') && !caseData.user_rating;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* ─── Back + Header ───────────────────────────────── */}
      <div>
        <button
          onClick={() => navigate('/cases')}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-4"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Cases
        </button>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            {CATEGORY_ICON[caseData.category ?? 'other']}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono text-gray-400">{caseData.case_number}</span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.bg} ${status.color}`}>
                  {status.label}
                </span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${severity.bg} ${severity.color}`}>
                  {severity.label}
                </span>
              </div>
              <h1 className="text-xl font-bold text-gray-900 mt-1">{caseData.title}</h1>
              <p className="text-sm text-gray-500 mt-1">
                Reported {timeAgo(caseData.created_at)}
                {caseData.assignee_name && (
                  <> · Assigned to <span className="font-medium text-gray-700">{caseData.assignee_name}</span></>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Main Content Grid ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — Description & Comments */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <Card>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Description</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{caseData.description}</p>

            {caseData.error_message && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <h4 className="text-xs font-semibold text-red-700 mb-1">Error Message</h4>
                <code className="text-xs text-red-800 font-mono whitespace-pre-wrap">{caseData.error_message}</code>
              </div>
            )}

            {caseData.resolution && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="text-xs font-semibold text-green-700 mb-1">Resolution</h4>
                <p className="text-sm text-green-800">{caseData.resolution}</p>
              </div>
            )}
          </Card>

          {/* Comments & Activity Tabs */}
          <Card padding="none">
            <div className="border-b border-gray-200">
              <div className="flex">
                <button
                  onClick={() => setActiveTab('comments')}
                  className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'comments'
                      ? 'border-red-500 text-red-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <ChatBubbleLeftIcon className="h-4 w-4" />
                  Comments ({comments.length})
                </button>
                <button
                  onClick={() => setActiveTab('activity')}
                  className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'activity'
                      ? 'border-red-500 text-red-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <ClockIcon className="h-4 w-4" />
                  Activity ({activity.length})
                </button>
              </div>
            </div>

            <div className="p-5">
              {activeTab === 'comments' && (
                <div className="space-y-4">
                  {comments.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">No comments yet. Be the first to add one.</p>
                  ) : (
                    comments.map((c) => (
                      <div key={c.id} className="flex gap-3">
                        <div className="flex-shrink-0">
                          <UserCircleIcon className="h-8 w-8 text-gray-300" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900">{c.user_name || 'User'}</span>
                            <span className="text-xs text-gray-400">{timeAgo(c.created_at)}</span>
                            {!!c.is_internal && (
                              <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">Internal</span>
                            )}
                          </div>
                          <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{c.comment}</p>
                        </div>
                      </div>
                    ))
                  )}

                  {/* Add comment */}
                  <div className="flex gap-3 pt-4 border-t border-gray-200">
                    <div className="flex-1">
                      <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        rows={3}
                        placeholder="Add a comment..."
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 resize-none transition-all"
                      />
                      <div className="flex justify-end mt-2">
                        <button
                          onClick={handleAddComment}
                          disabled={!newComment.trim() || submittingComment}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {submittingComment ? (
                            <ArrowPathIcon className="h-4 w-4 animate-spin" />
                          ) : (
                            <PaperAirplaneIcon className="h-4 w-4" />
                          )}
                          Send
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'activity' && (
                <div className="space-y-3">
                  {activity.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">No activity recorded yet.</p>
                  ) : (
                    activity.map((a) => (
                      <div key={a.id} className="flex items-start gap-3 text-sm">
                        <div className="flex-shrink-0 mt-0.5 w-2 h-2 rounded-full bg-gray-300" />
                        <div>
                          <span className="text-gray-700">
                            <span className="font-medium">{a.user_name || 'System'}</span>
                            {' '}{a.action.replace(/_/g, ' ')}
                            {a.new_value && (
                              <span className="text-gray-500"> → <span className="font-medium">{a.new_value}</span></span>
                            )}
                          </span>
                          <div className="text-xs text-gray-400 mt-0.5">{timeAgo(a.created_at)}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </Card>

          {/* Rating (for resolved cases) */}
          {canRate && (
            <Card>
              <div className="flex items-center gap-2 mb-3">
                <StarIcon className="h-5 w-5 text-yellow-500" />
                <h3 className="text-sm font-semibold text-gray-900">Rate Resolution</h3>
              </div>
              <p className="text-xs text-gray-500 mb-4">How would you rate the resolution of this case?</p>

              <div className="flex items-center gap-1 mb-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="p-0.5 transition-transform hover:scale-110"
                  >
                    {star <= (hoverRating || rating) ? (
                      <StarIconSolid className="h-8 w-8 text-yellow-400" />
                    ) : (
                      <StarIcon className="h-8 w-8 text-gray-300" />
                    )}
                  </button>
                ))}
                {rating > 0 && (
                  <span className="ml-2 text-sm font-medium text-gray-600">
                    {rating}/5
                  </span>
                )}
              </div>

              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={2}
                placeholder="Optional feedback..."
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500 resize-none transition-all"
              />

              <div className="flex justify-end mt-3">
                <button
                  onClick={handleRate}
                  disabled={rating === 0 || submittingRating}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm font-medium hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Submit Rating
                </button>
              </div>
            </Card>
          )}

          {/* Existing rating */}
          {caseData.user_rating && (
            <Card>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Your rating:</span>
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    s <= caseData.user_rating! ? (
                      <StarIconSolid key={s} className="h-5 w-5 text-yellow-400" />
                    ) : (
                      <StarIcon key={s} className="h-5 w-5 text-gray-300" />
                    )
                  ))}
                </div>
                {caseData.user_feedback && (
                  <span className="text-sm text-gray-500 ml-2">— "{caseData.user_feedback}"</span>
                )}
              </div>
            </Card>
          )}
        </div>

        {/* Right column — Sidebar info */}
        <div className="space-y-4">
          {/* AI Analysis */}
          {caseData.component_name && (
            <Card>
              <div className="flex items-center gap-2 mb-3">
                <SparklesIcon className="h-5 w-5 text-purple-500" />
                <h3 className="text-sm font-semibold text-gray-900">AI Analysis</h3>
              </div>
              <div className="space-y-2">
                <div>
                  <div className="text-xs text-gray-500">Component</div>
                  <div className="text-sm font-medium text-purple-700">{caseData.component_name}</div>
                </div>
                {caseData.component_path && (
                  <div>
                    <div className="text-xs text-gray-500">File Path</div>
                    <div className="text-xs font-mono text-gray-600 break-all">{caseData.component_path}</div>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Details */}
          <Card>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Details</h3>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-gray-500">Category</div>
                <div className="text-sm font-medium capitalize">
                  {caseData.category ? caseData.category.replace('_', ' ') : <span className="text-gray-400 italic">Unknown</span>}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Source</div>
                <div className="text-sm font-medium capitalize">{(caseData.source || 'user_report').replace(/_/g, ' ')}</div>
              </div>
              {caseData.page_path && (
                <div>
                  <div className="text-xs text-gray-500">Page</div>
                  <div className="text-xs font-mono text-gray-600 break-all">{caseData.page_path}</div>
                </div>
              )}
              {caseData.tags && caseData.tags.length > 0 && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">Tags</div>
                  <div className="flex flex-wrap gap-1">
                    {caseData.tags.map((tag, i) => (
                      <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <div className="text-xs text-gray-500">Created</div>
                <div className="text-sm text-gray-700">
                  {new Date(caseData.created_at).toLocaleString()}
                </div>
              </div>
              {caseData.resolved_at && (
                <div>
                  <div className="text-xs text-gray-500">Resolved</div>
                  <div className="text-sm text-gray-700">
                    {new Date(caseData.resolved_at).toLocaleString()}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CaseDetail;
