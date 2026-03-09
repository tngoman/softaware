import api from '../services/api';

/**
 * Staff Chat Model
 * Handles all unified chat operations (DMs + Groups) via REST API.
 * Replaces TeamChatModel for the new /staff-chat endpoints.
 */

// ── Types ───────────────────────────────────────────────────

export interface Conversation {
  id: number;
  type: 'direct' | 'group';
  name: string | null;
  description: string | null;
  icon_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string | null;
  pinned: boolean;
  archived: boolean;
  muted_until: string | null;
  last_read_message_id: number | null;
  last_message_id: number | null;
  last_message_content: string | null;
  last_message_type: string | null;
  last_message_at: string | null;
  last_message_sender_id: string | null;
  last_message_sender_name: string | null;
  unread_count: number;
  member_count: number;
  // DM-specific
  dm_other_name: string | null;
  dm_other_avatar: string | null;
  dm_other_user_id: string | null;
  // Populated in detail
  members?: ConversationMember[];
}

export interface ConversationMember {
  user_id: string;
  role: 'admin' | 'member';
  nickname: string | null;
  joined_at: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  avatar_url: string | null;
  display_name: string;
  online_status: 'online' | 'away' | 'offline';
  last_seen_at: string | null;
}

export interface ChatMessage {
  id: number;
  conversation_id: number;
  sender_id: string;
  sender_name: string;
  sender_avatar: string | null;
  content: string | null;
  message_type: 'text' | 'image' | 'video' | 'audio' | 'file' | 'gif' | 'location' | 'contact' | 'system';
  file_url: string | null;
  file_name: string | null;
  file_type: string | null;
  file_size: number | null;
  thumbnail_url: string | null;
  duration: number | null;
  link_preview: any | null;
  reply_to_id: number | null;
  reply_to: {
    id: number;
    sender_name: string;
    content: string | null;
    message_type: string;
  } | null;
  forwarded_from_id: number | null;
  edited_at: string | null;
  deleted_for_everyone_at: string | null;
  created_at: string;
  status: 'sent' | 'delivered' | 'read';
  reactions: ReactionGroup[];
}

export interface ReactionGroup {
  emoji: string;
  count: number;
  users: { user_id: string; display_name: string }[];
  reacted_by_me: boolean;
}

export interface AvailableUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  avatar_url: string | null;
  display_name: string;
  online_status: 'online' | 'away' | 'offline';
  last_seen_at: string | null;
}

export interface UserProfile {
  user: AvailableUser & { display_name: string };
  shared_conversations: { id: number; type: string; name: string }[];
  shared_conversation_count: number;
}

export interface StarredMessage {
  id: number;
  conversation_id: number;
  content: string | null;
  message_type: string;
  file_url: string | null;
  file_name: string | null;
  created_at: string;
  sender_name: string;
  sender_avatar: string | null;
  conversation_name: string | null;
  conversation_type: string;
  starred_at: string;
}

export interface SearchResult {
  id: number;
  conversation_id: number;
  content: string | null;
  message_type: string;
  created_at: string;
  sender_name: string;
  conversation_name?: string;
  conversation_type?: string;
}

export interface SyncData {
  new_messages: ChatMessage[];
  edited_messages: { id: number; conversation_id: number; content: string; edited_at: string }[];
  deleted_message_ids: number[];
  status_updates: { message_id: number; status: string; timestamp: string }[];
}

export interface GifResult {
  id: string;
  title: string;
  url: string;
  preview: string;
  width: number;
  height: number;
}

export interface LinkPreview {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  domain: string;
  favicon: string | null;
}

export interface CallHistoryEntry {
  id: number;
  conversation_id: number;
  call_type: 'voice' | 'video';
  initiated_by: string;
  status: 'ringing' | 'active' | 'ended' | 'missed' | 'declined';
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  conversation_name: string | null;
  conversation_type: 'direct' | 'group';
  caller_name: string;
  caller_avatar: string | null;
  my_joined_at: string | null;
  participant_count: number;
  other_user_name?: string;
  other_user_avatar?: string | null;
  other_user_id?: string;
}

export interface ScheduledCallParticipant {
  user_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  rsvp: 'pending' | 'accepted' | 'declined';
}

