const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const els=new Map(),element=()=>({value:'',textContent:'',innerHTML:'',disabled:false,listeners:{},classList:{add(){},remove(){}},addEventListener(type,listener){(this.listeners[type]??=[]).push(listener);},getContext(){return {clearRect(){},fillRect(){}}},pause(){},setAttribute(){}});
const context={window:{addEventListener(){},dispatchEvent(){}},document:{getElementById(id){if(!els.has(id))els.set(id,element());return els.get(id)},fonts:{ready:Promise.resolve(),addEventListener(){}},addEventListener(){},querySelectorAll(){return []}},CustomEvent:class{constructor(type,init){this.type=type;this.detail=init?.detail}},crypto:require('node:crypto').webcrypto,structuredClone,setTimeout,clearTimeout,requestAnimationFrame(){},performance,URL,console};vm.createContext(context);vm.runInContext(fs.readFileSync('renderer.js','utf8'),context);context.CutRenderer=context.window.CutRenderer;vm.runInContext(fs.readFileSync('caption-ranges.js','utf8'),context);context.CaptionRanges=context.window.CaptionRanges;context.CaptionStyle={resolve:c=>({color:c?.style?.color||c?.color||'#ffffff'})};context.window.CaptionStyle=context.CaptionStyle;vm.runInContext(fs.readFileSync('app.js','utf8'),context);
const run=s=>vm.runInContext(s,context);
run("scenes=[{id:'a',name:'image',type:'image',duration:2.4,motion:'still',transition:'cut',trimStart:0},{id:'b',name:'video',type:'video',duration:2.4,motion:'still',transition:'cut',trimStart:.3,sourceDuration:10}];cues=[{id:'c1',start:0,end:3,text:'첫 자막',color:'white'},{id:'c2',start:3,end:6,text:'둘째 자막',color:'white'}];assignAvailableCuts();renderCues()");
assert.equal(run('project().scenes[0].duration'),3);assert.equal(run('project().scenes[1].start'),3);assert.equal(run('CutRenderer.locate(project().scenes,2.999).index'),0);assert.equal(run('CutRenderer.locate(project().scenes,3).index'),1);assert.equal(run('CutRenderer.locate(project().scenes,6).index'),-1);
run("const beforeRender=JSON.stringify(cues);renderCues();if(JSON.stringify(cues)!==beforeRender)throw new Error('renderCues mutated cue data')");
run("cues[0].end=2;cues[1].start=3.5;renderCues()");assert.equal(run('project().scenes[0].duration'),2);assert.equal(run('project().scenes[1].duration'),2.5);assert.equal(run('CutRenderer.locate(project().scenes,3).index'),-1);
const splitBaseline=run('JSON.stringify({scenes,cues})');
run("window.CutflowCaption.split(1,2)");assert.equal(run('cues.length'),3);assert.equal(run('cues[2].sceneId'),'b');assert.ok(run('project().scenes[2].trimStart')>.3);
run(`({scenes,cues}=JSON.parse(${JSON.stringify(splitBaseline)}));renderCues()`);assert.equal(run('cues.length'),2);
run("window.CutflowCaption.split(0,1);window.CutflowCaption.mergeNext(0)");assert.equal(run('cues.length'),2);assert.equal(run('cues[0].sceneId'),'a');assert.equal(run('project().scenes[0].end'),2);
run(`({scenes,cues}=JSON.parse(${JSON.stringify(splitBaseline)}));renderCues()`);
run("cues.push({id:'c3',start:6,end:8,text:'누락',color:'white'});renderCues();stats()");assert.equal(els.get('exportBtn').disabled,true);run("cues[2].sceneId='a';renderCues();stats()");assert.equal(els.get('exportBtn').disabled,false);
console.log('PASS: exact 0–3 / 3–6 boundaries; timing edits; empty gaps; split video offset; merge and undo; missing-media export gate.');
run("scenes[0].motion='pan-left';renderCues()");
assert.equal(run("project().scenes.filter(s=>s.sourceIndex===0).every(s=>s.motion==='pan-left')"),true);assert.equal(run('scenes[0].motion'),'pan-left');
assert.equal(els.get('sceneList').hidden,true);assert.equal(els.get('sceneList').innerHTML,'');assert.ok(els.get('cueList').innerHTML.includes('data-action="color"'));assert.ok(els.get('cueList').innerHTML.includes('data-action="motion"'));
run("$('cueList').onchange({target:{value:'1.25',dataset:{action:'trim-start'},closest(){return {dataset:{index:'1'}}}}})");assert.equal(run('project().scenes[1].trimStart'),1.25);assert.equal(run('scenes[1].trimStart'),1.25);
console.log('PASS: caption rows share scene-level motion and video trim without duplicating media settings.');
vm.runInContext(fs.readFileSync('caption-style.js','utf8'),context);
context.CaptionStyle=context.window.CaptionStyle;
context.CutFonts={list:[{id:'noto',label:'기본'}],get:()=>({}),ensure:async()=>{}};
context.window.CutFonts=context.CutFonts;
context.CutRenderer.fonts=async()=>{};
vm.runInContext(fs.readFileSync('style-editor.js','utf8'),context);
run("$('styleScope').value='current';applyCaptionStyle({color:'#b8ff38',font:'gangwon',y:20,background:true})");
assert.equal(run('cues[0].style.color'),'#b8ff38');
assert.equal(run('cues[1].style'),undefined);
run("$('styleScope').value='all';applyCaptionStyle({size:80,bold:false,italic:false,strokeColor:'#ff0000',strokeWidth:4,backgroundOpacity:.4,padding:20,radius:8,y:82})");
assert.equal(run('cues.every(c=>c.style.size===80&&c.style.y===82&&c.style.strokeWidth===4)'),true);
assert.equal(run('cues[0].style.font'),'gangwon');
assert.equal(run('cues[1].style.font'),undefined);
const beforeScope=run('JSON.stringify(cues.map(({style,color,...rest})=>rest))');
const beforeAllStyle=run('JSON.stringify(cues)');
run("$('styleScope').value='all';$('styleScope').onchange()");
for(const style of JSON.parse(run('JSON.stringify(cues.map(c=>c.style))')))
  assert.deepEqual(style,JSON.parse(run('JSON.stringify(cues[0].style)')));
