import React,{useEffect,useMemo,useState} from 'react';
import {CheckCircle2,Edit3,Eye,EyeOff,RefreshCw,Search,ShieldAlert,Trash2,X} from 'lucide-react';
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
 updated_at?:string;
 publisher_name?:string|null;
 post_type?:string|null;
 publisher_role?:string|null;
 label?:string|null;
 rejection_reason?:string|null;
 visibility:string;
};

const FILTERS=[
 {value:'all',label:'هەموو'},
 {value:'public',label:'بڵاوکراوە'},
 {value:'private',label:'شاراوە'},
 {value:'pending',label:'چاوەڕوانی پەسەندکردن'},
 {value:'rejected',label:'ڕەتکراوە'}
];

const postLabel=(p:Post)=>p.label||({
 food:'خواردنگە',fashion:'جلوبەرگ',marketplace:'بازاڕ',car:'ئۆتۆمبێل',
 umrah:'عومرە',delivery:'گەیاندن',announcement:'ئاگاداری',support:'پشتگیری'
 } as Record<string,string>)[p.post_type||'']||'گشتی';

const imageOf=(images:unknown)=>{
 if(Array.isArray(images)&&typeof images[0]==='string')return String(images[0]);
 return '';
};

export default function PostsManagement({userId,role}:Props){
 const isAdmin=role==='admin'||role==='super_admin';
 const [posts,setPosts]=useState<Post[]>([]);
 const [loading,setLoading]=useState(true);
 const [busyId,setBusyId]=useState('');
 const [message,setMessage]=useState('');
 const [query,setQuery]=useState('');
 const [filter,setFilter]=useState('all');
 const [page,setPage]=useState(1);\n const pageSize=12;\n const [editing,setEditing]=useState<Post|null>(null);
 const [editTitle,setEditTitle]=useState('');
 const [editContent,setEditContent]=useState('');
 const [editPrice,setEditPrice]=useState('');
 const [editCity,setEditCity]=useState('');
 
 const load=async()=>{
  setLoading(true);
  let request=supabase.from('posts')
   .select('id,author_id,title,content,images,price_iqd,city,status,created_at,updated_at,publisher_name,post_type,publisher_role,label,rejection_reason,visibility')
   .order('created_at',{ascending:false})
   .limit(200);
  if(!isAdmin)request=request.eq('author_id',userId);
  const {data,error}=await request;
  if(error){setMessage('نەتوانرا پۆستەکان وەرگیرێن.');setLoading(false);return;}
  setPosts((data||[]) as Post[]);
  setMessage('');
  setLoading(false);
 };

 useEffect(()=>{\n  void load();\n  const channel=supabase.channel('shakh-post-management-'+userId)\n   .on('postgres_changes',{event:'*',schema:'public',table:'posts'},()=>{void load()})\n   .subscribe();\n  return()=>{void supabase.removeChannel(channel)};\n },[userId,role]);

 const visible=useMemo(()=>{
  const q=query.trim().toLowerCase();
  return posts.filter(p=>{
   const matchesFilter=filter==='all'
    || (filter==='public'&&p.visibility==='public'&&p.status==='approved')
    || (filter==='private'&&p.visibility!=='public')
    || (filter==='pending'&&p.status==='pending')
    || (filter==='rejected'&&p.status==='rejected');
   const hay=[p.title,p.content,p.publisher_name,p.city,postLabel(p)].filter(Boolean).join(' ').toLowerCase();
   return matchesFilter&&(!q||hay.includes(q));
  });
 },[posts,filter,query]);

 const startEdit=(p:Post)=>{
  setEditing(p);
  setEditTitle(p.title);
  setEditContent(p.content||'');
  setEditPrice(p.price_iqd==null?'':String(p.price_iqd));
  setEditCity(p.city||'هەولێر');
  setMessage('');
 };

 const saveEdit=async()=>{
  if(!editing)return;
  if(!editTitle.trim())return setMessage('سەردێڕ پڕ بکەرەوە.');
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

 const setVisibility=async(p:Post,visibility:'public'|'private')=>{
  setBusyId(p.id);
  const {error}=await supabase.from('posts').update({visibility}).eq('id',p.id);
  setBusyId('');
  if(error){setMessage(error.message);return;}
  setMessage(visibility==='public'?'پۆستەکە بڵاوکرایەوە.':'پۆستەکە شاردرایەوە.');
  await load();
 };

 const deletePost=async(p:Post)=>{
  if(!window.confirm('دڵنیایت لە سڕینەوەی ئەم پۆستە؟ ئەم کردارە گەڕانەوەی نییە.'))return;
  setBusyId(p.id);
  const {error}=await supabase.from('posts').delete().eq('id',p.id);
  setBusyId('');
  if(error){setMessage(error.message);return;}
  setPosts(x=>x.filter(item=>item.id!==p.id));
  setMessage('پۆستەکە سڕایەوە.');
 };

 const moderate=async(p:Post,nextStatus:'approved'|'rejected')=>{
  if(!isAdmin)return;
  const reason=nextStatus==='rejected'
   ? window.prompt('هۆکاری ڕەتکردنەوە بنووسە:')||''
   : '';
  if(nextStatus==='rejected'&&!reason.trim())return;
  setBusyId(p.id);
  const {error}=await supabase.from('posts').update({
   status:nextStatus,
   rejection_reason:nextStatus==='rejected'?reason.trim():null,
   visibility:nextStatus==='approved'?'public':p.visibility
  }).eq('id',p.id);
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
    <small>{isAdmin?'پشکنین، پەسەندکردن و بەڕێوەبردنی پۆستەکانی بەکارهێنەران':'دەستکاریکردن و کۆنترۆڵکردنی پۆستەکانت'}</small>
   </div>
   <button type="button" className="plain" onClick={()=>void load()} disabled={loading}><RefreshCw size={17}/></button>
  </div>

  <div className="postsManagementTools">
   <div className="postsSearch"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="گەڕان لە پۆستەکان..."/></div>
   <div className="postsFilters">{FILTERS.map(f=><button key={f.value} type="button" className={filter===f.value?'active':''} onClick={()=>setFilter(f.value)}>{f.label}</button>)}</div>
  </div>

  {loading?<div className="empty"><RefreshCw size={36}/><h3>پۆستەکان بار دەکرێن...</h3></div>:
   !visible.length?<div className="empty"><ShieldAlert size={36}/><h3>هیچ پۆستێک نییە</h3><p>پۆستە گونجاوەکان لەگەڵ گەڕان و فلتەرەکەت دەردەکەون.</p></div>:
   <div className="postsManagementList">{pageItems.map(p=>{
    const img=imageOf(p.images);
    const disabled=busyId===p.id;
    return <article className="postsManagementItem" key={p.id}>
     <div className="postsManagementImage">{img?<img src={img} alt={p.title}/>:<span>{postLabel(p).slice(0,1)}</span>}</div>
     <div className="postsManagementBody">
      <div className="postsManagementMeta"><span>{postLabel(p)}</span><small>{new Date(p.created_at).toLocaleString('ku-IQ')}</small></div>
      <h4>{p.title}</h4>
      {p.content&&<p>{p.content}</p>}
      <div className="postsManagementStatus">
       <b className={p.status==='approved'?'ok':p.status==='rejected'?'bad':'wait'}>{p.status==='approved'?'پەسەندکراو':p.status==='rejected'?'ڕەتکراوە':'چاوەڕوان'}</b>
       <small>{p.visibility==='public'?'بڵاوکراوە':'شاراوە'}</small>
       {p.publisher_name&&<small>{p.publisher_name}</small>}
      </div>
      {p.rejection_reason&&<small className="postsManagementReason">هۆکاری ڕەتکردنەوە: {p.rejection_reason}</small>}
      {p.price_iqd!=null&&<strong className="postsManagementPrice">{Number(p.price_iqd).toLocaleString('en-US')} د.ع</strong>}
      <div className="postsManagementActions">
       <button type="button" onClick={()=>startEdit(p)} disabled={disabled}><Edit3 size={15}/> دەستکاری</button>
       {p.visibility==='public'
        ?<button type="button" onClick={()=>void setVisibility(p,'private')} disabled={disabled}><EyeOff size={15}/> شارکردنەوە</button>
        :<button type="button" onClick={()=>void setVisibility(p,'public')} disabled={disabled}><Eye size={15}/> بڵاوکردنەوە</button>}
       {isAdmin&&p.status==='pending'&&<><button type="button" onClick={()=>void moderate(p,'approved')} disabled={disabled}><CheckCircle2 size={15}/> پەسەند</button><button type="button" onClick={()=>void moderate(p,'rejected')} disabled={disabled}><ShieldAlert size={15}/> ڕەتکردنەوە</button></>}
       <button type="button" className="danger" onClick={()=>void deletePost(p)} disabled={disabled}><Trash2 size={15}/> سڕینەوە</button>
      </div>
     </div>
    </article>
   })}</div>
  }
  {visible.length>pageSize&&<div className="postsPagination"><button type="button" disabled={currentPage<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>پێشوو</button><span>{currentPage} / {totalPages}</span><button type="button" disabled={currentPage>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}>دواتر</button></div>}\n  {message&&<div className="msg postsManagementMessage">{message}</div>}

  {editing&&<div className="modal"><div className="auth" style={{maxWidth:620}}>
   <button type="button" className="x" onClick={()=>setEditing(null)}><X size={18}/></button>
   <div className="mark"><Edit3 size={20}/></div>
   <h2>دەستکاریکردنی پۆست</h2>
   <p>زانیاریی پۆستەکە بگۆڕە و پاشان پاشەکەوتی بکە.</p>
   <label>سەردێڕ<input value={editTitle} onChange={e=>setEditTitle(e.target.value)} /></label>
   <label>ناوەڕۆک<textarea rows={5} value={editContent} onChange={e=>setEditContent(e.target.value)} /></label>
   <div className="postsEditGrid">
    <label>نرخ بە د.ع<input inputMode="numeric" value={editPrice} onChange={e=>setEditPrice(e.target.value.replace(/[^0-9]/g,''))}/></label>
    <label>شار<input value={editCity} onChange={e=>setEditCity(e.target.value)}/></label>
   </div>
   <button type="button" className="primary full" disabled={busyId===editing.id} onClick={()=>void saveEdit()}>{busyId===editing.id?'پاشەکەوت دەکرێت...':'پاشەکەوتکردن'}</button>
  </div></div>}
 </section>;
}
