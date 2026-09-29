import React,{useEffect,useState} from 'react';
import {Download,RefreshCw,X,Smartphone,Apple,Share2} from 'lucide-react';

type BeforeInstallPromptEvent=Event&{
 prompt:()=>Promise<void>;
 userChoice:Promise<{outcome:'accepted'|'dismissed'}>;
};

function isStandalone(){
 return window.matchMedia('(display-mode: standalone)').matches||Boolean((navigator as Navigator&{standalone?:boolean}).standalone);
}

export default function PwaInstallUpdate(){
 const [installEvent,setInstallEvent]=useState<BeforeInstallPromptEvent|null>(null);
 const [installHelp,setInstallHelp]=useState(false);
 const [updateReady,setUpdateReady]=useState(false);
 const [registration,setRegistration]=useState<ServiceWorkerRegistration|null>(null);
 const [standalone,setStandalone]=useState(false);
 const [version,setVersion]=useState('v1.9.8');
 const [checking,setChecking]=useState(false);
 const [status,setStatus]=useState('');
 const [isAndroid,setIsAndroid]=useState(false);
 const [isIOS,setIsIOS]=useState(false);

 useEffect(()=>{
  setStandalone(isStandalone());
  const ua=navigator.userAgent.toLowerCase();
  setIsAndroid(ua.includes('android'));
  setIsIOS(/iphone|ipad|ipod/.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1));
  fetch('/version.json?ts='+Date.now(),{cache:'no-store'}).then(r=>r.ok?r.json():null).then(data=>{if(data?.version)setVersion(String(data.version))}).catch(()=>{});
  if(!('serviceWorker' in navigator))return;

  const onInstall=(event:Event)=>{
   event.preventDefault();
   setInstallEvent(event as BeforeInstallPromptEvent);
  };
  const appInstalled=()=>{setInstallEvent(null);setStandalone(true);setStatus('ئەپی شاخ بە سەرکەوتوویی دامەزرا.');};
  window.addEventListener('beforeinstallprompt',onInstall);
  window.addEventListener('appinstalled',appInstalled);

  let active=true;
  let timer:number|undefined;
  let cleanupRegistration=()=>{};

  navigator.serviceWorker.register('/sw.js',{scope:'/'}).then(reg=>{
   if(!active||!reg)return;
   setRegistration(reg);

   const watchInstalling=()=>{
    const worker=reg.installing;
    if(!worker)return;
    const onState=()=>{
     if(worker.state==='installed'&&navigator.serviceWorker.controller)setUpdateReady(true);
    };
    worker.addEventListener('statechange',onState);
   };

   if(reg.waiting)setUpdateReady(true);
   reg.addEventListener('updatefound',watchInstalling);

   const check=()=>reg.update().catch(()=>{});
   check();
   timer=window.setInterval(check,30*60*1000);

   const onControllerChange=()=>window.location.reload();
   navigator.serviceWorker.addEventListener('controllerchange',onControllerChange);

   cleanupRegistration=()=>{
    reg.removeEventListener('updatefound',watchInstalling);
    navigator.serviceWorker.removeEventListener('controllerchange',onControllerChange);
   };
  }).catch(()=>{});

  return()=>{
   active=false;
   if(timer)window.clearInterval(timer);
   cleanupRegistration();
   window.removeEventListener('beforeinstallprompt',onInstall);
   window.removeEventListener('appinstalled',appInstalled);
  };
 },[]);

 const shareInstallLink=async()=>{try{if(navigator.share){await navigator.share({title:'SHAKH SUPER — شاخ',text:'ئەپی شاخ دامەزرێنە',url:window.location.origin})}else if(navigator.clipboard){await navigator.clipboard.writeText(window.location.origin);setStatus('لینکی شاخ کۆپی کرا.')}}catch{}};

 const install=async()=>{
  if(installEvent){
   await installEvent.prompt();
   const result=await installEvent.userChoice;
   if(result.outcome==='accepted'){
    setStandalone(true);
    setStatus('ئەپی شاخ دامەزرا.');
   }else{
    setStatus('دامەزراندن هەڵنەبژێردرا.');
   }
   setInstallEvent(null);
   return;
  }
  setInstallHelp(true);
 };

 const checkForUpdate=async()=>{
  if(!registration)return setStatus('خزمەتی نوێکردنەوە هێشتا ئامادە نییە.');
  setChecking(true);
  setStatus('');
  try{
   await registration.update();
   if(registration.waiting){
    setUpdateReady(true);
    setStatus('وەشانی نوێ ئامادەیە.');
   }else{
    setStatus('هیچ وەشانی نوێ نەدۆزرایەوە.');
   }
  }catch{
   setStatus('پشکنینی وەشانی نوێ سەرکەوتوو نەبوو.');
  }finally{
   setChecking(false);
  }
 };

 const update=async()=>{
  const worker=registration?.waiting;
  if(worker){
   worker.postMessage({type:'SKIP_WAITING'});
   return;
  }
  await registration?.update().catch(()=>{});
 };

 return <>
  <div id="app-install" className="pwaPanel">
   <div className="pwaPanelMain">
    <img className="pwaLogo" src="/shakh-logo.svg?v=1.9.8" alt="SHAKH SUPER — شاخ" />
    <div>
     <b>ئەپی شاخ</b>
     <small>وەشانی {version} · دامەزراندن و ئەپدەیتی خۆکار</small>
    </div>
   </div>
   <div className="pwaPanelActions">
    {!standalone&&isAndroid&&<button type="button" className="primary" onClick={install}>
     <Smartphone size={17}/> دامەزراندنی ڕاستەوخۆی Android
    </button>}
    {!standalone&&isIOS&&<button type="button" className="primary" onClick={()=>setInstallHelp(true)}>
     <Apple size={17}/> چۆنیەتی دامەزراندن لە iPhone
    </button>}
    {!standalone&&!isAndroid&&!isIOS&&<button type="button" className="primary" onClick={install}>
     <Download size={17}/> دامەزراندنی ئەپ
    </button>}
    <button type="button" className="plain" onClick={()=>void shareInstallLink()}>
     <Share2 size={17}/> هاوبەشکردنی لینکی ئەپ
    </button>
    <button type="button" className="plain" onClick={()=>void checkForUpdate()} disabled={checking||!registration}>
     <RefreshCw size={17}/> {checking?'پشکنین...':'پشکنینی وەشانی نوێ'}
    </button>
    {updateReady&&<button type="button" className="primary" onClick={()=>void update()}>
     <RefreshCw size={17}/> ئەپدەیتی ئێستا
    </button>}
   </div>
   {status&&<small className="pwaStatus">{status}</small>}
  </div>

  {installHelp&&<div className="modal"><div className="auth" style={{maxWidth:460}}>
   <button className="x" onClick={()=>setInstallHelp(false)}>×</button>
   <img className="pwaHelpLogo" src="/shakh-logo.svg?v=1.9.8" alt="SHAKH SUPER — شاخ" />
   <h2>دامەزراندنی ئەپی شاخ</h2>
   <p>لە Android، ئەگەر وێبگەڕەکە دوکمەی دامەزراندن پیشان بدات، «دامەزراندنی ئەپ» هەڵبژێرە تا شاخ وەک ئەپ دابمەزرێت. لە iPhone/iPad ـدا لە Safari دوگمەی Share بکە و «Add to Home Screen / زیادکردن بۆ شاشەی سەرەتا» هەڵبژێرە.</p>
   <button className="primary full" onClick={()=>setInstallHelp(false)}>باشە</button>
  </div></div>}

  {updateReady&&<div className="pwaUpdateBar">
   <RefreshCw size={19}/>
   <div className="pwaUpdateText">
    <b>وەشانی نوێی شاخ بەردەستە</b>
    <small>بە یەک کرتە ئەپەکە نوێ بکەرەوە.</small>
   </div>
   <button type="button" className="primary" onClick={()=>void update()}>نوێکردنەوە</button>
   <button type="button" className="plain" onClick={()=>setUpdateReady(false)} aria-label="داخستن"><X size={16}/></button>
  </div>}
 </>;
}
