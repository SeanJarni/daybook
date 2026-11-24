/* ---------- defaults ---------- */
const PALETTE=['#E56B5E','#BB405C','#F6A961','#583168','#843660','#C98A3B','#9E2F4E','#7A6A80','#A0705A'];
const OLDC={'#e4572e':'#E56B5E','#2f6fed':'#BB405C','#00a6a6':'#F6A961','#9b5de5':'#583168','#f2a541':'#843660','#2e9e5b':'#C98A3B','#d6336c':'#9E2F4E','#6c757d':'#7A6A80','#8d6e63':'#A0705A'};
const fixC=c=>OLDC[String(c||'').toLowerCase()]||c;
const _rgb=h=>{h=String(h||'#888').replace('#','');return[0,2,4].map(i=>parseInt(h.substr(i,2),16)||0)};
function nearestSlot(hex){const i=PALETTE.indexOf(hex);if(i>=0)return i;const a=_rgb(hex);let best=0,bd=1e9;PALETTE.forEach((p,j)=>{const b=_rgb(p),d=(a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2;if(d<bd){bd=d;best=j}});return best}
const migrate=L=>{if(L&&L.cats)L.cats.forEach(c=>{c.color=fixC(c.color);if(typeof c.slot!=='number')c.slot=nearestSlot(c.color)});return L};
const slotColors=()=>(THEMES[appliedTheme||'sunset']||THEMES.sunset).slots||PALETTE;
const catColor=c=>{const sl=slotColors();return sl[(typeof c.slot==='number'?c.slot:nearestSlot(c.color))%sl.length]};
const DEFAULT_LIB={cats:[
 {id:'lift',name:'Lift',color:'#E56B5E',groups:[
   {name:'Split',items:['Arm day','Triceps & shoulders','Chest','Back & biceps','Legs','Full body','Core']},
   {name:'Recovery',items:['Mobility','Stretching']}]},
 {id:'run',name:'Run',color:'#BB405C',groups:[
   {name:'Easy',items:['Easy run','Recovery run','Strides']},
   {name:'Quality',items:['Tempo','Intervals','Hill repeats','Fartlek']},
   {name:'Long',items:['Long run']}]},
 {id:'move',name:'Cardio & outdoors',color:'#F6A961',groups:[
   {name:'Activity',items:['Walk','Hike','Climbing gym','Bike']}]},
 {id:'photo',name:'Photography',color:'#583168',groups:[
   {name:'Bodies & drone',items:['Nikon Z8','Nikon D7500','Nikon D3400','DJI Mini 2']},
   {name:'Lenses',items:['Tokina 11-16mm f/2.8','18-55mm f/3.5-5.6 VR','35mm f/1.8G','50mm f/1.4G','50mm f/1.8D','55-300mm f/4.5-5.6 VR','200-500mm f/5.6E VR','105mm f/2.8D Micro','Laowa 100mm 2:1 macro']},
   {name:'Light scenario',items:['Wk 1 Window light','Wk 2 Golden hour & backlight','Wk 3 Harsh & overhead','Wk 4 Overcast & diffused','Wk 5 Low light & night','Wk 6 Mixed & artificial','Wk 7 Practical & creative','Wk 8 Client simulation']},
   {name:'Session',items:['Shoot block','Edit block','Quick shoot','Quick edit','Drone block']},
   {name:'Technique',items:['Rim light / backlight','Silhouettes','Intentional flare','Negative space','Shadow as subject','Expose for the face','Aperture depth separation','Macro 1:1','Macro 2:1','Moon at 500mm','Night sky long exposure','Light trails','Light painting','Manual Kelvin white balance','HDR bracketing (-2/0/+2)','Directing a subject','Pre-visualize 5 frames']},
   {name:'Subject',items:['Portrait','Cat','Real estate interior','Landscape','Street','Architecture','Macro detail','Moon / astro','Aerial']},
   {name:'Lighting gear',items:['Godox kit','Speedlight','Reflector','Practical light (lamp, candle, phone)','Colored gels / materials']},
   {name:'Post',items:['Cull to top 10','Edit top 5','Write frame notes','Lightroom edit','Flight log']}]},
 {id:'it',name:'Italian',color:'#C98A3B',groups:[
   {name:'Tutor (italki)',items:['Conversation session','Repair session (gap list)','Debate session','Grammar / writing session','Exam-format session']},
   {name:'Reading',items:['Io non ho paura','Seta','Marcovaldo',"L'amica geniale",'Se questo è un uomo','Il deserto dei Tartari']},
   {name:'Input & listening',items:['Slow-native podcast','Native podcast','Series (IT subtitles)','YouTube','No-subtitle content']},
   {name:'Vocab',items:['Anki (10 min)','Mine cards from reading']},
   {name:'Writing',items:['150-word journal','250-word opinion piece']},
   {name:'Grammar repair',items:['Congiuntivo','Condizionale composto','Pronomi combinati','Prepositions','Passato remoto (reading)','Hypotheticals (se + cong.)']},
   {name:'Practice & exam',items:['Language exchange (30 min)','Mock exam (timed)']},
   {name:'Milestones',items:['Demo recording','Gate assessment','Sunday review','Monthly gap-list review']}]},
 {id:'uk',name:'Ukrainian',color:'#9E2F4E',groups:[
   {name:'Core',items:['Pimsleur lesson','Ukrainian Lessons Podcast']},
   {name:'Vocab',items:['Anki reviews + 10 new','Cards from error log','Cards mined from input']},
   {name:'Ear & mouth',items:['Minimal-pair drills','Shadowing (sentence)','Shadowing (paragraph)','Shadowing (intonation)','Weekly shadowing recording']},
   {name:'Tutor (italki)',items:['Tutor session','Accent session']},
   {name:'Input',items:['YouTube (UA subtitles)','Learner podcast','Easy-Ukrainian news','Graded reader']},
   {name:'Writing',items:['Journal (8-10 sentences)']},
   {name:'Conversation',items:['Friend call / voice notes','Conversation club']},
   {name:'Milestones',items:['Demo video','Comprehension checkpoint','Gate assessment','Sunday review']}]},
 {id:'study',name:'Study',color:'#843660',groups:[
   {name:'Finance',items:['Derivatives','Fixed income','Attribution']},
   {name:'Other',items:['Reading','Course work']}]}
],v:6};
const LIB_VER=6;
const FAM={id:'fam',name:'Family & Friends',color:'#A0705A',groups:[
   {name:'Family',items:['Family dinner','Call home','Visit parents']},
   {name:'Friends',items:['Dinner out','Game night','Catch-up call']},
   {name:'Events',items:['Birthday party','Wedding','Holiday gathering']}]};
DEFAULT_LIB.cats.push(JSON.parse(JSON.stringify(FAM)));
const HOMEK={id:'homek',name:'Homekeeping',color:'#F6A961',groups:[
   {name:'Area',items:['Upstairs','Downstairs','Basement','Garage','Porch','Front Yard','Back Yard','Driveway/Pathways']},
   {name:'Floors',items:['Vacuum','Mop','Sweep','Spot-clean carpet & rugs']},
   {name:'Dust & wipe',items:['Dust surfaces','Dust ceiling fans','Dust blinds & baseboards','Wipe counters & tables','Clean mirrors & glass','Wipe handles & switches']},
   {name:'Tidy',items:['Declutter','Put things away','Laundry','Change sheets','Empty trash & recycling']},
   {name:'Kitchen & bath',items:['Clean sink','Clean toilet','Scrub shower / tub','Wipe appliances','Clean out fridge']},
   {name:'Outdoor',items:['Mow','Edge & trim','Rake leaves','Pull weeds','Sweep / blow pathways','Pressure wash','Water plants']},
   {name:'Deep clean',items:['Wash windows','Replace HVAC filter','Clean vents','Clean behind furniture','Organize storage']}]};
DEFAULT_LIB.cats.push(JSON.parse(JSON.stringify(HOMEK)));
const RESP={id:'resp',name:'Responsibilities',color:'#BB405C',groups:[
   {name:'Financials and bills',items:['Pay rent','Electric','Gas','Water & sewer','Internet','Phone','Renters insurance','Car insurance','Credit card payment','Car payment','Student loan']},
   {name:'Subscriptions',items:['Adobe Lightroom','Website hosting & domain','Claude','Pimsleur','italki tutoring','Streaming','Gym membership','Cloud storage','Review & cancel unused']},
   {name:'Money tasks',items:['Review budget','Track spending','Move money to savings','Retirement / brokerage contribution','Reconcile accounts','Check credit report']},
   {name:'Annual & occasional',items:['Taxes','Car registration & tag','Vehicle maintenance','Pet care / vet','Wedding vendor payment','FAA drone registration','Gifts & holidays']},
   {name:'Life admin',items:['Mail & paperwork','Doctor / dentist appointment','Lease renewal','Update passwords']}]};
DEFAULT_LIB.cats.push(JSON.parse(JSON.stringify(RESP)));
function upgrade(L){
  if(!L||!L.cats)return false;const v=L.v||1;if(v>=LIB_VER)return false;
  const D=DEFAULT_LIB,dp=D.cats.find(c=>c.id==='photo'),p=L.cats.find(c=>c.id==='photo');
  if(v<2){
  if(!p)L.cats.push(clone(dp));else{
    const ren={'bodies':'Bodies & drone','lighting':'Lighting gear'},drop=new Set(['100mm','Natural light','Real estate interiors','Landscape','Pet / portrait','Culling']);
    p.groups.forEach(g=>{const r=ren[g.name.toLowerCase()];if(r)g.name=r;g.items=g.items.filter(x=>!drop.has(x))});
    const out=[];
    for(const dg of dp.groups){const g=p.groups.find(x=>x.name.toLowerCase()===dg.name.toLowerCase());
      if(g){dg.items.forEach(i=>{if(!g.items.includes(i))g.items.push(i)});out.push(g)}else out.push(clone(dg))}
    p.groups.forEach(g=>{if(!out.includes(g)&&g.items.length)out.push(g)});p.groups=out;
  }
  const st=L.cats.find(c=>c.id==='study');
  if(st)st.groups=st.groups.filter(g=>!(g.name.toLowerCase()==='languages'&&g.items.every(i=>['Italian','Ukrainian'].includes(i))));
  }
  if(v<3){
    const add=['it','uk'].filter(id=>!L.cats.find(c=>c.id===id)).map(id=>clone(D.cats.find(c=>c.id===id)));
    const li=L.cats.findIndex(c=>c.id==='lang');
    if(li>=0)L.cats.splice(li,1,...add);else{const si=L.cats.findIndex(c=>c.id==='study');L.cats.splice(si>=0?si:L.cats.length,0,...add)}
  }
  if(v<4){
    const ex=L.cats.find(c=>c.id==='fam'||c.name.trim().toLowerCase()==='family & friends');
    if(!ex)L.cats.push(clone(FAM));else{
      for(const fg of FAM.groups){const g=ex.groups.find(x=>x.name.trim().toLowerCase()===fg.name.toLowerCase());
        if(g){fg.items.forEach(i=>{if(!g.items.includes(i))g.items.push(i)})}else ex.groups.push(clone(fg))}
    }
  }
  if(v<5){
    let h=L.cats.find(c=>c.id==='homek'||c.name.trim().toLowerCase()==='homekeeping');
    if(!h)L.cats.push(clone(HOMEK));else{
      const low=x=>x.trim().toLowerCase();
      // a group named "Upstairs" that holds the other areas becomes "Area"
      const up=h.groups.find(g=>low(g.name)==='upstairs'&&g.items.some(i=>low(i)==='downstairs'));
      if(up&&!h.groups.some(g=>low(g.name)==='area')){up.name='Area';if(!up.items.some(i=>low(i)==='upstairs'))up.items.unshift('Upstairs')}
      for(const hg of HOMEK.groups){const g=h.groups.find(x=>low(x.name)===low(hg.name));
        if(g){hg.items.forEach(i=>{if(!g.items.some(x=>low(x)===low(i)))g.items.push(i)})}else h.groups.push(clone(hg))}
      const ai=h.groups.findIndex(g=>low(g.name)==='area');if(ai>0)h.groups.unshift(h.groups.splice(ai,1)[0]);
    }
  }
  if(v<6){
    const low=x=>x.trim().toLowerCase();
    let r=L.cats.find(c=>c.id==='resp'||low(c.name)==='responsibilities');
    if(!r)L.cats.push(clone(RESP));else{
      for(const rg of RESP.groups){const g=r.groups.find(x=>low(x.name)===low(rg.name));
        if(g){rg.items.forEach(i=>{if(!g.items.some(x=>low(x)===low(i)))g.items.push(i)})}else r.groups.push(clone(rg))}
    }
  }
  L.v=LIB_VER;return true;
}
