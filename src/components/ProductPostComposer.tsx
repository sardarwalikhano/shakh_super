import React,{useEffect,useState} from 'react';
import {CheckCircle2,ImagePlus,PackagePlus,Store,Upload} from 'lucide-react';
import {supabase} from '../lib/supabase';

type Role='restaurant_vendor'|'supermarket_vendor'|'fashion_vendor'|'vendor'|'electronics_vendor'|'jewelry_vendor';
type Props={userId:string;role:string;onSaved?:()=>void};
type Config={storeCategory:string;label:string;heading:string;typeLabel:string;brand:boolean;size:boolean;cats:{slug:string;label:string;icon:string}[]};

const CONFIG:Record<Role,Config>={
 restaurant_vendor:{storeCategory:'restaurant',label:'چێشتخانە',heading:'پۆستکردنی خواردن',typeLabel:'جۆری خواردن',brand:false,size:false,cats:[{slug:'restaurant_food',label:'خواردنی چێشتخانە',icon:'🍽️'}]},
 supermarket_vendor:{storeCategory:'supermarket',label:'سووپەرمارکێت',heading:'پۆستکردنی بەرهەم',typeLabel:'جۆری بەرهەم',brand:true,size:false,cats:[
  {slug:'supermarket_food',label:'خواردن',icon:'🍎'},{slug:'supermarket_drinks',label:'خواردنەوە',icon:'🥤'},{slug:'supermarket_biscuits',label:'پسکیت',icon:'🍪'},{slug:'supermarket_cleaners',label:'پاککەرەوەکان',icon:'🧴'},{slug:'supermarket_dairy',label:'شیر و دایبی',icon:'🥛'}]},
 fashion_vendor:{storeCategory:'fashion',label:'جل و بەرگ',heading:'پۆستکردنی جل و بەرگ',typeLabel:'جۆری جل',brand:true,size:true,cats:[
  {slug:'fashion_men',label:'پیاوان',icon:'👔'},{slug:'fashion_women',label:'ئافرەتان',icon:'👗'},{slug:'fashion_kids',label:'منداڵان',icon:'🧒'}]},
 vendor:{storeCategory:'daily',label:'بازاڕ',heading:'پۆستکردنی بەرهەمی بازاڕ',typeLabel:'جۆری بەرهەم',brand:true,size:true,cats:[{slug:'general_store',label:'بازاڕی گشتی',icon:'🏪'}]},
 electronics_vendor:{storeCategory:'electronics',label:'ئەلیکترۆنیات',heading:'پۆستکردنی ئەلیکترۆنیات',typeLabel:'جۆری ئامێر',brand:true,size:false,cats:[
  {slug:'electronics_mobile',label:'مۆبایل و تابلێت',icon:'📱'},{slug:'electronics_computers',label:'کۆمپیوتەر',icon:'💻'},{slug:'electronics_home',label:'تەڵەفیزیۆن و ئامێرەکانی ماڵ',icon:'📺'},{slug:'electronics_accessories',label:'ئەکسسوارات ئەلیکترۆنی',icon:'🔌'}]},
 jewelry_vendor:{storeCategory:'jewelry',label:'جواکاری',heading:'پۆستکردنی جواکاری',typeLabel:'جۆری جواکاری',brand:true,size:true,cats:[
  {slug:'jewelry_gold',label:'زێڕ',icon:'💛'},{slug:'jewelry_silver',label:'زیو',icon:'🤍'},{slug:'jewelry_watches',label:'کاتژمێر',icon:'⌚'},{slug:'jewelry_accessories',label:'ئەکسسوارات',icon:'💎'}]}
};

const init={storeName:'',type:'',brand:'',name:'',size:'',price:'',description:'',available:true};

