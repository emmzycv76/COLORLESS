/* Persist COLORLESS editor state into IndexedDB. No server required. */
(function(){
  const WAIT = 350;
  let lastSaved = '';
  let timer = null;

  function projectId(){
    try{return localStorage.getItem('colorlessProjectId') || ''}catch(e){return ''}
  }

  function currentState(){
    const image=document.getElementById('editorImage');
    if(!image || !image.src) return null;
    let gridState=null;
    try{ if(typeof grid!=='undefined') gridState={...grid}; }catch(e){}
    let palette=[];
    let savedColors=[];
    try{ palette=JSON.parse(localStorage.getItem('colorlessPalette')||'[]'); }catch(e){}
    try{ savedColors=JSON.parse(localStorage.getItem('colorlessSavedColors')||'[]'); }catch(e){}
    return {
      src:image.src,
      filter:image.style.filter||'',
      grid:gridState,
      palette,
      savedColors,
      updatedAt:Date.now()
    };
  }

  function signature(state){
    if(!state)return '';
    return JSON.stringify({src:state.src,filter:state.filter,grid:state.grid,palette:state.palette,savedColors:state.savedColors});
  }

  async function save(force){
    const id=projectId();
    if(!id || !window.COLORLESSStorage)return;
    const state=currentState();
    if(!state)return;
    const sig=signature(state);
    if(!force && sig===lastSaved)return;
    try{
      const existing=await COLORLESSStorage.getProject(id);
      if(!existing)return;
      await COLORLESSStorage.saveProject({...existing,...state,id,updatedAt:Date.now()});
      lastSaved=sig;
      try{localStorage.setItem('colorlessImage',state.src)}catch(e){}
    }catch(e){}
  }

  function scheduleSave(){
    clearTimeout(timer);
    timer=setTimeout(()=>save(false),WAIT);
  }

  async function restore(){
    const id=projectId();
    if(!id || !window.COLORLESSStorage)return;
    try{
      const p=await COLORLESSStorage.getProject(id);
      if(!p)return;
      const image=document.getElementById('editorImage');
      if(!image)return;
      if(p.src && p.src!==image.src){
        image.src=p.src;
        try{localStorage.setItem('colorlessImage',p.src)}catch(e){}
      }
      if(typeof grid!=='undefined' && p.grid){
        grid={...grid,...p.grid};
        if(typeof syncGrid==='function')syncGrid();
        if(typeof drawGrid==='function')drawGrid();
      }
      if(p.filter!==undefined)image.style.filter=p.filter||'';
      if(Array.isArray(p.palette))try{localStorage.setItem('colorlessPalette',JSON.stringify(p.palette))}catch(e){}
      if(Array.isArray(p.savedColors))try{localStorage.setItem('colorlessSavedColors',JSON.stringify(p.savedColors))}catch(e){}
      if(typeof renderSaved==='function')renderSaved();
      lastSaved=signature(currentState());
    }catch(e){}
  }

  function observe(){
    const image=document.getElementById('editorImage');
    if(!image)return;
    const observer=new MutationObserver(scheduleSave);
    observer.observe(image,{attributes:true,attributeFilter:['src','style']});
    ['cols','rows','gridOpacity','gridColor','numberGrid','thirdsGrid','goldenGrid','hideGrid','normalView','grayView','valueView','applySimplify','applyCrop','saveColorBtn','savePaletteBtn'].forEach(id=>{
      const el=document.getElementById(id); if(el)el.addEventListener('click',scheduleSave);
    });
    ['cols','rows','gridOpacity','gridColor','levels'].forEach(id=>{
      const el=document.getElementById(id); if(el)el.addEventListener('input',scheduleSave);
    });
    image.addEventListener('load',scheduleSave);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')save(true)});
    window.addEventListener('pagehide',()=>save(true));
    setInterval(()=>save(false),2500);
  }

  async function init(){
    if(!document.getElementById('editorImage'))return;
    if(!window.COLORLESSStorage){
      const s=document.createElement('script');s.src='js/storage.js';document.head.appendChild(s);
      await new Promise(resolve=>{const start=Date.now();const check=()=>{if(window.COLORLESSStorage||Date.now()-start>3000)resolve();else setTimeout(check,25)};check()});
    }
    await restore();
    observe();
    setTimeout(()=>save(true),500);
  }

  if(document.readyState==='complete')setTimeout(init,0);else window.addEventListener('load',()=>setTimeout(init,0));
})();