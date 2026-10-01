const $=id=>document.getElementById(id);
const motionMeta={still:{label:'고정',badge:'●'},'zoom-in':{label:'줌 인',badge:'Z+'},'zoom-out':{label:'줌 아웃',badge:'Z−'},'pan-left':{label:'오른쪽 → 왼쪽 이동',badge:'←'},'pan-right':{label:'왼쪽 → 오른쪽 이동',badge:'→'},'pan-up':{label:'아래 → 위 이동',badge:'↑'},'pan-down':{label:'위 → 아래 이동',badge:'↓'},'zoom-in-slow':{label:'느린 줌인',badge:'Z+'},'zoom-in-fast':{label:'빠른 줌인',badge:'Z+'},'zoom-in-strong':{label:'강한 줌인',badge:'Z+'},'zoom-out-slow':{label:'느린 줌아웃',badge:'Z−'},'zoom-out-fast':{label:'빠른 줌아웃',badge:'Z−'},'zoom-pan-right':{label:'줌인 + 오른쪽 이동',badge:'Z↗'},'zoom-pan-left':{label:'줌인 + 왼쪽 이동',badge:'Z↖'},'zoom-pan-up':{label:'줌인 + 위 이동',badge:'Z↑'},'zoom-pan-down':{label:'줌인 + 아래 이동',badge:'Z↓'},'handheld-subtle':{label:'미세 카메라 흔들림',badge:'≈'},'punch-hold':{label:'빠르게 확대 후 유지',badge:'Z!'}};
const motionLabels=Object.fromEntries(Object.entries(motionMeta).map(([key,value])=>[key,value.label]));
window.CutflowMotionMeta=motionMeta;
const transitionLabels={cut:'하드 컷',dissolve:'디졸브',fade:'블랙 페이드',flash:'화이트 플래시',slide:'슬라이드'};
const rhythms={reference:{motions:['zoom-in','still','zoom-out','still','pan-left','pan-right'],transitions:['cut']},balanced:{motions:['zoom-in','pan-right','zoom-out','pan-left','pan-up','pan-down'],transitions:['cut','dissolve']},calm:{motions:['zoom-in','pan-right','zoom-out','pan-left'],transitions:['dissolve','fade']},impact:{motions:['zoom-in','pan-left','zoom-out','pan-right'],transitions:['cut','flash','cut','slide']}};
const autoMotionPool=Object.keys(motionLabels).filter(m=>m!=='still');
function pickAutoMotion(recent=[]){const available=autoMotionPool.filter(m=>!recent.includes(m)),pool=available.length?available:autoMotionPool;return pool[Math.floor(Math.random()*pool.length)];}
let autoMotionRecent=[];
function chooseAutoMotion(){const next=pickAutoMotion(autoMotionRecent);autoMotionRecent=[...autoMotionRecent,next].slice(-2);return next;}
let scenes=[],cues=[],audioBuffer=null,audioUrl=null,audioName='',audioFile=null,silences=[],envelope=[],timingAnalysis=null;
let titleColorRanges=[],lastTitleText='';
let playRequest=0;
let previewMediaAudio=null;
let offset=0,started=0,playing=false,rendering=false,dirty=true,exporting=false,loading=0,dragIndex=null,lastActive=-1,lastCue=-1,lastPlaybackScene=-1,downloadUrl=null;
const uid=()=>crypto.randomUUID?.()||Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const options=(map,value)=>Object.entries(map).map(([k,v])=>`<option value="${k}" ${k===value?'selected':''}>${v}</option>`).join('');
// Imported media stay reusable; each subtitle owns its exact playback interval.
function assignAvailableCuts(){const used=new Set(cues.map(c=>c.sceneId));const available=scenes.filter(s=>!used.has(s.id));cues.forEach(c=>{if(c.sceneId===undefined&&available.length)c.sceneId=available.shift().id;});}
function captionSegmentInfo(index){
  const cue=cues[index];if(!cue||!cue.sceneId)return {position:1,count:1,first:index,last:index,offset:0,total:Math.max(.1,(cue?.end||0)-(cue?.start||0))};
  let first=index,last=index;while(first>0&&cues[first-1]?.sceneId===cue.sceneId)first--;while(last<cues.length-1&&cues[last+1]?.sceneId===cue.sceneId)last++;
  let offset=0,total=0;for(let i=first;i<=last;i++){const d=Math.max(0,cues[i].end-cues[i].start);if(i<index)offset+=d;total+=d;}
  return {position:index-first+1,count:last-first+1,first,last,offset,total:Math.max(.1,total)};
}

