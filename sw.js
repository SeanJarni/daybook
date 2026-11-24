/* Daybook service worker: caches the whole app so it runs with no internet.
   The block between the BUILD markers is written by tools/build-sw.ps1.
   Run that script after changing any app file; a new VERSION makes phones update. */
// BUILD:START
const VERSION='4b6ec74bd534';
const ASSETS=[
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/app.js',
  'js/data.js',
  'js/files.js',
  'js/pwa.js',
  'js/storage.js',
  'js/themes.js',
  'js/util.js',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'slides/badwater.jpg',
  'slides/cat.jpg',
  'slides/dune.jpg',
  'slides/florence.jpg',
  'slides/fountain.jpg',
  'slides/pesaro.jpg',
  'slides/sailboat.jpg',
  'slides/statue.jpg',
  'slides/thorns.jpg',
  'slides/trail.jpg',
  'docs/it-1.jpg',
  'docs/it-2.jpg',
  'docs/it-3.jpg',
  'docs/it-4.jpg',
  'docs/uk-1.jpg',
  'docs/uk-2.jpg',
  'docs/uk-3.jpg',
  'docs/uk-4.jpg'
];
// BUILD:END

const CACHE='daybook-'+VERSION;

self.addEventListener('install',e=>{
  e.waitUntil((async()=>{
    const c=await caches.open(CACHE);
    // cache:'reload' skips the browser's HTTP cache so we never store a stale copy
    await c.addAll(ASSETS.map(u=>new Request(u,{cache:'reload'})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate',e=>{
  e.waitUntil((async()=>{
    for(const k of await caches.keys())if(k.startsWith('daybook-')&&k!==CACHE)await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==location.origin)return;
  e.respondWith((async()=>{
    const c=await caches.open(CACHE);
    // app pages: always answer with the cached shell, so launching offline works
    if(req.mode==='navigate'){
      const hit=await c.match('./')||await c.match('index.html');
      if(hit)return hit;
      return fetch(req);
    }
    const hit=await c.match(req,{ignoreSearch:true});
    if(hit)return hit;
    try{return await fetch(req)}
    catch(err){return new Response('',{status:504,statusText:'Offline'})}
  })());
});
