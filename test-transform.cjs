// Reuse the original app VM harness, then exercise the real model and compositor.
const fs=require('node:fs'),vm=require('node:vm');
let harness=fs.readFileSync('test-v4.cjs','utf8').split('run("scenes=')[0];
harness+=String.raw`
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,a+' != '+b);
run("scenes=[{id:'a',type:'image',duration:6,motion:'still',transition:'cut',transform:{scale:1.3,x:.12,y:-.08},element:{width:600,height:800}},{id:'b',type:'video',duration:3,motion:'zoom-in',transition:'cut',element:{videoWidth:600,videoHeight:800}}];cues=[{id:'1',sceneId:'a',start:0,end:3,text:'one'},{id:'2',sceneId:'a',start:3,end:6,text:'two'}]");
assert.equal(run('project().scenes[0].transform.scale'),1.3);
assert.equal(run('project().scenes[1].transform.scale'),1.3);
run("scenes[0].motion='zoom-in';jump(3);jump(0)");
assert.equal(run('project().scenes[0].transform.x'),.12);
run("$('cueList').onclick({target:{dataset:{action:'split'},closest(){return {dataset:{index:'0'},querySelector(){return null}}}}})");
assert.equal(run('cues.length'),3);
assert.equal(run('project().scenes.filter(s=>s.sourceIndex===0).every(s=>s.transform.scale===1.3)'),true);
assert.equal(run('cues.every(c=>c.transform===undefined)'),true);
for(const layout of ['reference','immersive','fullscreen'])for(const fit of ['cover','contain']){
 let previous;
 for(const w of [360,720,1080]){
  const rect=context.CutRenderer.mediaRect(w,w*16/9,layout);
  const scene={element:{width:600,height:800},duration:3,motion:'zoom-in',transform:{scale:1.3,x:.12,y:-.08}};
  const box=context.CutRenderer.mediaGeometry(scene,1.5,rect,fit);
  const normal=[box.x/w,box.y/w,box.w/w,box.h/w];if(previous)normal.forEach((n,i)=>near(n,previous[i]));previous=normal;
  const base=context.CutRenderer.mediaGeometry({...scene,transform:undefined},1.5,rect,fit);near(box.w,base.w*1.3);near(box.h,base.h*1.3);
  near(box.x+box.w/2,rect.x+rect.w/2+.12*rect.w);
  const video=context.CutRenderer.mediaGeometry({...scene,element:{videoWidth:600,videoHeight:800}},1.5,rect,fit);for(const k of ['x','y','w','h'])near(video[k],box[k]);
 }
}
const defaultBox=context.CutRenderer.mediaGeometry({element:{width:1080,height:1920},motion:'still',duration:3},0,{x:0,y:0,w:1080,h:1920},'cover');
assert.equal(defaultBox.x,0);assert.equal(defaultBox.y,0);assert.equal(defaultBox.w,1080);
assert.equal(context.CutRenderer.transform({scale:Infinity,x:NaN}).scale,1);
assert.equal(context.CutRenderer.transform({scale:100,x:10,y:-10}).scale,5);
console.log('PASS: scene-level transforms persist across caption splits; camera composition; image/video geometry; preview/export resolution equivalence and defaults.');
// Drive the shipped UI adapter with pointer events, including two-pointer rebasing.
const callbacks=[];
Object.assign(context,{requestAnimationFrame:fn=>callbacks.push(fn)});
const makeNode=()=>({disabled:false,hidden:false,value:'',style:{},listeners:{},classList:{toggle(){}},
 addEventListener(type,fn){(this.listeners[type]??=[]).push(fn)},setAttribute(){},append(){},before(){},
 getClientRects(){return [{}]},contains(){return false},getBoundingClientRect(){return {left:50,top:20,width:270,height:480}},setPointerCapture(){},blur(){context.document.activeElement=null;}});
for(const id of ['stage','sceneList','transformMode','transformReset','transformScale','transformX','transformY','transformRange']){const old=els.get(id)||{};els.set(id,Object.assign(makeNode(),old,{classList:{toggle(){}}}));}
const stage=els.get('stage');stage.width=1080;stage.height=1920;stage.parentElement=makeNode();
context.document.createElement=()=>makeNode();context.document.activeElement=null;
context.window.addEventListener=()=>{};context.CustomEvent=class {};context.window.dispatchEvent=()=>{};
vm.runInContext(fs.readFileSync('scene-ui.js','utf8'),context);context.CutflowScene=context.window.CutflowScene;
run("scenes=[{id:'a',duration:3,type:'image',motion:'still',transition:'cut',element:{width:1080,height:1920}},{id:'b',duration:3,type:'image',motion:'still',transition:'cut',element:{width:1080,height:1920}}];cues=[];offset=0;playing=false;$('layoutSelect').value='fullscreen';$('fitSelect').value='cover'");
vm.runInContext(fs.readFileSync('media-transform.js','utf8'),context);
function event(type,id,x,y){for(const fn of stage.listeners[type]||[])fn({pointerId:id,clientX:x,clientY:y,button:0,preventDefault(){}});}
function tick(){callbacks.shift()?.();}
els.get('transformMode').onclick();tick();
event('pointerdown',1,185,260);event('pointermove',1,212,308);event('pointerup',1,212,308);
near(run('scenes[0].transform.x'),.1);near(run('scenes[0].transform.y'),.1);
els.get('transformReset').onclick();near(run('scenes[0].transform.scale'),1);near(run('scenes[0].transform.x'),0);
event('pointerdown',1,150,260);event('pointerdown',2,220,260);event('pointermove',1,115,260);event('pointermove',2,255,260);
near(run('scenes[0].transform.scale'),2);near(run('scenes[0].transform.x'),0);
event('pointerup',2,255,260);event('pointermove',1,142,260);event('pointerup',1,142,260);near(run('scenes[0].transform.x'),.1);
run('CutflowScene.select(1)');tick();assert.equal(run('scenes[1].transform'),undefined);
const scaleInput=els.get('transformScale');scaleInput.value='130';scaleInput.valueAsNumber=130;scaleInput.listeners.input[0]();near(run('scenes[1].transform.scale'),1.3);
run('CutflowScene.select(0)');tick();near(run('scenes[0].transform.scale'),2);
// A pan/zoom camera still preserves the point under the pinch center.
run("scenes[0].motion='zoom-pan-right';scenes[0].transform={scale:1.3,x:.1,y:.1};offset=1");tick();
const before=run("CutRenderer.mediaGeometry(timelineScenes()[0],1,{x:0,y:0,w:1080,h:1920},'cover')");
event('pointerdown',1,150,260);event('pointerdown',2,220,260);event('pointermove',1,115,260);event('pointermove',2,255,260);event('pointerup',1,115,260);event('pointerup',2,255,260);
const after=run("CutRenderer.mediaGeometry(timelineScenes()[0],1,{x:0,y:0,w:1080,h:1920},'cover')");
near(after.x+after.w/2,540+((before.x+before.w/2)-540)*2);near(after.y+after.h/2,960+((before.y+before.h/2)-960)*2);
console.log('PASS: adapter drag, two-pointer pinch, pinch-to-drag, reset, numeric scale, scene isolation, camera pinch anchoring (simulated DOM).');

`;
vm.runInNewContext(harness,{require,console,__dirname,structuredClone,setTimeout,clearTimeout,performance,URL});
