/* v37 timing workspace: narration is the fixed reference, scenes are large ranges, captions are nested ranges. */
(()=>{
  const q=id=>document.getElementById(id);
  let selectedCueId=null,drag=null,raf=0,externalPanel=null,timelineZoom=1,snapEnabled=true,pendingCenter=false,lastCenteredCueId=null;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const num=(n,d=0)=>Number.isFinite(Number(n))?Number(n):d;
  const fmt=n=>num(n).toFixed(2);
  const sceneItems=()=>window.CutflowScene?.items?.()||[];
  const sceneIndex=()=>window.CutflowScene?.index?.()||0;
  const sceneItem=()=>sceneItems()[sceneIndex()]||null;
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
    if(commit){changed();renderCues();window.CutflowScene.select(Math.min(i,sceneItems().length-1));}
    return true;
  };
  const setSceneBoundary=(side,value,options)=>setSceneBoundaryAt(sceneIndex(),side,value,options);
  const setCaptionBoundary=(leftIndex,value,{commit=true}={})=>{
    const items=sceneItems(),item=items.find(g=>g?.cueIndices?.includes(leftIndex));if(!item)return false;
    const pos=item.cueIndices.indexOf(leftIndex),rightIndex=item.cueIndices[pos+1];if(rightIndex==null)return false;
    const left=cues[leftIndex],right=cues[rightIndex],min=left.start+.08,max=right.end-.08;value=clamp(num(value,left.end),min,max);
    left.end=value;right.start=value;updateOffsets(item);
    if(commit){changed();renderCues();const si=items.indexOf(item);if(si>=0)window.CutflowScene.select(si);}
    return true;
  };
  const setCaptionEdge=(cueIndex,side,value,{commit=true}={})=>{
    const items=sceneItems(),item=items.find(g=>g?.cueIndices?.includes(cueIndex)),cue=cues[cueIndex];if(!item||!cue)return false;
    const si=items.indexOf(item),pos=item.cueIndices.indexOf(cueIndex);
    if(side==='start'){
      if(pos===0){if(si===0){cue.start=clamp(num(value,cue.start),0,cue.end-.08);updateOffsets(item);}else setSceneBoundaryAt(si,'start',value,{commit:false});}
      else setCaptionBoundary(item.cueIndices[pos-1],value,{commit:false});
    }else{
      if(pos===item.cueIndices.length-1)setSceneBoundaryAt(si,'end',value,{commit:false});
      else setCaptionBoundary(cueIndex,value,{commit:false});
    }
    if(commit){changed();renderCues();window.CutflowScene.select(Math.max(0,si));}
    return true;
  };
  const redistribute=()=>{
    const item=sceneItem();if(!item?.cueIndices?.length)return;
    rememberCues();const list=item.cueIndices.map(i=>cues[i]).filter(Boolean);
    const aligned=window.CutflowTimingAlign?.alignTexts?.(list.map(c=>c.text||''),item.start,item.end,window.CutflowTimingData?.candidates||[]);
    if(aligned?.boundaries?.length===list.length+1){
      list.forEach((c,k)=>{c.start=aligned.boundaries[k];c.end=aligned.boundaries[k+1];});
    }else{
      const duration=item.end-item.start,min=.08,weights=list.map(c=>Math.max(1,(c.text||'').replace(/\s+/g,'').length)),sum=weights.reduce((a,b)=>a+b,0)||1;let cursor=item.start;
      list.forEach((c,k)=>{c.start=cursor;if(k===list.length-1)c.end=item.end;else{const remain=list.length-k-1;c.end=Math.min(item.end-remain*min,cursor+Math.max(min,duration*weights[k]/sum));}cursor=c.end;});
    }
    updateOffsets(item);changed();renderCues();window.CutflowScene.select(sceneIndex());renderAll();
    const pauseHits=aligned?.pauseHits||0,valleyHits=aligned?.valleyHits||0,fallback=aligned?.fallbackCount||0,matched=pauseHits+valleyHits;
    toast(matched?`내레이션의 자연스러운 쉼 ${matched}곳을 기준으로 자막 싱크를 맞췄습니다.${fallback?` ${fallback}곳은 문장 길이 기준으로 보정했습니다.`:''}`:'뚜렷한 쉼을 찾지 못해 문장 길이 기준으로 자막 시간을 배분했습니다.');
  };
  const changeSelectedTime=(side,value)=>{
    const item=sceneItem(),sel=cueForSelection(item);if(!item||!sel)return;
    rememberCues();setCaptionEdge(sel.index,side,value,{commit:false});changed();renderCues();window.CutflowScene.select(sceneForCueIndex(sel.index));renderAll();
  };
  function waveform(canvas,start,end){
    if(!canvas)return;const r=canvas.getBoundingClientRect(),dpr=devicePixelRatio||1,w=Math.max(1,Math.round(r.width*dpr)),h=Math.max(1,Math.round(r.height*dpr));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}const ctx=canvas.getContext('2d');ctx.clearRect(0,0,w,h);ctx.fillStyle='#20262d';ctx.fillRect(0,0,w,h);if(!audioBuffer){ctx.fillStyle='#69727e';ctx.font=`${12*dpr}px sans-serif`;ctx.fillText('내레이션 없음',12*dpr,h/2);return;}const data=audioBuffer.getChannelData(0),sr=audioBuffer.sampleRate,duration=end-start;ctx.strokeStyle='#8f9aa7';ctx.lineWidth=Math.max(1,dpr);ctx.beginPath();const columns=Math.max(1,Math.floor(w));for(let x=0;x<columns;x++){const t0=start+(x/columns)*duration,t1=start+((x+1)/columns)*duration,a=Math.max(0,Math.floor(t0*sr)),b=Math.min(data.length,Math.max(a+1,Math.ceil(t1*sr)));let peak=0;const step=Math.max(1,Math.floor((b-a)/8));for(let j=a;j<b;j+=step)peak=Math.max(peak,Math.abs(data[j]||0));const y=peak*h*.44;ctx.moveTo(x,h/2-y);ctx.lineTo(x,h/2+y);}ctx.stroke();}
  const timelineDuration=()=>{
    const list=sceneItems(),sceneEnd=list.at(-1)?.end||0,cueEnd=cues?.at(-1)?.end||0;
    return Math.max(.1,num(totalDuration?.(),0),num(sceneEnd,0),num(cueEnd,0));
  };
  const pctAll=(t,duration)=>clamp((num(t)/Math.max(.1,duration))*100,0,100);
  const tickStep=pps=>pps>=110 ? .5 : pps>=55 ? 1 : pps>=28 ? 2 : 5;
  const sceneForCueIndex=ci=>sceneItems().findIndex(item=>item?.cueIndices?.includes(ci));
  function timelineTicks(duration,pps){
    const step=tickStep(pps),out=[];
    for(let t=0;t<=duration+.0001;t+=step){
      const major=Math.abs((t/step)%5)<.001;
      out.push(`<span class="timeline-tick ${major?'major':''}" style="left:${pctAll(t,duration)}%"><i></i><b>${t.toFixed(step<1?1:0)}s</b></span>`);
    }
    if(!out.length||duration%step>.05)out.push(`<span class="timeline-tick major end" style="left:100%"><i></i><b>${duration.toFixed(1)}s</b></span>`);
    return out.join('');
  }
  function renderTrack(host,item){
    if(!host){return;}
    const list=sceneItems(),duration=timelineDuration();
    if(!list.length){host.innerHTML='<p class="timing-empty">장면을 먼저 추가해 주세요.</p>';return;}
    const previousScroll=host.querySelector('.timing-scroll')?.scrollLeft||0;
    const activeScene=sceneIndex(),selectedCue=cues.findIndex(c=>c.id===selectedCueId);
    const pps=40*timelineZoom,canvasWidth=Math.max(320,Math.ceil(duration*pps));
    const scenesMarkup=list.map((g,i)=>`<button type="button" class="timeline-scene-block ${i===activeScene?'active':''}" data-timeline-scene="${i}" style="left:${pctAll(g.start,duration)}%;width:${Math.max(.25,pctAll(g.end,duration)-pctAll(g.start,duration))}%"><b>장면 ${i+1}</b><span>${fmt(g.end-g.start)}s</span></button>`).join('');
    const captionsMarkup=(cues||[]).map((c,i)=>`<button type="button" class="timeline-caption-block ${i===selectedCue?'active':''}" data-timing-cue="${i}" style="left:${pctAll(c.start,duration)}%;width:${Math.max(.25,pctAll(c.end,duration)-pctAll(c.start,duration))}%"><b>${esc((c.text||'자막 '+(i+1)).replace(/\s+/g,' ').slice(0,28))}</b><span>${fmt(c.end-c.start)}s</span></button>`).join('');
    const captionHandles=list.flatMap(g=>(g.cueIndices||[]).slice(0,-1)).map(ci=>`<button type="button" class="timing-handle caption timeline-caption-handle" data-boundary-caption="${ci}" style="left:${pctAll(cues[ci].end,duration)}%" aria-label="자막 경계 조절"></button>`).join('');
    host.innerHTML=`
      <div class="timing-toolbar">
        <div class="timing-play-tools"><button type="button" data-timing-action="toggle-play">▶/Ⅱ</button><strong data-timeline-clock>${fmt(currentTime())} / ${fmt(duration)}</strong></div>
        <div class="timing-zoom-tools"><span>타임라인</span><button type="button" data-timing-action="zoom-out" aria-label="축소">−</button><b>${Math.round(timelineZoom*100)}%</b><button type="button" data-timing-action="zoom-in" aria-label="확대">＋</button></div>
      </div>
      <div class="timing-scroll">
        <div class="timing-canvas" data-timeline-seek style="width:max(100%,${canvasWidth}px)" data-window-start="0" data-window-end="${duration}">
          <div class="timing-ruler">${timelineTicks(duration,pps)}</div>
          <div class="timing-layer timing-scene-layer"><span class="timing-layer-label">장면</span><div class="timing-layer-body">${scenesMarkup}</div></div>
          <div class="timing-layer timing-caption-layer"><span class="timing-layer-label">자막</span><div class="timing-layer-body">${captionsMarkup}${captionHandles}</div></div>
          <div class="timing-playhead" style="left:${pctAll(currentTime(),duration)}%"></div>
        </div>
      </div>`;
    host.dataset.windowStart='0';host.dataset.windowEnd=String(duration);
    const scroller=host.querySelector('.timing-scroll');if(scroller)scroller.scrollLeft=Math.min(previousScroll,Math.max(0,scroller.scrollWidth-scroller.clientWidth));
  }
  function editorMarkup(item){
    if(!item)return '<p class="timing-empty">타이밍을 조정할 장면을 선택해 주세요.</p>';
    const sel=cueForSelection(item),cue=sel?.cue,pos=sel?item.cueIndices.indexOf(sel.index):-1,count=item.cueIndices.length;
    return `<div class="timing-head"><div><span>TIMING</span><h3>장면 ${sceneIndex()+1}</h3><small>${fmt(item.start)}–${fmt(item.end)}초 · ${fmt(item.end-item.start)}초</small></div><div class="timing-head-actions"><button type="button" data-timing-action="redistribute" ${count<2?'disabled':''}>✨ 내레이션에 맞춤</button></div></div><div class="timing-grid timeline-selection-grid"><section><h4>선택 장면</h4><div class="timing-selection-summary"><b>장면 ${sceneIndex()+1}</b><span>${fmt(item.start)}–${fmt(item.end)}초</span><small>타임라인의 장면 블록을 누르면 선택 위치가 이동합니다.</small></div></section><section><h4>선택 자막 ${count?`${pos+1}/${count}`:''}</h4>${cue?`<div class="timing-caption-text">${esc(cue.text||'(무자막 구간)')}</div><div class="timing-fields"><label>시작 (초)<input type="number" step="0.01" data-timing-caption="start" value="${fmt(cue.start)}"></label><label>종료 (초)<input type="number" step="0.01" data-timing-caption="end" value="${fmt(cue.end)}"></label></div><div class="timing-caption-actions"><button type="button" data-timing-action="play-caption">▶ 선택 자막 재생</button></div>`:'<p>자막이 없습니다.</p>'}</section></div>`;
  }
  function ensureUI(){
    const dt=q('desktopTabs');if(dt&&!dt.querySelector('[data-tab="timing"]')){const b=document.createElement('button');b.type='button';b.dataset.tab='timing';b.textContent='정밀 타이밍';dt.appendChild(b);}
    const de=q('desktopEditor');if(de&&!q('desktopTiming')){const p=document.createElement('section');p.id='desktopTiming';p.className='timing-panel';p.innerHTML='<div class="timing-track"></div><div class="timing-controls"></div>';de.insertBefore(p,q('desktopEditorScroll'));}
    // v41.3: mobile precision timing is a subview of the Caption tab, not a sixth bottom tab.
    const me=q('mobileEditor');if(me&&!q('mobileTiming')){const p=document.createElement('section');p.id='mobileTiming';p.className='timing-panel';p.innerHTML='<div class="timing-track"></div><div class="timing-controls"></div>';me.insertBefore(p,q('mobileEditorBody'));}
  }
  function renderPanel(panel){if(!panel)return;const item=sceneItem(),track=panel.querySelector('.timing-track'),controls=panel.querySelector('.timing-controls');renderTrack(track,item);controls.innerHTML=editorMarkup(item);}
  function renderAll(){ensureUI();renderPanel(q('desktopTiming'));renderPanel(q('mobileTiming'));}
  function visiblePanel(){if(externalPanel?.isConnected)return externalPanel;if(q('desktopEditor')?.dataset.mode==='timing')return q('desktopTiming');if(q('mobileEditor')?.dataset.mode==='timing')return q('mobileTiming');return null;}
  function selectCaption(delta){const item=sceneItem(),sel=cueForSelection(item);if(!item||!sel)return;const pos=item.cueIndices.indexOf(sel.index),target=item.cueIndices[clamp(pos+delta,0,item.cueIndices.length-1)],cue=cues[target];if(cue){selectedCueId=cue.id;jump(cue.start);renderAll();}}
  function handleAction(e){
    const panel=e.target.closest('.timing-panel');if(!panel)return;
    const sceneBtn=e.target.closest('[data-timeline-scene]');if(sceneBtn){window.CutflowScene?.select?.(Number(sceneBtn.dataset.timelineScene));renderAll();return;}
    const cueBtn=e.target.closest('[data-timing-cue]');if(cueBtn){const i=Number(cueBtn.dataset.timingCue);if(cues[i]){selectedCueId=cues[i].id;jump(cues[i].start);renderAll();}return;}
    const action=e.target.closest('[data-timing-action]')?.dataset.timingAction;
    if(action){
      if(action==='toggle-play')window.CutflowPlayer?.toggle?.();
      else if(action==='zoom-out'){timelineZoom=clamp(timelineZoom-.25,.5,3);renderAll();}
      else if(action==='zoom-in'){timelineZoom=clamp(timelineZoom+.25,.5,3);renderAll();}
      else if(action==='play-caption'){const sel=cueForSelection(sceneItem());if(sel){jump(sel.cue.start);play();}}
      else if(action==='redistribute')redistribute();
      return;
    }
    const canvas=e.target.closest('[data-timeline-seek]');
    if(canvas&&!e.target.closest('button,input,select,textarea')){
      const rect=canvas.getBoundingClientRect(),duration=timelineDuration(),time=clamp((e.clientX-rect.left)/rect.width,0,1)*duration;
      jump(time);renderAll();
    }
  }
  function handleChange(e){if(!e.target.closest('.timing-panel'))return;if(e.target.dataset.timingScene){rememberCues();setSceneBoundary(e.target.dataset.timingScene,e.target.value);renderAll();}else if(e.target.dataset.timingCaption){changeSelectedTime(e.target.dataset.timingCaption,e.target.value);}}
  function startDrag(e){
    const h=e.target.closest('.timing-handle');if(!h||h.disabled)return;
    const canvas=h.closest('.timing-canvas'),start=num(canvas?.dataset.windowStart,0),end=num(canvas?.dataset.windowEnd,timelineDuration()),rect=canvas?.getBoundingClientRect();
    if(!canvas||!rect)return;rememberCues();
    const leftIndex=h.dataset.boundaryCaption!=null?Number(h.dataset.boundaryCaption):null;
    drag={kind:'caption',leftIndex,start,end,rect,pointerId:e.pointerId,scene:sceneForCueIndex(leftIndex)};
    h.setPointerCapture?.(e.pointerId);e.preventDefault();
  }
  function moveDrag(e){if(!drag)return;const t=drag.start+clamp((e.clientX-drag.rect.left)/drag.rect.width,0,1)*(drag.end-drag.start);setCaptionBoundary(drag.leftIndex,t,{commit:false});changed();renderAll();}
  function endDrag(){if(!drag)return;const idx=Math.max(0,Math.min(drag.scene,sceneItems().length-1));drag=null;renderCues();CutflowScene.select(idx);renderAll();}
  document.addEventListener('click',handleAction);
  document.addEventListener('change',handleChange);
  document.addEventListener('pointerdown',startDrag);
  document.addEventListener('pointermove',moveDrag);
  document.addEventListener('pointerup',endDrag);document.addEventListener('pointercancel',endDrag);
  window.addEventListener('cutflow-scene',()=>requestAnimationFrame(renderAll));
  new MutationObserver(()=>requestAnimationFrame(renderAll)).observe(q('nowPlaying'),{childList:true});
  new MutationObserver(()=>requestAnimationFrame(renderAll)).observe(q('cueList'),{childList:true});
  new ResizeObserver(()=>{const panel=visiblePanel();if(panel)renderPanel(panel);}).observe(document.documentElement);
  setInterval(()=>{const panel=visiblePanel();if(!panel)return;const track=panel.querySelector('.timing-track'),line=track?.querySelector('.timing-playhead'),clock=track?.querySelector('[data-timeline-clock]');if(!track||!line)return;const duration=timelineDuration();line.style.left=`${pctAll(currentTime(),duration)}%`;if(clock)clock.textContent=`${fmt(currentTime())} / ${fmt(duration)}`;},100);
  window.CutflowTimeline={
    state(){return {duration:timelineDuration(),currentTime:currentTime(),zoom:timelineZoom,sceneIndex:sceneIndex(),selectedCueIndex:cues.findIndex(c=>c.id===selectedCueId),sceneCount:sceneItems().length,captionCount:cues.length};},
    setZoom(value){timelineZoom=clamp(num(value,1),.5,3);renderAll();return this.state();},
    seek(time){jump(clamp(num(time),0,timelineDuration()));renderAll();return this.state();},
    selectScene(index){window.CutflowScene?.select?.(index);renderAll();return this.state();},
    selectCaption(index){if(cues[index]){selectedCueId=cues[index].id;jump(cues[index].start);renderAll();return true;}return false;},
    render:renderAll
  };
  window.CutflowTiming={
    render:renderAll,setSceneBoundary,setCaptionBoundary,redistribute,
    selectCue(index){return window.CutflowTimeline.selectCaption(index);},
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
