import React,{useEffect,useMemo,useState} from 'react';
import {Filter,Image as ImageIcon,MapPin,RefreshCw,Share2,Tag,UserRound,WalletCards} from 'lucide-react';
import {supabase} from '../lib/supabase';

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
 publisher_name?:string|null;
 post_type?:string|null;
 publisher_role?:string|null;
 label?:string|null;
 visibility:string;
};

const TYPES=[
 {value:'all',label:'هەموو'},
 {value:'food',label:'خواردن'},
 {value:'fashion',label:'جلوبەرگ'},
 {value:'marketplace',label:'بازاڕ'},
 {value:'car',label:'ئۆتۆمبێل'},
 {value:'umrah',label:'عومرە'},
 {value:'delivery',label:'گەیاندن'},
 {value:'announcement',label:'ئاگاداری'}
];

const labelFor=(type?:string|null,label?:string|null)=>label||TYPES.find(item=>item.value===type)?.label||'گشتی';

function postImage(images:unknown){
 if(Array.isArray(images)&&images.length&&typeof images[0]==='string')return images[0] as string;
 return null;
}

function isNew(createdAt:string){
 return Date.now()-new Date(createdAt).getTime()<24*60*60*1000;
}

function timeLabel(createdAt:string){
 const diff=Math.max(0,Date.now()-new Date(createdAt).getTime());
 const minutes=Math.floor(diff/60000);
 if(minutes<1)return 'ئێستا';
 if(minutes<60)return `${minutes} خولەک لەمەوبەر`;
 const hours=Math.floor(minutes/60);
 if(hours<24)return `${hours} کاتژمێر لەمەوبەر`;
 const days=Math.floor(hours/24);
 return `${days} ڕۆژ لەمەوبەر`;
}

export default function PostsFeed(){
 const [posts,setPosts]=useState<Post[]>([]);
 const [filter,setFilter]=useState('all');
 const [loading,setLoading]=useState(true);
 const [page,setPage]=useState(1);
 const pageSize=12;
 const [message,setMessage]=useState('');
 const [selectedPost,setSelectedPost]=useState<Post|null>(null);

 const load=async()=>{
  setLoading(true);
  const {data,error}=await supabase
   .from('posts')
   .select('id,author_id,title,content,images,price_iqd,city,status,created_at,publisher_name,post_type,publisher_role,label,visibility')
   .order('created_at',{ascending:false})
   .limit(200);
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
  const channel=supabase.channel('shakh-live-posts')
   .on('postgres_changes',{event:'*',schema:'public',table:'posts'},()=>{void load()})
   .subscribe();
  return()=>{void supabase.removeChannel(channel)};
 },[]);

 const filtered=useMemo(()=>filter==='all'?posts:posts.filter(post=>post.post_type===filter),[posts,filter]);
 const shown=filtered.slice(0,page*pageSize);

 useEffect(()=>{setPage(1)},[filter]);

 return <section className="section postFeed" id="shakh-posts">
  <div className="title postFeedTitle">
   <div>
    <span>پۆستەکانی شاخ</span>
    <h2>نوێترین ناوەڕۆک لە بازاڕی شاخ</h2>
   </div>
   <button type="button" className="plain" onClick={()=>void load()} disabled={loading} aria-label="نوێکردنەوەی پۆستەکان"><RefreshCw size={17}/></button>
  </div>

  <div className="postFeedFilters" role="tablist" aria-label="فلتەری بەشەکان">
   <Filter size={17}/>
   {TYPES.map(item=><button key={item.value} type="button" role="tab" aria-selected={filter===item.value} className={filter===item.value?'active':''} onClick={()=>setFilter(item.value)}>{item.label}</button>)}
  </div>

  {loading&&!posts.length?<div className="postFeedEmpty"><RefreshCw size={35}/><strong>پۆستەکان بار دەکرێن...</strong><small>کەمێک چاوەڕوان بە.</small></div>:
   !filtered.length?<div className="postFeedEmpty"><Tag size={38}/><strong>هیچ پۆستێک نەدۆزرایەوە</strong><small>{filter==='all'?'هێشتا پۆستێکی بڵاوکراوە نییە.':'لەو بەشەدا پۆستێک نییە.'}</small></div>:
   <div className="postFeedGrid">{shown.map(post=>{
    const img=postImage(post.images);
    return <article className="postFeedCard" key={post.id} id={'post-'+post.id} tabIndex={0} role="button" onClick={()=>setSelectedPost(post)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();setSelectedPost(post)}}}>
     <div className="postFeedImage">
      {img?<img src={img} alt={post.title}/>:<ImageIcon size={40}/>}
      <span className="postFeedBadge">{labelFor(post.post_type,post.label)}</span>
      {isNew(post.created_at)&&<span className="postFeedNew">نوێ</span>}
     </div>
     <div className="postFeedBody">
      <div className="postFeedMeta"><span><MapPin size={12}/>{post.city||'هەولێر'}</span><small>{timeLabel(post.created_at)}</small></div>
      <h3>{post.title}</h3>
      {post.content&&<p>{post.content}</p>}
      <div className="postFeedPublisher"><UserRound size={14}/><span>{post.publisher_name||'بڵاوکەرەوە'}</span></div>
      <div className="postFeedFooter">
       {post.price_iqd!=null?<strong><WalletCards size={14}/>{Number(post.price_iqd).toLocaleString('en-US')} د.ع</strong>:<small>بێ نرخ</small>}
       <span>{post.status==='approved'?'پەسەندکراو':'چاوەڕوان'}</span>
      </div>
     </div>
    </article>;
   })}</div>
  }

  {shown.length<filtered.length&&<div className="postFeedMore"><button type="button" className="plain" onClick={()=>setPage(value=>value+1)}>زیاتر پیشاندان</button></div>}
  {message&&<div className="msg postFeedMessage" role="alert">{message}</div>}
  {selectedPost&&<div className="postDetailsBackdrop" role="presentation" onClick={()=>setSelectedPost(null)}>
   <div className="postDetailsModal" role="dialog" aria-modal="true" aria-label={selectedPost.title} onClick={event=>event.stopPropagation()}>
    <button type="button" className="postDetailsClose" onClick={()=>setSelectedPost(null)} aria-label="داخستن"><span>×</span></button>
    <div className="postDetailsImage">{postImage(selectedPost.images)?<img src={postImage(selectedPost.images)||''} alt={selectedPost.title}/>:<ImageIcon size={46}/>}</div>
    <div className="postDetailsBody">
     <div className="postDetailsMeta"><span>{labelFor(selectedPost.post_type,selectedPost.label)}</span><small>{selectedPost.city||'هەولێر'}</small></div>
     <h3>{selectedPost.title}</h3>
     {selectedPost.content&&<p>{selectedPost.content}</p>}
     <div className="postDetailsPublisher"><UserRound size={15}/><span>{selectedPost.publisher_name||'بڵاوکەرەوە'}</span></div>
     {selectedPost.price_iqd!=null&&<strong className="postDetailsPrice"><WalletCards size={15}/>{Number(selectedPost.price_iqd).toLocaleString('en-US')} د.ع</strong>}
     <button type="button" className="primary postDetailsShare" onClick={()=>void sharePost(selectedPost)}><Tag size={15}/> هاوبەشکردنی پۆست</button>
    </div>
   </div>
  </div>}
 </section>;
}
