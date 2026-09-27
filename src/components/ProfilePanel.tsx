import React,{useEffect,useMemo,useState} from 'react';
import {Camera,CheckCircle2,FileText,Languages,MapPin,RefreshCw,Save,ShieldCheck,UserRound} from 'lucide-react';
import {supabase} from '../lib/supabase';

type Props={userId:string;role:string;onOpenPosts?:()=>void;onDirtyChange?:(dirty:boolean)=>void};

type ProfileRow={
 id:string;
 full_name:string|null;
 email:string|null;
 phone:string|null;
 avatar_url:string|null;
 city:string|null;
 language:'ku'|'ar'|'en';
};

type PostSummary={id:string;title:string;status:string;created_at:string;visibility:string;post_type:string|null;};

const IRAQ_CITIES=['هەولێر','سلێمانی','دهۆک','کەرکووک','بەغدا','مووسڵ','کەربەلا','نەجەف','بەسرە','ئەنبار','دیالە','واسط','میسان','ذی قار','قادسیە','مثنی','بابل','صلاحەدین'];

const ROLE_LABELS:Record<string,string>={
 super_admin:'بەڕێوبەری باڵا',
 admin:'بەڕێوبەر',
 customer:'کڕیار',
 captain:'کاپتن',
 restaurant_vendor:'خاوەن چێشتخانە',
 supermarket_vendor:'خاوەن سووپەرمارکێت',
 fashion_vendor:'خاوەن جلوبەرگ',
 vendor:'خاوەن دوکان',
 electronics_vendor:'خاوەن ئەلیکترۆنیات',
 jewelry_vendor:'خاوەن جواکاری',
 car_dealer:'پێشانگای ئۆتۆمبێل',
 umrah_agency:'کۆمپانیای عومرە',
 support:'پشتگیری'
};

const LANGUAGE_LABELS:{value:ProfileRow['language'];label:string;icon:string}[]=[
 {value:'ku',label:'کوردی',icon:'کوردی'},
 {value:'ar',label:'عەرەبی',icon:'العربية'},
 {value:'en',label:'English',icon:'EN'}
];

