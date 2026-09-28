import React,{useEffect,useMemo,useRef,useState} from 'react';
import {CheckCircle2,Eye,ImagePlus,Send,Sparkles,Tag,Upload,X} from 'lucide-react';
import {supabase} from '../lib/supabase';

type Props={userId:string;role:string;onSaved?:()=>void};
type RoleConfig={types:{value:string;label:string}[];heading:string;label:string};

const CONFIG:Record<string,RoleConfig>={
 customer:{types:[{value:'general',label:'گشتی'},{value:'marketplace',label:'بازاڕ'}],heading:'پۆستی نوێ',label:'کڕیار'},
 captain:{types:[{value:'delivery',label:'گەیاندن'}],heading:'پۆستی گەیاندن',label:'کاپتن'},
 restaurant_vendor:{types:[{value:'food',label:'خواردن'},{value:'marketplace',label:'بازاڕ'}],heading:'پۆستی ڕێستوران',label:'فرۆشیاری خواردن'},
 fashion_vendor:{types:[{value:'fashion',label:'جلوبەرگ'},{value:'marketplace',label:'بازاڕ'}],heading:'پۆستی جلوبەرگ',label:'فرۆشیاری جلوبەرگ'},
 car_dealer:{types:[{value:'car',label:'ئۆتۆمبێل'}],heading:'SHAKH Cars',label:'پێشانگای ئۆتۆمبێل'},
 umrah_agency:{types:[{value:'umrah',label:'عومرە'}],heading:'پۆستی عومرە',label:'ئاژانسی عومرە'},
 admin:{types:[{value:'announcement',label:'ئاگاداری'},{value:'support',label:'پشتگیری'}],heading:'پۆستی بەڕێوەبەر',label:'بەڕێوەبەر'},
 super_admin:{types:[{value:'announcement',label:'ئاگاداری'},{value:'support',label:'پشتگیری'}],heading:'پۆستی بەڕێوەبەری باڵا',label:'بەڕێوەبەری باڵا'},
 support:{types:[{value:'support',label:'پشتگیری'},{value:'announcement',label:'ئاگاداری'}],heading:'پۆستی پشتگیری',label:'تیمی پشتگیری'}
};

const IRAQ_CITIES=['هەولێر','سلێمانی','دهۆک','کەرکووک','بەغدا','مووسڵ','کەربەلا','نەجەف','بەسرە','ئەنبار','دیالە','واسط','میسان','ذی قار','قادسیە','مثنی','بابل','صلاحەدین'];
const TYPE_ICONS:Record<string,string>={general:'💬',marketplace:'🛍️',delivery:'🛵',restaurant:'🍽️',fashion:'👕',car:'🚗',umrah:'🕋',announcement:'📢',support:'🛟'};
const OPTIONS={
 audience:['پیاوان','ئافرەتان','منداڵان','هەمووان'],
 clothingType:['تیشێرت','کراس','پانتۆڵ','جین','جاکەت','پۆشاک','جلوبەرگی وەرزشی','پێلاو','جانتا','ئاکسسوارات','کۆمەڵە جلوبەرگ'],
 fashionCondition:['نوێ','بەکارهاتوو'],
 colors:['ڕەش','سپی','خۆڵەمەشی','قاوەیی','شین','سۆر','سەوز','زەرد','پەمەیی','کەسک'],
 carCondition:['نوێ','کارکراو'],
 fuel:['بنزین','دیزڵ','هايبرید','کارەبا'],
 transmission:['ئۆتۆماتیک','مانوێڵ'],
 body:['سێدان','SUV','کروس ئۆڤەر','هەچبەک','پیکاپ','ڤان','کوپێ'],
 drivetrain:['FWD','RWD','AWD','4WD'],
 plate:['هەیە','نییە'],
 origin:['ئیمارات','ئەڵمانیا','ئەمریکا','کۆریا','ژاپۆن','چین','تورکیا','عێراق']
};
const CLOTHING_SIZES=['XS','S','M','L','XL','XXL','3XL','28','30','32','34','36','38','40','42','44'];

