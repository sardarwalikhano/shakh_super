import React,{useEffect,useRef,useState} from 'react';
import {CheckCircle2,Eye,ImagePlus,PackagePlus,Send,Sparkles,Store,Tag,Upload,X} from 'lucide-react';
import {supabase} from '../lib/supabase';

type Role='restaurant_vendor'|'supermarket_vendor'|'fashion_vendor'|'vendor'|'electronics_vendor'|'jewelry_vendor';
type Props={userId:string;role:string;onSaved?:()=>void};
type Config={storeCategory:string;label:string;heading:string;typeLabel:string;brand:boolean;size:boolean;cats:{slug:string;label:string;icon:string}[]};
type FormState={storeName:string;type:string;brand:string;name:string;size:string;price:string;salePrice:string;stock:string;description:string;available:boolean;city:string};

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
const CITIES=['هەولێر','سلێمانی','دهۆک','کەرکووک','بەغدا','مووسڵ','کەربەلا','نەجەف','بەسرە','ئەنبار','دیالە','واسط','میسان','ذی قار','قادسیە','مثنی','بابل','صلاحەدین'];
const FASHION_OPTIONS={audience:['پیاوان','ئافرەتان','منداڵان','هەمووان'],condition:['نوێ','بەکارهاتوو'],colors:['ڕەش','سپی','خۆڵەمەشی','قاوەیی','شین','سۆر','سەوز','زەرد','پەمەیی','کەسک'],sizes:['XS','S','M','L','XL','XXL','3XL','28','30','32','34','36','38','40','42','44'],types:['تیشێرت','کراس','پانتۆڵ','جین','جاکەت','پۆشاک','جلوبەرگی وەرزشی','پێلاو','جانتا','ئاکسسوارات','کۆمەڵە جلوبەرگ']};
const SHOE_SIZES=['35','36','37','38','39','40','41','42','43','44','45','46'];
const initialForm=(city='هەولێر'):FormState=>({storeName:'',type:'',brand:'',name:'',size:'',price:'',salePrice:'',stock:'1',description:'',available:true,city});

