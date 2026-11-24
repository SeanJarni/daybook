/* ---------- state ---------- */
let prefs={};try{prefs=JSON.parse(localStorage.getItem('daybook:prefs')||'{}')}catch(e){}
const S={view:'home',five:!!prefs.five,anchor:new Date(),lib:null,months:{},sheet:null,ready:false};
function savePrefs(){try{localStorage.setItem('daybook:prefs',JSON.stringify({view:S.view,five:S.five}))}catch(e){}}
const lib=()=>S.lib||(S.lib=clone(DEFAULT_LIB));
const catById=id=>lib().cats.find(c=>c.id===id);
const getDay=k=>(S.months[monthDoc(k)]?.days?.[k])||[];
function setDay(k,arr){
  const id=monthDoc(k);
  const m=S.months[id]||(S.months[id]={days:{}});
  m.days=m.days||{};
  if(arr.length)m.days[k]=arr;else delete m.days[k];
  markDirty(id);
}
const sortItems=a=>[...a].sort((x,y)=>(x.time?0:1)-(y.time?0:1)||(x.time||'').localeCompare(y.time||'')||0);
const view=e=>{const c=catById(e.cat);return{name:c?c.name:e.catName,color:c?catColor(c):slotColors()[nearestSlot(fixC(e.color||'#7A6A80'))]}};

/* ---------- persistence ---------- */
let db=null,me=null,mode='local',ASSETS=null;
const dirty=new Set(),inflight=new Set();let flushT=null;
function markDirty(id){dirty.add(id);clearTimeout(flushT);flushT=setTimeout(flush,350)}
async function flush(){
  for(const id of [...dirty]){
    if(inflight.has(id))continue;
    dirty.delete(id);inflight.add(id);
    const body=clone(id==='library'?S.lib:id==='meta'?S.meta:id==='photos'?S.photos:S.months[id]);
    try{await save(id,body)}
    catch(e){
      if(e&&e.code==='unavailable'){dirty.add(id);setTimeout(flush,1500+Math.random()*1000)}
      else if(e&&e.code==='quota_exceeded')toast('Storage is full. Delete old items to keep saving.');
      else toast("Couldn't save that change. Try again.");
    }
    finally{inflight.delete(id);if(dirty.has(id)){clearTimeout(flushT);flushT=setTimeout(flush,350)}}
  }
}
async function save(id,body){
  if(mode==='db')return db.doc(`data/users/${me}/${id}`).set(body);
  try{localStorage.setItem('daybook:doc:'+id,JSON.stringify(body))}catch(e){}
}
function loadLocal(){
  try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(!k.startsWith('daybook:doc:'))continue;
    const id=k.slice(12),v=JSON.parse(localStorage.getItem(k));if(id==='library'){S.lib=migrate(v);if(upgrade(S.lib))markDirty('library')}else if(id==='meta')S.meta=v;else if(id==='photos')S.photos=v;else S.months[id]=v}}catch(e){}
}
let pendingRender=false;
function isTyping(){const a=document.activeElement;return !!a&&/^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName)}
document.addEventListener('focusout',()=>setTimeout(()=>{if(pendingRender&&!isTyping()){pendingRender=false;render();if(S.sheet&&S.sheet.type==='day')drawSheet()}},50));
function banner(msg){$('#banner').innerHTML=msg?`<div class="banner">${esc(msg)}</div>`:''}

async function init(){
  render();
  const c=window.claude;
  if(c&&c.use){
    try{db=await c.use('db')}catch(e){db=null}
    try{const u=await c.use('user');me=u?await u.id():null}catch(e){me=null}
    try{ASSETS=await c.use('assets')}catch(e){ASSETS=null}
  }
  if(db&&me){
    mode='db';
    const loadT=setTimeout(()=>{if(!S.ready){S.ready=true;render()}banner("Can't reach your saved schedule yet. Showing what's on this device.")},10000);
    db.collection(`data/users/${me}`).onSnapshot(snap=>{
      let changed=false;
      for(const d of snap.docs){
        if(dirty.has(d.id)||inflight.has(d.id))continue;
        const v=d.data();if(!v)continue;
        const cur=d.id==='library'?S.lib:d.id==='meta'?S.meta:d.id==='photos'?S.photos:S.months[d.id];
        if(cur&&JSON.stringify(cur)===JSON.stringify(v))continue;
        changed=true;
        if(d.id==='library'){S.lib=migrate(clone(v));if(upgrade(S.lib))markDirty('library')}else if(d.id==='meta')S.meta=clone(v);else if(d.id==='photos'){S.photos=clone(v);setTimeout(refreshSlides)}else if(d.id.startsWith('m-'))S.months[d.id]=clone(v);
      }
      if(!snap.metadata.fromCache){clearTimeout(loadT);banner('')}
      const first=!S.ready;S.ready=true;
      if(first||changed){if(isTyping())pendingRender=true;else{render();if(S.sheet&&S.sheet.type==='day')drawSheet()}}
    },err=>{clearTimeout(loadT);S.ready=true;render();banner('Sync stopped. Reopen the page to reconnect.')});
  }else{
    mode='local';loadLocal();S.ready=true;
    banner('Saving on this device only. Open from claude.ai while signed in to sync across devices.');
    render();
  }
}

/* ---------- render ---------- */
function render(){
  document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('on',b.dataset.v===S.view));
  applyTheme();renderNav();renderTicker();
  {const f=$('#fstatus');if(f){const lb=S.meta&&S.meta.lastBackup;const fmt=k=>{const d=parse(k);return `${MON[d.getMonth()]} ${d.getDate()}`};
    f.textContent=(mode==='db'?'Saved to your Claude account':'Saved on this device')+' · '+(lb?`Last backup ${fmt(lb)}`:'No backup yet')}}
  const now=new Date();$('#bdate').textContent=`${DOW[(now.getDay()+6)%7]}, ${MON[now.getMonth()]} ${now.getDate()}`;
  const main=$('#main');main.classList.toggle('home',S.view==='home'&&S.ready);
  if(!S.ready){main.innerHTML='<div class="empty">Loading your schedule...</div>';return}
  if(S.view==='home')renderHome(main);else if(S.view==='docs')renderDocs(main);else if(S.view==='week')renderWeek(main);else if(S.view==='month')renderMonth(main);else renderLib(main);
}
function renderNav(){
  const n=$('#nav');
  if(S.view==='home'){n.innerHTML='';return}
  if(S.view==='docs'){const d=DOCS.find(x=>x.id===S.doc);n.innerHTML=d?`<button class="ib" data-act="docback" aria-label="Back">&#8249;</button><h1 class="grow">${esc(d.short)}</h1>`:'<h1 class="grow">Documents</h1>';return}
  if(S.view==='lib'){const T={acts:'Activities',themes:'Themes',photos:'Home photos',data:'Your data'}[S.editSec];
    n.innerHTML=T?`<button class="ib" data-act="eback" aria-label="Back">&#8249;</button><h1 class="grow">${T}</h1><span class="sub">Saves automatically</span>`:'<h1 class="grow">Edit</h1><span class="sub">Saves automatically</span>';return}
  let label;
  if(S.view==='week'){
    const s=mondayOf(S.anchor),e=addDays(s,S.five?4:6);
    label=s.getMonth()===e.getMonth()?`${MON[s.getMonth()]} ${s.getDate()} - ${e.getDate()}`:`${MON[s.getMonth()]} ${s.getDate()} - ${MON[e.getMonth()]} ${e.getDate()}`;
  }else label=`${MONTHS[S.anchor.getMonth()]} ${S.anchor.getFullYear()}`;
  n.innerHTML=`<button class="ib" data-act="prev" aria-label="Previous">&#8249;</button>
    <h1 class="grow">${label}</h1>
    ${S.view==='week'?`<button class="pill ${S.five?'on':''}" data-act="five">${S.five?'5 day':'7 day'}</button>`:''}
    <button class="pill" data-act="today">Today</button>
    <button class="ib" data-act="next" aria-label="Next">&#8250;</button>`;
}
function itemRow(k,e){
  const v=view(e);
  const det=[e.time?'':null,...(e.picks||[])].filter(Boolean).join(', ');
  const sub=[det,e.note].filter(Boolean).join(' · ');
  return `<div class="item ${e.done?'done':e.missed?'missed':''}" style="--c:${esc(v.color)}">
    <button class="chk" data-act="toggle" data-k="${k}" data-id="${esc(e.id)}" aria-label="Change status">${e.missed?XMARK:CHECK}</button>
    <button class="body" data-act="edit" data-k="${k}" data-id="${esc(e.id)}">
      <div class="t"><span>${esc(v.name)}</span>${e.time?`<span class="tm">${fmtTime(e.time)}</span>`:''}${e.missed?'<span class="mtag">Missed</span>':''}</div>
      ${sub?`<div class="d">${esc(sub)}</div>`:''}
    </button></div>`;
}
function renderWeek(main){
  const s=mondayOf(S.anchor),n=S.five?5:7,tk=todayKey();
  let tot=0,dn=0,ms=0,html='';
  for(let i=0;i<n;i++){
    const d=addDays(s,i),k=keyOf(d),items=sortItems(getDay(k));
    tot+=items.length;dn+=items.filter(x=>x.done).length;ms+=items.filter(x=>x.missed).length;
    const c=items.filter(x=>x.done).length;
    html+=`<section class="day ${k===tk?'today':''}" id="d-${k}">
      <div class="dh"><b>${DOW[i]}</b><span class="sub">${MON[d.getMonth()]} ${d.getDate()}</span>${k===tk?'<span class="tag">Today</span>':''}
      <span class="grow"></span>${items.length?`<span class="sub">${c}/${items.length}</span>`:''}
      <button class="add" data-act="new" data-k="${k}" aria-label="Add">+</button></div>
      ${items.length?items.map(e=>itemRow(k,e)).join(''):`<button class="none" data-act="new" data-k="${k}">Nothing planned. Tap + to add.</button>`}
    </section>`;
  }
  const pct=tot?Math.round(dn/tot*100):0;
  main.innerHTML=`<div class="summary"><span class="sub">${dn} of ${tot} done${ms?` · ${ms} missed`:''}</span><div class="bar"><i style="width:${pct}%"></i></div><span class="sub">${pct}%</span></div>
    <div class="week">${html}</div>
    <div class="wfoot"><button class="btn" data-act="copyweek">Copy last week's plan here</button>
    <button class="btn" data-act="export">Send to phone calendar</button></div>`;
}
const LINES=['Small reps, every day.','Show up. Fill the circle.','Done beats perfect.','One good day, then another.','Build the day you want to repeat.','Make it count, then make it a habit.','Momentum is a choice.'];
function streak(){let d=new Date(),n=0;const full=k=>{const it=getDay(k);return it.length&&it.every(x=>x.done)};
  if(!full(keyOf(d)))d=addDays(d,-1);
  for(let i=0;i<400&&full(keyOf(d));i++){n++;d=addDays(d,-1)}return n}
