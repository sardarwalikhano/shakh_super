import React,{useEffect,useMemo,useState} from 'react';
import {Car,Filter,MapPin,Search,ShieldCheck,SlidersHorizontal} from 'lucide-react';
import {supabase} from '../lib/supabase';

type Listing={
 id:string;title:string;make:string;model:string;trim?:string|null;model_year?:number|null;price_iqd:number;
 mileage_km?:number|null;condition:string;transmission?:string|null;fuel_type?:string|null;color?:string|null;
 body_type?:string|null;drivetrain?:string|null;engine_size_cc?:number|null;horsepower?:number|null;
 city?:string|null;images?:string[];negotiable?:boolean;exchange_allowed?:boolean;showroom_id:string;
};
type Row=Listing&{vehicle_showrooms?:{business_name?:string|null}|null};

export default function ShakhCarsMarketplace(){
 const [items,setItems]=useState<Row[]>([]);
 const [q,setQ]=useState('');const [make,setMake]=useState('all');const [condition,setCondition]=useState('all');const [body,setBody]=useState('all');const [city,setCity]=useState('all');
 const [min,setMin]=useState('');const [max,setMax]=useState('');const [loading,setLoading]=useState(true);

 useEffect(()=>{let live=true;(async()=>{
  const {data}=await supabase.from('vehicle_listings').select('id,title,make,model,trim,model_year,price_iqd,mileage_km,condition,transmission,fuel_type,color,body_type,drivetrain,engine_size_cc,horsepower,city,images,negotiable,exchange_allowed,showroom_id,vehicle_showrooms(business_name)').eq('status','approved').order('created_at',{ascending:false});
  if(live)setItems((data||[]) as Row[]);setLoading(false);
 })();return()=>{live=false}},[]);

 const options=(field:keyof Row)=>Array.from(new Set(items.map(x=>String(x[field]||'')).filter(Boolean))).sort();
 const filtered=useMemo(()=>items.filter(x=>{
  const hay=(x.title+' '+x.make+' '+x.model+' '+(x.trim||'')).toLowerCase();
  const price=Number(x.price_iqd||0);
  return (!q||hay.includes(q.toLowerCase()))&&(make==='all'||x.make===make)&&(condition==='all'||x.condition===condition)&&(body==='all'||x.body_type===body)&&(city==='all'||x.city===city)&&(!min||price>=Number(min))&&(!max||price<=Number(max));
 }),[items,q,make,condition,body,city,min,max]);

 return <section className="section" style={{marginTop:0}}>
  <div className="title"><div><span>SHAKH CARS</span><h2><Car size={25} style={{verticalAlign:'middle'}}/> بازاڕی ئۆتۆمبێلی شاخ</h2></div><small>پۆستە پەسەندکراوەکان</small></div>
  <div className="orderCard" style={{marginBottom:18}}>
   <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}><SlidersHorizontal size={18}/><b>گەڕان و فلتەر</b></div>
   <div className="carsMarketplaceFilterGrid">
    <label style={{display:'flex',alignItems:'center',gap:7}}><Search size={16}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="مارکە، مۆدێل یان تریم"/></label>
    <select value={make} onChange={e=>setMake(e.target.value)}><option value="all">هەموو مارکەکان</option>{options('make').map(x=><option key={x}>{x}</option>)}</select>
    <select value={condition} onChange={e=>setCondition(e.target.value)}><option value="all">نوێ و بەکارهاتوو</option><option value="new">نوێ</option><option value="used">بەکارهاتوو</option></select>
    <select value={body} onChange={e=>setBody(e.target.value)}><option value="all">هەموو جۆرە جەستەکان</option>{options('body_type').map(x=><option key={x}>{x}</option>)}</select>
   </div>
   <div className="carsMarketplacePriceGrid">
    <select value={city} onChange={e=>setCity(e.target.value)}><option value="all">هەموو شارەکان</option>{options('city').map(x=><option key={x}>{x}</option>)}</select>
    <input value={min} onChange={e=>setMin(e.target.value)} inputMode="numeric" placeholder="کەمترین نرخ"/>
    <input value={max} onChange={e=>setMax(e.target.value)} inputMode="numeric" placeholder="زۆرترین نرخ"/>
    <div style={{display:'flex',alignItems:'center',gap:8,color:'#718096'}}><Filter size={16}/> {filtered.length.toLocaleString('ku-IQ')} ئەنجام</div>
   </div>
  </div>
  {loading?<div className="empty">چاوەڕێ بکە...</div>:!filtered.length?<div className="empty"><Car size={42}/><h3>هیچ ئۆتۆمبێلێک نەدۆزرایەوە</h3><p>فلتەرەکان بگۆڕە و دوبارە هەوڵ بدە.</p></div>:<div className="grid">{filtered.map(x=><article className="card" key={x.id}>
   <div className="pic" style={{height:220}}>{x.images?.[0]?<img src={x.images[0]} alt={x.title} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:70}}>🚗</span>}</div>
   <div className="body">
    <small>{x.vehicle_showrooms?.business_name||'پێشانگا'} · {x.city||'هەولێر'}</small>
    <h3>{x.title}</h3>
    <div style={{display:'flex',gap:6,flexWrap:'wrap',margin:'7px 0'}}><span className="badge">{x.model_year||'—'}</span><span className="badge">{x.condition==='new'?'نوێ':'بەکارهاتوو'}</span><span className="badge">{Number(x.mileage_km||0).toLocaleString('en-US')} km</span></div>
    <small>{x.transmission||'—'} · {x.fuel_type||'—'} · {x.body_type||'—'} {x.engine_size_cc?'· '+x.engine_size_cc+' CC':''}</small>
    <div className="buy"><b>{Number(x.price_iqd).toLocaleString('en-US')} د.ع</b><small>{x.negotiable?'قابیلی گفتوگۆ':'نرخی کۆتایی'}</small></div>
    <div style={{display:'flex',gap:8,alignItems:'center'}}><ShieldCheck size={15}/><small>پۆستی پەسەندکراوی شاخ</small>{x.exchange_allowed&&<small> · معاوضە</small>}</div>
   </div>
  </article>)}</div>}
 </section>;
}