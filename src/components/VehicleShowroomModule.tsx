import React,{useEffect,useMemo,useState} from 'react';
import {Car,CheckCircle2,ChevronDown,CreditCard,Filter,Heart,ImagePlus,MapPin,Plus,Search,ShieldCheck,XCircle} from 'lucide-react';
import {supabase} from '../lib/supabase';

type Props={userId:string;isAdmin?:boolean;role?:string};
type Listing={
 id:string;showroom_id:string;owner_id:string;title:string;make:string;model:string;trim?:string|null;model_year?:number|null;
 price_iqd:number;mileage_km?:number|null;condition:string;transmission?:string|null;fuel_type?:string|null;color?:string|null;
 body_type?:string|null;drivetrain?:string|null;engine_size_cc?:number|null;cylinders?:number|null;horsepower?:number|null;
 doors?:number|null;seats?:number|null;warranty?:string|null;service_history?:string|null;accident_history?:string|null;
 import_status?:string|null;origin_country?:string|null;plate_status?:string|null;exchange_allowed?:boolean;negotiable?:boolean;
 description?:string|null;inspection_note?:string|null;images?:string[];status:string;commission_iqd:number;created_at:string;
};
const labels:Record<string,string>={pending_payment:'چاوەڕوانی پارەدان',pending_approval:'چاوەڕوانی ڕێگەپێدان',approved:'پەسەندکراو',rejected:'ڕەتکراوەتەوە',sold:'فرۆشراوە',archived:'ئەرشیفکراو'};
const empty={business_name:'',title:'',make:'',model:'',trim:'',model_year:'',price_iqd:'',mileage_km:'',condition:'used',transmission:'automatic',fuel_type:'petrol',body_type:'sedan',drivetrain:'fwd',engine_size_cc:'',cylinders:'',horsepower:'',doors:'4',seats:'5',color:'',city:'هەولێر',origin_country:'',import_status:'imported',plate_status:'registered',warranty:'',service_history:'',accident_history:'',inspection_note:'',description:'',exchange_allowed:false,negotiable:true};
const bodies=[['sedan','سەدان'],['suv','SUV'],['hatchback','هاتش‌باک'],['coupe','کووپ'],['pickup','پیکاپ'],['van','ڤان'],['wagon','واگن'],['convertible','کۆنڤەرتیبڵ']];
const fuels=[['petrol','بەنزین'],['diesel','دیزڵ'],['hybrid','هایبرید'],['electric','کارەبایی'],['plugin_hybrid','هایبریدی پلاگین']];
const transmissions=[['automatic','ئۆتۆماتیک'],['manual','مانواڵ'],['cvt','CVT'],['dct','DCT']];
const drive=[['fwd','FWD'],['rwd','RWD'],['awd','AWD'],['4wd','4WD']];
const uploadFile=async(userId:string,file:File)=>{
 const path=userId+'/cars/'+Date.now()+'-'+file.name.replace(/[^a-zA-Z0-9._-]/g,'-');
 const {error}=await supabase.storage.from('posts').upload(path,file,{upsert:false,contentType:file.type});
 if(error)throw error;return supabase.storage.from('posts').getPublicUrl(path).data.publicUrl;
};