function renderHome(main){
  const now=new Date(),k=keyOf(now),items=sortItems(getDay(k)),dn=items.filter(x=>x.done).length;
  const h=now.getHours(),greet=h<12?'Good morning':h<17?'Good afternoon':'Good evening';
  const doy=Math.floor((now-new Date(now.getFullYear(),0,0))/864e5);
  const mon=mondayOf(now);let wt=0,wd=0;for(let i=0;i<7;i++){const it=getDay(keyOf(addDays(mon,i)));wt+=it.length;wd+=it.filter(x=>x.done).length}
  const pct=items.length?dn/items.length:0,C=2*Math.PI*17;
  const ring=`<svg class="ring" viewBox="0 0 42 42"><circle cx="21" cy="21" r="17" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="4"/>
    <circle cx="21" cy="21" r="17" fill="none" style="stroke:var(--hi)" stroke-width="4" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C*(1-pct)}" transform="rotate(-90 21 21)"/>
    <text x="21" y="25" text-anchor="middle" font-size="11" font-weight="800" fill="#fff">${Math.round(pct*100)}%</text></svg>`;
  const st=streak();
  let hero=main.querySelector('.hero');
  if(!hero){main.innerHTML='<section class="hero"><div class="hero-in"></div></section>';hero=main.firstChild;hero.prepend(ensureSlides())}
  hero.querySelector('.hero-in').innerHTML=`
    <div class="hl"><div class="when">${DOWF[(now.getDay()+6)%7]}, ${MONTHS[now.getMonth()]} ${now.getDate()}</div>
    <h2>Make Today<br>Yours</h2>
    <p class="greet">${greet}, Sean.</p>
    <p class="line">${LINES[doy%LINES.length]}</p>
    <div class="mini"><span>This week ${wd}/${wt}</span><span>${st}-day streak</span></div>
    <div class="dots" id="dots"></div></div>
    <div class="spacer"></div>
    <div class="hr"><div class="glass">
      <div class="ghead">${ring}<div class="grow"><b>Today</b><div style="font-size:13px;opacity:.8">${items.length?`${dn} of ${items.length} done${items.some(x=>x.missed)?` · ${items.filter(x=>x.missed).length} missed`:''}`:'Nothing planned yet'}</div></div>
        <button class="add" data-act="new" data-k="${k}" aria-label="Add" style="background:rgba(255,255,255,.18);color:#fff">+</button></div>
      ${items.length?items.map(e=>itemRow(k,e)).join(''):'<div class="gempty">Tap + to plan your day.</div>'}
    </div>
    <div class="hbtns"><button class="hbtn" data-act="new" data-k="${k}">Plan today</button><button class="hbtn alt" data-act="view" data-v="week">This week</button></div></div>`;
  paintDots();
}
const BUILTIN=[['florence',50],['trail',68],['thorns',50],['badwater',40],['dune',50],['statue',55],['fountain',50],['sailboat',62],['cat',62],['pesaro',50]];
const ALL='__all',PICKS="Sean's picks";
function photos(){if(!S.photos)S.photos={albums:[PICKS],photos:BUILTIN.map(([n,x])=>({id:'b-'+n,builtin:n,album:PICKS,x})),active:ALL,speed:10,zoom:true};return S.photos}
const urlCache={};
const photoSrc=p=>p.builtin?`slides/${p.builtin}.jpg`:(urlCache[p.asset]||'/_blob/'+p.asset);
function activeSet(){const P=photos();let a=P.active===ALL?P.photos:P.photos.filter(p=>p.album===P.active);return a.length?a:P.photos}
let slidesEl=null,slideIdx=0,slideT=null,slidesSig='';
const slideSig=()=>JSON.stringify([activeSet().map(p=>[p.id,p.x]),photos().zoom!==false]);
function ensureSlides(){
  if(slidesEl&&slidesSig===slideSig())return slidesEl;
  const old=slidesEl;slidesEl=document.createElement('div');slidesEl.className='slides'+(photos().zoom===false?' nozoom':'');
  slidesSig=slideSig();slideIdx=0;
  const set=[...activeSet()].sort(()=>Math.random()-.5);
  for(const p of set){const d=document.createElement('div');d.className='slide';d.style.backgroundPosition=`${p.x??50}% 50%`;d.dataset.src=photoSrc(p);slidesEl.appendChild(d)}
  if(set.length){loadSlide(0);if(set.length>1)loadSlide(1);slidesEl.children[0].classList.add('on')}
  if(old&&old.isConnected)old.replaceWith(slidesEl);
  if(!slideT)scheduleSlide();
  return slidesEl;
}
function scheduleSlide(){clearTimeout(slideT);slideT=setTimeout(()=>{nextSlide();scheduleSlide()},(photos().speed||10)*1000)}
function refreshSlides(){if(slidesEl){ensureSlides();paintDots()}}
function loadSlide(i){const n=slidesEl.children.length;if(!n)return;const d=slidesEl.children[i%n];if(!d.style.backgroundImage)d.style.backgroundImage=`url("${d.dataset.src}")`}
function nextSlide(){
  if(!slidesEl||document.hidden||S.view!=='home'||!slidesEl.isConnected)return;
  const n=slidesEl.children.length;if(n<2)return;const cur=slidesEl.children[slideIdx];
  slideIdx=(slideIdx+1)%n;const nx=slidesEl.children[slideIdx];
  nx.classList.add('on');cur.classList.add('out');
  setTimeout(()=>{cur.style.transition='none';cur.classList.remove('on','out');void cur.offsetWidth;cur.style.transition=''},2600);
  loadSlide(slideIdx+1);paintDots();
}
function paintDots(){const el=document.getElementById('dots');if(!el||!slidesEl)return;
  el.innerHTML=[...slidesEl.children].map((_,i)=>`<i class="${i===slideIdx?'on':''}"></i>`).join('')}
