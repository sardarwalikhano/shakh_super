import { useEffect, useRef, useState } from 'react';
import { RefreshCw, Truck, PackageCheck, MapPin, Clock3, MessageCircle, Phone, Navigation, UserRound } from 'lucide-react';
import { supabase } from '../lib/supabase';
import LiveDeliveryMap from './LiveDeliveryMap';
import {
  claimOrder,
  getAvailableCaptainOrders,
  getCaptainOrders,
  getCaptainCustomerContact,
  markOrderDelivered,
  markOrderOnTheWay,
  updateOrderStatus,
  type CaptainCustomerContact,
  type CaptainOrder,
} from '../lib/captain';
import { buildWhatsAppOrderText, buildWhatsAppUrl } from '../lib/whatsapp';

const labels: Record<string, string> = {
  ready_for_pickup: 'ئامادەی وەرگرتن',
  assigned_to_captain: 'دراوەتە کاپتن',
  picked_up: 'وەرگیراوە',
  on_the_way: 'لە ڕێگادایە',
  delivered: 'گەیەندراوە',
};

const optionText = (options?: Record<string, unknown>) =>
  options
    ? Object.entries(options)
        .filter(([, value]) => value != null && String(value).trim() !== '')
        .map(([key, value]) => key + ': ' + String(value))
        .join('، ')
    : '';

