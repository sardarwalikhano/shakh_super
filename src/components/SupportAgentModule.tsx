import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, LifeBuoy, MessageSquareText, RefreshCw, Search, UserRound } from 'lucide-react';
import { supabase } from '../lib/supabase';

type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

type Ticket = {
  id: string;
  user_id: string;
  subject: string;
  message: string;
  status: TicketStatus | string | null;
  created_at: string | null;
  updated_at: string | null;
};

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
};

const statusLabels: Record<string, string> = {
  open: 'کراوە',
  in_progress: 'لە کاردایە',
  resolved: 'چارەسەرکراو',
  closed: 'داخراو',
};

const statusOrder: TicketStatus[] = ['open', 'in_progress', 'resolved', 'closed'];

const statusClass = (status: string | null) => {
  if (status === 'resolved') return 'is-resolved';
  if (status === 'closed') return 'is-closed';
  if (status === 'in_progress') return 'is-progress';
  return 'is-open';
};

const formatDate = (value: string | null) => {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ku-IQ', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
};

export default function SupportAgentModule() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | TicketStatus>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);

    const { data: ticketData, error: ticketError } = await supabase
      .from('support_tickets')
      .select('id,user_id,subject,message,status,created_at,updated_at')
      .order('updated_at', { ascending: false })
      .limit(200);

    if (ticketError) {
      setTickets([]);
      setProfiles({});
      setError(ticketError.message);
      setLoading(false);
      return;
    }

    const nextTickets = (ticketData || []) as Ticket[];
    setTickets(nextTickets);

    const userIds = [...new Set(nextTickets.map((ticket) => ticket.user_id).filter(Boolean))];
    if (userIds.length) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id,full_name,email,phone')
        .in('id', userIds);

      const nextProfiles: Record<string, Profile> = {};
      ((profileData || []) as Profile[]).forEach((profile) => {
        nextProfiles[profile.id] = profile;
      });
      setProfiles(nextProfiles);
    } else {
      setProfiles({});
    }

    setLoading(false);
  };

  useEffect(() => {
    void load();

    const channel = supabase
      .channel('shakh-support-agent')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, () => void load())
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const counts = useMemo(() => ({
    all: tickets.length,
    open: tickets.filter((ticket) => ticket.status === 'open').length,
    in_progress: tickets.filter((ticket) => ticket.status === 'in_progress').length,
    resolved: tickets.filter((ticket) => ticket.status === 'resolved').length,
    closed: tickets.filter((ticket) => ticket.status === 'closed').length,
  }), [tickets]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return tickets.filter((ticket) => {
      const matchesStatus = filter === 'all' || ticket.status === filter;
      if (!matchesStatus) return false;
      if (!normalized) return true;
      const profile = profiles[ticket.user_id];
      return [ticket.subject, ticket.message, profile?.full_name, profile?.email, profile?.phone]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase()
        .includes(normalized);
    });
  }, [tickets, profiles, query, filter]);

  const selected = tickets.find((ticket) => ticket.id === selectedId) || filtered[0] || null;

  useEffect(() => {
    if (selected && selected.id !== selectedId && filtered.length) setSelectedId(filtered[0].id);
    if (!filtered.length) setSelectedId(null);
  }, [filtered, selected, selectedId]);

  const updateStatus = async (id: string, status: TicketStatus) => {
    setUpdatingId(id);
    setError(null);

    const { error: updateError } = await supabase
      .from('support_tickets')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (updateError) {
      setError(updateError.message);
    } else {
      setTickets((current) => current.map((ticket) => ticket.id === id ? { ...ticket, status, updated_at: new Date().toISOString() } : ticket));
    }

    setUpdatingId(null);
  };

  const selectedProfile = selected ? profiles[selected.user_id] : null;

  return (
    <section className="supportAgentCenter" dir="rtl">
      <div className="supportAgentHero">
        <div>
          <span>SHAKH SUPPORT • CUSTOMER SERVICE</span>
          <h2>ناوەندی پشتگیری و خزمەتگوزاری</h2>
          <p>تیکەتەکانی بەکارهێنەران لە داتای ڕاستەقینەی Supabase بە شێوەی ڕێکخراو بەڕێوە ببە.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={16} />
          نوێکردنەوە
        </button>
      </div>

      {error && <div className="supportAgentAlert" role="alert">{error}</div>}

      <div className="supportAgentStats">
        <button type="button" className={filter === 'all' ? 'is-active' : ''} onClick={() => setFilter('all')}>
          <LifeBuoy size={17} />
          <span>هەموو تیکەتەکان</span>
          <strong>{counts.all.toLocaleString('ku-IQ')}</strong>
        </button>
        <button type="button" className={filter === 'open' ? 'is-active' : ''} onClick={() => setFilter('open')}>
          <MessageSquareText size={17} />
          <span>کراوە</span>
          <strong>{counts.open.toLocaleString('ku-IQ')}</strong>
        </button>
        <button type="button" className={filter === 'in_progress' ? 'is-active' : ''} onClick={() => setFilter('in_progress')}>
          <Clock3 size={17} />
          <span>لە کاردایە</span>
          <strong>{counts.in_progress.toLocaleString('ku-IQ')}</strong>
        </button>
        <button type="button" className={filter === 'resolved' ? 'is-active' : ''} onClick={() => setFilter('resolved')}>
          <CheckCircle2 size={17} />
          <span>چارەسەرکراو</span>
          <strong>{counts.resolved.toLocaleString('ku-IQ')}</strong>
        </button>
      </div>

      <div className="supportAgentToolbar">
        <div className="supportAgentSearch">
          <Search size={17} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="گەڕان بە ناونیشان، ناو یان ئیمەیڵ..."
            aria-label="گەڕان لە تیکەتەکان"
          />
        </div>
        <span>{filtered.length.toLocaleString('ku-IQ')} تیکەت</span>
      </div>

      <div className="supportAgentWorkspace">
        <div className="supportAgentTicketList">
          {loading && <div className="supportAgentEmpty"><RefreshCw className="supportAgentSpin" size={22} /><strong>داتا بار دەکرێت...</strong></div>}
          {!loading && !filtered.length && (
            <div className="supportAgentEmpty">
              <LifeBuoy size={25} />
              <strong>هیچ تیکەتێک نەدۆزرایەوە</strong>
              <small>لەگەڵ گەڕان یان فلتەرێکی تر هەوڵ بدەرەوە.</small>
            </div>
          )}
          {!loading && filtered.map((ticket) => {
            const profile = profiles[ticket.user_id];
            const active = selected?.id === ticket.id;
            return (
              <button key={ticket.id} type="button" className={`supportAgentTicket ${active ? 'is-selected' : ''}`} onClick={() => setSelectedId(ticket.id)}>
                <div className="supportAgentTicketTop">
                  <strong>{ticket.subject}</strong>
                  <span className={`supportAgentStatus ${statusClass(ticket.status)}`}>{statusLabels[ticket.status || 'open'] || ticket.status || 'کراوە'}</span>
                </div>
                <p>{ticket.message}</p>
                <small>{profile?.full_name || profile?.email || 'بەکارهێنەر'} • {formatDate(ticket.updated_at || ticket.created_at)}</small>
              </button>
            );
          })}
        </div>

        <article className="supportAgentDetail">
          {!selected ? (
            <div className="supportAgentEmpty">
              <LifeBuoy size={28} />
              <strong>تیکەتێک هەڵبژێرە</strong>
              <small>لێرە وردەکاری و دۆخی تیکەتەکە دەبینیت.</small>
            </div>
          ) : (
            <>
              <div className="supportAgentDetailHead">
                <div>
                  <span>تیکەت</span>
                  <h3>{selected.subject}</h3>
                  <small>{formatDate(selected.created_at)}</small>
                </div>
                <span className={`supportAgentStatus ${statusClass(selected.status)}`}>{statusLabels[selected.status || 'open'] || selected.status || 'کراوە'}</span>
              </div>

              <div className="supportAgentCustomer">
                <div className="supportAgentAvatar"><UserRound size={18} /></div>
                <div>
                  <strong>{selectedProfile?.full_name || 'بەکارهێنەر'}</strong>
                  <span>{selectedProfile?.email || selectedProfile?.phone || selected.user_id}</span>
                </div>
              </div>

              <div className="supportAgentMessage">
                <small>پەیامی بەکارهێنەر</small>
                <p>{selected.message}</p>
              </div>

              <div className="supportAgentStatusPanel">
                <div>
                  <strong>گۆڕینی دۆخی تیکەت</strong>
                  <small>دۆخی نوێ بە Supabase پاشەکەوت دەکرێت.</small>
                </div>
                <div className="supportAgentStatusActions">
                  {statusOrder.map((status) => (
                    <button
                      key={status}
                      type="button"
                      className={selected.status === status ? 'is-active' : ''}
                      disabled={updatingId === selected.id}
                      onClick={() => void updateStatus(selected.id, status)}
                    >
                      {statusLabels[status]}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </article>
      </div>
    </section>
  );
}