function normalizeSceneSettingsFromCues(){
  if(!cues.length)return;
  for(const scene of scenes){const group=cues.filter(c=>c.sceneId===scene.id);if(!group.length)continue;const first=group[0];
    if(first.transform&&scene.transform===undefined)scene.transform=cloneProjectData(first.transform);
    if(first.motion&&first.motion!=='still'&&(scene.motion===undefined||scene.motion==='still'))scene.motion=first.motion;
    if(first.transition&&first.transition!=='cut'&&(scene.transition===undefined||scene.transition==='cut'))scene.transition=first.transition;
    if(Number.isFinite(first.trimStart))scene.trimStart=first.trimStart;
    if(Number.isFinite(first.trimEnd))scene.trimEnd=first.trimEnd;
    for(const cue of group){delete cue.transform;delete cue.motion;delete cue.transition;delete cue.trimStart;delete cue.trimEnd;}
  }
}
function timelineScenes(){return cues.length?cues.map((c,i)=>{const sourceIndex=scenes.findIndex(s=>s.id===c.sceneId),s=scenes[sourceIndex],seg=captionSegmentInfo(i),continuation=seg.position>1,hasMore=seg.position<seg.count,baseTrim=s?.trimStart??0;return {...(s||{type:'missing',motion:'still',transition:'cut'}),transform:s?.transform,motion:s?.motion??'still',transition:continuation?'cut':(s?.transition??'cut'),trimStart:baseTrim+seg.offset,trimEnd:s?.trimEnd??s?.sourceDuration??Infinity,start:c.start,end:c.end,duration:c.end-c.start,cueIndex:i,sourceIndex,motionOffset:seg.offset,motionDuration:seg.total,mediaFadeIn:continuation?0:(s?.mediaFadeIn??0),mediaFadeOut:hasMore?0:(s?.mediaFadeOut??0),captionSegment:seg};}):scenes;}
const cutDuration=()=>CutRenderer.cutDuration(timelineScenes());
const totalDuration=()=>Math.max(cutDuration(),audioBuffer?.duration||0,...cues.map(c=>c.end),0);
const sceneStart=index=>cues.length?(cues.find(c=>c.sceneId===scenes[index]?.id)?.start||0):scenes.slice(0,index).reduce((n,s)=>n+s.duration,0);
const timeText=t=>`${Math.floor(Math.max(0,t)/60)}:${(Math.max(0,t)%60).toFixed(1).padStart(4,'0')}`;
const currentTime=()=>playing?Math.min(totalDuration(),offset+(window.CutAudio?CutAudio.elapsed():(performance.now()-started)/1000)):offset;
function stopPreviewMediaAudio(){
  if(previewMediaAudio){try{previewMediaAudio.pause();}catch{}previewMediaAudio=null;}
  for(const scene of scenes){if(scene.audioElement){try{scene.audioElement.pause();}catch{}}}
}
function previewAudioElement(scene){
  if(scene?.type!=='video')return null;
  if(!scene.audioElement){const el=document.createElement('video');el.src=scene.url;el.preload='auto';el.playsInline=true;el.muted=false;el.volume=1;scene.audioElement=el;}
  return scene.audioElement;
}
function releaseSceneResources(scene){if(!scene)return;try{scene.audioElement?.pause();if(scene.audioElement){scene.audioElement.removeAttribute?.('src');scene.audioElement.load?.();scene.audioElement=null;}if(scene.element){scene.element.removeAttribute?.('src');scene.element.src='';}}catch{}if(scene.url){URL.revokeObjectURL(scene.url);scene.url='';}}
window.CutflowReleaseSceneResources=releaseSceneResources;
function mediaFadeGain(item,elapsed){
  const clipLength=Math.max(0,Math.min(Number(item.duration)||0,(Number(item.trimEnd)||Number(item.sourceDuration)||0)-(Number(item.trimStart)||0)));
  if(!clipLength)return 0;
  const fadeIn=Math.min(clipLength,Math.max(0,Number(item.mediaFadeIn)||0));
  const fadeOut=Math.min(clipLength,Math.max(0,Number(item.mediaFadeOut)||0));
  let gain=1;if(fadeIn>0)gain=Math.min(gain,Math.max(0,elapsed/fadeIn));
  if(fadeOut>0)gain=Math.min(gain,Math.max(0,(clipLength-elapsed)/fadeOut));
  return Math.max(0,Math.min(1,gain));
}
function syncPreviewMediaAudio(time,force=false){
  if(!playing){stopPreviewMediaAudio();return;}
  const timeline=timelineScenes(),loc=CutRenderer.locate(timeline,time),item=timeline[loc.index];
  if(!item||item.type!=='video'||item.mediaMuted||(item.mediaVolume??0)<=0){stopPreviewMediaAudio();return;}
  const source=scenes[item.sourceIndex]||item,el=previewAudioElement(source);if(!el)return;
  const trimStart=Math.max(0,Number(item.trimStart)||0),trimEnd=Math.min(Number(source.sourceDuration)||Infinity,Number(item.trimEnd)||Number(source.sourceDuration)||Infinity);
  const available=Math.max(0,trimEnd-trimStart);
  if(loc.elapsed>=available-.015){stopPreviewMediaAudio();return;}
  const target=Math.max(trimStart,Math.min(trimEnd-.02,trimStart+loc.elapsed));
  if(previewMediaAudio!==el){stopPreviewMediaAudio();previewMediaAudio=el;force=true;}
  const baseVolume=Math.max(0,Math.min(1,item.mediaVolume??source.mediaVolume??0));
  el.volume=Math.max(0,Math.min(1,baseVolume*mediaFadeGain(item,loc.elapsed)));el.muted=!!item.mediaMuted;
  if(force||Math.abs((el.currentTime||0)-target)>.22){try{el.currentTime=target;}catch{}}
  if(el.paused)el.play().catch(()=>{});
}
function setSceneGroupDuration(cueIndex,nextDuration){
  const seg=captionSegmentInfo(cueIndex),group=cues.slice(seg.first,seg.last+1),oldDuration=seg.total;
  nextDuration=Math.max(.1,Math.min(600,Number(nextDuration)||oldDuration));if(!group.length||Math.abs(nextDuration-oldDuration)<.0001)return;
  const scale=nextDuration/oldDuration,start=group[0].start;let cursor=start;
  group.forEach((cue,idx)=>{const duration=idx===group.length-1?start+nextDuration-cursor:Math.max(.05,(cue.end-cue.start)*scale);cue.start=cursor;cue.end=cursor+duration;cursor=cue.end;});
  const delta=nextDuration-oldDuration;for(let j=seg.last+1;j<cues.length;j++){cues[j].start+=delta;cues[j].end+=delta;}
  const scene=scenes.find(x=>x.id===cues[seg.first]?.sceneId);if(scene)scene.duration=nextDuration;
}
function createFreeCue(scene){
  const start=cues.at(-1)?.end||0,duration=Math.max(.1,Number(scene.duration)||3),style=window.newCueStyle?.()||{};
  return {id:uid(),start,end:start+duration,text:'',color:'white',sceneId:scene.id,mediaOffset:0,freeEdit:true,...cloneProjectData(style)};
}
let toastTimer;
function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),4500);}
function project(){return {titleStrokeEnabled:$('titleStrokeEnabled').checked,titleStrokeWidth:Math.max(0,Math.min(18,Number($('titleStrokeWidth').value)||0)),channelStrokeEnabled:$('channelStrokeEnabled').checked,channelStrokeWidth:Math.max(0,Math.min(18,Number($('channelStrokeWidth').value)||0)),bgm:window.bgmProject?.(),channelSize:Number($('channelSize').value)||43.2,channelX:Number($('channelX').value),channelY:Number($('channelY').value),channelItalic:$('channelItalic').checked,channelBold:$('channelBold').checked,channelColor:$('channelColor').value||'#dddddd',titleSize:Number($('titleSize').value)||86.4,titleX:Number($('titleX').value),titleY:Number($('titleY').value),titleItalic:$('titleItalic').checked,titleBold:$('titleBold').checked,titleColor:$('titleColor').value||'#ffe22e',titleColorRanges,titleFont:$('titleFont').value||'noto',channelFont:$('channelFont').value||'noto',scenes:timelineScenes(),cues,title:$('titleInput').value,channel:$('channelInput').value,layout:$('layoutSelect').value,fit:$('fitSelect').value,duration:totalDuration(),audioBuffer};}
function rememberCues(){window.CutflowHistory?.begin?.('자막 편집');}
function repeatFlags(){const flags=new Set(),entries=timelineScenes().map((s,i)=>({s,i})).filter(({s})=>!s.captionSegment||s.captionSegment.position===1);entries.forEach((entry,pos)=>{const s=entry.s;if(s.motion==='still')return;if(pos&&s.motion===entries[pos-1].s.motion){flags.add(entry.i);flags.add(entries[pos-1].i);}const hits=entries.slice(Math.max(0,pos-3),pos+1).filter(x=>x.s.motion===s.motion);if(hits.length>=3)hits.forEach(x=>flags.add(x.i));});return flags;}
function changed({syncBgm=true}={}){dirty=true;stats();if(syncBgm)window.syncBgm?.({emit:false});window.CutflowProjects?.markDirty?.();window.CutflowHistory?.commit?.();}
function setUiText(id,text){const el=$(id);text=String(text);if(el&&el.textContent!==text)el.textContent=text;}
function setUiDisabled(id,value){const el=$(id),next=!!value;if(el&&el.disabled!==next)el.disabled=next;}
function stats(){
  const duration=totalDuration(),flags=repeatFlags();
  setUiText('sceneCount',`${scenes.length} 컷`);setUiText('totalDuration',`${duration.toFixed(2)}초`);setUiText('endTime',timeText(duration));
  setUiText('repeatCount',flags.size?`${flags.size}개 확인`:'없음');const repeat=$('repeatCount'),repeatClass=flags.size?'warn':'safe';if(repeat&&repeat.className!==repeatClass)repeat.className=repeatClass;
  const missing=cues.filter(c=>!scenes.some(s=>s.id===c.sceneId)).length;
  setUiDisabled('exportBtn',!scenes.length||missing>0||loading>0||exporting);
  setUiText('audioStatus',audioBuffer?`${audioName} · ${audioBuffer.duration.toFixed(2)}초`:'오디오 없음');
  const delta=audioBuffer?cutDuration()-audioBuffer.duration:0;
  let timingNotice=!audioBuffer?(window.bgmProject?.().buffer?'내레이션 없이 BGM만 포함해 MP4를 저장합니다.':'오디오 없이도 무음 MP4를 저장할 수 있습니다.'):Math.abs(delta)<.05?'컷 길이와 내레이션 길이가 일치합니다.':delta<0?`컷이 내레이션보다 ${(-delta).toFixed(2)}초 짧아 마지막 프레임을 유지합니다.`:`컷이 내레이션보다 ${delta.toFixed(2)}초 깁니다. 남은 구간은 무음입니다.`;
  if(cues.length)timingNotice=missing?`${missing}개 자막에 컷이 없습니다. 해당 구간에서 사용할 컷을 선택해 주세요.`:!audioBuffer&&cues.some(c=>c.freeEdit)?'내레이션 없는 자유 편집 모드입니다. 장면 길이와 자막을 직접 수정할 수 있습니다.':'자막 시작·종료와 연결된 컷 시간이 자동으로 일치합니다. 자막 사이 빈 구간에는 컷이 표시되지 않습니다.';
  setUiText('timingNotice',timingNotice);
  setUiDisabled('randomMotionBtn',!scenes.some(s=>s.type==='image'));
  setUiDisabled('fitCutsBtn',!scenes.length);setUiDisabled('applyTemplateBtn',!scenes.length);
}
function renderScenes(){
  const flags=repeatFlags();
  const list=$('sceneList');
  list.hidden=!!cues.length;
  if(cues.length)list.innerHTML='';
  else list.innerHTML=scenes.length?scenes.map((s,i)=>`<article class="scene-row ${flags.has(i)?'repeat':''}" data-index="${i}" draggable="true"><span class="drag-handle" title="끌어서 순서 변경">⋮⋮</span><img class="scene-thumb" src="${s.thumb}" alt="컷 ${i+1}"><div class="scene-meta"><strong>${String(i+1).padStart(2,'0')} · ${esc(s.name)}</strong><span>${s.type==='video'?'영상':'이미지'} · ${sceneStart(i).toFixed(2)}초부터</span>${flags.has(i)?'<span class="repeat-tag">움직임 반복</span>':''}</div><div class="control-group duration-control"><label for="dur-${s.id}">컷 길이 (초)</label><input id="dur-${s.id}" data-action="duration" type="number" min="0.1" max="600" step="0.01" value="${s.duration.toFixed(2)}"></div><div class="control-group motion-control"><label for="motion-${s.id}">움직임</label><select id="motion-${s.id}" data-action="motion">${options(motionLabels,s.motion)}</select></div><div class="control-group transition-control"><label for="trans-${s.id}">진입 전환</label><select id="trans-${s.id}" data-action="transition">${options(transitionLabels,s.transition)}</select></div><div class="row-actions"><button class="row-action" data-action="preview" aria-label="컷 ${i+1} 재생">▶</button><button class="row-action danger" data-action="delete" aria-label="컷 ${i+1} 삭제">×</button></div><div class="clip-extra">${s.type==='video'?`<label>원본 시작 <input data-action="trim-start" aria-label="컷 ${i+1} 원본 시작" type="number" min="0" max="${Math.max(0,(s.trimEnd??s.sourceDuration)-.04).toFixed(2)}" step="0.01" value="${s.trimStart.toFixed(2)}"> 초</label><label>원본 끝 <input data-action="trim-end" aria-label="컷 ${i+1} 원본 끝" type="number" min="${Math.min(s.sourceDuration,s.trimStart+.04).toFixed(2)}" max="${s.sourceDuration.toFixed(2)}" step="0.01" value="${(s.trimEnd??s.sourceDuration).toFixed(2)}"> 초</label><span>사용 ${(Math.max(0,(s.trimEnd??s.sourceDuration)-s.trimStart)).toFixed(2)}초 / 원본 ${s.sourceDuration.toFixed(2)}초</span>`:''}<button class="row-action" data-action="up" aria-label="컷 ${i+1} 위로" ${i===0?'disabled':''}>↑</button><button class="row-action" data-action="down" aria-label="컷 ${i+1} 아래로" ${i===scenes.length-1?'disabled':''}>↓</button></div></article>`).join(''):'<div class="empty-list">이미지 또는 영상 컷을 추가해 주세요.</div>';
  $('miniTimeline').innerHTML=timelineScenes().map((s,i)=>`<button class="mini-block ${flags.has(i)?'repeat':''}" data-index="${cues.length?s.sourceIndex:i}" data-time="${cues.length?s.start:sceneStart(i)}" style="width:${Math.max(30,s.duration*16)}px;background-image:url('${s.thumb||''}')" aria-label="${cues.length?'자막':'컷'} ${i+1}으로 이동"></button>`).join('');
  lastActive=-1;
}
function paletteButtons(action){const names={white:'흰색',yellow:'노란색',lime:'연두색',sky:'하늘색',orange:'주황색',red:'빨간색'};return Object.entries(window.CaptionStyle?.palette||{}).map(([name,color])=>`<button type="button" class="color-swatch mini-swatch" data-action="${action}" data-color="${color}" style="--swatch:${color}" aria-label="${names[name]||name}" title="${names[name]||name}"></button>`).join('');}
function captionColorOptions(c){const color=window.CaptionStyle?.resolve(c,project()).color||({white:'#ffffff',yellow:'#eeff00'}[c.color]||c.color);const map={'#ffffff':'흰색','#eeff00':'노란색','#b8ff38':'연두색','#70d6ff':'하늘색','#ff4949':'빨간색','#ff982f':'주황색'};if(!map[color])map[color]='직접 선택 색상';return options(map,color);}
function renderCues(){
  const timeline=timelineScenes(),flags=repeatFlags();
  $('cueList').hidden=!cues.length;
  $('cueList').innerHTML=cues.map((c,i)=>{
    const media=timeline[i],s=scenes[media.sourceIndex],segment=captionSegmentInfo(i),sceneNumber=media.sourceIndex>=0?media.sourceIndex+1:i+1,isLead=segment.position===1;
    const sceneStartTime=cues[segment.first]?.start??c.start,sceneEndTime=cues[segment.last]?.end??c.end,sceneDuration=Math.max(.1,sceneEndTime-sceneStartTime);
    const scenePanel=isLead?`<div class="scene-media-summary"><div><strong>장면 ${String(sceneNumber).padStart(2,'0')}</strong><span>${sceneStartTime.toFixed(2)}–${sceneEndTime.toFixed(2)}초 · ${sceneDuration.toFixed(2)}초</span></div><span>이 장면의 이미지·영상 설정은 자막 ${segment.count}개에 공통 적용됩니다.</span></div>
      ${c.freeEdit?`<div class="scene-media-duration"><label for="scene-duration-${c.id}">장면 길이 (초)</label><input id="scene-duration-${c.id}" data-action="scene-duration" type="number" min="0.1" max="600" step="0.1" value="${sceneDuration.toFixed(2)}"><span>장면 길이를 바꾸면 내부 자막 시간 비율은 유지됩니다.</span></div>`:''}
      <div class="editor-media"><label for="media-${c.id}">이미지·영상</label><select id="media-${c.id}" data-action="media"><option value="">컷을 선택해 주세요</option>${scenes.map((source,j)=>`<option value="${source.id}" ${source.id===c.sceneId?'selected':''}>${j+1} · ${esc(source.name)}</option>`).join('')}</select></div>
      <div class="editor-motion"><label for="motion-${c.id}">움직임</label><select id="motion-${c.id}" data-action="motion" ${s?'':'disabled'}>${options(motionLabels,s?.motion??'still')}</select></div>
      <div class="editor-transition"><label for="transition-${c.id}">진입 전환</label><select id="transition-${c.id}" data-action="transition" ${s?'':'disabled'}>${options(transitionLabels,s?.transition??'cut')}</select></div>
      ${s?.type==='video'?`<details class="media-advanced"><summary>영상 고급 설정 <span>Trim · 원음 · Fade</span></summary><div class="media-advanced-body"><div class="editor-trim"><strong>영상 Trim</strong><div class="trim-fields"><label for="trim-start-${c.id}">시작 (초)<input id="trim-start-${c.id}" data-action="trim-start" type="number" min="0" max="${Math.max(0,(s.trimEnd??s.sourceDuration)-.04).toFixed(2)}" step="0.01" value="${Number(s.trimStart||0).toFixed(2)}"></label><label for="trim-end-${c.id}">끝 (초)<input id="trim-end-${c.id}" data-action="trim-end" type="number" min="${Math.min(s.sourceDuration,(s.trimStart||0)+.04).toFixed(2)}" max="${s.sourceDuration.toFixed(2)}" step="0.01" value="${Number(s.trimEnd??s.sourceDuration).toFixed(2)}"></label></div><span>사용 ${Math.max(0,(s.trimEnd??s.sourceDuration)-(s.trimStart||0)).toFixed(2)}초 / 원본 ${s.sourceDuration.toFixed(2)}초</span></div><div class="editor-audio"><div class="video-audio-head"><strong>영상 원음</strong><label><input type="checkbox" data-action="media-muted" ${s.mediaMuted?'checked':''}> 음소거</label></div><label class="video-volume">볼륨 <input data-action="media-volume" type="range" min="0" max="100" step="1" value="${Math.round((s.mediaVolume??0)*100)}"><output>${Math.round((s.mediaVolume??0)*100)}%</output></label><div class="video-volume-presets" aria-label="영상 원음 빠른 볼륨"><button type="button" data-action="media-volume-preset" data-value="0">0</button><button type="button" data-action="media-volume-preset" data-value="25">25</button><button type="button" data-action="media-volume-preset" data-value="50">50</button><button type="button" data-action="media-volume-preset" data-value="75">75</button><button type="button" data-action="media-volume-preset" data-value="100">100%</button></div><div class="video-audio-fades"><label>페이드 인 (초)<input data-action="media-fade-in" type="number" min="0" max="10" step="0.1" value="${Number(s.mediaFadeIn||0).toFixed(1)}"></label><label>페이드 아웃 (초)<input data-action="media-fade-out" type="number" min="0" max="10" step="0.1" value="${Number(s.mediaFadeOut||0).toFixed(1)}"></label></div><span>내레이션·BGM과 별도로 영상 원음을 조절합니다.</span></div></div></details>`:''}`:'';
    return `<article class="cue-row editor-row ${c.freeEdit?'free-cue ':''}${c.captionGap?'caption-gap ':''}${flags.has(i)?'repeat':''}" data-index="${i}" data-scene-id="${esc(c.sceneId||'')}" data-scene-first="${isLead?'true':'false'}" aria-label="장면 ${sceneNumber} 자막 ${segment.position}">
      <div class="editor-row-heading caption-row-heading"><div><strong>자막 ${segment.position}/${segment.count}</strong><span>${c.start.toFixed(2)}–${c.end.toFixed(2)}초 · ${(c.end-c.start).toFixed(2)}초${c.captionGap?' · 무자막 구간':''}</span></div><button data-action="jump" class="button ghost small">자막 구간 재생</button></div>
      ${!c.freeEdit?`<div class="editor-start"><label for="start-${c.id}">자막 시작 (초)</label><input id="start-${c.id}" data-action="start" type="number" min="0" step="0.01" value="${c.start.toFixed(2)}"></div><div class="editor-end"><label for="end-${c.id}">자막 종료 (초)</label><input id="end-${c.id}" data-action="end" type="number" min="0.1" step="0.01" value="${c.end.toFixed(2)}"></div>`:''}
      <div class="editor-color"><label for="color-${c.id}">색상 · 이 자막</label><select id="color-${c.id}" data-action="color">${captionColorOptions(c)}</select></div>
      <div class="editor-text"><label for="text-${c.id}">자막 · [[강조]] 지원</label><textarea id="text-${c.id}" data-action="text" rows="2" maxlength="240">${esc(c.text)}</textarea><div class="selection-color-tools"><span>선택 글자색</span><div class="color-palette compact-palette selection-palette">${paletteButtons('selection-palette')}</div><label>직접 선택 <input type="color" data-action="selection-color" value="#eeff00" aria-label="구간 ${i+1} 선택 글자색"></label><button type="button" data-action="selection-reset">선택 색상 해제</button><span class="field-help">글자를 드래그한 뒤 색상을 누르면 즉시 적용됩니다.</span></div><div class="caption-segment-nav"><span>자막 ${segment.position} / ${segment.count}</span><div><button type="button" data-action="segment-prev" ${segment.position===1?'disabled':''}>‹ 이전 자막</button><button type="button" data-action="segment-next" ${segment.position===segment.count?'disabled':''}>다음 자막 ›</button></div></div><div class="cue-actions editor-actions caption-cue-actions"><span class="cue-action-label">자막 편집</span><button data-action="split">나누기</button><button data-action="merge" ${segment.position===segment.count?'disabled':''}>다음과 합치기</button><button data-action="delete">구간 삭제</button></div><div class="cue-actions editor-actions scene-cue-actions"><span class="cue-action-label">장면 편집</span><button data-action="scene-split" ${segment.position===1?'disabled':''}>나누기</button><button data-action="scene-merge" ${cues[segment.last+1]?'':'disabled'}>다음과 합치기</button><button data-action="scene-delete">장면 삭제</button></div><div class="caption-quick-timing"><div class="caption-quick-head"><strong>자막 타이밍</strong><span>${(c.end-c.start).toFixed(2)}초</span></div><div class="caption-quick-fields"><label>시작<input data-action="start" type="number" min="0" step="0.01" value="${c.start.toFixed(2)}"></label><label>종료<input data-action="end" type="number" min="0.1" step="0.01" value="${c.end.toFixed(2)}"></label></div><div class="caption-quick-actions"><button type="button" data-action="jump">▶ 현재 자막 재생</button><button type="button" data-action="timing-detail">정밀 타이밍 조정 ›</button></div></div></div>
      ${scenePanel}
    </article>`;
  }).join('');
  lastCue=-1;renderScenes();window.syncStyleEditor?.();
}
function pause(){playRequest++;if(playing)offset=currentTime();playing=false;lastPlaybackScene=-1;window.CutAudio?.stop();stopPreviewMediaAudio();$('narration').pause();$('playBtn').textContent='▶';$('playBtn').setAttribute('aria-label','재생');dirty=true;}
async function play(){
  if(playing){pause();return;}if(exporting||loading)return;
  if(!totalDuration()){toast('먼저 컷이나 내레이션을 불러와 주세요.');return;}
  if(offset>=totalDuration()-.01)offset=0;
  const request=++playRequest;
  try{await CutAudio.unlock();const mixed=await CutAudio.mix(project());if(request!==playRequest||exporting)return;CutAudio.start(mixed,offset);}
  catch{toast('오디오를 재생하지 못했습니다. 재생 버튼을 다시 눌러 주세요.');return;}
  started=performance.now();playing=true;syncPreviewMediaAudio(offset,true);$('playBtn').textContent='Ⅱ';$('playBtn').setAttribute('aria-label','일시정지');
}
const desktopNavigation=()=>window.matchMedia?.('(min-width: 820px)').matches===true;
function selectNavigationCue(index,scroll=false){
  const cue=cues[index];if(!cue||exporting)return;
  jump(cue.start);
  document.querySelectorAll('.cue-row').forEach(row=>{
    const selected=Number(row.dataset.index)===index;
    row.classList.toggle('active',selected);
    if(selected&&scroll)row.scrollIntoView({behavior:'smooth',block:'center',inline:'nearest'});
  });
  lastCue=index;
  if(typeof CustomEvent==='function')window.dispatchEvent(new CustomEvent('cutflow-caption-active',{detail:{index}}));
  window.selectStyleCue?.(index);
  const sourceIndex=scenes.findIndex(scene=>scene.id===cue.sceneId);
  const label=`자막 ${index+1} · 컷 ${sourceIndex+1}`;if($('nowPlaying').textContent!==label)$('nowPlaying').textContent=label;
}
function navigateCut(direction){
  if(desktopNavigation()&&window.CutflowScene?.items?.().length){
    const list=CutflowScene.items(),current=CutflowScene.index(),target=Math.max(0,Math.min(list.length-1,current+direction));
    CutflowScene.select(target);return;
  }
  if(desktopNavigation()&&cues.length){
    const time=currentTime(),active=cues.findIndex(c=>time>=c.start&&time<c.end);let index;
    if(active>=0)index=Math.max(0,Math.min(cues.length-1,active+direction));
    else if(direction>0){index=cues.findIndex(c=>c.start>time);if(index<0)index=cues.length-1;}
    else{index=cues.findLastIndex(c=>c.start<time);if(index<0)index=0;}
    selectNavigationCue(index,true);return;
  }
  const starts=cues.length?cues.map(c=>c.start):scenes.map((s,i)=>sceneStart(i));const time=currentTime();const next=direction>0?starts.find(t=>t>time+.01):starts.filter(t=>t<time-.01).at(-1);jump(next??(direction>0?totalDuration():0));
}
function jump(time){pause();offset=Math.max(0,Math.min(totalDuration(),time));if(audioBuffer)$('narration').currentTime=Math.min(offset,audioBuffer.duration);dirty=true;}
window.CutflowPlayer={
  state(){return {playing,currentTime:currentTime(),duration:totalDuration(),progress:totalDuration()?currentTime()/totalDuration():0,exporting,loading:!!loading};},
  toggle(){return play();},
  pause(){pause();return true;},
  seekProgress(progress){jump(totalDuration()*Math.max(0,Math.min(1,Number(progress)||0)));return this.state();},
  invalidate(){dirty=true;return true;}
};
let lastPreviewRenderAt=0;
async function tick(frameNow=performance.now()){
  const time=currentTime();
  if(playing&&time>=totalDuration()){pause();offset=totalDuration();}
  const mobilePlayback=playing&&window.CutflowUI?.mobileActive===true;
  const frameDue=!mobilePlayback||frameNow-lastPreviewRenderAt>=33;
  if(!exporting&&!rendering&&(dirty||(playing&&frameDue))){
    if(mobilePlayback)lastPreviewRenderAt=frameNow;
    rendering=true;dirty=false;
    try{await CutRenderer.draw($('stage'),project(),time);}catch(error){pause();toast(error.message);}finally{rendering=false;}
    $('currentTime').textContent=timeText(time);$('scrubber').value=totalDuration()?1000*time/totalDuration():0;
    const timeline=timelineScenes(),found=CutRenderer.locate(timeline,time),active=timeline[found.index];const loc={index:cues.length?(active?.sourceIndex??-1):found.index},playingLabel=loc.index<0?'장면 없음':cues.length?`자막 ${active.cueIndex+1} · 컷 ${loc.index+1}`:`컷 ${loc.index+1} / ${scenes.length}`;if($('nowPlaying').textContent!==playingLabel)$('nowPlaying').textContent=playingLabel;
    if(loc.index!==lastActive){document.querySelectorAll('.scene-row,.mini-block').forEach(el=>el.classList.toggle('active',Number(el.dataset.index)===loc.index));lastActive=loc.index;}
    const cueIndex=cues.findIndex(c=>time>=c.start&&time<c.end);if(cueIndex!==lastCue){document.querySelectorAll('.cue-row').forEach(el=>el.classList.toggle('active',Number(el.dataset.index)===cueIndex));lastCue=cueIndex;if(typeof CustomEvent==='function')window.dispatchEvent(new CustomEvent('cutflow-caption-active',{detail:{index:cueIndex}}));}
    if(playing){const sceneIndex=cues.length?(window.CutflowScene?.sceneIndexForCue?.(cueIndex)??-1):found.index;if(sceneIndex>=0&&sceneIndex!==lastPlaybackScene){lastPlaybackScene=sceneIndex;window.dispatchEvent(new CustomEvent('cutflow-scene',{detail:sceneIndex}));}}
    waveform(time);
  }
  if(playing)syncPreviewMediaAudio(time);
  requestAnimationFrame(tick);
}
function waveform(time=0){const canvas=$('waveform'),ctx=canvas.getContext('2d');ctx.clearRect(0,0,720,100);ctx.fillStyle='#687541';for(let i=0;i<envelope.length;i++){const amp=Math.max(1,envelope[i]*42);ctx.fillRect(i*720/envelope.length,50-amp,Math.max(1,720/envelope.length-1),amp*2);}if(audioBuffer){ctx.fillStyle='#e8693d';ctx.fillRect(Math.min(718,time/audioBuffer.duration*720),0,2,100);}}
function analyzeAudio(buffer){
  const data=buffer.getChannelData(0),sr=buffer.sampleRate,hop=Math.max(1,Math.floor(sr*.02));const rms=[];let peak=0;
  for(let i=0;i<data.length;i+=hop){let sum=0;for(let j=i;j<Math.min(data.length,i+hop);j++)sum+=data[j]*data[j];const v=Math.sqrt(sum/hop);rms.push(v);peak=Math.max(peak,v);}
  timingAnalysis=window.CutflowTimingAlign?.analyze?.(buffer)||null;
  silences=(timingAnalysis?.pauses||[]).map(p=>p.time);
  if(!silences.length){const threshold=Math.max(.001,peak*.07);let begin=null;rms.forEach((v,i)=>{if(v<threshold){if(begin===null)begin=i*.02;}else if(begin!==null){if(i*.02-begin>=.14)silences.push((begin+i*.02)/2);begin=null;}});}
  envelope=Array.from({length:360},(_,i)=>{const from=Math.floor(i*rms.length/360),to=Math.max(from+1,Math.floor((i+1)*rms.length/360));return Math.max(...rms.slice(from,to),0)/(peak||1);});
  window.CutflowTimingData=timingAnalysis;
}
async function loadAudio(file,{commit=true,notify=true}={}){
  if(!file)return false;pause();loading++;stats();$('audioStatus').textContent='오디오 읽는 중…';let context,loaded=false;
  try{context=new AudioContext();const decoded=await context.decodeAudioData(await file.arrayBuffer());if(!Number.isFinite(decoded.duration)||decoded.duration<=0)throw new Error('오디오 길이를 확인할 수 없습니다.');
    if(audioUrl)URL.revokeObjectURL(audioUrl);audioUrl=URL.createObjectURL(file);audioBuffer=decoded;audioName=file.name;audioFile=file;$('narration').src=audioUrl;analyzeAudio(decoded);offset=0;loaded=true;if(notify)toast('오디오를 불러왔습니다. 대본으로 자막 구간을 만들어 주세요.');
  }catch{if(notify)toast('오디오를 읽지 못했습니다. MP3 또는 WAV 파일로 다시 시도해 주세요.');}finally{await context?.close();loading--;if(loaded&&commit)changed();else stats();waveform();$('audioInput').value='';}
  return loaded;
}
function scriptLines(text){let lines=text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);if(lines.length===1)lines=lines[0].split(/(?<=[.!?。！？])\s+/).filter(Boolean);return lines.flatMap(line=>{if(line.length<=100)return [line];const result=[];while(line.length>100){let at=line.lastIndexOf(' ',90);if(at<30)at=80;result.push(line.slice(0,at).trim());line=line.slice(at).trim();}if(line)result.push(line);return result;});}
function buildCues(){
  const lines=scriptLines($('scriptInput').value);if(!audioBuffer||!lines.length){toast('대본과 내레이션 오디오를 모두 넣어 주세요.');return;}
  if(lines.length>audioBuffer.duration/.1){toast('자막 구간이 너무 많습니다. 대본의 줄 수를 줄여 주세요.');return;}
  pause();rememberCues();const inheritedStyle=window.newCueStyle?.()||{};const total=audioBuffer.duration;
  const aligned=window.CutflowTimingAlign?.alignTexts?.(lines,0,total,timingAnalysis?.candidates||[]);
  let boundaries=aligned?.boundaries;
  if(!Array.isArray(boundaries)||boundaries.length!==lines.length+1){
    const weights=lines.map(s=>Math.max(1,s.replace(/\[\[|\]\]|\s/g,'').length)),sum=weights.reduce((a,b)=>a+b,0);let weight=0;boundaries=[0];
    for(let i=0;i<lines.length-1;i++){weight+=weights[i];boundaries.push(total*weight/sum);}boundaries.push(total);
  }
  cues=lines.map((text,i)=>({id:uid(),start:boundaries[i],end:boundaries[i+1],text,color:'white',...structuredClone(inheritedStyle)}));
  offset=0;assignAvailableCuts();renderCues();changed();
  const matched=(aligned?.pauseHits||0)+(aligned?.valleyHits||0),fallback=aligned?.fallbackCount||0;
  toast(matched?`자막 시간 초안을 음성 쉼 ${matched}곳에 맞췄습니다.${fallback?` ${fallback}곳은 문장 길이 기준으로 배분했습니다.`:''}`:'자막 시간 초안을 문장 길이에 맞춰 만들었습니다. 음성을 들으며 조정해 주세요.');
}
function fitCuts(message=true){
  if(!scenes.length)return;pause();let didChange=false;
  if(cues.length){rememberCues();cues.forEach((c,i)=>{c.sceneId=scenes[i]?.id;c.mediaOffset=0;});renderCues();didChange=true;}
  else if(audioBuffer){scenes.forEach(s=>s.duration=audioBuffer.duration/scenes.length);renderScenes();didChange=true;}
  if(didChange)changed();offset=0;if(message)toast('자막 1개에 컷 1개씩 순서대로 연결했습니다. 부족한 컷은 해당 구간에서 선택해 주세요.');
}
function waitMedia(element,event){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>finish(new Error('파일을 읽는 시간이 초과되었습니다.')),15000);const ok=()=>finish(),bad=()=>finish(new Error('브라우저에서 재생할 수 없는 파일입니다.'));function finish(error){clearTimeout(timer);element.removeEventListener(event,ok);element.removeEventListener('error',bad);error?reject(error):resolve();}element.addEventListener(event,ok,{once:true});element.addEventListener('error',bad,{once:true});});}
async function makeScene(file){
  const video=file.type.startsWith('video/')||/\.(mp4|mov|webm|m4v)$/i.test(file.name),url=URL.createObjectURL(file);const element=video?document.createElement('video'):new Image();
  try{if(video){element.muted=true;element.playsInline=true;element.preload='auto';}const ready=waitMedia(element,video?'loadeddata':'load');element.src=url;await ready;
    const sourceDuration=video?element.duration:0;if(video&&(!Number.isFinite(sourceDuration)||sourceDuration<=0))throw new Error('유효한 영상 길이가 아닙니다.');
    const canvas=document.createElement('canvas');canvas.width=120;canvas.height=90;canvas.getContext('2d').drawImage(element,0,0,120,90);
    return {id:uid(),name:file.name,file,url,element,type:video?'video':'image',sourceDuration,trimStart:0,trimEnd:video?sourceDuration:0,duration:video?Math.min(2.4,sourceDuration):2.4,motion:'still',transition:'cut',mediaVolume:0,mediaMuted:false,mediaFadeIn:0,mediaFadeOut:0,thumb:canvas.toDataURL('image/jpeg',.65)};
  }catch(error){URL.revokeObjectURL(url);throw error;}
}
async function addFiles(files,{createFreeCues=true,deferCommit=false}={}){
  const list=[...files].filter(f=>/^image\/|^video\//.test(f.type)||/\.(mp4|mov|webm|m4v)$/i.test(f.name));if(!list.length){toast('이미지 또는 영상 파일을 선택해 주세요.');return [];}
  pause();loading++;stats();let success=0,errors=[],added=[];
  for(const file of list){try{const scene=await makeScene(file);scene.motion=scene.type==='image'?chooseAutoMotion():'still';
      if(!audioBuffer&&createFreeCues){scene.duration=scene.type==='video'?Math.max(.1,Math.min(600,scene.sourceDuration)):3;scene.mediaVolume=scene.type==='video'?1:0;}
      scenes.push(scene);added.push(scene);success++;}catch{errors.push(file.name);}}
  if(!audioBuffer&&createFreeCues&&added.length){rememberCues();for(const scene of added)cues.push(createFreeCue(scene));}
  loading--;
  if(deferCommit){stats();return added;}
  assignAvailableCuts();renderCues();if(success)changed();$('fileInput').value='';toast(`${success}개 장면을 추가했습니다.${!audioBuffer&&success?' 내레이션 없이 자막을 직접 입력할 수 있습니다.':''}${errors.length?' 읽기 실패: '+errors.join(', '):''}`);
  return added;
}
async function demo(){
  if(loading)return;loading++;stats();
  for(let i=0;i<4;i++){const canvas=document.createElement('canvas');canvas.width=600;canvas.height=900;const ctx=canvas.getContext('2d');const colors=['#244663','#674552','#526044','#61507b'];ctx.fillStyle=colors[i];ctx.fillRect(0,0,600,900);ctx.fillStyle='#f2d998';ctx.beginPath();ctx.arc(420,200,100,0,Math.PI*2);ctx.fill();ctx.fillStyle='#142930';ctx.beginPath();ctx.moveTo(0,620);ctx.lineTo(220,450);ctx.lineTo(600,800);ctx.lineTo(600,900);ctx.lineTo(0,900);ctx.fill();const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));scenes.push(await makeScene(new File([blob],`sample_${i+1}.png`,{type:'image/png'})));}
  if(!$('titleInput').value)$('titleInput').value='나만의 쇼츠 제목\n지금 만들어 보세요';lastTitleText=$('titleInput').value;if(!$('scriptInput').value)$('scriptInput').value='대본과 오디오를 함께 넣으세요.\n자막 시간을 자유롭게 조정하세요.\n이미지와 영상을 섞어 편집하세요.\n완성한 쇼츠를 MP4로 저장하세요.';
  if(!cues.length){rememberCues();cues=scriptLines($('scriptInput').value).map((text,i)=>({id:uid(),text,start:i*2.4,end:(i+1)*2.4,color:'white'}));}
  assignAvailableCuts();loading--;applyRhythm();await CutRenderer.fonts(project());dirty=true;
}
function applyRhythm(){pause();const rhythm=rhythms[$('templateSelect').value];scenes.forEach((s,i)=>{if(s.type==='image')s.motion=rhythm.motions[i%rhythm.motions.length];s.transition=i?rhythm.transitions[i%rhythm.transitions.length]:'cut';});cues.forEach(c=>{delete c.motion;delete c.transition;delete c.transform;delete c.trimStart;delete c.trimEnd;});renderCues();changed();toast('길이는 유지하고 장면별 움직임·전환만 적용했습니다.');}
async function exportVideo(){
  const emit=(type,detail={})=>{if(typeof CustomEvent==='function')window.dispatchEvent(new CustomEvent(type,{detail}));};
  if(exporting||loading){emit('cutflow-export-error',{message:exporting?'이미 MP4를 만들고 있습니다.':'미디어를 불러오는 중입니다.'});return false;}
  if(!scenes.length){emit('cutflow-export-error',{message:'먼저 이미지나 영상을 추가해 주세요.'});toast('먼저 이미지나 영상을 추가해 주세요.');return false;}
  const missing=cues.filter(c=>!scenes.some(s=>s.id===c.sceneId)).length;if(missing){emit('cutflow-export-error',{message:`장면이 연결되지 않은 자막이 ${missing}개 있습니다.`});toast('장면이 연결되지 않은 자막을 먼저 확인해 주세요.');return false;}
  pause();exporting=true;const mobile=window.CutflowUI?.mode==='mobile';
  if(!mobile)$('exportDialog').showModal();$('downloadLink').hidden=true;$('closeExportBtn').hidden=true;$('cancelExportBtn').hidden=false;$('exportProgress').value=0;if(downloadUrl){URL.revokeObjectURL(downloadUrl);downloadUrl=null;}stats();
  const token={cancelled:false};window.currentExport=token;let wakeLock;
  const width=Number($('resolutionSelect').value),filename=`Cutflow_${new Date().toISOString().slice(0,10)}_${width}p.mp4`;
  emit('cutflow-export-start',{width,filename});
  try{while(rendering)await new Promise(r=>setTimeout(r,20));await CutRenderer.fonts(project());try{wakeLock=await navigator.wakeLock?.request('screen');}catch{}
    const blob=await CutEncoder.exportMP4(project(),width,token,(progress,message)=>{$('exportProgress').value=progress;$('exportStatus').textContent=message;emit('cutflow-export-progress',{progress,message,width});});
    if(token.cancelled)throw new Error('취소되었습니다.');downloadUrl=URL.createObjectURL(blob);const link=$('downloadLink');link.href=downloadUrl;link.download=filename;link.hidden=false;$('exportProgress').value=1;$('exportStatus').textContent='MP4 완성. 다운로드 버튼을 눌러 저장하세요.';
    emit('cutflow-export-complete',{blob,filename,width,size:blob.size});toast('MP4 파일을 만들었습니다.');return {blob,filename,width};
  }catch(error){const message=token.cancelled?'저장을 취소했습니다. 편집 내용은 유지됩니다.':`저장 실패: ${error.message}`;$('exportStatus').textContent=message;emit(token.cancelled?'cutflow-export-cancelled':'cutflow-export-error',{message,error});return false;}
  finally{await wakeLock?.release();exporting=false;window.currentExport=null;$('cancelExportBtn').hidden=true;$('closeExportBtn').hidden=false;dirty=true;stats();}
}
$('uploadBtn').onclick=$('addMoreBtn').onclick=()=>$('fileInput').click();$('fileInput').onchange=e=>addFiles(e.target.files);
$('audioBtn').onclick=()=>$('audioInput').click();$('audioInput').onchange=e=>loadAudio(e.target.files[0]);$('scriptFileBtn').onclick=()=>$('scriptFile').click();$('scriptFile').onchange=async e=>{if(e.target.files[0]){$('scriptInput').value=await e.target.files[0].text();$('scriptInput').dispatchEvent(new Event('input',{bubbles:true}));changed();}e.target.value='';};
function applyRandomMotion(){
  pause();if(cues.length)rememberCues();let previous=[];
  const choose=()=>{const next=pickAutoMotion(previous);previous=[...previous,next].slice(-2);return next;};
  scenes.forEach(s=>{if(s.type==='image')s.motion=choose();});
  cues.forEach(c=>{delete c.motion;delete c.transition;delete c.transform;});
  renderCues();changed();toast('장면별로 겹치지 않는 랜덤 무빙을 적용했습니다. 자막을 나눠도 효과는 유지됩니다.');
  if(typeof CustomEvent==='function')window.dispatchEvent(new CustomEvent('cutflow-compose-updated',{detail:{reason:'random-motion'}}));
  return true;
}
$('randomMotionBtn').onclick=applyRandomMotion;
$('buildCuesBtn').onclick=async()=>{buildCues();if(cues.length&&$('projectCaptionWrap')?.checked)await autoWrapCaptions();};$('fitCutsBtn').onclick=()=>fitCuts();$('applyTemplateBtn').onclick=applyRhythm;$('demoBtn').onclick=demo;
$('playBtn').onclick=play;$('prevBtn').onclick=()=>navigateCut(-1);$('nextBtn').onclick=()=>navigateCut(1);$('scrubber').oninput=e=>jump(totalDuration()*Number(e.target.value)/1000);
$('waveform').onclick=e=>{if(audioBuffer)jump((e.clientX-e.target.getBoundingClientRect().left)/e.target.clientWidth*audioBuffer.duration);};
lastTitleText=$('titleInput').value;
$('titleInput').addEventListener('input',e=>{titleColorRanges=CaptionRanges.edit(lastTitleText,e.target.value,titleColorRanges);lastTitleText=e.target.value;});
['titleInput','titleBold','titleItalic','titleSize','titleColor','titleX','titleY','channelInput','channelBold','channelItalic','channelSize','channelColor','channelX','channelY','fitSelect'].forEach(id=>$(id).addEventListener('input',changed));
$('layoutSelect').addEventListener('input',()=>{$('fitSelect').disabled=$('layoutSelect').value==='fullscreen';$('layoutDescription').textContent=$('layoutSelect').value==='framed'?'노란 제목 · 중앙 이미지 · 하단 자막과 채널명':$('layoutSelect').value==='fullscreen'?'이미지·영상 전체 채우기 · 자막 오버레이':'노란 제목 · 세로 확장 영상 · 강조 자막과 채널명';window.syncStyleEditor?.();});
$('titleSelectionApply').onclick=()=>{const input=$('titleInput'),start=input.selectionStart,end=input.selectionEnd;if(start===end){toast('색상을 바꿀 제목 글자를 먼저 선택해 주세요.');return;}titleColorRanges=CaptionRanges.apply(input.value,titleColorRanges,start,end,$('titleSelectionColor').value);lastTitleText=input.value;changed();toast('선택한 제목 글자에 색상을 적용했습니다.');};
$('titleSelectionReset').onclick=()=>{const input=$('titleInput'),start=input.selectionStart,end=input.selectionEnd;if(start===end){toast('색상을 해제할 제목 글자를 먼저 선택해 주세요.');return;}titleColorRanges=CaptionRanges.apply(input.value,titleColorRanges,start,end,null);lastTitleText=input.value;changed();toast('선택한 제목 글자의 개별 색상을 해제했습니다.');};
$('miniTimeline').onclick=e=>{const target=e.target.closest('[data-index]');if(target)jump(Number(target.dataset.time));};
$('sceneList').onclick=e=>{const row=e.target.closest('.scene-row');if(!row)return;const i=Number(row.dataset.index),action=e.target.dataset.action;if(action==='preview'){jump(sceneStart(i));play();return;}if(action==='up'){window.CutflowScene?.move?.(i,i-1);return;}if(action==='down'){window.CutflowScene?.move?.(i,i+1);return;}if(action==='delete')window.CutflowScene?.remove?.(i);};
$('sceneList').onchange=e=>{const row=e.target.closest('.scene-row');if(!row)return;const i=Number(row.dataset.index),action=e.target.dataset.action,patch={};if(action==='duration')patch.duration=Number(e.target.value);else if(action==='trim-start')patch.trimStart=Number(e.target.value);else if(action==='trim-end')patch.trimEnd=Number(e.target.value);else if(action==='motion')patch.motion=e.target.value;else if(action==='transition')patch.transition=e.target.value;else return;if(window.CutflowScene?.update?.(i,patch))window.CutflowScene.select(i);};
$('sceneList').ondragstart=e=>{if(e.target.matches('input,textarea,select')){e.preventDefault();return;}dragIndex=Number(e.target.closest('.scene-row')?.dataset.index);};$('sceneList').ondragover=e=>e.preventDefault();$('sceneList').ondrop=e=>{e.preventDefault();const row=e.target.closest('.scene-row');if(row&&Number.isInteger(dragIndex))window.CutflowScene?.move?.(dragIndex,Number(row.dataset.index));dragIndex=null;};$('sceneList').ondragend=()=>dragIndex=null;
$('clearBtn').onclick=()=>{pause();scenes.forEach(releaseSceneResources);scenes=[];cues.forEach(c=>delete c.sceneId);offset=0;renderCues();changed();};
$('cueList').onfocusin=e=>{const row=e.target.closest('.cue-row');if(row)window.selectStyleCue?.(Number(row.dataset.index));if(e.target.dataset.action==='text')rememberCues();};
function applyCueSelectionColor(index,input,color){
  if(!cues[index]||!input)return false;
  return !!window.CutflowCaption?.applySelectionColor?.(index,Number(input.selectionStart),Number(input.selectionEnd),color||null);
}
$('cueList').oninput=e=>{const row=e.target.closest('.cue-row');if(!row)return;const index=Number(row.dataset.index),cue=cues[index],action=e.target.dataset.action;if(action==='selection-color'){const input=row.querySelector('textarea[data-action="text"]');if(input&&input.selectionStart!==input.selectionEnd)applyCueSelectionColor(index,input,e.target.value);return;}if(action==='text'){cue.colorRanges=CaptionRanges.edit(cue.text,e.target.value,cue.colorRanges);cue.text=e.target.value;cue.captionGap=!e.target.value.trim();changed();}else if(action==='media-volume'){const scene=scenes.find(s=>s.id===cue.sceneId);if(scene){scene.mediaVolume=Math.max(0,Math.min(1,Number(e.target.value)/100));const out=e.target.parentElement?.querySelector('output');if(out)out.textContent=`${Math.round(scene.mediaVolume*100)}%`;changed();}}else if(action==='media-fade-in'||action==='media-fade-out'){const scene=scenes.find(s=>s.id===cue.sceneId);if(scene){const available=Math.max(0,(scene.trimEnd??scene.sourceDuration)-scene.trimStart),value=Math.max(0,Math.min(available,Number(e.target.value)||0));scene[action==='media-fade-in'?'mediaFadeIn':'mediaFadeOut']=value;changed();}}};
$('cueList').onchange=e=>{const row=e.target.closest('.cue-row');if(!row)return;const i=Number(row.dataset.index),cue=cues[i],action=e.target.dataset.action;if(action==='text'||action==='selection-color'||action==='media-volume'||action==='media-fade-in'||action==='media-fade-out')return;const value=Number(e.target.value),seg=captionSegmentInfo(i),scene=scenes.find(s=>s.id===cue.sceneId);if(action==='start'&&(!Number.isFinite(value)||value<0||value>=cue.end-.05||(i>0&&value<cues[i-1].end))||action==='end'&&(!Number.isFinite(value)||value<=cue.start+.05||(i<cues.length-1&&value>cues[i+1].start))){toast('자막 시간은 서로 겹치지 않고 시작보다 종료가 늦어야 합니다.');renderCues();return;}if(action==='scene-duration'&&(!Number.isFinite(value)||value<.1)){toast('장면 길이는 0.1초 이상으로 입력해 주세요.');renderCues();return;}rememberCues();if(action==='scene-duration'){setSceneGroupDuration(i,value);}else if(action==='start'||action==='end')cue[action]=value;else if(action==='color'){cue.color=e.target.value;cue.style={...cue.style,color:e.target.value};}else if(action==='motion'){if(scene){scene.motion=e.target.value;for(let j=seg.first;j<=seg.last;j++)delete cues[j].motion;}}else if(action==='transition'){if(scene){scene.transition=e.target.value;for(let j=seg.first;j<=seg.last;j++)delete cues[j].transition;}}else if(action==='trim-start'){if(scene){scene.trimStart=Math.max(0,Math.min((scene.trimEnd??scene.sourceDuration)-.04,value||0));for(let j=seg.first;j<=seg.last;j++){delete cues[j].trimStart;delete cues[j].trimEnd;cues[j].mediaOffset=cues[j].start-cues[seg.first].start;}if(cue.freeEdit)setSceneGroupDuration(i,Math.max(.1,(scene.trimEnd??scene.sourceDuration)-scene.trimStart));}}else if(action==='trim-end'){if(scene){scene.trimEnd=Math.max((scene.trimStart||0)+.04,Math.min(scene.sourceDuration,value||scene.sourceDuration));for(let j=seg.first;j<=seg.last;j++){delete cues[j].trimStart;delete cues[j].trimEnd;cues[j].mediaOffset=cues[j].start-cues[seg.first].start;}if(cue.freeEdit)setSceneGroupDuration(i,Math.max(.1,scene.trimEnd-(scene.trimStart||0)));}}else if(action==='media-muted'){if(scene){scene.mediaMuted=e.target.checked;if(previewMediaAudio===scene.audioElement)previewMediaAudio.muted=scene.mediaMuted;}}else if(action==='media'){const newId=e.target.value||null;for(let j=seg.first;j<=seg.last;j++){cues[j].sceneId=newId;cues[j].mediaOffset=cues[j].start-cues[seg.first].start;delete cues[j].trimStart;delete cues[j].trimEnd;delete cues[j].motion;delete cues[j].transition;delete cues[j].transform;}}jump(cues[seg.first]?.start??cue.start);commitCaptionChange(i);};
$('cueList').onclick=async e=>{const row=e.target.closest('.cue-row');if(!row)return;const i=Number(row.dataset.index),cue=cues[i],action=e.target.dataset.action;if(action==='scene-split'){const sceneIndex=window.CutflowScene?.sceneIndexForCue?.(i)??-1;if(sceneIndex>=0)await window.CutflowScene?.split?.(sceneIndex,cue.start);return;}if(action==='scene-merge'){const sceneIndex=window.CutflowScene?.sceneIndexForCue?.(i)??-1;if(sceneIndex>=0&&confirm('다음 장면과 합칠까요? 현재 장면의 이미지·영상 설정이 유지됩니다.'))window.CutflowScene?.mergeNext?.(sceneIndex);return;}if(action==='scene-delete'){const sceneIndex=window.CutflowScene?.sceneIndexForCue?.(i)??-1;if(sceneIndex<0)return;if(window.CutflowScene?.confirmStructureEdit?.()===false)return;if(confirm(`장면 ${sceneIndex+1}을 삭제할까요?`))window.CutflowScene?.remove?.(sceneIndex);return;}if(action==='selection-palette'){const picker=row.querySelector('[data-action="selection-color"]'),input=row.querySelector('textarea[data-action="text"]');if(picker)picker.value=e.target.dataset.color;if(input)applyCueSelectionColor(i,input,e.target.dataset.color);return;}if(action==='media-volume-preset'){const scene=scenes.find(s=>s.id===cue.sceneId);if(scene){scene.mediaVolume=Math.max(0,Math.min(1,Number(e.target.dataset.value)/100));scene.mediaMuted=false;changed();renderCues();jump(cue.start);}return;}if(action==='selection-reset'){const input=row.querySelector('textarea[data-action="text"]');if(applyCueSelectionColor(i,input,null))toast('선택한 글자의 개별 색상을 해제했습니다.');return;}if(action==='style'){window.selectStyleCue?.(i,true);return;}if(action==='jump'){jump(cue.start);play();return;}if(action==='timing-detail'){window.dispatchEvent(new CustomEvent('cutflow-open-timing',{detail:{cueId:cue.id,index:i}}));return;}if(action==='segment-prev'||action==='segment-next'){const seg=captionSegmentInfo(i),target=action==='segment-prev'?i-1:i+1;if(target>=seg.first&&target<=seg.last)selectNavigationCue(target,false);return;}if(!['split','merge','delete'].includes(action)){if(desktopNavigation()&&!e.target.closest('button,a,input,textarea,select,label'))selectNavigationCue(i);return;}if(action==='split'){const input=row.querySelector('textarea[data-action="text"]');window.CutflowCaption?.split?.(i,input?.selectionStart);return;}if(action==='merge'){window.CutflowCaption?.mergeNext?.(i);return;}if(action==='delete'){window.CutflowCaption?.remove?.(i);return;};};
$('addCueBtn').onclick=()=>{rememberCues();const start=cues.at(-1)?.end||0;cues.push({id:uid(),start,end:start+2,text:'새 자막',color:'white',freeEdit:!audioBuffer,...window.newCueStyle?.()});assignAvailableCuts();renderCues();changed();};

