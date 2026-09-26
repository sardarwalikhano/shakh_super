import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, CheckCheck, Clock3, Package, RefreshCw } from 'lucide-react';
import { getMyNotifications, markNotificationRead, subscribeToMyNotifications } from '../lib/orderTracking';

type NotificationItem = {
  id: string;
  title: string;
  body: string | null;
  type: string | null;
  is_read: boolean;
  data: Record<string, unknown> | null;
  created_at: string;
};

type NotificationCenterProps = {
  userId: string;
};

export default function NotificationCenter({ userId }: NotificationCenterProps) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMyNotifications();
      setItems(data as NotificationItem[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'نەتوانرا ئاگادارکردنەوەکان بهێنرێن.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return subscribeToMyNotifications(userId, () => void load());
  }, [load, userId]);

  const unreadCount = useMemo(() => items.filter((item) => !item.is_read).length, [items]);

  const read = async (id: string) => {
    setBusy(id);
    try {
      await markNotificationRead(id);
      setItems((current) => current.map((item) => item.id === id ? { ...item, is_read: true } : item));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'نەتوانرا ئاگادارکردنەوەکە بخوێندرێتەوە.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="notification-center" dir="rtl" aria-label="ئاگادارکردنەوەکان">
      <header className="notification-center__header">
        <div>
          <span className="notification-center__eyebrow"><Bell size={16} /> ئاگادارکردنەوەکان</span>
          <h2>نوێترین ئاگادارکردنەوەکان</h2>
          <p>{unreadCount > 0 ? `${unreadCount.toLocaleString('ku-IQ')} ئاگادارکردنەوەی نەخوێندراوە هەیە.` : 'هەموو ئاگادارکردنەوەکانت خوێندراونەتەوە.'}</p>
        </div>
        <button type="button" className="notification-center__refresh" onClick={() => void load()} disabled={loading} aria-label="نوێکردنەوە">
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </header>

      {error && <div className="notification-center__error" role="alert">{error}</div>}

      {loading ? (
        <div className="notification-center__empty"><RefreshCw className="animate-spin" /><span>ئاگادارکردنەوەکان بار دەکرێن...</span></div>
      ) : items.length === 0 ? (
        <div className="notification-center__empty"><Bell size={40} /><strong>هیچ ئاگادارکردنەوەیەک نییە</strong><span>کاتێک ئۆردەرەکەت نوێ بکرێتەوە، لێرە دەردەکەوێت.</span></div>
      ) : (
        <div className="notification-center__list">
          {items.map((item) => {
            const orderId = typeof item.data?.order_id === 'string' ? item.data.order_id : null;
            return (
              <article key={item.id} className={`notification-center__item ${item.is_read ? 'is-read' : 'is-unread'}`}>
                <div className="notification-center__icon"><Package size={20} /></div>
                <div className="notification-center__content">
                  <div className="notification-center__title-row"><strong>{item.title}</strong>{!item.is_read && <span>نوێ</span>}</div>
                  {item.body && <p>{item.body}</p>}
                  <small><Clock3 size={14} /> {new Date(item.created_at).toLocaleString('ku-IQ')}{orderId ? ` · #${orderId.slice(0, 8)}` : ''}</small>
                </div>
                {!item.is_read && <button type="button" onClick={() => void read(item.id)} disabled={busy === item.id} aria-label="خوێندراوە بکە"><CheckCheck size={18} /></button>}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