export default function VehicleShowroomModule({userId,isAdmin=false,role='customer'}:Props){
 const isDealer=role==='car_dealer';const isCustomer=!isAdmin&&!isDealer;
 const [listings,setListings]=useState<Listing[]>([]),[showroom,setShowroom]=useState<any>(null),[loading,setLoading]=useState(true),[message,setMessage]=useState('');
 const [query,setQuery]=useState(''),[makeFilter,setMakeFilter]=useState('all'),[conditionFilter,setConditionFilter]=useState('all'),[minPrice,setMinPrice]=useState(''),[maxPrice,setMaxPrice]=useState('');
 const [form,setForm]=useState(empty),[files,setFiles]=useState<File[]>([]),[previews,setPreviews]=useState<string[]>([]);

 const load=async()=>{
  setLoading(true);
  if(isDealer){const {data:s}=await supabase.from('vehicle_showrooms').select('*').eq('owner_id',userId).maybeSingle();setShowroom(s);}
  let q=supabase.from('vehicle_listings').select('*').order('created_at',{ascending:false});
  if(isCustomer)q=q.eq('status','approved');else if(isDealer)q=q.eq('owner_id',userId);
  const {data,error}=await q;if(error)setMessage(error.message);else setListings((data||[]) as Listing[]);
  setLoading(false);
 };
 useEffect(()=>{void load()},[userId,role,isAdmin]);

 const fee=Number(showroom?.posting_fee_iqd||0);
 const makes=useMemo(()=>Array.from(new Set(listings.map(x=>x.make).filter(Boolean))).sort(),[listings]);
 const filtered=useMemo(()=>listings.filter(x=>{
  const hay=(x.title+' '+x.make+' '+x.model+' '+(x.trim||'')).toLowerCase();
  const p=Number(x.price_iqd||0);
  return (!query||hay.includes(query.toLowerCase()))&&(makeFilter==='all'||x.make===makeFilter)&&(conditionFilter==='all'||x.condition===conditionFilter)&&(!minPrice||p>=Number(minPrice))&&(!maxPrice||p<=Number(maxPrice));
 }),[listings,query,makeFilter,conditionFilter,minPrice,maxPrice]);

 const pickFiles=(list:FileList|null)=>{
  const arr=Array.from(list||[]).filter(f=>f.type.startsWith('image/')).slice(0,8);
  setFiles(arr);setPreviews(arr.map(f=>URL.createObjectURL(f)));
 };

 const createListing=async()=>{
  if(!showroom)return setMessage('سەرەتا پێشانگا تۆمار بکە.');
  if(fee<=0)return setMessage('سوپەر ئەدمین هێشتا کرێی پۆستکردن دیاری نەکردووە.');
  if(!form.title||!form.make||!form.model||!form.price_iqd)return setMessage('سەردێڕ، مارکە، مۆدێل و نرخ پڕ بکەرەوە.');
  try{
   const images=[];for(const f of files)images.push(await uploadFile(userId,f));
   const {data,error}=await supabase.from('vehicle_listings').insert({
    showroom_id:showroom.id,owner_id:userId,title:form.title.trim(),make:form.make.trim(),model:form.model.trim(),trim:form.trim.trim()||null,
    model_year:form.model_year?Number(form.model_year):null,price_iqd:Number(form.price_iqd),mileage_km:form.mileage_km?Number(form.mileage_km):null,
    condition:form.condition,transmission:form.transmission,fuel_type:form.fuel_type,body_type:form.body_type,drivetrain:form.drivetrain,
    engine_size_cc:form.engine_size_cc?Number(form.engine_size_cc):null,cylinders:form.cylinders?Number(form.cylinders):null,horsepower:form.horsepower?Number(form.horsepower):null,
    doors:form.doors?Number(form.doors):null,seats:form.seats?Number(form.seats):null,color:form.color.trim()||null,city:form.city.trim()||'هەولێر',
    origin_country:form.origin_country.trim()||null,import_status:form.import_status,plate_status:form.plate_status,warranty:form.warranty.trim()||null,
    service_history:form.service_history.trim()||null,accident_history:form.accident_history.trim()||null,inspection_note:form.inspection_note.trim()||null,
    description:form.description.trim()||null,exchange_allowed:form.exchange_allowed,negotiable:form.negotiable,images,commission_iqd:0,status:'pending_payment'
   }).select('*').single();
   if(error)throw error;setListings(x=>[data as Listing,...x]);setForm({...empty,business_name:showroom.business_name});setFiles([]);setPreviews([]);setMessage('پۆستەکە دروست کرا. ئێستا کرێی پۆستکردن بدە و پاشان بۆ پەسەندکردن دەنێردرێت.');
  }catch(e:any){setMessage(e?.message||'دروستکردنی پۆستی ئۆتۆمبێل سەرکەوتوو نەبوو.')}
 };

 const registerShowroom=async()=>{
  if(!form.business_name.trim())return setMessage('ناوی پێشانگا بنووسە.');
  const {data,error}=await supabase.from('vehicle_showrooms').insert({owner_id:userId,business_name:form.business_name.trim()}).select('*').single();
  if(error)return setMessage(error.message);setShowroom(data);setForm(x=>({...x,business_name:data.business_name}));setMessage('پێشانگا تۆمار کرا.');
 };
 const payPosting=async(l:Listing)=>{
  if(!fee)return setMessage('کرێی پۆستکردن دیاری نەکراوە.');
  const {error}=await supabase.from('vehicle_posting_payments').insert({listing_id:l.id,showroom_id:l.showroom_id,payer_id:userId,amount_iqd:fee,payment_method:'cash',status:'pending'});
  if(error)return setMessage(error.message);
  const {error:ue}=await supabase.from('vehicle_listings').update({status:'pending_approval'}).eq('id',l.id).eq('owner_id',userId);
  if(ue)return setMessage(ue.message);setMessage('داواکاری پارەدان تۆمار کرا.');void load();
 };
 const approve=async(l:Listing)=>{const {error}=await supabase.from('vehicle_listings').update({status:'approved',approved_at:new Date().toISOString(),approved_by:userId}).eq('id',l.id);if(error)return setMessage(error.message);setMessage('پۆستەکە بڵاوکرایەوە.');void load()};
 const reject=async(l:Listing)=>{const {error}=await supabase.from('vehicle_listings').update({status:'rejected',approved_by:userId,rejection_reason:'پێویستی بە پشکنینەوەی زیاتر هەیە.'}).eq('id',l.id);if(error)return setMessage(error.message);setMessage('پۆستەکە ڕەتکرایەوە.');void load()};

 return <div className="section" style={{marginTop:0}}>
  <div className="title"><div><span>SHAKH CARS</span><h2><Car size={25} style={{verticalAlign:'middle'}}/> بازاڕی ئۆتۆمبێلی شاخ</h2></div><small>{isCustomer?'خۆت بەدوای ئۆتۆمبێلی گونجاو بگەڕێ':'پێشانگا و پۆستەکانی ئۆتۆمبێل'}</small></div>

  {isCustomer&&<div className="orderCard" style={{marginBottom:18}}>
   <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}><Filter size={18}/><b>گەڕان و فلتەر</b></div>
   <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr',gap:8}}>
    <label style={{display:'flex',alignItems:'center',gap:6,border:'1px solid #e7ecf2',padding:'0 10px',borderRadius:10}}><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="مارکە، مۆدێل، تایبەتمەندی..." style={{border:0}}/></label>
    <select value={makeFilter} onChange={e=>setMakeFilter(e.target.value)}><option value="all">هەموو مارکەکان</option>{makes.map(m=><option key={m}>{m}</option>)}</select>
    <select value={conditionFilter} onChange={e=>setConditionFilter(e.target.value)}><option value="all">هەموو دۆخەکان</option><option value="new">نوێ</option><option value="used">بەکارهاتوو</option></select>
    <input value={minPrice} onChange={e=>setMinPrice(e.target.value)} inputMode="numeric" placeholder="کەمترین نرخ"/>
    <input value={maxPrice} onChange={e=>setMaxPrice(e.target.value)} inputMode="numeric" placeholder="زۆرترین نرخ"/>
   </div>
   <small style={{display:'block',marginTop:9}}>پۆستە پەسەندکراوەکان، وێنەی چەندگۆشە، ساڵ، کیلۆمەتر، نرخ، سەیارەی نوێ/بەکارهاتوو و تایبەتمەندییە فنییەکان لێرە دەردەکەون.</small>
  </div>}

  {isDealer&&!showroom&&<div className="auth" style={{margin:'0 auto 20px'}}><h3>تۆمارکردنی پێشانگا</h3><input value={form.business_name} onChange={e=>setForm({...form,business_name:e.target.value})} placeholder="ناوی پێشانگا"/><button className="primary full" onClick={registerShowroom}><Plus size={17}/> تۆمارکردنی پێشانگا</button></div>}

  {isDealer&&showroom&&<><div className="orderCard" style={{marginBottom:18}}><ShieldCheck size={22}/><b>{showroom.business_name}</b><small>کرێی پۆستکردن: {fee?fee.toLocaleString('en-US'):'دیاری نەکراو'} د.ع · کۆمسیۆن لە فرۆشتن: ٠ د.ع</small></div>
   <div className="orderCard" style={{marginBottom:20}}><h3>پۆستکردنی ئۆتۆمبێل</h3>
    <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:9}}>
     <input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="سەردێڕی پۆست"/>
     <input value={form.make} onChange={e=>setForm({...form,make:e.target.value})} placeholder="مارکە"/>
     <input value={form.model} onChange={e=>setForm({...form,model:e.target.value})} placeholder="مۆدێل"/>
     <input value={form.trim} onChange={e=>setForm({...form,trim:e.target.value})} placeholder="تریم / فەل"/>
     <input value={form.model_year} onChange={e=>setForm({...form,model_year:e.target.value})} inputMode="numeric" placeholder="ساڵ"/>
     <input value={form.price_iqd} onChange={e=>setForm({...form,price_iqd:e.target.value})} inputMode="numeric" placeholder="نرخ بە د.ع"/>
     <input value={form.mileage_km} onChange={e=>setForm({...form,mileage_km:e.target.value})} inputMode="numeric" placeholder="کیلۆمەتر"/>
     <select value={form.condition} onChange={e=>setForm({...form,condition:e.target.value})}><option value="used">بەکارهاتوو</option><option value="new">نوێ</option></select>
     <select value={form.transmission} onChange={e=>setForm({...form,transmission:e.target.value})}>{transmissions.map(x=><option key={x[0]} value={x[0]}>{x[1]}</option>)}</select>
     <select value={form.fuel_type} onChange={e=>setForm({...form,fuel_type:e.target.value})}>{fuels.map(x=><option key={x[0]} value={x[0]}>{x[1]}</option>)}</select>
     <select value={form.body_type} onChange={e=>setForm({...form,body_type:e.target.value})}>{bodies.map(x=><option key={x[0]} value={x[0]}>{x[1]}</option>)}</select>
     <select value={form.drivetrain} onChange={e=>setForm({...form,drivetrain:e.target.value})}>{drive.map(x=><option key={x[0]} value={x[0]}>{x[1]}</option>)}</select>
     <input value={form.engine_size_cc} onChange={e=>setForm({...form,engine_size_cc:e.target.value})} inputMode="numeric" placeholder="قەبارەی مووتەڕ (CC)"/>
     <input value={form.cylinders} onChange={e=>setForm({...form,cylinders:e.target.value})} inputMode="numeric" placeholder="ژمارەی سیلێندەر"/>
     <input value={form.horsepower} onChange={e=>setForm({...form,horsepower:e.target.value})} inputMode="numeric" placeholder="هێزی مووتەڕ HP"/>
     <input value={form.doors} onChange={e=>setForm({...form,doors:e.target.value})} inputMode="numeric" placeholder="دەرگا"/>
     <input value={form.seats} onChange={e=>setForm({...form,seats:e.target.value})} inputMode="numeric" placeholder="کورسی"/>
     <input value={form.color} onChange={e=>setForm({...form,color:e.target.value})} placeholder="ڕەنگ"/>
     <input value={form.city} onChange={e=>setForm({...form,city:e.target.value})} placeholder="شار"/>
     <input value={form.origin_country} onChange={e=>setForm({...form,origin_country:e.target.value})} placeholder="وڵاتی سەرچاوە"/>
     <select value={form.import_status} onChange={e=>setForm({...form,import_status:e.target.value})}><option value="imported">هاوردەکراو</option><option value="local">ناوخۆیی</option></select>
     <select value={form.plate_status} onChange={e=>setForm({...form,plate_status:e.target.value})}><option value="registered">ژمارەی هاتوو</option><option value="unregistered">بێ ژمارە</option></select>
     <input value={form.warranty} onChange={e=>setForm({...form,warranty:e.target.value})} placeholder="گەرەنتی"/>
     <input value={form.service_history} onChange={e=>setForm({...form,service_history:e.target.value})} placeholder="مێژووی سێرڤیس"/>
     <input value={form.accident_history} onChange={e=>setForm({...form,accident_history:e.target.value})} placeholder="مێژووی ڕووداو"/>
    </div>
    <textarea rows={3} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="وەسفی تەواوی ئۆتۆمبێل"/>
    <textarea rows={2} value={form.inspection_note} onChange={e=>setForm({...form,inspection_note:e.target.value})} placeholder="تێبینی پشکنین / چاکسازی"/>
    <div style={{display:'flex',gap:16,flexWrap:'wrap',margin:'10px 0'}}><label><input type="checkbox" checked={form.negotiable} onChange={e=>setForm({...form,negotiable:e.target.checked})}/> نرخ قابیلی گفتوگۆیە</label><label><input type="checkbox" checked={form.exchange_allowed} onChange={e=>setForm({...form,exchange_allowed:e.target.checked})}/> گۆڕین/معاوضە قبووڵە</label></div>
    <div style={{padding:12,border:'1px dashed #ccd6e2',borderRadius:14}}><div style={{marginBottom:8,fontWeight:800}}><ImagePlus size={17}/> وێنەکان (تا ٨ وێنە)</div><input type="file" accept="image/*" multiple onChange={e=>pickFiles(e.target.files)}/><div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:7,marginTop:9}}>{previews.map((src,i)=><img key={src} src={src} alt={'ئۆتۆمبێل '+(i+1)} style={{width:'100%',height:100,objectFit:'cover',borderRadius:10}}/>)}</div></div>
    <button className="primary" onClick={createListing} style={{marginTop:12}}><Plus size={17}/> پۆستکردن و ناردن بۆ پەسەندکردن</button>
   </div></>}

  {loading?<div className="empty">چاوەڕێ بکە...</div>:<div className="dashboardGrid">{filtered.map(l=><article className="orderCard" key={l.id}>
   {l.images?.length>0&&<img src={l.images[0]} alt={l.title} style={{width:'100%',height:190,objectFit:'cover',borderRadius:14,marginBottom:10}}/>}
   <div className="orderCardTop"><strong>{l.title}</strong><span>{labels[l.status]||l.status}</span></div>
   <div className="orderMeta"><Car size={15}/> {l.make} {l.model} {l.trim||''} · {l.model_year||'—'} · {l.condition==='new'?'نوێ':'بەکارهاتوو'}</div>
   <div className="orderMeta"><MapPin size={15}/> {l.city||'هەولێر'} · {Number(l.mileage_km||0).toLocaleString('en-US')} km · {l.transmission||'—'} · {l.fuel_type||'—'}</div>
   <div className="orderMeta">{l.engine_size_cc?l.engine_size_cc+' CC':''}{l.horsepower?' · '+l.horsepower+' HP':''}{l.drivetrain?' · '+l.drivetrain:''}</div>
   <div className="orderTotal">{Number(l.price_iqd).toLocaleString('en-US')} د.ع</div>
   {isCustomer&&<div style={{display:'flex',gap:8}}><button className="plain" type="button"><Heart size={16}/> پاشەکەوتن</button><small style={{alignSelf:'center'}}>پێشانگای پەسەندکراو</small></div>}
   {isDealer&&l.status==='pending_payment'&&<button className="primary full" onClick={()=>payPosting(l)}><CreditCard size={16}/> دانانی داواکاری پارەی پۆستکردن ({fee.toLocaleString('en-US')} د.ع)</button>}
   {isAdmin&&l.status==='pending_approval'&&<div style={{display:'flex',gap:8}}><button className="primary" onClick={()=>approve(l)}><CheckCircle2 size={16}/> پەسەند</button><button className="reset" onClick={()=>reject(l)}><XCircle size={16}/> ڕەتکردنەوە</button></div>}
   {l.commission_iqd===0&&<small>کۆمسیۆن: ٠ د.ع</small>}
  </article>)}</div>}
  {message&&<div className="msg">{message}</div>}
 </div>;
}