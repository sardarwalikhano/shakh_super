import React,{useEffect,useMemo,useState} from 'react';
import {CheckCircle2,Eye,ImagePlus,Send,Sparkles,Tag,Upload,X} from 'lucide-react';
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

const typeIcons:Record<string,string>={general:'💬',marketplace:'🛍️',delivery:'🛵',car:'🚗',umrah:'🕋',announcement:'📢',support:'🛟'};

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
 const [showPreview,setShowPreview]=useState(true);

 useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview)},[preview]);

 const isPriceVisible=useMemo(()=>postType==='marketplace'||postType==='car'||postType==='umrah',[postType]);
 const ready=Boolean(title.trim()&&(!isPriceVisible||price));

 const chooseFile=(next?:File)=>{
  if(!next)return;
  if(!next.type.startsWith('image/')){
   setMessage('تەنها فایلێکی وێنە هەڵبژێرە.');
   return;
  }
  if(next.size>5*1024*1024){
   setMessage('قەبارەی وێنە نابێت لە ٥ مێگابایت زیاتر بێت.');
   return;
  }
  if(preview)URL.revokeObjectURL(preview);
  setFile(next);
  setPreview(URL.createObjectURL(next));
  setMessage('');
 };

 const clearImage=()=>{
  if(preview)URL.revokeObjectURL(preview);
  setFile(null);
  setPreview('');
 };

 const submit=async()=>{
  try{
   if(!title.trim())return setMessage('سەردێڕ پڕ بکەرەوە.');
   if(price&&(!/^\d+$/.test(price)||Number(price)<=0))return setMessage('نرخ دەبێت ژمارەی دروست و زیاتر لە سفر بێت.');
   setBusy(true);
   setMessage('');

   let imageUrl:string|null=null;
   const {data:profile}=await supabase.from('profiles').select('full_name').eq('id',userId).maybeSingle();
   const publisherName=(profile as {full_name?:string|null}|null)?.full_name||cfg.label;

   if(file){
    const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,'-');
    const path=userId+'/posts/'+Date.now()+'-'+safeName;
    const {error:uploadError}=await supabase.storage.from('products').upload(path,file,{upsert:false,contentType:file.type});
    if(uploadError)throw uploadError;
    imageUrl=supabase.storage.from('products').getPublicUrl(path).data.publicUrl;
   }

   const {error}=await supabase.from('posts').insert({
    author_id:userId,
    title:title.trim(),
    content:content.trim()||null,
    images:imageUrl?[imageUrl]:[],
    price_iqd:price?Number(price):null,
    city:city.trim()||'هەولێر',
    status:'approved',
    section:postType,
    publisher_name:publisherName,
    post_type:postType,
    publisher_role:role,
    label:cfg.label,
    visibility:'public'
   });
   if(error)throw error;

   clearImage();
   setTitle('');
   setContent('');
   setPrice('');
   setCity('هەولێر');
   setShowPreview(true);
   setMessage('پۆستەکە بە سەرکەوتوویی بڵاوکرایەوە.');
   onSaved?.();
  }catch(error:unknown){
   setMessage(error instanceof Error?error.message:'پۆستکردن سەرکەوتوو نەبوو.');
  }finally{
   setBusy(false);
  }
 };

 return <section className="orderCard postComposer" aria-label="پۆستکردن">
  <div className="postComposerHead">
   <div>
    <span className="eyebrow"><Sparkles size={13}/> پۆستکردنی پیشەیی</span>
    <h3>{cfg.heading}</h3>
    <p>{cfg.label} · پەیام و زانیارییەکەت بە شێوەیەکی ڕێکخراو بڵاو بکەرەوە.</p>
   </div>
   <div className="postComposerBadge"><Tag size={21}/><span>{cfg.label}</span></div>
  </div>

  <div className="postComposerLabel">جۆری پۆست</div>
  <div className="postCategoryGrid">
   {cfg.types.map(item=><button key={item.value} type="button" className={postType===item.value?'postCategory active':'postCategory'} onClick={()=>setPostType(item.value)}>
    <span>{typeIcons[item.value]||'📝'}</span><b>{item.label}</b>
   </button>)}
  </div>

  <label className="postField">
   <span className="postLabelRow"><span>سەردێڕ</span><small>{title.length}/100</small></span>
   <input maxLength={100} value={title} onChange={e=>setTitle(e.target.value)} placeholder="سەردێڕی پۆست"/>
  </label>

  <label className="postField">
   <span className="postLabelRow"><span>ناوەڕۆک</span><small>{content.length}/500</small></span>
   <textarea rows={5} maxLength={500} value={content} onChange={e=>setContent(e.target.value)} placeholder="پەیام، زانیاری، ڕووداو یان ناوەڕۆکی پۆست..."/>
  </label>

  <div className="postFormGrid">
   {isPriceVisible&&<label className="postField">نرخ بە د.ع<input value={price} onChange={e=>setPrice(e.target.value.replace(/[^0-9]/g,''))} inputMode="numeric" placeholder="نموونە: ٢٥٠٠٠"/></label>}
   <label className="postField">شار<input value={city} onChange={e=>setCity(e.target.value)} placeholder="هەولێر"/></label>
  </div>

  <div className="postUploadBox">
   <div className="postUploadHead"><div><b>وێنەی پۆست</b><small>JPG، PNG یان WEBP · تا ٥ MB</small></div><ImagePlus size={20}/></div>
   <label className={preview?'postUploadDrop hasImage':'postUploadDrop'}>
    <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e=>chooseFile(e.target.files?.[0])}/>
    {preview?<><img src={preview} alt={title||'پێشبینینی پۆست'}/><span className="postUploadOverlay">گۆڕینی وێنە</span></>:<><Upload size={24}/><b>وێنە هەڵبژێرە</b><small>کلیک بکە و وێنەی پۆست هەڵبژێرە</small></>}
   </label>
   {preview&&<button type="button" className="postRemoveImage" onClick={clearImage}><X size={15}/> سڕینەوەی وێنە</button>}
  </div>

  <div className="postComposerBottom">
   <span className="postComposerHint">کاتێک بڵاودەکرێتەوە، پۆستەکە لە feed ـی شاخ دەردەکەوێت.</span>
   <button type="button" className="postPreviewToggle" onClick={()=>setShowPreview(value=>!value)}><Eye size={16}/>{showPreview?'شاردنەوەی پێشبینین':'پیشاندانی پێشبینین'}</button>
  </div>

  {showPreview&&<div className="postLivePreview">
   <div className="postLivePreviewTop"><span>پێشبینینی پۆست</span><small>{typeIcons[postType]||'📝'} {cfg.types.find(item=>item.value===postType)?.label||cfg.label}</small></div>
   <div className="postLivePreviewCard">
    <div className="postLivePreviewImage">{preview?<img src={preview} alt=""/>:<ImagePlus size={34}/>}</div>
    <div className="postLivePreviewBody">
     <small>{cfg.label} · {city||'هەولێر'}</small>
     <h4>{title.trim()||'سەردێڕی پۆستەکەت لێرە دەردەکەوێت'}</h4>
     <p>{content.trim()||'ناوەڕۆکی پۆستەکەت لێرە پیشان دەدرێت.'}</p>
     {isPriceVisible&&<div className="postLivePreviewPrice">{price?Number(price).toLocaleString('en-US'):'٠'} د.ع</div>}
    </div>
   </div>
  </div>}

  <button type="button" className="postResetButton" disabled={busy} onClick={()=>{clearImage();setTitle('');setContent('');setPrice('');setCity('هەولێر');setMessage('فۆڕمەکە پاک کرایەوە.')}}>پاککردنەوەی فۆڕم</button>

  <button type="button" className="primary postPublishButton" disabled={busy||!ready} onClick={()=>void submit()}>
   {busy?<><Upload size={17}/> بڵاوکردنەوە...</>:<><Send size={17}/> بڵاوکردنەوەی پۆست</>}
  </button>

  {message&&<div className={message.includes('سەرکەوت')?'postComposerMessage success':'postComposerMessage'} role="alert">{message}</div>}
  <small className="postComposerFoot"><CheckCircle2 size={14}/> پۆستەکان لە داتابەیسی شاخ هەڵدەگیرێن و Realtime ـیش چالاکە.</small>
 </section>;
}
