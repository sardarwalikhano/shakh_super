import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {createClient} from '@supabase/supabase-js';
import {Search,ShoppingBag,MapPin,User,Bell,Store,Truck,Wallet,ArrowLeft,LogIn} from 'lucide-react';
import './styles.css';

const url=import.meta.env.VITE_SUPABASE_URL as string|undefined;
const key=import.meta.env.VITE_SUPABASE_ANON_KEY as string|undefined;
const supabase=url&&key?createClient(url,key):null;

type Product={id:string;name:string;price:number;category?:string;image_url?:string;store_name?:string};
const demo:Product[]=[
{id:'1',name:'کەبابی تایبەت',price:11000,category:'خواردن',store_name:'چێشتخانەی شاخ'},
{id:'2',name:'برگر کلاسیک',price:9000,category:'خواردن',store_name:'Burger House'},
{id:'3',name:'برنج 5 کیلۆ',price:18000,category:'سوبرمارکێت',store_name:'سوپەر شاخ'},
{id:'4',name:'جاکێتی مۆدێرن',price:42000,category:'جل و بەرگ',store_name:'Shakh Fashion'}];

function App(){
 const [products,setProducts]=useState<Product[]>(demo); const [search,setSearch]=useState(''); const [cart,setCart]=useState<Product[]>([]); const [auth,setAuth]=useState(false); const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [message,setMessage]=useState('');
 useEffect(()=>{ if(!supabase)return; supabase.from('products').select('*').eq('is_available',true).order('created_at',{ascending:false}).then(({data,error})=>{if(!error&&data?.length)setProducts(data as Product[])}); const channel=supabase.channel('shakh-products').on('postgres_changes',{event:'*',schema:'public',table:'products'},()=>{supabase.from('products').select('*').eq('is_available',true).order('created_at',{ascending:false}).then(({data})=>{if(data?.length)setProducts(data as Product[])})}).subscribe(); return()=>{supabase.removeChannel(channel)}},[]);
 const filtered=products.filter(p=>p.name.toLowerCase().includes(search.toLowerCase()));
 const login=async()=>{if(!supabase){setMessage('Supabase environment variables دابین نەکراون.');return} const {error}=await supabase.auth.signInWithPassword({email,password}); setMessage(error?.message||'بە سەرکەوتوویی چوویتە ژوورەوە.');};
 const google=async()=>{if(!supabase){setMessage('Supabase environment variables دابین نەکراون.');return} const {error}=await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo:window.location.origin}}); if(error)setMessage(error.message)};
 const reset=async()=>{if(!supabase||!email){setMessage('تکایە ئیمەیلەکەت بنووسە.');return} const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin+'/reset-password'}); setMessage(error?.message||'لینکی گۆڕینی وشەی نهێنی بۆ ئیمەیلەکەت نێردرا.');};
 return <div className="app"><header><div className="nav"><div className="logo"><b>SHAKH</b><span>شاخ</span></div><div className="search"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="گەڕان لە خواردن، بازاڕ و بەرهەم..."/></div><button className="plain"><Bell/></button><button className="cart" onClick={()=>setAuth(true)}><ShoppingBag/><i>{cart.length}</i></button><button className="loginBtn" onClick={()=>setAuth(true)}><User size={17}/> چوونەژوورەوە</button></div></header>
 <main><section className="hero"><div><span className="eyebrow">SHAKH • LIVE MARKETPLACE</span><h1>هەموو شتێک،<strong> لە یەک شوێن.</strong></h1><p>خواردن، سوپرمارکێت، جل و بەرگ و پێداویستی ڕۆژانە بە گەیاندنی خێرا.</p><button className="primary">دەستپێبکە <ArrowLeft/></button></div><div className="heroOrb">🛍️</div></section>
 <section className="section"><div className="title"><span>بازاڕی شاخ</span><h2>بەرهەمە بەردەستەکان</h2></div><div className="grid">{filtered.map(p=><article className="card" key={p.id}><div className="pic">{p.image_url?<img src={p.image_url} alt=""/>:<span>🛍️</span>}</div><div className="body"><small>{p.category||'بازاڕ'} · {p.store_name||'SHAKH'}</small><h3>{p.name}</h3><div className="buy"><b>{p.price.toLocaleString('en-US')} د.ع</b><button onClick={()=>setCart(c=>[...c,p])}>+ زیادکردن</button></div></div></article>)}</div></section>
 <section className="features"><div><Truck/><b>گەیاندنی خێرا</b><small>بەدواداچوونی ئۆردەر</small></div><div><Store/><b>خاوەن دوکان</b><small>فرۆشتنی ڕاستەوخۆ</small></div><div><Wallet/><b>جزدانی شاخ</b><small>پارە و transaction</small></div></section></main>
 <footer><div className="logo"><b>SHAKH</b><span>شاخ</span></div><p>هەموو شتێک لە یەک شوێن.</p></footer>
 {auth&&<div className="modal" onClick={()=>setAuth(false)}><div className="auth" onClick={e=>e.stopPropagation()}><button className="x" onClick={()=>setAuth(false)}>×</button><div className="mark">شاخ</div><h2>بەخێربێیت بۆ شاخ</h2><p>بۆ ئۆردەرکردن خۆت تۆمار بکە یان بچۆ ژوورەوە.</p><button className="google" onClick={google}>G &nbsp; بەردەوام بە لەگەڵ Google</button><div className="or">یان</div><input value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="ئیمەیل"/><input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="وشەی نهێنی"/><button className="primary full" onClick={login}><LogIn size={17}/> چوونەژوورەوە</button><button className="reset" onClick={reset}>وشەی نهێنیت لەبیرچووە؟ گۆڕینی بە ئیمەیل</button>{message&&<small className="msg">{message}</small>}</div></div>}</div>}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
