/* Hybrid undo / redo history. Timeline edits restore only scenes + captions; global operations keep whole-project snapshots. */
(()=>{
  const MAX=40;
  let past=[],future=[],pending=null,applying=false,busy=false;
  const projectBridge=()=>window.CutflowProjectBridge;
  const scopeBridge=scope=>scope==='timeline'?window.CutflowTimelineBridge:null;
  const fileSig=file=>file instanceof Blob?{__file:true,name:file.name||'',size:Number(file.size)||0,lastModified:Number(file.lastModified)||0,type:file.type||''}:file;
  const signature=value=>{try{return JSON.stringify(value,(k,v)=>fileSig(v))}catch{return ''}};
  const capture=(scope='project')=>{try{return (scope==='project'?projectBridge():scopeBridge(scope))?.capture?.()||null}catch(error){console.warn('Cutflow history capture failed',scope,error);return null}};
  function update(){
    const canUndo=!busy&&past.length>0,canRedo=!busy&&future.length>0;
    if(typeof CustomEvent==='function')window.dispatchEvent(new CustomEvent('cutflow-history-updated',{detail:{canUndo,canRedo,busy}}));
  }
  function start(label='편집',scope='project'){
    if(applying||busy)return false;
    if(pending?.scope===scope)return true;
    const snapshot=capture(scope);if(!snapshot)return false;
    pending={scope,snapshot,signature:signature(snapshot),label};return true;
  }
  function begin(label='편집'){return start(label,'project')}
  function beginScoped(label='편집',scope='timeline'){return start(label,scope)}
  function ensureScoped(label='편집',scope='timeline'){if(pending?.scope===scope)return true;return start(label,scope)}
  function commit(){
    if(applying||busy||!pending)return;
    const now=capture(pending.scope);if(!now){pending=null;return;}
    if(signature(now)!==pending.signature){past.push(pending);if(past.length>MAX)past.shift();future=[];}
    pending=null;update();
  }
  async function apply(entry,direction){
    if(!entry||busy||applying)return false;
    const bridge=entry.scope==='project'?projectBridge():scopeBridge(entry.scope);
    if(!bridge?.restore)return false;
    const current=capture(entry.scope);if(!current)return false;
    const reverse={scope:entry.scope,snapshot:current,signature:signature(current),label:entry.label};
    busy=true;applying=true;pending=null;update();
    try{
      await bridge.restore(entry.snapshot,{history:true});
      if(direction==='undo')future.push(reverse);else{past.push(reverse);if(past.length>MAX)past.shift();}
      window.CutflowProjects?.markDirty?.();
      const prefix=direction==='undo'?'실행 취소':'다시 실행';
      window.toast?.(prefix+(entry.label?' · '+entry.label:''));
      return true;
    }catch(error){
      console.error('Cutflow history restore failed',entry.scope,error);window.toast?.('편집 기록을 복원하지 못했습니다.');return false;
    }finally{applying=false;busy=false;update();}
  }
  async function undo(){if(!past.length||busy)return false;const entry=past.pop(),ok=await apply(entry,'undo');if(!ok)past.push(entry);update();return ok;}
  async function redo(){if(!future.length||busy)return false;const entry=future.pop(),ok=await apply(entry,'redo');if(!ok)future.push(entry);update();return ok;}
  function reset(){past=[];future=[];pending=null;update();}
  function labelFor(target){
    if(!target)return '편집';
    const text=(target.getAttribute?.('aria-label')||target.textContent||'').trim().replace(/\s+/g,' ');
    if(target.closest?.('#cueList'))return target.dataset?.action==='split'?'자막 나누기':target.dataset?.action==='merge'?'자막 합치기':target.dataset?.action==='delete'?'자막 삭제':target.matches?.('textarea')?'자막 수정':'자막 편집';
    if(target.closest?.('#desktopStrip,#v42SceneStrip,#sceneList')||/장면/.test(text))return '장면 편집';
    if(target.closest?.('#captionStylePanel')||/자막 스타일/.test(text))return '자막 스타일';
    if(target.closest?.('#desktopTiming,#v42TimingHost')||/타이밍|내레이션에 맞춤/.test(text))return '타이밍 조정';
    if(/제목/.test(text))return '제목 편집';if(/채널/.test(text))return '채널명 편집';if(/BGM|음악/.test(text))return 'BGM 편집';
    if(/이미지|영상|미디어|무빙|움직임|전환|Trim|볼륨|페이드/.test(text))return '장면 효과';
    return text.slice(0,24)||'편집';
  }
  function scopeFor(target){
    if(!target)return 'project';
    if(target.closest?.('#cueList,#sceneList,#desktopStrip,#v42SceneStrip,#desktopTiming,#v42TimingHost,#mediaTransform,#captionBatchDialog'))return 'timeline';
    const panel=target.closest?.('#v42Panel');if(panel&&['caption','media','timing'].includes(panel.dataset.activeTab))return 'timeline';
    return 'project';
  }
  const autoBegin=e=>{const target=e.target;if(target.closest?.('[data-history-control],[data-scene]'))return;const label=labelFor(target),scope=scopeFor(target);scope==='timeline'?beginScoped(label,scope):begin(label);};
  document.addEventListener('pointerdown',autoBegin,true);
  document.addEventListener('focusin',e=>{const t=e.target;if(t.matches?.('input:not([type=file]),textarea,select,[contenteditable=true]'))autoBegin(e);},true);
  document.addEventListener('dragstart',autoBegin,true);
  document.addEventListener('keydown',e=>{
    const mod=(e.ctrlKey||e.metaKey)&&!e.altKey,key=String(e.key).toLowerCase();
    if(mod&&key==='z'){e.preventDefault();e.stopImmediatePropagation();if(e.shiftKey)redo();else undo();return;}
    if(e.ctrlKey&&!e.metaKey&&!e.altKey&&key==='y'){e.preventDefault();e.stopImmediatePropagation();redo();return;}
  },true);
  window.CutflowHistory={begin,beginScoped,ensureScoped,commit,undo,redo,reset,get canUndo(){return past.length>0},get canRedo(){return future.length>0},get busy(){return busy}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',update,{once:true});else queueMicrotask(update);
})();