export default function CaptainDashboard() {
  const [orders, setOrders] = useState<CaptainOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [isOnline, setIsOnline] = useState(false);
  const [onlineBusy, setOnlineBusy] = useState(false);
  const [contacts, setContacts] = useState<Record<string, CaptainCustomerContact | null>>({});
  const [contactBusy, setContactBusy] = useState<string | null>(null);
  const [locationTrackingOrderId, setLocationTrackingOrderId] = useState<string | null>(null);
  const [captainLocation, setCaptainLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const watchIdsRef = useRef<Record<string, number>>({});
  const lastLocationSentRef = useRef<Record<string, number>>({});

  const load = async () => {
    setLoading(true);
    try {
      const [available, mine] = await Promise.all([getAvailableCaptainOrders(), getCaptainOrders()]);
      const merged = [...available, ...mine].filter(
        (order, index, all) => index === all.findIndex((item) => item.id === order.id),
      );
      setOrders(merged);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'نەتوانرا ئۆردەرەکان بار بکرێن.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    let orderChannel: ReturnType<typeof supabase.channel> | null = null;
    void load();

    const setupLiveOrders = async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!active || !authData.user) return;

      const captainId = authData.user.id;
      const { data, error } = await supabase
        .from('captains')
        .select('is_online')
        .eq('user_id', captainId)
        .maybeSingle();

      if (active && !error) setIsOnline(Boolean(data?.is_online));
      if (!active) return;

      orderChannel = supabase
        .channel('captain-orders-live')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'orders', filter: 'status=eq.ready_for_pickup' },
          () => void load(),
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'orders', filter: 'captain_id=eq.' + captainId },
          () => void load(),
        )
        .subscribe();
    };

    void setupLiveOrders();
    return () => {
      active = false;
      if (orderChannel) void supabase.removeChannel(orderChannel);
    };
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
      setMessage(next ? 'کاپتن ئێستا ئۆنلاینە و ئۆردەرە نوێکان دەبینێت.' : 'کاپتن ئێستا ئۆفلاینە.');
      await load();
    }
    setOnlineBusy(false);
  };

  const startLocationTracking = async (orderId: string) => {
    if (watchIdsRef.current[orderId] != null) {
      setLocationTrackingOrderId(orderId);
      return;
    }
    if (!('geolocation' in navigator)) {
      setMessage('ئەم ئامێرە پشتگیری شوێنکەوتنی جی پی ئەس ناکات.');
      return;
    }
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      setMessage('پێویستە بچیتە ژوورەوە.');
      return;
    }

    setMessage('داوای مۆڵەتی شوێن دەکرێت...');
    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        const now = Date.now();
        const lastSent = lastLocationSentRef.current[orderId] || 0;
        if (now - lastSent < 10000) return;

        const { error } = await supabase.from('delivery_tracking_locations').upsert(
          {
            order_id: orderId,
            captain_id: authData.user.id,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy_m: position.coords.accuracy ?? null,
            heading: position.coords.heading ?? null,
            speed_mps: position.coords.speed ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'order_id' },
        );

        if (error) {
          setMessage(error.message);
          return;
        }

        lastLocationSentRef.current[orderId] = now;
        setCaptainLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setLocationTrackingOrderId(orderId);
        setMessage('شوێنی کاپتن بۆ کڕیار نوێ کرایەوە.');
      },
      (error) => {
        const reason =
          error.code === error.PERMISSION_DENIED
            ? 'مۆڵەتی شوێن دانراو نییە.'
            : error.code === error.POSITION_UNAVAILABLE
              ? 'شوێنی ئێستا بەردەست نییە.'
              : 'وەرگرتنی شوێن کاتی زۆری برد.';
        setMessage(reason + ' تکایە شوێنی ئامێر چالاک بکە.');
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
    );

    watchIdsRef.current[orderId] = watchId;
    setLocationTrackingOrderId(orderId);
    setMessage('شوێنکەوتنی نەخشە چالاک کرا.');
  };

  const stopLocationTracking = async (orderId: string, removeRemote = true) => {
    const watchId = watchIdsRef.current[orderId];
    if (watchId != null) {
      navigator.geolocation.clearWatch(watchId);
      delete watchIdsRef.current[orderId];
    }
    delete lastLocationSentRef.current[orderId];
    if (removeRemote) await supabase.from('delivery_tracking_locations').delete().eq('order_id', orderId);
    setLocationTrackingOrderId((current) => (current === orderId ? null : current));
    setCaptainLocation((current) => (locationTrackingOrderId === orderId ? null : current));
  };

  useEffect(
    () => () => {
      Object.values(watchIdsRef.current).forEach((watchId) => navigator.geolocation?.clearWatch(watchId));
    },
    [],
  );

  const todayKey = new Date().toLocaleDateString('en-CA');
  const completedOrders = orders.filter((order) => order.status === 'delivered');
  const activeOrders = orders.filter((order) => !['delivered', 'cancelled'].includes(order.status));
  const deliveredToday = completedOrders.filter(
    (order) =>
      new Date(order.delivered_at || order.updated_at || order.created_at).toLocaleDateString('en-CA') === todayKey,
  );
  const deliveryEarningsToday = deliveredToday.reduce((sum, order) => sum + Number(order.delivery_fee_iqd || 0), 0);

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

  const run = async (id: string, action: () => Promise<unknown>, success: string): Promise<boolean> => {
    setBusy(id);
    setMessage('');
    try {
      await action();
      setMessage(success);
      await load();
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'کردارەکە سەرکەوتوو نەبوو.');
      return false;
    } finally {
      setBusy(null);
    }
  };

  const openCustomerWhatsApp = (order: CaptainOrder, contact: CaptainCustomerContact) => {
    const phone = contact.whatsapp_phone || contact.phone;
    if (!phone) {
      setMessage('کڕیار ژمارەی واتسئاپی نییە.');
      return;
    }
    const text = buildWhatsAppOrderText({
      orderId: order.id,
      status: order.status,
      store: order.store || null,
      deliveryAddress: order.delivery_address || null,
      items: order.items || [],
      subtotal_iqd: order.subtotal_iqd,
      delivery_fee_iqd: order.delivery_fee_iqd,
      platform_fee_iqd: order.platform_fee_iqd,
      discount_iqd: order.discount_iqd,
      total_iqd: order.total_iqd,
      payment_method: order.payment_method,
      payment_status: order.payment_status,
      customer: contact,
    });
    window.open(buildWhatsAppUrl(phone, text), '_blank', 'noopener,noreferrer');
  };

  return (
    <section className="dashboard captainDashboard" dir="rtl">
      <div className="dashboardHeader">
        <div>
          <span className="eyebrow">داشبۆردی گەیاندن</span>
          <h2><Truck size={24} /> داشبۆردی کاپتن</h2>
          <p>ئۆردەرە نوێکان، وردەکاریی شوێن و زانیاریی گەیاندن لە یەک شوێن.</p>
        </div>
        <div className="captainHeaderActions">
          <button className={isOnline ? 'primary' : 'plain'} type="button" onClick={() => void toggleOnline()} disabled={onlineBusy}>
            {onlineBusy ? 'دۆخ...' : isOnline ? 'ئۆنلاین' : 'ئۆفلاین'}
          </button>
          <button className="plain" type="button" onClick={() => void load()} disabled={loading} aria-label="نوێکردنەوە">
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {message && <div className="msg" role="alert">{message}</div>}

      {!loading && (
        <div className="dashboardGrid captainStats">
          <div className="orderCard"><span className="eyebrow">ئۆردەرە چالاکەکان</span><strong className="captainStatNumber">{activeOrders.length}</strong></div>
          <div className="orderCard"><span className="eyebrow">گەیەندراوەکانی ئەمڕۆ</span><strong className="captainStatNumber">{deliveredToday.length}</strong></div>
          <div className="orderCard"><span className="eyebrow">کرێی گەیاندنی ئەمڕۆ</span><strong className="captainStatMoney">{deliveryEarningsToday.toLocaleString('ku-IQ')} دینار</strong></div>
        </div>
      )}

      <div className="dashboardGrid captainOrderGrid">
        {loading ? (
          <div className="empty">چاوەڕوان بە...</div>
        ) : activeOrders.length === 0 ? (
          <div className="empty"><PackageCheck size={38}/><h3>هیچ ئۆردەرێکی چالاک نییە</h3><p>کاتێک ئۆردەرێکی ئامادەی گەیاندن هەبێت، لێرە دەردەکەوێت.</p></div>
        ) : activeOrders.map((order) => (
          <article className="orderCard captainOrderCard" key={order.id}>
            <div className="orderCardTop">
              <strong>ئۆردەر #{order.id.slice(0, 8)}</strong>
              <span>{labels[order.status] || order.status}</span>
            </div>
            <div className="orderMeta"><Clock3 size={15}/> {new Date(order.created_at).toLocaleString('ku-IQ')}</div>

            <div className="captainPacketGrid">
              <div className="captainPacketSection">
                <div className="platformOrderSectionHead"><Truck size={15}/><b>دوکان</b></div>
                <strong>{order.store?.name || 'دوکان دیاری نەکراوە'}</strong>
                <span>{[order.store?.address, order.store?.city].filter(Boolean).join(' — ') || 'ناونیشانی دوکان نییە'}</span>
              </div>
              <div className="captainPacketSection">
                <div className="platformOrderSectionHead"><MapPin size={15}/><b>شوێنی وردی گەیاندن</b></div>
                <strong>{order.delivery_address?.address || 'شوێنی ورد دیاری نەکراوە'}</strong>
                <span>{order.delivery_address?.city || ''}</span>
              </div>
            </div>

            {order.delivery_address?.delivery_note && (
              <div className="orderNoteCard"><b>تێبینیی شوێن:</b><span>{order.delivery_address.delivery_note}</span></div>
            )}

            {order.delivery_address?.latitude != null && order.delivery_address?.longitude != null && (
              <div className="captainLocationActions">
                <a className="plain" href={'https://www.google.com/maps/dir/?api=1&destination=' + order.delivery_address.latitude + ',' + order.delivery_address.longitude} target="_blank" rel="noreferrer"><Navigation size={15}/> ڕێگا بۆ شوێنی گەیاندن</a>
                <span>GPS: {Number(order.delivery_address.latitude).toFixed(7)}, {Number(order.delivery_address.longitude).toFixed(7)}</span>
              </div>
            )}

            {order.items && order.items.length > 0 && (
              <div className="platformOrderItems">
                <div className="platformOrderSectionHead"><PackageCheck size={15}/><b>لیستی بەرهەمەکان</b></div>
                {order.items.map((item, index) => (
                  <div className="platformOrderItem" key={item.product_id || index}>
                    <span>{item.product_name} × {Number(item.quantity).toLocaleString('ku-IQ')}{optionText(item.options) ? ' — ' + optionText(item.options) : ''}</span>
                    <b>{(Number(item.unit_price_iqd) * Number(item.quantity)).toLocaleString('ku-IQ')} د.ع</b>
                  </div>
                ))}
              </div>
            )}

            <div className="platformOrderFinance captainFinance">
              <div><span>کۆی بەرهەم</span><b>{Number(order.subtotal_iqd || 0).toLocaleString('ku-IQ')} د.ع</b></div>
              <div><span>گەیاندن</span><b>{Number(order.delivery_fee_iqd || 0).toLocaleString('ku-IQ')} د.ع</b></div>
              <div><span>خزمەتی شاخ</span><b>{Number(order.platform_fee_iqd || 0).toLocaleString('ku-IQ')} د.ع</b></div>
              {Number(order.discount_iqd || 0) > 0 && <div><span>داشکاندن</span><b>-{Number(order.discount_iqd || 0).toLocaleString('ku-IQ')} د.ع</b></div>}
              <div className="grand"><span>کۆی گشتی</span><b>{Number(order.total_iqd || 0).toLocaleString('ku-IQ')} د.ع</b></div>
            </div>

            <div className="platformOrderMeta"><span>پارەدان: {order.payment_method || 'cash'} · {order.payment_status || 'pending'}</span></div>

            {(order.status === 'assigned_to_captain' || order.status === 'picked_up' || order.status === 'on_the_way') &&
              (order.store?.latitude != null || order.delivery_address?.latitude != null) && (
                <div className="captainOrderMapWrap">
                  <LiveDeliveryMap
                    store={order.store?.latitude != null && order.store?.longitude != null ? { latitude: Number(order.store.latitude), longitude: Number(order.store.longitude) } : null}
                    captain={locationTrackingOrderId === order.id ? captainLocation : null}
                    destination={order.delivery_address?.latitude != null && order.delivery_address?.longitude != null ? { latitude: Number(order.delivery_address.latitude), longitude: Number(order.delivery_address.longitude) } : null}
                  />
                </div>
              )}

            {order.status === 'ready_for_pickup' && (
              <button className="primary full" disabled={busy === order.id} onClick={() => void run(order.id, () => claimOrder(order.id), 'ئۆردەرەکە بە سەرکەوتوویی بۆ تۆ وەرگیرا.')}>
                {busy === order.id ? 'چاوەڕوان بە...' : 'وەرگرتنی ئۆردەر'}
              </button>
            )}
            {order.status === 'assigned_to_captain' && (
              <button className="primary full" disabled={busy === order.id} onClick={() => void run(order.id, () => updateOrderStatus(order.id, 'picked_up'), 'ئۆردەرەکە لە دوکان وەرگیرا.')}>وەرگرتن لە دوکان</button>
            )}
            {order.status === 'picked_up' && (
              <button className="primary full" disabled={busy === order.id} onClick={async () => {
                const ok = await run(order.id, () => markOrderOnTheWay(order.id), 'گەیاندن دەستی پێکرد.');
                if (ok) await startLocationTracking(order.id);
              }}>دەستپێکردنی گەیاندن و شوێنکەوتن</button>
            )}
            {order.status === 'on_the_way' && locationTrackingOrderId !== order.id && (
              <button className="plain full" type="button" onClick={() => void startLocationTracking(order.id)}>چالاککردنی شوێنکەوتنی نەخشە</button>
            )}
            {locationTrackingOrderId === order.id && (
              <div className="liveTrackingStatus" role="status">
                <div><span className="liveTrackingDot" /> شوێنی کاپتن زیندووە</div>
                <button type="button" className="plain" onClick={() => void stopLocationTracking(order.id, false)}>وەستاندن</button>
              </div>
            )}
            {order.status === 'on_the_way' && (
              <button className="primary full" disabled={busy === order.id} onClick={async () => {
                const ok = await run(order.id, () => markOrderDelivered(order.id), 'گەیاندن بە سەرکەوتوویی تەواو بوو.');
                if (ok) await stopLocationTracking(order.id, true);
              }}>تەواوکردنی گەیاندن</button>
            )}

            {order.status !== 'delivered' && (
              <>
                {!contacts[order.id] && (
                  <button className="plain full" type="button" disabled={contactBusy === order.id} onClick={() => void loadCustomerContact(order.id)}>
                    {contactBusy === order.id ? 'وەرگرتنی زانیاری...' : 'پیشاندانی پەیوەندیی کڕیار'}
                  </button>
                )}
                {contacts[order.id] && (
                  <div className="captainCustomerContactCard">
                    <div><UserRound size={16}/><span><b>کڕیار:</b> {contacts[order.id]?.full_name || 'ناوی دیاری نەکراوە'}</span></div>
                    <div className="captainContactActions">
                      {contacts[order.id]?.phone && <a href={'tel:' + contacts[order.id]?.phone}><Phone size={15}/> {contacts[order.id]?.phone}</a>}
                      {(contacts[order.id]?.whatsapp_phone || contacts[order.id]?.phone) && <button type="button" className="whatsappSendButton" onClick={() => openCustomerWhatsApp(order, contacts[order.id] as CaptainCustomerContact)}><MessageCircle size={15}/> واتسئاپی کڕیار</button>}
                    </div>
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
            <div><span className="eyebrow">مێژووی گەیاندن</span><h3><PackageCheck size={20}/> {completedOrders.length} ئۆردەری گەیەندراو</h3></div>
          </div>
          <div className="dashboardGrid">
            {completedOrders.slice(0, 20).map((order) => (
              <article className="orderCard captainOrderCard" key={order.id}>
                <div className="orderCardTop"><strong>ئۆردەر #{order.id.slice(0, 8)}</strong><span>{labels[order.status]}</span></div>
                <div className="orderMeta"><Clock3 size={15}/> گەیەندرا: {new Date(order.delivered_at || order.updated_at || order.created_at).toLocaleString('ku-IQ')}</div>
                <div className="captainPacketGrid">
                  <div className="captainPacketSection"><div className="platformOrderSectionHead"><Truck size={15}/><b>دوکان</b></div><strong>{order.store?.name || 'دوکان'}</strong><span>{[order.store?.address, order.store?.city].filter(Boolean).join(' — ') || '—'}</span></div>
                  <div className="captainPacketSection"><div className="platformOrderSectionHead"><MapPin size={15}/><b>گەیاندن</b></div><strong>{order.delivery_address?.address || '—'}</strong><span>{order.delivery_address?.city || ''}{order.delivery_address?.delivery_note ? ' — ' + order.delivery_address.delivery_note : ''}</span></div>
                </div>
                <div className="orderTotal">{Number(order.total_iqd || 0).toLocaleString('ku-IQ')} دینار</div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
