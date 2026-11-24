/* ---------- storage: IndexedDB, replaces claude.ai db/user/assets ----------
   Database "daybook" holds two stores:
   - docs:  key = doc id ('library', 'meta', 'photos', 'm-YYYY-MM'), value = the doc body
   - blobs: key = asset id, value = a JPEG Blob for an uploaded photo
   Doc shapes are exactly the ones the claude.ai version used. */
const Store=(()=>{
  const NAME='daybook',VER=1;
  let dbp=null;
  const req=r=>new Promise((res,rej)=>{r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
  const wrap=e=>{const err=new Error(e&&e.message||'storage error');
    err.code=e&&e.name==='QuotaExceededError'?'quota_exceeded':'failed';return err};
  function open(){
    if(dbp)return dbp;
    dbp=new Promise((res,rej)=>{
      if(!('indexedDB' in window))return rej(new Error('no indexedDB'));
      const r=indexedDB.open(NAME,VER);
      r.onupgradeneeded=()=>{const d=r.result;
        if(!d.objectStoreNames.contains('docs'))d.createObjectStore('docs');
        if(!d.objectStoreNames.contains('blobs'))d.createObjectStore('blobs')};
      r.onsuccess=()=>{const d=r.result;d.onversionchange=()=>d.close();res(d)};
      r.onerror=()=>rej(r.error);
      r.onblocked=()=>rej(new Error('blocked'));
    });
    dbp.catch(()=>{dbp=null});
    return dbp;
  }
  async function tx(store,mode,fn){
    const d=await open();
    return new Promise((res,rej)=>{
      const t=d.transaction(store,mode),s=t.objectStore(store);let out;
      Promise.resolve(fn(s)).then(v=>{out=v});
      t.oncomplete=()=>res(out);
      t.onerror=()=>rej(wrap(t.error));
      t.onabort=()=>rej(wrap(t.error));
    });
  }
  /* all docs as {id: body} */
  async function allDocs(){
    return tx('docs','readonly',async s=>{
      const [keys,vals]=await Promise.all([req(s.getAllKeys()),req(s.getAll())]);
      const o={};keys.forEach((k,i)=>{o[k]=vals[i]});return o;
    });
  }
  const putDoc=(id,body)=>tx('docs','readwrite',s=>{s.put(body,id)});
  const putDocs=obj=>tx('docs','readwrite',s=>{for(const [id,b] of Object.entries(obj))s.put(b,id)});
  const putBlob=(id,blob)=>tx('blobs','readwrite',s=>{s.put(blob,id)});
  const delBlob=id=>tx('blobs','readwrite',s=>{s.delete(id)});
  async function allBlobs(){
    return tx('blobs','readonly',async s=>{
      const [keys,vals]=await Promise.all([req(s.getAllKeys()),req(s.getAll())]);
      const o={};keys.forEach((k,i)=>{o[k]=vals[i]});return o;
    });
  }
  /* ask the browser not to evict our data (Safari grants this to home screen apps) */
  async function persist(){
    try{if(navigator.storage&&navigator.storage.persist&&!(await navigator.storage.persisted()))await navigator.storage.persist()}catch(e){}
  }
  return {open,allDocs,putDoc,putDocs,putBlob,delBlob,allBlobs,persist};
})();
