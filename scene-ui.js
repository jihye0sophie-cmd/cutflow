/* Logical-scene helpers. A scene can own multiple caption cues without duplicating media. */
(()=>{
  const releaseScene=scene=>{if(window.CutflowReleaseSceneResources)return window.CutflowReleaseSceneResources(scene);if(!scene)return;try{scene.audioElement?.pause();if(scene.audioElement){scene.audioElement.removeAttribute('src');scene.audioElement.load?.();scene.audioElement=null;}if(scene.element){scene.element.removeAttribute?.('src');scene.element.src='';}}catch{}if(scene.url){URL.revokeObjectURL(scene.url);scene.url='';}};
  const sceneSettings=scene=>({
    duration:scene.duration,motion:scene.motion,transition:scene.transition,
    transform:cloneProjectData(scene.transform||null),mediaVolume:scene.mediaVolume,
    mediaMuted:scene.mediaMuted,mediaFadeIn:scene.mediaFadeIn,mediaFadeOut:scene.mediaFadeOut,
    trimStart:scene.trimStart,trimEnd:scene.trimEnd
  });
  const duplicateScene=async scene=>{
    if(!scene?.file)throw new Error('원본 미디어를 찾을 수 없습니다.');
    const copy=await makeScene(scene.file);Object.assign(copy,sceneSettings(scene));return copy;
  };
  const sameMedia=(a,b)=>{
    if(!a||!b)return false;if(a.file&&b.file&&a.file===b.file)return true;
    const fa=a.file,fb=b.file;if(!fa||!fb)return false;
    return fa.name===fb.name&&fa.size===fb.size&&fa.type===fb.type&&Number(fa.lastModified||0)===Number(fb.lastModified||0);
  };
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

  const sourceForIndex=index=>{
    const list=logicalItems(),item=list[index];
    if(!item)return {list,item:null,scene:null};
    const scene=cues.length?(item.source||scenes.find(s=>s.id===item.sceneId)):item;
    return {list,item,scene};
  };
  const inspect=index=>{
    const {item,scene}=sourceForIndex(index);if(!item||!scene)return null;
    const transform=CutRenderer.transform(scene.transform);
    return {
      index,type:scene.type,name:scene.name||'',duration:Number(item.duration||scene.duration||0),
      motion:scene.motion||'still',transition:scene.transition||'cut',
      transform:{scale:transform.scale*100,x:transform.x*100,y:transform.y*100},
      trimStart:Number(scene.trimStart||0),trimEnd:Number(scene.trimEnd??scene.sourceDuration)||0,
      sourceDuration:Number(scene.sourceDuration)||0,mediaMuted:!!scene.mediaMuted,
      mediaVolume:Math.round((scene.mediaVolume??0)*100),
      mediaFadeIn:Number(scene.mediaFadeIn||0),mediaFadeOut:Number(scene.mediaFadeOut||0),
      motionOptions:Object.entries(motionLabels),transitionOptions:Object.entries(transitionLabels)
    };
  };
  const emitSceneUpdated=index=>{const state=inspect(index);window.dispatchEvent(new CustomEvent('cutflow-scene-updated',{detail:{index,state}}));return state;};
  const renderSceneModel=()=>{if(cues.length)renderCues();else renderScenes();};
  const patchScene=(index,patch={})=>{
    const {item,scene}=sourceForIndex(index);if(!item||!scene||exporting||loading)return false;
    pause();if(cues.length)rememberCues();
    const group=cues.length?item:null;
    if(patch.motion!=null&&Object.prototype.hasOwnProperty.call(motionLabels,patch.motion)){scene.motion=patch.motion;if(group)for(const ci of group.cueIndices)delete cues[ci].motion;}
    if(patch.transition!=null&&Object.prototype.hasOwnProperty.call(transitionLabels,patch.transition)){scene.transition=patch.transition;if(group)for(const ci of group.cueIndices)delete cues[ci].transition;}
    if(patch.transform){const t=CutRenderer.transform(scene.transform),p=patch.transform;scene.transform=CutRenderer.transform({
      scale:p.scale!=null?Number(p.scale)/100:t.scale,
      x:p.x!=null?Number(p.x)/100:t.x,
      y:p.y!=null?Number(p.y)/100:t.y
    });if(group)for(const ci of group.cueIndices)delete cues[ci].transform;}
    if(scene.type==='video'){
      let trimChanged=false;
      if(patch.trimStart!=null){scene.trimStart=Math.max(0,Math.min((scene.trimEnd??scene.sourceDuration)-.04,Number(patch.trimStart)||0));trimChanged=true;}
      if(patch.trimEnd!=null){scene.trimEnd=Math.max((scene.trimStart||0)+.04,Math.min(scene.sourceDuration,Number(patch.trimEnd)||scene.sourceDuration));trimChanged=true;}
      if(patch.mediaMuted!=null)scene.mediaMuted=!!patch.mediaMuted;
      if(patch.mediaVolume!=null)scene.mediaVolume=Math.max(0,Math.min(1,Number(patch.mediaVolume)/100));
      const available=Math.max(0,(scene.trimEnd??scene.sourceDuration)-(scene.trimStart||0));
      if(patch.mediaFadeIn!=null)scene.mediaFadeIn=Math.max(0,Math.min(available,Number(patch.mediaFadeIn)||0));
      if(patch.mediaFadeOut!=null)scene.mediaFadeOut=Math.max(0,Math.min(available,Number(patch.mediaFadeOut)||0));
      if(trimChanged&&group){for(const ci of group.cueIndices){delete cues[ci].trimStart;delete cues[ci].trimEnd;cues[ci].mediaOffset=Math.max(0,cues[ci].start-group.start);}if(group.freeEdit)setSceneGroupDuration(group.firstCueIndex,Math.max(.1,available));}
    }
    renderSceneModel();
    changed();
    return emitSceneUpdated(index);
  };

  const snapAxis=(candidates,threshold)=>{
    let best=null;
    for(const candidate of candidates){
      const distance=Math.abs(candidate.delta);
      if(distance>threshold||best&&distance>=best.distance)continue;
      best={...candidate,distance};
    }
    return best;
  };
  window.CutflowTransformSnap={
    apply({rect,box,transform,thresholdX=10,thresholdY=10,unit='percent'}={}){
      if(!rect||!box||!transform)return {transform,guides:{x:null,y:null}};
      const factor=unit==='normalized'?1:100;
      const x=snapAxis([
        {delta:rect.x-box.x,position:rect.x,kind:'left'},
        {delta:rect.x+rect.w-(box.x+box.w),position:rect.x+rect.w,kind:'right'},
        {delta:rect.x+rect.w/2-(box.x+box.w/2),position:rect.x+rect.w/2,kind:'center'}
      ],Math.max(0,Number(thresholdX)||0));
      const y=snapAxis([
        {delta:rect.y-box.y,position:rect.y,kind:'top'},
        {delta:rect.y+rect.h-(box.y+box.h),position:rect.y+rect.h,kind:'bottom'},
        {delta:rect.y+rect.h/2-(box.y+box.h/2),position:rect.y+rect.h/2,kind:'center'}
      ],Math.max(0,Number(thresholdY)||0));
      return {
        transform:{
          ...transform,
          x:Number(transform.x||0)+(x?x.delta/Math.max(1,rect.w)*factor:0),
          y:Number(transform.y||0)+(y?y.delta/Math.max(1,rect.h)*factor:0)
        },
        guides:{x:x?{position:x.position,kind:x.kind}:null,y:y?{position:y.position,kind:y.kind}:null}
      };
    }
  };

  let structureEditWarningShown=false;
  const confirmStructureEdit=()=>{
    const list=logicalItems();
    if(!audioBuffer||list.every(item=>item.freeEdit)||structureEditWarningShown)return true;
    const ok=confirm('이 프로젝트는 내레이션 기준으로 장면 시간이 생성되었습니다. 장면 순서 변경이나 삭제 시 내레이션과 장면 내용이 어긋날 수 있습니다. 계속할까요?');
    if(ok)structureEditWarningShown=true;
    return ok;
  };

  let transformGestureIndex=-1;
  const beginTransformGesture=index=>{
    const {scene}=sourceForIndex(index);if(!scene||exporting||loading)return false;
    pause();rememberCues();transformGestureIndex=index;return inspect(index);
  };
  const previewTransformGesture=(index,transform={})=>{
    if(index!==transformGestureIndex)return false;
    const {item,scene}=sourceForIndex(index);if(!item||!scene||exporting)return false;
    const current=CutRenderer.transform(scene.transform);
    scene.transform=CutRenderer.transform({
      scale:transform.scale!=null?Number(transform.scale)/100:current.scale,
      x:transform.x!=null?Number(transform.x)/100:current.x,
      y:transform.y!=null?Number(transform.y)/100:current.y
    });
    if(cues.length)for(const ci of item.cueIndices)delete cues[ci].transform;
    dirty=true;
    return inspect(index);
  };
  const commitTransformGesture=index=>{
    if(index!==transformGestureIndex)return false;
    transformGestureIndex=-1;changed();
    return emitSceneUpdated(index);
  };
  const cancelTransformGesture=()=>{transformGestureIndex=-1;};

  window.CutflowScene={
    items:logicalItems,
    state:inspect,
    confirmStructureEdit,
    geometry(index,width,height){
      const {item,scene}=sourceForIndex(index);if(!item||!scene)return null;
      width=Math.max(1,Number(width)||1080);height=Math.max(1,Number(height)||1920);
      const rect=CutRenderer.mediaRect(width,height,$('layoutSelect').value);
      const elapsed=cues.length?Math.max(0,currentTime()-Number(item.start||0)):Math.max(0,CutRenderer.locate(timelineScenes(),currentTime()).elapsed||0);
      const fit=$('layoutSelect').value==='fullscreen'?'cover':$('fitSelect').value;
      const box=CutRenderer.mediaGeometry(scene,elapsed,rect,fit);
      return box?{rect,box,transform:inspect(index)?.transform||null}:null;
    },
    update:patchScene,
    beginTransformGesture,previewTransformGesture,commitTransformGesture,cancelTransformGesture,
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
      }else{const [scene]=scenes.splice(from,1);scenes.splice(to,0,scene);renderScenes();}
      changed();this.select(to);return true;
    },
    remove(index){
      const list=logicalItems();if(exporting||index<0||index>=list.length)return false;pause();
      if(cues.length){
        rememberCues();const group=list[index],removeSet=new Set(group.cueIndices),removed=cues.filter((_,i)=>removeSet.has(i)),sceneId=group.sceneId;cues=cues.filter((_,i)=>!removeSet.has(i));recalcCueTimes();
        if(sceneId&&!cues.some(c=>c.sceneId===sceneId)){const si=scenes.findIndex(s=>s.id===sceneId);if(si>=0)releaseScene(scenes.splice(si,1)[0]);}
        syncSceneOrderToCues();renderSceneModel();
      }else{const [scene]=scenes.splice(index,1);releaseScene(scene);renderSceneModel();}
      offset=Math.min(offset,totalDuration());changed();const next=logicalItems();if(next.length)this.select(Math.min(index,next.length-1));else{jump(0);window.dispatchEvent(new CustomEvent('cutflow-scene',{detail:0}));}return true;
    },
    async split(index,time=currentTime()){
      const list=logicalItems();if(exporting||loading||index<0||index>=list.length)return false;const group=list[index],source=group?.source||scenes[index];if(!source)return false;
      const start=cues.length?group.start:this.start(index),duration=Math.max(.1,cues.length?group.duration:source.duration||0),end=start+duration,splitAt=Number(time);
      if(!Number.isFinite(splitAt)||splitAt<=start+.1||splitAt>=end-.1){toast('장면 안쪽의 원하는 위치로 재생 헤드를 옮긴 뒤 장면 나누기를 눌러 주세요.');return false;}
      pause();loading++;stats();
      try{
        const second=await duplicateScene(source),relative=splitAt-start,sourceIndex=scenes.indexOf(source),oldTrimStart=Number(source.trimStart)||0,oldTrimEnd=Number(source.trimEnd??source.sourceDuration)||0;
        source.duration=relative;second.duration=Math.max(.1,duration-relative);second.transition='cut';
        if(source.type==='video'){
          const sourceSplit=Math.max(oldTrimStart+.04,Math.min(oldTrimEnd-.04,oldTrimStart+relative));
          source.trimEnd=sourceSplit;second.trimStart=sourceSplit;second.trimEnd=oldTrimEnd;
          const oldFadeOut=Number(source.mediaFadeOut)||0;source.mediaFadeOut=0;second.mediaFadeIn=0;second.mediaFadeOut=oldFadeOut;
        }
        scenes.splice(sourceIndex+1,0,second);
        if(cues.length){
          rememberCues();const originalSceneId=source.id;let cutCue=-1;
          for(const ci of group.cueIndices){const c=cues[ci];if(c.start<splitAt-.001&&c.end>splitAt+.001){cutCue=ci;break;}}
          if(cutCue>=0){const cue=cues[cutCue],tail=cloneProjectData(cue);cue.end=splitAt;tail.id=uid();tail.start=splitAt;tail.sceneId=second.id;tail.mediaOffset=0;cues.splice(cutCue+1,0,tail);}
          for(const c of cues){if(c.sceneId===originalSceneId&&c.start>=splitAt-.001){c.sceneId=second.id;c.mediaOffset=Math.max(0,c.start-splitAt);}}
          for(const c of cues){if(c.sceneId===originalSceneId)c.mediaOffset=Math.max(0,c.start-start);}
          renderSceneModel();
        }else renderSceneModel();
        changed();jump(splitAt);this.select(index+1);toast('현재 재생 위치를 기준으로 장면을 두 개로 나눴습니다.');return true;
      }catch(error){toast(`장면을 나누지 못했습니다: ${error.message}`);return false;}finally{loading--;stats();}
    },
    mergeNext(index){
      const list=logicalItems();if(exporting||index<0||index>=list.length-1)return false;const current=list[index],next=list[index+1],a=current?.source||scenes[index],b=next?.source||scenes[index+1];if(!a||!b)return false;
      if(!sameMedia(a,b)){toast('다음 장면과 미디어가 달라 합칠 수 없습니다. 같은 이미지 또는 같은 영상 장면만 합칠 수 있습니다.');return false;}
      if(a.type==='video'&&Math.abs(Number(a.trimEnd??a.sourceDuration)-Number(b.trimStart||0))>.08){toast('같은 영상이라도 원본 구간이 이어져 있지 않아 합칠 수 없습니다.');return false;}
      pause();if(cues.length)rememberCues();
      if(a.type==='video'){a.trimEnd=Number(b.trimEnd??b.sourceDuration)||a.trimEnd;a.mediaFadeOut=b.mediaFadeOut??a.mediaFadeOut;}
      a.duration=Math.max(.1,(current.duration||a.duration||0)+(next.duration||b.duration||0));
      if(cues.length){for(const ci of next.cueIndices){cues[ci].sceneId=a.id;cues[ci].mediaOffset=Math.max(0,cues[ci].start-current.start);}const si=scenes.indexOf(b);if(si>=0){releaseScene(scenes.splice(si,1)[0]);}syncSceneOrderToCues();renderSceneModel();}
      else{const bi=scenes.indexOf(b);if(bi>=0){releaseScene(scenes.splice(bi,1)[0]);}renderSceneModel();}
      changed();this.select(index);toast('다음 장면과 합쳤습니다. 현재 장면의 효과 설정을 유지합니다.');return true;
    },
    async replace(file){
      if(!file)return false;const list=logicalItems(),sceneIndex=this.index(),group=list[sceneIndex],withCues=!!cues.length;const [added]=await addFiles([file],{createFreeCues:false,deferCommit:true});if(!added){toast('장면을 교체하지 못했습니다. 파일을 다시 확인해 주세요.');return false;}if(!audioBuffer&&added.type==='video'&&(added.mediaVolume??0)===0)added.mediaVolume=1;
      if(withCues&&group){
        const previous=scenes.find(s=>s.id===group.sceneId),addedIndex=scenes.indexOf(added),previousIndex=previous?scenes.indexOf(previous):-1;
        if(previous&&previousIndex>=0){
          const keptId=previous.id,sameVideo=previous.type==='video'&&added.type==='video';
          scenes[previousIndex]={...added,id:keptId,duration:group.duration,transform:previous.transform,motion:previous.motion,transition:previous.transition,
            mediaVolume:sameVideo?previous.mediaVolume:added.mediaVolume,mediaMuted:sameVideo?previous.mediaMuted:added.mediaMuted,
            mediaFadeIn:sameVideo?previous.mediaFadeIn:added.mediaFadeIn,mediaFadeOut:sameVideo?previous.mediaFadeOut:added.mediaFadeOut};
          if(addedIndex>=0&&addedIndex!==previousIndex)scenes.splice(scenes.indexOf(added),1);releaseScene(previous);
        }else{group.cueIndices.forEach(ci=>{cues[ci].sceneId=added.id;});}
        renderSceneModel();changed();this.select(sceneIndex);emitSceneUpdated(sceneIndex);return true;
      }else if(group){
        const target=scenes.findIndex(s=>s.id===group.id||s===group);if(target>=0){const previous=scenes[target],sameVideo=previous.type==='video'&&added.type==='video';scenes[target]={...added,id:previous.id,duration:previous.duration,transform:previous.transform,motion:previous.motion,transition:previous.transition,mediaVolume:sameVideo?previous.mediaVolume:added.mediaVolume,mediaMuted:sameVideo?previous.mediaMuted:added.mediaMuted,mediaFadeIn:sameVideo?previous.mediaFadeIn:added.mediaFadeIn,mediaFadeOut:sameVideo?previous.mediaFadeOut:added.mediaFadeOut};scenes.splice(scenes.indexOf(added),1);releaseScene(previous);renderSceneModel();changed();this.select(target);emitSceneUpdated(target);return true;}
      }
      return false;
    }
  };
})();
