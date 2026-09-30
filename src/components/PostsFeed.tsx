import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Filter,Image as ImageIcon,MapPin,RefreshCw,Share2,Tag,UserRound,WalletCards,X,SlidersHorizontal} from 'lucide-react';
import {supabase} from '../lib/supabase';

type Details=Record<string,unknown>;
type Post={id:string;author_id:string;store_id?:string|null;title:string;content?:string|null;images?:unknown;price_iqd?:number|null;city?:string|null;status:string;created_at:string;publisher_name?:string|null;post_type?:string|null;publisher_role?:string|null;label?:string|null;visibility:string;listing_details?:Details|null};
type Props={onAddToCart?: (productId:string)=>Promise<boolean>};

const TYPES=[{value:'all',label:'هەموو'},{value:'food',label:'خواردن'},{value:'fashion',label:'جلوبەرگ'},{value:'marketplace',label:'بازاڕ'},{value:'car',label:'ئۆتۆمبێل'},{value:'umrah',label:'عومرە'},{value:'delivery',label:'گەیاندن'},{value:'announcement',label:'ئاگاداری'}];
const AUDIENCE=['پیاوان','ئافرەتان','منداڵان','هەمووان'];
const CLOTHING_TYPES=['تیشێرت','کراس','پانتۆڵ','جین','جاکەت','پۆشاک','جلوبەرگی وەرزشی','پێلاو','جانتا','ئاکسسوارات','کۆمەڵە جلوبەرگ'];
const SIZES=['XS','S','M','L','XL','XXL','3XL','28','30','32','34','36','38','40','42','44'];
const COLORS=['ڕەش','سپی','خۆڵەمەشی','قاوەیی','شین','سۆر','سەوز','زەرد','پەمەیی','کەسک'];
const FUEL=['بنزین','دیزڵ','هايبرید','کارەبا'];
const TRANSMISSION=['ئۆتۆماتیک','مانوێڵ'];
const BODY=['سێدان','SUV','کروس ئۆڤەر','هەچبەک','پیکاپ','ڤان','کوپێ'];

const labelFor=(type?:string|null,label?:string|null)=>label||TYPES.find(item=>item.value===type)?.label||'گشتی';
const detailsOf=(post:Post)=>post.listing_details||{};
const listDetail=(post:Post,key:string):string[]=>{
 const value=detailsOf(post)[key];
 if(Array.isArray(value))return value.filter(v=>typeof v==='string'||typeof v==='number').map(String);
 if(typeof value==='string'&&value.trim())return value.split(',').map(v=>v.trim()).filter(Boolean);
 if(typeof value==='number')return [String(value)];
 return[];
};
const variantDetails=(post:Post)=>{
 const d=detailsOf(post);
 const sizes=[...new Set([...listDetail(post,'available_sizes'),...listDetail(post,'sizes'),...(d.size?[String(d.size)]:[])])];
 const colors=[...new Set([...listDetail(post,'available_colors'),...listDetail(post,'colors'),...(d.color?[String(d.color)]:[])])];
 const shoeSizes=[...new Set([...listDetail(post,'shoe_sizes'),...(d.shoe_size?[String(d.shoe_size)]:[])])];
 return{sizes,colors,shoeSizes,unlimited:Boolean(d.unlimited_stock),stock:d.inventory_stock==null?null:Number(d.inventory_stock)};
};
const stringDetail=(post:Post,key:string)=>{const value=detailsOf(post)[key];return value==null?'':String(value)};
const postImages=(images:unknown):string[]=>{if(Array.isArray(images))return images.filter((value):value is string=>typeof value==='string'&&value.trim().length>0).slice(0,12);if(typeof images==='string'){try{const parsed=JSON.parse(images);return Array.isArray(parsed)?parsed.filter((value):value is string=>typeof value==='string'&&value.trim().length>0).slice(0,12):[]}catch{return images.startsWith('http')?[images]:[]}}return[]};
const isNew=(createdAt:string)=>Date.now()-new Date(createdAt).getTime()<86400000;
const timeLabel=(createdAt:string)=>{const m=Math.floor(Math.max(0,Date.now()-new Date(createdAt).getTime())/60000);if(m<1)return 'ئێستا';if(m<60)return m+' خولەک لەمەوبەر';const h=Math.floor(m/60);if(h<24)return h+' کاتژمێر لەمەوبەر';return Math.floor(h/24)+' ڕۆژ لەمەوبەر'};
const postShareUrl=(id:string)=>{const u=new URL(window.location.href);u.search='';u.searchParams.set('post',id);u.hash='shakh-posts';return u.toString()};
async function sharePost(post:Post){try{const url=postShareUrl(post.id);if(typeof navigator.share==='function'){await navigator.share({title:post.title,text:post.content||post.title,url});return'shared'}if(navigator.clipboard){await navigator.clipboard.writeText(url);return'copied'}return'failed'}catch(error){if(error instanceof DOMException&&error.name==='AbortError')return'cancelled';return'failed'}}

