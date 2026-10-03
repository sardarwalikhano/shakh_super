import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, Bell, Car, CheckCircle2, ClipboardList, Clock3, LifeBuoy, MapPinned, Package,
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

type RecentOrder = {
  id: string;
  status: string;
  total_iqd: number | null;
  created_at: string;
};

type TrendPoint = {
  key: string;
  label: string;
  count: number;
  revenue: number;
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'چاوەڕوان',
  accepted: 'قبوڵکراو',
  preparing: 'لە ئامادەکردندایە',
  ready_for_pickup: 'ئامادەی وەرگرتن',
  assigned_to_captain: 'کاپتن دیاریکراوە',
  picked_up: 'وەرگیراوە',
  on_the_way: 'لە ڕێگادایە',
  delivered: 'گەیەندراوە',
  cancelled: 'هەڵوەشێنراوەتەوە',
};

const makeTrend = (rows: RecentOrder[]): TrendPoint[] => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    return {
      key: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
      label: date.toLocaleDateString('ku-IQ', { weekday: 'short' }),
      count: 0,
      revenue: 0,
    };
  });
  const map = new Map(days.map((day) => [day.key, day]));
  rows.forEach((row) => {
    const date = new Date(row.created_at);
    const point = map.get(`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`);
    if (!point) return;
    point.count += 1;
    point.revenue += Number(row.total_iqd ?? 0);
  });
  return days;
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
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [trendRows, setTrendRows] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState('CONNECTING');

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const since = new Date();
      since.setHours(0, 0, 0, 0);
      since.setDate(since.getDate() - 6);
      const [
        users,
        vendors,
        stores,
        products,
        orders,
        activeOrders,
        onlineCaptains,
        openTickets,
        recentOrders,
      ] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).in('role', VENDOR_ROLES),
        supabase.from('stores').select('id', { count: 'exact', head: true }),
        supabase.from('products').select('id', { count: 'exact', head: true }),
        supabase.from('orders').select('id', { count: 'exact', head: true }),
        supabase.from('orders').select('id', { count: 'exact', head: true }).not('status', 'in', '("delivered","cancelled")'),
        supabase.from('captains').select('user_id', { count: 'exact', head: true }).eq('is_online', true),
        supabase.from('support_tickets').select('id', { count: 'exact', head: true }).in('status', ['open', 'in_progress']),
        supabase.from('orders').select('id,status,total_iqd,created_at').gte('created_at', since.toISOString()).order('created_at', { ascending: false }).limit(200),
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
        recentOrders,
      ].find((result) => result && 'error' in result && result.error)?.error;

      if (firstError) throw firstError;

      const rows = (recentOrders.data ?? []) as RecentOrder[];
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
      setRecentOrders(rows.slice(0, 8));
      setTrendRows(makeTrend(rows));
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => void load())
      .subscribe((status) => setRealtimeStatus(status));

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);

  const trendMax = Math.max(1, ...trendRows.map((point) => point.count));
  const trendOrderCount = trendRows.reduce((sum, point) => sum + point.count, 0);
  const trendRevenue = trendRows.reduce((sum, point) => sum + point.revenue, 0);
  const realtimeReady = realtimeStatus === 'SUBSCRIBED';

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
        <div className="shakhAdminHeroActions">
          <span className={'shakhAdminLiveStatus ' + (realtimeReady ? 'is-live' : 'is-warn')} role="status" aria-live="polite">
            {realtimeReady ? <CheckCircle2 size={13} /> : <Clock3 size={13} />}
            {realtimeReady ? 'Realtime چالاکە' : 'Realtime پەیوەندی دەکات'}
          </span>
          <button type="button" className="shakhAdminRefresh" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={17} className={loading ? 'is-spinning' : ''} />
            نوێکردنەوە
          </button>
        </div>
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

      <section className="shakhAdminTrendPanel" aria-labelledby="admin-trend-title">
        <div className="shakhAdminPanelHead">
          <div>
            <span>٧ ڕۆژی ڕابردوو</span>
            <h3 id="admin-trend-title">هەستی ئۆردەر</h3>
          </div>
          <div className="shakhAdminTrendSummary">
            <strong>{loading ? '—' : trendOrderCount.toLocaleString('ku-IQ')}</strong>
            <small>{loading ? '—' : trendRevenue.toLocaleString('ku-IQ') + ' د.ع'}</small>
          </div>
        </div>
        {loading ? (
          <div className="shakhAdminTrendSkeleton" aria-label="هەستی ئۆردەر بار دەکرێت">
            {Array.from({ length: 7 }, (_, index) => <span key={index} />)}
          </div>
        ) : trendOrderCount === 0 ? (
          <div className="shakhAdminEmpty">لەم ٧ ڕۆژەی ڕابردوودا هیچ ئۆردەرێکی نوێ تۆمار نەکراوە.</div>
        ) : (
          <div className="shakhAdminTrendBars">
            {trendRows.map((point) => (
              <div className="shakhAdminTrendBarItem" key={point.key} title={point.count.toLocaleString('ku-IQ') + ' ئۆردەر · ' + point.revenue.toLocaleString('ku-IQ') + ' د.ع'}>
                <div className="shakhAdminTrendBarTrack"><span style={{ height: Math.max(point.count ? 12 : 4, (point.count / trendMax) * 100) + '%' }} /></div>
                <strong>{point.count.toLocaleString('ku-IQ')}</strong>
                <small>{point.label}</small>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="shakhAdminRecentPanel" aria-labelledby="admin-recent-title">
        <div className="shakhAdminPanelHead">
          <div><span>Live operational feed</span><h3 id="admin-recent-title">نوێترین ئۆردەرەکان</h3></div>
          <button type="button" className="shakhAdminTextAction" onClick={() => onNavigate('orders')}>بینینی هەموو ←</button>
        </div>
        {loading ? (
          <div className="shakhAdminRecentSkeleton" aria-label="ئۆردەرەکان بار دەکرێن">{Array.from({ length: 5 }, (_, index) => <span key={index} />)}</div>
        ) : recentOrders.length === 0 ? (
          <div className="shakhAdminEmpty">هێشتا هیچ ئۆردەرێکی نوێ نییە.</div>
        ) : (
          <div className="shakhAdminRecentList">
            {recentOrders.map((order) => (
              <button type="button" className="shakhAdminRecentRow" key={order.id} onClick={() => onNavigate('orders')}>
                <span><strong>#{order.id.slice(0, 8)}</strong><small>{new Date(order.created_at).toLocaleString('ku-IQ')}</small></span>
                <em>{STATUS_LABEL[order.status] || order.status}</em>
                <b>{Number(order.total_iqd || 0).toLocaleString('ku-IQ')} د.ع</b>
              </button>
            ))}
          </div>
        )}
      </section>

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