assert.equal(run('cues[1].style.font'),'gangwon');
assert.equal(run('cues[1].color'),'#b8ff38');
assert.equal(run('JSON.stringify(cues.map(({style,color,...rest})=>rest))'),beforeScope);
run(`cues=JSON.parse(${JSON.stringify(beforeAllStyle)});renderCues()`);
assert.equal(run('cues[1].style.font'),undefined);
run("$('styleScope').value='current';$('styleScope').onchange();applyCaptionStyle({color:'#ff982f'})");
assert.equal(run('cues[0].color'),'#ff982f');
assert.notEqual(run('cues[1].color'),'#ff982f');
console.log('PASS: edit then select all copies complete style without changing cuts/timing/text; undo and current-only editing remain intact.');
run("cues=Array.from({length:12},(_,i)=>({id:'r'+i,start:i,end:i+1,text:'x',sceneId:i===5?'b':'a',motion:'still'}));scenes[0].motion='still';scenes[1].motion='still';renderCues();$('randomMotionBtn').onclick()");
assert.equal(run("scenes[1].motion"),'still');
assert.notEqual(run("scenes[0].motion"),'still');
assert.equal(run("cues.every(c=>c.motion===undefined)"),true);
for(const name of run('Object.keys(motionLabels)')){
  const samples=[];
  for(const elapsed of [0,.22,.5,1,1.5,2]){
    const m=context.CutRenderer.motion({motion:name,duration:2},elapsed);samples.push(m);
    assert.ok(Number.isFinite(m.scale)&&m.scale>=1-1e-12&&Number.isFinite(m.x)&&Number.isFinite(m.y));
  }
  if(name!=='still')assert.ok(samples.some(m=>Math.abs(m.scale-1)>1e-6||Math.abs(m.x)>1e-6||Math.abs(m.y)>1e-6),name+' must produce visible camera motion');
}
assert.equal(context.CutRenderer.motion({motion:'punch-hold',duration:2},.22).scale,context.CutRenderer.motion({motion:'punch-hold',duration:2},2).scale);
assert.ok(context.CutRenderer.motion({motion:'zoom-pan-up',duration:2},2).y<context.CutRenderer.motion({motion:'zoom-pan-up',duration:2},0).y);
assert.ok(context.CutRenderer.motion({motion:'zoom-pan-down',duration:2},2).y>context.CutRenderer.motion({motion:'zoom-pan-down',duration:2},0).y);
const handheldA=context.CutRenderer.motion({motion:'handheld-subtle',duration:2},.7),handheldB=context.CutRenderer.motion({motion:'handheld-subtle',duration:2},.7);
assert.deepEqual(handheldA,handheldB);assert.ok(Math.abs(handheldA.x)<.01&&Math.abs(handheldA.y)<.01&&handheldA.scale>1&&handheldA.scale<1.04);
console.log('PASS: current/all caption patches preserve unrelated styles; random images avoid repeats and leave video unchanged; all camera paths are finite; vertical zoom-pan directions and deterministic subtle handheld motion are bounded; punch zoom holds.');
run("cues=[{id:'r1',start:0,end:4,text:'가나다 라마바',colorRanges:CaptionRanges.apply('가나다 라마바',[],1,6,'#ff4949')},{id:'r2',start:4,end:6,text:'다음'}];renderCues()");
run("window.CutflowCaption.split(0,3)");
assert.equal(run('cues[0].text'),'가나다');assert.equal(run('cues[1].text'),'라마바');
assert.equal(run('JSON.stringify(cues[0].colorRanges)'),JSON.stringify([{start:1,end:3,color:'#ff4949'}]));
assert.equal(run('JSON.stringify(cues[1].colorRanges)'),JSON.stringify([{start:0,end:2,color:'#ff4949'}]));
run("window.CutflowCaption.mergeNext(0)");
assert.equal(run('cues[0].colorRanges[1].start'),4);
assert.equal(run("JSON.stringify(CaptionRanges.edit('가나다','앞가나다',[{start:1,end:3,color:'#ff4949'}]))"),JSON.stringify([{start:2,end:4,color:'#ff4949'}]));
assert.equal(run("JSON.stringify(CaptionRanges.apply('가나다',[{start:0,end:3,color:'#ff4949'}],1,2,null))"),JSON.stringify([{start:0,end:1,color:'#ff4949'},{start:2,end:3,color:'#ff4949'}]));
console.log('PASS: selection colors survive text insertion, split, merge; reset affects only selected characters.');

