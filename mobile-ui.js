/* Mobile presentation adapter. Existing controls, events and project data stay authoritative. */
(()=>{
  const mq=matchMedia('(max-width:760px)');
  let enabled=false,index=0,selectedId=null,mode='image',hadMedia=false,opener=null,lastStroke=6;
  const slots=new Map(),q=s=>document.querySelector(s);
  const shell=document.createElement('section');shell.id='mobileStudio';shell.className='mobile-only';
  shell.innerHTML=`<div id="mobilePreview"></div><details id="mobileProject" open><summary>⚙ 프로젝트 설정 <span>대본 · 음성 · 제목</span></summary><div id="mobileProjectBody"></div></details><div id="mobileEditor"><div class="mobile-current-heading"><div><span class="mobile-eyebrow">CURRENT SCENE</span><h2 id="mobileSceneTitle">장면을 추가하세요</h2></div><button id="mobileAdd" type="button">+ 이미지·영상</button></div><p id="mobileEmpty">프로젝트 설정에서 대본, 내레이션과 이미지·영상을 입력하세요.</p><div id="mobileEditorBody"></div></div>`;
  q('.app-shell').prepend(shell);
  const nav=document.createElement('nav');nav.id='mobileTools';nav.className='mobile-only';nav.setAttribute('aria-label','모바일 편집 도구');
  nav.innerHTML=[['image','▧','이미지'],['caption','T','자막'],['effects','✧','효과'],['scenes','▦','전체 장면']].map(([key,icon,name])=>`<button type="button" data-mobile-tab="${key}" aria-pressed="${key==='image'}"><span aria-hidden="true">${icon}</span>${name}</button>`).join('');document.body.append(nav);
  const sheet=document.createElement('section');sheet.id='mobileSheet';sheet.className='mobile-only';sheet.hidden=true;sheet.setAttribute('role','dialog');sheet.setAttribute('aria-label','편집 설정');
  sheet.innerHTML='<div class="mobile-sheet-heading"><h2 id="mobileSheetTitle">자막 설정</h2><button type="button" id="mobileSheetClose" aria-label="설정 닫기">×</button></div><div id="mobileSheetBody"><div id="mobileCaptionHost"></div><div id="mobileSceneGrid"></div></div>';document.body.append(sheet);
  const mobileNav=document.createElement('div');mobileNav.id='mobileSceneNav';mobileNav.className='mobile-only';mobileNav.innerHTML='<button id="mobilePrev" type="button">‹ 이전</button><strong id="mobileSceneCount">장면 0 / 0</strong><button id="mobileNext" type="button">다음 ›</button>';
  q('.preview-panel').append(mobileNav);
  const exportButton=document.createElement('button');exportButton.id='mobileExport';exportButton.className='mobile-only';exportButton.type='button';exportButton.textContent='내보내기';q('.topbar').append(exportButton);
  const replaceButton=document.createElement('button');replaceButton.id='mobileReplace';replaceButton.type='button';replaceButton.textContent='이미지·영상 교체';replaceButton.className='mobile-only';q('#mobileEditor .mobile-current-heading').after(replaceButton);
  const replaceInput=document.createElement('input');replaceInput.type='file';replaceInput.accept='image/*,video/*';replaceInput.hidden=true;document.body.append(replaceInput);
  const strokeToggle=document.createElement('label');strokeToggle.className='mobile-only mobile-stroke-toggle';strokeToggle.innerHTML='<input id="mobileCaptionStroke" type="checkbox"> 스트로크 사용';$('captionStroke').closest('label').before(strokeToggle);
  function move(node,target){if(!slots.has(node)){const marker=document.createComment('mobile-original-position');node.before(marker);slots.set(node,marker);}target.append(node);}
  function items(){return CutflowScene.items();}
  function start(i){return cues.length?cues[i]?.start:sceneStart(i);}
  function select(i){if(!enabled)return;CutflowScene.select(i);}
  window.addEventListener('cutflow-scene',e=>{if(enabled){index=e.detail;selectedId=items()[index]?.id;sync();}});
  function closeSheet(focus=true){sheet.hidden=true;document.body.classList.remove('mobile-sheet-open');setTab(mode);if(focus&&opener?.isConnected)opener.focus({preventScroll:true});}
  function setTab(tab){nav.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mobileTab===tab)));}
  function openSheet(tab){if(!enabled)return;pause();opener=document.activeElement;sheet.hidden=false;document.body.classList.add('mobile-sheet-open');$('mobileSheetTitle').textContent=tab==='caption'?'자막 설정':'전체 장면';$('mobileCaptionHost').hidden=tab!=='caption';$('mobileSceneGrid').hidden=tab!=='scenes';if(tab==='caption'){if(cues.length)window.selectStyleCue?.(index);$('captionStylePanel').open=true;syncStroke();}else buildGrid();$('mobileSheetBody').scrollTop=0;setTab(tab);$('mobileSheetClose').focus({preventScroll:true});requestAnimationFrame(viewport);}
  function syncStroke(){const n=Number($('captionStroke').value);$('mobileCaptionStroke').checked=n>0;if(n>0)lastStroke=n;}
  window.syncCaptionStrokeUI=syncStroke;
  $('captionStylePanel').addEventListener('input',()=>queueMicrotask(syncStroke));
  $('captionStylePanel').addEventListener('change',()=>queueMicrotask(syncStroke));
  function buildGrid(){
    $('mobileSceneGrid').innerHTML=items().length?items().map((item,i)=>{const {source,duration}=CutflowScene.thumbnail(item,i);return `<button type="button" data-mobile-scene="${i}" aria-label="장면 ${i+1} 선택" aria-current="${i===index?'true':'false'}">${source?.thumb?`<img src="${esc(source.thumb)}" alt="">`:'<span class="mobile-missing">컷 없음</span>'}<span class="mobile-grid-number">${String(i+1).padStart(2,'0')}</span><span class="mobile-grid-duration">${duration.toFixed(1)}초</span></button>`;}).join(''):'<p>장면을 먼저 추가해 주세요.</p>';
  }
  function sync(){
    if(!enabled)return;
    const list=items(),found=list.findIndex(item=>item.id===selectedId);
    index=found>=0?found:Math.min(index,Math.max(0,list.length-1));selectedId=list[index]?.id||null;
    q('#mobileSceneTitle').textContent=list.length?`장면 ${index+1}`:'장면을 추가하세요';
    $('mobileSceneCount').textContent=`장면 ${list.length?index+1:0} / ${list.length}`;
    $('mobilePrev').disabled=!list.length||index===0||exporting;$('mobileNext').disabled=!list.length||index===list.length-1||exporting;
    exportButton.disabled=$('exportBtn').disabled;replaceButton.disabled=!list.length||loading>0||exporting;
    $('mobileEmpty').hidden=!!list.length;
    q('#mobileEditor').dataset.mode=mode;
    document.querySelectorAll('.cue-row,.scene-row').forEach(row=>{const on=Number(row.dataset.index)===index;row.classList.toggle('mobile-selected',on);row.draggable=false;if(!row.querySelector('.mobile-caption-text')){const text=row.querySelector('.editor-text');if(text){const fold=document.createElement('details');fold.className='mobile-caption-text';fold.innerHTML='<summary>자막 문구 · 선택 글자색</summary>';text.before(fold);fold.append(text);}}});
    if(scenes.length&&!hadMedia){$('mobileProject').open=false;hadMedia=true;}if(!scenes.length)hadMedia=false;
    if(!sheet.hidden&&!$('mobileSceneGrid').hidden)buildGrid();syncStroke();
  }
  function activate(){
    if(enabled)return;window.dispatchEvent(new Event('cutflow-mobile-activate'));index=CutflowScene.index();selectedId=items()[index]?.id;captionWasOpen=$('captionStylePanel').open;enabled=true;document.body.classList.add('mobile-editor');
    move(q('.preview-panel'),$('mobilePreview'));
    [q('.hero'),q('.source-panel'),q('.bgm-panel'),q('.setup-panel')].forEach(n=>move(n,$('mobileProjectBody')));
    move(q('.timeline-panel'),$('mobileEditorBody'));move($('captionStylePanel'),$('mobileCaptionHost'));
    // The export controls remain the originals, tucked into project settings.
    move(q('.export-panel'),$('mobileProjectBody'));
    $('captionStylePanel').open=true;sync();
  }
  function deactivate(){if(!enabled)return;closeSheet(false);enabled=false;document.body.classList.remove('mobile-editor','mobile-compact','mobile-keyboard','mobile-input-focus');for(const [node,marker] of slots){marker.replaceWith(node);}slots.clear();document.querySelectorAll('.scene-row').forEach(row=>row.draggable=true);document.querySelectorAll('.mobile-caption-text').forEach(fold=>fold.replaceWith(...Array.from(fold.children).filter(n=>n.tagName!=='SUMMARY')));$('captionStylePanel').open=captionWasOpen;}
  let captionWasOpen=$('captionStylePanel').open;
  mq.addEventListener('change',()=>mq.matches?activate():deactivate());
  $('mobilePrev').onclick=()=>select(index-1);$('mobileNext').onclick=()=>select(index+1);
  $('mobileAdd').onclick=()=>$('fileInput').click();exportButton.onclick=()=>$('exportBtn').click();
  nav.onclick=e=>{const tab=e.target.closest('[data-mobile-tab]')?.dataset.mobileTab;if(!tab)return;if(tab==='caption'||tab==='scenes')openSheet(tab);else{mode=tab;closeSheet(false);sync();}};
  $('mobileSheetClose').onclick=()=>closeSheet();
  $('mobileSceneGrid').onclick=e=>{const target=e.target.closest('[data-mobile-scene]');if(target){select(Number(target.dataset.mobileScene));closeSheet(false);}};
  // Capture only mobile UI actions; the desktop listeners are untouched.
  $('cueList').addEventListener('click',e=>{if(enabled&&e.target.closest('[data-action="style"]')){e.stopImmediatePropagation();openSheet('caption');}},true);
  $('styleCue').addEventListener('change',()=>{if(enabled){index=cues.findIndex(c=>c.id===$('styleCue').value);selectedId=cues[index]?.id;sync();}});
  $('mobileCaptionStroke').oninput=()=>{const control=$('captionStroke');control.value=$('mobileCaptionStroke').checked?lastStroke:0;control.dispatchEvent(new Event('input',{bubbles:true}));};
  replaceButton.onclick=()=>replaceInput.click();
  replaceInput.onchange=async()=>{
    await CutflowScene.replace(replaceInput.files[0]);replaceInput.value='';
  };
  let touch=null;
  $('stage').addEventListener('touchstart',e=>{if(enabled&&e.touches.length===1)touch={x:e.touches[0].clientX,y:e.touches[0].clientY};},{passive:true});
  $('stage').addEventListener('touchend',e=>{if(!touch||!enabled)return;const t=e.changedTouches[0],dx=t.clientX-touch.x,dy=t.clientY-touch.y;touch=null;if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.8)select(index+(dx<0?1:-1));},{passive:true});
  $('stage').addEventListener('touchcancel',()=>touch=null,{passive:true});
  document.addEventListener('keydown',e=>{if(enabled&&e.key==='Escape'&&!sheet.hidden)closeSheet();});
  window.addEventListener('scroll',()=>{if(enabled)document.body.classList.toggle('mobile-compact',scrollY>80);viewport();},{passive:true});
  function viewport(){if(!enabled)return;const vv=window.visualViewport;const height=vv?.height||innerHeight;document.documentElement.style.setProperty('--mobile-visible-height',height+'px');document.documentElement.style.setProperty('--mobile-keyboard-offset',Math.max(0,innerHeight-height-(vv?.offsetTop||0))+'px');document.body.classList.toggle('mobile-keyboard',height<innerHeight*.75);const available=height-Math.max(0,$('mobilePreview').getBoundingClientRect().bottom)-nav.offsetHeight-12;document.documentElement.style.setProperty('--mobile-sheet-height',Math.max(130,available)+'px');}
  document.addEventListener('focusin',()=>{if(enabled){document.body.classList.toggle('mobile-input-focus',document.activeElement.matches('textarea,input[type=number],input[type=text],input:not([type])'));viewport();}});document.addEventListener('focusout',()=>{if(enabled)requestAnimationFrame(()=>{document.body.classList.toggle('mobile-input-focus',document.activeElement.matches('textarea,input[type=number],input[type=text],input:not([type])'));viewport();});});window.visualViewport?.addEventListener('resize',viewport);window.addEventListener('resize',viewport);
  new MutationObserver(()=>{sync();}).observe($('cueList'),{childList:true});
  new MutationObserver(()=>{sync();}).observe($('sceneList'),{childList:true});
  new MutationObserver(()=>{if(!enabled)return;const active=CutRenderer.locate(timelineScenes(),currentTime()).index;if(active>=0&&active!==index){index=active;selectedId=items()[index]?.id;if(cues.length&&!sheet.hidden)window.selectStyleCue?.(index);sync();}}).observe($('nowPlaying'),{childList:true});
  new MutationObserver(()=>{if(enabled)exportButton.disabled=$('exportBtn').disabled;}).observe($('exportBtn'),{attributes:true,attributeFilter:['disabled']});
  new ResizeObserver(()=>viewport()).observe($('mobilePreview'));if(mq.matches)activate();viewport();
})();
