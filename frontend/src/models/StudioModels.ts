/**
 * Studio Models — API client for Softaware Studio
 */
import api from '../services/api';

// ─── Types ───────────────────────────────────────────────────────────────

export interface StudioSite {
  id: string;
  business_name: string;
  tagline: string;
  status: 'draft' | 'generating' | 'generated' | 'deployed' | 'failed';
  tier: string;
  max_pages: number;
  logo_url: string | null;
  custom_domain: string | null;
  primary_color: string;
  font_family: string;
  user_id: string;
  owner_email?: string;
  owner_name?: string;
  page_count?: number;
  deploy_count?: number;
  pages?: StudioPage[];
  created_at: string;
  updated_at: string;
}

export interface StudioPage {
  id: string;
  site_id: string;
  name: string;
  page_type: string;
  title: string;
  slug: string;
  sort_order: number;
  status: string;
  content?: string;
  generated_html?: string;
  html_content?: string;
  css_content?: string;
  created_at: string;
  updated_at: string;
}

export interface StudioSnapshot {
  id: string;
  site_id: string;
  staff_id: string;
  label: string;
  page_data?: unknown;
  styles_data?: unknown;
  thumbnail?: string;
  created_at: string;
}

export interface StickyNote {
  id: string;
  site_id: string;
  page_id: string | null;
  staff_id: string;
  staff_name?: string;
  content: string;
  color: 'yellow' | 'pink' | 'blue' | 'green' | 'purple';
  pos_x: number;
  pos_y: number;
  width: number;
  height: number;
  minimized: boolean;
  resolved: boolean;
  reply_count?: number;
  replies?: NoteReply[];
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface NoteReply {
  id: string;
  note_id: string;
  staff_id: string;
  content: string;
  created_by_name?: string;
  created_at: string;
}

export interface SiteCollection {
  collection_name: string;
  count: number;
  item_count?: number;
  total_bytes: number;
  allowPublicWrite: boolean;
  schemaTemplate: Record<string, string> | null;
}

export interface StudioStats {
  total_sites: number;
  deployed: number;
  generating: number;
  failed: number;
  draft: number;
  total_pages: number;
  total_deployments: number;
}

export interface StudioAction {
  type: 'update_component' | 'insert_component' | 'delete_component' |
        'update_styles' | 'update_page' | 'create_page' |
        'suggest_palette' | 'add_note' | 'generate_image';
  target?: string;
  description?: string;
  html?: string;
  css?: string;
  palette?: string[];
  imageUrl?: string;
  note?: { text: string; color: string; position: { x: number; y: number } };
  preview?: string;
  requiresApproval: boolean;
}

// ─── API Client ──────────────────────────────────────────────────────────

export class StudioModel {
  private static BASE = '/v1/studio';

  // ── Sites ──────────────────────────────────────────────────────────

  static async listSites(params?: { search?: string; status?: string; limit?: number; offset?: number }) {
    const res = await api.get<{ success: boolean; sites: StudioSite[]; total: number }>(`${this.BASE}/sites`, { params });
    return { sites: res.data.sites, total: res.data.total };
  }

  static async getStats() {
    const res = await api.get<{ success: boolean; stats: StudioStats }>(`${this.BASE}/sites/stats`);
    return res.data.stats;
  }

  static async getSite(siteId: string) {
    const res = await api.get<{ success: boolean; site: StudioSite; pages: StudioPage[]; deployments: unknown[] }>(`${this.BASE}/sites/${siteId}`);
    return res.data;
  }

  static async updateSite(siteId: string, data: Partial<StudioSite>) {
    await api.put(`${this.BASE}/sites/${siteId}`, data);
  }

  static async createSite(data: { clientId: string; businessName: string; tagline?: string; about?: string; services?: string; primaryColor?: string; fontFamily?: string; maxPages?: number }) {
    const res = await api.post<{ success: boolean; siteId: string; pageId: string }>(`${this.BASE}/sites`, data);
    return res.data;
  }

  static async deleteSite(siteId: string) {
    await api.delete(`${this.BASE}/sites/${siteId}`);
  }

  // ── Snapshots ──────────────────────────────────────────────────────

  static async listSnapshots(siteId: string) {
    const res = await api.get<{ success: boolean; snapshots: StudioSnapshot[] }>(`${this.BASE}/sites/${siteId}/snapshots`);
    return res.data.snapshots;
  }