const captionState=index=>{const c=cues[index];if(!c)return null;const seg=captionSegmentInfo(index);return {index,id:c.id,text:c.text||'',start:c.start,end:c.end,color:CaptionStyle.resolve(c,project()).color,freeEdit:!!c.freeEdit,sceneId:c.sceneId||null,segment:{position:seg.position,count:seg.count,first:seg.first,last:seg.last}};};
const captionChanged=index=>{renderCues();window.selectStyleCue?.(Math.max(0,Math.min(cues.length-1,index)));window.dispatchEvent(new CustomEvent('cutflow-caption-updated',{detail:{index,state:captionState(index)}}));};
const commitCaptionChange=index=>{changed();captionChanged(index);return captionState(index);};
window.CutflowCaption={
  count(){return cues.length;},
  state:captionState,
  currentIndex(){
    const time=currentTime(),active=cues.findIndex(c=>time>=c.start&&time<c.end);
    if(active>=0)return active;
    const si=window.CutflowScene?.index?.()||0,ci=window.CutflowScene?.cueIndex?.(si);
    return Number.isInteger(ci)&&ci>=0?ci:Math.max(0,active);
  },
  update(index,patch={}){
    const c=cues[index];if(!c)return false;const seg=captionSegmentInfo(index);
    const nextStart=patch.start!=null&&!c.freeEdit?Number(patch.start):null,nextEnd=patch.end!=null&&!c.freeEdit?Number(patch.end):null;
    if(nextStart!=null&&(!Number.isFinite(nextStart)||nextStart<0||nextStart>=c.end-.05||(index>0&&nextStart<cues[index-1].end))){toast('자막 시작 시간을 확인해 주세요.');return false;}
    if(nextEnd!=null&&(!Number.isFinite(nextEnd)||nextEnd<=(nextStart??c.start)+.05||(index<cues.length-1&&nextEnd>cues[index+1].start))){toast('자막 종료 시간을 확인해 주세요.');return false;}
    rememberCues();
    if(patch.text!=null){c.colorRanges=CaptionRanges.edit(c.text,String(patch.text),c.colorRanges);c.text=String(patch.text);c.captionGap=!c.text.trim();}
    if(patch.color!=null){c.color=patch.color;c.style={...c.style,color:patch.color};}
    if(nextStart!=null)c.start=nextStart;
    if(nextEnd!=null)c.end=nextEnd;
    if(c.sceneId){for(let j=seg.first;j<=seg.last;j++)cues[j].mediaOffset=Math.max(0,cues[j].start-cues[seg.first].start);}
    return commitCaptionChange(index);
  },
  play(index){const c=cues[index];if(!c)return false;jump(c.start);play();return true;},
  applySelectionColor(index,start,end,color){
    const c=cues[index];if(!c)return false;start=Number(start);end=Number(end);
    if(!Number.isInteger(start)||!Number.isInteger(end)||start===end){toast('색상을 바꿀 글자를 먼저 선택해 주세요.');return false;}
    pause();rememberCues();c.colorRanges=CaptionRanges.apply(c.text,c.colorRanges,start,end,color||null);jump(c.start);changed();
    if(typeof CustomEvent==='function')window.dispatchEvent(new CustomEvent('cutflow-caption-updated',{detail:{index,state:captionState(index)}}));
    return true;
  },
  select(index){if(!cues[index])return false;jump(cues[index].start);window.selectStyleCue?.(index);window.dispatchEvent(new CustomEvent('cutflow-caption-selected',{detail:{index,state:captionState(index)}}));return true;},
  split(index,cursor){
    const c=cues[index];if(!c)return false;
    const start=Number(c.start),end=Number(c.end),duration=end-start;cursor=Number(cursor);
    if(!Number.isFinite(start)||!Number.isFinite(end)||!Number.isFinite(duration)||duration<.2){toast('자막 시간 정보가 올바르지 않아 나눌 수 없습니다.');return false;}
    if(!Number.isInteger(cursor)||cursor<=0||cursor>=String(c.text||'').length){toast('자막을 나눌 글자 위치를 선택해 주세요.');return false;}
    const [first,second]=CaptionRanges.split(String(c.text||''),c.colorRanges,cursor);
    if(!first.text||!second.text){toast('자막 앞뒤에 글자가 있도록 나눌 위치를 옮겨 주세요.');return false;}
    const ratio=Math.max(.15,Math.min(.85,first.text.length/Math.max(1,first.text.length+second.text.length)));
    const firstDuration=Math.max(.1,Math.min(duration-.1,duration*ratio)),splitAt=start+firstDuration,base=Number(c.mediaOffset)||0;
    if(!Number.isFinite(splitAt)||splitAt<=start||splitAt>=end){toast('자막 분할 시간을 계산하지 못했습니다.');return false;}
    rememberCues();
    c.start=start;c.end=splitAt;c.text=first.text;c.colorRanges=first.ranges;c.captionGap=false;
    const next={...cloneProjectData(c),id:uid(),start:splitAt,end,text:second.text,colorRanges:second.ranges,captionGap:false,mediaOffset:base+firstDuration};
    cues.splice(index+1,0,next);
    commitCaptionChange(index);toast('자막을 두 구간으로 나눴습니다.');return true;
  },
  mergeNext(index){
    const c=cues[index],next=cues[index+1],seg=captionSegmentInfo(index);if(!c||!next||index>=seg.last)return false;
    const end=Number(next.end);if(!Number.isFinite(end)){toast('다음 자막 시간 정보가 올바르지 않아 합칠 수 없습니다.');return false;}rememberCues();c.end=end;c.colorRanges=CaptionRanges.merge(c,next);c.text=[c.text,next.text].filter(Boolean).join('\n');c.captionGap=!c.text.trim();cues.splice(index+1,1);commitCaptionChange(index);return true;
  },
  remove(index){
    const c=cues[index];if(!c)return false;rememberCues();const seg=captionSegmentInfo(index);
    if(seg.count>1){c.text='';c.colorRanges=[];c.captionGap=true;}
    else{const duration=c.end-c.start,sceneId=c.sceneId;cues.splice(index,1);if(c.freeEdit){const si=scenes.findIndex(s=>s.id===sceneId);if(si>=0){const [removed]=scenes.splice(si,1);releaseSceneResources(removed);}for(let j=index;j<cues.length;j++){cues[j].start-=duration;cues[j].end-=duration;}}}
    commitCaptionChange(Math.min(index,cues.length-1));return true;
  }
};
window.CutflowExport={start:exportVideo,cancel(){if(window.currentExport){window.currentExport.cancelled=true;CutEncoder.cancel();$('exportStatus').textContent='취소하는 중…';return true;}return false;},get busy(){return exporting}};
$('exportBtn').onclick=exportVideo;$('cancelExportBtn').onclick=()=>window.CutflowExport.cancel();$('closeExportBtn').onclick=()=>$('exportDialog').close();$('exportDialog').addEventListener('cancel',e=>{if(exporting){e.preventDefault();$('cancelExportBtn').click();}});

