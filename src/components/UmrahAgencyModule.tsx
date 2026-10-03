import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {supabase} from '../lib/supabase';
import {CalendarDays,CheckCircle2,ClipboardList,MapPin,RefreshCw,ShieldCheck,Users,WalletCards} from 'lucide-react';
type Trip={id:string;title:string;destination?:string|null;departure_date?:string|null;return_date?:string|null;total_price_iqd?:number|null;capacity?:number|null;available_seats?:number|null;status?:string|null};
type Booking={id:string;status?:string|null;booking_payment_status?:string|null;travel_payment_status?:string|null;booking_fee_iqd?:number|null;travel_payment_iqd?:number|null;passenger_name?:string|null;created_at:string};
const money=(n:number)=>Number(n||0).toLocaleString('ku-IQ')+' د.ع';
const status=(s?:string|null)=>String(s||'').toLowerCase();
export default function UmrahAgencyModule(){
 const [agency,setAgency]=useState<any>(null),[trips,setTrips]=useState<Trip[]>([]),[bookings,setBookings]=useState<Booking[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const load=useCallback(async()=>{
  setLoading(true);setError('');
  try{
   const {data:ur}=await supabase.auth.getUser();const uid=ur.user?.id;if(!uid)throw new Error('هەژمارەکە بەردەست نییە.');
   const {data:a,error:ae}=await supabase.from('umrah_agencies').select('id,business_name,license_number,phone,city,address,is_active,approved_at,description').eq('owner_id',uid).maybeSingle();if(ae)throw ae;
   setAgency(a);
   if(!a){setTrips([]);setBookings([]);return;}
   const [{data:td,error:te},{data:bd,error:be}]=await Promise.all([
    supabase.from('umrah_trips').select('id,title,destination,departure_date,return_date,total_price_iqd,capacity,available_seats,status').eq('agency_id',a.id).order('departure_date',{ascending:true}).limit(100),
    supabase.from('umrah_bookings').select('id,status,booking_payment_status,travel_payment_status,booking_fee_iqd,travel_payment_iqd,passenger_name,created_at').eq('agency_id',a.id).order('created_at',{ascending:false}).limit(100)
   ]);
   if(te)throw te;if(be)throw be;setTrips(td||[]);setBookings(bd||[]);
  }catch(e){setError(e instanceof Error?e.message:'نەتوانرا زانیارییەکانی عومرە وەرگیرێن.');}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{void load();const ch=supabase.channel('shakh-umrah-agency').on('postgres_changes',{event:'*',schema:'public',table:'umrah_trips'},()=>void load()).on('postgres_changes',{event:'*',schema:'public',table:'umrah_bookings'},()=>void load()).subscribe();return()=>{void supabase.removeChannel(ch);};},[load]);
 const stats=useMemo(()=>({trips:trips.length,active:trips.filter(t=>!['cancelled','archived','rejected','completed'].includes(status(t.status))).length,bookings:bookings.length,pending:bookings.filter(b=>['pending','review','awaiting_payment'].includes(status(b.status))).length,revenue:bookings.reduce((s,b)=>s+Number(b.travel_payment_iqd||0)+Number(b.booking_fee_iqd||0),0),seats:trips.reduce((s,t)=>s+Number(t.available_seats||0),0)}),[trips,bookings]);
 const nav=(v:string)=>window.dispatchEvent(new CustomEvent('shakh-dashboard-navigate',{detail:v}));
 return <section className="umrahAgencyCenter" dir="rtl">
  <div className="umrahAgencyHero"><div><span>SHAKH UMRAH • AGENCY</span><h2>ناوەندی بەڕێوەبردنی عومرە</h2><p>گەشتەکان، حجزەکان، شوێنە بەردەستەکان و پارەدانەکان لەسەر داتای ڕاستەقینەی Supabase.</p></div><button type="button" onClick={()=>void load()} disabled={loading}><RefreshCw size={16}/> نوێکردنەوە</button></div>
  {error&&<div className="umrahAgencyAlert">{error}</div>}
  {!agency&&!loading&&!error&&<div className="umrahAgencyEmpty"><ShieldCheck size={28}/><strong>پروفایلی ئاژانسی عومرە نەدۆزرایەوە</strong><small>پێش بەڕێوەبردنی گەشتەکان، پڕۆفایلی ئاژانس پێویستە.</small></div>}
  {agency&&<><div className="umrahAgencyIdentity"><div><small>ئاژانسی تۆ</small><h3>{agency.business_name||'ئاژانسی بێ ناو'}</h3><p>{[agency.city,agency.phone].filter(Boolean).join(' • ')||'زانیاریی پەیوەندی تۆمار نەکراوە'}</p></div><span className={agency.is_active?'is-active':''}>{agency.is_active?'چالاک':'ناچالاک'}</span></div>
  <div className="umrahAgencyStats">
   <article><span><CalendarDays/></span><small>هەموو گەشتەکان</small><strong>{stats.trips.toLocaleString('ku-IQ')}</strong></article>
   <article><span><CheckCircle2/></span><small>گەشتی چالاک</small><strong>{stats.active.toLocaleString('ku-IQ')}</strong></article>
   <article><span><ClipboardList/></span><small>حجزەکان</small><strong>{stats.bookings.toLocaleString('ku-IQ')}</strong></article>
   <article><span><ShieldCheck/></span><small>حجزی چاوەڕوان</small><strong>{stats.pending.toLocaleString('ku-IQ')}</strong></article>
   <article><span><Users/></span><small>شوێنی بەردەست</small><strong>{stats.seats.toLocaleString('ku-IQ')}</strong></article>
   <article><span><WalletCards/></span><small>کۆی پارەی تۆمارکراو</small><strong>{money(stats.revenue)}</strong></article>
  </div>
  <div className="umrahAgencyPanels"><div className="umrahAgencyPanel"><small>بەڕێوەبردن</small><h3>کردارە خێراکان</h3><div className="umrahAgencyActions">
   <button type="button" onClick={()=>nav('publish_post')}><CalendarDays/> بڵاوکردنەوەی گەشتی عومرە</button>
   <button type="button" onClick={()=>nav('manage_posts')}><ClipboardList/> ناوەڕۆک و پۆستەکان</button>
   <button type="button" onClick={()=>nav('orders')}><Users/> حجزەکان</button>
   <button type="button" onClick={()=>nav('wallet')}><WalletCards/> پارە و جزدان</button>
  </div></div>
  <div className="umrahAgencyPanel"><div className="umrahAgencyPanelHead"><div><small>گەشتەکانی ئاژانس</small><h3>دواین گەشتەکان</h3></div><span>{trips.slice(0,6).length.toLocaleString('ku-IQ')} دانە</span></div><div className="umrahAgencyTrips">{trips.slice(0,6).map(t=><article key={t.id}><div><strong>{t.title||'گەشتی بێ ناونیشان'}</strong><small>{[t.destination,t.departure_date,t.return_date].filter(Boolean).join(' • ')}</small></div><div><b>{t.total_price_iqd?money(Number(t.total_price_iqd)):'نرخ دانەنراوە'}</b><small>{Number(t.available_seats||0).toLocaleString('ku-IQ')} شوێن بەردەست</small></div></article>)}{!trips.length&&<div className="umrahAgencyEmpty"><MapPin size={24}/><strong>هێشتا گەشتێک نییە</strong><small>یەکەم گەشتەکەت بڵاو بکەرەوە.</small></div>}</div></div></div></>}
 </section>;
}