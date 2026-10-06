const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let now=0,changedCount=0,renderCount=0,lastSelected=-1;
const ctx={console,URL:{revokeObjectURL(){}},window:{dispatchEvent(){},selectStyleCue(i){lastSelected=i}},CustomEvent:function(type,init){this.type=type;this.detail=init?.detail},
 cues:[{id:'c1',sceneId:'s1',start:0,end:2,text:'A',freeEdit:true,mediaOffset:0},{id:'c2',sceneId:'s1',start:2,end:6,text:'B',freeEdit:true,mediaOffset:2},{id:'c3',sceneId:'s2',start:6,end:9,text:'C',freeEdit:true,mediaOffset:0}],
 scenes:[{id:'s1',duration:6,thumb:'1',element:{}},{id:'s2',duration:3,thumb:'2',element:{}}],
 offset:0,currentTime:()=>now,totalDuration:()=>9,sceneStart:i=>i?6:0,exporting:false,pause(){},rememberCues(){},renderCues(){renderCount++},renderScenes(){},changed(){changedCount++},jump(t){now=t},timelineScenes(){return[]},CutRenderer:{locate(){return{index:0}}},moveScene(){}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('scene-ui.js','utf8'),ctx);const S=ctx.window.CutflowScene;
assert.equal(S.items().length,2);assert.equal(JSON.stringify(S.items()[0].cueIndices),'[0,1]');assert.equal(S.items()[0].duration,6);
now=3;assert.equal(S.index(),0);assert.equal(S.cueIndex(0),1);assert.equal(S.sceneIndexForCue(1),0);assert.equal(S.sceneIndexForCue(2),1);
S.select(0);assert.equal(now,0);assert.equal(lastSelected,0);
assert.equal(S.move(0,1),true);assert.equal(JSON.stringify(ctx.cues.map(c=>c.id)),'["c3","c1","c2"]');assert.equal(S.items().length,2);assert.equal(S.items()[1].cueIndices.length,2);
assert.equal(S.remove(1),true);assert.equal(JSON.stringify(ctx.cues.map(c=>c.id)),'["c3"]');assert.equal(JSON.stringify(ctx.scenes.map(s=>s.id)),'["s2"]');assert.ok(changedCount>=2&&renderCount>=2);
console.log('PASS: logical scenes keep multiple caption segments grouped for navigation, reorder and delete.');

assert.ok(app.includes('mediaVolume:0'),'new video scenes must start with original audio muted by volume');
assert.ok(!app.includes("scene.mediaVolume=scene.type==='video'?1:0"),'free-cue video insertion must not force original audio to 100%');
assert.ok(!sceneUI.includes("added.mediaVolume=1"),'video replacement must not force original audio to 100%');
