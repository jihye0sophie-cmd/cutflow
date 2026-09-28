(()=>{
const $=id=>document.getElementById(id);
const state={grids:[],narration:null,bgm:null,running:false};
function lines(){return window.CutflowAutoBridge?.scriptLines($('autoScript').value||'')||[];}
function capacity(){return state.grids.length*(Number($('autoCols').value)||4)*(Number($('autoRows').value)||2);}
function update(){
  const n=lines().length,c=capacity();$('autoScriptCount').textContent=`${n}개`;$('autoImageCount').textContent=`${c}개`;
  $('autoNarrationName').textContent=state.narration?.name||'선택 안 됨';$('autoBgmName').textContent=state.bgm?.name||'선택 안 됨';$('autoGridName').textContent=state.grids.length?`${state.grids.length}장 선택`:'선택 안 됨';
  const m=$('autoMatch');m.className='auto-match '+(!n||!c?'muted':c<n?'bad':c===n?'good':'warn');
  m.textContent=!n?'대본을 입력하면 필요한 장면 수를 계산합니다.':!c?'그리드 이미지를 선택해 주세요.':c<n?`이미지가 ${n-c}장 부족합니다.`:c===n?'대본 장면 수와 이미지 수가 일치합니다.':`이미지가 ${c-n}장 더 많습니다. 앞에서 ${n}장만 사용합니다.`;
  $('autoStart').disabled=state.running||!n||!state.narration||c<n;
}
async function imageElement(file){return new Promise((res,rej)=>{const u=URL.createObjectURL(file),im=new Image();im.onload=()=>{URL.revokeObjectURL(u);res(im)};im.onerror=()=>{URL.revokeObjectURL(u);rej(new Error(`${file.name}을 읽지 못했습니다.`))};im.src=u;});}
async function splitGrid(file,cols,rows,startIndex,limit){
  const im=await imageElement(file),out=[];const cw=im.naturalWidth/cols,ch=im.naturalHeight/rows;
  for(let r=0;r<rows&&out.length<limit;r++)for(let c=0;c<cols&&out.length<limit;c++){
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(cw));canvas.height=Math.max(1,Math.round(ch));
    canvas.getContext('2d').drawImage(im,c*cw,r*ch,cw,ch,0,0,canvas.width,canvas.height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    if(!blob)throw new Error('이미지 분할에 실패했습니다.');
    const no=String(startIndex+out.length+1).padStart(2,'0');out.push(new File([blob],`scene_${no}.png`,{type:'image/png'}));
  }return out;
}
function status(text,step){$('autoStatus').textContent=text;document.querySelectorAll('.auto-step').forEach((el,i)=>el.dataset.state=i<step?'done':i===step?'active':'');}
async function run(){
  if(state.running)return;const script=lines(),cols=Math.max(1,Number($('autoCols').value)||4),rows=Math.max(1,Number($('autoRows').value)||2);
  if(!script.length||!state.narration||capacity()<script.length)return;
  if(window.CutflowProjectBridge?.hasWork?.()&&!confirm('자동 세팅을 시작하면 현재 대본·내레이션·장면 구성이 새 입력으로 교체됩니다. 계속할까요?'))return;
  state.running=true;update();$('autoProgress').hidden=false;
  try{
    status('그리드 이미지를 분할하는 중…',0);let files=[];
    for(const grid of state.grids){if(files.length>=script.length)break;files.push(...await splitGrid(grid,cols,rows,files.length,script.length-files.length));}
    status(`이미지 ${files.length}장 준비 완료 · 내레이션 연결 중…`,1);
    $('scriptInput').value=$('autoScript').value;window.CutflowAutoBridge.markChanged();
    if(!await window.CutflowAutoBridge.loadNarration(state.narration))throw new Error('내레이션을 읽지 못했습니다. MP3 또는 WAV로 다시 시도해 주세요.');
    status('기존 장면을 정리하고 이미지를 배치하는 중…',2);await window.CutflowAutoBridge.clearScenesOnly();
    const added=await window.CutflowAutoBridge.addMedia(files);if(added!==files.length)throw new Error(`이미지 ${files.length}장 중 ${added}장만 추가되었습니다.`);
    status('대본과 내레이션으로 자막 타임라인을 만드는 중…',3);const result=window.CutflowAutoBridge.buildTimeline();if(result.cueCount!==script.length)throw new Error('자막 구간 생성 결과를 확인해 주세요.');
    status('BGM을 적용하는 중…',4);if(state.bgm&&!(await window.loadBgmFile?.(state.bgm)))throw new Error('BGM을 읽지 못했습니다.');
    status('자동 세팅이 완료되었습니다.',5);$('autoProgress').querySelectorAll('.auto-step').forEach(el=>el.dataset.state='done');
    setTimeout(()=>document.querySelector('.workspace')?.scrollIntoView({behavior:'smooth',block:'start'}),250);
  }catch(e){status(`자동 세팅 중단: ${e.message}`,0);window.CutflowAutoBridge?.toast?.(e.message);}
  finally{state.running=false;update();}
}
$('autoToggle').onclick=()=>{$('autoPanel').hidden=!$('autoPanel').hidden;$('autoToggle').setAttribute('aria-expanded',String(!$('autoPanel').hidden));};
$('autoScript').addEventListener('input',update);$('autoCols').addEventListener('input',update);$('autoRows').addEventListener('input',update);
$('autoNarrationBtn').onclick=()=>$('autoNarration').click();$('autoNarration').onchange=e=>{state.narration=e.target.files[0]||null;update();};
$('autoGridBtn').onclick=()=>$('autoGrids').click();$('autoGrids').onchange=e=>{state.grids=[...e.target.files];update();};
$('autoBgmBtn').onclick=()=>$('autoBgm').click();$('autoBgm').onchange=e=>{state.bgm=e.target.files[0]||null;update();};
$('autoStart').onclick=run;update();
})();
