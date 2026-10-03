import React,{useEffect,useMemo,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {createClient,User} from '@supabase/supabase-js';
import {Search,ShoppingBag,User as UserIcon,Bell,Store,Truck,Wallet,ArrowLeft,LogOut,Minus,Plus,Trash2,X,MapPin,PackageCheck,LayoutDashboard,RefreshCw,Car,Plane,Home,MessageCircle,ShieldCheck,Settings,Moon,Sun,ClipboardList} from 'lucide-react';
import './styles.css';
import CustomerOrdersPanel from './components/CustomerOrdersPanel';
import CaptainDashboard from './components/CaptainDashboard';
import VendorDashboard from './components/VendorDashboard';
import SuperAdminOrderMonitor from './components/SuperAdminOrderMonitor';
import VehicleShowroomModule from './components/VehicleShowroomModule';
import UmrahBookingModule from './components/UmrahBookingModule';
import PwaInstallUpdate from './components/PwaInstallUpdate';
import PostsFeed from './components/PostsFeed';
import PostPublishingHub from './components/PostPublishingHub';
import PostsManagement from './components/PostsManagement';
import NotificationCenter from './components/NotificationCenter';
import ProfilePanel,{type ProfilePanelHandle} from './components/ProfilePanel';
import WalletPanel from './components/WalletPanel';
import SupportTicketsPanel from './components/SupportTicketsPanel';
import DeliveryZoneManager from './components/DeliveryZoneManager';
import SettingsPanel from './components/SettingsPanel';
import InteractiveMapPicker from './components/InteractiveMapPicker';
import DashboardShell,{type DashboardView} from './components/DashboardShell';
import SuperAdminControlCenter from './components/SuperAdminControlCenter';
import AdminControlCenter from './components/AdminControlCenter';
import CustomerControlCenter from './components/CustomerControlCenter';
import CaptainControlCenter from './components/CaptainControlCenter';
import VendorControlCenter from './components/VendorControlCenter';
import VendorOrdersPanel from './components/VendorOrdersPanel';
import RestaurantControlCenter from './components/RestaurantControlCenter';
import RestaurantOrdersPanel from './components/RestaurantOrdersPanel';
import SupermarketControlCenter from './components/SupermarketControlCenter';
import SupermarketOrdersPanel from './components/SupermarketOrdersPanel';
import FashionControlCenter from './components/FashionControlCenter';
import FashionOrdersPanel from './components/FashionOrdersPanel';
import ElectronicsControlCenter from './components/ElectronicsControlCenter';
import ElectronicsOrdersPanel from './components/ElectronicsOrdersPanel';
import JewelryControlCenter from './components/JewelryControlCenter';
import JewelryOrdersPanel from './components/JewelryOrdersPanel';
import {reverseGeocodeExactLocation} from './lib/geocoding';
import {applyTheme,getCurrentTheme,type ThemePreference} from './lib/theme';

const url=import.meta.env.VITE_SUPABASE_URL as string|undefined;
const key=import.meta.env.VITE_SUPABASE_ANON_KEY as string|undefined;
const supabase=url&&key?createClient(url,key):null;

type Product={id:string;store_id:string;name_ku:string;name_ar?:string;name_en?:string;price_iqd:number;sale_price_iqd?:number|null;image_url?:string|null;is_available:boolean;stock?:number|null;unlimited_stock?:boolean|null;product_type?:string|null;brand?:string|null;size?:string|null;category?:string;store_name?:string;variants?:unknown};
type CartOptions=Record<string,string|number>;
type VariantInventoryRecord={size?:unknown;color?:unknown;shoe_size?:unknown;stock?:unknown;unlimited_stock?:unknown};
type VariantRecord={shoe_sizes?:unknown;shoe_size?:unknown;shoeSizes?:unknown;shoeSize?:unknown;available_sizes?:unknown;sizes?:unknown;available_colors?:unknown;colors?:unknown;color?:unknown;unlimited_stock?:unknown;variant_inventory?:unknown};
const getVariantOptions=(variants:unknown)=>{
 const sizes=new Set<string>(),colors=new Set<string>(),shoeSizes=new Set<string>();
 if(!Array.isArray(variants))return{sizes:[],colors:[],shoeSizes:[],unlimited:false};
 const add=(target:Set<string>,value:unknown)=>{
  const values=Array.isArray(value)?value:[value];
  for(const item of values){
   if(typeof item==='string'&&item.trim())target.add(item.trim());
   else if(typeof item==='number')target.add(String(item));
  }
 };
 let unlimited=false;
 for(const variant of variants){
  if(!variant||typeof variant!=='object')continue;
  const v=variant as VariantRecord;
  unlimited=unlimited||v.unlimited_stock===true;
  add(sizes,v.available_sizes);add(sizes,v.sizes);
  add(colors,v.available_colors);add(colors,v.colors);add(colors,v.color);
  add(shoeSizes,v.shoe_sizes);add(shoeSizes,v.shoeSizes);
  for(const value of [v.shoe_size,v.shoeSize])if(typeof value==='string'&&/^\d+$/.test(value))shoeSizes.add(value);
 }
 return{sizes:[...sizes],colors:[...colors],shoeSizes:[...shoeSizes],unlimited};
};
const getShoeSizes=(variants:unknown):string[]=>getVariantOptions(variants).shoeSizes;
const getVariantInventory=(variants:unknown):VariantInventoryRecord[]=>{
 const rows:VariantInventoryRecord[]=[];
 if(!Array.isArray(variants))return rows;
 for(const item of variants){
  if(!item||typeof item!=='object')continue;
  const value=(item as VariantRecord).variant_inventory;
  if(!Array.isArray(value))continue;
  for(const row of value){
   if(!row||typeof row!=='object')continue;
   rows.push(row as VariantInventoryRecord);
  }
 }
 return rows;
};
const matchingVariantInventory=(variants:unknown,options:CartOptions):VariantInventoryRecord|null=>{
 const rows=getVariantInventory(variants);
 if(!rows.length)return null;
 return rows.find(row=>{
  const hasSize=row.size!=null&&String(row.size).trim()!=='';
  const hasShoe=row.shoe_size!=null&&String(row.shoe_size).trim()!=='';
  const hasColor=row.color!=null&&String(row.color).trim()!=='';
  return (!hasSize||String(options.size||'')===String(row.size))&&(!hasShoe||String(options.shoe_size||'')===String(row.shoe_size))&&(!hasColor||String(options.color||'')===String(row.color));
 })||null;
};
const isVariantChoiceAvailable=(variants:unknown,kind:'size'|'color'|'shoe_size',value:string,options:CartOptions)=>{
 const rows=getVariantInventory(variants);
 if(!rows.length)return true;
 return rows.some(row=>{
  const stockable=row.unlimited_stock===true||Number(row.stock||0)>0;
  if(!stockable)return false;
  const sameOtherSize=!options.size||kind==='size'||!row.size||String(row.size)===String(options.size);
  const sameOtherColor=!options.color||kind==='color'||!row.color||String(row.color)===String(options.color);
  const sameOtherShoe=!options.shoe_size||kind==='shoe_size'||!row.shoe_size||String(row.shoe_size)===String(options.shoe_size);
  if(kind==='size'&&String(row.size||'')!==String(value))return false;
  if(kind==='color'&&String(row.color||'')!==String(value))return false;
  if(kind==='shoe_size'&&String(row.shoe_size||'')!==String(value))return false;
  return sameOtherSize&&sameOtherColor&&sameOtherShoe;
 });
};

type CartItem={id?:string;product_id:string;store_id:string;name:string;price:number;quantity:number;stock?:number|null;unlimited_stock?:boolean|null;is_available?:boolean;image_url?:string|null;options?:CartOptions};
type Order={id:string;status:string;total_iqd:number;created_at:string;store_id?:string};
type SavedAddress={id:string;label?:string|null;address:string;delivery_note?:string|null;city?:string|null;latitude?:number|null;longitude?:number|null};
type Promotion={id:string;title:string;description?:string|null;image_url?:string|null;starts_at?:string|null;ends_at?:string|null};
const dashboardStatusLabel:Record<string,string>={pending:'چاوەڕوان',accepted:'قبوڵکراو',preparing:'لە ئامادەکردندایە',ready_for_pickup:'ئامادەی وەرگرتن',assigned_to_captain:'کاپتن دیاریکراوە',picked_up:'وەرگیراوە',on_the_way:'لە ڕێگادایە',delivered:'گەیەندراوە',cancelled:'هەڵوەشێنراوەتەوە'};


function PasswordReset(){
 const [password,setPassword]=useState('');
 const [confirm,setConfirm]=useState('');
 const [message,setMessage]=useState('');
 const [saving,setSaving]=useState(false);
 const [ready,setReady]=useState(false);
 const [checking,setChecking]=useState(true);
 useEffect(()=>{
   if(!supabase){setChecking(false);return}
   let active=true;
   supabase.auth.getSession().then(({data})=>{if(active){setReady(Boolean(data.session));setChecking(false)}}).catch(()=>{if(active){setReady(false);setChecking(false)}});
   const {data:listener}=supabase.auth.onAuthStateChange((event,session)=>{
     if(!active)return;
     if(event==='PASSWORD_RECOVERY'||session){setReady(true);setChecking(false)}
   });
   return()=>{active=false;listener.subscription.unsubscribe()};
 },[]);
 const update=async()=>{
   if(!supabase)return setMessage('پەیوەندی بە خزمەتگوزاری بەردەست نییە.');
   if(!ready)return setMessage('لینکی گۆڕینی وشەی نهێنی بەردەست نییە یان بەسەرچووە.');
   if(password.length<6)return setMessage('وشەی نهێنی دەبێت لانیکەم ٦ پیت بێت.');
   if(password!==confirm)return setMessage('دوو وشەی نهێنی یەکسان نین.');
   setSaving(true);setMessage('');
   const {error}=await supabase.auth.updateUser({password});
   if(error){setMessage(error.message);setSaving(false);return}
   await supabase.auth.signOut();
   setMessage('وشەی نهێنی بە سەرکەوتوویی گۆڕدرا. ئێستا دەتوانیت بە وشەی نهێنی نوێ بچیتە ژوورەوە.');
   setSaving(false);
 };
 const back=()=>{window.location.href='/';};
 return <div className="app"><main><div className="auth passwordResetPage" style={{margin:'80px auto'}}>
  <div className="brandMark"><img src="/shakh-logo.svg?v=1.9.8" alt="شاخ" /></div>
  <h2>گەڕاندنەوەی وشەی نهێنی</h2>
  {checking?<p>دۆخی لینکی گۆڕینی وشەی نهێنی دەپشکنرێت...</p>:ready?<p>وشەی نهێنیی نوێت دابنێ.</p>:<div className="msg">لینکی گۆڕینی وشەی نهێنی بەردەست نییە یان بەسەرچووە. تکایە لە شاشەی چوونەژوورەوە داوای لینکێکی نوێ بکە.</div>}
  {ready&&<><label className="authFieldLabel">وشەی نهێنی نوێ<input value={password} onChange={e=>setPassword(e.target.value)} type="password" autoComplete="new-password" placeholder="لانیکەم ٦ پیت"/></label><label className="authFieldLabel">دووبارە وشەی نهێنی<input value={confirm} onChange={e=>setConfirm(e.target.value)} type="password" autoComplete="new-password" placeholder="وشەی نهێنی دووبارە بنووسە"/></label><button className="primary full" onClick={()=>void update()} disabled={saving}>{saving?'پاشەکەوت دەکرێت...':'گۆڕینی وشەی نهێنی'}</button></>}
  <button className="reset" type="button" onClick={back}>گەڕانەوە بۆ سەرەکی شاخ</button>
  {message&&<small className="msg">{message}</small>}
 </div></main></div>;
}
function App(){
 const [products,setProducts]=useState<Product[]>([]); const [platformDeliveryFee,setPlatformDeliveryFee]=useState(1000);const [platformFee,setPlatformFee]=useState(250); const [couponCode,setCouponCode]=useState('');const [couponDiscount,setCouponDiscount]=useState(0);const [couponBusy,setCouponBusy]=useState(false);const [promotions,setPromotions]=useState<Promotion[]>([]);const [search,setSearch]=useState('');const [cart,setCart]=useState<CartItem[]>([]);const [cartId,setCartId]=useState<string|null>(null);const [cartReferralCodes,setCartReferralCodes]=useState<Record<string,string>>({});const [referralWalletBalance,setReferralWalletBalance]=useState(0);const [savedAddresses,setSavedAddresses]=useState<SavedAddress[]>([]);const [selectedAddressId,setSelectedAddressId]=useState<string|null>(null);const [paymentMethod,setPaymentMethod]=useState<'cash'|'wallet'|'referral_wallet'>('cash');const [deliveryCity,setDeliveryCity]=useState('هەولێر');const [cartOpen,setCartOpen]=useState(false);const [checkoutOpen,setCheckoutOpen]=useState(false);const [dashboard,setDashboard]=useState(false);const [selectedOptions,setSelectedOptions]=useState<CartOptions>({});const [selectedReferralCode,setSelectedReferralCode]=useState<string|null>(new URLSearchParams(window.location.search).get('ref')||null);const [dashboardView,setDashboardView]=useState<DashboardView>('home');const [dashboardDirty,setDashboardDirty]=useState(false);const [postsFocusRequest,setPostsFocusRequest]=useState<{postId:string;nonce:number}|null>(null);const [address,setAddress]=useState('');const [deliveryNote,setDeliveryNote]=useState('');const [exactLocationAddress,setExactLocationAddress]=useState('');const [locationLookupBusy,setLocationLookupBusy]=useState(false);const [mapCoords,setMapCoords]=useState<{latitude:number;longitude:number}|null>(null);const [locating,setLocating]=useState(false);const [locationReady,setLocationReady]=useState(false);
 const locationLookupTimerRef=useRef<number|null>(null);const locationLookupAbortRef=useRef<AbortController|null>(null);const [auth,setAuth]=useState(false);const [authMode,setAuthMode]=useState<'login'|'signup'|'reset'>('login');const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [name,setName]=useState('');const [privacyOpen,setPrivacyOpen]=useState(false);const [privacyAccepted,setPrivacyAccepted]=useState(false);const [confirmationPendingEmail,setConfirmationPendingEmail]=useState('');const [message,setMessage]=useState('');const [user,setUser]=useState<User|null>(null);const profileRef=useRef<ProfilePanelHandle|null>(null);const [role,setRole]=useState('customer');const [signupRole,setSignupRole]=useState('customer');const [orders,setOrders]=useState<Order[]>([]);const [busy,setBusy]=useState(false);const [selectedProduct,setSelectedProduct]=useState<Product|null>(null);const [unreadNotifications,setUnreadNotifications]=useState(0);
 useEffect(()=>{
  const modalOpen=dashboard||auth||cartOpen||checkoutOpen||!!selectedProduct;
  if(!modalOpen)return;
  const previousOverflow=document.body.style.overflow;
  document.body.style.overflow='hidden';
  return()=>{document.body.style.overflow=previousOverflow};
 },[dashboard,auth,cartOpen,checkoutOpen,selectedProduct]);
 const loadProducts=async()=>{if(!supabase)return;const {data,error}=await supabase.from('products').select('id,store_id,name_ku,name_ar,name_en,price_iqd,sale_price_iqd,image_url,is_available,stock,product_type,brand,size,variants,stores(name),categories(name)').eq('is_available',true).order('created_at',{ascending:false});if(!error&&data)setProducts((data as any[]).map(p=>({...p,store_name:p.stores?.name,category:p.categories?.name,unlimited_stock:getVariantOptions(p.variants).unlimited})))};
 const loadCart=async(u:User)=>{if(!supabase)return;const {data:c}=await supabase.from('carts').select('id').eq('user_id',u.id).order('updated_at',{ascending:false}).limit(1).maybeSingle();if(!c){setCart([]);setCartId(null);setCartReferralCodes({});return}setCartId(c.id);const [{data:items},{data:refs}]=await Promise.all([supabase.from('cart_items').select('id,product_id,quantity,unit_price_iqd,options,products(store_id,name_ku,image_url,stock,is_available,variants)').eq('cart_id',c.id),supabase.from('cart_post_share_attributions').select('product_id,share_code').eq('cart_id',c.id)]);const codeMap:Record<string,string>={};for(const row of (refs||[]) as any[]){if(row.product_id&&row.share_code)codeMap[row.product_id]=String(row.share_code)}setCartReferralCodes(codeMap);setCart((items as any[]||[]).map(i=>({id:i.id,product_id:i.product_id,store_id:i.products?.store_id,name:i.products?.name_ku||'بەرهەم',price:Number(i.unit_price_iqd),quantity:i.quantity,stock:i.products?.stock,unlimited_stock:getVariantOptions(i.products?.variants).unlimited,is_available:i.products?.is_available,image_url:i.products?.image_url,options:(i.options||{}) as CartOptions})))};

 const loadProfile=async(u:User)=>{if(!supabase)return;const {data}=await supabase.from('profiles').select('role').eq('id',u.id).maybeSingle();setRole(data?.role||'customer')}; const loadReferralWallet=async(u:User)=>{if(!supabase)return;const {data,error}=await supabase.from('referral_wallets').select('balance_iqd').eq('user_id',u.id).maybeSingle();setReferralWalletBalance(error?0:Number(data?.balance_iqd||0))};
 const loadOrders=async(u:User)=>{if(!supabase)return;const {data}=await supabase.from('orders').select('id,status,total_iqd,created_at,store_id').eq('customer_id',u.id).order('created_at',{ascending:false}).limit(20);if(data)setOrders(data as Order[])};
 const loadPlatformSettings=async()=>{if(!supabase)return;const {data}=await supabase.from('platform_settings').select('default_delivery_fee_iqd,platform_fee_iqd').eq('id',true).maybeSingle();if(data){setPlatformDeliveryFee(Number(data.default_delivery_fee_iqd||1000));setPlatformFee(Number(data.platform_fee_iqd||250));}}; const loadPromotions=async()=>{if(!supabase)return;const {data}=await supabase.from('promotions').select('id,title,description,image_url,starts_at,ends_at').eq('is_active',true).order('starts_at',{ascending:false}).limit(20);const now=Date.now();setPromotions(((data||[]) as Promotion[]).filter(p=>(!p.starts_at||new Date(p.starts_at).getTime()<=now)&&(!p.ends_at||new Date(p.ends_at).getTime()>=now)).slice(0,8));};
 const loadUnreadNotifications=async(u:User)=>{if(!supabase)return;const {count,error}=await supabase.from('notifications').select('id',{count:'exact',head:true}).eq('user_id',u.id).eq('is_read',false);if(!error)setUnreadNotifications(count||0)};
 const [currentTheme,setCurrentTheme]=useState<'light'|'dark'>(()=>getCurrentTheme());
 const loadStoredPreferences=async(userId:string)=>{if(!supabase)return;const {data}=await supabase.from('user_preferences').select('theme').eq('user_id',userId).maybeSingle();if(data?.theme){const preference=data.theme as ThemePreference;applyTheme(preference);setCurrentTheme(getCurrentTheme())}};
 const toggleTheme=async()=>{const next=currentTheme==='dark'?'light':'dark';applyTheme(next);setCurrentTheme(next);if(user?.id&&supabase){const {error}=await supabase.from('user_preferences').upsert({user_id:user.id,theme:next,updated_at:new Date().toISOString()},{onConflict:'user_id'});if(error)setMessage('گۆڕینی ڕووکاری شاخ پاشەکەوت نەکرا، بەڵام ڕوکار گۆڕدرا.')}};
 const loadSavedAddresses=async(u:User)=>{if(!supabase)return;const {data,error}=await supabase.from('delivery_addresses').select('id,label,address,delivery_note,city,latitude,longitude').eq('user_id',u.id).order('created_at',{ascending:false}).limit(10);if(!error&&data)setSavedAddresses(data as SavedAddress[])};
 useEffect(()=>{applyTheme(getCurrentTheme());const onThemeChange=()=>setCurrentTheme(getCurrentTheme());window.addEventListener('shakh-theme-change',onThemeChange);if(!supabase){return()=>window.removeEventListener('shakh-theme-change',onThemeChange)}let mounted=true;supabase.auth.getSession().then(({data})=>{if(mounted&&data.session?.user){setUser(data.session.user);loadProfile(data.session.user);loadCart(data.session.user);loadOrders(data.session.user);loadSavedAddresses(data.session.user);loadUnreadNotifications(data.session.user);loadReferralWallet(data.session.user);loadStoredPreferences(data.session.user.id)}});const {data:listener}=supabase.auth.onAuthStateChange((event,session)=>{setUser(session?.user??null);if(event==='SIGNED_IN'){setAuth(false);setMessage('بەخێربێیت بۆ شاخ 👋');}if(session?.user){loadProfile(session.user);loadCart(session.user);loadOrders(session.user);loadSavedAddresses(session.user);loadUnreadNotifications(session.user);loadReferralWallet(session.user);loadStoredPreferences(session.user.id)}else{applyTheme('light');setCurrentTheme('light');setCart([]);setCartId(null);setCartReferralCodes({});setReferralWalletBalance(0);setOrders([]);setSavedAddresses([]);setRole('customer');setUnreadNotifications(0)}});loadProducts();loadPlatformSettings();loadPromotions();const channel=supabase.channel('shakh-live-products').on('postgres_changes',{event:'*',schema:'public',table:'products'},()=>loadProducts()).on('postgres_changes',{event:'*',schema:'public',table:'promotions'},()=>loadPromotions()).subscribe();return()=>{mounted=false;listener.subscription.unsubscribe();supabase.removeChannel(channel);window.removeEventListener('shakh-theme-change',onThemeChange)}},[]);
 useEffect(()=>{if(!supabase||!user?.id){setUnreadNotifications(0);return}const userId=user.id;void loadUnreadNotifications(user);const channel=supabase.channel('shakh-notification-badge-'+userId).on('postgres_changes',{event:'INSERT',schema:'public',table:'notifications',filter:'user_id=eq.'+userId},(payload)=>{const row=payload.new as {title?:string;body?:string};setUnreadNotifications(current=>current+1);if(row.title){setMessage(row.body?row.title+' — '+row.body:row.title)}}).on('postgres_changes',{event:'UPDATE',schema:'public',table:'notifications',filter:'user_id=eq.'+userId},()=>void loadUnreadNotifications(user)).subscribe();return()=>{void supabase.removeChannel(channel)}},[user?.id]);
 const filtered=useMemo(()=>products.filter(p=>(p.name_ku||'').toLowerCase().includes(search.toLowerCase())),[products,search]);


 const selectedVariantOptions=useMemo(()=>getVariantOptions(selectedProduct?.variants),[selectedProduct]);
 const selectedShoeSizes=selectedVariantOptions.shoeSizes;
 const selectedFashionSizes=selectedVariantOptions.sizes;
 const selectedFashionColors=selectedVariantOptions.colors;
 const selectedNeedsVariant=selectedShoeSizes.length>0||selectedFashionSizes.length>0||selectedFashionColors.length>0;
 const selectedVariantInventory=useMemo(()=>matchingVariantInventory(selectedProduct?.variants,selectedOptions),[selectedProduct,selectedOptions]);
 const selectedVariantInventoryRows=useMemo(()=>getVariantInventory(selectedProduct?.variants),[selectedProduct]);
 const selectedVariantSelectionComplete=Boolean(
  (!selectedShoeSizes.length||Boolean(selectedOptions.shoe_size))&&
  (!selectedFashionSizes.length||Boolean(selectedOptions.size))&&
  (!selectedFashionColors.length||Boolean(selectedOptions.color))
 );
 const selectedVariantMissing=Boolean(selectedVariantInventoryRows.length&&selectedNeedsVariant&&selectedVariantSelectionComplete&&!selectedVariantInventory);
 const selectedVariantOutOfStock=Boolean(selectedVariantInventory&&!selectedVariantInventory.unlimited_stock&&Number(selectedVariantInventory.stock||0)<=0);
 const selectedVariantUnavailable=selectedVariantMissing||selectedVariantOutOfStock;
 const selectedAvailability=selectedVariantInventory
  ? selectedVariantInventory.unlimited_stock
    ? 'بێ سنوور ∞'
    : Number(selectedVariantInventory.stock||0).toLocaleString('ku-IQ')+' دانە'
  : selectedProduct?.unlimited_stock
    ? 'بێ سنوور ∞'
    : Number(selectedProduct?.stock||0).toLocaleString('ku-IQ')+' دانە';
 const openProductForCart=async(productId:string,referralCode?:string)=>{if(!supabase)return false;const code=referralCode||selectedReferralCode||undefined;const {data,error}=await supabase.from('products').select('id,store_id,name_ku,name_ar,name_en,price_iqd,sale_price_iqd,image_url,is_available,stock,product_type,brand,size,variants').eq('id',productId).single();if(error||!data){setMessage('بەرهەمەکە نەدۆزرایەوە.');return false}const p=data as Product;setSelectedOptions({});setSelectedReferralCode(code||null);if(getVariantOptions(p.variants).shoeSizes.length||getVariantOptions(p.variants).sizes.length||getVariantOptions(p.variants).colors.length){setSelectedProduct(p);return true}return addToCart(p,{},code)};
 const subtotal=cart.reduce((s,i)=>s+i.price*i.quantity,0);const delivery=cart.length?platformDeliveryFee:0;const fee=cart.length?platformFee:0;const total=subtotal+delivery+fee;const checkoutTotal=Math.max(0,total-couponDiscount);
 const ensureCart=async(u:User,storeId:string)=>{if(!supabase)throw new Error('پەیوەندی بە خزمەتگوزاری بەردەست نییە.');const {data,error}=await supabase.from('carts').select('id,store_id').eq('user_id',u.id).maybeSingle();if(error)throw error;if(data){if(data.store_id!==storeId){const {error:updateError}=await supabase.from('carts').update({store_id:storeId,updated_at:new Date().toISOString()}).eq('id',data.id);if(updateError)throw updateError;}return data.id as string}const {data:created,error:ce}=await supabase.from('carts').insert({user_id:u.id,store_id:storeId}).select('id').single();if(ce)throw ce;return created.id as string};
 const attachReferralToCart=async(cartIdValue:string,productId:string,code?:string|null)=>{if(!supabase||!code)return;const {data, error}=await supabase.rpc('attach_post_share_to_cart',{p_cart_id:cartIdValue,p_product_id:productId,p_code:code});if(error||data!==true)setMessage('لینکی قازانج پشتڕاست نەکرا؛ بەڵام کڕینەکە بەردەوامە.');};
 const addToCart=async(p:Product,options:CartOptions={},referralCode?:string):Promise<boolean>=>{
  if(!user){setAuthMode('login');setAuth(true);setMessage('بۆ زیادکردن بۆ سەلە، تکایە بچۆ ژوورەوە یان خۆت تۆمار بکە.');return false}
  const variantOptions=getVariantOptions(p.variants);
  const selectedInventory=matchingVariantInventory(p.variants,options);
  const selectedInventoryUnavailable=Boolean(selectedInventory&&!selectedInventory.unlimited_stock&&Number(selectedInventory.stock||0)<=0);
  if(variantOptions.shoeSizes.length){
   if(!options.shoe_size)return(setSelectedOptions({}),setSelectedProduct(p),setMessage('تکایە ژمارەی پێلاوی بەردەست هەڵبژێرە.'),false);
   if(typeof options.shoe_size!=='string'||!variantOptions.shoeSizes.includes(options.shoe_size))return setMessage('ئەم ژمارەی پێلاوە بەردەست نییە.'),false;
  }else if(variantOptions.sizes.length){
   if(!options.size)return(setSelectedOptions({}),setSelectedProduct(p),setMessage('تکایە قەبارەی بەردەست هەڵبژێرە.'),false);
   if(typeof options.size!=='string'||!variantOptions.sizes.includes(options.size))return setMessage('ئەم قەبارەیە بەردەست نییە.'),false;
  }
  if(variantOptions.colors.length){
   if(!options.color)return(setSelectedOptions(v=>({...v})),setSelectedProduct(p),setMessage('تکایە ڕەنگی بەردەست هەڵبژێرە.'),false);
   if(typeof options.color!=='string'||!variantOptions.colors.includes(options.color))return setMessage('ئەم ڕەنگە بەردەست نییە.'),false;
  }
  const inventoryRows=getVariantInventory(p.variants);
  const completeVariantSelection=Boolean(
   (!variantOptions.shoeSizes.length||Boolean(options.shoe_size))&&
   (!variantOptions.sizes.length||Boolean(options.size))&&
   (!variantOptions.colors.length||Boolean(options.color))
  );
  if(inventoryRows.length&&completeVariantSelection&&!selectedInventory){
   setSelectedProduct(p);
   setMessage('ئەم کۆمبینەیشنەی هەڵبژێردراو بەردەست نییە.');
   return false;
  }
  try{
   setBusy(true);
   if(!p.is_available||(!selectedInventory&&!variantOptions.unlimited&&Number(p.stock||0)<=0)||selectedInventoryUnavailable){setMessage(selectedInventoryUnavailable?'ئەم هەڵبژاردەیە ستۆکی نەماوە.':'ئەم بەرهەمە ئێستا بەردەست نییە.');return false}
   if(cart.length&&cart[0].store_id!==p.store_id){setMessage('لە هەر سەلەیەکدا تەنها لە یەک دوکان دەتوانیت داواکاری بکەیت.');return false}
   const {data:live,error:liveError}=await supabase!.from('products').select('is_available,stock,price_iqd,sale_price_iqd,variants').eq('id',p.id).single();
   if(liveError)throw liveError;
   const liveVariantOptions=getVariantOptions(live?.variants);
   const liveUnlimited=liveVariantOptions.unlimited;
   const liveInventory=matchingVariantInventory(live?.variants,options);
   const liveInventoryRows=getVariantInventory(live?.variants);
   const liveSelectionComplete=Boolean(
    (!liveVariantOptions.shoeSizes.length||Boolean(options.shoe_size))&&
    (!liveVariantOptions.sizes.length||Boolean(options.size))&&
    (!liveVariantOptions.colors.length||Boolean(options.color))
   );
   const liveInventoryMissing=Boolean(liveInventoryRows.length&&liveSelectionComplete&&!liveInventory);
   const liveInventoryUnavailable=Boolean(liveInventory&&!liveInventory.unlimited_stock&&Number(liveInventory.stock||0)<=0);
   if(!live?.is_available||liveInventoryMissing||(!liveInventory&&!liveUnlimited&&Number(live.stock||0)<=0)||liveInventoryUnavailable){
    setMessage(liveInventoryMissing?'ئەم کۆمبینەیشنەی هەڵبژێردراو چیتر بەردەست نییە.':liveInventoryUnavailable?'ئەم هەڵبژاردەیە چیتر بەردەست نییە.':'ئەم بەرهەمە ئێستا بەردەست نییە.');
    await loadProducts();return false;
   }
   const ensuredCartId=await ensureCart(user,p.store_id);const effectiveReferralCode=referralCode||selectedReferralCode;
   const price=Number(live.sale_price_iqd??live.price_iqd);
   const optionsKey=JSON.stringify(options,Object.keys(options).sort());
   const existing=cart.find(i=>i.product_id===p.id&&JSON.stringify(i.options||{},Object.keys(i.options||{}).sort())===optionsKey);
   if(existing?.id){
    if((liveInventory&&!liveInventory.unlimited_stock&&existing.quantity>=Number(liveInventory.stock||0))||(!liveInventory&& !liveUnlimited&&existing.quantity>=Number(live.stock||0))){setMessage('ژمارەی داواکراو لە ستۆک زیاترە.');return false}
    const {error}=await supabase!.from('cart_items').update({quantity:existing.quantity+1}).eq('id',existing.id);
    if(error)throw error;
   }else{
    const {error}=await supabase!.from('cart_items').insert({cart_id:cartId,product_id:p.id,quantity:1,unit_price_iqd:price,options});
    if(error)throw error;
   }
   if(effectiveReferralCode)await attachReferralToCart(ensuredCartId,p.id,effectiveReferralCode);setCouponDiscount(0);await loadCart(user);setMessage(effectiveReferralCode?'بەرهەمەکە بۆ سەلە زیاد کرا و کۆدی قازانج پەیوەست کرا.':'بەرهەمەکە بۆ سەلە زیاد کرا.');return true;
  }catch(e:any){setMessage(e?.message||'زیادکردنی بەرهەم سەرکەوتوو نەبوو.');return false}finally{setBusy(false)}
 };
 const changeQty=async(item:CartItem,delta:number)=>{
  if(!item.id||!supabase)return;
  setCouponDiscount(0);
  const q=item.quantity+delta;
  if(delta>0){
   const {data:live,error}=await supabase.from('products').select('stock,is_available,variants').eq('id',item.product_id).single();
   if(error)return setMessage('نەتوانرا بەردەستیی بەرهەم پشکنرێت.');
   const liveVariantOptions=getVariantOptions(live?.variants);
   const inventory=matchingVariantInventory(live?.variants,item.options||{});
   const inventoryRows=getVariantInventory(live?.variants);
   const selectionComplete=Boolean(
    (!liveVariantOptions.shoeSizes.length||Boolean(item.options?.shoe_size))&&
    (!liveVariantOptions.sizes.length||Boolean(item.options?.size))&&
    (!liveVariantOptions.colors.length||Boolean(item.options?.color))
   );
   const inventoryMissing=Boolean(inventoryRows.length&&selectionComplete&&!inventory);
   const unlimited=inventory?.unlimited_stock===true||(!inventory&&!inventoryRows.length&&liveVariantOptions.unlimited);
   const available=inventory?Number(inventory.stock||0):Number(live?.stock||0);
   if(!live?.is_available||inventoryMissing||(!unlimited&&q>available)){
    setMessage(inventoryMissing?'ئەم هەڵبژاردەیە چیتر بەردەست نییە.':available>0&&!unlimited?'ژمارەی داواکراو لە ستۆک زیاترە.':'ئەم هەڵبژاردەیە ستۆکی نەماوە.');
    return;
   }
  }
  if(q<=0){await supabase.from('cart_items').delete().eq('id',item.id);if(cartId)await supabase.from('cart_post_share_attributions').delete().eq('cart_id',cartId).eq('product_id',item.product_id);}
  else await supabase.from('cart_items').update({quantity:q}).eq('id',item.id);
  if(user)await loadCart(user);
};
 const clearCart=async()=>{if(!supabase||!user)return;setCouponDiscount(0);if(cartId)await supabase.from('cart_post_share_attributions').delete().eq('cart_id',cartId);const ids=cart.map(i=>i.id).filter(Boolean) as string[];if(ids.length)await supabase.from('cart_items').delete().in('id',ids);setCart([]);setCartReferralCodes({})};
 const queueReverseGeocode=(coords:{latitude:number;longitude:number})=>{setExactLocationAddress(`شوێنی دیاریکراو لە نەخشە — ${coords.latitude.toFixed(7)}, ${coords.longitude.toFixed(7)}`);setLocationLookupBusy(true);if(locationLookupTimerRef.current!==null)window.clearTimeout(locationLookupTimerRef.current);locationLookupAbortRef.current?.abort();const controller=new AbortController();locationLookupAbortRef.current=controller;locationLookupTimerRef.current=window.setTimeout(()=>{void reverseGeocodeExactLocation(coords,controller.signal).then(result=>{if(controller.signal.aborted)return;if(result.displayName)setExactLocationAddress(result.displayName);if(result.city)setDeliveryCity(result.city)}).catch(error=>{if(error?.name==='AbortError')return}).finally(()=>{if(!controller.signal.aborted)setLocationLookupBusy(false)})},1100)};
 const detectLocation=()=>{if(!('geolocation' in navigator)){setLocationReady(false);return setMessage('وێبگەڕەکەت پشتگیری جی‌پی‌ئێس ناکات.')}setLocating(true);setMessage('تکایە مۆڵەتی شوێن بدە بۆ ئەوەی شوێنی وردت دیاری بکرێت...');navigator.geolocation.getCurrentPosition(pos=>{const latitude=Number(pos.coords.latitude.toFixed(7));const longitude=Number(pos.coords.longitude.toFixed(7));const coords={latitude,longitude};setMapCoords(coords);setExactLocationAddress(`شوێنی دیاریکراو لە نەخشە — ${latitude.toFixed(7)}, ${longitude.toFixed(7)}`);queueReverseGeocode(coords);setLocationReady(true);setLocating(false);setSelectedAddressId(null);setMessage('شوێنی وردت دیاریکرا ✓');},()=>{setLocationReady(false);setLocating(false);setMessage('شوێنەکەت دیاری نەکراوە؛ لە ڕێکخستنی وێبگەڕ مۆڵەتی شوێن بدە.')},{enableHighAccuracy:true,timeout:12000,maximumAge:30000});};
 const beginSignup=()=>{setAuthMode('signup');setPrivacyAccepted(false);setPrivacyOpen(true);setConfirmationPendingEmail('')};
 const resendConfirmation=async()=>{if(!supabase||!confirmationPendingEmail)return;const {error}=await supabase.auth.resend({type:'signup',email:confirmationPendingEmail});setMessage(error?.message||'ئیمەیڵی پشتڕاستکردنەوە دووبارە نێردرا. تکایە Inbox و Spam بپشکنە.')};
 const previewCoupon=async()=>{
  const code=couponCode.trim();
  if(!code){setCouponDiscount(0);setMessage('کۆدی کۆپۆن بنووسە.');return}
  if(!supabase||!user)return;
  try{
    setCouponBusy(true);
    const {data,error}=await supabase.rpc('preview_coupon',{p_code:code,p_subtotal:subtotal});
    if(error)throw error;
    const row=Array.isArray(data)?data[0]:data;
    const discount=Math.min(Math.max(Number(row?.discount_iqd||0),0),subtotal);
    setCouponDiscount(discount);
    setMessage(discount>0?'کۆپۆن جێبەجێ کرا؛ '+discount.toLocaleString('en-US')+' د.ع داشکاندن.':'کۆپۆنێک بە داشکاندن نەدۆزرایەوە.');
  }catch(error){
    setCouponDiscount(0);
    const msg=error instanceof Error?error.message:'';
    if(msg.includes('COUPON_EXPIRED'))setMessage('ئەم کۆپۆنە بەسەرچووە.');
    else if(msg.includes('COUPON_LIMIT_REACHED'))setMessage('سنووری بەکارهێنانی ئەم کۆپۆنە پڕ بووە.');
    else if(msg.includes('COUPON_CODE_REQUIRED'))setMessage('کۆدی کۆپۆن بنووسە.');
    else setMessage('کۆپۆنەکە نادروستە یان چیتر بەردەست نییە.');
  }finally{setCouponBusy(false)}
};
const ensureOrderContact=async()=>{if(!supabase||!user)return false;const {data,error}=await supabase.from('profiles').select('phone,whatsapp_phone').eq('id',user.id).maybeSingle();if(error)throw error;if(!data?.phone?.trim()||!data?.whatsapp_phone?.trim()){setCheckoutOpen(false);setDashboardView('profile');setDashboard(true);setMessage('بۆ تۆمارکردنی داواکاری، تکایە ژمارەی مۆبایل و واتسئاپت لە پرۆفایل پاشەکەوت بکە.');return false}return true};
 const checkout=async()=>{if(!user){setCartOpen(false);setAuthMode('login');setAuth(true);setMessage('بۆ تەواوکردنی داواکارییەکەت، تکایە بچۆ ژوورەوە یان خۆت تۆمار بکە.');return}if(!cart.length)return setMessage('سەلەکەت بەتاڵە.');if(!mapCoords)return setMessage('تکایە لەسەر نەخشە شوێنی وردی گەیاندن دیاری بکە.');if(paymentMethod==='referral_wallet'&&referralWalletBalance<checkoutTotal)return setMessage('باڵانسی قازانجی پۆستەکان بەس نییە بۆ ئەم کڕینە.');try{const contactReady=await ensureOrderContact();if(!contactReady)return;setBusy(true);const storeId=cart[0].store_id;const exactAddress=exactLocationAddress.trim()||`شوێنی دیاریکراو لە نەخشە — ${mapCoords.latitude.toFixed(7)}, ${mapCoords.longitude.toFixed(7)}`;let addressId=selectedAddressId;if(!addressId){const {data:addr,error:ae}=await supabase!.from('delivery_addresses').insert({user_id:user.id,label:'شوێنی وردی گەیاندن',address:exactAddress,delivery_note:deliveryNote.trim()||null,city:deliveryCity.trim()||null,latitude:mapCoords.latitude,longitude:mapCoords.longitude,is_default:false}).select('id').single();if(ae)throw ae;addressId=addr.id}else{const {data:addr,error:ae}=await supabase!.from('delivery_addresses').select('id,latitude,longitude').eq('id',addressId).eq('user_id',user.id).maybeSingle();if(ae)throw ae;if(!addr||addr.latitude==null||addr.longitude==null)throw new Error('ناونیشانی هەڵبژێردراو خاڵی وردی ماپی نییە. تکایە دووبارە شوێنێک لە ماپ هەڵبژێرە.');addressId=addr.id}const {data:orderId,error:oe}=await supabase!.rpc('create_order_with_stock',{p_store_id:storeId,p_address_id:addressId,p_items:cart.map(i=>({product_id:i.product_id,quantity:i.quantity,options:{...(i.options||{}),...(cartReferralCodes[i.product_id]?{__shakh_share_ref:cartReferralCodes[i.product_id]}:{})},referral_code:null})),p_payment_method:paymentMethod,p_coupon_code:couponCode.trim()||null});if(oe)throw oe;if(!orderId)throw new Error('ژمارەی ئۆردەر دروست نەکرا.');await clearCart();await loadOrders(user);await loadProducts();setCheckoutOpen(false);setCartOpen(false);setAddress('');setDeliveryNote('');setExactLocationAddress('');setDeliveryCity('هەولێر');setSelectedAddressId(null);setMapCoords(null);setLocationLookupBusy(false);setPaymentMethod('cash');await loadReferralWallet(user);setCouponCode('');setCouponDiscount(0);setMessage('داواکارییەکەت بە سەرکەوتوویی تۆمار کرا. ژمارەی داواکاری: '+String(orderId).slice(0,8))}catch(e:any){const msg=e?.message||'';if(msg.includes('DELIVERY_OUTSIDE_SERVICE_AREA'))setMessage('ئەم شوێنە لە ناوچەی گەیاندنی ئەم دوکانە نییە. تکایە شوێنێک لە ناو سنوری گەیاندن هەڵبژێرە.');else if(msg.includes('COUPON_EXPIRED'))setMessage('کۆپۆنەکە بەسەرچووە.')
 else if(msg.includes('COUPON_LIMIT_REACHED'))setMessage('سنووری بەکارهێنانی کۆپۆنەکە پڕ بووە.')
 else if(msg.includes('INVALID_COUPON'))setMessage('کۆپۆنەکە نادروستە یان چیتر بەردەست نییە.')
 else if(msg.includes('INSUFFICIENT_WALLET_BALANCE'))setMessage('باڵانسی جزدانت بەس نییە بۆ تەواوکردنی ئەم ئۆردەرە. تکایە پارەی پێویست زیاد بکە یان شێوازی پارەدان بە کاش بگۆڕە.');else if(msg.includes('INSUFFICIENT_REFERRAL_WALLET_BALANCE'))setMessage('باڵانسی قازانجی پۆستەکان بەس نییە بۆ ئەم کڕینە.');else setMessage(msg||'تۆمارکردنی داواکاری سەرکەوتوو نەبوو.')}finally{setBusy(false)}};const login=async()=>{if(!supabase)return setMessage('پەیوەندی بە خزمەتگوزاری بەردەست نییە.');const {error}=await supabase.auth.signInWithPassword({email,password});if(error){setMessage(error.message);return}setAuth(false);setMessage('بەخێربێیت بۆ شاخ 👋');};
 const signup=async()=>{if(!supabase)return setMessage('پەیوەندی بە خزمەتگوزاری بەردەست نییە.');if(!privacyAccepted){setPrivacyOpen(true);return setMessage('پێش دروستکردنی هەژمار، سیاسەتی پاراستنی نهێنی پەسەند بکە.')}if(!name.trim())return setMessage('تکایە ناوی تەواو بنووسە.');if(password.length<6)return setMessage('وشەی نهێنی دەبێت لانیکەم ٦ پیت بێت.');const acceptedAt=new Date().toISOString();const {data,error}=await supabase.auth.signUp({email,password,options:{data:{full_name:name.trim(),role:signupRole,privacy_policy_accepted_at:acceptedAt,privacy_policy_version:'1.0'}}});if(error){setMessage(error.message);return}if(data.session){setAuth(false);setMessage('هەژمارت دروست کرا؛ بەخێربێیت بۆ شاخ 👋')}else{setConfirmationPendingEmail(email.trim());setMessage('هەژمارت دروست کرا. تکایە ئیمەیڵەکەت پشتڕاست بکەرەوە؛ ئەگەر پەیامەکە نەهات، دووبارە بینێرەوە.')}};
 const google=async()=>{if(!supabase)return setMessage('پەیوەندی بە خزمەتگوزاری بەردەست نییە.');const {error}=await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo:window.location.origin}});if(error)setMessage(error.message)};
 const reset=async()=>{if(!supabase||!email.trim())return setMessage('تکایە ئیمەیڵەکەت بنووسە.');setBusy(true);const {error}=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:window.location.origin+'/reset-password'});setMessage(error?.message||'ئەگەر ئەم ئیمەیڵە هەژماری شاخ بێت، لینکی گۆڕینی وشەی نهێنی بۆ نێردرا. تکایە Inbox و Spam بپشکنە.');setBusy(false)};
 const signout=async()=>{await supabase?.auth.signOut();setAuth(false);setDashboard(false);setDashboardView('home')};
 const openDashboard=(view:DashboardView='home')=>{if(!user){setAuthMode('login');setAuth(true);setMessage('بۆ بینینی داشبۆرد، تکایە سەرەتا بچۆ ژوورەوە.');return}if(dashboardDirty&&dashboardView==='profile'&&view!=='profile'&&!window.confirm('گۆڕانکارییەکانی پرۆفایل پاشەکەوت نەکراون. دڵنیایت دەتەوێت بچیتە بەشێکی تر؟'))return;setDashboardView(view);setDashboard(true);void loadOrders(user)};
 const closeDashboard=async()=>{
  if(dashboardDirty&&dashboardView==='profile'){
   const saveFirst=window.confirm('گۆڕانکارییەکانی پرۆفایل پاشەکەوت نەکراون. دەتەوێت پاشەکەوتیان بکەیت و داشبۆرد دابخەیت؟');
   if(saveFirst){
    const saved=await profileRef.current?.save();
    if(!saved)return;
   }else{
    const discard=window.confirm('گۆڕانکارییەکانی پرۆفایل پاشەکەوت نەکرێن و داشبۆرد دابخرێت؟');
    if(!discard)return;
   }
  }else if(dashboardDirty&&!window.confirm('گۆڕانکارییەکانی پرۆفایل پاشەکەوت نەکراون. دڵنیایت دەتەوێت داشبۆرد دابخەیت؟'))return;
  setDashboard(false);setDashboardView('home');setDashboardDirty(false);
 };
 const roleLabel=role==='super_admin'?'بەڕێوبەری باڵا':role==='admin'?'بەڕێوبەر':['restaurant_vendor','supermarket_vendor','fashion_vendor','vendor','electronics_vendor','jewelry_vendor'].includes(role)?'خاوەن دوکان':role==='captain'?'کاپتن':role==='car_dealer'?'پێشانگای ئۆتۆمبێل':role==='umrah_agency'?'کۆمپانیای حەج و عومرە':role==='beauty_vendor'?'جوانکاری':'کڕیار';
 const dashboardModule=()=>{
  if(!user)return null;
  if(dashboardView==='services'){
   const serviceItems=[
    {id:'profile' as const,label:'پرۆفایل',description:'ناو، تەلەفون، شار، زمان و وێنە',icon:UserIcon,group:'هەژمار',tone:'indigo'},
    {id:'store' as const,label:'دوکان و پێشانگا',description:'بازاڕ، دوکان و بەرهەمەکانی شاخ',icon:Store,group:'بازاڕ و گەیاندن',tone:'orange'},
    {id:'orders' as const,label:'ئۆردەرەکان',description:'بینین و بەدواداچوونی داواکارییەکان',icon:ClipboardList,group:'بازاڕ و گەیاندن',tone:'blue'},
    {id:'delivery' as const,label:'گەیاندن',description:'شوێنکەوتن و دۆخی گەیاندن',icon:Truck,group:'بازاڕ و گەیاندن',tone:'green'},
    ...( ['restaurant_vendor','supermarket_vendor','fashion_vendor','vendor','electronics_vendor','jewelry_vendor','super_admin','admin'].includes(role)
      ? [{id:'delivery_zones' as const,label:'سنوری گەیاندن',description:'ناوچە و سنوری خزمەتگوزاریی شاخ',icon:MapPin,group:'بازاڕ و گەیاندن',tone:'sky'}]
      : [] ),
    {id:'cars' as const,label:'SHAKH Cars',description:'پێشانگا و بەڕێوەبردنی ئۆتۆمبێل',icon:Car,group:'خزمەتگوزاری تایبەت',tone:'violet'},
    {id:'umrah' as const,label:'حەج و عومرە',description:'پەکەج و حجزکردنی گەشت',icon:Plane,group:'خزمەتگوزاری تایبەت',tone:'teal'},
    {id:'wallet' as const,label:'جزدان',description:'باڵانس، مامەڵە و خاڵەکان',icon:Wallet,group:'خزمەتگوزاری تایبەت',tone:'gold'},
    {id:'notifications' as const,label:'ئاگادارکردنەوەکان',description:'ئاگاداریی نوێی هەژمار و ئۆردەر',icon:Bell,group:'بەڕێوەبردنی هەژمار',tone:'rose'},
    {id:'support' as const,label:'پشتگیری',description:'تیکەت و پەیوەندی لەگەڵ پشتگیری',icon:MessageCircle,group:'بەڕێوەبردنی هەژمار',tone:'cyan'},
    {id:'settings' as const,label:'ڕێکخستنەکان',description:'ڕوکار، ئاگاداری، شوێن و هەژمار',icon:Settings,group:'بەڕێوەبردنی هەژمار',tone:'slate'},
   ];
   return <section className="dashboardAccountServices" aria-labelledby="dashboard-account-services-title">
    <div className="dashboardAccountServicesHero">
     <div>
      <span>ناوەندی خزمەتگوزاری</span>
      <h2 id="dashboard-account-services-title">هەموو بەشەکانی شاخ لە یەک شوێن</h2>
      <p>بەشێک هەڵبژێرە؛ داشبۆرد هەمان کاتەگۆری تەنها پیشان دەدات و ناوبەر و هێدەر لە شوێنی خۆیان دەمێننەوە.</p>
     </div>
     <div className="dashboardAccountServicesCount"><strong>{serviceItems.length.toLocaleString('ku-IQ')}</strong><small>بەشی بەردەست</small></div>
    </div>
    <div className="dashboardAccountServicesGrid">
     {serviceItems.map((item,index)=>{const Icon=item.icon;const previousGroup=serviceItems[index-1]?.group;const showGroup=item.group!==previousGroup;return <React.Fragment key={item.id}>
      {showGroup&&<div className="dashboardAccountServicesGroupLabel">{item.group}</div>}
      <button key={item.id} type="button" className="dashboardAccountServiceCard" data-tone={item.tone} onClick={()=>openDashboard(item.id)}>
       <span className="dashboardAccountServiceCardIcon"><Icon size={20}/></span>
       <span className="dashboardAccountServiceCardCopy"><strong>{item.label}</strong><small>{item.description}</small></span>
       <span className="dashboardAccountServiceCardArrow"><ArrowLeft size={16}/></span>
      </button>
     </React.Fragment>})}
    </div>
   </section>;
  }
  if(dashboardView==='publish_post'){
   return <section className="dashboardAccountSingleModule"><PostPublishingHub userId={user.id} role={role} onSaved={()=>void loadOrders(user)}/></section>;
  }
  if(dashboardView==='manage_posts'){
   return <section className="dashboardAccountSingleModule"><PostsManagement userId={user.id} role={role} focusRequest={postsFocusRequest}/></section>;
  }
  if(dashboardView==='orders'){
   if(role==='super_admin'||role==='admin')return <SuperAdminOrderMonitor/>;
   if(role==='restaurant_vendor')return <RestaurantOrdersPanel userId={user.id}/>;
   if(role==='supermarket_vendor')return <SupermarketOrdersPanel userId={user.id}/>;
   if(role==='fashion_vendor')return <FashionOrdersPanel userId={user.id}/>;
   if(role==='electronics_vendor')return <ElectronicsOrdersPanel userId={user.id}/>;
   if(role==='jewelry_vendor')return <JewelryOrdersPanel userId={user.id}/>;
   if(role==='vendor')return <VendorOrdersPanel userId={user.id}/>;
   return <CustomerOrdersPanel userId={user.id}/>;
  }
  if(dashboardView==='delivery'){
   if(role==='captain')return <CaptainDashboard/>;
   if(role==='super_admin'||role==='admin')return <SuperAdminOrderMonitor/>;
   return <CustomerOrdersPanel userId={user.id}/>;
  }
  if(dashboardView==='delivery_zones')return <DeliveryZoneManager userId={user.id} role={role}/>;
  if(dashboardView==='store'){
   if(['restaurant_vendor','supermarket_vendor','fashion_vendor','vendor','electronics_vendor','jewelry_vendor'].includes(role))return <VendorDashboard userId={user.id} role={role} onRefresh={()=>void loadProducts()} productCount={products.length} pendingOrders={orders.filter(o=>o.status==='pending').length} todaySales={orders.reduce((s,o)=>s+Number(o.total_iqd||0),0)}/>;
   if(role==='car_dealer')return <VehicleShowroomModule userId={user.id} role={role}/>;
   if(role==='umrah_agency')return <UmrahBookingModule userId={user.id} role={role}/>;
   if(role==='super_admin'||role==='admin')return <SuperAdminOrderMonitor/>;
   return <CustomerOrdersPanel userId={user.id}/>;
  }
  if(dashboardView==='cars')return <VehicleShowroomModule userId={user.id} isAdmin={role==='super_admin'||role==='admin'} role={role}/>;
  if(dashboardView==='umrah')return <UmrahBookingModule userId={user.id} role={role}/>;
  if(dashboardView==='notifications')return <NotificationCenter userId={user.id}/>;
  if(dashboardView==='support')return <SupportTicketsPanel userId={user.id} role={role}/>;
  if(dashboardView==='settings')return <SettingsPanel userId={user.id} role={role} onSignOut={signout} onPrivacy={()=>setPrivacyOpen(true)}/>;
  if(dashboardView==='wallet')return <WalletPanel userId={user.id} role={role}/>;
  if(dashboardView==='profile')return <ProfilePanel ref={profileRef} userId={user.id} role={role} onSignOut={signout} onOpenPosts={(postId)=>{
   if(postId)setPostsFocusRequest(current=>({postId,nonce:(current?.nonce||0)+1}));
   else setPostsFocusRequest(null);
   setDashboardView('manage_posts');
  }} onDirtyChange={setDashboardDirty}/>;
  return null;
 };
 useEffect(()=>()=>{locationLookupAbortRef.current?.abort();if(locationLookupTimerRef.current!==null)window.clearTimeout(locationLookupTimerRef.current)},[]);
 return <div className="app" dir="rtl"><header><div className="nav"><a className="logo" href="/" aria-label="SHAKH SUPER — شاخ" onClick={e=>{if(window.location.pathname==='/')e.preventDefault()}}><img className="logoImage" src="/shakh-logo.svg?v=1.9.8" alt="SHAKH SUPER — شاخ" /></a><div className="search"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="گەڕان لە خواردن، بازاڕ و بەرهەم..."/></div><button type="button" className={locationReady?"locationIndicator ready":"locationIndicator"} onClick={detectLocation} disabled={locating} aria-label="دیاریکردنی شوێنی من"><MapPin size={16}/><span>{locating?"شوێن دەدۆزرێتەوە...":locationReady?"شوێنەکەت دیارە":"دیاریکردنی شوێن"}</span></button><button type="button" className="themeToggleButton" onClick={()=>void toggleTheme()} aria-label={currentTheme==='dark'?'گۆڕین بۆ ڕوون':'گۆڕین بۆ تاریک'} title={currentTheme==='dark'?'ڕوون':'تاریک'}>{currentTheme==='dark'?<Sun size={18}/>:<Moon size={18}/>}<span>{currentTheme==='dark'?'ڕوون':'تاریک'}</span></button><button className="plain" onClick={()=>user?openDashboard('notifications'):(setAuthMode('login'),setAuth(true))} aria-label="ئاگادارکردنەوە" style={{position:'relative'}}><Bell/>{user&&unreadNotifications>0&&<i style={{position:'absolute',top:5,right:5,minWidth:17,height:17,padding:'0 4px',borderRadius:999,background:'#ff4d2e',color:'#fff',fontSize:9,fontWeight:900,display:'grid',placeItems:'center',fontStyle:'normal'}}>{unreadNotifications>99?'99+':unreadNotifications}</i>}</button><button className="cart" onClick={()=>setCartOpen(true)}><ShoppingBag/><i>{cart.reduce((s,i)=>s+i.quantity,0)}</i></button>{user&&<button className="plain" title="داشبۆرد" onClick={()=>openDashboard('home')}><LayoutDashboard/></button>}{user?<button className="loginBtn" onClick={()=>openDashboard('profile')}><UserIcon size={17}/> هەژمار</button>:<button className="loginBtn" onClick={()=>{setAuthMode('login');setAuth(true)}}><UserIcon size={17}/> چوونەژوورەوە</button>}</div></header>
 <div className="brandRibbon" aria-label="SHAKH SUPER"><div className="brandRibbonLogo"><img src="/shakh-logo.svg?v=1.9.8" alt="SHAKH SUPER — شاخ" /></div><div className="brandRibbonCopy"><b>SHAKH SUPER</b><span>لەگەڵ شاخ دەگەیتە لوتکە</span></div></div>
 <main><section className="hero"><div><span className="eyebrow">بازاڕی زیندووی شاخ</span><h1>هەموو شتێک،<strong> لە یەک شوێن.</strong></h1><p>خواردن، سوپرمارکێت، جل و بەرگ، ئۆتۆمبێل و گەشتەکانی حەج و عومرە لە یەک پلاتفۆرم.</p><button className="primary" onClick={()=>document.querySelector('.section')?.scrollIntoView({behavior:'smooth'})}>دەستپێبکە <ArrowLeft/></button></div><div className="heroOrb" aria-hidden="true"><img src="/shakh-logo.svg?v=1.9.8" alt="" /></div></section>
 {promotions.length>0&&<section className="section promotionsSection" aria-label="پرۆمۆشنەکانی شاخ"><div className="title"><div><span>پرۆمۆشنەکانی شاخ</span><h2>داشکاندن و ئۆفەری چالاک</h2></div></div><div className="promotionsGrid">{promotions.map(p=><article className="promotionCard" key={p.id}>{p.image_url&&<img src={p.image_url} alt={p.title} loading="lazy" decoding="async"/>}<div><b>{p.title}</b>{p.description&&<p>{p.description}</p>}{p.ends_at&&<small>تا {new Date(p.ends_at).toLocaleDateString('ku-IQ')}</small>}</div></article>)}</div></section>}
 <PostsFeed onAddToCart={openProductForCart}/><section className="section"><div className="title"><span>بازاڕی شاخ</span><h2>بەرهەمە بەردەستەکان</h2></div>{!filtered.length?<div className="empty"><PackageCheck size={40}/><h3>هێشتا بەرهەمێک بەردەست نییە</h3><p>کاتێک خاوەن دوکان بەرهەم زیاد بکات، لێرە بە شێوەی زیندوو دەردەکەوێت.</p></div>:<div className="grid">{filtered.map(p=>{const price=Number(p.sale_price_iqd??p.price_iqd);return <article className="card" key={p.id} tabIndex={0} role="button" aria-label={'بەرهەمی '+p.name_ku+' بکەرەوە'} onClick={()=>{setSelectedReferralCode(null);setSelectedProduct(p)}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelectedProduct(p)}}} style={{cursor:'pointer'}}><div className="pic">{p.image_url?<img src={p.image_url} alt={p.name_ku}/>:<span>🛍️</span>}</div><div className="body"><small>{p.category||'بازاڕ'} · {p.store_name||'دوکان'}</small><h3>{p.name_ku}</h3><small>{p.product_type||''}{p.brand?' · '+p.brand:''}{p.size?' · '+p.size:''}</small><div className="buy"><b>{price.toLocaleString('en-US')} د.ع</b><button disabled={busy||!p.is_available||Number(p.stock||0)<=0} onClick={e=>{e.stopPropagation();void openProductForCart(p.id)}}>{Number(p.stock||0)<=0?'ستۆکی نەماوە':'+ زیادکردن'}</button></div></div></article>})}</div>}</section>
 <section className="features"><button type="button" onClick={()=>openDashboard('delivery')}><Truck/><b>گەیاندنی خێرا</b><small>بەدواداچوونی داواکاری</small></button>{['restaurant_vendor','supermarket_vendor','fashion_vendor','vendor','electronics_vendor','jewelry_vendor','super_admin','admin'].includes(role)&&<button type="button" onClick={()=>openDashboard('delivery_zones')}><MapPin/><b>ناوچەی گەیاندن</b><small>سنوری خزمەتگوزاریی شاخ</small></button>}<button type="button" onClick={()=>openDashboard('store')}><Store/><b>دوکان و پێشانگا</b><small>بازاڕ و فرۆشتنی ڕاستەوخۆ</small></button><button type="button" onClick={()=>openDashboard('cars')}><Car/><b>SHAKH Cars</b><small>پێشانگا، پۆستکردن و پەسەندکردن</small></button><button type="button" onClick={()=>openDashboard('umrah')}><Plane/><b>حەج و عومرە</b><small>تەنها حجزکردنی گەشت</small></button><button type="button" onClick={()=>openDashboard('wallet')}><Wallet/><b>جزدان</b><small>پارە و خاڵەکان</small></button></section>
 <footer className="siteFooter" id="footer">
  <div className="siteFooterGrid">
   <div><div className="footerBrand"><img src="/shakh-logo.svg?v=1.9.8" alt="لۆگۆی شاخ" /><div><b>شاخ</b><small>بازاڕ و گەیاندنی ڕاستەقینە</small></div></div><p>هەموو داواکارییەکانت لە یەک شوێن؛ بە شێوەیەکی خێرا و ئاسان.</p></div>
   <div><b>خزمەتگوزارییەکان</b><button type="button" onClick={()=>openDashboard('store')}>دوکان و بازاڕ</button><button type="button" onClick={()=>openDashboard('delivery')}>گەیاندن</button><button type="button" onClick={()=>openDashboard('cars')}>SHAKH Cars</button><button type="button" onClick={()=>openDashboard('umrah')}>حەج و عومرە</button></div>
   <div><b>بەستەرە خێراکان</b><button type="button" onClick={()=>window.scrollTo({top:0,behavior:'smooth'})}>سەرەکی</button><button type="button" onClick={()=>user?openDashboard('orders'):(setAuthMode('login'),setAuth(true))}>داواکارییەکان</button><button type="button" onClick={()=>document.getElementById('app-install')?.scrollIntoView({behavior:'smooth'})}>دامەزراندن و ئەپدەیت</button></div>
   <div><b>پشتگیری</b><p className="footerSupport">هەر کێشەیەکت هەیە، لە بەشی پشتگیریی شاخ بەدواداچوون بکە.</p><div className="footerSupportContacts"><a href="tel:+9647504796924">📞 07504796924</a><a href="https://wa.me/9647504796924" target="_blank" rel="noreferrer">💬 WhatsApp</a></div><button type="button" className="footerPrivacyLink" onClick={()=>setPrivacyOpen(true)}>سیاسەتی پاراستنی نهێنی</button></div>
  </div>
  <PwaInstallUpdate/>
  <div className="siteFooterBottom"><span>© ٢٠٢٦ شاخ — هەموو مافەکان پارێزراون</span><span>وەشان ١.٩.٨</span></div>
 </footer></main>
 <nav className="mobileBottomNav" aria-label="ناوبەری خێرای مۆبایل">
  <button type="button" className={!dashboard?'active':''} onClick={()=>{void closeDashboard();window.scrollTo({top:0,behavior:'smooth'})}}><Home size={18}/><span>سەرەکی</span></button>
  <button type="button" className={dashboard&&dashboardView==='orders'?'active':''} onClick={()=>user?openDashboard('orders'):(setAuthMode('login'),setAuth(true))}><PackageCheck size={18}/><span>داواکاری</span></button>
  <button type="button" className={dashboard&&dashboardView==='delivery'?'active':''} onClick={()=>openDashboard('delivery')}><Truck size={18}/><span>گەیاندن</span></button>
  <button type="button" className={dashboard&&dashboardView==='wallet'?'active':''} onClick={()=>user?openDashboard('wallet'):(setAuthMode('login'),setAuth(true))}><Wallet size={18}/><span>جزدان</span></button>
  <button type="button" className={dashboard&&dashboardView==='profile'?'active':''} onClick={()=>user?openDashboard('profile'):(setAuthMode('login'),setAuth(true))}><UserIcon size={18}/><span>هەژمار</span></button>
 </nav>
 {selectedProduct&&<div className="productDetailsBackdrop" role="presentation" onClick={()=>setSelectedProduct(null)}><div className="productDetailsModal" role="dialog" aria-modal="true" aria-labelledby="selected-product-title" onClick={event=>event.stopPropagation()}>
 <button type="button" className="productDetailsClose" aria-label="داخستنی زانیاریی بەرهەم" onClick={()=>setSelectedProduct(null)}>×</button>
 <div className="productDetailsImage" role="img" aria-label={selectedProduct.name_ku}>{selectedProduct.image_url?<img src={selectedProduct.image_url} alt={selectedProduct.name_ku} loading="eager" decoding="async"/>:<span className="productDetailsPlaceholder">🛍️</span>}</div>
 <div className="productDetailsBody">
  <div className="productDetailsMeta"><span>{selectedProduct.category||'بازاڕ'}</span><small>{selectedProduct.store_name||'دوکان'}</small></div>
  <h2 id="selected-product-title">{selectedProduct.name_ku}</h2>
  <p className="productDetailsType">{selectedProduct.product_type||'جۆر دیاری نەکراو'}{selectedProduct.brand?' · '+selectedProduct.brand:''}</p>
  {selectedFashionSizes.length>0&&<div className="productVariantBox"><b>قەبارەی بەردەست</b><div className="variantChoicePicker">{selectedFashionSizes.map(size=>{const available=isVariantChoiceAvailable(selectedProduct.variants,'size',size,selectedOptions);return <button type="button" key={size} disabled={!available} className={selectedOptions.size===size?'variantChoiceChip active':'variantChoiceChip'} aria-pressed={selectedOptions.size===size} aria-disabled={!available} onClick={()=>available&&setSelectedOptions(v=>({...v,size}))}>{size}</button>})}</div><small>قەبارەی بێ‌ستۆک هەڵنابژێردرێت.</small></div>}
  {selectedFashionColors.length>0&&<div className="productVariantBox"><b>ڕەنگی بەردەست</b><div className="variantChoicePicker">{selectedFashionColors.map(color=>{const available=isVariantChoiceAvailable(selectedProduct.variants,'color',color,selectedOptions);return <button type="button" key={color} disabled={!available} className={selectedOptions.color===color?'variantChoiceChip colorChip active':'variantChoiceChip colorChip'} aria-pressed={selectedOptions.color===color} aria-disabled={!available} onClick={()=>available&&setSelectedOptions(v=>({...v,color}))}>{color}</button>})}</div><small>ڕەنگی بێ‌ستۆک هەڵنابژێردرێت.</small></div>}
  {selectedShoeSizes.length>0&&<div className="productVariantBox"><b>ژمارەی پێلاوی بەردەست</b><div className="shoeSizePicker">{selectedShoeSizes.map(size=>{const available=isVariantChoiceAvailable(selectedProduct.variants,'shoe_size',size,selectedOptions);return <button type="button" key={size} disabled={!available} className={selectedOptions.shoe_size===size?'shoeSizeChip active':'shoeSizeChip'} aria-pressed={selectedOptions.shoe_size===size} aria-disabled={!available} onClick={()=>available&&setSelectedOptions(v=>({...v,shoe_size:size}))}>{size}</button>})}</div><small>ژمارەی بێ‌ستۆک هەڵنابژێردرێت.</small></div>}
  <div className="productDetailsPriceRow"><span>نرخی بەرهەم</span><strong>{selectedProduct.sale_price_iqd!=null&&Number(selectedProduct.sale_price_iqd)>0&&Number(selectedProduct.sale_price_iqd)<Number(selectedProduct.price_iqd)?<>{Number(selectedProduct.sale_price_iqd).toLocaleString('en-US')} د.ع <small style={{textDecoration:'line-through',opacity:.6}}>{Number(selectedProduct.price_iqd).toLocaleString('en-US')} د.ع</small></>:<>{Number(selectedProduct.price_iqd).toLocaleString('en-US')} د.ع</>}</strong></div>
  <div className="productDetailsStats">
   <div><small>بەردەستی</small><b>{selectedAvailability}</b></div>
   <div><small>دۆخ</small><b>{!selectedProduct.is_available?'بەردەست نییە':selectedVariantUnavailable?'ئەم کۆمبینەیشنە بەردەست نییە':selectedVariantInventory?selectedVariantInventory.unlimited_stock||Number(selectedVariantInventory.stock||0)>0?'بەردەستە':'بەردەست نییە':selectedProduct.unlimited_stock||Number(selectedProduct.stock||0)>0?'بەردەستە':'بەردەست نییە'}</b></div>
  </div>
  <button type="button" className="primary full productDetailsAdd" disabled={!selectedProduct.is_available||selectedVariantUnavailable||(!selectedVariantInventory&&selectedVariantInventoryRows.length===0&&!selectedVariantOptions.unlimited&&Number(selectedProduct.stock||0)<=0)||busy||(selectedShoeSizes.length>0&&!selectedOptions.shoe_size)||(selectedFashionSizes.length>0&&!selectedOptions.size)||(selectedFashionColors.length>0&&!selectedOptions.color)} onClick={async()=>{const added=await addToCart(selectedProduct,selectedOptions);if(added){setSelectedProduct(null);setSelectedOptions({})}}}>{selectedProduct.is_available&&((selectedVariantInventory?selectedVariantInventory.unlimited_stock||Number(selectedVariantInventory.stock||0)>0:(selectedVariantInventoryRows.length?selectedVariantInventoryRows.length>0&&selectedVariantSelectionComplete&&Boolean(selectedVariantInventory):selectedVariantOptions.unlimited||Number(selectedProduct.stock||0)>0)))?(selectedVariantUnavailable?'بەردەستی نییە':selectedShoeSizes.length&&!selectedOptions.shoe_size?'سەرەتا ژمارەی پێلاو هەڵبژێرە':selectedFashionSizes.length&&!selectedOptions.size?'سەرەتا قەبارە هەڵبژێرە':selectedFashionColors.length&&!selectedOptions.color?'سەرەتا ڕەنگ هەڵبژێرە':'زیادکردن بۆ سەلە'):'بەردەست نییە'}</button>
 </div>
 </div></div>}{message&&<div className="toast"><span>{message}</span><button onClick={()=>setMessage('')}><X size={16}/></button></div>}
 {cartOpen&&<div className="modal" role="presentation" onClick={()=>setCartOpen(false)}><div className="auth cartPanel" role="dialog" aria-modal="true" aria-labelledby="cart-title" onClick={event=>event.stopPropagation()}>
 <button type="button" className="x" aria-label="داخستنی سەلە" onClick={()=>setCartOpen(false)}>×</button>
 <div className="cartHead"><div><span>سەلەی شاخ</span><h2 id="cart-title">سەلەی من</h2><small>{cart.length.toLocaleString('ku-IQ')} جۆری بەرهەم</small></div><ShoppingBag className="cartHeadIcon"/></div>
 {!cart.length?<div className="empty"><ShoppingBag size={42}/><h3>سەلەکەت بەتاڵە</h3><p>بەرهەمەکان زیاد بکە بۆ دەستپێکردنی داواکاری.</p></div>:<><div className="cartList">{cart.map(i=><div className="cartRow" key={i.id}>
  <div className="cartItemInfo">{i.image_url?<img src={i.image_url} alt="" loading="lazy" decoding="async"/>:<span className="cartItemPlaceholder">🛍️</span>}<div><b>{i.name}</b><small>{i.price.toLocaleString('en-US')} د.ع · {i.unlimited_stock?'بێ‌سنوور':Number(i.stock||0).toLocaleString('ku-IQ')+' دانە'}</small>{i.options?.size&&<span className="cartItemOption">قەبارە: {String(i.options.size)}</span>}{i.options?.color&&<span className="cartItemOption">ڕەنگ: {String(i.options.color)}</span>}{i.options?.shoe_size&&<span className="cartItemOption">پێلاو: {String(i.options.shoe_size)}</span>}</div></div>
  <div className="qty"><button type="button" aria-label="کەمکردنەوە" onClick={()=>changeQty(i,-1)}><Minus size={15}/></button><b>{i.quantity}</b><button type="button" aria-label="زیادکردنەوە" onClick={()=>changeQty(i,1)}><Plus size={15}/></button><button type="button" className="danger" aria-label="سڕینەوەی بەرهەم" onClick={()=>changeQty(i,-i.quantity)}><Trash2 size={15}/></button></div>
 </div>)}</div>
 <div className="summary cartSummary"><div><span>کۆی بەرهەم</span><b>{subtotal.toLocaleString('en-US')} د.ع</b></div><div><span>گەیاندن</span><b>{delivery.toLocaleString('en-US')} د.ع</b></div><div><span>خزمەتی شاخ</span><b>{platformFee.toLocaleString('en-US')} د.ع</b></div><div className="grand"><span>کۆی گشتی</span><b>{total.toLocaleString('en-US')} د.ع</b></div></div>
 <button type="button" className="primary full cartCheckoutButton" onClick={()=>{if(!user){setCartOpen(false);setAuthMode('login');setAuth(true);setMessage('بۆ تەواوکردنی داواکارییەکەت، تکایە چوونەژوورەوە بکە.')}else setCheckoutOpen(true)}}>تەواوکردنی داواکاری</button></>}</div></div>}
 {checkoutOpen&&<div className="modal" role="presentation" onClick={()=>{setCheckoutOpen(false);setMapCoords(null);setExactLocationAddress('');setDeliveryNote('')}}><div className="auth checkoutPanel" role="dialog" aria-modal="true" aria-labelledby="checkout-title" onClick={event=>event.stopPropagation()}><button type="button" className="x" aria-label="داخستنی ناونیشانی گەیاندن" onClick={()=>{setCheckoutOpen(false);setMapCoords(null);setExactLocationAddress('');setDeliveryNote('')}}>×</button><div className="mark checkoutIcon"><MapPin/></div><h2 id="checkout-title">ناونیشانی گەیاندن</h2><p>ناونیشانی وردی شوێنی گەیاندنت بنووسە یان شوێنەکەت بە جی‌پی‌ئێس دیاری بکە.</p>{savedAddresses.length>0&&<div className="savedAddressList"><b>ناونیشانە پاشەکەوتکراوەکان</b>{savedAddresses.map(saved=><button type="button" className={selectedAddressId===saved.id?'savedAddress active':'savedAddress'} key={saved.id} onClick={()=>{setSelectedAddressId(saved.id);setExactLocationAddress(saved.address);setDeliveryNote(saved.delivery_note||'');setAddress(saved.address);setDeliveryCity(saved.city||'');setMapCoords(saved.latitude!=null&&saved.longitude!=null?{latitude:Number(saved.latitude),longitude:Number(saved.longitude)}:null)}}><span>{saved.label||'ناونیشان'}</span><small>{saved.address}</small>{saved.delivery_note&&<small>تێبینی: {saved.delivery_note}</small>}</button>)}</div>}<div className="checkoutAutoCity"><MapPin size={15}/><span>شار: {deliveryCity||'لە شوێنی هەڵبژێردراوەوە دیاری دەکرێت'}</span></div>
<label className="locationExactField"><span>ناونیشانی وردی شوێنی گەیاندن {locationLookupBusy&&<small> · ناونیشان دەدۆزرێتەوە...</small>}</span><input aria-label="ناونیشانی وردی شوێنی گەیاندن" value={mapCoords?exactLocationAddress:''} readOnly placeholder="لەسەر نەخشە شوێنی ورد دیاری بکە" /></label><label className="deliveryNoteField"><span>زانیاری زیاتر بۆ شوێنی گەیاندن</span><input aria-label="زانیاری زیاتر بۆ شوێنی گەیاندن" maxLength={500} value={deliveryNote} onChange={e=>{setDeliveryNote(e.target.value);setSelectedAddressId(null)}} placeholder="نموونە: مزگەوتی المهاجرینە" /></label><button type="button" className="locationFindButton full" onClick={detectLocation} disabled={locating}><MapPin size={17}/> {locating?'شوێنم دەدۆزێتەوە...':'دۆزینەوەی شوێنی من'}</button><InteractiveMapPicker value={mapCoords} onChange={(next)=>{setMapCoords(next);setSelectedAddressId(null);setExactLocationAddress(`شوێنی دیاریکراو لە نەخشە — ${next.latitude.toFixed(7)}, ${next.longitude.toFixed(7)}`);setLocationReady(true);queueReverseGeocode(next);setMessage('شوێنی وردی هەڵبژێردرا ✓');}} />{mapCoords&&<div className="mapSelectedLocationSummary"><MapPin size={15}/><span>شوێنی هەڵبژێردراو: {mapCoords.latitude.toFixed(7)}, {mapCoords.longitude.toFixed(7)}</span><a href={'https://www.google.com/maps/search/?api=1&query='+mapCoords.latitude+','+mapCoords.longitude} target="_blank" rel="noreferrer">لە نەخشەی گووگڵ</a></div>}<div className="couponCheckoutBox"><div className="couponCheckoutHead"><b>کۆپۆنی داشکاندن</b><small>کۆدی ئۆفەرەکەت بنووسە و پشکنینی بکە.</small></div><div className="couponCheckoutRow"><input value={couponCode} onChange={e=>{setCouponCode(e.target.value.toUpperCase());setCouponDiscount(0)}} placeholder="SHAKH10" autoComplete="off"/><button type="button" className="plain" disabled={couponBusy||!couponCode.trim()} onClick={()=>void previewCoupon()}>{couponBusy?'پشکنین...':'جێبەجێکردن'}</button></div>{couponDiscount>0&&<div className="couponApplied">داشکاندن: <b>{couponDiscount.toLocaleString('en-US')} د.ع</b></div>}<div className="summary checkoutCouponSummary"><div><span>کۆی پێش داشکاندن</span><b>{total.toLocaleString('en-US')} د.ع</b></div>{couponDiscount>0&&<div><span>داشکاندنی کۆپۆن</span><b>-{couponDiscount.toLocaleString('en-US')} د.ع</b></div>}<div className="grand"><span>کۆی کۆتایی</span><b>{checkoutTotal.toLocaleString('en-US')} د.ع</b></div></div></div><div className="paymentMethodPicker" aria-label="شێوازی پارەدان"><span className="paymentMethodTitle">شێوازی پارەدان</span><div className="paymentMethodOptions"><button type="button" className={paymentMethod==='cash'?'paymentMethodOption active':'paymentMethodOption'} onClick={()=>setPaymentMethod('cash')}><span>پارە لە کاتی گەیاندن</span><small>کاش — پارەدان لە کاتی وەرگرتن</small></button><button type="button" className={paymentMethod==='wallet'?'paymentMethodOption active':'paymentMethodOption'} onClick={()=>setPaymentMethod('wallet')}><span>پارە لە جزدان</span><small>لە باڵانسی جزدانی شاخ کەم دەکرێتەوە</small></button><button type="button" className={paymentMethod==='referral_wallet'?'paymentMethodOption active':'paymentMethodOption'} onClick={()=>setPaymentMethod('referral_wallet')} disabled={referralWalletBalance<checkoutTotal}><span>قازانجی پۆستەکان</span><small>باڵانس: {referralWalletBalance.toLocaleString('en-US')} د.ع — بۆ کڕین لە شاخ</small></button></div></div><button className="primary full" disabled={busy} onClick={checkout}>{busy?'تکایە چاوەڕێ بکە':'تۆمارکردنی داواکاری'}</button></div></div>}
 {dashboard&&user&&<DashboardShell
  user={user}
  role={role}
  roleLabel={roleLabel}
  view={dashboardView}
  orders={orders}
  dirty={dashboardDirty}
  onSelectView={(next)=>openDashboard(next)}
  onClose={closeDashboard}
  onRefresh={()=>loadOrders(user)}
  homeContent={
   role==='super_admin'
    ? <SuperAdminControlCenter onNavigate={openDashboard} />
    : role==='admin'
    ? <AdminControlCenter onNavigate={openDashboard} />
    : role==='customer'
    ? <CustomerControlCenter userId={user.id} onNavigate={openDashboard} />
    : role==='captain'
    ? <CaptainControlCenter onNavigate={openDashboard} />
    : role==='vendor'
    ? <VendorControlCenter userId={user.id} onNavigate={openDashboard} />
    : role==='restaurant_vendor'
    ? <RestaurantControlCenter userId={user.id} onNavigate={openDashboard} />
    : role==='supermarket_vendor'
    ? <SupermarketControlCenter userId={user.id} onNavigate={openDashboard} />
    : role==='fashion_vendor'
    ? <FashionControlCenter userId={user.id} onNavigate={openDashboard} />
    : role==='electronics_vendor'
    ? <ElectronicsControlCenter userId={user.id} onNavigate={openDashboard} />
    : role==='jewelry_vendor'
    ? <JewelryControlCenter userId={user.id} onNavigate={openDashboard} />
    : <section className="dashboardShellRecentOrders" aria-labelledby="dashboard-recent-orders-title">
      <div className="dashboardShellRecentOrdersHead">
       <div><span>بەدواداچوونی</span><h2 id="dashboard-recent-orders-title">نوێترین ئۆردەرەکان</h2></div>
       <button type="button" onClick={()=>openDashboard('orders')}>هەمووی ببینە</button>
      </div>
      {!orders.length
        ? <div className="dashboardShellRecentEmpty">هێشتا هیچ ئۆردەرێکت نییە.</div>
        : <div className="dashboardShellRecentList">
         {orders.slice(0,6).map((order)=>(
          <button type="button" className="dashboardShellRecentRow" key={order.id} onClick={()=>openDashboard('orders')}>
           <span className="dashboardShellRecentId">#{order.id.slice(0,8)}</span>
           <span className="dashboardShellRecentStatus">{order.status==='pending'?'چاوەڕوان':dashboardStatusLabel[order.status]||order.status}</span>
           <strong>{Number(order.total_iqd).toLocaleString('ku-IQ')} د.ع</strong>
           <small>{new Date(order.created_at).toLocaleString('ku-IQ')}</small>
          </button>
         ))}
        </div>}
     </section>
  } >
  {dashboardView!=='home'&&dashboardModule()}
 </DashboardShell>}

 {auth&&<div className="modal" role="presentation" onClick={()=>setAuth(false)}><div className="auth" role="dialog" aria-modal="true" aria-label="چوونەژوورەوە و دروستکردنی هەژمار" onClick={event=>event.stopPropagation()}><button type="button" className="x" aria-label="داخستنی چوونەژوورەوە" onClick={()=>setAuth(false)}>×</button><div className="brandMark"><img src="/shakh-logo.svg?v=1.9.8" alt="شاخ" /></div>{authMode==='reset'?<><h2>گەڕاندنەوەی وشەی نهێنی</h2><p>لینکی گۆڕینی وشەی نهێنی بۆ ئیمەیڵەکەت دەنێرین.</p><input value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="ئیمەیڵ"/><button className="primary full" onClick={()=>void reset()} disabled={busy}>{busy?'لینک دەنێردرێت...':'ناردنی لینک'}</button><button className="reset" onClick={()=>setAuthMode('login')}>گەڕانەوە بۆ چوونەژوورەوە</button></>:<><h2>{authMode==='login'?'بەخێربێیت بۆ شاخ':'هەژماری نوێ دروست بکە'}</h2>{authMode==='signup'&&<><input value={name} onChange={e=>setName(e.target.value)} placeholder="ناوی تەواو"/><div style={{margin:'10px 0 12px'}}><label style={{display:'block',marginBottom:8,fontWeight:900}}>جۆری هەژمار هەڵبژێرە</label><div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:8}}><button type="button" onClick={()=>setSignupRole('customer')} style={{border:signupRole==='customer'?'2px solid #ff6a00':'1px solid #e7ecf2',background:signupRole==='customer'?'#fff4ea':'#fff',borderRadius:12,padding:'10px 8px',fontWeight:800,color:'#081a33'}}>👤 کڕیار</button><button type="button" onClick={()=>setSignupRole('restaurant_vendor')} style={{border:signupRole==='restaurant_vendor'?'2px solid #ff6a00':'1px solid #e7ecf2',background:signupRole==='restaurant_vendor'?'#fff4ea':'#fff',borderRadius:12,padding:'10px 8px',fontWeight:800,color:'#081a33'}}>🍽️ چێشتخانە</button><button type="button" onClick={()=>setSignupRole('supermarket_vendor')} style={{border:signupRole==='supermarket_vendor'?'2px solid #ff6a00':'1px solid #e7ecf2',background:signupRole==='supermarket_vendor'?'#fff4ea':'#fff',borderRadius:12,padding:'10px 8px',fontWeight:800,color:'#081a33'}}>🛒 سووپەرمارکێت</button><button type="button" onClick={()=>setSignupRole('fashion_vendor')} style={{border:signupRole==='fashion_vendor'?'2px solid #ff6a00':'1px solid #e7ecf2',background:signupRole==='fashion_vendor'?'#fff4ea':'#fff',borderRadius:12,padding:'10px 8px',fontWeight:800,color:'#081a33'}}>👕 جل و بەرگ</button><button type="button" onClick={()=>setSignupRole('vendor')} style={{border:signupRole==='vendor'?'2px solid #ff6a00':'1px solid #e7ecf2',background:signupRole==='vendor'?'#fff4ea':'#fff',borderRadius:12,padding:'10px 8px',fontWeight:800,color:'#081a33'}}>🏪 خاوەن دوکان</button><button type="button" onClick={()=>setSignupRole('electronics_vendor')} style={{border:signupRole==='electronics_vendor'?'2px solid #ff6a00':'1px solid #e7ecf2',background:signupRole==='electronics_vendor'?'#fff4ea':'#fff',borderRadius:12,padding:'10px 8px',fontWeight:800,color:'#081a33'}}>📱 ئەلیکترۆنیات</button><button type="button" onClick={()=>setSignupRole('jewelry_vendor')} style={{border:signupRole==='jewelry_vendor'?'2px solid #ff6a00':'1px solid #e7ecf2',background:signupRole==='jewelry_vendor'?'#fff4ea':'#fff',borderRadius:12,padding:'10px 8px',fontWeight:800,color:'#081a33'}}>💎 جواکاری</button><button type="button" onClick={()=>setSignupRole('car_dealer')} style={{border:signupRole==='car_dealer'?'2px solid #ff6a00':'1px solid #e7ecf2',background:signupRole==='car_dealer'?'#fff4ea':'#fff',borderRadius:12,padding:'10px 8px',fontWeight:800,color:'#081a33'}}>🚗 پێشانگای ئۆتۆمبێل</button><button type="button" onClick={()=>setSignupRole('umrah_agency')} style={{border:signupRole==='umrah_agency'?'2px solid #ff6a00':'1px solid #e7ecf2',background:signupRole==='umrah_agency'?'#fff4ea':'#fff',borderRadius:12,padding:'10px 8px',fontWeight:800,color:'#081a33'}}>🕋 کۆمپانیای حەج و عومرە</button><button type="button" onClick={()=>setSignupRole('captain')} style={{border:signupRole==='captain'?'2px solid #ff6a00':'1px solid #e7ecf2',background:signupRole==='captain'?'#fff4ea':'#fff',borderRadius:12,padding:'10px 8px',fontWeight:800,color:'#081a33'}}>🛵 کاپتن</button></div></div><label className="privacyConsentRow"><input type="checkbox" checked={privacyAccepted} onChange={event=>setPrivacyAccepted(event.target.checked)}/><span>سیاسەتی پاراستنی نهێنی پەسەند دەکەم</span><button type="button" className="privacyInlineButton" onClick={()=>setPrivacyOpen(true)}>بینینی سیاسەت</button></label>{confirmationPendingEmail&&<button type="button" className="resendConfirmationButton" onClick={()=>void resendConfirmation()}>دووبارە ناردنەوەی ئیمەیڵی پشتڕاستکردنەوە</button>}</>}<input value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="ئیمەیڵ"/><input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="وشەی نهێنی"/><button className="primary full" onClick={authMode==='login'?login:signup}>{authMode==='login'?'چوونەژوورەوە':'تۆمارکردن'}</button><div className="or">یان</div><button className="google" onClick={google}>چوونەژوورەوە بە گووگڵ</button>{authMode==='login'&&<button className="reset" onClick={()=>setAuthMode('reset')}>وشەی نهێنیت لەبیرچووە؟</button>}<button className="reset" onClick={()=>authMode==='login'?beginSignup():setAuthMode('login')}>{authMode==='login'?'هەژمارت نییە؟ تۆماربە':'هەژمارت هەیە؟ بچۆ ژوورەوە'}</button>{message&&<small className="msg">{message}</small>}</>}</div></div>}
 {privacyOpen&&<div className="modal" role="presentation" onClick={()=>setPrivacyOpen(false)}><div className="auth privacyModal" role="dialog" aria-modal="true" aria-labelledby="privacy-title" onClick={event=>event.stopPropagation()}><button type="button" className="x" aria-label="داخستنی سیاسەتی پاراستنی نهێنی" onClick={()=>setPrivacyOpen(false)}>×</button><div className="mark privacyMark"><ShieldCheck/></div><h2 id="privacy-title">سیاسەتی پاراستنی نهێنی</h2><p>شاخ زانیارییەکانی هەژمار، ناونیشان، ئۆردەر و پەیوەندییەکانت بۆ بەڕێوەبردنی خزمەتگوزارییەکە بەکاردهێنێت. زانیاریی کەسی بەبێ پێویستی خزمەتگوزاری یان پێویستی یاسایی بە لایەنی سێیەم نادرێت.</p><div className="privacyPoints"><span>🔒 پاراستنی هەژمار و چوونەژوورەوە</span><span>📍 بەکارهێنانی شوێن بۆ خزمەتگوزارییەکانی شاخ</span><span>🧾 پاراستنی زانیاریی ئۆردەر و پارەدان بە ڕۆڵ و RLS</span><span>✉️ بەکارهێنانی ئیمەیڵ بۆ پشتڕاستکردنەوە و گەڕاندنەوەی وشەی نهێنی</span></div><div className="privacyActions"><button type="button" className="reset" onClick={()=>{setPrivacyAccepted(false);setPrivacyOpen(false)}}>ڕەتکردنەوە</button><button type="button" className="primary" onClick={()=>{setPrivacyAccepted(true);setPrivacyOpen(false);setMessage('سیاسەتی پاراستنی نهێنی پەسەند کرا.')}}>پەسەندکردن و بەردەوامبوون</button></div></div></div>}
 </div>;
}

 const path=window.location.pathname;
createRoot(document.getElementById('root')!).render(path==='/reset-password'?<PasswordReset/>:<App/>);