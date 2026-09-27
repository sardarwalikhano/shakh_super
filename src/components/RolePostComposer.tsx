import React,{useMemo,useState} from 'react';
import {ImagePlus,Send,Tag} from 'lucide-react';
import {supabase} from '../lib/supabase';

type Props={userId:string;role:string;onSaved?:()=>void};

const CONFIG:Record<string,{types:{value:string;label:string}[];heading:string;label:string}> = {
 customer:{types:[{value:'general',label:'گشتی'},{value:'marketplace',label:'بازاڕ'}],heading:'پۆستی نوێ',label:'کڕیار'},
 captain:{types:[{value:'delivery',label:'گەیاندن'}],heading:'پۆستی گەیاندن',label:'کاپتن'},
 car_dealer:{types:[{value:'car',label:'ئۆتۆمبێل'}],heading:'پۆستی ئۆتۆمبێل',label:'پێشانگای ئۆتۆمبێل'},
 umrah_agency:{types:[{value:'umrah',label:'عومرە'}],heading:'پۆستی عومرە',label:'کۆمپانیای عومرە'},
 admin:{types:[{value:'announcement',label:'ئاگاداری'},{value:'support',label:'پشتگیری'}],heading:'پۆستی بەڕێوەبەر',label:'بەڕێوبەر'},
 super_admin:{types:[{value:'announcement',label:'ئاگاداری'},{value:'support',label:'پشتگیری'}],heading:'پۆستی بەڕێوەبەر',label:'بەڕێوبەری باڵا'}
};

export default function RolePostComposer({userId,role,onSaved}:Props){
 const cfg=CONFIG[role]||CONFIG.customer;
 const [postType,setPostType]=useState(cfg.types[0].value);
 const [title,setTitle]=useState('');
 const [content,setContent]=useState('');
 const [price,setPrice]=useState('');
 const [city,setCity]=useState('هەولێر');
 const [file,setFile]=useState<File|null>(null);
 const [preview,setPreview]=useState('');
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');

 const isPriceVisible=useMemo(()=>postType==='marketplace'||postType==='car'||postType==='umrah',[postType]);

 const chooseFile=(f?:File)=>{
  if(!f)return;
  if(!f.type.startsWith('image/'))return setMessage('تەنها وێنە هەڵبژێرە.');
  if(f.size>5*1024*1024)return setMessage('قەبارەی وێنە نابێت لە ٥ مێگابایت زیاتر بێت.');
  setFile(f);setPreview(URL.createObjectURL(f));setMessage('');
 };

 const submit=async()=>{
  try{
   if(!title.trim())return setMessage('سەردێڕ پڕ بکەرەوە.');
   setBusy(true);setMessage('');
   let imageUrl:string|null=null;
   if(file){
    const path=userId+'/posts/'+Date.now()+'-'+file.name.replace(/[^a-zA-Z0-9._-]/g,'-');
    const {error:upErr}=await supabase.storage.from('products').upload(path,file,{upsert:false,contentType:file.type});
    if(upErr)throw upErr;
    imageUrl=supabase.storage.from('products').getPublicUrl(path).data.publicUrl;
   }
   const {error}=await supabase.from('posts').insert({
    author_id:userId,
    title:title.trim(),
    content:content.trim()||null,
    images:imageUrl?[imageUrl]:[],
    price_iqd:price?Number(price):null,
    city:city.trim()||'هەولێر',
    status:role==='admin'||role==='super_admin'?'approved':'approved',
    section:postType,
    publisher_name:undefined,
    post_type:postType,
    publisher_role:role,
    label:cfg.label,
    visibility:'public'
   });
   if(error)throw error;
   setTitle('');setContent('');setPrice('');setCity('هەولێر');setFile(null);setPreview('');
   setMessage('پۆستەکە بە سەرکەوتوویی بڵاوکرایەوە.');
   onSaved?.();
  }catch(e:any){setMessage(e?.message||'پۆستکردن سەرکەوتوو نەبوو.')}finally{setBusy(false)}
 };

 return <section className="orderCard" style={{marginTop:18}}>
  <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center'}}>
   <div><span className="eyebrow">پۆستکردن</span><h3 style={{margin:'6px 0 2px'}}>{cfg.heading}</h3><small>{cfg.label}</small></div>
   <Tag size={24}/>
  </div>
  {cfg.types.length>1&&<label style={{marginTop:10}}>جۆری پۆست<select value={postType} onChange={e=>setPostType(e.target.value)} style={{width:'100%'}}>{cfg.types.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select></label>}
  <label style={{marginTop:10}}>سەردێڕ<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="سەردێڕی پۆست"/></label>
  <label>ناوەڕۆک<textarea rows={4} value={content} onChange={e=>setContent(e.target.value)} placeholder="پەیام یان زانیاریی پۆست..."/></label>
  <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:10}}>
   {isPriceVisible&&<label>نرخ بە د.ع<input value={price} onChange={e=>setPrice(e.target.value.replace(/[^0-9]/g,''))} inputMode="numeric" placeholder="نرخ"/></label>}
   <label>شار<input value={city} onChange={e=>setCity(e.target.value)} placeholder="هەولێر"/></label>
  </div>
  <div style={{marginTop:10,padding:12,border:'1px dashed #ccd6e2',borderRadius:14}}>
   <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:8}}><ImagePlus size={18}/> وێنەی پۆست</div>
   <input type="file" accept="image/*" onChange={e=>chooseFile(e.target.files?.[0])}/>
   {preview&&<img src={preview} alt={title||'پۆست'} style={{width:'100%',maxHeight:220,objectFit:'cover',borderRadius:12,marginTop:10}}/>}
  </div>
  <button type="button" className="primary" disabled={busy} onClick={()=>void submit()} style={{marginTop:12}}><Send size={17}/>{busy?'تکایە چاوەڕێ بکە':'بڵاوکردنەوەی پۆست'}</button>
  {message&&<div className="msg" style={{marginTop:10}}>{message}</div>}
 </section>;
}