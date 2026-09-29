/* v37 timing workspace: narration is the fixed reference, scenes are large ranges, captions are nested ranges. */
(()=>{
  const q=id=>document.getElementById(id);
  let selectedCueId=null,drag=null,raf=0,externalPanel=null;
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
  const setSceneBoundary=(side,value,{commit=true}={})=>{
    const list=sceneItems(),i=sceneIndex(),item=list[i];if(!item||!cues.length)return false;
    value=num(value,side==='start'?item.start:item.end);
    if(side==='start'){
      if(i===0)return false;const prev=list[i-1],min=prev.start+.1,max=item.end-.1;value=clamp(value,min,max);
      rescaleGroup(prev,prev.start,value);rescaleGroup(item,value,item.end);
    }else{
      const next=list[i+1];const min=item.start+.1,max=next?next.end-.1:Math.max(item.start+.1,audioBuffer?.duration||item.end+60);
      value=clamp(value,min,max);rescaleGroup(item,item.start,value);if(next)rescaleGroup(next,value,next.end);
    }
    if(commit){changed();renderCues();window.CutflowScene.select(Math.min(i,sceneItems().length-1));}
    return true;
  };
  const setCaptionBoundary=(leftIndex,value,{commit=true}={})=>{
    const item=sceneItem();if(!item||!item.cueIndices.includes(leftIndex))return false;
    const pos=item.cueIndices.indexOf(leftIndex),rightIndex=item.cueIndices[pos+1];if(rightIndex==null)return false;
    const left=cues[leftIndex],right=cues[rightIndex],min=left.start+.08,max=right.end-.08;value=clamp(num(value,left.end),min,max);
    left.end=value;right.start=value;updateOffsets(item);
    if(commit){changed();renderCues();window.CutflowScene.select(sceneIndex());}
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
    const pos=item.cueIndices.indexOf(sel.index);rememberCues();
    if(side==='start'){
      if(pos===0)setSceneBoundary('start',value,{commit:false});else setCaptionBoundary(item.cueIndices[pos-1],value,{commit:false});
    }else{
      if(pos===item.cueIndices.length-1)setSceneBoundary('end',value,{commit:false});else setCaptionBoundary(sel.index,value,{commit:false});
    }
    changed();renderCues();window.CutflowScene.select(sceneIndex());renderAll();
  };
  function waveform(canvas,start,end){
    if(!canvas)return;const r=canvas.getBoundingClientRect(),dpr=devicePixelRatio||1,w=Math.max(1,Math.round(r.width*dpr)),h=Math.max(1,Math.round(r.height*dpr));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}const ctx=canvas.getContext('2d');ctx.clearRect(0,0,w,h);ctx.fillStyle='#20262d';ctx.fillRect(0,0,w,h);if(!audioBuffer){ctx.fillStyle='#69727e';ctx.font=`${12*dpr}px sans-serif`;ctx.fillText('내레이션 없음',12*dpr,h/2);return;}const data=audioBuffer.getChannelData(0),sr=audioBuffer.sampleRate,duration=end-start;ctx.strokeStyle='#8f9aa7';ctx.lineWidth=Math.max(1,dpr);ctx.beginPath();const columns=Math.max(1,Math.floor(w));for(let x=0;x<columns;x++){const t0=start+(x/columns)*duration,t1=start+((x+1)/columns)*duration,a=Math.max(0,Math.floor(t0*sr)),b=Math.min(data.length,Math.max(a+1,Math.ceil(t1*sr)));let peak=0;const step=Math.max(1,Math.floor((b-a)/8));for(let j=a;j<b;j+=step)peak=Math.max(peak,Math.abs(data[j]||0));const y=peak*h*.44;ctx.moveTo(x,h/2-y);ctx.lineTo(x,h/2+y);}ctx.stroke();}
  function boundsFor(item){const list=sceneItems(),i=sceneIndex(),prev=list[i-1],next=list[i+1];let start=prev?prev.start:Math.max(0,item.start-1),end=next?next.end:item.end+Math.max(1,Math.min(3,(audioBuffer?.duration||item.end+2)-item.end));if(audioBuffer)end=Math.min(Math.max(end,item.end+.5),audioBuffer.duration);if(end<=start)end=start+1;return {start,end};}
  const pct=(t,b)=>((t-b.start)/(b.end-b.start))*100;
  function renderTrack(host,item){
    if(!host||!item){if(host)host.innerHTML='<p class="timing-empty">장면을 먼저 선택해 주세요.</p>';return;}
    const b=boundsFor(item),list=sceneItems(),i=sceneIndex(),prev=list[i-1],next=list[i+1];
    const segs=[{g:prev,n:i},{g:item,n:i+1},{g:next,n:i+2}].filter(x=>x.g).map(({g,n})=>`<div class="timing-scene-block ${g===item?'active':''}" style="left:${pct(g.start,b)}%;width:${Math.max(.5,pct(g.end,b)-pct(g.start,b))}%"><b>장면 ${n}</b><span>${fmt(g.start)}–${fmt(g.end)}</span></div>`).join('');
    const captions=(item.cueIndices||[]).map((ci,k)=>{const c=cues[ci];return `<button type="button" class="timing-caption-block ${c.id===selectedCueId?'active':''}" data-timing-cue="${ci}" style="left:${pct(c.start,b)}%;width:${Math.max(.5,pct(c.end,b)-pct(c.start,b))}%"><b>자막 ${k+1}</b><span>${fmt(c.start)}–${fmt(c.end)}</span></button>`;}).join('');
    const capHandles=(item.cueIndices||[]).slice(0,-1).map(ci=>`<button type="button" class="timing-handle caption" data-boundary-caption="${ci}" style="left:${pct(cues[ci].end,b)}%" aria-label="자막 경계 조절"></button>`).join('');
    host.innerHTML=`<div class="timing-wave"><canvas></canvas><div class="timing-scene-shade" style="left:${pct(item.start,b)}%;width:${pct(item.end,b)-pct(item.start,b)}%"></div><div class="timing-playhead" style="left:${pct(currentTime(),b)}%"></div></div><div class="timing-scenes-track">${segs}<button class="timing-handle scene start" data-boundary-scene="start" style="left:${pct(item.start,b)}%" ${i===0?'disabled':''}></button><button class="timing-handle scene end" data-boundary-scene="end" style="left:${pct(item.end,b)}%"></button></div><div class="timing-captions-track">${captions}${capHandles}</div>`;
    host.dataset.windowStart=b.start;host.dataset.windowEnd=b.end;waveform(host.querySelector('canvas'),b.start,b.end);
  }
  function editorMarkup(item){
    if(!item)return '<p class="timing-empty">타이밍을 조정할 장면을 선택해 주세요.</p>';
    const sel=cueForSelection(item),cue=sel?.cue,pos=sel?item.cueIndices.indexOf(sel.index):-1,count=item.cueIndices.length;
    return `<div class="timing-head"><div><span>TIMING</span><h3>장면 ${sceneIndex()+1}</h3><small>${fmt(item.start)}–${fmt(item.end)}초 · ${fmt(item.end-item.start)}초</small></div><div class="timing-head-actions"><button type="button" data-timing-action="prev-scene" ${sceneIndex()===0?'disabled':''}>‹ 이전 장면</button><button type="button" data-timing-action="next-scene" ${sceneIndex()===sceneItems().length-1?'disabled':''}>다음 장면 ›</button><button type="button" data-timing-action="redistribute" ${count<2?'disabled':''}>✨ 내레이션에 맞춤</button></div></div><div class="timing-grid"><section><h4>장면 시간</h4><div class="timing-fields"><label>시작 (초)<input type="number" step="0.01" data-timing-scene="start" value="${fmt(item.start)}" ${sceneIndex()===0?'readonly':''}></label><label>종료 (초)<input type="number" step="0.01" data-timing-scene="end" value="${fmt(item.end)}"></label></div><p>장면 경계를 바꾸면 앞·뒤 장면과 내부 자막 길이가 자동으로 맞춰집니다.</p></section><section><h4>선택 자막 ${count?`${pos+1}/${count}`:''}</h4>${cue?`<div class="timing-caption-nav"><button type="button" data-timing-action="prev-caption" ${pos<=0?'disabled':''}>‹ 이전</button><button type="button" data-timing-action="play-caption">재생</button><button type="button" data-timing-action="next-caption" ${pos>=count-1?'disabled':''}>다음 ›</button></div><div class="timing-caption-text">${esc(cue.text||'(무자막 구간)')}</div><div class="timing-fields"><label>시작 (초)<input type="number" step="0.01" data-timing-caption="start" value="${fmt(cue.start)}"></label><label>종료 (초)<input type="number" step="0.01" data-timing-caption="end" value="${fmt(cue.end)}"></label></div>`:'<p>자막이 없습니다.</p>'}</section></div>`;
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
  function handleAction(e){const panel=e.target.closest('.timing-panel');if(!panel)return;const cueBtn=e.target.closest('[data-timing-cue]');if(cueBtn){const i=Number(cueBtn.dataset.timingCue);if(cues[i]){selectedCueId=cues[i].id;jump(cues[i].start);renderAll();}return;}
    const action=e.target.closest('[data-timing-action]')?.dataset.timingAction;if(!action)return;
    if(action==='prev-scene')CutflowScene.select(sceneIndex()-1);else if(action==='next-scene')CutflowScene.select(sceneIndex()+1);else if(action==='prev-caption')selectCaption(-1);else if(action==='next-caption')selectCaption(1);else if(action==='play-caption'){const sel=cueForSelection(sceneItem());if(sel){jump(sel.cue.start);play();}}else if(action==='redistribute')redistribute();
  }
  function handleChange(e){if(!e.target.closest('.timing-panel'))return;if(e.target.dataset.timingScene){rememberCues();setSceneBoundary(e.target.dataset.timingScene,e.target.value);renderAll();}else if(e.target.dataset.timingCaption){changeSelectedTime(e.target.dataset.timingCaption,e.target.value);}}
  function startDrag(e){const h=e.target.closest('.timing-handle');if(!h||h.disabled)return;const track=h.closest('.timing-track'),start=num(track.dataset.windowStart),end=num(track.dataset.windowEnd),rect=track.getBoundingClientRect();rememberCues();drag={kind:h.dataset.boundaryScene?'scene':'caption',side:h.dataset.boundaryScene,leftIndex:h.dataset.boundaryCaption!=null?Number(h.dataset.boundaryCaption):null,start,end,rect,pointerId:e.pointerId,scene:sceneIndex()};h.setPointerCapture?.(e.pointerId);e.preventDefault();}
  function moveDrag(e){if(!drag)return;const t=drag.start+clamp((e.clientX-drag.rect.left)/drag.rect.width,0,1)*(drag.end-drag.start);if(drag.kind==='scene')setSceneBoundary(drag.side,t,{commit:false});else setCaptionBoundary(drag.leftIndex,t,{commit:false});changed();renderAll();}
  function endDrag(){if(!drag)return;const idx=Math.min(drag.scene,sceneItems().length-1);drag=null;renderCues();CutflowScene.select(idx);renderAll();}
  document.addEventListener('click',handleAction);
  document.addEventListener('change',handleChange);
  document.addEventListener('pointerdown',startDrag);
  document.addEventListener('pointermove',moveDrag);
  document.addEventListener('pointerup',endDrag);document.addEventListener('pointercancel',endDrag);
  window.addEventListener('cutflow-scene',()=>requestAnimationFrame(renderAll));
  new MutationObserver(()=>requestAnimationFrame(renderAll)).observe(q('nowPlaying'),{childList:true});
  new MutationObserver(()=>requestAnimationFrame(renderAll)).observe(q('cueList'),{childList:true});
  new ResizeObserver(()=>{const panel=visiblePanel();if(panel)renderPanel(panel);}).observe(document.documentElement);
  setInterval(()=>{const panel=visiblePanel();if(!panel)return;const track=panel.querySelector('.timing-track'),line=track?.querySelector('.timing-playhead');if(!track||!line)return;const b={start:num(track.dataset.windowStart),end:num(track.dataset.windowEnd,1)};line.style.left=`${clamp(pct(currentTime(),b),0,100)}%`;},100);
  window.CutflowTiming={
    render:renderAll,setSceneBoundary,setCaptionBoundary,redistribute,
    selectCue(index){if(cues[index]){selectedCueId=cues[index].id;jump(cues[index].start);renderAll();return true;}return false;},
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