export default function ProfilePanel({userId,role,onOpenPosts,onDirtyChange}:Props){
 const [profile,setProfile]=useState<ProfileRow|null>(null);
 const [name,setName]=useState('');
 const [phone,setPhone]=useState('');
 const [city,setCity]=useState('هەولێر');
 const [language,setLanguage]=useState<ProfileRow['language']>('ku');
 const [avatarUrl,setAvatarUrl]=useState('');
 const [file,setFile]=useState<File|null>(null);
 const [preview,setPreview]=useState('');
 const [postCount,setPostCount]=useState(0);
 const [latestPosts,setLatestPosts]=useState<PostSummary[]>([]);
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [message,setMessage]=useState('');

 const load=async()=>{
  setLoading(true);
  setMessage('');
  const [{data,error},{count:countValue},{data:latest}]=await Promise.all([
   supabase.from('profiles').select('id,full_name,email,phone,avatar_url,city,language').eq('id',userId).maybeSingle(),
   supabase.from('posts').select('id',{count:'exact',head:true}).eq('author_id',userId),
   supabase.from('posts').select('id,title,status,created_at,visibility,post_type').eq('author_id',userId).order('created_at',{ascending:false}).limit(3)
  ]);
  if(error){
   setMessage('نەتوانرا زانیاریی پرۆفایل وەرگیرێت.');
   setLoading(false);
   return;
  }
  const next=(data||null) as ProfileRow|null;
  setProfile(next);
  setName(next?.full_name||'');
  setPhone(next?.phone||'');
  setCity(next?.city||'هەولێر');
  setLanguage(next?.language||'ku');
  setAvatarUrl(next?.avatar_url||'');
  setPostCount(countValue||0);
  setLatestPosts((latest||[]) as PostSummary[]);
  setLoading(false);
 };

 useEffect(()=>{void load();},[userId]);
 useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview)},[preview]);

 const displayName=useMemo(()=>name.trim()||'بەکارهێنەری شاخ',[name]);
 const roleLabel=ROLE_LABELS[role]||'بەکارهێنەر';
 const hasChanges=useMemo(()=>{
  if(!profile)return Boolean(file);
  return name.trim()!==(profile.full_name||'')
   ||phone.trim()!==(profile.phone||'')
   ||city!==(profile.city||'هەولێر')
   ||language!==(profile.language||'ku')
   ||Boolean(file);
 },[profile,name,phone,city,language,file]);

 useEffect(()=>{onDirtyChange?.(hasChanges);return()=>onDirtyChange?.(false);},[hasChanges]);

 const chooseAvatar=(next?:File)=>{
  if(!next)return;
  if(!['image/jpeg','image/png','image/webp'].includes(next.type)){
   setMessage('تەنها JPG، PNG یان WEBP بۆ وێنەی پرۆفایل ڕێگەپێدراوە.');
   return;
  }
  if(next.size>5*1024*1024){
   setMessage('قەبارەی وێنەکە نابێت لە ٥ مێگابایت زیاتر بێت.');
   return;
  }
  if(preview)URL.revokeObjectURL(preview);
  setFile(next);
  setPreview(URL.createObjectURL(next));
  setMessage('');
 };

 const uploadAvatar=async()=>{
  if(!file)return avatarUrl||null;
  const extension=file.type.split('/')[1]||'jpeg';
  const path=userId+'/profile-'+Date.now()+'.'+extension;
  const {error}=await supabase.storage.from('avatars').upload(path,file,{upsert:false,contentType:file.type,cacheControl:'3600'});
  if(error)throw error;
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
 };

 const save=async()=>{
  const trimmedName=name.trim();
  if(!trimmedName)return setMessage('تکایە ناوی تەواو بنووسە.');
  if(trimmedName.length>80)return setMessage('ناو نابێت لە ٨٠ پیت زیاتر بێت.');
  if(phone.trim().length>20)return setMessage('ژمارەی تەلەفون نابێت لە ٢٠ پیت زیاتر بێت.');
  setSaving(true);
  setMessage('');
  try{
   const nextAvatar=await uploadAvatar();
   const {data,error}=await supabase.from('profiles').update({
    full_name:trimmedName,
    phone:phone.trim()||null,
    city:city||'هەولێر',
    language,
    avatar_url:nextAvatar
   }).eq('id',userId).select('id,full_name,email,phone,avatar_url,city,language').single();
   if(error)throw error;
   setProfile(data as ProfileRow);
   setName(data.full_name||'');
   setPhone(data.phone||'');
   setCity(data.city||'هەولێر');
   setLanguage(data.language||'ku');
   setAvatarUrl(data.avatar_url||'');
   setFile(null);
   if(preview)URL.revokeObjectURL(preview);
   setPreview('');
   setMessage('زانیاریی پرۆفایل بە سەرکەوتوویی پاشەکەوت کرا.');
  }catch(error:unknown){
   setMessage(error instanceof Error?error.message:'نوێکردنەوەی پرۆفایل سەرکەوتوو نەبوو.');
  }finally{
   setSaving(false);
  }
 };

 if(loading)return <section className="profilePanel"><div className="profileLoading"><RefreshCw size={22}/> پرۆفایل بار دەکرێت...</div></section>;

 return <section className="profilePanel" aria-label="پرۆفایلی بەکارهێنەر">
  <div className="profilePanelHero">
   <div className="profileAvatarWrap">
    <div className="profileAvatar">
     {(preview||avatarUrl)?<img src={preview||avatarUrl} alt={displayName}/>:<UserRound size={40}/>}
    </div>
    <label className="profileAvatarButton" aria-label="گۆڕینی وێنەی پرۆفایل">
     <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>chooseAvatar(e.target.files?.[0])}/>
     <Camera size={15}/>
    </label>
   </div>
   <div className="profileHeroText">
    <span className="profileEyebrow"><ShieldCheck size={14}/> هەژماری شاخ</span>
    <h2>{displayName}</h2>
    <p>{profile?.email||''}</p>
    <span className="profileRoleBadge">{roleLabel}</span>
   </div>
   <button type="button" className="plain profileRefresh" onClick={()=>void load()} disabled={loading||saving} aria-label="نوێکردنەوەی پرۆفایل"><RefreshCw size={17}/></button>
  </div>

  <div className="profileStats">
   <div><FileText size={18}/><strong>{postCount.toLocaleString('ku-IQ')}</strong><span>پۆست</span></div>
   <div><MapPin size={18}/><strong>{city}</strong><span>شار</span></div>
   <div><Languages size={18}/><strong>{LANGUAGE_LABELS.find(item=>item.value===language)?.label||'کوردی'}</strong><span>زمان</span></div>
  </div>

  <div className="profileSectionTitle"><div><span>زانیاریی کەسی</span><h3>پرۆفایلەکەت نوێ بکەرەوە</h3></div><small>ئیمەیڵ لێرە تەنها بۆ خوێندنەوەیە.</small></div>

  <div className="profileFormGrid">
   <label className="profileField">ناوی تەواو<input maxLength={80} value={name} onChange={e=>setName(e.target.value)} placeholder="ناوی تەواو"/></label>
   <label className="profileField">ژمارەی تەلەفون<input maxLength={20} value={phone} onChange={e=>setPhone(e.target.value)} inputMode="tel" placeholder="+964 7xx xxx xxxx"/></label>
   <label className="profileField profileFieldWide">ئیمەیڵ<input value={profile?.email||''} readOnly aria-readonly="true"/></label>
   <label className="profileField">شار<select value={city} onChange={e=>setCity(e.target.value)}>{IRAQ_CITIES.map(item=><option key={item} value={item}>{item}</option>)}</select></label>
  </div>

  <div className="profilePostSection">
   <div className="profileSectionTitle compact">
    <div><span>ناوەڕۆکی من</span><h3>دوایین پۆستەکان</h3></div>
    <button type="button" className="profilePostsLink" onClick={()=>onOpenPosts?.()} disabled={!onOpenPosts}>بینینی هەموو پۆستەکان <FileText size={14}/></button>
   </div>
   {!latestPosts.length
    ?<div className="profilePostsEmpty"><FileText size={20}/><span>هێشتا هیچ پۆستێکت نییە.</span></div>
    :<div className="profilePostsList">{latestPosts.map(post=><button type="button" className="profilePostRow" key={post.id} onClick={()=>onOpenPosts?.()} disabled={!onOpenPosts}>
      <span className="profilePostDot" aria-hidden="true"/>
      <span className="profilePostInfo"><b>{post.title}</b><small>{post.post_type||'گشتی'} · {new Date(post.created_at).toLocaleDateString('ku-IQ')}</small></span>
      <span className={'profilePostStatus '+(post.status==='approved'&&post.visibility==='public'?'ok':post.status==='rejected'?'bad':'wait')}>{post.status==='approved'?(post.visibility==='public'?'بڵاوکراوە':'شاراوە'):post.status==='rejected'?'ڕەتکراوە':'چاوەڕوان'}</span>
     </button>)}</div>}
  </div>

  <div className="profileSectionTitle compact"><div><span>پەسەندی زمان</span><h3>زمانی هەژمار هەڵبژێرە</h3></div></div>
  <div className="profileLanguageGrid" role="radiogroup" aria-label="پەسەندی زمانی هەژمار">
   {LANGUAGE_LABELS.map(item=><button type="button" key={item.value} role="radio" aria-checked={language===item.value} className={language===item.value?'active':''} onClick={()=>setLanguage(item.value)}>
    <b>{item.icon}</b><span>{item.label}</span>{language===item.value&&<CheckCircle2 size={17}/>}
   </button>)}
  </div>

  <div className="profileSaveRow">
   <small className={hasChanges?'profileDirtyText':'profileSavedText'}>{hasChanges?'گۆڕانکارییە نوێکانت هەن؛ پاشەکەوتیان بکە.':'هەموو گۆڕانکارییەکان پاشەکەوت کراون.'}</small>
   <button type="button" className="primary profileSaveButton" onClick={()=>void save()} disabled={saving||!hasChanges}>
    {saving?<><RefreshCw size={17}/> پاشەکەوت دەکرێت...</>:<><Save size={17}/> پاشەکەوتکردنی پرۆفایل</>}
   </button>
  </div>

  {file&&<div className="profileUploadHint"><Camera size={15}/> وێنەی نوێ هەڵبژێردراوە؛ پاشەکەوتکردن بۆ جێگیرکردنی وێنەکە پێویستە.</div>}
  {message&&<div className={message.includes('سەرکەوت')?'profileMessage success':'profileMessage'} role="alert" aria-live="polite">{message}</div>}
 </section>;
}
