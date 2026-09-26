import React,{useEffect,useState} from 'react';
import {Download,RefreshCw,X} from 'lucide-react';

type BeforeInstallPromptEvent=Event&{
 prompt:()=>Promise<void>;
 userChoice:Promise<{outcome:'accepted'|'dismissed'}>;
};

export default function PwaInstallUpdate(){
 const [installEvent,setInstallEvent]=useState<BeforeInstallPromptEvent|null>(null);
 const [updateReady,setUpdateReady]=useState(false);
 const [showInstall,setShowInstall]=useState(true);
 const [registration,setRegistration]=useState<ServiceWorkerRegistration|null>(null);

 useEffect(()=>{
  if(!('serviceWorker' in navigator))return;

  const onInstall=(event:Event)=>{
   event.preventDefault();
   setInstallEvent(event as BeforeInstallPromptEvent);
  };
  const appInstalled=()=>{setShowInstall(false);setInstallEvent(null)};

  window.addEventListener('beforeinstallprompt',onInstall);
  window.addEventListener('appinstalled',appInstalled);

  let active=true;
  let timer:number|undefined;

  navigator.serviceWorker.getRegistration('/').then(reg=>{
   if(!active||!reg)return;
   setRegistration(reg);

   const watchInstalling=()=>{
    const worker=reg.installing;
    if(!worker)return;
    worker.addEventListener('statechange',()=>{
     if(worker.state==='installed'&&navigator.serviceWorker.controller)setUpdateReady(true);
    });
   };

   if(reg.waiting)setUpdateReady(true);
   reg.addEventListener('updatefound',watchInstalling);

   const check=()=>reg.update().catch(()=>{});
   check();
   timer=window.setInterval(check,30*60*1000);

   const onControllerChange=()=>window.location.reload();
   navigator.serviceWorker.addEventListener('controllerchange',onControllerChange);

   return undefined;
  }).catch(()=>{});

  return()=>{
   active=false;
   if(timer)window.clearInterval(timer);
   window.removeEventListener('beforeinstallprompt',onInstall);
   window.removeEventListener('appinstalled',appInstalled);
  };
 },[]);

 const install=async()=>{
  if(!installEvent)return;
  await installEvent.prompt();
  const result=await installEvent.userChoice;
  if(result.outcome==='accepted')setShowInstall(false);
  setInstallEvent(null);
 };

 const update=async()=>{
  const worker=registration?.waiting;
  if(!worker){
   await registration?.update().catch(()=>{});
   return;
  }
  worker.postMessage({type:'SKIP_WAITING'});
 };

 return <>
  {installEvent&&showInstall&&<div style={{position:'fixed',bottom:18,right:18,zIndex:100,background:'#fff',border:'1px solid #e7ecf2',borderRadius:16,padding:12,boxShadow:'0 20px 60px rgba(8,26,51,.18)',display:'flex',alignItems:'center',gap:10,maxWidth:370}}>
   <Download size={20}/>
   <div style={{flex:1}}>
    <b style={{display:'block'}}>ئەپەکەی شاخ دامەزرێنە</b>
    <small style={{opacity:.7}}>بۆ بەکارهێنانی خێراتر و وەک ئەپ.</small>
   </div>
   <button type="button" className="primary" onClick={install}>دامەزراندن</button>
   <button type="button" className="plain" onClick={()=>setShowInstall(false)} aria-label="داخستن"><X size={16}/></button>
  </div>}

  {updateReady&&<div style={{position:'fixed',top:92,left:'50%',transform:'translateX(-50%)',zIndex:100,background:'#081a33',color:'#fff',borderRadius:16,padding:'12px 14px',boxShadow:'0 18px 50px rgba(8,26,51,.25)',display:'flex',alignItems:'center',gap:10,width:'min(92vw,560px)'}}>
   <RefreshCw size={19}/>
   <div style={{flex:1}}>
    <b style={{display:'block'}}>وەشانی نوێی شاخ بەردەستە</b>
    <small style={{opacity:.78}}>لەسەر هەمان ئەپی دامەزراو نوێ دەکرێتەوە؛ پێویست بە دابەزاندنەوەی دووبارە نییە.</small>
   </div>
   <button type="button" className="primary" onClick={update}>نوێکردنەوە</button>
  </div>}
 </>;
}
