import React,{useEffect,useMemo,useState} from 'react';
import {CheckCircle2,Eye,ImagePlus,PackagePlus,Sparkles,Store,Tag,Upload,X} from 'lucide-react';
import {supabase} from '../lib/supabase';

type Role='restaurant_vendor'|'supermarket_vendor'|'fashion_vendor'|'vendor'|'electronics_vendor'|'jewelry_vendor';
type Props={userId:string;role:string;onSaved?:()=>void};
type Config={
 storeCategory:string;label:string;heading:string;typeLabel:string;brand:boolean;size:boolean;
 cats:{slug:string;label:string;icon:string}[];
};

const CONFIG:Record<Role,Config>={
 restaurant_vendor:{storeCategory:'restaurant',label:'چێشتخانە',heading:'پۆستکردنی خواردن',typeLabel:'جۆری خواردن',brand:false,size:false,cats:[{slug:'restaurant_food',label:'خواردنی چێشتخانە',icon:'🍽️'}]},
 supermarket_vendor:{storeCategory:'supermarket',label:'سووپەرمارکێت',heading:'پۆستکردنی بەرهەم',typeLabel:'جۆری بەرهەم',brand:true,size:false,cats:[{slug:'supermarket_food',label:'خواردن',icon:'🍎'},{slug:'supermarket_drinks',label:'خواردنەوە',icon:'🥤'},{slug:'supermarket_biscuits',label:'پسکیت',icon:'🍪'},{slug:'supermarket_cleaners',label:'پاککەرەوەکان',icon:'🧴'},{slug:'supermarket_dairy',label:'شیر و دایبی',icon:'🥛'}]},
 fashion_vendor:{storeCategory:'fashion',label:'جل و بەرگ',heading:'پۆستکردنی جل و بەرگ',typeLabel:'جۆری جل',brand:true,size:true,cats:[{slug:'fashion_men',label:'پیاوان',icon:'👔'},{slug:'fashion_women',label:'ئافرەتان',icon:'👗'},{slug:'fashion_kids',label:'منداڵان',icon:'🧒'}]},
 vendor:{storeCategory:'daily',label:'بازاڕ',heading:'پۆستکردنی بەرهەمی بازاڕ',typeLabel:'جۆری بەرهەم',brand:true,size:true,cats:[{slug:'general_store',label:'بازاڕی گشتی',icon:'🏪'}]},
 electronics_vendor:{storeCategory:'electronics',label:'ئەلیکترۆنیات',heading:'پۆستکردنی ئەلیکترۆنیات',typeLabel:'جۆری ئامێر',brand:true,size:false,cats:[{slug:'electronics_mobile',label:'مۆبایل و تابلێت',icon:'📱'},{slug:'electronics_computers',label:'کۆمپیوتەر',icon:'💻'},{slug:'electronics_home',label:'تەڵەفیزیۆن و ئامێرەکانی ماڵ',icon:'📺'},{slug:'electronics_accessories',label:'ئەکسسوارات ئەلیکترۆنی',icon:'🔌'}]},
 jewelry_vendor:{storeCategory:'jewelry',label:'جواکاری',heading:'پۆستکردنی جواکاری',typeLabel:'جۆری جواکاری',brand:true,size:true,cats:[{slug:'jewelry_gold',label:'زێڕ',icon:'💛'},{slug:'jewelry_silver',label:'زیو',icon:'🤍'},{slug:'jewelry_watches',label:'کاتژمێر',icon:'⌚'},{slug:'jewelry_accessories',label:'ئەکسسوارات',icon:'💎'}]}
};

const POST_META:Record<string,{postType:string;label:string}>={
 restaurant_vendor:{postType:'food',label:'خواردنگە'},
 supermarket_vendor:{postType:'marketplace',label:'بازاڕ'},
 fashion_vendor:{postType:'fashion',label:'جلوبەرگ'},
 vendor:{postType:'marketplace',label:'بازاڕ'},
 electronics_vendor:{postType:'marketplace',label:'ئەلیکترۆنیات'},
 jewelry_vendor:{postType:'marketplace',label:'جواکاری'}
};

type FormState={storeName:string;type:string;brand:string;name:string;size:string;price:string;description:string;available:boolean};
const initialForm=(storeName=''):FormState=>({storeName,type:'',brand:'',name:'',size:'',price:'',description:'',available:true});

