import React,{useEffect,useState} from 'react';
import {Download,RefreshCw,X} from 'lucide-react';

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

 useEffect(()=>{
  setStandalone(isStandalone());
  if(!('serviceWorker' in navigator))return;

  const onInstall=(event:Event)=>{
   event.preventDefault();
   setInstallEvent(event as BeforeInstallPromptEvent);
  };
  const appInstalled=()=>{setInstallEvent(null);setStandalone(true)};
  window.addEventListener('beforeinstallprompt',onInstall);
  window.addEventListener('appinstalled',appInstalled);

  let active=true;
  let timer:number|undefined;
  let cleanupRegistration=()=>{};

  navigator.serviceWorker.getRegistration('/').then(reg=>{
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

 const install=async()=>{
  if(installEvent){
   await installEvent.prompt();
   const result=await installEvent.userChoice;
   if(result.outcome==='accepted')setStandalone(true);
   setInstallEvent(null);
   return;
  }
  setInstallHelp(true);
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
  {!standalone&&<button type="button" onClick={install} style={{position:'fixed',bottom:18,right:18,zIndex:100,border:0,borderRadius:16,background:'linear-gradient(135deg,#ff9b4a,#ff6b16)',color:'#fff',padding:'12px 16px',fontWeight:900,boxShadow:'0 18px 40px rgba(255,107,22,.28)',display:'flex',alignItems:'center',gap:8}}>
   <Download size={18}/><span>دامەزراندنی ئەپی شاخ</span>
  </button>}

  {installHelp&&<div className="modal"><div className="auth" style={{maxWidth:460}}>
   <button className="x" onClick={()=>setInstallHelp(false)}>×</button>
   <div className="mark">شاخ</div>
   <h2>دامەزراندنی ئەپی شاخ</h2>
   <p>لە وێبگەڕەکەدا لیستی هەڵبژاردنەکان بکەرەوە و «دامەزراندنی ئەپ» یان «زیادکردن بۆ سەرەتا» هەڵبژێرە.</p>
   <button className="primary full" onClick={()=>setInstallHelp(false)}>باشە</button>
  </div></div>}

  {updateReady&&<div style={{position:'fixed',top:92,left:'50%',transform:'translateX(-50%)',zIndex:100,background:'#081a33',color:'#fff',borderRadius:16,padding:'12px 14px',boxShadow:'0 18px 50px rgba(8,26,51,.25)',display:'flex',alignItems:'center',gap:10,width:'min(92vw,560px)'}}>
   <RefreshCw size={19}/>
   <div style={{flex:1}}>
    <b style={{display:'block'}}>وەشانی نوێی شاخ بەردەستە</b>
    <small style={{opacity:.78}}>ئەپە دامەزراوەکەت هەر لەسەر خۆی نوێ دەکرێتەوە؛ پێویست بە دابەزاندنەوەی دووبارە نییە.</small>
   </div>
   <button type="button" className="primary" onClick={update}>نوێکردنەوە</button>
   <button type="button" className="plain" onClick={()=>setUpdateReady(false)} aria-label="داخستن"><X size={16}/></button>
  </div>}
 </>;
}
