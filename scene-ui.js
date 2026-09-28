/* Shared presentation helpers; the existing project model remains authoritative. */
/* Shared presentation helpers; the existing project model remains authoritative. */
(()=>{
  const releaseScene=scene=>{if(!scene)return;try{scene.audioElement?.pause();if(scene.element)scene.element.src='';}catch{}if(scene.url)URL.revokeObjectURL(scene.url);};
  const recalcCueTimes=()=>{let time=0;cues.forEach(cue=>{const duration=Math.max(.1,Number(cue.end)-Number(cue.start)||.1);cue.start=time;cue.end=time+duration;const scene=scenes.find(s=>s.id===cue.sceneId);if(scene&&cue.freeEdit)scene.duration=duration;time=cue.end;});};
  const syncSceneOrderToCues=()=>{if(!cues.length)return;const byId=new Map(scenes.map(scene=>[scene.id,scene]));const ordered=[],used=new Set();cues.forEach(cue=>{const scene=byId.get(cue.sceneId);if(scene&&!used.has(scene.id)){ordered.push(scene);used.add(scene.id);}});scenes.forEach(scene=>{if(!used.has(scene.id))ordered.push(scene);});scenes.splice(0,scenes.length,...ordered);};

window.CutflowScene={
 items:()=>cues.length?cues:scenes,
 index:()=>{const n=CutRenderer.locate(timelineScenes(),currentTime()).index;return Math.max(0,Math.min(CutflowScene.items().length-1,n));},
 start:i=>cues.length?cues[i]?.start:sceneStart(i),
 select(i){const list=this.items();if(exporting||!list.length)return;i=Math.max(0,Math.min(list.length-1,i));jump(this.start(i));if(cues.length)window.selectStyleCue?.(i);window.dispatchEvent(new CustomEvent('cutflow-scene',{detail:i}));},
 thumbnail(item,i){const source=cues.length?scenes.find(s=>s.id===item.sceneId):item;return {source,duration:cues.length?item.end-item.start:item.duration,index:i};},
 move(from,to){
   const list=this.items();if(exporting||from===to||from<0||to<0||from>=list.length||to>=list.length)return false;
   pause();
   if(cues.length){rememberCues();const [cue]=cues.splice(from,1);cues.splice(to,0,cue);recalcCueTimes();syncSceneOrderToCues();renderCues();}
   else{moveScene(from,to);}
   changed();this.select(to);return true;
 },
 remove(index){
   const list=this.items();if(exporting||index<0||index>=list.length)return false;pause();
   if(cues.length){
     rememberCues();const [cue]=cues.splice(index,1);const sceneId=cue?.sceneId;recalcCueTimes();
     if(sceneId&&!cues.some(c=>c.sceneId===sceneId)){const si=scenes.findIndex(s=>s.id===sceneId);if(si>=0)releaseScene(scenes.splice(si,1)[0]);}
     syncSceneOrderToCues();renderCues();
   }else{const [scene]=scenes.splice(index,1);releaseScene(scene);renderScenes();}
   offset=Math.min(offset,totalDuration());changed();const next=this.items();if(next.length)this.select(Math.min(index,next.length-1));else{jump(0);window.dispatchEvent(new CustomEvent('cutflow-scene',{detail:0}));}return true;
 },
 async replace(file){
    const targetId=CutflowScene.items()[CutflowScene.index()]?.id,withCues=!!cues.length;if(!file)return;
    const oldIds=new Set(scenes.map(s=>s.id));await addFiles([file],{createFreeCues:false});
    const added=scenes.find(s=>!oldIds.has(s.id));if(!added)return;if(!audioBuffer&&added.type==='video'&&(added.mediaVolume??0)===0)added.mediaVolume=1;
    const target=withCues?cues.findIndex(c=>c.id===targetId):scenes.findIndex(s=>s.id===targetId);
    if(withCues&&target>=0){const input=$('cueList').querySelector(`[data-index="${target}"] [data-action="media"]`);if(input){input.value=added.id;input.dispatchEvent(new Event('change',{bubbles:true}));}CutflowScene.select(target);}
    else if(target>=0){const previous=scenes[target];scenes[target]={...added,id:previous.id,duration:previous.duration,transform:previous.transform,motion:previous.motion,transition:previous.transition};scenes.splice(scenes.indexOf(added),1);renderScenes();CutflowScene.select(target);}
 }
};
})();
