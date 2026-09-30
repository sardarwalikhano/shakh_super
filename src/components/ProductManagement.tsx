import React,{useEffect,useMemo,useState} from 'react';
import {Edit3,Save,Trash2,X} from 'lucide-react';
import {supabase} from '../lib/supabase';

type VariantInventoryEntry={size?:string;color?:string;shoe_size?:string;stock?:number;unlimited_stock?:boolean};
type Product={
 id:string;
 store_id:string;
 name_ku:string;
 price_iqd:number;
 sale_price_iqd?:number|null;
 stock?:number|null;
 unlimited_stock?:boolean|null;
 product_type?:string|null;
 brand?:string|null;
 size?:string|null;
 image_url?:string|null;
 is_available:boolean;
 variants?:unknown;
};
type Props={userId:string;role:string;onChanged?:()=>void};

const variantSummary=(variants:unknown)=>{
 const sizes=new Set<string>(),colors=new Set<string>(),shoeSizes=new Set<string>();
 if(!Array.isArray(variants))return{sizes:[],colors:[],shoeSizes:[],unlimited:false,inventory:[] as VariantInventoryEntry[]};
 const add=(target:Set<string>,value:unknown)=>{const values=Array.isArray(value)?value:[value];for(const item of values){if(typeof item==='string'&&item.trim())target.add(item.trim());else if(typeof item==='number')target.add(String(item))}};
 let unlimited=false;
 const inventory:VariantInventoryEntry[]=[];
 for(const item of variants){if(!item||typeof item!=='object')continue;const v=item as Record<string,unknown>;unlimited=unlimited||v.unlimited_stock===true;
  if(Array.isArray(v.variant_inventory))for(const row of v.variant_inventory){if(row&&typeof row==='object'){const item=row as VariantInventoryEntry;inventory.push(item);unlimited=unlimited||item.unlimited_stock===true;}}add(sizes,v.available_sizes);add(sizes,v.sizes);add(colors,v.available_colors);add(colors,v.colors);add(colors,v.color);add(shoeSizes,v.shoe_sizes);add(shoeSizes,v.shoeSizes);}
 return{sizes:[...sizes],colors:[...colors],shoeSizes:[...shoeSizes],unlimited,inventory};
};

const CLOTHING_SIZES=['XS','S','M','L','XL','XXL','3XL','28','30','32','34','36','38','40','42','44'];
const COLORS=['ڕەش','سپی','خۆڵەمەشی','قاوەیی','شین','سۆر','سەوز','زەرد','پەمەیی','کەسک'];
const SHOE_SIZES=['35','36','37','38','39','40','41','42','43','44','45','46'];
const comboKey=(row:{size?:string;color?:string;shoe_size?:string})=>[row.size||'',row.shoe_size||'',row.color||''].join('¦');

const vendorCategories:Record<string,string[]>={
 restaurant_vendor:['restaurant'],supermarket_vendor:['supermarket'],fashion_vendor:['fashion'],vendor:['daily'],electronics_vendor:['electronics'],jewelry_vendor:['jewelry']
};

