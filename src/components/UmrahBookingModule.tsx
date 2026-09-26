import React, { useEffect, useState } from 'react';
import { CalendarDays, CheckCircle2, CreditCard, FileText, Plane, Plus, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Props = { userId: string; role: string };
type Trip = { id:string; agency_id:string; title:string; destination:string; departure_date:string; return_date?:string|null; total_price_iqd:number; booking_fee_iqd:number; capacity?:number|null; available_seats?:number|null; status:string };
type Booking = { id:string; trip_id:string; agency_id:string; customer_id:string; passenger_name:string; phone?:string|null; passport_number?:string|null; passport_issue_date?:string|null; booking_fee_iqd:number; booking_payment_status:string; travel_payment_iqd:number; travel_payment_due_date?:string|null; travel_payment_status:string; status:string };

const today = () => new Date().toISOString().slice(0,10);
const statusText: Record<string,string> = { pending_payment:'چاوەڕوانی پارەی حجز', confirmed:'حجزکراو', documents_pending:'چاوەڕوانی بەڵگەنامە', travel_payment_due:'پارەی سەفەر داواکراوە', ready_for_travel:'ئامادەی سەفەر', completed:'تەواوبوو', cancelled:'هەڵوەشێنراوە' };

export default function UmrahBookingModule({ userId, role }: Props) {
  const [trips,setTrips]=useState<Trip[]>([]); const [bookings,setBookings]=useState<Booking[]>([]); const [agency,setAgency]=useState<any>(null); const [loading,setLoading]=useState(true); const [message,setMessage]=useState('');
  const [form,setForm]=useState({business_name:'',license_number:'',title:'',destination:'مەککە و مەدینە',departure_date:'',return_date:'',total_price_iqd:'',capacity:'',passenger_name:'',phone:'',passport_number:'',passport_issue_date:''});

  const load=async()=>{
    setLoading(true);
    if(role==='umrah_agency') { const {data}=await supabase.from('umrah_agencies').select('*').eq('owner_id',userId).maybeSingle(); setAgency(data); }
    const {data: t}=await supabase.from('umrah_trips').select('*').eq('status','approved').order('departure_date'); setTrips((t||[]) as Trip[]);
    const {data: b}=await supabase.from('umrah_bookings').select('*').eq('customer_id',userId).order('created_at',{ascending:false}); setBookings((b||[]) as Booking[]);
    setLoading(false);
  };
  useEffect(()=>{void load();},[userId,role]);

  const registerAgency=async()=>{
    if(!form.business_name.trim()) return setMessage('ناوی کۆمپانیای حەج و عومرە بنووسە.');
    const {data,error}=await supabase.from('umrah_agencies').insert({owner_id:userId,business_name:form.business_name.trim(),license_number:form.license_number.trim()||null}).select('*').single();
    if(error) return setMessage(error.message); setAgency(data); setMessage('کۆمپانیا تۆمار کرا و پێویستی بە پەسەندی سوپەر ئەدمین هەیە.');
  };

  const createTrip=async()=>{
    if(!agency) return setMessage('سەرەتا کۆمپانیا تۆمار بکە.');
    if(!form.title || !form.departure_date || !form.total_price_iqd) return setMessage('زانیاری گەشتەکە تەواو بکە.');
    const {error}=await supabase.from('umrah_trips').insert({agency_id:agency.id,title:form.title,destination:form.destination,departure_date:form.departure_date,return_date:form.return_date||null,total_price_iqd:Number(form.total_price_iqd),booking_fee_iqd:3000,capacity:form.capacity?Number(form.capacity):null,available_seats:form.capacity?Number(form.capacity):null,status:'pending_approval'});
    if(error) return setMessage(error.message); setMessage('گەشتەکە دروست کرا؛ پێویستی بە پەسەندی سوپەر ئەدمین هەیە.'); void load();
  };

  const book=async(trip:Trip)=>{
    if(!form.passenger_name || !form.passport_issue_date) return setMessage('ناوی مسافر و ڕۆژی دەرکردنی پاسەپۆرت پێویستە.');
    const due=form.passport_issue_date;
    const {data,error}=await supabase.from('umrah_bookings').insert({trip_id:trip.id,agency_id:trip.agency_id,customer_id:userId,passenger_name:form.passenger_name,phone:form.phone||null,passport_number:form.passport_number||null,passport_issue_date:due,booking_fee_iqd:3000,booking_payment_status:'pending',travel_payment_iqd:Number(trip.total_price_iqd),travel_payment_due_date:due,travel_payment_status: due<=today()?'requested':'not_due',status:'pending_payment'}).select('*').single();
    if(error) return setMessage(error.message);
    setBookings(x=>[data as Booking,...x]);
    const {error:pe}=await supabase.from('umrah_payment_records').insert({booking_id:data.id,customer_id:userId,agency_id:trip.agency_id,payment_kind:'booking_fee',amount_iqd:3000,due_date:today(),status:'pending',payment_method:'cash'});
    if(pe) setMessage('حجز دروست کرا، بەڵام تۆمارکردنی پارەی حجز سەرکەوتوو نەبوو.'); else setMessage('حجز دروست کرا. کرێی حجز ٣,٠٠٠ د.ع ـە. پارەی سەفەر لە ڕۆژی دەرکردنی پاسەپۆرت داواکراوە.');
  };

  const submitPayment=async(b:Booking,kind:'booking_fee'|'travel_payment')=>{
    const amount=kind==='booking_fee'?3000:Number(b.travel_payment_iqd||0); if(!amount) return setMessage('بڕی پارەی سەفەر دیاری نەکراوە.');
    const {error}=await supabase.from('umrah_payment_records').insert({booking_id:b.id,customer_id:userId,agency_id:b.agency_id,payment_kind:kind,amount_iqd:amount,due_date:kind==='travel_payment'?b.travel_payment_due_date:today(),status:'submitted',payment_method:'cash'});
    if(error) return setMessage(error.message);
    const update=kind==='booking_fee'?{booking_payment_status:'paid',status:'confirmed'}:{travel_payment_status:'pending',status:'travel_payment_due'};
    const {error:ue}=await supabase.from('umrah_bookings').update(update).eq('id',b.id).eq('customer_id',userId); if(ue) return setMessage(ue.message); setMessage('داواکاری پارەدان تۆمار کرا و چاوەڕوانی پشتڕاستکردنەوەیە.'); void load();
  };

  const isDue=(b:Booking)=>!!b.travel_payment_due_date && b.travel_payment_due_date<=today() && !['paid','verified'].includes(b.travel_payment_status);

  return <div className="section" style={{marginTop:0}}>
    <div className="title"><div><span>حەج و عومرە</span><h2><Plane size={25} style={{verticalAlign:'middle'}}/> حجزکردنی گەشت</h2></div><b>کرێی حجز: ٣,٠٠٠ د.ع</b></div>
    <div className="msg" style={{marginBottom:18}}>ئەم بەشە تەنها بۆ حجزکردنی گەشتە. کرێی حجز <b>٣,٠٠٠ د.ع</b> ـە. پارەی سەفەر لە <b>ڕۆژی دەرکردنی پاسەپۆرت</b> داوا دەکرێت. شاخ کۆمسیۆنی گەشت زیاد ناکات.</div>

    {role==='umrah_agency' && !agency && <div className="auth" style={{margin:'0 auto 20px'}}><h3>تۆمارکردنی کۆمپانیا</h3><input value={form.business_name} onChange={e=>setForm({...form,business_name:e.target.value})} placeholder="ناوی کۆمپانیا"/><input value={form.license_number} onChange={e=>setForm({...form,license_number:e.target.value})} placeholder="ژمارەی مۆڵەت"/><button className="primary full" onClick={registerAgency}><Plus size={17}/> تۆمارکردن</button></div>}
    {role==='umrah_agency' && agency && <div className="orderCard" style={{marginBottom:18}}><ShieldCheck size={22}/><b>{agency.business_name}</b><small>گەشتەکان پێش بڵاوکردنەوە پێویستیان بە پەسەندی سوپەر ئەدمین هەیە.</small></div>}
    {role==='umrah_agency' && agency && <div className="orderCard" style={{marginBottom:20}}><h3>زیادکردنی گەشت</h3><div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10}}><input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="ناوی گەشت"/><input value={form.destination} onChange={e=>setForm({...form,destination:e.target.value})} placeholder="شوێن"/><input type="date" value={form.departure_date} onChange={e=>setForm({...form,departure_date:e.target.value})}/><input type="date" value={form.return_date} onChange={e=>setForm({...form,return_date:e.target.value})}/><input value={form.total_price_iqd} onChange={e=>setForm({...form,total_price_iqd:e.target.value})} placeholder="نرخی تەواوی گەشت"/><input value={form.capacity} onChange={e=>setForm({...form,capacity:e.target.value})} placeholder="ژمارەی شوێن"/></div><button className="primary" onClick={createTrip}><Plus size={17}/> زیادکردنی گەشت</button></div>}

    {!loading && role!=='umrah_agency' && <div className="orderCard" style={{marginBottom:18}}><h3>حجزکردنی گەشت</h3><div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10}}><input value={form.passenger_name} onChange={e=>setForm({...form,passenger_name:e.target.value})} placeholder="ناوی مسافر"/><input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="ژمارەی مۆبایل"/><input value={form.passport_number} onChange={e=>setForm({...form,passport_number:e.target.value})} placeholder="ژمارەی پاسەپۆرت"/><label style={{fontSize:12,color:'#718096'}}>ڕۆژی دەرکردنی پاسەپۆرت<input type="date" value={form.passport_issue_date} onChange={e=>setForm({...form,passport_issue_date:e.target.value})}/></label></div><small>پارەی حجز: ٣,٠٠٠ د.ع — پارەی گەشت لە ڕۆژی دەرکردنی پاسەپۆرت داوا دەکرێت.</small></div>}

    {!loading && role!=='umrah_agency' && <div className="dashboardGrid">{trips.map(t=><div className="orderCard" key={t.id}><div className="orderCardTop"><strong>{t.title}</strong><span>{t.destination}</span></div><div className="orderMeta"><CalendarDays size={15}/> {t.departure_date} {t.return_date ? `→ ${t.return_date}` : ''}</div><div className="orderTotal">{Number(t.total_price_iqd).toLocaleString('en-US')} د.ع</div><small>کرێی حجز: ٣,٠٠٠ د.ع</small><button className="primary full" onClick={()=>book(t)}><FileText size={16}/> حجزکردن</button></div>)}</div>}

    {bookings.length>0 && <><h3 style={{marginTop:28}}>حجزەکانم</h3><div className="dashboardGrid">{bookings.map(b=><div className="orderCard" key={b.id}><div className="orderCardTop"><strong>{b.passenger_name}</strong><span>{statusText[b.status]||b.status}</span></div><div className="orderMeta"><CalendarDays size={15}/> پاسەپۆرت: {b.passport_issue_date||'—'}</div><p>کرێی حجز: <b>٣,٠٠٠ د.ع</b> — {b.booking_payment_status}</p>{b.booking_payment_status==='pending'&&<button className="primary full" onClick={()=>submitPayment(b,'booking_fee')}><CreditCard size={16}/> پارەدانی حجز</button>}{isDue(b)&&<button className="primary full" onClick={()=>submitPayment(b,'travel_payment')}><CreditCard size={16}/> پارەدانی گەشت ({Number(b.travel_payment_iqd).toLocaleString('en-US')} د.ع)</button>}<small>{b.travel_payment_due_date ? `پارەی سەفەر لە ${b.travel_payment_due_date} داوا دەکرێت.` : ''}</small></div>)}</div></>}
    {message && <div className="msg">{message}</div>}
  </div>;
}
