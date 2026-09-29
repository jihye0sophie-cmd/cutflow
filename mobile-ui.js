/* v32 mobile presentation adapter. Desktop controls/events/project data remain authoritative. */
(()=>{
  const mq=matchMedia('(max-width:760px)');
  let enabled=false,index=0,selectedId=null,mode='caption',lastEditMode='caption',hadMedia=false,lastStroke=15,captionWasOpen=false,sceneEdit=false,narrationSceneWarningShown=false;
  const slots=new Map(),q=s=>document.querySelector(s);

  const shell=document.createElement('section');
  shell.id='mobileStudio';shell.className='mobile-only';
  shell.innerHTML=`
    <div id="mobilePreview"></div>
    <details id="mobileProject">
      <summary>프로젝트 설정 <span>대본 · 음성 · 템플릿 · 제목 · BGM</span></summary>
      <div id="mobileProjectBody">
        <div id="mobileProjectQuick" class="mobile-project-quick"><button id="mobileProjectOpen" type="button">저장된 프로젝트 열기</button></div>
        <div id="mobileProjectGroups"></div>
      </div>
    </details>
    <nav id="mobileTools" aria-label="모바일 편집 도구"></nav>
    <div id="mobileEditor">
      <p id="mobileEmpty">장면을 추가하면 내레이션 없이도 이미지·영상과 자막을 직접 편집할 수 있습니다.</p>
      <div id="mobileSceneActions" class="mobile-scene-tools"><strong>장면 편집</strong><div><button id="mobileSceneSplit" type="button">나누기</button><button id="mobileSceneMerge" type="button">다음과 합치기</button><button id="mobileSceneDelete" type="button" class="danger">삭제</button></div><small>나누기는 현재 재생 위치 기준</small></div><div id="mobileEditorBody"></div>
      <section id="mobileScenesPane" hidden>
        <div class="mobile-scenes-head"><strong>전체 장면</strong><div class="mobile-scenes-head-actions"><button id="mobileScenesEdit" type="button">순서 편집</button><button id="mobileScenesAdd" type="button">+ 장면 추가</button></div></div>
        <div id="mobileSceneGrid"></div>
      </section>
    </div>`;
  q('.app-shell').prepend(shell);

  const nav=q('#mobileTools');
  nav.innerHTML=[
    ['caption','T','자막'],['media','▧','미디어'],['motion','✧','움직임'],['style','Aa','스타일'],['scenes','▦','장면']
  ].map(([key,icon,name])=>`<button type="button" data-mobile-tab="${key}" aria-pressed="${key==='caption'}"><span aria-hidden="true">${icon}</span>${name}</button>`).join('');

  const mobileNav=document.createElement('div');
  mobileNav.id='mobileSceneNav';mobileNav.className='mobile-only';
  mobileNav.innerHTML='<button id="mobilePrev" type="button" aria-label="이전 장면">‹</button><strong id="mobileSceneCount">장면 0 / 0</strong><button id="mobileNext" type="button" aria-label="다음 장면">›</button>';
  q('.preview-panel').append(mobileNav);

  const settingsButton=document.createElement('button');settingsButton.id='mobileSettings';settingsButton.className='mobile-only';settingsButton.type='button';settingsButton.setAttribute('aria-label','프로젝트 설정');settingsButton.textContent='⚙';q('.topbar').append(settingsButton);
  const saveButton=document.createElement('button');saveButton.id='mobileSave';saveButton.className='mobile-only';saveButton.type='button';saveButton.textContent='저장';q('.topbar').append(saveButton);
  const exportButton=document.createElement('button');exportButton.id='mobileExport';exportButton.className='mobile-only';exportButton.type='button';exportButton.textContent='내보내기';q('.topbar').append(exportButton);

  const replaceButton=document.createElement('button');replaceButton.id='mobileReplace';replaceButton.type='button';replaceButton.textContent='이미지·영상 교체';replaceButton.className='mobile-only';
  const replaceInput=document.createElement('input');replaceInput.type='file';replaceInput.accept='image/*,video/*';replaceInput.hidden=true;document.body.append(replaceInput);

  const strokeToggle=document.createElement('label');strokeToggle.className='mobile-only mobile-stroke-toggle';strokeToggle.innerHTML='<input id="mobileCaptionStroke" type="checkbox"> 스트로크 사용';$('captionStroke').closest('label').before(strokeToggle);

  function move(node,target){if(!node)return;if(!slots.has(node)){const marker=document.createComment('mobile-original-position');node.before(marker);slots.set(node,marker);}target.append(node);}
  function items(){return CutflowScene.items();}
  function select(i){if(!enabled)return;const list=items();if(i<0||i>=list.length)return;CutflowScene.select(i);}
  function setTab(tab){nav.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mobileTab===tab)));}

  function sceneStatus(item){const count=(item?.cueIndices||[]).length;const motion={zoomIn:'Z+',zoomOut:'Z−',panLeft:'←',panRight:'→',panUp:'↑',panDown:'↓',still:'●'}[item?.motion]||'';return `${count>1?`<span class="mobile-scene-badge caption-count">${count}</span>`:''}${motion?`<span class="mobile-scene-badge motion-state">${motion}</span>`:''}`;}

  function buildGrid(){
    const list=items();
    const edit=$('mobileScenesEdit');if(edit){edit.textContent=sceneEdit?'완료':'순서 편집';edit.setAttribute('aria-pressed',String(sceneEdit));}
    $('mobileSceneGrid').classList.toggle('scene-editing',sceneEdit);
    $('mobileSceneGrid').innerHTML=list.length?list.map((item,i)=>{const {source,duration}=CutflowScene.thumbnail(item,i);return `<div class="mobile-scene-item" data-mobile-scene-item="${i}"><button type="button" class="mobile-scene-card" data-mobile-scene="${i}" aria-label="장면 ${i+1} 선택" aria-current="${i===index?'true':'false'}">${source?.thumb?`<img src="${esc(source.thumb)}" alt="">`:'<span class="mobile-missing">컷 없음</span>'}<span class="mobile-grid-number">${String(i+1).padStart(2,'0')}</span><span class="mobile-grid-duration">${duration.toFixed(1)}초</span>${sceneStatus(item)}</button>${sceneEdit?`<div class="mobile-scene-actions"><button type="button" data-scene-move="-1" data-index="${i}" aria-label="장면 ${i+1} 앞으로 이동" ${i===0?'disabled':''}>←</button><button type="button" data-scene-move="1" data-index="${i}" aria-label="장면 ${i+1} 뒤로 이동" ${i===list.length-1?'disabled':''}>→</button><button type="button" class="danger" data-scene-delete="${i}" aria-label="장면 ${i+1} 삭제">삭제</button></div>`:''}</div>`;}).join(''):'<p class="mobile-scenes-empty">장면을 먼저 추가해 주세요.</p>';
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
    $('mobileEditor').dataset.mode=mode;
    setTab(mode);
    const cueIndex=cues.length?CutflowScene.cueIndex(index):index;
    const selectedCueIndex=cues.length&&['media','motion'].includes(mode)?(list[index]?.firstCueIndex??cueIndex):cueIndex;
    document.querySelectorAll('.cue-row,.scene-row').forEach(row=>{const rowIndex=Number(row.dataset.index),on=cues.length?row.classList.contains('cue-row')&&rowIndex===selectedCueIndex:rowIndex===index;row.classList.toggle('mobile-selected',on);row.draggable=false;const fold=row.querySelector('.mobile-caption-text');if(fold)fold.replaceWith(...Array.from(fold.children).filter(n=>n.tagName!=='SUMMARY'));});
    $('mobileScenesPane').hidden=mode!=='scenes';
    if(mode==='scenes')buildGrid();else sceneEdit=false;
    if(mode==='style'&&cues.length&&cueIndex>=0){window.selectStyleCue?.(cueIndex);$('captionStylePanel').open=true;}else $('captionStylePanel').open=false;
    if(scenes.length&&!hadMedia){$('mobileProject').open=false;document.body.classList.remove('mobile-project-open');hadMedia=true;}if(!scenes.length)hadMedia=false;
    syncStroke();viewport();
  }

  function activate(){
    if(enabled)return;
    window.dispatchEvent(new Event('cutflow-mobile-activate'));
    index=CutflowScene.index();selectedId=items()[index]?.id;captionWasOpen=$('captionStylePanel').open;enabled=true;document.body.classList.add('mobile-editor');
    move(q('.preview-panel'),$('mobilePreview'));
    move($('scrubber'),q('.player-controls'));
    const controls=q('.player-controls');if(controls&&$('scrubber'))controls.insertBefore($('scrubber'),controls.querySelector('.timecode'));

    const groups=$('mobileProjectGroups');groups.innerHTML='';
    const specs=[['대본 · 음성','내레이션과 자막 구간',q('.hero'),q('.source-panel')],['템플릿 · 제목 · 채널명','화면 전체 스타일',q('.setup-panel')],['배경음악 · BGM','음악 · 볼륨 · 페이드',q('.bgm-panel')],['영상 출력','해상도 · MP4 저장',q('.export-panel')]];
    specs.forEach(([title,desc,...nodes])=>{const d=document.createElement('details');d.className='mobile-project-group';d.innerHTML=`<summary><strong>${title}</strong><span>${desc}</span></summary><div class="mobile-project-group-body"></div>`;groups.append(d);nodes.forEach(n=>move(n,d.lastElementChild));});

    move(q('.timeline-panel'),$('mobileEditorBody'));
    move($('captionStylePanel'),$('mobileEditorBody'));
    q('.timeline-panel')?.prepend(replaceButton);
    $('captionStylePanel').open=false;
    sync();
  }

  function deactivate(){
    if(!enabled)return;enabled=false;
    document.body.classList.remove('mobile-editor','mobile-compact','mobile-keyboard','mobile-input-focus','mobile-project-open');
    for(const [node,marker] of slots)marker.replaceWith(node);slots.clear();
    $('mobileProjectGroups').innerHTML='';document.querySelectorAll('.scene-row').forEach(row=>row.draggable=true);document.querySelectorAll('.mobile-caption-text').forEach(fold=>fold.replaceWith(...Array.from(fold.children).filter(n=>n.tagName!=='SUMMARY')));$('captionStylePanel').open=captionWasOpen;
  }

  window.addEventListener('cutflow-scene',e=>{if(enabled){index=e.detail;selectedId=items()[index]?.id;sync();}});
  mq.addEventListener('change',()=>mq.matches?activate():deactivate());
  $('mobilePrev').onclick=()=>select(index-1);$('mobileNext').onclick=()=>select(index+1);
  $('mobileSceneSplit').onclick=async()=>{await CutflowScene.split(index,currentTime());sync();};
  $('mobileSceneMerge').onclick=()=>{if(confirm('다음 장면과 합칠까요? 같은 미디어의 연속 장면만 합칠 수 있습니다.')){CutflowScene.mergeNext(index);sync();}};
  $('mobileSceneDelete').onclick=()=>{if(!confirmNarrationSceneEdit())return;if(confirm(`장면 ${index+1}을 삭제할까요?`)){CutflowScene.remove(index);sync();}};
  settingsButton.onclick=()=>{const open=!document.body.classList.contains('mobile-project-open');document.body.classList.toggle('mobile-project-open',open);$('mobileProject').open=open;if(open)pause();};
  $('mobileProject').addEventListener('toggle',()=>{if(enabled&&!$('mobileProject').open)document.body.classList.remove('mobile-project-open');});
  saveButton.onclick=()=>$('projectSaveBtn').click();$('mobileProjectOpen').onclick=()=>$('projectOpenBtn').click();exportButton.onclick=()=>$('exportBtn').click();
  $('mobileScenesAdd').onclick=()=>$('fileInput').click();$('mobileScenesEdit').onclick=()=>{sceneEdit=!sceneEdit;buildGrid();};

  nav.onclick=e=>{const tab=e.target.closest('[data-mobile-tab]')?.dataset.mobileTab;if(!tab)return;if(tab!=='scenes')lastEditMode=tab;mode=tab;if(mode==='style'&&cues.length){const cueIndex=CutflowScene.cueIndex(index);if(cueIndex>=0)window.selectStyleCue?.(cueIndex);}sync();requestAnimationFrame(()=>q('#mobileEditor')?.scrollIntoView({block:'start',behavior:'smooth'}));};
  $('mobileSceneGrid').onclick=e=>{
    const move=e.target.closest('[data-scene-move]');if(move){const from=Number(move.dataset.index),to=from+Number(move.dataset.sceneMove);if(confirmNarrationSceneEdit()&&CutflowScene.move(from,to)){index=to;selectedId=items()[to]?.id;buildGrid();}return;}
    const del=e.target.closest('[data-scene-delete]');if(del){const at=Number(del.dataset.sceneDelete);if(!confirmNarrationSceneEdit())return;const name=`장면 ${at+1}`;if(confirm(`${name}을 삭제할까요? 삭제 후 뒤 장면의 시간이 자동으로 다시 계산됩니다.`)){CutflowScene.remove(at);index=Math.min(at,Math.max(0,items().length-1));selectedId=items()[index]?.id||null;buildGrid();}return;}
    const target=e.target.closest('[data-mobile-scene]');if(target){select(Number(target.dataset.mobileScene));if(!sceneEdit){mode=lastEditMode;sync();requestAnimationFrame(()=>q('#mobileEditor')?.scrollIntoView({block:'start',behavior:'smooth'}));}else buildGrid();}
  };

  $('cueList').addEventListener('click',e=>{if(enabled&&e.target.closest('[data-action="style"]')){e.stopImmediatePropagation();mode='style';sync();}},true);
  $('styleCue').addEventListener('change',()=>{if(enabled){const cueIndex=cues.findIndex(c=>c.id===$('styleCue').value),sceneIndex=CutflowScene.sceneIndexForCue(cueIndex);if(sceneIndex>=0){index=sceneIndex;selectedId=items()[index]?.id;}sync();}});
  $('mobileCaptionStroke').oninput=()=>{const control=$('captionStroke');control.value=$('mobileCaptionStroke').checked?lastStroke:0;control.dispatchEvent(new Event('input',{bubbles:true}));};

  replaceButton.onclick=()=>replaceInput.click();
  replaceInput.onchange=async()=>{await CutflowScene.replace(replaceInput.files[0]);replaceInput.value='';};

  // Scene navigation swipe lives on the compact scene bar, avoiding conflicts with media transform gestures on the preview.
  let navTouch=null;
  mobileNav.addEventListener('touchstart',e=>{if(enabled&&e.touches.length===1)navTouch={x:e.touches[0].clientX,y:e.touches[0].clientY};},{passive:true});
  mobileNav.addEventListener('touchend',e=>{if(!navTouch||!enabled)return;const t=e.changedTouches[0],dx=t.clientX-navTouch.x,dy=t.clientY-navTouch.y;navTouch=null;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.5)select(index+(dx<0?1:-1));},{passive:true});
  mobileNav.addEventListener('touchcancel',()=>navTouch=null,{passive:true});

  window.addEventListener('cutflow-open-timing',()=>{if(!enabled)return;mode='timing';sync();requestAnimationFrame(()=>q('#mobileEditor')?.scrollIntoView({block:'start',behavior:'smooth'}));});

  function viewport(){if(!enabled)return;const vv=window.visualViewport;const height=vv?.height||innerHeight;document.documentElement.style.setProperty('--mobile-visible-height',height+'px');document.documentElement.style.setProperty('--mobile-keyboard-offset',Math.max(0,innerHeight-height-(vv?.offsetTop||0))+'px');document.body.classList.toggle('mobile-keyboard',height<innerHeight*.75);}
  document.addEventListener('focusin',()=>{if(enabled){document.body.classList.toggle('mobile-input-focus',document.activeElement.matches('textarea,input[type=number],input[type=text],input:not([type])'));viewport();}});
  document.addEventListener('focusout',()=>{if(enabled)requestAnimationFrame(()=>{document.body.classList.toggle('mobile-input-focus',document.activeElement.matches('textarea,input[type=number],input[type=text],input:not([type])'));viewport();});});
  window.visualViewport?.addEventListener('resize',viewport);window.addEventListener('resize',viewport);
  new MutationObserver(()=>sync()).observe($('cueList'),{childList:true});
  new MutationObserver(()=>sync()).observe($('sceneList'),{childList:true});
  new MutationObserver(()=>{if(!enabled)return;const active=CutflowScene.index();if(active>=0&&active!==index){index=active;selectedId=items()[index]?.id;if(cues.length&&mode==='style'){const cueIndex=CutflowScene.cueIndex(index);if(cueIndex>=0)window.selectStyleCue?.(cueIndex);}sync();}else if(cues.length){sync();}}).observe($('nowPlaying'),{childList:true});
  new MutationObserver(()=>{if(enabled)exportButton.disabled=$('exportBtn').disabled;}).observe($('exportBtn'),{attributes:true,attributeFilter:['disabled']});
  const saveStatus=$('projectSaveStatus');if(saveStatus)new MutationObserver(()=>{if(!enabled)return;const state=saveStatus.dataset.state;saveButton.textContent=state==='saved'?'✓ 저장됨':state==='busy'?'저장 중…':'저장';saveButton.dataset.state=state||'';}).observe(saveStatus,{childList:true,attributes:true,attributeFilter:['data-state']});
  if(mq.matches)activate();viewport();
})();
