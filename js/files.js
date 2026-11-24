/* ---------- files: replaces claude.ai downloads ----------
   On iPhone and iPad the share sheet is the reliable way to save a file
   (Save to Files, iCloud Drive, Calendar). Everywhere else, a normal download.
   Must be called straight from a tap: share needs the user gesture.
   Resolves 'shared' | 'downloaded', rejects with name 'AbortError' if cancelled. */
const isIOS=/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
async function saveFile(filename,data,type){
  const blob=data instanceof Blob?data:new Blob([data],{type});
  if(isIOS&&navigator.canShare){
    let file=null;try{file=new File([blob],filename,{type})}catch(e){}
    if(file&&navigator.canShare({files:[file]})){await navigator.share({files:[file]});return 'shared'}
  }
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=filename;a.rel='noopener';a.style.display='none';
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
  return 'downloaded';
}
