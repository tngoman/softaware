import api from '../services/api';

/**
 * Planning Model — Handles calendar/schedule/meeting operations
 */

// ─── Types ───────────────────────────────────────────────────────────────

export type EventType = 'meeting' | 'call' | 'reminder' | 'task' | 'email_invite' | 'other';
export type SourceType = 'manual' | 'scheduled_call' | 'email_invite';
export type EventStatus = 'confirmed' | 'tentative' | 'cancelled' | 'declined';
export type Recurrence = 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly';
export type CallType = 'voice' | 'video';
export type RsvpStatus = 'pending' | 'accepted' | 'declined' | 'tentative';

export interface EventAttendee {
  user_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  rsvp: RsvpStatus;
  is_organizer: boolean | number;
  added_at: string;
  responded_at: string | null;
}

export interface CalendarEvent {
  id: number;
  user_id: string;
  title: string;
  description: string | null;
  location: string | null;
  event_type: EventType;
  source_type: SourceType;
  start_at: string;
  end_at: string;
  all_day: boolean;
  recurrence: Recurrence;
  recurrence_end: string | null;
  status: EventStatus;
  scheduled_call_id: number | null;
  call_session_id: number | null;
  email_account_id: number | null;
  email_folder: string | null;
  email_uid: number | null;
  email_message_id: string | null;
  ical_uid: string | null;
  organizer_name: string | null;
  organizer_email: string | null;
  color: string | null;
  reminder_minutes: number | null;
  reminder_sent: boolean;
  invitation_token: string | null;
  meeting_link: string | null;
  call_type: CallType | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Enriched from backend
  attendees?: EventAttendee[];
  attendee_count?: number;
  accepted_attendees?: number;
}

export interface CreateEventInput {
  title: string;
  description?: string;
  location?: string;
  event_type?: EventType;
  start_at: string;
  end_at: string;
  all_day?: boolean;
  recurrence?: Recurrence;
  recurrence_end?: string;
  color?: string;
  reminder_minutes?: number;
  call_type?: CallType;
  notes?: string;
  attendee_ids?: string[];
  meeting_link?: string;
}

export interface UpdateEventInput {
  title?: string;
  description?: string | null;
  location?: string | null;
  event_type?: EventType;
  start_at?: string;
  end_at?: string;
  all_day?: boolean;
  recurrence?: Recurrence;
  recurrence_end?: string | null;
  status?: EventStatus;
  color?: string | null;
  reminder_minutes?: number;
  call_type?: CallType;
  notes?: string | null;
  meeting_link?: string | null;
  attendee_ids?: string[];
}

export interface CalendarStats {
  today: number;
  this_week: number;
  pending_invites: number;
}

export interface EmailInvitation {
  uid: number;
  subject: string;
  from: { name: string; address: string };
  date: string;
  already_imported: boolean;
  calendar_event_id: number | null;
}

export interface PlanningUser {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
}

export interface StartCallResult {
  action: 'start_scheduled_call' | 'initiate_call';
  scheduled_call_id?: number;
  call_session_id?: number;
  event_id?: number;
  call_type?: string;
  title?: string;
  attendee_user_ids?: string[];
}

// ─── API Methods ─────────────────────────────────────────────────────────

export class PlanningModel {

  // ── Calendar Events ─────────────────────────────────────────────────

  static async getEvents(params?: {
    start?: string; end?: string;
    source_type?: SourceType; event_type?: EventType; status?: EventStatus;
  }): Promise<CalendarEvent[]> {
    const query = new URLSearchParams();
    if (params?.start) query.set('start', params.start);
    if (params?.end) query.set('end', params.end);
    if (params?.source_type) query.set('source_type', params.source_type);
    if (params?.event_type) query.set('event_type', params.event_type);
    if (params?.status) query.set('status', params.status);
    const qs = query.toString();
    const res = await api.get<{ success: boolean; data: CalendarEvent[] }>(
      `/planning/events${qs ? '?' + qs : ''}`
    );
    return res.data.data;
  }

  static async getEvent(id: number): Promise<CalendarEvent> {
    const res = await api.get<{ success: boolean; data: CalendarEvent }>(`/planning/events/${id}`);
    return res.data.data;
  }