const savedControlIds=['scriptInput','projectCaptionWrap','layoutSelect','titleInput','titleFont','titleSize','titleColor','titleBold','titleItalic','titleStrokeEnabled','titleStrokeWidth','titleX','titleY','channelInput','channelFont','channelSize','channelColor','channelBold','channelItalic','channelStrokeEnabled','channelStrokeWidth','channelX','channelY','fitSelect','templateSelect','resolutionSelect'];
function captureControls(){const out={};for(const id of savedControlIds){const el=$(id);if(!el)continue;out[id]=el.type==='checkbox'?el.checked:el.value;}return out;}
function restoreControls(values={}){for(const [id,value] of Object.entries(values)){const el=$(id);if(!el)continue;if(el.type==='checkbox')el.checked=!!value;else el.value=value;}lastTitleText=$('titleInput').value||'';$('fitSelect').disabled=$('layoutSelect').value==='fullscreen';$('layoutDescription').textContent=$('layoutSelect').value==='framed'?'노란 제목 · 중앙 이미지 · 하단 자막과 채널명':$('layoutSelect').value==='fullscreen'?'이미지·영상 전체 채우기 · 자막 오버레이':'노란 제목 · 세로 확장 영상 · 강조 자막과 채널명';}
function cleanSceneState(scene){const {id,name,type,sourceDuration,trimStart,trimEnd,duration,motion,transition,transform,mediaVolume,mediaMuted,mediaFadeIn,mediaFadeOut}=scene;return {id,name,type,sourceDuration,trimStart,trimEnd:trimEnd??sourceDuration,duration,motion,transition,transform,mediaVolume:mediaVolume??0,mediaMuted:!!mediaMuted,mediaFadeIn:mediaFadeIn??0,mediaFadeOut:mediaFadeOut??0};}
function mediaBytes(){const bgm=window.bgmSnapshot?.();return scenes.reduce((n,s)=>n+(s.file?.size||0),0)+(audioFile?.size||0)+(bgm?.file?.size||0);}
async function clearProjectMedia(){pause();for(const s of scenes)releaseSceneResources(s);scenes=[];cues=[];if(audioUrl)URL.revokeObjectURL(audioUrl);audioUrl=null;audioBuffer=null;audioFile=null;audioName='';$('narration').removeAttribute('src');$('narration').load();silences=[];envelope=[];timingAnalysis=null;window.CutflowTimingData=null;await window.restoreBgmSnapshot?.(null,{silent:true});}
const cloneProjectData=value=>{if(value==null)return value;try{if(typeof structuredClone==='function')return structuredClone(value);}catch{}return JSON.parse(JSON.stringify(value));};
function autoWrapCaptionText(text,style={}){
  const raw=String(text||'').replace(/\s*\n\s*/g,' ').replace(/\s+/g,' ').trim();
  if(!raw||!raw.includes(' '))return raw;
  const canvas=autoWrapCaptionText.canvas||(autoWrapCaptionText.canvas=document.createElement('canvas'));
  const ctx=canvas.getContext('2d'),fontInfo=window.CutFonts?.get(style.font||'noto');
  const family=fontInfo?.family||'Noto Sans KR',nativeWeight=fontInfo?.file?400:(style.bold===false?400:900),size=Number(style.size)||66;
  ctx.font=`${style.italic?'italic ':''}${nativeWeight} ${size}px "${family}", sans-serif`;
  const clean=v=>v.replace(/\[\[|\]\]/g,'');
  const width=v=>ctx.measureText(clean(v)).width;
  const maxWidth=1080*.86,fullWidth=width(raw);
  if(fullWidth<=maxWidth)return raw;
  const words=raw.split(' ');let best=null;
  for(let i=1;i<words.length;i++){
    const a=words.slice(0,i).join(' '),b=words.slice(i).join(' '),wa=width(a),wb=width(b);
    if(wa>maxWidth||wb>maxWidth)continue;
    const score=Math.abs(wa-wb)+Math.max(wa,wb)*.08;
    if(!best||score<best.score)best={a,b,score};
  }
  return best?`${best.a}\n${best.b}`:raw;
}
async function autoWrapCaptions(){
  try{await CutRenderer.fonts(project());}catch{}
  let changedCount=0;
  for(const cue of cues){const style=CaptionStyle.resolve(cue,project()),next=autoWrapCaptionText(cue.text,style);if(next!==cue.text){cue.text=next;changedCount++;}}
  if(changedCount){changed();renderCues();}
  return changedCount;
}

