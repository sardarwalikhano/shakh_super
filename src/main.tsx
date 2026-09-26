import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {createClient,User} from '@supabase/supabase-js';
import {Search,ShoppingBag,User as UserIcon,Bell,Store,Truck,Wallet,ArrowLeft,LogIn,UserPlus,LogOut} from 'lucide-react';
import './styles.css';

const url=import.meta.env.VITE_SUPABASE_URL as string|undefined;
const key=import.meta.env.VITE_SUPABASE_ANON_KEY as string|undefined;
const supabase=url&&key?createClient(url,key):null;

type Product={id:string;name:string;price:number;category?:string;image_url?:string;store_name?:string};
const demo:Product[]=[
{id:'1',name:'کەبابی تایبەت',price:11000,category:'خواردن',store_name:'چێشتخانەی شاخ'},
{id:'2',name:'برگر کلاسیک',price:9000,category:'خواردن',store_name:'ماڵی برگر'},
{id:'3',name:'برنج 5 کیلۆ',price:18000,category:'سوبرمارکێت',store_name:'سوپەری شاخ'},
{id:'4',name:'جاکێتی مۆدێرن',price:42000,category:'جل و بەرگ',store_name:'شاخ فاشن'}];

function PasswordReset(){
 const [password,setPassword]=useState(''); const [confirm,setConfirm]=useState(''); const [message,setMessage]=useState('');
 const update=async()=>{if(!supabase)return setMessage('پەیوەندی بە خزمەتگوزاری بەردەست نییە.'); if(password.length<6)return setMessage('وشەی نهێنی دەبێت لانیکەم ٦ پیت بێت.'); if(password!==confirm)return setMessage('دوو وشەی نهێنی یەکسان نین.'); const {error}=await supabase.auth.updateUser({password}); setMessage(error?.message||'وشەی نهێنی بە سەرکەوتوویی گۆڕدرا.');};
 return <div className="app"><main><div className="auth" style={{margin:'80px auto'}}><div className="mark">شاخ</div><h2>گۆڕینی وشەی نهێنی</h2><p>وشەی نهێنی نوێی خۆت بنووسە.</p><input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="وشەی نهێنی نوێ"/><input value={confirm} onChange={e=>setConfirm(e.target.value)} type="password" placeholder="دووبارە وشەی نهێنی"/><button className="primary full" onClick={update}>گۆڕینی وشەی نهێنی</button>{message&&<small className="msg">{message}</small>}</div></main></div>;
}