export interface ScheduledCall {
  id: number;
  conversation_id: number;
  created_by: string;
  creator_name: string;
  creator_avatar: string | null;
  title: string;
  description: string | null;
  call_type: 'voice' | 'video';
  screen_share: boolean;
  scheduled_at: string;
  duration_minutes: number;
  recurrence: 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly';
  recurrence_end: string | null;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  call_session_id: number | null;
  conversation_name: string | null;
  conversation_type: 'direct' | 'group';
  participants: ScheduledCallParticipant[];
  my_rsvp: 'pending' | 'accepted' | 'declined';
}

// ── API calls ───────────────────────────────────────────────

export class StaffChatModel {
  // ── Conversations ─────────────────────────────────────────

  static async getConversations(type?: 'direct' | 'group'): Promise<Conversation[]> {
    const params = type ? `?type=${type}` : '';
    const { data } = await api.get(`/staff-chat/conversations${params}`);
    return data.data;
  }

  static async getConversation(id: number): Promise<Conversation> {
    const { data } = await api.get(`/staff-chat/conversations/${id}`);
    return data.data;
  }

  static async createConversation(input: {
    type: 'direct' | 'group';
    name?: string;
    description?: string;
    member_ids: string[];
  }): Promise<Conversation> {
    const { data } = await api.post('/staff-chat/conversations', input);
    return data.data;
  }

  static async updateConversation(id: number, input: {
    name?: string;
    description?: string;
    icon_url?: string;
  }): Promise<Conversation> {
    const { data } = await api.put(`/staff-chat/conversations/${id}`, input);
    return data.data;
  }

  static async deleteConversation(id: number): Promise<void> {
    await api.delete(`/staff-chat/conversations/${id}`);
  }

  static async clearConversation(id: number): Promise<void> {
    await api.post(`/staff-chat/conversations/${id}/clear`);
  }

  // ── Members ───────────────────────────────────────────────

  static async addMembers(conversationId: number, userIds: string[]): Promise<{ added: number }> {
    const { data } = await api.post(`/staff-chat/conversations/${conversationId}/members`, { user_ids: userIds });
    return data.data;
  }

  static async removeMember(conversationId: number, userId: string): Promise<void> {
    await api.delete(`/staff-chat/conversations/${conversationId}/members/${userId}`);
  }

  static async updateMembership(conversationId: number, input: {
    pinned?: boolean;
    archived?: boolean;
    muted_until?: string | null;
    nickname?: string | null;
  }): Promise<void> {
    await api.patch(`/staff-chat/conversations/${conversationId}/members/me`, input);
  }

  // ── Messages ──────────────────────────────────────────────

  static async getMessages(conversationId: number, params?: {
    before?: string;
    limit?: number;
  }): Promise<ChatMessage[]> {
    const query = new URLSearchParams();
    if (params?.before) query.set('before', String(params.before));
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString() ? `?${query}` : '';
    const { data } = await api.get(`/staff-chat/conversations/${conversationId}/messages${qs}`);
    return data.data;
  }

  static async sendMessage(conversationId: number, input: {
    content?: string;
    message_type?: string;
    file_url?: string;
    file_name?: string;
    file_type?: string;
    file_size?: number;
    thumbnail_url?: string;
    reply_to_id?: number;
  }): Promise<ChatMessage> {
    const { data } = await api.post(`/staff-chat/conversations/${conversationId}/messages`, input);
    return data.data;
  }

  static async editMessage(conversationId: number, messageId: number, content: string): Promise<ChatMessage> {
    const { data } = await api.put(`/staff-chat/conversations/${conversationId}/messages/${messageId}`, { content });
    return data.data;
  }

  static async deleteMessage(conversationId: number, messageId: number, forEveryone = false): Promise<void> {
    await api.delete(`/staff-chat/conversations/${conversationId}/messages/${messageId}?for=${forEveryone ? 'everyone' : 'me'}`);
  }

  static async forwardMessage(messageId: number, conversationIds: number[]): Promise<void> {
    await api.post(`/staff-chat/messages/${messageId}/forward`, { conversation_ids: conversationIds });
  }

  // ── Reactions ─────────────────────────────────────────────

