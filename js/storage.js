/* COLORLESS local project storage — no server required. */
(function(){
  const DB_NAME = 'COLORLESS_DB';
  const DB_VERSION = 1;
  const STORE = 'projects';
  const MAX_PROJECTS = 12;

  function openDB(){
    return new Promise((resolve,reject)=>{
      if(!('indexedDB' in window)){ reject(new Error('IndexedDB unavailable')); return; }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if(!db.objectStoreNames.contains(STORE)){
          const store = db.createObjectStore(STORE,{keyPath:'id'});
          store.createIndex('updatedAt','updatedAt',{unique:false});
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('Could not open project storage'));
    });
  }

  function request(mode, action){
    return openDB().then(db=>new Promise((resolve,reject)=>{
      const tx = db.transaction(STORE,mode);
      const store = tx.objectStore(STORE);
      let req;
      try{ req = action(store); }catch(e){ reject(e); db.close(); return; }
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('Storage request failed'));
      tx.oncomplete = () => db.close();
      tx.onerror = () => reject(tx.error || new Error('Storage transaction failed'));
    }));
  }

  function makeId(){ return 'project-' + Date.now() + '-' + Math.random().toString(36).slice(2,9); }

  async function allProjects(){
    const list = await request('readonly',store=>store.index('updatedAt').getAll());
    return (list || []).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
  }

  async function saveProject(project){
    const p = {...project};
    if(!p.id) p.id = makeId();
    p.updatedAt = p.updatedAt || Date.now();
    p.createdAt = p.createdAt || p.updatedAt;
    await request('readwrite',store=>store.put(p));
    const projects = await allProjects();
    if(projects.length > MAX_PROJECTS){
      const old = projects.slice(MAX_PROJECTS);
      await Promise.all(old.map(x=>request('readwrite',store=>store.delete(x.id))));
    }
    return p;
  }

  async function getProject(id){ return request('readonly',store=>store.get(id)); }
  async function deleteProject(id){ return request('readwrite',store=>store.delete(id)); }
  async function clearProjects(){ return request('readwrite',store=>store.clear()); }

  async function migrateLegacy(){
    const projects = await allProjects();
    if(projects.length) return projects;
    let legacyImage = null, legacyRecent = [];
    try{
      legacyImage = localStorage.getItem('colorlessImage');
      legacyRecent = JSON.parse(localStorage.getItem('colorlessRecentProjects')||'[]');
      if(!Array.isArray(legacyRecent)) legacyRecent=[];
    }catch(e){}

    const candidates = [];
    legacyRecent.forEach(item=>{
      if(item && item.src) candidates.push({src:item.src,updatedAt:item.time||Date.now()});
    });
    if(legacyImage && !candidates.some(x=>x.src===legacyImage)) candidates.unshift({src:legacyImage,updatedAt:Date.now()});

    for(const item of candidates.slice(0,MAX_PROJECTS)){
      await saveProject({
        src:item.src,
        title:'Reference',
        palette:[],
        grid:null,
        notes:'',
        updatedAt:item.updatedAt,
        createdAt:item.updatedAt
      });
    }
    return allProjects();
  }

  window.COLORLESSStorage = {openDB,allProjects,saveProject,getProject,deleteProject,clearProjects,migrateLegacy,MAX_PROJECTS};
})();