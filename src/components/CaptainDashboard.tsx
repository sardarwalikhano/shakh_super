import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { RefreshCw, Truck, PackageCheck, MapPin, Clock3 } from 'lucide-react';
import { claimOrder, getAvailableCaptainOrders, getCaptainOrders, getCaptainCustomerContact, markOrderDelivered, markOrderOnTheWay, updateOrderStatus } from '../lib/captain';

type CaptainOrder = {
  id: string;
  status: string;
  total_iqd: number;
  created_at: string;
  updated_at?: string | null;
  delivered_at?: string | null;
  delivery_fee_iqd?: number;
  address_id?: string;
  items?: {
    product_id: string | null;
    product_name: string;
    quantity: number;
    unit_price_iqd: number;
  }[];
  delivery_address?: {
    address?: string | null;
    label?: string | null;
    city?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
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
  const [isOnline, setIsOnline] = useState(false);
  const [onlineBusy, setOnlineBusy] = useState(false);
  const [contacts, setContacts] = useState<Record<string, { full_name: string | null; phone: string | null } | null>>({});
  const [contactBusy, setContactBusy] = useState<string | null>(null);

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
    const loadCaptainState = async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) return;
      const { data, error } = await supabase.from('captains').select('is_online').eq('user_id', authData.user.id).maybeSingle();
      if (!error) setIsOnline(Boolean(data?.is_online));
    };
    void loadCaptainState();
    const channel = supabase
      .channel('captain-orders-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, []);

  const toggleOnline = async () => {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      setMessage('پێویستە بچیتە ژوورەوە.');
      return;
    }
    setOnlineBusy(true);
    setMessage('');
    const next = !isOnline;
    const { error } = await supabase.from('captains').update({ is_online: next }).eq('user_id', authData.user.id);
    if (error) setMessage(error.message);
    else {
      setIsOnline(next);
      setMessage(next ? 'کاپتن ئێستا ئۆنلاینە و دەتوانێت ئۆردەر وەربگرێت.' : 'کاپتن ئێستا ئۆفلاینە.');
      await load();
    }
    setOnlineBusy(false);
  };

  const todayKey = new Date().toLocaleDateString('en-CA');
  const completedOrders = orders.filter((order) => order.status === 'delivered');
  const activeOrders = orders.filter((order) => order.status !== 'delivered');
  const deliveredToday = completedOrders.filter(
    (order) =>
      new Date(order.delivered_at || order.updated_at || order.created_at).toLocaleDateString('en-CA') === todayKey,
  );
  const deliveryEarningsToday = deliveredToday.reduce(
    (sum, order) => sum + Number(order.delivery_fee_iqd || 0),
    0,
  );

  const loadCustomerContact = async (orderId: string) => {
    setContactBusy(orderId);
    setMessage('');
    try {
      const contact = await getCaptainCustomerContact(orderId);
      setContacts((current) => ({ ...current, [orderId]: contact }));
      if (!contact) setMessage('زانیاری پەیوەندیی کڕیار بەردەست نییە.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'نەتوانرا زانیاریی کڕیار وەرگیرێت.');
    } finally {
      setContactBusy(null);
    }
  };

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

      {!loading && (
        <div className="dashboardGrid" style={{ marginBottom: 20 }}>
          <div className="orderCard">
            <span className="eyebrow">ئۆردەرە چالاکەکان</span>
            <strong style={{ fontSize: 28 }}>{activeOrders.length}</strong>
          </div>
          <div className="orderCard">
            <span className="eyebrow">گەیەندراوەکانی ئەمڕۆ</span>
            <strong style={{ fontSize: 28 }}>{deliveredToday.length}</strong>
          </div>
          <div className="orderCard">
            <span className="eyebrow">کرێی گەیاندنی ئەمڕۆ</span>
            <strong style={{ fontSize: 22 }}>{deliveryEarningsToday.toLocaleString('ku-IQ')} دینار</strong>
          </div>
        </div>
      )}

      <div className="dashboardGrid">
        {loading ? <div className="empty">چاوەڕوان بە...</div> : activeOrders.length === 0 ? (
          <div className="empty"><PackageCheck size={38} /><h3>هیچ ئۆردەرێکی چالاک نییە</h3><p>کاتێک ئۆردەرێکی ئامادەی گەیاندن هەبێت، لێرە دەردەکەوێت.</p></div>
        ) : activeOrders.map(order => (
          <article className="orderCard" key={order.id}>
            <div className="orderCardTop"><strong>ئۆردەر #{order.id.slice(0, 8)}</strong><span>{labels[order.status] || order.status}</span></div>
            <div className="orderMeta"><Clock3 size={16} /> {new Date(order.created_at).toLocaleString('ku-IQ')}</div>
            {order.items && order.items.length > 0 && (
              <div style={{ display: 'grid', gap: 6, margin: '10px 0' }}>
                {order.items.map((item, index) => (
                  <div className="orderMeta" key={item.product_id || index}>
                    <span>{item.product_name}</span>
                    <span>× {item.quantity}</span>
                    <strong>{(Number(item.unit_price_iqd) * Number(item.quantity)).toLocaleString('ku-IQ')} دینار</strong>
                  </div>
                ))}
              </div>
            )}
            <div className="orderMeta"><MapPin size={16} /> {order.delivery_address?.address || 'ناونیشانی گەیاندن دیاری نەکراوە'}{order.delivery_address?.city ? ' — ' + order.delivery_address.city : ''}</div>
            {order.delivery_address?.latitude != null && order.delivery_address?.longitude != null && (
              <button
                className="plain full"
                type="button"
                onClick={() => {
                  const url = 'https://www.google.com/maps/search/?api=1&query=' + order.delivery_address!.latitude + ',' + order.delivery_address!.longitude;
                  window.open(url, '_blank', 'noopener,noreferrer');
                }}
              >
                کردنەوەی شوێنی گەیاندن لە نەخشە
              </button>
            )}
            <div className="orderTotal">{Number(order.total_iqd).toLocaleString('ku-IQ')} دینار</div>

            {order.status === 'ready_for_pickup' && <button className="primary full" disabled={busy === order.id} onClick={() => void run(order.id, () => claimOrder(order.id), 'ئۆردەرەکە بە سەرکەوتوویی بۆ تۆ وەرگیرا.')}>{busy === order.id ? 'چاوەڕوان بە...' : 'وەرگرتنی ئۆردەر'}</button>}
            {order.status === 'assigned_to_captain' && <button className="primary full" disabled={busy === order.id} onClick={() => void run(order.id, () => updateOrderStatus(order.id, 'picked_up'), 'ئۆردەرەکە لە دوکان وەرگیرا.')}>وەرگرتن لە دوکان</button>}
            {order.status === 'picked_up' && <button className="primary full" disabled={busy === order.id} onClick={() => void run(order.id, () => markOrderOnTheWay(order.id), 'گەیاندن دەستی پێکرد.')}>دەستپێکردنی گەیاندن</button>}
            {order.status === 'on_the_way' && <button className="primary full" disabled={busy === order.id} onClick={() => void run(order.id, () => markOrderDelivered(order.id), 'گەیاندن بە سەرکەوتوویی تەواو بوو.')}>تەواوکردنی گەیاندن</button>}
            {order.status !== 'delivered' && (
              <>
                {!contacts[order.id] && <button className="plain full" type="button" disabled={contactBusy === order.id} onClick={() => void loadCustomerContact(order.id)}>
                  {contactBusy === order.id ? 'وەرگرتنی زانیاری...' : 'پیشاندانی پەیوەندیی کڕیار'}
                </button>}
                {contacts[order.id] && (
                  <div className="orderMeta">
                    <span>کڕیار: {contacts[order.id]?.full_name || 'ناوی دیاری نەکراوە'}</span>
                    {contacts[order.id]?.phone ? (
                      <a href={'tel:' + contacts[order.id]?.phone}>{contacts[order.id]?.phone}</a>
                    ) : (
                      <span>ژمارەی مۆبایل بەردەست نییە</span>
                    )}
                  </div>
                )}
              </>
            )}
          </article>
        ))}
      </div>

      {!loading && completedOrders.length > 0 && (
        <>
          <div className="dashboardHeader" style={{ marginTop: 28 }}>
            <div>
              <span className="eyebrow">مێژووی گەیاندن</span>
              <h3><PackageCheck size={20} /> {completedOrders.length} ئۆردەری گەیەندراو</h3>
            </div>
          </div>
          <div className="dashboardGrid">
            {completedOrders.slice(0, 20).map(order => (
              <article className="orderCard" key={order.id}>
                <div className="orderCardTop"><strong>ئۆردەر #{order.id.slice(0, 8)}</strong><span>{labels[order.status]}</span></div>
                <div className="orderMeta"><Clock3 size={16} /> گەیەندرا: {new Date(order.delivered_at || order.updated_at || order.created_at).toLocaleString('ku-IQ')}</div>
                {order.items && order.items.length > 0 && (
                  <div style={{ display: 'grid', gap: 6, margin: '10px 0' }}>
                    {order.items.map((item, index) => (
                      <div className="orderMeta" key={item.product_id || index}>
                        <span>{item.product_name}</span>
                        <span>× {item.quantity}</span>
                        <strong>{(Number(item.unit_price_iqd) * Number(item.quantity)).toLocaleString('ku-IQ')} دینار</strong>
                      </div>
                    ))}
                  </div>
                )}
                <div className="orderMeta"><MapPin size={16} /> {order.delivery_address?.address || 'ناونیشانی گەیاندن دیاری نەکراوە'}{order.delivery_address?.city ? ' — ' + order.delivery_address.city : ''}</div>
                <div className="orderTotal">{Number(order.total_iqd).toLocaleString('ku-IQ')} دینار</div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
