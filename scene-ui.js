/* Logical-scene helpers. A scene can own multiple caption cues without duplicating media. */
(()=>{
  const releaseScene=scene=>{if(!scene)return;try{scene.audioElement?.pause();if(scene.element)scene.element.src='';}catch{}if(scene.url)URL.revokeObjectURL(scene.url);};
  const recalcCueTimes=()=>{
    let time=0;const totals=new Map();
    cues.forEach(cue=>{const duration=Math.max(.1,Number(cue.end)-Number(cue.start)||.1);cue.start=time;cue.end=time+duration;time=cue.end;if(cue.sceneId)totals.set(cue.sceneId,(totals.get(cue.sceneId)||0)+duration);});
    for(const [sceneId,duration] of totals){const scene=scenes.find(s=>s.id===sceneId);if(scene&&cues.some(c=>c.sceneId===sceneId&&c.freeEdit))scene.duration=duration;}
  };
  const syncSceneOrderToCues=()=>{if(!cues.length)return;const byId=new Map(scenes.map(scene=>[scene.id,scene])),ordered=[],used=new Set();logicalItems().forEach(group=>{const scene=byId.get(group.sceneId);if(scene&&!used.has(scene.id)){ordered.push(scene);used.add(scene.id);}});scenes.forEach(scene=>{if(!used.has(scene.id))ordered.push(scene);});scenes.splice(0,scenes.length,...ordered);};
  const logicalItems=()=>{
    if(!cues.length)return scenes;
    const out=[];
    for(let i=0;i<cues.length;i++){
      const cue=cues[i],previous=out.at(-1),same=previous&&previous.sceneId&&cue.sceneId===previous.sceneId;
      if(same){previous.cueIndices.push(i);previous.lastCueIndex=i;previous.end=cue.end;previous.duration=previous.end-previous.start;previous.freeEdit=previous.freeEdit&&!!cue.freeEdit;continue;}
      const source=scenes.find(s=>s.id===cue.sceneId);
      out.push({id:cue.sceneId?`scene:${cue.sceneId}`:`cue:${cue.id}`,sceneId:cue.sceneId||null,start:cue.start,end:cue.end,duration:cue.end-cue.start,firstCueIndex:i,lastCueIndex:i,cueIndices:[i],freeEdit:!!cue.freeEdit,source});
    }
    return out;
  };
  const activeCueIndex=()=>{
    if(!cues.length)return -1;const t=currentTime();let i=cues.findIndex(c=>t>=c.start&&t<c.end);if(i<0&&Math.abs(t-totalDuration())<.02)i=cues.length-1;if(i<0)i=Math.max(0,cues.findLastIndex(c=>c.start<=t));return i;
  };
  const sceneIndexForCue=cueIndex=>{if(!cues.length)return cueIndex;return logicalItems().findIndex(g=>g.cueIndices.includes(cueIndex));};
  const cueIndexForScene=sceneIndex=>{
    if(!cues.length)return -1;const group=logicalItems()[sceneIndex];if(!group)return -1;const active=activeCueIndex();return group.cueIndices.includes(active)?active:group.firstCueIndex;
  };

  window.CutflowScene={
    items:logicalItems,
    index(){
      const list=logicalItems();if(!list.length)return 0;
      if(cues.length){const ci=activeCueIndex(),si=sceneIndexForCue(ci);return Math.max(0,si>=0?si:0);}
      const n=CutRenderer.locate(timelineScenes(),currentTime()).index;return Math.max(0,Math.min(list.length-1,n));
    },
    cueIndex:cueIndexForScene,
    sceneIndexForCue,
    start:i=>{const item=logicalItems()[i];return cues.length?(item?.start||0):sceneStart(i);},
    select(i){const list=logicalItems();if(exporting||!list.length)return;i=Math.max(0,Math.min(list.length-1,i));const item=list[i];jump(this.start(i));if(cues.length&&item){window.selectStyleCue?.(item.firstCueIndex);}window.dispatchEvent(new CustomEvent('cutflow-scene',{detail:i}));},
    thumbnail(item,i){if(cues.length){const source=item?.source||scenes.find(s=>s.id===item?.sceneId);return {source,duration:item?.duration||0,index:i};}return {source:item,duration:item?.duration||0,index:i};},
    move(from,to){
      const list=logicalItems();if(exporting||from===to||from<0||to<0||from>=list.length||to>=list.length)return false;pause();
      if(cues.length){
        rememberCues();const groups=list.map(g=>g.cueIndices.map(ci=>cues[ci]));const [block]=groups.splice(from,1);groups.splice(to,0,block);cues=groups.flat();recalcCueTimes();syncSceneOrderToCues();renderCues();
      }else{moveScene(from,to);}
      changed();this.select(to);return true;
    },
    remove(index){
      const list=logicalItems();if(exporting||index<0||index>=list.length)return false;pause();
      if(cues.length){
        rememberCues();const group=list[index],removeSet=new Set(group.cueIndices),removed=cues.filter((_,i)=>removeSet.has(i)),sceneId=group.sceneId;cues=cues.filter((_,i)=>!removeSet.has(i));recalcCueTimes();
        if(sceneId&&!cues.some(c=>c.sceneId===sceneId)){const si=scenes.findIndex(s=>s.id===sceneId);if(si>=0)releaseScene(scenes.splice(si,1)[0]);}
        syncSceneOrderToCues();renderCues();
      }else{const [scene]=scenes.splice(index,1);releaseScene(scene);renderScenes();}
      offset=Math.min(offset,totalDuration());changed();const next=logicalItems();if(next.length)this.select(Math.min(index,next.length-1));else{jump(0);window.dispatchEvent(new CustomEvent('cutflow-scene',{detail:0}));}return true;
    },
    async replace(file){
      if(!file)return;const list=logicalItems(),sceneIndex=this.index(),group=list[sceneIndex],withCues=!!cues.length;const oldIds=new Set(scenes.map(s=>s.id));await addFiles([file],{createFreeCues:false});const added=scenes.find(s=>!oldIds.has(s.id));if(!added)return;if(!audioBuffer&&added.type==='video'&&(added.mediaVolume??0)===0)added.mediaVolume=1;
      if(withCues&&group){
        const previous=scenes.find(s=>s.id===group.sceneId),addedIndex=scenes.indexOf(added),previousIndex=previous?scenes.indexOf(previous):-1;
        if(previous&&previousIndex>=0){const keptId=previous.id;scenes[previousIndex]={...added,id:keptId,duration:group.duration,transform:previous.transform,motion:previous.motion,transition:previous.transition,mediaVolume:previous.mediaVolume,mediaMuted:previous.mediaMuted,mediaFadeIn:previous.mediaFadeIn,mediaFadeOut:previous.mediaFadeOut};if(addedIndex>=0&&addedIndex!==previousIndex)scenes.splice(scenes.indexOf(added),1);try{previous.audioElement?.pause();previous.element.src='';}catch{}if(previous.url)URL.revokeObjectURL(previous.url);}
        else{group.cueIndices.forEach(ci=>{cues[ci].sceneId=added.id;});}
        renderCues();this.select(sceneIndex);
      }else if(group){const target=scenes.findIndex(s=>s.id===group.id||s===group);if(target>=0){const previous=scenes[target];scenes[target]={...added,id:previous.id,duration:previous.duration,transform:previous.transform,motion:previous.motion,transition:previous.transition};scenes.splice(scenes.indexOf(added),1);renderScenes();this.select(target);}}
    }
  };
})();
