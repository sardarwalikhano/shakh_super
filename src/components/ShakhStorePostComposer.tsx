import React,{useState} from 'react';
import {createClient} from '@supabase/supabase-js';
import {Send,Store} from 'lucide-react';

const url=import.meta.env.VITE_SUPABASE_URL as string|undefined;
const key=import.meta.env.VITE_SUPABASE_ANON_KEY as string|undefined;
const supabase=url&&key?createClient(url,key):null;

const sections=[
 {value:'restaurant',label:'🍽️ چێشتخانە'},
 {value:'supermarket',label:'🛒 سوپەرمارکێت'},
 {value:'fashion',label:'👕 جل و بەرگ'},
 {value:'daily',label:'🏪 بازاڕ'},
 {value:'marketplace',label:'🛍️ مارکێت‌پڵەیس'},
 {value:'electronics',label:'📱 ئەلیکترۆنیات'},
 {value:'jewelry',label:'💎 جواکاری'},
 {value:'cars',label:'🚗 ئۆتۆمبێل'},
 {value:'umrah',label:'🕋 حەج و عومرە'}
];

export default function ShakhStorePostComposer({userId}:{userId:string}){
 const [section,setSection]=useState('marketplace');
 const [title,setTitle]=useState('');
 const [content,setContent]=useState('');
 const [price,setPrice]=useState('');
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const submit=async()=>{
  if(!supabase)return setMessage('پەیوەندی بە Supabase بەردەست نییە.');
  if(!title.trim())return setMessage('ناونیشانی پۆست بنووسە.');
  try{
   setBusy(true);setMessage('');
   const {error}=await supabase.from('posts').insert({author_id:userId,title:title.trim(),content:content.trim()||null,price_iqd:price?Number(price):null,section,publisher_name:'SHAKH Store',status:'approved'});
   if(error)throw error;
   setTitle('');setContent('');setPrice('');
   setMessage('پۆست بە ناوی SHAKH Store بڵاوکرایەوە.');
  }catch(e:any){setMessage(e?.message||'بڵاوکردنەوەی پۆست سەرکەوتوو نەبوو.')}finally{setBusy(false)}
 };
 return <div style={{border:'1px solid #eee',borderRadius:18,padding:18,marginTop:18,background:'#fff'}}>
  <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}><Store size={22}/><div><b>SHAKH Store</b><small style={{display:'block',opacity:.65}}>پۆستکردن لە هەموو بەشەکان</small></div></div>
  <select value={section} onChange={e=>setSection(e.target.value)} style={{width:'100%',padding:11,borderRadius:10,border:'1px solid #ddd',marginBottom:10}}>{sections.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}</select>
  <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="ناونیشانی پۆست" style={{width:'100%',padding:11,borderRadius:10,border:'1px solid #ddd',marginBottom:10}}/>
  <textarea value={content} onChange={e=>setContent(e.target.value)} placeholder="ناوەڕۆکی پۆست" rows={4} style={{width:'100%',padding:11,borderRadius:10,border:'1px solid #ddd',marginBottom:10,resize:'vertical'}}/>
  <input value={price} onChange={e=>setPrice(e.target.value)} inputMode="numeric" placeholder="نرخ بە دینار (ئارەزوومەندانە)" style={{width:'100%',padding:11,borderRadius:10,border:'1px solid #ddd',marginBottom:10}}/>
  <button type="button" className="primary full" disabled={busy} onClick={submit}><Send size={17}/>{busy?'تکایە چاوەڕێ بکە':'بڵاوکردنەوەی پۆست'}</button>
  {message&&<small className="msg">{message}</small>}
 </div>;
}
