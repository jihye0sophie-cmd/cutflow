const fs=require('node:fs'),assert=require('node:assert');
const store=fs.readFileSync('project-store.js','utf8');
const app=fs.readFileSync('app.js','utf8');
const html=fs.readFileSync('index.html','utf8');

assert.ok(store.includes("appVersion:'42'"),'saved project metadata must use current app version');
assert.ok(store.includes("fileRef:ref"),'scene media must be detached into blob references');
assert.ok(store.includes("p.narration.fileRef"),'narration media reference missing');
assert.ok(store.includes("p.bgm.fileRef"),'BGM media reference missing');
assert.ok(store.includes("s.file=file(s.fileRef"),'scene media must hydrate back into project payload');
assert.ok(store.includes('MissingProjectMedia'),'missing saved media must fail load instead of silently dropping scenes');
assert.ok(store.includes('shared=new Map()')&&store.includes('sharedFiles=new Map()'),'shared long-video media must be stored and hydrated by one shared reference');
assert.ok(store.includes("PACKAGE_MAGIC='CUTFLOW1'")&&store.includes("type:'application/octet-stream'"),'portable .cutflow binary container format missing');
assert.ok(store.includes('encodePackage(record,rows)')&&store.includes('decodePackage(file)'),'portable project encode/decode path missing');
assert.ok(store.includes('const check=await decodePackage(blob)')&&store.includes("check.sourceRows.length!==rows.length"),'portable export must self-validate before download');
assert.ok(!store.includes('navigator.share')&&!store.includes('navigator.canShare'),'direct Web Share must stay disabled for binary .cutflow files');
assert.ok(store.includes("new Blob([header,json,...rows.map(r=>r.blob)]"),'portable project must include original media blobs without base64 expansion');
assert.ok(store.includes("const key=\`\${id}:import:\${i}\`")&&store.includes('refMap.set(row.key,key)'),'imported media references must be remapped to a fresh project id');
assert.ok(store.includes('await saveBundle(bundle.record,bundle.rows)')&&store.includes('await bridge().restore(await hydrate(bundle.record))'),'imported projects must be saved locally and opened for editing');
assert.ok(store.includes('if(importedId){try{await remove(importedId);}')&&store.includes('Cutflow import rollback failed'),'failed imports must clean the partial saved project and restore the previous workspace');
assert.ok(html.includes('projectExportBtn')&&html.includes('projectImportBtn')&&html.includes('projectImportInput'),'project transfer controls missing');
assert.ok(/project-store\.js\?v=41\.9/.test(html)&&/project-store\.css\?v=24\.2/.test(html),'project transfer runtime cache keys missing');
assert.ok(store.includes('replaceBytes=Number(existing?.sizeBytes)||0'),'overwrite quota must account for the project being replaced');
assert.ok(!store.includes("restore(previous,{history:true});window.CutflowHistory?.reset"),'failed load rollback must preserve the current undo stack');
assert.ok(store.includes("p.narration.file=file(p.narration.fileRef"),'narration must hydrate back into project payload');
assert.ok(store.includes("p.bgm.file=file(p.bgm.fileRef"),'BGM must hydrate back into project payload');

assert.ok(app.includes("capture(){return {schemaVersion:1"),'project bridge capture schema missing');
assert.ok(app.includes("async restore(data,options={})"),'project bridge restore missing');
assert.ok(app.includes("await clearProjectMedia()"),'restore must clear old media before rebuilding');
assert.ok(app.includes("scene=await makeScene(file)"),'restore must rebuild scene media elements');
assert.ok(app.includes("await loadAudio(f,{commit:false,notify:false})"),'restore must rebuild narration audio state without intermediate dirty commits');
assert.ok(app.includes("if(!(await loadAudio(f,{commit:false,notify:false})))throw new Error('저장된 내레이션을 복원하지 못했습니다.')"),'project restore must fail if saved narration cannot be decoded');
assert.ok(!app.includes("if(!saved?.file)continue;"),'project/timeline restore must never silently drop a scene with missing media');
assert.ok(app.includes("await window.restoreBgmSnapshot?.(data.bgm||null,{silent:true})"),'restore must rebuild BGM state');
assert.ok(app.includes("cutflow-project-restored"),'restore completion event missing');

console.log('project save/restore roundtrip architecture checks passed');
