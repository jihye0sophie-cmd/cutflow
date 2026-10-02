/* Shared whole-caption editor for desktop and mobile. */
(()=>{
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let dialog=null,selected=-1,cursor=0,draft='';
  const api=()=>window.CutflowCaption;
  const sceneApi=()=>window.CutflowScene;

  function sceneGroups(){
    const items=sceneApi()?.items?.()||[];
    return items.map((item,sceneIndex)=>{
      let cueIndices=Array.isArray(item?.cueIndices)?item.cueIndices.slice():[];
      if(!cueIndices.length&&Number.isInteger(item?.firstCueIndex)){
        const first=item.firstCueIndex,last=Number.isInteger(item.lastCueIndex)?item.lastCueIndex:first;
        cueIndices=Array.from({length:Math.max(0,last-first+1)},(_,i)=>first+i);
      }
      return {sceneIndex,cueIndices:cueIndices.filter(i=>{const state=api()?.state?.(i);return state&&String(state.text||'').trim();})};
    }).filter(group=>group.cueIndices.length);
  }

  function ensureDialog(){
    if(dialog)return dialog;
    dialog=document.createElement('dialog');
    dialog.id='captionBatchDialog';
    dialog.className='caption-batch-dialog';
    dialog.innerHTML=`
      <div class="caption-batch-shell">
        <header class="caption-batch-head">
          <div><strong>전체 자막 편집</strong><small>장면별 자막을 빠르게 나누고 합칩니다.</small></div>
          <div class="caption-batch-head-actions">
            <button type="button" class="caption-batch-auto-wrap" data-caption-batch-auto-wrap>전체 자동 줄바꿈</button>
            <button type="button" data-caption-batch-close aria-label="닫기">×</button>
          </div>
        </header>
        <div class="caption-batch-list" data-caption-batch-list></div>
        <footer class="caption-batch-actions" data-caption-batch-actions hidden>
          <button type="button" data-caption-batch-split>나누기</button>
          <button type="button" data-caption-batch-prev>이전과 합치기</button>
          <button type="button" data-caption-batch-next>다음과 합치기</button>
          <button type="button" class="danger" data-caption-batch-delete>삭제</button>
        </footer>
      </div>`;
    document.body.append(dialog);
    dialog.addEventListener('click',handleClick);
    dialog.addEventListener('input',handleInput);
    dialog.addEventListener('keyup',rememberCursor);
    dialog.addEventListener('mouseup',rememberCursor);
    dialog.addEventListener('touchend',rememberCursor,{passive:true});
    dialog.addEventListener('cancel',()=>{commitDraft();dialog.querySelector('[data-caption-batch-input]')?.blur?.();});
    dialog.addEventListener('close',()=>{dialog.querySelector('[data-caption-batch-input]')?.blur?.();selected=-1;cursor=0;draft='';});
    return dialog;
  }

  function selectedState(){return selected>=0?api()?.state?.(selected):null;}

  function render({focus=false}={}){
    const d=ensureDialog(),list=d.querySelector('[data-caption-batch-list]'),groups=sceneGroups();
    if(!groups.length){
      list.innerHTML='<p class="caption-batch-empty">편집할 자막이 없습니다.</p>';
      d.querySelector('[data-caption-batch-actions]').hidden=true;
      return;
    }
    list.innerHTML=groups.map(group=>{
      const segments=group.cueIndices.map((index,pos)=>{
        const state=api().state(index),text=state?.text||'';
        if(index===selected){
          const value=draft!==''?draft:text;
          return `<span class="caption-batch-segment selected" data-caption-index="${index}"><input data-caption-batch-input value="${esc(value)}" aria-label="장면 ${group.sceneIndex+1} 자막 ${pos+1}"></span>`;
        }
        return `<button type="button" class="caption-batch-segment" data-caption-index="${index}">${esc(text||'빈 자막')}</button>`;
      }).join('<span class="caption-batch-divider" aria-hidden="true">/</span>');
      return `<div class="caption-batch-row" data-caption-scene="${group.sceneIndex}"><b>장면 ${group.sceneIndex+1}</b><span class="caption-batch-bar" aria-hidden="true">|</span><div class="caption-batch-segments">${segments}</div></div>`;
    }).join('');

    const state=selectedState(),actions=d.querySelector('[data-caption-batch-actions]');
    actions.hidden=!state;
    if(state){
      actions.querySelector('[data-caption-batch-prev]').disabled=state.segment.position<=1;
      actions.querySelector('[data-caption-batch-next]').disabled=state.segment.position>=state.segment.count;
      const input=d.querySelector('[data-caption-batch-input]');
      if(input&&focus){
        input.focus({preventScroll:true});
        const at=Math.max(0,Math.min(cursor||input.value.length,input.value.length));
        try{input.setSelectionRange(at,at);}catch{}
      }
    }
  }

  function selectCaption(index){
    commitDraft();
    const state=api()?.state?.(index);if(!state)return;
    selected=index;draft=state.text||'';cursor=draft.length;
    api()?.select?.(index);
    render({focus:true});
  }

  function rememberCursor(e){
    const input=e.target.closest?.('[data-caption-batch-input]');if(!input)return;
    cursor=Number.isInteger(input.selectionStart)?input.selectionStart:input.value.length;
  }

  function handleInput(e){
    const input=e.target.closest?.('[data-caption-batch-input]');if(!input)return;
    draft=input.value;cursor=input.selectionStart??draft.length;
  }

  function commitDraft(){
    if(selected<0)return true;
    const state=api()?.state?.(selected);if(!state)return false;
    if(draft!==state.text)api()?.update?.(selected,{text:draft});
    return true;
  }

  function splitSelected(){
    const state=selectedState();if(!state)return;
    const input=dialog.querySelector('[data-caption-batch-input]');
    if(input){draft=input.value;cursor=input.selectionStart??cursor;}
    commitDraft();
    if(api()?.split?.(selected,cursor)){
      selected=Math.min(selected+1,(api()?.count?.()||1)-1);
      const next=api().state(selected);draft=next?.text||'';cursor=0;
      render({focus:true});
    }else render({focus:true});
  }

  function mergePrev(){
    const state=selectedState();if(!state||state.segment.position<=1)return;
    commitDraft();
    const target=selected-1;
    if(api()?.mergeNext?.(target)){
      selected=target;draft=api().state(target)?.text||'';cursor=draft.length;
      render({focus:true});
    }
  }

  function mergeNext(){
    const state=selectedState();if(!state||state.segment.position>=state.segment.count)return;
    commitDraft();
    if(api()?.mergeNext?.(selected)){
      draft=api().state(selected)?.text||'';cursor=draft.length;
      render({focus:true});
    }
  }

  async function autoWrapAllCaptions(){
    commitDraft();
    const wrap=window.CutflowAutoBridge?.autoWrapCaptions;
    if(typeof wrap!=='function')return;
    const button=dialog?.querySelector('[data-caption-batch-auto-wrap]');
    if(button){button.disabled=true;button.textContent='줄바꿈 중…';}
    try{
      await wrap();
      if(selected>=0){
        const state=api()?.state?.(selected);
        draft=state?.text||'';cursor=draft.length;
      }
      render({focus:false});
    }finally{
      if(button){button.disabled=false;button.textContent='전체 자동 줄바꿈';}
    }
  }

  function removeSelected(){
    const state=selectedState();if(!state)return;
    if(!confirm('선택한 자막을 삭제할까요?'))return;
    commitDraft();
    if(api()?.remove?.(selected)){
      const count=api()?.count?.()||0;selected=count?Math.min(selected,count-1):-1;
      draft=selected>=0?(api().state(selected)?.text||''):'';cursor=draft.length;
      render({focus:selected>=0});
    }
  }

  function handleClick(e){
    if(e.target===dialog)return;
    if(e.target.closest('[data-caption-batch-close]')){commitDraft();dialog.querySelector('[data-caption-batch-input]')?.blur?.();dialog.close();return;}
    if(e.target.closest('[data-caption-batch-auto-wrap]')){autoWrapAllCaptions();return;}
    const seg=e.target.closest('[data-caption-index]');
    if(seg&&!e.target.matches('[data-caption-batch-input]')){selectCaption(Number(seg.dataset.captionIndex));return;}
    if(e.target.closest('[data-caption-batch-split]')){splitSelected();return;}
    if(e.target.closest('[data-caption-batch-prev]')){mergePrev();return;}
    if(e.target.closest('[data-caption-batch-next]')){mergeNext();return;}
    if(e.target.closest('[data-caption-batch-delete]')){removeSelected();return;}
  }

  function open(index){
    const d=ensureDialog(),count=api()?.count?.()||0;
    if(count&&Number.isInteger(index)&&api().state(index)){selected=index;draft=api().state(index)?.text||'';cursor=draft.length;}
    else{selected=-1;draft='';cursor=0;}
    render({focus:false});
    if(!d.open){try{d.showModal();}catch(error){console.warn('Caption batch dialog open failed',error);}}
  }

  window.addEventListener('cutflow-caption-updated',()=>{if(dialog?.open)render({focus:false});});
  window.addEventListener('cutflow-project-restored',()=>{if(dialog?.open){selected=-1;draft='';render();}});
  window.CutflowCaptionBatch={open};
})();
