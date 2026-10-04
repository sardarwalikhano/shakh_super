import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChefHat, MapPin, Package, RefreshCw, Truck, UserRound, XCircle } from 'lucide-react';
import { getVendorOrders, subscribeToVendorOrders, updateVendorOrderStatus, type VendorOrder } from '../lib/vendorOrders';
import LiveDeliveryMap from './LiveDeliveryMap';

const labels: Record<string, string> = {
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

const actions: Record<string, { status: string; label: string; icon: React.ReactNode }[]> = {
  pending: [{ status: 'accepted', label: 'قبوڵکردن', icon: <CheckCircle2 size={16} /> }],
  accepted: [{ status: 'preparing', label: 'دەستپێکردنی ئامادەکردن', icon: <ChefHat size={16} /> }],
  preparing: [{ status: 'ready_for_pickup', label: 'ئامادەی وەرگرتن', icon: <Package size={16} /> }],
};

type Props = { storeId: string };

export default function VendorLiveOrders({ storeId }: Props) {
  const [orders, setOrders] = useState<VendorOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextOrders = await getVendorOrders(storeId);
      setOrders(nextOrders);
      setSelectedId((current) => current && nextOrders.some((order) => order.id === current) ? current : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'نەتوانرا ئۆردەرەکان وەربگیرێن');
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    void load();
    return subscribeToVendorOrders(storeId, () => void load());
  }, [load, storeId]);

  const changeStatus = async (orderId: string, status: string) => {
    setBusy(orderId);
    setError(null);
    try {
      await updateVendorOrderStatus(orderId, status);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'نەتوانرا دۆخی ئۆردەر بگۆڕدرێت');
    } finally {
      setBusy(null);
    }
  };

  const stats = useMemo(() => ({
    active: orders.filter((o) => !['delivered', 'cancelled'].includes(o.status)).length,
    sales: orders.filter((o) => o.status !== 'cancelled').reduce((sum, o) => sum + Number(o.subtotal_iqd || 0), 0),
    platformFees: orders.filter((o) => o.status !== 'cancelled').reduce((sum, o) => sum + Number(o.platform_fee_iqd || 0), 0),
  }), [orders]);

  if (loading) return <div dir="rtl"><RefreshCw className="animate-spin" /> ئۆردەرەکان بار دەکرێن...</div>;

  const selected = useMemo(() => orders.find((order) => order.id === selectedId) ?? null, [orders, selectedId]);

  return (
    <section dir="rtl" className="compactOrderRoute" aria-label="ئۆردەرەکانی دوکان">
      <div className="compactOrderHeader">
        <div>
          <small>بازاڕ و مامەڵە</small>
          <h3>ئۆردەرەکان</h3>
          <p>{stats.active.toLocaleString('ku-IQ')} ئۆردەری چالاک</p>
        </div>
        <button type="button" className="plain" onClick={() => void load()} disabled={loading} aria-label="نوێکردنەوە"><RefreshCw size={17} /></button>
      </div>

      <div className="dashCards compactOrderStats" style={{ marginTop: 10 }}>
        <div><b>{stats.active.toLocaleString('ku-IQ')}</b><span>چالاک</span></div>
        <div><b>{stats.sales.toLocaleString('ku-IQ')}</b><span>کۆی بەرهەم</span></div>
        <div><b>{stats.platformFees.toLocaleString('ku-IQ')}</b><span>خزمەتی شاخ</span></div>
      </div>

      {error && <p role="alert" className="msg">{error}</p>}

      {orders.length === 0 ? (
        <p className="empty">هیچ ئۆردەرێکی ئەم دوکانە نییە.</p>
      ) : (
        <div className="compactOrderWorkspace">
          <div className="compactOrderList" aria-label="لیستی ئۆردەرەکان">
            {orders.map((order) => (
              <button
                type="button"
                key={order.id}
                className={selectedId === order.id ? 'compactOrderRow is-selected' : 'compactOrderRow'}
                onClick={() => setSelectedId(order.id)}
              >
                <span className="compactOrderAvatar"><UserRound size={17} /></span>
                <span className="compactOrderIdentity">
                  <strong>{order.customer?.full_name || 'کڕیار'}</strong>
                  <small>#{order.id.slice(0, 8)}</small>
                </span>
                <span className="compactOrderStatus">{labels[order.status] ?? order.status}</span>
              </button>
            ))}
          </div>

          <div className="compactOrderDetail" aria-live="polite">
            {!selected ? (
              <div className="compactOrderEmpty">
                <Package size={34} />
                <strong>ئۆردەرێک هەڵبژێرە</strong>
                <span>کاتێک لە لیستەکە کلیک بکەیت، هەموو وردەکارییەکانی ئەو ئۆردەرە لێرە پیشان دەدرێت.</span>
              </div>
            ) : (
              <>
                <div className="compactOrderDetailHead">
                  <div>
                    <small>وردەکاریی ئۆردەر</small>
                    <h4>{selected.customer?.full_name || 'کڕیار'} · #{selected.id.slice(0, 8)}</h4>
                    <span>{labels[selected.status] ?? selected.status} · {new Date(selected.created_at).toLocaleString('ku-IQ')}</span>
                  </div>
                </div>

                {selected.items.length > 0 && (
                  <div className="compactOrderSection">
                    <div className="compactOrderSectionTitle"><Package size={16} /> بەرهەمەکان</div>
                    {selected.items.map((item, index) => (
                      <div className="compactOrderLine" key={item.product_id ?? index}>
                        <span>{item.product_name} × {Number(item.quantity).toLocaleString('ku-IQ')}</span>
                        <b>{(Number(item.unit_price_iqd) * Number(item.quantity)).toLocaleString('ku-IQ')} د.ع</b>
                      </div>
                    ))}
                  </div>
                )}

                {selected.delivery_address?.address && (
                  <div className="compactOrderSection">
                    <div className="compactOrderSectionTitle"><MapPin size={16} /> شوێنی گەیاندن</div>
                    <div className="compactOrderText"><strong>{selected.delivery_address.address}</strong><span>{selected.delivery_address.city || ''}</span></div>
                    {selected.delivery_address.delivery_note && <small>{selected.delivery_address.delivery_note}</small>}
                    {selected.delivery_address.latitude != null && selected.delivery_address.longitude != null && (
                      <a className="plain full" href={'https://www.google.com/maps/dir/?api=1&destination='+selected.delivery_address.latitude+','+selected.delivery_address.longitude} target="_blank" rel="noreferrer">کردنەوەی شوێنی گەیاندن</a>
                    )}
                  </div>
                )}

                {selected.store?.latitude != null && selected.store?.longitude != null && (
                  <div className="compactOrderSection">
                    <div className="compactOrderSectionTitle"><MapPin size={16} /> شوێنی دوکان</div>
                    <LiveDeliveryMap store={{ latitude: Number(selected.store.latitude), longitude: Number(selected.store.longitude) }} />
                  </div>
                )}

                <div className="compactOrderSection compactOrderSummary">
                  <div className="compactOrderLine"><span>کۆی بەرهەم</span><b>{Number(selected.subtotal_iqd).toLocaleString('ku-IQ')} د.ع</b></div>
                  <div className="compactOrderLine"><span>گەیاندن</span><b>{Number(selected.delivery_fee_iqd).toLocaleString('ku-IQ')} د.ع</b></div>
                  <div className="compactOrderLine"><span>خزمەتی شاخ</span><b>{Number(selected.platform_fee_iqd).toLocaleString('ku-IQ')} د.ع</b></div>
                  <div className="compactOrderLine is-grand"><span>کۆی گشتی</span><b>{Number(selected.total_iqd).toLocaleString('ku-IQ')} د.ع</b></div>
                </div>

                {actions[selected.status]?.map((action) => (
                  <button key={action.status} className="primary full compactOrderAction" type="button" disabled={busy === selected.id} onClick={() => void changeStatus(selected.id, action.status)}>
                    {action.icon}{action.label}
                  </button>
                ))}

                {selected.status === 'ready_for_pickup' && <div className="compactOrderNotice"><Truck size={16} /> چاوەڕێی کاپتن</div>}
                {selected.status === 'cancelled' && <div className="compactOrderNotice is-danger"><XCircle size={16} /> هەڵوەشێنراوەتەوە</div>}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
