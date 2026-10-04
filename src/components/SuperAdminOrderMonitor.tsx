import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, Clock3, CreditCard, ListChecks, MapPin, MessageCircle,
  Navigation, Package, RefreshCw, Search, Store, Truck, UserRound,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { buildWhatsAppOrderText, buildWhatsAppUrl } from '../lib/whatsapp';

type Item = {
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price_iqd: number;
  options?: Record<string, unknown> | null;
};

type Order = {
  id: string;
  status: string;
  subtotal_iqd: number | null;
  delivery_fee_iqd: number | null;
  platform_fee_iqd: number | null;
  discount_iqd: number | null;
  total_iqd: number | null;
  payment_method: string | null;
  payment_status: string | null;
  created_at: string;
  updated_at: string | null;
  customer_id: string | null;
  captain_id: string | null;
  store_id: string | null;
  address_id: string | null;
  customer?: { id: string; full_name: string | null; phone: string | null; whatsapp_phone: string | null } | null;
  store?: { id: string; name: string | null; address: string | null; city: string | null; latitude: number | null; longitude: number | null } | null;
  delivery_address?: { id: string; label: string | null; address: string | null; delivery_note: string | null; city: string | null; latitude: number | null; longitude: number | null } | null;
  items: Item[];
};

type OnlineCaptain = { id: string; full_name: string | null; phone: string | null; whatsapp_phone: string | null };