const DOCS=[
 {id:'syllabus',tpl:'doc-syllabus',title:'Light & Lens Syllabus',short:'Light & Lens',sub:'8-week light mastery cycle, lens field guide, pre-session protocol',tag:'DOCX',bg:'linear-gradient(160deg,#E56B5E,#843660)'},
 {id:'nikkor',tpl:'doc-nikkor',title:'NIKKOR Lens Nomenclature',short:'Lens Nomenclature',sub:'F-mount designations decoded, plus your lenses',tag:'PDF',bg:'linear-gradient(160deg,#F6A961,#BB405C)'},
 {id:'it',pages:[1,2,3,4].map(i=>`docs/it-${i}.jpg`),title:'Italiano: Reactivation to Fluency',short:'Italian syllabus',sub:'12-month program to certified B2 (CILS/CELI)',tag:'PDF',bg:'linear-gradient(160deg,#C98A3B,#843660)'},
 {id:'uk',pages:[1,2,3,4].map(i=>`docs/uk-${i}.jpg`),title:'Ukrainian: Zero to Conversational',short:'Ukrainian syllabus',sub:'12-month program to B1 conversation',tag:'PDF',bg:'linear-gradient(160deg,#9E2F4E,#583168)'}];
function renderDocs(main){
  const d=DOCS.find(x=>x.id===S.doc);
  if(d&&d.pages){main.innerHTML=`<div class="pdfbar"><span class="sub">${d.pages.length} pages · tap a page to zoom</span><span class="grow"></span><button class="pill ${S.zoom?'on':''}" data-act="zoom">${S.zoom?'Fit width':'Zoom in'}</button></div>
    <div class="pdf ${S.zoom?'z':''}">${d.pages.map((p,i)=>`<img src="${p}" alt="Page ${i+1}" loading="lazy" data-act="zoom">`).join('')}</div>`;return}
  if(d){main.innerHTML='<article class="doc"></article>';main.firstChild.appendChild(document.getElementById(d.tpl).content.cloneNode(true));return}
  main.innerHTML='<div class="doclist">'+DOCS.map(x=>`<button class="doccard" data-act="opendoc" data-id="${x.id}">
    <span class="ic" style="background:${x.bg}">${x.tag}</span><span class="grow"><b>${esc(x.title)}</b><span class="sub">${esc(x.sub)}</span></span><span class="sub" style="font-size:20px">&#8250;</span></button>`).join('')+'</div>';
}
function renderMonth(main){
  const a=S.anchor,first=new Date(a.getFullYear(),a.getMonth(),1),start=mondayOf(first);
  const last=new Date(a.getFullYear(),a.getMonth()+1,0);
  const weeks=Math.ceil(((last-start)/864e5+1)/7);
  const tk=todayKey();let cells='';
  for(let i=0;i<weeks*7;i++){
    const d=addDays(start,i),k=keyOf(d),items=sortItems(getDay(k));
    const all=items.length&&items.every(x=>x.done);
    cells+=`<button class="cell ${d.getMonth()!==a.getMonth()?'out':''} ${k===tk?'today':''} ${all?'alldone':''}" data-act="day" data-k="${k}">
      <span class="n">${d.getDate()}</span>
      ${items.slice(0,3).map(e=>{const v=view(e);return`<span class="mi ${e.done?'dn':e.missed?'ms':''}" style="--c:${esc(v.color)}">${esc(v.name)}</span>`}).join('')}
      ${items.length>3?`<span class="more">+${items.length-3}</span>`:''}</button>`;
  }
  main.innerHTML=`<div class="month"><div class="mh">${DOW.map(x=>`<div>${x[0]}</div>`).join('')}</div><div class="mg">${cells}</div></div>
    <div class="wfoot"><button class="btn" data-act="export">Send month to phone calendar</button></div>`;
}
function themeCard(page){
  const cur=pickTheme(),m=S.meta||{},strip=k=>`<span class="tstrip">${THEMES[k].sw.map(c=>`<i style="background:${c}"></i>`).join('')}</span>`;
  if(!page&&!S.openThemes)return `<div class="libcat closed"><button class="lhead" data-act="openthemes">${strip(cur.key)}<span class="grow"><b>Themes</b><span class="sub">Now: ${esc(THEMES[cur.key].name)} · ${esc(cur.why)}</span></span><span class="chev">&#8250;</span></button></div>`;
  const now=new Date(),fmt=d=>`${MON[d.getMonth()]} ${d.getDate()}`,rng=([a,b])=>+a===+b?fmt(a):`${fmt(a)} - ${fmt(b)}`;
  const Y=now.getFullYear(),ord=h=>{if(h.key==='newyear')return 0;const a=h.win(Y)[0];return a.getMonth()*100+a.getDate()+(h.kind==='h'?0.5:0)};
  const cal=[...HOLIDAYS.map(h=>({...h,kind:'h'})),...SEASONS.map(x=>({...x,kind:'s'}))].sort((a,b)=>ord(a)-ord(b));
  const prev=['sunset',...[...new Set(cal.map(x=>x.theme).filter(Boolean))]];
  return `<div class="libcat"><div class="row">${strip(cur.key)}<b class="grow" style="font-size:16px">Themes</b>${page?'':'<button class="x chevb" data-act="openthemes" aria-label="Collapse"><span class="chev on">&#8250;</span></button>'}</div>
    <div class="sub" style="margin-top:6px">Showing <b>${esc(THEMES[cur.key].name)}</b> (${esc(cur.why)}).</div>
    <div class="row" style="margin-top:10px"><span class="grow">Holiday themes</span><button class="pill ${m.holidayThemes!==false?'on':''}" data-act="tholiday">${m.holidayThemes!==false?'On':'Off'}</button></div>
    <div class="lbl">Preview</div><div class="chips">${prev.map(k=>`<button class="chip ${S.preview===k?'on':''}" style="--c:var(--accent)" data-act="tpreview" data-v="${k}">${strip(k)} ${esc(THEMES[k].name)}</button>`).join('')}
      ${S.preview?'<button class="chip" data-act="tpreview" data-v="">Stop preview</button>':''}</div>
    <div class="lbl">Activity colors in this theme</div><div class="slotrow">${slotColors().map((c,i)=>`<span style="background:${c}">${i+1}</span>`).join('')}</div>
    <div class="sub" style="margin-top:4px">Each activity uses a numbered slot. Tap an activity's color dot to cycle through these.</div>
    <div class="lbl">Calendar</div>
    <div class="sub" style="margin-bottom:4px">Holidays switch on automatically. Seasons run only when you turn them on.</div>
    ${cal.map(x=>{const w=nextWin(x,now),hol=x.kind==='h';return `<div class="trow ${hol?'hol':''}"><span class="grow"><b>${esc(x.name)}</b><span class="sub">${hol?'Holiday':'Season'} · ${rng(w)}</span></span>${x.theme?strip(x.theme):''}${!hol&&x.theme?`<button class="pill ${(m.seasons||{})[x.key]?'on':''}" data-act="tseason" data-v="${x.key}">${(m.seasons||{})[x.key]?'On':'Off'}</button>`:hol?'<span class="tauto">Auto</span>':''}</div>`}).join('')}
  </div>`;
}
function photoCard(page){
  const P=photos(),n=P.photos.length,act=P.active===ALL?'All photos':P.active,can=!!ASSETS;
  if(!page&&!S.openPhotos)return `<div class="libcat closed"><button class="lhead" data-act="openphotos"><span class="phic"></span><span class="grow"><b>Home photos</b><span class="sub">${n} photo${n===1?'':'s'} · Playing: ${esc(act)}</span></span><span class="chev">&#8250;</span></button></div>`;
  const sel=P.photos.find(p=>p.id===S.photoSel),cnt=a=>a===ALL?n:P.photos.filter(p=>p.album===a).length;
  const panel=p=>`<div class="psel"><div class="row"><span class="sub grow">Album</span><select id="p-move" data-id="${esc(p.id)}">${P.albums.map(a=>`<option ${a===p.album?'selected':''}>${esc(a)}</option>`).join('')}</select></div>
    <div class="row"><span class="sub grow">Keep in frame</span><div class="seg small">${[[25,'Left'],[50,'Center'],[75,'Right']].map(([v,l])=>`<button class="${(p.x??50)===v?'on':''}" data-act="pcrop" data-v="${v}">${l}</button>`).join('')}</div></div>
    <button class="danger" data-act="premove" data-id="${esc(p.id)}" style="justify-self:start;padding:6px 0">Remove photo</button></div>`;
  return `<div class="libcat"><div class="row"><span class="phic"></span><b class="grow" style="font-size:16px">Home photos</b>${page?'':'<button class="x chevb" data-act="openphotos" aria-label="Collapse"><span class="chev on">&#8250;</span></button>'}</div>
    <div class="lbl">Plays on Home</div><div class="chips">${[ALL,...P.albums].map(a=>`<button class="chip ${P.active===a?'on':''}" style="--c:var(--accent)" data-act="palbum" data-v="${esc(a)}">${a===ALL?'All photos':esc(a)} <span class="pc">${cnt(a)}</span></button>`).join('')}</div>
    <div class="row" style="margin-top:10px"><span class="sub grow">New photo every</span><select id="p-speed">${[6,10,15,20,30].map(v=>`<option value="${v}" ${(P.speed||10)===v?'selected':''}>${v} seconds</option>`).join('')}</select></div>
    <div class="row" style="margin-top:8px"><span class="sub grow">Slow zoom</span><button class="pill ${P.zoom!==false?'on':''}" data-act="pzoom">${P.zoom!==false?'On':'Off'}</button></div>
    ${P.albums.map((a,ai)=>`<div class="libgrp open"><div class="row"><input class="gname" value="${esc(a)}" data-edit="album" data-a="${ai}"><button class="x" data-act="delalbum" data-a="${ai}" aria-label="Delete album">&times;</button></div>
      <div class="pgrid">${P.photos.filter(p=>p.album===a).map(p=>`<button class="pth ${S.photoSel===p.id?'sel':''}" data-act="psel" data-id="${esc(p.id)}" style="background-image:url('${photoSrc(p)}');background-position:${p.x??50}% 50%" aria-label="Photo options"></button>`).join('')}
      ${can?`<label class="pth add" aria-label="Add photos">+<input type="file" accept="image/*" multiple hidden data-upload="${esc(a)}"></label>`:''}</div>
      ${sel&&sel.album===a?panel(sel):''}</div>`).join('')}
    <div class="row"><input class="grow" placeholder="+ New album (e.g. Travel)" data-add="album" enterkeyhint="done" style="margin-top:10px"></div>
    ${can?'<div class="sub" style="margin-top:8px">Tap + to add from your camera roll. Tap a photo to move it, adjust its crop, or remove it.</div>':'<div class="sub" style="margin-top:8px">Adding photos works when Daybook is open on claude.ai, signed in as you.</div>'}
  </div>`;
}
async function shrink(file){
  let src;try{src=await createImageBitmap(file,{imageOrientation:'from-image'})}catch(e){src=await new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=rej;im.src=URL.createObjectURL(file)})}
  const w=src.width,h=src.height,sc=Math.min(1,1600/Math.max(w,h)),c=document.createElement('canvas');c.width=Math.round(w*sc);c.height=Math.round(h*sc);
  c.getContext('2d').drawImage(src,0,0,c.width,c.height);
  return await new Promise(r=>c.toBlob(r,'image/jpeg',.82));
}
async function uploadPhotos(files,album){
  if(!ASSETS)return;const P=photos();let ok=0;
  for(let i=0;i<files.length;i++){toast(`Adding photo ${i+1} of ${files.length}...`);
    try{const blob=await shrink(files[i]);const r=await ASSETS.upload(blob,{type:'image/jpeg'});urlCache[r.id]=r.url;
      P.photos.push({id:'u-'+rid(),asset:r.id,album,x:50});ok++;markDirty('photos')}
    catch(e){toast(e&&e.code==='quota_or_state'?'Photo storage is full':e&&e.code==='too_large'?'That photo is too large':"Couldn't add that photo");await new Promise(r=>setTimeout(r,1200))}}
  if(ok)toast(`Added ${ok} photo${ok===1?'':'s'}`);render();refreshSlides();
}
function renderActs(main){
  const L=lib(),ed=S.editItem,OC=S.openCats||(S.openCats=new Set()),OG=S.openGrps||(S.openGrps=new Set());
  const up=(act,ds,dis)=>`<button class="x" data-act="${act}" ${ds} data-d="-1" ${dis?'disabled style="opacity:.25"':''} aria-label="Move up">&#8593;</button>`;
  const dn=(act,ds,dis)=>`<button class="x" data-act="${act}" ${ds} data-d="1" ${dis?'disabled style="opacity:.25"':''} aria-label="Move down">&#8595;</button>`;
  const chev=(open,act,attrs)=>`<button class="x chevb" data-act="${act}" ${attrs} aria-label="${open?'Collapse':'Expand'}"><span class="chev ${open?'on':''}">&#8250;</span></button>`;
  main.innerHTML=`<div class="libtop"><span class="sub grow">Tap an activity to open it, then tap a group to see its options.</span><button class="pill" data-act="libtoggleall">${OC.size?'Collapse all':'Expand all'}</button></div>`
  +L.cats.map((c,ci)=>{
    const n=c.groups.reduce((a,g)=>a+g.items.length,0),meta=`${c.groups.length} group${c.groups.length===1?'':'s'} · ${n} option${n===1?'':'s'}`;
    if(!OC.has(c.id))return `<div class="libcat closed"><button class="lhead" data-act="opencat" data-id="${esc(c.id)}">
      <span class="swatch" style="background:${esc(catColor(c))}"></span><span class="grow"><b>${esc(c.name)}</b><span class="sub">${meta}</span></span><span class="chev">&#8250;</span></button></div>`;
    return `<div class="libcat">
    <div class="row"><button class="swatch" style="background:${esc(catColor(c))}" data-act="color" data-c="${ci}" aria-label="Change color"></button>
      <input class="lname" value="${esc(c.name)}" data-edit="cat" data-c="${ci}">
      ${up('mvcat',`data-c="${ci}"`,ci===0)}${dn('mvcat',`data-c="${ci}"`,ci===L.cats.length-1)}
      <button class="x" data-act="delcat" data-c="${ci}" aria-label="Delete activity">&times;</button>
      ${chev(true,'opencat',`data-id="${esc(c.id)}"`)}</div>
    ${c.groups.length?'':'<div class="sub" style="margin:6px 4px 0">No groups yet. Add one below, like "Books".</div>'}
    ${c.groups.map((g,gi)=>{const gk=c.id+'|'+g.name;
      if(!OG.has(gk))return `<div class="libgrp"><button class="ghead" data-act="opengrp" data-k="${esc(gk)}"><span class="gtitle">${esc(g.name)}</span><span class="cnt">${g.items.length}</span><span class="grow"></span><span class="chev">&#8250;</span></button></div>`;
      return `<div class="libgrp open">
      <div class="row"><input class="gname" value="${esc(g.name)}" data-edit="grp" data-c="${ci}" data-g="${gi}">
        ${up('mvgrp',`data-c="${ci}" data-g="${gi}"`,gi===0)}${dn('mvgrp',`data-c="${ci}" data-g="${gi}"`,gi===c.groups.length-1)}
        <button class="x" data-act="delgrp" data-c="${ci}" data-g="${gi}" aria-label="Delete group">&times;</button>
        ${chev(true,'opengrp',`data-k="${esc(gk)}"`)}</div>
      <div class="chips">${g.items.map((it,ii)=>ed&&ed.c===ci&&ed.g===gi&&ed.i===ii
        ?`<input class="additem" value="${esc(it)}" data-edit="item" data-c="${ci}" data-g="${gi}" data-i="${ii}" enterkeyhint="done" style="width:170px">`
        :`<span class="chip ed"><button data-act="renitem" data-c="${ci}" data-g="${gi}" data-i="${ii}">${esc(it)}</button><button class="x" data-act="delitem" data-c="${ci}" data-g="${gi}" data-i="${ii}" aria-label="Remove">&times;</button></span>`).join('')}
        <input class="additem" placeholder="+ Add" data-add="item" data-c="${ci}" data-g="${gi}" enterkeyhint="done"></div></div>`}).join('')}
    <div class="row"><input class="grow" placeholder="+ New group (e.g. Books, Lenses)" data-add="grp" data-c="${ci}" enterkeyhint="done" style="margin-top:10px"></div>
  </div>`}).join('')+`<div class="libcat"><input class="newcat" placeholder="+ New activity (e.g. Reading)" data-add="cat" enterkeyhint="done"></div>`;
  if(ed){const n=main.querySelector('input[data-edit="item"]');if(n){n.focus();n.select()}}
}
function renderLib(main){
  const sec=S.editSec;
  if(sec==='acts')return renderActs(main);
  if(sec==='themes'){main.innerHTML=themeCard(true);return}
  if(sec==='photos'){main.innerHTML=photoCard(true);return}
  if(sec==='data'){main.innerHTML=dataCard();return}
  const L=lib(),nopt=L.cats.reduce((a,c)=>a+c.groups.reduce((x,g)=>x+g.items.length,0),0),P=photos(),cur=pickTheme(),lb=S.meta&&S.meta.lastBackup;
  const strip=k=>`<span class="tstrip">${THEMES[k].sw.map(c=>`<i style="background:${c}"></i>`).join('')}</span>`;
  const dots=`<span class="secdots">${L.cats.slice(0,4).map(c=>`<i style="background:${esc(catColor(c))}"></i>`).join('')}</span>`;
  const card=(v,icon,title,sub)=>`<div class="libcat closed"><button class="lhead" data-act="esec" data-v="${v}">${icon}<span class="grow"><b>${title}</b><span class="sub">${sub}</span></span><span class="chev">&#8250;</span></button></div>`;
  main.innerHTML=card('acts',dots,'Activities',`${L.cats.length} activities · ${nopt} options`)
    +card('themes',strip(cur.key),'Themes',`Now: ${esc(THEMES[cur.key].name)} · ${esc(cur.why)}`)
    +card('photos','<span class="phic"></span>','Home photos',`${P.photos.length} photos · Playing: ${esc(P.active===ALL?'All photos':P.active)}`)
    +card('data','<span class="dataic">&#8681;</span>','Your data',lb?`Last backup ${MON[parse(lb).getMonth()]} ${parse(lb).getDate()}`:'No backup yet');
}
function dataCard(){return `<div class="libcat"><b>Your data</b><div class="sub" style="margin-top:4px">Save a copy of everything (activities and every scheduled item) as a file. Restoring replaces what's here with the file.</div>
  ${S.pendingRestore?`<div class="banner" style="margin:10px 0 0">Replace all current data with the backup from ${esc((S.pendingRestore.saved||'').slice(0,10)||'that file')}?</div>
    <div class="datarow"><button class="btn armed" data-act="restoreok">Replace</button><button class="btn" data-act="restorecancel">Cancel</button></div>`
  :`<div class="datarow"><button class="btn" data-act="backup">Back up to file</button><label class="btn" style="cursor:pointer">Restore from file<input type="file" id="restore" accept=".json,application/json" hidden></label></div>`}</div>`}