export default function ProductManagement({userId,role,onChanged}:Props){
 const [items,setItems]=useState<Product[]>([]),[loading,setLoading]=useState(true),[editing,setEditing]=useState<Product|null>(null),[editingVariants,setEditingVariants]=useState({sizes:[] as string[],colors:[] as string[],shoeSizes:[] as string[]}),[editingVariantInventory,setEditingVariantInventory]=useState<VariantInventoryEntry[]>([]),[editingVariantSync,setEditingVariantSync]=useState(false),[message,setMessage]=useState('');

 const load=async()=>{
  setLoading(true);
  const cats=vendorCategories[role]||[];
  const {data:stores}=await supabase.from('stores').select('id').eq('owner_id',userId).in('category',cats);
  const ids=(stores||[]).map((s:any)=>s.id);
  if(!ids.length){setItems([]);setLoading(false);return}
  const {data,error}=await supabase.from('products').select('id,store_id,name_ku,price_iqd,sale_price_iqd,stock,product_type,brand,size,image_url,is_available,variants').in('store_id',ids).order('created_at',{ascending:false});
  if(error)setMessage(error.message);else setItems(((data||[]) as Product[]).map(p=>({...p,unlimited_stock:variantSummary(p.variants).unlimited})));
  setLoading(false);
 };

 useEffect(()=>{void load()},[userId,role]);

 const lowStockCount=useMemo(()=>items.filter(p=>!p.unlimited_stock&&Number(p.stock||0)>0&&Number(p.stock||0)<=5).length,[items]);
 const outOfStockCount=useMemo(()=>items.filter(p=>!p.unlimited_stock&&Number(p.stock||0)<=0).length,[items]);

 const setEditVariant=(key:'sizes'|'colors'|'shoeSizes',value:string)=>{
  setEditingVariantSync(true);
  setEditingVariants(v=>({...v,[key]:v[key].includes(value)?v[key].filter(item=>item!==value):[...v[key],value]}));
 };
 const startEdit=(p:Product)=>{
  setEditing(p);
  const summary=variantSummary(p.variants);
  setEditingVariants(summary);
  setEditingVariantInventory(summary.inventory);
  setEditingVariantSync(summary.inventory.length>0);
 };
 useEffect(()=>{
  if(role!=='fashion_vendor'||!editingVariantSync)return;
  const primary=editingVariants.shoeSizes.length?editingVariants.shoeSizes:editingVariants.sizes;
  const combos=primary.flatMap(value=>editingVariants.colors.map(color=>editingVariants.shoeSizes.length?{shoe_size:value,color}:{size:value,color}));
  setEditingVariantInventory(current=>{
    const map=new Map(current.map(row=>[comboKey(row),row] as const));
    return combos.map(combo=>map.get(comboKey(combo))||{...combo,stock:0,unlimited_stock:false});
  });
 },[role,editingVariantSync,JSON.stringify(editingVariants.sizes),JSON.stringify(editingVariants.shoeSizes),JSON.stringify(editingVariants.colors)]);
 const updateVariantInventory=(index:number,patch:Partial<VariantInventoryEntry>)=>{
  setEditingVariantInventory(rows=>rows.map((row,i)=>i===index?{...row,...patch}:row));
 };
 const buildVariants=(p:Product)=>{
  const base=Array.isArray(p.variants)?p.variants:[];
  const next=base.length?base.map((item,index)=>index===0&&item&&typeof item==='object'?{
    ...(item as Record<string,unknown>),
    available_sizes:editingVariants.sizes,
    available_colors:editingVariants.colors,
    shoe_sizes:editingVariants.shoeSizes,
    ...(editingVariantInventory.length?{variant_inventory:editingVariantInventory}:{}),
  }:item):[{
    section:role,
    category:'fashion',
    available_sizes:editingVariants.sizes,
    available_colors:editingVariants.colors,
    shoe_sizes:editingVariants.shoeSizes,
  }];
  return next;
 };
 const update=async(p:Product)=>{
  const matrixHasUnlimited=editingVariantInventory.some(row=>row.unlimited_stock===true);
  const matrixStock=editingVariantInventory.reduce((sum,row)=>sum+(row.unlimited_stock?0:Math.max(0,Math.floor(Number(row.stock)||0))),0);
  const stock=editingVariantInventory.length?matrixStock:Math.max(0,Math.floor(Number(p.stock)||0));
  const price=Number(p.price_iqd);
  const sale=p.sale_price_iqd==null||Number(p.sale_price_iqd)<=0?null:Number(p.sale_price_iqd);
  if(!Number.isFinite(price)||price<=0)return setMessage('نرخ دەبێت زیاتر لە سفر بێت.');
  if(sale!==null&&sale>price)return setMessage('نرخی داشکان نابێت لە نرخی سەرەکی زیاتر بێت.');
  const {error}=await supabase.from('products').update({
   name_ku:p.name_ku.trim(),
   price_iqd:price,
   sale_price_iqd:p.sale_price_iqd!=null&&Number(p.sale_price_iqd)>0?Number(p.sale_price_iqd):null,
   product_type:p.product_type?.trim()||null,
   brand:p.brand?.trim()||null,
   size:p.size?.trim()||null,
   stock,
   is_available:editingVariantInventory.length?(matrixHasUnlimited||stock>0):p.is_available,
   variants:buildVariants(p)
  }).eq('id',p.id);
  if(error)return setMessage(error.message);
  const saved={...p,stock,unlimited_stock:editingVariantInventory.length?matrixHasUnlimited:p.unlimited_stock,variants:buildVariants(p),size:editingVariants.sizes.join(', ')||p.size,is_available:editingVariantInventory.length?(matrixHasUnlimited||stock>0):p.is_available};
  setItems(x=>x.map(i=>i.id===p.id?saved:i));
  if(role==='fashion_vendor'){
   const variantPayload={available_sizes:editingVariants.sizes,available_colors:editingVariants.colors,shoe_sizes:editingVariants.shoeSizes,variant_inventory:editingVariantInventory,stock,unlimited_stock:matrixHasUnlimited};
   const {data:linkedPosts}=await supabase.from('posts').select('id,listing_details').eq('author_id',userId).contains('listing_details',{product_id:p.id});
   for(const post of (linkedPosts||[]) as {id:string;listing_details?:Record<string,unknown>|null}[]){
    await supabase.from('posts').update({listing_details:{...(post.listing_details||{}),...variantPayload,size:editingVariants.sizes.join(', ')||null,color:editingVariants.colors.join(', ')||null,shoe_sizes:editingVariants.shoeSizes,inventory_stock:matrixHasUnlimited?null:stock,unlimited_stock:matrixHasUnlimited}}).eq('id',post.id).eq('author_id',userId);
   }
  }
  setEditing(null);
  setEditingVariants({sizes:[],colors:[],shoeSizes:[]});
  setEditingVariantInventory([]);
  setEditingVariantSync(false);
  setMessage('بەرهەمەکە نوێکرایەوە.');
  onChanged?.();
 };

 const remove=async(p:Product)=>{
  if(!window.confirm('دڵنیایت لە سڕینەوەی ئەم بەرهەمە؟'))return;
  const {error}=await supabase.from('products').delete().eq('id',p.id);
  if(error)return setMessage(error.message);
  setItems(x=>x.filter(i=>i.id!==p.id));
  setMessage('بەرهەمەکە سڕایەوە.');
  onChanged?.();
 };

 return <section className="orderCard" style={{marginTop:18}}>
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
   <div>
    <span className="eyebrow">بەڕێوەبردن</span>
    <h3 style={{margin:'6px 0 2px'}}>بەرهەمەکانم</h3>
    <small>دەستکاری، ستۆک، بەردەستی و سڕینەوە</small>
   </div>
   <b>{items.length.toLocaleString('ku-IQ')}</b>
  </div>

  {!loading&&items.length>0&&<div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:12}}>
   <span className="orderCard" style={{padding:'8px 10px',margin:0}}>کەم‌ستۆک: {lowStockCount.toLocaleString('ku-IQ')}</span>
   <span className="orderCard" style={{padding:'8px 10px',margin:0}}>بێ‌ستۆک: {outOfStockCount.toLocaleString('ku-IQ')}</span>
  </div>}

  {loading?<div className="empty">چاوەڕێ بکە...</div>:!items.length?<div className="empty"><h4>هێشتا بەرهەمێکت نییە</h4><p>لە فۆڕمی پۆستکردنەوە بەرهەمێک زیاد بکە.</p></div>:<div className="dashboardGrid">{items.map(p=>{
    const stock=Number(p.stock||0);
    const variants=variantSummary(p.variants);
    return editing?.id===p.id?<div className="orderCard" key={p.id}>
     <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}><b>دەستکاریکردنی بەرهەم</b><button className="plain" onClick={()=>{setEditing(null);setEditingVariants({sizes:[],colors:[],shoeSizes:[]});setEditingVariantInventory([]);setEditingVariantSync(false)}}><X size={16}/></button></div>
     <input value={editing.name_ku} onChange={e=>setEditing({...editing,name_ku:e.target.value})} placeholder="ناو"/>
     <input value={editing.product_type||''} onChange={e=>setEditing({...editing,product_type:e.target.value})} placeholder="جۆر"/>
     <input value={editing.brand||''} onChange={e=>setEditing({...editing,brand:e.target.value})} placeholder="مارکە"/>
     <input value={editing.size||''} onChange={e=>setEditing({...editing,size:e.target.value})} placeholder="قەبارەی legacy"/>
     <input value={String(editing.price_iqd)} onChange={e=>setEditing({...editing,price_iqd:Number(e.target.value)||0})} inputMode="numeric" placeholder="نرخ"/><input value={editing.sale_price_iqd==null?'':String(editing.sale_price_iqd)} onChange={e=>setEditing({...editing,sale_price_iqd:e.target.value===''?null:Number(e.target.value)||0})} inputMode="numeric" placeholder="نرخی داشکان (ئارەزوومەندانە)"/>
     <label><input type="checkbox" checked={Boolean(editing.unlimited_stock)} onChange={e=>setEditing({...editing,unlimited_stock:e.target.checked})}/> بێ‌سنوورە ∞</label>
     {role==='fashion_vendor'&&<div className="productVariantEditor">
       <b>قەبارە و ڕەنگی بەردەست</b>
       <span>قەبارە</span><div className="postChoiceGrid">{CLOTHING_SIZES.map(value=><button type="button" key={value} className={editingVariants.sizes.includes(value)?'postChoiceChip active':'postChoiceChip'} onClick={()=>setEditVariant('sizes',value)}>{value}</button>)}</div>
       <span>ڕەنگ</span><div className="postChoiceGrid postColorChoiceGrid">{COLORS.map(value=><button type="button" key={value} className={editingVariants.colors.includes(value)?'postChoiceChip active':'postChoiceChip'} onClick={()=>setEditVariant('colors',value)}>{value}</button>)}</div>
       <span>ژمارەی پێلاو</span><div className="postChoiceGrid">{SHOE_SIZES.map(value=><button type="button" key={value} className={editingVariants.shoeSizes.includes(value)?'postChoiceChip active':'postChoiceChip'} onClick={()=>setEditVariant('shoeSizes',value)}>{value}</button>)}</div>
     </div>}
     {editingVariantInventory.length>0&&<div className="variantInventoryEditor">
       <div className="postComposerLabel">📦 ستۆکی هەر هەڵبژاردە</div>
       <div className="variantInventoryList">{editingVariantInventory.map((row,index)=><div className="variantInventoryRow" key={comboKey(row)+index}>
        <div className="variantInventoryIdentity">{row.shoe_size&&<b>پێلاو {row.shoe_size}</b>}{row.size&&<b>قەبارە {row.size}</b>}{row.color&&<span>{row.color}</span>}</div>
        <div className="variantInventoryControls">
         <input inputMode="numeric" min="0" value={row.unlimited_stock?'':String(row.stock??0)} disabled={Boolean(row.unlimited_stock)} onChange={e=>updateVariantInventory(index,{stock:Math.max(0,Math.floor(Number(e.target.value)||0))})} placeholder="٠"/>
         <button type="button" className={row.unlimited_stock?'postChoiceChip active':'postChoiceChip'} onClick={()=>updateVariantInventory(index,{unlimited_stock:!row.unlimited_stock})}>{row.unlimited_stock?'∞ بێ‌سنوور':'بێ‌سنوور ∞'}</button>
        </div>
       </div>)}</div>
       <small>بڕی هەر قەبارە/ڕەنگ/ژمارە بە جیاوازی پاشەکەوت دەکرێت.</small>
      </div>}
     {!editing.unlimited_stock&&<label>ژمارەی ستۆک<input type="number" min="0" step="1" value={String(editing.stock??0)} onChange={e=>setEditing({...editing,stock:Math.max(0,Math.floor(Number(e.target.value)||0))})} inputMode="numeric" placeholder="بڕی بەردەست"/></label>}
     <label><input type="checkbox" checked={editing.is_available||Boolean(editing.unlimited_stock)} onChange={e=>setEditing({...editing,is_available:e.target.checked})}/> لە بازاڕدا بەردەستە</label>
     <button className="primary full" onClick={()=>void update(editing)}><Save size={16}/> پاشەکەوتکردن</button>
    </div>:<article className="orderCard" key={p.id}>
     {p.image_url&&<img src={p.image_url} alt={p.name_ku} style={{width:'100%',height:150,objectFit:'cover',borderRadius:12,marginBottom:8}}/>}
     <div className="orderCardTop"><strong>{p.name_ku}</strong><span>{p.is_available?(p.unlimited_stock?'بێ‌سنوور ∞':stock>0?'بەردەستە':'ستۆکی نەماوە'):'ناچالاکە'}</span></div>
     <small>{p.product_type||'—'}{p.brand?' · '+p.brand:''}</small>{(variants.sizes.length||variants.colors.length||variants.shoeSizes.length)&&<div className="productVariantSummary">{variants.sizes.length>0&&<span>قەبارە: {variants.sizes.join('، ')}</span>}{variants.colors.length>0&&<span>ڕەنگ: {variants.colors.join('، ')}</span>}{variants.shoeSizes.length>0&&<span>پێلاو: {variants.shoeSizes.join('، ')}</span>}</div>}
     <div className="orderTotal">{p.sale_price_iqd!=null&&Number(p.sale_price_iqd)>0&&Number(p.sale_price_iqd)<Number(p.price_iqd)?<><b>{Number(p.sale_price_iqd).toLocaleString('en-US')} د.ع</b> <small style={{textDecoration:'line-through',opacity:.65}}>{Number(p.price_iqd).toLocaleString('en-US')} د.ع</small></>:<>{Number(p.price_iqd).toLocaleString('en-US')} د.ع</>}</div>
     <div style={{marginTop:7}}><small>{p.unlimited_stock?'بەردەستی: بێ‌سنوور ∞':<>ستۆک: <b>{stock.toLocaleString('ku-IQ')}</b></>}</small></div>
     <div style={{display:'flex',gap:8,marginTop:8}}><button className="primary" onClick={()=>startEdit(p)}><Edit3 size={16}/> دەستکاری</button><button className="reset" onClick={()=>void remove(p)}><Trash2 size={16}/> سڕینەوە</button></div>
    </article>
  })}</div>}

  {message&&<div className="msg" style={{marginTop:10}}>{message}</div>}
 </section>;
}
