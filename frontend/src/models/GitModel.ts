import api from '../services/api';

/**
 * Git Model — All git operations for the Source Control page.
 *
 * API base: /code/git
 */
export const GitModel = {
  // ─── Read Operations ──────────────────────────────────────

  /** Get branch restriction config & current branch */
  async getConfig() {
    const res = await api.get('/code/git/config');
    return res.data;
  },

  /** Get repo info (branch, last commit, remote, status) */
  async getInfo() {
    const res = await api.get('/code/git/info');
    return res.data;
  },

  /** Get working tree status (files, staged/unstaged counts) */
  async getStatus() {
    const res = await api.get('/code/git/status');
    return res.data;
  },

  /** List all branches */
  async getBranches() {
    const res = await api.get('/code/git/branches');
    return res.data;
  },

  /** Get commit log */
  async getLog(limit = 20, path?: string) {
    const params: Record<string, any> = { limit };
    if (path) params.path = path;
    const res = await api.get('/code/git/log', { params });
    return res.data;
  },

  /** Get a single commit's details */
  async getCommit(hash: string) {
    const res = await api.get(`/code/git/commit/${hash}`);
    return res.data;
  },

  /** Get diff (staged or unstaged) */
  async getDiff(staged = false, file?: string) {
    const params: Record<string, any> = { staged: staged ? 'true' : 'false' };
    if (file) params.file = file;
    const res = await api.get('/code/git/diff', { params });
    return res.data;
  },

  /** List tags */
  async getTags() {
    const res = await api.get('/code/git/tags');
    return res.data;
  },

  /** List stash entries */
  async getStashList() {
    const res = await api.get('/code/git/stash/list');
    return res.data;
  },

  /** Get file history */
  async getHistory(path: string) {
    const res = await api.get('/code/git/history', { params: { path } });
    return res.data;
  },

  /** Get file content at a specific ref */
  async getFileContent(path: string, ref = 'HEAD') {
    const res = await api.get('/code/git/file-content', { params: { path, ref } });
    return res.data;
  },

  // ─── Write Operations (Bugfix branch only) ───────────────

  /** Switch to the Bugfix branch */
  async checkout(branch: string) {
    const res = await api.post('/code/git/checkout', { branch });
    return res.data;
  },

  /** Fetch latest from remote (no merge) */
  async fetch() {
    const res = await api.post('/code/git/fetch');
    return res.data;
  },

  /** Pull latest from origin/Bugfix */
  async pull() {
    const res = await api.post('/code/git/pull');
    return res.data;
  },

  /** Stage files (omit files to stage all) */
  async stage(files?: string[]) {
    const res = await api.post('/code/git/stage', { files });
    return res.data;
  },

  /** Unstage files (omit files to unstage all) */
  async unstage(files?: string[]) {
    const res = await api.post('/code/git/unstage', { files });
    return res.data;
  },

  /** Commit staged changes */
  async commit(message: string) {
    const res = await api.post('/code/git/commit', { message });
    return res.data;
  },

  /** Push to remote */
  async push() {
    const res = await api.post('/code/git/push');
    return res.data;
  },

  /** Stash changes */
  async stash(message?: string) {
    const res = await api.post('/code/git/stash', { message });
    return res.data;
  },

  /** Pop stash */
  async stashPop() {
    const res = await api.post('/code/git/stash/pop');
    return res.data;
  },

  /** Discard changes (omit files to discard all) */
  async discard(files?: string[]) {
    const res = await api.post('/code/git/discard', { files });
    return res.data;
  },

  /** Reset to a commit */
  async reset(target = 'HEAD', mode: 'soft' | 'mixed' | 'hard' = 'mixed') {
    const res = await api.post('/code/git/reset', { target, mode });
    return res.data;
  },

  /** Resolve merge conflicts */
  async resolveConflicts(strategy: 'ours' | 'theirs', files?: string[]) {
    const res = await api.post('/code/git/resolve-conflicts', { strategy, files });
    return res.data;
  },

  /** Abort an in-progress merge */
  async abortMerge() {
    const res = await api.post('/code/git/abort-merge');
    return res.data;
  },
};