/* ---------- sheets ---------- */
function openEditor(k,entry,back){
  const fut=entry?new Set(futureOf(entry,k)).size:0;
  const d=parse(k);
  S.sheet={type:'edit',k,back,id:entry?entry.id:null,cat:entry?entry.cat:null,picks:new Set(entry?entry.picks||[]:[]),
    note:entry?entry.note||'':'',time:entry?entry.time||'':'',dows:new Set([(d.getDay()+6)%7]),weeks:1,rmode:'weekly',months:12,mday:'date',scope:'one',fut,status:entry?(entry.done?'done':entry.missed?'missed':'open'):'open',ghost:entry&&!catById(entry.cat)?{name:entry.catName,color:slotColors()[nearestSlot(fixC(entry.color))]}:null};
  drawSheet();
}
function drawSheet(){
  const el=$('#sheet'),s=S.sheet;
  if(!s){el.innerHTML='';return}
  const ob=el.querySelector('.sh-body'),keep=ob&&ob.dataset.key===s.type+s.k+(s.id||'')?ob.scrollTop:0;
  requestAnimationFrame(()=>{const nb=el.querySelector('.sh-body');if(nb){nb.dataset.key=s.type+s.k+(s.id||'');if(keep)nb.scrollTop=keep}});
  const d=parse(s.k),title=`${DOW[(d.getDay()+6)%7]}, ${MON[d.getMonth()]} ${d.getDate()}`;
  if(s.type==='day'){
    const items=sortItems(getDay(s.k));
    el.innerHTML=`<div class="sheet-wrap"><div class="sheet-bg" data-act="close"></div><div class="sheet daysheet"><div class="grab"></div>
      <div class="sh-head"><b>${title}</b><button data-act="close">Done</button></div>
      <div class="sh-body">${items.length?items.map(e=>itemRow(s.k,e)).join(''):'<div class="empty">Nothing planned.</div>'}</div>
      <div class="sh-foot"><button class="primary" data-act="new" data-k="${s.k}" data-back="day">+ Add</button></div></div></div>`;
    return;
  }
  const L=lib(),cat=catById(s.cat),edit=!!s.id;
  const cats=L.cats.map(c=>`<button class="chip cat ${s.cat===c.id?'on':''}" style="--c:${esc(catColor(c))}" data-act="pickcat" data-id="${esc(c.id)}"><i></i>${esc(c.name)}</button>`).join('')
    +(s.ghost&&!cat?`<button class="chip cat on" style="--c:${esc(s.ghost.color)}"><i></i>${esc(s.ghost.name)}</button>`:'')
    +`<button class="chip" data-act="gotoedit">+ New activity</button>`;
  const addIn=gi=>`<input class="additem" placeholder="+ Add" data-add="sheetitem" data-g="${gi}" enterkeyhint="done">`;
  const groups=cat?`<div class="tree" style="--c:${esc(catColor(cat))}"><div class="tree-head"><i></i>${esc(cat.name)}</div>`+(cat.groups.length?cat.groups.map((g,gi)=>`<div class="branch"><div class="lbl">${esc(g.name)}</div><div class="chips">${g.items.map((it,ii)=>
      `<button class="chip ${s.picks.has(it)?'on':''}" style="--c:${esc(catColor(cat))}" data-act="pick" data-g="${gi}" data-i="${ii}">${esc(it)}</button>`).join('')}${addIn(gi)}</div></div>`).join('')
      :`<div class="branch"><div class="lbl">Options</div><div class="chips">${addIn(-1)}</div></div>`)+'</div>':'';
  const dn=d.getDate(),isLast=dn===new Date(d.getFullYear(),d.getMonth()+1,0).getDate(),ord=n=>n+(n%10===1&&n!==11?'st':n%10===2&&n!==12?'nd':n%10===3&&n!==13?'rd':'th');
  const repeat=edit?'':`<div class="lbl">Repeat</div>
    <div class="seg"><button class="${s.rmode==='weekly'?'on':''}" data-act="rmode" data-v="weekly">Weekly</button><button class="${s.rmode==='monthly'?'on':''}" data-act="rmode" data-v="monthly">Monthly</button></div>
    ${s.rmode==='weekly'?`<div class="dows">${DOW.map((x,i)=>`<button class="${s.dows.has(i)?'on':''}" data-act="dow" data-i="${i}">${x[0]}</button>`).join('')}</div>
    <div class="row" style="margin-top:10px"><span class="sub grow">For how many weeks</span>
    <select id="f-weeks">${[1,2,3,4,6,8,12].map(w=>`<option value="${w}" ${s.weeks===w?'selected':''}>${w===1?'Just this week':w+' weeks'}</option>`).join('')}</select></div>`
    :`${isLast?`<div class="seg"><button class="${s.mday!=='last'?'on':''}" data-act="mday" data-v="date">The ${ord(dn)}</button><button class="${s.mday==='last'?'on':''}" data-act="mday" data-v="last">Last day of month</button></div>`:''}
    <div class="sub" style="margin-top:8px">${isLast&&s.mday==='last'?'On the <b>last day</b> of every month: the 31st, 30th, or 28th/29th in February.':`On the <b>${ord(dn)}</b> of each month${dn>28?', or the last day in shorter months':''}.`}</div>
    <div class="row" style="margin-top:10px"><span class="sub grow">For how many months</span>
    <select id="f-months">${[1,3,6,12,18,24].map(m=>`<option value="${m}" ${s.months===m?'selected':''}>${m===1?'Just this month':m+' months'}</option>`).join('')}</select></div>`}`;
  const ok=!!(cat||s.ghost);
  el.innerHTML=`<div class="sheet-wrap"><div class="sheet-bg" data-act="close"></div><div class="sheet"><div class="grab"></div>
    <div class="sh-head"><b>${edit?'Edit':'Add'} · ${title}</b><button data-act="close">Cancel</button></div>
    <div class="sh-body">
      <div class="lbl">Activity${({photo:'syllabus',it:'it',uk:'uk'})[s.cat]?`<button class="doclink" data-act="opendoc" data-id="${({photo:'syllabus',it:'it',uk:'uk'})[s.cat]}">View syllabus</button>`:''}</div><div class="chips">${cats}</div>
      ${groups}
      ${edit&&s.fut?`<div class="lbl">Changes apply to</div><div class="seg"><button class="${s.scope!=='future'?'on':''}" data-act="scope" data-v="one">This one</button><button class="${s.scope==='future'?'on':''}" data-act="scope" data-v="future">This &amp; ${s.fut} future</button></div><div class="sub" style="margin:-2px 0 4px">Applies to edits and Delete. Status always changes just this one.</div>`:''}
      ${edit?`<div class="lbl">Status</div><div class="stat-row">${[['open','Open'],['done','Done'],['missed','Missed']].map(([v,l])=>`<button class="chip ${s.status===v?'on':''} ${v==='missed'?'ms':''}" style="--c:var(--done)" data-act="status" data-v="${v}">${l}</button>`).join('')}</div>`:''}
      ${ok?`<div class="lbl">Time (optional, sets the reminder)</div>
      <div class="row"><input type="time" id="f-time" value="${esc(s.time)}" class="grow"><button class="pill" data-act="cleartime">No time</button></div>
      <div class="lbl">Note (optional)</div><input id="f-note" value="${esc(s.note)}" placeholder="Anything extra" style="width:100%">
      ${repeat}`:'<div class="sub" style="margin-top:12px">Pick an activity to see its options.</div>'}
    </div>
    <div class="sh-foot">${edit?'<button class="danger" data-act="delentry">Delete</button>':''}<button class="primary" data-act="save" ${ok?'':'disabled'}>Save</button></div>
  </div></div>`;
}
function readInputs(){const s=S.sheet;if(!s||s.type!=='edit')return;const t=$('#f-time'),n=$('#f-note'),w=$('#f-weeks'),mo=$('#f-months');if(mo)s.months=+mo.value;
  if(t)s.time=t.value;if(n)s.note=n.value.trim();if(w)s.weeks=+w.value}
