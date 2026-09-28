import React,{useEffect,useMemo,useState} from 'react';
import {CheckCircle2,Edit3,Eye,EyeOff,RefreshCw,Search,Share2,ShieldAlert,Trash2,X} from 'lucide-react';
import {supabase} from '../lib/supabase';

type Props={userId:string;role:string;focusRequest?:{postId:string;nonce:number}|null};

type Post={
 id:string;
 author_id:string;
 title:string;
 content?:string|null;
 images?:unknown;
 price_iqd?:number|null;
 city?:string|null;
 status:string;
 created_at:string;
 updated_at?:string|null;
 publisher_name?:string|null;
 post_type?:string|null;
 publisher_role?:string|null;
 label?:string|null;
 rejection_reason?:string|null;
 visibility:string;
 listing_details?:Record<string,unknown>|null;
};

const STATUS_FILTERS=[
 {value:'all',label:'هەموو'},
 {value:'public',label:'بڵاوکراوە'},
 {value:'private',label:'شاراوە'},
 {value:'pending',label:'چاوەڕوان'},
 {value:'rejected',label:'ڕەتکراوە'}
];

const IRAQ_CITIES=['هەولێر','سلێمانی','دهۆک','کەرکووک','بەغدا','مووسڵ','کەربەلا','نەجەف','بەسرە','ئەنبار','دیالە','واسط','میسان','ذی قار','قادسیە','مثنی','بابل','صلاحەدین'];

const ROLE_FILTERS=[
 {value:'all',label:'هەموو ڕۆڵەکان'},
 {value:'customer',label:'کڕیار'},
 {value:'restaurant_vendor',label:'چێشتخانە'},
 {value:'supermarket_vendor',label:'سووپەرمارکێت'},
 {value:'fashion_vendor',label:'جلوبەرگ'},
 {value:'vendor',label:'بازاڕ'},
 {value:'electronics_vendor',label:'ئەلیکترۆنیات'},
 {value:'jewelry_vendor',label:'جواکاری'},
 {value:'car_dealer',label:'ئۆتۆمبێل'},
 {value:'umrah_agency',label:'عومرە'},
 {value:'captain',label:'کاپتن'},
 {value:'admin',label:'بەڕێوبەر'},
 {value:'super_admin',label:'بەڕێوبەری باڵا'}
];

const typeLabels:Record<string,string>={
 food:'خواردنگە',fashion:'جلوبەرگ',marketplace:'بازاڕ',car:'ئۆتۆمبێل',
 umrah:'عومرە',delivery:'گەیاندن',announcement:'ئاگاداری',support:'پشتگیری',general:'گشتی'
};

const imageOf=(images:unknown)=>{
 if(Array.isArray(images)&&typeof images[0]==='string')return String(images[0]);
 return '';
};

const labelOf=(post:Post)=>post.label||typeLabels[post.post_type||'']||'گشتی';

const updatedLabel=(post:Post)=>{
 if(!post.updated_at)return '';
 const created=new Date(post.created_at).getTime();
 const updated=new Date(post.updated_at).getTime();
 return updated-created>60000?`نوێکراوە: ${new Date(post.updated_at).toLocaleString('ku-IQ')}`:'';
};

