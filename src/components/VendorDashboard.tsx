import React,{useEffect,useState} from 'react';
import { Package, ShoppingBag, TrendingUp, Store, Plus, RefreshCw } from 'lucide-react';
import VendorLiveOrders from './VendorLiveOrders';
import { supabase } from '../lib/supabase';
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
  const [resolvedStoreName,setResolvedStoreName]=useState(storeName);
  const [vendorProductCount,setVendorProductCount]=useState(productCount);
  const [vendorPendingOrders,setVendorPendingOrders]=useState(pendingOrders);
  const [vendorTodaySales,setVendorTodaySales]=useState(todaySales);
  const [postAnchor,setPostAnchor]=useState<HTMLDivElement|null>(null);
  useEffect(()=>{let live=true;const resolve=async()=>{let sid=storeId||'';let sname=storeName;if(!sid&&userId&&role){const categoryMap:Record<string,string>={restaurant_vendor:'restaurant',supermarket_vendor:'supermarket',fashion_vendor:'fashion',vendor:'daily',electronics_vendor:'electronics',jewelry_vendor:'jewelry'};const category=categoryMap[role]||'';if(category){const {data}=await supabase.from('stores').select('id,name').eq('owner_id',userId).eq('category',category).eq('is_active',true).limit(1).maybeSingle();if(data){sid=data.id;sname=data.name||sname;}}}if(!live)return;if(!sid){setResolvedStoreId('');return}setResolvedStoreId(sid);setResolvedStoreName(sname);const [productCountResult,ordersResult]=await Promise.all([supabase.from('products').select('id',{count:'exact',head:true}).eq('store_id',sid),supabase.from('orders').select('status,subtotal_iqd,created_at').eq('store_id',sid).order('created_at',{ascending:false}).limit(200)]);if(!live)return;if(!productCountResult.error)setVendorProductCount(productCountResult.count||0);if(!ordersResult.error){const rows=(ordersResult.data||[]) as {status:string;subtotal_iqd:number|string;created_at:string}[];setVendorPendingOrders(rows.filter(o=>o.status==='pending').length);const today=new Date();const y=today.getFullYear(),m=today.getMonth(),d=today.getDate();setVendorTodaySales(rows.filter(o=>o.status==='delivered').filter(o=>{const dt=new Date(o.created_at);return dt.getFullYear()===y&&dt.getMonth()===m&&dt.getDate()===d}).reduce((sum,o)=>sum+Number(o.subtotal_iqd||0),0));}};void resolve();return()=>{live=false}},[storeId,storeName,userId,role]);
  return (
    <section className="vendor-dashboard" dir="rtl">
      <div className="vendor-dashboard__header">
        <div>
          <span className="vendor-dashboard__eyebrow">داشبۆردی خاوەن دوکان</span>
          <h2>{resolvedStoreName}</h2>
          <p>بەڕێوەبردنی بەرهەم و داواکارییەکانی دوکان لە یەک شوێن.</p>
        </div>
        <div className="vendor-dashboard__actions">
          <button className="vendor-dashboard__secondary" onClick={onRefresh} type="button"><RefreshCw size={17} /> نوێکردنەوە</button>
          <button className="vendor-dashboard__primary" type="button" onClick={()=>postAnchor?.scrollIntoView({behavior:'smooth',block:'start'})}><Plus size={17} /> زیادکردنی بەرهەم</button>
        </div>
      </div>
      <div className="vendor-dashboard__stats">
        <article><Package /><span>بەرهەمەکان</span><strong>{vendorProductCount.toLocaleString('ku-IQ')}</strong></article>
        <article><ShoppingBag /><span>داواکارییە چاوەڕوانەکان</span><strong>{vendorPendingOrders.toLocaleString('ku-IQ')}</strong></article>
        <article><TrendingUp /><span>فرۆشی ئەمڕۆ</span><strong>{vendorTodaySales.toLocaleString('ku-IQ')} د.ع</strong></article>
        <article><Store /><span>دۆخی دوکان</span><strong className="is-live">چالاک</strong></article>
      </div>
      {resolvedStoreId ? <VendorLiveOrders storeId={resolvedStoreId} /> : <div className="vendor-dashboard__empty"><ShoppingBag size={42} /><h3>دوکانەکەت دیاری نەکراوە</h3><p>بۆ پیشاندانی ئۆردەرە زیندووەکان، دەبێت ناسنامەی دوکان بۆ داشبۆرد بنێردرێت.</p></div>}
      {userId && role && <><div ref={setPostAnchor}><ProductPostComposer userId={userId} role={role} onSaved={onRefresh} /></div><ProductManagement userId={userId} role={role} onChanged={onRefresh} />{resolvedStoreId && <StoreLocationManager storeId={resolvedStoreId} userId={userId} />}</>}
    </section>
  );
}
