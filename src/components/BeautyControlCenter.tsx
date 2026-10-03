import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bell, ClipboardList, FileText, LifeBuoy, Package, PackageCheck, RefreshCw,
  Sparkles, Store, Settings2, UserRound, WalletCards, Heart,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { DashboardView } from './DashboardShell';

type Props = { userId: string; onNavigate: (view: DashboardView) => void };
type ProductRow = { stock?: number | null; unlimited_stock?: boolean | null; variants?: unknown; brand?: string | null; category?: string | null };
type Metrics = {
  stores: number; activeStores: number; products: number; brandedProducts: number;
  cosmetics: number; skincare: number; haircare: number; fragrance: number; accessories: number;
  lowStock: number; outOfStock: number; pendingOrders: number; activeOrders: number;
  salesToday: number; unreadNotifications: number;
};
const initial: Metrics = {
  stores: 0, activeStores: 0, products: 0, brandedProducts: 0,
  cosmetics: 0, skincare: 0, haircare: 0, fragrance: 0, accessories: 0,
  lowStock: 0, outOfStock: 0, pendingOrders: 0, activeOrders: 0,
  salesToday: 0, unreadNotifications: 0
};
const money = (v: number) => Number(v || 0).toLocaleString('ku-IQ') + ' د.ع';

function inventoryInfo(product: ProductRow) {
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const rows = variants.flatMap((variant: any) =>
    Array.isArray(variant?.variant_inventory) ? variant.variant_inventory : []
  );
  const unlimited = Boolean(product.unlimited_stock) || rows.some((row: any) => row?.unlimited_stock === true);
  const stock = rows.length
    ? rows.reduce((sum: number, row: any) => sum + (row?.unlimited_stock ? 0 : Math.max(0, Number(row?.stock || 0))), 0)
    : Math.max(0, Number(product.stock || 0));
  return { unlimited, stock };
}