function App(){
 const [products,setProducts]=useState<Product[]>(demo); const [search,setSearch]=useState(''); const [cart,setCart]=useState<Product[]>([]); const [auth,setAuth]=useState(false); const [authMode,setAuthMode]=useState<'login'|'signup'>('login'); const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [name,setName]=useState(''); const [message,setMessage]=useState(''); const [user,setUser]=useState<User|null>(null);
 useEffect(()=>{if(!supabase)return; supabase.auth.getSession().then(({data})=>setUser(data.session?.user??null)); const {data:listener}=supabase.auth.onAuthStateChange((_event,session)=>setUser(session?.user??null)); supabase.from('products').select('*').eq('is_available',true).order('created_at',{ascending:false}).then(({data,error})=>{if(!error&&data?.length)setProducts(data as Product[])}); const channel=supabase.channel('shakh-products').on('postgres_changes',{event:'*',schema:'public',table:'products'},()=>{supabase.from('products').select('*').eq('is_available',true).order('created_at',{ascending:false}).then(({data})=>{if(data?.length)setProducts(data as Product[])})}).subscribe(); return()=>{listener.subscription.unsubscribe();supabase.removeChannel(channel)}},[]);
 const filtered=products.filter(p=>p.name.toLowerCase().includes(search.toLowerCase()));
 const login=async()=>{if(!supabase)return setMessage('پەیوەندی بە خزمەتگوزاری بەردەست نییە.'); const {error}=await supabase.auth.signInWithPassword({email,password}); setMessage(error?.message||'بە سەرکەوتوویی چوویتە ژوورەوە.');};
 const signup=async()=>{if(!supabase)return setMessage('پەیوەندی بە خزمەتگوزاری بەردەست نییە.'); if(password.length<6)return setMessage('وشەی نهێنی دەبێت لانیکەم ٦ پیت بێت.'); const {data,error}=await supabase.auth.signUp({email,password,options:{data:{full_name:name}}}); setMessage(error?.message||(data.session?'هەژمارەکەت دروست کرا.':'هەژمارەکەت دروست کرا؛ تکایە ئیمەیڵەکەت پشتڕاست بکەرەوە.'));};
 const google=async()=>{if(!supabase)return setMessage('پەیوەندی بە خزمەتگوزاری بەردەست نییە.'); const {error}=await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo:window.location.origin}}); if(error)setMessage(error.message)};
 const reset=async()=>{if(!supabase||!email)return setMessage('تکایە ئیمەیڵەکەت بنووسە.'); const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin+'/reset-password'}); setMessage(error?.message||'لینکی گۆڕینی وشەی نهێنی بۆ ئیمەیڵەکەت نێردرا.');};
 const signout=async()=>{await supabase?.auth.signOut();setAuth(false);};
 const openCart=()=>{if(user){setMessage('سەلەکەت ئامادەیە؛ هەنگاوی داوات لە وەشانی دواتردا زیاد دەکرێت.');}else{setAuthMode('login');setAuth(true);setMessage('بۆ تەواوکردنی داواکارییەکەت، تکایە بچۆ ژوورەوە یان خۆت تۆمار بکە.');}};
 return <div className="app"><header><div className="nav"><div className="logo"><b>شاخ</b><span>بازاڕی هەموو شت</span></div><div className="search"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="گەڕان لە خواردن، بازاڕ و بەرهەم..."/></div><button className="plain"><Bell/></button><button className="cart" onClick={openCart}><ShoppingBag/><i>{cart.length}</i></button>{user?<button className="loginBtn" onClick={signout}><LogOut size={17}/> دەرچوون</button>:<button className="loginBtn" onClick={()=>{setAuthMode('login');setAuth(true)}}><UserIcon size={17}/> چوونەژوورەوە</button>}</div></header>
 <main><section className="hero"><div><span className="eyebrow">بازاڕی زیندووی شاخ</span><h1>هەموو شتێک،<strong> لە یەک شوێن.</strong></h1><p>خواردن، سوپرمارکێت، جل و بەرگ و پێداویستی ڕۆژانە بە گەیاندنی خێرا.</p><button className="primary">دەستپێبکە <ArrowLeft/></button></div><div className="heroOrb">🛍️</div></section>
 <section className="section"><div className="title"><span>بازاڕی شاخ</span><h2>بەرهەمە بەردەستەکان</h2></div><div className="grid">{filtered.map(p=><article className="card" key={p.id}><div className="pic">{p.image_url?<img src={p.image_url} alt=""/>:<span>🛍️</span>}</div><div className="body"><small>{p.category||'بازاڕ'} · {p.store_name||'شاخ'}</small><h3>{p.name}</h3><div className="buy"><b>{p.price.toLocaleString('en-US')} د.ع</b><button onClick={()=>setCart(c=>[...c,p])}>+ زیادکردن</button></div></div></article>)}</div></section>
 <section className="features"><div><Truck/><b>گەیاندنی خێرا</b><small>بەدواداچوونی ئۆردەر</small></div><div><Store/><b>خاوەن دوکان</b><small>فرۆشتنی ڕاستەوخۆ</small></div><div><Wallet/><b>جزدانی شاخ</b><small>پارە و مامەڵە</small></div></section></main>
 <footer><div className="logo"><b>شاخ</b><span>هەموو شتێک لە یەک شوێن</span></div></footer>
 {auth&&<div className="modal" onClick={()=>setAuth(false)}><div className="auth" onClick={e=>e.stopPropagation()}><button className="x" onClick={()=>setAuth(false)}>×</button><div className="mark">شاخ</div><h2>{authMode==='login'?'بەخێربێیت بۆ شاخ':'هەژماری نوێ دروست بکە'}</h2><p>{authMode==='login'?'بۆ ئۆردەرکردن بچۆ ژوورەوە.':'بۆ دەستپێکردن هەژمارێکی خۆت دروست بکە.'}</p><button className="google" onClick={google}>گووگڵ · بەردەوام بە لەگەڵ گووگڵ</button><div className="or">یان</div>{authMode==='signup'&&<input value={name} onChange={e=>setName(e.target.value)} placeholder="ناوی تەواو"/>}<input value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="ئیمەیڵ"/><input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="وشەی نهێنی"/>{authMode==='login'?<><button className="primary full" onClick={login}><LogIn size={17}/> چوونەژوورەوە</button><button className="reset" onClick={reset}>وشەی نهێنیت لەبیرچووە؟ گۆڕینی بە ئیمەیڵ</button><button className="reset" onClick={()=>{setAuthMode('signup');setMessage('')}}><UserPlus size={16}/> هەژمارت نییە؟ خۆت تۆمار بکە</button></>:<><button className="primary full" onClick={signup}><UserPlus size={17}/> خۆم تۆمار دەکەم</button><button className="reset" onClick={()=>{setAuthMode('login');setMessage('')}}>هەژمارم هەیە؛ بچمە ژوورەوە</button></>}{message&&<small className="msg">{message}</small>}</div></div>}</div>}

const root=document.getElementById('root')!;
createRoot(root).render(window.location.pathname==='/reset-password'?<PasswordReset/>:<React.StrictMode><App/></React.StrictMode>);
