import React, { useEffect, useState } from 'react';
import { CalendarDays, CheckCircle2, CreditCard, FileText, Plane, Plus, ShieldCheck, ImagePlus, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Props = { userId: string; role: string };
type Trip = { id:string; agency_id:string; title:string; destination:string; departure_date:string; return_date?:string|null; total_price_iqd:number; booking_fee_iqd:number; capacity?:number|null; available_seats?:number|null; hotel_details?:string|null; transport_details?:string|null; passport_note?:string|null; description?:string|null; images?:string[]; status:string };
type Booking = { id:string; trip_id:string; agency_id:string; customer_id:string; passenger_name:string; phone?:string|null; passport_number?:string|null; passport_issue_date?:string|null; booking_fee_iqd:number; booking_payment_status:string; travel_payment_iqd:number; travel_payment_due_date?:string|null; travel_payment_status:string; status:string };
type Payment = { id:string; booking_id:string; agency_id:string; payment_kind:string; amount_iqd:number; status:string; due_date?:string|null; receipt_url?:string|null; };
type PostingPayment = { id:string; trip_id:string; agency_id:string; payer_id:string; amount_iqd:number; payment_method:string; status:string; receipt_url?:string|null; created_at:string };

const today = () => new Date().toISOString().slice(0,10);
const statusText: Record<string,string> = { pending_payment:'چاوەڕوانی پارە', pending_payment_verification:'چاوەڕوانی پشتڕاستکردنەوەی وەسڵ', pending_approval:'چاوەڕوانی پەسەندکردن', confirmed:'حجزکراو', documents_pending:'چاوەڕوانی بەڵگەنامە', travel_payment_due:'پارەی سەفەر داواکراوە', ready_for_travel:'ئامادەی سەفەر', completed:'تەواوبوو', cancelled:'هەڵوەشێنراوە' };

export default function UmrahBookingModule({ userId, role }: Props) {
  const isAdmin = role === 'super_admin' || role === 'admin';
  const [trips,setTrips]=useState<Trip[]>([]); const [bookings,setBookings]=useState<Booking[]>([]); const [payments,setPayments]=useState<Payment[]>([]); const [postingPayments,setPostingPayments]=useState<PostingPayment[]>([]); const [agencies,setAgencies]=useState<any[]>([]); const [agency,setAgency]=useState<any>(null); const [loading,setLoading]=useState(true); const [message,setMessage]=useState(''); const [postingReceipt,setPostingReceipt]=useState<File|null>(null); const [postingTripId,setPostingTripId]=useState<string|null>(null);
  const [form,setForm]=useState({business_name:'',license_number:'',title:'',destination:'مەککە و مەدینە',departure_date:'',return_date:'',total_price_iqd:'',capacity:'',hotel_details:'',transport_details:'',passport_note:'',description:'',passenger_name:'',phone:'',passport_number:'',passport_issue_date:''}); const [tripImages,setTripImages]=useState<File[]>([]);

  const load=async()=>{
    setLoading(true);
    let currentAgency = agency;
    if(role==='umrah_agency') {
      const {data,error}=await supabase.from('umrah_agencies').select('*').eq('owner_id',userId).maybeSingle();
      if(error){ setMessage(error.message); setLoading(false); return; }
      currentAgency = data;
      setAgency(data);
    }
    if(isAdmin){ const {data:agencyData}=await supabase.from('umrah_agencies').select('*').order('created_at',{ascending:false}); setAgencies(agencyData||[]); }
    let postingQuery=supabase.from('umrah_posting_payments').select('id,trip_id,agency_id,payer_id,amount_iqd,payment_method,status,receipt_url,created_at').order('created_at',{ascending:false}).limit(100);
    if(!isAdmin)postingQuery=postingQuery.eq('payer_id',userId);
    const {data:postingData}=await postingQuery; setPostingPayments((postingData||[]) as PostingPayment[]);
    let tripQuery = supabase.from('umrah_trips').select('*').order('departure_date');
    if (isAdmin) {
      // Admins can review every trip.
    } else if (role === 'umrah_agency' && currentAgency) {
      tripQuery = tripQuery.eq('agency_id', currentAgency.id);
    } else {
      tripQuery = tripQuery.eq('status','approved');
    }
    const {data: t}=await tripQuery; setTrips((t||[]) as Trip[]);

    let bookingQuery = supabase.from('umrah_bookings').select('*').order('created_at',{ascending:false});
    if (isAdmin) {
      // Admins can review every booking.
    } else if (role === 'umrah_agency' && currentAgency) {
      bookingQuery = bookingQuery.eq('agency_id', currentAgency.id);
    } else {
      bookingQuery = bookingQuery.eq('customer_id',userId);
    }
    const {data: b}=await bookingQuery; setBookings((b||[]) as Booking[]);
    if(isAdmin){ const {data:p}=await supabase.from('umrah_payment_records').select('*').order('created_at',{ascending:false}); setPayments((p||[]) as Payment[]); }
    setLoading(false);
  };
  useEffect(()=>{void load();},[userId,role]);

  const registerAgency=async()=>{
    if(!form.business_name.trim()) return setMessage('ناوی کۆمپانیای حەج و عومرە بنووسە.');
    const {data,error}=await supabase.from('umrah_agencies').insert({owner_id:userId,business_name:form.business_name.trim(),license_number:form.license_number.trim()||null}).select('*').single();
    if(error) return setMessage(error.message); setAgency(data); setMessage('کۆمپانیا تۆمار کرا و پێویستی بە پەسەندی سوپەر ئەدمین هەیە.');
  };

  const uploadTripImages=async()=>{
    const urls:string[]=[];
    for(const file of tripImages){
      if(!file.type.startsWith('image/')||file.size>5242880) continue;
      const path=userId+'/umrah/'+Date.now()+'-'+file.name.replace(/[^a-zA-Z0-9._-]/g,'-');
      const {error}=await supabase.storage.from('posts').upload(path,file,{upsert:false,contentType:file.type});
      if(error) throw error;
      urls.push(supabase.storage.from('posts').getPublicUrl(path).data.publicUrl);
    }
    return urls;
  };

  const createTrip=async()=>{
    if(!agency) return setMessage('سەرەتا کۆمپانیا تۆمار بکە.');
    if(!form.title || !form.departure_date || !form.total_price_iqd) return setMessage('زانیاری گەشتەکە تەواو بکە.');
    const postingFee=Number(agency.posting_fee_iqd||0); if(postingFee<=0)return setMessage('سوپەر ئەدمین هێشتا کرێی پۆستکردنی حەج و عومرە دیاری نەکردووە.'); const images=await uploadTripImages(); const {error}=await supabase.from('umrah_trips').insert({agency_id:agency.id,title:form.title,destination:form.destination,departure_date:form.departure_date,return_date:form.return_date||null,total_price_iqd:Number(form.total_price_iqd),booking_fee_iqd:3000,capacity:form.capacity?Number(form.capacity):null,available_seats:form.capacity?Number(form.capacity):null,hotel_details:form.hotel_details.trim()||null,transport_details:form.transport_details.trim()||null,passport_note:form.passport_note.trim()||null,description:form.description.trim()||null,images,status:'pending_payment'});
    if(error) return setMessage(error.message); setMessage('گەشتەکە دروست کرا؛ پێویستی بە پەسەندی سوپەر ئەدمین هەیە.'); void load();
  };

  const payTripPosting=async(trip:Trip)=>{const fee=Number(agency?.posting_fee_iqd||0);if(fee<=0)return setMessage('کرێی پۆستکردن دیاری نەکراوە.');if(!postingReceipt)return setMessage('تکایە وێنەی وەسڵی پارەدان زیاد بکە.');if(!['image/jpeg','image/png','image/webp'].includes(postingReceipt.type)||postingReceipt.size>5*1024*1024)return setMessage('وەسڵ دەبێت JPG، PNG یان WEBP و تا ٥ MB بێت.');try{setPostingTripId(trip.id);const safe=postingReceipt.name.replace(/[^a-zA-Z0-9._-]/g,'-');const path=userId+'/umrah-posting-payments/'+Date.now()+'-'+safe;const {error:uploadError}=await supabase.storage.from('payment-receipts').upload(path,postingReceipt,{upsert:false,contentType:postingReceipt.type});if(uploadError)throw uploadError;const {error}=await supabase.from('umrah_posting_payments').insert({trip_id:trip.id,agency_id:agency.id,payer_id:userId,amount_iqd:fee,payment_method:'cash',status:'submitted',receipt_url:path});if(error)throw error;const {error:tripError}=await supabase.from('umrah_trips').update({status:'pending_payment_verification'}).eq('id',trip.id).eq('agency_id',agency.id);if(tripError)throw tripError;setPostingReceipt(null);setMessage('وەسڵ نێردرا؛ پۆستەکە بۆ پشتڕاستکردنەوەی بەڕێوبەری باڵا چوو.');void load()}catch(error){setMessage(error instanceof Error?error.message:'ناردنی وەسڵ سەرکەوتوو نەبوو.')}finally{setPostingTripId(null)}};
  const openReceipt=async(path?:string|null)=>{if(!path)return;const {data,error}=await supabase.storage.from('payment-receipts').createSignedUrl(path,600);if(error)return setMessage(error.message);if(data?.signedUrl)window.open(data.signedUrl,'_blank','noopener,noreferrer')};
  const verifyPostingPayment=async(payment:PostingPayment)=>{const {error}=await supabase.from('umrah_posting_payments').update({status:'verified',verified_at:new Date().toISOString(),verified_by:userId,paid_at:new Date().toISOString()}).eq('id',payment.id);if(error)return setMessage(error.message);const {error:tripError}=await supabase.from('umrah_trips').update({status:'pending_approval'}).eq('id',payment.trip_id);if(tripError)return setMessage(tripError.message);setMessage('وەسڵ پشتڕاست کرا؛ گەشتەکە ئێستا لە لیستی پەسەندکردندا هەیە.');void load()};
  const rejectPostingPayment=async(payment:PostingPayment)=>{const {error}=await supabase.from('umrah_posting_payments').update({status:'rejected',verified_at:new Date().toISOString(),verified_by:userId}).eq('id',payment.id);if(error)return setMessage(error.message);await supabase.from('umrah_trips').update({status:'pending_payment'}).eq('id',payment.trip_id);setMessage('وەسڵ ڕەتکرایەوە؛ داواکاری پارەدان دووبارە بکەرەوە.');void load()};
  const approveTrip=async(trip:Trip)=>{ const {error}=await supabase.from('umrah_trips').update({status:'approved',approved_at:new Date().toISOString(),approved_by:userId}).eq('id',trip.id); if(error) return setMessage(error.message); setMessage('گەشتەکە پەسەند کرا.'); void load(); };
  const rejectTrip=async(trip:Trip)=>{ const {error}=await supabase.from('umrah_trips').update({status:'rejected',approved_by:userId}).eq('id',trip.id); if(error) return setMessage(error.message); setMessage('گەشتەکە ڕەتکرایەوە.'); void load(); };

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

  const verifyPayment=async(p:Payment)=>{
    const {error}=await supabase.from('umrah_payment_records').update({status:'verified',verified_at:new Date().toISOString(),verified_by:userId,paid_at:new Date().toISOString()}).eq('id',p.id);
    if(error) return setMessage(error.message);
    const bookingUpdate = p.payment_kind==='booking_fee' ? {booking_payment_status:'verified',status:'confirmed'} : {travel_payment_status:'verified',status:'ready_for_travel'};
    await supabase.from('umrah_bookings').update(bookingUpdate).eq('id',p.booking_id);
    const settlementType = p.payment_kind==='booking_fee' ? 'booking_fee_receivable' : 'travel_payment_receivable';
    await supabase.from('umrah_company_settlements').insert({agency_id:p.agency_id,booking_id:p.booking_id,settlement_type:settlementType,amount_iqd:Number(p.amount_iqd),status:'pending',due_date:today()});
    setMessage('پارەکە پشتڕاست کرا و قەرزی کۆمپانیا بۆ شاخ تۆمار کرا.'); void load();
  };

  const isDue=(b:Booking)=>!!b.travel_payment_due_date && b.travel_payment_due_date<=today() && !['paid','verified'].includes(b.travel_payment_status);

  return <div className="section" style={{marginTop:0}}>
    <div className="title"><div><span>حەج و عومرە</span><h2><Plane size={25} style={{verticalAlign:'middle'}}/> حجزکردنی گەشت</h2></div><b>کرێی حجز: ٣,٠٠٠ د.ع</b></div>
    <div className="msg" style={{marginBottom:18}}>ئەم بەشە تەنها بۆ حجزکردنی گەشتە. کرێی حجز <b>٣,٠٠٠ د.ع</b> ـە. پارەی سەفەر لە <b>ڕۆژی دەرکردنی پاسەپۆرت</b> داوا دەکرێت. شاخ کۆمسیۆنی گەشت زیاد ناکات.</div>

    {role==='umrah_agency' && !agency && <div className="auth" style={{margin:'0 auto 20px'}}><h3>تۆمارکردنی کۆمپانیا</h3><input value={form.business_name} onChange={e=>setForm({...form,business_name:e.target.value})} placeholder="ناوی کۆمپانیا"/><input value={form.license_number} onChange={e=>setForm({...form,license_number:e.target.value})} placeholder="ژمارەی مۆڵەت"/><button className="primary full" onClick={registerAgency}><Plus size={17}/> تۆمارکردن</button></div>}
    {role==='umrah_agency' && agency && <div className="orderCard" style={{marginBottom:18}}><ShieldCheck size={22}/><b>{agency.business_name}</b><small>کرێی پۆستکردن: {Number(agency.posting_fee_iqd||0).toLocaleString('en-US')} د.ع · گەشتەکان پێش بڵاوکردنەوە پێویستیان بە پارەدان و پەسەندی سوپەر ئەدمین هەیە.</small></div>}
    {role==='umrah_agency' && agency && <div className="orderCard" style={{marginBottom:20}}><h3>زیادکردنی گەشت</h3><div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10}}><input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="ناوی گەشت"/><input value={form.destination} onChange={e=>setForm({...form,destination:e.target.value})} placeholder="شوێن"/><input type="date" value={form.departure_date} onChange={e=>setForm({...form,departure_date:e.target.value})}/><input type="date" value={form.return_date} onChange={e=>setForm({...form,return_date:e.target.value})}/><input value={form.total_price_iqd} onChange={e=>setForm({...form,total_price_iqd:e.target.value})} placeholder="نرخی تەواوی گەشت"/><input value={form.capacity} onChange={e=>setForm({...form,capacity:e.target.value})} placeholder="ژمارەی شوێن"/><input value={form.hotel_details} onChange={e=>setForm({...form,hotel_details:e.target.value})} placeholder="وردەکاری هۆتێل"/><input value={form.transport_details} onChange={e=>setForm({...form,transport_details:e.target.value})} placeholder="وردەکاری گواستنەوە"/><input value={form.passport_note} onChange={e=>setForm({...form,passport_note:e.target.value})} placeholder="تێبینی پاسەپۆرت"/></div><textarea rows={3} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="وەسفی پەکی حەج و عومرە"/><div style={{margin:'10px 0'}}><b>وێنەکانی پەک</b><input type="file" accept="image/*" multiple onChange={e=>setTripImages(Array.from(e.target.files||[]).slice(0,8))}/></div><button className="primary" onClick={createTrip}><Plus size={17}/> زیادکردنی گەشت</button></div>}

    {role==='umrah_agency' && agency && trips.filter(t=>['pending_payment','pending_payment_verification'].includes(t.status)).length>0&&<div className="orderCard" style={{marginBottom:20}}><h3>پارەی پۆستکردنی گەشت</h3>{trips.filter(t=>['pending_payment','pending_payment_verification'].includes(t.status)).map(t=><div className="orderRow" key={t.id}><div><b>{t.title}</b><small>{statusText[t.status]||t.status} · کرێ: {Number(agency.posting_fee_iqd||0).toLocaleString('en-US')} د.ع</small></div><div>{t.status==='pending_payment'&&<div><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setPostingReceipt(e.target.files?.[0]||null)} aria-label="وێنەی وەسڵی پارەی پۆستکردن"/><button className="primary" disabled={postingTripId===t.id} onClick={()=>void payTripPosting(t)}>{postingTripId===t.id?'دەنێردرێت...':'ناردنی وەسڵ'}</button></div>}</div></div>)}</div>}

    {!loading && !isAdmin && role!=='umrah_agency' && <div className="orderCard" style={{marginBottom:18}}><h3>حجزکردنی گەشت</h3><div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10}}><input value={form.passenger_name} onChange={e=>setForm({...form,passenger_name:e.target.value})} placeholder="ناوی مسافر"/><input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="ژمارەی مۆبایل"/><input value={form.passport_number} onChange={e=>setForm({...form,passport_number:e.target.value})} placeholder="ژمارەی پاسەپۆرت"/><label style={{fontSize:12,color:'#718096'}}>ڕۆژی دەرکردنی پاسەپۆرت<input type="date" value={form.passport_issue_date} onChange={e=>setForm({...form,passport_issue_date:e.target.value})}/></label></div><small>پارەی حجز: ٣,٠٠٠ د.ع — پارەی گەشت لە ڕۆژی دەرکردنی پاسەپۆرت داوا دەکرێت.</small></div>}

    {!loading && !isAdmin && role!=='umrah_agency' && <div className="dashboardGrid">{trips.map(t=><div className="orderCard" key={t.id}><div className="orderCardTop"><strong>{t.title}</strong><span>{t.destination}</span></div><div className="orderMeta"><CalendarDays size={15}/> {t.departure_date} {t.return_date ? `→ ${t.return_date}` : ''}</div><small>{t.hotel_details||'هۆتێل دیاری نەکراو'} · {t.transport_details||'گواستنەوە دیاری نەکراو'}</small><div className="orderTotal">{Number(t.total_price_iqd).toLocaleString('en-US')} د.ع</div><small>کرێی حجز: ٣,٠٠٠ د.ع</small><button className="primary full" onClick={()=>book(t)}><FileText size={16}/> حجزکردن</button></div>)}</div>}

    {isAdmin && <><div className="orderCard" style={{marginBottom:20}}><h3>کرێی پۆستکردنی حەج و عومرە</h3><small>سوپەر ئەدمین دەتوانێت کرێی پۆستکردن بۆ هەر کۆمپانیا دیاری بکات.</small><div className="dashboardGrid">{agencies.map(a=><div className="orderCard" key={a.id}><strong>{a.business_name}</strong><div className="orderMeta">{a.city||'هەولێر'}</div><input inputMode="numeric" value={String(a.posting_fee_iqd||'')} onChange={e=>setAgencies(items=>items.map(item=>item.id===a.id?{...item,posting_fee_iqd:e.target.value.replace(/\D/g,'')}:item))} placeholder="کرێی پۆستکردن"/></div>)}</div><button className="primary" onClick={async()=>{for(const a of agencies){await supabase.from('umrah_agencies').update({posting_fee_iqd:Number(a.posting_fee_iqd||0)}).eq('id',a.id)}setMessage('کرێی پۆستکردنی کۆمپانیاکان پاشەکەوت کرا.');void load()}}>پاشەکەوتکردنی نرخەکان</button></div>
<div className="orderCard" style={{marginBottom:20}}><div className="orderCardTop"><strong>داواکارییەکانی پارەی پۆستکردن</strong><span>{postingPayments.filter(p=>p.status==='submitted').length} چاوەڕوان</span></div>{postingPayments.filter(p=>p.status==='submitted').length===0?<small>هیچ وەسڵێکی نوێ نییە.</small>:postingPayments.filter(p=>p.status==='submitted').map(p=>{const trip=trips.find(t=>t.id===p.trip_id);return <div className="vehiclePaymentAdminRow" key={p.id}><div><b>{trip?.title||'گەشتی حەج و عومرە'}</b><small>{Number(p.amount_iqd).toLocaleString('en-US')} د.ع · {new Date(p.created_at).toLocaleString('ku-IQ')}</small></div><div><button type="button" className="plain" onClick={()=>void openReceipt(p.receipt_url)}>بینینی وەسڵ</button><button type="button" className="primary" onClick={()=>void verifyPostingPayment(p)}>پشتڕاستکردنەوە</button><button type="button" className="reset" onClick={()=>void rejectPostingPayment(p)}>ڕەتکردنەوە</button></div></div>})}</div>
<h3>پەسەندکردنی گەشتەکان</h3><div className="dashboardGrid">{trips.filter(t=>t.status==='pending_approval').map(t=><div className="orderCard" key={t.id}><div className="orderCardTop"><strong>{t.title}</strong><span>چاوەڕوانی</span></div><div className="orderMeta"><CalendarDays size={15}/> {t.departure_date}</div><p>{Number(t.total_price_iqd).toLocaleString('en-US')} د.ع</p><div style={{display:'flex',gap:8}}><button className="primary" onClick={()=>approveTrip(t)}><CheckCircle2 size={16}/> پەسەند</button><button className="reset" onClick={()=>rejectTrip(t)}>ڕەتکردنەوە</button></div></div>)}</div><h3 style={{marginTop:28}}>پارەکانی حەج و عومرە</h3><div className="dashboardGrid">{payments.filter(p=>p.status==='submitted').map(p=><div className="orderCard" key={p.id}><div className="orderCardTop"><strong>{p.payment_kind==='booking_fee'?'کرێی حجز':'پارەی سەفەر'}</strong><span>چاوەڕوانی پشتڕاستکردنەوە</span></div><div className="orderTotal">{Number(p.amount_iqd).toLocaleString('en-US')} د.ع</div><button className="primary full" onClick={()=>verifyPayment(p)}><CheckCircle2 size={16}/> پشتڕاستکردنەوە و تۆمارکردنی قەرزی کۆمپانیا</button></div>)}</div></>}

    {bookings.length>0 && !isAdmin && <><h3 style={{marginTop:28}}>حجزەکانم</h3><div className="dashboardGrid">{bookings.map(b=><div className="orderCard" key={b.id}><div className="orderCardTop"><strong>{b.passenger_name}</strong><span>{statusText[b.status]||b.status}</span></div><div className="orderMeta"><CalendarDays size={15}/> پاسەپۆرت: {b.passport_issue_date||'—'}</div><p>کرێی حجز: <b>٣,٠٠٠ د.ع</b> — {b.booking_payment_status}</p>{b.booking_payment_status==='pending'&&<button className="primary full" onClick={()=>submitPayment(b,'booking_fee')}><CreditCard size={16}/> پارەدانی حجز</button>}{isDue(b)&&<button className="primary full" onClick={()=>submitPayment(b,'travel_payment')}><CreditCard size={16}/> پارەدانی گەشت ({Number(b.travel_payment_iqd).toLocaleString('en-US')} د.ع)</button>}<small>{b.travel_payment_due_date ? `پارەی سەفەر لە ${b.travel_payment_due_date} داوا دەکرێت.` : ''}</small></div>)}</div></>}
    {message && <div className="msg">{message}</div>}
  </div>;
}
