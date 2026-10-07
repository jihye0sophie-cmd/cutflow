(()=>{
const $=id=>document.getElementById(id);
const state={grids:[],singles:[],narration:null,processedNarration:null,silencePreset:'normal',bgm:null,mediaMode:'multi',longVideo:null,running:false,drag:null};
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const setText=(id,text)=>{const el=$(id);text=String(text);if(el&&el.textContent!==text)el.textContent=text;};
const setDisabled=(id,value)=>{const el=$(id),next=!!value;if(el&&el.disabled!==next)el.disabled=next;};
function lines(){return window.CutflowAutoBridge?.scriptLines($('autoScript').value||'')||[];}
function silencePreset(){return document.querySelector('input[name="autoSilencePreset"]:checked')?.value||'normal';}
function updateSilenceInfo(){
  state.silencePreset=silencePreset();const cfg=window.CutflowSilenceCut?.PRESETS?.[state.silencePreset];if(!cfg)return;
  setText('autoSilenceInfo',`${cfg.label} · ${cfg.thresholdDb} dB · 최소 ${cfg.minSilence.toFixed(2)}초 · 공백 ${cfg.keepSilence.toFixed(2)}초`);
}

function evenCuts(count){return Array.from({length:Math.max(0,count-1)},(_,i)=>(i+1)*100/count);}
function normalizeGrid(grid){
  grid.cols=clamp(Number(grid.cols)||4,1,12);grid.rows=clamp(Number(grid.rows)||1,1,12);grid.gap=clamp(Number.isFinite(Number(grid.gap))?Number(grid.gap):8,0,40);
  if(!Array.isArray(grid.xCuts)||grid.xCuts.length!==grid.cols-1)grid.xCuts=evenCuts(grid.cols);
  if(!Array.isArray(grid.yCuts)||grid.yCuts.length!==grid.rows-1)grid.yCuts=evenCuts(grid.rows);
  return grid;
}
function capacity(){return state.grids.reduce((sum,g)=>sum+normalizeGrid(g).cols*g.rows,0)+state.singles.length;}
function gridCapacity(){return state.grids.reduce((sum,g)=>sum+normalizeGrid(g).cols*g.rows,0);}
function gridName(){return state.grids.length?`${state.grids.length}장 · 분할 ${gridCapacity()}컷`:'선택 안 됨';}
function singleName(){return state.singles.length?`${state.singles.length}장 선택`:'선택 안 됨';}
function autoState(){
  const scriptCount=lines().length,imageCount=capacity(),hasNarration=!!state.narration,mediaMode=state.mediaMode||'multi',hasLongVideo=!!state.longVideo;
  const mediaReady=mediaMode==='long-video'?hasLongVideo:imageCount>=scriptCount;
  const canStart=!state.running&&!!scriptCount&&hasNarration&&mediaReady;
  const reason=state.running?'자동 세팅 실행 중…':!scriptCount?'대본을 입력해 주세요.':!hasNarration?'내레이션을 선택해 주세요.':mediaMode==='long-video'&&!hasLongVideo?'긴 영상 1개를 선택해 주세요.':mediaMode==='multi'&&imageCount<scriptCount?`이미지가 ${scriptCount-imageCount}장 부족합니다.`:'준비 완료';
  return {scriptCount,imageCount,hasNarration,mediaMode,hasLongVideo,longVideoName:state.longVideo?.name||'',running:state.running,canStart,reason};
}
function update(){
  const info=autoState(),n=info.scriptCount,c=info.imageCount,longMode=info.mediaMode==='long-video';setText('autoScriptCount',`${n}개`);setText('autoImageCount',longMode?(state.longVideo?'1개 영상':'0개'):`${c}개`);
  setText('autoNarrationName',state.narration?.name||'선택 안 됨');setText('autoBgmName',state.bgm?.name||'선택 안 됨');setText('autoGridName',gridName());setText('autoSingleName',singleName());setText('autoLongVideoName',state.longVideo?.name||'선택 안 됨');
  if($('autoMultiMediaSection'))$('autoMultiMediaSection').hidden=longMode;if($('autoLongVideoSection'))$('autoLongVideoSection').hidden=!longMode;
  const m=$('autoMatch'),matchClass='auto-match '+(longMode?(!n||!state.longVideo?'muted':'good'):(!n||!c?'muted':c<n?'bad':c===n?'good':'warn'));if(m.className!==matchClass)m.className=matchClass;
  setText('autoMatch',longMode?(!n?'대본을 입력하면 필요한 장면 수를 계산합니다.':!state.longVideo?'긴 영상 1개를 선택해 주세요.':`긴 영상 1개를 자막 기준 ${n}개 장면으로 자동 분할합니다.`):!n?'대본을 입력하면 필요한 장면 수를 계산합니다.':!c?'그리드 또는 개별 이미지를 추가해 주세요.':c<n?`이미지가 ${n-c}장 부족합니다.`:c===n?'대본 장면 수와 이미지 수가 일치합니다.':`이미지가 ${c-n}장 더 많습니다. 앞에서 ${n}장만 사용합니다.`);
  setDisabled('autoStart',!info.canStart);
  emit('cutflow-auto-state',info);
}
function gridMarkup(grid,index){
  normalizeGrid(grid);
  const x=grid.xCuts.map((p,i)=>`<button type="button" class="auto-cut-line auto-cut-x" data-axis="x" data-cut="${i}" style="left:${p}%" aria-label="세로 분할 여백 ${i+1}"></button>`).join('');
  const y=grid.yCuts.map((p,i)=>`<button type="button" class="auto-cut-line auto-cut-y" data-axis="y" data-cut="${i}" style="top:${p}%" aria-label="가로 분할 여백 ${i+1}"></button>`).join('');
  const gapXPct=grid.width?grid.gap/grid.width*100:0,gapYPct=grid.height?grid.gap/grid.height*100:0;
  return `<article class="auto-grid-item" data-grid-index="${index}">
    <div class="auto-grid-item-head"><div><strong>${esc(grid.file.name)}</strong><span>${grid.cols}×${grid.rows} · ${grid.cols*grid.rows}장</span></div><button type="button" class="auto-grid-remove" data-grid-remove aria-label="이미지 제거">×</button></div>
    <div class="auto-grid-controls"><label>열<input data-grid-cols type="number" min="1" max="12" value="${grid.cols}"></label><span>×</span><label>행<input data-grid-rows type="number" min="1" max="12" value="${grid.rows}"></label><label>분할 여백(px)<input data-grid-gap type="number" min="0" max="40" step="1" value="${grid.gap}"></label><button type="button" class="button ghost small" data-grid-reset>초기화</button></div>
    <div class="auto-grid-preview" style="aspect-ratio:${grid.width||4}/${grid.height||2};--cut-gap-x:${gapXPct}%;--cut-gap-y:${gapYPct}%"><img src="${grid.url}" alt="${esc(grid.file.name)} 분할 미리보기">${x}${y}</div>
    <p class="auto-grid-help">노란 띠가 실제 분할 시 제거되는 여백입니다. 기본 8px이며, 경계가 맞지 않으면 띠의 중심을 마우스나 손가락으로 움직여 조정하세요.</p>
  </article>`;
}
function renderGrids(){
  $('autoGridList').innerHTML=state.grids.length?state.grids.map(gridMarkup).join(''):'<p class="auto-grid-empty">그리드 이미지를 추가하면 이미지별 분할 설정이 표시됩니다.</p>';
  update();
}

function renderSingles(){
  const root=$('autoSingleList');if(!root)return;
  root.innerHTML=state.singles.length?state.singles.map((item,index)=>`<article class="auto-single-item" data-single-index="${index}"><img src="${item.url}" alt="${esc(item.file.name)}"><div><strong>${esc(item.file.name)}</strong><span>개별 이미지 · 장면 1컷</span></div><button type="button" class="auto-grid-remove" data-single-remove aria-label="개별 이미지 제거">×</button></article>`).join(''):'<p class="auto-single-empty">분할 없이 그대로 사용할 개별 이미지를 추가할 수 있습니다.</p>';
}
async function addSingleFiles(files){
  for(const file of files){try{const info=await imageInfo(file);state.singles.push({file,url:info.url,width:info.width,height:info.height});}catch(e){window.CutflowAutoBridge?.toast?.(e.message);}}
  renderSingles();update();window.dispatchEvent(new CustomEvent('cutflow-auto-grid-change',{detail:{kind:'single-add',commit:true}}));
}
async function imageInfo(file){return new Promise((res,rej)=>{const url=URL.createObjectURL(file),im=new Image();im.onload=()=>res({url,width:im.naturalWidth,height:im.naturalHeight});im.onerror=()=>{URL.revokeObjectURL(url);rej(new Error(`${file.name}을 읽지 못했습니다.`))};im.src=url;});}
async function addGridFiles(files){
  for(const file of files){try{const info=await imageInfo(file);state.grids.push({file,cols:4,rows:1,gap:8,xCuts:evenCuts(4),yCuts:evenCuts(1),...info});}catch(e){window.CutflowAutoBridge?.toast?.(e.message);}}
  renderGrids();window.dispatchEvent(new CustomEvent('cutflow-auto-grid-change',{detail:{kind:'grid-add',commit:true}}));
}
function resetCuts(grid){grid.xCuts=evenCuts(grid.cols);grid.yCuts=evenCuts(grid.rows);}
function lineBounds(cuts,index){return {min:index?cuts[index-1]+2:2,max:index<cuts.length-1?cuts[index+1]-2:98};}
function updateDraggedLine(e){
  const d=state.drag;if(!d||e.pointerId!==d.pointerId)return;const grid=state.grids[d.gridIndex];if(!grid)return;
  const rect=d.preview.getBoundingClientRect();let pct=d.axis==='x'?(e.clientX-rect.left)/rect.width*100:(e.clientY-rect.top)/rect.height*100;
  const cuts=d.axis==='x'?grid.xCuts:grid.yCuts,b=lineBounds(cuts,d.cutIndex);pct=clamp(pct,b.min,b.max);cuts[d.cutIndex]=pct;
  d.line.style[d.axis==='x'?'left':'top']=`${pct}%`;
}
function stopDrag(e){if(!state.drag||e?.pointerId!=null&&e.pointerId!==state.drag.pointerId)return;state.drag.line.classList.remove('dragging');state.drag=null;document.body.classList.remove('auto-cut-dragging');}
async function imageElement(file){return new Promise((res,rej)=>{const u=URL.createObjectURL(file),im=new Image();im.onload=()=>{URL.revokeObjectURL(u);res(im)};im.onerror=()=>{URL.revokeObjectURL(u);rej(new Error(`${file.name}을 읽지 못했습니다.`))};im.src=u;});}
async function splitGrid(grid,startIndex,limit){
  normalizeGrid(grid);const im=await imageElement(grid.file),out=[];
  const xs=[0,...grid.xCuts,100].map(p=>p/100*im.naturalWidth),ys=[0,...grid.yCuts,100].map(p=>p/100*im.naturalHeight);
  for(let r=0;r<grid.rows&&out.length<limit;r++)for(let c=0;c<grid.cols&&out.length<limit;c++){
    const halfGap=grid.gap/2;
    const left=xs[c]+(c>0?halfGap:0),right=xs[c+1]-(c<grid.cols-1?halfGap:0);
    const top=ys[r]+(r>0?halfGap:0),bottom=ys[r+1]-(r<grid.rows-1?halfGap:0);
    const sx=Math.max(0,left),sy=Math.max(0,top),sw=Math.max(1,right-left),sh=Math.max(1,bottom-top);
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(sw));canvas.height=Math.max(1,Math.round(sh));
    canvas.getContext('2d').drawImage(im,sx,sy,sw,sh,0,0,canvas.width,canvas.height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    if(!blob)throw new Error('이미지 분할에 실패했습니다.');
    const no=String(startIndex+out.length+1).padStart(2,'0');out.push(new File([blob],`scene_${no}.png`,{type:'image/png'}));
  }return out;
}
function emit(type,detail={}){window.dispatchEvent(new CustomEvent(type,{detail}));}
function status(text,step){$('autoStatus').textContent=text;document.querySelectorAll('.auto-step').forEach((el,i)=>el.dataset.state=i<step?'done':i===step?'active':'');emit('cutflow-auto-status',{text,step});}
async function applyProjectBasics(){
  const title=$('autoTitle').value||'',channel=$('autoChannel').value||'',layout=$('autoLayout').value||'fullscreen';
  $('titleInput').value=title;$('titleInput').dispatchEvent(new Event('input',{bubbles:true}));
  $('channelInput').value=channel;$('channelInput').dispatchEvent(new Event('input',{bubbles:true}));
  $('layoutSelect').value=layout;$('layoutSelect').dispatchEvent(new Event('input',{bubbles:true}));if(layout==='story'){if($('storyTitle')){$('storyTitle').value=title;$('storyTitle').dispatchEvent(new Event('input',{bubbles:true}));}if($('storyChannel')){$('storyChannel').value=channel;$('storyChannel').dispatchEvent(new Event('input',{bubbles:true}));}}
}
async function run(){
  if(state.running)return;const script=lines();state.silencePreset=silencePreset();const longMode=state.mediaMode==='long-video';
  if(!script.length||!state.narration||(longMode?!state.longVideo:capacity()<script.length))return;
  const bridge=window.CutflowProjectBridge,hadWork=!!bridge?.hasWork?.();
  if(hadWork&&!confirm('자동 세팅을 시작하면 현재 대본·내레이션·장면 구성이 새 입력으로 교체됩니다. 계속할까요?'))return;
  const rollback=bridge?.capture?.()||null;
  const historyBatch=!!window.CutflowHistory?.beginBatch?.('자동 세팅','project');let historyDone=false;
  state.running=true;update();$('autoProgress').hidden=false;
  try{
    status(longMode?'긴 영상을 자막 장면 수에 맞춰 준비하는 중…':'장면 이미지를 준비하는 중…',0);let files=[];
    if(longMode)files=Array.from({length:script.length},()=>state.longVideo);
    else{
      for(const grid of state.grids){if(files.length>=script.length)break;files.push(...await splitGrid(grid,files.length,script.length-files.length));}
      if(files.length<script.length){for(const item of state.singles){if(files.length>=script.length)break;files.push(item.file);}}
      if(files.length!==script.length)throw new Error(`필요한 이미지 ${script.length}장 중 ${files.length}장만 준비되었습니다.`);
    }
    status(longMode?`긴 영상 자동 분할용 장면 ${files.length}개 준비 · 내레이션 무음 줄이는 중…`:`이미지 ${files.length}장 준비 완료 · 내레이션 무음 줄이는 중…`,1);
    await applyProjectBasics();$('scriptInput').value=$('autoScript').value;$('scriptInput').dispatchEvent(new Event('input',{bubbles:true}));window.CutflowAutoBridge.markChanged();
    if(!window.CutflowSilenceCut?.process)throw new Error('무음컷 엔진을 불러오지 못했습니다. 페이지를 새로고침해 주세요.');
    const cut=await window.CutflowSilenceCut.process(state.narration,state.silencePreset,msg=>status(msg,1));state.processedNarration=cut.processedFile;
    status(`무음컷 완료 · ${cut.originalDuration.toFixed(1)}초 → ${cut.processedDuration.toFixed(1)}초 · 타임라인용 내레이션 연결 중…`,1);
    if(!await window.CutflowAutoBridge.loadNarration(state.processedNarration))throw new Error('처리된 내레이션을 읽지 못했습니다.');
    status(longMode?'기존 장면을 정리하고 긴 영상을 가상 장면으로 나누는 중…':'기존 장면을 정리하고 이미지를 배치하는 중…',2);await window.CutflowAutoBridge.clearScenesOnly();
    const added=await window.CutflowAutoBridge.addMedia(files);if(added!==files.length)throw new Error(longMode?`긴 영상 장면 ${files.length}개 중 ${added}개만 생성되었습니다.`:`이미지 ${files.length}장 중 ${added}장만 추가되었습니다.`);
    const afterMedia=window.CutflowAutoBridge.counts?.();if(afterMedia&&afterMedia.sceneCount!==script.length)throw new Error(`장면 생성 수가 맞지 않습니다. 필요 ${script.length}장 / 생성 ${afterMedia.sceneCount}장`);
    status('내레이션의 쉼을 분석해 자막 타이밍을 자동으로 맞추는 중…',3);const result=window.CutflowAutoBridge.buildTimeline(longMode?{sequentialVideo:{start:Math.max(0,Number($('autoLongVideoStart')?.value)||0)}}:{});
    if(result.cueCount!==script.length)throw new Error(`자막 구간 수가 맞지 않습니다. 필요 ${script.length}개 / 생성 ${result.cueCount}개`);
    if(result.sceneCount!==script.length)throw new Error(`장면 수가 맞지 않습니다. 필요 ${script.length}장 / 생성 ${result.sceneCount}장`);
    if(result.missingSceneCount)throw new Error(`장면이 연결되지 않은 자막이 ${result.missingSceneCount}개 있습니다.`);
    await window.applyTemplateTypography?.($('autoLayout').value,{applyCues:true,notify:false});
    if($('autoCaptionWrap')?.checked){status('자막을 보기 좋게 줄바꿈하는 중…',3);await window.CutflowAutoBridge.autoWrapCaptions?.();}
    status('BGM을 적용하는 중…',4);
    if(state.bgm){if(!(await window.loadBgmFile?.(state.bgm)))throw new Error('BGM을 읽지 못했습니다.');}
    else window.CutflowBgm?.remove?.();
    status('자동 세팅이 완료되었습니다.',5);$('autoProgress').querySelectorAll('.auto-step').forEach(el=>el.dataset.state='done');
    const complete={cueCount:result.cueCount,sceneCount:result.sceneCount,missingSceneCount:result.missingSceneCount||0,imageCount:longMode?0:files.length,mediaMode:state.mediaMode,longVideoSegments:longMode?files.length:0};
    if(historyBatch){window.CutflowHistory?.endBatch?.(true);historyDone=true;}
    emit('cutflow-auto-complete',complete);
    if(window.CutflowUI?.mode!=='mobile')setTimeout(()=>document.querySelector('.workspace')?.scrollIntoView({behavior:'smooth',block:'start'}),250);
  }catch(e){
    let rollbackError=null;
    if(rollback&&bridge?.restore){
      try{await bridge.restore(rollback,{history:true});}
      catch(error){rollbackError=error;console.error('Cutflow auto setup rollback failed',error);}
    }
    const message=rollbackError?`자동 세팅 중단: ${e.message} · 시작 전 상태 복원에도 실패했습니다.`:`자동 세팅 중단: ${e.message}${rollback?' · 시작 전 상태로 복원했습니다.':''}`;
    status(message,0);emit('cutflow-auto-error',{message,error:e,rolledBack:!!rollback&&!rollbackError});window.CutflowAutoBridge?.toast?.(message);
  }
  finally{if(historyBatch&&!historyDone)window.CutflowHistory?.endBatch?.(false);state.running=false;update();}
}
function syncBasicsFromProject(){
  if(!$('autoTitle').value)$('autoTitle').value=$('layoutSelect').value==='story'?($('storyTitle')?.value||$('titleInput').value||''):($('titleInput').value||'');
  if(!$('autoChannel').value)$('autoChannel').value=$('layoutSelect').value==='story'?($('storyChannel')?.value||$('channelInput').value||''):($('channelInput').value||'');
  $('autoLayout').value=$('layoutSelect').value||'fullscreen';
}
$('autoToggle').onclick=()=>{const open=$('autoPanel').hidden;if(open)syncBasicsFromProject();$('autoPanel').hidden=!open;$('autoToggle').setAttribute('aria-expanded',String(open));$('autoToggle').closest('.auto-setup')?.classList.toggle('is-open',open);};
$('autoScript').addEventListener('input',update);
$('autoMediaMode').addEventListener('change',e=>{state.mediaMode=e.target.value==='long-video'?'long-video':'multi';update();});
$('autoLongVideoBtn').onclick=()=>$('autoLongVideo').click();$('autoLongVideo').onchange=e=>{const file=e.target.files[0]||null;state.longVideo=file&&(/^video\//.test(file.type)||/\.(mp4|mov|webm|m4v)$/i.test(file.name))?file:null;if(file&&!state.longVideo)window.CutflowAutoBridge?.toast?.('영상 파일을 선택해 주세요.');e.target.value='';update();};
$('autoLongVideoStart').addEventListener('input',update);
$('autoNarrationBtn').onclick=()=>{const input=$('autoNarration');input.value='';input.click();};$('autoNarration').onchange=e=>{state.narration=e.target.files[0]||null;state.processedNarration=null;e.target.value='';update();};
document.querySelectorAll('input[name="autoSilencePreset"]').forEach(el=>el.addEventListener('change',()=>{state.processedNarration=null;updateSilenceInfo();}));
$('autoGridBtn').onclick=()=>$('autoGrids').click();$('autoGrids').onchange=e=>{addGridFiles([...e.target.files]);e.target.value='';};
$('autoSingleBtn').onclick=()=>$('autoSingles').click();$('autoSingles').onchange=e=>{addSingleFiles([...e.target.files]);e.target.value='';};
$('autoBgmBtn').onclick=()=>{const input=$('autoBgm');input.value='';input.click();};$('autoBgm').onchange=e=>{state.bgm=e.target.files[0]||null;e.target.value='';update();};
$('autoGridList').addEventListener('input',e=>{const item=e.target.closest('.auto-grid-item');if(!item)return;const index=Number(item.dataset.gridIndex),grid=state.grids[index];if(!grid||e.target.value==='')return;const value=Number(e.target.value);if(!Number.isFinite(value))return;if(e.target.matches('[data-grid-cols]'))grid.cols=clamp(value,1,12);else if(e.target.matches('[data-grid-rows]'))grid.rows=clamp(value,1,12);else if(e.target.matches('[data-grid-gap]'))grid.gap=clamp(value,0,40);else return;update();});
$('autoGridList').addEventListener('change',e=>{const item=e.target.closest('.auto-grid-item');if(!item)return;const index=Number(item.dataset.gridIndex),grid=state.grids[index];if(!grid)return;let dimension=false;if(e.target.matches('[data-grid-cols]')){grid.cols=clamp(Number(e.target.value)||grid.cols||1,1,12);dimension=true;}else if(e.target.matches('[data-grid-rows]')){grid.rows=clamp(Number(e.target.value)||grid.rows||1,1,12);dimension=true;}else if(e.target.matches('[data-grid-gap]'))grid.gap=clamp(Number(e.target.value)||0,0,40);else return;if(dimension)resetCuts(grid);renderGrids();});
$('autoGridList').addEventListener('click',e=>{const item=e.target.closest('.auto-grid-item');if(!item)return;const index=Number(item.dataset.gridIndex),grid=state.grids[index];if(e.target.closest('[data-grid-remove]')){URL.revokeObjectURL(grid.url);state.grids.splice(index,1);renderGrids();return;}if(e.target.closest('[data-grid-reset]')){resetCuts(grid);renderGrids();}});
$('autoGridList').addEventListener('pointerdown',e=>{const line=e.target.closest('.auto-cut-line');if(!line)return;const item=line.closest('.auto-grid-item'),preview=line.closest('.auto-grid-preview');state.drag={gridIndex:Number(item.dataset.gridIndex),axis:line.dataset.axis,cutIndex:Number(line.dataset.cut),line,preview,pointerId:e.pointerId};line.classList.add('dragging');document.body.classList.add('auto-cut-dragging');line.setPointerCapture?.(e.pointerId);e.preventDefault();});
$('autoSingleList').addEventListener('click',e=>{const item=e.target.closest('.auto-single-item');if(!item)return;const index=Number(item.dataset.singleIndex),single=state.singles[index];if(e.target.closest('[data-single-remove]')){URL.revokeObjectURL(single.url);state.singles.splice(index,1);renderSingles();update();}});
window.addEventListener('pointermove',updateDraggedLine,{passive:true});window.addEventListener('pointerup',stopDrag);window.addEventListener('pointercancel',stopDrag);$('autoGridList').addEventListener('lostpointercapture',stopDrag,true);
window.CutflowAutoSetup={
  status:()=>autoState(),
  run,
  setMediaMode(mode){state.mediaMode=mode==='long-video'?'long-video':'multi';if($('autoMediaMode'))$('autoMediaMode').value=state.mediaMode;update();return state.mediaMode;},
  longVideo(){return state.longVideo?{name:state.longVideo.name,size:state.longVideo.size,type:state.longVideo.type,start:Math.max(0,Number($('autoLongVideoStart')?.value)||0)}:null;},
  grids(){return state.grids.map((g,index)=>{normalizeGrid(g);return {index,name:g.file?.name||`그리드 ${index+1}`,url:g.url,width:g.width,height:g.height,cols:g.cols,rows:g.rows,gap:g.gap,xCuts:[...g.xCuts],yCuts:[...g.yCuts]};});},
  singles(){return state.singles.map((g,index)=>({index,name:g.file?.name||`이미지 ${index+1}`,url:g.url,width:g.width,height:g.height}));},
  setGrid(index,patch={}){const g=state.grids[index];if(!g)return false;let reset=false;if(patch.cols!=null){const v=clamp(Number(patch.cols)||1,1,12);reset=reset||v!==g.cols;g.cols=v;}if(patch.rows!=null){const v=clamp(Number(patch.rows)||1,1,12);reset=reset||v!==g.rows;g.rows=v;}if(patch.gap!=null)g.gap=clamp(Number(patch.gap)||0,0,40);if(reset)resetCuts(g);normalizeGrid(g);renderGrids();window.dispatchEvent(new CustomEvent('cutflow-auto-grid-change',{detail:{kind:'grid-settings',commit:true}}));return true;},
  setCut(index,axis,cutIndex,pct,{commit=false}={}){const g=state.grids[index];if(!g)return false;normalizeGrid(g);const cuts=axis==='x'?g.xCuts:g.yCuts;if(!cuts[cutIndex]&&cuts[cutIndex]!==0)return false;const b=lineBounds(cuts,cutIndex);cuts[cutIndex]=clamp(Number(pct)||0,b.min,b.max);if(commit)renderGrids();window.dispatchEvent(new CustomEvent('cutflow-auto-grid-change',{detail:{index,axis,cutIndex,pct:cuts[cutIndex],commit:!!commit,live:!commit}}));return true;},
  resetGrid(index){const g=state.grids[index];if(!g)return false;resetCuts(g);renderGrids();window.dispatchEvent(new CustomEvent('cutflow-auto-grid-change',{detail:{kind:'grid-reset',commit:true}}));return true;},
  removeGrid(index){const g=state.grids[index];if(!g)return false;URL.revokeObjectURL(g.url);state.grids.splice(index,1);renderGrids();window.dispatchEvent(new CustomEvent('cutflow-auto-grid-change',{detail:{kind:'grid-remove',commit:true}}));return true;},
  removeSingle(index){const g=state.singles[index];if(!g)return false;URL.revokeObjectURL(g.url);state.singles.splice(index,1);renderSingles();update();window.dispatchEvent(new CustomEvent('cutflow-auto-grid-change',{detail:{kind:'single-remove',commit:true}}));return true;}
};
$('autoStart').onclick=run;state.mediaMode=$('autoMediaMode')?.value==='long-video'?'long-video':'multi';updateSilenceInfo();renderGrids();renderSingles();update();emit('cutflow-auto-ready',autoState());
})();
