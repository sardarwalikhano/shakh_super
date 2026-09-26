import React, { useEffect, useMemo, useState } from 'react';
import { Car, CheckCircle2, CreditCard, ImagePlus, Plus, ShieldCheck, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import ShakhCarsMarketplace from './ShakhCarsMarketplace';

type Listing = {
  id: string; showroom_id: string; owner_id: string; title: string; make: string; model: string;
  model_year?: number | null; price_iqd: number; mileage_km?: number | null; condition: string;
  transmission?: string | null; fuel_type?: string | null; color?: string | null; body_type?: string | null;
  drivetrain?: string | null; engine_size_cc?: number | null; horsepower?: number | null; images?: string[];
  status: string; commission_iqd: number; created_at: string;
};

type Props = { userId: string; isAdmin?: boolean; role?: string };

const statusLabel: Record<string,string> = {
  pending_payment: 'چاوەڕوانی پارەدان', pending_approval: 'چاوەڕوانی ڕێگەپێدان', approved: 'پەسەندکراو',
  rejected: 'ڕەتکراوەتەوە', sold: 'فرۆشراوە', archived: 'ئەرشیفکراو'
};

export default function VehicleShowroomModule({ userId, isAdmin = false, role = 'customer' }: Props) {
  if (!isAdmin && role !== 'car_dealer') return <ShakhCarsMarketplace />;
  const [listings, setListings] = useState<Listing[]>([]);
  const [showroom, setShowroom] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ business_name: '', title: '', make: '', model: '', model_year: '', price_iqd: '', mileage_km: '', condition: 'used', transmission:'automatic', fuel_type:'petrol', body_type:'suv', drivetrain:'awd', engine_size_cc:'', horsepower:'', color:'', description:'' });
  const [carImages, setCarImages] = useState<File[]>([]);
  const [carPreviews, setCarPreviews] = useState<string[]>([]);

  const load = async () => {
    setLoading(true);
    const { data: s } = await supabase.from('vehicle_showrooms').select('*').eq('owner_id', userId).maybeSingle();
    setShowroom(s);
    let query = supabase.from('vehicle_listings').select('*').order('created_at', { ascending: false });
    if (!isAdmin) query = query.eq('owner_id', userId);
    const { data, error } = await query;
    if (error) setMessage(error.message); else setListings((data || []) as Listing[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [userId, isAdmin]);

  const fee = Number(showroom?.posting_fee_iqd || 0);
  const canPost = !!showroom && fee > 0;

  const uploadCarImages = async () => { const urls: string[] = []; for (const file of carImages.slice(0, 6)) { if (!file.type.startsWith('image/') || file.size > 5242880) continue; const path = `${userId}/cars/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`; const { error } = await supabase.storage.from('posts').upload(path, file, { upsert: false, contentType: file.type }); if (error) throw error; urls.push(supabase.storage.from('posts').getPublicUrl(path).data.publicUrl); } return urls; };

  const createListing = async () => {
    if (!showroom) return setMessage('سەرەتا پێویستە پێشانگا تۆمار بکرێت.');
    if (fee <= 0) return setMessage('سوپەر ئەدمین هێشتا نرخی پۆستکردنی ئۆتۆمبێل دیاری نەکردووە.');
    const images = await uploadCarImages();
    const { data, error } = await supabase.from('vehicle_listings').insert({
      showroom_id: showroom.id, owner_id: userId, title: form.title, make: form.make, model: form.model,
      model_year: form.model_year ? Number(form.model_year) : null, price_iqd: Number(form.price_iqd || 0),
      mileage_km: form.mileage_km ? Number(form.mileage_km) : null, condition: form.condition,
      transmission: form.transmission, fuel_type: form.fuel_type, body_type: form.body_type, drivetrain: form.drivetrain,
      engine_size_cc: form.engine_size_cc ? Number(form.engine_size_cc) : null, horsepower: form.horsepower ? Number(form.horsepower) : null,
      color: form.color || null, description: form.description || null, images, commission_iqd: 0,
      status: 'pending_payment'
    }).select('*').single();
    if (error) return setMessage(error.message);
    setListings((x) => [data as Listing, ...x]);
    setForm({ business_name: showroom.business_name, title: '', make: '', model: '', model_year: '', price_iqd: '', mileage_km: '', condition: 'used', transmission:'automatic', fuel_type:'petrol', body_type:'suv', drivetrain:'awd', engine_size_cc:'', horsepower:'', color:'', description:'' }); setCarImages([]); setCarPreviews([]);
    setMessage('پۆست دروست کرا. ئێستا پارەی پۆستکردن بدە، پاشان سوپەر ئەدمین پەسەندی دەکات.');
  };

  const registerShowroom = async () => {
    if (!form.business_name.trim()) return setMessage('ناوی پێشانگا بنووسە.');
    const { data, error } = await supabase.from('vehicle_showrooms').insert({ owner_id: userId, business_name: form.business_name.trim() }).select('*').single();
    if (error) return setMessage(error.message);
    setShowroom(data); setMessage('پێشانگاکە تۆمار کرا. نرخی پۆستکردن لەلایەن سوپەر ئەدمین دیاری دەکرێت.');
  };

  const payPosting = async (listing: Listing) => {
    if (!showroom || fee <= 0) return setMessage('نرخی پۆستکردن دیارینەکراوە.');
    const { error } = await supabase.from('vehicle_posting_payments').insert({ listing_id: listing.id, showroom_id: showroom.id, payer_id: userId, amount_iqd: fee, payment_method: 'cash', status: 'pending' });
    if (error) return setMessage(error.message);
    const { error: updateError } = await supabase.from('vehicle_listings').update({ status: 'pending_approval' }).eq('id', listing.id).eq('owner_id', userId);
    if (updateError) return setMessage(updateError.message);
    setMessage('داواکاری پارەدان تۆمار کرا؛ پۆستەکە چووە بۆ پشکنینی سوپەر ئەدمین.');
    void load();
  };

  const approve = async (listing: Listing) => {
    const { error } = await supabase.from('vehicle_listings').update({ status: 'approved', approved_at: new Date().toISOString(), approved_by: userId }).eq('id', listing.id);
    if (error) return setMessage(error.message);
    setMessage('پۆستەکە پەسەند کرا و بڵاوکرایەوە.'); void load();
  };

  const reject = async (listing: Listing) => {
    const { error } = await supabase.from('vehicle_listings').update({ status: 'rejected', approved_by: userId, rejection_reason: 'پێویستی بە پشکنینەوەی زیاتر هەیە.' }).eq('id', listing.id);
    if (error) return setMessage(error.message);
    setMessage('پۆستەکە ڕەتکرایەوە.'); void load();
  };

  const counts = useMemo(() => ({ pending: listings.filter(x => x.status === 'pending_approval').length, approved: listings.filter(x => x.status === 'approved').length }), [listings]);

  return <div className="section" style={{ marginTop: 0 }}>
    <div className="title"><div><span>SHAKH CARS</span><h2><Car size={25} style={{ verticalAlign:'middle' }}/> پێشانگای ئۆتۆمبێل</h2></div><div style={{display:'flex',gap:8}}><b>{counts.approved} پەسەندکراو</b><b>{counts.pending} چاوەڕوان</b></div></div>
    {!showroom && !isAdmin && <div className="auth" style={{margin:'0 auto 20px'}}><h3>تۆمارکردنی پێشانگا</h3><p>ڕۆلی پێشانگای ئۆتۆمبێل هیچ کۆمسیۆنێکی لەسەر فرۆشتن نییە؛ تەنها کرێی پۆستکردن هەیە.</p><input value={form.business_name} onChange={e=>setForm({...form,business_name:e.target.value})} placeholder="ناوی پێشانگا"/><button className="primary full" onClick={registerShowroom}><Plus size={17}/> تۆمارکردنی پێشانگا</button></div>}
    {showroom && !isAdmin && <div className="orderCard" style={{marginBottom:18}}><ShieldCheck size={24}/><b>{showroom.business_name}</b><span>کرێی پۆستکردن: {fee ? fee.toLocaleString('en-US') : 'دیاری نەکراو'} د.ع</span><small>کۆمسیۆن: ٠ د.ع — تەنها کرێی پۆستکردن.</small></div>}
    {!isAdmin && showroom && <div className="orderCard" style={{marginBottom:20}}><h3>پۆستکردنی ئۆتۆمبێل — Shakh Cars</h3><div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>{[['title','سەردێڕ'],['make','مارکە'],['model','مۆدێل'],['model_year','ساڵ'],['price_iqd','نرخ'],['mileage_km','کیلۆمەتر'],['color','ڕەنگ'],['engine_size_cc','مووتەڕ CC'],['horsepower','HP']].map(([k,p])=><input key={k} value={(form as any)[k]} onChange={e=>setForm({...form,[k]:e.target.value})} placeholder={p}/>)}<select value={form.condition} onChange={e=>setForm({...form,condition:e.target.value})}><option value="used">بەکارهاتوو</option><option value="new">نوێ</option></select><select value={form.transmission} onChange={e=>setForm({...form,transmission:e.target.value})}><option value="automatic">ئۆتۆماتیک</option><option value="manual">مانواڵ</option><option value="cvt">CVT</option><option value="dct">DCT</option></select><select value={form.fuel_type} onChange={e=>setForm({...form,fuel_type:e.target.value})}><option value="petrol">بەنزین</option><option value="diesel">دیزڵ</option><option value="hybrid">هایبرید</option><option value="electric">کارەبایی</option></select><select value={form.body_type} onChange={e=>setForm({...form,body_type:e.target.value})}><option value="sedan">سەدان</option><option value="suv">SUV</option><option value="pickup">پیکاپ</option><option value="coupe">کووپ</option></select><select value={form.drivetrain} onChange={e=>setForm({...form,drivetrain:e.target.value})}><option value="fwd">FWD</option><option value="rwd">RWD</option><option value="awd">AWD</option><option value="4wd">4WD</option></select></div><textarea rows={3} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="وەسفی تەواوی ئۆتۆمبێل"/><div style={{marginTop:10}}><div style={{fontWeight:800,marginBottom:6}}><ImagePlus size={17}/> وێنەکان</div><input type="file" accept="image/*" multiple onChange={e=>{const fs=Array.from(e.target.files||[]).slice(0,6);setCarImages(fs);setCarPreviews(fs.map(x=>URL.createObjectURL(x)))}}/><div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:7,marginTop:8}}>{carPreviews.map(src=><img key={src} src={src} alt="ئۆتۆمبێل" style={{width:'100%',height:90,objectFit:'cover',borderRadius:9}}/>)}</div></div><button className="primary" disabled={!canPost} onClick={createListing}><Plus size={17}/> پۆستکردن</button></div>}
    {loading ? <div className="empty">چاوەڕێ بکە...</div> : <div className="dashboardGrid">{listings.map(l=><div className="orderCard" key={l.id}>{l.images?.[0]&&<img src={l.images[0]} alt={l.title} style={{width:'100%',height:180,objectFit:'cover',borderRadius:12,marginBottom:9}}/>}<div className="orderCardTop"><strong>{l.title}</strong><span>{statusLabel[l.status] || l.status}</span></div><div className="orderMeta"><Car size={15}/> {l.make} {l.model} · {l.model_year || '—'} · {l.condition === 'new' ? 'نوێ' : 'بەکارهاتوو'}</div><div className="orderMeta">{l.transmission||'—'} · {l.fuel_type||'—'} · {l.body_type||'—'} · {l.drivetrain||'—'}</div><div className="orderMeta">{l.engine_size_cc?l.engine_size_cc+' CC':''}{l.horsepower?' · '+l.horsepower+' HP':''}{l.color?' · '+l.color:''}</div><div className="orderTotal">{Number(l.price_iqd).toLocaleString('en-US')} د.ع</div>{!isAdmin && l.status === 'pending_payment' && <button className="primary full" onClick={()=>payPosting(l)}><CreditCard size={16}/> دانانی داواکاری پارەی پۆستکردن ({fee.toLocaleString('en-US')} د.ع)</button>}{isAdmin && l.status === 'pending_approval' && <div style={{display:'flex',gap:8}}><button className="primary" onClick={()=>approve(l)}><CheckCircle2 size={16}/> ڕێگەپێدان</button><button className="reset" onClick={()=>reject(l)}><XCircle size={16}/> ڕەتکردنەوە</button></div>}{l.commission_iqd === 0 && <small>کۆمسیۆن: ٠ د.ع</small>}</div>)}</div>}
    {message && <div className="msg">{message}</div>}
  </div>;
}