function closeSheet(){S.sheet=null;drawSheet()}
/* ---------- series helpers ---------- */
function sameSeries(a,b){if(a.series||b.series)return !!a.series&&a.series===b.series;
  return a.cat===b.cat&&(a.time||'')===(b.time||'')&&(a.note||'')===(b.note||'')&&(a.picks||[]).join('|')===(b.picks||[]).join('|')}
function futureOf(orig,fromK){const out=[];
  for(const m of Object.values(S.months))for(const [k,arr] of Object.entries(m.days||{}))if(k>fromK)for(const e of arr)if(e.id!==orig.id&&sameSeries(orig,e))out.push(k);
  return out}
function applyFuture(orig,fromK,fn){const keys=[...new Set(futureOf(orig,fromK))];
  for(const k of keys)setDay(k,getDay(k).flatMap(e=>e.id!==orig.id&&sameSeries(orig,e)?fn(e):[e]));return keys.length}
function saveEntry(){
  readInputs();const s=S.sheet,cat=catById(s.cat);
  const order=cat?cat.groups.flatMap(g=>g.items):[];
  const picks=[...order.filter(x=>s.picks.has(x)),...[...s.picks].filter(x=>!order.includes(x))];
  const base={cat:s.cat,catName:cat?cat.name:s.ghost.name,color:cat?cat.color:s.ghost.color,picks,note:s.note,time:s.time};
  if(s.id){
    const orig=getDay(s.k).find(e=>e.id===s.id);
    setDay(s.k,getDay(s.k).map(e=>e.id===s.id?{...e,...base,done:s.status==='done',missed:s.status==='missed'}:e));
    if(orig&&s.scope==='future'){const n=applyFuture(orig,s.k,e=>[{...e,...base}]);if(n)toast(`Updated this and ${n} future`)}
  }else{
    const startD=parse(s.k),mon=mondayOf(startD);let count=0;
    if((s.rmode==='monthly'&&s.months>1)||(s.rmode!=='monthly'&&(s.weeks>1||s.dows.size>1)))base.series=rid();
    if(s.rmode==='monthly'){const day=startD.getDate();
      for(let m=0;m<s.months;m++){const y=startD.getFullYear(),mm=startD.getMonth()+m,last=new Date(y,mm+1,0).getDate();
        const isLast=day===new Date(startD.getFullYear(),startD.getMonth()+1,0).getDate(),useLast=isLast&&s.mday==='last';
        const k=keyOf(new Date(y,mm,useLast?last:Math.min(day,last)));setDay(k,[...getDay(k),{id:rid(),...base,done:false}]);count++}
    }else
    for(let w=0;w<s.weeks;w++)for(const i of [...s.dows].sort()){
      const d=addDays(mon,w*7+i);if(d<startD)continue;
      const k=keyOf(d);setDay(k,[...getDay(k),{id:rid(),...base,done:false}]);count++;
    }
    if(count>1)toast(`Added ${count} times`);
  }
  const back=s.back,k=s.k;
  if(back==='day')S.sheet={type:'day',k};else S.sheet=null;
  drawSheet();render();
}

