import { useEffect, useState } from 'react';
import { ChefHat, RefreshCw, Store } from 'lucide-react';
import { supabase } from '../lib/supabase';
import VendorLiveOrders from './VendorLiveOrders';

type Props = { userId: string };

export default function RestaurantOrdersPanel({ userId }: Props) {
  const [storeId, setStoreId] = useState('');
  const [storeName, setStoreName] = useState('چێشتخانەکەم');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true); setMessage('');
      const { data, error } = await supabase
        .from('stores').select('id,name').eq('owner_id', userId).eq('category', 'restaurant').eq('is_active', true).limit(1).maybeSingle();
      if (!active) return;
      if (error) { setMessage(error.message); setLoading(false); return; }
      setStoreId(data?.id || ''); setStoreName(data?.name || 'چێشتخانەکەم'); setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [userId]);

  if (loading) return <section className="restaurantOrdersRoute" dir="rtl"><div className="restaurantOrdersRouteState"><RefreshCw className="is-spinning" size={20} /> ئۆردەرەکانی چێشتخانە بار دەکرێن...</div></section>;
  if (message) return <section className="restaurantOrdersRoute" dir="rtl"><div className="msg" role="alert">{message}</div></section>;
  if (!storeId) return <section className="restaurantOrdersRoute" dir="rtl"><div className="restaurantOrdersRouteState"><Store size={32} /><ChefHat size={22} /><h3>{storeName}</h3><p>چێشتخانەیەکی چالاک نەدۆزرایەوە؛ تکایە زانیاریی دوکان و هەژمارەکەت بپشکنە.</p></div></section>;

  return <section className="restaurantOrdersRoute" dir="rtl"><VendorLiveOrders storeId={storeId} /></section>;
}
