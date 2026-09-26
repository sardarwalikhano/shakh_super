import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { RefreshCw, Truck, PackageCheck, MapPin, Clock3 } from 'lucide-react';
import { claimOrder, getAvailableCaptainOrders, getCaptainOrders, markOrderDelivered, markOrderOnTheWay, updateOrderStatus } from '../lib/captain';

type CaptainOrder = {
  id: string;
  status: string;
  total_iqd: number;
  created_at: string;
  delivery_fee_iqd?: number;
  address_id?: string;
};

const labels: Record<string, string> = {
  ready_for_pickup: 'ئامادەی وەرگرتن',
  assigned_to_captain: 'دراوەتە کاپتن',
  picked_up: 'وەرگیراوە',
  on_the_way: 'لە ڕێگادایە',
  delivered: 'گەیەندراوە',
};

export default function CaptainDashboard() {
  const [orders, setOrders] = useState<CaptainOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [available, mine] = await Promise.all([getAvailableCaptainOrders(), getCaptainOrders()]);
      const merged = [...available, ...mine].filter((order, index, all) => index === all.findIndex((item) => item.id === order.id));
      setOrders(merged as CaptainOrder[]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'نەتوانرا ئۆردەرەکان بار بکرێن.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const channel = supabase
      .channel('captain-orders-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, []);

  const run = async (id: string, action: () => Promise<unknown>, success: string) => {
    setBusy(id);
    setMessage('');
    try {
      await action();
      setMessage(success);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'کردارەکە سەرکەوتوو نەبوو.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="dashboard" dir="rtl">
      <div className="dashboardHeader">
        <div>
          <span className="eyebrow">داشبۆردی گەیاندن</span>
          <h2><Truck size={24} /> داشبۆردی کاپتن</h2>
          <p>ئۆردەرە بەردەستەکان و ئۆردەرە وەرگیراوەکانت بە شێوەی زیندوو ببینە.</p>
        </div>
        <button className="plain" onClick={() => void load()} disabled={loading}><RefreshCw size={18} /></button>
      </div>

      {message && <div className="msg">{message}</div>}

      <div className="dashboardGrid">
        {loading ? <div className="empty">چاوەڕوان بە...</div> : orders.length === 0 ? (
          <div className="empty"><PackageCheck size={38} /><h3>هیچ ئۆردەرێکی چالاک نییە</h3><p>کاتێک ئۆردەرێکی ئامادەی گەیاندن هەبێت، لێرە دەردەکەوێت.</p></div>
        ) : orders.map(order => (
          <article className="orderCard" key={order.id}>
            <div className="orderCardTop"><strong>ئۆردەر #{order.id.slice(0, 8)}</strong><span>{labels[order.status] || order.status}</span></div>
            <div className="orderMeta"><Clock3 size={16} /> {new Date(order.created_at).toLocaleString('ku-IQ')}</div>
            <div className="orderMeta"><MapPin size={16} /> ناونیشانی گەیاندن لە وردەکارییەکانی ئۆردەر</div>
            <div className="orderTotal">{Number(order.total_iqd).toLocaleString('ku-IQ')} دینار</div>

            {order.status === 'ready_for_pickup' && <button className="primary full" disabled={busy === order.id} onClick={() => void run(order.id, () => claimOrder(order.id), 'ئۆردەرەکە بە سەرکەوتوویی بۆ تۆ وەرگیرا.')}>{busy === order.id ? 'چاوەڕوان بە...' : 'وەرگرتنی ئۆردەر'}</button>}
            {order.status === 'assigned_to_captain' && <button className="primary full" disabled={busy === order.id} onClick={() => void run(order.id, () => updateOrderStatus(order.id, 'picked_up'), 'ئۆردەرەکە لە دوکان وەرگیرا.')}>وەرگرتن لە دوکان</button>}
            {order.status === 'picked_up' && <button className="primary full" disabled={busy === order.id} onClick={() => void run(order.id, () => markOrderOnTheWay(order.id), 'گەیاندن دەستی پێکرد.')}>دەستپێکردنی گەیاندن</button>}
            {order.status === 'on_the_way' && <button className="primary full" disabled={busy === order.id} onClick={() => void run(order.id, () => markOrderDelivered(order.id), 'گەیاندن بە سەرکەوتوویی تەواو بوو.')}>تەواوکردنی گەیاندن</button>}
          </article>
        ))}
      </div>
    </section>
  );
}