export default function RolePostComposer({userId,role,onSaved}:Props){
 const cfg=CONFIG[role]||CONFIG.customer;
 const [postType,setPostType]=useState(cfg.types[0].value);
 const [title,setTitle]=useState('');
 const [content,setContent]=useState('');
 const [price,setPrice]=useState('');
 const [city,setCity]=useState('هەولێر');
 const [files,setFiles]=useState<File[]>([]);
 const [previews,setPreviews]=useState<string[]>([]);const previewsRef=useRef<string[]>([]);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [showPreview,setShowPreview]=useState(true);
 const [fashion,setFashion]=useState({audience:'',clothingType:'',size:'',color:'',shoeSize:'',condition:'',brand:''});
 const [car,setCar]=useState({make:'',model:'',year:'',trim:'',mileage:'',engine:'',body:'',fuel:'',transmission:'',drivetrain:'',color:'',condition:'',origin:'',plate:'',negotiable:true,exchange:false});
 const isFashion=postType==='fashion';
 const isCar=postType==='car';
 const isPriceVisible=useMemo(()=>postType==='marketplace'||isCar||postType==='umrah',[postType]);

 const ready=Boolean(
   title.trim() &&
   (!isPriceVisible||Number(price)>0) &&
   (!isFashion||(fashion.audience&&fashion.clothingType&&fashion.size&&fashion.color&&fashion.condition)) &&
   (!isCar||(car.make&&car.model&&car.year&&car.mileage&&car.body&&car.fuel&&car.transmission&&car.color))
 );

 const hasChanges=Boolean(title.trim()||content.trim()||price.trim()||city!=='هەولێر'||files.length||postType!==cfg.types[0].value||
   Object.values(fashion).some(Boolean)||Object.entries(car).some(([key,value])=>key==='negotiable'?value===false:key==='exchange'?value===true:Boolean(value)));

 useEffect(()=>{previewsRef.current=previews},[previews]);useEffect(()=>()=>{previewsRef.current.forEach(URL.revokeObjectURL)},[]);

 const setF=(key:keyof typeof fashion,value:string)=>setFashion(v=>({...v,[key]:value}));
 const setC=(key:keyof typeof car,value:string|boolean)=>setCar(v=>({...v,[key]:value}));

 const chooseFiles=(list:FileList|null)=>{
   if(!list?.length)return;
   const incoming=Array.from(list).slice(0,6-files.length);
   const valid=incoming.filter(file=>{
     if(!['image/jpeg','image/png','image/webp'].includes(file.type)){setMessage('تەنها JPG، PNG یان WEBP ڕێگەپێدراوە.');return false}
     if(file.size>5*1024*1024){setMessage('هەر وێنەیەک نابێت لە ٥ MB زیاتر بێت.');return false}
     return true;
   });
   if(!valid.length)return;
   setFiles(v=>[...v,...valid]);
   setPreviews(v=>[...v,...valid.map(file=>URL.createObjectURL(file))]);
   setMessage('');
 };

 const removeImage=(index:number)=>{
   URL.revokeObjectURL(previews[index]||'');
   setFiles(v=>v.filter((_,i)=>i!==index));
   setPreviews(v=>v.filter((_,i)=>i!==index));
 };

 const submit=async()=>{
  const uploadedPaths:string[]=[];
  try{
   if(!title.trim())return setMessage('سەردێڕ پڕ بکەرەوە.');
   if(isPriceVisible&&(!/^\d+$/.test(price)||Number(price)<=0))return setMessage('نرخ دەبێت ژمارەی دروست و زیاتر لە سفر بێت.');
   if(isFashion&&!fashion.audience)return setMessage('تکایە بۆ کێ جلوبەرگەکەیە دیاری بکە.');
   if(isFashion&&!fashion.clothingType)return setMessage('تکایە جۆری جلوبەرگ دیاری بکە.');
   if(isFashion&&!fashion.size)return setMessage('تکایە قەبارە دیاری بکە.');
   if(isFashion&&!fashion.color)return setMessage('تکایە ڕەنگ دیاری بکە.');
   if(isFashion&&!fashion.condition)return setMessage('تکایە حاڵەت دیاری بکە.');
   if(isCar&&!car.make)return setMessage('مارکەی ئۆتۆمبێل دیاری بکە.');
   if(isCar&&!car.model)return setMessage('مۆدێلی ئۆتۆمبێل دیاری بکە.');
   if(isCar&&!car.year)return setMessage('ساڵی ئۆتۆمبێل دیاری بکە.');
   if(isCar&&!car.mileage)return setMessage('کیلۆمەتر دیاری بکە.');
   if(isCar&&!car.body)return setMessage('جۆری بۆدی دیاری بکە.');
   if(isCar&&!car.fuel)return setMessage('سووتەمەنی دیاری بکە.');
   if(isCar&&!car.transmission)return setMessage('گێڕ دیاری بکە.');
   if(isCar&&!car.color)return setMessage('ڕەنگی ئۆتۆمبێل دیاری بکە.');
   if(isCar){
    const year=Number(car.year),mileage=Number(car.mileage);
    if(!Number.isInteger(year)||year<1900||year>new Date().getFullYear()+1)return setMessage('ساڵی ئۆتۆمبێل دروست نییە.');
    if(!Number.isFinite(mileage)||mileage<0)return setMessage('کیلۆمەتر دەبێت ژمارەی دروست بێت.');
   }
   setBusy(true);setMessage('');

   const {data:profile}=await supabase.from('profiles').select('full_name').eq('id',userId).maybeSingle();
   const publisherName=(profile as {full_name?:string|null}|null)?.full_name||cfg.label;
   const imageUrls:string[]=[];
   for(const [index,file] of files.entries()){
    const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,'-');
    const path=userId+'/posts/'+Date.now()+'-'+index+'-'+safeName;
    const {error}=await supabase.storage.from('products').upload(path,file,{upsert:false,contentType:file.type});
    if(error)throw error;
    uploadedPaths.push(path);
    imageUrls.push(supabase.storage.from('products').getPublicUrl(path).data.publicUrl);
   }

   const listingDetails=isFashion
    ?{category:'fashion',audience:fashion.audience,clothing_type:fashion.clothingType,size:fashion.size,color:fashion.color,shoe_size:fashion.shoeSize||null,condition:fashion.condition,brand:fashion.brand||null}
    :isCar
    ?{category:'car',make:car.make,model:car.model,year:Number(car.year),trim:car.trim||null,mileage:Number(car.mileage),engine:car.engine||null,body_type:car.body,fuel:car.fuel,transmission:car.transmission,drivetrain:car.drivetrain||null,color:car.color,condition:car.condition,origin:car.origin||null,plate_status:car.plate||null,negotiable:car.negotiable,exchange_allowed:car.exchange}
    :{};

   const {error}=await supabase.from('posts').insert({
    author_id:userId,title:title.trim(),content:content.trim()||null,images:imageUrls,
    price_iqd:price?Number(price):null,city:city.trim()||'هەولێر',status:'approved',
    section:postType,publisher_name:publisherName,post_type:postType,publisher_role:role,
    label:cfg.label,visibility:'public',listing_details:listingDetails
   });
   if(error)throw error;

   setTitle('');setContent('');setPrice('');setCity('هەولێر');
   setFiles([]);previews.forEach(URL.revokeObjectURL);setPreviews([]);
   setFashion({audience:'',clothingType:'',size:'',color:'',shoeSize:'',condition:'',brand:''});
   setCar({make:'',model:'',year:'',trim:'',mileage:'',engine:'',body:'',fuel:'',transmission:'',drivetrain:'',color:'',condition:'',origin:'',plate:'',negotiable:true,exchange:false});
   setShowPreview(true);setMessage('پۆستەکە بە سەرکەوتوویی بڵاوکرایەوە.');onSaved?.();
  }catch(error:unknown){
   if(uploadedPaths.length)await supabase.storage.from('products').remove(uploadedPaths);
   setMessage(error instanceof Error?error.message:'پۆستکردن سەرکەوتوو نەبوو.');
  }finally{setBusy(false)}
 };
 const selectField=(label:string,value:string,options:string[],onChange:(value:string)=>void)=>
   <label className="postField"><span>{label}</span><select value={value} onChange={e=>onChange(e.target.value)}><option value="">هەڵبژێرە</option>{options.map(item=><option key={item} value={item}>{item}</option>)}</select></label>;

 return <section className="orderCard postComposer" aria-label="پۆستکردن">
   <div className="postComposerHead">
     <div><span className="eyebrow"><Sparkles size={13}/> پۆستکردنی پیشەیی</span><h3>{cfg.heading}</h3><p>{cfg.label} · لەگەڵ شاخ دەگەیتە لوتکە</p></div>
     <div className="postComposerBadge"><Tag size={21}/><span>{cfg.label}</span></div>
   </div>

   <div className="postComposerLabel">جۆری پۆست</div>
   <div className="postCategoryGrid">{cfg.types.map(item=><button key={item.value} type="button" className={postType===item.value?'postCategory active':'postCategory'} aria-pressed={postType===item.value} onClick={()=>setPostType(item.value)}><span>{TYPE_ICONS[item.value]||'📝'}</span><b>{item.label}</b></button>)}</div>

   {isFashion&&<div className="postStructuredBox">
     <div className="postComposerLabel">👕 زانیاری جلوبەرگ</div>
     <div className="postFormGrid">
       {selectField('بۆ کێیە؟',fashion.audience,OPTIONS.audience,v=>setF('audience',v))}
       {selectField('جۆری جلوبەرگ',fashion.clothingType,OPTIONS.clothingType,v=>setF('clothingType',v))}
       {selectField('قەبارە',fashion.size,CLOTHING_SIZES,v=>setF('size',v))}
       {selectField('ڕەنگ',fashion.color,OPTIONS.colors,v=>setF('color',v))}
       {selectField('حاڵەت',fashion.condition,OPTIONS.fashionCondition,v=>setF('condition',v))}
       <label className="postField"><span>ژمارەی پێلاو</span><input inputMode="numeric" value={fashion.shoeSize} onChange={e=>setF('shoeSize',e.target.value.replace(/\D/g,''))} placeholder="نموونە: ٤٢"/></label>
       <label className="postField"><span>براند</span><input value={fashion.brand} onChange={e=>setF('brand',e.target.value)} placeholder="نموونە: Nike"/></label>
     </div>
   </div>}

   {isCar&&<div className="postStructuredBox carListingBox">
     <div className="postComposerLabel">🚗 SHAKH Cars — زانیاریی تەواوی ئۆتۆمبێل</div>
     <div className="postFormGrid">
       <label className="postField"><span>مارکە</span><input value={car.make} onChange={e=>setC('make',e.target.value)} placeholder="Toyota"/></label>
       <label className="postField"><span>مۆدێل</span><input value={car.model} onChange={e=>setC('model',e.target.value)} placeholder="Land Cruiser"/></label>
       <label className="postField"><span>ساڵ</span><input inputMode="numeric" value={car.year} onChange={e=>setC('year',e.target.value.replace(/\D/g,''))} placeholder="2024"/></label>
       <label className="postField"><span>تریم</span><input value={car.trim} onChange={e=>setC('trim',e.target.value)} placeholder="GXR / Limited"/></label>
       <label className="postField"><span>کیلۆمەتر</span><input inputMode="numeric" value={car.mileage} onChange={e=>setC('mileage',e.target.value.replace(/\D/g,''))} placeholder="45000"/></label>
       <label className="postField"><span>مەکینە</span><input value={car.engine} onChange={e=>setC('engine',e.target.value)} placeholder="3.5L V6"/></label>
       {selectField('جۆری بۆدی',car.body,OPTIONS.body,v=>setC('body',v))}
       {selectField('سووتەمەنی',car.fuel,OPTIONS.fuel,v=>setC('fuel',v))}
       {selectField('گێڕ',car.transmission,OPTIONS.transmission,v=>setC('transmission',v))}
       {selectField('Drivetrain',car.drivetrain,OPTIONS.drivetrain,v=>setC('drivetrain',v))}
       {selectField('ڕەنگ',car.color,OPTIONS.colors,v=>setC('color',v))}
       {selectField('حاڵەت',car.condition,OPTIONS.carCondition,v=>setC('condition',v))}
       {selectField('سەرچاوە',car.origin,OPTIONS.origin,v=>setC('origin',v))}
       {selectField('پلاک',car.plate,OPTIONS.plate,v=>setC('plate',v))}
     </div>
     <div className="postToggleRow">
       <label><input type="checkbox" checked={car.negotiable} onChange={e=>setC('negotiable',e.target.checked)}/> نرخ دانوستاندن هەیە</label>
       <label><input type="checkbox" checked={car.exchange} onChange={e=>setC('exchange',e.target.checked)}/> گۆڕین/ئەکسچێنج قبوڵە</label>
     </div>
   </div>}

   <div className="postFormGrid">
     <label className="postField"><span className="postLabelRow"><span>سەردێڕ</span><small>{title.length}/100</small></span><input maxLength={100} value={title} onChange={e=>setTitle(e.target.value)} placeholder={isCar?'نموونە: Toyota Land Cruiser 2024':isFashion?'نموونە: جلی ژنانەی نوێ':'سەردێڕی پۆست'}/></label>
     {isPriceVisible&&<label className="postField"><span>نرخ بە د.ع</span><input maxLength={14} value={price} onChange={e=>setPrice(e.target.value.replace(/\D/g,''))} inputMode="numeric" placeholder="نموونە: ٢٥٠٠٠"/></label>}
     <label className="postField"><span>شار</span><select value={city} onChange={e=>setCity(e.target.value)}>{IRAQ_CITIES.map(item=><option key={item}>{item}</option>)}</select></label>
   </div>

   <label className="postField"><span className="postLabelRow"><span>وەسف</span><small>{content.length}/800</small></span><textarea rows={5} maxLength={800} value={content} onChange={e=>setContent(e.target.value)} placeholder="وردەکارییەکانی پۆستەکەت بنووسە..."/></label>

   <div className="postUploadBox">
     <div className="postUploadHead"><div><b>{isCar?'وێنەکانی ئۆتۆمبێل':isFashion?'وێنەکانی جلوبەرگ':'وێنەکانی پۆست'}</b><small>{files.length}/6 · JPG، PNG یان WEBP · هەر وێنە تا ٥ MB</small></div><ImagePlus size={20}/></div>
     <label className="postUploadDrop postUploadMulti" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();chooseFiles(e.dataTransfer.files)}}>
       <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e=>chooseFiles(e.target.files)}/>
       <ImagePlus size={24}/><b>{files.length?'زیادکردنی وێنەی تر':'تا ٦ وێنە زیاد بکە'}</b><small>وێنەکان بکێشە و دابنێ یان کلیک بکە</small>
     </label>
     {previews.length>0&&<div className="postImageGallery">{previews.map((src,index)=><div className="postImageGalleryItem" key={src}><img src={src} alt="" /><button type="button" onClick={()=>removeImage(index)} aria-label="سڕینەوەی وێنە"><X size={15}/></button><span>{index+1}</span></div>)}</div>}
   </div>

   <div className="postComposerBottom"><span className="postComposerHint">پۆستەکە لە Supabase هەڵدەگیرێت و لە Feed ـدا بە شێوەی ڕاستەقینە دەردەکەوێت.</span><button type="button" className="postPreviewToggle" onClick={()=>setShowPreview(v=>!v)}><Eye size={16}/>{showPreview?'شاردنەوەی پێشبینین':'پیشاندانی پێشبینین'}</button></div>

   {showPreview&&<div className="postLivePreview"><div className="postLivePreviewTop"><span>پێشبینینی پۆست</span><small>{TYPE_ICONS[postType]||'📝'} {cfg.types.find(item=>item.value===postType)?.label||cfg.label}</small></div><div className="postLivePreviewCard"><div className="postLivePreviewImage">{previews[0]?<img src={previews[0]} alt="" />:<ImagePlus size={34}/>}</div><div className="postLivePreviewBody"><small>{cfg.label} · {city}</small><h4>{title.trim()||'سەردێڕی پۆستەکەت لێرە دەردەکەوێت'}</h4><p>{content.trim()||'ناوەڕۆکی پۆستەکەت لێرە پیشان دەدرێت.'}</p>{isPriceVisible&&<div className="postLivePreviewPrice">{price?Number(price).toLocaleString('en-US'):'٠'} د.ع</div>}{isFashion&&<div className="postPreviewChips">{[fashion.audience,fashion.clothingType,fashion.size,fashion.color,fashion.shoeSize&&'پێلاو '+fashion.shoeSize,fashion.condition,fashion.brand].filter(Boolean).map(v=><span key={String(v)}>{String(v)}</span>)}</div>}{isCar&&<div className="postPreviewChips">{[car.make&&car.model?car.make+' '+car.model:car.make,car.year,car.mileage&&car.mileage+' km',car.body,car.fuel,car.transmission,car.color].filter(Boolean).map(v=><span key={String(v)}>{String(v)}</span>)}</div>}</div></div></div>}

   {message&&<div className={message.includes('سەرکەوت')?'postComposerMessage success':'postComposerMessage'} role="alert" aria-live="polite">{message}</div>}
   <button type="button" className="primary postPublishButton" disabled={busy||!ready} onClick={()=>void submit()}>{busy?<><Upload size={17}/> بڵاوکردنەوە...</>:<><Send size={17}/> بڵاوکردنەوەی پۆست</>}</button>
   <small className="postComposerFoot"><CheckCircle2 size={14}/> لێبلی <b>{cfg.label}</b> لەگەڵ پۆستەکە هەڵدەگیرێت.</small>
 </section>;
}