/* ---------- export (.ics) ---------- */
async function exportIcs(){
  let days=[];
  if(S.view==='week'){const s=mondayOf(S.anchor);for(let i=0;i<(S.five?5:7);i++)days.push(keyOf(addDays(s,i)))}
  else{const a=S.anchor,n=new Date(a.getFullYear(),a.getMonth()+1,0).getDate();for(let i=1;i<=n;i++)days.push(keyOf(new Date(a.getFullYear(),a.getMonth(),i)))}
  const ie=s=>String(s).replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\n/g,'\\n');
  const now=new Date(),stamp=`${now.getUTCFullYear()}${pad(now.getUTCMonth()+1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}00Z`;
  const L=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Daybook//EN','CALSCALE:GREGORIAN'];let n=0;
  for(const k of days)for(const e of getDay(k)){
    if(e.done||e.missed)continue;n++;
    const v=view(e),ymd=k.replace(/-/g,'');
    L.push('BEGIN:VEVENT',`UID:${e.id}@daybook`,`DTSTAMP:${stamp}`,`SUMMARY:${ie(v.name+(e.picks&&e.picks.length?': '+e.picks.join(', '):''))}`);
    if(e.note)L.push(`DESCRIPTION:${ie(e.note)}`);
    if(e.time){const[h,m]=e.time.split(':').map(Number);const end=new Date(2000,0,1,h,m+45);
      L.push(`DTSTART:${ymd}T${pad(h)}${pad(m)}00`,`DTEND:${ymd}T${pad(end.getHours())}${pad(end.getMinutes())}00`,'BEGIN:VALARM','ACTION:DISPLAY',`DESCRIPTION:${ie(v.name)}`,'TRIGGER:-PT15M','END:VALARM');}
    else{L.push(`DTSTART;VALUE=DATE:${ymd}`,`DTEND;VALUE=DATE:${keyOf(addDays(parse(k),1)).replace(/-/g,'')}`,'BEGIN:VALARM','ACTION:DISPLAY',`DESCRIPTION:${ie(v.name)}`,'TRIGGER:PT8H','END:VALARM');}
    L.push('END:VEVENT');
  }
  L.push('END:VCALENDAR');
  if(!n){toast('Nothing open to send in this view');return}
  const text=L.join('\r\n');
  let dl=null;try{dl=window.claude&&await window.claude.use('downloads')}catch(e){}
  if(dl){try{await dl.save({filename:S.view==='week'?'daybook-week.ics':'daybook-month.ics',data:text});toast('Open the file to add it to your calendar');return}catch(e){toast('Download cancelled');return}}
  try{await navigator.clipboard.writeText(text);toast('Calendar file copied')}catch(e){toast('Downloads are not available here')}
}

/* ---------- backup reminder ticker (1st & 15th) ---------- */
function backupDue(){const n=new Date(),d=n.getDate();
  return keyOf(new Date(n.getFullYear(),n.getMonth(),d>=15?15:1))}
function renderTicker(){
  const el=$('#ticker');if(!el)return;
  const due=backupDue(),last=(S.meta&&S.meta.lastBackup)||'';
  let hid='';try{hid=localStorage.getItem('daybook:tickerhide')||''}catch(e){}
  if(!S.ready||last>=due||hid===todayKey()){el.innerHTML='';return}
  el.innerHTML=`<div class="ticker"><div class="run" data-act="backup"><span>Backup day: tap here to save a copy of your Daybook data to Files or iCloud Drive &nbsp;&#9679;&nbsp; There is no automatic copy anywhere else, so a fresh backup keeps your plans safe</span></div><button class="x" data-act="hideticker" aria-label="Hide for today">&times;</button></div>`;
}