export default function ProductPostComposer({userId,role,onSaved}:Props){
 const cfg=CONFIG[role as Role];
 if(!cfg)return null;

 const [form,setForm]=useState<FormState>(()=>initialForm());
 const [category,setCategory]=useState(cfg.cats[0].slug);
 const [storeId,setStoreId]=useState('');
 const [storeLoading,setStoreLoading]=useState(true);
 const [file,setFile]=useState<File|null>(null);
 const [preview,setPreview]=useState('');
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [showPreview,setShowPreview]=useState(true);

 useEffect(()=>{
  let live=true;
  setStoreLoading(true);
  (async()=>{
   const {data}=await supabase.from('stores')
    .select('id,name')
    .eq('owner_id',userId)
    .eq('category',cfg.storeCategory)
    .eq('is_active',true)
    .limit(1)
    .maybeSingle();
   if(!live)return;
   if(data){
    setStoreId(data.id);
    setForm(current=>({...current,storeName:data.name||''}));
   }
   setStoreLoading(false);
  })();
  return()=>{
   live=false;
  };
 },[userId,cfg.storeCategory]);

 useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview)},[preview]);

 const selectedCategory=cfg.cats.find(item=>item.slug===category)||cfg.cats[0];
 const ready=Boolean(form.name.trim()&&form.type.trim()&&form.price&&(!cfg.brand||form.brand.trim())&&(!cfg.size||form.size.trim()));
 const descriptionCount=form.description.length;

 const update=(patch:Partial<FormState>)=>setForm(current=>({...current,...patch}));

 const pick=(next?:File)=>{
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

 const getStore=async()=>{
  if(storeId)return storeId;
  if(!form.storeName.trim())throw new Error('ناوی دوکان بنووسە.');
  const {data,error}=await supabase.from('stores').insert({
   owner_id:userId,
   name:form.storeName.trim(),
   category:cfg.storeCategory,
   city:'هەولێر',
   is_active:true
  }).select('id').single();
  if(error)throw error;
  setStoreId(data.id);
  return data.id;
 };

 const upload=async()=>{
  if(!file)return null;
  const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,'-');
  const path=userId+'/posts/'+Date.now()+'-'+safeName;
  const {error}=await supabase.storage.from('products').upload(path,file,{upsert:false,contentType:file.type});
  if(error)throw error;
  return supabase.storage.from('products').getPublicUrl(path).data.publicUrl;
 };

 const submit=async()=>{
  try{
   if(!ready){
    setMessage('تکایە هەموو خانە پێویستەکان پڕ بکەرەوە.');
    return;
   }
   if(!/^\d+$/.test(form.price)||Number(form.price)<=0){
    setMessage('نرخ دەبێت ژمارەی دروست و زیاتر لە سفر بێت.');
    return;
   }
   setBusy(true);
   setMessage('');

   const sid=await getStore();
   const {data:cat,error:categoryError}=await supabase.from('categories').select('id').eq('slug',category).single();
   if(categoryError)throw categoryError;

   const imageUrl=await upload();
   const productName=form.name.trim();
   const {error}=await supabase.from('products').insert({
    store_id:sid,
    category_id:cat.id,
    name_ku:productName,
    name_ar:productName,
    name_en:productName,
    description_ku:form.description.trim()||null,
    price_iqd:Number(form.price),
    product_type:form.type.trim(),
    brand:form.brand.trim()||null,
    size:form.size.trim()||null,
    image_url:imageUrl,
    stock:form.available?1:0,
    is_available:form.available,
    variants:[{section:role,category}]
   });
   if(error)throw error;

   const meta=POST_META[role];
   if(meta){
    const {data:profile}=await supabase.from('profiles').select('full_name').eq('id',userId).maybeSingle();
    const publisherName=(profile as {full_name?:string|null}|null)?.full_name||form.storeName.trim()||meta.label;
    const {error:postError}=await supabase.from('posts').insert({
     author_id:userId,
     store_id:sid,
     title:productName,
     content:form.description.trim()||null,
     images:imageUrl?[imageUrl]:[],
     price_iqd:Number(form.price),
     city:'هەولێر',
     status:'approved',
     section:category,
     publisher_name:publisherName,
     post_type:meta.postType,
     publisher_role:role,
     label:meta.label,
     visibility:'public'
    });
    if(postError)throw postError;
   }

   const storeName=form.storeName;
   clearImage();
   setForm(initialForm(storeName));
   setShowPreview(true);
   setMessage('بەرهەمەکە و پۆستەکە بە سەرکەوتوویی بڵاوکرانەوە.');
   onSaved?.();
  }catch(error:unknown){
   setMessage(error instanceof Error?error.message:'پۆستکردنی بەرهەم سەرکەوتوو نەبوو.');
  }finally{
   setBusy(false);
  }
 };

 return <section className="orderCard postComposer" aria-label="پۆستکردنی بەرهەم">
  <div className="postComposerHead">
   <div>
    <span className="eyebrow"><Sparkles size={13}/> پۆستکردنی پیشەیی</span>
    <h3>{cfg.heading}</h3>
    <p>{cfg.label} · بەرهەمەکەت بە وێنە و زانیاری ورد بڵاو بکەرەوە.</p>
   </div>
   <div className="postComposerBadge"><PackagePlus size={21}/><span>{cfg.label}</span></div>
  </div>

  {!storeId&&(
   <div className="postComposerNotice">
    <Store size={17}/>
    <div>
     <b>{storeLoading?'دۆزینەوەی دوکان...':'دوکانێکت نەدۆزرایەوە'}</b>
     <small>{storeLoading?'زانیاریی دوکانەکەت پشکنین دەکرێت.':'ناوی دوکان بنووسە تا دوکانەکەت خۆکارانە دروست بکرێت.'}</small>
    </div>
   </div>
  )}

  {!storeId&&<label className="postField">ناوی دوکان<input value={form.storeName} onChange={e=>update({storeName:e.target.value})} placeholder={cfg.label}/></label>}

  <div className="postComposerLabel">کەتەگۆری</div>
  <div className="postCategoryGrid">
   {cfg.cats.map(item=><button key={item.slug} type="button" className={category===item.slug?'postCategory active':'postCategory'} onClick={()=>setCategory(item.slug)}>
    <span>{item.icon}</span><b>{item.label}</b>
   </button>)}
  </div>

  <div className="postFormGrid">
   <label className="postField">ناوی بەرهەم<input value={form.name} onChange={e=>update({name:e.target.value})} placeholder="ناوی بەرهەم"/></label>
   <label className="postField">{cfg.typeLabel}<input value={form.type} onChange={e=>update({type:e.target.value})} placeholder="نموونە: کەباب / قەمیس"/></label>
   {cfg.brand&&<label className="postField">مارکە<input value={form.brand} onChange={e=>update({brand:e.target.value})} placeholder="مارکە"/></label>}
   {cfg.size&&<label className="postField">قەبارە<input value={form.size} onChange={e=>update({size:e.target.value})} placeholder="سایز"/></label>}
   <label className="postField">نرخ بە د.ع<input value={form.price} onChange={e=>update({price:e.target.value.replace(/[^0-9]/g,'')})} inputMode="numeric" placeholder="نموونە: ١٥٠٠٠"/></label>
  </div>

  <label className="postField">
   <span className="postLabelRow"><span>وەسفی بەرهەم</span><small>{descriptionCount}/240</small></span>
   <textarea rows={4} maxLength={240} value={form.description} onChange={e=>update({description:e.target.value})} placeholder="ناساندنی بەرهەم، تایبەتمەندی، قەبارە و زانیاری گرنگ..."/>
  </label>

  <div className="postUploadBox">
   <div className="postUploadHead"><div><b>وێنەی بەرهەم</b><small>JPG، PNG یان WEBP · تا ٥ MB</small></div><ImagePlus size={20}/></div>
   <label className={preview?'postUploadDrop hasImage':'postUploadDrop'}>
    <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e=>pick(e.target.files?.[0])}/>
    {preview?<><img src={preview} alt={form.name||'پێشبینینی بەرهەم'}/><span className="postUploadOverlay">گۆڕینی وێنە</span></>:<><Upload size={24}/><b>وێنە هەڵبژێرە</b><small>کلیک بکە و وێنەی بەرهەم هەڵبژێرە</small></>}
   </label>
   {preview&&<button type="button" className="postRemoveImage" onClick={clearImage}><X size={15}/> سڕینەوەی وێنە</button>}
  </div>

  <div className="postComposerBottom">
   <label className="postAvailable"><input type="checkbox" checked={form.available} onChange={e=>update({available:e.target.checked})}/><span>ئەم بەرهەمە بەردەستە</span></label>
   <button type="button" className="postPreviewToggle" onClick={()=>setShowPreview(value=>!value)}><Eye size={16}/>{showPreview?'شاردنەوەی پێشبینین':'پیشاندانی پێشبینین'}</button>
  </div>

  {showPreview&&<div className="postLivePreview">
   <div className="postLivePreviewTop"><span>پێشبینینی پۆست</span><small><Tag size={12}/> {selectedCategory.label}</small></div>
   <div className="postLivePreviewCard">
    <div className="postLivePreviewImage">{preview?<img src={preview} alt=""/>:<ImagePlus size={34}/>}</div>
    <div className="postLivePreviewBody">
     <small>{cfg.label} · {selectedCategory.label}</small>
     <h4>{form.name.trim()||'ناوی بەرهەمەکەت لێرە دەردەکەوێت'}</h4>
     <p>{form.description.trim()||'وەسفی بەرهەمەکەت لێرە پیشان دەدرێت.'}</p>
     <div className="postLivePreviewPrice">{form.price?Number(form.price).toLocaleString('en-US'):'٠'} د.ع</div>
    </div>
   </div>
  </div>}

  <button type="button" className="primary postPublishButton" disabled={busy||!ready} onClick={()=>void submit()}>
   {busy?<><Upload size={17}/> بڵاوکردنەوە...</>:<><Store size={17}/> بڵاوکردنەوەی بەرهەم و پۆست</>}
  </button>

  {message&&<div className={message.includes('سەرکەوت')?'postComposerMessage success':'postComposerMessage'} role="alert">{message}</div>}
  <small className="postComposerFoot"><CheckCircle2 size={14}/> زانیارییەکان بە ڕاستەوخۆ لە داتابەیسی شاخ هەڵدەگیرێن.</small>
 </section>;
}
