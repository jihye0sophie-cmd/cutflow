const fs=require('node:fs'),assert=require('node:assert');
const store=fs.readFileSync('project-store.js','utf8');
const app=fs.readFileSync('app.js','utf8');

assert.ok(store.includes("appVersion:'42'"),'saved project metadata must use current app version');
assert.ok(store.includes("fileRef:ref"),'scene media must be detached into blob references');
assert.ok(store.includes("p.narration.fileRef"),'narration media reference missing');
assert.ok(store.includes("p.bgm.fileRef"),'BGM media reference missing');
assert.ok(store.includes("s.file=file(s.fileRef"),'scene media must hydrate back into project payload');
assert.ok(store.includes('MissingProjectMedia'),'missing saved media must fail load instead of silently dropping scenes');
assert.ok(store.includes('shared=new Map()')&&store.includes('sharedFiles=new Map()'),'shared long-video media must be stored and hydrated by one shared reference');
assert.ok(store.includes('replaceBytes=Number(existing?.sizeBytes)||0'),'overwrite quota must account for the project being replaced');
assert.ok(!store.includes("restore(previous,{history:true});window.CutflowHistory?.reset"),'failed load rollback must preserve the current undo stack');
assert.ok(store.includes("p.narration.file=file(p.narration.fileRef"),'narration must hydrate back into project payload');
assert.ok(store.includes("p.bgm.file=file(p.bgm.fileRef"),'BGM must hydrate back into project payload');

assert.ok(app.includes("capture(){return {schemaVersion:1"),'project bridge capture schema missing');
assert.ok(app.includes("async restore(data,options={})"),'project bridge restore missing');
assert.ok(app.includes("await clearProjectMedia()"),'restore must clear old media before rebuilding');
assert.ok(app.includes("scene=await makeScene(file)"),'restore must rebuild scene media elements');
assert.ok(app.includes("await loadAudio(f,{commit:false,notify:false})"),'restore must rebuild narration audio state without intermediate dirty commits');
assert.ok(app.includes("await window.restoreBgmSnapshot?.(data.bgm||null,{silent:true})"),'restore must rebuild BGM state');
assert.ok(app.includes("cutflow-project-restored"),'restore completion event missing');

console.log('project save/restore roundtrip architecture checks passed');
