import React, { useState, useEffect, useCallback } from 'react';
import {
  PlusIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
  ArrowUpTrayIcon,
  DocumentArrowUpIcon,
  CubeIcon,
  ClockIcon,
  CircleStackIcon,
  DocumentTextIcon,
  CheckBadgeIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';
import api from '../services/api';
import { useSoftware } from '../hooks/useSoftware';

/* ═══════════════════════════════════════════════════════════════
   Updates Administration — CRUD for update_releases
   Mirrors the desktop updates/page.tsx (publish update packages)
   ═══════════════════════════════════════════════════════════════ */

interface UpdateRelease {
  id: number;
  software_id: number;
  software_name?: string;
  version: string;
  description: string | null;
  file_path: string | null;
  file_size: number | null;
  file_name: string | null;
  uploaded_by: string | null;
  uploaded_by_name: string | null;
  has_migrations: number;
  migration_notes: string | null;
  schema_file: string | null;
  released_at: string | null;
  created_at: string;
}

/* ── Update Dialog ───────────────────────────────────────── */
const UpdateDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  update: UpdateRelease | null;
  softwareList: { id: number; name: string }[];
  onSaved: () => void;
}> = ({ open, onClose, update, softwareList, onSaved }) => {
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    software_id: '',
    version: '',
    description: '',
    has_migrations: false,
    migration_notes: '',
    schema_file: '',
    file_path: '',
    file_name: '',
  });
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (!open) return;
    if (update) {
      setForm({
        software_id: String(update.software_id || ''),
        version: update.version || '',
        description: update.description || '',
        has_migrations: !!update.has_migrations,
        migration_notes: update.migration_notes || '',
        schema_file: update.schema_file || '',
        file_path: update.file_path || '',
        file_name: update.file_name || '',
      });
    } else {
      setForm({
        software_id: softwareList.length > 0 ? String(softwareList[0].id) : '',
        version: '',
        description: '',
        has_migrations: false,
        migration_notes: '',
        schema_file: '',
        file_path: '',
        file_name: '',
      });
    }
    setFile(null);
    setUploadProgress(0);
  }, [open, update, softwareList]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      if (!form.file_name) {
        setForm(prev => ({ ...prev, file_name: selected.name }));
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      setFile(dropped);
      if (!form.file_name) {
        setForm(prev => ({ ...prev, file_name: dropped.name }));
      }
    }
  };

  const handleUploadFile = async (): Promise<string | null> => {
    if (!file) return form.file_path || null;
    setUploading(true);
    setUploadProgress(0);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('software_id', form.software_id);
      const res = await api.post('/updates/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.total) setUploadProgress(Math.round((e.loaded / e.total) * 100));
        },
      });
      return res.data?.file_path || res.data?.path || null;
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'File upload failed');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.version.trim()) { toast.error('Version is required'); return; }
    if (!form.software_id) { toast.error('Select a software product'); return; }

    setLoading(true);
    try {
      // Upload file first if one was selected
      let filePath = form.file_path;
      if (file) {
        const uploaded = await handleUploadFile();
        if (uploaded) filePath = uploaded;
        else if (!form.file_path) {
          setLoading(false);
          return; // upload failed and no existing file
        }
      }

      const payload: Record<string, any> = {
        software_id: parseInt(form.software_id),
        version: form.version.trim(),
        description: form.description.trim() || null,
        has_migrations: form.has_migrations ? 1 : 0,
        migration_notes: form.migration_notes.trim() || null,
        schema_file: form.schema_file.trim() || null,
        file_path: filePath || null,
      };

      if (update) {
        payload.id = update.id;
        await api.put('/updates/updates', payload);
        toast.success('Update modified');
      } else {
        await api.post('/updates/updates', payload);
        toast.success('Update created');
      }
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save update');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">{update ? 'Edit Update' : 'Publish Update'}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><XMarkIcon className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Software + Version */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Software *</label>
              <select value={form.software_id} onChange={e => setForm({ ...form, software_id: e.target.value })}
                required className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                <option value="">Select…</option>
                {softwareList.map(sw => <option key={sw.id} value={sw.id}>{sw.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Version *</label>
              <input value={form.version} onChange={e => setForm({ ...form, version: e.target.value })}
                required className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g., 2.1.0" />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description / Release Notes</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              rows={4} className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="Describe what's new in this update…" />
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Update Package File</label>
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              className="border-2 border-dashed rounded-lg p-6 text-center hover:border-picton-blue/50 transition-colors cursor-pointer"
              onClick={() => document.getElementById('update-file-input')?.click()}
            >
              <input id="update-file-input" type="file" className="hidden" onChange={handleFileChange}
                accept=".zip,.tar,.tar.gz,.tgz,.gz" />
              {file ? (
                <div className="flex items-center justify-center gap-2">
                  <DocumentArrowUpIcon className="h-6 w-6 text-picton-blue" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-900">{file.name}</p>
                    <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <button type="button" onClick={(e) => { e.stopPropagation(); setFile(null); }}
                    className="p-1 rounded hover:bg-gray-100"><XMarkIcon className="h-4 w-4 text-gray-400" /></button>
                </div>
              ) : form.file_path ? (
                <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                  <CheckBadgeIcon className="h-5 w-5 text-emerald-500" />
                  <span>Existing file: {form.file_name || form.file_path}</span>
                </div>
              ) : (
                <div>
                  <ArrowUpTrayIcon className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Drop a file here or click to browse</p>
                  <p className="text-xs text-gray-400 mt-1">.zip, .tar.gz, .tgz</p>
                </div>
              )}
            </div>
            {uploading && (
              <div className="mt-2">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                  <span>Uploading…</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div className="bg-picton-blue h-1.5 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            )}
          </div>

          {/* Migrations */}
          <div className="p-4 bg-gray-50 rounded-lg border space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.has_migrations}
                onChange={e => setForm({ ...form, has_migrations: e.target.checked })}
                className="rounded border-gray-300 text-picton-blue focus:ring-picton-blue" />
              <span className="text-sm font-medium text-gray-700">Includes database migrations</span>
            </label>
            {form.has_migrations && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Migration Notes</label>
                  <textarea value={form.migration_notes} onChange={e => setForm({ ...form, migration_notes: e.target.value })}
                    rows={2} className="w-full px-3 py-2 border rounded-lg text-sm"
                    placeholder="Describe migration steps or changes…" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Schema File Path</label>
                  <input value={form.schema_file} onChange={e => setForm({ ...form, schema_file: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g., migrations/v2.1.0.sql" />
                </div>
              </>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={loading || uploading}
              className="px-6 py-2 text-sm font-medium bg-picton-blue text-white rounded-lg hover:bg-picton-blue/90 disabled:opacity-50">
              {loading ? 'Saving…' : update ? 'Update' : 'Publish'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════
   Main Updates Admin Page
   ═══════════════════════════════════════════════════════════ */

const UpdatesAdmin: React.FC = () => {
  const { software: softwareList } = useSoftware();
  const [updates, setUpdates] = useState<UpdateRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [softwareFilter, setSoftwareFilter] = useState('all');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUpdate, setEditingUpdate] = useState<UpdateRelease | null>(null);

  const loadUpdates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/updates/updates');
      setUpdates(res.data?.updates || []);
    } catch (err: any) {
      toast.error('Failed to load updates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUpdates(); }, [loadUpdates]);

  const handleDelete = async (update: UpdateRelease) => {
    const result = await Swal.fire({
      title: 'Delete Update',
      text: `Delete v${update.version}${update.software_name ? ' (' + update.software_name + ')' : ''}? The package file will also be removed.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Delete',
    });
    if (!result.isConfirmed) return;
    try {
      await api.delete(`/updates/updates?id=${update.id}`);
      toast.success('Update deleted');
      loadUpdates();
    } catch {
      toast.error('Failed to delete update');
    }
  };

  const filteredUpdates = updates.filter(u => {
    if (softwareFilter !== 'all' && String(u.software_id) !== softwareFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return u.version.toLowerCase().includes(q)
        || u.software_name?.toLowerCase().includes(q)
        || u.description?.toLowerCase().includes(q);
    }
    return true;
  });

  const formatSize = (bytes: number | null) => {
    if (!bytes) return '—';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(2) + ' MB';
  };

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const uniqueSoftware = Array.from(new Map(
    updates.filter(u => u.software_name).map(u => [u.software_id, { id: u.software_id, name: u.software_name! }])
  ).values());

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Updates Administration</h2>
              <p className="text-sm text-gray-500">Manage and publish software update packages</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { setEditingUpdate(null); setDialogOpen(true); }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-picton-blue text-white rounded-lg hover:bg-picton-blue/90">
                <PlusIcon className="h-4 w-4" /> Publish Update
              </button>
              <button onClick={loadUpdates} disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-50">
                <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search updates…" className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm" />
            </div>
            <select value={softwareFilter} onChange={e => setSoftwareFilter(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm bg-white min-w-[160px]">
              <option value="all">All Software</option>
              {uniqueSoftware.map(sw => <option key={sw.id} value={sw.id}>{sw.name}</option>)}
            </select>
          </div>

          <div className="text-xs text-gray-500">
            {filteredUpdates.length} update{filteredUpdates.length !== 1 ? 's' : ''} published
          </div>
        </div>
      </div>

      {/* Updates list */}
      {loading && updates.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <ArrowPathIcon className="h-8 w-8 animate-spin text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-400">Loading updates…</p>
          </div>
        </div>
      ) : filteredUpdates.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border p-16 text-center">
          <DocumentArrowUpIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500 mb-3">No updates published yet</p>
          <button onClick={() => { setEditingUpdate(null); setDialogOpen(true); }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-picton-blue text-white rounded-lg hover:bg-picton-blue/90">
            <PlusIcon className="h-4 w-4" /> Publish First Update
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredUpdates.map(update => (
            <div key={update.id}
              className="bg-white rounded-lg shadow-sm border p-5 hover:shadow-md transition-all">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-lg font-bold text-gray-900">v{update.version}</span>
                    {update.software_name && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium border border-blue-200">
                        <CubeIcon className="h-3 w-3" /> {update.software_name}
                      </span>
                    )}
                    {update.has_migrations === 1 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-medium border border-amber-200">
                        <CircleStackIcon className="h-3 w-3" /> Has Migrations
                      </span>
                    )}
                  </div>

                  {update.description && (
                    <p className="mt-2 text-sm text-gray-600 line-clamp-2">{update.description}</p>
                  )}

                  <div className="flex items-center gap-4 mt-3 text-xs text-gray-500 flex-wrap">
                    <span className="flex items-center gap-1">
                      <ClockIcon className="h-3.5 w-3.5" />
                      Released {formatDate(update.released_at || update.created_at)}
                    </span>
                    {update.file_name && (
                      <span className="flex items-center gap-1">
                        <DocumentTextIcon className="h-3.5 w-3.5" />
                        {update.file_name}
                      </span>
                    )}
                    {update.file_size && (
                      <span>{formatSize(update.file_size)}</span>
                    )}
                    {update.uploaded_by_name && (
                      <span>by {update.uploaded_by_name}</span>
                    )}
                  </div>

                  {update.migration_notes && (
                    <div className="mt-2 p-2 bg-amber-50 rounded border border-amber-100 text-xs text-amber-700">
                      <strong>Migration notes:</strong> {update.migration_notes}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => { setEditingUpdate(update); setDialogOpen(true); }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border rounded-lg hover:bg-gray-50">
                    <PencilIcon className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button onClick={() => handleDelete(update)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border rounded-lg text-red-500 hover:bg-red-50">
                    <TrashIcon className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <UpdateDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditingUpdate(null); }}
        update={editingUpdate}
        softwareList={softwareList.map(s => ({ id: s.id, name: s.name }))}
        onSaved={loadUpdates}
      />
    </div>
  );
};

export default UpdatesAdmin;
