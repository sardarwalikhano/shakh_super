import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bell, CheckCircle2, Clock3, LifeBuoy, MessageCircle, RefreshCw,
  Settings2, UserRound, XCircle, ClipboardList,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { DashboardView } from './DashboardShell';

type Props = { userId: string; onNavigate: (view: DashboardView) => void };
type Ticket = { id: string; status?: string | null; created_at: string };
type Metrics = { total: number; open: number; inProgress: number; resolved: number; closed: number; unreadNotifications: number };
const initial: Metrics = { total: 0, open: 0, inProgress: 0, resolved: 0, closed: 0, unreadNotifications: 0 };

export default function SupportControlCenter({ userId, onNavigate }: Props) {
  const [metrics, setMetrics] = useState<Metrics>(initial);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true); setMessage('');
    try {
      const [ticketsResult, notificationsResult] = await Promise.all([
        supabase.from('support_tickets').select('id,status,created_at').order('created_at', { ascending: false }).limit(500),
        supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('is_read', false),
      ]);
      const firstError = [ticketsResult, notificationsResult].find(result => result.error)?.error;
      if (firstError) throw firstError;
      const tickets = (ticketsResult.data || []) as Ticket[];

      setMetrics({
        total: tickets.length,
        open: tickets.filter(t => (t.status || 'open') === 'open').length,
        inProgress: tickets.filter(t => t.status === 'in_progress').length,
        resolved: tickets.filter(t => t.status === 'resolved').length,
        closed: tickets.filter(t => t.status === 'closed').length,
        unreadNotifications: notificationsResult.count || 0,
      });
      setSyncedAt(new Date());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'نەتوانرا metric ـەکانی پشتگیری وەرگیرێن.');
    } finally { setLoading(false); }
  }, [userId]);

  useEffect(() => {
    void load();
    const channel = supabase.channel('shakh-support-control-center-' + userId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: 'user_id=eq.' + userId }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load, userId]);

  const cards = useMemo(() => [
    { label: 'کۆی تیکەتەکان', value: metrics.total, icon: ClipboardList, tone: 'orange' },
    { label: 'کراوە', value: metrics.open, icon: MessageCircle, tone: 'rose' },
    { label: 'لە کاردایە', value: metrics.inProgress, icon: Clock3, tone: 'amber' },
    { label: 'چارەسەرکراو', value: metrics.resolved, icon: CheckCircle2, tone: 'green' },
    { label: 'داخراو', value: metrics.closed, icon: XCircle, tone: 'slate' },
    { label: 'ئاگادارییە نوێکان', value: metrics.unreadNotifications, icon: Bell, tone: 'blue' },
  ], [metrics]);

  return <section className="shakhSupportCenter" aria-labelledby="support-center-title" dir="rtl">
    <div className="shakhSupportHero">
      <div className="shakhSupportHeroCopy">
        <span className="shakhSupportEyebrow"><LifeBuoy size={15}/> ناوەندی پشتگیری</span>
        <h2 id="support-center-title">SHAKH Support Center</h2>
        <p>بەڕێوەبردنی تیکەتەکان، دۆخی کێشەکان و ئاگادارییەکانی بەشی پشتگیری لە یەک شوێن.</p>
      </div>
      <button type="button" className="shakhSupportRefresh" onClick={() => void load()} disabled={loading}>
        <RefreshCw size={17} className={loading ? 'is-spinning' : ''}/> نوێکردنەوە
      </button>
    </div>
    {message && <div className="msg" role="alert">{message}</div>}

    <div className="shakhSupportStats">
      {cards.map(({ label, value, icon: Icon, tone }) => (
        <article className="shakhSupportStat" data-tone={tone} key={label}>
          <span className="shakhSupportStatIcon"><Icon size={19}/></span>
          <div><small>{label}</small><strong>{value.toLocaleString('ku-IQ')}</strong></div>
        </article>
      ))}
    </div>

    <div className="shakhSupportWorkspace">
      <div className="shakhSupportWorkspaceHead">
        <div><span>دەستگەیشتنی خێرا</span><h3>ئەرکەکانی پشتگیری</h3></div>
        <small>{syncedAt ? 'sync: ' + syncedAt.toLocaleTimeString('ku-IQ') : 'sync دەکرێت...'}</small>
      </div>
      <div className="shakhSupportActionGrid">
        <button type="button" onClick={() => onNavigate('support')}><ClipboardList/><span><b>تیکەتەکان</b><small>{metrics.open} تیکەتی کراوە</small></span></button>
        <button type="button" onClick={() => onNavigate('support')}><MessageCircle/><span><b>تیکەتی نوێ</b><small>داواکارییەکی نوێ تۆمار بکە</small></span></button>
        <button type="button" onClick={() => onNavigate('notifications')}><Bell/><span><b>ئاگادارییەکان</b><small>{metrics.unreadNotifications} نوێ</small></span></button>
        <button type="button" onClick={() => onNavigate('profile')}><UserRound/><span><b>پرۆفایل</b><small>زانیاری هەژمار</small></span></button>
        <button type="button" onClick={() => onNavigate('settings')}><Settings2/><span><b>ڕێکخستنەکان</b><small>ڕێکخستنی هەژمار</small></span></button>
      </div>
    </div>
  </section>;
}
