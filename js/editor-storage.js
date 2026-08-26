/* COLORLESS editor project-state persistence — IndexedDB, no server required. */
(function(){
  function whenReady(fn){
    let tries=0;
    const check=()=>{
      tries++;
      try{
        if(window.COLORLESSStorage && document.getElementById('editorImage') && typeof grid!=='undefined') return fn();
      }catch(e){}
      if(tries<100)setTimeout(check,100);
    };
    check();
  }

  whenReady(async function(){
    const image=document.getElementById('editorImage');
    let projectId='';
    let restoring=false;
    let saveTimer=null;

    try{ projectId=localStorage.getItem('colorlessProjectId')||''; }catch(e){}

    async function getProject(){
      if(!projectId)return null;
      return await COLORLESSStorage.getProject(projectId);
    }

    function state(){
      let palette=[];
      let savedColors=[];
      try{palette=JSON.parse(localStorage.getItem('colorlessPalette')||'[]')}catch(e){}
      try{savedColors=JSON.parse(localStorage.getItem('colorlessSavedColors')||'[]')}catch(e){}
      return {src:image.src,filter:image.style.filter||'',grid:{...grid},palette,savedColors,updatedAt:Date.now()};
    }

    async function saveNow(){
      if(restoring || !projectId || !window.COLORLESSStorage || !image.src)return false;
      try{
        const existing=await getProject();
        if(!existing)return false;
        const s=state();
        await COLORLESSStorage.saveProject({...existing,...s,id:projectId,updatedAt:Date.now()});
        try{localStorage.setItem('colorlessImage',s.src)}catch(e){}
        return true;
      }catch(e){console.warn('COLORLESS save failed',e);return false}
    }

    function scheduleSave(delay=150){
      if(restoring)return;
      clearTimeout(saveTimer);
      saveTimer=setTimeout(()=>saveNow(),delay);
    }

    async function restore(){
      if(!projectId)return;
      const p=await getProject();
      if(!p)return;
      restoring=true;
      try{
        if(p.src && p.src!==image.src){
          await new Promise(resolve=>{
            const done=()=>resolve();
            image.addEventListener('load',done,{once:true});
            image.src=p.src;
            if(image.complete)resolve();
          });
        }
        if(p.filter!==undefined)image.style.filter=p.filter||'';
        if(p.grid){
          grid={...grid,...p.grid};
          if(typeof syncGrid==='function')syncGrid();
          if(typeof drawGrid==='function')drawGrid();
        }
        if(Array.isArray(p.palette))try{localStorage.setItem('colorlessPalette',JSON.stringify(p.palette))}catch(e){}
        if(Array.isArray(p.savedColors)){
          try{localStorage.setItem('colorlessSavedColors',JSON.stringify(p.savedColors))}catch(e){}
          if(typeof renderSaved==='function')renderSaved();
        }
        try{localStorage.setItem('colorlessImage',image.src)}catch(e){}
      }finally{restoring=false;}
    }

    if(document.readyState==='complete')setTimeout(restore,50);else window.addEventListener('load',()=>setTimeout(restore,50),{once:true});

    ['cols','rows','gridOpacity','gridColor'].forEach(id=>{
      const el=document.getElementById(id);
      if(el){el.addEventListener('input',()=>scheduleSave());el.addEventListener('change',()=>scheduleSave())}
    });
    ['numberGrid','thirdsGrid','goldenGrid','hideGrid'].forEach(id=>{
      const el=document.getElementById(id);if(el)el.addEventListener('click',()=>saveNow());
    });
    ['normalView','grayView','valueView','applySimplify','applyCrop','saveColorBtn','savePaletteBtn'].forEach(id=>{
      const el=document.getElementById(id);if(el)el.addEventListener('click',()=>scheduleSave(250));
    });
    image.addEventListener('load',()=>scheduleSave(250));

    // Back must wait for IndexedDB to finish writing. A normal navigation can unload the
    // page before an asynchronous IndexedDB transaction has completed.
    document.addEventListener('click',async e=>{
      const target=e.target.closest && e.target.closest('button,a');
      if(!target)return;
      const label=(target.textContent||'').trim().toLowerCase();
      const isBack=target.id==='backBtn'||target.hasAttribute('data-back')||label==='← back'||label==='back';
      if(!isBack)return;
      e.preventDefault();
      e.stopImmediatePropagation();
      clearTimeout(saveTimer);
      target.disabled=true;
      await saveNow();
      location.assign('index.html');
    },true);

    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')saveNow()});
    window.addEventListener('pagehide',()=>{saveNow()});
    window.COLORLESSProjectSave=saveNow;
  });
})();