export default function PostsFeed({onAddToCart}:Props){
 const [posts,setPosts]=useState<Post[]>([]),[filter,setFilter]=useState('all'),[loading,setLoading]=useState(true),[page,setPage]=useState(1),[message,setMessage]=useState(''),[selectedPost,setSelectedPost]=useState<Post|null>(null),[shareMessage,setShareMessage]=useState('');
 const [addingProductId,setAddingProductId]=useState<string|null>(null);
 const [showAdvanced,setShowAdvanced]=useState(false);
 const [fashionAudience,setFashionAudience]=useState(''),[fashionType,setFashionType]=useState(''),[fashionSize,setFashionSize]=useState(''),[fashionColor,setFashionColor]=useState(''),[fashionShoe,setFashionShoe]=useState('');
 const [carMake,setCarMake]=useState(''),[carFuel,setCarFuel]=useState(''),[carTransmission,setCarTransmission]=useState(''),[carBody,setCarBody]=useState(''),[carMinYear,setCarMinYear]=useState(''),[carMaxYear,setCarMaxYear]=useState(''),[carMaxMileage,setCarMaxMileage]=useState(''),[carMinPrice,setCarMinPrice]=useState(''),[carMaxPrice,setCarMaxPrice]=useState('');
 const [activeImage,setActiveImage]=useState(0);
 const pageSize=12,closeButtonRef=useRef<HTMLButtonElement|null>(null);

 const load=async()=>{setLoading(true);const {data,error}=await supabase.from('posts').select('id,author_id,store_id,title,content,images,price_iqd,city,status,created_at,publisher_name,post_type,publisher_role,label,visibility,listing_details').eq('status','approved').eq('visibility','public').order('created_at',{ascending:false}).limit(200);if(error){setMessage('نەتوانرا پۆستەکان وەرگیرێن.');setLoading(false);return}setPosts((data||[]) as Post[]);setMessage('');setLoading(false)};
 useEffect(()=>{void load();const c=supabase.channel('shakh-live-posts').on('postgres_changes',{event:'*',schema:'public',table:'posts'},()=>{void load()}).subscribe();return()=>{void supabase.removeChannel(c)}},[]);
 useEffect(()=>{setPage(1);if(filter!=='fashion'&&filter!=='car')setShowAdvanced(false)},[filter]);
 useEffect(()=>{if(!selectedPost)return;const u=new URL(window.location.href);u.searchParams.set('post',selectedPost.id);u.hash='shakh-posts';window.history.replaceState(null,'',u.pathname+u.search+u.hash)},[selectedPost]);

 const clearAdvanced=()=>{setFashionAudience('');setFashionType('');setFashionSize('');setFashionColor('');setFashionShoe('');setCarMake('');setCarFuel('');setCarTransmission('');setCarBody('');setCarMinYear('');setCarMaxYear('');setCarMaxMileage('');setCarMinPrice('');setCarMaxPrice('');};
 const filtered=useMemo(()=>posts.filter(post=>{
   if(filter!=='all'&&post.post_type!==filter)return false;
   const d=detailsOf(post);
   if(filter==='fashion'){
     if(fashionAudience&&d.audience!==fashionAudience)return false;
     if(fashionType&&d.clothing_type!==fashionType)return false;
     const variants=variantDetails(post);
     if(fashionSize&&!variants.sizes.includes(fashionSize))return false;
     if(fashionColor&&!variants.colors.includes(fashionColor))return false;
     if(fashionShoe&&!variants.shoeSizes.some(size=>Number(size)>=Number(fashionShoe)))return false;
   }
   if(filter==='car'){
     if(carMake&&!stringDetail(post,'make').toLowerCase().includes(carMake.toLowerCase()))return false;
     if(carFuel&&d.fuel!==carFuel)return false;
     if(carTransmission&&d.transmission!==carTransmission)return false;
     if(carBody&&d.body_type!==carBody)return false;
     if(carMinYear&&Number(d.year||0)<Number(carMinYear))return false;
     if(carMaxYear&&Number(d.year||0)>Number(carMaxYear))return false;
     if(carMaxMileage&&Number(d.mileage||0)>Number(carMaxMileage))return false;
     if(carMinPrice&&Number(post.price_iqd||0)<Number(carMinPrice))return false;
     if(carMaxPrice&&Number(post.price_iqd||0)>Number(carMaxPrice))return false;
   }
   return true;
 }),[posts,filter,fashionAudience,fashionType,fashionSize,fashionColor,fashionShoe,carMake,carFuel,carTransmission,carBody,carMinYear,carMaxYear,carMaxMileage,carMinPrice,carMaxPrice]);
 const shown=filtered.slice(0,page*pageSize);
 const productIdOf=(post:Post)=>{const value=detailsOf(post).product_id;return typeof value==='string'&&value?value:null};
 const addProduct=(productId:string)=>{if(!onAddToCart)return;setAddingProductId(productId);void onAddToCart(productId).then(ok=>setMessage(ok?'بەرهەمەکە بۆ سەلە زیاد کرا.':'')).finally(()=>setAddingProductId(null));};

 const openPost=(post:Post)=>{setSelectedPost(post);setActiveImage(0);setShareMessage('')};
 const closePost=()=>{setSelectedPost(null);setShareMessage('');const u=new URL(window.location.href);u.searchParams.delete('post');u.hash='shakh-posts';window.history.replaceState(null,'',u.pathname+u.search+u.hash)};
 const chips=(post:Post)=>{
  const d=detailsOf(post);
  if(post.post_type==='fashion'){
   const v=variantDetails(post);
   return [d.audience,d.clothing_type,v.sizes.length?'قەبارە: '+v.sizes.join('، '):'',v.colors.length?'ڕەنگ: '+v.colors.join('، '):'',v.shoeSizes.length?'پێلاو: '+v.shoeSizes.join('، '):'',v.unlimited?'بەردەستی: بێ‌سنوور':v.stock!==null&&!Number.isNaN(v.stock)?'بەردەستی: '+v.stock+' دانە':'',d.condition,d.brand].filter(Boolean).map(String);
  }
  if(post.post_type==='car')return[d.make&&d.model?d.make+' '+d.model:d.make,d.year,d.mileage&&Number(d.mileage).toLocaleString('en-US')+' km',d.body_type,d.fuel,d.transmission,d.color,d.engine].filter(Boolean).map(String);
  return[];
 };

 useEffect(()=>{const id=new URLSearchParams(window.location.search).get('post');if(id&&!selectedPost){const match=posts.find(post=>post.id===id);if(match)openPost(match)}},[posts,selectedPost]);
 useEffect(()=>{if(!selectedPost)return;const prev=document.body.style.overflow;document.body.style.overflow='hidden';const key=(e:KeyboardEvent)=>{if(e.key==='Escape')closePost()};window.addEventListener('keydown',key);window.setTimeout(()=>closeButtonRef.current?.focus(),0);return()=>{document.body.style.overflow=prev;window.removeEventListener('keydown',key)}},[selectedPost]);

 return <section className="section postFeed" id="shakh-posts">
  <div className="title postFeedTitle"><div><span>پۆستەکانی شاخ</span><h2>بازاڕ و ناوەڕۆکی ڕاستەقینەی شاخ</h2></div><button type="button" className="plain" onClick={()=>void load()} disabled={loading} aria-label="نوێکردنەوە"><RefreshCw size={17}/></button></div>
  <div className="postFeedFilters" role="tablist" aria-label="فلتەری بەشەکان"><Filter size={17}/>{TYPES.map(item=><button key={item.value} type="button" role="tab" aria-selected={filter===item.value} className={filter===item.value?'active':''} onClick={()=>setFilter(item.value)}>{item.label}</button>)}</div>

  {(filter==='fashion'||filter==='car')&&<div className="postAdvancedFilter">
    <div className="postAdvancedFilterHead"><div><SlidersHorizontal size={18}/><div><b>{filter==='fashion'?'فلتەری وردی جلوبەرگ':'فلتەری وردی SHAKH Cars'}</b><small>{filtered.length.toLocaleString('ku-IQ')} پۆست لە ئەنجامەکان</small></div></div><div><button type="button" className="plain" onClick={()=>setShowAdvanced(v=>!v)}>{showAdvanced?'شاردنەوە':'پیشاندانی فلتەر'}</button><button type="button" className="plain" onClick={clearAdvanced}>پاککردنەوە</button></div></div>
    {showAdvanced&&<div className="postAdvancedGrid">
      {filter==='fashion'?<>
       <label className="postField"><span>بۆ کێیە؟</span><select value={fashionAudience} onChange={e=>setFashionAudience(e.target.value)}><option value="">هەمووان</option>{AUDIENCE.map(v=><option key={v}>{v}</option>)}</select></label>
       <label className="postField"><span>جۆری جلوبەرگ</span><select value={fashionType} onChange={e=>setFashionType(e.target.value)}><option value="">هەموو جۆرەکان</option>{CLOTHING_TYPES.map(v=><option key={v}>{v}</option>)}</select></label>
       <label className="postField"><span>قەبارە</span><select value={fashionSize} onChange={e=>setFashionSize(e.target.value)}><option value="">هەموو</option>{SIZES.map(v=><option key={v}>{v}</option>)}</select></label>
       <label className="postField"><span>ڕەنگ</span><select value={fashionColor} onChange={e=>setFashionColor(e.target.value)}><option value="">هەموو</option>{COLORS.map(v=><option key={v}>{v}</option>)}</select></label>
       <label className="postField"><span>کەمترین ژمارەی پێلاو</span><input inputMode="numeric" value={fashionShoe} onChange={e=>setFashionShoe(e.target.value.replace(/\D/g,''))} placeholder="٤٠"/></label>
      </>:<>
       <label className="postField"><span>مارکە</span><input value={carMake} onChange={e=>setCarMake(e.target.value)} placeholder="Toyota"/></label>
       <label className="postField"><span>سووتەمەنی</span><select value={carFuel} onChange={e=>setCarFuel(e.target.value)}><option value="">هەموو</option>{FUEL.map(v=><option key={v}>{v}</option>)}</select></label>
       <label className="postField"><span>گێڕ</span><select value={carTransmission} onChange={e=>setCarTransmission(e.target.value)}><option value="">هەموو</option>{TRANSMISSION.map(v=><option key={v}>{v}</option>)}</select></label>
       <label className="postField"><span>بۆدی</span><select value={carBody} onChange={e=>setCarBody(e.target.value)}><option value="">هەموو</option>{BODY.map(v=><option key={v}>{v}</option>)}</select></label>
       <label className="postField"><span>کەمترین ساڵ</span><input inputMode="numeric" value={carMinYear} onChange={e=>setCarMinYear(e.target.value.replace(/\D/g,''))} placeholder="2020"/></label>
       <label className="postField"><span>زۆرترین ساڵ</span><input inputMode="numeric" value={carMaxYear} onChange={e=>setCarMaxYear(e.target.value.replace(/\D/g,''))} placeholder="2026"/></label>
       <label className="postField"><span>زۆرترین کیلۆمەتر</span><input inputMode="numeric" value={carMaxMileage} onChange={e=>setCarMaxMileage(e.target.value.replace(/\D/g,''))} placeholder="100000"/></label>
       <label className="postField"><span>کەمترین نرخ</span><input inputMode="numeric" value={carMinPrice} onChange={e=>setCarMinPrice(e.target.value.replace(/\D/g,''))} placeholder="10000000"/></label>
       <label className="postField"><span>زۆرترین نرخ</span><input inputMode="numeric" value={carMaxPrice} onChange={e=>setCarMaxPrice(e.target.value.replace(/\D/g,''))} placeholder="50000000"/></label>
      </>}
    </div>}
  </div>}

  {loading&&!posts.length?<div className="postFeedEmpty"><RefreshCw size={35}/><strong>پۆستەکان بار دەکرێن...</strong><small>کەمێک چاوەڕوان بە.</small></div>:!filtered.length?<div className="postFeedEmpty"><Tag size={38}/><strong>هیچ پۆستێک نەدۆزرایەوە</strong><small>فلتەرەکان بگۆڕە یان پاکیان بکەرەوە.</small></div>:<div className="postFeedGrid">{shown.map(post=>{const imgs=postImages(post.images),img=imgs[0],postChips=chips(post);return <article className={'postFeedCard '+(post.post_type==='car'?'postFeedCardCar':post.post_type==='fashion'?'postFeedCardFashion':'')} key={post.id} id={'post-'+post.id} tabIndex={0} role="button" aria-label={'پۆستی '+post.title+' بکەرەوە'} onClick={()=>openPost(post)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openPost(post)}}}>
   <div className="postFeedImage">{img?<img src={img} alt={post.title} loading="lazy" decoding="async"/>:<ImageIcon size={40}/>}<span className="postFeedBadge">{labelFor(post.post_type,post.label)}</span>{imgs.length>1&&<span className="postFeedImageCount">{imgs.length} وێنە</span>}{isNew(post.created_at)&&<span className="postFeedNew">نوێ</span>}</div>
   <div className="postFeedBody"><div className="postFeedMeta"><span><MapPin size={12}/>{post.city||'هەولێر'}</span><small>{timeLabel(post.created_at)}</small></div><h3>{post.title}</h3>{post.content&&<p>{post.content}</p>}{postChips.length>0&&<div className="postSpecChips">{postChips.slice(0,7).map((chip,i)=><span key={chip+'-'+i}>{chip}</span>)}</div>}<div className="postFeedPublisher"><UserRound size={14}/><span>{post.publisher_name||'بڵاوکەرەوە'}</span></div><div className="postFeedFooter">{post.price_iqd!=null?<strong><WalletCards size={14}/>{Number(post.price_iqd).toLocaleString('en-US')} د.ع</strong>:<small>بێ نرخ</small>}{productIdOf(post)&&onAddToCart?<button type="button" className="postAddToCart" onClick={e=>{e.stopPropagation();addProduct(productIdOf(post)!)}} disabled={addingProductId===productIdOf(post)}>{addingProductId===productIdOf(post)?'زیاد دەکرێت...':'زیادکردن بۆ سەلە'}</button>:<span>وردەکاری</span>}</div></div>
  </article>})}</div>}
  {shown.length<filtered.length&&<div className="postFeedMore"><button type="button" className="plain" onClick={()=>setPage(v=>v+1)}>زیاتر پیشاندان</button></div>}{message&&<div className="msg postFeedMessage" role="alert" aria-live="polite">{message}</div>}

  {selectedPost&&<div className="postDetailsBackdrop" role="presentation" onClick={closePost}><div className="postDetailsModal postDetailsModalRich" role="dialog" aria-modal="true" aria-labelledby="post-details-title" onClick={e=>e.stopPropagation()}>
   <button ref={closeButtonRef} type="button" className="postDetailsClose" onClick={closePost} aria-label="داخستن"><X size={20}/></button>
   <div className="postDetailsGallery">
     <div className="postDetailsMainImage">{postImages(selectedPost.images)[activeImage]?<img src={postImages(selectedPost.images)[activeImage]} alt={selectedPost.title}/>:<ImageIcon size={50}/>}</div>
     {postImages(selectedPost.images).length>1&&<div className="postDetailsThumbs">{postImages(selectedPost.images).map((src,index)=><button key={src} type="button" className={activeImage===index?'active':''} onClick={()=>setActiveImage(index)}><img src={src} alt=""/><span>{index+1}</span></button>)}</div>}
   </div>
   <div className="postDetailsBody">
    <div className="postDetailsMeta"><span>{labelFor(selectedPost.post_type,selectedPost.label)}</span><small>{selectedPost.city||'هەولێر'}</small></div>
    <h3 id="post-details-title">{selectedPost.title}</h3>{selectedPost.content&&<p>{selectedPost.content}</p>}
    {chips(selectedPost).length>0&&<div className="postSpecChips postSpecChipsDetails">{chips(selectedPost).map((chip,i)=><span key={chip+'-'+i}>{chip}</span>)}</div>}
    <div className="postDetailsPublisher"><UserRound size={15}/><span>{selectedPost.publisher_name||'بڵاوکەرەوە'}</span></div>
    {selectedPost.price_iqd!=null&&<strong className="postDetailsPrice"><WalletCards size={15}/>{Number(selectedPost.price_iqd).toLocaleString('en-US')} د.ع</strong>}
    {productIdOf(selectedPost)&&onAddToCart&&<button type="button" className="primary postDetailsCart" disabled={addingProductId===productIdOf(selectedPost)} onClick={()=>addProduct(productIdOf(selectedPost)!) }>{addingProductId===productIdOf(selectedPost)?'زیاد دەکرێت...':'زیادکردن بۆ سەلە'}</button>}
    <button type="button" className="primary postDetailsShare" onClick={async()=>{const result=await sharePost(selectedPost);if(result==='shared')setShareMessage('پۆستەکە بە سەرکەوتوویی هاوبەش کرا.');else if(result==='copied')setShareMessage('لینکی پۆستەکە کۆپی کرا.');else if(result==='failed')setShareMessage('نەتوانرا هاوبەشی بکەیت.')}}><Share2 size={15}/> هاوبەشکردن</button>
    {shareMessage&&<div className="msg" role="status">{shareMessage}</div>}
   </div>
  </div></div>}
 </section>;
}
