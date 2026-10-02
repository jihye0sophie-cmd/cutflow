/* Cutflow project storage v3: Safari-safe IndexedDB metadata + separate media blobs. */
(()=>{
const DB='cutflow-projects',VER=3,P='projects',M='media';let currentId=null,currentName='',dirty=false,busy=false;const $=id=>document.getElementById(id),bridge=()=>window.CutflowProjectBridge;
const bytes=n=>{n=Number(n)||0;if(n<1024)return`${n} B`;const u=['KB','MB','GB','TB'];let i=-1;do{n/=1024;i++}while(n>=1024&&i<u.length-1);return`${n.toFixed(n>=100?0:n>=10?1:2)} ${u[i]}`},date=v=>new Intl.DateTimeFormat('ko-KR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v));
function db(){return new Promise((res,rej)=>{if(!window.indexedDB)return rej(new Error('IndexedDBUnavailable'));const r=indexedDB.open(DB,VER);r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains(P)){const s=d.createObjectStore(P,{keyPath:'id'});s.createIndex('updatedAt','updatedAt')}if(!d.objectStoreNames.contains(M)){const s=d.createObjectStore(M,{keyPath:'key'});s.createIndex('projectId','projectId')}};r.onsuccess=()=>{r.result.onversionchange=()=>r.result.close();res(r.result)};r.onerror=()=>rej(r.error||new Error('IndexedDBOpenFailed'));r.onblocked=()=>rej(new Error('IndexedDBBlocked'))})}
async function get(id){const d=await db();try{return await new Promise((res,rej)=>{const r=d.transaction(P).objectStore(P).get(id);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}finally{d.close()}}
async function all(){const d=await db();try{return await new Promise((res,rej)=>{const r=d.transaction(P).objectStore(P).getAll();r.onsuccess=()=>res((r.result||[]).sort((a,b)=>b.updatedAt-a.updatedAt));r.onerror=()=>rej(r.error)})}finally{d.close()}}
async function media(id){const d=await db();try{return await new Promise((res,rej)=>{const r=d.transaction(M).objectStore(M).index('projectId').getAll(IDBKeyRange.only(id));r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error)})}finally{d.close()}}
async function saveBundle(record,rows){const d=await db();try{return await new Promise((res,rej)=>{const t=d.transaction([P,M],'readwrite'),ps=t.objectStore(P),ms=t.objectStore(M),q=ms.index('projectId').getAllKeys(IDBKeyRange.only(record.id));q.onsuccess=()=>{for(const k of q.result||[])ms.delete(k);for(const row of rows)ms.put(row);ps.put(record)};q.onerror=()=>{try{t.abort()}catch{}rej(q.error)};t.oncomplete=()=>res();t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error||new Error('TransactionAborted'))})}finally{d.close()}}
async function saveMeta(record){const d=await db();try{return await new Promise((res,rej)=>{const t=d.transaction(P,'readwrite');t.objectStore(P).put(record);t.oncomplete=()=>res();t.onerror=()=>rej(t.error)})}finally{d.close()}}
async function remove(id){const d=await db();try{return await new Promise((res,rej)=>{const t=d.transaction([P,M],'readwrite'),ms=t.objectStore(M);t.objectStore(P).delete(id);const q=ms.index('projectId').getAllKeys(IDBKeyRange.only(id));q.onsuccess=()=>{for(const k of q.result||[])ms.delete(k)};t.oncomplete=()=>res();t.onerror=()=>rej(t.error)})}finally{d.close()}}
const uid=()=>crypto.randomUUID?.()||`project-${Date.now()}-${Math.random().toString(16).slice(2)}`;function status(text,state=''){const e=$('projectSaveStatus'),changed=!e||e.textContent!==text||e.dataset.state!==state;if(e){if(e.textContent!==text)e.textContent=text;if(e.dataset.state!==state)e.dataset.state=state}if(changed&&typeof CustomEvent==='function')window.dispatchEvent(new CustomEvent('cutflow-project-status',{detail:{text,state}}))}function markDirty(){if(!busy){dirty=true;status(currentId?`${currentName} · 저장 안 됨`:'저장 안 됨','dirty')}}function markSaved(r){currentId=r.id;currentName=r.name;dirty=false;status(`${r.name} · 저장됨`,'saved')}
async function usage(){try{const e=await navigator.storage?.estimate?.();return{usage:e?.usage||0,quota:e?.quota||0}}catch{return{usage:0,quota:0}}}async function refresh(){const e=$('projectStorageInfo');if(!e)return;const s=await usage();e.textContent=s.quota?`이 기기 저장공간: ${bytes(s.usage)} 사용 / 약 ${bytes(s.quota)} 허용`:'이 기기의 브라우저 저장공간을 사용합니다.'}async function persist(){try{await navigator.storage?.persist?.()}catch{}}
function detach(raw,id){const out={...raw,scenes:(raw.scenes||[]).map(s=>({...s})),narration:raw.narration?{...raw.narration}:null,bgm:raw.bgm?{...raw.bgm}:null},rows=[],shared=new Map();const add=(key,kind,file,name)=>{if(!(file instanceof Blob))return null;if(shared.has(file))return shared.get(file);rows.push({key,projectId:id,kind,name:name||file.name||'media',type:file.type||'',lastModified:Number(file.lastModified)||0,size:file.size||0,blob:file});shared.set(file,key);return key};out.scenes=out.scenes.map((s,i)=>{const ref=add(`${id}:scene:${i}`,'scene',s.file,s.meta?.name);return{...s,file:undefined,fileRef:ref}});if(out.narration?.file){const ref=add(`${id}:narration`,'narration',out.narration.file,out.narration.name);out.narration={...out.narration,file:undefined,fileRef:ref}}if(out.bgm?.file){const ref=add(`${id}:bgm`,'bgm',out.bgm.file,out.bgm.name);out.bgm={...out.bgm,file:undefined,fileRef:ref}}return{payload:out,rows}}
const clonePlain=value=>JSON.parse(JSON.stringify(value??{}));
const PACKAGE_MAGIC='CUTFLOW1',PACKAGE_HEADER_BYTES=12,PACKAGE_SCHEMA=1;
const safeFileName=name=>String(name||'Cutflow').replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_').replace(/\s+/g,' ').trim().slice(0,100)||'Cutflow';
function packageManifest(record,rows){
  return {
    format:'cutflow-project',
    schemaVersion:PACKAGE_SCHEMA,
    exportedAt:Date.now(),
    project:{name:record.name,createdAt:record.createdAt,updatedAt:record.updatedAt,schemaVersion:record.schemaVersion,appVersion:record.appVersion,sizeBytes:record.sizeBytes,sceneCount:record.sceneCount,duration:record.duration,payload:record.payload},
    media:rows.map(r=>({key:r.key,kind:r.kind,name:r.name,type:r.type,lastModified:r.lastModified,size:r.blob?.size||r.size||0}))
  };
}
function encodePackage(record,rows){
  const manifest=packageManifest(record,rows),json=new TextEncoder().encode(JSON.stringify(manifest));
  const header=new Uint8Array(PACKAGE_HEADER_BYTES);header.set(new TextEncoder().encode(PACKAGE_MAGIC),0);new DataView(header.buffer).setUint32(8,json.byteLength,true);
  return new Blob([header,json,...rows.map(r=>r.blob)],{type:'application/x-cutflow-project'});
}
async function decodePackage(file){
  if(!(file instanceof Blob)||file.size<PACKAGE_HEADER_BYTES)throw new Error('올바른 Cutflow 프로젝트 파일이 아닙니다.');
  const head=new Uint8Array(await file.slice(0,PACKAGE_HEADER_BYTES).arrayBuffer()),magic=new TextDecoder().decode(head.slice(0,8));
  if(magic!==PACKAGE_MAGIC)throw new Error('Cutflow 프로젝트 파일 형식을 확인해 주세요.');
  const manifestBytes=new DataView(head.buffer,head.byteOffset,head.byteLength).getUint32(8,true);
  if(!manifestBytes||manifestBytes>16*1024*1024||PACKAGE_HEADER_BYTES+manifestBytes>file.size)throw new Error('프로젝트 파일의 정보 영역이 손상되었습니다.');
  let manifest;try{manifest=JSON.parse(await file.slice(PACKAGE_HEADER_BYTES,PACKAGE_HEADER_BYTES+manifestBytes).text())}catch{throw new Error('프로젝트 정보를 읽지 못했습니다.')}
  if(manifest?.format!=='cutflow-project'||manifest?.schemaVersion!==PACKAGE_SCHEMA||!manifest?.project?.payload||!Array.isArray(manifest?.media))throw new Error('지원하지 않는 Cutflow 프로젝트 파일입니다.');
  let offset=PACKAGE_HEADER_BYTES+manifestBytes;const sourceRows=[];
  for(let i=0;i<manifest.media.length;i++){
    const meta=manifest.media[i],size=Number(meta?.size)||0;if(size<0||offset+size>file.size)throw new Error('프로젝트 미디어 데이터가 손상되었습니다.');
    sourceRows.push({...meta,blob:file.slice(offset,offset+size,meta.type||'application/octet-stream')});offset+=size;
  }
  if(offset!==file.size)throw new Error('프로젝트 파일 끝에 알 수 없는 데이터가 있습니다.');
  return {manifest,sourceRows};
}
function importedBundle(decoded){
  const id=uid(),now=Date.now(),project=clonePlain(decoded.manifest.project),refMap=new Map();
  const rows=decoded.sourceRows.map((row,i)=>{const key=`${id}:import:${i}`;refMap.set(row.key,key);return{key,projectId:id,kind:row.kind||'media',name:row.name||'media',type:row.type||row.blob.type||'',lastModified:Number(row.lastModified)||now,size:row.blob.size,blob:row.blob}});
  const payload=project.payload||{};
  for(const scene of payload.scenes||[])if(scene.fileRef&&refMap.has(scene.fileRef))scene.fileRef=refMap.get(scene.fileRef);
  if(payload.narration?.fileRef&&refMap.has(payload.narration.fileRef))payload.narration.fileRef=refMap.get(payload.narration.fileRef);
  if(payload.bgm?.fileRef&&refMap.has(payload.bgm.fileRef))payload.bgm.fileRef=refMap.get(payload.bgm.fileRef);
  const record={id,name:String(project.name||'가져온 프로젝트'),createdAt:now,updatedAt:now,schemaVersion:Number(project.schemaVersion)||2,appVersion:String(project.appVersion||'42'),sizeBytes:rows.reduce((n,r)=>n+r.size,0),sceneCount:Number(project.sceneCount)||0,duration:Number(project.duration)||0,payload};
  return {record,rows};
}
async function exportProject(){
  if(busy||!bridge())return;
  busy=true;status('프로젝트 내보내는 중…','busy');
  try{
    let name=currentName||defaultName(),createdAt=Date.now(),raw,record,rows;
    if(currentId&&!dirty){
      const saved=await get(currentId);
      if(saved){record=saved;rows=await media(currentId);name=saved.name;}
    }
    if(!record){
      raw=bridge().capture();const sum=bridge().summary?.()||{},id=uid(),d=detach(raw,id);
      record={id,name,createdAt,updatedAt:Date.now(),schemaVersion:2,appVersion:'42',sizeBytes:Number(raw.estimatedMediaBytes)||0,sceneCount:sum.sceneCount||0,duration:sum.duration||0,payload:d.payload};rows=d.rows;
    }
    const blob=encodePackage(record,rows),filename=`${safeFileName(name)}.cutflow`;
    if(navigator.share&&navigator.canShare){
      try{
        const file=new File([blob],filename,{type:blob.type,lastModified:Date.now()});
        if(navigator.canShare({files:[file]})){await navigator.share({files:[file],title:name});window.toast?.('프로젝트 파일을 내보냈습니다.');return;}
      }catch(error){if(error?.name==='AbortError')return;console.warn('Cutflow share export fallback',error);}
    }
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
    window.toast?.('프로젝트 파일을 저장했습니다.');
  }catch(error){console.error('Cutflow project export failed',error);alert(`프로젝트를 내보내지 못했습니다. ${error?.message||''}`);}
  finally{busy=false;status(currentId?`${currentName} · ${dirty?'저장 안 됨':'저장됨'}`:'저장 안 됨',dirty?'dirty':currentId?'saved':'dirty');}
}
async function importProject(file){
  if(busy||!bridge()||!file)return;
  busy=true;status('프로젝트 파일 확인 중…','busy');
  const previous=bridge().capture?.()||null,previousStore={currentId,currentName,dirty};let importedId=null,completed=false;
  try{
    const decoded=await decodePackage(file),p=decoded.manifest.project;
    const size=decoded.sourceRows.reduce((n,r)=>n+(r.blob?.size||0),0),name=String(p.name||file.name.replace(/\.cutflow$/i,'')||'가져온 프로젝트');
    if(!confirm(`“${name}” 프로젝트를 가져올까요?\n장면 ${Number(p.sceneCount)||0}개 · ${(Number(p.duration)||0).toFixed(1)}초 · 미디어 ${bytes(size)}\n\n가져온 프로젝트는 이 기기에도 저장됩니다.`)){completed=true;return;}
    status('프로젝트 가져오는 중…','busy');await persist();const bundle=importedBundle(decoded);
    bundle.record.name=name;importedId=bundle.record.id;await saveBundle(bundle.record,bundle.rows);
    await bridge().restore(await hydrate(bundle.record));window.CutflowHistory?.reset?.();markSaved(bundle.record);await renderList();
    if(typeof CustomEvent==='function')window.dispatchEvent(new CustomEvent('cutflow-project-imported',{detail:{id:bundle.record.id,name:bundle.record.name,sceneCount:bundle.record.sceneCount,duration:bundle.record.duration}}));
    closeDialog();completed=true;window.toast?.('프로젝트를 가져와 이 기기에 저장했습니다.');
  }catch(error){
    console.error('Cutflow project import failed',error);let rollbackError=null;
    if(importedId){try{await remove(importedId);}catch(e){console.error('Cutflow imported project cleanup failed',e)}}
    if(previous){try{await bridge().restore(previous,{history:true});}catch(e){rollbackError=e;console.error('Cutflow import rollback failed',e)}}
    currentId=previousStore.currentId;currentName=previousStore.currentName;dirty=previousStore.dirty;
    status(currentId?`${currentName} · ${dirty?'저장 안 됨':'저장됨'}`:'저장 안 됨',dirty?'dirty':currentId?'saved':'dirty');
    alert(rollbackError?'프로젝트 가져오기에 실패했고 이전 작업 복원에도 실패했습니다.':`프로젝트를 가져오지 못했습니다. ${error?.message||''}`);
  }finally{busy=false;const input=$('projectImportInput');if(input)input.value='';if(completed&&currentId)status(`${currentName} · ${dirty?'저장 안 됨':'저장됨'}`,dirty?'dirty':'saved');else if(completed)status('저장 안 됨','dirty');}
}

async function hydrate(record){const p=clonePlain(record.payload||{}),refs=[],sharedFiles=new Map();(p.scenes||[]).forEach(s=>s.fileRef&&refs.push(s.fileRef));if(p.narration?.fileRef)refs.push(p.narration.fileRef);if(p.bgm?.fileRef)refs.push(p.bgm.fileRef);if(!refs.length)return p;const map=new Map((await media(record.id)).map(r=>[r.key,r])),file=(ref,name)=>{if(sharedFiles.has(ref))return sharedFiles.get(ref);const r=map.get(ref);if(!r?.blob){const e=new Error(`저장 미디어를 찾지 못했습니다: ${name||ref}`);e.name='MissingProjectMedia';throw e}let value;try{value=new File([r.blob],r.name||name||'media',{type:r.type||r.blob.type||'',lastModified:r.lastModified||Date.now()})}catch{value=r.blob}sharedFiles.set(ref,value);return value};(p.scenes||[]).forEach(s=>{if(s.fileRef){s.file=file(s.fileRef,s.meta?.name);delete s.fileRef}});if(p.narration?.fileRef){p.narration.file=file(p.narration.fileRef,p.narration.name);delete p.narration.fileRef}if(p.bgm?.fileRef){p.bgm.file=file(p.bgm.fileRef,p.bgm.name);delete p.bgm.fileRef}return p}
function defaultName(){return bridge()?.nameSuggestion?.()||`Cutflow ${new Date().toLocaleDateString('ko-KR')}`}
async function save({asNew=false}={}){
  if(busy||!bridge())return;
  let id=currentId,name=currentName,createdAt=Date.now(),existing=null,stage='start';
  if(asNew||!id){
    name=prompt('프로젝트 이름을 입력해 주세요.',defaultName());if(name===null)return;
    name=name.trim()||defaultName();id=uid();
  }
  busy=true;status('프로젝트 저장 중…','busy');$('projectSaveBtn').disabled=true;
  try{
    if(!asNew&&currentId===id){stage='existing-meta';existing=await get(id);createdAt=existing?.createdAt||createdAt;}
    stage='persist';await persist();
    stage='capture';const raw=bridge().capture();
    stage='summary';const sum=typeof bridge().summary==='function'?bridge().summary():{};
    stage='estimate';const estimate=await usage(),size=Number(raw.estimatedMediaBytes)||0,replaceBytes=Number(existing?.sizeBytes)||0;
    const available=estimate.quota?Math.max(0,estimate.quota-estimate.usage+replaceBytes):0;
    if(estimate.quota&&size>available){const e=new Error('QuotaExceededError');e.name='QuotaExceededError';throw e}
    stage='detach';const d=detach(raw,id),record={id,name,createdAt,updatedAt:Date.now(),schemaVersion:2,appVersion:'42',sizeBytes:size,sceneCount:sum.sceneCount||0,duration:sum.duration||0,payload:d.payload};
    stage='indexeddb-write';await saveBundle(record,d.rows);
    stage='complete';markSaved(record);
    if(typeof CustomEvent==='function')window.dispatchEvent(new CustomEvent('cutflow-project-saved',{detail:{id:record.id,name:record.name,sceneCount:record.sceneCount,duration:record.duration}}));
    window.toast?.('프로젝트를 이 기기에 저장했습니다.');await renderList();
  }catch(e){
    console.error('Cutflow save failed',{stage,error:e,name:e?.name,message:e?.message,stack:e?.stack});
    status(currentId?`${currentName} · 저장 실패`:'저장 실패','error');
    const m=String(e?.message||''),q=e?.name==='QuotaExceededError'||/quota|space/i.test(m),b=/blocked/i.test(m),u=/unavailable|security|invalidstate/i.test(`${e?.name||''} ${m}`);
    alert(q?'저장공간이 부족합니다. 저장된 프로젝트를 삭제하거나 기기 저장공간을 확보한 뒤 다시 시도해 주세요.':b?'브라우저 저장소가 다른 탭에서 사용 중입니다. Cutflow 탭을 모두 닫았다가 다시 열어 주세요.':u?'이 브라우저에서는 프로젝트 저장소를 사용할 수 없습니다. 일반 Safari/Chrome 또는 홈 화면의 Cutflow에서 다시 시도해 주세요.':`프로젝트를 저장하지 못했습니다. (${e?.name||'저장 오류'} / ${stage}) 페이지를 새로고침한 뒤 다시 시도해 주세요.`);
  }finally{busy=false;$('projectSaveBtn').disabled=false}
}
async function load(id){
  if(busy||!bridge())return;
  if(dirty&&!confirm('현재 작업에 저장하지 않은 변경사항이 있습니다. 다른 프로젝트를 불러올까요?'))return;
  const previous=bridge().capture?.()||null;
  const previousStore={currentId,currentName,dirty};
  busy=true;status('프로젝트 불러오는 중…','busy');closeDialog();let r=null;
  try{
    r=await get(id);if(!r)throw new Error('저장된 프로젝트를 찾지 못했습니다.');
    await bridge().restore(await hydrate(r));
    window.CutflowHistory?.reset?.();markSaved(r);
    if(typeof CustomEvent==='function')window.dispatchEvent(new CustomEvent('cutflow-project-loaded',{detail:{id:r.id,name:r.name,sceneCount:r.sceneCount||0,duration:r.duration||0}}));
    window.toast?.('저장된 프로젝트를 불러왔습니다.');
  }catch(e){
    console.error(e);let rollbackError=null;
    if(previous){
      try{await bridge().restore(previous,{history:true});}
      catch(error){rollbackError=error;console.error('Cutflow project load rollback failed',error);}
    }
    if(previous&&!rollbackError){
      currentId=previousStore.currentId;currentName=previousStore.currentName;dirty=previousStore.dirty;
      status(currentId?`${currentName} · ${dirty?'저장 안 됨':'저장됨'}`:'저장 안 됨',dirty?'dirty':currentId?'saved':'dirty');
    }else status('불러오기 실패','error');
    alert(rollbackError?'프로젝트를 불러오지 못했고 이전 작업 복원에도 실패했습니다.':previous?'프로젝트를 불러오지 못해 이전 작업을 복원했습니다.':(e?.message||'프로젝트를 불러오지 못했습니다.'));
  }finally{busy=false}
}
async function rename(id){const r=await get(id);if(!r)return;const name=prompt('새 프로젝트 이름을 입력해 주세요.',r.name);if(name===null||!name.trim())return;r.name=name.trim();r.updatedAt=Date.now();await saveMeta(r);if(id===currentId){currentName=r.name;status(`${currentName} · ${dirty?'저장 안 됨':'저장됨'}`,dirty?'dirty':'saved')}await renderList()}
async function del(id){const r=await get(id);if(!r||!confirm(`“${r.name}” 프로젝트를 삭제할까요?\n삭제한 프로젝트는 복구할 수 없습니다.`))return;await remove(id);if(id===currentId){currentId=null;currentName='';dirty=true;status('현재 작업 · 저장 안 됨','dirty')}await renderList()}
function esc(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}async function renderList(){const h=$('projectList');if(!h)return;try{const rs=await all();h.innerHTML=rs.length?rs.map(r=>`<article class="saved-project ${r.id===currentId?'current':''}" data-id="${r.id}"><div class="saved-project-main"><strong>${esc(r.name)}</strong><span>${date(r.updatedAt)} · ${r.sceneCount||0}장면 · ${(Number(r.duration)||0).toFixed(1)}초</span><small>${bytes(r.sizeBytes||0)}${r.id===currentId?' · 현재 프로젝트':''}</small></div><div class="saved-project-actions"><button type="button" data-action="load">열기</button><button type="button" data-action="rename">이름 변경</button><button type="button" data-action="delete" class="danger">삭제</button></div></article>`).join(''):'<p class="empty-projects">이 기기에 저장된 프로젝트가 없습니다.</p>';await refresh()}catch(e){console.error(e);h.innerHTML='<p class="empty-projects">저장소를 열지 못했습니다. 페이지를 새로고침해 주세요.</p>'}}
function openDialog(){const d=$('projectDialog');if(!d||d.open)return;renderList();try{d.showModal()}catch(e){console.warn('Cutflow project dialog open failed',e)}}function closeDialog(){const d=$('projectDialog');if(d?.open)d.close()}
$('projectSaveBtn')?.addEventListener('click',()=>save({asNew:!currentId}));$('projectOpenBtn')?.addEventListener('click',openDialog);$('projectSaveAsBtn')?.addEventListener('click',()=>save({asNew:true}));$('projectExportBtn')?.addEventListener('click',exportProject);$('projectImportBtn')?.addEventListener('click',()=>{const input=$('projectImportInput');if(input){input.value='';input.click();}});$('projectImportInput')?.addEventListener('change',e=>importProject(e.target.files?.[0]));$('projectDialogClose')?.addEventListener('click',closeDialog);$('projectList')?.addEventListener('click',e=>{const a=e.target.closest('[data-id]'),x=e.target.dataset.action;if(!a||!x)return;if(x==='load')load(a.dataset.id);if(x==='rename')rename(a.dataset.id);if(x==='delete')del(a.dataset.id)});document.addEventListener('input',e=>{const t=e.target;if(!t.matches?.('input:not([type=file]),textarea,select'))return;if(['scrubber','projectNameInput'].includes(t.id))return;markDirty()},true);window.CutflowProjects={markDirty,save,exportProject,importProject,get dirty(){return dirty;},get busy(){return busy;},get currentId(){return currentId;}};status('저장 안 됨','dirty');refresh();
})();
