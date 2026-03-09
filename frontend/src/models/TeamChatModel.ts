import api from '../services/api';

/**
 * Team Chat Model
 * Handles all local DB-backed team chat operations (REST API).
 * These are "local teams" as opposed to external Socket.IO groups.
 */

// ── Types ───────────────────────────────────────────────────

export interface TeamChat {
  id: number;
  name: string;
  description?: string;
  created_by?: string;
  created_at: string;
  updated_at?: string;
  member_count?: number;
  last_message?: string;
  last_message_at?: string;
}

export interface TeamChatMember {
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  display_name: string;
}

export interface TeamChatMessage {
  id: number;
  team_id: number;
  user_id: string;
  content: string;
  message_type: 'text' | 'image' | 'video' | 'audio' | 'file';
  file_url?: string;
  file_name?: string;
  file_type?: string;
  file_size?: number;
  reply_to_id?: number;
  reply_to_content?: string;
  reply_to_user_name?: string;
  created_at: string;
  user_name: string;
}

export interface AvailableUser {
  id: string;
  first_name?: string;
  last_name?: string;
  email: string;
  display_name: string;
}

// ── API calls ───────────────────────────────────────────────

export class TeamChatModel {
  /** List all teams the current user is a member of */
  static async getAll(): Promise<TeamChat[]> {
    const res = await api.get<{ success: boolean; data: TeamChat[] }>('/team-chats');
    return res.data.data || [];
  }

  /** Get single team with members */
  static async getById(id: number): Promise<TeamChat & { members: TeamChatMember[] }> {
    const res = await api.get<{ success: boolean; data: TeamChat & { members: TeamChatMember[] } }>(`/team-chats/${id}`);
    return res.data.data;
  }

  /** Create a new team */
  static async create(data: { name: string; description?: string }): Promise<TeamChat> {
    const res = await api.post<{ success: boolean; data: TeamChat }>('/team-chats', data);
    return res.data.data;
  }

  /** Update team name/description */
  static async update(id: number, data: { name?: string; description?: string }): Promise<TeamChat> {
    const res = await api.put<{ success: boolean; data: TeamChat }>(`/team-chats/${id}`, data);
    return res.data.data;
  }

  /** Delete a team */
  static async delete(id: number): Promise<void> {
    await api.delete(`/team-chats/${id}`);
  }

  /** Add members to a team */
  static async addMembers(teamId: number, userIds: string[]): Promise<{ added: number }> {
    const res = await api.post<{ success: boolean; added: number }>(`/team-chats/${teamId}/members`, { user_ids: userIds });
    return { added: res.data.added };
  }

  /** Remove a member from a team */
  static async removeMember(teamId: number, userId: string): Promise<void> {
    await api.delete(`/team-chats/${teamId}/members/${userId}`);
  }

  /** Get messages for a team */
  static async getMessages(teamId: number, params?: { limit?: number; before?: string }): Promise<TeamChatMessage[]> {
    const res = await api.get<{ success: boolean; data: TeamChatMessage[] }>(`/team-chats/${teamId}/messages`, { params });
    return res.data.data || [];
  }

  /** Send a message to a team */
  static async sendMessage(teamId: number, data: {
    content: string;
    message_type?: string;
    file_url?: string;
    file_name?: string;
    file_type?: string;
    file_size?: number;
    reply_to_id?: string;
  }): Promise<TeamChatMessage> {
    const res = await api.post<{ success: boolean; data: TeamChatMessage }>(`/team-chats/${teamId}/messages`, data);
    return res.data.data;
  }

  /** Delete a message */
  static async deleteMessage(teamId: number, messageId: number): Promise<void> {
    await api.delete(`/team-chats/${teamId}/messages/${messageId}`);
  }

  /** Get available users for the member picker */
  static async getAvailableUsers(): Promise<AvailableUser[]> {
    const res = await api.get<{ success: boolean; data: AvailableUser[] }>('/team-chats/users/available');
    return res.data.data || [];
  }

  /** Upload a file to a team chat */
  static async uploadFile(
    teamId: number,
    file: { file_name: string; file_type: string; file_data: string },
  ): Promise<{ file_url: string; file_name: string; file_type: string; file_size: number }> {
    const res = await api.post<{
      success: boolean;
      file_url: string;
      file_name: string;
      file_type: string;
      file_size: number;
    }>(`/team-chats/${teamId}/upload`, file);
    return {
      file_url: res.data.file_url,
      file_name: res.data.file_name,
      file_type: res.data.file_type,
      file_size: res.data.file_size,
    };
  }
}
