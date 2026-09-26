import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, Check, CheckCheck, Clock3, MapPin, Package, RefreshCw, Truck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getMyNotifications, markNotificationRead, subscribeToMyNotifications } from '../lib/orderTracking';
import LiveDeliveryMap from './LiveDeliveryMap';

type CustomerOrder = {
  id: string;
  status: string;
  total_iqd: number;
  created_at: string;
  store_id: string | null;
  captain_id: string | null;
  address_id: string | null;
  subtotal_iqd: number;
  delivery_fee_iqd: number;
  platform_fee_iqd: number;
  discount_iqd: number;
  payment_status: string;
  payment_method: string | null;
  items: { product_id: string | null; product_name: string; quantity: number; unit_price_iqd: number }[];
  store: { name?: string | null; address?: string | null; city?: string | null; latitude?: number | null; longitude?: number | null } | null;
  delivery_address: { address?: string | null; label?: string | null; city?: string | null; latitude?: number | null; longitude?: number | null } | null;
};

type TrackingLocation = {
  order_id: string;
  captain_id: string;
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
  heading: number | null;
  speed_mps: number | null;
  updated_at: string;
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

function googleMapsUrl(latitude: number, longitude: number) {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

function googleDirectionsUrl(originLatitude: number, originLongitude: number, destinationLatitude: number, destinationLongitude: number) {
  return `https://www.google.com/maps/dir/?api=1&origin=${originLatitude},${originLongitude}&destination=${destinationLatitude},${destinationLongitude}`;
}

function formatTrackingAge(updatedAt: string, now = Date.now()) {
  const seconds = Math.max(0, Math.round((now - new Date(updatedAt).getTime()) / 1000));
  if (seconds < 60) return `نوێکراوە ${seconds} چرکە پێش`;
  const minutes = Math.round(seconds / 60);
  return `نوێکراوە ${minutes} خولەک پێش`;
}

function distanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const earthRadiusKm = 6371;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const dLat = lat2 - lat1;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const haversine = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function estimateEtaMinutes(distance: number, speedMps: number | null) {
  const speedKmh = speedMps != null && speedMps >= 1 && speedMps <= 15
    ? speedMps * 3.6
    : 25;
  const estimatedRoadKm = distance * 1.25;
  return Math.min(120, Math.max(1, Math.ceil((estimatedRoadKm / speedKmh) * 60)));
}

export default function CustomerOrdersPanel({ userId }: { userId: string }) {
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [trackingLocation, setTrackingLocation] = useState<TrackingLocation | null>(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingClock, setTrackingClock] = useState(() => Date.now());

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const [{ data: orderData, error: orderError }, notificationData] = await Promise.all([
        supabase.from('orders').select('id,status,total_iqd,created_at,store_id,captain_id,address_id,subtotal_iqd,delivery_fee_iqd,platform_fee_iqd,discount_iqd,payment_status,payment_method,order_items(product_id,product_name,quantity,unit_price_iqd),store:stores(name,address,city,latitude,longitude),delivery_address:delivery_addresses(address,label,city,latitude,longitude)').eq('customer_id', userId).order('created_at', { ascending: false }).limit(30),
        getMyNotifications(userId, 30),
      ]);
      if (orderError) throw orderError;
      const nextOrders = (orderData ?? []).map((order: any) => ({
        ...order,
        subtotal_iqd: Number(order.subtotal_iqd || 0),
        delivery_fee_iqd: Number(order.delivery_fee_iqd || 0),
        platform_fee_iqd: Number(order.platform_fee_iqd || 0),
        discount_iqd: Number(order.discount_iqd || 0),
        payment_status: order.payment_status ?? 'pending',
        payment_method: order.payment_method ?? null,
        store: Array.isArray(order.store) ? (order.store[0] ?? null) : (order.store ?? null),
        delivery_address: Array.isArray(order.delivery_address) ? (order.delivery_address[0] ?? null) : (order.delivery_address ?? null),
        items: (order.order_items ?? []).map((item: any) => ({
          product_id: item.product_id ?? null,
          product_name: item.product_name,
          quantity: Number(item.quantity),
          unit_price_iqd: Number(item.unit_price_iqd),
        })),
      })) as CustomerOrder[];
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

  useEffect(() => {
    setTrackingLocation(null);
    if (!selectedId) return;
    let active = true;
    setTrackingLoading(true);

    const loadTracking = async () => {
      const { data, error } = await supabase
        .from('delivery_tracking_locations')
        .select('order_id,captain_id,latitude,longitude,accuracy_m,heading,speed_mps,updated_at')
        .eq('order_id', selectedId)
        .maybeSingle();
      if (!active) return;
      if (error) {
        setTrackingLoading(false);
        return;
      }
      setTrackingLocation((data as TrackingLocation | null) ?? null);
      setTrackingLoading(false);
    };

    void loadTracking();
    const channel = supabase
      .channel(`delivery-tracking-${selectedId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_tracking_locations', filter: `order_id=eq.${selectedId}` }, (payload) => {
        if (!active) return;
        if (payload.eventType === 'DELETE') {
          setTrackingLocation(null);
          return;
        }
        setTrackingLocation(payload.new as TrackingLocation);
      })
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [selectedId]);
  useEffect(() => {
    if (!trackingLocation) return;
    const interval = window.setInterval(() => setTrackingClock(Date.now()), 15000);
    return () => window.clearInterval(interval);
  }, [trackingLocation]);

  const visibleNotifications = useMemo(() => unreadOnly ? notifications.filter((item) => !item.is_read) : notifications, [notifications, unreadOnly]);

  const trackingDestination = selected?.delivery_address?.latitude != null && selected.delivery_address?.longitude != null
    ? { latitude: Number(selected.delivery_address.latitude), longitude: Number(selected.delivery_address.longitude) }
    : null;
  const trackingDistance = trackingLocation && trackingDestination
    ? distanceKm(
        { latitude: trackingLocation.latitude, longitude: trackingLocation.longitude },
        trackingDestination,
      )
    : null;
  const trackingEtaMinutes = trackingDistance != null ? estimateEtaMinutes(trackingDistance, trackingLocation?.speed_mps ?? null) : null;
  const unreadCount = notifications.filter((item) => !item.is_read).length;

  const cancelOrder = async (orderId: string) => {
    if (!window.confirm('دڵنیایت لە هەڵوەشاندنەوەی ئەم ئۆردەرە؟')) return;
    setError(null);
    const { error: cancelError } = await supabase.rpc('transition_order_status', {
      p_order_id: orderId,
      p_next_status: 'cancelled',
    });
    if (cancelError) {
      setError(cancelError.message);
      return;
    }
    await load();
  };

  const readNotification = async (id: string) => {
    await markNotificationRead(userId, id);
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
              {selected.items.length > 0 && (
                <div className="summary" style={{ marginBottom: 12 }}>
                  {selected.items.map((item, index) => (
                    <div key={item.product_id ?? index}>
                      <span>{item.product_name} × {item.quantity.toLocaleString('ku-IQ')}</span>
                      <b>{(item.unit_price_iqd * item.quantity).toLocaleString('ku-IQ')} د.ع</b>
                    </div>
                  ))}
                </div>
              )}
              <div className="summary" style={{ marginBottom: 12 }}>
                <div><span>دۆخی پارەدان</span><b>{selected.payment_status === 'paid' ? 'پارەدراوە' : selected.payment_status === 'failed' ? 'سەرکەوتوو نەبوو' : selected.payment_status === 'refunded' ? 'گەڕێندرایەوە' : 'چاوەڕوانی پارەدان'}</b></div>
                <div><span>شێوازی پارەدان</span><b>{selected.payment_method === 'cash' ? 'کاش' : selected.payment_method || 'دیاری نەکراوە'}</b></div>
                <div><span>کۆی بەرهەم</span><b>{selected.subtotal_iqd.toLocaleString('ku-IQ')} د.ع</b></div>
                <div><span>گەیاندن</span><b>{selected.delivery_fee_iqd.toLocaleString('ku-IQ')} د.ع</b></div>
                <div><span>خزمەتی شاخ</span><b>{selected.platform_fee_iqd.toLocaleString('ku-IQ')} د.ع</b></div>
                {selected.discount_iqd > 0 && <div><span>داشکاندن</span><b>-{selected.discount_iqd.toLocaleString('ku-IQ')} د.ع</b></div>}
                <div className="grand"><span>کۆی گشتی</span><b>{Number(selected.total_iqd).toLocaleString('ku-IQ')} د.ع</b></div>
              </div>
              <div className="tracking-card__timeline">
                {steps.map(([key, label], index) => {
                  const active = index <= stepIndex(selected.status);
                  return <div className={`tracking-step ${active ? 'is-active' : ''}`} key={key}><span>{active ? <Check size={15} /> : index + 1}</span><div><strong>{label}</strong>{key === selected.status && <small>دۆخی ئێستا</small>}</div></div>;
                })}
              </div>
              <div className="tracking-card__footer"><MapPin size={17} /><span>شوێنی گەیاندن لە زانیارییەکانی ئۆردەرەکە پارێزراوە.</span></div>

              {(selected.status === 'assigned_to_captain' || selected.status === 'picked_up' || selected.status === 'on_the_way') && (
                <div className="liveDeliveryMapCard">
                  <div className="liveDeliveryMapHeader">
                    <div>
                      <span className="customer-orders-panel__eyebrow"><MapPin size={15} /> نەخشەی گەیاندن</span>
                      <strong>{trackingLocation ? 'شوێنی کاپتن زیندوە' : 'شوێنی کاپتن هێشتا نەنێردراوە'}</strong>
                    </div>
                    {trackingLocation && <small>{formatTrackingAge(trackingLocation.updated_at, trackingClock)}</small>}
                  </div>

                  {trackingLoading ? (
                    <div className="liveTrackingEmpty">چاوەڕوانی شوێنی زیندووی کاپتن...</div>
                  ) : trackingLocation ? (
                    <>
                      <LiveDeliveryMap
                        store={selected.store?.latitude != null && selected.store?.longitude != null ? { latitude: Number(selected.store.latitude), longitude: Number(selected.store.longitude) } : null}
                        captain={{ latitude: trackingLocation.latitude, longitude: trackingLocation.longitude }}
                        destination={selected.delivery_address?.latitude != null && selected.delivery_address?.longitude != null ? { latitude: Number(selected.delivery_address.latitude), longitude: Number(selected.delivery_address.longitude) } : null}
                      />
                      <a className="plain full liveMapExternalLink" href={googleMapsUrl(trackingLocation.latitude, trackingLocation.longitude)} target="_blank" rel="noreferrer">کردنەوەی شوێنی کاپتن لە نەخشەی گووگڵ</a>
                      <div className="liveTrackingMeta">
                        <span><span className="liveTrackingDot" /> کاپتن لە ڕێگادایە</span>
                        {trackingLocation.accuracy_m != null && <span>دروستی نزیکەی {Math.round(trackingLocation.accuracy_m).toLocaleString('ku-IQ')} مەتر</span>}
                      </div>
                      {trackingDistance != null && (
                        <div className="etaCard">
                          <div><Truck size={18} /><span>دووری تا شوێنی کڕیار</span><strong>{trackingDistance < 1 ? `${Math.round(trackingDistance * 1000).toLocaleString('ku-IQ')} مەتر` : `${trackingDistance.toFixed(1)} کیلۆمەتر`}</strong></div>
                          <div><Clock3 size={18} /><span>کاتی خەمڵێنراوی گەیشتن</span><strong>{trackingEtaMinutes?.toLocaleString('ku-IQ')} خولەک</strong></div>
                          <small>ئەم کاتە خەمڵێنراوەیە و بە پێی شوێن و خێرایی نوێ دەبێتەوە.</small>
                        </div>
                      )}
                      {selected.delivery_address?.latitude != null && selected.delivery_address?.longitude != null && (
                        <div className="liveTrackingActions">
                          <a className="plain" href={googleDirectionsUrl(trackingLocation.latitude, trackingLocation.longitude, selected.delivery_address.latitude, selected.delivery_address.longitude)} target="_blank" rel="noreferrer">ڕێگای کاپتن بۆ ناونیشان</a>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="liveTrackingEmpty">
                      <strong>{selected.status === 'assigned_to_captain' ? 'کاپتن دیاریکراوە؛ چاوەڕوانی وەرگرتنی شوێنە.' : 'کاپتن هێشتا شوێنی زیندووی خۆی نەناردووە.'}</strong>
                      <span>کاتێک شوێن نێردرا، لێرە بە شێوەی زیندوو نوێ دەبێتەوە.</span>
                    </div>
                  )}

                  {selected.store?.latitude != null && selected.store?.longitude != null && selected.delivery_address?.latitude != null && selected.delivery_address?.longitude != null && (
                    <a className="plain full liveStoreMapLink" href={googleDirectionsUrl(selected.store.latitude, selected.store.longitude, selected.delivery_address.latitude, selected.delivery_address.longitude)} target="_blank" rel="noreferrer">بینینی ڕێگای دوکان تا ناونیشانی گەیاندن</a>
                  )}
                </div>
              )}

              {selected.status === 'pending' && <button type="button" className="reset" onClick={() => void cancelOrder(selected.id)} style={{ marginTop: 10 }}>هەڵوەشاندنەوەی ئۆردەر</button>}
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