/* ---------- backup / restore ---------- */
async function backup(){
  const data=JSON.stringify({app:'daybook',format:1,saved:new Date().toISOString(),library:lib(),months:S.months,photos:S.photos||null});
  let dl=null;try{dl=window.claude&&await window.claude.use('downloads')}catch(e){}
  const done=()=>{S.meta={...(S.meta||{}),lastBackup:todayKey()};markDirty('meta');renderTicker()};
  if(dl){try{await dl.save({filename:`daybook-backup-${todayKey()}.json`,data});done();toast('Backup saved')}catch(e){toast('Backup cancelled')}return}
  try{await navigator.clipboard.writeText(data);done();toast('Backup copied to clipboard')}catch(e){toast('Downloads are not available here')}
}
function applyRestore(){
  const o=S.pendingRestore;if(!o)return;S.pendingRestore=null;
  S.lib=migrate(clone(o.library));upgrade(S.lib);markDirty('library');
  for(const id of Object.keys(S.months))if(!o.months[id]){S.months[id]={days:{}};markDirty(id)}
  for(const [id,m] of Object.entries(o.months))if(/^m-\d{4}-\d{2}$/.test(id)){S.months[id]=clone(m);markDirty(id)}
  if(o.photos){S.photos=clone(o.photos);markDirty('photos');refreshSlides()}
  toast('Backup restored');render();
}

/* ---------- interactions ---------- */
let armedEl=null,armT=null;
function arm(el,label){ // two-tap confirm
  if(armedEl===el){clearTimeout(armT);armedEl=null;return true}
  if(armedEl){armedEl.classList.remove('armed');armedEl.innerHTML=armedEl.dataset.orig}
  el.dataset.orig=el.innerHTML;el.classList.add('armed');el.textContent=label;armedEl=el;
  clearTimeout(armT);armT=setTimeout(()=>{if(armedEl===el){el.classList.remove('armed');el.innerHTML=el.dataset.orig;armedEl=null}},3000);
  return false;
}
function toast(m){const t=$('#toast');t.innerHTML=`<div class="toast">${esc(m)}</div>`;clearTimeout(toast.t);toast.t=setTimeout(()=>t.innerHTML='',2200)}
function libChanged(){markDirty('library');render()}