export default function ProductPostComposer({userId,role,onSaved}:Props){
 const cfg=CONFIG[role as Role];
 if(!cfg)return null;
 const [form,setForm]=useState(init),[category,setCategory]=useState(cfg.cats[0].slug),[storeId,setStoreId]=useState(''),[file,setFile]=useState<File|null>(null),[preview,setPreview]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');

 useEffect(()=>{let live=true;(async()=>{
  const {data}=await supabase.from('stores').select('id,name').eq('owner_id',userId).eq('category',cfg.storeCategory).eq('is_active',true).limit(1).maybeSingle();
  if(live&&data){setStoreId(data.id);setForm(x=>({...x,storeName:data.name||''}));}
 })();return()=>{live=false}},[userId,role,cfg.storeCategory]);

 const pick=(f?:File)=>{if(!f)return;if(!f.type.startsWith('image/'))return setMessage('تەنها وێنە هەڵبژێرە.');if(f.size>5242880)return setMessage('قەبارەی وێنە نابێت لە ٥ مێگابایت زیاتر بێت.');setFile(f);setPreview(URL.createObjectURL(f));setMessage('')};

 const getStore=async()=>{
  if(storeId)return storeId;
  if(!form.storeName.trim())throw new Error('ناوی دوکان بنووسە.');
  const {data,error}=await supabase.from('stores').insert({owner_id:userId,name:form.storeName.trim(),category:cfg.storeCategory,city:'هەولێر',is_active:true}).select('id').single();
  if(error)throw error;setStoreId(data.id);return data.id;
 };

 const upload=async()=>{if(!file)return null;const path=userId+'/'+Date.now()+'-'+file.name.replace(/[^a-zA-Z0-9._-]/g,'-');const {error}=await supabase.storage.from('products').upload(path,file,{upsert:false,contentType:file.type});if(error)throw error;return supabase.storage.from('products').getPublicUrl(path).data.publicUrl};

 const submit=async()=>{
  try{
   if(!form.name.trim()||!form.type.trim()||!form.price)return setMessage('ناو، جۆر و نرخ پڕ بکەرەوە.');
   if(cfg.brand&&!form.brand.trim())return setMessage('مارکە بنووسە.');
   if(cfg.size&&!form.size.trim())return setMessage('قەبارە بنووسە.');
   setBusy(true);setMessage('');
   const sid=await getStore();
   const {data:cat,error:ce}=await supabase.from('categories').select('id').eq('slug',category).single();if(ce)throw ce;
   const image_url=await upload();
   const {error}=await supabase.from('products').insert({store_id:sid,category_id:cat.id,name_ku:form.name.trim(),name_ar:form.name.trim(),name_en:form.name.trim(),description_ku:form.description.trim()||null,price_iqd:Number(form.price),product_type:form.type.trim(),brand:form.brand.trim()||null,size:form.size.trim()||null,image_url,stock:form.available?1:0,is_available:form.available,variants:[{section:role,category}]});
   if(error)throw error;
   const storeName=form.storeName;setForm({...init,storeName});setFile(null);setPreview('');setMessage('بەرهەمەکە بە سەرکەوتوویی پۆست کرا.');onSaved?.();
  }catch(e:any){setMessage(e?.message||'پۆستکردنی بەرهەم سەرکەوتوو نەبوو.')}finally{setBusy(false)}
 };

 return <section className="orderCard" style={{marginTop:18}}>
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}><div><span className="eyebrow">پۆستکردن</span><h3 style={{margin:'6px 0 2px'}}>{cfg.heading}</h3><small>{cfg.label} · زانیاریی بەرهەم</small></div><PackagePlus size={26}/></div>
  {!storeId&&<label>ناوی دوکان<input value={form.storeName} onChange={e=>setForm({...form,storeName:e.target.value})} placeholder={cfg.label}/></label>}
  <label>کاتەگۆری<select value={category} onChange={e=>setCategory(e.target.value)} style={{width:'100%'}}>{cfg.cats.map(c=><option key={c.slug} value={c.slug}>{c.icon} {c.label}</option>)}</select></label>
  <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:10}}>
   <label>ناو<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="ناوی بەرهەم"/></label>
   <label>{cfg.typeLabel}<input value={form.type} onChange={e=>setForm({...form,type:e.target.value})} placeholder="نموونە: کەباب / قەمیس"/></label>
   {cfg.brand&&<label>مارکە<input value={form.brand} onChange={e=>setForm({...form,brand:e.target.value})} placeholder="مارکە"/></label>}
   {cfg.size&&<label>قەبارە<input value={form.size} onChange={e=>setForm({...form,size:e.target.value})} placeholder="سایز"/></label>}
   <label>نرخ بە د.ع<input value={form.price} onChange={e=>setForm({...form,price:e.target.value})} inputMode="numeric" placeholder="نرخ"/></label>
  </div>
  <label>وەسف<textarea rows={3} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="زانیاری زیاتر"/></label>
  <div style={{marginTop:10,padding:12,border:'1px dashed #ccd6e2',borderRadius:14}}><div style={{display:'flex',gap:8,alignItems:'center',marginBottom:8}}><ImagePlus size={18}/> وێنەی بەرهەم</div><input type="file" accept="image/*" onChange={e=>pick(e.target.files?.[0])}/>{preview&&<img src={preview} alt={form.name||'بەرهەم'} style={{width:'100%',maxHeight:220,objectFit:'cover',borderRadius:12,marginTop:10}}/>}</div>
  <label style={{display:'flex',gap:8,alignItems:'center',marginTop:12}}><input type="checkbox" checked={form.available} onChange={e=>setForm({...form,available:e.target.checked})}/> بەرهەم بەردەستە</label>
  <button type="button" className="primary" disabled={busy} onClick={submit} style={{marginTop:12}}>{busy?<Upload size={17}/>:<Store size={17}/>} {busy?'تکایە چاوەڕێ بکە':'پۆستکردنی بەرهەم'}</button>
  {message&&<div className="msg" style={{marginTop:10}}>{message}</div>}
  <small style={{display:'flex',gap:6,alignItems:'center',marginTop:8,color:'#718096'}}><CheckCircle2 size={14}/> زانیارییەکان لە داتابەیسی شاخ هەڵدەگیرێن.</small>
 </section>;
}