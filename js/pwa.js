/* ---------- PWA: service worker registration and updates ----------
   A new version installs in the background. To avoid reloading under Sean's
   fingers, the page switches to it the next time Daybook comes back to the
   front (or right away if nothing is open and nothing is being typed). */
if('serviceWorker' in navigator&&location.protocol!=='file:'){
  let reg=null,updated=false,reloading=false;
  const hadController=!!navigator.serviceWorker.controller;
  const reloadNow=async()=>{if(reloading)return;reloading=true;
    try{clearTimeout(flushT);await flush()}catch(e){}
    location.reload()};
  const safeToReload=()=>!S.sheet&&!isTyping()&&!dirty.size&&!inflight.size;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(!hadController)return; // first install: this page is already current
    updated=true;
    if(document.hidden||safeToReload())reloadNow();
  });
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden)return;
    if(updated){reloadNow();return}
    if(reg)reg.update().catch(()=>{}); // home screen apps stay open for days; check for updates on return
  });
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('sw.js').then(r=>{reg=r}).catch(()=>{});
  });
}
