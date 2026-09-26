/* One adapter for both layouts. The existing compositor owns all media geometry. */
(()=>{
 const stage=$('stage'),wrap=stage.parentElement;
 const panel=document.createElement('fieldset');panel.id='mediaTransform';
 panel.innerHTML=`<legend>이미지·영상 크기 / 위치</legend>
 <div class="transform-actions"><button type="button" id="transformMode" aria-pressed="false">미리보기에서 조절</button><button type="button" id="transformReset">초기화</button></div>
 <div class="transform-fields"><label>Scale (%)<input id="transformScale" type="number" min="10" max="500" step="1" value="100"></label><label>Position X (%)<input id="transformX" type="number" min="-200" max="200" step="1" value="0"></label><label>Position Y (%)<input id="transformY" type="number" min="-200" max="200" step="1" value="0"></label></div>
 <input id="transformRange" type="range" min="10" max="500" value="100" aria-label="이미지·영상 확대 비율">
 <p>조절 모드: 드래그로 이동 · 두 손가락으로 확대/축소<br>X/Y는 영상 영역 기준 비율입니다. 현재 장면에만 적용됩니다.</p>`;
 $('sceneList').before(panel);
 const frame=document.createElement('div');frame.className='media-transform-frame';frame.hidden=true;wrap.append(frame);
 let enabled=false,identity=null,gesture=null,inputSaved=false;
 const points=new Map(),mode=$('transformMode');
 const fields={scale:$('transformScale'),x:$('transformX'),y:$('transformY')};
 function state(){const list=timelineScenes(),loc=CutRenderer.locate(list,currentTime());return {item:CutflowScene.items()[loc.index],scene:list[loc.index],loc};}
 function allowed(){return enabled&&!exporting&&!playing&&!!state().scene?.element&&!!panel.getClientRects().length;}
 function save(){if(cues.length)rememberCues();}
 function write(value){const {item}=state();if(!item||exporting)return;item.transform=CutRenderer.transform(value);changed();syncValues();}
 function syncValues(){const v=CutRenderer.transform(state().scene?.transform);for(const k in fields)if(document.activeElement!==fields[k])fields[k].value=+(v[k]*100).toFixed(2);$('transformRange').value=v.scale*100;}
 function stop(){points.clear();gesture=null;}
 mode.onclick=()=>{enabled=!enabled;mode.setAttribute('aria-pressed',String(enabled));if(enabled)pause();stop();};
 $('transformReset').onclick=()=>{if(exporting)return;pause();save();write({scale:1,x:0,y:0});};
 for(const [key,input] of [...Object.entries(fields),['scale',$('transformRange')]]){
  input.addEventListener('focus',()=>{inputSaved=false;});
  input.addEventListener('pointerdown',()=>{inputSaved=false;});
  input.addEventListener('input',()=>{if(exporting||input.value===''||!Number.isFinite(input.valueAsNumber))return;pause();if(!inputSaved){save();inputSaved=true;}write({...CutRenderer.transform(state().scene?.transform),[key]:input.valueAsNumber/100});});
  input.addEventListener('change',()=>{inputSaved=false;input.blur();syncValues();});
 }
 // Canvas is object-fit:contain in full-screen mode; exclude its letterboxing.
 function viewport(){const b=stage.getBoundingClientRect(),ratio=stage.width/stage.height;let w=b.width,h=b.height;if(w/h>ratio)w=h*ratio;else h=w/ratio;return {x:b.left+(b.width-w)/2,y:b.top+(b.height-h)/2,w,h};}
 function point(e){const v=viewport();return {x:(e.clientX-v.x)*stage.width/v.w,y:(e.clientY-v.y)*stage.height/v.h};}
 function geometry(){const s=state(),rect=CutRenderer.mediaRect(stage.width,stage.height,$('layoutSelect').value);return {...s,rect,box:CutRenderer.mediaGeometry(s.scene,s.loc.elapsed,rect,$('layoutSelect').value==='fullscreen'?'cover':$('fitSelect').value)};}
 function center(){const p=[...points.values()];return p.length>1?{x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2}:p[0];}
 function distance(){const p=[...points.values()];return p.length>1?Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y):0;}
 function rebase(){const g=geometry();gesture={base:CutRenderer.transform(g.scene?.transform),center:center(),distance:distance(),rect:g.rect,box:g.box};}
 stage.addEventListener('pointerdown',e=>{
  if(!allowed()||e.button>0||points.size>=2)return;
  const p=point(e),g=geometry();if(!g.box)return;
  if(!points.size&&(p.x<Math.max(g.rect.x,g.box.x)||p.x>Math.min(g.rect.x+g.rect.w,g.box.x+g.box.w)||p.y<Math.max(g.rect.y,g.box.y)||p.y>Math.min(g.rect.y+g.rect.h,g.box.y+g.box.h)))return;
  e.preventDefault();if(!points.size)save();points.set(e.pointerId,p);stage.setPointerCapture(e.pointerId);rebase();
 });
 stage.addEventListener('pointermove',e=>{
  if(!points.has(e.pointerId)||!gesture)return;if(!allowed()){stop();return;}e.preventDefault();points.set(e.pointerId,point(e));
  const c=center(),g=gesture,scale=CutRenderer.transform({scale:g.base.scale*(g.distance>0?distance()/g.distance:1)}).scale,r=scale/g.base.scale;
  const bx=g.box.x+g.box.w/2,by=g.box.y+g.box.h/2;
  const candidate=CutRenderer.mediaGeometry({...state().scene,transform:{...g.base,scale}},state().loc.elapsed,g.rect,$('layoutSelect').value==='fullscreen'?'cover':$('fitSelect').value);
  // Keep the pinched image point under the moving two-finger centroid.
  write({scale,x:g.base.x+(c.x-g.center.x+(g.center.x-bx)*(1-r)+bx-candidate.x-candidate.w/2)/g.rect.w,y:g.base.y+(c.y-g.center.y+(g.center.y-by)*(1-r)+by-candidate.y-candidate.h/2)/g.rect.h});
 });
 function release(e){if(!points.has(e.pointerId))return;points.delete(e.pointerId);if(points.size)rebase();else gesture=null;}
 stage.addEventListener('pointerup',release);stage.addEventListener('pointercancel',()=>stop());stage.addEventListener('lostpointercapture',release);
 // Capture before the pre-existing touch swipe handlers. Outside this mode they are unchanged.
 for(const name of ['touchstart','touchmove','touchend','touchcancel'])stage.addEventListener(name,e=>{if(allowed()){e.stopImmediatePropagation();if(e.cancelable)e.preventDefault();}},{capture:true,passive:false});
 window.addEventListener('blur',stop);window.addEventListener('resize',stop);window.addEventListener('cutflow-scene',stop);
 function refresh(){
  const s=state();if(identity!==s.item){identity=s.item;stop();syncValues();}
  const disabled=exporting||!s.scene?.element;panel.disabled=disabled;
  const active=allowed();stage.classList.toggle('media-transform-active',active);frame.hidden=!active;
  if(active){const g=geometry(),v=viewport(),b=wrap.getBoundingClientRect();if(g.box){const x=Math.max(g.rect.x,g.box.x),y=Math.max(g.rect.y,g.box.y),right=Math.min(g.rect.x+g.rect.w,g.box.x+g.box.w),bottom=Math.min(g.rect.y+g.rect.h,g.box.y+g.box.h);frame.hidden=right<=x||bottom<=y;Object.assign(frame.style,{left:`${v.x-b.left+x*v.w/stage.width}px`,top:`${v.y-b.top+y*v.h/stage.height}px`,width:`${Math.max(0,right-x)*v.w/stage.width}px`,height:`${Math.max(0,bottom-y)*v.h/stage.height}px`});}}
  if(!points.size&&!panel.contains(document.activeElement))syncValues();requestAnimationFrame(refresh);
 }
 refresh();
})();
