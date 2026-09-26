import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChefHat, Package, RefreshCw, Truck, XCircle } from 'lucide-react';
import { getVendorOrders, subscribeToVendorOrders, updateVendorOrderStatus, type VendorOrder } from '../lib/vendorOrders';

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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setOrders(await getVendorOrders(storeId));
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

  return (
    <section dir="rtl" aria-label="ئۆردەرەکانی دوکان">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <div>
          <h3 style={{ margin: 0 }}>ئۆردەرە زیندووەکان</h3>
          <small>{stats.active.toLocaleString('ku-IQ')} ئۆردەری چالاک</small>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} aria-label="نوێکردنەوە"><RefreshCw size={17} /></button>
      </div>

      <div className="dashCards" style={{ marginTop: 12 }}>
        <div><b>{stats.active.toLocaleString('ku-IQ')}</b><span>چالاک</span></div>
        <div><b>{stats.sales.toLocaleString('ku-IQ')}</b><span>کۆی بەرهەم</span></div>
        <div><b>{stats.platformFees.toLocaleString('ku-IQ')}</b><span>خزمەتی شاخ</span></div>
      </div>

      {error && <p role="alert" className="msg">{error}</p>}
      {orders.length === 0 ? (
        <p className="empty">هیچ ئۆردەرێکی ئەم دوکانە نییە.</p>
      ) : (
        <div className="orderList" style={{ marginTop: 12 }}>
          {orders.map((order) => (
            <article className="orderCard" key={order.id}>
              <div className="orderCardTop">
                <div>
                  <strong>#{order.id.slice(0, 8)}</strong>
                  <small>{new Date(order.created_at).toLocaleString('ku-IQ')}</small>
                </div>
                <span>{labels[order.status] ?? order.status}</span>
              </div>

              {order.items.length > 0 && (
                <div style={{ marginTop: 10, display: 'grid', gap: 7 }}>
                  {order.items.map((item, index) => (
                    <div key={item.product_id ?? index} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <span>{item.product_name} × {Number(item.quantity).toLocaleString('ku-IQ')}</span>
                      <b>{(Number(item.unit_price_iqd) * Number(item.quantity)).toLocaleString('ku-IQ')} د.ع</b>
                    </div>
                  ))}
                </div>
              )}

              <div className="summary" style={{ marginTop: 10 }}>
                <div><span>کۆی بەرهەم</span><b>{Number(order.subtotal_iqd).toLocaleString('ku-IQ')} د.ع</b></div>
                <div><span>گەیاندن</span><b>{Number(order.delivery_fee_iqd).toLocaleString('ku-IQ')} د.ع</b></div>
                <div><span>خزمەتی شاخ</span><b>{Number(order.platform_fee_iqd).toLocaleString('ku-IQ')} د.ع</b></div>
                <div className="grand"><span>کۆی گشتی</span><b>{Number(order.total_iqd).toLocaleString('ku-IQ')} د.ع</b></div>
              </div>

              {actions[order.status]?.map((action) => (
                <button key={action.status} className="primary" type="button" style={{ marginTop: 10 }} disabled={busy === order.id} onClick={() => void changeStatus(order.id, action.status)}>
                  {action.icon}{action.label}
                </button>
              ))}

              {order.status === 'ready_for_pickup' && <span style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 10 }}><Truck size={16} /> چاوەڕێی کاپتن</span>}
              {order.status === 'cancelled' && <span style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 10 }}><XCircle size={16} /> هەڵوەشێنراوەتەوە</span>}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
