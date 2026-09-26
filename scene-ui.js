/* Shared presentation helpers; the existing project model remains authoritative. */
window.CutflowScene={
 items:()=>cues.length?cues:scenes,
 index:()=>{const n=CutRenderer.locate(timelineScenes(),currentTime()).index;return Math.max(0,Math.min(CutflowScene.items().length-1,n));},
 start:i=>cues.length?cues[i]?.start:sceneStart(i),
 select(i){const list=this.items();if(exporting||!list.length)return;i=Math.max(0,Math.min(list.length-1,i));jump(this.start(i));if(cues.length)window.selectStyleCue?.(i);window.dispatchEvent(new CustomEvent('cutflow-scene',{detail:i}));},
 thumbnail(item,i){const source=cues.length?scenes.find(s=>s.id===item.sceneId):item;return {source,duration:cues.length?item.end-item.start:item.duration,index:i};},
 async replace(file){
    const targetId=CutflowScene.items()[CutflowScene.index()]?.id,withCues=!!cues.length;if(!file)return;
    const oldIds=new Set(scenes.map(s=>s.id));await addFiles([file]);
    const added=scenes.find(s=>!oldIds.has(s.id));if(!added)return;
    const target=withCues?cues.findIndex(c=>c.id===targetId):scenes.findIndex(s=>s.id===targetId);
    if(withCues&&target>=0){const input=$('cueList').querySelector(`[data-index="${target}"] [data-action="media"]`);if(input){input.value=added.id;input.dispatchEvent(new Event('change',{bubbles:true}));}CutflowScene.select(target);}
    else if(target>=0){const previous=scenes[target];scenes[target]={...added,id:previous.id,duration:previous.duration,transform:previous.transform,motion:previous.motion,transition:previous.transition};scenes.splice(scenes.indexOf(added),1);renderScenes();CutflowScene.select(target);}
 }
};
