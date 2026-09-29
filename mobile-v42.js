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
  const lockedMobile=!!(mobileUA||ipadDesktop||touchHandheld);
  const isMobile=()=>lockedMobile;
  window.CutflowUI=window.CutflowUI||{};
  window.CutflowUI.mode=lockedMobile?'mobile':'desktop';
  window.CutflowUI.isMobileDevice=isMobile;

  if(!lockedMobile)return;
  document.body.classList.add('v42-mobile');
  document.body.classList.remove('mobile-editor');

  const app=document.createElement('div');
  app.id='mobileAppV42';
  app.innerHTML=`
    <header class="v42-head">
      <div class="v42-brand"><span class="v42-brand-mark" aria-hidden="true"></span><div><strong>Cutflow</strong><small>쇼츠 컷 편집 스튜디오</small></div></div>
      <div class="v42-head-actions">
        <button type="button" id="v42Settings" class="v42-icon-btn" aria-label="설정" title="설정">⚙</button>
        <button type="button" data-click="projectOpenBtn">열기</button>
        <button type="button" data-click="projectSaveBtn">저장</button>
        <button type="button" id="v42Export" class="primary">내보내기</button>
      </div>
    </header>
    <main class="v42-main">
      <section class="v42-preview-card">
        <div class="v42-preview-head"><strong>미리보기</strong><span id="v42TimeLabel">0:00.0 / 0:00.0</span></div>
        <div class="v42-stage-wrap"><canvas id="v42Stage" width="360" height="640" aria-label="모바일 영상 미리보기"></canvas></div>
        <div class="v42-player">
          <button type="button" id="v42Play" class="play" aria-label="재생">▶</button>
          <button type="button" id="v42Fullscreen" class="v42-fullscreen-icon" aria-label="전체화면 미리보기" title="전체화면 미리보기">⛶</button>
        </div>
        <input id="v42Scrubber" class="v42-scrubber" type="range" min="0" max="1000" value="0" aria-label="재생 위치">
        <div class="v42-scene-nav"><button type="button" id="v42PrevScene">이전</button><strong id="v42SceneLabel">장면 0 / 0</strong><button type="button" id="v42NextScene">다음</button></div>
      </section>
      <section class="v42-scenes-card">
        <div class="v42-scenes-head"><strong>장면</strong><button id="v42AllScenes" type="button">전체 장면</button></div>
        <div class="v42-scenes-row"><div id="v42SceneStrip" class="v42-scene-strip"></div><button id="v42AddScene" type="button" class="v42-add-scene" aria-label="장면 추가">＋</button></div>
      </section>
      <nav id="v42Tabs" class="v42-tabs" aria-label="모바일 편집 탭">
        <button type="button" data-tab="caption" aria-pressed="true"><span>T</span>자막</button>
        <button type="button" data-tab="media"><span>▧</span>미디어</button>
        <button type="button" data-tab="narration"><span>●</span>내레이션</button>
        <button type="button" data-tab="template"><span>Aa</span>템플릿</button>
        <button type="button" data-tab="bgm"><span>♪</span>BGM</button>
      </nav>
      <section id="v42Panel" class="v42-panel"></section>
    </main>`;
  document.body.append(app);
  const previewDialog=document.createElement('dialog');
  previewDialog.id='v42PreviewDialog';
  previewDialog.innerHTML='<div class="v42-full-head"><strong>전체화면 미리보기</strong><button type="button" id="v42FullClose">×</button></div><canvas id="v42FullStage" width="360" height="640"></canvas>';
  document.body.append(previewDialog);
  const exportDialogV42=document.createElement('dialog');
  exportDialogV42.id='v42ExportDialog';
  exportDialogV42.innerHTML='<div class="v42-sheet-head"><div><strong>MP4 내보내기</strong><small>Cutflow</small></div><button type="button" id="v42ExportClose" aria-label="닫기">×</button></div><div class="v42-export-body"><progress id="v42ExportProgress" max="1" value="0"></progress><p id="v42ExportStatus" class="v42-status">준비 중…</p><div id="v42ExportResult" class="v42-export-result" hidden></div><div class="v42-actions"><button type="button" id="v42ExportCancel" class="v42-btn danger">취소</button><button type="button" id="v42ExportShare" class="v42-btn primary" hidden>iPhone에 저장/공유</button><a id="v42ExportDownload" class="v42-btn primary" hidden>MP4 다운로드</a><button type="button" id="v42ExportDone" class="v42-btn" hidden>닫기</button></div></div>';
  document.body.append(exportDialogV42);
  const scenesDialog=document.createElement('dialog');
  scenesDialog.id='v42ScenesDialog';
  scenesDialog.innerHTML='<div class="v42-sheet-head"><strong>전체 장면</strong><button type="button" id="v42ScenesClose">×</button></div><div id="v42ScenesGrid" class="v42-scenes-grid"></div>';
  document.body.append(scenesDialog);
  const settingsDialog=document.createElement('dialog');
  settingsDialog.id='v42SettingsDialog';
  settingsDialog.innerHTML='<div class="v42-sheet-head"><div><strong>프로젝트 설정</strong><small>Cutflow</small></div><button type="button" id="v42SettingsClose" aria-label="닫기">×</button></div><div id="v42SettingsBody" class="v42-settings-body"></div>';
  document.body.append(settingsDialog);

  const panel=$('v42Panel'),tabs=$('v42Tabs'),stage=$('v42Stage'),ctx=stage.getContext('2d'),fullStage=$('v42FullStage'),fullCtx=fullStage.getContext('2d');
  const proxyMap=new Map(),settingsProxyMap=new Map();
  let tab='caption',sceneIndex=0,lastSceneId=null,renderQueued=false,captionMode='edit';

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
    if(!grids.length)return '<p class="v42-help">그리드 이미지를 추가하면 PC와 동일한 분할 미리보기와 조절선이 표시됩니다.</p>';
    return grids.map(g=>{
      const x=g.xCuts.map((p,i)=>`<button type="button" class="v42-cut-line v42-cut-x" data-auto-cut="x" data-cut-index="${i}" style="left:${p}%" aria-label="세로 분할선 ${i+1}"></button>`).join('');
      const y=g.yCuts.map((p,i)=>`<button type="button" class="v42-cut-line v42-cut-y" data-auto-cut="y" data-cut-index="${i}" style="top:${p}%" aria-label="가로 분할선 ${i+1}"></button>`).join('');
      return `<article class="v42-grid-source" data-auto-grid="${g.index}">
        <div class="v42-grid-source-head"><div><strong>${esc(g.name)}</strong><small>${g.cols}×${g.rows} · ${g.cols*g.rows}장</small></div></div>
        <div class="v42-grid3"><label class="v42-field"><span>열</span><input type="number" min="1" max="12" value="${g.cols}" data-auto-field="cols"></label><label class="v42-field"><span>행</span><input type="number" min="1" max="12" value="${g.rows}" data-auto-field="rows"></label><label class="v42-field"><span>여백(px)</span><input type="number" min="0" max="40" value="${g.gap}" data-auto-field="gap"></label></div>
        <div class="v42-grid-preview" style="aspect-ratio:${g.width||4}/${g.height||2}"><img src="${esc(g.url||'')}" alt=""><div class="v42-grid-lines">${x}${y}</div></div>
        <p class="v42-help">노란 분할선을 손가락으로 움직여 실제 분할 위치를 조정할 수 있습니다.</p>
        <div class="v42-actions"><button type="button" class="v42-btn" data-auto-action="reset">균등 분할</button><button type="button" class="v42-btn danger" data-auto-action="remove">삭제</button></div>
      </article>`;
    }).join('');
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
    root.innerHTML=items.length?items.map((item,i)=>{const t=window.CutflowScene?.thumbnail?.(item,i)||{},src=t.source?.thumb||'';return `<button type="button" data-scene="${i}" aria-current="${i===index}">${src?`<img src="${esc(src)}" alt="">`:'<span class="missing">'+(i+1)+'</span>'}<b>${String(i+1).padStart(2,'0')}</b><small>${Number(t.duration||item.duration||0).toFixed(1)}s</small></button>`}).join(''):'<p class="v42-empty-strip">장면을 추가해 주세요.</p>';
    $('v42SceneLabel').textContent=`장면 ${items.length?index+1:0} / ${items.length}`;
    const grid=$('v42ScenesGrid');if(grid)grid.innerHTML=items.length?items.map((item,i)=>{const t=window.CutflowScene?.thumbnail?.(item,i)||{},src=t.source?.thumb||'';return `<button type="button" data-scene-grid="${i}" aria-current="${i===index}">${src?`<img src="${esc(src)}" alt="">`:'<span class="missing">'+(i+1)+'</span>'}<strong>${String(i+1).padStart(2,'0')}</strong><small>${Number(t.duration||item.duration||0).toFixed(1)}초</small></button>`}).join(''):'<p class="v42-help">장면이 없습니다.</p>';
  }
  function renderCaption(){
    proxyMap.clear();
    const api=window.CutflowCaption,index=api?.currentIndex?.()??-1,state=api?.state?.(index);
    if(!state){captionMode='edit';panel.innerHTML=section('자막','<p class="v42-help">아직 자막 구간이 없습니다. 내레이션 탭에서 대본으로 자막 구간을 만들거나 직접 추가하세요.</p>'+proxyButton($('buildCuesBtn'),'대본으로 자막 구간 만들기',{primary:true,wide:true})+proxyButton($('addCueBtn'),'+ 자막 구간 추가',{wide:true}));return;}
    window.CutflowCaptionStyle?.select?.(index);
    if(captionMode==='timing'){
      panel.innerHTML=section(`자막 ${index+1} · 정밀 타이밍`,`<button type="button" id="v42TimingBack" class="v42-btn wide">← 자막 편집으로 돌아가기</button><div id="v42TimingHost" class="v42-timing-host"></div>`,'PRECISION TIMING');
      const host=$('v42TimingHost');window.CutflowTiming?.mount?.(host,index);
      $('v42TimingBack').onclick=()=>{window.CutflowTiming?.unmount?.(host);captionMode='edit';renderCaption();};
      return;
    }
    const colorOptions=Object.values(window.CaptionStyle?.palette||{}),colors=[...new Set([...colorOptions,state.color||'#ffffff'])];
    const core=`<label class="v42-field wide"><span>자막 · [[강조]] 지원</span><textarea id="v42CaptionText" data-caption-field="text" rows="3" maxlength="240">${esc(state.text)}</textarea></label>${state.freeEdit?'':`<div class="v42-grid2"><label class="v42-field"><span>시작(초)</span><input data-caption-field="start" type="number" min="0" step="0.01" value="${Number(state.start).toFixed(2)}"></label><label class="v42-field"><span>종료(초)</span><input data-caption-field="end" type="number" min="0.1" step="0.01" value="${Number(state.end).toFixed(2)}"></label></div>`}<label class="v42-field"><span>이 자막 색상</span><select data-caption-field="color">${colors.map(c=>`<option value="${esc(c)}" ${c===state.color?'selected':''}>${esc(c)}</option>`).join('')}</select></label><div class="v42-actions"><button type="button" id="v42CaptionPlay" class="v42-btn">현재 자막 재생</button><button type="button" id="v42CaptionTiming" class="v42-btn">정밀 타이밍 조정</button></div><div class="v42-actions"><button type="button" id="v42CaptionSplit" class="v42-btn">나누기</button><button type="button" id="v42CaptionMerge" class="v42-btn" ${state.segment.position>=state.segment.count?'disabled':''}>다음과 합치기</button><button type="button" id="v42CaptionDelete" class="v42-btn danger">삭제</button></div><p class="v42-help">장면 내 자막 ${state.segment.position}/${state.segment.count} · ${Number(state.end-state.start).toFixed(2)}초</p>`;
    const style=`<div class="v42-grid2">${proxyControl($('captionFont'),'폰트')}${proxyControl($('captionSize'),'크기')}${proxyControl($('captionColor'),'글자색')}${proxyControl($('captionStrokeColor'),'스트로크 색상')}${proxyControl($('captionStroke'),'스트로크 두께')}${proxyControl($('captionBackground'),'배경 사용')}${proxyControl($('captionBackgroundColor'),'배경색')}${proxyControl($('captionOpacity'),'배경 불투명도')}${proxyControl($('captionPadding'),'배경 여백')}${proxyControl($('captionRadius'),'모서리 둥글기')}${proxyControl($('captionPosition'),'자막 위치')}${proxyControl($('captionY'),'세로 위치')}${proxyControl($('captionBold'),'볼드')}${proxyControl($('captionItalic'),'이탤릭')}</div>${palette('captionColor')}${proxyButton($('applyAllCaptionStyle'),'현재 스타일을 전체 자막에 적용',{primary:true,wide:true})}`;
    panel.innerHTML=section(`자막 ${index+1}`,core,'현재 선택 자막')+details('자막 스타일',style,'폰트 · 색상 · 스트로크 · 배경 · 위치',true);
    $('v42CaptionPlay').onclick=()=>api.play(index);
    $('v42CaptionTiming').onclick=()=>{captionMode='timing';renderCaption();};
    $('v42CaptionSplit').onclick=()=>{const input=$('v42CaptionText'),cursor=input?.selectionStart;if(api.split(index,cursor)){captionMode='edit';requestRefresh(true);}};
    $('v42CaptionMerge').onclick=()=>{if(api.mergeNext(index))requestRefresh(true);};
    $('v42CaptionDelete').onclick=()=>{if(confirm(`자막 ${index+1}을 삭제할까요?`)&&api.remove(index))requestRefresh(true);};
  }
  function renderMedia(){
    proxyMap.clear();const {item,index}=currentRows();
    if(!item){panel.innerHTML=section('미디어','<p class="v42-help">장면을 먼저 추가해 주세요.</p>'+proxyButton($('uploadBtn'),'이미지·영상 추가',{primary:true,wide:true}));return;}
    const state=window.CutflowScene?.state?.(index);
    if(!state){panel.innerHTML=section('미디어','<p class="v42-help">현재 장면 정보를 불러오지 못했습니다.</p>');return;}
    const thumb=window.CutflowScene?.thumbnail?.(item,index)?.source?.thumb||'';
    const opts=(rows,value)=>rows.map(([v,l])=>`<option value="${esc(v)}" ${v===value?'selected':''}>${esc(l)}</option>`).join('');
    const field=(label,name,type,value,attrs='')=>`<label class="v42-field"><span>${esc(label)}</span><input data-media-field="${name}" type="${type}" value="${esc(value)}" ${attrs}></label>`;
    const mediaHead=`<div class="v42-media-summary">${thumb?`<img src="${esc(thumb)}" alt="">`:''}<div><strong>장면 ${index+1}</strong><small>${state.type==='video'?'영상':'이미지'} · ${Number(state.duration||0).toFixed(2)}초</small></div></div><input id="v42ReplaceInput" type="file" accept="image/*,video/*" hidden><button type="button" id="v42ReplaceBtn" class="v42-btn primary wide">이미지·영상 교체</button>`;
    const primary=`<div class="v42-grid2"><label class="v42-field"><span>움직임</span><select data-media-field="motion">${opts(state.motionOptions,state.motion)}</select></label><label class="v42-field"><span>진입 전환</span><select data-media-field="transition">${opts(state.transitionOptions,state.transition)}</select></label></div>`;
    const sceneActions=`<div class="v42-actions"><button class="v42-btn" id="v42SplitScene">장면 나누기</button><button class="v42-btn" id="v42MergeScene">다음과 합치기</button><button class="v42-btn danger" id="v42DeleteScene">삭제</button></div><p class="v42-help">나누기는 현재 재생 위치를 기준으로 합니다. 장면 경계에 있으면 가운데에서 나눕니다.</p>`;
    let advanced=`<div class="v42-grid3">${field('Scale (%)','scale','number',Number(state.transform.scale).toFixed(1),'min="10" max="500" step="1"')}${field('Position X (%)','x','number',Number(state.transform.x).toFixed(1),'min="-200" max="200" step="1"')}${field('Position Y (%)','y','number',Number(state.transform.y).toFixed(1),'min="-200" max="200" step="1"')}</div>`;
    if(state.type==='video'){
      advanced+=`<div class="v42-grid2">${field('Trim 시작','trimStart','number',state.trimStart.toFixed(2),`min="0" max="${Math.max(0,state.trimEnd-.04).toFixed(2)}" step="0.01"`)}${field('Trim 끝','trimEnd','number',state.trimEnd.toFixed(2),`min="${Math.min(state.sourceDuration,state.trimStart+.04).toFixed(2)}" max="${state.sourceDuration.toFixed(2)}" step="0.01"`)}</div><label class="v42-check"><input data-media-field="mediaMuted" type="checkbox" ${state.mediaMuted?'checked':''}><span>영상 원음 음소거</span></label>${field('영상 원음 볼륨 (%)','mediaVolume','range',state.mediaVolume,'min="0" max="100" step="1"')}<div class="v42-grid2">${field('원음 Fade In','mediaFadeIn','number',state.mediaFadeIn.toFixed(1),'min="0" max="10" step="0.1"')}${field('원음 Fade Out','mediaFadeOut','number',state.mediaFadeOut.toFixed(1),'min="0" max="10" step="0.1"')}</div>`;
    }
    panel.innerHTML=section('이미지·영상',mediaHead)+section('움직임 · 진입 전환',primary)+section('장면 편집',sceneActions)+details('상세 설정',advanced,'크기 · 위치 · Trim · 원음 · Fade');
    $('v42ReplaceBtn').onclick=()=>$('v42ReplaceInput').click();
    $('v42ReplaceInput').onchange=async e=>{const f=e.target.files?.[0];if(f&&window.CutflowScene?.replace)await window.CutflowScene.replace(f);e.target.value='';requestRefresh(true);};
    $('v42SplitScene').onclick=()=>{const start=window.CutflowScene?.start?.(index)||0,duration=window.CutflowScene?.state?.(index)?.duration||0;let at=typeof currentTime==='function'?currentTime():start;if(!(at>start+.1&&at<start+duration-.1))at=start+duration/2;window.CutflowScene?.split?.(index,at);};
    $('v42MergeScene').onclick=()=>window.CutflowScene?.mergeNext?.(index);
    $('v42DeleteScene').onclick=()=>{if(confirm(`장면 ${index+1}을 삭제할까요?`))window.CutflowScene?.remove?.(index);};
  }
  function autoSetupMarkup(map=proxyMap){
    const preset=document.querySelector('input[name="autoSilencePreset"]:checked')?.value||'normal';
    const pc=(el,label,opts={})=>proxyControl(el,label,{...opts,map});
    const pb=(el,label,opts={})=>proxyButton(el,label,{...opts,map});
    return `${pc($('autoTitle'),'영상 제목',{wide:true})}${pc($('autoChannel'),'채널명')}${pc($('autoLayout'),'영상 템플릿')}${pc($('autoScript'),'대본 · 한 줄이 한 장면',{wide:true})}${pc($('autoCaptionWrap'),'자막 자동 줄바꿈')}<div class="v42-file-actions">${pb($('autoNarrationBtn'),'내레이션 선택')}${pb($('autoGridBtn'),'+ 그리드 이미지')}${pb($('autoSingleBtn'),'+ 개별 이미지')}${pb($('autoBgmBtn'),'BGM 선택')}</div><div class="v42-auto-files"><span><b>내레이션</b><i data-auto-status="narration">${esc($('autoNarrationName')?.textContent||'선택 안 됨')}</i></span><span><b>그리드</b><i data-auto-status="grid">${esc($('autoGridName')?.textContent||'선택 안 됨')}</i></span><span><b>개별 이미지</b><i data-auto-status="single">${esc($('autoSingleName')?.textContent||'선택 안 됨')}</i></span></div><div class="v42-silence"><strong>무음컷 강도</strong><div class="v42-pills" data-auto-silence>${[['soft','부드럽게'],['normal','보통'],['tight','타이트']].map(([v,l])=>`<label><input type="radio" name="v42AutoSilence" value="${v}" ${preset===v?'checked':''}><span>${l}</span></label>`).join('')}</div><p class="v42-help" data-auto-status="silence-info">${esc($('autoSilenceInfo')?.textContent||'')}</p></div><div data-settings-grid-mirror>${details('그리드 분할 설정',autoGridMirror(),'열 · 행 · 분할 여백')}</div><div class="v42-auto-check"><span>대본 장면 <strong data-auto-status="script-count">${esc($('autoScriptCount')?.textContent||'0개')}</strong></span><span>장면 이미지 <strong data-auto-status="image-count">${esc($('autoImageCount')?.textContent||'0개')}</strong></span></div><p class="v42-auto-match" data-auto-status="match">${esc($('autoMatch')?.textContent||'')}</p><p class="v42-status" data-auto-status="run">${esc($('autoStatus')?.textContent||'')}</p>${pb($('autoStart'),'쇼츠 자동 세팅 시작',{primary:true,wide:true})}`;
  }
  function renderNarration(){
    proxyMap.clear();
    const status=$('audioStatus')?.textContent||'오디오 없음';
    const source=`${proxyControl($('scriptInput'),'대본 · 한 줄이 한 자막 구간',{wide:true})}${proxyControl($('projectCaptionWrap'),'자막 자동 줄바꿈')}<div class="v42-actions">${proxyButton($('scriptFileBtn'),'TXT 대본 불러오기')}${proxyButton($('audioBtn'),'내레이션 불러오기')}</div><p class="v42-status">${esc(status)}</p>${proxyButton($('buildCuesBtn'),'대본으로 자막 구간 만들기',{primary:true,wide:true})}<div class="v42-silence"><strong>현재 내레이션 무음 줄이기</strong><div class="v42-pills"><label><input type="radio" name="v42Silence" value="soft"><span>부드럽게</span></label><label><input type="radio" name="v42Silence" value="normal" checked><span>보통</span></label><label><input type="radio" name="v42Silence" value="tight"><span>타이트</span></label></div><button id="v42SilenceRun" class="v42-btn wide" type="button">무음 줄이기</button><p id="v42SilenceStatus" class="v42-help">원본은 유지하고 처리본을 사용합니다.</p></div>`;
    panel.innerHTML=section('대본 · 내레이션',source,'SCRIPT & VOICE');
    $('v42SilenceRun').onclick=async()=>{const statusEl=$('v42SilenceStatus');try{const p=qs('input[name="v42Silence"]:checked')?.value||'normal';statusEl.textContent='무음 구간 분석 중…';const result=await window.CutflowAutoBridge?.processNarration?.(p,m=>statusEl.textContent=m);if(!result)throw new Error('무음컷을 실행하지 못했습니다.');statusEl.textContent=`완료 · ${result.originalDuration.toFixed(1)}초 → ${result.processedDuration.toFixed(1)}초`;requestRefresh(true);}catch(err){statusEl.textContent=`처리 실패: ${err.message}`;}};
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
    const statusMap={
      narration:$('autoNarrationName')?.textContent||'선택 안 됨',
      grid:$('autoGridName')?.textContent||'선택 안 됨',
      single:$('autoSingleName')?.textContent||'선택 안 됨',
      'silence-info':$('autoSilenceInfo')?.textContent||'',
      'script-count':$('autoScriptCount')?.textContent||'0개',
      'image-count':$('autoImageCount')?.textContent||'0개',
      match:$('autoMatch')?.textContent||'',
      run:$('autoStatus')?.textContent||''
    };
    for(const [name,value] of Object.entries(statusMap)){
      const el=settingsDialog.querySelector(`[data-auto-status="${name}"]`);
      if(el)el.textContent=value;
    }
    settingsDialog.querySelector('[data-cutflow-history="undo"]')?.toggleAttribute('disabled',!window.CutflowHistory?.canUndo);
    settingsDialog.querySelector('[data-cutflow-history="redo"]')?.toggleAttribute('disabled',!window.CutflowHistory?.canRedo);
  }
  function syncSettingsGridMirror(){
    if(!settingsDialog.open)return;
    const host=settingsDialog.querySelector('[data-settings-grid-mirror]');
    if(!host)return;
    const active=document.activeElement;
    if(active&&host.contains(active))return;
    host.innerHTML=details('그리드 분할 설정',autoGridMirror(),'열 · 행 · 분할 여백');
  }
  function renderSettings(){
    settingsProxyMap.clear();
    const pc=(el,label,opts={})=>proxyControl(el,label,{...opts,map:settingsProxyMap});
    const pb=(el,label,opts={})=>proxyButton(el,label,{...opts,map:settingsProxyMap});
    const quickActions=`<div class="v42-settings-actions"><button type="button" class="v42-btn primary" data-direct-click="uploadBtn">이미지·영상 추가</button><button type="button" class="v42-btn" data-direct-click="demoBtn">샘플로 시작</button></div>`;
    const history=`<div class="v42-settings-actions"><button type="button" class="v42-btn" data-history-control="1" data-cutflow-history="undo" ${window.CutflowHistory?.canUndo?'':'disabled'}>↶ 실행 취소</button><button type="button" class="v42-btn" data-history-control="1" data-cutflow-history="redo" ${window.CutflowHistory?.canRedo?'':'disabled'}>↷ 다시 실행</button></div>`;
    const source=`${pc($('scriptInput'),'대본 · 한 줄이 한 자막 구간',{wide:true})}${pc($('projectCaptionWrap'),'자막 자동 줄바꿈')}<div class="v42-actions">${pb($('scriptFileBtn'),'TXT 대본 불러오기')}${pb($('audioBtn'),'내레이션 불러오기')}</div><p class="v42-status">${esc($('audioStatus')?.textContent||'오디오 없음')}</p>${pb($('buildCuesBtn'),'대본으로 자막 구간 만들기',{primary:true,wide:true})}<div class="v42-silence"><strong>내레이션 무음 줄이기</strong><div class="v42-pills"><label><input type="radio" name="v42SettingsSilence" value="soft"><span>부드럽게</span></label><label><input type="radio" name="v42SettingsSilence" value="normal" checked><span>보통</span></label><label><input type="radio" name="v42SettingsSilence" value="tight"><span>타이트</span></label></div><button type="button" class="v42-btn wide" data-settings-silence-run>무음 줄이기</button><p class="v42-help" data-settings-silence-status>원본은 유지하고 처리본을 사용합니다.</p></div>`;
    const bgm=`<div class="v42-actions">${pb($('bgmBtn'),'음악 파일 추가',{primary:true})}${pb($('bgmRemove'),'음악 제거',{danger:true})}</div><p class="v42-status">${esc($('bgmStatus')?.textContent||'음악 없음')}</p><div class="v42-grid2">${pc($('bgmStart'),'음악 시작 지점')}${pc($('bgmVolume'),'BGM 볼륨')}${pc($('bgmRepeat'),'음악이 짧을 때')}${pc($('bgmFadeIn'),'페이드 인')}${pc($('bgmFadeOut'),'페이드 아웃')}</div>`;
    const project=`${pc($('layoutSelect'),'영상 템플릿')}${pc($('titleInput'),'상단 제목',{wide:true})}${pc($('channelInput'),'채널명')}${pc($('fitSelect'),'이미지·영상 맞춤')}${pc($('templateSelect'),'움직임 프리셋')}${pb($('applyTemplateBtn'),'움직임만 전체 적용',{wide:true})}${pb($('randomMotionBtn'),'전체 이미지에 랜덤 무빙',{wide:true})}`;
    const output=`${pc($('resolutionSelect'),'출력 해상도')}${pb($('exportBtn'),'MP4 영상 저장',{primary:true,wide:true})}`;
    $('v42SettingsBody').innerHTML=
      section('빠른 시작',quickActions,'PROJECT')+
      section('편집 기록',history,'UNDO · REDO')+
      section('대본과 내레이션',source,'01 SCRIPT & VOICE')+
      section('배경음악 · BGM',bgm,'AUDIO')+
      section('화면 구성',project,'02 COMPOSE')+
      section('쇼츠 자동 세팅',autoSetupMarkup(settingsProxyMap),'QUICK START','v42-quick-start')+
      section('출력 설정',output,'04 EXPORT');
    syncSettingsProxyState();
  }
  function renderTemplate(){
    proxyMap.clear();
    const compose=window.CutflowCompose?.state?.()||{},title=window.CutflowTypography?.state?.('title')||{},channel=window.CutflowTypography?.state?.('channel')||{};
    const selectMarkup=(id,value,field)=>{const el=$(id);return `<label class="v42-field"><span>${esc(field.label)}</span><select data-compose-field="${field.key}" ${field.disabled?'disabled':''}>${[...el.options].map(o=>`<option value="${esc(o.value)}" ${o.value===value?'selected':''}>${esc(o.textContent)}</option>`).join('')}</select></label>`;};
    const fontMarkup=(kind,state)=>{const el=$(kind+'Font');return `<label class="v42-field"><span>폰트</span><select data-typo-kind="${kind}" data-typo-field="font">${[...el.options].map(o=>`<option value="${esc(o.value)}" ${o.value===state.font?'selected':''}>${esc(o.textContent)}</option>`).join('')}</select></label>`;};
    const typoMarkup=(kind,state)=>{
      const yMax=kind==='channel'?94:90;
      return `<div class="v42-grid2">${fontMarkup(kind,state)}
        <label class="v42-field"><span>크기(px)</span><input data-typo-kind="${kind}" data-typo-field="size" type="number" min="${kind==='channel'?16:24}" max="${kind==='channel'?96:160}" step="0.1" value="${esc(state.size)}"></label>
        <label class="v42-field"><span>색상</span><input data-typo-kind="${kind}" data-typo-field="color" type="color" value="${esc(state.color)}"></label>
        <label class="v42-field"><span>가로 위치 ${Number(state.x||0).toFixed(0)}%</span><input data-typo-kind="${kind}" data-typo-field="x" type="range" min="5" max="95" step="1" value="${esc(state.x)}"></label>
        <label class="v42-field"><span>세로 위치 ${Number(state.y||0).toFixed(0)}%</span><input data-typo-kind="${kind}" data-typo-field="y" type="range" min="0" max="${yMax}" step="1" value="${esc(state.y)}"></label>
        <label class="v42-check"><input data-typo-kind="${kind}" data-typo-field="bold" type="checkbox" ${state.bold?'checked':''}><span><b>B</b> 볼드</span></label>
        <label class="v42-check"><input data-typo-kind="${kind}" data-typo-field="italic" type="checkbox" ${state.italic?'checked':''}><span><i>I</i> 이탤릭</span></label>
        <label class="v42-check"><input data-typo-kind="${kind}" data-typo-field="strokeEnabled" type="checkbox" ${state.strokeEnabled?'checked':''}><span>스트로크 사용</span></label>
        <label class="v42-field"><span>스트로크 두께</span><input data-typo-kind="${kind}" data-typo-field="strokeWidth" type="range" min="0" max="18" step="0.5" value="${esc(state.strokeWidth)}" ${state.strokeEnabled?'':'disabled'}></label>
      </div><div class="v42-typo-palette" data-typo-palette="${kind}">${Object.values(window.CaptionStyle?.palette||{}).map(c=>`<button type="button" class="v42-color" data-color="${c}" style="--v42-color:${c}" aria-label="${c}"></button>`).join('')}</div>`;
    };
    const basic=`${selectMarkup('layoutSelect',compose.layout,{key:'layout',label:'영상 템플릿'})}<label class="v42-field wide"><span>상단 제목</span><textarea data-compose-field="title" rows="2" maxlength="80">${esc(compose.title||'')}</textarea></label><label class="v42-field"><span>채널명</span><input data-compose-field="channel" maxlength="40" value="${esc(compose.channel||'')}"></label>${selectMarkup('fitSelect',compose.fit,{key:'fit',label:'이미지·영상 맞춤',disabled:compose.fitDisabled})}${selectMarkup('templateSelect',compose.motionPreset,{key:'motionPreset',label:'움직임 프리셋'})}<div class="v42-actions"><button type="button" id="v42ApplyMotionPreset" class="v42-btn wide">움직임만 전체 적용</button><button type="button" id="v42RandomMotion" class="v42-btn wide">전체 이미지 랜덤 무빙</button></div>`;
    panel.innerHTML=section('화면 구성',basic)+details('제목 스타일',typoMarkup('title',title),'폰트 · 크기 · 색상 · 위치 · B · I · 스트로크',true)+details('채널명 스타일',typoMarkup('channel',channel),'폰트 · 크기 · 색상 · 위치 · B · I · 스트로크',true);
    $('v42ApplyMotionPreset').onclick=()=>{window.CutflowCompose?.applyMotionPreset?.();requestRefresh(false);};
    $('v42RandomMotion').onclick=()=>{window.CutflowCompose?.randomMotion?.();requestRefresh(false);};
  }
  function renderBgm(){
    proxyMap.clear();
    const api=window.CutflowBgm,state=api?.state?.()||{loaded:false,name:'',duration:0,start:0,volume:0,repeat:'stop',fadeIn:0,fadeOut:0,summary:'음악을 추가하면 쇼츠 길이에 맞춰 자동으로 잘립니다.'};
    const repeat=$('bgmRepeat');
    const controls=`<input id="v42BgmInput" type="file" accept="audio/*,.mp3,.wav,.m4a,.aac" hidden>
      <div class="v42-actions"><button type="button" id="v42BgmAdd" class="v42-btn primary">음악 파일 추가</button><button type="button" id="v42BgmRemove" class="v42-btn danger" ${state.loaded?'':'disabled'}>음악 제거</button></div>
      <p class="v42-status">${state.loaded?esc(state.name)+' · '+Number(state.duration).toFixed(2)+'초':'음악 없음'}</p>
      <div class="v42-grid2">
        <label class="v42-field"><span>음악 시작 지점</span><input data-bgm-field="start" type="number" min="0" max="${Math.max(0,(state.duration||0)-.01).toFixed(2)}" step="0.01" value="${Number(state.start||0).toFixed(2)}" ${state.loaded?'':'disabled'}></label>
        <label class="v42-field"><span>BGM 볼륨 ${Math.round(state.volume||0)}%</span><input data-bgm-field="volume" type="range" min="0" max="100" step="1" value="${Math.round(state.volume||0)}" ${state.loaded?'':'disabled'}></label>
        <label class="v42-field"><span>음악이 짧을 때</span><select data-bgm-field="repeat" ${state.loaded?'':'disabled'}>${repeat?[...repeat.options].map(o=>`<option value="${esc(o.value)}" ${o.value===state.repeat?'selected':''}>${esc(o.textContent)}</option>`).join(''):''}</select></label>
        <label class="v42-field"><span>페이드 인</span><input data-bgm-field="fadeIn" type="number" min="0" max="30" step="0.1" value="${Number(state.fadeIn||0).toFixed(1)}" ${state.loaded?'':'disabled'}></label>
        <label class="v42-field"><span>페이드 아웃</span><input data-bgm-field="fadeOut" type="number" min="0" max="30" step="0.1" value="${Number(state.fadeOut||0).toFixed(1)}" ${state.loaded?'':'disabled'}></label>
      </div>
      <p class="v42-help">${esc(state.summary||'')}</p>`;
    panel.innerHTML=section('배경음악 · BGM',controls);
    $('v42BgmAdd').onclick=()=>$('v42BgmInput').click();
    $('v42BgmInput').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;const btn=$('v42BgmAdd');btn.disabled=true;btn.textContent='음악 읽는 중…';const ok=await api?.load?.(file);e.target.value='';if(!ok){btn.disabled=false;btn.textContent='음악 파일 추가';window.CutflowAutoBridge?.toast?.('음악을 읽지 못했습니다. MP3 또는 WAV 파일로 다시 시도해 주세요.');return;}requestRefresh(true);};
    $('v42BgmRemove').onclick=()=>{api?.remove?.();requestRefresh(true);};
  }
  function renderPanel(force=false){
    if(!force&&panel.contains(document.activeElement))return;
    panel.hidden=false;panel.dataset.activeTab=tab;
    try{
      if(tab==='caption')renderCaption(); else if(tab==='media')renderMedia(); else if(tab==='narration')renderNarration(); else if(tab==='template')renderTemplate(); else renderBgm();
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
    if(state&&m&&document.activeElement!==m){m.min='0';m.max='1000';m.value=String(Math.round((state.progress||0)*1000));}
    const ct=$('currentTime')?.textContent||'0:00.0',et=$('endTime')?.textContent||'0:00.0';$('v42TimeLabel').textContent=`${ct} / ${et}`;
    const mobilePlay=qs('.v42-player .play');if(mobilePlay)mobilePlay.textContent=state?.playing?'Ⅱ':'▶';
  }
  function mirrorStage(){
    const src=$('stage');if(src&&ctx){try{ctx.clearRect(0,0,stage.width,stage.height);ctx.drawImage(src,0,0,stage.width,stage.height);if(previewDialog.open){fullCtx.clearRect(0,0,fullStage.width,fullStage.height);fullCtx.drawImage(src,0,0,fullStage.width,fullStage.height);}}catch{}}
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
    const action=e.target.closest?.('[data-auto-action]');if(!action)return false;
    const card=action.closest('[data-auto-grid]'),i=Number(card?.dataset.autoGrid);
    if(action.dataset.autoAction==='reset')window.CutflowAutoSetup?.resetGrid?.(i);
    else window.CutflowAutoSetup?.removeGrid?.(i);
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
    const history=e.target.closest('[data-cutflow-history]');
    if(history){window.CutflowHistory?.[history.dataset.cutflowHistory]?.();setTimeout(syncSettingsProxyState,0);return;}
    const silence=e.target.closest('[data-settings-silence-run]');
    if(silence){const statusEl=settingsDialog.querySelector('[data-settings-silence-status]');(async()=>{try{const p=settingsDialog.querySelector('input[name="v42SettingsSilence"]:checked')?.value||'normal';statusEl.textContent='무음 구간 분석 중…';const result=await window.CutflowAutoBridge?.processNarration?.(p,m=>statusEl.textContent=m);if(!result)throw new Error('무음컷을 실행하지 못했습니다.');statusEl.textContent=`완료 · ${result.originalDuration.toFixed(1)}초 → ${result.processedDuration.toFixed(1)}초`;requestRefresh(true);syncSettingsProxyState();}catch(err){statusEl.textContent=`처리 실패: ${err.message}`;}})();return;}
    const direct=e.target.closest('[data-direct-click]');if(direct){const source=$(direct.dataset.directClick),fileTarget=fileTargetFor(source);if(fileTarget&&openFileTarget(fileTarget))return;source?.click();return;}
    const proxy=e.target.closest('[data-proxy-click]');if(proxy){const fileTarget=proxy.dataset.fileTarget;if(fileTarget&&openFileTarget(fileTarget))return;settingsProxyMap.get(proxy.dataset.proxyClick)?.click();setTimeout(()=>{syncSettingsProxyState();syncSettingsGridMirror();},0);return;}
    handleAutoClick(e,()=>{syncSettingsProxyState();syncSettingsGridMirror();});
  });
  $('v42SettingsBody').addEventListener('input',e=>{proxyInput(e,settingsProxyMap);handleAutoInput(e,()=>{syncSettingsProxyState();syncSettingsGridMirror();});});
  $('v42SettingsBody').addEventListener('change',e=>{proxyChange(e,settingsProxyMap);handleAutoInput(e,()=>{syncSettingsProxyState();syncSettingsGridMirror();});setTimeout(syncSettingsProxyState,0);});
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
  tabs.addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(!b)return;const timingHost=$('v42TimingHost');if(timingHost)window.CutflowTiming?.unmount?.(timingHost);tab=b.dataset.tab;if(tab!=='caption')captionMode='edit';qsa('button',tabs).forEach(x=>x.setAttribute('aria-pressed',String(x===b)));renderPanel(true);requestAnimationFrame(ensurePanelVisible);});
  $('v42AddScene').onclick=()=>$('fileInput')?.click();
  $('v42PrevScene').onclick=()=>{const {items,index}=currentScene();if(items.length)window.CutflowScene?.select?.(Math.max(0,index-1));};
  $('v42NextScene').onclick=()=>{const {items,index}=currentScene();if(items.length)window.CutflowScene?.select?.(Math.min(items.length-1,index+1));};
  $('v42AllScenes').onclick=()=>{renderSceneStrip();scenesDialog.showModal();};
  $('v42ScenesClose').onclick=()=>scenesDialog.close();
  $('v42ScenesGrid').onclick=e=>{const b=e.target.closest('[data-scene-grid]');if(!b)return;window.CutflowScene?.select?.(Number(b.dataset.sceneGrid));scenesDialog.close();requestRefresh(true);requestAnimationFrame(()=>followSelectedScene('smooth'));};
  scenesDialog.addEventListener('cancel',e=>{e.preventDefault();scenesDialog.close();});
  async function openPreviewFullscreen(){
    previewDialog.showModal();
    try{if(previewDialog.requestFullscreen&&!document.fullscreenElement)await previewDialog.requestFullscreen();}catch{}
  }
  async function closePreviewFullscreen(){
    try{if(document.fullscreenElement===previewDialog)await document.exitFullscreen();}catch{}
    if(previewDialog.open)previewDialog.close();
  }
  $('v42Fullscreen').onclick=openPreviewFullscreen;$('v42FullClose').onclick=closePreviewFullscreen;previewDialog.addEventListener('cancel',e=>{e.preventDefault();closePreviewFullscreen();});
  document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&previewDialog.open)previewDialog.close();});
  $('v42Scrubber').addEventListener('input',e=>window.CutflowPlayer?.seekProgress?.(Number(e.target.value)/1000));
  $('v42Scrubber').addEventListener('change',e=>window.CutflowPlayer?.seekProgress?.(Number(e.target.value)/1000));

  let mobileExportBlob=null,mobileExportFilename='',mobileExportUrl='';
  const resetMobileExport=()=>{
    if(mobileExportUrl){URL.revokeObjectURL(mobileExportUrl);mobileExportUrl='';}
    mobileExportBlob=null;mobileExportFilename='';$('v42ExportProgress').value=0;$('v42ExportStatus').textContent='준비 중…';$('v42ExportResult').hidden=true;$('v42ExportResult').textContent='';$('v42ExportCancel').hidden=false;$('v42ExportShare').hidden=true;$('v42ExportDownload').hidden=true;$('v42ExportDone').hidden=true;
  };
  $('v42Play').onclick=()=>window.CutflowPlayer?.toggle?.();
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

  for(const id of ['cueList','sceneList','nowPlaying','projectSaveStatus','bgmStatus','bgmSummary','audioStatus','autoGridList','autoSingleList','autoGridName','autoSingleName','autoNarrationName','autoMatch','autoScriptCount','autoImageCount','autoSilenceInfo','autoStatus']){const el=$(id);if(el)new MutationObserver(()=>{requestRefresh(false);if(settingsDialog.open){syncSettingsProxyState();syncSettingsGridMirror();}}).observe(el,{subtree:true,childList:true,attributes:true});}
  window.addEventListener('cutflow-scene',e=>{sceneIndex=Number(e.detail)||0;lastSceneId=null;requestRefresh(true);requestAnimationFrame(()=>followSelectedScene('smooth'));});
  window.addEventListener('cutflow-scene-updated',()=>requestRefresh(false));
  window.addEventListener('cutflow-caption-updated',()=>requestRefresh(false));
  window.addEventListener('cutflow-caption-style-updated',()=>requestRefresh(false));
  window.addEventListener('cutflow-compose-updated',()=>requestRefresh(false));
  window.addEventListener('cutflow-typography-updated',()=>requestRefresh(false));
  window.addEventListener('cutflow-bgm-updated',()=>requestRefresh(false));
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
    lastSceneId=null;captionMode='edit';
    const timingHost=$('v42TimingHost');if(timingHost)window.CutflowTiming?.unmount?.(timingHost);
    requestRefresh(true);
    if(settingsDialog.open){syncSettingsProxyState();syncSettingsGridMirror();}
    requestAnimationFrame(()=>followSelectedScene('auto'));
  };
  window.addEventListener('cutflow-project-restored',syncAfterProjectRestore);
  window.addEventListener('cutflow-project-loaded',syncAfterProjectRestore);
  window.addEventListener('cutflow-history-updated',()=>{if(settingsDialog.open)syncSettingsProxyState();});
  for(const id of ['scriptInput','projectCaptionWrap','audioInput','scriptFile','bgmInput','autoNarration','autoGrids','autoSingles','autoBgm']){
    const el=$(id);if(!el)continue;
    el.addEventListener(id==='scriptInput'||id==='projectCaptionWrap'?'input':'change',()=>setTimeout(()=>{requestRefresh(false);if(settingsDialog.open){syncSettingsProxyState();syncSettingsGridMirror();}},id==='audioInput'?350:40));
  }
  window.addEventListener('cutflow-auto-grid-change',()=>{if(settingsDialog.open)syncSettingsGridMirror();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)requestRefresh(false);});
  window.addEventListener('pageshow',()=>requestRefresh(false));
  setInterval(syncPlayer,200);
  renderSceneStrip();renderPanel(true);syncPlayer();mirrorStage();
})();
