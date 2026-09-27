import React,{useEffect,useMemo,useState} from 'react';
import {CheckCircle2,Edit3,Eye,EyeOff,RefreshCw,Search,Share2,ShieldAlert,Trash2,X} from 'lucide-react';
import {supabase} from '../lib/supabase';

type Props={userId:string;role:string};

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

export default function PostsManagement({userId,role}:Props){
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
 const pageSize=12;

 const load=async()=>{
  setLoading(true);
  let builder=supabase
   .from('posts')
   .select('id,author_id,title,content,images,price_iqd,city,status,created_at,updated_at,publisher_name,post_type,publisher_role,label,rejection_reason,visibility')
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

 const filterCount=(value:string)=>posts.filter(post=>value==='all'||(value==='public'&&post.status==='approved'&&post.visibility==='public')||(value==='private'&&post.visibility!=='public')||(value==='pending'&&post.status==='pending')||(value==='rejected'&&post.status==='rejected')).length;

 const totalPages=Math.max(1,Math.ceil(filtered.length/pageSize));
 const currentPage=Math.min(page,totalPages);
 const pageItems=filtered.slice((currentPage-1)*pageSize,currentPage*pageSize);

 useEffect(()=>{setPage(1)},[statusFilter,roleFilter,query]);

 const startEdit=(post:Post)=>{
  setEditing(post);
  setEditTitle(post.title);
  setEditContent(post.content||'');
  setEditPrice(post.price_iqd==null?'':String(post.price_iqd));
  setEditCity(post.city||'هەولێر');
  setMessage('');
 };

 const saveEdit=async()=>{
  if(!editing)return;
  if(!editTitle.trim())return setMessage('سەردێڕ پڕ بکەرەوە.');
  if(editPrice&&!/^\d+$/.test(editPrice))return setMessage('نرخ دەبێت تەنها ژمارە بێت.');
  setBusyId(editing.id);
  const {error}=await supabase.from('posts').update({
   title:editTitle.trim(),
   content:editContent.trim()||null,
   price_iqd:editPrice?Number(editPrice):null,
   city:editCity.trim()||'هەولێر'
  }).eq('id',editing.id);
  setBusyId('');
  if(error){setMessage(error.message);return;}
  setEditing(null);
  setMessage('پۆستەکە نوێکرایەوە.');
  await load();
 };

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
   if(navigator.share){await navigator.share({title:post.title,text:post.content||post.title,url});}
   else{await navigator.clipboard.writeText(url);setMessage('لینکی پۆستەکە کۆپی کرا.');}
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

 const moderate=async(post:Post,nextStatus:'approved'|'rejected')=>{
  if(!isAdmin)return;
  let reason='';
  if(nextStatus==='rejected'){
   reason=window.prompt('هۆکاری ڕەتکردنەوە بنووسە:')||'';
   if(!reason.trim())return;
  }
  setBusyId(post.id);
  const {error}=await supabase.from('posts').update({
   status:nextStatus,
   rejection_reason:nextStatus==='rejected'?reason.trim():null,
   visibility:nextStatus==='approved'?'public':post.visibility
  }).eq('id',post.id);
  setBusyId('');
  if(error){setMessage(error.message);return;}
  setMessage(nextStatus==='approved'?'پۆستەکە پەسەند کرا.':'پۆستەکە ڕەتکرایەوە.');
  await load();
 };

 return <section className="orderCard postsManagement" style={{marginTop:18}}>
  <div className="postsManagementHead">
   <div>
    <span className="eyebrow">بەڕێوەبردنی پۆست</span>
    <h3 style={{margin:'6px 0 3px'}}>{isAdmin?'بەڕێوەبردنی هەموو پۆستەکان':'پۆستەکانی من'}</h3>
    <small>{isAdmin?'پشکنین و پەسەندکردنی پۆستەکان':'دەستکاری و کۆنترۆڵی پۆستەکانت'}</small>
   </div>
   <button type="button" className="plain" onClick={()=>void load()} disabled={loading}><RefreshCw size={17}/></button>
  </div>

  <div className="postsManagementStats">
   <span>هەموو: <b>{posts.length}</b></span>
   <span>بڵاوکراوە: <b>{posts.filter(p=>p.status==='approved'&&p.visibility==='public').length}</b></span>
   <span>چاوەڕوان: <b>{posts.filter(p=>p.status==='pending').length}</b></span>
   <span>شاراوە: <b>{posts.filter(p=>p.visibility!=='public').length}</b></span>
  </div>

  <div className="postsManagementTools">
   <div className="postsSearch"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="گەڕان لە پۆستەکان..."/></div>
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
    return <article className="postsManagementItem" key={post.id}>
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
       {isAdmin&&post.status==='pending'&&<><button type="button" onClick={()=>void moderate(post,'approved')} disabled={disabled}><CheckCircle2 size={15}/> پەسەند</button><button type="button" onClick={()=>void moderate(post,'rejected')} disabled={disabled}><ShieldAlert size={15}/> ڕەتکردنەوە</button></>}
       <button type="button" className="danger" onClick={()=>void deletePost(post)} disabled={disabled}><Trash2 size={15}/> سڕینەوە</button>
      </div>
     </div>
    </article>;
   })}</div>}

  {filtered.length>pageSize&&<div className="postsPagination"><button type="button" disabled={currentPage<=1} onClick={()=>setPage(value=>Math.max(1,value-1))}>پێشوو</button><span>{currentPage} / {totalPages}</span><button type="button" disabled={currentPage>=totalPages} onClick={()=>setPage(value=>Math.min(totalPages,value+1))}>دواتر</button></div>}
  {message&&<div className="msg postsManagementMessage" role="status" aria-live="polite">{message}</div>}

  {editing&&<div className="modal" role="dialog" aria-modal="true" aria-label="دەستکاریکردنی پۆست"><div className="auth" style={{maxWidth:620}}>
   <button type="button" className="x" onClick={()=>setEditing(null)}><X size={18}/></button>
   <div className="mark"><Edit3 size={20}/></div>
   <h2>دەستکاریکردنی پۆست</h2>
   <p>زانیاریی پۆستەکە بگۆڕە و پاشەکەوتی بکە.</p>
   {imageOf(editing.images)&&<div className="postsEditImage"><img src={imageOf(editing.images)||''} alt={editing.title}/></div>}
   <label>سەردێڕ<input maxLength={100} value={editTitle} onChange={e=>setEditTitle(e.target.value)}/></label>
   <label>ناوەڕۆک<textarea rows={5} maxLength={500} value={editContent} onChange={e=>setEditContent(e.target.value)}/></label>
   <div className="postsEditGrid">
    <label>نرخ بە د.ع<input inputMode="numeric" maxLength={14} value={editPrice} onChange={e=>setEditPrice(e.target.value.replace(/[^0-9]/g,''))}/></label>
    <label>شار<select value={editCity} onChange={e=>setEditCity(e.target.value)}>{IRAQ_CITIES.map(item=><option key={item} value={item}>{item}</option>)}</select></label>
   </div>
   <button type="button" className="primary full" disabled={busyId===editing.id} onClick={()=>void saveEdit()}>{busyId===editing.id?'پاشەکەوت دەکرێت...':'پاشەکەوتکردن'}</button>
  </div></div>}
 </section>;
}