// Reapplying while already in All mode must overwrite later per-cue style edits.
run("$('styleScope').value='all';selectStyleCue(0);applyCaptionStyle({font:'noto',size:72,bold:false,italic:true,background:true,strokeWidth:5});cues[1].style={...cues[1].style,size:24,color:'#ff0000'};renderCues();$('applyAllCaptionStyle').onclick()");
assert.equal(run('cues.every(c=>c.style.size===72&&c.style.bold===false&&c.style.italic===true&&c.style.background===true&&c.style.strokeWidth===5)'),true);
const existingStyle=run('JSON.stringify(cues[0].style)');
run("$('addCueBtn').onclick()");
assert.deepEqual(JSON.parse(run('JSON.stringify(cues.at(-1).style)')),JSON.parse(existingStyle));
run("$('styleScope').value='current';$('addCueBtn').onclick()");
assert.equal(run('cues.at(-1).style'),undefined);
console.log('PASS: explicit reapply in All mode and new-cue style inheritance; Current scope stays isolated.');

// Exercise the UI events through project() and the compositor shared by preview/export.
const input=id=>els.get(id).listeners.input.forEach(fn=>fn());
run("$('titleStrokeWidth').value='12';$('channelStrokeWidth').value='6';$('layoutSelect').value='fullscreen'");input('layoutSelect');
assert.equal(run('project().titleStrokeEnabled&&project().channelStrokeEnabled'),true);
run("$('titleStrokeEnabled').checked=false");input('titleStrokeEnabled');
assert.equal(els.get('titleStrokeWidth').disabled,true);
run("$('layoutSelect').value='framed'");input('layoutSelect');
run("$('layoutSelect').value='fullscreen'");input('layoutSelect');
assert.equal(run('project().titleStrokeEnabled'),false);
run("$('titleStrokeEnabled').checked=true");input('titleStrokeEnabled');
assert.equal(run('project().titleStrokeWidth'),12);
assert.equal(els.get('titleStrokeWidth').disabled,false);
assert.equal(els.get('titleStrokeValue').textContent,'12px');
run("$('channelStrokeWidth').value='0'");input('channelStrokeWidth');
assert.equal(run('project().channelStrokeWidth'),0);
(async()=>{
  const calls=[];
  const ctx={save(){},restore(){},fillRect(){},measureText(){return {width:8};},strokeText(text){calls.push({text,width:this.lineWidth});},fillText(){}};
  const base={scenes:[{start:0,end:1,duration:1}],cues:[{start:0,end:1,text:'S',style:{strokeWidth:3}}],title:'T',channel:'C',titleStrokeEnabled:true,titleStrokeWidth:12,channelStrokeEnabled:true,channelStrokeWidth:6};
  for(const layout of ['framed','immersive','fullscreen'])for(const width of [360,720,1080]){
    const canvas={width,height:width*16/9,getContext:()=>ctx};
    calls.length=0;await context.CutRenderer.draw(canvas,{...base,layout},0);
    for(const [text,size] of [['T',12],['C',6],['S',3]])assert.equal(calls.find(c=>c.text===text)?.width,size*width/1080,`${layout}/${width}: ${text}`);
    calls.length=0;await context.CutRenderer.draw(canvas,{...base,layout,titleStrokeEnabled:false,channelStrokeEnabled:false},0);
    assert.deepEqual(calls.map(c=>c.text),['S']);
    calls.length=0;await context.CutRenderer.draw(canvas,{...base,layout,titleStrokeWidth:0,channelStrokeWidth:0},0);
    assert.deepEqual(calls.map(c=>c.text),['S']);
  }
  console.log('PASS: independent title/channel toggles, retained widths, template switching, zero width, caption isolation and 360/720/1080 scaling in all layouts.');
})().catch(error=>{console.error(error);process.exitCode=1;});

