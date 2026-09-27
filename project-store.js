/* Local project storage (v1): IndexedDB + media Blobs. No cloud upload. */
(()=>{
  const DB_NAME='cutflow-projects',DB_VERSION=1,STORE='projects';
  let currentId=null,currentName='',dirty=false,busy=false;
  const $=id=>document.getElementById(id);
  const bridge=()=>window.CutflowProjectBridge;
  const formatBytes=n=>{n=Number(n)||0;if(n<1024)return `${n} B`;const units=['KB','MB','GB','TB'];let i=-1;do{n/=1024;i++;}while(n>=1024&&i<units.length-1);return `${n.toFixed(n>=100?0:n>=10?1:2)} ${units[i]}`;};
  const formatDate=value=>new Intl.DateTimeFormat('ko-KR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
  function openDb(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,DB_VERSION);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE)){const store=db.createObjectStore(STORE,{keyPath:'id'});store.createIndex('updatedAt','updatedAt');}};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
  async function tx(mode,fn){const db=await openDb();try{return await new Promise((resolve,reject)=>{const t=db.transaction(STORE,mode),store=t.objectStore(STORE);let result;try{result=fn(store);}catch(e){reject(e);return;}t.oncomplete=()=>resolve(result);t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||new Error('저장 작업이 중단되었습니다.'));});}finally{db.close();}}
  async function all(){const db=await openDb();try{return await new Promise((resolve,reject)=>{const req=db.transaction(STORE,'readonly').objectStore(STORE).getAll();req.onsuccess=()=>resolve(req.result.sort((a,b)=>b.updatedAt-a.updatedAt));req.onerror=()=>reject(req.error);});}finally{db.close();}}
  async function get(id){const db=await openDb();try{return await new Promise((resolve,reject)=>{const req=db.transaction(STORE,'readonly').objectStore(STORE).get(id);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}finally{db.close();}}
  async function put(record){const db=await openDb();try{return await new Promise((resolve,reject)=>{const t=db.transaction(STORE,'readwrite');t.objectStore(STORE).put(record);t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||new Error('저장 작업이 중단되었습니다.'));});}finally{db.close();}}
  async function remove(id){return tx('readwrite',store=>store.delete(id));}
  function uid(){return crypto.randomUUID?.()||`project-${Date.now()}-${Math.random().toString(16).slice(2)}`;}
  function estimateSize(payload){const media=Number(payload.estimatedMediaBytes)||0;let json=0;try{const shallow={...payload,scenes:(payload.scenes||[]).map(s=>({...s,file:undefined})),narration:payload.narration?{...payload.narration,file:undefined}:null,bgm:payload.bgm?{...payload.bgm,file:undefined}:null};json=new Blob([JSON.stringify(shallow)]).size;}catch{}return media+json;}
  function setStatus(text,state=''){const el=$('projectSaveStatus');if(!el)return;el.textContent=text;el.dataset.state=state;}
  function markDirty(){if(busy)return;dirty=true;setStatus(currentId?`${currentName} · 저장 안 됨`:'저장 안 됨','dirty');}
  function markSaved(record){currentId=record.id;currentName=record.name;dirty=false;setStatus(`${record.name} · 저장됨`,'saved');}
  async function storageInfo(){try{const e=await navigator.storage?.estimate?.();return {usage:e?.usage||0,quota:e?.quota||0};}catch{return {usage:0,quota:0};}}
  async function refreshStorage(){const {usage,quota}=await storageInfo(),el=$('projectStorageInfo');if(!el)return;el.textContent=quota?`이 기기 저장공간: ${formatBytes(usage)} 사용 / 약 ${formatBytes(quota)} 허용`:`이 기기의 브라우저 저장공간을 사용합니다.`;}
  async function persist(){try{await navigator.storage?.persist?.();}catch{}}
  function defaultName(){return bridge()?.nameSuggestion?.()||`Cutflow ${new Date().toLocaleDateString('ko-KR')}`;}
  async function save({asNew=false}={}){
    if(busy||!bridge())return;
    let id=currentId,name=currentName,createdAt=Date.now();
    if(asNew||!id){name=prompt('프로젝트 이름을 입력해 주세요.',defaultName());if(name===null)return;name=name.trim()||defaultName();id=uid();}
    else {const old=await get(id);createdAt=old?.createdAt||createdAt;}
    busy=true;setStatus('프로젝트 저장 중…','busy');$('projectSaveBtn').disabled=true;
    try{const payload=bridge().capture(),summary=bridge().summary?.()||{};const now=Date.now();const record={id,name,createdAt,updatedAt:now,schemaVersion:1,appVersion:'22',sizeBytes:estimateSize(payload),sceneCount:summary.sceneCount||0,duration:summary.duration||0,payload};await put(record);await persist();markSaved(record);window.toast?.('프로젝트를 이 기기에 저장했습니다.');await renderList();}
    catch(error){console.error(error);setStatus(currentId?`${currentName} · 저장 실패`:'저장 실패','error');const quota=error?.name==='QuotaExceededError'||/quota|space/i.test(error?.message||'');alert(quota?'저장공간이 부족합니다. 저장된 프로젝트를 삭제해 공간을 확보한 뒤 다시 시도해 주세요.':'프로젝트를 저장하지 못했습니다. 브라우저 저장공간을 확인해 주세요.');}
    finally{busy=false;$('projectSaveBtn').disabled=false;}
  }
  async function load(id){if(busy||!bridge())return;if(dirty&&!confirm('현재 작업에 저장하지 않은 변경사항이 있습니다. 다른 프로젝트를 불러올까요?'))return;const record=await get(id);if(!record){alert('저장된 프로젝트를 찾지 못했습니다.');return;}busy=true;setStatus('프로젝트 불러오는 중…','busy');closeDialog();try{await bridge().restore(record.payload);markSaved(record);window.toast?.('저장된 프로젝트를 불러왔습니다.');}catch(error){console.error(error);setStatus('불러오기 실패','error');alert(error?.message||'프로젝트를 불러오지 못했습니다.');}finally{busy=false;}}
  async function rename(id){const record=await get(id);if(!record)return;const name=prompt('새 프로젝트 이름을 입력해 주세요.',record.name);if(name===null||!name.trim())return;record.name=name.trim();record.updatedAt=Date.now();await put(record);if(id===currentId){currentName=record.name;setStatus(`${currentName} · ${dirty?'저장 안 됨':'저장됨'}`,dirty?'dirty':'saved');}await renderList();}
  async function del(id){const record=await get(id);if(!record||!confirm(`“${record.name}” 프로젝트를 삭제할까요?\n삭제한 프로젝트는 복구할 수 없습니다.`))return;await remove(id);if(id===currentId){currentId=null;currentName='';dirty=true;setStatus('현재 작업 · 저장 안 됨','dirty');}await renderList();}
  async function renderList(){const host=$('projectList');if(!host)return;const records=await all();host.innerHTML=records.length?records.map(r=>`<article class="saved-project ${r.id===currentId?'current':''}" data-id="${r.id}"><div class="saved-project-main"><strong>${escapeHtml(r.name)}</strong><span>${formatDate(r.updatedAt)} · ${r.sceneCount||0}장면 · ${(Number(r.duration)||0).toFixed(1)}초</span><small>${formatBytes(r.sizeBytes||0)}${r.id===currentId?' · 현재 프로젝트':''}</small></div><div class="saved-project-actions"><button type="button" data-action="load">열기</button><button type="button" data-action="rename">이름 변경</button><button type="button" data-action="delete" class="danger">삭제</button></div></article>`).join(''):'<p class="empty-projects">이 기기에 저장된 프로젝트가 없습니다.</p>';await refreshStorage();}
  function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function openDialog(){renderList();$('projectDialog')?.showModal();}
  function closeDialog(){$('projectDialog')?.close();}
  $('projectSaveBtn')?.addEventListener('click',()=>save({asNew:!currentId}));
  $('projectOpenBtn')?.addEventListener('click',openDialog);
  $('projectSaveAsBtn')?.addEventListener('click',()=>save({asNew:true}));
  $('projectDialogClose')?.addEventListener('click',closeDialog);
  $('projectList')?.addEventListener('click',e=>{const article=e.target.closest('[data-id]'),action=e.target.dataset.action;if(!article||!action)return;if(action==='load')load(article.dataset.id);if(action==='rename')rename(article.dataset.id);if(action==='delete')del(article.dataset.id);});
  document.addEventListener('input',e=>{const t=e.target;if(!t.matches?.('input:not([type=file]),textarea,select'))return;if(['scrubber','projectNameInput'].includes(t.id))return;markDirty();},true);
  window.CutflowProjects={markDirty,save,open:openDialog,get currentId(){return currentId;},get dirty(){return dirty;}};
  setStatus('저장 안 됨','dirty');refreshStorage();
})();
