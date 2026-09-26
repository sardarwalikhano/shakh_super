import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, Check, CheckCheck, Clock3, MapPin, Package, RefreshCw, Truck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getMyNotifications, markNotificationRead, subscribeToMyNotifications } from '../lib/orderTracking';

type CustomerOrder = {
  id: string;
  status: string;
  total_iqd: number;
  created_at: string;
  store_id: string | null;
};

type NotificationItem = {
  id: string;
  title: string;
  body: string | null;
  type: string | null;
  is_read: boolean;
  data: Record<string, unknown> | null;
  created_at: string;
};

const steps = [
  ['pending', 'تۆمارکرا'],
  ['accepted', 'قبوڵکرا'],
  ['preparing', 'ئامادە دەکرێت'],
  ['ready_for_pickup', 'ئامادەی وەرگرتن'],
  ['assigned_to_captain', 'کاپتن دیاریکرا'],
  ['picked_up', 'کاپتن وەریگرت'],
  ['on_the_way', 'لە ڕێگادایە'],
  ['delivered', 'گەیەندرا'],
] as const;

function stepIndex(status: string) {
  const index = steps.findIndex(([key]) => key === status);
  return index < 0 ? 0 : index;
}

export default function CustomerOrdersPanel({ userId }: { userId: string }) {
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ data: orderData, error: orderError }, notificationData] = await Promise.all([
        supabase.from('orders').select('id,status,total_iqd,created_at,store_id').eq('customer_id', userId).order('created_at', { ascending: false }).limit(30),
        getMyNotifications(30),
      ]);
      if (orderError) throw orderError;
      const nextOrders = (orderData ?? []) as CustomerOrder[];
      setOrders(nextOrders);
      setNotifications(notificationData as NotificationItem[]);
      setSelectedId((current) => current && nextOrders.some((order) => order.id === current) ? current : nextOrders[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'نەتوانرا زانیارییەکان بار بکرێن.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
    const orderChannel = supabase
      .channel(`customer-orders-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `customer_id=eq.${userId}` }, () => void load())
      .subscribe();
    const unsubscribeNotifications = subscribeToMyNotifications(userId, () => void load());
    return () => {
      void supabase.removeChannel(orderChannel);
      unsubscribeNotifications();
    };
  }, [load, userId]);

  const selected = useMemo(() => orders.find((order) => order.id === selectedId) ?? null, [orders, selectedId]);
  const visibleNotifications = useMemo(() => unreadOnly ? notifications.filter((item) => !item.is_read) : notifications, [notifications, unreadOnly]);
  const unreadCount = notifications.filter((item) => !item.is_read).length;

  const readNotification = async (id: string) => {
    await markNotificationRead(id);
    setNotifications((current) => current.map((item) => item.id === id ? { ...item, is_read: true } : item));
  };

  return (
    <section className="customer-orders-panel" dir="rtl">
      <div className="customer-orders-panel__header">
        <div>
          <span className="customer-orders-panel__eyebrow"><Package size={16} /> ئۆردەرەکانم</span>
          <h2>شوێنکەوتنی ئۆردەر</h2>
          <p>هەر گۆڕانکارییەک بە شێوەی زیندوو لێرە پیشان دەدرێت.</p>
        </div>
        <button className="plain" type="button" onClick={() => void load()} disabled={loading} aria-label="نوێکردنەوە"><RefreshCw size={18} /></button>
      </div>

      {error && <div className="msg">{error}</div>}

      <div className="customer-orders-panel__grid">
        <div className="customer-orders-panel__orders">
          {loading ? <div className="empty">چاوەڕوان بە...</div> : orders.length === 0 ? <div className="empty"><Package size={38} /><strong>هێشتا هیچ ئۆردەرێکت نییە</strong></div> : orders.map((order) => (
            <button key={order.id} type="button" className={`customer-order-card ${selectedId === order.id ? 'is-selected' : ''}`} onClick={() => setSelectedId(order.id)}>
              <div><strong>#{order.id.slice(0, 8)}</strong><span>{steps.find(([key]) => key === order.status)?.[1] ?? order.status}</span></div>
              <small><Clock3 size={14} /> {new Date(order.created_at).toLocaleString('ku-IQ')}</small>
              <b>{Number(order.total_iqd).toLocaleString('ku-IQ')} دینار</b>
            </button>
          ))}
        </div>

        <div className="customer-orders-panel__detail">
          {selected ? (
            <>
              <div className="tracking-card__top"><div><span>داواکاری</span><h3>#{selected.id.slice(0, 8)}</h3></div><Truck size={28} /></div>
              <div className="tracking-card__timeline">
                {steps.map(([key, label], index) => {
                  const active = index <= stepIndex(selected.status);
                  return <div className={`tracking-step ${active ? 'is-active' : ''}`} key={key}><span>{active ? <Check size={15} /> : index + 1}</span><div><strong>{label}</strong>{key === selected.status && <small>دۆخی ئێستا</small>}</div></div>;
                })}
              </div>
              <div className="tracking-card__footer"><MapPin size={17} /><span>شوێنی گەیاندن لە زانیارییەکانی ئۆردەرەکە پارێزراوە.</span></div>
            </>
          ) : <div className="empty">ئۆردەرێک هەڵبژێرە بۆ بینینی Tracking.</div>}
        </div>
      </div>

      <div className="customer-orders-panel__notifications">
        <div className="customer-orders-panel__notification-head">
          <div><span className="customer-orders-panel__eyebrow"><Bell size={16} /> ئاگادارکردنەوە</span><h3>نوێترین ئاگادارکردنەوەکان {unreadCount > 0 && <em>{unreadCount}</em>}</h3></div>
          <button type="button" className="plain" onClick={() => setUnreadOnly((value) => !value)}>{unreadOnly ? 'هەموو' : 'نەخوێندراوەکان'}</button>
        </div>
        {visibleNotifications.length === 0 ? <div className="empty">هیچ ئاگادارکردنەوەیەک نییە.</div> : <div className="notification-list">
          {visibleNotifications.map((item) => <article className={`notification-item ${item.is_read ? 'is-read' : 'is-unread'}`} key={item.id}>
            <div className="notification-item__icon"><Bell size={17} /></div>
            <div><strong>{item.title}</strong>{item.body && <p>{item.body}</p>}<small><Clock3 size={13} /> {new Date(item.created_at).toLocaleString('ku-IQ')}</small></div>
            {!item.is_read && <button type="button" onClick={() => void readNotification(item.id)} aria-label="خوێندراوە بکە"><CheckCheck size={17} /></button>}
          </article>)}
        </div>}
      </div>
    </section>
  );
}
