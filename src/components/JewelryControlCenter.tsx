import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bell, ClipboardList, FileText, LifeBuoy, Package, PackageCheck, RefreshCw,
  Gem, Store, Settings2, UserRound, WalletCards, Watch, CircleDollarSign,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { DashboardView } from './DashboardShell';

type Props = { userId: string; onNavigate: (view: DashboardView) => void };
type ProductRow = {
  stock?: number | null; unlimited_stock?: boolean | null; variants?: unknown;
  brand?: string | null; category?: string | null;
};
type Metrics = {
  stores: number; activeStores: number; products: number; brandedProducts: number; variantProducts: number;
  gold: number; silver: number; watches: number; accessories: number;
  lowStock: number; outOfStock: number; pendingOrders: number; activeOrders: number;
  salesToday: number; unreadNotifications: number;
};
const initial: Metrics = {
  stores: 0, activeStores: 0, products: 0, brandedProducts: 0, variantProducts: 0,
  gold: 0, silver: 0, watches: 0, accessories: 0, lowStock: 0, outOfStock: 0,
  pendingOrders: 0, activeOrders: 0, salesToday: 0, unreadNotifications: 0
};
const money = (v: number) => Number(v || 0).toLocaleString('ku-IQ') + ' د.ع';

function inventoryInfo(product: ProductRow) {
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const inventoryRows = variants.flatMap((variant: any) =>
    Array.isArray(variant?.variant_inventory) ? variant.variant_inventory : []
  );
  const unlimited = Boolean(product.unlimited_stock) || inventoryRows.some((row: any) => row?.unlimited_stock === true);
  const stock = inventoryRows.length
    ? inventoryRows.reduce((sum: number, row: any) =>
      sum + (row?.unlimited_stock ? 0 : Math.max(0, Number(row?.stock || 0))), 0)
    : Math.max(0, Number(product.stock || 0));
  const hasVariants = variants.some((variant: any) =>
    variant?.size || variant?.sizes?.length || variant?.color || variant?.colors?.length ||
    variant?.variant_inventory?.length
  );
  return { unlimited, stock, hasVariants };
}

