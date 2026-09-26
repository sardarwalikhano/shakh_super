import { useEffect, useMemo, useState } from 'react';
import { BellRing, CheckCircle2, Clock3, Package, RefreshCw, Store, Truck } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Order = {
  id: string;
  status: string;
  total_iqd: number;
  created_at: string;
  store_id?: string | null;
  delivery_fee_iqd?: number | null;
  platform_fee_iqd?: number | null;
};

type Props = { userId: string };

const steps = [
  { key: 'pending', label: 'تۆمارکرا', icon: Package },
  { key: 'accepted', label: 'قبوڵکرا', icon: CheckCircle2 },
  { key: 'preparing', label: 'لە ئامادەکردندایە', icon: Store },
  { key: 'ready_for_pickup', label: 'ئامادەی وەرگرتن', icon: Package },
  { key: 'assigned_to_captain', label: 'کاپتن وەریگرت', icon: Truck },
  { key: 'picked_up', label: 'لە دوکان وەرگیرا', icon: Truck },
  { key: 'on_the_way', label: 'لە ڕێگادایە', icon: Truck },
  { key: 'delivered', label: 'گەیەندرا', icon: CheckCircle2 },
];

const orderStep = (status: string) => {
  const index = steps.findIndex((s) => s.key === status);
  return index < 0 ? (status === 'cancelled' ? -1 : 0) : index;
};

export default function CustomerOrderTracking({ userId }: Props) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setError('');
    const { data, error: queryError } = await supabase
      .from('orders')
      .select('id,status,total_iqd,created_at,store_id,delivery_fee_iqd,platform_fee_iqd')
      .eq('customer_id', userId)
      .order('created_at', { ascending: false })
      .limit(30);
    if (queryError) setError(queryError.message);
    else {
      const next = (data ?? []) as Order[];
      setOrders(next);
      if (!selected && next[0]) setSelected(next[0].id);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
    const channel = supabase
      .channel(`customer-orders-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `customer_id=eq.${userId}` }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [userId]);

  const current = useMemo(() => orders.find((o) => o.id === selected) ?? orders[0], [orders, selected]);
  const currentStep = current ? orderStep(current.status) : 0;

  return (
    <section className="customer-tracking" dir="rtl">
      <div className="customer-tracking__header">
        <div><span className="eyebrow">شوێنکەوتنی ئۆردەر</span><h2>ئۆردەرەکانم</h2><p>دۆخی ئۆردەرەکەت بە شێوەی زیندوو لە شاخ ببینە.</p></div>
        <button className="plain" onClick={() => void load()} disabled={loading} aria-label="نوێکردنەوە"><RefreshCw size={18} /></button>
      </div>

      {error && <div className="msg" role="alert">{error}</div>}
      {loading ? <div className="empty">ئۆردەرەکان بار دەکرێن...</div> : orders.length === 0 ? (
        <div className="empty"><Package size={38}/><h3>هێشتا هیچ ئۆردەرێکت نییە</h3><p>کاتێک داواکارییەکت تۆمار کرد، لێرە دەردەکەوێت.</p></div>
      ) : <>
        <div className="customer-tracking__orders">
          {orders.map((order) => <button key={order.id} className={order.id === current?.id ? 'order-select active' : 'order-select'} onClick={() => setSelected(order.id)} type="button">
            <span>#{order.id.slice(0, 8)}</span><strong>{Number(order.total_iqd).toLocaleString('ku-IQ')} د.ع</strong><small>{new Date(order.created_at).toLocaleString('ku-IQ')}</small>
          </button>)}
        </div>

        {current && <article className="customer-tracking__card">
          <div className="tracking-card__top"><div><span>ئۆردەری هەڵبژێردراو</span><h3>#{current.id.slice(0, 8)}</h3></div><BellRing size={22}/></div>
          {current.status === 'cancelled' ? <div className="msg">ئەم ئۆردەرە هەڵوەشێنراوەتەوە.</div> : <div className="tracking-timeline">
            {steps.map((step, index) => { const Icon = step.icon; const done = index <= currentStep; return <div className={done ? 'timeline-step done' : 'timeline-step'} key={step.key}><span><Icon size={16}/></span><div><strong>{step.label}</strong>{done && index === currentStep && <small><Clock3 size={13}/> دۆخی ئێستا</small>}</div></div>; })}
          </div>}
          <div className="tracking-summary"><div><span>کۆی گشتی</span><strong>{Number(current.total_iqd).toLocaleString('ku-IQ')} د.ع</strong></div><div><span>کاتی تۆمارکردن</span><strong>{new Date(current.created_at).toLocaleString('ku-IQ')}</strong></div></div>
        </article>}
      </>}
    </section>
  );
}
