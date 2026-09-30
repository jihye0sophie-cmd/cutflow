/* Cutflow v42 mobile shell.
   Mobile UI is independent from the desktop DOM. Existing controls remain authoritative
   and are only mirrored/proxied here; no desktop panel is moved into the mobile shell. */
(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  const qs=(s,r=document)=>r.querySelector(s);
  const qsa=(s,r=document)=>[...r.querySelectorAll(s)];
  const ua=navigator.userAgent||'';
  const mobileUA=/Android|iPhone|iPad|iPod|Mobile/i.test(ua) || navigator.userAgentData?.mobile===true;
  const ipadDesktop=/Macintosh/i.test(ua)&&(navigator.maxTouchPoints||0)>1;
  const coarse=matchMedia('(hover:none) and (pointer:coarse)').matches;
  const touchPoints=navigator.maxTouchPoints||0;
  const physicalShort=Math.min(screen.width||9999,screen.height||9999);
  const desktopOS=/Windows NT|X11|CrOS/i.test(ua);
  const touchHandheld=!desktopOS&&coarse&&touchPoints>0&&physicalShort<=900;
  const deviceMobile=!!(mobileUA||ipadDesktop||touchHandheld);
  const compactMq=matchMedia('(max-width:760px)');
  const standaloneMode=window.matchMedia?.('(display-mode: standalone)')?.matches||navigator.standalone===true;
  document.body.classList.toggle('v42-standalone',!!standaloneMode);
  window.CutflowUI=window.CutflowUI||{};
  window.CutflowUI.isMobileDevice=()=>deviceMobile;
  window.CutflowUI.mobileActive=!!(deviceMobile||compactMq.matches);
  window.CutflowUI.mode=window.CutflowUI.mobileActive?'mobile':'desktop';

  const app=document.createElement('div');
  app.id='mobileAppV42';
  app.innerHTML=`
    <header class="v42-head">
      <div class="v42-brand"><div><strong>Cutflow</strong><small>쇼츠 컷 편집 스튜디오</small></div></div>
      <div class="v42-head-actions">
        <button type="button" id="v42Settings" class="v42-icon-btn" aria-label="설정" title="설정"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M19 12a7.2 7.2 0 0 0-.08-1l2.02-1.58-2-3.46-2.48 1a7.4 7.4 0 0 0-1.72-1L14.36 3h-4.02l-.38 2.96a7.4 7.4 0 0 0-1.72 1l-2.48-1-2 3.46L5.78 11a7.2 7.2 0 0 0 0 2l-2.02 1.58 2 3.46 2.48-1a7.4 7.4 0 0 0 1.72 1l.38 2.96h4.02l.38-2.96a7.4 7.4 0 0 0 1.72-1l2.48 1 2-3.46L18.92 13c.05-.33.08-.66.08-1Z"/></svg></button>
        <button type="button" data-click="projectOpenBtn">열기</button>
        <button type="button" data-click="projectSaveBtn">저장</button>
        <button type="button" id="v42Export" class="primary">내보내기 ↗</button>
      </div>
    </header>
    <main class="v42-main">
      <section class="v42-preview-card">
        <div class="v42-preview-head"><strong>미리보기</strong><span id="v42TimeLabel">0:00.0 / 0:00.0</span></div>
        <div class="v42-stage-wrap"><canvas id="v42Stage" width="360" height="640" aria-label="모바일 영상 미리보기"></canvas></div>
        <input id="v42Scrubber" class="v42-scrubber" type="range" min="0" max="1000" value="0" aria-label="재생 위치">
        <div class="v42-player">
          <div class="v42-transport">
            <button type="button" id="v42PrevScene" aria-label="이전 장면" title="이전 장면">‹</button>
            <button type="button" id="v42Play" class="play" aria-label="재생">▶</button>
            <button type="button" id="v42NextScene" aria-label="다음 장면" title="다음 장면">›</button>
          </div>
          <div class="v42-preview-tools">
            <button type="button" id="v42Undo" data-history-control="1" aria-label="실행 취소" title="실행 취소" disabled>↶</button>
            <button type="button" id="v42Redo" data-history-control="1" aria-label="다시 실행" title="다시 실행" disabled>↷</button>
            <button type="button" id="v42Fullscreen" aria-label="전체화면 미리보기" title="전체화면 미리보기">⛶</button>
          </div>
        </div>
        <div class="v42-scene-nav"><strong id="v42SceneLabel">0 / 0</strong></div>
      </section>
      <section class="v42-scenes-card" aria-label="장면 목록">
        <div class="v42-scenes-row"><div id="v42SceneStrip" class="v42-scene-strip"></div><button id="v42AddScene" type="button" class="v42-add-scene" aria-label="장면 추가">＋</button></div>
      </section>
      <nav id="v42Tabs" class="v42-tabs" aria-label="모바일 편집 탭">
        <button type="button" data-tab="caption" aria-pressed="true" aria-label="자막" title="자막">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6h14M12 6v12M8 18h8"/></svg>
        </button>
        <button type="button" data-tab="media" aria-label="이미지·영상" title="이미지·영상">
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2"/><path d="m6.5 16 4-4 3 3 2-2 2 3"/><circle cx="15.5" cy="9" r="1.2"/></svg>
        </button>
        <button type="button" data-tab="timing" aria-label="정밀 타이밍" title="정밀 타이밍">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="7"/><path d="M12 9v4l2.5 1.5M9 3h6"/></svg>
        </button>
      </nav>
      <section id="v42Panel" class="v42-panel"></section>
    </main>`;
  document.body.append(app);
  const previewDialog=document.createElement('div');
  previewDialog.id='v42PreviewDialog';
  previewDialog.className='v42-preview-overlay';
  previewDialog.hidden=true;
  previewDialog.setAttribute('role','dialog');
  previewDialog.setAttribute('aria-modal','true');
  previewDialog.setAttribute('aria-label','전체화면 미리보기');
  previewDialog.innerHTML='<div class="v42-full-head"><strong>전체화면 미리보기</strong><button type="button" id="v42FullClose" aria-label="닫기">×</button></div><div class="v42-full-stage-wrap"><canvas id="v42FullStage" width="1080" height="1920"></canvas></div><div class="v42-full-controls"><button type="button" id="v42FullPlay" class="v42-full-play" aria-label="재생/일시정지">▶</button></div>';
  document.body.append(previewDialog);
  const exportDialogV42=document.createElement('dialog');
  exportDialogV42.id='v42ExportDialog';
  exportDialogV42.innerHTML='<div class="v42-sheet-head"><div><strong>MP4 내보내기</strong><small>Cutflow</small></div><button type="button" id="v42ExportClose" aria-label="닫기">×</button></div><div class="v42-export-body"><progress id="v42ExportProgress" max="1" value="0"></progress><p id="v42ExportStatus" class="v42-status">준비 중…</p><div id="v42ExportResult" class="v42-export-result" hidden></div><div class="v42-actions"><button type="button" id="v42ExportCancel" class="v42-btn danger">취소</button><button type="button" id="v42ExportShare" class="v42-btn primary" hidden>iPhone에 저장/공유</button><a id="v42ExportDownload" class="v42-btn primary" hidden>MP4 다운로드</a><button type="button" id="v42ExportDone" class="v42-btn" hidden>닫기</button></div></div>';
  document.body.append(exportDialogV42);
  const settingsDialog=document.createElement('dialog');
  settingsDialog.id='v42SettingsDialog';
  settingsDialog.innerHTML='<div class="v42-sheet-head"><div><strong>프로젝트 설정</strong></div><button type="button" id="v42SettingsClose" aria-label="닫기">×</button></div><div id="v42SettingsBody" class="v42-settings-body"></div>';
  document.body.append(settingsDialog);

  function revealCutflowUI(){document.body.classList.remove('cutflow-booting');document.body.classList.add('cutflow-ready');}
  const panel=$('v42Panel'),tabs=$('v42Tabs'),stage=$('v42Stage'),ctx=stage.getContext('2d'),fullStage=$('v42FullStage'),fullCtx=fullStage.getContext('2d');
  const setMobileActive=(next,{initial=false}={})=>{
    next=!!next;
    const prev=!!window.CutflowUI.mobileActive;
    const sourcePreview=$('stage');
    if(sourcePreview){
      const targetW=next?540:1080,targetH=next?960:1920;
      if(sourcePreview.width!==targetW||sourcePreview.height!==targetH){
        sourcePreview.width=targetW;sourcePreview.height=targetH;
        window.CutflowPlayer?.invalidate?.();
      }
    }
    window.CutflowUI.mobileActive=next;
    window.CutflowUI.mode=next?'mobile':'desktop';
    document.body.classList.toggle('v42-mobile',next);
    document.body.classList.remove('mobile-editor');
    if(!next){
      for(const dialog of [settingsDialog,exportDialogV42]){try{if(dialog?.open)dialog.close();}catch{}}
      previewDialog.hidden=true;
      document.body.classList.remove('v42-preview-lock');
    }
    if(initial||prev===next)return;
    window.dispatchEvent(new CustomEvent(next?'cutflow-mobile-activate':'cutflow-mobile-deactivate',{detail:{responsive:!deviceMobile,width:innerWidth}}));
    if(next){requestAnimationFrame(()=>{requestRefresh(true);syncPreviewHistory();});}
  };
  const syncResponsiveMode=()=>setMobileActive(deviceMobile||compactMq.matches);
  setMobileActive(deviceMobile||compactMq.matches,{initial:true});
  if(typeof compactMq.addEventListener==='function')compactMq.addEventListener('change',syncResponsiveMode);
  else if(typeof compactMq.addListener==='function')compactMq.addListener(syncResponsiveMode);
  const proxyMap=new Map(),settingsProxyMap=new Map();
  let tab='caption',sceneIndex=0,lastSceneId=null,renderQueued=false,captionMode='edit',captionSelection={index:-1,start:0,end:0};

  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const key=()=>`p${Math.random().toString(36).slice(2)}`;
  const dispatch=(el,type)=>el.dispatchEvent(new Event(type,{bubbles:true}));
  const fileButtonTargets={
    uploadBtn:'fileInput',
    scriptFileBtn:'scriptFile',
    audioBtn:'audioInput',
    bgmBtn:'bgmInput',
    autoNarrationBtn:'autoNarration',
    autoGridBtn:'autoGrids',
    autoSingleBtn:'autoSingles',
    autoBgmBtn:'autoBgm'
  };
  const fileTargetFor=el=>fileButtonTargets[el?.id]||'';
  const openFileTarget=id=>{const input=$(id);if(input?.type==='file'){input.click();return true;}return false;};
  function proxyControl(el,label,{wide=false,map=proxyMap}={}){
    if(!el)return '';
    const k=key();map.set(k,el);
    const cls=wide?' wide':'';
    if(el.tagName==='SELECT'){
      return `<label class="v42-field${cls}"><span>${esc(label)}</span><select data-proxy="${k}">${[...el.options].map(o=>`<option value="${esc(o.value)}" ${o.selected?'selected':''}>${esc(o.textContent)}</option>`).join('')}</select></label>`;
    }
    if(el.type==='checkbox')return `<label class="v42-check${cls}"><input data-proxy="${k}" type="checkbox" ${el.checked?'checked':''}><span>${esc(label)}</span></label>`;
    if(el.tagName==='TEXTAREA')return `<label class="v42-field${cls}"><span>${esc(label)}</span><textarea data-proxy="${k}" rows="${el.rows||3}" maxlength="${el.maxLength>0?el.maxLength:10000}">${esc(el.value)}</textarea></label>`;
    const type=el.type==='range'?'range':el.type==='color'?'color':el.type==='number'?'number':'text';
    const attrs=[el.min&&`min="${esc(el.min)}"`,el.max&&`max="${esc(el.max)}"`,el.step&&`step="${esc(el.step)}"`].filter(Boolean).join(' ');
    return `<label class="v42-field${cls}"><span>${esc(label)}</span><input data-proxy="${k}" type="${type}" value="${esc(el.value)}" ${attrs}></label>`;
  }
  function proxyButton(el,label,{primary=false,danger=false,wide=false,map=proxyMap}={}){
    if(!el)return '';
    const k=key();map.set(k,el);
    const fileTarget=fileTargetFor(el);
    return `<button type="button" data-proxy-click="${k}" ${fileTarget?`data-file-target="${fileTarget}"`:''} class="v42-btn ${primary?'primary ':''}${danger?'danger ':''}${wide?'wide':''}" ${el.disabled?'disabled':''}>${esc(label)}</button>`;
  }
  function section(title,body,sub='',extra=''){
    return `<section class="v42-section ${extra}"><div class="v42-section-head"><strong>${esc(title)}</strong>${sub?`<small>${esc(sub)}</small>`:''}</div>${body}</section>`;
  }
  const paletteColors=[['흰','#ffffff'],['노랑','#f5e642'],['연두','#b8ff38'],['하늘','#70d6ff'],['주황','#ff982f'],['빨강','#ff4949']];
  function palette(targetId){
    const el=$(targetId);if(!el)return '';
    return `<div class="v42-palette" data-color-target="${targetId}">${paletteColors.map(([name,color])=>`<button type="button" data-color="${color}" title="${name}" aria-label="${name}" style="--swatch:${color}" ${String(el.value).toLowerCase()===color?'aria-current="true"':''}></button>`).join('')}</div>`;
  }
  function details(title,body,sub='',open=false){return `<details class="v42-details" ${open?'open':''}><summary><span>${esc(title)}</span>${sub?`<small>${esc(sub)}</small>`:''}</summary><div class="v42-detail-body">${body}</div></details>`;}
  function autoGridMirror(){
    const grids=window.CutflowAutoSetup?.grids?.()||[];
    if(!grids.length)return '<div class="v42-auto-empty v42-auto-grid-empty">그리드 이미지를 추가하면 분할 미리보기와 조절선이 바로 표시됩니다.</div>';
    return grids.map(g=>{
      const x=g.xCuts.map((p,i)=>`<button type="button" class="v42-cut-line v42-cut-x" data-auto-cut="x" data-cut-index="${i}" style="left:${p}%" aria-label="세로 분할선 ${i+1}"></button>`).join('');
      const y=g.yCuts.map((p,i)=>`<button type="button" class="v42-cut-line v42-cut-y" data-auto-cut="y" data-cut-index="${i}" style="top:${p}%" aria-label="가로 분할선 ${i+1}"></button>`).join('');
      return `<article class="v42-grid-source" data-auto-grid="${g.index}">
        <div class="v42-grid-source-head"><div><strong>${esc(g.name)}</strong><small>${g.cols}×${g.rows} · ${g.cols*g.rows}장</small></div><button type="button" class="v42-grid-remove" data-auto-grid-delete aria-label="이미지 제거">×</button></div>
        <div class="v42-grid-control-row">
          <label><span>열</span><input type="number" min="1" max="12" value="${g.cols}" data-auto-field="cols"></label>
          <b>×</b>
          <label><span>행</span><input type="number" min="1" max="12" value="${g.rows}" data-auto-field="rows"></label>
          <label class="gap"><span>분할 여백(px)</span><input type="number" min="0" max="40" value="${g.gap}" data-auto-field="gap"></label>
          <button type="button" class="v42-btn reset" data-auto-action="reset">초기화</button>
        </div>
        <div class="v42-grid-preview" style="aspect-ratio:${g.width||4}/${g.height||1}"><img src="${esc(g.url||'')}" alt=""><div class="v42-grid-lines">${x}${y}</div></div>
        <p class="v42-help">노란 띠가 실제 분할 시 제거되는 여백입니다. 기본 8px이며, 경계가 맞지 않으면 띠의 중심을 손가락으로 움직여 조정하세요.</p>
      </article>`;
    }).join('');
  }
  function autoSingleMirror(){
    const singles=window.CutflowAutoSetup?.singles?.()||[];
    if(!singles.length)return '<p class="v42-auto-empty">분할 없이 그대로 사용할 개별 이미지를 추가할 수 있습니다.</p>';
    return `<div class="v42-auto-single-list">${singles.map(s=>`<article class="v42-auto-single-item" data-auto-single="${s.index}"><img src="${esc(s.url||'')}" alt=""><div><strong>${esc(s.name)}</strong><small>개별 이미지 · 장면 1컷</small></div><button type="button" class="v42-grid-remove" data-auto-single-action="remove" aria-label="개별 이미지 제거">×</button></article>`).join('')}</div>`;
  }
  function currentScene(){
    const api=window.CutflowScene;if(!api?.items)return {items:[],item:null,index:0};
    const items=api.items()||[];
    let i=Math.max(0,Math.min(items.length-1,api.index?.()??sceneIndex));
    if(lastSceneId){const found=items.findIndex(x=>x.id===lastSceneId);if(found>=0)i=found;}
    sceneIndex=i;lastSceneId=items[i]?.id||null;return {items,item:items[i],index:i};
  }
  function currentRows(){
    const {item,index}=currentScene();
    const cueIndex=item?.firstCueIndex ?? window.CutflowScene?.cueIndex?.(index) ?? -1;
    const cueRow=cueIndex>=0?qs(`.cue-row[data-index="${cueIndex}"]`):null;
    const sceneRow=qs(`.scene-row[data-index="${index}"]`);
    const mediaCueIndex=item?.firstCueIndex ?? cueIndex;
    const mediaRow=mediaCueIndex>=0?qs(`.cue-row[data-index="${mediaCueIndex}"]`):sceneRow;
    return {item,index,cueIndex,cueRow,sceneRow,mediaRow};
  }
  function followSelectedScene(behavior='smooth'){
    const root=$('v42SceneStrip'),selected=root?.querySelector('[aria-current="true"]');
    if(!root||!selected)return;
    const left=selected.offsetLeft-(root.clientWidth-selected.offsetWidth)/2;
    root.scrollTo({left:Math.max(0,left),behavior});
  }
  function renderSceneStrip(){
    const {items,index}=currentScene(),root=$('v42SceneStrip');
    root.innerHTML=items.length?items.map((item,i)=>{const t=window.CutflowScene?.thumbnail?.(item,i)||{},src=t.source?.thumb||'';return `<button type="button" data-scene="${i}" aria-current="${i===index}" aria-label="장면 ${i+1}">${src?`<img src="${esc(src)}" alt="">`:'<span class="missing">'+(i+1)+'</span>'}</button>`}).join(''):'<p class="v42-empty-strip">장면을 추가해 주세요.</p>';
    $('v42SceneLabel').textContent=`${items.length?index+1:0} / ${items.length}`;

  }
  function renderCaption(){
    proxyMap.clear();
    const api=window.CutflowCaption,index=api?.currentIndex?.()??-1,state=api?.state?.(index);
    if(!state){panel.innerHTML=section('자막','<p class="v42-help">아직 자막 구간이 없습니다. 프로젝트 설정에서 대본과 내레이션을 불러온 뒤 자막 구간을 만들어 주세요.</p>');return;}
    window.CutflowCaptionStyle?.select?.(index);
    const selectionPalette=paletteColors.map(([name,color])=>`<button type="button" data-caption-selection-color="${color}" title="${name}" aria-label="${name}" style="--swatch:${color}"></button>`).join('');
    const core=`
      <div class="v42-caption-batch-entry"><button type="button" id="v42CaptionBatchOpen" class="v42-btn wide">전체 자막 편집</button></div>
      <label class="v42-field wide"><span>자막 · [[강조]] 지원</span><textarea id="v42CaptionText" data-caption-field="text" rows="3" maxlength="240">${esc(state.text)}</textarea></label>
      <div class="v42-caption-selection-tools"><strong>선택 글자색</strong><div class="v42-palette">${selectionPalette}</div><label class="v42-selection-picker">직접 선택 <input id="v42CaptionSelectionPicker" type="color" value="#f5e642" aria-label="선택 글자색 직접 선택"></label><button type="button" id="v42CaptionSelectionReset" class="v42-btn">선택 색상 해제</button><small>자막에서 글자를 드래그한 뒤 색상을 누르면 즉시 적용됩니다.</small></div>
      <div class="v42-caption-segment-nav"><span>자막 ${state.segment.position} / ${state.segment.count}</span><div><button type="button" id="v42CaptionPrev" class="v42-btn" ${state.segment.position===1?'disabled':''}>‹ 이전 자막</button><button type="button" id="v42CaptionNext" class="v42-btn" ${state.segment.position===state.segment.count?'disabled':''}>다음 자막 ›</button></div></div>
      <div class="v42-caption-actions"><button type="button" id="v42CaptionSplit" class="v42-btn">나누기</button><button type="button" id="v42CaptionMerge" class="v42-btn" ${state.segment.position===state.segment.count?'disabled':''}>다음 자막과 합치기</button><button type="button" id="v42CaptionDelete" class="v42-btn danger">구간 삭제</button></div>
      <div class="v42-caption-timing"><div class="v42-caption-timing-head"><strong>자막 타이밍</strong><span>${Number(state.end-state.start).toFixed(2)}초</span></div>
      <div class="v42-grid2"><label class="v42-field"><span>시작</span><input data-caption-field="start" type="number" min="0" step="0.01" value="${Number(state.start).toFixed(2)}" ${state.freeEdit?'disabled':''}></label><label class="v42-field"><span>종료</span><input data-caption-field="end" type="number" min="0.1" step="0.01" value="${Number(state.end).toFixed(2)}" ${state.freeEdit?'disabled':''}></label></div>
      <div class="v42-actions"><button type="button" id="v42CaptionPlay" class="v42-btn">▶ 현재 자막 재생</button><button type="button" id="v42CaptionTiming" class="v42-btn">정밀 타이밍 조정 ›</button></div></div>`;
    const styleRange=(id,label,outputId)=>{
      const el=$(id);if(!el)return '';const k=key();proxyMap.set(k,el);
      const value=$(outputId)?.textContent||el.value;
      return `<label class="v42-field"><span>${esc(label)} <b class="v42-live-value">${esc(value)}</b></span><input data-proxy="${k}" type="range" value="${esc(el.value)}" min="${esc(el.min)}" max="${esc(el.max)}" step="${esc(el.step)}"></label>`;
    };
    const style=`
      ${proxyControl($('styleScope'),'적용 범위',{wide:true})}
      ${proxyButton($('applyAllCaptionStyle'),'현재 스타일을 전체 자막에 적용',{primary:true,wide:true})}
      <p class="v42-help">${esc($('styleScopeNote')?.textContent||'선택한 자막 스타일을 수정합니다.')}</p>
      ${proxyControl($('stylePreset'),'스타일 프리셋',{wide:true})}
      <div class="v42-grid2">${proxyControl($('captionFont'),'자막 폰트')}${styleRange('captionSize','글자 크기','sizeValue')}</div>
      <div class="v42-grid2">${proxyControl($('captionBold'),'볼드')}${proxyControl($('captionItalic'),'이탤릭')}</div>
      <p class="v42-help">${esc($('captionFontNote')?.textContent||'')}</p>
      <div class="v42-caption-base-color"><strong>글자색</strong>${palette('captionColor')}${proxyControl($('captionColor'),'직접 선택',{wide:true})}</div>
      <div class="v42-grid2">${proxyControl($('captionStrokeColor'),'스트로크 색상')}${styleRange('captionStroke','스트로크 두께','strokeValue')}</div>
      ${proxyControl($('captionBackground'),'자막 배경 사용',{wide:true})}
      <div class="v42-grid2">${proxyControl($('captionBackgroundColor'),'배경색')}${styleRange('captionOpacity','배경 불투명도','opacityValue')}${styleRange('captionPadding','배경 내부 여백','paddingValue')}${styleRange('captionRadius','모서리 둥글기','radiusValue')}</div>
      <div class="v42-grid2">${proxyControl($('captionPosition'),'자막 위치')}${styleRange('captionY','세로 위치 · 위에서','yValue')}</div>
      <p class="v42-help">변경 즉시 미리보기와 MP4에 반영됩니다. 크기·두께·여백은 1080px 너비 기준입니다. [[강조]]로 감싼 글자는 노란색으로 유지됩니다.</p>`;
    panel.innerHTML=section('자막',core,`자막 ${state.segment.position}/${state.segment.count}`)+details('상세 설정',style,'폰트 · 크기 · 색상 · B · I · 스트로크 · 배경',false);

    $('v42CaptionBatchOpen').onclick=()=>window.CutflowCaptionBatch?.open?.(index);
    const captionText=$('v42CaptionText');
    const rememberCaptionSelection=()=>{if(!captionText)return;captionSelection={index,start:captionText.selectionStart??0,end:captionText.selectionEnd??0};};
    ['select','keyup','mouseup','touchend'].forEach(type=>captionText?.addEventListener(type,rememberCaptionSelection));
    const applySelectedCaptionColor=color=>{rememberCaptionSelection();const sel=captionSelection;if(sel.index!==index||sel.start===sel.end){window.CutflowAutoBridge?.toast?.('색상을 바꿀 글자를 먼저 선택해 주세요.');return;}api.applySelectionColor?.(index,sel.start,sel.end,color);};
    panel.querySelectorAll('[data-caption-selection-color]').forEach(btn=>btn.onclick=()=>applySelectedCaptionColor(btn.dataset.captionSelectionColor));
    $('v42CaptionSelectionPicker').oninput=e=>applySelectedCaptionColor(e.target.value);
    $('v42CaptionSelectionReset').onclick=()=>applySelectedCaptionColor(null);
    $('v42CaptionPrev').onclick=()=>{if(index>state.segment.first)api.select(index-1);};
    $('v42CaptionNext').onclick=()=>{if(index<state.segment.last)api.select(index+1);};
    $('v42CaptionPlay').onclick=()=>api.play(index);
    $('v42CaptionTiming').onclick=()=>{tab='timing';qsa('button',tabs).forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.tab==='timing')));renderPanel(true);};
    $('v42CaptionSplit').onclick=()=>{const cursor=captionText?.selectionStart;if(api.split(index,cursor))requestRefresh(true);};
    $('v42CaptionMerge').onclick=()=>{if(api.mergeNext(index))requestRefresh(true);};
    $('v42CaptionDelete').onclick=()=>{if(confirm(`자막 ${state.segment.position}을 삭제할까요?`)&&api.remove(index))requestRefresh(true);};
  }

  function renderTiming(){
    proxyMap.clear();
    const api=window.CutflowCaption,index=api?.currentIndex?.()??-1,state=api?.state?.(index);
    if(!state){panel.innerHTML=section('정밀 타이밍','<p class="v42-help">조정할 자막이 없습니다.</p>');return;}
    panel.innerHTML=section('정밀 타이밍',`<div id="v42TimingHost" class="v42-timing-host"></div>`,`자막 ${state.segment.position}/${state.segment.count}`);
    window.CutflowTiming?.mount?.($('v42TimingHost'),index);
  }
  function renderMedia(){
    proxyMap.clear();const {item,index,mediaRow}=currentRows();
    if(!item){panel.innerHTML=section('이미지·영상','<p class="v42-help">장면을 먼저 추가해 주세요.</p>'+proxyButton($('uploadBtn'),'이미지·영상 추가',{primary:true,wide:true}));return;}
    const state=window.CutflowScene?.state?.(index);
    if(!state){panel.innerHTML=section('이미지·영상','<p class="v42-help">현재 장면 정보를 불러오지 못했습니다.</p>');return;}
    const opts=(rows,value)=>rows.map(([v,l])=>`<option value="${esc(v)}" ${v===value?'selected':''}>${esc(l)}</option>`).join('');
    const field=(label,name,type,value,attrs='')=>`<label class="v42-field"><span>${esc(label)}</span><input data-media-field="${name}" type="${type}" value="${esc(value)}" ${attrs}></label>`;
    const sourceSelect=mediaRow?.querySelector('[data-action="media"]');
    const durationInput=mediaRow?.querySelector('[data-action="scene-duration"]');
    const mediaBlock=`<div class="v42-media-primary">${sourceSelect?proxyControl(sourceSelect,'이미지·영상',{wide:true}):`<label class="v42-field wide"><span>이미지·영상</span><input value="${esc(state.name||'현재 장면')}" disabled></label>`}<input id="v42ReplaceInput" type="file" accept="image/*,video/*" hidden><button type="button" id="v42ReplaceBtn" class="v42-btn primary wide">이미지·영상 교체</button></div>`;
    const effects=`<div class="v42-grid2"><label class="v42-field"><span>움직임</span><select data-media-field="motion">${opts(state.motionOptions,state.motion)}</select></label><label class="v42-field"><span>진입 전환</span><select data-media-field="transition">${opts(state.transitionOptions,state.transition)}</select></label></div>`;
    const duration=durationInput?proxyControl(durationInput,'장면 길이 (초)',{wide:true}):'';
    let videoAdvanced='';
    if(state.type==='video'){
      const used=Math.max(0,state.trimEnd-state.trimStart).toFixed(2);
      videoAdvanced=details('영상 고급 설정',`
        <div class="v42-media-subsection"><strong>영상 Trim</strong><div class="v42-grid2">${field('시작 (초)','trimStart','number',state.trimStart.toFixed(2),`min="0" max="${Math.max(0,state.trimEnd-.04).toFixed(2)}" step="0.01"`)}${field('끝 (초)','trimEnd','number',state.trimEnd.toFixed(2),`min="${Math.min(state.sourceDuration,state.trimStart+.04).toFixed(2)}" max="${state.sourceDuration.toFixed(2)}" step="0.01"`)}</div><p class="v42-help">사용 ${used}초 / 원본 ${state.sourceDuration.toFixed(2)}초</p></div>
        <div class="v42-media-subsection"><div class="v42-media-audio-head"><strong>영상 원음</strong><label class="v42-check"><input data-media-field="mediaMuted" type="checkbox" ${state.mediaMuted?'checked':''}><span>음소거</span></label></div>
        <label class="v42-field"><span>볼륨 <b class="v42-live-value">${Math.round(state.mediaVolume)}%</b></span><input data-media-field="mediaVolume" type="range" min="0" max="100" step="1" value="${state.mediaVolume}"></label>
        <div class="v42-media-volume-presets" aria-label="영상 원음 빠른 볼륨">${[0,25,50,75,100].map(v=>`<button type="button" class="v42-btn" data-media-volume="${v}">${v}${v===100?'%':''}</button>`).join('')}</div>
        <div class="v42-grid2">${field('페이드 인 (초)','mediaFadeIn','number',state.mediaFadeIn.toFixed(1),'min="0" max="10" step="0.1"')}${field('페이드 아웃 (초)','mediaFadeOut','number',state.mediaFadeOut.toFixed(1),'min="0" max="10" step="0.1"')}</div><p class="v42-help">내레이션·BGM과 별도로 영상 원음을 조절합니다.</p></div>`,'Trim · 원음 · Fade',false);
    }
    const sceneActions=`<div class="v42-caption-actions"><button class="v42-btn" id="v42SplitScene">장면 나누기</button><button class="v42-btn" id="v42MergeScene" ${index>=(window.CutflowScene?.items?.().length||1)-1?'disabled':''}>다음 장면과 합치기</button><button class="v42-btn danger" id="v42DeleteScene">장면 삭제</button></div><p class="v42-help">장면 나누기는 현재 재생 위치를 기준으로 합니다.</p>`;
    const transform=`<div class="v42-grid3">${field('Scale (%)','scale','number',Number(state.transform.scale).toFixed(1),'min="10" max="500" step="1"')}${field('Position X (%)','x','number',Number(state.transform.x).toFixed(1),'min="-200" max="200" step="1"')}${field('Position Y (%)','y','number',Number(state.transform.y).toFixed(1),'min="-200" max="200" step="1"')}</div><button type="button" id="v42TransformReset" class="v42-btn wide">크기·위치 초기화</button><p class="v42-help">현재 장면에만 적용됩니다.</p>`;
    panel.innerHTML=
      section('이미지·영상',mediaBlock)+
      section('움직임 · 진입 전환',effects)+
      (duration?section('장면 길이',duration):'')+
      videoAdvanced+
      section('장면 편집',sceneActions)+
      details('상세 설정',transform,'이미지·영상 크기 / 위치',false);
    $('v42ReplaceBtn').onclick=()=>$('v42ReplaceInput').click();
    $('v42ReplaceInput').onchange=async e=>{const f=e.target.files?.[0];if(f&&window.CutflowScene?.replace)await window.CutflowScene.replace(f);e.target.value='';requestRefresh(true);};
    panel.querySelectorAll('[data-media-volume]').forEach(btn=>btn.onclick=()=>{window.CutflowScene?.update?.(index,{mediaVolume:Number(btn.dataset.mediaVolume)});requestRefresh(false);});
    $('v42TransformReset').onclick=()=>{window.CutflowScene?.update?.(index,{transform:{scale:100,x:0,y:0}});requestRefresh(false);};
    $('v42SplitScene').onclick=()=>{const start=window.CutflowScene?.start?.(index)||0,duration=window.CutflowScene?.state?.(index)?.duration||0;let at=typeof currentTime==='function'?currentTime():start;if(!(at>start+.1&&at<start+duration-.1))at=start+duration/2;window.CutflowScene?.split?.(index,at);};
    $('v42MergeScene').onclick=()=>window.CutflowScene?.mergeNext?.(index);
    $('v42DeleteScene').onclick=()=>{if(confirm(`장면 ${index+1}을 삭제할까요?`))window.CutflowScene?.remove?.(index);};
  }
  function autoSetupMarkup(map=proxyMap){
    const preset=document.querySelector('input[name="autoSilencePreset"]:checked')?.value||'normal';
    const pc=(el,label,opts={})=>proxyControl(el,label,{...opts,map});
    const pb=(el,label,opts={})=>proxyButton(el,label,{...opts,map});
    const info=window.CutflowAutoSetup?.status?.()||{canStart:!$('autoStart')?.disabled,running:false,reason:''};
    const progressVisible=!$('autoProgress')?.hidden||info.running;
    const runText=progressVisible?($('autoStatus')?.textContent||''):(info.canStart?'준비 완료 · 자동 세팅을 시작할 수 있습니다.':info.reason||'');
    return `
      <div class="v42-auto-basics">
        <div class="v42-auto-title">${pc($('autoTitle'),'영상 제목',{wide:true})}</div>
        <div class="v42-grid2">${pc($('autoChannel'),'채널명')}${pc($('autoLayout'),'영상 템플릿')}</div>
      </div>
      <section class="v42-auto-flow-section v42-auto-script-section">
        <header><strong>대본 · 한 줄이 한 장면</strong></header>
        ${pc($('autoScript'),'대본 · 한 줄이 한 장면',{wide:true})}
        ${pc($('autoCaptionWrap'),'자막 보기 좋게 자동 줄바꿈')}
      </section>
      <section class="v42-auto-flow-section v42-auto-audio-section">
        <header><strong>내레이션·BGM</strong></header>
        <div class="v42-auto-audio-picks">
          <div><span class="pick-button">${pb($('autoNarrationBtn'),'내레이션 선택')}</span><small data-auto-status="narration">${esc($('autoNarrationName')?.textContent||'선택 안 됨')}</small></div>
          <div><span class="pick-button">${pb($('autoBgmBtn'),'BGM 선택')}</span><small data-auto-status="bgm">${esc($('autoBgmName')?.textContent||'선택 안 됨')}<em> · 선택사항</em></small></div>
        </div>
        <div class="v42-silence"><strong>내레이션 무음 줄이기</strong><div class="v42-pills" data-auto-silence>${[['soft','부드럽게'],['normal','보통'],['tight','타이트']].map(([v,l])=>`<label><input type="radio" name="v42AutoSilence" value="${v}" ${preset===v?'checked':''}><span>${l}</span></label>`).join('')}</div><p class="v42-help" data-auto-status="silence-info">${esc($('autoSilenceInfo')?.textContent||'')}</p></div>
      </section>
      <section class="v42-auto-flow-section v42-auto-images-section">
        <header class="v42-auto-images-head"><div class="v42-auto-images-title"><strong>장면 이미지</strong><small>그리드 분할 + 개별 이미지 혼합 가능</small></div><div class="v42-auto-image-buttons">${pb($('autoGridBtn'),'+ 그리드 이미지')}${pb($('autoSingleBtn'),'+ 개별 이미지')}</div></header>
        <div class="v42-auto-source-block">
          <div class="v42-auto-source-title"><strong>그리드 분할 이미지</strong><small data-auto-status="grid">${esc($('autoGridName')?.textContent||'선택 안 됨')}</small></div>
          <div class="v42-auto-grid-inline" data-settings-grid-mirror>${autoGridMirror()}</div>
        </div>
        <div class="v42-auto-source-block v42-auto-single-block">
          <div class="v42-auto-source-title"><strong>개별 이미지</strong><small data-auto-status="single">${esc($('autoSingleName')?.textContent||'선택 안 됨')}</small></div>
          <div data-settings-single-mirror>${autoSingleMirror()}</div>
        </div>
      </section>
      <div class="v42-auto-check"><span>대본 장면 <strong data-auto-status="script-count">${esc($('autoScriptCount')?.textContent||'0개')}</strong></span><span>장면 이미지 <strong data-auto-status="image-count">${esc($('autoImageCount')?.textContent||'0개')}</strong></span></div>
      <p class="v42-auto-match" data-auto-status="match">${esc($('autoMatch')?.textContent||'')}</p>
      <p class="v42-status" data-auto-status="run">${esc(runText)}</p>
      <div class="v42-auto-start-row"><button type="button" data-auto-start class="v42-btn primary" ${info.canStart?'':'disabled'}>쇼츠 자동 세팅 시작</button></div>`;
  }
  function syncSettingsProxyState(){
    if(!settingsDialog.open)return;
    for(const [k,source] of settingsProxyMap){
      const mirror=settingsDialog.querySelector(`[data-proxy="${k}"]`);
      if(!mirror||mirror===document.activeElement)continue;
      if(source.type==='checkbox')mirror.checked=source.checked;
      else if('value' in mirror)mirror.value=source.value;
      mirror.disabled=!!source.disabled;
    }
    const autoInfo=window.CutflowAutoSetup?.status?.()||{canStart:!$('autoStart')?.disabled,running:false,reason:''};
    const autoRunText=(!$('autoProgress')?.hidden||autoInfo.running)?($('autoStatus')?.textContent||''):(autoInfo.canStart?'준비 완료 · 자동 세팅을 시작할 수 있습니다.':autoInfo.reason||'');
    const statusMap={
      narration:$('autoNarrationName')?.textContent||'선택 안 됨',
      bgm:($('autoBgmName')?.textContent||'선택 안 됨')+' · 선택사항',
      grid:$('autoGridName')?.textContent||'선택 안 됨',
      single:$('autoSingleName')?.textContent||'선택 안 됨',
      'silence-info':$('autoSilenceInfo')?.textContent||'',
      'script-count':$('autoScriptCount')?.textContent||'0개',
      'image-count':$('autoImageCount')?.textContent||'0개',
      match:$('autoMatch')?.textContent||'',
      run:autoRunText
    };
    for(const [name,value] of Object.entries(statusMap)){
      const el=settingsDialog.querySelector(`[data-auto-status="${name}"]`);
      if(el)el.textContent=value;
    }
    const start=settingsDialog.querySelector('[data-auto-start]');if(start)start.disabled=!autoInfo.canStart;
    settingsDialog.querySelector('[data-cutflow-history="undo"]')?.toggleAttribute('disabled',!window.CutflowHistory?.canUndo);
    settingsDialog.querySelector('[data-cutflow-history="redo"]')?.toggleAttribute('disabled',!window.CutflowHistory?.canRedo);
  }
  function syncSettingsGridMirror(force=false){
    if(!settingsDialog.open)return;
    const gridHost=settingsDialog.querySelector('[data-settings-grid-mirror]');
    const singleHost=settingsDialog.querySelector('[data-settings-single-mirror]');
    const active=document.activeElement;
    if(gridHost&&(force||!(active&&gridHost.contains(active))))gridHost.innerHTML=autoGridMirror();
    if(singleHost&&(force||!(active&&singleHost.contains(active))))singleHost.innerHTML=autoSingleMirror();
  }
  function renderSettings(){
    settingsProxyMap.clear();
    const pc=(el,label,opts={})=>proxyControl(el,label,{...opts,map:settingsProxyMap});
    const pb=(el,label,opts={})=>proxyButton(el,label,{...opts,map:settingsProxyMap});
    const settingsSection=(step,title,body,status='')=>`<section class="v42-pc-settings-section"><header><div><span>${esc(step)}</span><strong>${esc(title)}</strong></div>${status?`<small>${esc(status)}</small>`:''}</header><div class="v42-pc-settings-body">${body}</div></section>`;
    const collapsibleSettingsSection=(step,title,body)=>`<details class="v42-pc-settings-section v42-pc-settings-collapsible v42-quick-start"><summary><div><span>${esc(step)}</span><strong>${esc(title)}</strong></div><em>자동 세팅 열기</em></summary><div class="v42-pc-settings-body">${body}</div></details>`;
    let waveformSrc='';try{waveformSrc=$('waveform')?.toDataURL?.('image/png')||'';}catch{}
    const topActions=`
      <div class="v42-settings-primary-actions">
        <button type="button" class="v42-btn primary" data-direct-click="uploadBtn">이미지·영상 추가</button>
        <button type="button" class="v42-btn" data-direct-click="demoBtn">샘플로 시작</button>
        <button type="button" class="v42-btn" data-direct-click="clearBtn">불러온 컷 비우기</button>
      </div>`;
    const source=`
      ${pc($('scriptInput'),'대본 · 한 줄이 한 자막 구간',{wide:true})}
      ${pc($('projectCaptionWrap'),'자막 보기 좋게 자동 줄바꿈')}
      <div class="v42-settings-file-row v42-left-file-action">${pb($('scriptFileBtn'),'TXT 대본 불러오기')}</div>
      <div class="v42-settings-file-row">${pb($('audioBtn'),'내레이션 오디오 불러오기',{wide:true})}</div>
      ${waveformSrc?`<div class="v42-settings-waveform"><img src="${waveformSrc}" alt="내레이션 파형"></div>`:''}
      ${pb($('buildCuesBtn'),'대본으로 자막 구간 만들기',{primary:true,wide:true})}
      <p class="v42-help">내레이션을 사용할 때는 대본 분량과 음성의 무음 구간으로 시간을 추정합니다. 내레이션이 없다면 장면을 추가하고 자막과 장면 길이를 직접 입력할 수 있습니다.</p>`;
    const bgm=`
      <div class="v42-actions v42-compact-actions v42-bgm-actions">${pb($('bgmBtn'),'음악 파일 추가')}${pb($('bgmRemove'),'음악 제거',{danger:true})}</div>
      <div class="v42-grid2">${pc($('bgmStart'),'음악 시작 지점 (초)')}${pc($('bgmVolume'),'BGM 볼륨')}${pc($('bgmRepeat'),'음악이 짧을 때')}${pc($('bgmFadeIn'),'페이드 인 (초)')}${pc($('bgmFadeOut'),'페이드 아웃 (초)')}</div>
      <p class="v42-help">${esc($('bgmSummary')?.textContent||'음악을 추가하면 쇼츠 길이에 맞춰 자동으로 잘립니다.')}</p>`;
    const stylePalette=(target)=>Object.values(window.CaptionStyle?.palette||{white:'#ffffff',yellow:'#f5e642',lime:'#c9ff57',sky:'#8ed1f5',red:'#e95a55',orange:'#ee9b45'}).map(c=>`<button type="button" data-settings-color-target="${target}" data-color="${c}" style="--swatch:${c}" aria-label="${c}"></button>`).join('');
    const titleStyle=`
      <div class="v42-pc-typo-grid">
        <div class="v42-typo-font">${pc($('titleFont'),'폰트')}</div>
        <div class="v42-typo-size">${pc($('titleSize'),'크기 (px)')}</div>
        <div class="full v42-typo-color-row"><span>색상</span><div class="v42-typo-color-controls"><div class="v42-settings-palette">${stylePalette('titleColor')}</div>${pc($('titleColor'),'직접 선택')}</div></div>
        ${pc($('titleX'),'가로 위치')}${pc($('titleY'),'세로 위치')}
        <div class="full v42-inline-checks">${pc($('titleBold'),'볼드')}${pc($('titleItalic'),'이탤릭')}</div>
        <div class="full v42-selection-style">
          <strong>선택 글자색</strong>
          <div class="v42-selection-row"><div class="v42-settings-palette">${stylePalette('titleSelectionColor')}</div>${pc($('titleSelectionColor'),'직접 선택')}${pb($('titleSelectionReset'),'해제')}</div>
          <small>제목에서 글자를 드래그한 뒤 적용하세요.</small>
        </div>
        <div class="full v42-stroke-row">${pc($('titleStrokeEnabled'),'스트로크 사용')}${pc($('titleStrokeWidth'),'두께')}</div>
      </div>
      <p class="v42-help">${esc($('titleFontNote')?.textContent||'')}</p>`;
    const channelStyle=`
      <div class="v42-pc-typo-grid">
        <div class="v42-typo-font">${pc($('channelFont'),'폰트')}</div>
        <div class="v42-typo-size">${pc($('channelSize'),'크기 (px)')}</div>
        <div class="full v42-typo-color-row"><span>색상</span><div class="v42-typo-color-controls"><div class="v42-settings-palette">${stylePalette('channelColor')}</div>${pc($('channelColor'),'직접 선택')}</div></div>
        ${pc($('channelX'),'가로 위치')}${pc($('channelY'),'세로 위치')}
        <div class="full v42-inline-checks">${pc($('channelBold'),'볼드')}${pc($('channelItalic'),'이탤릭')}</div>
        <div class="full v42-stroke-row">${pc($('channelStrokeEnabled'),'스트로크 사용')}${pc($('channelStrokeWidth'),'두께')}</div>
      </div>
      <p class="v42-help">${esc($('channelFontNote')?.textContent||'')}</p>`;
    const project=`
      <label class="v42-field"><span>화면 비율</span><div class="v42-format-lock">9:16 <small>세로형 고정</small></div></label>
      ${pc($('layoutSelect'),'영상 템플릿')}
      <p class="v42-help">${esc($('layoutDescription')?.textContent||'')}</p>
      <div class="v42-compose-title">${pc($('titleInput'),'상단 제목',{wide:true})}</div>
      <details class="v42-settings-details v42-pc-style-card" open><summary>제목 스타일 <small>폰트 · 크기 · 색상 · B · I · 스트로크</small></summary><div>${titleStyle}</div></details>
      ${pc($('channelInput'),'채널명 · 모든 템플릿',{wide:true})}
      <details class="v42-settings-details v42-pc-style-card" open><summary>채널명 스타일 <small>폰트 · 크기 · 색상 · B · I · 스트로크</small></summary><div>${channelStyle}</div></details>
      ${pc($('fitSelect'),'이미지·영상 맞춤')}
      ${pc($('templateSelect'),'움직임 프리셋')}
      <div class="v42-actions v42-compact-actions v42-motion-actions">${pb($('applyTemplateBtn'),'움직임만 전체 적용')}${pb($('randomMotionBtn'),'전체 이미지에 랜덤 무빙')}</div>
      <p class="v42-help">랜덤 무빙은 이미지에만 적용하며 영상의 움직임은 유지합니다.</p>
      <div class="v42-settings-stats"><span>출력 시간 <strong>${esc($('totalDuration')?.textContent||'0.0초')}</strong></span><span>반복 움직임 <strong>${esc($('repeatCount')?.textContent||'없음')}</strong></span></div>
      <p class="v42-help">${esc($('timingNotice')?.textContent||'')}</p>
      <div class="v42-fitcuts-action">${pb($('fitCutsBtn'),'자막 순서대로 컷 다시 연결')}</div>`;
    const output=`
      <p class="v42-export-copy">제목·자막·이미지·영상 컷·영상 원음·내레이션·BGM을 하나의 영상으로 저장합니다. 첫 저장 시 약 32MB의 인코더를 내려받습니다. 파일은 외부로 전송하지 않습니다.</p>
      <div class="v42-grid2">${pc($('resolutionSelect'),'출력 해상도')}${pb($('exportBtn'),'MP4 영상 저장',{primary:true,wide:true})}</div>`;
    $('v42SettingsBody').innerHTML=
      topActions+
      collapsibleSettingsSection('QUICK START','✨ 쇼츠 자동 세팅',autoSetupMarkup(settingsProxyMap))+
      settingsSection('01 SCRIPT & VOICE','대본과 내레이션',source,$('audioStatus')?.textContent||'오디오 없음')+
      settingsSection('AUDIO','배경음악 · BGM',bgm,$('bgmStatus')?.textContent||'음악 없음')+
      settingsSection('02 COMPOSE','화면 구성',project,$('sceneCount')?.textContent||'')+
      settingsSection('03 EXPORT','완성한 쇼츠를 MP4로.',output);
    syncSettingsProxyState();
  }
  function renderPanel(force=false){
    if(!force&&panel.contains(document.activeElement))return;
    panel.hidden=false;panel.dataset.activeTab=tab;
    try{
      if(tab==='caption')renderCaption(); else if(tab==='media')renderMedia(); else renderTiming();
      panel.dataset.renderState='ready';
    }catch(error){
      console.error('Cutflow mobile panel render failed',tab,error);
      proxyMap.clear();
      panel.dataset.renderState='error';
      panel.innerHTML=section('편집창을 불러오지 못했습니다.',`<p class="v42-help">현재 탭을 다시 불러오세요.</p><button type="button" id="v42PanelRetry" class="v42-btn primary wide">다시 불러오기</button>`,'MOBILE');
      $('v42PanelRetry').onclick=()=>renderPanel(true);
    }
  }
  function ensurePanelVisible(){
    const rect=panel.getBoundingClientRect(),nav=tabs.getBoundingClientRect(),vh=window.visualViewport?.height||window.innerHeight;
    const visibleBottom=Math.min(nav.top||vh,vh)-8;
    if(rect.top>=visibleBottom||rect.bottom<=0)panel.scrollIntoView({block:'nearest',inline:'nearest',behavior:'auto'});
  }
  function requestRefresh(force=false){
    if(renderQueued&&!force)return;renderQueued=true;requestAnimationFrame(()=>{renderQueued=false;renderSceneStrip();renderPanel(force);syncPlayer();});
  }
  function syncPlayer(){
    const state=window.CutflowPlayer?.state?.(),m=$('v42Scrubber');
    if(state&&m){
      const progress=Math.max(0,Math.min(1,Number(state.progress)||0));
      if(document.activeElement!==m){m.min='0';m.max='1000';m.value=String(Math.round(progress*1000));}
      m.style.setProperty('--v42-progress',`${progress*100}%`);
    }
    const ct=$('currentTime')?.textContent||'0:00.0',et=$('endTime')?.textContent||'0:00.0';$('v42TimeLabel').textContent=`${ct} / ${et}`;
    const label=state?.playing?'Ⅱ':'▶';
    const mobilePlay=$('v42Play');if(mobilePlay)mobilePlay.textContent=label;
    const fullPlay=$('v42FullPlay');if(fullPlay)fullPlay.textContent=label;
  }
  let lastMirrorAt=0;
  function mirrorStage(frameNow=performance.now()){
    if(frameNow-lastMirrorAt>=33){
      lastMirrorAt=frameNow;
      const src=$('stage');if(src&&ctx){try{ctx.clearRect(0,0,stage.width,stage.height);ctx.drawImage(src,0,0,stage.width,stage.height);if(!previewDialog.hidden){fullCtx.clearRect(0,0,1080,1920);fullCtx.drawImage(src,0,0,1080,1920);}}catch{}}
      syncPlayer();
    }
    requestAnimationFrame(mirrorStage);
  }

  function proxyInput(e,map){const k=e.target.dataset.proxy,el=map.get(k);if(!el)return false;if(el.type==='checkbox')el.checked=e.target.checked;else el.value=e.target.value;dispatch(el,'input');return true;}
  function proxyChange(e,map){const k=e.target.dataset.proxy,el=map.get(k);if(!el)return false;if(el.type==='checkbox')el.checked=e.target.checked;else el.value=e.target.value;dispatch(el,'change');return true;}
  function applyMediaField(el){
    const field=el?.dataset?.mediaField;if(!field)return false;
    const index=currentScene().index,api=window.CutflowScene;if(!api?.update)return false;
    if(field==='scale'||field==='x'||field==='y')api.update(index,{transform:{[field]:Number(el.value)}});
    else if(field==='mediaMuted')api.update(index,{mediaMuted:el.checked});
    else if(['trimStart','trimEnd','mediaVolume','mediaFadeIn','mediaFadeOut'].includes(field))api.update(index,{[field]:Number(el.value)});
    else api.update(index,{[field]:el.value});
    return true;
  }
  function applyComposeField(el){
    const field=el?.dataset?.composeField;if(!field||!window.CutflowCompose?.update)return false;
    window.CutflowCompose.update({[field]:el.value});return true;
  }
  function applyTypographyField(el){
    const kind=el?.dataset?.typoKind,field=el?.dataset?.typoField;if(!kind||!field||!window.CutflowTypography?.update)return false;
    const value=el.type==='checkbox'?el.checked:['size','strokeWidth','x','y'].includes(field)?Number(el.value):el.value;
    window.CutflowTypography.update(kind,{[field]:value});return true;
  }
  function applyBgmField(el){
    const field=el?.dataset?.bgmField;if(!field||!window.CutflowBgm?.update)return false;
    const value=field==='repeat'?el.value:Number(el.value);
    window.CutflowBgm.update({[field]:value});return true;
  }
  function handleAutoInput(e,refresh){
    const card=e.target.closest?.('[data-auto-grid]');
    if(card&&e.target.dataset.autoField){
      const i=Number(card.dataset.autoGrid),patch={[e.target.dataset.autoField]:e.target.value};
      window.CutflowAutoSetup?.setGrid?.(i,patch);setTimeout(refresh,0);return true;
    }
    if(e.target.name==='v42AutoSilence'){const target=document.querySelector(`input[name="autoSilencePreset"][value="${e.target.value}"]`);if(target){target.checked=true;dispatch(target,'change');setTimeout(refresh,0);}return true;}
    return false;
  }
  function handleAutoClick(e,refresh){
    const singleAction=e.target.closest?.('[data-auto-single-action]');
    if(singleAction){
      const card=singleAction.closest('[data-auto-single]'),i=Number(card?.dataset.autoSingle);
      let changed=false;
      if(Number.isFinite(i)&&singleAction.dataset.autoSingleAction==='remove')changed=!!window.CutflowAutoSetup?.removeSingle?.(i);
      if(changed){singleAction.blur?.();syncSettingsGridMirror(true);}
      setTimeout(refresh,0);return true;
    }
    const action=e.target.closest?.('[data-auto-action]');if(!action)return false;
    const card=action.closest('[data-auto-grid]'),i=Number(card?.dataset.autoGrid);
    let changed=false;
    if(Number.isFinite(i)){
      if(action.dataset.autoAction==='reset')changed=!!window.CutflowAutoSetup?.resetGrid?.(i);
      else if(action.dataset.autoAction==='remove')changed=false;
    }
    if(changed){action.blur?.();syncSettingsGridMirror(true);}
    setTimeout(refresh,0);return true;
  }

  app.addEventListener('click',e=>{
    const click=e.target.closest('[data-click]');if(click){const source=$(click.dataset.click),fileTarget=fileTargetFor(source);if(fileTarget&&openFileTarget(fileTarget))return;source?.click();return;}
    const proxy=e.target.closest('[data-proxy-click]');if(proxy){const fileTarget=proxy.dataset.fileTarget;if(fileTarget&&openFileTarget(fileTarget))return;proxyMap.get(proxy.dataset.proxyClick)?.click();setTimeout(()=>requestRefresh(true),0);return;}
    const scene=e.target.closest('[data-scene]');if(scene){const i=Number(scene.dataset.scene);lastSceneId=null;sceneIndex=i;window.CutflowScene?.select?.(i);requestRefresh(true);return;}
  });
  panel.addEventListener('input',e=>{if(e.target.dataset.bgmField&&['volume'].includes(e.target.dataset.bgmField)){applyBgmField(e.target);return;}if(e.target.dataset.composeField&&['title','channel'].includes(e.target.dataset.composeField)){applyComposeField(e.target);return;}if(e.target.dataset.typoField&&['color','x','y'].includes(e.target.dataset.typoField)){applyTypographyField(e.target);return;}const cf=e.target.dataset.captionField;if(cf==='text'){window.CutflowCaption?.update?.(window.CutflowCaption.currentIndex(),{text:e.target.value});return;}const f=e.target.dataset.mediaField;if(f&&['scale','x','y','mediaVolume','mediaFadeIn','mediaFadeOut'].includes(f)){applyMediaField(e.target);return;}proxyInput(e,proxyMap);});
  panel.addEventListener('change',e=>{if(e.target.dataset.bgmField){applyBgmField(e.target);setTimeout(()=>requestRefresh(false),0);return;}if(e.target.dataset.composeField){applyComposeField(e.target);setTimeout(()=>requestRefresh(false),0);return;}if(e.target.dataset.typoField){applyTypographyField(e.target);setTimeout(()=>requestRefresh(false),0);return;}const cf=e.target.dataset.captionField;if(cf){window.CutflowCaption?.update?.(window.CutflowCaption.currentIndex(),{[cf]:cf==='color'?e.target.value:Number(e.target.value)});setTimeout(()=>requestRefresh(false),0);return;}if(e.target.dataset.mediaField){applyMediaField(e.target);setTimeout(()=>requestRefresh(false),0);return;}if(proxyChange(e,proxyMap))setTimeout(()=>requestRefresh(false),0);});
  panel.addEventListener('click',e=>{
    const typoColor=e.target.closest('[data-typo-palette] [data-color]');if(typoColor){const kind=typoColor.closest('[data-typo-palette]').dataset.typoPalette;window.CutflowTypography?.update?.(kind,{color:typoColor.dataset.color});requestRefresh(false);return;}
    const sw=e.target.closest('[data-color-target] [data-color]');if(sw){const wrap=sw.closest('[data-color-target]'),el=$(wrap.dataset.colorTarget);if(el){el.value=sw.dataset.color;dispatch(el,'input');dispatch(el,'change');requestRefresh(false);}return;}
    handleAutoClick(e,()=>requestRefresh(true));
  });
  panel.addEventListener('input',e=>{handleAutoInput(e,()=>requestRefresh(true));});
  $('v42Settings').onclick=()=>{renderSettings();settingsDialog.showModal();requestAnimationFrame(()=>{$('v42SettingsBody').scrollTop=0;syncSettingsProxyState();});};
  $('v42SettingsClose').onclick=()=>settingsDialog.close();
  settingsDialog.addEventListener('cancel',e=>{e.preventDefault();settingsDialog.close();});
  $('v42SettingsBody').addEventListener('click',e=>{
    const del=e.target.closest('[data-auto-grid-delete]');
    if(!del)return;
    e.preventDefault();
    e.stopPropagation();
    const card=del.closest('[data-auto-grid]');
    const i=Number(card?.dataset.autoGrid);
    if(!Number.isFinite(i))return;
    const removed=window.CutflowAutoSetup?.removeGrid?.(i);
    if(removed){
      card?.remove();
      syncSettingsGridMirror(true);
      syncSettingsProxyState();
    }
  },true);
  $('v42SettingsBody').addEventListener('click',e=>{
    const settingsColor=e.target.closest('[data-settings-color-target][data-color]');
    if(settingsColor){const targetId=settingsColor.dataset.settingsColorTarget,source=$(targetId);if(source){source.value=settingsColor.dataset.color;dispatch(source,'input');dispatch(source,'change');if(targetId==='titleSelectionColor')$('titleSelectionApply')?.click();syncSettingsProxyState();}return;}
    const history=e.target.closest('[data-cutflow-history]');
    if(history){window.CutflowHistory?.[history.dataset.cutflowHistory]?.();setTimeout(syncSettingsProxyState,0);return;}
    const autoStart=e.target.closest('[data-auto-start]');
    if(autoStart){window.CutflowAutoSetup?.run?.();syncSettingsProxyState();return;}
    const silence=e.target.closest('[data-settings-silence-run]');
    if(silence){const statusEl=settingsDialog.querySelector('[data-settings-silence-status]');(async()=>{try{const p=settingsDialog.querySelector('input[name="v42SettingsSilence"]:checked')?.value||'normal';statusEl.textContent='무음 구간 분석 중…';const result=await window.CutflowAutoBridge?.processNarration?.(p,m=>statusEl.textContent=m);if(!result)throw new Error('무음컷을 실행하지 못했습니다.');statusEl.textContent=`완료 · ${result.originalDuration.toFixed(1)}초 → ${result.processedDuration.toFixed(1)}초`;requestRefresh(true);syncSettingsProxyState();}catch(err){statusEl.textContent=`처리 실패: ${err.message}`;}})();return;}
    const direct=e.target.closest('[data-direct-click]');if(direct){const source=$(direct.dataset.directClick),fileTarget=fileTargetFor(source);if(fileTarget&&openFileTarget(fileTarget))return;source?.click();return;}
    const proxy=e.target.closest('[data-proxy-click]');if(proxy){const fileTarget=proxy.dataset.fileTarget;if(fileTarget&&openFileTarget(fileTarget))return;settingsProxyMap.get(proxy.dataset.proxyClick)?.click();setTimeout(()=>{syncSettingsProxyState();syncSettingsGridMirror();},0);return;}
    handleAutoClick(e,()=>{syncSettingsProxyState();syncSettingsGridMirror();});
  });
  $('v42SettingsBody').addEventListener('input',e=>{proxyInput(e,settingsProxyMap);handleAutoInput(e,()=>{syncSettingsProxyState();syncSettingsGridMirror();});});
  $('v42SettingsBody').addEventListener('select',e=>{const k=e.target?.dataset?.proxy,source=k?settingsProxyMap.get(k):null;if(source===$('titleInput')&&typeof source.setSelectionRange==='function')source.setSelectionRange(e.target.selectionStart||0,e.target.selectionEnd||0);},true);
  $('v42SettingsBody').addEventListener('change',e=>{proxyChange(e,settingsProxyMap);setTimeout(syncSettingsProxyState,0);});
  let mobileGridDrag=null;
  $('v42SettingsBody').addEventListener('pointerdown',e=>{
    const line=e.target.closest('[data-auto-cut]');if(!line)return;
    const card=line.closest('[data-auto-grid]'),preview=line.closest('.v42-grid-preview');if(!card||!preview)return;
    mobileGridDrag={index:Number(card.dataset.autoGrid),axis:line.dataset.autoCut,cutIndex:Number(line.dataset.cutIndex),preview,line,pointerId:e.pointerId};
    line.setPointerCapture?.(e.pointerId);line.classList.add('dragging');e.preventDefault();
  });
  $('v42SettingsBody').addEventListener('pointermove',e=>{
    if(!mobileGridDrag)return;const d=mobileGridDrag,r=d.preview.getBoundingClientRect();
    const pct=d.axis==='x'?(e.clientX-r.left)/r.width*100:(e.clientY-r.top)/r.height*100;
    if(window.CutflowAutoSetup?.setCut?.(d.index,d.axis,d.cutIndex,pct)){d.line.style[d.axis==='x'?'left':'top']=`${Math.max(0,Math.min(100,pct))}%`;}
  });
  const endMobileGridDrag=()=>{if(!mobileGridDrag)return;window.CutflowAutoSetup?.setCut?.(mobileGridDrag.index,mobileGridDrag.axis,mobileGridDrag.cutIndex,parseFloat(mobileGridDrag.line.style[mobileGridDrag.axis==='x'?'left':'top'])||0,{commit:true});mobileGridDrag.line.classList.remove('dragging');mobileGridDrag=null;syncSettingsGridMirror();};
  $('v42SettingsBody').addEventListener('pointerup',endMobileGridDrag);
  $('v42SettingsBody').addEventListener('pointercancel',endMobileGridDrag);
  tabs.addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(!b)return;const timingHost=$('v42TimingHost');if(timingHost)window.CutflowTiming?.unmount?.(timingHost);tab=b.dataset.tab;qsa('button',tabs).forEach(x=>x.setAttribute('aria-pressed',String(x===b)));renderPanel(true);requestAnimationFrame(ensurePanelVisible);});
  $('v42AddScene').onclick=()=>$('fileInput')?.click();
  $('v42Undo').onclick=()=>window.CutflowHistory?.undo?.();
  $('v42Redo').onclick=()=>window.CutflowHistory?.redo?.();
  const syncPreviewHistory=()=>{const undo=$('v42Undo'),redo=$('v42Redo');if(undo)undo.disabled=!window.CutflowHistory?.canUndo;if(redo)redo.disabled=!window.CutflowHistory?.canRedo;};
  syncPreviewHistory();
  const bindMobileTap=(el,handler)=>{
    if(!el)return;
    let lastPointer=0;
    el.addEventListener('pointerup',e=>{
      if(e.pointerType==='mouse')return;
      lastPointer=performance.now();
      e.preventDefault();e.stopPropagation();
      handler(e);
    },{passive:false});
    el.addEventListener('click',e=>{
      if(performance.now()-lastPointer<650){e.preventDefault();e.stopPropagation();return;}
      e.preventDefault();e.stopPropagation();
      handler(e);
    });
  };
  const selectAdjacentScene=delta=>{
    window.CutflowPlayer?.pause?.();
    const {items,index}=currentScene();
    if(items.length)window.CutflowScene?.select?.(Math.max(0,Math.min(items.length-1,index+delta)));
    requestAnimationFrame(()=>{syncPlayer();requestRefresh(true);});
  };
  bindMobileTap($('v42PrevScene'),()=>selectAdjacentScene(-1));
  bindMobileTap($('v42NextScene'),()=>selectAdjacentScene(1));
  function setSourcePreviewSize(width,height){
    const sourcePreview=$('stage');
    if(!sourcePreview)return;
    if(sourcePreview.width!==width||sourcePreview.height!==height){
      sourcePreview.width=width;
      sourcePreview.height=height;
      window.CutflowPlayer?.invalidate?.();
    }
  }
  function openPreviewFullscreen(){
    setSourcePreviewSize(1080,1920);
    previewDialog.hidden=false;
    document.body.classList.add('v42-preview-lock');
    syncPlayer();
    requestAnimationFrame(()=>$('v42FullPlay')?.focus?.({preventScroll:true}));
  }
  function closePreviewFullscreen(){
    window.CutflowPlayer?.pause?.();
    previewDialog.hidden=true;
    document.body.classList.remove('v42-preview-lock');
    setSourcePreviewSize(window.CutflowUI?.mobileActive?540:1080,window.CutflowUI?.mobileActive?960:1920);
    requestAnimationFrame(()=>{syncPlayer();window.CutflowPlayer?.invalidate?.();});
  }
  bindMobileTap($('v42Fullscreen'),openPreviewFullscreen);
  bindMobileTap($('v42FullClose'),closePreviewFullscreen);
  bindMobileTap($('v42FullPlay'),()=>{window.CutflowPlayer?.toggle?.();requestAnimationFrame(syncPlayer);});
  $('v42Scrubber').addEventListener('input',e=>window.CutflowPlayer?.seekProgress?.(Number(e.target.value)/1000));
  $('v42Scrubber').addEventListener('change',e=>window.CutflowPlayer?.seekProgress?.(Number(e.target.value)/1000));

  let mobileExportBlob=null,mobileExportFilename='',mobileExportUrl='';
  const resetMobileExport=()=>{
    if(mobileExportUrl){URL.revokeObjectURL(mobileExportUrl);mobileExportUrl='';}
    mobileExportBlob=null;mobileExportFilename='';$('v42ExportProgress').value=0;$('v42ExportStatus').textContent='준비 중…';$('v42ExportResult').hidden=true;$('v42ExportResult').textContent='';$('v42ExportCancel').hidden=false;$('v42ExportShare').hidden=true;$('v42ExportDownload').hidden=true;$('v42ExportDone').hidden=true;
  };
  bindMobileTap($('v42Play'),()=>{window.CutflowPlayer?.toggle?.();requestAnimationFrame(syncPlayer);});
  $('v42Export').onclick=()=>{resetMobileExport();exportDialogV42.showModal();window.CutflowExport?.start?.();};
  $('v42ExportCancel').onclick=()=>window.CutflowExport?.cancel?.();
  $('v42ExportClose').onclick=()=>{if(!window.CutflowExport?.busy)exportDialogV42.close();};
  $('v42ExportDone').onclick=()=>exportDialogV42.close();
  exportDialogV42.addEventListener('cancel',e=>{if(window.CutflowExport?.busy){e.preventDefault();window.CutflowExport.cancel();}});
  $('v42ExportShare').onclick=async()=>{
    if(!mobileExportBlob)return;
    const file=new File([mobileExportBlob],mobileExportFilename||'Cutflow.mp4',{type:'video/mp4'});
    try{
      if(navigator.canShare?.({files:[file]})&&navigator.share){await navigator.share({files:[file],title:'Cutflow MP4'});$('v42ExportStatus').textContent='공유/저장 창을 열었습니다.';return;}
    }catch(err){if(err?.name==='AbortError')return;}
    $('v42ExportDownload').click();
  };

  for(const id of ['cueList','sceneList','projectSaveStatus','bgmStatus','bgmSummary','audioStatus','autoGridList','autoSingleList','autoGridName','autoSingleName','autoNarrationName','autoMatch','autoScriptCount','autoImageCount','autoSilenceInfo','autoStatus']){const el=$(id);if(el)new MutationObserver(()=>{const active=document.activeElement,isBgmMutation=(id==='bgmStatus'||id==='bgmSummary'),editingBgm=!!active?.dataset?.bgmField||(settingsDialog.open&&!!active?.dataset?.proxy&&settingsDialog.contains(active));if(!(isBgmMutation&&editingBgm))requestRefresh(false);if(settingsDialog.open){syncSettingsProxyState();if(!isBgmMutation)syncSettingsGridMirror();}}).observe(el,{subtree:true,childList:true,attributes:true});}
  window.addEventListener('cutflow-scene',e=>{sceneIndex=Number(e.detail)||0;lastSceneId=null;requestRefresh(true);requestAnimationFrame(()=>followSelectedScene('smooth'));});
  window.addEventListener('cutflow-scene-updated',()=>requestRefresh(false));
  window.addEventListener('cutflow-caption-updated',()=>requestRefresh(false));
  window.addEventListener('cutflow-caption-style-updated',()=>requestRefresh(false));
  window.addEventListener('cutflow-compose-updated',()=>requestRefresh(false));
  window.addEventListener('cutflow-typography-updated',()=>requestRefresh(false));
  window.addEventListener('cutflow-bgm-updated',()=>{
    const active=document.activeElement;
    const editingBgm=!!active?.dataset?.bgmField;
    const editingSettingsBgm=settingsDialog.open&&!!active?.dataset?.proxy&&settingsDialog.contains(active);
    if(editingBgm||editingSettingsBgm){if(settingsDialog.open)syncSettingsProxyState();return;}
    requestRefresh(false);
  });
  window.addEventListener('cutflow-auto-status',e=>{const el=settingsDialog.querySelector('[data-auto-status="run"]');if(el)el.textContent=e.detail?.text||'';});
  window.addEventListener('cutflow-auto-error',e=>{if(!settingsDialog.open){renderSettings();settingsDialog.showModal();}const el=settingsDialog.querySelector('[data-auto-status="run"]');if(el)el.textContent=e.detail?.message?'자동 세팅 중단: '+e.detail.message:'자동 세팅이 중단되었습니다.';});
  window.addEventListener('cutflow-auto-complete',e=>{const detail=e.detail||{};const el=settingsDialog.querySelector('[data-auto-status="run"]');if(el)el.textContent='완료 · 장면 '+(detail.sceneCount||0)+'개 · 자막 '+(detail.cueCount||0)+'개';requestRefresh(true);requestAnimationFrame(()=>{followSelectedScene('smooth');ensurePanelVisible();});});
  window.addEventListener('cutflow-export-start',e=>{if(!exportDialogV42.open)exportDialogV42.showModal();$('v42ExportStatus').textContent=(e.detail?.width||'')+'p MP4 준비 중…';$('v42ExportCancel').hidden=false;});
  window.addEventListener('cutflow-export-progress',e=>{$('v42ExportProgress').value=Number(e.detail?.progress)||0;$('v42ExportStatus').textContent=e.detail?.message||'MP4 만드는 중…';});
  window.addEventListener('cutflow-export-complete',e=>{mobileExportBlob=e.detail?.blob||null;mobileExportFilename=e.detail?.filename||'Cutflow.mp4';$('v42ExportProgress').value=1;$('v42ExportStatus').textContent='MP4 완성';$('v42ExportCancel').hidden=true;$('v42ExportDone').hidden=false;const result=$('v42ExportResult');result.hidden=false;result.textContent=(e.detail?.width||'')+'p · '+((e.detail?.size||0)/1024/1024).toFixed(1)+'MB';const dl=$('v42ExportDownload');if(mobileExportBlob){mobileExportUrl=URL.createObjectURL(mobileExportBlob);dl.href=mobileExportUrl;dl.download=mobileExportFilename;dl.hidden=false;const file=new File([mobileExportBlob],mobileExportFilename,{type:'video/mp4'});$('v42ExportShare').hidden=!(navigator.canShare?.({files:[file]})&&navigator.share);}});
  window.addEventListener('cutflow-export-error',e=>{if(!exportDialogV42.open)exportDialogV42.showModal();$('v42ExportStatus').textContent=e.detail?.message||'MP4 저장에 실패했습니다.';$('v42ExportCancel').hidden=true;$('v42ExportDone').hidden=false;});
  window.addEventListener('cutflow-export-cancelled',()=>{$('v42ExportStatus').textContent='저장을 취소했습니다. 편집 내용은 유지됩니다.';$('v42ExportCancel').hidden=true;$('v42ExportDone').hidden=false;});
  $('projectDialog')?.addEventListener('close',()=>setTimeout(()=>requestRefresh(false),0));
  const syncAfterProjectRestore=()=>{
    const items=window.CutflowScene?.items?.()||[];
    sceneIndex=Math.max(0,Math.min(sceneIndex,Math.max(0,items.length-1)));
    lastSceneId=null;
    const timingHost=$('v42TimingHost');if(timingHost)window.CutflowTiming?.unmount?.(timingHost);
    requestRefresh(true);
    if(settingsDialog.open){syncSettingsProxyState();syncSettingsGridMirror();}
    requestAnimationFrame(()=>followSelectedScene('auto'));
  };
  window.addEventListener('cutflow-project-restored',syncAfterProjectRestore);
  window.addEventListener('cutflow-project-loaded',syncAfterProjectRestore);
  window.addEventListener('cutflow-history-updated',()=>{syncPreviewHistory();if(settingsDialog.open)syncSettingsProxyState();});
  for(const id of ['scriptInput','projectCaptionWrap','audioInput','scriptFile','bgmInput','autoNarration','autoGrids','autoSingles','autoBgm']){
    const el=$(id);if(!el)continue;
    el.addEventListener(id==='scriptInput'||id==='projectCaptionWrap'?'input':'change',()=>setTimeout(()=>{requestRefresh(false);if(settingsDialog.open){syncSettingsProxyState();syncSettingsGridMirror();}},id==='audioInput'?350:40));
  }
  window.addEventListener('cutflow-auto-grid-change',()=>{if(settingsDialog.open){syncSettingsGridMirror(true);syncSettingsProxyState();}});
  window.addEventListener('cutflow-auto-state',()=>{if(settingsDialog.open)syncSettingsProxyState();});
  window.addEventListener('cutflow-auto-ready',()=>{if(settingsDialog.open){syncSettingsProxyState();syncSettingsGridMirror();}});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)requestRefresh(false);});
  window.addEventListener('pageshow',()=>requestRefresh(false));
  setInterval(syncPlayer,200);
  renderSceneStrip();renderPanel(true);syncPlayer();mirrorStage();requestAnimationFrame(()=>revealCutflowUI());
})();