export default function JewelryControlCenter({ userId, onNavigate }: Props) {
  const [metrics, setMetrics] = useState<Metrics>(initial);
  const [storeName, setStoreName] = useState('دوکانی جواکارییەکەم');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true); setMessage('');
    try {
      const { data: stores, error: storeError } = await supabase
        .from('stores').select('id,name,is_active').eq('owner_id', userId).eq('category', 'jewelry');
      if (storeError) throw storeError;

      const storeRows = (stores || []) as { id: string; name?: string | null; is_active?: boolean | null }[];
      const storeIds = storeRows.map((store) => store.id);
      setStoreName(storeRows.find((store) => store.is_active)?.name || storeRows[0]?.name || 'دوکانی جواکارییەکەم');

      const start = new Date(); start.setHours(0, 0, 0, 0);
      const end = new Date(start); end.setDate(end.getDate() + 1);

      const notificationResultPromise = supabase
        .from('notifications').select('id', { count: 'exact', head: true })
        .eq('user_id', userId).eq('is_read', false);

      if (!storeIds.length) {
        const notificationResult = await notificationResultPromise;
        if (notificationResult.error) throw notificationResult.error;
        setMetrics({ ...initial, unreadNotifications: notificationResult.count || 0 });
        setSyncedAt(new Date());
        return;
      }

      const [products, productRows, pendingOrders, activeOrders, todaySales] = await Promise.all([
        supabase.from('products').select('id', { count: 'exact', head: true }).in('store_id', storeIds),
        supabase.from('products').select('stock,unlimited_stock,variants,brand,category').in('store_id', storeIds),
        supabase.from('orders').select('id', { count: 'exact', head: true }).in('store_id', storeIds).eq('status', 'pending'),
        supabase.from('orders').select('id', { count: 'exact', head: true }).in('store_id', storeIds).not('status', 'in', '("delivered","cancelled")'),
        supabase.from('orders').select('subtotal_iqd').in('store_id', storeIds).eq('status', 'delivered').gte('created_at', start.toISOString()).lt('created_at', end.toISOString()),
      ]);
      const notifications = await notificationResultPromise;
      const firstError = [products, productRows, pendingOrders, activeOrders, todaySales, notifications]
        .find((result) => result.error)?.error;
      if (firstError) throw firstError;

      let lowStock = 0, outOfStock = 0, brandedProducts = 0, variantProducts = 0;
      let gold = 0, silver = 0, watches = 0, accessories = 0;
      for (const product of (productRows.data || []) as ProductRow[]) {
        if (product.brand?.trim()) brandedProducts += 1;
        const inv = inventoryInfo(product);
        if (inv.hasVariants) variantProducts += 1;
        if (!inv.unlimited) {
          if (inv.stock <= 0) outOfStock += 1;
          else if (inv.stock <= 5) lowStock += 1;
        }
        if (product.category === 'jewelry_gold') gold += 1;
        else if (product.category === 'jewelry_silver') silver += 1;
        else if (product.category === 'jewelry_watches') watches += 1;
        else if (product.category === 'jewelry_accessories') accessories += 1;
      }

      const salesToday = (todaySales.data || []).reduce(
        (sum: number, row: { subtotal_iqd?: number | string | null }) => sum + Number(row.subtotal_iqd || 0), 0
      );

      setMetrics({
        stores: storeRows.length,
        activeStores: storeRows.filter((store) => store.is_active !== false).length,
        products: products.count || 0,
        brandedProducts, variantProducts, gold, silver, watches, accessories,
        lowStock, outOfStock,
        pendingOrders: pendingOrders.count || 0,
        activeOrders: activeOrders.count || 0,
        salesToday,
        unreadNotifications: notifications.count || 0,
      });
      setSyncedAt(new Date());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'نەتوانرا پوختەی دوکانی جواهرات وەرگیرێت.');
    } finally { setLoading(false); }
  }, [userId]);

  useEffect(() => {
    void load();
    const channel = supabase.channel('shakh-jewelry-control-center-' + userId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stores', filter: 'owner_id=eq.' + userId }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: 'user_id=eq.' + userId }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load, userId]);

  const cards = useMemo(() => [
    { label: 'بەرهەمەکانی جواهرات', value: metrics.products, icon: Gem, tone: 'orange' },
    { label: 'زێڕ', value: metrics.gold, icon: CircleDollarSign, tone: 'gold' },
    { label: 'زیو', value: metrics.silver, icon: Gem, tone: 'slate' },
    { label: 'کاتژمێر', value: metrics.watches, icon: Watch, tone: 'blue' },
    { label: 'ئەکسسوارات', value: metrics.accessories, icon: Gem, tone: 'violet' },
    { label: 'بەرهەمی جۆردار', value: metrics.variantProducts, icon: Package, tone: 'teal' },
    { label: 'ئۆردەری چاوەڕوان', value: metrics.pendingOrders, icon: ClipboardList, tone: 'blue2' },
    { label: 'ئۆردەری چالاک', value: metrics.activeOrders, icon: PackageCheck, tone: 'green' },
    { label: 'فرۆشی ئەمڕۆ', value: money(metrics.salesToday), icon: WalletCards, tone: 'violet2', money: true },
    { label: 'کەم‌ستۆک', value: metrics.lowStock, icon: Package, tone: 'amber' },
    { label: 'بێ‌ستۆک', value: metrics.outOfStock, icon: ShoppingBagIcon, tone: 'rose' },
    { label: 'براندەکان', value: metrics.brandedProducts, icon: Store, tone: 'teal2' },
  ], [metrics]);

  return <section className="shakhJewelryCenter" aria-labelledby="jewelry-center-title" dir="rtl">
    <div className="shakhJewelryHero">
      <div className="shakhJewelryHeroCopy">
        <span className="shakhJewelryEyebrow"><Gem size={15} /> ناوەندی جواهرات</span>
        <h2 id="jewelry-center-title">SHAKH Jewelry Center</h2>
        <p>{storeName} — بەڕێوەبردنی زێڕ، زیو، کاتژمێر، ئەکسسوارات، variant و ئۆردەر لە یەک شوێن.</p>
      </div>
      <button type="button" className="shakhJewelryRefresh" onClick={() => void load()} disabled={loading}>
        <RefreshCw size={17} className={loading ? 'is-spinning' : ''} /> نوێکردنەوە
      </button>
    </div>
    {message && <div className="msg" role="alert">{message}</div>}
    <div className="shakhJewelryStats">
      {cards.map(({ label, value, icon: Icon, tone, money: isMoney }) => (
        <article className="shakhJewelryStat" data-tone={tone} key={label}>
          <span className="shakhJewelryStatIcon"><Icon size={19} /></span>
          <div><small>{label}</small><strong className={isMoney ? 'is-money' : ''}>{typeof value === 'number' ? value.toLocaleString('ku-IQ') : value}</strong></div>
        </article>
      ))}
    </div>
    <div className="shakhJewelryWorkspace">
      <div className="shakhJewelryWorkspaceHead">
        <div><span>دەستگەیشتنی خێرا</span><h3>کارە سەرەکییەکانی جواهرات</h3></div>
        <small>{syncedAt ? 'دوایین sync: ' + syncedAt.toLocaleTimeString('ku-IQ') : 'sync دەکرێت...'}</small>
      </div>
      <div className="shakhJewelryActionGrid">
        <button type="button" onClick={() => onNavigate('orders')}><ClipboardList /><span><b>ئۆردەرەکان</b><small>{metrics.pendingOrders.toLocaleString('ku-IQ')} چاوەڕوان</small></span></button>
        <button type="button" onClick={() => onNavigate('store')}><Gem /><span><b>بەرهەم و variant</b><small>{metrics.products.toLocaleString('ku-IQ')} بەرهەم</small></span></button>
        <button type="button" onClick={() => onNavigate('delivery_zones')}><Store /><span><b>سنوری گەیاندن</b><small>ناوچە و نرخی گەیاندن</small></span></button>
        <button type="button" onClick={() => onNavigate('manage_posts')}><FileText /><span><b>پۆستەکانی جواهرات</b><small>بڵاوکردنەوە و بەڕێوەبردن</small></span></button>
        <button type="button" onClick={() => onNavigate('wallet')}><WalletCards /><span><b>جزدان</b><small>باڵانس و مامەڵەکان</small></span></button>
        <button type="button" onClick={() => onNavigate('notifications')}><Bell /><span><b>ئاگادارییەکان</b><small>{metrics.unreadNotifications.toLocaleString('ku-IQ')} نوێ</small></span></button>
        <button type="button" onClick={() => onNavigate('profile')}><UserRound /><span><b>پرۆفایل</b><small>هەژمار و زانیاریی دوکان</small></span></button>
        <button type="button" onClick={() => onNavigate('support')}><LifeBuoy /><span><b>پشتگیری</b><small>تیکەت و یارمەتی</small></span></button>
        <button type="button" onClick={() => onNavigate('settings')}><Settings2 /><span><b>ڕێکخستنەکان</b><small>ئاگاداری و هەژمار</small></span></button>
      </div>
    </div>
  </section>;
}

function ShoppingBagIcon(props: { size?: number }) {
  return <Package size={props.size || 19} />;
}
