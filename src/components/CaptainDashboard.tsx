import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { RefreshCw, Truck, PackageCheck, MapPin, Clock3 } from 'lucide-react';

type CaptainOrder = {
  id: string;
  status: string;
  total_iqd: number;
  created_at: string;
  delivery_fee_iqd?: number;
  address_id?: string;
};

const labels: Record<string, string> = {
  pending: 'چاوەڕوانی وەرگرتن',
  assigned_to_captain: 'دراوەتە کاپتن',
  picked_up: 'وەرگیراوە',
  on_the_way: 'لە ڕێگادایە',
  delivered: 'گەیەندراوە',
  cancelled: 'هەڵوەشێنراوەتەوە',
};

export default function CaptainDashboard() {
  const [orders, setOrders] = useState<CaptainOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select('id,status,total_iqd,created_at,delivery_fee_iqd,address_id')
      .in('status', ['pending', 'assigned_to_captain', 'picked_up', 'on_the_way'])
      .order('created_at', { ascending: false });
    if (error) setMessage('نەتوانرا داواکارییەکان بخوێندرێنەوە.');
    else setOrders((data || []) as CaptainOrder[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel('captain-orders-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const claim = async (id: string) => {
    setBusy(id);
    setMessage('');
    const { error } = await supabase.rpc('claim_order', { p_order_id: id });
    if (error) setMessage(error.message || 'وەرگرتنی داواکاری سەرکەوتوو نەبوو.');
    else setMessage('داواکارییەکە بە سەرکەوتوویی وەرگیرا.');
    await load();
    setBusy(null);
  };

  const setStatus = async (id: string, status: string) => {
    setBusy(id);
    const { error } = await supabase.from('orders').update({ status }).eq('id', id);
    if (error) setMessage(error.message || 'گۆڕینی دۆخ سەرکەوتوو نەبوو.');
    else setMessage('دۆخی داواکاری نوێ کرایەوە.');
    await load();
    setBusy(null);
  };

  return (
    <section className="dashboard" dir="rtl">
      <div className="dashboardHeader">
        <div>
          <span className="eyebrow">داشبۆردی گەیاندن</span>
          <h2><Truck size={24} /> داشبۆردی کاپتن</h2>
          <p>داواکارییە نوێکان ببینە و دۆخی گەیاندنەکانت بە شێوەی زیندوو نوێ بکەرەوە.</p>
        </div>
        <button className="plain" onClick={load} disabled={loading}><RefreshCw size={18} /></button>
      </div>

      {message && <div className="msg">{message}</div>}

      <div className="dashboardGrid">
        {loading ? <div className="empty">چاوەڕوان بە...</div> : orders.length === 0 ? (
          <div className="empty"><PackageCheck size={38} /><h3>هیچ داواکارییەکی چالاک نییە</h3><p>کاتێک داواکارییەکی نوێ هەبێت، لێرە دەردەکەوێت.</p></div>
        ) : orders.map(order => (
          <article className="orderCard" key={order.id}>
            <div className="orderCardTop">
              <strong>داواکاری #{order.id.slice(0, 8)}</strong>
              <span>{labels[order.status] || order.status}</span>
            </div>
            <div className="orderMeta"><Clock3 size={16} /> {new Date(order.created_at).toLocaleString('ku-IQ')}</div>
            <div className="orderMeta"><MapPin size={16} /> ناونیشانی گەیاندن لە وردەکارییەکانی داواکاری</div>
            <div className="orderTotal">{Number(order.total_iqd).toLocaleString('ku-IQ')} دینار</div>
            {order.status === 'pending' && <button className="primary full" disabled={busy === order.id} onClick={() => claim(order.id)}>{busy === order.id ? 'چاوەڕوان بە...' : 'وەرگرتنی داواکاری'}</button>}
            {order.status === 'assigned_to_captain' && <button className="primary full" disabled={busy === order.id} onClick={() => setStatus(order.id, 'picked_up')}>وەرگرتن لە دوکان</button>}
            {order.status === 'picked_up' && <button className="primary full" disabled={busy === order.id} onClick={() => setStatus(order.id, 'on_the_way')}>دەستپێکردنی گەیاندن</button>}
            {order.status === 'on_the_way' && <button className="primary full" disabled={busy === order.id} onClick={() => setStatus(order.id, 'delivered')}>تەواوکردنی گەیاندن</button>}
          </article>
        ))}
      </div>
    </section>
  );
}
