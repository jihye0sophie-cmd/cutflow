/* Desktop presentation only. Reparents original controls; no copied editing model. */
(()=>{
 const q=s=>document.querySelector(s),mq=matchMedia('(min-width:820px)'),slots=new Map();
 let enabled=false,mode='caption',captionOpen=false,signature='',lastIndex=-1,sceneEdit=false,dragIndex=null,sceneFollowRaf=0;
 const mobileMode=()=>!!(window.CutflowUI?.mobileActive||window.CutflowUI?.isMobileDevice?.());
 const shell=document.createElement('section');shell.id='desktopStudio';shell.className='desktop-only';
 shell.innerHTML=`<div class="desktop-workspace"><div id="desktopPreview"></div><section id="desktopEditor"><header class="desktop-current"><div><span>CURRENT SCENE</span><h1 id="desktopSceneTitle">장면을 추가하세요</h1></div><div class="desktop-current-actions"><p id="desktopSceneTime"></p></div></header><nav id="desktopTabs" aria-label="장면 편집"><button data-tab="caption" aria-pressed="true">자막</button><button data-tab="image" aria-pressed="false">이미지·영상</button><button data-tab="timing" aria-pressed="false">정밀 타이밍</button></nav><section id="desktopTiming" class="timing-panel"><div class="timing-track"></div><div class="timing-controls"></div></section><div id="desktopEditorScroll"><button id="desktopBatchCaptions" class="desktop-caption-batch-open" type="button">전체 자막 편집</button><div id="desktopEditorBody"></div><section id="desktopMediaDetails" class="desktop-media-details"><div id="desktopMediaDetailsBody"></div></section><div id="desktopSceneActions" class="desktop-scene-tools"><strong>장면 관리</strong><div><button id="desktopSceneDelete" type="button" class="danger">장면 삭제</button></div></div><div id="desktopCaption"></div></div></section></div><section id="desktopScenes"><header><strong id="desktopSceneTotal">전체 장면 0</strong><div class="desktop-scene-head-actions"><button id="desktopSceneEdit" type="button" aria-pressed="false">순서 편집</button><button id="desktopAdd">+ 장면 추가</button></div></header><div class="desktop-strip-wrap"><button id="desktopStripPrev" aria-label="이전 썸네일">‹</button><div id="desktopStrip" aria-label="전체 장면"></div><button id="desktopStripNext" aria-label="다음 썸네일">›</button></div></section>`;q('.app-shell').prepend(shell);
 const actions=document.createElement('div');actions.className='desktop-only desktop-header-actions';actions.innerHTML='<button id="desktopSettingsTop" type="button" aria-label="프로젝트 설정" title="프로젝트 설정">⚙</button><button id="desktopOpen" type="button">열기</button><button id="desktopSave" type="button">저장</button><button id="desktopExport" type="button">내보내기 ↗</button>';q('.topbar').append(actions);
 const dialog=document.createElement('dialog');dialog.id='desktopProject';dialog.innerHTML='<header><h2>프로젝트 설정</h2><button id="desktopProjectClose" aria-label="프로젝트 설정 닫기">×</button></header><div id="desktopProjectBody"></div>';document.body.append(dialog);
 const previewTools=document.createElement('div');previewTools.id='desktopPreviewTools';previewTools.className='desktop-only desktop-preview-tools';previewTools.innerHTML='<button id="desktopUndo" type="button" data-cutflow-history="undo" data-history-control="1" aria-label="실행 취소" title="실행 취소 · Ctrl/Cmd+Z">↶</button><button id="desktopRedo" type="button" data-cutflow-history="redo" data-history-control="1" aria-label="다시 실행" title="다시 실행 · Ctrl/Cmd+Shift+Z">↷</button><button id="desktopFullscreen" type="button" aria-label="미리보기 전체화면" title="미리보기 전체화면">⛶</button>';q('.preview-panel').append(previewTools);
 const nav=document.createElement('div');nav.id='desktopSceneNav';nav.className='desktop-only';nav.innerHTML='<button id="desktopPrev">‹ 이전</button><strong id="desktopSceneCount">장면 0 / 0</strong><button id="desktopNext">다음 ›</button>';q('.preview-panel').append(nav);
 const file=document.createElement('input');file.type='file';file.accept='image/*,video/*';file.hidden=true;document.body.append(file);
 function move(node,target){const marker=document.createComment('desktop-position');node.before(marker);slots.set(node,marker);target.append(node);}
 function activate(){if(enabled||!mq.matches||mobileMode())return;enabled=true;captionOpen=$('captionStylePanel').open;document.body.classList.add('desktop-editor');move(q('.preview-panel'),$('desktopPreview'));[q('.hero'),q('.auto-setup'),q('.source-panel'),q('.bgm-panel'),q('.setup-panel'),q('.export-panel')].forEach(n=>move(n,$('desktopProjectBody')));move(q('.timeline-panel'),$('desktopEditorBody'));if($('mediaTransform'))move($('mediaTransform'),$('desktopMediaDetailsBody'));move($('captionStylePanel'),$('desktopCaption'));move($('clearBtn'),q('.hero-actions'));signature='';sync();}
 function deactivate(){if(!enabled)return;dialog.close();enabled=false;document.body.classList.remove('desktop-editor');for(const [node,marker] of slots)marker.replaceWith(node);slots.clear();$('captionStylePanel').open=captionOpen;}

 function stabilizeImageLayout(){
  if(!enabled)return;
  const detailsBody=$('desktopMediaDetailsBody'),transform=$('mediaTransform');
  if(transform&&detailsBody&&transform.parentElement!==detailsBody)detailsBody.append(transform);
  const scroll=$('desktopEditorScroll'),body=$('desktopEditorBody'),actions=$('desktopSceneActions'),details=$('desktopMediaDetails'),caption=$('desktopCaption');
  if(scroll&&body&&actions&&details){
   if(body.nextElementSibling!==details)scroll.insertBefore(details,body.nextSibling);
   if(details.nextElementSibling!==actions)scroll.insertBefore(actions,details.nextSibling);
   if(caption&&actions.nextElementSibling!==caption)scroll.insertBefore(caption,actions.nextSibling);
  }
 }
 function revealCutflowUI(){document.body.classList.remove('cutflow-booting');document.body.classList.add('cutflow-ready');}
function sync(){
  if(!enabled)return;const list=CutflowScene.items(),i=CutflowScene.index(),item=list[i];
  $('desktopSceneTitle').textContent=item?`장면 ${i+1}`:'장면을 추가하세요';$('desktopSceneCount').textContent=`장면 ${item?i+1:0} / ${list.length}`;$('desktopSceneTotal').textContent=`전체 장면 ${list.length}`;
  const begin=item?CutflowScene.start(i):0,duration=item?(cues.length?item.end-item.start:item.duration):0;$('desktopSceneTime').textContent=item?`${begin.toFixed(2)} – ${(begin+duration).toFixed(2)}초 (${duration.toFixed(2)}초)`:'';
  $('desktopPrev').disabled=!item||i===0||exporting;$('desktopNext').disabled=!item||i===list.length-1||exporting;$('desktopExport').disabled=$('exportBtn').disabled;$('desktopSave').disabled=$('projectSaveBtn')?.disabled||false;
  $('desktopSceneDelete').disabled=!item||loading>0||exporting;
  $('desktopEditor').dataset.mode=mode;
  const cueIndex=cues.length?CutflowScene.cueIndex(i):i;
  const selectedCueIndex=cues.length&&mode==='image'?(item?.firstCueIndex??cueIndex):cueIndex;
  document.querySelectorAll('.cue-row,.scene-row').forEach(row=>{const rowIndex=Number(row.dataset.index),selected=cues.length?row.classList.contains('cue-row')&&rowIndex===selectedCueIndex:rowIndex===i;row.classList.toggle('desktop-selected',selected);});
  stabilizeImageLayout();
  // Keep the image/video tab in the practical edit order:
  // media + motion + transition -> always-visible size/position controls -> scene tools.
  // The source cue rows are rebuilt frequently, so create this lightweight
  // replacement control inside the current media block on every sync as needed.
  document.querySelectorAll('.desktop-inline-replace').forEach(button=>button.remove());
  if(mode==='image'&&item){
   const selectedRow=document.querySelector('.cue-row.desktop-selected,.scene-row.desktop-selected');
   const mediaBlock=selectedRow?.querySelector('.editor-media');
   if(mediaBlock){
    const inlineReplace=document.createElement('button');
    inlineReplace.type='button';inlineReplace.className='desktop-inline-replace';inlineReplace.textContent='이미지·영상 교체';
    inlineReplace.disabled=loading>0||exporting;inlineReplace.onclick=()=>file.click();mediaBlock.prepend(inlineReplace);
   }
  }
  const next=JSON.stringify(list.map((item,j)=>{const {source,duration}=CutflowScene.thumbnail(item,j);return [item.id,source?.thumb,duration,source?.motion,(item?.cueIndices||[]).length]}));
  const edit=$('desktopSceneEdit');if(edit){edit.textContent=sceneEdit?'편집 완료':'순서 편집';edit.setAttribute('aria-pressed',String(sceneEdit));}
  const renderKey=next+'|'+sceneEdit;
  if(signature!==renderKey){signature=renderKey;$('desktopStrip').classList.toggle('scene-editing',sceneEdit);$('desktopStrip').innerHTML=list.length?list.map((item,j)=>{const {source,duration}=CutflowScene.thumbnail(item,j);return `<div class="desktop-scene-item" data-desktop-scene-item="${j}" draggable="${sceneEdit}"><button type="button" class="desktop-scene-card" data-scene="${j}" aria-label="장면 ${j+1} 선택">${source?.thumb?`<img src="${esc(source.thumb)}" alt="">`:'<span>컷 없음</span>'}<b>${String(j+1).padStart(2,'0')}</b><small>${duration.toFixed(1)}초</small>${sceneStatus(item,source)}</button>${sceneEdit?`<span class="desktop-scene-drag" aria-hidden="true">⋮⋮</span><div class="desktop-scene-actions"><button type="button" data-scene-move="-1" data-index="${j}" aria-label="장면 ${j+1} 앞으로 이동" ${j===0?'disabled':''}>←</button><button type="button" data-scene-move="1" data-index="${j}" aria-label="장면 ${j+1} 뒤로 이동" ${j===list.length-1?'disabled':''}>→</button><button type="button" class="danger" data-scene-delete="${j}" aria-label="장면 ${j+1} 삭제">×</button></div>`:''}</div>`}).join(''):'<p>장면을 추가하거나 프로젝트 설정에서 자동 편집을 시작하세요.</p>';}
  const strip=$('desktopStrip');strip.querySelectorAll('[data-scene]').forEach(b=>b.setAttribute('aria-current',String(Number(b.dataset.scene)===i)));
  if(item){cancelAnimationFrame(sceneFollowRaf);sceneFollowRaf=requestAnimationFrame(()=>{
   const liveStrip=$('desktopStrip'),active=liveStrip?.querySelector(`[data-scene="${i}"]`);if(!active)return;
   const tile=active.closest('.desktop-scene-item')||active,sr=liveStrip.getBoundingClientRect(),tr=tile.getBoundingClientRect(),pad=10;
   if(tr.left<sr.left+pad||tr.right>sr.right-pad){const delta=(tr.left+tr.width/2)-(sr.left+sr.width/2);liveStrip.scrollTo({left:Math.max(0,liveStrip.scrollLeft+delta),behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});}
  });}
  if(i!==lastIndex){lastIndex=i;if(cues.length&&cueIndex>=0&&mode==='caption')window.selectStyleCue?.(cueIndex);}
  window.syncCaptionStrokeUI?.();
  $('desktopTabs').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tab===mode)));
 }
 let syncQueued=false;
 function requestSync(){if(syncQueued||!enabled)return;syncQueued=true;requestAnimationFrame(()=>{syncQueued=false;sync();});}
 function sceneStatus(item,source){const count=(item?.cueIndices||[]).length;const motion=window.CutflowMotionMeta?.[source?.motion]?.badge||'';return `${count>1?`<span class="scene-status-badge caption-count">${count}</span>`:''}${motion?`<span class="scene-status-badge motion-state">${motion}</span>`:''}`;}
 function canEditStructure(){return CutflowScene.confirmStructureEdit?.()===true;}
 function clearDragState(){dragIndex=null;$('desktopStrip').querySelectorAll('.dragging,.drop-target').forEach(el=>el.classList.remove('dragging','drop-target'));}
 $('desktopSettingsTop').onclick=()=>dialog.showModal();$('desktopOpen').onclick=()=>$('projectOpenBtn').click();$('desktopSave').onclick=()=>$('projectSaveBtn').click();$('desktopProjectClose').onclick=()=>dialog.close();dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
 $('desktopUndo').onclick=()=>window.CutflowHistory?.undo?.();$('desktopRedo').onclick=()=>window.CutflowHistory?.redo?.();
 $('desktopFullscreen').onclick=async()=>{const panel=q('.preview-panel');if(!panel)return;try{if(document.fullscreenElement===panel)await document.exitFullscreen();else if(panel.requestFullscreen)await panel.requestFullscreen();}catch{}};
 document.addEventListener('fullscreenchange',()=>{const b=$('desktopFullscreen'),panel=q('.preview-panel');if(!b||!panel)return;const active=document.fullscreenElement===panel;b.textContent=active?'×':'⛶';b.setAttribute('aria-label',active?'전체화면 닫기':'미리보기 전체화면');b.title=active?'전체화면 닫기':'미리보기 전체화면';});
 $('desktopExport').onclick=()=>{dialog.showModal();requestAnimationFrame(()=>q('.export-panel')?.scrollIntoView({behavior:'smooth',block:'center'}));};$('desktopAdd').onclick=()=>$('fileInput').click();$('desktopSceneEdit').onclick=()=>{sceneEdit=!sceneEdit;signature='';sync();};file.onchange=async()=>{signature='';await CutflowScene.replace(file.files[0]);file.value='';};
 $('desktopTabs').onclick=e=>{const tab=e.target.closest('[data-tab]');if(tab){mode=tab.dataset.tab;sync();if(mode==='timing')requestAnimationFrame(()=>window.CutflowTiming?.render?.());}};
 $('desktopBatchCaptions').onclick=()=>window.CutflowCaptionBatch?.open?.(window.CutflowCaption?.currentIndex?.());
 $('desktopPrev').onclick=()=>CutflowScene.select(CutflowScene.index()-1);$('desktopNext').onclick=()=>CutflowScene.select(CutflowScene.index()+1);
 $('desktopSceneDelete').onclick=()=>{const at=CutflowScene.index();if(!canEditStructure())return;if(confirm(`장면 ${at+1}을 삭제할까요?`)){signature='';CutflowScene.remove(at);}};
 $('desktopStrip').onclick=e=>{
  const move=e.target.closest('[data-scene-move]');if(move){const from=Number(move.dataset.index),to=from+Number(move.dataset.sceneMove);if(canEditStructure()){signature='';CutflowScene.move(from,to);}return;}
  const del=e.target.closest('[data-scene-delete]');if(del){const at=Number(del.dataset.sceneDelete);if(!canEditStructure())return;if(confirm(`장면 ${at+1}을 삭제할까요? 삭제 후 뒤 장면의 시간이 자동으로 다시 계산됩니다.`)){signature='';CutflowScene.remove(at);}return;}
  const b=e.target.closest('[data-scene]');if(b)CutflowScene.select(Number(b.dataset.scene));
 };
 $('desktopStrip').addEventListener('dragstart',e=>{if(!sceneEdit)return;const item=e.target.closest('[data-desktop-scene-item]');if(!item)return;dragIndex=Number(item.dataset.desktopSceneItem);item.classList.add('dragging');e.dataTransfer.effectAllowed='move';try{e.dataTransfer.setData('text/plain',String(dragIndex));}catch{}});
 $('desktopStrip').addEventListener('dragover',e=>{if(!sceneEdit||dragIndex===null)return;const item=e.target.closest('[data-desktop-scene-item]');if(!item)return;e.preventDefault();$('desktopStrip').querySelectorAll('.drop-target').forEach(el=>el.classList.remove('drop-target'));if(Number(item.dataset.desktopSceneItem)!==dragIndex)item.classList.add('drop-target');e.dataTransfer.dropEffect='move';});
 $('desktopStrip').addEventListener('drop',e=>{if(!sceneEdit||dragIndex===null)return;const item=e.target.closest('[data-desktop-scene-item]');if(!item){clearDragState();return;}e.preventDefault();const to=Number(item.dataset.desktopSceneItem),from=dragIndex;clearDragState();if(from!==to&&canEditStructure()){signature='';CutflowScene.move(from,to);}});
 $('desktopStrip').addEventListener('dragend',clearDragState);
 for(const [id,d] of [['desktopStripPrev',-1],['desktopStripNext',1]])$(id).onclick=()=>$('desktopStrip').scrollBy({left:d*$('desktopStrip').clientWidth*.7,behavior:'smooth'});
 $('desktopStrip').addEventListener('wheel',e=>{const s=$('desktopStrip');if(Math.abs(e.deltaY)>Math.abs(e.deltaX)&&s.scrollWidth>s.clientWidth){const before=s.scrollLeft;s.scrollLeft+=e.deltaY;if(s.scrollLeft!==before)e.preventDefault();}},{passive:false});
 $('cueList').addEventListener('click',e=>{if(!enabled)return;const b=e.target.closest('[data-action="style"],[data-action="jump"]');if(!b)return;const cueIndex=Number(b.closest('[data-index]').dataset.index),sceneIndex=CutflowScene.sceneIndexForCue(cueIndex);if(sceneIndex>=0){lastIndex=sceneIndex;window.dispatchEvent(new CustomEvent('cutflow-scene',{detail:sceneIndex}));}if(b.dataset.action==='style'){mode='caption';requestSync();}},true);
 window.addEventListener('cutflow-open-timing',()=>{if(!enabled)return;mode='timing';sync();requestAnimationFrame(()=>$('desktopTiming')?.scrollIntoView({block:'nearest'}));});
 const syncDesktopMode=()=>queueMicrotask(()=>mobileMode()?deactivate():(mq.matches?activate():deactivate()));
 window.addEventListener('cutflow-scene',()=>{requestSync();if(mode==='timing')requestAnimationFrame(()=>window.CutflowTiming?.render?.());});window.addEventListener('cutflow-mobile-activate',deactivate);window.addEventListener('cutflow-mobile-deactivate',syncDesktopMode);
 if(typeof mq.addEventListener==='function')mq.addEventListener('change',syncDesktopMode);else if(typeof mq.addListener==='function')mq.addListener(syncDesktopMode);
 for(const id of ['cueList','sceneList'])new MutationObserver(requestSync).observe($(id),{childList:true});
 window.addEventListener('cutflow-caption-active',requestSync);
 new MutationObserver(requestSync).observe($('exportBtn'),{attributes:true,attributeFilter:['disabled']});syncDesktopMode();requestAnimationFrame(()=>revealCutflowUI());
})();