  static async toggleReaction(messageId: number, emoji: string): Promise<ReactionGroup[]> {
    const { data } = await api.post(`/staff-chat/messages/${messageId}/reactions`, { emoji });
    return data.data;
  }

  static async getReactions(messageId: number): Promise<ReactionGroup[]> {
    const { data } = await api.get(`/staff-chat/messages/${messageId}/reactions`);
    return data.data;
  }

  // ── Stars ─────────────────────────────────────────────────

  static async toggleStar(messageId: number): Promise<{ starred: boolean }> {
    const { data } = await api.post(`/staff-chat/messages/${messageId}/star`);
    return data;
  }

  static async getStarredMessages(): Promise<StarredMessage[]> {
    const { data } = await api.get('/staff-chat/starred');
    return data.data;
  }

  // ── Report ────────────────────────────────────────────────

  static async reportMessage(messageId: number, reason: string): Promise<void> {
    await api.post(`/staff-chat/messages/${messageId}/report`, { reason });
  }

  // ── Read Receipts ─────────────────────────────────────────

  static async markRead(conversationId: number, messageId?: number): Promise<void> {
    await api.post(`/staff-chat/conversations/${conversationId}/read`, messageId ? { message_id: messageId } : {});
  }

  // ── Search ────────────────────────────────────────────────

  static async searchGlobal(query: string, limit = 20): Promise<SearchResult[]> {
    const { data } = await api.get(`/staff-chat/search?q=${encodeURIComponent(query)}&limit=${limit}`);
    return data.data;
  }

  static async searchInConversation(conversationId: number, query: string): Promise<SearchResult[]> {
    const { data } = await api.get(`/staff-chat/conversations/${conversationId}/search?q=${encodeURIComponent(query)}`);
    return data.data;
  }

  // ── Media ─────────────────────────────────────────────────

  static async getMedia(conversationId: number, type = 'images', page = 1): Promise<any[]> {
    const { data } = await api.get(`/staff-chat/conversations/${conversationId}/media?type=${type}&page=${page}`);
    return data.data;
  }

  // ── Upload ────────────────────────────────────────────────

  static async uploadFile(conversationId: number, file: {
    file_name: string;
    file_type: string;
    file_data: string;
  }): Promise<{ file_url: string; file_name: string; file_type: string; file_size: number; thumbnail_url?: string }> {
    const { data } = await api.post(`/staff-chat/conversations/${conversationId}/upload`, file);
    return data;
  }

  static async uploadAvatar(fileData: string, fileName: string): Promise<{ avatar_url: string }> {
    const { data } = await api.post('/staff-chat/profile/avatar', { file_data: fileData, file_name: fileName });
    return data;
  }

  // ── GIFs ──────────────────────────────────────────────────

  static async searchGifs(query?: string, limit = 20): Promise<GifResult[]> {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    params.set('limit', String(limit));
    const { data } = await api.get(`/staff-chat/gifs?${params}`);
    return data.data;
  }

  // ── Link Preview ──────────────────────────────────────────

  static async getLinkPreview(url: string): Promise<LinkPreview | null> {
    const { data } = await api.get(`/staff-chat/link-preview?url=${encodeURIComponent(url)}`);
    return data.data;
  }

  // ── Users ─────────────────────────────────────────────────

  static async getAvailableUsers(): Promise<AvailableUser[]> {
    const { data } = await api.get('/staff-chat/users/available');
    return data.data;
  }

  static async getUserProfile(userId: string): Promise<UserProfile> {
    const { data } = await api.get(`/staff-chat/users/${userId}/profile`);
    return data.data;
  }

  // ── Sync ──────────────────────────────────────────────────

  static async sync(since: string): Promise<SyncData> {
    const { data } = await api.get(`/staff-chat/sync?since=${encodeURIComponent(since)}`);
    return data.data;
  }

  // ── Do Not Disturb ────────────────────────────────────────

  static async getDndSettings(): Promise<{ enabled: boolean; start: string | null; end: string | null }> {
    const { data } = await api.get('/staff-chat/dnd');
    return data.data;
  }

  static async updateDndSettings(settings: { enabled: boolean; start?: string | null; end?: string | null }): Promise<void> {
    await api.put('/staff-chat/dnd', settings);
  }

