import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bell,
  ClipboardList,
  MapPinned,
  Package,
  PackageCheck,
  RefreshCw,
  Settings2,
  ShoppingBag,
  Store,
  UserRound,
  WalletCards,
  LifeBuoy,
  FileText,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { DashboardView } from './DashboardShell';

type Props = { userId: string; onNavigate: (view: DashboardView) => void };
type Metrics = {
  stores: number;
  activeStores: number;
  products: number;
  lowStock: number;
  outOfStock: number;
  pendingOrders: number;
  activeOrders: number;
  salesToday: number;
  unreadNotifications: number;
};
const initial: Metrics = {
  stores: 0,
  activeStores: 0,
  products: 0,
  lowStock: 0,
  outOfStock: 0,
  pendingOrders: 0,
  activeOrders: 0,
  salesToday: 0,
  unreadNotifications: 0,
};
const money = (v: number) => Number(v || 0).toLocaleString('ku-IQ') + ' د.ع';

export default function VendorControlCenter({ userId, onNavigate }: Props) {
  const [metrics, setMetrics] = useState<Metrics>(initial);
  const [storeName, setStoreName] = useState('دوکانی من');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setMessage('');
    try {
      const { data: stores, error: storeError } = await supabase
        .from('stores')
        .select('id,name,is_active')
        .eq('owner_id', userId)
        .eq('category', 'daily');

      if (storeError) throw storeError;

      const rows = (stores || []) as { id: string; name?: string | null; is_active?: boolean | null }[];
      const storeIds = rows.map((store) => store.id);
      setStoreName(rows.find((store) => store.is_active)?.name || rows[0]?.name || 'دوکانی من');

      if (!storeIds.length) {
        const { count: unreadNotifications, error: notificationError } = await supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('is_read', false);
        if (notificationError) throw notificationError;

        setMetrics({
          ...initial,
          stores: 0,
          activeStores: 0,
          unreadNotifications: unreadNotifications || 0,
        });
        setSyncedAt(new Date());
        return;
      }

      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);

      const [products, productRows, pendingOrders, activeOrders, todaySales, notifications] = await Promise.all([
        supabase.from('products').select('id', { count: 'exact', head: true }).in('store_id', storeIds),
        supabase.from('products').select('stock,unlimited_stock,variants').in('store_id', storeIds),
        supabase.from('orders').select('id', { count: 'exact', head: true }).in('store_id', storeIds).eq('status', 'pending'),
        supabase.from('orders').select('id', { count: 'exact', head: true }).in('store_id', storeIds).not('status', 'in', '("delivered","cancelled")'),
        supabase.from('orders').select('subtotal_iqd').in('store_id', storeIds).eq('status', 'delivered').gte('created_at', start.toISOString()).lt('created_at', end.toISOString()),
        supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('is_read', false),
      ]);

      const results = [products, productRows, pendingOrders, activeOrders, todaySales, notifications];
      const firstError = results.find((result) => result.error)?.error;
      if (firstError) throw firstError;

      const productData = (productRows.data || []) as { stock?: number | null; unlimited_stock?: boolean | null; variants?: unknown }[];
      let lowStock = 0;
      let outOfStock = 0;
      for (const product of productData) {
        const rowsFromVariants = Array.isArray(product.variants)
          ? product.variants.flatMap((variant: any) => Array.isArray(variant?.variant_inventory) ? variant.variant_inventory : [])
          : [];
        const hasUnlimited = Boolean(product.unlimited_stock) || rowsFromVariants.some((row: any) => row?.unlimited_stock === true);
        const totalStock = rowsFromVariants.length
          ? rowsFromVariants.reduce((sum: number, row: any) => sum + (row?.unlimited_stock ? 0 : Math.max(0, Number(row?.stock || 0))), 0)
          : Math.max(0, Number(product.stock || 0));

        if (hasUnlimited) continue;
        if (totalStock <= 0) outOfStock += 1;
        else if (totalStock <= 5) lowStock += 1;
      }

      const salesToday = (todaySales.data || []).reduce(
        (sum: number, row: { subtotal_iqd?: number | string | null }) => sum + Number(row.subtotal_iqd || 0),
        0,
      );

      setMetrics({
        stores: rows.length,
        activeStores: rows.filter((store) => store.is_active !== false).length,
        products: products.count || 0,
        lowStock,
        outOfStock,
        pendingOrders: pendingOrders.count || 0,
        activeOrders: activeOrders.count || 0,
        salesToday,
        unreadNotifications: notifications.count || 0,
      });
      setSyncedAt(new Date());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'نەتوانرا پوختەی خاوەن دوکان وەرگیرێت.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel('shakh-vendor-control-center-' + userId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stores', filter: 'owner_id=eq.' + userId }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: 'user_id=eq.' + userId }, () => void load())
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [load, userId]);

  const cards = useMemo(() => [
    { label: 'بەرهەمەکان', value: metrics.products, icon: Package, tone: 'orange' },
    { label: 'ئۆردەری چاوەڕوان', value: metrics.pendingOrders, icon: ClipboardList, tone: 'blue' },
    { label: 'ئۆردەری چالاک', value: metrics.activeOrders, icon: PackageCheck, tone: 'green' },
    { label: 'فرۆشی ئەمڕۆ', value: money(metrics.salesToday), icon: WalletCards, tone: 'violet', money: true },
    { label: 'کەم‌ستۆک', value: metrics.lowStock, icon: ShoppingBag, tone: 'amber' },
    { label: 'بێ‌ستۆک', value: metrics.outOfStock, icon: Package, tone: 'rose' },
    { label: 'دوکانە چالاکەکان', value: metrics.activeStores + '/' + metrics.stores, icon: Store, tone: 'teal' },
    { label: 'ئاگاداریی نوێ', value: metrics.unreadNotifications, icon: Bell, tone: 'slate' },
  ], [metrics]);

  return <section className="shakhVendorCenter" aria-labelledby="vendor-center-title">
    <div className="shakhVendorHero">
      <div className="shakhVendorHeroCopy">
        <span className="shakhVendorEyebrow"><Store size={15} /> ناوەندی خاوەن دوکان</span>
        <h2 id="vendor-center-title">SHAKH Vendor Center</h2>
        <p>{storeName} — بەڕێوەبردنی بەرهەم، ستۆک، ئۆردەر و فرۆش لە یەک شوێن.</p>
      </div>
      <button type="button" className="shakhVendorRefresh" onClick={() => void load()} disabled={loading}>
        <RefreshCw size={17} className={loading ? 'is-spinning' : ''} />
        نوێکردنەوە
      </button>
    </div>

    {message && <div className="msg" role="alert">{message}</div>}

    <div className="shakhVendorStats">
      {cards.map(({ label, value, icon: Icon, tone, money: isMoney }) => (
        <article className="shakhVendorStat" data-tone={tone} key={label}>
          <span className="shakhVendorStatIcon"><Icon size={19} /></span>
          <div>
            <small>{label}</small>
            <strong className={isMoney ? 'is-money' : ''}>{typeof value === 'number' ? value.toLocaleString('ku-IQ') : value}</strong>
          </div>
        </article>
      ))}
    </div>

    <div className="shakhVendorWorkspace">
      <div className="shakhVendorWorkspaceHead">
        <div><span>دەستگەیشتنی خێرا</span><h3>کارە سەرەکییەکانی دوکان</h3></div>
        <small>{syncedAt ? 'دوایین sync: ' + syncedAt.toLocaleTimeString('ku-IQ') : 'sync دەکرێت...'}</small>
      </div>

      <div className="shakhVendorActionGrid">
        <button type="button" onClick={() => onNavigate('orders')}><ClipboardList /><span><b>ئۆردەرەکان</b><small>{metrics.pendingOrders.toLocaleString('ku-IQ')} چاوەڕوان</small></span></button>
        <button type="button" onClick={() => onNavigate('store')}><ShoppingBag /><span><b>بەرهەم و ستۆک</b><small>{metrics.products.toLocaleString('ku-IQ')} بەرهەم</small></span></button>
        <button type="button" onClick={() => onNavigate('delivery_zones')}><MapPinned /><span><b>سنوری گەیاندن</b><small>ناوچە و نرخی گەیاندن</small></span></button>
        <button type="button" onClick={() => onNavigate('manage_posts')}><FileText /><span><b>پۆستەکانم</b><small>دەستکاری و بەڕێوەبردن</small></span></button>
        <button type="button" onClick={() => onNavigate('wallet')}><WalletCards /><span><b>جزدان</b><small>باڵانس و مامەڵەکان</small></span></button>
        <button type="button" onClick={() => onNavigate('notifications')}><Bell /><span><b>ئاگادارییەکان</b><small>{metrics.unreadNotifications.toLocaleString('ku-IQ')} نوێ</small></span></button>
        <button type="button" onClick={() => onNavigate('profile')}><UserRound /><span><b>پرۆفایل</b><small>زانیاری هەژمار و دوکان</small></span></button>
        <button type="button" onClick={() => onNavigate('support')}><LifeBuoy /><span><b>پشتگیری</b><small>تیکەت و یارمەتی</small></span></button>
        <button type="button" onClick={() => onNavigate('settings')}><Settings2 /><span><b>ڕێکخستنەکان</b><small>ئاگاداری و هەژمار</small></span></button>
      </div>
    </div>
  </section>;
}
