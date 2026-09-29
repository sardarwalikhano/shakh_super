import { useEffect, useState } from 'react';
import { LocateFixed, MapPin, Save } from 'lucide-react';
import InteractiveMapPicker from './InteractiveMapPicker';
import { supabase } from '../lib/supabase';

type Point={latitude:number;longitude:number};
type Props={storeId:string;userId:string};

export default function StoreLocationManager({storeId,userId}:Props){
 const [coords,setCoords]=useState<Point|null>(null);
 const [address,setAddress]=useState('');
 const [city,setCity]=useState('هەولێر');
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [message,setMessage]=useState('');

 useEffect(()=>{
  let active=true;
  const load=async()=>{
   setLoading(true);
   const {data,error}=await supabase.from('stores').select('latitude,longitude,address,city').eq('id',storeId).eq('owner_id',userId).maybeSingle();
   if(!active)return;
   if(error){setMessage(error.message);setLoading(false);return}
   if(data){
    const lat=data.latitude==null?null:Number(data.latitude);
    const lng=data.longitude==null?null:Number(data.longitude);
    setCoords(lat!=null&&lng!=null&&Number.isFinite(lat)&&Number.isFinite(lng)?{latitude:lat,longitude:lng}:null);
    setAddress(data.address||'');
    setCity(data.city||'هەولێر');
   }
   setLoading(false);
  };
  void load();
  return()=>{active=false};
 },[storeId,userId]);

 const useMyLocation=()=>{
  if(!('geolocation' in navigator))return setMessage('وێبگەڕەکەت پشتگیری GPS ناکات.');
  setMessage('شوێنی ئێستا وەردەگیرێت...');
  navigator.geolocation.getCurrentPosition(
   position=>{setCoords({latitude:position.coords.latitude,longitude:position.coords.longitude});setMessage('شوێنی دوکان دیاریکرا. ئێستا پاشەکەوتی بکە.')},
   ()=>setMessage('نەتوانرا شوێن وەرگیرێت؛ مۆڵەتی Location پێویستە.'),
   {enableHighAccuracy:true,timeout:12000,maximumAge:30000},
  );
 };
 const save=async()=>{
  if(!coords)return setMessage('تکایە شوێنی دوکان لەسەر نەخشە دیاری بکە.');
  setSaving(true);setMessage('');
  const {error}=await supabase.from('stores').update({
   latitude:coords.latitude,longitude:coords.longitude,address:address.trim(),city:city.trim()||'هەولێر',updated_at:new Date().toISOString()
  }).eq('id',storeId).eq('owner_id',userId);
  if(error)setMessage(error.message);else setMessage('شوێنی دوکان بە سەرکەوتوویی پاشەکەوت کرا.');
  setSaving(false);
 };
 if(loading)return <div className='orderCard'><span>شوێنی دوکان بار دەکرێت...</span></div>;
 return <div className='orderCard storeLocationManager' dir='rtl'>
  <div className='storeLocationHeader'><div><span className='eyebrow'><MapPin size={16}/> نەخشەی دوکان</span><h3>شوێنی دوکان و ناونیشان</h3><p>شوێنی ڕاستەقینەی دوکان دیاری بکە بۆ کڕیار و کاپتن.</p></div><button className='plain' type='button' onClick={useMyLocation}><LocateFixed size={16}/> شوێنی من</button></div>
  <InteractiveMapPicker value={coords} onChange={(next)=>{setCoords(next);setMessage('شوێنی نوێ دیاریکرا.')}}/>
  <div className='storeLocationFields'><label>ناونیشان<input value={address} onChange={e=>setAddress(e.target.value)} placeholder='ناونیشانی دوکان'/></label><label>شار<input value={city} onChange={e=>setCity(e.target.value)} placeholder='هەولێر'/></label></div>
  {coords&&<div className='storeLocationCoords'><MapPin size={15}/>{coords.latitude.toFixed(6)}, {coords.longitude.toFixed(6)}</div>}
  {message&&<div className='msg' role='status' aria-live='polite'>{message}</div>}
  <button className='primary full' type='button' onClick={()=>void save()} disabled={saving}><Save size={16}/>{saving?'پاشەکەوت دەکرێت...':'پاشەکەوتکردنی شوێنی دوکان'}</button>
 </div>;
}