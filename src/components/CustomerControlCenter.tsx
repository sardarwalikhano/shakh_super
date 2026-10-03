import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, Car, ClipboardList, LifeBuoy, MapPin, Package, Plane, RefreshCw, ShoppingBag, UserRound, WalletCards } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { DashboardView } from './DashboardShell';

type Props = { userId: string; onNavigate: (view: DashboardView) => void };
type Metrics = { orders: number; activeOrders: number; cartItems: number; unreadNotifications: number; walletBalance: number; referralBalance: number; savedAddresses: number };
const initialMetrics: Metrics = { orders: 0, activeOrders: 0, cartItems: 0, unreadNotifications: 0, walletBalance: 0, referralBalance: 0, savedAddresses: 0 };
const money = (value: number) => Number(value || 0).toLocaleString('ku-IQ') + ' د.ع';

export default function CustomerControlCenter({ userId, onNavigate }: Props) {
  const [metrics, setMetrics] = useState<Metrics>(initialMetrics);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true); setMessage('');
    try {
      const [orders, activeOrders, notifications, wallet, referralWallet, addresses, cart] = await Promise.all([
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('customer_id', userId),
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('customer_id', userId).not('status', 'in', '("delivered","cancelled")'),
        supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('is_read', false),
        supabase.from('wallets').select('balance_iqd').eq('user_id', userId).maybeSingle(),
        supabase.from('referral_wallets').select('balance_iqd').eq('user_id', userId).maybeSingle(),
        supabase.from('delivery_addresses').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('carts').select('id').eq('user_id', userId).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
      ]);
      const results = [orders, activeOrders, notifications, wallet, referralWallet, addresses, cart];
      const firstError = results.find((result) => result.error)?.error;
      if (firstError) {
        const text = String(firstError.message || '').toLowerCase();
        const ignorable = firstError.code === 'PGRST116' || text.includes('schema cache') || text.includes('relation');
        if (!ignorable) throw firstError;
      }
      let cartItems = 0;
      if (cart.data?.id) {
        const cartItemsResult = await supabase.from('cart_items').select('quantity').eq('cart_id', cart.data.id);
        if (cartItemsResult.error) throw cartItemsResult.error;
        cartItems = (cartItemsResult.data || []).reduce((sum, item: any) => sum + Number(item.quantity || 0), 0);
      }
      setMetrics({
        orders: orders.count || 0,
        activeOrders: activeOrders.count || 0,
        cartItems,
        unreadNotifications: notifications.count || 0,
        walletBalance: Number(wallet.data?.balance_iqd || 0),
        referralBalance: Number(referralWallet.data?.balance_iqd || 0),
        savedAddresses: addresses.count || 0,
      });
      setSyncedAt(new Date());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'نەتوانرا پوختەی هەژماری کڕیار وەرگیرێت.');
    } finally { setLoading(false); }
  }, [userId]);

  useEffect(() => {
    void load();
    const channel = supabase.channel('shakh-customer-control-center-' + userId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: 'customer_id=eq.' + userId }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: 'user_id=eq.' + userId }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wallets', filter: 'user_id=eq.' + userId }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'referral_wallets', filter: 'user_id=eq.' + userId }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_addresses', filter: 'user_id=eq.' + userId }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'carts', filter: 'user_id=eq.' + userId }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cart_items' }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load, userId]);

  const statCards = useMemo(() => [
    { label: 'هەموو ئۆردەرەکان', value: metrics.orders, icon: ClipboardList, tone: 'orange' },
    { label: 'ئۆردەری چالاک', value: metrics.activeOrders, icon: Package, tone: 'blue' },
    { label: 'بەرهەم لە سەلە', value: metrics.cartItems, icon: ShoppingBag, tone: 'green' },
    { label: 'ئاگاداریی نوێ', value: metrics.unreadNotifications, icon: Bell, tone: 'violet' },
    { label: 'باڵانسی جزدان', value: money(metrics.walletBalance), icon: WalletCards, tone: 'amber', money: true },
    { label: 'قازانجی Share', value: money(metrics.referralBalance), icon: WalletCards, tone: 'teal', money: true },
    { label: 'ناونیشانی پاشەکەوتکراو', value: metrics.savedAddresses, icon: MapPin, tone: 'rose' },
  ], [metrics]);

  return (
    <section className="shakhCustomerCenter" aria-labelledby="customer-center-title">
      <div className="shakhCustomerHero">
        <div className="shakhCustomerHeroCopy">
          <span className="shakhCustomerEyebrow"><UserRound size={15} /> ناوەندی کڕیار</span>
          <h2 id="customer-center-title">SHAKH Customer Center</h2>
          <p>هەموو زانیارییە گرنگەکانی کڕین، داواکاری، جزدان، ئاگاداری و ناونیشان لە یەک شوێن.</p>
        </div>
        <button type="button" className="shakhCustomerRefresh" onClick={() => void load()} disabled={loading}><RefreshCw size={17} className={loading ? 'is-spinning' : ''} /> نوێکردنەوە</button>
      </div>
      {message && <div className="msg" role="alert">{message}</div>}
      <div className="shakhCustomerStats">
        {statCards.map(({ label, value, icon: Icon, tone, money: isMoney }) => <article className="shakhCustomerStat" data-tone={tone} key={label}><span className="shakhCustomerStatIcon"><Icon size={19} /></span><div><small>{label}</small><strong className={isMoney ? 'is-money' : ''}>{typeof value === 'number' ? value.toLocaleString('ku-IQ') : value}</strong></div></article>)}
      </div>
      <div className="shakhCustomerWorkspace">
        <div className="shakhCustomerWorkspaceHead"><div><span>دەستگەیشتنی خێرا</span><h3>بەشە سەرەکییەکانی هەژمار</h3></div><small>{syncedAt ? 'دوایین sync: ' + syncedAt.toLocaleTimeString('ku-IQ') : 'sync دەکرێت...'}</small></div>
        <div className="shakhCustomerActionGrid">
          <button type="button" onClick={() => onNavigate('orders')}><ClipboardList /><span><b>ئۆردەرەکانم</b><small>{metrics.activeOrders.toLocaleString('ku-IQ')} چالاک</small></span></button>
          <button type="button" onClick={() => onNavigate('store')}><ShoppingBag /><span><b>بازاڕ و سەلە</b><small>{metrics.cartItems.toLocaleString('ku-IQ')} دانە لە سەلە</small></span></button>
          <button type="button" onClick={() => onNavigate('delivery')}><MapPin /><span><b>شوێنکەوتنی گەیاندن</b><small>دۆخی نوێی ئۆردەر</small></span></button>
          <button type="button" onClick={() => onNavigate('wallet')}><WalletCards /><span><b>جزدان و قازانج</b><small>{money(metrics.walletBalance + metrics.referralBalance)}</small></span></button>
          <button type="button" onClick={() => onNavigate('notifications')}><Bell /><span><b>ئاگادارییەکان</b><small>{metrics.unreadNotifications.toLocaleString('ku-IQ')} نوێ</small></span></button>
          <button type="button" onClick={() => onNavigate('profile')}><UserRound /><span><b>پرۆفایل</b><small>زانیاری و ڕێکخستنەکانی هەژمار</small></span></button>
          <button type="button" onClick={() => onNavigate('cars')}><Car /><span><b>SHAKH Cars</b><small>گەڕان و پێشانگا</small></span></button>
          <button type="button" onClick={() => onNavigate('umrah')}><Plane /><span><b>حەج و عومرە</b><small>پەکەج و حجز</small></span></button>
          <button type="button" onClick={() => onNavigate('support')}><LifeBuoy /><span><b>پشتگیری</b><small>داواکاری و تیکەت</small></span></button>
        </div>
      </div>
    </section>
  );
}