export default function ProductPostComposer({userId,role,onSaved}:Props){
 const cfg=CONFIG[role as Role];if(!cfg)return null;
 const [form,setForm]=useState<FormState>(()=>initialForm());
 const [category,setCategory]=useState(cfg.cats[0].slug),[storeId,setStoreId]=useState(''),[storeLoading,setStoreLoading]=useState(true);
 const [files,setFiles]=useState<File[]>([]),[previews,setPreviews]=useState<string[]>([]);const previewsRef=useRef<string[]>([]);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[showPreview,setShowPreview]=useState(true);
 const [fashion,setFashionState]=useState({audience:'',clothingType:'',size:'',color:'',shoeSize:'',shoeSizes:[] as string[],condition:'',brand:''});
 const isFashion=role==='fashion_vendor';
 const selectedCategory=cfg.cats.find(item=>item.slug===category)||cfg.cats[0];
 useEffect(()=>{let live=true;setStoreLoading(true);(async()=>{const {data,error}=await supabase.from('stores').select('id,name').eq('owner_id',userId).eq('category',cfg.storeCategory).eq('is_active',true).limit(1);if(!live)return;if(error){setMessage('نەتوانرا دوکانەکەت وەرگیرێت. تکایە دووبارە هەوڵ بدەرەوە.');setStoreLoading(false);return}const store=data?.[0];if(store){setStoreId(store.id);setForm(v=>({...v,storeName:store.name||''}))}setStoreLoading(false)})();return()=>{live=false}},[userId,cfg.storeCategory]);
 useEffect(()=>{previewsRef.current=previews},[previews]);useEffect(()=>()=>{previewsRef.current.forEach(URL.revokeObjectURL)},[]);
 const update=(patch:Partial<FormState>)=>setForm(v=>({...v,...patch}));
 const setFashion=(key:keyof typeof fashion,value:string)=>setFashionState(v=>({...v,[key]:value}));
 const toggleShoeSize=(size:string)=>setFashionState(v=>({...v,shoeSizes:v.shoeSizes.includes(size)?v.shoeSizes.filter(item=>item!==size):[...v.shoeSizes,size]}));
 const ready=Boolean(form.name.trim()&&form.type.trim()&&Number(form.price)>0&&Number.isInteger(Number(form.stock))&&Number(form.stock)>=0&&(!form.salePrice||Number(form.salePrice)>0&&Number(form.salePrice)<=Number(form.price))&&(!cfg.brand||form.brand.trim())&&(!cfg.size||isFashion||form.size.trim())&&(!isFashion||fashion.audience&&fashion.clothingType&&fashion.color&&fashion.condition&&(fashion.clothingType==='پێلاو'?fashion.shoeSizes.length>0:Boolean(fashion.size))));
 const hasChanges=Boolean(files.length||form.type.trim()||form.name.trim()||form.brand.trim()||form.size.trim()||form.price.trim()||form.salePrice.trim()||form.stock!=='1'||form.description.trim()||!form.available||category!==cfg.cats[0].slug||Object.values(fashion).some(Boolean));
 const chooseFiles=(list:FileList|null)=>{if(!list?.length)return;const incoming=Array.from(list).slice(0,6-files.length).filter(file=>['image/jpeg','image/png','image/webp'].includes(file.type)&&file.size<=5*1024*1024);if(!incoming.length)return;setFiles(v=>[...v,...incoming]);setPreviews(v=>[...v,...incoming.map(file=>URL.createObjectURL(file))]);};
 const removeImage=(index:number)=>{URL.revokeObjectURL(previews[index]||'');setFiles(v=>v.filter((_,i)=>i!==index));setPreviews(v=>v.filter((_,i)=>i!==index));};
 const getStore=async()=>{
  if(storeId)return {id:storeId,created:false};
  if(!form.storeName.trim())throw new Error('ناوی دوکان بنووسە.');
  const {data,error}=await supabase.from('stores').insert({owner_id:userId,name:form.storeName.trim(),category:cfg.storeCategory,city:form.city||'هەولێر',is_active:true}).select('id').single();
  if(error)throw error;
  setStoreId(data.id);
  setForm(v=>({...v,storeName:form.storeName.trim()}));
  return {id:data.id,created:true};
 };
 const submit=async()=>{
  const uploadedPaths:string[]=[];
  let createdProductId:string|null=null;
  let createdStoreId:string|null=null;
  try{
   if(!ready)return setMessage('تکایە هەموو خانە پێویستەکان پڕ بکەرەوە.');
   if(!/^\d+$/.test(form.price)||Number(form.price)<=0)return setMessage('نرخ دەبێت ژمارەی دروست و زیاتر لە سفر بێت.');
   if(!/^\d+$/.test(form.stock)||Number(form.stock)<0)return setMessage('ستۆک دەبێت ژمارەیەکی دروست و صفر یان زیاتر بێت.');
   if(form.salePrice&&(!/^\d+$/.test(form.salePrice)||Number(form.salePrice)<=0||Number(form.salePrice)>Number(form.price)))return setMessage('نرخی داشکان دەبێت لە ١ تا نرخە سەرەکییەکە بێت.');
   if(isFashion&&!fashion.audience)return setMessage('تکایە بۆ کێیە دیاری بکە.');
   if(isFashion&&!fashion.clothingType)return setMessage('تکایە جۆری جلوبەرگ دیاری بکە.');
   if(isFashion&&fashion.clothingType==='پێلاو'&&fashion.shoeSizes.length===0)return setMessage('تکایە لانیکەم یەک ژمارەی پێلاو هەڵبژێرە.');
   if(isFashion&&fashion.clothingType!=='پێلاو'&&!fashion.size)return setMessage('تکایە قەبارەی جلوبەرگ دیاری بکە.');
   setBusy(true);setMessage('');

   const store=await getStore();
   const sid=store.id;
   if(store.created)createdStoreId=sid;

   const {data:cat,error:categoryError}=await supabase.from('categories').select('id').eq('slug',category).single();
   if(categoryError)throw categoryError;

   const imageUrls:string[]=[];
   for(const [index,file] of files.entries()){
    const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,'-');
    const path=userId+'/posts/'+Date.now()+'-'+index+'-'+safeName;
    const {error:uploadError}=await supabase.storage.from('products').upload(path,file,{upsert:false,contentType:file.type});
    if(uploadError)throw uploadError;
    uploadedPaths.push(path);
    imageUrls.push(supabase.storage.from('products').getPublicUrl(path).data.publicUrl);
   }

   const fashionDetails=isFashion?{category:'fashion',audience:fashion.audience,clothing_type:fashion.clothingType,size:fashion.clothingType==='پێلاو'?null:fashion.size,color:fashion.color,shoe_size:fashion.shoeSize||null,shoe_sizes:fashion.clothingType==='پێلاو'?fashion.shoeSizes:[],condition:fashion.condition,brand:fashion.brand||null}:{};
   const productName=form.name.trim();

   const {data:createdProduct,error:productError}=await supabase.from('products').insert({
    store_id:sid,category_id:cat.id,name_ku:productName,name_ar:productName,name_en:productName,
    description_ku:form.description.trim()||null,price_iqd:Number(form.price),sale_price_iqd:form.salePrice?Number(form.salePrice):null,product_type:form.type.trim(),
    brand:isFashion?fashion.brand.trim()||null:form.brand.trim()||null,
    size:isFashion?fashion.size.trim()||null:form.size.trim()||null,
    image_url:imageUrls[0]||null,stock:Number(form.stock),is_available:form.available&&Number(form.stock)>0,
    variants:[{section:role,category,...fashionDetails}]
   }).select('id').single();
   if(productError)throw productError;
   createdProductId=createdProduct.id;

   const meta=POST_META[role];
   if(meta){
    const {data:profile}=await supabase.from('profiles').select('full_name').eq('id',userId).maybeSingle();
    const publisherName=(profile as {full_name?:string|null}|null)?.full_name||form.storeName.trim()||meta.label;
    const {error:postError}=await supabase.from('posts').insert({
     author_id:userId,store_id:sid,title:productName,content:form.description.trim()||null,images:imageUrls,
     price_iqd:Number(form.price),city:form.city||'هەولێر',status:'approved',
     section:meta.postType==='fashion'?'fashion':category,publisher_name:publisherName,post_type:meta.postType,
     publisher_role:role,label:meta.label,visibility:'public',listing_details:{...fashionDetails,product_id:createdProduct.id,source:'vendor_product'}
    });
    if(postError)throw postError;
   }

   setForm(v=>({...initialForm(v.city),storeName:v.storeName}));
   setFiles([]);previews.forEach(URL.revokeObjectURL);setPreviews([]);
   setFashionState({audience:'',clothingType:'',size:'',color:'',shoeSize:'',shoeSizes:[],condition:'',brand:''});
   setCategory(cfg.cats[0].slug);setShowPreview(true);
   setMessage('بەرهەمەکە و پۆستەکە بە سەرکەوتوویی بڵاوکرانەوە.');onSaved?.();
  }catch(error:unknown){
   if(createdProductId)await supabase.from('products').delete().eq('id',createdProductId).eq('store_id',createdStoreId||storeId);
   if(uploadedPaths.length)await supabase.storage.from('products').remove(uploadedPaths);
   if(createdStoreId)await supabase.from('stores').delete().eq('id',createdStoreId).eq('owner_id',userId);
   setMessage(error instanceof Error?error.message:'پۆستکردن سەرکەوتوو نەبوو.');
  }finally{setBusy(false)}
 };
 return <section className="orderCard postComposer" aria-label="پۆستکردنی بەرهەم" aria-busy={busy}>
  <div className="postComposerHead"><div><span className="eyebrow"><Sparkles size={13}/> پۆستکردنی پیشەیی</span><h3>{cfg.heading}</h3><p>{cfg.label} · لەگەڵ شاخ دەگەیتە لوتکە</p></div><div className="postComposerBadge"><PackagePlus size={21}/><span>{cfg.label}</span></div></div>
  {!storeId&&<div className="postComposerNotice"><Store size={17}/><div><b>{storeLoading?'دۆزینەوەی دوکان...':'دوکانەکەت دیاری نەکراوە'}</b><small>{storeLoading?'زانیاریی دوکانەکەت پشکنین دەکرێت.':'ناوی دوکان بنووسە بۆ دروستکردنی دوکان.'}</small></div></div>}
  {!storeId&&<label className="postField">ناوی دوکان<input maxLength={100} value={form.storeName} onChange={e=>update({storeName:e.target.value})} placeholder={cfg.label}/></label>}
  <div className="postComposerLabel">کەتەگۆری</div><div className="postCategoryGrid">{cfg.cats.map(item=><button key={item.slug} type="button" className={category===item.slug?'postCategory active':'postCategory'} aria-pressed={category===item.slug} onClick={()=>setCategory(item.slug)}><span>{item.icon}</span><b>{item.label}</b></button>)}</div>
  {isFashion&&<div className="postStructuredBox"><div className="postComposerLabel">👕 زانیاری تایبەتی جلوبەرگ</div><div className="postFormGrid">
   <label className="postField"><span>بۆ کێیە؟</span><select value={fashion.audience} onChange={e=>setFashion('audience',e.target.value)}><option value="">هەڵبژێرە</option>{FASHION_OPTIONS.audience.map(v=><option key={v}>{v}</option>)}</select></label>
   <label className="postField"><span>جۆری جلوبەرگ</span><select value={fashion.clothingType} onChange={e=>setFashion('clothingType',e.target.value)}><option value="">هەڵبژێرە</option>{FASHION_OPTIONS.types.map(v=><option key={v}>{v}</option>)}</select></label>
   <label className="postField"><span>قەبارە</span><select value={fashion.size} onChange={e=>setFashion('size',e.target.value)}><option value="">هەڵبژێرە</option>{FASHION_OPTIONS.sizes.map(v=><option key={v}>{v}</option>)}</select></label>
   <label className="postField"><span>ڕەنگ</span><select value={fashion.color} onChange={e=>setFashion('color',e.target.value)}><option value="">هەڵبژێرە</option>{FASHION_OPTIONS.colors.map(v=><option key={v}>{v}</option>)}</select></label>
   <label className="postField"><span>حاڵەت</span><select value={fashion.condition} onChange={e=>setFashion('condition',e.target.value)}><option value="">هەڵبژێرە</option>{FASHION_OPTIONS.condition.map(v=><option key={v}>{v}</option>)}</select></label>
   {fashion.clothingType==='پێلاو'&&<div className="postField postFieldWide"><span>ژمارەکانی پێلاوی بەردەست</span><div className="shoeSizePicker">{SHOE_SIZES.map(size=><button key={size} type="button" className={fashion.shoeSizes.includes(size)?'shoeSizeChip active':'shoeSizeChip'} aria-pressed={fashion.shoeSizes.includes(size)} onClick={()=>toggleShoeSize(size)}>{size}</button>)}</div><small>تەنها ژمارەکانی بەردەست هەڵبژێرە؛ کڕیار لە هەمان لیست هەڵدەبژێرێت.</small></div>}
   {fashion.clothingType!=='پێلاو'&&<label className="postField"><span>ژمارەی پێلاو</span><input inputMode="numeric" value={fashion.shoeSize} onChange={e=>setFashion('shoeSize',e.target.value.replace(/\D/g,''))} placeholder="٤٢"/></label>}
   <label className="postField"><span>براند</span><input value={fashion.brand} onChange={e=>setFashion('brand',e.target.value)} placeholder="Nike"/></label>
  </div></div>}
  <div className="postFormGrid"><label className="postField">ناوی بەرهەم<input value={form.name} onChange={e=>update({name:e.target.value})} placeholder="ناوی بەرهەم"/></label>{!isFashion&&<label className="postField">{cfg.typeLabel}<input value={form.type} onChange={e=>update({type:e.target.value})} placeholder="جۆری بەرهەم"/></label>}{isFashion&&<label className="postField">{cfg.typeLabel}<input value={form.type} onChange={e=>update({type:e.target.value})} placeholder="جۆری بەرهەم"/></label>}{cfg.brand&&!isFashion&&<label className="postField">مارکە<input value={form.brand} onChange={e=>update({brand:e.target.value})} placeholder="مارکە"/></label>}{cfg.size&&!isFashion&&<label className="postField">قەبارە<input value={form.size} onChange={e=>update({size:e.target.value})} placeholder="قەبارە"/></label>}<label className="postField">نرخی سەرەکی بە د.ع<input value={form.price} onChange={e=>update({price:e.target.value.replace(/\D/g,'')})} inputMode="numeric" placeholder="نموونە: ١٥٠٠٠٠"/></label><label className="postField">نرخی داشکان<input value={form.salePrice} onChange={e=>update({salePrice:e.target.value.replace(/\D/g,'')})} inputMode="numeric" placeholder="ئارەزوومەندانە"/></label><label className="postField">بڕی ستۆک<input value={form.stock} onChange={e=>update({stock:e.target.value.replace(/\D/g,'')})} inputMode="numeric" min="0" placeholder="١"/></label><label className="postField">شار<select value={form.city} onChange={e=>update({city:e.target.value})}>{CITIES.map(v=><option key={v}>{v}</option>)}</select></label></div>
  <label className="postField"><span className="postLabelRow"><span>وەسف</span><small>{form.description.length}/500</small></span><textarea rows={4} maxLength={500} value={form.description} onChange={e=>update({description:e.target.value})} placeholder="وردەکارییەکانی بەرهەم..."/></label>
  <div className="postUploadBox"><div className="postUploadHead"><div><b>{isFashion?'وێنەکانی جلوبەرگ':'وێنەکانی بەرهەم'}</b><small>{files.length}/6 · JPG، PNG یان WEBP · هەر وێنە تا ٥ MB</small></div><ImagePlus size={20}/></div><label className="postUploadDrop postUploadMulti" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();chooseFiles(e.dataTransfer.files)}}><input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={e=>{chooseFiles(e.target.files);e.currentTarget.value=''}} aria-label="زیادکردنی وێنەی بەرهەم"/><ImagePlus size={24}/><b>{files.length?'زیادکردنی وێنەی تر':'تا ٦ وێنە زیاد بکە'}</b><small>کلیک بکە یان وێنەکان بکێشە و دابنێ</small></label>{previews.length>0&&<div className="postImageGallery">{previews.map((src,index)=><div className="postImageGalleryItem" key={src}><img src={src} alt=""/><button type="button" onClick={()=>removeImage(index)} aria-label="سڕینەوەی وێنە"><X size={15}/></button><span>{index+1}</span></div>)}</div>}</div>
  <div className="postComposerBottom"><label className="postAvailable"><input type="checkbox" checked={form.available} onChange={e=>update({available:e.target.checked})}/><span>بەردەستە</span></label><button type="button" className="postPreviewToggle" onClick={()=>setShowPreview(v=>!v)}><Eye size={16}/>{showPreview?'شاردنەوەی پێشبینین':'پیشاندانی پێشبینین'}</button></div>
  {showPreview&&<div className="postLivePreview"><div className="postLivePreviewTop"><span>پێشبینینی پۆست</span><small><Tag size={12}/> {selectedCategory.label}</small></div><div className="postLivePreviewCard"><div className="postLivePreviewImage">{previews[0]?<img src={previews[0]} alt=""/>:<ImagePlus size={34}/>}</div><div className="postLivePreviewBody"><small>{cfg.label} · {selectedCategory.label} · {form.city}</small><h4>{form.name.trim()||'ناوی بەرهەمەکەت لێرە دەردەکەوێت'}</h4><p>{form.description.trim()||'وەسفی بەرهەمەکەت لێرە پیشان دەدرێت.'}</p><div className="postLivePreviewPrice">{form.salePrice?Number(form.salePrice).toLocaleString('en-US'):form.price?Number(form.price).toLocaleString('en-US'):'٠'} د.ع{form.salePrice&&form.price?<small style={{marginInlineStart:6,textDecoration:'line-through',opacity:.65}}>{Number(form.price).toLocaleString('en-US')} د.ع</small>:null}</div>{isFashion&&<div className="postPreviewChips">{[fashion.audience,fashion.clothingType,fashion.size,fashion.color,fashion.shoeSize&&'پێلاو '+fashion.shoeSize,fashion.condition,fashion.brand].filter(Boolean).map(v=><span key={String(v)}>{String(v)}</span>)}</div>}</div></div></div>}
  <button type="button" className="postResetButton" disabled={busy||!hasChanges} onClick={()=>{if(!window.confirm('دڵنیایت؟ هەموو گۆڕانکارییەکانی فۆڕمەکە لەدەست دەچێت.'))return;setForm(initialForm(form.city));setFashionState({audience:'',clothingType:'',size:'',color:'',shoeSize:'',shoeSizes:[],condition:'',brand:''});setFiles([]);previews.forEach(URL.revokeObjectURL);setPreviews([]);setCategory(cfg.cats[0].slug);setMessage('فۆڕمەکە پاک کرایەوە.')}}>پاککردنەوەی فۆڕم</button>
  <button type="button" className="primary postPublishButton" disabled={busy||!ready} onClick={()=>void submit()}>{busy?<><Upload size={17}/> بڵاوکردنەوە...</>:<><Send size={17}/> بڵاوکردنەوەی بەرهەم و پۆست</>}</button>
  {message&&<div className={message.includes('سەرکەوت')?'postComposerMessage success':'postComposerMessage'} role="alert" aria-live="polite">{message}</div>}
  <small className="postComposerFoot"><CheckCircle2 size={14}/> لێبلی <b>{POST_META[role]?.label||cfg.label}</b> و زانیارییە structured ـەکان لەگەڵ پۆستەکە هەڵدەگیرێن.</small>
 </section>;
}
