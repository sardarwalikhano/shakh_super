import {useEffect,useRef,useState} from 'react';
import {ImagePlus,Send,Store,Upload,X} from 'lucide-react';
import {createClient} from '@supabase/supabase-js';

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
] as const;

const PRODUCT_SECTIONS=new Set(['restaurant','supermarket','fashion','daily','marketplace','electronics','jewelry']);
const CATEGORY_SLUGS:Record<string,string>={
 restaurant:'restaurant_food',
 supermarket:'supermarket_food',
 fashion:'fashion_men',
 daily:'general_store',
 marketplace:'general_store',
 electronics:'electronics_mobile',
 jewelry:'jewelry_gold'
};

export default function ShakhStorePostComposer({userId,initialSection='marketplace',hideSectionSelector=false,onBack}:{userId:string;initialSection?:string;hideSectionSelector?:boolean;onBack?:()=>void}){
 const [section,setSection]=useState(initialSection);
 useEffect(()=>{setSection(initialSection);setMessage('')},[initialSection]);
 const [title,setTitle]=useState('');
 const [content,setContent]=useState('');
 const [price,setPrice]=useState('');
 const [city,setCity]=useState('هەولێر');
 const [files,setFiles]=useState<File[]>([]);
 const [previews,setPreviews]=useState<string[]>([]);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const previewsRef=useRef<string[]>([]);

 useEffect(()=>{previewsRef.current=previews},[previews]);
 useEffect(()=>()=>{previewsRef.current.forEach(src=>URL.revokeObjectURL(src))},[]);

 const chooseFiles=(list:FileList|null)=>{
  if(!list?.length)return;
  const incoming=Array.from(list).slice(0,6-files.length).filter(file=>['image/jpeg','image/png','image/webp'].includes(file.type)&&file.size<=5*1024*1024);
  if(!incoming.length)return;
  setFiles(v=>[...v,...incoming]);
  setPreviews(v=>[...v,...incoming.map(file=>URL.createObjectURL(file))]);
 };
 const removeImage=(index:number)=>{
  URL.revokeObjectURL(previews[index]||'');
  setFiles(v=>v.filter((_,i)=>i!==index));
  setPreviews(v=>v.filter((_,i)=>i!==index));
 };

 const submit=async()=>{
  if(!supabase)return setMessage('پەیوەندی بە Supabase بەردەست نییە.');
  if(!title.trim())return setMessage('ناونیشانی پۆست بنووسە.');
  if(price&&!/^\d+$/.test(price))return setMessage('نرخ دەبێت تەنها ژمارە بێت.');
  if(PRODUCT_SECTIONS.has(section)&&!price)return setMessage('بۆ پۆستی بەرهەم تکایە نرخێک دابنێ.');
  if(PRODUCT_SECTIONS.has(section)&&files.length===0)return setMessage('بۆ پۆستی بەرهەم لانیکەم یەک وێنە زیاد بکە.');
  const uploadedPaths:string[]=[];
  let createdStoreId:string|null=null;
  let createdProductId:string|null=null;
  let storeId:string|null=null;
  try{
   setBusy(true);setMessage('');
   const imageUrls:string[]=[];
   for(const [index,file] of files.entries()){
    const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,'-');
    const path=userId+'/posts/'+Date.now()+'-'+index+'-'+safeName;
    const {error:uploadError}=await supabase.storage.from('products').upload(path,file,{upsert:false,contentType:file.type});
    if(uploadError)throw uploadError;
    uploadedPaths.push(path);
    imageUrls.push(supabase.storage.from('products').getPublicUrl(path).data.publicUrl);
   }

   const postType=section==='restaurant'?'food':section==='fashion'?'fashion':section==='cars'?'car':section==='umrah'?'umrah':PRODUCT_SECTIONS.has(section)?'marketplace':'announcement';

   if(PRODUCT_SECTIONS.has(section)){
    const {data:existingStore,error:storeLookupError}=await supabase.from('stores').select('id').eq('owner_id',userId).eq('name','SHAKH Store').eq('is_active',true).limit(1).maybeSingle();
    if(storeLookupError)throw storeLookupError;
    storeId=existingStore?.id||null;

    if(!storeId){
     const {data:newStore,error:newStoreError}=await supabase.from('stores').insert({owner_id:userId,name:'SHAKH Store',category:'daily',city:city.trim()||'هەولێر',is_active:true}).select('id').single();
     if(newStoreError)throw newStoreError;
     storeId=newStore.id;
     createdStoreId=storeId;
    }

    const {data:category,error:categoryError}=await supabase.from('categories').select('id').eq('slug',CATEGORY_SLUGS[section]).single();
    if(categoryError)throw categoryError;

    const {data:newProduct,error:productError}=await supabase.from('products').insert({
     store_id:storeId,
     category_id:category.id,
     name_ku:title.trim(),
     name_ar:title.trim(),
     name_en:title.trim(),
     description_ku:content.trim()||null,
     price_iqd:price?Number(price):0,
     product_type:section,
     image_url:imageUrls[0]||null,
     stock:1,
     is_available:true,
     variants:[{section}]
    }).select('id').single();
    if(productError)throw productError;
    createdProductId=newProduct.id;
   }

   const {error:postError}=await supabase.from('posts').insert({
    author_id:userId,
    store_id:storeId,
    title:title.trim(),
    content:content.trim()||null,
    images:imageUrls,
    price_iqd:price?Number(price):null,
    city:city.trim()||'هەولێر',
    section,
    publisher_name:'SHAKH Store',
    post_type:postType,
    publisher_role:'super_admin',
    label:'بەڕێوبەری باڵا',
    status:'approved',
    visibility:'public',
    listing_details:createdProductId?{source:'shakh_store',product_id:createdProductId}:{source:'shakh_store'}
   });
   if(postError)throw postError;

   setTitle('');setContent('');setPrice('');setFiles([]);previews.forEach(src=>URL.revokeObjectURL(src));setPreviews([]);
   setMessage(createdProductId?'بەرهەم و پۆست بە سەرکەوتوویی بڵاوکرانەوە؛ کڕیار دەتوانێت بۆ سەلە زیادیکات.':'پۆست بە ناوی SHAKH Store بڵاوکرایەوە.');
  }catch(error){
   if(createdProductId)await supabase.from('products').delete().eq('id',createdProductId);
   if(uploadedPaths.length)await supabase.storage.from('products').remove(uploadedPaths);
   if(createdStoreId)await supabase.from('stores').delete().eq('id',createdStoreId).eq('owner_id',userId);
   setMessage(error instanceof Error?error.message:'بڵاوکردنەوەی پۆست سەرکەوتوو نەبوو.');
  }finally{setBusy(false)}
 };

 return <div className="postComposer" style={{marginTop:18}} aria-busy={busy}>
  <div className="postComposerHead"><div className="postComposerBadge"><Store size={22}/></div><div><h3>SHAKH Store</h3><p>پۆستی بەرهەم دروست بکە؛ بۆ بەرهەمە بازاڕییەکان product و سەلە بە شێوەی خۆکار پەیوەست دەکرێن.</p></div></div>
  {!hideSectionSelector&&<div className="postCategoryGrid">
   {sections.map(s=><button type="button" key={s.value} className={section===s.value?'postCategory active':'postCategory'} aria-pressed={section===s.value} onClick={()=>setSection(s.value)}>{s.label}</button>)}
  </div>}
  {hideSectionSelector&&onBack&&<button type="button" className="postBackToCategories" onClick={onBack}>← گەڕانەوە بۆ هەڵبژاردنی کاتەگۆری</button>}
  <div className="postFormGrid">
   <label className="postField"><span>ناونیشانی پۆست</span><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="نموونە: کەباب"/></label>
   <label className="postField"><span>نرخ بە دینار</span><input value={price} onChange={e=>setPrice(e.target.value.replace(/\D/g,''))} inputMode="numeric" placeholder="5000" maxLength={14}/></label>
   <label className="postField"><span>شار</span><input value={city} onChange={e=>setCity(e.target.value)} placeholder="هەولێر"/></label>
   <label className="postField postFieldWide"><span>ناوەڕۆک</span><textarea value={content} onChange={e=>setContent(e.target.value)} placeholder="وەسف و زانیارییەکانی بەرهەم بنووسە..." rows={4}/></label>
  </div>
  <div className="postUploadBox">
   <div className="postUploadHead"><div><b>وێنەکانی پۆست و بەرهەم</b><small>{files.length}/6 · JPG، PNG یان WEBP · هەر وێنە تا ٥ MB</small></div><ImagePlus size={20}/></div>
   <label className="postUploadDrop postUploadMulti">
    <input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={e=>{chooseFiles(e.target.files);e.currentTarget.value=''}} aria-label="زیادکردنی وێنەی پۆست"/>
    <ImagePlus size={24}/><b>{files.length?'زیادکردنی وێنەی تر':'تا ٦ وێنە زیاد بکە'}</b><small>کلیک بکە یان وێنەکان بکێشە و دابنێ</small>
   </label>
   {previews.length>0&&<div className="postImageGallery">{previews.map((src,index)=><div className="postImageGalleryItem" key={src}><img src={src} alt=""/><button type="button" onClick={()=>removeImage(index)} aria-label="سڕینەوەی وێنە"><X size={15}/></button><span>{index+1}</span></div>)}</div>}
  </div>
  <button type="button" className="primary postPublishButton" disabled={busy} onClick={()=>void submit()}>{busy?<><Upload size={17}/> بڵاوکردنەوە...</>:<><Send size={17}/> بڵاوکردنەوەی پۆست</>}</button>
  {message&&<small className="msg postComposerMessage" role="status" aria-live="polite">{message}</small>}
 </div>;
}
