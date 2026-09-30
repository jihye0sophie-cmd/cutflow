/* Global undo / redo history. Uses the project bridge so scene, caption, style, timing, media, narration and BGM edits restore together without duplicating media bytes. */
(()=>{
  const MAX=40;
  let past=[],future=[],pending=null,applying=false,busy=false;
  const bridge=()=>window.CutflowProjectBridge;
  const cloneFileSig=file=>file?{name:file.name||'',size:Number(file.size)||0,lastModified:Number(file.lastModified)||0,type:file.type||''}:null;
  function fingerprint(snapshot){
    if(!snapshot)return '';
    const bgm=snapshot.bgm?{...snapshot.bgm,file:cloneFileSig(snapshot.bgm.file)}:null;
    const narration=snapshot.narration?{name:snapshot.narration.name||'',file:cloneFileSig(snapshot.narration.file)}:null;
    return JSON.stringify({
      controls:snapshot.controls||{},titleColorRanges:snapshot.titleColorRanges||[],cues:snapshot.cues||[],
      scenes:(snapshot.scenes||[]).map(s=>({meta:s.meta||{},file:cloneFileSig(s.file)})),narration,bgm
    });
  }
  function capture(){try{return bridge()?.capture?.()||null}catch(error){console.warn('Cutflow history capture failed',error);return null}}
  function update(){
    const canUndo=!busy&&past.length>0,canRedo=!busy&&future.length>0;
    if(typeof CustomEvent==='function')window.dispatchEvent(new CustomEvent('cutflow-history-updated',{detail:{canUndo,canRedo,busy}}));
  }
  function begin(label='편집'){
    if(applying||busy||!bridge())return;
    const snapshot=capture();if(!snapshot)return;
    pending={snapshot,signature:fingerprint(snapshot),label};
  }
  function commit(){
    if(applying||busy||!pending)return;
    const now=capture();if(!now){pending=null;return;}
    if(fingerprint(now)!==pending.signature){
      const last=past.at(-1);
      if(!last||last.signature!==pending.signature){past.push(pending);if(past.length>MAX)past.shift();}
      future=[];
    }
    pending=null;update();
  }
  async function restore(entry,direction){
    if(!entry||busy||applying||!bridge())return false;
    const current=capture();if(!current)return false;
    const currentEntry={snapshot:current,signature:fingerprint(current),label:direction==='undo'?'다시 실행':'실행 취소'};
    busy=true;applying=true;pending=null;update();
    try{
      if(direction==='undo')future.push(currentEntry);else{past.push(currentEntry);if(past.length>MAX)past.shift();}
      await bridge().restore(entry.snapshot,{history:true});
      window.CutflowProjects?.markDirty?.();
      window.toast?.(direction==='undo'?`실행 취소${entry.label?` · ${entry.label}`:''}`:`다시 실행${entry.label?` · ${entry.label}`:''}`);
      return true;
    }catch(error){
      console.error('Cutflow history restore failed',error);
      window.toast?.('편집 기록을 복원하지 못했습니다.');
      return false;
    }finally{applying=false;busy=false;update();}
  }
  async function undo(){if(!past.length||busy)return false;const entry=past.pop();const ok=await restore(entry,'undo');if(!ok)past.push(entry);update();return ok;}
  async function redo(){if(!future.length||busy)return false;const entry=future.pop();const ok=await restore(entry,'redo');if(!ok)future.push(entry);update();return ok;}
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
  document.addEventListener('pointerdown',e=>begin(labelFor(e.target)),true);
  document.addEventListener('focusin',e=>{const t=e.target;if(t.matches?.('input:not([type=file]),textarea,select,[contenteditable=true]'))begin(labelFor(t));},true);
  document.addEventListener('dragstart',e=>begin(labelFor(e.target)),true);
  document.addEventListener('keydown',e=>{
    const mod=(e.ctrlKey||e.metaKey)&&!e.altKey,key=String(e.key).toLowerCase();
    if(mod&&key==='z'){e.preventDefault();e.stopImmediatePropagation();if(e.shiftKey)redo();else undo();return;}
    if(e.ctrlKey&&!e.metaKey&&!e.altKey&&key==='y'){e.preventDefault();e.stopImmediatePropagation();redo();return;}
  },true);
  window.CutflowHistory={begin,commit,undo,redo,reset,get canUndo(){return past.length>0},get canRedo(){return future.length>0}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',update,{once:true});else queueMicrotask(update);
})();
