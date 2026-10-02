/* Timing workspace: narration is the fixed reference, scenes are large ranges, captions are nested ranges. */
(()=>{
  const q=id=>document.getElementById(id);
  let selectedCueId=null,drag=null,externalPanel=null,timelineZoom=1,snapEnabled=true,pendingCenter=false,timelineScrollLeft=0,playbackFollowScene=-1;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const num=(n,d=0)=>Number.isFinite(Number(n))?Number(n):d;
  const fmt=n=>num(n).toFixed(2);
  const sceneItems=()=>window.CutflowScene?.items?.()||[];
  const sceneIndex=()=>window.CutflowScene?.index?.()||0;
  const displaySceneIndex=()=>window.CutflowPlayer?.state?.().playing&&playbackFollowScene>=0?playbackFollowScene:sceneIndex();
  const sceneItem=()=>sceneItems()[displaySceneIndex()]||null;
  const cueIndices=item=>item?.cueIndices||[];
  const cueForSelection=item=>{
    if(!item||!cues?.length)return null;
    let idx=cues.findIndex(c=>c.id===selectedCueId);
    if(!item.cueIndices.includes(idx))idx=window.CutflowScene?.cueIndex?.(sceneIndex())??item.firstCueIndex;
    idx=item.cueIndices.includes(idx)?idx:item.firstCueIndex;
    const cue=cues[idx];if(cue)selectedCueId=cue.id;return {cue,index:idx};
  };
  const updateOffsets=item=>{
    if(!item?.sceneId)return;
    const group=sceneItems().find(g=>g.sceneId===item.sceneId)||item;
    const start=group.start;
    for(const ci of group.cueIndices||[]){const c=cues[ci];if(c)c.mediaOffset=Math.max(0,c.start-start);}
    const scene=scenes.find(s=>s.id===item.sceneId);if(scene)scene.duration=Math.max(.1,group.end-group.start);
  };
  const rescaleGroup=(item,newStart,newEnd)=>{
    if(!item?.cueIndices?.length)return;
    const oldStart=item.start,oldEnd=item.end,oldDur=Math.max(.001,oldEnd-oldStart),newDur=Math.max(.1,newEnd-newStart);
    const list=item.cueIndices.map(i=>cues[i]).filter(Boolean);
    list.forEach((c,k)=>{
      const rs=(c.start-oldStart)/oldDur,re=(c.end-oldStart)/oldDur;
      c.start=k===0?newStart:newStart+rs*newDur;
      c.end=k===list.length-1?newEnd:newStart+re*newDur;
    });
    for(let k=1;k<list.length;k++){const boundary=(list[k-1].end+list[k].start)/2;list[k-1].end=boundary;list[k].start=boundary;}
    updateOffsets({...item,start:newStart,end:newEnd});
  };
  const commitTimingMutation=targetScene=>{
    changed();renderCues();
    if(Number.isInteger(targetScene)&&targetScene>=0)window.CutflowScene.select(targetScene);
    else requestRenderAll();
  };
  const setSceneBoundaryAt=(i,side,value,{commit=true}={})=>{
    const list=sceneItems(),item=list[i];if(!item||!cues.length)return false;
    value=num(value,side==='start'?item.start:item.end);
    if(side==='start'){
      if(i===0)return false;const prev=list[i-1],min=prev.start+.1,max=item.end-.1;value=clamp(value,min,max);
      rescaleGroup(prev,prev.start,value);rescaleGroup(item,value,item.end);
    }else{
      const next=list[i+1],min=item.start+.1,max=next?next.end-.1:Math.max(item.start+.1,audioBuffer?.duration||item.end+60);
      value=clamp(value,min,max);rescaleGroup(item,item.start,value);if(next)rescaleGroup(next,value,next.end);
    }
    if(commit)commitTimingMutation(Math.min(i,sceneItems().length-1));
    return true;
  };
  const setSceneBoundary=(side,value,options)=>setSceneBoundaryAt(sceneIndex(),side,value,options);
  const setCaptionBoundary=(leftIndex,value,{commit=true}={})=>{
    const items=sceneItems(),item=items.find(g=>g?.cueIndices?.includes(leftIndex));if(!item)return false;
    const pos=item.cueIndices.indexOf(leftIndex),rightIndex=item.cueIndices[pos+1];if(rightIndex==null)return false;
    const left=cues[leftIndex],right=cues[rightIndex],min=left.start+.08,max=right.end-.08;value=clamp(num(value,left.end),min,max);
    left.end=value;right.start=value;updateOffsets(item);
    if(commit)commitTimingMutation(items.indexOf(item));
    return true;
  };
  const setCaptionEdge=(cueIndex,side,value,{commit=true}={})=>{
    const items=sceneItems(),item=items.find(g=>g?.cueIndices?.includes(cueIndex)),cue=cues[cueIndex];if(!item||!cue)return false;
    const si=items.indexOf(item),pos=item.cueIndices.indexOf(cueIndex),prevIndex=item.cueIndices[pos-1],nextIndex=item.cueIndices[pos+1];
    if(side==='start'){
      const min=prevIndex!=null?Math.max(item.start,cues[prevIndex].end):item.start,max=cue.end-.08;
      cue.start=clamp(num(value,cue.start),min,max);
    }else{
      const min=cue.start+.08,max=nextIndex!=null?Math.min(item.end,cues[nextIndex].start):item.end;
      cue.end=clamp(num(value,cue.end),min,max);
    }
    updateOffsets(item);
    if(commit)commitTimingMutation(Math.max(0,si));
    return true;
  };
  const alignSelectedCaption=()=>{
    const item=sceneItem(),sel=cueForSelection(item);if(!item||!sel||!audioBuffer)return;
    const cue=cues[sel.index],items=sceneItems(),si=items.indexOf(item),pos=item.cueIndices.indexOf(sel.index),prevIndex=item.cueIndices[pos-1],nextIndex=item.cueIndices[pos+1];
    rememberCues();let snapped=0;
    const startMin=prevIndex!=null?Math.max(item.start,cues[prevIndex].end):item.start;
    const startMax=Math.max(startMin,cue.end-.08),startHit=nearestNarrationBoundary(cue.start,startMin,startMax,.8);
    if(startHit!=null){setCaptionEdge(sel.index,'start',startHit,{commit:false});snapped++;}
    const live=cues[sel.index],endMin=live.start+.08;
    const endMax=nextIndex!=null?Math.min(item.end,cues[nextIndex].start):item.end;
    const endHit=nearestNarrationBoundary(live.end,endMin,Math.max(endMin,endMax),.8);
    if(endHit!=null){setCaptionEdge(sel.index,'end',endHit,{commit:false});snapped++;}
    const currentItem=sceneItems().find(g=>g?.cueIndices?.includes(sel.index));if(currentItem)updateOffsets(currentItem);
    commitTimingMutation(Math.max(0,sceneForCueIndex(sel.index)));
    toast(snapped?`선택 자막을 내레이션 쉼 ${snapped}곳에 맞췄습니다.`:'선택 자막 주변에서 가까운 쉼을 찾지 못해 현재 시간을 유지했습니다.');
  };
  const alignAllCaptions=()=>{
    if(!audioBuffer||!cues?.length)return;
    rememberCues();
    const start=Math.max(0,num(cues[0]?.start,0)),end=Math.max(start+.1,num(audioBuffer.duration,timelineDuration()));
    const aligned=window.CutflowTimingAlign?.alignTexts?.(cues.map(c=>c.text||''),start,end,window.CutflowTimingData?.candidates||[]);
    if(!aligned?.boundaries||aligned.boundaries.length!==cues.length+1){toast('전체 자막을 내레이션에 맞추지 못했습니다.');return;}
    cues.forEach((cue,i)=>{cue.start=aligned.boundaries[i];cue.end=aligned.boundaries[i+1];});
    for(const group of sceneItems())updateOffsets(group);
    commitTimingMutation(Math.min(sceneIndex(),Math.max(0,sceneItems().length-1)));
    const matched=(aligned.pauseHits||0)+(aligned.valleyHits||0),fallback=aligned.fallbackCount||0;
    toast(matched?`전체 자막을 내레이션 쉼 ${matched}곳에 맞췄습니다.${fallback?` ${fallback}곳은 문장 길이 기준으로 보정했습니다.`:''}`:'전체 자막을 문장 길이 기준으로 다시 배분했습니다.');
  };
  const redistribute=alignSelectedCaption;
  const changeSelectedTime=(side,value)=>{
    const item=sceneItem(),sel=cueForSelection(item);if(!item||!sel)return;
    rememberCues();setCaptionEdge(sel.index,side,value,{commit:false});commitTimingMutation(sceneForCueIndex(sel.index));
  };
  const timelineRanges=()=>{
    const list=sceneItems();if(cues?.length)return list;
    let cursor=0;return list.map((item,i)=>{const duration=Math.max(.1,num(item?.duration,window.CutflowScene?.state?.(i)?.duration||.1)),start=cursor,end=cursor+duration;cursor=end;return {...item,start,end,duration};});
  };
  const timelineDuration=()=>{
    const list=timelineRanges(),sceneEnd=list.at(-1)?.end||0,cueEnd=cues?.at(-1)?.end||0;
    return Math.max(.1,num(totalDuration?.(),0),num(sceneEnd,0),num(cueEnd,0));
  };
  const sceneIndexAtTime=time=>{
    const list=timelineRanges();if(!list.length)return -1;
    time=num(time,0);
    let index=list.findIndex((item,i)=>time>=num(item.start)&&time<num(item.end)||(i===list.length-1&&Math.abs(time-num(item.end))<.02));
    if(index<0)index=Math.max(0,list.findLastIndex(item=>num(item.start)<=time));
    return clamp(index,0,list.length-1);
  };
  const pctAll=(t,duration)=>clamp((num(t)/Math.max(.1,duration))*100,0,100);
  const tickStep=pps=>pps>=110 ? .5 : pps>=55 ? 1 : pps>=28 ? 2 : 5;
  const sceneForCueIndex=ci=>sceneItems().findIndex(item=>item?.cueIndices?.includes(ci));
  const syncSelectedCueToScene=(index=sceneIndex(),{forceFirst=false}={})=>{
    const item=sceneItems()[index];if(!item?.cueIndices?.length){selectedCueId=null;return -1;}
    const selectedIndex=cues.findIndex(c=>c.id===selectedCueId);
    if(!forceFirst&&item.cueIndices.includes(selectedIndex))return selectedIndex;
    const activeIndex=window.CutflowScene?.cueIndex?.(index);
    const target=!forceFirst&&item.cueIndices.includes(activeIndex)?activeIndex:item.firstCueIndex;
    const cue=cues[target];selectedCueId=cue?.id||null;return cue?target:-1;
  };
  const syncSelectedCueToTime=time=>{
    time=num(time,currentTime());
    const index=(cues||[]).findIndex((cue,i)=>{
      const start=num(cue.start),end=num(cue.end);
      if(time>=start&&time<end)return true;
      return i===cues.length-1&&Math.abs(time-end)<.001;
    });
    if(index<0)return -1;
    selectedCueId=cues[index].id;
    return index;
  };
  const isDesktopTimingTarget=target=>!!target?.closest?.('#desktopTiming');
  const snapCandidates=()=>{
    const values=[0,timelineDuration()];
    for(const item of timelineRanges())values.push(num(item.start),num(item.end));
    for(const cue of cues||[])values.push(num(cue.start),num(cue.end));
    return values.filter(Number.isFinite);
  };
  const snapTime=(value,pps=40*timelineZoom)=>{
    value=clamp(num(value),0,timelineDuration());if(!snapEnabled)return value;
    const threshold=Math.max(.025,8/Math.max(20,pps)),grid=Math.round(value*10)/10;
    let best=Math.abs(grid-value)<=threshold?grid:value,dist=Math.abs(best-value);
    for(const candidate of snapCandidates()){const d=Math.abs(candidate-value);if(d<=threshold&&d<dist){best=candidate;dist=d;}}
    return best;
  };
  function timelineTicks(duration,pps){
    const step=tickStep(pps),out=[];
    for(let t=0;t<=duration+.0001;t+=step){
      const major=Math.abs((t/step)%5)<.001;
      out.push(`<span class="timeline-tick ${major?'major':''}" style="left:${pctAll(t,duration)}%"><i></i><b>${t.toFixed(step<1?1:0)}s</b></span>`);
    }
    if(!out.length||duration%step>.05)out.push(`<span class="timeline-tick major end" style="left:100%"><i></i><b>${duration.toFixed(1)}s</b></span>`);
    return out.join('');
  }
  function waveformMarkup(duration){
    const analysis=window.CutflowTimingData,rms=analysis?.rms,peak=Math.max(.000001,num(analysis?.peak,0));
    if(!rms?.length||!audioBuffer)return '<span class="timing-waveform-empty">내레이션 없음</span>';
    const bars=420,out=[],len=rms.length;
    for(let i=0;i<bars;i++){
      const from=Math.floor(i*len/bars),to=Math.max(from+1,Math.floor((i+1)*len/bars));let amp=0;
      for(let j=from;j<to;j++)amp=Math.max(amp,num(rms[j],0));
      const level=clamp(amp/peak,0,1),h=level<.018?0:Math.min(94,1+Math.pow(level,.88)*93);
      out.push(`<i style="left:${i/bars*100}%;height:${h}%;opacity:${Math.max(.18,Math.min(.96,.28+level*.72))}"></i>`);
    }
    return `<div class="timing-waveform-bars" aria-hidden="true">${out.join('')}</div>`;
  }
  function nearestNarrationBoundary(value,min,max,maxDistance=.7){
    const candidates=window.CutflowTimingData?.candidates||[];let best=null,bestScore=Infinity;
    for(const candidate of candidates){
      const t=num(candidate?.time,NaN);if(!Number.isFinite(t)||t<min||t>max)continue;
      const dist=Math.abs(t-value);if(dist>maxDistance)continue;
      const strength=num(candidate?.strength,0),pauseBonus=candidate?.type==='pause'?.16:0;
      const score=dist-(strength*.18)-pauseBonus;
      if(score<bestScore){bestScore=score;best=t;}
    }
    return best;
  }
  function renderTrack(host,item){
    if(!host)return;
    const list=timelineRanges(),duration=timelineDuration();
    if(!list.length){host.innerHTML='<p class="timing-empty">장면을 먼저 추가해 주세요.</p>';return;}
    const liveScroller=host.querySelector('.timing-scroll');if(liveScroller)timelineScrollLeft=liveScroller.scrollLeft;
    const activeScene=displaySceneIndex(),selectedCue=cues.findIndex(c=>c.id===selectedCueId),selected=cues[selectedCue];
    const pps=40*timelineZoom,canvasWidth=Math.max(320,Math.ceil(duration*pps));
    const scenesMarkup=list.map((g,i)=>`<button type="button" class="timeline-scene-block ${i===activeScene?'active':''}" data-timeline-scene="${i}" style="left:${pctAll(g.start,duration)}%;width:${Math.max(.25,pctAll(g.end,duration)-pctAll(g.start,duration))}%"><b>장면 ${i+1}</b><span>${fmt(g.end-g.start)}s</span></button>`).join('');
    const sceneHandles=list.map((g,i)=>i===0?'':`<button type="button" class="timing-handle scene timeline-scene-handle" data-scene-boundary="${i}" data-boundary-side="start" style="left:${pctAll(g.start,duration)}%" aria-label="장면 ${i} / ${i+1} 경계 조절"></button>`).join('')+
      `<button type="button" class="timing-handle scene timeline-scene-handle end" data-scene-boundary="${list.length-1}" data-boundary-side="end" style="left:${pctAll(list.at(-1).end,duration)}%" aria-label="마지막 장면 종료 조절"></button>`;
    const captionsMarkup=(cues||[]).map((c,i)=>`<button type="button" class="timeline-caption-block ${i===selectedCue?'active':''}" data-timing-cue="${i}" style="left:${pctAll(c.start,duration)}%;width:${Math.max(.25,pctAll(c.end,duration)-pctAll(c.start,duration))}%"><b>${esc((c.text||'자막 '+(i+1)).replace(/\s+/g,' ').slice(0,28))}</b><span>${fmt(c.end-c.start)}s</span></button>`).join('');
    const captionHandles=selected?`<button type="button" class="timing-handle caption timeline-caption-edge start" data-caption-edge="start" data-cue-index="${selectedCue}" style="left:${pctAll(selected.start,duration)}%" aria-label="선택 자막 시작 조절"></button><button type="button" class="timing-handle caption timeline-caption-edge end" data-caption-edge="end" data-cue-index="${selectedCue}" style="left:${pctAll(selected.end,duration)}%" aria-label="선택 자막 종료 조절"></button>`:'';
    host.innerHTML=`
      <div class="timing-toolbar">
        <div class="timing-play-tools">
          <button type="button" data-timing-action="prev-scene" aria-label="이전 장면">‹</button>
          <button type="button" data-timing-action="toggle-play" aria-label="재생 또는 일시정지">▶/Ⅱ</button>
          <button type="button" data-timing-action="next-scene" aria-label="다음 장면">›</button>
          <strong data-timeline-clock>${fmt(currentTime())} / ${fmt(duration)}</strong>
        </div>
        <div class="timing-zoom-tools"><label class="timing-snap-toggle"><input type="checkbox" data-timing-action="snap" ${snapEnabled?'checked':''}> 스냅</label><span>타임라인</span><button type="button" data-timing-action="zoom-out" aria-label="축소">−</button><b>${Math.round(timelineZoom*100)}%</b><button type="button" data-timing-action="zoom-in" aria-label="확대">＋</button></div>
      </div>
      <div class="timing-scroll">
        <div class="timing-canvas" data-timeline-seek style="width:max(100%,${canvasWidth}px)" data-window-start="0" data-window-end="${duration}">
          <div class="timing-ruler">${timelineTicks(duration,pps)}</div>
          <div class="timing-layer timing-waveform-layer"><span class="timing-layer-label">내레이션</span><div class="timing-layer-body">${waveformMarkup(duration)}</div></div>
          <div class="timing-layer timing-scene-layer"><span class="timing-layer-label">장면</span><div class="timing-layer-body">${scenesMarkup}${sceneHandles}</div></div>
          <div class="timing-layer timing-caption-layer"><span class="timing-layer-label">자막</span><div class="timing-layer-body">${captionsMarkup}${captionHandles}</div></div>
          <div class="timing-playhead-area"><div class="timing-playhead" style="left:${pctAll(currentTime(),duration)}%"></div><button type="button" class="timing-playhead-grip" data-timeline-playhead style="left:${pctAll(currentTime(),duration)}%" aria-label="재생 위치 드래그"></button></div>
        </div>
      </div>`;
    host.dataset.windowStart='0';host.dataset.windowEnd=String(duration);
    const scroller=host.querySelector('.timing-scroll');
    if(scroller){
      const maxScroll=Math.max(0,scroller.scrollWidth-scroller.clientWidth);
      if(pendingCenter){
        const focus=selected||list[activeScene],center=focus?((num(focus.start)+num(focus.end))/2)*pps:null;
        if(center!=null)requestAnimationFrame(()=>{timelineScrollLeft=Math.max(0,Math.min(maxScroll,center-scroller.clientWidth/2));scroller.scrollLeft=timelineScrollLeft;});
        pendingCenter=false;
      }else{
        timelineScrollLeft=Math.max(0,Math.min(maxScroll,timelineScrollLeft));
        scroller.scrollLeft=timelineScrollLeft;
      }
      scroller.addEventListener('scroll',()=>{timelineScrollLeft=scroller.scrollLeft;},{passive:true});
    }
  }
  function editorMarkup(item){
    if(!item)return '<p class="timing-empty">타이밍을 조정할 장면을 선택해 주세요.</p>';
    const sel=cueForSelection(item),cue=sel?.cue,pos=sel?item.cueIndices.indexOf(sel.index):-1,count=item.cueIndices.length;
    return `<div class="timing-head"><div><span>TIMING</span><h3>장면 ${displaySceneIndex()+1}</h3><small>${fmt(item.start)}–${fmt(item.end)}초 · ${fmt(item.end-item.start)}초</small></div><div class="timing-head-actions"><button type="button" data-timing-action="align-selected">✨ 선택 자막 맞춤</button><button type="button" data-timing-action="align-all">전체 맞춤</button></div></div><div class="timing-grid timeline-selection-grid"><section><h4>선택 장면</h4><div class="timing-fields"><label>시작 (초)<input type="number" step="0.01" data-timing-scene="start" value="${fmt(item.start)}" ${displaySceneIndex()===0?'readonly':''}></label><label>종료 (초)<input type="number" step="0.01" data-timing-scene="end" value="${fmt(item.end)}"></label><label>길이 (초)<input type="number" min="0.1" step="0.01" data-timing-scene-duration value="${fmt(item.end-item.start)}"></label></div><p>장면 경계를 움직이면 인접 장면과 내부 자막 길이가 함께 맞춰집니다.</p></section><section><h4>선택 자막 ${count?`${pos+1}/${count}`:''}</h4>${cue?`<div class="timing-caption-text">${esc(cue.text||'(무자막 구간)')}</div><div class="timing-fields"><label>시작 (초)<input type="number" step="0.01" data-timing-caption="start" value="${fmt(cue.start)}"></label><label>종료 (초)<input type="number" step="0.01" data-timing-caption="end" value="${fmt(cue.end)}"></label></div>`:'<p>자막이 없습니다.</p>'}</section></div>`;
  }
  function ensureUI(){
    const dt=q('desktopTabs');if(dt&&!dt.querySelector('[data-tab="timing"]')){const b=document.createElement('button');b.type='button';b.dataset.tab='timing';b.textContent='정밀 타이밍';dt.append(b);}
    const de=q('desktopEditor');if(de&&!q('desktopTiming')){const p=document.createElement('section');p.id='desktopTiming';p.className='timing-panel';p.innerHTML='<div class="timing-track"></div><div class="timing-controls"></div>';de.insertBefore(p,q('desktopEditorScroll'));}
  }
  function renderPanel(panel){
    if(!panel)return;
    const verticalOwner=panel.closest('.v42-panel')||panel.closest('#desktopTiming'),verticalScroll=verticalOwner?.scrollTop||0,windowScroll=window.scrollY||0;
    const item=sceneItem(),track=panel.querySelector('.timing-track'),controls=panel.querySelector('.timing-controls');
    renderTrack(track,item);controls.innerHTML=editorMarkup(item);
    requestAnimationFrame(()=>{
      if(verticalOwner)verticalOwner.scrollTop=verticalScroll;
      if(externalPanel===panel&&Math.abs((window.scrollY||0)-windowScroll)>2)window.scrollTo({top:windowScroll,left:0,behavior:'auto'});
    });
  }
  function renderAll(){
    ensureUI();const targets=new Set();
    if(externalPanel?.isConnected)targets.add(externalPanel);
    if(q('desktopEditor')?.dataset.mode==='timing')targets.add(q('desktopTiming'));
    if(!targets.size){const visible=visiblePanel();if(visible)targets.add(visible);}
    targets.forEach(renderPanel);
  }
  let renderAllQueued=false;
  function requestRenderAll(){
    if(renderAllQueued)return;
    renderAllQueued=true;
    requestAnimationFrame(()=>{renderAllQueued=false;renderAll();});
  }
  function visiblePanel(){if(externalPanel?.isConnected)return externalPanel;if(q('desktopEditor')?.dataset.mode==='timing')return q('desktopTiming');return null;}
  function selectSceneRelative(delta){
    const list=sceneItems(),target=clamp(sceneIndex()+delta,0,Math.max(0,list.length-1));if(!list.length||target===sceneIndex())return;
    syncSelectedCueToScene(target,{forceFirst:true});pendingCenter=true;
    window.CutflowScene?.select?.(target);
  }
  function handleAction(e){
    const panel=e.target.closest('.timing-panel');if(!panel)return;
    const sceneBtn=e.target.closest('[data-timeline-scene]');if(sceneBtn){const target=Number(sceneBtn.dataset.timelineScene);syncSelectedCueToScene(target,{forceFirst:true});pendingCenter=true;window.CutflowScene?.select?.(target);return;}
    const cueBtn=e.target.closest('[data-timing-cue]');if(cueBtn){const i=Number(cueBtn.dataset.timingCue);if(cues[i]){selectedCueId=cues[i].id;pendingCenter=true;jump(cues[i].start);requestRenderAll();}return;}
    const action=e.target.closest('[data-timing-action]')?.dataset.timingAction;
    if(action){
      if(action==='prev-scene')selectSceneRelative(-1);
      else if(action==='toggle-play')window.CutflowPlayer?.toggle?.();
      else if(action==='next-scene')selectSceneRelative(1);
      else if(action==='zoom-out'){timelineZoom=clamp(timelineZoom-.25,.5,3);pendingCenter=true;requestRenderAll();}
      else if(action==='zoom-in'){timelineZoom=clamp(timelineZoom+.25,.5,3);pendingCenter=true;requestRenderAll();}
      else if(action==='snap'){snapEnabled=!!e.target.checked;requestRenderAll();}
      else if(action==='align-selected')alignSelectedCaption();
      else if(action==='align-all')alignAllCaptions();
      return;
    }
    const canvas=e.target.closest('[data-timeline-seek]');
    if(canvas&&!e.target.closest('button,input,select,textarea')){
      const body=canvas.querySelector('.timing-scene-layer .timing-layer-body'),rect=(body||canvas).getBoundingClientRect(),duration=timelineDuration(),time=clamp((e.clientX-rect.left)/Math.max(1,rect.width),0,1)*duration,t=snapTime(time);
      jump(t);
      syncSelectedCueToTime(t);
      requestRenderAll();
    }
  }
  function handleChange(e){
    if(!e.target.closest('.timing-panel'))return;
    const input=e.target;
    if(input.matches('input[type="number"]')&&(input.value===''||!Number.isFinite(Number(input.value)))){requestRenderAll();return;}
    if(input.dataset.timingScene){rememberCues();setSceneBoundary(input.dataset.timingScene,input.value);}
    else if(input.hasAttribute('data-timing-scene-duration')){const item=sceneItem();if(item){rememberCues();setSceneBoundary('end',item.start+Math.max(.1,num(input.value,.1)));}}
    else if(input.dataset.timingCaption){changeSelectedTime(input.dataset.timingCaption,input.value);}
  }
  function updatePlayheadFeedback(t){
    const duration=timelineDuration();
    document.querySelectorAll('.timing-panel').forEach(panel=>{
      if(!panel.offsetParent&&panel!==externalPanel)return;
      panel.querySelectorAll('.timing-playhead,.timing-playhead-grip').forEach(el=>el.style.left=`${pctAll(t,duration)}%`);
      const clock=panel.querySelector('[data-timeline-clock]');if(clock)clock.textContent=`${fmt(t)} / ${fmt(duration)}`;
    });
  }
  function updateBoundaryFeedback(){
    const duration=timelineDuration(),list=timelineRanges();
    document.querySelectorAll('.timing-panel').forEach(panel=>{
      if(!panel.offsetParent&&panel!==externalPanel)return;
      list.forEach((g,i)=>{
        const block=panel.querySelector(`[data-timeline-scene="${i}"]`);
        if(block){block.style.left=`${pctAll(g.start,duration)}%`;block.style.width=`${Math.max(.25,pctAll(g.end,duration)-pctAll(g.start,duration))}%`;const s=block.querySelector('span');if(s)s.textContent=`${fmt(g.end-g.start)}s`;}
      });
      (cues||[]).forEach((c,i)=>{
        const block=panel.querySelector(`[data-timing-cue="${i}"]`);
        if(block){block.style.left=`${pctAll(c.start,duration)}%`;block.style.width=`${Math.max(.25,pctAll(c.end,duration)-pctAll(c.start,duration))}%`;const s=block.querySelector('span');if(s)s.textContent=`${fmt(c.end-c.start)}s`;}
      });
    });
  }
  function startDrag(e){
    const playhead=e.target.closest('[data-timeline-playhead]');
    if(playhead){
      const canvas=playhead.closest('.timing-canvas'),body=canvas?.querySelector('.timing-scene-layer .timing-layer-body'),start=num(canvas?.dataset.windowStart,0),end=num(canvas?.dataset.windowEnd,timelineDuration()),rect=(body||canvas)?.getBoundingClientRect();
      if(!canvas||!rect)return;
      drag={kind:'playhead',start,end,rect,pointerId:e.pointerId,scene:sceneIndex(),el:playhead,desktopTiming:isDesktopTimingTarget(playhead)};
      playhead.setPointerCapture?.(e.pointerId);e.preventDefault();return;
    }
    const h=e.target.closest('.timing-handle');
    if(h&&!h.disabled){
      const canvas=h.closest('.timing-canvas'),body=h.closest('.timing-layer-body'),start=num(canvas?.dataset.windowStart,0),end=num(canvas?.dataset.windowEnd,timelineDuration()),rect=(body||canvas)?.getBoundingClientRect();
      if(!canvas||!rect)return;rememberCues();
      if(h.dataset.captionEdge){
        const cueIndex=Number(h.dataset.cueIndex);drag={kind:'caption-edge',cueIndex,side:h.dataset.captionEdge,start,end,rect,pointerId:e.pointerId,scene:sceneForCueIndex(cueIndex),el:h};
      }else if(h.dataset.sceneBoundary!=null){
        drag={kind:'scene',scene:Number(h.dataset.sceneBoundary),side:h.dataset.boundarySide||'start',start,end,rect,pointerId:e.pointerId,el:h};
      }else return;
      h.setPointerCapture?.(e.pointerId);e.preventDefault();return;
    }
    const canvas=e.target.closest('[data-timeline-seek]');
    if(canvas&&!e.target.closest('button,input,select,textarea')){
      if(e.pointerType&&e.pointerType!=='mouse')return;
      const body=canvas.querySelector('.timing-scene-layer .timing-layer-body'),start=num(canvas.dataset.windowStart,0),end=num(canvas.dataset.windowEnd,timelineDuration()),rect=(body||canvas).getBoundingClientRect();
      if(!rect)return;
      const raw=start+clamp((e.clientX-rect.left)/Math.max(1,rect.width),0,1)*(end-start),t=snapTime(raw,40*timelineZoom);
      drag={kind:'playhead',start,end,rect,pointerId:e.pointerId,scene:sceneIndex(),el:canvas,desktopTiming:isDesktopTimingTarget(canvas)};
      jump(t);updatePlayheadFeedback(t);
      canvas.setPointerCapture?.(e.pointerId);e.preventDefault();
    }
  }
  function moveDrag(e){
    if(!drag||e.pointerId!==drag.pointerId)return;
    if(e.cancelable)e.preventDefault();
    const raw=drag.start+clamp((e.clientX-drag.rect.left)/Math.max(1,drag.rect.width),0,1)*(drag.end-drag.start),t=snapTime(raw,40*timelineZoom);
    if(drag.kind==='playhead'){jump(t);updatePlayheadFeedback(t);return;}
    if(drag.kind==='caption-edge')setCaptionEdge(drag.cueIndex,drag.side,t,{commit:false});
    else if(drag.kind==='scene')setSceneBoundaryAt(drag.scene,drag.side,t,{commit:false});
    if(drag.el?.isConnected)drag.el.style.left=`${pctAll(t,timelineDuration())}%`;
    updateBoundaryFeedback();
  }
  function endDrag(e){
    if(!drag||e?.pointerId!=null&&e.pointerId!==drag.pointerId)return;
    if(drag.kind==='playhead'){
      const t=currentTime();
      drag=null;updatePlayheadFeedback(t);
      syncSelectedCueToTime(t);requestRenderAll();
      return;
    }
    const idx=Math.max(0,Math.min(drag.scene,sceneItems().length-1));drag=null;syncSelectedCueToScene(idx);commitTimingMutation(idx);
  }
  document.addEventListener('click',handleAction);
  document.addEventListener('change',handleChange);
  document.addEventListener('pointerdown',startDrag);
  document.addEventListener('pointermove',moveDrag);
  document.addEventListener('pointerup',endDrag);document.addEventListener('pointercancel',endDrag);
  document.addEventListener('lostpointercapture',endDrag,true);
  window.addEventListener('blur',()=>endDrag());
  document.addEventListener('visibilitychange',()=>{if(document.hidden)endDrag();});
  window.addEventListener('cutflow-scene',e=>{const target=Number(e.detail);if(Number.isInteger(target)){syncSelectedCueToScene(target);if(window.CutflowPlayer?.state?.().playing){const time=currentTime(),activeScene=sceneIndexAtTime(time);playbackFollowScene=activeScene>=0?activeScene:target;syncSelectedCueToTime(time);pendingCenter=true;}}requestRenderAll();});
  window.addEventListener('cutflow-scene-updated',requestRenderAll);
  window.addEventListener('cutflow-project-restored',()=>{selectedCueId=null;playbackFollowScene=-1;timelineScrollLeft=0;pendingCenter=true;syncSelectedCueToTime(currentTime());requestRenderAll();});
  new MutationObserver(requestRenderAll).observe(q('cueList'),{childList:true});
  new ResizeObserver(()=>{
    const panel=visiblePanel();if(!panel)return;
    const active=document.activeElement;
    if(active&&panel.contains(active)&&active.matches?.('input,textarea,select,[contenteditable="true"]'))return;
    renderPanel(panel);
  }).observe(document.documentElement);
  function syncPlaybackFrame(){
    const panel=visiblePanel(),playerState=window.CutflowPlayer?.state?.();
    if(panel){
      const time=currentTime();updatePlayheadFeedback(time);
      if(playerState?.playing){
        const activeScene=sceneIndexAtTime(time);
        if(activeScene>=0&&activeScene!==playbackFollowScene){
          playbackFollowScene=activeScene;
          syncSelectedCueToScene(activeScene,{forceFirst:false});
          syncSelectedCueToTime(time);
          pendingCenter=true;
          requestRenderAll();
        }
      }else playbackFollowScene=-1;
    }else if(!playerState?.playing)playbackFollowScene=-1;
    requestAnimationFrame(syncPlaybackFrame);
  }
  requestAnimationFrame(syncPlaybackFrame);
  function selectTimelineCaption(index){
    if(!cues[index])return false;
    selectedCueId=cues[index].id;pendingCenter=true;jump(cues[index].start);requestRenderAll();return true;
  }
  window.CutflowTiming={
    render:renderAll,setSceneBoundary,setCaptionBoundary,redistribute,alignSelectedCaption,alignAllCaptions,
    selectCue(index){return selectTimelineCaption(index);},
    mount(container,index){
      if(!container)return false;externalPanel=container;container.classList.add('timing-panel','v42-timing-panel');container.style.display='block';
      if(!container.querySelector('.timing-track'))container.innerHTML='<div class="timing-track"></div><div class="timing-controls"></div>';
      if(Number.isInteger(index)&&cues[index])selectedCueId=cues[index].id;
      renderPanel(container);return true;
    },
    unmount(container){if(!container||externalPanel===container){externalPanel=null;if(container){container.classList.remove('timing-panel','v42-timing-panel');container.innerHTML='';}}}
  };
  window.addEventListener('cutflow-open-timing',e=>{const index=Number(e.detail?.index);if(Number.isInteger(index))window.CutflowTiming.selectCue(index);});
  requestAnimationFrame(renderAll);
})();
