/* v41 mobile presentation adapter. Desktop controls/events/project data remain authoritative. */
(()=>{
  const mq=matchMedia('(max-width:760px)');
  let enabled=false,index=0,selectedId=null,mode='caption',lastEditMode='caption',hadMedia=false,lastStroke=15,captionWasOpen=false,sceneEdit=false,narrationSceneWarningShown=false;
  const slots=new Map(),q=s=>document.querySelector(s);

  const shell=document.createElement('section');
  shell.id='mobileStudio';shell.className='mobile-only';
  shell.innerHTML=`
    <div id="mobilePreview"></div>
    <section id="mobileSceneStripWrap" aria-label="장면 바로가기">
      <div id="mobileSceneStrip"></div><button id="mobileStripAdd" type="button" aria-label="장면 추가">＋</button>
    </section>
    <nav id="mobileTools" aria-label="모바일 편집 도구"></nav>
    <div id="mobileEditor">
      <p id="mobileEmpty">장면을 추가하면 이미지·영상과 자막을 직접 편집할 수 있습니다.</p>
      <div id="mobileSceneActions" class="mobile-scene-tools"><strong>장면 편집</strong><div><button id="mobileSceneSplit" type="button">나누기</button><button id="mobileSceneMerge" type="button">다음과 합치기</button><button id="mobileSceneDelete" type="button" class="danger">삭제</button></div><small>나누기는 현재 재생 위치 기준</small></div>
      <div id="mobileEditorBody"></div>
    </div>`;
  q('.app-shell').prepend(shell);

  const nav=q('#mobileTools');
  nav.innerHTML=[
    ['caption','T','자막'],['media','▧','미디어'],['narration','🎙','내레이션'],['template','Aa','템플릿'],['bgm','♪','BGM']
  ].map(([key,icon,name])=>`<button type="button" data-mobile-tab="${key}" aria-pressed="${key==='caption'}"><span aria-hidden="true">${icon}</span>${name}</button>`).join('');

  const mobileNav=document.createElement('div');
  mobileNav.id='mobileSceneNav';mobileNav.className='mobile-only';
  mobileNav.innerHTML='<button id="mobilePrev" type="button" aria-label="이전 장면">‹</button><strong id="mobileSceneCount">장면 0 / 0</strong><button id="mobileNext" type="button" aria-label="다음 장면">›</button>';
  q('.preview-panel').append(mobileNav);

  const openButton=document.createElement('button');openButton.id='mobileOpen';openButton.className='mobile-only';openButton.type='button';openButton.textContent='열기';q('.topbar').append(openButton);
  const saveButton=document.createElement('button');saveButton.id='mobileSave';saveButton.className='mobile-only';saveButton.type='button';saveButton.textContent='저장';q('.topbar').append(saveButton);
  const exportButton=document.createElement('button');exportButton.id='mobileExport';exportButton.className='mobile-only';exportButton.type='button';exportButton.textContent='내보내기';q('.topbar').append(exportButton);

  const outputDialog=document.createElement('dialog');outputDialog.id='mobileOutputDialog';outputDialog.className='mobile-only';outputDialog.innerHTML='<div class="mobile-output-head"><strong>영상 내보내기</strong><button id="mobileOutputClose" type="button" aria-label="닫기">×</button></div><div id="mobileOutputBody"></div>';document.body.append(outputDialog);

  const silenceBox=document.createElement('section');silenceBox.id='mobileSilenceCut';silenceBox.className='mobile-only mobile-silence-cut';silenceBox.innerHTML=`<div class="mobile-section-title"><strong>내레이션 무음컷</strong><span>원본 유지 · 처리본 사용</span></div><div class="mobile-silence-presets" role="radiogroup" aria-label="무음 제거 강도"><label><input type="radio" name="mobileSilencePreset" value="soft"><span>부드럽게</span></label><label><input type="radio" name="mobileSilencePreset" value="normal" checked><span>보통</span></label><label><input type="radio" name="mobileSilencePreset" value="tight"><span>타이트</span></label></div><button id="mobileSilenceRun" type="button" class="button secondary wide">현재 내레이션 무음 줄이기</button><p id="mobileSilenceStatus" class="field-help">기본 강도: 보통</p>`;

  const replaceButton=document.createElement('button');replaceButton.id='mobileReplace';replaceButton.type='button';replaceButton.textContent='이미지·영상 교체';replaceButton.className='mobile-only';
  const replaceInput=document.createElement('input');replaceInput.type='file';replaceInput.accept='image/*,video/*';replaceInput.hidden=true;document.body.append(replaceInput);

  const strokeToggle=document.createElement('label');strokeToggle.className='mobile-only mobile-stroke-toggle';strokeToggle.innerHTML='<input id="mobileCaptionStroke" type="checkbox"> 스트로크 사용';$('captionStroke').closest('label').before(strokeToggle);

  function move(node,target){if(!node)return;if(!slots.has(node)){const marker=document.createComment('mobile-original-position');node.before(marker);slots.set(node,marker);}target.append(node);}
  function items(){return CutflowScene.items();}
  function select(i){if(!enabled)return;const list=items();if(i<0||i>=list.length)return;CutflowScene.select(i);}
  function setTab(tab){const active=tab==='timing'?'caption':tab;nav.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mobileTab===active)));}

  function sceneStatus(item){const count=(item?.cueIndices||[]).length;const motion={zoomIn:'Z+',zoomOut:'Z−',panLeft:'←',panRight:'→',panUp:'↑',panDown:'↓',still:'●'}[item?.motion]||'';return `${count>1?`<span class="mobile-scene-badge caption-count">${count}</span>`:''}${motion?`<span class="mobile-scene-badge motion-state">${motion}</span>`:''}`;}
  function buildStrip(){
    const list=items(),strip=$('mobileSceneStrip');
    strip.innerHTML=list.map((item,i)=>{const {source,duration}=CutflowScene.thumbnail(item,i);return `<button type="button" class="mobile-strip-card" data-mobile-strip="${i}" aria-current="${i===index?'true':'false'}" aria-label="장면 ${i+1}">${source?.thumb?`<img src="${esc(source.thumb)}" alt="">`:'<span class="mobile-strip-missing">${i+1}</span>'}<b>${String(i+1).padStart(2,'0')}</b><small>${duration.toFixed(1)}s</small>${sceneStatus(item)}</button>`}).join('');
    requestAnimationFrame(()=>{const active=strip.querySelector('[aria-current="true"]');if(!active)return;const sr=strip.getBoundingClientRect(),ar=active.getBoundingClientRect();if(ar.left<sr.left||ar.right>sr.right){strip.scrollTo({left:Math.max(0,strip.scrollLeft+(ar.left+ar.width/2)-(sr.left+sr.width/2)),behavior:'smooth'});}});
  }


  function confirmNarrationSceneEdit(){
    if(!audioBuffer||items().every(item=>item.freeEdit)||narrationSceneWarningShown)return true;
    const ok=confirm('이 프로젝트는 내레이션 기준으로 장면 시간이 생성되었습니다. 장면 순서 변경이나 삭제 시 내레이션과 장면 내용이 어긋날 수 있습니다. 계속할까요?');
    if(ok)narrationSceneWarningShown=true;return ok;
  }

  function syncStroke(){const n=Number($('captionStroke').value);$('mobileCaptionStroke').checked=n>0;if(n>0)lastStroke=n;}
  window.syncCaptionStrokeUI=syncStroke;
  $('captionStylePanel').addEventListener('input',()=>queueMicrotask(syncStroke));
  $('captionStylePanel').addEventListener('change',()=>queueMicrotask(syncStroke));

  function sync(){
    if(!enabled)return;
    const list=items(),found=list.findIndex(item=>item.id===selectedId);
    index=found>=0?found:Math.min(index,Math.max(0,list.length-1));selectedId=list[index]?.id||null;
    $('mobileSceneCount').textContent=`장면 ${list.length?index+1:0} / ${list.length}`;
    $('mobilePrev').disabled=!list.length||index===0||exporting;$('mobileNext').disabled=!list.length||index===list.length-1||exporting;
    exportButton.disabled=$('exportBtn').disabled;saveButton.disabled=$('projectSaveBtn')?.disabled||false;replaceButton.disabled=!list.length||loading>0||exporting;
    $('mobileSceneSplit').disabled=!list.length||loading>0||exporting;$('mobileSceneMerge').disabled=!list.length||index>=list.length-1||loading>0||exporting;$('mobileSceneDelete').disabled=!list.length||loading>0||exporting;
    $('mobileEmpty').hidden=!!list.length;
    if(!['caption','media','narration','template','bgm','timing'].includes(mode))mode='caption';
    $('mobileEditor').dataset.mode=mode;
    setTab(mode);
    const cueIndex=cues.length?CutflowScene.cueIndex(index):index;
    const selectedCueIndex=cues.length&&['media','motion'].includes(mode)?(list[index]?.firstCueIndex??cueIndex):cueIndex;
    document.querySelectorAll('.cue-row,.scene-row').forEach(row=>{const rowIndex=Number(row.dataset.index),on=cues.length?row.classList.contains('cue-row')&&rowIndex===selectedCueIndex:rowIndex===index;row.classList.toggle('mobile-selected',on);row.draggable=false;const fold=row.querySelector('.mobile-caption-text');if(fold)fold.replaceWith(...Array.from(fold.children).filter(n=>n.tagName!=='SUMMARY'));});
    buildStrip();
    if(mode==='caption'&&cues.length&&cueIndex>=0){window.selectStyleCue?.(cueIndex);}
    $('captionStylePanel').open=mode==='caption'&&$('captionStylePanel').open;
    syncStroke();viewport();
  }

  function activate(){
    if(enabled)return;
    window.dispatchEvent(new Event('cutflow-mobile-activate'));
    index=CutflowScene.index();selectedId=items()[index]?.id;captionWasOpen=$('captionStylePanel').open;enabled=true;document.body.classList.add('mobile-editor');
    move(q('.preview-panel'),$('mobilePreview'));
    move($('scrubber'),q('.player-controls'));
    const controls=q('.player-controls');if(controls&&$('scrubber'))controls.insertBefore($('scrubber'),controls.querySelector('.timecode'));

    move(q('.hero'),$('mobileEditorBody'));
    move(q('.timeline-panel'),$('mobileEditorBody'));
    move($('captionStylePanel'),$('mobileEditorBody'));
    move(q('.source-panel'),$('mobileEditorBody'));q('.source-panel')?.append(silenceBox);
    move(q('.auto-setup'),$('mobileEditorBody'));
    move(q('.setup-panel'),$('mobileEditorBody'));
    move(q('.bgm-panel'),$('mobileEditorBody'));
    move(q('.export-panel'),$('mobileOutputBody'));
    q('.timeline-panel')?.prepend(replaceButton);
    $('captionStylePanel').open=false;
    sync();
  }

  function deactivate(){
    if(!enabled)return;enabled=false;
    document.body.classList.remove('mobile-editor','mobile-compact','mobile-keyboard','mobile-input-focus','mobile-project-open');
    for(const [node,marker] of slots)marker.replaceWith(node);slots.clear();
document.querySelectorAll('.scene-row').forEach(row=>row.draggable=true);document.querySelectorAll('.mobile-caption-text').forEach(fold=>fold.replaceWith(...Array.from(fold.children).filter(n=>n.tagName!=='SUMMARY')));$('captionStylePanel').open=captionWasOpen;
  }

  window.addEventListener('cutflow-scene',e=>{if(enabled){index=e.detail;selectedId=items()[index]?.id;sync();}});
  mq.addEventListener('change',()=>mq.matches?activate():deactivate());
  $('mobilePrev').onclick=()=>select(index-1);$('mobileNext').onclick=()=>select(index+1);
  $('mobileSceneSplit').onclick=async()=>{await CutflowScene.split(index,currentTime());sync();};
  $('mobileSceneMerge').onclick=()=>{if(confirm('다음 장면과 합칠까요? 같은 미디어의 연속 장면만 합칠 수 있습니다.')){CutflowScene.mergeNext(index);sync();}};
  $('mobileSceneDelete').onclick=()=>{if(!confirmNarrationSceneEdit())return;if(confirm(`장면 ${index+1}을 삭제할까요?`)){CutflowScene.remove(index);sync();}};
  openButton.onclick=()=>$('projectOpenBtn').click();
  saveButton.onclick=()=>$('projectSaveBtn').click();exportButton.onclick=()=>{pause();outputDialog.showModal();};$('mobileOutputClose').onclick=()=>outputDialog.close();
  $('mobileStripAdd').onclick=()=>$('fileInput').click();
  $('mobileSceneStrip').onclick=e=>{const target=e.target.closest('[data-mobile-strip]');if(target)select(Number(target.dataset.mobileStrip));};
  $('mobileSilenceRun').onclick=async()=>{const btn=$('mobileSilenceRun'),status=$('mobileSilenceStatus');if(!audioFile){status.textContent='먼저 내레이션 오디오를 불러오세요.';return;}const preset=document.querySelector('input[name="mobileSilencePreset"]:checked')?.value||'normal';btn.disabled=true;try{const result=await window.CutflowSilenceCut.process(audioFile,preset,msg=>status.textContent=msg);await loadAudio(result.processedFile);status.textContent=`완료 · ${result.originalDuration.toFixed(1)}초 → ${result.processedDuration.toFixed(1)}초 · 처리본 사용 중`;window.CutflowProjects?.markDirty?.();}catch(err){status.textContent=`무음컷 실패: ${err.message}`;}finally{btn.disabled=false;}};

  nav.onclick=e=>{const tab=e.target.closest('[data-mobile-tab]')?.dataset.mobileTab;if(!tab)return;lastEditMode=tab;mode=tab;sync();requestAnimationFrame(()=>q('#mobileEditor')?.scrollIntoView({block:'start',behavior:'smooth'}));};


  $('cueList').addEventListener('click',e=>{if(enabled&&e.target.closest('[data-action="style"]')){e.stopImmediatePropagation();mode='caption';$('captionStylePanel').open=true;sync();}},true);
  $('styleCue').addEventListener('change',()=>{if(enabled){const cueIndex=cues.findIndex(c=>c.id===$('styleCue').value),sceneIndex=CutflowScene.sceneIndexForCue(cueIndex);if(sceneIndex>=0){index=sceneIndex;selectedId=items()[index]?.id;}sync();}});
  $('mobileCaptionStroke').oninput=()=>{const control=$('captionStroke');control.value=$('mobileCaptionStroke').checked?lastStroke:0;control.dispatchEvent(new Event('input',{bubbles:true}));};

  replaceButton.onclick=()=>replaceInput.click();
  replaceInput.onchange=async()=>{await CutflowScene.replace(replaceInput.files[0]);replaceInput.value='';};

  // Scene navigation swipe lives on the compact scene bar, avoiding conflicts with media transform gestures on the preview.
  let navTouch=null;
  mobileNav.addEventListener('touchstart',e=>{if(enabled&&e.touches.length===1)navTouch={x:e.touches[0].clientX,y:e.touches[0].clientY};},{passive:true});
  mobileNav.addEventListener('touchend',e=>{if(!navTouch||!enabled)return;const t=e.changedTouches[0],dx=t.clientX-navTouch.x,dy=t.clientY-navTouch.y;navTouch=null;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.5)select(index+(dx<0?1:-1));},{passive:true});
  mobileNav.addEventListener('touchcancel',()=>navTouch=null,{passive:true});

  window.addEventListener('cutflow-open-timing',()=>{if(!enabled)return;lastEditMode='caption';mode='timing';sync();requestAnimationFrame(()=>q('#mobileEditor')?.scrollIntoView({block:'start',behavior:'smooth'}));});

  function viewport(){if(!enabled)return;const vv=window.visualViewport;const height=vv?.height||innerHeight;document.documentElement.style.setProperty('--mobile-visible-height',height+'px');document.documentElement.style.setProperty('--mobile-keyboard-offset',Math.max(0,innerHeight-height-(vv?.offsetTop||0))+'px');document.body.classList.toggle('mobile-keyboard',height<innerHeight*.75);}
  document.addEventListener('focusin',()=>{if(enabled){document.body.classList.toggle('mobile-input-focus',document.activeElement.matches('textarea,input[type=number],input[type=text],input:not([type])'));viewport();}});
  document.addEventListener('focusout',()=>{if(enabled)requestAnimationFrame(()=>{document.body.classList.toggle('mobile-input-focus',document.activeElement.matches('textarea,input[type=number],input[type=text],input:not([type])'));viewport();});});
  window.visualViewport?.addEventListener('resize',viewport);window.addEventListener('resize',viewport);
  new MutationObserver(()=>sync()).observe($('cueList'),{childList:true});
  new MutationObserver(()=>sync()).observe($('sceneList'),{childList:true});
  new MutationObserver(()=>{if(!enabled)return;const active=CutflowScene.index();if(active>=0&&active!==index){index=active;selectedId=items()[index]?.id;if(cues.length&&mode==='caption'){const cueIndex=CutflowScene.cueIndex(index);if(cueIndex>=0)window.selectStyleCue?.(cueIndex);}sync();}else if(cues.length){sync();}}).observe($('nowPlaying'),{childList:true});
  new MutationObserver(()=>{if(enabled)exportButton.disabled=$('exportBtn').disabled;}).observe($('exportBtn'),{attributes:true,attributeFilter:['disabled']});
  const saveStatus=$('projectSaveStatus');if(saveStatus)new MutationObserver(()=>{if(!enabled)return;const state=saveStatus.dataset.state;saveButton.textContent=state==='saved'?'✓ 저장됨':state==='busy'?'저장 중…':'저장';saveButton.dataset.state=state||'';}).observe(saveStatus,{childList:true,attributes:true,attributeFilter:['data-state']});
  if(mq.matches)activate();viewport();
})();
