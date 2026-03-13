/**
 * PlanningPage — Full meeting scheduling system with calendar, event
 * detail drawer, attendee management, invitation links, and calling.
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  CalendarDaysIcon,
  PlusIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  PhoneIcon,
  VideoCameraIcon,
  EnvelopeIcon,
  ClockIcon,
  MapPinIcon,
  ArrowPathIcon,
  XMarkIcon,
  PencilSquareIcon,
  TrashIcon,
  CheckCircleIcon,
  QuestionMarkCircleIcon,
  XCircleIcon,
  InboxArrowDownIcon,
  CalendarIcon,
  UserIcon,
  FunnelIcon,
  LinkIcon,
  ClipboardDocumentIcon,
  UserPlusIcon,
  UserGroupIcon,
  ChevronRightIcon,
  BellIcon,
  EllipsisVerticalIcon,
  MagnifyingGlassIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { notify } from '../../utils/notify';
import PlanningModel, {
  type CalendarEvent,
  type CreateEventInput,
  type CalendarStats,
  type EmailInvitation,
  type EventType,
  type EventStatus,
  type EventAttendee,
  type PlanningUser,
  type CallType,
  type Recurrence,
  type RsvpStatus,
} from '../../models/PlanningModel';
import { WebmailAccountModel, type MailboxAccount } from '../../models/WebmailModel';

// ─── Helpers ─────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}
function fmtDateLong(iso: string): string {
  return new Date(iso).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}
function isSameDay(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}
function getInitials(name: string): string {
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);
}
function evtColor(e: CalendarEvent): string {
  if (e.color) return e.color;
  if (e.source_type === 'scheduled_call') return '#3B82F6';
  if (e.source_type === 'email_invite') return '#8B5CF6';
  switch (e.event_type) {
    case 'meeting': return '#3B82F6';
    case 'call': return '#10B981';
    case 'reminder': return '#F59E0B';
    case 'task': return '#6366F1';
    default: return '#6B7280';
  }
}
function statusBadge(status: EventStatus) {
  switch (status) {
    case 'confirmed': return { text: 'Confirmed', cls: 'bg-green-100 text-green-700' };
    case 'tentative': return { text: 'Tentative', cls: 'bg-yellow-100 text-yellow-700' };
    case 'cancelled': return { text: 'Cancelled', cls: 'bg-red-100 text-red-700' };
    case 'declined': return { text: 'Declined', cls: 'bg-gray-100 text-gray-600' };
  }
}
function rsvpBadge(rsvp: RsvpStatus) {
  switch (rsvp) {
    case 'accepted': return { text: 'Accepted', cls: 'bg-green-100 text-green-700' };
    case 'tentative': return { text: 'Tentative', cls: 'bg-yellow-100 text-yellow-700' };
    case 'declined': return { text: 'Declined', cls: 'bg-red-100 text-red-600' };
    default: return { text: 'Pending', cls: 'bg-gray-100 text-gray-600' };
  }
}
function sourceIcon(e: CalendarEvent) {
  if (e.source_type === 'scheduled_call') return e.event_type === 'call' && e.call_type === 'voice'
    ? <PhoneIcon className="h-4 w-4 text-green-500" />
    : <VideoCameraIcon className="h-4 w-4 text-blue-500" />;
  if (e.source_type === 'email_invite') return <EnvelopeIcon className="h-4 w-4 text-purple-500" />;
  if (e.event_type === 'call') return <PhoneIcon className="h-4 w-4 text-green-500" />;
  if (e.event_type === 'meeting') return <UserGroupIcon className="h-4 w-4 text-blue-500" />;
  return <CalendarDaysIcon className="h-4 w-4 text-gray-500" />;
}
function evtTypeLabel(t: EventType) {
  const m: Record<EventType, string> = { meeting: 'Meeting', call: 'Call', reminder: 'Reminder', task: 'Task', email_invite: 'Email Invite', other: 'Other' };
  return m[t] || t;
}
function buildInviteUrl(token: string): string {
  return `${window.location.origin}/planning?invite=${token}`;
}

function getCalendarDays(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const days: Date[] = [];
  for (let i = first.getDay() - 1; i >= 0; i--) days.push(new Date(year, month, -i));
  for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, month, d));
  while (days.length < 42) days.push(new Date(year, month + 1, days.length - first.getDay() - last.getDate() + 1));
  return days;
}

// Duration in human-readable text
function durationText(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const PlanningPage: React.FC = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [stats, setStats] = useState<CalendarStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Calendar nav
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Panels
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [detailEvent, setDetailEvent] = useState<CalendarEvent | null>(null);
  const [showEmailPanel, setShowEmailPanel] = useState(false);

  // Email import
  const [mailAccounts, setMailAccounts] = useState<MailboxAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<number | null>(null);
  const [emailInvites, setEmailInvites] = useState<EmailInvitation[]>([]);
  const [scanningEmail, setScanningEmail] = useState(false);

  // Filter
  const [sourceFilter, setSourceFilter] = useState<string>('all');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = new Date();

  // ── Data loading ──────────────────────────────────────────────────────
  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month + 2, 0);
      const params: any = { start: start.toISOString(), end: end.toISOString() };
      if (sourceFilter !== 'all') params.source_type = sourceFilter;
      setEvents(await PlanningModel.getEvents(params));
    } catch (err) {
      console.error('Failed to load events:', err);
    } finally {
      setLoading(false);
    }
  }, [year, month, sourceFilter]);

  const loadStats = useCallback(async () => {
    try { setStats(await PlanningModel.getStats()); } catch {}
  }, []);

  useEffect(() => { loadEvents(); loadStats(); }, [loadEvents, loadStats]);

  // ── Handle invite link from URL ──────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inviteToken = params.get('invite');
    if (inviteToken) {
      (async () => {
        try {
          const { event } = await PlanningModel.resolveInvite(inviteToken);
          setDetailEvent(event);
          // Clean up URL
          window.history.replaceState({}, '', window.location.pathname);
        } catch {
          notify.error('Invalid or expired invitation link');
        }
      })();
    }
  }, []);

  // ── Calendar computed ─────────────────────────────────────────────────
  const calendarDays = useMemo(() => getCalendarDays(year, month), [year, month]);

  const eventsForDay = useCallback((date: Date) => {
    return events.filter(e => {
      const s = new Date(e.start_at), en = new Date(e.end_at);
      return isSameDay(s, date) || isSameDay(en, date) || (s <= date && en >= date);
    });
  }, [events]);

  const selectedDayEvents = useMemo(
    () => eventsForDay(selectedDate).sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()),
    [selectedDate, eventsForDay]
  );

  const upcomingEvents = useMemo(() => {
    const now = new Date();
    const next7 = new Date(now.getTime() + 7 * 86400000);
    return events
      .filter(e => new Date(e.start_at) >= now && new Date(e.start_at) <= next7 && e.status !== 'cancelled')
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
      .slice(0, 8);
  }, [events]);

  // ── Navigation ────────────────────────────────────────────────────────
  const goToPrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const goToNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => { setCurrentDate(new Date()); setSelectedDate(new Date()); };

  // ── Actions ───────────────────────────────────────────────────────────
  const handleSyncCalls = async () => {
    setSyncing(true);
    try {
      const r = await PlanningModel.syncScheduledCalls();
      notify.success(`Synced ${r.imported} new call(s) from ${r.total} total`);
      loadEvents(); loadStats();
    } catch { notify.error('Failed to sync scheduled calls'); }
    finally { setSyncing(false); }
  };

  const handleDeleteEvent = async (id: number) => {
    if (!window.confirm('Delete this event? This cannot be undone.')) return;
    try {
      await PlanningModel.deleteEvent(id);
      notify.success('Event deleted');
      setDetailEvent(null);
      loadEvents(); loadStats();
    } catch { notify.error('Failed to delete event'); }
  };

  const handleRsvp = async (id: number, status: 'accepted' | 'tentative' | 'declined') => {
    try {
      const updated = await PlanningModel.respondToEvent(id, status);
      notify.success(`Responded: ${status}`);
      setDetailEvent(updated);
      loadEvents();
    } catch { notify.error('Failed to update RSVP'); }
  };

  const handleStartCall = async (event: CalendarEvent) => {
    try {
      const result = await PlanningModel.startCall(event.id);
      notify.success('Starting call...');
      // Navigate to chat page with call params — ChatPage will auto-join WebRTC
      window.location.href = `/chat?c=${result.conversation_id}&joinCallId=${result.call_id}&callType=${result.call_type}`;
    } catch (err: any) {
      notify.error(err?.response?.data?.error || 'Failed to start call');
    }
  };

  const openCreateModal = (date?: Date) => {
    setEditingEvent(null);
    if (date) setSelectedDate(date);
    setShowModal(true);
  };

  const openEditModal = (event: CalendarEvent) => {
    setEditingEvent(event);
    setDetailEvent(null);
    setShowModal(true);
  };

  const openDetail = async (event: CalendarEvent) => {
    try {
      const full = await PlanningModel.getEvent(event.id);
      setDetailEvent(full);
    } catch {
      setDetailEvent(event);
    }
  };

  // ── Email scan ────────────────────────────────────────────────────────
  const loadMailAccounts = async () => {
    try {
      const accts = await WebmailAccountModel.list();
      setMailAccounts(accts);
      if (accts.length) setSelectedAccount(accts[0].id);
    } catch {}
  };

  const handleScanEmails = async () => {
    if (!selectedAccount) return;
    setScanningEmail(true);
    try {
      const invites = await PlanningModel.scanEmailInvites(selectedAccount);
      setEmailInvites(invites);
      if (!invites.length) notify.info('📭 No calendar invitations found');
    } catch { notify.error('Failed to scan emails'); }
    finally { setScanningEmail(false); }
  };

  const handleImportInvite = async (uid: number) => {
    if (!selectedAccount) return;
    try {
      await PlanningModel.importEmailInvite(selectedAccount, 'INBOX', uid);
      notify.success('Invitation imported');
      loadEvents(); loadStats();
      setEmailInvites(prev => prev.map(inv => inv.uid === uid ? { ...inv, already_imported: true } : inv));
    } catch { notify.error('Failed to import invitation'); }
  };

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <div className="max-w-[1600px] mx-auto">
      {/* ── HEADER ────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarDaysIcon className="h-7 w-7 text-picton-blue-600" />
            Planning
          </h1>
          <p className="text-sm text-gray-500 mt-1">Meetings, calls, schedule &amp; invitations</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {stats && (
            <div className="flex items-center gap-2 mr-2">
              <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">{stats.today} today</span>
              <span className="px-2.5 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium">{stats.this_week} this week</span>
              {stats.pending_invites > 0 && (
                <span className="px-2.5 py-1 bg-purple-50 text-purple-700 rounded-full text-xs font-medium animate-pulse">{stats.pending_invites} pending</span>
              )}
            </div>
          )}
          <button onClick={handleSyncCalls} disabled={syncing}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50">
            <ArrowPathIcon className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} /> Sync Calls
          </button>
          <button onClick={() => { setShowEmailPanel(!showEmailPanel); if (!mailAccounts.length) loadMailAccounts(); }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-purple-300 text-purple-700 bg-purple-50 hover:bg-purple-100">
            <InboxArrowDownIcon className="h-4 w-4" /> Email Invites
          </button>
          <button onClick={() => openCreateModal()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-sm">
            <PlusIcon className="h-4 w-4" /> New Meeting
          </button>
        </div>
      </div>

      {/* ── EMAIL IMPORT PANEL ────────────────────────────────────────── */}
      {showEmailPanel && (
        <div className="mb-6 bg-purple-50 border border-purple-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-purple-800 flex items-center gap-2">
              <EnvelopeIcon className="h-4 w-4" /> Import Calendar Invitations from Email
            </h3>
            <button onClick={() => setShowEmailPanel(false)} className="text-purple-400 hover:text-purple-600"><XMarkIcon className="h-5 w-5" /></button>
          </div>
          <div className="flex items-center gap-3 mb-3">
            <select value={selectedAccount || ''} onChange={e => setSelectedAccount(Number(e.target.value))}
              className="px-3 py-2 text-sm border border-purple-300 rounded-lg bg-white focus:ring-2 focus:ring-purple-500">
              {mailAccounts.map(a => <option key={a.id} value={a.id}>{a.display_name} ({a.email_address})</option>)}
              {!mailAccounts.length && <option value="">No email accounts</option>}
            </select>
            <button onClick={handleScanEmails} disabled={scanningEmail || !selectedAccount}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50">
              <ArrowPathIcon className={`h-4 w-4 ${scanningEmail ? 'animate-spin' : ''}`} /> Scan Inbox
            </button>
          </div>
          {emailInvites.length > 0 && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {emailInvites.map(inv => (
                <div key={inv.uid} className="flex items-center justify-between bg-white rounded-lg p-3 border border-purple-100">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{inv.subject}</p>
                    <p className="text-xs text-gray-500">From: {inv.from.name || inv.from.address} · {fmtDate(inv.date)}</p>
                  </div>
                  {inv.already_imported ? (
                    <span className="flex items-center gap-1 text-xs text-green-600 font-medium px-2"><CheckCircleIcon className="h-4 w-4" /> Imported</span>
                  ) : (
                    <button onClick={() => handleImportInvite(inv.uid)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-600 text-white hover:bg-purple-700">
                      <PlusIcon className="h-3.5 w-3.5" /> Import
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {emailInvites.length === 0 && !scanningEmail && <p className="text-xs text-purple-600">Click "Scan Inbox" to find calendar invitations.</p>}
          {scanningEmail && <p className="text-xs text-purple-600 animate-pulse">Scanning inbox for calendar invitations...</p>}
        </div>
      )}

      {/* ── FILTER BAR ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-4">
        <FunnelIcon className="h-4 w-4 text-gray-400" />
        <span className="text-xs text-gray-500 font-medium">Source:</span>
        {['all','manual','scheduled_call','email_invite'].map(f => (
          <button key={f} onClick={() => setSourceFilter(f)}
            className={`px-2.5 py-1 text-xs rounded-full font-medium transition-colors ${
              sourceFilter === f ? 'bg-picton-blue-100 text-picton-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            {f === 'all' ? 'All' : f === 'scheduled_call' ? 'Calls' : f === 'email_invite' ? 'Email' : 'Manual'}
          </button>
        ))}
      </div>

      {/* ── MAIN LAYOUT ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">
        {/* LEFT — Calendar + Day Events */}
        <div className="space-y-4">
          {/* Calendar Card */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <button onClick={goToPrevMonth} className="p-1.5 rounded-lg hover:bg-gray-100"><ArrowLeftIcon className="h-4 w-4 text-gray-600" /></button>
                <h2 className="text-lg font-semibold text-gray-900">{MONTH_NAMES[month]} {year}</h2>
                <button onClick={goToNextMonth} className="p-1.5 rounded-lg hover:bg-gray-100"><ArrowRightIcon className="h-4 w-4 text-gray-600" /></button>
              </div>
              <button onClick={goToToday} className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">Today</button>
            </div>
            <div className="grid grid-cols-7 border-b border-gray-100">
              {DAY_NAMES.map(d => <div key={d} className="px-2 py-2 text-center text-xs font-semibold text-gray-500 uppercase">{d}</div>)}
            </div>
            <div className="grid grid-cols-7">
              {calendarDays.map((date, idx) => {
                const dayEvts = eventsForDay(date);
                const isCurMonth = date.getMonth() === month;
                const isToday_ = isSameDay(date, today);
                const isSel = isSameDay(date, selectedDate);
                return (
                  <button key={idx} onClick={() => setSelectedDate(date)}
                    className={`relative min-h-[80px] p-1.5 border-b border-r border-gray-100 text-left transition-colors hover:bg-blue-50
                      ${!isCurMonth ? 'bg-gray-50' : 'bg-white'}
                      ${isSel ? 'ring-2 ring-inset ring-picton-blue-400 bg-blue-50' : ''}`}>
                    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium
                      ${isToday_ ? 'bg-blue-600 text-white' : isCurMonth ? 'text-gray-900' : 'text-gray-400'}`}>
                      {date.getDate()}
                    </span>
                    <div className="mt-0.5 space-y-0.5">
                      {dayEvts.slice(0, 3).map(evt => (
                        <div key={evt.id} className="truncate rounded px-1 py-0.5 text-[10px] font-medium leading-tight text-white cursor-pointer"
                          style={{ backgroundColor: evtColor(evt) }}
                          title={evt.title}
                          onClick={e => { e.stopPropagation(); openDetail(evt); }}>
                          {evt.title}
                        </div>
                      ))}
                      {dayEvts.length > 3 && <span className="text-[10px] text-gray-500 pl-1">+{dayEvts.length - 3} more</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Day Events */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-picton-blue-600" />
                {fmtDateLong(selectedDate.toISOString())}
                <span className="text-xs font-normal text-gray-500">({selectedDayEvents.length} events)</span>
              </h3>
              <button onClick={() => openCreateModal(selectedDate)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-picton-blue-100 text-picton-blue-700 hover:bg-picton-blue-200">
                <PlusIcon className="h-3.5 w-3.5" /> Add
              </button>
            </div>

            {selectedDayEvents.length === 0 && (
              <p className="text-sm text-gray-400 py-6 text-center">No events for this day</p>
            )}

            <div className="space-y-2">
              {selectedDayEvents.map(evt => {
                const badge = statusBadge(evt.status);
                return (
                  <button key={evt.id} onClick={() => openDetail(evt)}
                    className="w-full text-left flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:border-picton-blue-200 hover:bg-blue-50/50 transition-colors group">
                    <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: evtColor(evt) }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {sourceIcon(evt)}
                        <span className="text-sm font-medium text-gray-900 truncate">{evt.title}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${badge.cls}`}>{badge.text}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <ClockIcon className="h-3.5 w-3.5" />
                          {evt.all_day ? 'All day' : `${fmtTime(evt.start_at)} – ${fmtTime(evt.end_at)}`}
                          {!evt.all_day && <span className="text-gray-400">({durationText(evt.start_at, evt.end_at)})</span>}
                        </span>
                        {evt.location && <span className="flex items-center gap-1 truncate"><MapPinIcon className="h-3.5 w-3.5" />{evt.location}</span>}
                        {(evt.attendee_count ?? 0) > 0 && (
                          <span className="flex items-center gap-1"><UserGroupIcon className="h-3.5 w-3.5" />{evt.accepted_attendees}/{evt.attendee_count}</span>
                        )}
                      </div>
                      {evt.organizer_name && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                          <UserIcon className="h-3 w-3" /> {evt.organizer_name}
                        </div>
                      )}
                    </div>
                    <ChevronRightIcon className="h-4 w-4 text-gray-300 self-center opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT — Sidebar */}
        <div className="space-y-4">
          {/* Upcoming */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <ClockIcon className="h-4 w-4 text-picton-blue-600" /> Upcoming (7 days)
            </h3>
            {upcomingEvents.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">No upcoming events</p>}
            <div className="space-y-2">
              {upcomingEvents.map(evt => (
                <button key={evt.id} onClick={() => { openDetail(evt); setSelectedDate(new Date(evt.start_at)); }}
                  className="w-full text-left flex items-start gap-2.5 p-2.5 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: evtColor(evt) }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{evt.title}</p>
                    <p className="text-xs text-gray-500">{fmtDate(evt.start_at)}{!evt.all_day && ` · ${fmtTime(evt.start_at)}`}</p>
                    {(evt.attendee_count ?? 0) > 0 && (
                      <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                        <UserGroupIcon className="h-3 w-3" /> {evt.accepted_attendees}/{evt.attendee_count} attendees
                      </p>
                    )}
                  </div>
                  {(evt.event_type === 'meeting' || evt.event_type === 'call') && (
                    <span className="flex-shrink-0 mt-1">
                      {evt.call_type === 'voice' ? <PhoneIcon className="h-4 w-4 text-green-400" /> : <VideoCameraIcon className="h-4 w-4 text-blue-400" />}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-gradient-to-br from-picton-blue-50 to-blue-50 rounded-xl border border-picton-blue-200 p-4">
            <h3 className="text-sm font-semibold text-picton-blue-800 mb-2">Quick Actions</h3>
            <div className="space-y-2">
              <button onClick={() => openCreateModal()}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-white text-picton-blue-700 hover:bg-picton-blue-50 border border-picton-blue-200">
                <PlusIcon className="h-4 w-4" /> Schedule Meeting
              </button>
              <button onClick={() => { setEditingEvent(null); setShowModal(true); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-white text-green-700 hover:bg-green-50 border border-green-200">
                <PhoneIcon className="h-4 w-4" /> Schedule Call
              </button>
              <button onClick={handleSyncCalls} disabled={syncing}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-white text-indigo-700 hover:bg-indigo-50 border border-indigo-200 disabled:opacity-50">
                <ArrowPathIcon className="h-4 w-4" /> Sync from Staff Chat
              </button>
              <button onClick={() => { setShowEmailPanel(true); if (!mailAccounts.length) loadMailAccounts(); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-white text-purple-700 hover:bg-purple-50 border border-purple-200">
                <EnvelopeIcon className="h-4 w-4" /> Import Email Invites
              </button>
            </div>
          </div>

          {/* Legend */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Legend</h3>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { color: '#3B82F6', label: 'Meeting / Video' },
                { color: '#10B981', label: 'Voice Call' },
                { color: '#8B5CF6', label: 'Email Invite' },
                { color: '#F59E0B', label: 'Reminder' },
                { color: '#6366F1', label: 'Task' },
                { color: '#6B7280', label: 'Other' },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
                  <span className="text-xs text-gray-600">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── EVENT DETAIL DRAWER ───────────────────────────────────────── */}
      {detailEvent && (
        <EventDetailDrawer
          event={detailEvent}
          onClose={() => setDetailEvent(null)}
          onEdit={() => openEditModal(detailEvent)}
          onDelete={() => handleDeleteEvent(detailEvent.id)}
          onRsvp={(s) => handleRsvp(detailEvent.id, s)}
          onStartCall={() => handleStartCall(detailEvent)}
          onRefresh={async () => {
            try {
              const full = await PlanningModel.getEvent(detailEvent.id);
              setDetailEvent(full);
            } catch {}
          }}
          onReload={() => { loadEvents(); loadStats(); }}
        />
      )}

      {/* ── CREATE / EDIT MODAL ───────────────────────────────────────── */}
      {showModal && (
        <EventFormModal
          event={editingEvent}
          defaultDate={selectedDate}
          onClose={() => { setShowModal(false); setEditingEvent(null); }}
          onSaved={() => { setShowModal(false); setEditingEvent(null); loadEvents(); loadStats(); }}
        />
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// EVENT DETAIL DRAWER — Full-featured event view with attendees, links, etc.
// ═══════════════════════════════════════════════════════════════════════════

interface EventDetailDrawerProps {
  event: CalendarEvent;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRsvp: (status: 'accepted' | 'tentative' | 'declined') => void;
  onStartCall: () => void;
  onRefresh: () => void;
  onReload: () => void;
}

const EventDetailDrawer: React.FC<EventDetailDrawerProps> = ({
  event, onClose, onEdit, onDelete, onRsvp, onStartCall, onRefresh, onReload,
}) => {
  const [showAddAttendee, setShowAddAttendee] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [searchResults, setSearchResults] = useState<PlanningUser[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef<number | null>(null);

  const inviteUrl = event.invitation_token ? buildInviteUrl(event.invitation_token) : null;
  const badge = statusBadge(event.status);
  const attendees = event.attendees || [];
  const isOwner = true; // The backend enforces ownership checks

  const copyInviteLink = () => {
    if (!inviteUrl) return;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(inviteUrl).then(() => notify.success('Invitation link copied!'));
    } else {
      const ta = document.createElement('textarea');
      ta.value = inviteUrl;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      notify.success('Invitation link copied!');
    }
  };

  const handleUserSearch = (q: string) => {
    setUserSearch(q);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!q.trim()) { setSearchResults([]); return; }
    searchTimeout.current = window.setTimeout(async () => {
      setSearching(true);
      try {
        const results = await PlanningModel.searchUsers(q);
        // Filter out existing attendees
        const existingIds = new Set(attendees.map(a => a.user_id));
        setSearchResults(results.filter(u => !existingIds.has(u.id)));
      } catch {} finally { setSearching(false); }
    }, 300);
  };

  const handleAddAttendee = async (userId: string) => {
    try {
      await PlanningModel.addAttendees(event.id, [userId]);
      notify.success('Attendee added');
      setUserSearch('');
      setSearchResults([]);
      onRefresh();
    } catch { notify.error('Failed to add attendee'); }
  };

  const handleRemoveAttendee = async (userId: string) => {
    try {
      await PlanningModel.removeAttendee(event.id, userId);
      notify.success('Attendee removed');
      onRefresh();
    } catch { notify.error('Failed to remove attendee'); }
  };

  const isMeetingOrCall = event.event_type === 'meeting' || event.event_type === 'call';
  const canStartCall = isMeetingOrCall && event.status !== 'cancelled';

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
      <div className="relative w-full max-w-xl bg-white shadow-2xl overflow-y-auto animate-[slideInRight_0.2s_ease-out]"
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-start justify-between z-10">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {sourceIcon(event)}
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${badge.cls}`}>{badge.text}</span>
              <span className="text-[10px] text-gray-400 uppercase">{evtTypeLabel(event.event_type)}</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900 truncate">{event.title}</h2>
          </div>
          <div className="flex items-center gap-1 ml-4">
            <button onClick={onEdit} className="p-2 rounded-lg hover:bg-gray-100" title="Edit">
              <PencilSquareIcon className="h-5 w-5 text-gray-500" />
            </button>
            <button onClick={onDelete} className="p-2 rounded-lg hover:bg-red-50" title="Delete">
              <TrashIcon className="h-5 w-5 text-red-400 hover:text-red-600" />
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100">
              <XMarkIcon className="h-5 w-5 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="px-6 py-4 space-y-5">
          {/* Date & Time */}
          <div className="flex items-start gap-3">
            <ClockIcon className="h-5 w-5 text-gray-400 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-900">
                {event.all_day
                  ? fmtDateLong(event.start_at) + ' (All day)'
                  : `${fmtDateLong(event.start_at)}`}
              </p>
              {!event.all_day && (
                <p className="text-sm text-gray-600">
                  {fmtTime(event.start_at)} – {fmtTime(event.end_at)}
                  <span className="text-gray-400 ml-1">({durationText(event.start_at, event.end_at)})</span>
                </p>
              )}
              {event.recurrence !== 'none' && (
                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                  <ArrowPathIcon className="h-3.5 w-3.5" /> Repeats {event.recurrence}
                  {event.recurrence_end && ` until ${fmtDate(event.recurrence_end)}`}
                </p>
              )}
            </div>
          </div>

          {/* Location */}
          {event.location && (
            <div className="flex items-start gap-3">
              <MapPinIcon className="h-5 w-5 text-gray-400 mt-0.5" />
              <p className="text-sm text-gray-700">{event.location}</p>
            </div>
          )}

          {/* Call Type for meetings/calls */}
          {isMeetingOrCall && (
            <div className="flex items-start gap-3">
              {event.call_type === 'voice' ? <PhoneIcon className="h-5 w-5 text-green-500 mt-0.5" /> : <VideoCameraIcon className="h-5 w-5 text-blue-500 mt-0.5" />}
              <div>
                <p className="text-sm font-medium text-gray-700">{event.call_type === 'voice' ? 'Voice Call' : 'Video Call'}</p>
                {event.meeting_link && (
                  <div className="mt-1">
                    <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">External link</span>
                    <a href={event.meeting_link} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline truncate block">{event.meeting_link}</a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Invitation Link */}
          {inviteUrl && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-blue-800 flex items-center gap-1">
                  <LinkIcon className="h-3.5 w-3.5" /> Invitation Link
                </span>
                <button onClick={copyInviteLink}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded bg-blue-600 text-white hover:bg-blue-700">
                  <ClipboardDocumentIcon className="h-3 w-3" /> Copy Link
                </button>
              </div>
              <p className="text-[11px] text-blue-600 break-all select-all font-mono">{inviteUrl}</p>
              <p className="text-[10px] text-blue-500 mt-1">Share this link to invite others to this event</p>
            </div>
          )}

          {/* Start Call Button */}
          {canStartCall && (
            <button onClick={onStartCall}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 shadow-sm">
              {event.call_type === 'voice' ? <PhoneIcon className="h-5 w-5" /> : <VideoCameraIcon className="h-5 w-5" />}
              Start {event.call_type === 'voice' ? 'Voice' : 'Video'} Call
            </button>
          )}

          {/* RSVP Buttons */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Your Response</p>
            <div className="flex items-center gap-2">
              <button onClick={() => onRsvp('accepted')}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-green-100 text-green-700 hover:bg-green-200 border border-green-200">
                <CheckCircleIcon className="h-4 w-4" /> Accept
              </button>
              <button onClick={() => onRsvp('tentative')}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-yellow-100 text-yellow-700 hover:bg-yellow-200 border border-yellow-200">
                <QuestionMarkCircleIcon className="h-4 w-4" /> Maybe
              </button>
              <button onClick={() => onRsvp('declined')}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-red-100 text-red-700 hover:bg-red-200 border border-red-200">
                <XCircleIcon className="h-4 w-4" /> Decline
              </button>
            </div>
          </div>

          {/* Attendees */}
          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                <UserGroupIcon className="h-3.5 w-3.5" /> Attendees ({attendees.length})
              </p>
              <button onClick={() => setShowAddAttendee(!showAddAttendee)}
                className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-lg bg-picton-blue-100 text-picton-blue-700 hover:bg-picton-blue-200">
                <UserPlusIcon className="h-3 w-3" /> Add
              </button>
            </div>

            {/* Add attendee search */}
            {showAddAttendee && (
              <div className="mb-3 relative">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input type="text" value={userSearch} onChange={e => handleUserSearch(e.target.value)}
                    placeholder="Search by name or email..."
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-picton-blue-500 focus:border-picton-blue-500" />
                </div>
                {searchResults.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {searchResults.map(u => (
                      <button key={u.id} onClick={() => handleAddAttendee(u.id)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-blue-50 text-sm">
                        <div className="h-7 w-7 rounded-full bg-picton-blue-100 text-picton-blue-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                          {u.avatar_url ? <img src={u.avatar_url} className="h-7 w-7 rounded-full object-cover" alt="" /> : getInitials(u.name || u.email)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">{u.name}</p>
                          <p className="text-xs text-gray-500 truncate">{u.email}</p>
                        </div>
                        <PlusIcon className="h-4 w-4 text-picton-blue-500 ml-auto flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
                {searching && <p className="text-xs text-gray-400 mt-1 animate-pulse">Searching...</p>}
              </div>
            )}

            {/* Attendee list */}
            {attendees.length === 0 && <p className="text-sm text-gray-400 text-center py-2">No attendees yet</p>}
            <div className="space-y-1.5">
              {attendees.map(a => {
                const rb = rsvpBadge(a.rsvp);
                return (
                  <div key={a.user_id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-gray-50 group">
                    <div className="h-8 w-8 rounded-full bg-picton-blue-100 text-picton-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {a.avatar_url ? <img src={a.avatar_url} className="h-8 w-8 rounded-full object-cover" alt="" /> : getInitials(a.name || a.email)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-gray-900 truncate">{a.name}</span>
                        {a.is_organizer ? (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-100 text-blue-700">ORGANIZER</span>
                        ) : null}
                      </div>
                      <p className="text-xs text-gray-500 truncate">{a.email}</p>
                    </div>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${rb.cls}`}>{rb.text}</span>
                    {!a.is_organizer && (
                      <button onClick={() => handleRemoveAttendee(a.user_id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 transition-opacity" title="Remove">
                        <XMarkIcon className="h-3.5 w-3.5 text-red-400" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Description */}
          {event.description && (
            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                <DocumentTextIcon className="h-3.5 w-3.5" /> Description
              </p>
              <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700 whitespace-pre-wrap">{event.description}</div>
            </div>
          )}

          {/* Notes */}
          {event.notes && (
            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Notes</p>
              <div className="p-3 bg-yellow-50 border border-yellow-100 rounded-lg text-sm text-gray-700 whitespace-pre-wrap">{event.notes}</div>
            </div>
          )}

          {/* Organizer info (for email invites) */}
          {event.organizer_name && event.source_type !== 'manual' && (
            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Organizer</p>
              <div className="flex items-center gap-2">
                <UserIcon className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-700">{event.organizer_name}</span>
                {event.organizer_email && <span className="text-xs text-gray-400">&lt;{event.organizer_email}&gt;</span>}
              </div>
            </div>
          )}

          {/* Meta */}
          <div className="border-t border-gray-100 pt-4 text-[11px] text-gray-400 space-y-1">
            <p>Created: {new Date(event.created_at).toLocaleString()}</p>
            {event.reminder_minutes != null && event.reminder_minutes > 0 && (
              <p className="flex items-center gap-1"><BellIcon className="h-3 w-3" /> Reminder: {event.reminder_minutes} min before</p>
            )}
            <p>Source: {event.source_type.replace('_', ' ')} · ID: {event.id}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// EVENT FORM MODAL — Create / Edit with attendees
// ═══════════════════════════════════════════════════════════════════════════

interface EventFormModalProps {
  event: CalendarEvent | null;
  defaultDate: Date;
  onClose: () => void;
  onSaved: () => void;
}

const EventFormModal: React.FC<EventFormModalProps> = ({ event, defaultDate, onClose, onSaved }) => {
  const isEdit = !!event;
  const defStart = new Date(defaultDate);
  defStart.setHours(new Date().getHours() + 1, 0, 0, 0);
  const defEnd = new Date(defStart.getTime() + 3600000);

  const [title, setTitle] = useState(event?.title || '');
  const [description, setDescription] = useState(event?.description || '');
  const [location, setLocation] = useState(event?.location || '');
  const [eventType, setEventType] = useState<EventType>(event?.event_type || 'meeting');
  const [startDate, setStartDate] = useState(event ? new Date(event.start_at).toISOString().slice(0, 10) : defStart.toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState(event ? new Date(event.start_at).toTimeString().slice(0, 5) : defStart.toTimeString().slice(0, 5));
  const [endDate, setEndDate] = useState(event ? new Date(event.end_at).toISOString().slice(0, 10) : defEnd.toISOString().slice(0, 10));
  const [endTime, setEndTime] = useState(event ? new Date(event.end_at).toTimeString().slice(0, 5) : defEnd.toTimeString().slice(0, 5));
  const [allDay, setAllDay] = useState(event?.all_day || false);
  const [recurrence, setRecurrence] = useState<Recurrence>(event?.recurrence || 'none');
  const [color, setColor] = useState(event?.color || '#3B82F6');
  const [callType, setCallType] = useState<CallType>(event?.call_type || 'video');
  const [notes, setNotes] = useState(event?.notes || '');
  const [meetingLink, setMeetingLink] = useState(event?.meeting_link || '');
  const [reminderMinutes, setReminderMinutes] = useState(event?.reminder_minutes ?? 15);
  const [saving, setSaving] = useState(false);

  // Attendee picker
  const [selectedAttendees, setSelectedAttendees] = useState<PlanningUser[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [searchResults, setSearchResults] = useState<PlanningUser[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef<number | null>(null);

  // Load existing attendees for edit mode
  useEffect(() => {
    if (isEdit && event?.attendees) {
      setSelectedAttendees(event.attendees.filter(a => !a.is_organizer).map(a => ({
        id: a.user_id, name: a.name, email: a.email, avatar_url: a.avatar_url,
      })));
    }
  }, [isEdit, event]);

  const handleUserSearch = (q: string) => {
    setUserSearch(q);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!q.trim()) { setSearchResults([]); return; }
    searchTimeout.current = window.setTimeout(async () => {
      setSearching(true);
      try {
        const results = await PlanningModel.searchUsers(q);
        const existingIds = new Set(selectedAttendees.map(a => a.id));
        setSearchResults(results.filter(u => !existingIds.has(u.id)));
      } catch {} finally { setSearching(false); }
    }, 300);
  };

  const addAttendee = (user: PlanningUser) => {
    setSelectedAttendees(prev => [...prev, user]);
    setUserSearch('');
    setSearchResults([]);
  };

  const removeAttendee = (id: string) => {
    setSelectedAttendees(prev => prev.filter(u => u.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { notify.error('Title is required'); return; }
    setSaving(true);
    try {
      const start_at = new Date(`${startDate}T${startTime}:00`).toISOString();
      const end_at = new Date(`${endDate}T${endTime}:00`).toISOString();

      if (isEdit) {
        await PlanningModel.updateEvent(event!.id, {
          title, description: description || null, location: location || null,
          event_type: eventType, start_at, end_at, all_day: allDay,
          recurrence, color, call_type: callType,
          notes: notes || null, meeting_link: meetingLink || null,
          reminder_minutes: reminderMinutes,
          attendee_ids: selectedAttendees.map(a => a.id),
        });
        notify.success('Event updated');
      } else {
        await PlanningModel.createEvent({
          title, description: description || undefined, location: location || undefined,
          event_type: eventType, start_at, end_at, all_day: allDay,
          recurrence, color, call_type: callType,
          notes: notes || undefined, meeting_link: meetingLink || undefined,
          reminder_minutes: reminderMinutes,
          attendee_ids: selectedAttendees.map(a => a.id),
        });
        notify.success('Event created');
      }
      onSaved();
    } catch {
      notify.error(isEdit ? 'Failed to update event' : 'Failed to create event');
    } finally { setSaving(false); }
  };

  const colorOptions = ['#3B82F6','#10B981','#8B5CF6','#F59E0B','#EF4444','#6366F1','#EC4899','#14B8A6'];
  const showCallOptions = eventType === 'meeting' || eventType === 'call';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <h3 className="text-lg font-semibold text-gray-900">{isEdit ? 'Edit Event' : 'New Meeting / Event'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><XMarkIcon className="h-5 w-5 text-gray-400" /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-picton-blue-500 focus:border-picton-blue-500"
              placeholder="Team standup, Client meeting, etc." />
          </div>

          {/* Type + Call Type + Color */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select value={eventType} onChange={e => setEventType(e.target.value as EventType)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-picton-blue-500">
                <option value="meeting">Meeting</option>
                <option value="call">Call</option>
                <option value="reminder">Reminder</option>
                <option value="task">Task</option>
                <option value="other">Other</option>
              </select>
            </div>
            {showCallOptions && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Call Type</label>
                <select value={callType} onChange={e => setCallType(e.target.value as CallType)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-picton-blue-500">
                  <option value="video">📹 Video</option>
                  <option value="voice">📞 Voice</option>
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
              <div className="flex items-center gap-1.5 mt-1">
                {colorOptions.map(c => (
                  <button key={c} type="button" onClick={() => setColor(c)}
                    className={`w-6 h-6 rounded-full border-2 transition-transform ${color === c ? 'border-gray-900 scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
          </div>

          {/* All day */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)}
              className="rounded border-gray-300 text-picton-blue-600 focus:ring-picton-blue-500" />
            <span className="text-sm text-gray-700">All day event</span>
          </label>

          {/* Start / End */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start</label>
              <div className="flex gap-2">
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-picton-blue-500" />
                {!allDay && <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required
                  className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-picton-blue-500" />}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End</label>
              <div className="flex gap-2">
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-picton-blue-500" />
                {!allDay && <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} required
                  className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-picton-blue-500" />}
              </div>
            </div>
          </div>

          {/* Location + Meeting Link */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <input type="text" value={location} onChange={e => setLocation(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-picton-blue-500"
                placeholder="Office, Room 3, etc." />
            </div>
            {showCallOptions && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">External Meeting Link <span className="font-normal text-gray-400">(optional)</span></label>
                <input type="url" value={meetingLink} onChange={e => setMeetingLink(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-picton-blue-500"
                  placeholder="https://zoom.us/j/... or teams link" />
                <p className="text-[11px] text-gray-400 mt-1">Only needed if using Zoom, Teams, Meet, etc. Internal calls work without this.</p>
              </div>
            )}
          </div>

          {/* Attendees */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
              <UserGroupIcon className="h-4 w-4" /> Attendees
            </label>
            {/* Search */}
            <div className="relative mb-2">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input type="text" value={userSearch} onChange={e => handleUserSearch(e.target.value)}
                placeholder="Search users to add..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-picton-blue-500" />
              {searchResults.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                  {searchResults.map(u => (
                    <button key={u.id} type="button" onClick={() => addAttendee(u)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-blue-50 text-sm">
                      <div className="h-6 w-6 rounded-full bg-picton-blue-100 text-picton-blue-700 flex items-center justify-center text-[9px] font-bold flex-shrink-0">
                        {getInitials(u.name || u.email)}
                      </div>
                      <span className="text-gray-900 truncate">{u.name}</span>
                      <span className="text-xs text-gray-400 truncate">{u.email}</span>
                      <PlusIcon className="h-3.5 w-3.5 text-picton-blue-500 ml-auto" />
                    </button>
                  ))}
                </div>
              )}
              {searching && <p className="text-xs text-gray-400 mt-1 animate-pulse">Searching...</p>}
            </div>
            {/* Selected attendees */}
            {selectedAttendees.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedAttendees.map(u => (
                  <span key={u.id} className="inline-flex items-center gap-1 px-2.5 py-1 bg-picton-blue-50 text-picton-blue-700 rounded-full text-xs font-medium">
                    {u.name || u.email}
                    <button type="button" onClick={() => removeAttendee(u.id)} className="hover:text-red-500">
                      <XMarkIcon className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {selectedAttendees.length === 0 && (
              <p className="text-xs text-gray-400">No attendees added — they will receive invitations automatically</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-picton-blue-500 resize-none"
              placeholder="Agenda, purpose of meeting..." />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-picton-blue-500 resize-none"
              placeholder="Internal notes..." />
          </div>

          {/* Recurrence + Reminder */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Recurrence</label>
              <select value={recurrence} onChange={e => setRecurrence(e.target.value as Recurrence)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-picton-blue-500">
                <option value="none">No repeat</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Biweekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reminder</label>
              <select value={reminderMinutes} onChange={e => setReminderMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-picton-blue-500">
                <option value={0}>None</option>
                <option value={5}>5 minutes before</option>
                <option value={10}>10 minutes before</option>
                <option value={15}>15 minutes before</option>
                <option value={30}>30 minutes before</option>
                <option value={60}>1 hour before</option>
                <option value={1440}>1 day before</option>
              </select>
            </div>
          </div>

          {/* Form footer */}
          <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="px-6 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-sm disabled:opacity-50">
              {saving ? 'Saving...' : isEdit ? 'Update Event' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PlanningPage;