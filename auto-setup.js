(()=>{
const $=id=>document.getElementById(id);
const state={grids:[],narration:null,processedNarration:null,silencePreset:'normal',bgm:null,running:false,drag:null};
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function lines(){return window.CutflowAutoBridge?.scriptLines($('autoScript').value||'')||[];}
function silencePreset(){return document.querySelector('input[name="autoSilencePreset"]:checked')?.value||'normal';}
function updateSilenceInfo(){
  state.silencePreset=silencePreset();const cfg=window.CutflowSilenceCut?.PRESETS?.[state.silencePreset];if(!cfg)return;
  const info=$('autoSilenceInfo');if(info)info.textContent=`${cfg.label} · ${cfg.thresholdDb} dB · 최소 ${cfg.minSilence.toFixed(2)}초 · 공백 ${cfg.keepSilence.toFixed(2)}초`;
}

function evenCuts(count){return Array.from({length:Math.max(0,count-1)},(_,i)=>(i+1)*100/count);}
function normalizeGrid(grid){
  grid.cols=clamp(Number(grid.cols)||4,1,12);grid.rows=clamp(Number(grid.rows)||2,1,12);grid.gap=clamp(Number.isFinite(Number(grid.gap))?Number(grid.gap):6,0,40);
  if(!Array.isArray(grid.xCuts)||grid.xCuts.length!==grid.cols-1)grid.xCuts=evenCuts(grid.cols);
  if(!Array.isArray(grid.yCuts)||grid.yCuts.length!==grid.rows-1)grid.yCuts=evenCuts(grid.rows);
  return grid;
}
function capacity(){return state.grids.reduce((sum,g)=>sum+normalizeGrid(g).cols*g.rows,0);}
function gridName(){return state.grids.length?`${state.grids.length}장 선택`:'선택 안 됨';}
function update(){
  const n=lines().length,c=capacity();$('autoScriptCount').textContent=`${n}개`;$('autoImageCount').textContent=`${c}개`;
  $('autoNarrationName').textContent=state.narration?.name||'선택 안 됨';$('autoBgmName').textContent=state.bgm?.name||'선택 안 됨';$('autoGridName').textContent=gridName();
  const m=$('autoMatch');m.className='auto-match '+(!n||!c?'muted':c<n?'bad':c===n?'good':'warn');
  m.textContent=!n?'대본을 입력하면 필요한 장면 수를 계산합니다.':!c?'그리드 이미지를 선택해 주세요.':c<n?`이미지가 ${n-c}장 부족합니다.`:c===n?'대본 장면 수와 이미지 수가 일치합니다.':`이미지가 ${c-n}장 더 많습니다. 앞에서 ${n}장만 사용합니다.`;
  $('autoStart').disabled=state.running||!n||!state.narration||c<n;
}
function gridMarkup(grid,index){
  normalizeGrid(grid);
  const x=grid.xCuts.map((p,i)=>`<button type="button" class="auto-cut-line auto-cut-x" data-axis="x" data-cut="${i}" style="left:${p}%" aria-label="세로 분할 여백 ${i+1}"></button>`).join('');
  const y=grid.yCuts.map((p,i)=>`<button type="button" class="auto-cut-line auto-cut-y" data-axis="y" data-cut="${i}" style="top:${p}%" aria-label="가로 분할 여백 ${i+1}"></button>`).join('');
  const gapXPct=grid.width?grid.gap/grid.width*100:0,gapYPct=grid.height?grid.gap/grid.height*100:0;
  return `<article class="auto-grid-item" data-grid-index="${index}">
    <div class="auto-grid-item-head"><div><strong>${esc(grid.file.name)}</strong><span>${grid.cols}×${grid.rows} · ${grid.cols*grid.rows}장</span></div><button type="button" class="auto-grid-remove" data-grid-remove aria-label="이미지 제거">×</button></div>
    <div class="auto-grid-controls"><label>열<input data-grid-cols type="number" min="1" max="12" value="${grid.cols}"></label><span>×</span><label>행<input data-grid-rows type="number" min="1" max="12" value="${grid.rows}"></label><label>분할 여백(px)<input data-grid-gap type="number" min="0" max="40" step="1" value="${grid.gap}"></label><button type="button" class="button ghost small" data-grid-reset>균등 분할로 초기화</button></div>
    <div class="auto-grid-preview" style="aspect-ratio:${grid.width||4}/${grid.height||2};--cut-gap-x:${gapXPct}%;--cut-gap-y:${gapYPct}%"><img src="${grid.url}" alt="${esc(grid.file.name)} 분할 미리보기">${x}${y}</div>
    <p class="auto-grid-help">노란 띠가 실제 분할 시 제거되는 여백입니다. 기본 6px이며, 경계가 맞지 않으면 띠의 중심을 마우스나 손가락으로 움직여 조정하세요.</p>
  </article>`;
}
function renderGrids(){
  $('autoGridList').innerHTML=state.grids.length?state.grids.map(gridMarkup).join(''):'<p class="auto-grid-empty">그리드 이미지를 추가하면 이미지별 분할 설정이 표시됩니다.</p>';
  update();
}
async function imageInfo(file){return new Promise((res,rej)=>{const url=URL.createObjectURL(file),im=new Image();im.onload=()=>res({url,width:im.naturalWidth,height:im.naturalHeight});im.onerror=()=>{URL.revokeObjectURL(url);rej(new Error(`${file.name}을 읽지 못했습니다.`))};im.src=url;});}
async function addGridFiles(files){
  for(const file of files){try{const info=await imageInfo(file);state.grids.push({file,cols:4,rows:2,gap:6,xCuts:evenCuts(4),yCuts:evenCuts(2),...info});}catch(e){window.CutflowAutoBridge?.toast?.(e.message);}}
  renderGrids();
}
function resetCuts(grid){grid.xCuts=evenCuts(grid.cols);grid.yCuts=evenCuts(grid.rows);}
function lineBounds(cuts,index){return {min:index?cuts[index-1]+2:2,max:index<cuts.length-1?cuts[index+1]-2:98};}
function updateDraggedLine(e){
  const d=state.drag;if(!d)return;const grid=state.grids[d.gridIndex];if(!grid)return;
  const rect=d.preview.getBoundingClientRect();let pct=d.axis==='x'?(e.clientX-rect.left)/rect.width*100:(e.clientY-rect.top)/rect.height*100;
  const cuts=d.axis==='x'?grid.xCuts:grid.yCuts,b=lineBounds(cuts,d.cutIndex);pct=clamp(pct,b.min,b.max);cuts[d.cutIndex]=pct;
  d.line.style[d.axis==='x'?'left':'top']=`${pct}%`;
}
function stopDrag(){if(!state.drag)return;state.drag.line.classList.remove('dragging');state.drag=null;document.body.classList.remove('auto-cut-dragging');}
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
function status(text,step){$('autoStatus').textContent=text;document.querySelectorAll('.auto-step').forEach((el,i)=>el.dataset.state=i<step?'done':i===step?'active':'');}
async function applyProjectBasics(){
  const title=$('autoTitle').value||'',channel=$('autoChannel').value||'',layout=$('autoLayout').value||'fullscreen';
  $('titleInput').value=title;$('titleInput').dispatchEvent(new Event('input',{bubbles:true}));
  $('channelInput').value=channel;$('channelInput').dispatchEvent(new Event('input',{bubbles:true}));
  $('layoutSelect').value=layout;$('layoutSelect').dispatchEvent(new Event('input',{bubbles:true}));
}
async function run(){
  if(state.running)return;const script=lines();
  if(!script.length||!state.narration||capacity()<script.length)return;
  if(window.CutflowProjectBridge?.hasWork?.()&&!confirm('자동 세팅을 시작하면 현재 대본·내레이션·장면 구성이 새 입력으로 교체됩니다. 계속할까요?'))return;
  state.running=true;update();$('autoProgress').hidden=false;
  try{
    status('그리드 이미지를 분할하는 중…',0);let files=[];
    for(const grid of state.grids){if(files.length>=script.length)break;files.push(...await splitGrid(grid,files.length,script.length-files.length));}
    status(`이미지 ${files.length}장 준비 완료 · 내레이션 무음 줄이는 중…`,1);
    await applyProjectBasics();$('scriptInput').value=$('autoScript').value;window.CutflowAutoBridge.markChanged();
    if(!window.CutflowSilenceCut?.process)throw new Error('무음컷 엔진을 불러오지 못했습니다. 페이지를 새로고침해 주세요.');
    const cut=await window.CutflowSilenceCut.process(state.narration,state.silencePreset,msg=>status(msg,1));state.processedNarration=cut.processedFile;
    status(`무음컷 완료 · ${cut.originalDuration.toFixed(1)}초 → ${cut.processedDuration.toFixed(1)}초 · 타임라인용 내레이션 연결 중…`,1);
    if(!await window.CutflowAutoBridge.loadNarration(state.processedNarration))throw new Error('처리된 내레이션을 읽지 못했습니다.');
    status('기존 장면을 정리하고 이미지를 배치하는 중…',2);await window.CutflowAutoBridge.clearScenesOnly();
    const added=await window.CutflowAutoBridge.addMedia(files);if(added!==files.length)throw new Error(`이미지 ${files.length}장 중 ${added}장만 추가되었습니다.`);
    status('대본과 내레이션으로 자막 타임라인을 만드는 중…',3);const result=window.CutflowAutoBridge.buildTimeline();if(result.cueCount!==script.length)throw new Error('자막 구간 생성 결과를 확인해 주세요.');
    await window.applyTemplateTypography?.($('autoLayout').value,{applyCues:true,notify:false});
    if($('autoCaptionWrap')?.checked){status('자막을 보기 좋게 줄바꿈하는 중…',3);await window.CutflowAutoBridge.autoWrapCaptions?.();}
    status('BGM을 적용하는 중…',4);if(state.bgm&&!(await window.loadBgmFile?.(state.bgm)))throw new Error('BGM을 읽지 못했습니다.');
    status('자동 세팅이 완료되었습니다.',5);$('autoProgress').querySelectorAll('.auto-step').forEach(el=>el.dataset.state='done');
    setTimeout(()=>document.querySelector('.workspace')?.scrollIntoView({behavior:'smooth',block:'start'}),250);
  }catch(e){status(`자동 세팅 중단: ${e.message}`,0);window.CutflowAutoBridge?.toast?.(e.message);}
  finally{state.running=false;update();}
}
function syncBasicsFromProject(){
  if(!$('autoTitle').value)$('autoTitle').value=$('titleInput').value||'';
  if(!$('autoChannel').value)$('autoChannel').value=$('channelInput').value||'';
  $('autoLayout').value=$('layoutSelect').value||'fullscreen';
}
$('autoToggle').onclick=()=>{const open=$('autoPanel').hidden;if(open)syncBasicsFromProject();$('autoPanel').hidden=!open;$('autoToggle').setAttribute('aria-expanded',String(open));};
$('autoScript').addEventListener('input',update);
$('autoNarrationBtn').onclick=()=>$('autoNarration').click();$('autoNarration').onchange=e=>{state.narration=e.target.files[0]||null;state.processedNarration=null;update();};
document.querySelectorAll('input[name="autoSilencePreset"]').forEach(el=>el.addEventListener('change',()=>{state.processedNarration=null;updateSilenceInfo();}));
$('autoGridBtn').onclick=()=>$('autoGrids').click();$('autoGrids').onchange=e=>{addGridFiles([...e.target.files]);e.target.value='';};
$('autoBgmBtn').onclick=()=>$('autoBgm').click();$('autoBgm').onchange=e=>{state.bgm=e.target.files[0]||null;update();};
$('autoGridList').addEventListener('input',e=>{const item=e.target.closest('.auto-grid-item');if(!item)return;const index=Number(item.dataset.gridIndex),grid=state.grids[index];if(!grid)return;if(e.target.matches('[data-grid-cols]')){grid.cols=clamp(Number(e.target.value)||1,1,12);resetCuts(grid);renderGrids();}if(e.target.matches('[data-grid-rows]')){grid.rows=clamp(Number(e.target.value)||1,1,12);resetCuts(grid);renderGrids();}if(e.target.matches('[data-grid-gap]')){grid.gap=clamp(Number(e.target.value)||0,0,40);renderGrids();}});
$('autoGridList').addEventListener('click',e=>{const item=e.target.closest('.auto-grid-item');if(!item)return;const index=Number(item.dataset.gridIndex),grid=state.grids[index];if(e.target.closest('[data-grid-remove]')){URL.revokeObjectURL(grid.url);state.grids.splice(index,1);renderGrids();return;}if(e.target.closest('[data-grid-reset]')){resetCuts(grid);renderGrids();}});
$('autoGridList').addEventListener('pointerdown',e=>{const line=e.target.closest('.auto-cut-line');if(!line)return;const item=line.closest('.auto-grid-item'),preview=line.closest('.auto-grid-preview');state.drag={gridIndex:Number(item.dataset.gridIndex),axis:line.dataset.axis,cutIndex:Number(line.dataset.cut),line,preview};line.classList.add('dragging');document.body.classList.add('auto-cut-dragging');line.setPointerCapture?.(e.pointerId);e.preventDefault();});
window.addEventListener('pointermove',updateDraggedLine,{passive:true});window.addEventListener('pointerup',stopDrag);window.addEventListener('pointercancel',stopDrag);
$('autoStart').onclick=run;updateSilenceInfo();renderGrids();update();
})();
