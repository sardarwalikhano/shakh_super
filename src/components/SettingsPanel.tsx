import { useEffect, useState } from 'react';
import { Bell, Check, LogOut, MapPin, Moon, Monitor, Phone, Save, ShieldCheck, Sun } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { applyTheme, getCurrentTheme } from '../lib/theme';

type Preferences = { theme:'system'|'light'|'dark'; order_notifications:boolean; delivery_notifications:boolean; wallet_notifications:boolean; marketing_notifications:boolean };
type PlatformSettings = { default_delivery_fee_iqd:number; platform_fee_iqd:number; commission_percent:number; referral_commission_percent:number; support_phone:string; support_whatsapp:string; default_city:string; privacy_policy_version:string };

export default function SettingsPanel({ userId, role, onSignOut, onPrivacy }: { userId:string; role:string; onSignOut:()=>Promise<void>|void; onPrivacy:()=>void }) {
  const isAdmin = role==='super_admin' || role==='admin';
  const [prefs,setPrefs]=useState<Preferences>({theme:'system',order_notifications:true,delivery_notifications:true,wallet_notifications:true,marketing_notifications:true});
  const [city,setCity]=useState('هەولێر');
  const [platform,setPlatform]=useState<PlatformSettings>({default_delivery_fee_iqd:1000,platform_fee_iqd:250,commission_percent:0,referral_commission_percent:0,support_phone:'07504796924',support_whatsapp:'07504796924',default_city:'هەولێر',privacy_policy_version:'1.0'});
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState('');

  const load=async()=>{
    setLoading(true);setMessage('');
    const [prefResult,profileResult]=await Promise.all([
      supabase.from('user_preferences').select('theme,order_notifications,delivery_notifications,wallet_notifications,marketing_notifications').eq('user_id',userId).maybeSingle(),
      supabase.from('profiles').select('city,language').eq('id',userId).maybeSingle(),
    ]);
    if(prefResult.error)setMessage(prefResult.error.message);
    const nextPrefs=({...prefs,...(prefResult.data||{})}) as Preferences;setPrefs(nextPrefs);applyTheme(nextPrefs.theme);
    if(profileResult.data?.city)setCity(profileResult.data.city);
    if(isAdmin){
      const {data,error}=await supabase.from('platform_settings').select('default_delivery_fee_iqd,platform_fee_iqd,commission_percent,referral_commission_percent,support_phone,support_whatsapp,default_city,privacy_policy_version').eq('id',true).maybeSingle();
      if(error)setMessage(error.message);else if(data)setPlatform({default_delivery_fee_iqd:Number(data.default_delivery_fee_iqd||0),platform_fee_iqd:Number(data.platform_fee_iqd||0),commission_percent:Number(data.commission_percent||0),referral_commission_percent:Number(data.referral_commission_percent||0),support_phone:data.support_phone||'',support_whatsapp:data.support_whatsapp||'',default_city:data.default_city||'هەولێر',privacy_policy_version:data.privacy_policy_version||'1.0'});
    }
    setLoading(false);
  };
  useEffect(()=>{void load()},[userId,isAdmin]);
  useEffect(()=>{
    const syncTheme=(event:Event)=>{
      const detail=(event as CustomEvent<{preference?:Preferences['theme']}>).detail;
      if(detail?.preference){
        setPrefs(current=>({...current,theme:detail.preference!}));
        return;
      }
      const actual=getCurrentTheme();
      setPrefs(current=>({...current,theme:actual}));
    };
    window.addEventListener('shakh-theme-change',syncTheme);
    return()=>window.removeEventListener('shakh-theme-change',syncTheme);
  },[]);

  const save=async()=>{
    setSaving(true);setMessage('');
    const [{error:prefError},{error:profileError}]=await Promise.all([
      supabase.from('user_preferences').upsert({user_id:userId,...prefs,updated_at:new Date().toISOString()},{onConflict:'user_id'}),
      supabase.from('profiles').update({city:city.trim()||'هەولێر',updated_at:new Date().toISOString()}).eq('id',userId),
    ]);
    if(prefError||profileError){setMessage(prefError?.message||profileError?.message||'پاشەکەوتکردن سەرکەوتوو نەبوو.');setSaving(false);return}
    applyTheme(prefs.theme);
    if(isAdmin){
      const {error}=await supabase.from('platform_settings').update({default_delivery_fee_iqd:Number(platform.default_delivery_fee_iqd||0),platform_fee_iqd:Number(platform.platform_fee_iqd||0),support_phone:platform.support_phone.trim(),support_whatsapp:platform.support_whatsapp.trim(),default_city:platform.default_city.trim()||'هەولێر',referral_commission_percent:Math.min(100,Math.max(0,Number(platform.referral_commission_percent||0))),updated_at:new Date().toISOString(),updated_by:userId}).eq('id',true);
      if(error){setMessage(error.message);setSaving(false);return}
    }
    setMessage('هەموو ڕێکخستنەکان پاشەکەوت کران.');setSaving(false);
  };

  return <section className='dashboard settingsPanel' dir='rtl'>
    <div className='dashboardHeader'><div><span className='eyebrow'><ShieldCheck size={16}/> ڕێکخستنەکان</span><h2>ڕێکخستنی شاخ</h2><p>ڕێکخستنەکانی هەژمار و خزمەتگوزاری لە یەک شوێن بەڕێوەببە.</p></div></div>
    {message&&<div className='msg'>{message}</div>}
    {loading?<div className='empty'>چاوەڕوان بە...</div>:<div className='settingsGrid'>
      <div className='settingsCard'><div className='settingsCardHeader'><div><b>ڕووکاری ئەپ</b><small>شێوازی پیشاندانی شاخ</small></div></div><div className='settingsChoiceGrid'>
        {([['system','سیستەم',Monitor],['light','ڕوون',Sun],['dark','تاریک',Moon]] as const).map(([value,label,Icon])=><button key={value} type='button' className={prefs.theme===value?'settingsChoice active':'settingsChoice'} onClick={()=>{setPrefs({...prefs,theme:value});applyTheme(value)}}><Icon size={18}/><span>{label}</span>{prefs.theme===value&&<Check size={15}/>}</button>)}
      </div></div>

      <div className='settingsCard'><div className='settingsCardHeader'><div><b>ئاگادارییەکان</b><small>کۆنترۆڵی پەیامەکانی شاخ</small></div><Bell size={20}/></div>
        <label className='settingsSwitch'><span><b>ئاگاداریی ئۆردەر</b><small>گۆڕانی دۆخی ئۆردەر</small></span><input type='checkbox' checked={prefs.order_notifications} onChange={e=>setPrefs({...prefs,order_notifications:e.target.checked})}/></label>
        <label className='settingsSwitch'><span><b>ئاگاداریی گەیاندن</b><small>کاپتن، شوێنکەوتن و گەیاندن</small></span><input type='checkbox' checked={prefs.delivery_notifications} onChange={e=>setPrefs({...prefs,delivery_notifications:e.target.checked})}/></label><label className='settingsSwitch'><span><b>ئاگاداریی جزدان</b><small>پارەدان، گەڕانەوەی پارە و داهات</small></span><input type='checkbox' checked={prefs.wallet_notifications} onChange={e=>setPrefs({...prefs,wallet_notifications:e.target.checked})}/></label>
        <label className='settingsSwitch'><span><b>پێشنیار و ڕیکلام</b><small>پێشنیارەکانی بازاڕ و کۆد</small></span><input type='checkbox' checked={prefs.marketing_notifications} onChange={e=>setPrefs({...prefs,marketing_notifications:e.target.checked})}/></label>
      </div>

      <div className='settingsCard'><div className='settingsCardHeader'><div><b>شوێن و شار</b><small>زانیاری شوێنی بنەڕەتی هەژمار</small></div><MapPin size={20}/></div><label>شار<input value={city} onChange={e=>setCity(e.target.value)} placeholder='هەولێر'/></label><small className='settingsHint'>لە checkout ـدا دەتوانیت ناونیشانی تایبەتی هەڵبژێریت.</small></div>

      <div className='settingsCard'><div className='settingsCardHeader'><div><b>پاراستنی نهێنی</b><small>بینینی سیاسەتی پاراستنی زانیاری</small></div><ShieldCheck size={20}/></div><button type='button' className='plain full settingsPrivacyButton' onClick={onPrivacy}>بینینی سیاسەتی پاراستنی نهێنی</button></div>

      {isAdmin&&<div className='settingsCard settingsAdminCard'><div className='settingsCardHeader'><div><b>ڕێکخستنەکانی پلاتفۆرم</b><small>تەنها بەڕێوبەر و بەڕێوبەری باڵا دەتوانن ئەمانە بگۆڕن.</small></div></div>
        <div className='settingsAdminGrid'><label>کرێی بنەڕەتی گەیاندن<input inputMode='numeric' value={String(platform.default_delivery_fee_iqd)} onChange={e=>setPlatform({...platform,default_delivery_fee_iqd:Number(e.target.value.replace(/\D/g,''))})}/><small>دینار</small></label><label>کرێی خزمەتی پلاتفۆرم<input inputMode='numeric' value={String(platform.platform_fee_iqd)} onChange={e=>setPlatform({...platform,platform_fee_iqd:Number(e.target.value.replace(/\D/g,''))})}/><small>دینار</small></label><label>کۆمسیۆن<input inputMode='decimal' value={String(platform.commission_percent)} onChange={e=>setPlatform({...platform,commission_percent:Number(e.target.value.replace(/[^0-9.]/g,''))})}/><small>%</small></label><label>کۆمسیۆنی قازانجی پۆست<input inputMode='decimal' min='0' max='100' value={String(platform.referral_commission_percent)} onChange={e=>setPlatform({...platform,referral_commission_percent:Number(e.target.value.replace(/[^0-9.]/g,''))})}/><small>% · لە کاتی پۆستکردن قەفل دەکرێت</small></label><label>شارە بنەڕەتی<input value={platform.default_city} onChange={e=>setPlatform({...platform,default_city:e.target.value})}/></label><label>ژمارەی پشتگیری<input value={platform.support_phone} onChange={e=>setPlatform({...platform,support_phone:e.target.value})}/></label><label>WhatsApp<input value={platform.support_whatsapp} onChange={e=>setPlatform({...platform,support_whatsapp:e.target.value})}/></label></div>
        <div className='settingsInfoRow'><Phone size={16}/><span>پشتگیری: {platform.support_phone}</span></div>
      </div>}

      <div className='settingsCard settingsAccountCard'><div className='settingsCardHeader'><div><b>هەژمار</b><small>کۆتایی هێنان بە چوونەژوورەوە</small></div><LogOut size={20}/></div><button type='button' className='profileLogoutButton' onClick={()=>void onSignOut()}><LogOut size={17}/> دەرچوون لە هەژمار</button></div>
    </div>}
    <div className='settingsSaveBar'><button type='button' className='primary' onClick={()=>void save()} disabled={saving}>{saving?<><Save size={17}/> پاشەکەوت دەکرێت...</>:<><Save size={17}/> پاشەکەوتکردنی ڕێکخستنەکان</>}</button></div>
  </section>;
}