const STATUS: Record<string, string> = {
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

const money = (value: number | null | undefined) => `${Number(value ?? 0).toLocaleString('ku-IQ')} د.ع`;

export default function SuperAdminOrderMonitor() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [captains, setCaptains] = useState<OnlineCaptain[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [captainsLoading, setCaptainsLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: rows, error: oe } = await supabase
        .from('orders')
        .select('id,status,subtotal_iqd,delivery_fee_iqd,platform_fee_iqd,discount_iqd,total_iqd,payment_method,payment_status,created_at,updated_at,customer_id,captain_id,store_id,address_id')
        .order('created_at', { ascending: false })
        .limit(200);
      if (oe) throw oe;

      const base = rows ?? [];
      const customerIds = [...new Set(base.map((r: any) => r.customer_id).filter(Boolean))];
      const storeIds = [...new Set(base.map((r: any) => r.store_id).filter(Boolean))];
      const addressIds = [...new Set(base.map((r: any) => r.address_id).filter(Boolean))];
      const orderIds = base.map((r: any) => r.id);

      const [cr, sr, ar, ir] = await Promise.all([
        customerIds.length ? supabase.from('profiles').select('id,full_name,phone,whatsapp_phone').in('id', customerIds) : Promise.resolve({ data: [], error: null }),
        storeIds.length ? supabase.from('stores').select('id,name,address,city,latitude,longitude').in('id', storeIds) : Promise.resolve({ data: [], error: null }),
        addressIds.length ? supabase.from('delivery_addresses').select('id,label,address,delivery_note,city,latitude,longitude').in('id', addressIds) : Promise.resolve({ data: [], error: null }),
        orderIds.length ? supabase.from('order_items').select('order_id,product_id,product_name,quantity,unit_price_iqd,options').in('order_id', orderIds) : Promise.resolve({ data: [], error: null }),
      ]);
      if (cr.error) throw cr.error;
      if (sr.error) throw sr.error;
      if (ar.error) throw ar.error;
      if (ir.error) throw ir.error;

      const cm = new Map((cr.data ?? []).map((x: any) => [x.id, x]));
      const sm = new Map((sr.data ?? []).map((x: any) => [x.id, x]));
      const am = new Map((ar.data ?? []).map((x: any) => [x.id, x]));
      const im = new Map<string, Item[]>();
      (ir.data ?? []).forEach((x: any) => {
        const list = im.get(x.order_id) ?? [];
        list.push({ product_id: x.product_id ?? null, product_name: String(x.product_name ?? 'بەرهەم'), quantity: Number(x.quantity ?? 0), unit_price_iqd: Number(x.unit_price_iqd ?? 0), options: x.options ?? {} });
        im.set(x.order_id, list);
      });

      const nextOrders = base.map((row: any) => ({
        ...row,
        customer: cm.get(row.customer_id) ?? null,
        store: sm.get(row.store_id) ?? null,
        delivery_address: am.get(row.address_id) ?? null,
        items: im.get(row.id) ?? [],
      })) as Order[];
      setOrders(nextOrders);
      setSelectedId((current) => current && nextOrders.some((order) => order.id === current) ? current : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'نەتوانرا زانیاریی تەواوی ئۆردەرەکان وەرگیرێت.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCaptains = useCallback(async () => {
    setCaptainsLoading(true);
    try {
      const { data, error: e } = await supabase.from('captains').select('user_id').eq('is_online', true);
      if (e) throw e;
      const ids = [...new Set((data ?? []).map((x: any) => x.user_id).filter(Boolean))];
      if (!ids.length) {
        setCaptains([]);
        return;
      }
      const { data: ps, error: pe } = await supabase.from('profiles').select('id,full_name,phone,whatsapp_phone').in('id', ids);
      if (pe) throw pe;
      setCaptains((ps ?? []) as OnlineCaptain[]);
    } catch (err) {
      setCaptains([]);
      setError(err instanceof Error ? err.message : 'نەتوانرا کاپتنە ئۆنلاینەکان وەرگیرێن.');
    } finally {
      setCaptainsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    void loadCaptains();
    const channel = supabase
      .channel('super-admin-orders-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => { void load(); void loadCaptains(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'captains' }, () => void loadCaptains())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load, loadCaptains]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((o) =>
      (status === 'all' || o.status === status) &&
      (!q || o.id.toLowerCase().includes(q) || (o.customer?.full_name ?? '').toLowerCase().includes(q) || (o.store?.name ?? '').toLowerCase().includes(q))
    );
  }, [orders, query, status]);

  const active = orders.filter((o) => !['delivered', 'cancelled'].includes(o.status)).length;
  const delivered = orders.filter((o) => o.status === 'delivered').length;
  const revenue = orders.reduce((sum, o) => sum + Number(o.total_iqd ?? 0), 0);

  const sendToCaptain = (order: Order, captain: OnlineCaptain) => {
    const phone = captain.whatsapp_phone || captain.phone;
    if (!phone) {
      setError('ئەم کاپتنە ژمارەی واتسئاپی نییە.');
      return;
    }
    const text = buildWhatsAppOrderText({
      orderId: order.id,
      status: order.status,
      createdAt: order.created_at,
      store: order.store,
      deliveryAddress: order.delivery_address,
      items: order.items,
      subtotal_iqd: order.subtotal_iqd,
      delivery_fee_iqd: order.delivery_fee_iqd,
      platform_fee_iqd: order.platform_fee_iqd,
      discount_iqd: order.discount_iqd,
      total_iqd: order.total_iqd,
      payment_method: order.payment_method,
      payment_status: order.payment_status,
      customer: order.customer,
      includeCustomerContact: false,
    });
    window.open(buildWhatsAppUrl(phone, text), '_blank', 'noopener,noreferrer');
  };

  return (
    <section className="dashboard platformOrderMonitor" dir="rtl" aria-labelledby="platform-orders-title">
      <div className="dashboardHeader platformMonitorHero">
        <div>
          <span className="eyebrow"><Activity size={16} /> چاودێری پلاتفۆرم</span>
          <h2 id="platform-orders-title">ناوەندی چاودێری ئۆردەر</h2>
          <p>هەموو زانیاریی ئۆردەر لە یەک شوێن: کڕیار، دوکان، بەرهەم، پارەدان، شوێن و گەیاندن.</p>
        </div>
        <button className="plain" type="button" onClick={() => { void load(); void loadCaptains(); }} disabled={loading} aria-label="نوێکردنەوەی ئۆردەرەکان">
          <RefreshCw size={18} />
        </button>
      </div>

      {error && <div className="msg" role="alert">{error}</div>}

      <div className="orderMonitorStats dashboardGrid" aria-label="پوختەی ئۆردەرەکان">
        <div className="orderCard orderMetricCard"><span className="metricIcon"><Package size={20} /></span><div><strong>{orders.length}</strong><span>کۆی ئۆردەر</span></div></div>
        <div className="orderCard orderMetricCard"><span className="metricIcon"><Truck size={20} /></span><div><strong>{active}</strong><span>ئۆردەری چالاک</span></div></div>
        <div className="orderCard orderMetricCard"><span className="metricIcon"><Store size={20} /></span><div><strong>{delivered}</strong><span>گەیەندراوە</span></div></div>
        <div className="orderCard orderMetricCard"><span className="metricIcon"><CreditCard size={20} /></span><div><strong>{money(revenue)}</strong><span>کۆی نرخی پیشاندراو</span></div></div>
      </div>

      <div className="orderMonitorControls orderCard">
        <div className="orderMonitorSearchWrap">
          <Search size={17} aria-hidden="true" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="گەڕان بە ژمارەی ئۆردەر، کڕیار یان دوکان..." aria-label="گەڕان لە ئۆردەرەکان" />
        </div>
        <div className="orderMonitorFilterRow">
          <label><span>دۆخ</span><select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="فلتەری دۆخی ئۆردەر"><option value="all">هەموو دۆخەکان</option>{Object.entries(STATUS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <span className="resultCount">{filtered.length.toLocaleString('ku-IQ')} ئۆردەر</span>
        </div>
      </div>

      <div className="orderMonitorList dashboardGrid">
        {loading ? <div className="empty">زانیارییەکان بار دەکرێن...</div> : filtered.length === 0 ? <div className="empty">هیچ ئۆردەرێک نەدۆزرایەوە.</div> : filtered.map((order) => (
          <div key={order.id}>
            <button type="button" className={selectedId === order.id ? 'compactOrderRow is-selected' : 'compactOrderRow'} onClick={() => setSelectedId(order.id)}>
              <span className="compactOrderAvatar"><UserRound size={17} /></span>
              <span className="compactOrderIdentity">
                <strong>{order.customer?.full_name || 'کڕیار'}</strong>
                <small>#{order.id.slice(0, 8)}</small>
              </span>
              <span className="compactOrderStatus">{STATUS[order.status] || order.status}</span>
            </button>
            {selectedId === order.id && <article className="orderCard platformOrderCard compactOrderExpanded">
            <div className="orderCardTop">
              <div><small>ژمارەی ئۆردەر</small><strong>#{order.id.slice(0, 8)}</strong></div>
              <span className="orderStatusBadge">{STATUS[order.status] || order.status}</span>
            </div>

            <div className="platformOrderGrid">
              <div className="platformOrderSection"><div className="platformOrderSectionHead"><UserRound size={15} /><b>کڕیار</b></div><strong>{order.customer?.full_name || 'ناوی دیاری نەکراوە'}</strong><span>{order.customer?.phone || 'ژمارەی مۆبایل نییە'}</span></div>
              <div className="platformOrderSection"><div className="platformOrderSectionHead"><Store size={15} /><b>دوکان</b></div><strong>{order.store?.name || 'دوکان دیاری نەکراوە'}</strong><span>{[order.store?.address, order.store?.city].filter(Boolean).join(' — ') || 'ناونیشان نییە'}</span></div>
              <div className="platformOrderSection"><div className="platformOrderSectionHead"><MapPin size={15} /><b>شوێنی گەیاندن</b></div><strong>{order.delivery_address?.address || 'شوێنی ورد نییە'}</strong><span>{[order.delivery_address?.city, order.delivery_address?.delivery_note].filter(Boolean).join(' — ')}</span></div>
            </div>

            {order.items.length > 0 && <div className="platformOrderItems"><div className="platformOrderSectionHead"><ListChecks size={15} /><b>لیستی بەرهەمەکان</b></div>{order.items.map((item, index) => <div className="platformOrderItem" key={item.product_id || index}><span>{item.product_name} × {item.quantity}</span><b>{money(Number(item.unit_price_iqd) * Number(item.quantity))}</b></div>)}</div>}

            <div className="platformOrderFinance">
              <div><span>کۆی بەرهەم</span><b>{money(order.subtotal_iqd)}</b></div>
              <div><span>گەیاندن</span><b>{money(order.delivery_fee_iqd)}</b></div>
              <div><span>خزمەتی شاخ</span><b>{money(order.platform_fee_iqd)}</b></div>
              {Number(order.discount_iqd || 0) > 0 && <div><span>داشکاندن</span><b>-{money(order.discount_iqd)}</b></div>}
              <div className="grand"><span>کۆی گشتی</span><b>{money(order.total_iqd)}</b></div>
            </div>

            <div className="platformOrderMeta"><span><CreditCard size={14} /> {order.payment_method || 'cash'} · {order.payment_status || 'pending'}</span><span><Clock3 size={14} /> {new Date(order.created_at).toLocaleString('ku-IQ')}</span></div>

            {order.delivery_address?.latitude != null && order.delivery_address?.longitude != null && <a className="plain full" href={`https://www.google.com/maps/dir/?api=1&destination=${order.delivery_address.latitude},${order.delivery_address.longitude}`} target="_blank" rel="noreferrer"><Navigation size={15} /> ڕێگا بۆ شوێنی گەیاندن</a>}

            {order.status === 'ready_for_pickup' && <div className="captainBroadcastBox"><div><b>ئامادەکردنی ئۆردەر بۆ کاپتن</b><small>زانیاریی کڕیار تا کاتی وەرگرتنی ئۆردەر بۆ کاپتن نانێردرێت.</small><small>{captains.length} کاپتن ئێستا ئۆنلاینە.</small></div>{captainsLoading ? <span>بارکردن...</span> : captains.length === 0 ? <span>کاپتنی ئۆنلاین بەردەست نییە.</span> : <div className="captainBroadcastList">{captains.map((captain) => <button type="button" className="whatsappSendButton" key={captain.id} onClick={() => sendToCaptain(order, captain)}><MessageCircle size={15} />{captain.full_name || 'کاپتن'} · واتسئاپ</button>)}</div>}</div>}

            {order.captain_id && <div className="assignedCaptainCard"><Truck size={16} /><span><b>کاپتنی دیاریکراو:</b> {order.captain_id.slice(0, 8)}</span></div>}
            </article>}
          </div>
        ))}
      </div>
    </section>
  );
}
