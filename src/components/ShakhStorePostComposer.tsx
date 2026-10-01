import {useEffect,useRef,useState} from 'react';
import {ImagePlus,Send,Store,Upload,X} from 'lucide-react';
import {createClient} from '@supabase/supabase-js';

const url=import.meta.env.VITE_SUPABASE_URL as string|undefined;
const key=import.meta.env.VITE_SUPABASE_ANON_KEY as string|undefined;
const supabase=url&&key?createClient(url,key):null;

const SHOE_SIZES=['35','36','37','38','39','40','41','42','43','44','45','46'];

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
 useEffect(()=>{setSection(initialSection);setMessage('');resetDetails()},[initialSection]);
 useEffect(()=>{if(!supabase)return;void supabase.from('platform_settings').select('referral_commission_percent').eq('id',true).maybeSingle().then(({data})=>{if(data?.referral_commission_percent!=null)setReferralRewardPercent(String(data.referral_commission_percent))})},[]);
 const [title,setTitle]=useState('');
 const [content,setContent]=useState('');
 const [price,setPrice]=useState('');
 const [city,setCity]=useState('هەولێر');
 const [details,setDetails]=useState({type:'',audience:'',sizes:[] as string[],colors:[] as string[],condition:'',brand:'',shoeSizes:[] as string[],model:'',material:'',karat:''});
 const [stockMode,setStockMode]=useState<'finite'|'unlimited'>('finite');
 const [stock,setStock]=useState('0');
 const [files,setFiles]=useState<File[]>([]);
 const [previews,setPreviews]=useState<string[]>([]);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState(''); const [referralRewardPercent,setReferralRewardPercent]=useState('');
 const previewsRef=useRef<string[]>([]);
 const isFashion=section==='fashion';
 const isProductListing=PRODUCT_SECTIONS.has(section);
 const isShoe=isFashion&&details.type==='پێلاو';
 const isFood=section==='restaurant';
 const isSupermarket=section==='supermarket';
 const isElectronics=section==='electronics';
 const isJewelry=section==='jewelry';
 const isGenericProduct=section==='daily'||section==='marketplace';
  const updateDetail=(key:'type'|'audience'|'condition'|'brand'|'model'|'material'|'karat',value:string)=>setDetails(v=>({...v,[key]:value}));
  const toggleDetailChoice=(key:'sizes'|'colors'|'shoeSizes',value:string)=>{
    setDetails(v=>({...v,[key]:v[key].includes(value)?v[key].filter(item=>item!==value):[...v[key],value]}));
  };
  const resetDetails=()=>setDetails({type:'',audience:'',sizes:[],colors:[],condition:'',brand:'',shoeSizes:[],model:'',material:'',karat:''});

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
  if(referralRewardPercent&&!/^\d+(?:\.\d+)?$/.test(referralRewardPercent))return setMessage('خەڵاتی Share دەبێت ژمارە بێت.');
  if(Number(referralRewardPercent)<0||Number(referralRewardPercent)>100)return setMessage('خەڵاتی Share دەبێت لە ٠ تا ١٠٠٪ بێت.');
  if(PRODUCT_SECTIONS.has(section)&&!price)return setMessage('بۆ پۆستی بەرهەم تکایە نرخێک دابنێ.');
  if(PRODUCT_SECTIONS.has(section)&&files.length===0)return setMessage('بۆ پۆستی بەرهەم لانیکەم یەک وێنە زیاد بکە.');
  if(isProductListing&&stockMode==='finite'&&(!/^\d+$/.test(stock)||Number(stock)<0))return setMessage('ژمارەی بەردەست دەبێت ٠ یان ژمارەیەکی دروست بێت.');
  if(isFashion&&!details.type)return setMessage('تکایە جۆری جلوبەرگ دیاری بکە.');
  if(isFashion&&!details.condition)return setMessage('تکایە حاڵەتی جلوبەرگ دیاری بکە.');
  if(isFashion&&isShoe&&details.shoeSizes.length===0)return setMessage('تکایە لانیکەم یەک ژمارەی پێلاو هەڵبژێرە.');
  if(isFashion&&!isShoe&&details.sizes.length===0)return setMessage('تکایە لانیکەم یەک قەبارەی جلوبەرگ هەڵبژێرە.');
  if(isFashion&&details.colors.length===0)return setMessage('تکایە لانیکەم یەک ڕەنگ هەڵبژێرە.');
  if(isFood&&!details.type)return setMessage('تکایە جۆری خواردن دیاری بکە.');
  if(isElectronics&&!details.type)return setMessage('تکایە جۆری ئامێر دیاری بکە.');
  if(isJewelry&&!details.type)return setMessage('تکایە جۆری جواهرات دیاری بکە.');
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
     product_type:details.type||section,
     brand:details.brand||null,
     size:isFashion&&!isShoe&&details.sizes.length?details.sizes.join(', '):null,
     image_url:imageUrls[0]||null,
     stock:stockMode==='unlimited'?0:Number(stock||0),
     unlimited_stock:stockMode==='unlimited',
     is_available:stockMode==='unlimited'||Number(stock||0)>0,
     variants:[{section,category:isFashion?'fashion':section,clothing_type:isFashion?details.type:null,available_sizes:isFashion&&!isShoe?details.sizes:[],available_colors:isFashion?details.colors:[],shoe_sizes:isFashion&&isShoe?details.shoeSizes:[],unlimited_stock:stockMode==='unlimited'}]
    }).select('id').single();
    if(productError)throw productError;
    createdProductId=newProduct.id;
   }

   const {data:createdPost,error:postError}=await supabase.from('posts').insert({
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
    listing_details:{source:'shakh_store',referral_reward_percent:Number(referralRewardPercent||0),...(createdProductId?{product_id:createdProductId}:{}),stock:stockMode==='unlimited'?null:Number(stock||0),unlimited_stock:stockMode==='unlimited',...details,available_sizes:isFashion&&!isShoe?details.sizes:[],available_colors:isFashion?details.colors:[],shoe_sizes:isFashion&&isShoe?details.shoeSizes:[]}
   }).select('id').single();
   if(postError)throw postError;

   const {data:referralProgram}=createdPost?.id?await supabase.from('post_referral_programs').select('commission_percent').eq('post_id',createdPost.id).maybeSingle():{data:null};
   const savedReward=referralProgram?.commission_percent??Number(referralRewardPercent||0);

   setTitle('');setContent('');setPrice('');setReferralRewardPercent('');setFiles([]);previews.forEach(src=>URL.revokeObjectURL(src));setPreviews([]);resetDetails();setStockMode('finite');setStock('0');
   setMessage(savedReward>0?(createdProductId?'بەرهەم و پۆست بە سەرکەوتوویی بڵاوکرانەوە. خەڵاتی Share: '+savedReward+'٪.':'پۆست بە سەرکەوتوویی بڵاوکرایەوە. خەڵاتی Share: '+savedReward+'٪.'):(createdProductId?'بەرهەم و پۆست بە سەرکەوتوویی بڵاوکرانەوە؛ کڕیار دەتوانێت بۆ سەلە زیادیکات.':'پۆست بە ناوی SHAKH Store بڵاوکرایەوە.'));
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
   <label className="postField"><span>نرخ بە دینار</span><input value={price} onChange={e=>setPrice(e.target.value.replace(/\D/g,''))} inputMode="numeric" placeholder="5000" maxLength={14}/></label><label className="postField"><span>خەڵاتی Share (%)</span><input value={referralRewardPercent} onChange={e=>setReferralRewardPercent(e.target.value.replace(/[^0-9.]/g,''))} inputMode="decimal" min="0" max="100" placeholder="0"/><small>ئەو خەڵاتەی بۆ کەسی Share ـکەر دیاری دەکەیت؛ لە کاتی پۆستکردن قەفل دەکرێت.</small></label>
   <label className="postField"><span>شار</span><input value={city} onChange={e=>setCity(e.target.value)} placeholder="هەولێر"/></label>
   <label className="postField postFieldWide"><span>ناوەڕۆک</span><textarea value={content} onChange={e=>setContent(e.target.value)} placeholder="وەسف و زانیارییەکانی بەرهەم بنووسە..." rows={4}/></label>
  </div>
  {isProductListing&&<div className="postInventoryBox">
   <div className="postInventoryHeader"><div><b>بەردەستی بەرهەم</b><small>ژمارەی بەردەست لە ٠ تا ژمارەی دیاریکراو یان بێ‌سنوور.</small></div><span>{stockMode==='unlimited'?'بێ سنوور ∞':stock||'0'}</span></div>
   <div className="postInventoryMode"><button type="button" className={stockMode==='finite'?'active':''} onClick={()=>setStockMode('finite')}>ژمارەی دیاریکراو</button><button type="button" className={stockMode==='unlimited'?'active':''} onClick={()=>setStockMode('unlimited')}>بێ‌سنوور ∞</button></div>
   {stockMode==='finite'&&<label className="postField"><span>چەند دانە بەردەستە؟</span><input inputMode="numeric" min="0" value={stock} onChange={e=>setStock(e.target.value.replace(/\D/g,''))} placeholder="٠"/></label>}
  </div>}
  {isFashion&&<div className="postStructuredBox">
   <div className="postComposerLabel">👕 زانیاری جلوبەرگ و variant ـەکان</div>
   <div className="postFormGrid">
    <label className="postField"><span>جۆری جلوبەرگ</span><select value={details.type} onChange={e=>{updateDetail('type',e.target.value);if(e.target.value==='پێلاو')setDetails(v=>({...v,sizes:[]}));else setDetails(v=>({...v,shoeSizes:[]}))}}><option value="">هەڵبژێرە</option>{['تیشێرت','کراس','پانتۆڵ','جین','جاکەت','پۆشاک','جلوبەرگی وەرزشی','پێلاو','جانتا','ئاکسسوارات','کۆمەڵە جلوبەرگ'].map(v=><option key={v}>{v}</option>)}</select></label>
    <label className="postField"><span>بۆ کێیە؟</span><select value={details.audience} onChange={e=>updateDetail('audience',e.target.value)}><option value="">هەڵبژێرە</option>{['پیاوان','ئافرەتان','منداڵان','هەمووان'].map(v=><option key={v}>{v}</option>)}</select></label>
    <label className="postField postFieldWide"><span>{isShoe?'ژمارەکانی پێلاوی بەردەست':'قەبارەکانی بەردەست'}</span><div className="postChoiceGrid">{(isShoe?SHOE_SIZES:['XS','S','M','L','XL','XXL','3XL','28','30','32','34','36','38','40','42','44']).map(v=><button type="button" key={v} className={(isShoe?details.shoeSizes:details.sizes).includes(v)?'postChoiceChip active':'postChoiceChip'} onClick={()=>toggleDetailChoice(isShoe?'shoeSizes':'sizes',v)}>{v}</button>)}</div><small>{isShoe?'هەر ژمارەی پێلاوی بەردەستە هەڵیبژێرە.':'هەر قەبارەی بەردەستە هەڵیبژێرە.'}</small></label>
    <label className="postField postFieldWide"><span>ڕەنگەکانی بەردەست</span><div className="postChoiceGrid postColorChoiceGrid">{['ڕەش','سپی','خۆڵەمەشی','قاوەیی','شین','سۆر','سەوز','زەرد','پەمەیی','کەسک'].map(v=><button type="button" key={v} className={details.colors.includes(v)?'postChoiceChip active':'postChoiceChip'} onClick={()=>toggleDetailChoice('colors',v)}>{v}</button>)}</div><small>دەتوانیت چەند ڕەنگێک هەڵبژێریت.</small></label>
    <label className="postField"><span>حاڵەت / تازەیی</span><select value={details.condition} onChange={e=>updateDetail('condition',e.target.value)}><option value="">هەڵبژێرە</option><option>نوێ</option><option>بەکارهاتوو</option></select></label>
    <label className="postField"><span>براند</span><input value={details.brand} onChange={e=>updateDetail('brand',e.target.value)} placeholder="نموونە: Nike"/></label>
   </div>
  </div>}
  {(isFood||isSupermarket||isGenericProduct)&&<div className="postStructuredBox">
   <div className="postComposerLabel">🛍️ زانیاریی بەرهەم</div>
   <div className="postFormGrid">
    <label className="postField"><span>{isFood?'جۆری خواردن':'جۆری بەرهەم'}</span><input value={details.type} onChange={e=>updateDetail('type',e.target.value)} placeholder={isFood?'کەباب، بریانی...':'نموونە: پاککەرەوە'}/></label>
    {(isSupermarket||isGenericProduct)&&<label className="postField"><span>براند</span><input value={details.brand} onChange={e=>updateDetail('brand',e.target.value)} placeholder="براند"/></label>}
    {isSupermarket&&<label className="postField"><span>حاڵەت</span><select value={details.condition} onChange={e=>updateDetail('condition',e.target.value)}><option value="">هەڵبژێرە</option><option>نوێ</option><option>بەکارهاتوو</option></select></label>}
   </div>
  </div>}
  {isElectronics&&<div className="postStructuredBox">
   <div className="postComposerLabel">📱 زانیاریی ئەلیکترۆنیات</div>
   <div className="postFormGrid">
    <label className="postField"><span>جۆری ئامێر</span><input value={details.type} onChange={e=>updateDetail('type',e.target.value)} placeholder="مۆبایل، لپتۆپ..."/></label>
    <label className="postField"><span>براند</span><input value={details.brand} onChange={e=>updateDetail('brand',e.target.value)} placeholder="Apple"/></label>
    <label className="postField"><span>مۆدێل</span><input value={details.model} onChange={e=>updateDetail('model',e.target.value)} placeholder="iPhone 17 Pro"/></label>
    <label className="postField"><span>حاڵەت</span><select value={details.condition} onChange={e=>updateDetail('condition',e.target.value)}><option value="">هەڵبژێرە</option><option>نوێ</option><option>بەکارهاتوو</option></select></label>
   </div>
  </div>}
  {isJewelry&&<div className="postStructuredBox">
   <div className="postComposerLabel">💎 زانیاریی جواهرات</div>
   <div className="postFormGrid">
    <label className="postField"><span>جۆری جواهرات</span><input value={details.type} onChange={e=>updateDetail('type',e.target.value)} placeholder="خاتم، زنجیر..."/></label>
    <label className="postField"><span>مادە</span><input value={details.material} onChange={e=>updateDetail('material',e.target.value)} placeholder="زێڕ / زیو"/></label>
    <label className="postField"><span>عیار</span><input value={details.karat} onChange={e=>updateDetail('karat',e.target.value)} placeholder="18K"/></label>
    <label className="postField"><span>حاڵەت</span><select value={details.condition} onChange={e=>updateDetail('condition',e.target.value)}><option value="">هەڵبژێرە</option><option>نوێ</option><option>بەکارهاتوو</option></select></label>
   </div>
  </div>}
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
