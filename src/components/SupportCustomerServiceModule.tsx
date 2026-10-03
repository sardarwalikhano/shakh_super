import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock3,
  LifeBuoy,
  MessageSquareText,
  RefreshCw,
  Send,
  Ticket,
  UserRound,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

type TicketRow = {
  id: string;
  user_id: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type Props = {
  role: string;
};

const STATUS_LABELS: Record<string, string> = {
  open: 'کراوە',
  pending: 'چاوەڕوان',
  in_progress: 'لە کاردایە',
  resolved: 'چارەسەرکراو',
  closed: 'داخراو',
};

const statusLabel = (status: string) =>
  STATUS_LABELS[String(status || '').toLowerCase()] || status || 'بێ دۆخ';

const statusClass = (status: string) => {
  const value = String(status || '').toLowerCase();
  if (['resolved', 'closed'].includes(value)) return 'is-success';
  if (['in_progress', 'pending'].includes(value)) return 'is-warning';
  return 'is-open';
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('ku-IQ', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));

export default function SupportCustomerServiceModule({ role }: Props) {
  const isAgent = role === 'support' || role === 'admin' || role === 'super_admin';
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadTickets = async () => {
    setLoading(true);
    setError('');
    const { data: userResult } = await supabase.auth.getUser();
    const userId = userResult.user?.id;
    if (!userId) {
      setTickets([]);
      setLoading(false);
      return;
    }

    const query = supabase
      .from('support_tickets')
      .select('id,user_id,subject,message,status,created_at,updated_at')
      .order('updated_at', { ascending: false })
      .limit(isAgent ? 100 : 30);

    const { data, error: queryError } = isAgent
      ? await query
      : await query.eq('user_id', userId);

    if (queryError) {
      setError(queryError.message);
      setTickets([]);
    } else {
      setTickets((data || []) as TicketRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadTickets();
    const channel = supabase
      .channel('shakh-support-tickets')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'support_tickets' },
        () => void loadTickets(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [role]);

  const selectedTicket = tickets.find((ticket) => ticket.id === selectedId) || tickets[0] || null;

  const counts = useMemo(() => {
    const open = tickets.filter((t) => ['open', 'pending'].includes(String(t.status).toLowerCase())).length;
    const active = tickets.filter((t) => String(t.status).toLowerCase() === 'in_progress').length;
    const resolved = tickets.filter((t) => ['resolved', 'closed'].includes(String(t.status).toLowerCase())).length;
    return { total: tickets.length, open, active, resolved };
  }, [tickets]);

  const createTicket = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!subject.trim() || !message.trim()) return;

    setSaving(true);
    setError('');
    const { data: userResult } = await supabase.auth.getUser();
    const userId = userResult.user?.id;
    if (!userId) {
      setError('تکایە سەرەتا بچۆ ژوورەوە.');
      setSaving(false);
      return;
    }

    const { error: insertError } = await supabase.from('support_tickets').insert({
      user_id: userId,
      subject: subject.trim(),
      message: message.trim(),
      status: 'open',
    });

    if (insertError) {
      setError(insertError.message);
    } else {
      setSubject('');
      setMessage('');
      await loadTickets();
    }
    setSaving(false);
  };

  const updateStatus = async (nextStatus: string) => {
    if (!selectedTicket || !isAgent) return;
    setSaving(true);
    setError('');
    const { error: updateError } = await supabase
      .from('support_tickets')
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq('id', selectedTicket.id);

    if (updateError) {
      setError(updateError.message);
    } else {
      await loadTickets();
    }
    setSaving(false);
  };

  return (
    <section className="supportCenter" dir="rtl">
      <div className="supportHero">
        <div>
          <span>SHAKH • SUPPORT / CUSTOMER SERVICE</span>
          <h2>{isAgent ? 'ناوەندی پشتگیری و خزمەتگوزاری' : 'ناوەندی پشتگیری'}</h2>
          <p>
            {isAgent
              ? 'تیکەتەکانی بەکارهێنەران بە شێوەی ڕاستەقینە لە Supabase و بە نوێکردنەوەی Realtime بەڕێوەببە.'
              : 'کێشەکەت بنووسە و لە هەمان ناوەندەوە بەدوای وەڵام و دۆخی تیکەتەکەت بکەوە.'}
          </p>
        </div>
        <button type="button" onClick={() => void loadTickets()} disabled={loading}>
          <RefreshCw size={16} /> نوێکردنەوە
        </button>
      </div>

      {error && <div className="supportAlert">{error}</div>}

      <div className="supportStats">
        <article><Ticket size={17} /><small>کۆی تیکەت</small><strong>{counts.total.toLocaleString('ku-IQ')}</strong></article>
        <article><Clock3 size={17} /><small>کراوە / چاوەڕوان</small><strong>{counts.open.toLocaleString('ku-IQ')}</strong></article>
        <article><MessageSquareText size={17} /><small>لە کاردایە</small><strong>{counts.active.toLocaleString('ku-IQ')}</strong></article>
        <article><CheckCircle2 size={17} /><small>چارەسەرکراو</small><strong>{counts.resolved.toLocaleString('ku-IQ')}</strong></article>
      </div>

      <div className="supportLayout">
        {!isAgent && (
          <form className="supportPanel supportNewTicket" onSubmit={createTicket}>
            <div className="supportPanelHead">
              <div><small>NEW REQUEST</small><h3>تیکەتی نوێ</h3></div>
              <LifeBuoy size={20} />
            </div>
            <label>
              بابەت
              <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="بابەتی کێشەکەت..." maxLength={160} />
            </label>
            <label>
              پەیام
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="وردەکاری کێشەکە بنووسە..." rows={7} maxLength={4000} />
            </label>
            <button type="submit" disabled={saving || !subject.trim() || !message.trim()}>
              <Send size={16} /> {saving ? 'دەنێردرێت...' : 'ناردنی تیکەت'}
            </button>
          </form>
        )}

        <div className="supportPanel supportTicketsPanel">
          <div className="supportPanelHead">
            <div><small>{isAgent ? 'CUSTOMER QUEUE' : 'MY TICKETS'}</small><h3>{isAgent ? 'تیکەتەکانی بەکارهێنەران' : 'تیکەتەکانم'}</h3></div>
            <span>{tickets.length.toLocaleString('ku-IQ')} تیکەت</span>
          </div>

          <div className="supportTicketList">
            {tickets.map((ticket) => (
              <button
                type="button"
                key={ticket.id}
                className={`supportTicketRow ${selectedTicket?.id === ticket.id ? 'is-selected' : ''}`}
                onClick={() => setSelectedId(ticket.id)}
              >
                <span className="supportTicketIcon"><Ticket size={17} /></span>
                <span className="supportTicketCopy">
                  <strong>{ticket.subject || 'بێ بابەت'}</strong>
                  <small>{formatDate(ticket.updated_at || ticket.created_at)}</small>
                </span>
                {isAgent && <span className="supportTicketUser"><UserRound size={13} /> {ticket.user_id.slice(0, 8)}…</span>}
                <span className={`supportStatus ${statusClass(ticket.status)}`}>{statusLabel(ticket.status)}</span>
              </button>
            ))}
            {!tickets.length && !loading && (
              <div className="supportEmpty"><LifeBuoy size={28} /><strong>{isAgent ? 'هیچ تیکەتێک نییە' : 'هێشتا هیچ تیکەتێکت نییە'}</strong><small>{isAgent ? 'کاتێک بەکارهێنەر تیکەت بنێرێت لێرە دەردەکەوێت.' : 'لە فۆڕمی تیکەتی نوێوە یەکەم داواکارییەکەت بنێرە.'}</small></div>
            )}
          </div>
        </div>

        <aside className="supportPanel supportDetailPanel">
          {selectedTicket ? (
            <>
              <div className="supportDetailTop">
                <div><small>SELECTED TICKET</small><h3>{selectedTicket.subject || 'بێ بابەت'}</h3></div>
                <span className={`supportStatus ${statusClass(selectedTicket.status)}`}>{statusLabel(selectedTicket.status)}</span>
              </div>
              <div className="supportMessage">{selectedTicket.message || 'پەیامێک تۆمار نەکراوە.'}</div>
              <div className="supportMeta">
                <span><UserRound size={14} /> {selectedTicket.user_id.slice(0, 8)}…</span>
                <span><Clock3 size={14} /> {formatDate(selectedTicket.created_at)}</span>
              </div>
              {isAgent && (
                <div className="supportActions">
                  <button type="button" onClick={() => void updateStatus('in_progress')} disabled={saving}>لە کاردایە</button>
                  <button type="button" onClick={() => void updateStatus('resolved')} disabled={saving}>چارەسەرکراو</button>
                  <button type="button" onClick={() => void updateStatus('closed')} disabled={saving}>داخستن</button>
                </div>
              )}
            </>
          ) : (
            <div className="supportEmpty supportDetailEmpty"><LifeBuoy size={30} /><strong>تیکەتێک هەڵبژێرە</strong><small>وردەکاری تیکەتەکە لێرە پیشان دەدرێت.</small></div>
          )}
        </aside>
      </div>
    </section>
  );
}