  static async createEvent(data: CreateEventInput): Promise<CalendarEvent> {
    const res = await api.post<{ success: boolean; data: CalendarEvent }>('/planning/events', data);
    return res.data.data;
  }

  static async updateEvent(id: number, data: UpdateEventInput): Promise<CalendarEvent> {
    const res = await api.put<{ success: boolean; data: CalendarEvent }>(`/planning/events/${id}`, data);
    return res.data.data;
  }

  static async deleteEvent(id: number): Promise<void> {
    await api.delete(`/planning/events/${id}`);
  }

  // ── Respond / RSVP ─────────────────────────────────────────────────

  static async respondToEvent(id: number, status: 'accepted' | 'tentative' | 'declined'): Promise<CalendarEvent> {
    const res = await api.post<{ success: boolean; data: CalendarEvent }>(`/planning/events/${id}/respond`, { status });
    return res.data.data;
  }

  // ── Attendees ───────────────────────────────────────────────────────

  static async addAttendees(eventId: number, userIds: string[]): Promise<CalendarEvent> {
    const res = await api.post<{ success: boolean; data: CalendarEvent }>(`/planning/events/${eventId}/attendees`, { user_ids: userIds });
    return res.data.data;
  }

  static async removeAttendee(eventId: number, userId: string): Promise<void> {
    await api.delete(`/planning/events/${eventId}/attendees/${userId}`);
  }

  // ── Invitation Links ────────────────────────────────────────────────

  static async resolveInvite(token: string): Promise<{ event: CalendarEvent; my_rsvp: string | null; is_my_event: boolean }> {
    const res = await api.get<{ success: boolean; data: CalendarEvent; my_rsvp: string | null; is_my_event: boolean }>(
      `/planning/invite/${token}`
    );
    return { event: res.data.data, my_rsvp: res.data.my_rsvp, is_my_event: res.data.is_my_event };
  }

  static async acceptInvite(token: string, rsvp: 'accepted' | 'tentative' | 'declined' = 'accepted'): Promise<CalendarEvent> {
    const res = await api.post<{ success: boolean; data: CalendarEvent }>(`/planning/invite/${token}/accept`, { rsvp });
    return res.data.data;
  }

  // ── Call Integration ────────────────────────────────────────────────

  static async startCall(eventId: number): Promise<StartCallResult> {
    const res = await api.post<{ success: boolean; data: StartCallResult }>(`/planning/events/${eventId}/start-call`);
    return res.data.data;
  }

  // ── Users (for attendee picker) ─────────────────────────────────────

  static async searchUsers(q?: string): Promise<PlanningUser[]> {
    const res = await api.get<{ success: boolean; data: PlanningUser[] }>(
      `/planning/users${q ? '?q=' + encodeURIComponent(q) : ''}`
    );
    return res.data.data;
  }

  // ── Scheduled Call Sync ─────────────────────────────────────────────

  static async syncScheduledCalls(): Promise<{ imported: number; total: number }> {
    const res = await api.post<{ success: boolean; data: { imported: number; total: number } }>(
      '/planning/sync/scheduled-calls'
    );
    return res.data.data;
  }

  // ── Email Invitation Scan & Import ──────────────────────────────────

  static async scanEmailInvites(accountId: number): Promise<EmailInvitation[]> {
    const res = await api.get<{ success: boolean; data: EmailInvitation[] }>(
      `/planning/scan/email-invites?account_id=${accountId}`
    );
    return res.data.data;
  }

  static async importEmailInvite(accountId: number, folder: string, uid: number): Promise<CalendarEvent> {
    const res = await api.post<{ success: boolean; data: CalendarEvent | CalendarEvent[] }>(
      '/planning/import/email-invite',
      { account_id: accountId, folder, uid }
    );
    const d = res.data.data;
    return Array.isArray(d) ? d[0] : d;
  }

  // ── Stats ───────────────────────────────────────────────────────────

  static async getStats(): Promise<CalendarStats> {
    const res = await api.get<{ success: boolean; data: CalendarStats }>('/planning/stats');
    return res.data.data;
  }
}

export default PlanningModel;