import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Clock3, Package, RefreshCw, Search, Truck, Store, UserRound } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Order = {
  id: string;
  status: string;
  total_iqd: number | null;
  delivery_fee_iqd: number | null;
  created_at: string;
  customer_id: string | null;
  captain_id: string | null;
  store_id: string | null;
};

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

export default function SuperAdminOrderMonitor() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: requestError } = await supabase
      .from('orders')
      .select('id,status,total_iqd,delivery_fee_iqd,created_at,customer_id,captain_id,store_id')
      .order('created_at', { ascending: false })
      .limit(200);
    if (requestError) setError(requestError.message);
    else setOrders((data ?? []) as Order[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel('super-admin-orders-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load]);

  const filtered = useMemo(() => orders.filter((order) => {
    const matchesStatus = status === 'all' || order.status === status;
    const matchesQuery = !query || order.id.toLowerCase().includes(query.toLowerCase());
    return matchesStatus && matchesQuery;
  }), [orders, query, status]);

  const active = orders.filter((o) => !['delivered', 'cancelled'].includes(o.status)).length;
  const delivered = orders.filter((o) => o.status === 'delivered').length;
  const revenue = orders.reduce((sum, o) => sum + Number(o.total_iqd ?? 0), 0);

  return (
    <section className="dashboard" dir="rtl">
      <div className="dashboardHeader">
        <div>
          <span className="eyebrow"><Activity size={16} /> چاودێری ئۆردەر</span>
          <h2>Super Admin · Order Monitor</h2>
          <p>هەموو ئۆردەرەکان لە یەک شوێن، بە نوێکردنەوەی Realtime.</p>
        </div>
        <button className="plain" onClick={() => void load()} disabled={loading} aria-label="نوێکردنەوە"><RefreshCw size={18} /></button>
      </div>

      {error && <div className="msg">{error}</div>}

      <div className="dashboardGrid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        <div className="orderCard"><Package size={22} /><strong>{orders.length}</strong><span>کۆی ئۆردەر</span></div>
        <div className="orderCard"><Truck size={22} /><strong>{active}</strong><span>ئۆردەری چالاک</span></div>
        <div className="orderCard"><Store size={22} /><strong>{delivered}</strong><span>گەیەندراوە</span></div>
      </div>

      <div className="orderCard" style={{ marginTop: 16 }}>
        <div className="orderMeta"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="گەڕان بە ID ـی ئۆردەر..." /></div>
        <div className="orderMeta">
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">هەموو دۆخەکان</option>
            {Object.entries(STATUS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
          <span>کۆی نرخی پیشاندراو: {revenue.toLocaleString('ku-IQ')} دینار</span>
        </div>
      </div>

      <div className="dashboardGrid">
        {loading ? <div className="empty">چاوەڕوان بە...</div> : filtered.length === 0 ? <div className="empty">هیچ ئۆردەرێک نەدۆزرایەوە.</div> : filtered.map((order) => (
          <article className="orderCard" key={order.id}>
            <div className="orderCardTop"><strong>#{order.id.slice(0, 8)}</strong><span>{STATUS[order.status] || order.status}</span></div>
            <div className="orderMeta"><Clock3 size={15} /> {new Date(order.created_at).toLocaleString('ku-IQ')}</div>
            <div className="orderMeta"><UserRound size={15} /> کڕیار: {order.customer_id ? order.customer_id.slice(0, 8) : '—'}</div>
            <div className="orderMeta"><Store size={15} /> دوکان: {order.store_id ? order.store_id.slice(0, 8) : '—'}</div>
            <div className="orderMeta"><Truck size={15} /> کاپتن: {order.captain_id ? order.captain_id.slice(0, 8) : 'دیارینەکراوە'}</div>
            <div className="orderTotal">{Number(order.total_iqd ?? 0).toLocaleString('ku-IQ')} دینار</div>
          </article>
        ))}
      </div>
    </section>
  );
}