const composeState=()=>({layout:$('layoutSelect').value,title:$('titleInput').value,channel:$('channelInput').value,fit:$('fitSelect').value,motionPreset:$('templateSelect').value,fitDisabled:$('fitSelect').disabled});
window.CutflowCompose={
  update(patch={}){
    const map={layout:'layoutSelect',title:'titleInput',channel:'channelInput',fit:'fitSelect',motionPreset:'templateSelect'};
    for(const [key,id] of Object.entries(map)){
      if(patch[key]==null)continue;const el=$(id);if(!el)continue;el.value=String(patch[key]);
      el.dispatchEvent(new Event(key==='motionPreset'?'change':'input',{bubbles:true}));
    }
    const state=composeState();
    if(typeof CustomEvent==='function')window.dispatchEvent(new CustomEvent('cutflow-compose-updated',{detail:{state}}));
    return state;
  }
};

window.CutflowAutoBridge={
  scriptLines,
  async autoWrapCaptions(){return autoWrapCaptions();},
  async loadNarration(file){return loadAudio(file);},
  async processNarration(preset='normal',onProgress){if(!audioFile)throw new Error('먼저 내레이션을 불러오세요.');if(!window.CutflowSilenceCut?.process)throw new Error('무음컷 엔진을 불러오지 못했습니다.');const result=await window.CutflowSilenceCut.process(audioFile,preset,onProgress);if(!await loadAudio(result.processedFile))throw new Error('무음컷 결과 음성을 불러오지 못했습니다.');return result;},
  async addMedia(files){const added=await addFiles(files,{createFreeCues:false});return added.length;},
  buildTimeline(){buildCues();if(cues.length&&scenes.length)fitCuts(false);const missingSceneCount=cues.filter(c=>!scenes.some(s=>s.id===c.sceneId)).length;return {cueCount:cues.length,sceneCount:scenes.length,missingSceneCount};},
  counts(){return {sceneCount:scenes.length,cueCount:cues.length,scriptCount:scriptLines($('scriptInput').value).length,missingSceneCount:cues.filter(c=>!scenes.some(s=>s.id===c.sceneId)).length};},
  async clearScenesOnly(){pause();for(const s of scenes)releaseSceneResources(s);scenes=[];cues.forEach(c=>{c.sceneId=null;});offset=0;renderCues();changed();},
  markChanged(){changed();},
  toast
};

