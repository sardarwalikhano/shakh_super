import './support-module.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Plus,
  CheckCircle2,
  Clock3,
  Headphones,
  MessageCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  Ticket,
  UserRound,
  XCircle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed' | string;

type SupportTicket = {
  id: string;
  user_id: string;
  subject: string;
  message: string;
  status: TicketStatus | null;
  created_at: string | null;
  updated_at: string | null;
};

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  open: 'کراوە',
  in_progress: 'لە کاردایە',
  resolved: 'چارەسەرکراو',
  closed: 'داخراو',
};

const STATUS_CLASS: Record<string, string> = {
  open: 'is-open',
  in_progress: 'is-progress',
  resolved: 'is-resolved',
  closed: 'is-closed',
};

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ku-IQ', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function SupportModule({ role = 'support' }: { role?: string }) {
  const canManage = role === 'support' || role === 'admin' || role === 'super_admin';
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved' | 'closed'>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const loadTickets = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError('');

    const { data: authData } = await supabase.auth.getUser();
    const currentUserId = authData.user?.id;
    if (!currentUserId) {
      setError('هەژمارەکەت نەدۆزرایەوە. تکایە دووبارە بچۆ ژوورەوە.');
      setTickets([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    let ticketQuery = supabase
      .from('support_tickets')
      .select('id,user_id,subject,message,status,created_at,updated_at')
      .order('updated_at', { ascending: false });

    if (!canManage) ticketQuery = ticketQuery.eq('user_id', currentUserId);

    const { data, error: ticketError } = await ticketQuery;

    if (ticketError) {
      setError(ticketError.message);
      setTickets([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const nextTickets = (data ?? []) as SupportTicket[];
    setTickets(nextTickets);

    const userIds = [...new Set(nextTickets.map((ticket) => ticket.user_id).filter(Boolean))];
    if (userIds.length) {
      const { data: profileRows } = await supabase
        .from('profiles')
        .select('id,full_name,email,phone')
        .in('id', userIds);

      const nextProfiles: Record<string, Profile> = {};
      for (const profile of (profileRows ?? []) as Profile[]) nextProfiles[profile.id] = profile;
      setProfiles(nextProfiles);
    } else {
      setProfiles({});
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void loadTickets();

    const channel = supabase
      .channel('shakh-support-tickets')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'support_tickets' },
        () => void loadTickets(true),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadTickets]);

  const stats = useMemo(() => {
    const count = (status: string) => tickets.filter((ticket) => ticket.status === status).length;
    return {
      total: tickets.length,
      open: count('open'),
      progress: count('in_progress'),
      resolved: count('resolved'),
      closed: count('closed'),
    };
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('ku');
    return tickets.filter((ticket) => {
      const statusMatch = statusFilter === 'all' || ticket.status === statusFilter;
      if (!statusMatch) return false;
      if (!query) return true;
      const profile = profiles[ticket.user_id];
      return [
        ticket.subject,
        ticket.message,
        profile?.full_name,
        profile?.email,
        profile?.phone,
      ].filter(Boolean).some((value) => String(value).toLocaleLowerCase('ku').includes(query));
    });
  }, [profiles, search, statusFilter, tickets]);

  const updateStatus = async (status: 'open' | 'in_progress' | 'resolved' | 'closed') => {
    if (!selected || saving) return;
    setSaving(true);
    setError('');

    const { data, error: updateError } = await supabase
      .from('support_tickets')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', selected.id)
      .select('id,user_id,subject,message,status,created_at,updated_at')
      .single();

    if (updateError) {
      setError(updateError.message);
    } else if (data) {
      const next = data as SupportTicket;
      setSelected(next);
      setTickets((current) => current.map((ticket) => ticket.id === next.id ? next : ticket));
    }
    setSaving(false);
  };

  const createTicket = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!subject.trim() || !message.trim() || saving) return;
    setSaving(true);
    setError('');
    const { data: authData } = await supabase.auth.getUser();
    const currentUserId = authData.user?.id;
    if (!currentUserId) {
      setError('هەژمارەکەت نەدۆزرایەوە.');
      setSaving(false);
      return;
    }
    const { error: insertError } = await supabase.from('support_tickets').insert({
      user_id: currentUserId,
      subject: subject.trim(),
      message: message.trim(),
      status: 'open',
    });
    if (insertError) {
      setError(insertError.message);
    } else {
      setSubject('');
      setMessage('');
      setShowNew(false);
      await loadTickets(true);
    }
    setSaving(false);
  };

  const activeTickets = filteredTickets;

  return (
    <section className="supportCenter" dir="rtl">
      <header className="supportHero">
        <div>
          <span>SHAKH • CUSTOMER SERVICE</span>
          <h2>ناوەندی پشتیوانی و خزمەتگوزاری</h2>
          <p>{canManage ? 'بەڕێوەبردنی تیکەتەکانی کڕیاران لەسەر داتای ڕاستەقینەی سیستەم.' : 'کێشەکەت تۆمار بکە و دۆخی تیکەتەکەت بەدواداچوون بکە.'}</p>
        </div>
        <div className="supportHeroActions">
          <button type="button" onClick={() => void loadTickets(true)} disabled={refreshing}>
          <RefreshCw size={16} className={refreshing ? 'supportSpin' : ''} />
          نوێکردنەوە
          </button>
          <button type="button" className="supportCreateButton" onClick={() => setShowNew(true)}>
            <Plus size={16} /> تیکەتی نوێ
          </button>
        </div>
      </header>

      {error && (
        <div className="supportAlert">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className="supportStats">
        <article><span><Ticket size={16} /></span><small>هەموو تیکەتەکان</small><strong>{stats.total}</strong></article>
        <article className="is-attention"><span><AlertCircle size={16} /></span><small>کراوە</small><strong>{stats.open}</strong></article>
        <article><span><Clock3 size={16} /></span><small>لە کاردایە</small><strong>{stats.progress}</strong></article>
        <article><span><CheckCircle2 size={16} /></span><small>چارەسەرکراو</small><strong>{stats.resolved}</strong></article>
        <article><span><XCircle size={16} /></span><small>داخراو</small><strong>{stats.closed}</strong></article>
      </div>

      <div className="supportWorkspace">
        <section className="supportListPanel">
          <div className="supportToolbar">
            <div className="supportSearch">
              <Search size={15} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="گەڕان بە ناو، بابەت یان پەیام..."
                aria-label="گەڕان لە تیکەتەکان"
              />
            </div>
            <div className="supportFilters" role="tablist" aria-label="فلتەری تیکەت">
              {([
                ['all', 'هەموو'],
                ['open', 'کراوە'],
                ['in_progress', 'لە کاردایە'],
                ['resolved', 'چارەسەر'],
                ['closed', 'داخراو'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={statusFilter === value ? 'is-active' : ''}
                  onClick={() => setStatusFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="supportEmpty"><RefreshCw size={18} className="supportSpin" /><strong>داتا بار دەکرێت...</strong></div>
          ) : activeTickets.length === 0 ? (
            <div className="supportEmpty">
              <MessageCircle size={24} />
              <strong>هیچ تیکەتێک نەدۆزرایەوە</strong>
              <small>بەپێی فلتەر یان گەڕانەکەت تیکەتێکی تر هەڵبژێرە.</small>
            </div>
          ) : (
            <div className="supportTickets">
              {activeTickets.map((ticket) => {
                const profile = profiles[ticket.user_id];
                const status = ticket.status ?? 'open';
                return (
                  <button
                    type="button"
                    key={ticket.id}
                    className={selected?.id === ticket.id ? 'supportTicket is-selected' : 'supportTicket'}
                    onClick={() => setSelected(ticket)}
                  >
                    <div className="supportTicketIcon"><Headphones size={17} /></div>
                    <div className="supportTicketCopy">
                      <strong>{ticket.subject}</strong>
                      <small>{canManage ? (profile?.full_name || profile?.email || 'بەکارهێنەر') : 'تیکەتی من'} • {formatDate(ticket.updated_at || ticket.created_at)}</small>
                      <p>{ticket.message}</p>
                    </div>
                    <span className={'supportStatus ' + (STATUS_CLASS[status] ?? '')}>
                      {STATUS_LABELS[status] ?? status}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <aside className="supportDetailPanel">
          {!selected ? (
            <div className="supportEmpty supportDetailEmpty">
              <ShieldCheck size={28} />
              <strong>تیکەتێک هەڵبژێرە</strong>
              <small>وردەکاری کڕیار و تیکەت لێرە پیشان دەدرێت.</small>
            </div>
          ) : (
            <div className="supportDetail">
              <div className="supportDetailHead">
                <div>
                  <small>تیکەت</small>
                  <h3>{selected.subject}</h3>
                </div>
                <span className={'supportStatus ' + (STATUS_CLASS[selected.status ?? 'open'] ?? '')}>
                  {STATUS_LABELS[selected.status ?? 'open'] ?? selected.status}
                </span>
              </div>

              <div className="supportCustomer">
                <div className="supportAvatar"><UserRound size={18} /></div>
                <div>
                  <strong>{profiles[selected.user_id]?.full_name || 'کڕیار'}</strong>
                  <small>{profiles[selected.user_id]?.email || profiles[selected.user_id]?.phone || selected.user_id}</small>
                </div>
              </div>

              <div className="supportMessage">
                <small>پەیامی کڕیار</small>
                <p>{selected.message}</p>
              </div>

              <div className="supportMeta">
                <span>دروستکراو: {formatDate(selected.created_at)}</span>
                <span>نوێکراوەتەوە: {formatDate(selected.updated_at)}</span>
              </div>

              {canManage && <div className="supportActions">
                <small>گۆڕینی دۆخ</small>
                <div>
                  <button type="button" onClick={() => void updateStatus('in_progress')} disabled={saving || selected.status === 'in_progress'}>
                    <Clock3 size={14} /> لە کاردایە
                  </button>
                  <button type="button" onClick={() => void updateStatus('resolved')} disabled={saving || selected.status === 'resolved'}>
                    <CheckCircle2 size={14} /> چارەسەرکراو
                  </button>
                  <button type="button" onClick={() => void updateStatus('closed')} disabled={saving || selected.status === 'closed'}>
                    <XCircle size={14} /> داخستن
                  </button>
                  <button type="button" onClick={() => void updateStatus('open')} disabled={saving || selected.status === 'open'}>
                    <Ticket size={14} /> کردنەوە
                  </button>
                </div>
              </div>}
            </div>
          )}
        </aside>
      </div>

      {showNew && (
        <div className="supportModalBackdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setShowNew(false);
        }}>
          <form className="supportModal" onSubmit={createTicket}>
            <button type="button" className="supportModalClose" onClick={() => setShowNew(false)} aria-label="داخستن"><XCircle size={18} /></button>
            <div className="supportModalIcon"><Ticket size={22} /></div>
            <span>SUPPORT TICKET</span>
            <h3>تیکەتی نوێ دروست بکە</h3>
            <p>بابەت و وردەکاری کێشەکە بنووسە بۆ تیمی پشتگیری.</p>
            <label>بابەت
              <input required maxLength={160} value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="بابەتی کێشەکە" />
            </label>
            <label>پەیام
              <textarea required maxLength={4000} rows={6} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="کێشەکە بە وردی باس بکە..." />
            </label>
            <div className="supportModalActions">
              <button type="button" onClick={() => setShowNew(false)}>پاشگەزبوونەوە</button>
              <button type="submit" disabled={saving}><Ticket size={15} /> {saving ? 'دەنێردرێت...' : 'ناردنی تیکەت'}</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