export default function PostsManagement({userId,role,focusRequest}:Props){
 const isAdmin=role==='admin'||role==='super_admin';
 const [posts,setPosts]=useState<Post[]>([]);
 const [loading,setLoading]=useState(true);
 const [busyId,setBusyId]=useState('');
 const [message,setMessage]=useState('');
 const [query,setQuery]=useState('');
 const [statusFilter,setStatusFilter]=useState('all');
 const [roleFilter,setRoleFilter]=useState('all');
 const [page,setPage]=useState(1);
 const [editing,setEditing]=useState<Post|null>(null);
 const [editTitle,setEditTitle]=useState('');
 const [editContent,setEditContent]=useState('');
 const [editPrice,setEditPrice]=useState('');
 const [editCity,setEditCity]=useState('');
 const [editListing,setEditListing]=useState<Record<string,any>>({});
 const [editImages,setEditImages]=useState<string[]>([]);
 const [editFiles,setEditFiles]=useState<File[]>([]);
 const [editFilePreviews,setEditFilePreviews]=useState<string[]>([]);
 const [editGalleryIndex,setEditGalleryIndex]=useState(0);
 const [rejectingPost,setRejectingPost]=useState<Post|null>(null);
 const [rejectReason,setRejectReason]=useState('');
 const pageSize=12;

 const load=async()=>{
  setLoading(true);
  let builder=supabase
   .from('posts')
   .select('id,author_id,title,content,images,price_iqd,city,status,created_at,updated_at,publisher_name,post_type,publisher_role,label,rejection_reason,visibility,listing_details')
   .order('created_at',{ascending:false})
   .limit(200);
  if(!isAdmin)builder=builder.eq('author_id',userId);
  const {data,error}=await builder;
  if(error){
   setMessage('نەتوانرا پۆستەکان وەرگیرێن.');
   setLoading(false);
   return;
  }
  setPosts((data||[]) as Post[]);
  setMessage('');
  setLoading(false);
 };

 useEffect(()=>{
  void load();
  const channel=supabase.channel('shakh-post-management-'+userId)
   .on('postgres_changes',{event:'*',schema:'public',table:'posts'},()=>{void load()})
   .subscribe();
  return()=>{void supabase.removeChannel(channel)};
 },[userId,role]);

 const filtered=useMemo(()=>{
  const textQuery=query.trim().toLowerCase();
  return posts.filter(post=>{
   const statusOk=statusFilter==='all'
    || (statusFilter==='public'&&post.status==='approved'&&post.visibility==='public')
    || (statusFilter==='private'&&post.visibility!=='public')
    || (statusFilter==='pending'&&post.status==='pending')
    || (statusFilter==='rejected'&&post.status==='rejected');
   const roleOk=!isAdmin||roleFilter==='all'||post.publisher_role===roleFilter;
   const haystack=[post.title,post.content,post.publisher_name,post.city,labelOf(post)].filter(Boolean).join(' ').toLowerCase();
   return statusOk&&roleOk&&(!textQuery||haystack.includes(textQuery));
  });
 },[posts,statusFilter,roleFilter,query,isAdmin]);

 const matchesStatus=(post:Post,value:string)=>value==='all'||(value==='public'&&post.status==='approved'&&post.visibility==='public')||(value==='private'&&post.visibility!=='public')||(value==='pending'&&post.status==='pending')||(value==='rejected'&&post.status==='rejected');
 const filterCount=(value:string)=>posts.filter(post=>matchesStatus(post,value)&&(!isAdmin||roleFilter==='all'||post.publisher_role===roleFilter)).length;

 const totalPages=Math.max(1,Math.ceil(filtered.length/pageSize));
 const currentPage=Math.min(page,totalPages);
 const pageItems=filtered.slice((currentPage-1)*pageSize,currentPage*pageSize);

 useEffect(()=>{setPage(1)},[statusFilter,roleFilter,query]);

 useEffect(()=>{
  if(!focusRequest?.postId||!posts.length)return;
  const index=posts.findIndex(post=>post.id===focusRequest.postId);
  if(index<0){
   setMessage('ئەم پۆستە لە لیستی ئێستەدا نییە یان مۆڵەتی بینینی نییە.');
   return;
  }
  setQuery('');
  setStatusFilter('all');
  if(isAdmin)setRoleFilter('all');
  setPage(Math.floor(index/pageSize)+1);
 },[focusRequest?.nonce,posts,isAdmin]);

 useEffect(()=>{
  if(!focusRequest?.postId)return;
  const target=pageItems.find(post=>post.id===focusRequest.postId);
  if(!target)return;
  window.setTimeout(()=>{
   const element=document.getElementById('managed-post-'+focusRequest.postId);
   if(!element)return;
   element.scrollIntoView({behavior:'smooth',block:'center'});
   element.classList.add('profilePostJump');
   window.setTimeout(()=>element.classList.remove('profilePostJump'),1800);
  },0);
 },[focusRequest?.nonce,pageItems]);

 useEffect(()=>{
  if(!editing)return;
  const previousOverflow=document.body.style.overflow;
  document.body.style.overflow='hidden';
  const onKeyDown=(event:KeyboardEvent)=>{if(event.key==='Escape')closeEditor()};
  window.addEventListener('keydown',onKeyDown);
  return()=>{document.body.style.overflow=previousOverflow;window.removeEventListener('keydown',onKeyDown)};
 },[editing]);

 useEffect(()=>{
  if(!rejectingPost)return;
  const previousOverflow=document.body.style.overflow;
  document.body.style.overflow='hidden';
  const onKeyDown=(event:KeyboardEvent)=>{
   if(event.key==='Escape'&&busyId!==rejectingPost.id){setRejectingPost(null);setRejectReason('');}
  };
  window.addEventListener('keydown',onKeyDown);
  return()=>{document.body.style.overflow=previousOverflow;window.removeEventListener('keydown',onKeyDown)};
 },[rejectingPost,busyId]);

 const refreshPosts=()=>{
  if(editing&&hasEditChanges&&!window.confirm('گۆڕانکارییەکانی پۆست پاشەکەوت نەکراون. دڵنیایت دەتەوێت داتا دووبارە بار بکرێت؟'))return;
  void load();
 };

 const startEdit=(post:Post)=>{setEditing(post);setEditTitle(post.title);setEditContent(post.content||'');setEditPrice(post.price_iqd==null?'':String(post.price_iqd));setEditCity(post.city||'هەولێر');setEditListing(post.listing_details&&typeof post.listing_details==='object'?{...post.listing_details}:{});setEditImages(Array.isArray(post.images)?post.images.filter((v):v is string=>typeof v==='string'):[]);setEditFiles([]);setEditFilePreviews([]);setEditGalleryIndex(0);setMessage('');};
 const setEditSpec=(key:string,value:any)=>setEditListing(v=>({...v,[key]:value}));
 const chooseEditFiles=(list:FileList|null)=>{if(!list?.length)return;const incoming=Array.from(list).slice(0,8-editFiles.length).filter(file=>['image/jpeg','image/png','image/webp'].includes(file.type)&&file.size<=5*1024*1024);if(!incoming.length)return;setEditFiles(v=>[...v,...incoming]);setEditFilePreviews(v=>[...v,...incoming.map(file=>URL.createObjectURL(file))]);};
 const removeEditFile=(index:number)=>{URL.revokeObjectURL(editFilePreviews[index]||'');setEditFiles(v=>v.filter((_,i)=>i!==index));setEditFilePreviews(v=>v.filter((_,i)=>i!==index));};
 const hasEditChanges=useMemo(()=>{if(!editing)return false;return editTitle.trim()!==editing.title||editContent.trim()!==(editing.content||'')||editPrice!==(editing.price_iqd==null?'':String(editing.price_iqd))||editCity!==(editing.city||'هەولێر')||JSON.stringify(editListing)!==JSON.stringify(editing.listing_details||{})||JSON.stringify(editImages)!==JSON.stringify(Array.isArray(editing.images)?editing.images:[])||editFiles.length>0;},[editing,editTitle,editContent,editPrice,editCity,editListing,editImages,editFiles]);
 const closeEditor=()=>{if(busyId)return;if(hasEditChanges&&!window.confirm('گۆڕانکارییەکان پاشەکەوت نەکراون. دڵنیایت دەتەوێت دەستکارییەکە دابخەیت؟'))return;editFilePreviews.forEach(URL.revokeObjectURL);setEditing(null);setEditFiles([]);setEditFilePreviews([])};
 const saveEdit=async()=>{if(!editing)return;if(!editTitle.trim())return setMessage('سەردێڕ پڕ بکەرەوە.');if(editPrice&&!/^\d+$/.test(editPrice))return setMessage('نرخ دەبێت تەنها ژمارە بێت.');setBusyId(editing.id);try{let images=[...editImages];for(const [index,file] of editFiles.entries()){const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,'-');const path=editing.author_id+'/posts/'+Date.now()+'-edit-'+index+'-'+safeName;const {error:uploadError}=await supabase.storage.from('products').upload(path,file,{upsert:false,contentType:file.type});if(uploadError)throw uploadError;images.push(supabase.storage.from('products').getPublicUrl(path).data.publicUrl)}const {error}=await supabase.from('posts').update({title:editTitle.trim(),content:editContent.trim()||null,price_iqd:editPrice?Number(editPrice):null,city:editCity.trim()||'هەولێر',images,listing_details:editListing}).eq('id',editing.id);if(error)throw error;editFilePreviews.forEach(URL.revokeObjectURL);setEditing(null);setEditFiles([]);setEditFilePreviews([]);setMessage('پۆستەکە بە تەواوی نوێکرایەوە.');await load()}catch(error:unknown){setMessage(error instanceof Error?error.message:'نوێکردنەوەی پۆست سەرکەوتوو نەبوو.')}finally{setBusyId('')}};

 const changeVisibility=async(post:Post,nextVisibility:'public'|'private')=>{
  setBusyId(post.id);
  const {error}=await supabase.from('posts').update({visibility:nextVisibility}).eq('id',post.id);
  setBusyId('');
  if(error){setMessage(error.message);return;}
  setMessage(nextVisibility==='public'?'پۆستەکە بڵاوکرایەوە.':'پۆستەکە شاردرایەوە.');
  await load();
 };

 const sharePost=async(post:Post)=>{
  const urlObject=new URL(window.location.href);
  urlObject.search='';
  urlObject.searchParams.set('post',post.id);
  urlObject.hash='shakh-posts';
  const url=urlObject.toString();
  try{
   if(navigator.share){await navigator.share({title:post.title,text:post.content||post.title,url});setMessage('پۆستەکە بە سەرکەوتوویی هاوبەش کرا.');}
   else if(navigator.clipboard){await navigator.clipboard.writeText(url);setMessage('لینکی پۆستەکە کۆپی کرا.');}
   else{setMessage('ئامرازێکی هاوبەشکردن لەم وێبگەڕەدا بەردەست نییە.');}
  }catch(error){
   if(error instanceof DOMException&&error.name==='AbortError')return;
   setMessage('نەتوانرا پۆستەکە share بکرێت.');
  }
 };

 const deletePost=async(post:Post)=>{
  if(!window.confirm('دڵنیایت لە سڕینەوەی ئەم پۆستە؟'))return;
  setBusyId(post.id);
  const {error}=await supabase.from('posts').delete().eq('id',post.id);
  setBusyId('');
  if(error){setMessage(error.message);return;}
  setPosts(current=>current.filter(item=>item.id!==post.id));
  setMessage('پۆستەکە سڕایەوە.');
 };

 const moderate=async(post:Post,nextStatus:'approved'|'rejected',reasonOverride='')=>{
  if(!isAdmin)return;
  const reason=reasonOverride.trim();
  if(nextStatus==='rejected'&&!reason)return;
  setBusyId(post.id);
  const {error}=await supabase.from('posts').update({
   status:nextStatus,
   rejection_reason:nextStatus==='rejected'?reason:null,
   visibility:nextStatus==='approved'?'public':post.visibility
  }).eq('id',post.id);
  setBusyId('');
  if(error){setMessage(error.message);return;}
  setRejectingPost(null);
  setRejectReason('');
  setMessage(nextStatus==='approved'?'پۆستەکە پەسەند کرا.':'پۆستەکە ڕەتکرایەوە.');
  await load();
 };

 const openReject=({post}:{post:Post})=>{
  if(!isAdmin||busyId===post.id)return;
  setRejectReason('');
  setRejectingPost(post);
 };

 return <section id="shakh-post-management" className="orderCard postsManagement" style={{marginTop:18}}>
  <div className="postsManagementHead">
   <div>
    <span className="eyebrow">بەڕێوەبردنی پۆست</span>
    <h3 style={{margin:'6px 0 3px'}}>{isAdmin?'بەڕێوەبردنی هەموو پۆستەکان':'پۆستەکانی من'}</h3>
    <small>{isAdmin?'پشکنین و پەسەندکردنی پۆستەکان':'دەستکاری و کۆنترۆڵی پۆستەکانت'}</small>
   </div>
   <button type="button" className="plain" onClick={refreshPosts} disabled={loading||!!busyId} aria-label="نوێکردنەوەی پۆستەکان"><RefreshCw size={17}/></button>
  </div>

  <div className="postsManagementStats">
   <span>هەموو: <b>{posts.length}</b></span>
   <span>بڵاوکراوە: <b>{posts.filter(p=>p.status==='approved'&&p.visibility==='public').length}</b></span>
   <span>چاوەڕوان: <b>{posts.filter(p=>p.status==='pending').length}</b></span>
   <span>شاراوە: <b>{posts.filter(p=>p.visibility!=='public').length}</b></span>
  </div>

  <div className="postsManagementTools">
   <div className="postsSearch"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="گەڕان لە پۆستەکان..." aria-label="گەڕان لە پۆستەکان"/>{query&&<button type="button" className="postsSearchClear" onClick={()=>setQuery('')} aria-label="پاککردنەوەی گەڕان"><X size={15}/></button>}</div>
   <div className="postsFilters">
    {isAdmin&&<select value={roleFilter} onChange={e=>setRoleFilter(e.target.value)} aria-label="فلتەری ڕۆڵ">
     {ROLE_FILTERS.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}
    </select>}
    {STATUS_FILTERS.map(item=><button key={item.value} type="button" className={statusFilter===item.value?'active':''} onClick={()=>setStatusFilter(item.value)}>{item.label} ({filterCount(item.value)})</button>)}
   </div>
  </div>

  {loading?<div className="empty"><RefreshCw size={36}/><h3>پۆستەکان بار دەکرێن...</h3></div>:
   !pageItems.length?<div className="empty"><ShieldAlert size={36}/><h3>هیچ پۆستێک نییە</h3><p>لەگەڵ فلتەر و گەڕانەکەت پۆستێک نەدۆزرایەوە.</p></div>:
   <div className="postsManagementList">{pageItems.map(post=>{
    const img=imageOf(post.images);
    const disabled=busyId===post.id;
    return <article className="postsManagementItem" id={'managed-post-'+post.id} key={post.id}>
     <div className="postsManagementImage">{img?<img src={img} alt={post.title} loading="lazy" decoding="async"/>:<span>{labelOf(post).slice(0,1)}</span>}</div>
     <div className="postsManagementBody">
      <div className="postsManagementMeta"><span>{labelOf(post)}</span><small>{new Date(post.created_at).toLocaleString('ku-IQ')}</small>{updatedLabel(post)&&<small>{updatedLabel(post)}</small>}</div>
      <h4>{post.title}</h4>
      {post.content&&<p>{post.content}</p>}
      <div className="postsManagementStatus">
       <b className={post.status==='approved'?'ok':post.status==='rejected'?'bad':'wait'}>{post.status==='approved'?'پەسەندکراو':post.status==='rejected'?'ڕەتکراوە':'چاوەڕوان'}</b>
       <small>{post.visibility==='public'?'بڵاوکراوە':'شاراوە'}</small>
       {post.publisher_name&&<small>{post.publisher_name}</small>}
      </div>
      {post.rejection_reason&&<small className="postsManagementReason">هۆکاری ڕەتکردنەوە: {post.rejection_reason}</small>}
      {post.price_iqd!=null&&<strong className="postsManagementPrice">{Number(post.price_iqd).toLocaleString('en-US')} د.ع</strong>}
      <div className="postsManagementActions">
       <button type="button" onClick={()=>startEdit(post)} disabled={disabled}><Edit3 size={15}/> دەستکاری</button>
       <button type="button" onClick={()=>void sharePost(post)} disabled={disabled}><Share2 size={15}/> هاوبەشکردن</button>
       {post.visibility==='public'
        ?<button type="button" onClick={()=>void changeVisibility(post,'private')} disabled={disabled}><EyeOff size={15}/> شارکردنەوە</button>
        :<button type="button" onClick={()=>void changeVisibility(post,'public')} disabled={disabled}><Eye size={15}/> بڵاوکردنەوە</button>}
       {isAdmin&&post.status==='pending'&&<><button type="button" onClick={()=>void moderate(post,'approved')} disabled={disabled}><CheckCircle2 size={15}/> پەسەند</button><button type="button" onClick={()=>openReject({post})} disabled={disabled}><ShieldAlert size={15}/> ڕەتکردنەوە</button></>}
       <button type="button" className="danger" onClick={()=>void deletePost(post)} disabled={disabled}><Trash2 size={15}/> سڕینەوە</button>
      </div>
     </div>
    </article>;
   })}</div>}

  {filtered.length>pageSize&&<div className="postsPagination"><button type="button" disabled={currentPage<=1} onClick={()=>setPage(value=>Math.max(1,value-1))}>پێشوو</button><span>{currentPage} / {totalPages}</span><button type="button" disabled={currentPage>=totalPages} onClick={()=>setPage(value=>Math.min(totalPages,value+1))}>دواتر</button></div>}
  {message&&<div className="msg postsManagementMessage" role="status" aria-live="polite">{message}</div>}

  {rejectingPost&&<div className="postsRejectBackdrop" role="presentation" onClick={()=>{if(busyId)return;setRejectingPost(null);setRejectReason('')}}>
   <div className="postsRejectDialog" role="dialog" aria-modal="true" aria-labelledby="posts-reject-title" onClick={event=>event.stopPropagation()}>
    <div className="postsEditDialogHead">
     <div>
      <span className="eyebrow">بەڕێوەبردنی پۆست</span>
      <h2 id="posts-reject-title">ڕەتکردنەوەی پۆست</h2>
      <p>تکایە هۆکارەکە بنووسە بۆ ئەوەی بۆ بڵاوکەرەوەکە ڕوون بێت.</p>
     </div>
     <button type="button" className="postsEditClose" onClick={()=>{setRejectingPost(null);setRejectReason('')}} aria-label="داخستن"><X size={18}/></button>
    </div>
    <div className="postsRejectTarget"><strong>{rejectingPost.title}</strong><small>{labelOf(rejectingPost)} · {rejectingPost.publisher_name||'بڵاوکەرەوە'}</small></div>
    <label className="postsEditField">هۆکاری ڕەتکردنەوە
     <textarea rows={5} maxLength={300} value={rejectReason} onChange={e=>setRejectReason(e.target.value)} placeholder="نموونە: زانیاریی نرخ یان وێنە تەواو نییە..." autoFocus aria-describedby="reject-reason-count"/>
     <small id="reject-reason-count">{rejectReason.length}/300</small>
    </label>
    <div className="postsEditDialogFoot">
     <small className={rejectReason.trim()?'postsEditDirty':'postsEditSaved'}>{rejectReason.trim()?'هۆکار ئامادەیە':'هۆکار پێویستە'}</small>
     <button type="button" className="plain postsEditCancel" onClick={()=>{setRejectingPost(null);setRejectReason('')}} disabled={busyId===rejectingPost.id}>پاشگەزبوونەوە</button>
     <button type="button" className="primary postsEditSave postsRejectSubmit" disabled={busyId===rejectingPost.id||!rejectReason.trim()} onClick={()=>void moderate(rejectingPost,'rejected',rejectReason)}>{busyId===rejectingPost.id?'ڕەتکردنەوە دەکرێت...':'ڕەتکردنەوەی پۆست'}</button>
    </div>
   </div>
  </div>}
 
  {editing&&<div className="postsEditBackdrop" role="presentation" onClick={closeEditor}>
   <div className="postsEditDialog postsEditDialogWide" role="dialog" aria-modal="true" aria-labelledby="posts-edit-title" onClick={event=>event.stopPropagation()}>
    <div className="postsEditDialogHead"><div><span className="eyebrow">دەستکاریکردن</span><h2 id="posts-edit-title">نوێکردنەوەی پۆست</h2><p>ناوەڕۆک، نرخ، زانیاریی structured و وێنەکانت نوێ بکەرەوە.</p></div><button type="button" className="postsEditClose" onClick={closeEditor} aria-label="داخستن"><X size={18}/></button></div>
    <div className="postsEditGallery">{editImages[editGalleryIndex]?<img src={editImages[editGalleryIndex]} alt={editing.title}/>:<div className="postsEditGalleryEmpty">هیچ وێنەیەک نییە</div>}{editImages.length>1&&<div className="postsEditThumbs">{editImages.map((src,index)=><button key={src} type="button" className={editGalleryIndex===index?'active':''} onClick={()=>setEditGalleryIndex(index)}><img src={src} alt=""/><i>{index+1}</i></button>)}</div>}</div>
    <div className="postsEditFields"><div className="postsEditGrid"><label className="postsEditField">سەردێڕ<input maxLength={120} autoFocus value={editTitle} onChange={e=>setEditTitle(e.target.value)}/><small>{editTitle.length}/120</small></label><label className="postsEditField">شار<select value={editCity} onChange={e=>setEditCity(e.target.value)}><option key="هەولێر" value="هەولێر">هەولێر</option><option key="سلێمانی" value="سلێمانی">سلێمانی</option><option key="دهۆک" value="دهۆک">دهۆک</option><option key="کەرکووک" value="کەرکووک">کەرکووک</option><option key="بەغدا" value="بەغدا">بەغدا</option><option key="مووسڵ" value="مووسڵ">مووسڵ</option><option key="کەربەلا" value="کەربەلا">کەربەلا</option><option key="نەجەف" value="نەجەف">نەجەف</option><option key="بەسرە" value="بەسرە">بەسرە</option><option key="ئەنبار" value="ئەنبار">ئەنبار</option><option key="دیالە" value="دیالە">دیالە</option><option key="واسط" value="واسط">واسط</option><option key="میسان" value="میسان">میسان</option><option key="ذی قار" value="ذی قار">ذی قار</option><option key="قادسیە" value="قادسیە">قادسیە</option><option key="مثنی" value="مثنی">مثنی</option><option key="بابل" value="بابل">بابل</option><option key="صلاحەدین" value="صلاحەدین">صلاحەدین</option></select></label></div>
     <label className="postsEditField">ناوەڕۆک<textarea rows={5} maxLength={1200} value={editContent} onChange={e=>setEditContent(e.target.value)}/><small>{editContent.length}/1200</small></label>
     <div className="postsEditGrid"><label className="postsEditField">نرخ بە د.ع<input inputMode="numeric" maxLength={14} value={editPrice} onChange={e=>setEditPrice(e.target.value.replace(/[^0-9]/g,''))}/></label><label className="postsEditField">لێبل<input value={labelOf(editing)} readOnly/></label></div></div>
    ${editing.post_type==='fashion'&&<div className="postsEditStructured"><h4>👕 زانیاری جلوبەرگ</h4><div className="postsEditGrid">
      <label className="postsEditField">بۆ کێیە؟<input value={String(editListing.audience||'')} onChange={e=>setEditSpec('audience',e.target.value)}/></label>
      <label className="postsEditField">جۆری جلوبەرگ<input value={String(editListing.clothing_type||'')} onChange={e=>setEditSpec('clothing_type',e.target.value)}/></label>
      <label className="postsEditField">قەبارە<input value={String(editListing.size||'')} onChange={e=>setEditSpec('size',e.target.value)}/></label>
      <label className="postsEditField">ڕەنگ<input value={String(editListing.color||'')} onChange={e=>setEditSpec('color',e.target.value)}/></label>
      <label className="postsEditField">پێلاو<input inputMode="numeric" value={String(editListing.shoe_size||'')} onChange={e=>setEditSpec('shoe_size',e.target.value.replace(/\\D/g,''))}/></label>
      <label className="postsEditField">حاڵەت<input value={String(editListing.condition||'')} onChange={e=>setEditSpec('condition',e.target.value)}/></label>
      <label className="postsEditField">براند<input value={String(editListing.brand||'')} onChange={e=>setEditSpec('brand',e.target.value)}/></label>
    </div></div>}
    ${editing.post_type==='car'&&<div className="postsEditStructured"><h4>🚗 SHAKH Cars</h4><div className="postsEditGrid"><label className="postsEditField">make<input value={String(editListing['make']??'')} onChange={e=>setEditSpec('make',e.target.value)}/></label><label className="postsEditField">model<input value={String(editListing['model']??'')} onChange={e=>setEditSpec('model',e.target.value)}/></label><label className="postsEditField">year<input value={String(editListing['year']??'')} onChange={e=>setEditSpec('year',e.target.value)}/></label><label className="postsEditField">trim<input value={String(editListing['trim']??'')} onChange={e=>setEditSpec('trim',e.target.value)}/></label><label className="postsEditField">mileage<input value={String(editListing['mileage']??'')} onChange={e=>setEditSpec('mileage',e.target.value)}/></label><label className="postsEditField">engine<input value={String(editListing['engine']??'')} onChange={e=>setEditSpec('engine',e.target.value)}/></label><label className="postsEditField">body_type<input value={String(editListing['body_type']??'')} onChange={e=>setEditSpec('body_type',e.target.value)}/></label><label className="postsEditField">fuel<input value={String(editListing['fuel']??'')} onChange={e=>setEditSpec('fuel',e.target.value)}/></label><label className="postsEditField">transmission<input value={String(editListing['transmission']??'')} onChange={e=>setEditSpec('transmission',e.target.value)}/></label><label className="postsEditField">drivetrain<input value={String(editListing['drivetrain']??'')} onChange={e=>setEditSpec('drivetrain',e.target.value)}/></label><label className="postsEditField">color<input value={String(editListing['color']??'')} onChange={e=>setEditSpec('color',e.target.value)}/></label><label className="postsEditField">condition<input value={String(editListing['condition']??'')} onChange={e=>setEditSpec('condition',e.target.value)}/></label><label className="postsEditField">origin<input value={String(editListing['origin']??'')} onChange={e=>setEditSpec('origin',e.target.value)}/></label><label className="postsEditField">plate_status<input value={String(editListing['plate_status']??'')} onChange={e=>setEditSpec('plate_status',e.target.value)}/></label></div><div className="postsEditToggles"><label><input type="checkbox" checked={Boolean(editListing.negotiable)} onChange={e=>setEditSpec('negotiable',e.target.checked)}/> نرخ دانوستاندن هەیە</label><label><input type="checkbox" checked={Boolean(editListing.exchange_allowed)} onChange={e=>setEditSpec('exchange_allowed',e.target.checked)}/> گۆڕین/ئەکسچێنج قبوڵە</label></div></div>}
    <div className="postsEditStructured"><h4>📸 زیادکردنی وێنە</h4><label className="postsEditUpload"><input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={e=>chooseEditFiles(e.target.files)}/><span>{editFiles.length?'زیادکردنی وێنە: '+editFiles.length:'تا ٨ وێنەی تر زیاد بکە'}</span></label>{editFilePreviews.length>0&&<div className="postsEditNewThumbs">{editFilePreviews.map((src,index)=><div key={src}><img src={src} alt=""/><button type="button" onClick={()=>removeEditFile(index)}><X size={14}/></button></div>)}</div>}</div>
    <div className="postsEditDialogFoot"><small className={hasEditChanges?'postsEditDirty':'postsEditSaved'}>{hasEditChanges?'گۆڕانکاریی هەیە':'هیچ گۆڕانکارییەکی تازە نییە'}</small><button type="button" className="plain postsEditCancel" onClick={closeEditor} disabled={busyId===editing.id}>پاشگەزبوونەوە</button><button type="button" className="primary postsEditSave" disabled={busyId===editing.id||!hasEditChanges} onClick={()=>void saveEdit()}>{busyId===editing.id?'پاشەکەوت دەکرێت...':'پاشەکەوتکردنی گۆڕانکارییەکان'}</button></div>
   </div>
  </div>}</section>;
}