window.CutflowProjectBridge={
  capture(){return {schemaVersion:1,controls:captureControls(),titleColorRanges:cloneProjectData(titleColorRanges),cues:cloneProjectData(cues),scenes:scenes.map(s=>({meta:cleanSceneState(s),file:s.file})),narration:audioFile?{file:audioFile,name:audioName}:null,bgm:window.bgmSnapshot?.()||null,playhead:currentTime(),estimatedMediaBytes:mediaBytes()};},
  async restore(data,options={}){if(!data||data.schemaVersion!==1)throw new Error('지원하지 않는 프로젝트 형식입니다.');loading++;stats();try{await clearProjectMedia();restoreControls(data.controls);titleColorRanges=cloneProjectData(data.titleColorRanges||[]);lastTitleText=$('titleInput').value||'';for(const saved of data.scenes||[]){if(!saved?.file)continue;const file=saved.file instanceof File?saved.file:new File([saved.file],saved.meta?.name||'media',{type:saved.file.type||''});const scene=await makeScene(file);Object.assign(scene,saved.meta||{});scene.file=file;scenes.push(scene);}cues=cloneProjectData(data.cues||[]);normalizeSceneSettingsFromCues();assignAvailableCuts();if(data.narration?.file){const f=data.narration.file instanceof File?data.narration.file:new File([data.narration.file],data.narration.name||'narration.wav',{type:data.narration.file.type||'audio/wav'});await loadAudio(f,{commit:false,notify:false});}await window.restoreBgmSnapshot?.(data.bgm||null,{silent:true});offset=Math.max(0,Math.min(Number(data.playhead)||0,totalDuration()));renderCues();waveform(offset);window.syncTextStyleNotes?.();await CutRenderer.fonts(project());dirty=true;if(typeof CustomEvent==='function')window.dispatchEvent(new CustomEvent('cutflow-project-restored',{detail:{history:!!options.history,sceneCount:scenes.length,cueCount:cues.length,playhead:offset,narration:!!audioBuffer,bgm:!!window.bgmProject?.().buffer}}));return true;}finally{loading--;stats();}},
  hasWork(){return !!(scenes.length||audioBuffer||window.bgmProject?.().buffer||$('scriptInput').value||$('titleInput').value);},
  nameSuggestion(){return ($('titleInput').value||'').replace(/\s+/g,' ').trim().slice(0,60)||`Cutflow ${new Date().toLocaleDateString('ko-KR')}`;},
  summary(){return {sceneCount:scenes.length,duration:totalDuration(),title:$('titleInput').value||'',mediaBytes:mediaBytes()};}
};

document.addEventListener('keydown',e=>{const active=document.activeElement,editable=!!active&&(active.isContentEditable||['INPUT','TEXTAREA','SELECT','BUTTON'].includes(active.tagName));const saveKey=(e.ctrlKey||e.metaKey)&&!e.altKey&&String(e.key).toLowerCase()==='s';if(saveKey){e.preventDefault();window.CutflowProjects?.save?.();return;}if(editable||exporting||e.ctrlKey||e.metaKey||e.altKey)return;if(e.code==='Space'){e.preventDefault();playing?pause():play();return;}if(e.key==='ArrowLeft'){e.preventDefault();navigateCut(-1);return;}if(e.key==='ArrowRight'){e.preventDefault();navigateCut(1);}});
window.addEventListener('beforeunload',e=>{const savedState=window.CutflowProjects?.dirty;if(savedState===true||(savedState==null&&(scenes.length||audioBuffer||window.bgmProject?.().buffer))){e.preventDefault();e.returnValue='';}});
document.fonts.ready.then(()=>dirty=true);document.fonts.addEventListener('loadingdone',()=>dirty=true);
renderCues();waveform();requestAnimationFrame(tick);
