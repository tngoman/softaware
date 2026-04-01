import { useEffect, useState, useCallback } from 'react';
import api from '../../lib/api';

const CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'mathematical_protocols', label: 'Mathematical Protocols' },
  { value: 'time_and_systems', label: 'Time & Systems' },
  { value: 'universal_currency', label: 'Universal Currency' },
];

export default function DictionaryManager() {
  const [terms, setTerms] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modal, setModal] = useState(null); // null | 'add' | 'edit'
  const [editingTerm, setEditingTerm] = useState(null);
  const [form, setForm] = useState({ category: 'mathematical_protocols', term: '', meaning: '', the_leap: '' });
  const [saving, setSaving] = useState(false);

  const fetchTerms = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (category) params.set('category', category);
      if (search) params.set('search', search);

      const { data } = await api.get(`/index?${params}`);
      setTerms(data.data.terms);
      setTotal(data.data.total);
    } catch (err) {
      console.error('Failed to fetch terms:', err);
    } finally {
      setLoading(false);
    }
  }, [page, category, search]);

  useEffect(() => { fetchTerms(); }, [fetchTerms]);

  const openAdd = () => {
    setForm({ category: 'mathematical_protocols', term: '', meaning: '', the_leap: '' });
    setEditingTerm(null);
    setModal('add');
  };

  const openEdit = (term) => {
    setForm({ category: term.category, term: term.term, meaning: term.meaning, the_leap: term.the_leap });
    setEditingTerm(term);
    setModal('edit');
  };

  const closeModal = () => {
    setModal(null);
    setEditingTerm(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (modal === 'add') {
        await api.post('/index', form);
      } else {
        await api.put(`/index/${editingTerm.id}`, form);
      }
      closeModal();
      fetchTerms();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this term from the canon?')) return;
    try {
      await api.delete(`/index/${id}`);
      fetchTerms();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete');
    }
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Dictionary</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {total} canon terms loaded
          </p>
        </div>
        <button
          onClick={openAdd}
          className="btn btn-primary"
        >
          + ADD TERM
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <select
          value={category}
          onChange={(e) => { setCategory(e.target.value); setPage(1); }}
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Search terms…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          style={{ maxWidth: '240px' }}
        />
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-[var(--text-secondary)]">
              <th className="text-left px-4 py-3 uppercase tracking-widest font-medium">Term</th>
              <th className="text-left px-4 py-3 uppercase tracking-widest font-medium">Meaning</th>
              <th className="text-left px-4 py-3 uppercase tracking-widest font-medium">Category</th>
              <th className="text-left px-4 py-3 uppercase tracking-widest font-medium">The Leap</th>
              <th className="px-4 py-3 w-24"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--text-secondary)] tracking-widest">
                  LOADING...
                </td>
              </tr>
            ) : terms.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[var(--text-secondary)]">
                  No terms found.
                </td>
              </tr>
            ) : (
              terms.map((t) => (
                <tr key={t.id} className="border-b border-[var(--border)] hover:bg-[var(--bg-tertiary)] transition-colors">
                  <td className="px-4 py-3 text-[var(--accent)] font-semibold">{t.term}</td>
                  <td className="px-4 py-3">{t.meaning}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                      {t.category.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)] max-w-xs truncate">{t.the_leap}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => openEdit(t)}
                        className="text-[var(--info)] hover:underline cursor-pointer"
                      >
                        edit
                      </button>
                      <button
                        onClick={() => handleDelete(t.id)}
                        className="text-[var(--danger)] hover:underline cursor-pointer"
                      >
                        del
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-5">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn btn-ghost disabled:opacity-30">← Prev</button>
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="btn btn-ghost disabled:opacity-30">Next →</button>
        </div>
      )}

      {/* ─── Add / Edit Modal ─── */}
      {modal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <form
            onSubmit={handleSave}
            className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-6 w-full max-w-lg"
          >
            <h2 className="text-lg font-bold mb-5">
              {modal === 'add' ? '+ New Canon Term' : 'Edit Term'}
            </h2>

            <div className="mb-4">
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-secondary)' }}>Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {CATEGORIES.slice(1).map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-secondary)' }}>Term</label>
              <input
                type="text"
                value={form.term}
                onChange={(e) => setForm({ ...form, term: e.target.value })}
                required
                placeholder='e.g. "1.5 2"'
              />
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-secondary)' }}>Meaning</label>
              <input
                type="text"
                value={form.meaning}
                onChange={(e) => setForm({ ...form, meaning: e.target.value })}
                required
                placeholder='e.g. "15 Minutes"'
              />
            </div>

            <div className="mb-6">
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-secondary)' }}>The Leap</label>
              <textarea
                value={form.the_leap}
                onChange={(e) => setForm({ ...form, the_leap: e.target.value })}
                required
                rows={3}
                placeholder="The logical bridge…"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button type="button" onClick={closeModal} className="btn btn-ghost">Cancel</button>
              <button type="submit" disabled={saving} className="btn btn-primary disabled:opacity-50">
                {saving ? 'Saving…' : modal === 'add' ? 'Create' : 'Update'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
