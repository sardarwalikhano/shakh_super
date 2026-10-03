import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, Bell, Car, ClipboardList, LifeBuoy, Package, RefreshCw,
  ShieldCheck, Store, Truck, Users, WalletCards, Zap,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { DashboardView } from './DashboardShell';

type Props = { onNavigate: (view: DashboardView) => void };

type Metrics = {
  users: number;
  stores: number;
  products: number;
  orders: number;
  activeOrders: number;
  onlineCaptains: number;
  tickets: number;
  unreadNotifications: number;
};

const initialMetrics: Metrics = {
  users: 0,
  stores: 0,
  products: 0,
  orders: 0,
  activeOrders: 0,
  onlineCaptains: 0,
  tickets: 0,
  unreadNotifications: 0,
};

export default function SuperAdminControlCenter({ onNavigate }: Props) {
  const [metrics, setMetrics] = useState<Metrics>(initialMetrics);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const [
        users,
        stores,
        products,
        orders,
        activeOrders,
        onlineCaptains,
        tickets,
        unreadNotifications,
      ] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('stores').select('id', { count: 'exact', head: true }),
        supabase.from('products').select('id', { count: 'exact', head: true }),
        supabase.from('orders').select('id', { count: 'exact', head: true }),
        supabase.from('orders').select('id', { count: 'exact', head: true }).not('status', 'in', '("delivered","cancelled")'),
        supabase.from('captains').select('user_id', { count: 'exact', head: true }).eq('is_online', true),
        supabase.from('support_tickets').select('id', { count: 'exact', head: true }),
        supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('is_read', false),
      ]);

      const firstError = [users, stores, products, orders, activeOrders, onlineCaptains, tickets, unreadNotifications]
        .find((result) => result.error)?.error;
      if (firstError) throw firstError;

      setMetrics({
        users: users.count ?? 0,
        stores: stores.count ?? 0,
        products: products.count ?? 0,
        orders: orders.count ?? 0,
        activeOrders: activeOrders.count ?? 0,
        onlineCaptains: onlineCaptains.count ?? 0,
        tickets: tickets.count ?? 0,
        unreadNotifications: unreadNotifications.count ?? 0,
      });
      setSyncedAt(new Date());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'نەتوانرا داتای ناوەندی کۆنترۆڵ وەرگیرێت.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel('shakh-super-admin-control-center')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stores' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'captains' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load]);

  const statCards = useMemo(() => [
    { label: 'بەکارهێنەران', value: metrics.users, icon: Users, tone: 'orange' },
    { label: 'دوکانەکان', value: metrics.stores, icon: Store, tone: 'blue' },
    { label: 'بەرهەمەکان', value: metrics.products, icon: Package, tone: 'green' },
    { label: 'هەموو ئۆردەرەکان', value: metrics.orders, icon: ClipboardList, tone: 'violet' },
    { label: 'ئۆردەرە چالاکەکان', value: metrics.activeOrders, icon: Activity, tone: 'amber' },
    { label: 'کاپتنی ئۆنلاین', value: metrics.onlineCaptains, icon: Truck, tone: 'teal' },
    { label: 'تیکەتەکان', value: metrics.tickets, icon: LifeBuoy, tone: 'rose' },
    { label: 'ئاگاداریی نەخوێندراو', value: metrics.unreadNotifications, icon: Bell, tone: 'slate' },
  ], [metrics]);

  return (
    <section className="shakhSuperAdminCenter" aria-labelledby="super-admin-center-title">
      <div className="shakhSuperAdminHero">
        <div className="shakhSuperAdminHeroCopy">
          <span className="shakhSuperAdminEyebrow"><ShieldCheck size={15} /> ناوەندی کۆنترۆڵی بەڕێوبەری باڵا</span>
          <h2 id="super-admin-center-title">SHAKH Command Center</h2>
          <p>پوختەی ڕاستەقینەی پلاتفۆرم بۆ چاودێری بەکارهێنەر، بازار، ئۆردەر و گەیاندن.</p>
        </div>
        <button type="button" className="shakhSuperAdminRefresh" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={17} className={loading ? 'is-spinning' : ''} />
          نوێکردنەوە
        </button>
      </div>

      {message && <div className="msg" role="alert">{message}</div>}

      <div className="shakhSuperAdminStats">
        {statCards.map(({ label, value, icon: Icon, tone }) => (
          <article className="shakhSuperAdminStat" data-tone={tone} key={label}>
            <span className="shakhSuperAdminStatIcon"><Icon size={19} /></span>
            <div><small>{label}</small><strong>{value.toLocaleString('ku-IQ')}</strong></div>
          </article>
        ))}
      </div>

      <div className="shakhSuperAdminWorkspace">
        <div className="shakhSuperAdminWorkspaceHead">
          <div>
            <span>دەستگەیشتن بە خێرایی</span>
            <h3>بەشە سەرەکییەکانی بەڕێوبەرایەتی</h3>
          </div>
          <small>{syncedAt ? 'دوایین sync: ' + syncedAt.toLocaleTimeString('ku-IQ') : 'sync دەکرێت...'}</small>
        </div>

        <div className="shakhSuperAdminActionGrid">
          <button type="button" onClick={() => onNavigate('orders')}><ClipboardList /><span><b>ناوەندی ئۆردەر</b><small>{metrics.activeOrders.toLocaleString('ku-IQ')} چالاک</small></span></button>
          <button type="button" onClick={() => onNavigate('delivery')}><Truck /><span><b>چاودێری گەیاندن</b><small>کاپتن و شوێنکەوتن</small></span></button>
          <button type="button" onClick={() => onNavigate('delivery_zones')}><Store /><span><b>سنوری گەیاندن</b><small>ناوچە و خزمەتگوزاری</small></span></button>
          <button type="button" onClick={() => onNavigate('cars')}><Car /><span><b>SHAKH Cars</b><small>پێشانگا و ئۆتۆمبێل</small></span></button>
          <button type="button" onClick={() => onNavigate('umrah')}><Zap /><span><b>حەج و عومرە</b><small>پەکەج و حجز</small></span></button>
          <button type="button" onClick={() => onNavigate('wallet')}><WalletCards /><span><b>جزدان</b><small>پارە و خاڵ</small></span></button>
          <button type="button" onClick={() => onNavigate('support')}><LifeBuoy /><span><b>پشتگیری</b><small>{metrics.tickets.toLocaleString('ku-IQ')} تیکەت</small></span></button>
          <button type="button" onClick={() => onNavigate('settings')}><ShieldCheck /><span><b>ڕێکخستن و ئاسایش</b><small>ڕوکار و پلاتفۆرم</small></span></button>
        </div>
      </div>
    </section>
  );
}
