import { FormEvent, useCallback, useEffect, useState } from 'react';
import { MessageCircle, Plus, RefreshCw, Send, ShieldCheck, Clock3, Phone, ExternalLink, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Props = { userId: string; role: string };

type Ticket = {
  id: string;
  user_id: string;
  subject: string;
  message: string;
  status: string | null;
  created_at: string;
  updated_at: string;
};

const statusLabel: Record<string, string> = {
  open: 'کراوە',
  in_progress: 'لە کاردایە',
  resolved: 'چارەسەرکراو',
  closed: 'داخراو',
};

export default function SupportTicketsPanel({ userId, role }: Props) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [error, setError] = useState('');
  const canReadAll = role === 'support' || role === 'admin' || role === 'super_admin';
  const canManageStatus = role === 'support' || role === 'admin' || role === 'super_admin';

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    let query = supabase
      .from('support_tickets')
      .select('id,user_id,subject,message,status,created_at,updated_at')
      .order('created_at', { ascending: false })
      .limit(50);

    if (!canReadAll) query = query.eq('user_id', userId);

    const { data, error: loadError } = await query;
    if (loadError) setError('نەتوانرا پەیامەکانی پشتگیری وەرگیرێن.');
    else setTickets((data || []) as Ticket[]);
    setLoading(false);
  }, [canReadAll, userId]);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel('shakh-support-' + userId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, () => void load())
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load, userId]);

  const updateStatus = async (ticket: Ticket, status: string) => {
    if (!canManageStatus) return;
    setError('');
    const { error: updateError } = await supabase.from('support_tickets')
      .update({ status })
      .eq('id', ticket.id);
    if (updateError) {
      setError('گۆڕینی دۆخی تیکەت سەرکەوتوو نەبوو.');
      return;
    }
    setTickets(current => current.map(item => item.id === ticket.id ? { ...item, status, updated_at: new Date().toISOString() } : item));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const cleanSubject = subject.trim();
    const cleanMessage = message.trim();

    if (cleanSubject.length < 3) {
      setError('سەردێڕی پشتگیری دەبێت لانیکەم ٣ پیت بێت.');
      return;
    }
    if (cleanMessage.length < 10) {
      setError('پەیامی پشتگیری دەبێت وردتر بێت.');
      return;
    }

    setSaving(true);
    setError('');
    const { error: insertError } = await supabase.from('support_tickets').insert({
      user_id: userId,
      subject: cleanSubject,
      message: cleanMessage,
    });

    if (insertError) {
      setError('ناردنی داواکاریی پشتگیری سەرکەوتوو نەبوو.');
    } else {
      setSubject('');
      setMessage('');
      setShowComposer(false);
      await load();
    }
    setSaving(false);
  };

  return (
    <section className="supportPanel" aria-label="پشتگیریی شاخ">
      <div className="supportHead">
        <div>
          <span className="eyebrow"><MessageCircle size={16} /> پشتگیری</span>
          <h2>{canReadAll ? 'داواکارییەکانی پشتگیری' : 'پشتگیریی من'}</h2>
          <p>{canReadAll ? 'تیکەتەکانی بەشەکە لێرە بە شێوەی ڕاستەوخۆ نوێ دەبنەوە.' : 'کێشە یان پرسیارەکەت تۆمار بکە و مێژووی بەدواداچوون ببینە.'}</p>
        </div>
        <div className="supportHeadActions">
          <button type="button" className="plain" onClick={() => void load()} disabled={loading} aria-label="نوێکردنەوەی پشتگیری">
            <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
          </button>
          <button type="button" className="primary supportNewButton" onClick={() => setShowComposer(current => !current)}>
            <Plus size={17} /> تیکەتی نوێ
          </button>
        </div>
      </div>
      <div className="supportContactCard">
        <div><strong>پشتگیریی ڕاستەوخۆ</strong><small>بۆ کێشەی خێرا پەیوەندی بکە.</small></div>
        <div className="supportContactActions">
          <a href="tel:+9647504796924"><Phone size={16}/> 07504796924</a>
          <a href="https://wa.me/9647504796924" target="_blank" rel="noreferrer"><MessageCircle size={16}/> WhatsApp <ExternalLink size={12}/></a>
        </div>
      </div>

      {showComposer && (
        <form className="supportComposer" onSubmit={submit}>
          <div className="supportComposerBadge"><ShieldCheck size={20} /></div>
          <div className="supportComposerFields">
            <input
              value={subject}
              onChange={event => setSubject(event.target.value)}
              maxLength={120}
              placeholder="سەردێڕی کێشەکە"
              aria-label="سەردێڕی پشتگیری"
              autoFocus
            />
            <textarea
              value={message}
              onChange={event => setMessage(event.target.value)}
              maxLength={2000}
              rows={5}
              placeholder="کێشەکە بە وردی باس بکە..."
              aria-label="پەیامی پشتگیری"
            />
            <div className="supportComposerFooter">
              <small>{message.length.toLocaleString('ku-IQ')} / ٢٠٠٠</small>
              <button type="submit" className="primary" disabled={saving}>
                <Send size={17} /> {saving ? 'دەنێردرێت...' : 'ناردنی تیکەت'}
              </button>
            </div>
          </div>
        </form>
      )}

      {error && <div className="supportMessage" role="alert">{error}</div>}

      {loading ? (
        <div className="supportEmpty"><RefreshCw className="animate-spin" /><span>پشتگیری بار دەکرێت...</span></div>
      ) : tickets.length === 0 ? (
        <div className="supportEmpty">
          <MessageCircle size={40} />
          <strong>هێشتا هیچ تیکەتێک نییە</strong>
          <span>لە «تیکەتی نوێ» ـەوە داواکارییەکەت بنێرە.</span>
        </div>
      ) : (
        <div className="supportList">
          {tickets.map(ticket => (
            <article className="supportTicket" key={ticket.id}>
              <div className="supportTicketIcon"><MessageCircle size={19} /></div>
              <div className="supportTicketBody">
                <div className="supportTicketTitle">
                  <strong>{ticket.subject}</strong>
                  <span className={'supportStatus supportStatus-' + (ticket.status || 'open')}>{statusLabel[ticket.status || 'open'] || ticket.status || 'کراوە'}</span>
                </div>
                <p>{ticket.message}</p>
                <small><Clock3 size={13} /> {new Date(ticket.updated_at || ticket.created_at).toLocaleString('ku-IQ')}</small>
                {canReadAll && <small className="supportTicketUser">هەژمار: {ticket.user_id.slice(0, 8)}</small>}
                {canManageStatus && (
                  <div className="supportTicketActions" role="group" aria-label="گۆڕینی دۆخی تیکەت">
                    <button type="button" className="supportStatusAction" onClick={() => void updateStatus(ticket, 'open')} disabled={ticket.status === 'open'}>
                      <MessageCircle size={14} /> کراوە
                    </button>
                    <button type="button" className="supportStatusAction" onClick={() => void updateStatus(ticket, 'in_progress')} disabled={ticket.status === 'in_progress'}>
                      <Clock3 size={14} /> لە کاردایە
                    </button>
                    <button type="button" className="supportStatusAction" onClick={() => void updateStatus(ticket, 'resolved')} disabled={ticket.status === 'resolved'}>
                      <CheckCircle2 size={14} /> چارەسەرکراو
                    </button>
                    <button type="button" className="supportStatusAction" onClick={() => void updateStatus(ticket, 'closed')} disabled={ticket.status === 'closed'}>
                      <XCircle size={14} /> داخراو
                    </button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
