import React,{useEffect,useState} from 'react';
import { Package, ShoppingBag, TrendingUp, Store, Plus, RefreshCw } from 'lucide-react';
import VendorLiveOrders from './VendorLiveOrders';
import './vendor-dashboard.css';
import ProductPostComposer from './ProductPostComposer';
import ProductManagement from './ProductManagement';
import StoreLocationManager from './StoreLocationManager';

type VendorDashboardProps = {
  storeId?: string;
  storeName?: string;
  productCount?: number;
  pendingOrders?: number;
  todaySales?: number;
  onRefresh?: () => void;
  userId?: string;
  role?: string;
};

export default function VendorDashboard({
  storeId,
  storeName = 'دوکانی من',
  productCount = 0,
  pendingOrders = 0,
  todaySales = 0,
  onRefresh,
  userId,
  role,
}: VendorDashboardProps) {
  const [resolvedStoreId,setResolvedStoreId]=useState(storeId||'');
  const [postAnchor,setPostAnchor]=useState<HTMLDivElement|null>(null);
  useEffect(()=>{let live=true;if(storeId){setResolvedStoreId(storeId);return()=>{live=false}};if(!userId||!role)return;const categoryMap:Record<string,string>={restaurant_vendor:'restaurant',supermarket_vendor:'supermarket',fashion_vendor:'fashion',vendor:'daily',electronics_vendor:'electronics',jewelry_vendor:'jewelry'};const category=categoryMap[role]||'';if(!category)return;import('../lib/supabase').then(({supabase})=>supabase.from('stores').select('id,name').eq('owner_id',userId).eq('category',category).eq('is_active',true).limit(1).maybeSingle()).then(({data})=>{if(live&&data){setResolvedStoreId(data.id);}}).catch(()=>{});return()=>{live=false}},[storeId,userId,role]);
  return (
    <section className="vendor-dashboard" dir="rtl">
      <div className="vendor-dashboard__header">
        <div>
          <span className="vendor-dashboard__eyebrow">داشبۆردی خاوەن دوکان</span>
          <h2>{storeName}</h2>
          <p>بەڕێوەبردنی بەرهەم و داواکارییەکانی دوکان لە یەک شوێن.</p>
        </div>
        <div className="vendor-dashboard__actions">
          <button className="vendor-dashboard__secondary" onClick={onRefresh} type="button"><RefreshCw size={17} /> نوێکردنەوە</button>
          <button className="vendor-dashboard__primary" type="button" onClick={()=>postAnchor?.scrollIntoView({behavior:'smooth',block:'start'})}><Plus size={17} /> زیادکردنی بەرهەم</button>
        </div>
      </div>
      <div className="vendor-dashboard__stats">
        <article><Package /><span>بەرهەمەکان</span><strong>{productCount.toLocaleString('ku-IQ')}</strong></article>
        <article><ShoppingBag /><span>داواکارییە چاوەڕوانەکان</span><strong>{pendingOrders.toLocaleString('ku-IQ')}</strong></article>
        <article><TrendingUp /><span>فرۆشی ئەمڕۆ</span><strong>{todaySales.toLocaleString('ku-IQ')} د.ع</strong></article>
        <article><Store /><span>دۆخی دوکان</span><strong className="is-live">چالاک</strong></article>
      </div>
      {resolvedStoreId ? <VendorLiveOrders storeId={resolvedStoreId} /> : <div className="vendor-dashboard__empty"><ShoppingBag size={42} /><h3>دوکانەکەت دیاری نەکراوە</h3><p>بۆ پیشاندانی ئۆردەرە زیندووەکان، دەبێت ناسنامەی دوکان بۆ داشبۆرد بنێردرێت.</p></div>}
      {userId && role && <><div ref={setPostAnchor}><ProductPostComposer userId={userId} role={role} onSaved={onRefresh} /></div><ProductManagement userId={userId} role={role} onChanged={onRefresh} />{resolvedStoreId && <StoreLocationManager storeId={resolvedStoreId} userId={userId} />}</>}
    </section>
  );
}
