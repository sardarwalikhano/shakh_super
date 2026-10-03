import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, ClipboardList, MapPin, PackageCheck, RefreshCw, Truck, WalletCards, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getAvailableCaptainOrders, getCaptainOrders } from '../lib/captain';
import type { DashboardView } from './DashboardShell';

type Props = { onNavigate: (view: DashboardView) => void };
type Metrics = { available: number; active: number; deliveredToday: number; earningsToday: number; online: boolean };
const initial: Metrics = { available: 0, active: 0, deliveredToday: 0, earningsToday: 0, online: false };
const money = (v: number) => Number(v || 0).toLocaleString('ku-IQ') + ' د.ع';

export default function CaptainControlCenter({ onNavigate }: Props) {
  const [metrics, setMetrics] = useState<Metrics>(initial);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setMessage('');
    try {
      const [{ data: authData }, available, mine] = await Promise.all([supabase.auth.getUser(), getAvailableCaptainOrders(), getCaptainOrders()]);
      if (!authData.user) throw new Error('پێویستە بچیتە ژوورەوە.');
      const { data: captain, error: captainError } = await supabase.from('captains').select('is_online').eq('user_id', authData.user.id).maybeSingle();
      if (captainError) throw captainError;
      const todayKey = new Date().toLocaleDateString('en-CA');
      const deliveredToday = mine.filter((order) => order.status === 'delivered' && new Date(order.delivered_at || order.updated_at || order.created_at).toLocaleDateString('en-CA') === todayKey);
      setMetrics({
        available: available.length,
        active: mine.filter((order) => !['delivered', 'cancelled'].includes(order.status)).length,
        deliveredToday: deliveredToday.length,
        earningsToday: deliveredToday.reduce((sum, order) => sum + Number(order.delivery_fee_iqd || 0), 0),
        online: Boolean(captain?.is_online),
      });
      setSyncedAt(new Date());
    } catch (error) { setMessage(error instanceof Error ? error.message : 'نەتوانرا پوختەی کاپتن وەرگیرێت.'); }
    finally { setLoading(false); }
  }, []);

  const toggleOnline = async () => {
    setBusy(true); setMessage('');
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) throw new Error('پێویستە بچیتە ژوورەوە.');
      const next = !metrics.online;
      const { error } = await supabase.from('captains').update({ is_online: next }).eq('user_id', authData.user.id);
      if (error) throw error;
      setMetrics((current) => ({ ...current, online: next }));
      setMessage(next ? 'کاپتن ئۆنلاین کرا.' : 'کاپتن ئۆفلاین کرا.');
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'گۆڕینی دۆخی ئۆنلاین سەرکەوتوو نەبوو.'); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    void load();
    const channel = supabase.channel('shakh-captain-center')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'captains' }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load]);

  const cards = useMemo(() => [
    { label: 'ئۆردەری ئامادە بۆ وەرگرتن', value: metrics.available, icon: Zap, tone: 'orange' },
    { label: 'ئۆردەرە چالاکەکانم', value: metrics.active, icon: Activity, tone: 'blue' },
    { label: 'گەیەندراوەکانی ئەمڕۆ', value: metrics.deliveredToday, icon: PackageCheck, tone: 'green' },
    { label: 'کرێی گەیاندنی ئەمڕۆ', value: money(metrics.earningsToday), icon: WalletCards, tone: 'violet', money: true },
  ], [metrics]);

  return <section className="shakhCaptainCenter" aria-labelledby="captain-center-title">
    <div className="shakhCaptainHero">
      <div className="shakhCaptainHeroCopy">
        <span className="shakhCaptainEyebrow"><Truck size={15} /> ناوەندی کاپتن</span>
        <h2 id="captain-center-title">SHAKH Captain Center</h2>
        <p>ئۆردەرە بەردەستەکان، گەیاندنە چالاکەکان، داهاتی ئەمڕۆ و دۆخی ئۆنلاین لە یەک شوێن.</p>
      </div>
      <div className="shakhCaptainHeroActions">
        <button type="button" className={metrics.online ? 'shakhCaptainOnline is-online' : 'shakhCaptainOnline'} onClick={() => void toggleOnline()} disabled={busy}><span className="shakhCaptainStatusDot" /> {busy ? 'دۆخ...' : metrics.online ? 'ئۆنلاین' : 'ئۆفلاین'}</button>
        <button type="button" className="shakhCaptainRefresh" onClick={() => void load()} disabled={loading}><RefreshCw size={17} className={loading ? 'is-spinning' : ''} /> نوێکردنەوە</button>
      </div>
    </div>
    {message && <div className="msg" role="alert">{message}</div>}
    <div className="shakhCaptainStats">{cards.map(({ label, value, icon: Icon, tone, money: isMoney }) => <article className="shakhCaptainStat" data-tone={tone} key={label}><span className="shakhCaptainStatIcon"><Icon size={19} /></span><div><small>{label}</small><strong className={isMoney ? 'is-money' : ''}>{typeof value === 'number' ? value.toLocaleString('ku-IQ') : value}</strong></div></article>)}</div>
    <div className="shakhCaptainWorkspace">
      <div className="shakhCaptainWorkspaceHead"><div><span>دەستگەیشتنی خێرا</span><h3>ئامرازە سەرەکییەکانی کاپتن</h3></div><small>{syncedAt ? 'دوایین sync: ' + syncedAt.toLocaleTimeString('ku-IQ') : 'sync دەکرێت...'}</small></div>
      <div className="shakhCaptainActionGrid">
        <button type="button" onClick={() => onNavigate('delivery')}><ClipboardList /><span><b>ئۆردەر و گەیاندن</b><small>{metrics.active.toLocaleString('ku-IQ')} چالاک</small></span></button>
        <button type="button" onClick={() => onNavigate('wallet')}><WalletCards /><span><b>جزدان</b><small>{money(metrics.earningsToday)} ئەمڕۆ</small></span></button>
        <button type="button" onClick={() => onNavigate('profile')}><Truck /><span><b>پرۆفایل</b><small>زانیاری و ژمارەی پەیوەندی</small></span></button>
        <button type="button" onClick={() => onNavigate('notifications')}><Zap /><span><b>ئاگادارییەکان</b><small>ئاگاداریی ئۆردەر و گەیاندن</small></span></button>
        <button type="button" onClick={() => onNavigate('support')}><MapPin /><span><b>پشتگیری</b><small>یارمەتی و تیکەت</small></span></button>
      </div>
    </div>
  </section>;
}