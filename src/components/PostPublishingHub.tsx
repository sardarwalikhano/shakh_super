import React,{useEffect,useMemo,useState} from 'react';
import {Megaphone,MessageCircle,ShoppingBag,Truck,Car,Plane,Store,Shirt,Smartphone,Diamond,Utensils,LayoutGrid,ArrowRight} from 'lucide-react';
import ShakhStorePostComposer from './ShakhStorePostComposer';
import RolePostComposer from './RolePostComposer';

type Props={userId:string;role:string;onSaved?:()=>void};

type Category={
 id:string;
 kind:'store'|'role';
 value:string;
 label:string;
 description:string;
 icon:React.ComponentType<{size?:number}>;
};

const iconMap:Record<string,Category['icon']>={
 food:Utensils,supermarket:ShoppingBag,fashion:Shirt,marketplace:Store,electronics:Smartphone,jewelry:Diamond,
 general:LayoutGrid,delivery:Truck,car:Car,umrah:Plane,announcement:Megaphone,support:MessageCircle
};

const roleCategories=(role:string):Category[]=>{
 if(role==='super_admin')return[
  {id:'food',kind:'store',value:'restaurant',label:'خواردن',description:'چێشتخانە و خواردنی شاخ',icon:Utensils},
  {id:'supermarket',kind:'store',value:'supermarket',label:'سووپەرمارکێت',description:'بەرهەم و پێداویستییەکانی ڕۆژانە',icon:ShoppingBag},
  {id:'fashion',kind:'store',value:'fashion',label:'جل و بەرگ',description:'پۆشاک و جلوبەرگی نوێ',icon:Shirt},
  {id:'marketplace',kind:'store',value:'marketplace',label:'بازاڕ',description:'بەرهەمە گشتییەکانی شاخ',icon:Store},
  {id:'electronics',kind:'store',value:'electronics',label:'ئەلیکترۆنیات',description:'مۆبایل و ئامێرە ئەلیکترۆنییەکان',icon:Smartphone},
  {id:'jewelry',kind:'store',value:'jewelry',label:'جواهرات',description:'زێڕ، زیو و جواهرات',icon:Diamond},
  {id:'announcement',kind:'role',value:'announcement',label:'ئاگاداری',description:'ڕاگەیاندن و ئاگادارییەکانی شاخ',icon:Megaphone},
  {id:'support',kind:'role',value:'support',label:'پشتگیری',description:'پۆستی پشتیوانی و خزمەتگوزاری',icon:MessageCircle}
 ];
 if(role==='customer')return[
  {id:'general',kind:'role',value:'general',label:'پۆستی گشتی',description:'بیرۆکە، دەق و پۆستی گشتی',icon:LayoutGrid},
  {id:'marketplace',kind:'role',value:'marketplace',label:'بازاڕ',description:'پۆستی بەرهەم و کڕین و فرۆشتن',icon:Store}
 ];
 if(role==='captain')return[{id:'delivery',kind:'role',value:'delivery',label:'گەیاندن',description:'پۆستی پەیوەندیدار بە گەیاندن',icon:Truck}];
 if(role==='car_dealer')return[{id:'car',kind:'role',value:'car',label:'SHAKH Cars',description:'پۆستی ئۆتۆمبێل و پێشانگا',icon:Car}];
 if(role==='umrah_agency')return[{id:'umrah',kind:'role',value:'umrah',label:'حەج و عومرە',description:'پۆستی گەشت و پەکێجی عومرە',icon:Plane}];
 if(role==='admin')return[
  {id:'announcement',kind:'role',value:'announcement',label:'ئاگاداری',description:'ڕاگەیاندنی بەڕێوەبەرایەتی',icon:Megaphone},
  {id:'support',kind:'role',value:'support',label:'پشتگیری',description:'پۆستەکانی پشتیوانی',icon:MessageCircle}
 ];
 if(role==='support')return[
  {id:'support',kind:'role',value:'support',label:'پشتگیری',description:'پۆستی پشتیوانی و خزمەتگوزاری',icon:MessageCircle},
  {id:'announcement',kind:'role',value:'announcement',label:'ئاگاداری',description:'ئاگادارییە گرنگەکان',icon:Megaphone}
 ];
 return[];
};

export default function PostPublishingHub({userId,role,onSaved}:Props){
 const categories=useMemo(()=>roleCategories(role),[role]);
 const [selected,setSelected]=useState<Category|null>(null);
 useEffect(()=>setSelected(null),[role]);

 return <section className="postPublishingHub" aria-label="ناوەندی پۆستکردن">
  <div className="postHubHeader">
   <div>
    <span>ناوەندی بڵاوکردنەوە</span>
    <h2>{selected?'فۆڕمی '+selected.label:'چی دەتەوێت بڵاو بکەیتەوە؟'}</h2>
    <p>{selected?'تەنها ناوەڕۆکی ئەم کاتەگۆرییە دەبینیت.':'یەکێک لە کاتەگۆرییەکان هەڵبژێرە تا فۆڕمی پەیوەندیدار بکرێتەوە.'}</p>
   </div>
   {selected&&<button type="button" className="plain postHubBack" onClick={()=>setSelected(null)}><ArrowRight size={16}/> گەڕانەوە بۆ کاتەگۆرییەکان</button>}
  </div>

  <div className="postHubGrid postHubGridPersistent">
   {categories.map(item=>{const Icon=item.icon||iconMap[item.value]||LayoutGrid;return <button key={item.id} type="button" className={selected?.id===item.id?'postHubCard active':'postHubCard'} aria-pressed={selected?.id===item.id} onClick={()=>setSelected(item)}>
    <span className="postHubIcon"><Icon size={24}/></span>
    <span className="postHubCardText"><b>{item.label}</b><small>{item.description}</small></span>
    <ArrowRight size={17} className="postHubArrow"/>
   </button>})}
  </div>

  {selected&&<div className="postHubSelectedForm">
   {selected.kind==='store'
    ?<ShakhStorePostComposer key={selected.id} userId={userId} initialSection={selected.value} hideSectionSelector onBack={()=>setSelected(null)}/>
    :<RolePostComposer key={selected.id} userId={userId} role={role} initialType={selected.value} hideTypeSelector onBack={()=>setSelected(null)} onSaved={onSaved}/>
   }
  </div>}
 </section>;
}
