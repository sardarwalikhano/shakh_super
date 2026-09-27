import React,{useEffect,useMemo,useState} from 'react';
import {Filter,RefreshCw,Image as ImageIcon,Tag,UserRound} from 'lucide-react';
import {supabase} from '../lib/supabase';

type Post={
 id:string;author_id:string;title:string;content?:string|null;images?:unknown;price_iqd?:number|null;
 city?:string|null;status:string;created_at:string;publisher_name?:string|null;
 post_type?:string|null;publisher_role?:string|null;label?:string|null;visibility:string;
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

const labelFor=(type?:string|null,label?:string|null)=>{
 if(label)return label;
 return TYPES.find(x=>x.value===type)?.label||'گشتی';
};

function postImage(images:unknown){
 if(Array.isArray(images)&&images.length&&typeof images[0]==='string')return images[0] as string;
 return null;
}

export default function PostsFeed(){
 const [posts,setPosts]=useState<Post[]>([]);
 const [filter,setFilter]=useState('all');
 const [loading,setLoading]=useState(true);
 const [message,setMessage]=useState('');

 const load=async()=>{
  setLoading(true);
  const {data,error}=await supabase
   .from('posts')
   .select('id,author_id,title,content,images,price_iqd,city,status,created_at,publisher_name,post_type,publisher_role,label,visibility')
   .order('created_at',{ascending:false})
   .limit(100);
  if(error){setMessage('نەتوانرا پۆستەکان وەرگیرێن.');setLoading(false);return;}
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

 const filtered=useMemo(()=>filter==='all'?posts:posts.filter(p=>p.post_type===filter),[posts,filter]);

 return <section className="section" id="shakh-posts">
  <div className="title">
   <span>پۆستەکانی شاخ</span>
   <h2>پۆستە نوێکان و پیشەییەکان</h2>
  </div>

  <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center',marginBottom:16}}>
   <Filter size={18}/>
   {TYPES.map(t=><button key={t.value} type="button" onClick={()=>setFilter(t.value)}
    style={{border:filter===t.value?'2px solid #ff6a00':'1px solid #e7ecf2',background:filter===t.value?'#fff4ea':'#fff',borderRadius:999,padding:'8px 14px',fontWeight:800,color:'#081a33'}}>
    {t.label}
   </button>)}
   <button type="button" className="plain" onClick={()=>void load()} disabled={loading}><RefreshCw size={17}/></button>
  </div>

  {loading&&!posts.length?<div className="empty"><RefreshCw size={38}/><h3>پۆستەکان بار دەکرێن...</h3></div>:
   !filtered.length?<div className="empty"><Tag size={40}/><h3>هیچ پۆستێک نەدۆزرایەوە</h3><p>{filter==='all'?'هێشتا پۆستێک بڵاونەکراوەتەوە.':'لەو بەشەدا پۆستێک نییە.'}</p></div>:
   <div className="grid">{filtered.map(p=>{
    const img=postImage(p.images);
    return <article className="card" key={p.id}>
     <div className="pic">{img?<img src={img} alt={p.title}/>:<ImageIcon size={42}/>}</div>
     <div className="body">
      <div style={{display:'flex',justifyContent:'space-between',gap:8,alignItems:'center'}}>
       <small>{labelFor(p.post_type,p.label)}</small>
       <small>{p.city||'هەولێر'}</small>
      </div>
      <h3>{p.title}</h3>
      {p.content&&<p style={{margin:'6px 0',lineHeight:1.7}}>{p.content}</p>}
      <small style={{display:'flex',gap:6,alignItems:'center'}}><UserRound size={14}/>{p.publisher_name||'بڵاوکەرەوە'}</small>
      {p.price_iqd!=null&&<div className="buy"><b>{Number(p.price_iqd).toLocaleString('en-US')} د.ع</b></div>}
     </div>
    </article>;
   })}</div>
  }
  {message&&<div className="msg" style={{marginTop:10}}>{message}</div>}
 </section>;
}