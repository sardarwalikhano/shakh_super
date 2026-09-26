import React,{useEffect,useState} from 'react';
import {Edit3,Save,Trash2,X} from 'lucide-react';
import {supabase} from '../lib/supabase';

type Product={id:string;store_id:string;name_ku:string;price_iqd:number;product_type?:string|null;brand?:string|null;size?:string|null;image_url?:string|null;is_available:boolean};
type Props={userId:string;role:string;onChanged?:()=>void};

const vendorCategories:Record<string,string[]>={
 restaurant_vendor:['restaurant'],supermarket_vendor:['supermarket'],fashion_vendor:['fashion'],vendor:['daily'],electronics_vendor:['electronics'],jewelry_vendor:['jewelry']
};

export default function ProductManagement({userId,role,onChanged}:Props){
 const [items,setItems]=useState<Product[]>([]),[loading,setLoading]=useState(true),[editing,setEditing]=useState<Product|null>(null),[message,setMessage]=useState('');
 const load=async()=>{
  setLoading(true);
  const cats=vendorCategories[role]||[];
  const {data:stores}=await supabase.from('stores').select('id').eq('owner_id',userId).in('category',cats);
  const ids=(stores||[]).map((s:any)=>s.id);
  if(!ids.length){setItems([]);setLoading(false);return}
  const {data,error}=await supabase.from('products').select('id,store_id,name_ku,price_iqd,product_type,brand,size,image_url,is_available').in('store_id',ids).order('created_at',{ascending:false});
  if(error)setMessage(error.message);else setItems((data||[]) as Product[]);
  setLoading(false);
 };
 useEffect(()=>{void load()},[userId,role]);

 const update=async(p:Product)=>{
  const {error}=await supabase.from('products').update({
   name_ku:p.name_ku.trim(),price_iqd:Number(p.price_iqd),product_type:p.product_type?.trim()||null,
   brand:p.brand?.trim()||null,size:p.size?.trim()||null,is_available:p.is_available,stock:p.is_available?1:0
  }).eq('id',p.id);
  if(error)return setMessage(error.message);
  setItems(x=>x.map(i=>i.id===p.id?p:i));setEditing(null);setMessage('بەرهەمەکە نوێکرایەوە.');onChanged?.();
 };

 const remove=async(p:Product)=>{
  if(!window.confirm('دڵنیایت لە سڕینەوەی ئەم بەرهەمە؟'))return;
  const {error}=await supabase.from('products').delete().eq('id',p.id);
  if(error)return setMessage(error.message);
  setItems(x=>x.filter(i=>i.id!==p.id));setMessage('بەرهەمەکە سڕایەوە.');onChanged?.();
 };

 return <section className="orderCard" style={{marginTop:18}}>
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}><div><span className="eyebrow">بەڕێوەبردن</span><h3 style={{margin:'6px 0 2px'}}>بەرهەمەکانم</h3><small>دەستکاری، بەردەستی و سڕینەوە</small></div><b>{items.length.toLocaleString('ku-IQ')}</b></div>
  {loading?<div className="empty">چاوەڕێ بکە...</div>:!items.length?<div className="empty"><h4>هێشتا بەرهەمێکت نییە</h4><p>لە فۆڕمی پۆستکردنەوە بەرهەمێک زیاد بکە.</p></div>:<div className="dashboardGrid">{items.map(p=>editing?.id===p.id?<div className="orderCard" key={p.id}>
    <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}><b>دەستکاریکردنی بەرهەم</b><button className="plain" onClick={()=>setEditing(null)}><X size={16}/></button></div>
    <input value={editing.name_ku} onChange={e=>setEditing({...editing,name_ku:e.target.value})} placeholder="ناو"/>
    <input value={editing.product_type||''} onChange={e=>setEditing({...editing,product_type:e.target.value})} placeholder="جۆر"/>
    <input value={editing.brand||''} onChange={e=>setEditing({...editing,brand:e.target.value})} placeholder="مارکە"/>
    <input value={editing.size||''} onChange={e=>setEditing({...editing,size:e.target.value})} placeholder="قەبارە"/>
    <input value={String(editing.price_iqd)} onChange={e=>setEditing({...editing,price_iqd:Number(e.target.value)||0})} inputMode="numeric" placeholder="نرخ"/>
    <label><input type="checkbox" checked={editing.is_available} onChange={e=>setEditing({...editing,is_available:e.target.checked})}/> بەردەستە</label>
    <button className="primary full" onClick={()=>void update(editing)}><Save size={16}/> پاشەکەوتکردن</button>
   </div>:<article className="orderCard" key={p.id}>{p.image_url&&<img src={p.image_url} alt={p.name_ku} style={{width:'100%',height:150,objectFit:'cover',borderRadius:12,marginBottom:8}}/>}<div className="orderCardTop"><strong>{p.name_ku}</strong><span>{p.is_available?'بەردەستە':'بەردەست نییە'}</span></div><small>{p.product_type||'—'}{p.brand?' · '+p.brand:''}{p.size?' · '+p.size:''}</small><div className="orderTotal">{Number(p.price_iqd).toLocaleString('en-US')} د.ع</div><div style={{display:'flex',gap:8,marginTop:8}}><button className="primary" onClick={()=>setEditing(p)}><Edit3 size={16}/> دەستکاری</button><button className="reset" onClick={()=>void remove(p)}><Trash2 size={16}/> سڕینەوە</button></div></article>)}</div>}
  {message&&<div className="msg" style={{marginTop:10}}>{message}</div>}
 </section>;
}