  static async createSnapshot(siteId: string, label?: string) {
    const res = await api.post<{ success: boolean; snapshotId: string }>(`${this.BASE}/sites/${siteId}/snapshots`, { label });
    return res.data.snapshotId;
  }

  static async getSnapshot(siteId: string, snapshotId: string) {
    const res = await api.get<{ success: boolean; snapshot: StudioSnapshot }>(`${this.BASE}/sites/${siteId}/snapshots/${snapshotId}`);
    return res.data.snapshot;
  }

  static async deleteSnapshot(siteId: string, snapshotId: string) {
    await api.delete(`${this.BASE}/sites/${siteId}/snapshots/${snapshotId}`);
  }

  // ── Sticky Notes ───────────────────────────────────────────────────

  static async listNotes(siteId: string, pageId?: string) {
    const params = pageId ? { pageId } : {};
    const res = await api.get<{ success: boolean; notes: StickyNote[] }>(`${this.BASE}/sites/${siteId}/notes`, { params });
    return res.data.notes;
  }

  static async createNote(siteId: string, data: { content: string; color?: string; pageId?: string; posX?: number; posY?: number }) {
    const res = await api.post<{ success: boolean; noteId: string }>(`${this.BASE}/sites/${siteId}/notes`, data);
    return res.data.noteId;
  }

  static async updateNote(siteId: string, noteId: string, data: Partial<StickyNote>) {
    await api.put(`${this.BASE}/sites/${siteId}/notes/${noteId}`, data);
  }

  static async deleteNote(siteId: string, noteId: string) {
    await api.delete(`${this.BASE}/sites/${siteId}/notes/${noteId}`);
  }

  static async addNoteReply(siteId: string, noteId: string, content: string) {
    const res = await api.post<{ success: boolean; replyId: string }>(`${this.BASE}/sites/${siteId}/notes/${noteId}/replies`, { content });
    return res.data.replyId;
  }

  // ── Collections ────────────────────────────────────────────────────

  static async listCollections(siteId: string) {
    const res = await api.get<{ success: boolean; collections: SiteCollection[] }>(`${this.BASE}/sites/${siteId}/collections`);
    return res.data.collections;
  }

  static async getCollection(siteId: string, collectionName: string) {
    const res = await api.get<{ success: boolean; items: any[] }>(`${this.BASE}/sites/${siteId}/collections/${collectionName}`);
    return res.data.items;
  }

  static async createCollection(siteId: string, collectionName: string, data: Record<string, unknown>) {
    const res = await api.post<{ success: boolean; id: string }>(`${this.BASE}/sites/${siteId}/collections/${collectionName}`, data);
    return res.data.id;
  }

  static async createCollectionRecord(siteId: string, collectionName: string, data: Record<string, unknown>) {
    const res = await api.post<{ success: boolean; id: string }>(`${this.BASE}/sites/${siteId}/collections/${collectionName}`, data);
    return res.data.id;
  }

  static async deleteCollectionItem(siteId: string, collectionName: string, itemId: string) {
    await api.delete(`${this.BASE}/sites/${siteId}/collections/${collectionName}/${itemId}`);
  }

  static async updateCollectionMeta(siteId: string, collectionName: string, data: { allowPublicWrite?: boolean; schemaTemplate?: Record<string, string> }) {
    await api.patch(`${this.BASE}/sites/${siteId}/collections/${collectionName}/meta`, data);
  }

  // ── AI Intent (studio-mode) ────────────────────────────────────────

  static async sendStudioIntent(data: {
    text: string;
    assistantId?: string;
    conversationId?: string;
    siteId?: string;
    selectedComponent?: { id: string; type: string; html: string; css: string };
    viewport?: 'desktop' | 'tablet' | 'mobile';
    siteContext?: { businessName: string; industry: string; colorPalette: string[]; pageCount: number; currentPageType: string };
  }) {
    const res = await api.post<{
      reply: string;
      conversationId: string;
      toolsUsed: string[];
      data?: Record<string, unknown>;
    }>('/v1/mobile/intent', {
      text: data.text,
      assistantId: data.assistantId,
      conversationId: data.conversationId,
      context: 'studio',
      siteId: data.siteId,
      studioContext: {
        selectedComponent: data.selectedComponent,
        viewport: data.viewport,
        siteContext: data.siteContext,
      },
    });
    return res.data;
  }
}