document.addEventListener('click',ev=>{
  const b=ev.target.closest('[data-act]');if(!b)return;
  const a=b.dataset.act,k=b.dataset.k,ds=b.dataset;
  if(armedEl&&armedEl!==b){armedEl.classList.remove('armed');armedEl.innerHTML=armedEl.dataset.orig;armedEl=null}
  switch(a){
    case 'view':if(ds.v==='docs'&&S.view==='docs')S.doc=null;if(ds.v==='lib'&&S.view==='lib')S.editSec=null;S.view=ds.v;savePrefs();render();APP.scrollTo(0,0);if(S.view==='week')setTimeout(scrollToday,150);break;
    case 'five':S.five=!S.five;savePrefs();render();break;
    case 'today':S.anchor=new Date();render();scrollToday();break;
    case 'prev':case 'next':{const dir=a==='next'?1:-1;
      S.anchor=S.view==='week'?addDays(S.anchor,7*dir):new Date(S.anchor.getFullYear(),S.anchor.getMonth()+dir,1);render();break}
    case 'new':readInputs();openEditor(k,null,ds.back);break;
    case 'edit':{const e=getDay(k).find(x=>x.id===ds.id);if(e)openEditor(k,e,S.sheet&&S.sheet.type==='day'?'day':null);break}
    case 'toggle':{let msg='';setDay(k,getDay(k).map(e=>{if(e.id!==ds.id)return e;
        if(!e.done&&!e.missed)return{...e,done:true,missed:false};
        if(e.done){msg='Marked missed · tap again to reopen';return{...e,done:false,missed:true}}
        return{...e,done:false,missed:false}}));if(msg)toast(msg);render();if(S.sheet&&S.sheet.type==='day')drawSheet();break}
    case 'day':S.sheet={type:'day',k};drawSheet();break;
    case 'close':{const s=S.sheet;if(s&&s.type==='edit'&&s.back==='day'){S.sheet={type:'day',k:s.k}}else S.sheet=null;drawSheet();break}
    case 'pickcat':readInputs();if(S.sheet.cat!==ds.id){S.sheet.cat=ds.id;S.sheet.picks=new Set();S.sheet.ghost=null}drawSheet();break;
    case 'pick':{readInputs();const it=catById(S.sheet.cat).groups[+ds.g].items[+ds.i];S.sheet.picks.has(it)?S.sheet.picks.delete(it):S.sheet.picks.add(it);drawSheet();break}
    case 'dow':readInputs();{const i=+ds.i,s=S.sheet.dows;s.has(i)?s.delete(i):s.add(i);if(!s.size)s.add(i)}drawSheet();break;
    case 'cleartime':S.sheet.time='';{const t=$('#f-time');if(t)t.value=''}break;
    case 'save':saveEntry();break;
    case 'scope':readInputs();S.sheet.scope=ds.v;drawSheet();break;
    case 'mday':readInputs();S.sheet.mday=ds.v;drawSheet();break;
    case 'rmode':readInputs();S.sheet.rmode=ds.v;drawSheet();break;
    case 'status':readInputs();S.sheet.status=ds.v;drawSheet();break;
    case 'delentry':if(arm(b,'Tap again to delete')){const s=S.sheet,orig=getDay(s.k).find(e=>e.id===s.id);
      if(orig&&s.scope==='future'){const n=applyFuture(orig,s.k,()=>[]);if(n)toast(`Deleted this and ${n} future`)}
      setDay(s.k,getDay(s.k).filter(e=>e.id!==s.id));
      if(s.back==='day')S.sheet={type:'day',k:s.k};else S.sheet=null;drawSheet();render()}break;
    case 'copyweek':{const s=mondayOf(S.anchor);let n=0;
      const hasAny=[0,1,2,3,4,5,6].some(i=>getDay(keyOf(addDays(s,i))).length);
      if(hasAny&&!arm(b,'This week has items. Tap again to add anyway'))break;
      for(let i=0;i<7;i++){const src=getDay(keyOf(addDays(s,i-7)));if(!src.length)continue;const k2=keyOf(addDays(s,i));
        setDay(k2,[...getDay(k2),...src.map(e=>({...e,id:rid(),done:false,missed:false,series:undefined}))]);n+=src.length}
      toast(n?`Copied ${n} items`:'Last week was empty');render();break}
    case 'export':exportIcs();break;
    case 'color':{const c=lib().cats[+ds.c];c.slot=((typeof c.slot==='number'?c.slot:nearestSlot(c.color))+1)%PALETTE.length;c.color=PALETTE[c.slot];libChanged();break}
    case 'delcat':if(arm(b,'Delete?')){lib().cats.splice(+ds.c,1);libChanged()}break;
    case 'delgrp':if(arm(b,'Delete?')){lib().cats[+ds.c].groups.splice(+ds.g,1);libChanged()}break;
    case 'mvcat':case 'mvgrp':{const L=lib(),arr=a==='mvcat'?L.cats:L.cats[+ds.c].groups,i=+(a==='mvcat'?ds.c:ds.g),j=i+(+ds.d);
      if(j<0||j>=arr.length)break;[arr[i],arr[j]]=[arr[j],arr[i]];S.editItem=null;libChanged();break}
    case 'opencat':{const O=S.openCats||(S.openCats=new Set());O.has(ds.id)?O.delete(ds.id):O.add(ds.id);render();break}
    case 'opengrp':{const O=S.openGrps||(S.openGrps=new Set());O.has(ds.k)?O.delete(ds.k):O.add(ds.k);render();break}
    case 'libtoggleall':{const O=S.openCats||(S.openCats=new Set());if(O.size){O.clear();S.openGrps&&S.openGrps.clear()}else lib().cats.forEach(c=>O.add(c.id));render();break}
    case 'esec':S.editSec=ds.v;render();APP.scrollTo(0,0);break;
    case 'eback':S.editSec=null;render();APP.scrollTo(0,0);break;
    case 'openthemes':S.openThemes=!S.openThemes;render();break;
    case 'tholiday':{S.meta={...(S.meta||{})};S.meta.holidayThemes=S.meta.holidayThemes===false;markDirty('meta');render();break}
    case 'tseason':{S.meta={...(S.meta||{})};const se={...(S.meta.seasons||{})};se[ds.v]=!se[ds.v];S.meta.seasons=se;markDirty('meta');render();break}
    case 'tpreview':S.preview=ds.v||null;render();break;
    case 'openphotos':S.openPhotos=!S.openPhotos;S.photoSel=null;render();break;
    case 'palbum':photos().active=ds.v;markDirty('photos');render();refreshSlides();break;
    case 'pzoom':{const P=photos();P.zoom=P.zoom===false;markDirty('photos');render();refreshSlides();break}
    case 'psel':S.photoSel=S.photoSel===ds.id?null:ds.id;render();break;
    case 'pcrop':{const p=photos().photos.find(x=>x.id===S.photoSel);if(p){p.x=+ds.v;markDirty('photos');render();refreshSlides()}break}
    case 'premove':if(arm(b,'Tap again to remove')){const P=photos(),p=P.photos.find(x=>x.id===ds.id);if(p){
        if(p.asset&&ASSETS)ASSETS.delete(p.asset).catch(()=>{});P.photos=P.photos.filter(x=>x.id!==p.id);S.photoSel=null;markDirty('photos');render();refreshSlides()}}break;
    case 'delalbum':{const P=photos(),a=P.albums[+ds.a];if(P.albums.length<2){toast('Keep at least one album');break}
      const has=P.photos.some(p=>p.album===a);if(has&&!arm(b,'Photos move to '+P.albums.find(x=>x!==a)))break;
      const to=P.albums.find(x=>x!==a);P.photos.forEach(p=>{if(p.album===a)p.album=to});P.albums=P.albums.filter(x=>x!==a);if(P.active===a)P.active=ALL;
      markDirty('photos');render();refreshSlides();break}
    case 'renitem':S.editItem={c:+ds.c,g:+ds.g,i:+ds.i};render();break;
    case 'gotoedit':S.sheet=null;drawSheet();S.view='lib';S.editSec='acts';savePrefs();render();APP.scrollTo(0,APP.scrollHeight);{const n=$('input[data-add="cat"]');if(n)n.focus()}break;
    case 'opendoc':S.sheet=null;drawSheet();S.view='docs';S.doc=ds.id;render();APP.scrollTo(0,0);break;
    case 'zoom':S.zoom=!S.zoom;render();break;
    case 'backup':backup();break;
    case 'hideticker':try{localStorage.setItem('daybook:tickerhide',todayKey())}catch(e){}renderTicker();break;
    case 'restoreok':applyRestore();break;
    case 'restorecancel':S.pendingRestore=null;render();break;
    case 'docback':S.doc=null;render();APP.scrollTo(0,0);break;
    case 'delitem':lib().cats[+ds.c].groups[+ds.g].items.splice(+ds.i,1);libChanged();break;
  }
});
document.addEventListener('keydown',ev=>{if(ev.key==='Enter'&&ev.target.matches('input[data-add],input[data-edit]')){ev.preventDefault();addFrom(ev.target,true)}});
document.addEventListener('change',ev=>{const t=ev.target;
  if(t.matches('input[data-edit="album"]')){const v=t.value.trim(),P=photos(),old=P.albums[+t.dataset.a];
    if(v&&v!==old&&!P.albums.includes(v)){P.albums[+t.dataset.a]=v;P.photos.forEach(p=>{if(p.album===old)p.album=v});if(P.active===old)P.active=v;markDirty('photos')}
    setTimeout(render,0);return}
  if(t.id==='p-speed'){photos().speed=+t.value;markDirty('photos');scheduleSlide();return}
  if(t.id==='p-move'){const p=photos().photos.find(x=>x.id===t.dataset.id);if(p){p.album=t.value;markDirty('photos');render();refreshSlides()}return}
  if(t.matches('input[data-upload]')&&t.files&&t.files.length){uploadPhotos([...t.files],t.dataset.upload);return}
  if(t.matches('input[data-edit]')){const v=t.value.trim();if(!v){S.editItem=null;setTimeout(render,0);return}
    const c=lib().cats[+t.dataset.c];
    if(t.dataset.edit==='item'){const g=c.groups[+t.dataset.g];if(!g.items.includes(v))g.items[+t.dataset.i]=v;S.editItem=null;setTimeout(libChanged,0);return}
    if(t.dataset.edit==='cat')c.name=v;else{const g=c.groups[+t.dataset.g],O=S.openGrps;if(O&&O.has(c.id+'|'+g.name)){O.delete(c.id+'|'+g.name);O.add(c.id+'|'+v)}g.name=v}markDirty('library')}
  else if(t.matches('input[data-add]'))addFrom(t,false);
  else if(t.id==='f-weeks')S.sheet.weeks=+t.value;
  else if(t.id==='restore'&&t.files&&t.files[0]){t.files[0].text().then(txt=>{let o;try{o=JSON.parse(txt)}catch(e){}
    if(!o||o.app!=='daybook'||!o.library||!o.months){toast("That file isn't a Daybook backup");return}
    S.pendingRestore=o;render()})}
});
document.addEventListener('focusout',ev=>{if(ev.target.matches('input[data-edit="item"]'))setTimeout(()=>{if(S.editItem){S.editItem=null;render()}},0)});
function addFrom(t,refocus){
  if(t.matches('[data-edit]')){t.blur();return}
  const v=t.value.trim();if(!v)return;
  if(t.dataset.add==='album'){const P=photos();t.value='';if(!P.albums.includes(v)){P.albums.push(v);markDirty('photos')}render();
    if(refocus){const n=document.querySelector('input[data-add="album"]');if(n)n.focus()}return}
  if(t.dataset.add==='sheetitem'){t.value='';readInputs();const cat=catById(S.sheet.cat);if(!cat)return;let gi=+t.dataset.g;
    if(gi<0){cat.groups.push({name:'Options',items:[]});gi=cat.groups.length-1}
    const g=cat.groups[gi];const fresh=+t.dataset.g<0;
    if(!g.items.includes(v)){g.items.push(v);S.sheet.picks.add(v);markDirty('library');
      if(!fresh){const bt=document.createElement('button');bt.className='chip on';bt.style.setProperty('--c',catColor(cat));bt.dataset.act='pick';bt.dataset.g=gi;bt.dataset.i=g.items.length-1;bt.textContent=v;t.before(bt);if(!refocus)t.blur();return}}
    drawSheet();
    if(refocus){const n=document.querySelector(`input[data-add="sheetitem"][data-g="${gi}"]`);if(n)n.focus()}return}const L=lib(),ds=t.dataset,sel=`input[data-add="${ds.add}"]`+(ds.c!=null?`[data-c="${ds.c}"]`:'')+(ds.g!=null?`[data-g="${ds.g}"]`:'');
  t.value='';
  const OC=S.openCats||(S.openCats=new Set()),OG=S.openGrps||(S.openGrps=new Set());
  if(ds.add==='cat'){const id=rid();L.cats.push({id,name:v,slot:L.cats.length%PALETTE.length,color:PALETTE[L.cats.length%PALETTE.length],groups:[]});OC.add(id);refocus=true}
  else if(ds.add==='grp'){const c=L.cats[+ds.c];if(!c.groups.some(g=>g.name===v)){c.groups.push({name:v,items:[]});OG.add(c.id+'|'+v)}}
  else{const g=L.cats[+ds.c].groups[+ds.g];if(g.items.includes(v))return;g.items.push(v);markDirty('library');
    const ii=g.items.length-1,sp=document.createElement('span');sp.className='chip ed';
    sp.innerHTML=`<button data-act="renitem" data-c="${ds.c}" data-g="${ds.g}" data-i="${ii}"></button><button class="x" data-act="delitem" data-c="${ds.c}" data-g="${ds.g}" data-i="${ii}" aria-label="Remove">&times;</button>`;
    sp.firstChild.textContent=v;t.before(sp);if(!refocus)t.blur();return}
  libChanged();
  if(refocus){const n=document.querySelector(ds.add==='cat'?`input[data-add="grp"][data-c="${L.cats.length-1}"]`:ds.add==='grp'?`input[data-add="item"][data-c="${ds.c}"][data-g="${L.cats[+ds.c].groups.length-1}"]`:sel);if(n)n.focus()}
}
function scrollToday(){const el=document.getElementById('d-'+todayKey());if(el)el.scrollIntoView({block:'center',behavior:'smooth'})}

init();