  // ── Notification Sound ────────────────────────────────────

  static async setNotificationSound(conversationId: number, sound: string | null): Promise<void> {
    await api.put(`/staff-chat/conversations/${conversationId}/notification-sound`, { sound });
  }
  // ── Voice & Video Calling ─────────────────────────────

  static async getIceConfig(): Promise<{ iceServers: RTCIceServer[] }> {
    const { data } = await api.get('/staff-chat/calls/ice-config');
    return data.data;
  }

  static async initiateCall(conversationId: number, callType: 'voice' | 'video'): Promise<{
    call_id: number;
    conversation_id: number;
    call_type: string;
    status: string;
  }> {
    const { data } = await api.post('/staff-chat/calls/initiate', {
      conversation_id: conversationId,
      call_type: callType,
    });
    return data.data;
  }

  static async acceptCall(callId: number): Promise<void> {
    await api.post(`/staff-chat/calls/${callId}/accept`);
  }

  static async endCall(callId: number): Promise<void> {
    await api.post(`/staff-chat/calls/${callId}/end`);
  }

  static async getCallHistory(limit = 50, offset = 0): Promise<CallHistoryEntry[]> {
    const { data } = await api.get(`/staff-chat/calls/history?limit=${limit}&offset=${offset}`);
    return data.data;
  }

  static async getCallDetail(callId: number): Promise<any> {
    const { data } = await api.get(`/staff-chat/calls/${callId}`);
    return data.data;
  }

  // ── Scheduled Calls ───────────────────────────────────

  static async createScheduledCall(input: {
    conversation_id: number;
    title: string;
    description?: string;
    call_type: 'voice' | 'video';
    screen_share?: boolean;
    scheduled_at: string;
    duration_minutes?: number;
    recurrence?: 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly';
    recurrence_end?: string;
    participant_ids?: string[];
  }): Promise<ScheduledCall> {
    const { data } = await api.post('/staff-chat/scheduled-calls', input);
    return data.data;
  }

  static async getScheduledCalls(params?: {
    conversation_id?: number;
    status?: string;
    upcoming?: boolean;
  }): Promise<ScheduledCall[]> {
    const query = new URLSearchParams();
    if (params?.conversation_id) query.set('conversation_id', String(params.conversation_id));
    if (params?.upcoming) {
      query.set('status', 'upcoming');
    } else if (params?.status) {
      query.set('status', params.status);
    }
    const qs = query.toString() ? `?${query}` : '';
    const { data } = await api.get(`/staff-chat/scheduled-calls${qs}`);
    return data.data;
  }

  static async getScheduledCallDetail(id: number): Promise<ScheduledCall> {
    const { data } = await api.get(`/staff-chat/scheduled-calls/${id}`);
    return data.data;
  }

  static async updateScheduledCall(id: number, input: {
    title?: string;
    description?: string;
    call_type?: 'voice' | 'video';
    screen_share?: boolean;
    scheduled_at?: string;
    duration_minutes?: number;
    recurrence?: 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly';
    recurrence_end?: string;
  }): Promise<ScheduledCall> {
    const { data } = await api.put(`/staff-chat/scheduled-calls/${id}`, input);
    return data.data;
  }

  static async cancelScheduledCall(id: number): Promise<void> {
    await api.delete(`/staff-chat/scheduled-calls/${id}`);
  }

  static async rsvpScheduledCall(id: number, rsvp: 'accepted' | 'declined'): Promise<void> {
    await api.post(`/staff-chat/scheduled-calls/${id}/rsvp`, { rsvp });
  }

  static async startScheduledCall(id: number): Promise<{
    call_id: number;
    conversation_id: number;
    call_type: string;
    status: string;
  }> {
    const { data } = await api.post(`/staff-chat/scheduled-calls/${id}/start`);
    return data.data;
  }

  static async addScheduledCallParticipants(id: number, userIds: string[]): Promise<{ added: number }> {
    const { data } = await api.post(`/staff-chat/scheduled-calls/${id}/participants`, { user_ids: userIds });
    return data.data;
  }

  static async removeScheduledCallParticipant(id: number, userId: string): Promise<void> {
    await api.delete(`/staff-chat/scheduled-calls/${id}/participants/${userId}`);
  }
}
