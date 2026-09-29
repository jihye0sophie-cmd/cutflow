/* View-only enlargement: original canvas/player/seek controls keep their handlers. */
(()=>{
 const mq=matchMedia('(max-width:760px)'),panel=document.querySelector('.preview-panel');
 const launch=document.createElement('button');launch.type='button';launch.id='mobileFullscreenOpen';launch.setAttribute('aria-label','전체 화면 모드');launch.title='전체 화면 모드';launch.innerHTML='<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/></svg>';
 panel.querySelector('.stage-wrap').append(launch);
 const dialog=document.createElement('dialog');dialog.id='mobileFullscreenDialog';dialog.setAttribute('aria-label','전체 화면 미리보기');
 dialog.innerHTML='<div id="mobileFullscreenView"><header><strong>전체 화면 미리보기</strong><button type="button" id="mobileFullscreenClose" aria-label="전체 화면 닫기">×</button></header><div id="mobileFullscreenContent"></div></div>';
 document.body.append(dialog);
 const view=dialog.firstElementChild,content=document.getElementById('mobileFullscreenContent'),closeButton=document.getElementById('mobileFullscreenClose');
 let active=false,nativeEntered=false,overflow='',scroll=0,generation=0;const slots=new Map();
 function restore(){if(!active)return;active=false;generation++;nativeEntered=false;for(const [node,marker] of slots)marker.replaceWith(node);slots.clear();document.body.style.overflow=overflow;document.body.classList.remove('preview-fullscreen-open');window.scrollTo({top:scroll,behavior:'instant'});launch.focus({preventScroll:true});}
 function close(){if(document.fullscreenElement===view)document.exitFullscreen().catch(()=>{});if(dialog.open)dialog.close();restore();}
 launch.onclick=()=>{
  if(!(window.CutflowUI?.isMobileDevice?.()||mq.matches)||active||exporting)return;
  const sheet=document.getElementById('mobileSheet');if(sheet&&!sheet.hidden)document.getElementById('mobileSheetClose').click();
  active=true;const ticket=++generation;scroll=window.scrollY;overflow=document.body.style.overflow;document.body.style.overflow='hidden';document.body.classList.add('preview-fullscreen-open');
  for(const node of [panel.querySelector('.stage-wrap'),panel.querySelector('.player-controls'),document.getElementById('scrubber'),document.getElementById('mobileSceneNav')]){
   const marker=document.createComment('fullscreen-control-position');node.before(marker);slots.set(node,marker);content.append(node);
  }
  dialog.showModal();closeButton.focus({preventScroll:true});
  // The viewport-filling dialog is also the fallback when native fullscreen is unavailable.
  if(view.requestFullscreen&&document.fullscreenEnabled){try{Promise.resolve(view.requestFullscreen()).then(()=>{if(!active||ticket!==generation){if(document.fullscreenElement===view)document.exitFullscreen().catch(()=>{});return;}nativeEntered=document.fullscreenElement===view;}).catch(()=>{});}catch{}}
 };
 closeButton.onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});dialog.addEventListener('close',restore);
 document.addEventListener('fullscreenchange',()=>{if(document.fullscreenElement===view)nativeEntered=true;else if(nativeEntered)close();});
 const syncMode=()=>{if(!(window.CutflowUI?.isMobileDevice?.()||mq.matches))close();};if(typeof mq.addEventListener==='function')mq.addEventListener('change',syncMode);else if(typeof mq.addListener==='function')mq.addListener(syncMode);
})();