// Desktop navigation uses cue intervals, including repeated source media.
let desktop=true,scrolls=[];
context.window.matchMedia=()=>({matches:desktop});
const navRows=[0,1,2].map(index=>({dataset:{index:String(index)},selected:false,classList:{toggle(name,on){navRows[index].selected=on}},scrollIntoView(options){scrolls.push({index,...options})}}));
context.document.querySelectorAll=selector=>selector==='.cue-row'?navRows:[];
run("scenes=[{id:'a',type:'image',duration:2,motion:'still',transition:'cut'}];cues=[{id:'n0',sceneId:'a',start:0,end:2,text:'A'},{id:'n1',sceneId:'a',start:3,end:5,text:'B'},{id:'n2',sceneId:'a',start:5,end:8,text:'C'}];audioBuffer=null;playing=false;offset=0");
const untouched=run('JSON.stringify({scenes,cues})');
run("$('nextBtn').onclick()");assert.equal(run('offset'),3);assert.equal(run('lastCue'),1);assert.equal(navRows[1].selected,true);assert.equal(scrolls.at(-1).behavior,'smooth');assert.equal(scrolls.at(-1).block,'center');
run("$('prevBtn').onclick()");assert.equal(run('offset'),0);
run("offset=4;$('prevBtn').onclick()");assert.equal(run('offset'),0);
run("offset=2.5;$('nextBtn').onclick()");assert.equal(run('offset'),3);
run("offset=5;$('nextBtn').onclick()");assert.equal(run('offset'),5);
context.navClick={target:{dataset:{},closest(selector){return selector==='.cue-row'?navRows[1]:null}}};
run("$('cueList').onclick(navClick)");assert.equal(run('offset'),3);assert.equal(run('lastCue'),1);assert.ok(els.get('nowPlaying').textContent.includes('자막 2'));
assert.equal(run('JSON.stringify({scenes,cues})'),untouched);
desktop=false;const priorScrolls=scrolls.length;run("offset=0;$('nextBtn').onclick()");assert.equal(run('offset'),3);assert.equal(scrolls.length,priorScrolls);
run("offset=0;$('cueList').onclick(navClick)");assert.equal(run('offset'),0);
console.log('PASS: desktop next/previous/card sync, repeated media, gaps, last boundary, smooth centered scroll, unchanged timeline data and mobile scrolling.');
