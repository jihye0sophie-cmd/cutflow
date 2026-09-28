/* Desktop presentation only. Reparents original controls; no copied editing model. */
(()=>{
 const q=s=>document.querySelector(s),mq=matchMedia('(min-width:761px)'),slots=new Map();
 let enabled=false,mode='caption',captionOpen=false,signature='',lastIndex=-1;
 const shell=document.createElement('section');shell.id='desktopStudio';shell.className='desktop-only';
 shell.innerHTML=`<div class="desktop-workspace"><div id="desktopPreview"></div><section id="desktopEditor"><header class="desktop-current"><div><span>CURRENT SCENE</span><h1 id="desktopSceneTitle">장면을 추가하세요</h1></div><p id="desktopSceneTime"></p></header><nav id="desktopTabs" aria-label="장면 편집"><button data-tab="caption" aria-pressed="true">자막</button><button data-tab="image" aria-pressed="false">이미지·영상</button></nav><div id="desktopEditorScroll"><button id="desktopReplace">이미지·영상 교체</button><div id="desktopEditorBody"></div><div id="desktopCaption"></div></div></section></div><section id="desktopScenes"><header><strong id="desktopSceneTotal">전체 장면 0</strong><button id="desktopAdd">+ 장면 추가</button></header><div class="desktop-strip-wrap"><button id="desktopStripPrev" aria-label="이전 썸네일">‹</button><div id="desktopStrip" aria-label="전체 장면"></div><button id="desktopStripNext" aria-label="다음 썸네일">›</button></div></section>`;q('.app-shell').prepend(shell);
 const actions=document.createElement('div');actions.className='desktop-only desktop-header-actions';actions.innerHTML='<span id="desktopUndoHost"></span><button id="desktopProjectOpen">⚙ 프로젝트 설정</button><button id="desktopExport">내보내기 ↗</button>';q('.topbar').append(actions);
 const dialog=document.createElement('dialog');dialog.id='desktopProject';dialog.innerHTML='<header><h2>프로젝트 설정</h2><button id="desktopProjectClose" aria-label="프로젝트 설정 닫기">×</button></header><div id="desktopProjectBody"><div id="desktopManage"></div></div>';document.body.append(dialog);
 const nav=document.createElement('div');nav.id='desktopSceneNav';nav.className='desktop-only';nav.innerHTML='<button id="desktopPrev">‹ 이전</button><strong id="desktopSceneCount">장면 0 / 0</strong><button id="desktopNext">다음 ›</button>';q('.preview-panel').append(nav);
 const file=document.createElement('input');file.type='file';file.accept='image/*,video/*';file.hidden=true;document.body.append(file);
 function move(node,target){const marker=document.createComment('desktop-position');node.before(marker);slots.set(node,marker);target.append(node);}
 function activate(){if(enabled||!mq.matches)return;enabled=true;captionOpen=$('captionStylePanel').open;document.body.classList.add('desktop-editor');move(q('.preview-panel'),$('desktopPreview'));[q('.hero'),q('.source-panel'),q('.bgm-panel'),q('.setup-panel'),q('.export-panel')].forEach(n=>move(n,$('desktopProjectBody')));move(q('.timeline-panel'),$('desktopEditorBody'));move($('captionStylePanel'),$('desktopCaption'));move($('undoCuesBtn'),$('desktopUndoHost'));move($('addCueBtn'),$('desktopManage'));move($('clearBtn'),$('desktopManage'));$('captionStylePanel').open=true;signature='';sync();}
 function deactivate(){if(!enabled)return;dialog.close();enabled=false;document.body.classList.remove('desktop-editor');for(const [node,marker] of slots)marker.replaceWith(node);slots.clear();$('captionStylePanel').open=captionOpen;}
 function sync(){
  if(!enabled)return;const list=CutflowScene.items(),i=CutflowScene.index(),item=list[i];
  $('desktopSceneTitle').textContent=item?`장면 ${i+1}`:'장면을 추가하세요';$('desktopSceneCount').textContent=`장면 ${item?i+1:0} / ${list.length}`;$('desktopSceneTotal').textContent=`전체 장면 ${list.length}`;
  const begin=item?CutflowScene.start(i):0,duration=item?(cues.length?item.end-item.start:item.duration):0;$('desktopSceneTime').textContent=item?`${begin.toFixed(2)} – ${(begin+duration).toFixed(2)}초 (${duration.toFixed(2)}초)`:'';
  $('desktopPrev').disabled=!item||i===0||exporting;$('desktopNext').disabled=!item||i===list.length-1||exporting;$('desktopReplace').disabled=!item||loading>0||exporting;$('desktopExport').disabled=$('exportBtn').disabled;
  $('desktopEditor').dataset.mode=mode;
  document.querySelectorAll('.cue-row,.scene-row').forEach(row=>row.classList.toggle('desktop-selected',Number(row.dataset.index)===i));
  const sceneChanged=i!==lastIndex;
  const next=JSON.stringify(list.map((item,j)=>{const {source,duration}=CutflowScene.thumbnail(item,j);return [item.id,source?.thumb,duration]}));
  if(signature!==next){signature=next;$('desktopStrip').innerHTML=list.length?list.map((item,j)=>{const {source,duration}=CutflowScene.thumbnail(item,j);return `<button data-scene="${j}" aria-label="장면 ${j+1} 선택">${source?.thumb?`<img src="${esc(source.thumb)}" alt="">`:'<span>컷 없음</span>'}<b>${String(j+1).padStart(2,'0')}</b><small>${duration.toFixed(1)}초</small></button>`}).join(''):'<p>장면을 추가하거나 프로젝트 설정에서 자동 편집을 시작하세요.</p>';}
  const strip=$('desktopStrip');strip.querySelectorAll('[data-scene]').forEach(b=>{const on=Number(b.dataset.scene)===i;b.setAttribute('aria-current',String(on));if(on&&sceneChanged){const left=b.offsetLeft-strip.offsetLeft;if(left<strip.scrollLeft||left+b.offsetWidth>strip.scrollLeft+strip.clientWidth)strip.scrollTo({left:left-(strip.clientWidth-b.offsetWidth)/2,behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});}});
  if(i!==lastIndex){lastIndex=i;if(cues.length)window.selectStyleCue?.(i);}
  window.syncCaptionStrokeUI?.();
  $('desktopTabs').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tab===mode)));
 }
 $('desktopProjectOpen').onclick=()=>dialog.showModal();$('desktopProjectClose').onclick=()=>dialog.close();dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
 $('desktopExport').onclick=()=>$('exportBtn').click();$('desktopAdd').onclick=()=>$('fileInput').click();$('desktopReplace').onclick=()=>file.click();file.onchange=async()=>{await CutflowScene.replace(file.files[0]);file.value='';sync();};
 $('desktopTabs').onclick=e=>{const tab=e.target.closest('[data-tab]');if(tab){mode=tab.dataset.tab;sync();}};
 $('desktopPrev').onclick=()=>CutflowScene.select(CutflowScene.index()-1);$('desktopNext').onclick=()=>CutflowScene.select(CutflowScene.index()+1);
 $('desktopStrip').onclick=e=>{const b=e.target.closest('[data-scene]');if(b)CutflowScene.select(Number(b.dataset.scene));};
 for(const [id,d] of [['desktopStripPrev',-1],['desktopStripNext',1]])$(id).onclick=()=>$('desktopStrip').scrollBy({left:d*$('desktopStrip').clientWidth*.7,behavior:'smooth'});
 $('desktopStrip').addEventListener('wheel',e=>{const s=$('desktopStrip');if(Math.abs(e.deltaY)>Math.abs(e.deltaX)&&s.scrollWidth>s.clientWidth){const before=s.scrollLeft;s.scrollLeft+=e.deltaY;if(s.scrollLeft!==before)e.preventDefault();}},{passive:false});
 $('cueList').addEventListener('click',e=>{if(!enabled)return;const b=e.target.closest('[data-action="style"],[data-action="jump"]');if(b){e.stopImmediatePropagation();CutflowScene.select(Number(b.closest('[data-index]').dataset.index));if(b.dataset.action==='style'){mode='caption';sync();}}},true);
 window.addEventListener('cutflow-scene',sync);window.addEventListener('cutflow-mobile-activate',deactivate);mq.addEventListener('change',()=>queueMicrotask(()=>mq.matches?activate():deactivate()));
 for(const id of ['cueList','sceneList'])new MutationObserver(sync).observe($(id),{childList:true});
 let previewLabel='';new MutationObserver(()=>{const value=$('nowPlaying').textContent;if(value!==previewLabel){previewLabel=value;sync();}}).observe($('nowPlaying'),{childList:true});
 new MutationObserver(sync).observe($('exportBtn'),{attributes:true,attributeFilter:['disabled']});activate();
})();
