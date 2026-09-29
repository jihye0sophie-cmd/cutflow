/* Cutflow v42 mobile shell.
   Mobile UI is independent from the desktop DOM. Existing controls remain authoritative
   and are only mirrored/proxied here; no desktop panel is moved into the mobile shell. */
(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  const qs=(s,r=document)=>r.querySelector(s);
  const qsa=(s,r=document)=>[...r.querySelectorAll(s)];
  const mq=matchMedia('(max-width:900px)');
  const ua=navigator.userAgent||'';
  const mobileUA=/Android|iPhone|iPad|iPod|Mobile/i.test(ua) || navigator.userAgentData?.mobile===true;
  const ipadDesktop=/Macintosh/i.test(ua)&&(navigator.maxTouchPoints||0)>1;
  const coarse=matchMedia('(hover:none) and (pointer:coarse)').matches;
  const physicalShort=Math.min(screen.width||9999,screen.height||9999);
  const isMobile=()=>mq.matches||mobileUA||ipadDesktop||(coarse&&physicalShort<=900);
  window.CutflowUI=window.CutflowUI||{};
  window.CutflowUI.isMobileDevice=isMobile;

  if(!isMobile())return;
  document.body.classList.add('v42-mobile');
  document.body.classList.remove('mobile-editor');

  const app=document.createElement('div');
  app.id='mobileAppV42';
  app.innerHTML=`
    <header class="v42-head">
      <div class="v42-brand"><strong>Cutflow</strong><small>v42 MOBILE</small></div>
      <div class="v42-head-actions">
        <button type="button" data-click="projectOpenBtn">열기</button>
        <button type="button" data-click="projectSaveBtn">저장</button>
        <button type="button" class="primary" data-click="exportBtn">내보내기</button>
      </div>
    </header>
    <main class="v42-main">
      <section class="v42-preview-card">
        <div class="v42-preview-head"><strong id="v42SceneLabel">장면 0 / 0</strong><div><span id="v42TimeLabel">0:00.0 / 0:00.0</span><button id="v42Fullscreen" type="button">전체화면</button></div></div>
        <div class="v42-stage-wrap"><canvas id="v42Stage" width="360" height="640" aria-label="모바일 영상 미리보기"></canvas></div>
        <div class="v42-player">
          <button type="button" data-click="prevBtn" aria-label="이전 장면">‹</button>
          <button type="button" class="play" data-click="playBtn" aria-label="재생">▶</button>
          <button type="button" data-click="nextBtn" aria-label="다음 장면">›</button>
        </div>
        <input id="v42Scrubber" class="v42-scrubber" type="range" min="0" max="1000" value="0" aria-label="재생 위치">
      </section>
      <section class="v42-scenes-card">
        <div id="v42SceneStrip" class="v42-scene-strip"></div>
        <button id="v42AddScene" type="button" class="v42-add-scene" aria-label="장면 추가">＋</button>
      </section>
      <nav id="v42Tabs" class="v42-tabs" aria-label="모바일 편집 탭">
        <button type="button" data-tab="caption" aria-pressed="true"><span>T</span>자막</button>
        <button type="button" data-tab="media"><span>▧</span>미디어</button>
        <button type="button" data-tab="narration"><span>🎙</span>내레이션</button>
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

  const panel=$('v42Panel'),tabs=$('v42Tabs'),stage=$('v42Stage'),ctx=stage.getContext('2d'),fullStage=$('v42FullStage'),fullCtx=fullStage.getContext('2d');
  const proxyMap=new Map();
  let tab='caption',sceneIndex=0,lastSceneId=null,renderQueued=false;

  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const key=()=>`p${Math.random().toString(36).slice(2)}`;
  const dispatch=(el,type)=>el.dispatchEvent(new Event(type,{bubbles:true}));
  function proxyControl(el,label,{wide=false}={}){
    if(!el)return '';
    const k=key();proxyMap.set(k,el);
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
  function proxyButton(el,label,{primary=false,danger=false,wide=false}={}){
    if(!el)return '';
    const k=key();proxyMap.set(k,el);
    return `<button type="button" data-proxy-click="${k}" class="v42-btn ${primary?'primary ':''}${danger?'danger ':''}${wide?'wide':''}" ${el.disabled?'disabled':''}>${esc(label)}</button>`;
  }
  function section(title,body,sub=''){
    return `<section class="v42-section"><div class="v42-section-head"><strong>${esc(title)}</strong>${sub?`<small>${esc(sub)}</small>`:''}</div>${body}</section>`;
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
  function renderSceneStrip(){
    const {items,index}=currentScene(),root=$('v42SceneStrip');
    root.innerHTML=items.length?items.map((item,i)=>{const t=window.CutflowScene?.thumbnail?.(item,i)||{},src=t.source?.thumb||'';return `<button type="button" data-scene="${i}" aria-current="${i===index}">${src?`<img src="${esc(src)}" alt="">`:'<span class="missing">${i+1}</span>'}<b>${String(i+1).padStart(2,'0')}</b><small>${Number(t.duration||item.duration||0).toFixed(1)}s</small></button>`}).join(''):'<p class="v42-empty-strip">장면을 추가해 주세요.</p>';
    $('v42SceneLabel').textContent=`장면 ${items.length?index+1:0} / ${items.length}`;
  }
  function renderCaption(){
    proxyMap.clear();const {cueRow,cueIndex}=currentRows();
    if(!cueRow){
      panel.innerHTML=section('자막','<p class="v42-help">아직 자막 구간이 없습니다. 대본과 내레이션에서 자막 구간을 만들거나 구간을 직접 추가하세요.</p>'+proxyButton($('buildCuesBtn'),'대본으로 자막 구간 만들기',{primary:true,wide:true})+proxyButton($('addCueBtn'),'+ 자막 구간 추가',{wide:true}));return;
    }
    const text=qs('[data-action="text"]',cueRow),start=qs('[data-action="start"]',cueRow),end=qs('[data-action="end"]',cueRow),color=qs('[data-action="color"]',cueRow);
    const actions=`<div class="v42-actions">${proxyButton(qs('[data-action="split"]',cueRow),'나누기')}${proxyButton(qs('[data-action="merge"]',cueRow),'다음과 합치기')}${proxyButton(qs('[data-action="delete"]',cueRow),'삭제',{danger:true})}</div>`;
    const core=proxyControl(text,'자막 · [[강조]] 지원',{wide:true})+`<div class="v42-grid2">${proxyControl(start,'시작(초)')}${proxyControl(end,'종료(초)')}</div>`+proxyControl(color,'이 자막 색상')+actions;
    const styleIds=[['captionFont','폰트'],['captionSize','크기'],['captionColor','기본 색상'],['captionBold','볼드'],['captionItalic','이탤릭'],['captionStroke','스트로크 두께'],['captionBackground','배경']];
    const styles=styleIds.map(([id,l])=>proxyControl($(id),l)).join('');
    panel.innerHTML=section(`자막 ${cueIndex+1}`,core,'선택 장면의 현재 자막')+section('자막 스타일',`<div class="v42-grid2">${styles}</div>${proxyButton($('applyAllCaptionStyle'),'현재 스타일을 전체 자막에 적용',{wide:true})}`);
  }
  function renderMedia(){
    proxyMap.clear();const {item,index,mediaRow}=currentRows();
    if(!item){panel.innerHTML=section('미디어','<p class="v42-help">장면을 먼저 추가해 주세요.</p>'+proxyButton($('uploadBtn'),'이미지·영상 추가',{primary:true,wide:true}));return;}
    const thumb=window.CutflowScene?.thumbnail?.(item,index)?.source?.thumb||'';
    const replaceInput='<input id="v42ReplaceInput" type="file" accept="image/*,video/*" hidden>';
    const mediaHead=`<div class="v42-media-summary">${thumb?`<img src="${esc(thumb)}" alt="">`:''}<div><strong>장면 ${index+1}</strong><small>${Number(item.duration||0).toFixed(2)}초</small></div></div>${replaceInput}<button type="button" id="v42ReplaceBtn" class="v42-btn wide">이미지·영상 교체</button>`;
    const motion=mediaRow&&qs('[data-action="motion"]',mediaRow),transition=mediaRow&&qs('[data-action="transition"]',mediaRow);
    const transform=`<div class="v42-grid3">${proxyControl($('transformScale'),'Scale (%)')}${proxyControl($('transformX'),'Position X')}${proxyControl($('transformY'),'Position Y')}</div>`;
    const basic=`<div class="v42-grid2">${proxyControl(motion,'움직임')}${proxyControl(transition,'진입 전환')}</div>${transform}`;
    let advanced='';
    if(mediaRow){
      const defs=[['trim-start','Trim 시작'],['trim-end','Trim 끝'],['media-muted','영상 원음 음소거'],['media-volume','영상 원음 볼륨'],['media-fade-in','원음 Fade In'],['media-fade-out','원음 Fade Out']];
      advanced=defs.map(([a,l])=>proxyControl(qs(`[data-action="${a}"]`,mediaRow),l)).join('');
    }
    panel.innerHTML=section('이미지·영상',mediaHead)+section('움직임 · 크기 · 위치',basic)+ (advanced?section('영상 상세 설정',`<div class="v42-grid2">${advanced}</div>`):'')+section('장면 편집',`<div class="v42-actions"><button class="v42-btn" id="v42SplitScene">나누기</button><button class="v42-btn" id="v42MergeScene">다음과 합치기</button><button class="v42-btn danger" id="v42DeleteScene">삭제</button></div>`);
    $('v42ReplaceBtn').onclick=()=>$('v42ReplaceInput').click();
    $('v42ReplaceInput').onchange=async e=>{const f=e.target.files?.[0];if(f&&window.CutflowScene?.replace)await window.CutflowScene.replace(f);e.target.value='';requestRefresh(true);};
    $('v42SplitScene').onclick=()=>window.CutflowScene?.split?.(index,typeof currentTime==='function'?currentTime():undefined);
    $('v42MergeScene').onclick=()=>window.CutflowScene?.mergeNext?.(index);
    $('v42DeleteScene').onclick=()=>{if(confirm(`장면 ${index+1}을 삭제할까요?`))window.CutflowScene?.remove?.(index);};
  }
  function renderNarration(){
    proxyMap.clear();
    const status=$('audioStatus')?.textContent||'오디오 없음';
    const source=proxyControl($('scriptInput'),'대본 · 한 줄이 한 자막 구간',{wide:true})+proxyControl($('projectCaptionWrap'),'자막 자동 줄바꿈')+`<div class="v42-actions">${proxyButton($('scriptFileBtn'),'TXT 대본 불러오기')}${proxyButton($('audioBtn'),'내레이션 불러오기')}</div><p class="v42-status">${esc(status)}</p>${proxyButton($('buildCuesBtn'),'대본으로 자막 구간 만들기',{primary:true,wide:true})}<div class="v42-silence"><strong>내레이션 무음 줄이기</strong><div class="v42-pills"><label><input type="radio" name="v42Silence" value="soft"><span>부드럽게</span></label><label><input type="radio" name="v42Silence" value="normal" checked><span>보통</span></label><label><input type="radio" name="v42Silence" value="tight"><span>타이트</span></label></div><button id="v42SilenceRun" class="v42-btn wide" type="button">현재 내레이션 무음 줄이기</button><p id="v42SilenceStatus" class="v42-help">원본은 유지하고 처리본을 사용합니다.</p></div>`;
    const auto=`<details class="v42-details"><summary>쇼츠 자동 세팅</summary><div class="v42-detail-body">${proxyControl($('autoTitle'),'영상 제목',{wide:true})}${proxyControl($('autoChannel'),'채널명')}${proxyControl($('autoLayout'),'영상 템플릿')}${proxyControl($('autoScript'),'자동 세팅 대본',{wide:true})}<div class="v42-actions">${proxyButton($('autoNarrationBtn'),'내레이션 선택')}${proxyButton($('autoGridBtn'),'+ 그리드 이미지')}${proxyButton($('autoSingleBtn'),'+ 개별 이미지')}${proxyButton($('autoBgmBtn'),'BGM 선택')}</div><div class="v42-auto-status"><span>${esc($('autoNarrationName')?.textContent||'')}</span><span>${esc($('autoGridName')?.textContent||'')}</span><span>${esc($('autoSingleName')?.textContent||'')}</span><span>${esc($('autoMatch')?.textContent||'')}</span></div>${proxyButton($('autoStart'),'쇼츠 자동 세팅 시작',{primary:true,wide:true})}</div></details>`;
    panel.innerHTML=section('대본 · 내레이션',source)+auto;
    $('v42SilenceRun').onclick=async()=>{const statusEl=$('v42SilenceStatus');try{if(typeof audioFile==='undefined'||!audioFile){statusEl.textContent='먼저 내레이션을 불러오세요.';return;}const preset=qs('input[name="v42Silence"]:checked')?.value||'normal';statusEl.textContent='무음 구간 분석 중…';const result=await window.CutflowSilenceCut.process(audioFile,preset,m=>statusEl.textContent=m);if(typeof loadAudio==='function')await loadAudio(result.processedFile);statusEl.textContent=`완료 · ${result.originalDuration.toFixed(1)}초 → ${result.processedDuration.toFixed(1)}초`;requestRefresh(true);}catch(err){statusEl.textContent=`처리 실패: ${err.message}`;}};
  }
  function renderTemplate(){
    proxyMap.clear();
    const basic=proxyControl($('layoutSelect'),'영상 템플릿')+proxyControl($('titleInput'),'상단 제목',{wide:true})+proxyControl($('channelInput'),'채널명')+proxyControl($('fitSelect'),'이미지·영상 맞춤')+proxyControl($('templateSelect'),'움직임 프리셋');
    const title=[['titleFont','폰트'],['titleSize','크기'],['titleColor','색상'],['titleBold','볼드'],['titleItalic','이탤릭'],['titleStrokeEnabled','스트로크'],['titleStrokeWidth','스트로크 두께']].map(([id,l])=>proxyControl($(id),l)).join('');
    const channel=[['channelFont','폰트'],['channelSize','크기'],['channelColor','색상'],['channelBold','볼드'],['channelItalic','이탤릭'],['channelStrokeEnabled','스트로크'],['channelStrokeWidth','스트로크 두께']].map(([id,l])=>proxyControl($(id),l)).join('');
    panel.innerHTML=section('화면 구성',basic+proxyButton($('applyTemplateBtn'),'움직임만 전체 적용',{wide:true})+proxyButton($('randomMotionBtn'),'전체 이미지에 랜덤 무빙',{wide:true}))+section('제목 스타일',`<div class="v42-grid2">${title}</div>`)+section('채널명 스타일',`<div class="v42-grid2">${channel}</div>`);
  }
  function renderBgm(){
    proxyMap.clear();
    const controls=`<div class="v42-actions">${proxyButton($('bgmBtn'),'음악 파일 추가',{primary:true})}${proxyButton($('bgmRemove'),'음악 제거',{danger:true})}</div><p class="v42-status">${esc($('bgmStatus')?.textContent||'음악 없음')}</p><div class="v42-grid2">${proxyControl($('bgmStart'),'음악 시작 지점')}${proxyControl($('bgmVolume'),'BGM 볼륨')}${proxyControl($('bgmRepeat'),'음악이 짧을 때')}${proxyControl($('bgmFadeIn'),'페이드 인')}${proxyControl($('bgmFadeOut'),'페이드 아웃')}</div><p class="v42-help">${esc($('bgmSummary')?.textContent||'')}</p>`;
    panel.innerHTML=section('배경음악 · BGM',controls);
  }
  function renderPanel(force=false){
    if(!force&&panel.contains(document.activeElement))return;
    if(tab==='caption')renderCaption(); else if(tab==='media')renderMedia(); else if(tab==='narration')renderNarration(); else if(tab==='template')renderTemplate(); else renderBgm();
  }
  function requestRefresh(force=false){
    if(renderQueued&&!force)return;renderQueued=true;requestAnimationFrame(()=>{renderQueued=false;renderSceneStrip();renderPanel(force);syncPlayer();});
  }
  function syncPlayer(){
    const s=$('scrubber'),m=$('v42Scrubber');if(s&&m&&document.activeElement!==m){m.min=s.min;m.max=s.max;m.value=s.value;}
    const ct=$('currentTime')?.textContent||'0:00.0',et=$('endTime')?.textContent||'0:00.0';$('v42TimeLabel').textContent=`${ct} / ${et}`;
    const play=$('playBtn'),mobilePlay=qs('.v42-player .play');if(play&&mobilePlay)mobilePlay.textContent=play.textContent||'▶';
  }
  function mirrorStage(){
    const src=$('stage');if(src&&ctx){try{ctx.clearRect(0,0,stage.width,stage.height);ctx.drawImage(src,0,0,stage.width,stage.height);if(previewDialog.open){fullCtx.clearRect(0,0,fullStage.width,fullStage.height);fullCtx.drawImage(src,0,0,fullStage.width,fullStage.height);}}catch{}}
    requestAnimationFrame(mirrorStage);
  }

  app.addEventListener('click',e=>{
    const click=e.target.closest('[data-click]');if(click){$(click.dataset.click)?.click();return;}
    const proxy=e.target.closest('[data-proxy-click]');if(proxy){proxyMap.get(proxy.dataset.proxyClick)?.click();setTimeout(()=>requestRefresh(true),0);return;}
    const scene=e.target.closest('[data-scene]');if(scene){const i=Number(scene.dataset.scene);lastSceneId=null;sceneIndex=i;window.CutflowScene?.select?.(i);requestRefresh(true);return;}
  });
  panel.addEventListener('input',e=>{const k=e.target.dataset.proxy,el=proxyMap.get(k);if(!el)return;if(el.type==='checkbox')el.checked=e.target.checked;else el.value=e.target.value;dispatch(el,'input');});
  panel.addEventListener('change',e=>{const k=e.target.dataset.proxy,el=proxyMap.get(k);if(!el)return;if(el.type==='checkbox')el.checked=e.target.checked;else el.value=e.target.value;dispatch(el,'change');setTimeout(()=>requestRefresh(false),0);});
  tabs.addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(!b)return;tab=b.dataset.tab;qsa('button',tabs).forEach(x=>x.setAttribute('aria-pressed',String(x===b)));renderPanel(true);panel.scrollIntoView({block:'start',behavior:'smooth'});});
  $('v42AddScene').onclick=()=>$('fileInput')?.click();
  $('v42Fullscreen').onclick=()=>previewDialog.showModal();$('v42FullClose').onclick=()=>previewDialog.close();previewDialog.addEventListener('cancel',e=>{e.preventDefault();previewDialog.close();});
  $('v42Scrubber').addEventListener('input',e=>{const s=$('scrubber');if(s){s.value=e.target.value;dispatch(s,'input');}});
  $('v42Scrubber').addEventListener('change',e=>{const s=$('scrubber');if(s){s.value=e.target.value;dispatch(s,'change');}});

  for(const id of ['cueList','sceneList','nowPlaying','projectSaveStatus','bgmStatus','bgmSummary','audioStatus']){const el=$(id);if(el)new MutationObserver(()=>requestRefresh(false)).observe(el,{subtree:true,childList:true,attributes:true});}
  window.addEventListener('cutflow-scene',e=>{sceneIndex=Number(e.detail)||0;lastSceneId=null;requestRefresh(true);});
  window.addEventListener('resize',()=>{if(!isMobile())location.reload();});
  setInterval(syncPlayer,200);
  renderSceneStrip();renderPanel(true);syncPlayer();mirrorStage();
})();
