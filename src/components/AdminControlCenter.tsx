import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, Bell, Car, ClipboardList, LifeBuoy, MapPinned, Package,
  Plane, RefreshCw, Settings2, ShieldCheck, Store, Truck, Users,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { DashboardView } from './DashboardShell';

type Props = { onNavigate: (view: DashboardView) => void };

type Metrics = {
  users: number;
  vendors: number;
  stores: number;
  products: number;
  orders: number;
  activeOrders: number;
  onlineCaptains: number;
  openTickets: number;
};

const initialMetrics: Metrics = {
  users: 0,
  vendors: 0,
  stores: 0,
  products: 0,
  orders: 0,
  activeOrders: 0,
  onlineCaptains: 0,
  openTickets: 0,
};

const VENDOR_ROLES = [
  'restaurant_vendor',
  'supermarket_vendor',
  'fashion_vendor',
  'vendor',
  'electronics_vendor',
  'jewelry_vendor',
  'beauty_vendor',
  'car_dealer',
  'umrah_agency',
];

export default function AdminControlCenter({ onNavigate }: Props) {
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
        vendors,
        stores,
        products,
        orders,
        activeOrders,
        onlineCaptains,
        openTickets,
      ] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).in('role', VENDOR_ROLES),
        supabase.from('stores').select('id', { count: 'exact', head: true }),
        supabase.from('products').select('id', { count: 'exact', head: true }),
        supabase.from('orders').select('id', { count: 'exact', head: true }),
        supabase.from('orders').select('id', { count: 'exact', head: true }).not('status', 'in', '("delivered","cancelled")'),
        supabase.from('captains').select('user_id', { count: 'exact', head: true }).eq('is_online', true),
        supabase.from('support_tickets').select('id', { count: 'exact', head: true }).in('status', ['open', 'in_progress']),
      ]);

      const firstError = [
        users,
        vendors,
        stores,
        products,
        orders,
        activeOrders,
        onlineCaptains,
        openTickets,
      ].find((result) => result.error)?.error;

      if (firstError) throw firstError;

      setMetrics({
        users: users.count ?? 0,
        vendors: vendors.count ?? 0,
        stores: stores.count ?? 0,
        products: products.count ?? 0,
        orders: orders.count ?? 0,
        activeOrders: activeOrders.count ?? 0,
        onlineCaptains: onlineCaptains.count ?? 0,
        openTickets: openTickets.count ?? 0,
      });
      setSyncedAt(new Date());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'نەتوانرا داتای ناوەندی بەڕێوبەر وەرگیرێت.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel('shakh-admin-control-center')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stores' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'captains' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, () => void load())
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);

  const statCards = useMemo(() => [
    { label: 'بەکارهێنەرەکان', value: metrics.users, icon: Users, tone: 'orange' },
    { label: 'فرۆشیار و دامەزراوە', value: metrics.vendors, icon: Store, tone: 'blue' },
    { label: 'دوکانەکان', value: metrics.stores, icon: Store, tone: 'green' },
    { label: 'بەرهەمەکان', value: metrics.products, icon: Package, tone: 'violet' },
    { label: 'هەموو ئۆردەرەکان', value: metrics.orders, icon: ClipboardList, tone: 'slate' },
    { label: 'ئۆردەری چالاک', value: metrics.activeOrders, icon: Activity, tone: 'amber' },
    { label: 'کاپتنی ئۆنلاین', value: metrics.onlineCaptains, icon: Truck, tone: 'teal' },
    { label: 'تیکەتی کراوە', value: metrics.openTickets, icon: LifeBuoy, tone: 'rose' },
  ], [metrics]);

  return (
    <section className="shakhAdminCenter" aria-labelledby="admin-center-title">
      <div className="shakhAdminHero">
        <div className="shakhAdminHeroCopy">
          <span className="shakhAdminEyebrow"><ShieldCheck size={15} /> ناوەندی بەڕێوبەر</span>
          <h2 id="admin-center-title">SHAKH Admin Center</h2>
          <p>پوختەی ڕاستەقینەی بەڕێوبەرایەتی بۆ ئۆردەر، بازاڕ، کاپتن و پشتگیری؛ بەبێ داتای ساختە.</p>
        </div>
        <button type="button" className="shakhAdminRefresh" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={17} className={loading ? 'is-spinning' : ''} />
          نوێکردنەوە
        </button>
      </div>

      {message && <div className="msg" role="alert">{message}</div>}

      <div className="shakhAdminStats">
        {statCards.map(({ label, value, icon: Icon, tone }) => (
          <article className="shakhAdminStat" data-tone={tone} key={label}>
            <span className="shakhAdminStatIcon"><Icon size={19} /></span>
            <div>
              <small>{label}</small>
              <strong>{value.toLocaleString('ku-IQ')}</strong>
            </div>
          </article>
        ))}
      </div>

      <div className="shakhAdminWorkspace">
        <div className="shakhAdminWorkspaceHead">
          <div>
            <span>دەستگەیشتنی خێرا</span>
            <h3>ئامرازەکانی بەڕێوبەر</h3>
          </div>
          <small>{syncedAt ? 'دوایین sync: ' + syncedAt.toLocaleTimeString('ku-IQ') : 'sync دەکرێت...'}</small>
        </div>

        <div className="shakhAdminActionGrid">
          <button type="button" onClick={() => onNavigate('orders')}>
            <ClipboardList />
            <span><b>ناوەندی ئۆردەر</b><small>{metrics.activeOrders.toLocaleString('ku-IQ')} چالاک</small></span>
          </button>
          <button type="button" onClick={() => onNavigate('delivery')}>
            <Truck />
            <span><b>چاودێری گەیاندن</b><small>ئۆردەر و کاپتن</small></span>
          </button>
          <button type="button" onClick={() => onNavigate('delivery_zones')}>
            <MapPinned />
            <span><b>سنوری گەیاندن</b><small>گشتی و دوکان</small></span>
          </button>
          <button type="button" onClick={() => onNavigate('cars')}>
            <Car />
            <span><b>SHAKH Cars</b><small>پێشانگا و پۆست</small></span>
          </button>
          <button type="button" onClick={() => onNavigate('umrah')}>
            <Plane />
            <span><b>حەج و عومرە</b><small>پەکەج و حجز</small></span>
          </button>
          <button type="button" onClick={() => onNavigate('support')}>
            <LifeBuoy />
            <span><b>پشتگیری</b><small>{metrics.openTickets.toLocaleString('ku-IQ')} تیکەتی کراوە</small></span>
          </button>
          <button type="button" onClick={() => onNavigate('notifications')}>
            <Bell />
            <span><b>ئاگادارکردنەوەکان</b><small>چاودێری ئاگادارییەکان</small></span>
          </button>
          <button type="button" onClick={() => onNavigate('settings')}>
            <Settings2 />
            <span><b>ڕێکخستنەکان</b><small>هەژمار و پلاتفۆرم</small></span>
          </button>
        </div>
      </div>
    </section>
  );
}
