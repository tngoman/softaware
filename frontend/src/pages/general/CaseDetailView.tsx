/**
 * CaseDetailView — Single case detail view
 * Follows finance/Invoices.tsx detail view design pattern
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FlagIcon, ChatBubbleLeftIcon, ClockIcon,
  ArrowPathIcon, BugAntIcon, SparklesIcon,
  PaperAirplaneIcon, StarIcon, UserCircleIcon,
  ExclamationTriangleIcon, ShieldExclamationIcon, LightBulbIcon,
  PaperClipIcon, XMarkIcon, PhotoIcon, DocumentIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import { BackButton } from '../../components/UI';
import { CaseModel } from '../../models/CaseModel';
import { Case, CaseComment, CaseActivity } from '../../types/cases';
import { formatDate } from '../../utils/formatters';
import { useAppStore } from '../../store';
import { getAssetUrl } from '../../config/app';
import Swal from 'sweetalert2';
import { notify } from '../../utils/notify';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  open: { label: 'Open', color: 'text-blue-700', bg: 'bg-blue-100', icon: <FlagIcon className="h-4 w-4" /> },
  in_progress: { label: 'In Progress', color: 'text-yellow-700', bg: 'bg-yellow-100', icon: <ArrowPathIcon className="h-4 w-4" /> },
  waiting: { label: 'Waiting', color: 'text-purple-700', bg: 'bg-purple-100', icon: <ClockIcon className="h-4 w-4" /> },
  resolved: { label: 'Resolved', color: 'text-green-700', bg: 'bg-green-100', icon: <ClockIcon className="h-4 w-4" /> },
  closed: { label: 'Closed', color: 'text-gray-700', bg: 'bg-gray-100', icon: <ClockIcon className="h-4 w-4" /> },
};

const SEVERITY_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  low: { label: 'Low', color: 'text-green-700', bg: 'bg-green-100', dot: 'bg-green-500' },
  medium: { label: 'Medium', color: 'text-yellow-700', bg: 'bg-yellow-100', dot: 'bg-yellow-500' },
  high: { label: 'High', color: 'text-orange-700', bg: 'bg-orange-100', dot: 'bg-orange-500' },
  critical: { label: 'Critical', color: 'text-red-700', bg: 'bg-red-100', dot: 'bg-red-500' },
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  bug: <BugAntIcon className="h-5 w-5 text-red-500" />,
  performance: <ExclamationTriangleIcon className="h-5 w-5 text-orange-500" />,
  ui_issue: <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />,
  data_issue: <ShieldExclamationIcon className="h-5 w-5 text-purple-500" />,
  security: <ShieldExclamationIcon className="h-5 w-5 text-red-700" />,
  feature_request: <LightBulbIcon className="h-5 w-5 text-blue-500" />,
  other: <FlagIcon className="h-5 w-5 text-gray-500" />,
};

const timeAgo = (dateStr: string): string => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
};

const CaseDetailView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAppStore();

  const [caseData, setCaseData] = useState<Case | null>(null);
  const [comments, setComments] = useState<CaseComment[]>([]);
  const [activity, setActivity] = useState<CaseActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
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
      const comment = await CaseModel.addComment(id, newComment.trim(), false, attachments);
      setComments((prev) => [...prev, comment]);
      setNewComment('');
      setAttachments([]);
      notify.success('Your comment has been posted');
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
      notify.success('Your rating has been recorded');
      loadCase();
    } catch (err: any) {
      notify.error('Failed to submit rating.');
    } finally {
      setSubmittingRating(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    handleFiles(files);
  };

  const handleFiles = (files: File[]) => {
    const validFiles = files.filter(f => {
      const maxSize = 10 * 1024 * 1024; // 10MB
      const allowed = /\.(jpg|jpeg|png|gif|pdf|doc|docx|txt|zip)$/i;
      if (f.size > maxSize) {
        notify.warning(`${f.name} exceeds 10MB limit`);
        return false;
      }
      if (!allowed.test(f.name)) {
        notify.warning(`${f.name} is not an allowed file type`);
        return false;
      }
      return true;
    });
    
    if (attachments.length + validFiles.length > 5) {
      notify.warning('Maximum 5 attachments allowed');
      return;
    }
    
    setAttachments(prev => [...prev, ...validFiles]);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData?.items || []);
    const files = items
      .filter(item => item.kind === 'file')
      .map(item => item.getAsFile())
      .filter((f): f is File => f !== null);
    
    if (files.length > 0) {
      e.preventDefault();
      handleFiles(files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-10 w-10 border-4 border-picton-blue border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!caseData) return null;

  const status = STATUS_CONFIG[caseData.status] || STATUS_CONFIG.open;
  const severity = SEVERITY_CONFIG[caseData.severity] || SEVERITY_CONFIG.medium;
  const canRate = (caseData.status === 'resolved' || caseData.status === 'closed') && !caseData.user_rating;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-scarlet to-scarlet/80 rounded-xl shadow-lg text-white">
        <div className="p-4">
          <BackButton to="/cases" label="Back to Cases" className="text-white" />
        </div>
        
        <div className="flex justify-between items-start px-6 pb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold">
                CASE {caseData.case_number}
              </h1>
            </div>
            <p className="text-lg font-semibold mb-3">{caseData.title}</p>
            <div className="flex items-center gap-3 text-sm">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium ${severity.bg} ${severity.color}`}>
                <span className={`w-2 h-2 rounded-full ${severity.dot}`} />
                {severity.label}
              </span>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium ${status.bg} ${status.color}`}>
                {status.icon}
                {status.label}
              </span>
            </div>
          </div>
          {user?.is_admin && (
            <button
              onClick={async () => {
                const result = await Swal.fire({
                  title: 'Delete Case?',
                  text: 'This action cannot be undone.',
                  icon: 'warning',
                  showCancelButton: true,
                  confirmButtonColor: '#dc2626',
                  cancelButtonColor: '#6b7280',
                  confirmButtonText: 'Yes, delete it'
                });
                if (result.isConfirmed && id) {
                  try {
                    await CaseModel.adminDelete(id);
                    notify.success('Case has been deleted.');
                    navigate('/cases');
                  } catch (err) {
                    notify.error('Failed to delete case');
                  }
                }
              }}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Delete Case
            </button>
          )}
        </div>
      </div>

      {/* Case Content */}
      <div className="bg-white shadow-xl rounded-xl border-2 border-gray-100 overflow-hidden">
        {/* Case Info Banner */}
        <div className="bg-gradient-to-r from-non-photo-blue/30 to-white p-6 border-b-2 border-picton-blue/20">
          <div className="grid grid-cols-3 gap-6">
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Reported By</h3>
              <p className="text-sm font-medium text-gray-900">{caseData.reporter_name || 'Unknown User'}</p>
              {caseData.reporter_email && caseData.reporter_email !== caseData.reporter_name && (
                <p className="text-xs text-gray-500">{caseData.reporter_email}</p>
              )}
            </div>
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Category</h3>
              <p className="text-sm font-medium text-gray-900 capitalize">
                {(caseData.category || 'other').replace(/_/g, ' ')}
              </p>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Created</h3>
              <p className="text-sm font-medium text-gray-900">{formatDate(caseData.created_at)}</p>
              <p className="text-xs text-gray-500">{timeAgo(caseData.created_at)}</p>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Description</h3>
          <p className="text-gray-900 whitespace-pre-wrap leading-relaxed">{caseData.description}</p>
          
          {caseData.error_message && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <h4 className="text-xs font-semibold text-red-700 uppercase mb-2">Error Message</h4>
              <code className="text-sm text-red-800 font-mono block whitespace-pre-wrap">{caseData.error_message}</code>
            </div>
          )}

          {caseData.page_path && (
            <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <h4 className="text-xs font-semibold text-gray-700 uppercase mb-2">Page Context</h4>
              <code className="text-sm text-gray-700 font-mono">{caseData.page_path}</code>
            </div>
          )}

          {caseData.resolution && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="text-xs font-semibold text-green-700 uppercase mb-2">Resolution</h4>
              <p className="text-sm text-green-800">{caseData.resolution}</p>
            </div>
          )}
        </div>

        {/* Tabs: Comments & Activity */}
        <div className="border-b border-gray-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab('comments')}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === 'comments'
                  ? 'border-scarlet text-scarlet bg-scarlet/5'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <ChatBubbleLeftIcon className="h-5 w-5" />
              Comments ({comments.length})
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === 'activity'
                  ? 'border-scarlet text-scarlet bg-scarlet/5'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <ClockIcon className="h-5 w-5" />
              Activity ({activity.length})
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'comments' && (
            <div className="space-y-6">
              {comments.length === 0 ? (
                <div className="text-center py-12">
                  <ChatBubbleLeftIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">No comments yet. Be the first to comment.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {comments.map((c) => (
                    <div key={c.id} className="flex gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <UserCircleIcon className="h-10 w-10 text-gray-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-gray-900">
                            {c.user_name || (user?.first_name || user?.last_name ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : user?.username) || 'Unknown User'}
                          </span>
                          <span className="text-xs text-gray-400">•</span>
                          <span className="text-xs text-gray-500">{timeAgo(c.created_at)}</span>
                          {c.is_internal && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-yellow-100 text-yellow-700 font-medium">
                              Internal
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.comment}</p>
                        
                        {/* Display attachments */}
                        {c.attachments && Array.isArray(c.attachments) && c.attachments.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {c.attachments.map((att: string, idx: number) => {
                              const filename = att.split('/').pop() || att;
                              const isImage = /\.(jpg|jpeg|png|gif)$/i.test(filename);
                              const fullUrl = att.startsWith('http') ? att : getAssetUrl(att);
                              return isImage ? (
                                <a
                                  key={idx}
                                  href={fullUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block overflow-hidden rounded-lg border border-gray-200 hover:border-blue-400 transition-colors"
                                >
                                  <img
                                    src={fullUrl}
                                    alt={filename}
                                    className="h-24 w-24 object-cover"
                                  />
                                </a>
                              ) : (
                                <a
                                  key={idx}
                                  href={fullUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                                >
                                  <DocumentIcon className="h-4 w-4 text-gray-500" />
                                  <span className="text-gray-700 max-w-[120px] truncate">{filename}</span>
                                </a>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Comment Form */}
              <div className="pt-4 border-t border-gray-200">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Add Comment</label>
                
                {/* Textarea with drag-drop */}
                <div
                  className={`relative rounded-lg border-2 transition-colors ${
                    isDragging 
                      ? 'border-picton-blue bg-picton-blue/5' 
                      : 'border-gray-300'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onPaste={handlePaste}
                    rows={4}
                    placeholder="Write your comment here... (Paste images with Ctrl+V or drag files here)"
                    className="w-full px-4 py-3 border-0 rounded-lg text-sm focus:ring-2 focus:ring-picton-blue/20 focus:outline-none resize-none"
                  />
                  {isDragging && (
                    <div className="absolute inset-0 flex items-center justify-center bg-picton-blue/10 rounded-lg pointer-events-none">
                      <div className="text-center">
                        <PhotoIcon className="h-12 w-12 text-picton-blue mx-auto mb-2" />
                        <p className="text-sm font-semibold text-picton-blue">Drop files here</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Attachment previews */}
                {attachments.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {attachments.map((file, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg text-sm group"
                      >
                        {file.type.startsWith('image/') ? (
                          <PhotoIcon className="h-4 w-4 text-gray-500" />
                        ) : (
                          <DocumentIcon className="h-4 w-4 text-gray-500" />
                        )}
                        <span className="text-gray-700 font-medium max-w-[150px] truncate">
                          {file.name}
                        </span>
                        <span className="text-gray-500 text-xs">
                          {formatFileSize(file.size)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeAttachment(idx)}
                          className="ml-1 text-gray-400 hover:text-red-600 transition-colors"
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex justify-between items-center mt-3">
                  <div className="flex gap-2">
                    <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors">
                      <PaperClipIcon className="h-5 w-5" />
                      <span className="text-sm">Attach Files</span>
                      <input
                        type="file"
                        multiple
                        accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.txt,.zip"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                    </label>
                    <span className="text-xs text-gray-500 self-center">
                      Max 5 files, 10MB each
                    </span>
                  </div>
                  <button
                    onClick={handleAddComment}
                    disabled={!newComment.trim() || submittingComment}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-scarlet text-white rounded-lg font-semibold hover:bg-scarlet/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md"
                  >
                    {submittingComment ? (
                      <ArrowPathIcon className="h-5 w-5 animate-spin" />
                    ) : (
                      <PaperAirplaneIcon className="h-5 w-5" />
                    )}
                    {submittingComment ? 'Posting...' : 'Post Comment'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="space-y-3">
              {activity.length === 0 ? (
                <div className="text-center py-12">
                  <ClockIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">No activity recorded yet.</p>
                </div>
              ) : (
                activity.map((a) => (
                  <div key={a.id} className="flex items-start gap-3 text-sm p-3 bg-gray-50 rounded-lg">
                    <div className="flex-shrink-0 mt-1 w-2 h-2 rounded-full bg-picton-blue" />
                    <div className="flex-1">
                      <span className="font-semibold text-gray-900">{a.user_name || 'System'}</span>
                      <span className="text-gray-700"> {a.action.replace(/_/g, ' ')}</span>
                      {a.new_value && (
                        <span className="text-gray-500"> → <span className="font-medium text-gray-900">{a.new_value}</span></span>
                      )}
                      <div className="text-xs text-gray-400 mt-0.5">{timeAgo(a.created_at)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Rating Section (for resolved cases) */}
      {canRate && (
        <div className="bg-white shadow-xl rounded-xl border-2 border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <StarIcon className="h-6 w-6 text-yellow-500" />
            <h3 className="text-lg font-bold text-gray-900">Rate Resolution</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">How would you rate the resolution of this case?</p>

          <div className="flex items-center gap-2 mb-4">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                className="p-1 transition-transform hover:scale-110"
              >
                {star <= (hoverRating || rating) ? (
                  <StarIconSolid className="h-9 w-9 text-yellow-400" />
                ) : (
                  <StarIcon className="h-9 w-9 text-gray-300" />
                )}
              </button>
            ))}
            {rating > 0 && (
              <span className="ml-3 text-lg font-bold text-gray-700">{rating}/5</span>
            )}
          </div>

          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={3}
            placeholder="Optional feedback..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500 resize-none mb-4"
          />

          <button
            onClick={handleRate}
            disabled={rating === 0 || submittingRating}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-yellow-500 text-white rounded-lg font-semibold hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md"
          >
            {submittingRating ? (
              <>
                <ArrowPathIcon className="h-5 w-5 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <StarIcon className="h-5 w-5" />
                Submit Rating
              </>
            )}
          </button>
        </div>
      )}

      {/* Existing Rating Display */}
      {caseData.user_rating && (
        <div className="bg-white shadow-xl rounded-xl border-2 border-gray-100 p-6">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-600">Your rating:</span>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((s) =>
                s <= caseData.user_rating! ? (
                  <StarIconSolid key={s} className="h-5 w-5 text-yellow-400" />
                ) : (
                  <StarIcon key={s} className="h-5 w-5 text-gray-300" />
                )
              )}
            </div>
            {caseData.user_feedback && (
              <span className="text-sm text-gray-600 ml-2">— "{caseData.user_feedback}"</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CaseDetailView;