export default function BeautyControlCenter({ userId, onNavigate }: Props) {
  const [metrics, setMetrics] = useState<Metrics>(initial);
  const [storeName, setStoreName] = useState('دوکانی جوانکاریم');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true); setMessage('');
    try {
      const { data: stores, error: storeError } = await supabase
        .from('stores').select('id,name,is_active').eq('owner_id', userId).eq('category', 'beauty');
      if (storeError) throw storeError;

      const storeRows = (stores || []) as { id: string; name?: string | null; is_active?: boolean | null }[];
      const storeIds = storeRows.map((store) => store.id);
      setStoreName(storeRows.find((store) => store.is_active)?.name || storeRows[0]?.name || 'دوکانی جوانکاریم');

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

      let lowStock = 0, outOfStock = 0, brandedProducts = 0;
      let cosmetics = 0, skincare = 0, haircare = 0, fragrance = 0, accessories = 0;
      for (const product of (productRows.data || []) as ProductRow[]) {
        if (product.brand?.trim()) brandedProducts += 1;
        const inv = inventoryInfo(product);
        if (!inv.unlimited) {
          if (inv.stock <= 0) outOfStock += 1;
          else if (inv.stock <= 5) lowStock += 1;
        }
        if (product.category === 'beauty_cosmetics') cosmetics += 1;
        else if (product.category === 'beauty_skincare') skincare += 1;
        else if (product.category === 'beauty_haircare') haircare += 1;
        else if (product.category === 'beauty_fragrance') fragrance += 1;
        else if (product.category === 'beauty_accessories') accessories += 1;
      }

      const salesToday = (todaySales.data || []).reduce(
        (sum: number, row: { subtotal_iqd?: number | string | null }) => sum + Number(row.subtotal_iqd || 0), 0
      );

      setMetrics({
        stores: storeRows.length,
        activeStores: storeRows.filter((store) => store.is_active !== false).length,
        products: products.count || 0, brandedProducts,
        cosmetics, skincare, haircare, fragrance, accessories,
        lowStock, outOfStock,
        pendingOrders: pendingOrders.count || 0,
        activeOrders: activeOrders.count || 0,
        salesToday,
        unreadNotifications: notifications.count || 0,
      });
      setSyncedAt(new Date());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'نەتوانرا پوختەی جوانکاری وەرگیرێت.');
    } finally { setLoading(false); }
  }, [userId]);

  useEffect(() => {
    void load();
    const channel = supabase.channel('shakh-beauty-control-center-' + userId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stores', filter: 'owner_id=eq.' + userId }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: 'user_id=eq.' + userId }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load, userId]);

  const cards = useMemo(() => [
    { label: 'بەرهەمەکانی جوانکاری', value: metrics.products, icon: Sparkles, tone: 'orange' },
    { label: 'کۆسمەتیک', value: metrics.cosmetics, icon: Sparkles, tone: 'violet' },
    { label: 'چاودێری پێست', value: metrics.skincare, icon: Heart, tone: 'rose' },
    { label: 'چاودێری قژ', value: metrics.haircare, icon: Sparkles, tone: 'teal' },
    { label: 'بۆن و عەتری', value: metrics.fragrance, icon: Sparkles, tone: 'gold' },
    { label: 'ئەکسسوارات', value: metrics.accessories, icon: Sparkles, tone: 'blue' },
    { label: 'ئۆردەری چاوەڕوان', value: metrics.pendingOrders, icon: ClipboardList, tone: 'blue2' },
    { label: 'ئۆردەری چالاک', value: metrics.activeOrders, icon: PackageCheck, tone: 'green' },
    { label: 'فرۆشی ئەمڕۆ', value: money(metrics.salesToday), icon: WalletCards, tone: 'violet2', money: true },
    { label: 'کەم‌ستۆک', value: metrics.lowStock, icon: Package, tone: 'amber' },
    { label: 'بێ‌ستۆک', value: metrics.outOfStock, icon: Package, tone: 'rose2' },
    { label: 'براندەکان', value: metrics.brandedProducts, icon: Store, tone: 'teal2' },
  ], [metrics]);

  return <section className="shakhBeautyCenter" aria-labelledby="beauty-center-title" dir="rtl">
    <div className="shakhBeautyHero">
      <div className="shakhBeautyHeroCopy">
        <span className="shakhBeautyEyebrow"><Sparkles size={15} /> ناوەندی جوانکاری</span>
        <h2 id="beauty-center-title">SHAKH Beauty Center</h2>
        <p>{storeName} — بەڕێوەبردنی کۆسمەتیک، پێست، قژ، بۆن و ئەکسسوارات، ستۆک و ئۆردەر لە یەک شوێن.</p>
      </div>
      <button type="button" className="shakhBeautyRefresh" onClick={() => void load()} disabled={loading}>
        <RefreshCw size={17} className={loading ? 'is-spinning' : ''} /> نوێکردنەوە
      </button>
    </div>
    {message && <div className="msg" role="alert">{message}</div>}
    <div className="shakhBeautyStats">
      {cards.map(({ label, value, icon: Icon, tone, money: isMoney }) => (
        <article className="shakhBeautyStat" data-tone={tone} key={label}>
          <span className="shakhBeautyStatIcon"><Icon size={19} /></span>
          <div><small>{label}</small><strong className={isMoney ? 'is-money' : ''}>{typeof value === 'number' ? value.toLocaleString('ku-IQ') : value}</strong></div>
        </article>
      ))}
    </div>
    <div className="shakhBeautyWorkspace">
      <div className="shakhBeautyWorkspaceHead">
        <div><span>دەستگەیشتنی خێرا</span><h3>کارە سەرەکییەکانی جوانکاری</h3></div>
        <small>{syncedAt ? 'دوایین sync: ' + syncedAt.toLocaleTimeString('ku-IQ') : 'sync دەکرێت...'}</small>
      </div>
      <div className="shakhBeautyActionGrid">
        <button type="button" onClick={() => onNavigate('orders')}><ClipboardList /><span><b>ئۆردەرەکان</b><small>{metrics.pendingOrders.toLocaleString('ku-IQ')} چاوەڕوان</small></span></button>
        <button type="button" onClick={() => onNavigate('store')}><Sparkles /><span><b>بەرهەم و ستۆک</b><small>{metrics.products.toLocaleString('ku-IQ')} بەرهەم</small></span></button>
        <button type="button" onClick={() => onNavigate('delivery_zones')}><Store /><span><b>سنوری گەیاندن</b><small>ناوچە و نرخی گەیاندن</small></span></button>
        <button type="button" onClick={() => onNavigate('manage_posts')}><FileText /><span><b>پۆستەکانی جوانکاری</b><small>بڵاوکردنەوە و بەڕێوەبردن</small></span></button>
        <button type="button" onClick={() => onNavigate('wallet')}><WalletCards /><span><b>جزدان</b><small>باڵانس و مامەڵەکان</small></span></button>
        <button type="button" onClick={() => onNavigate('notifications')}><Bell /><span><b>ئاگادارییەکان</b><small>{metrics.unreadNotifications.toLocaleString('ku-IQ')} نوێ</small></span></button>
        <button type="button" onClick={() => onNavigate('profile')}><UserRound /><span><b>پرۆفایل</b><small>هەژمار و زانیاریی دوکان</small></span></button>
        <button type="button" onClick={() => onNavigate('support')}><LifeBuoy /><span><b>پشتگیری</b><small>تیکەت و یارمەتی</small></span></button>
        <button type="button" onClick={() => onNavigate('settings')}><Settings2 /><span><b>ڕێکخستنەکان</b><small>ئاگاداری و هەژمار</small></span></button>
      </div>
    </div>
  </section>;
}
