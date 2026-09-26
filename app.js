const $=id=>document.getElementById(id);
const motionLabels={still:'고정','zoom-in':'줌 인','zoom-out':'줌 아웃','pan-left':'오른쪽 → 왼쪽 이동','pan-right':'왼쪽 → 오른쪽 이동','pan-up':'아래 → 위 이동','pan-down':'위 → 아래 이동','zoom-in-slow':'느린 줌인','zoom-in-fast':'빠른 줌인','zoom-in-strong':'강한 줌인','zoom-out-slow':'느린 줌아웃','zoom-out-fast':'빠른 줌아웃','zoom-pan-right':'줌인 + 오른쪽 이동','zoom-pan-left':'줌인 + 왼쪽 이동','punch-hold':'빠르게 확대 후 유지'};
const transitionLabels={cut:'하드 컷',dissolve:'디졸브',fade:'블랙 페이드',flash:'화이트 플래시',slide:'슬라이드'};
const rhythms={reference:{motions:['zoom-in','still','zoom-out','still','pan-left','pan-right'],transitions:['cut']},balanced:{motions:['zoom-in','pan-right','zoom-out','pan-left','pan-up','pan-down'],transitions:['cut','dissolve']},calm:{motions:['zoom-in','pan-right','zoom-out','pan-left'],transitions:['dissolve','fade']},impact:{motions:['zoom-in','pan-left','zoom-out','pan-right'],transitions:['cut','flash','cut','slide']}};
let scenes=[],cues=[],audioBuffer=null,audioUrl=null,audioName='',silences=[],envelope=[],cueHistory=[];
let playRequest=0;
let offset=0,started=0,playing=false,rendering=false,dirty=true,exporting=false,loading=0,dragIndex=null,lastActive=-1,lastCue=-1,downloadUrl=null;
const uid=()=>crypto.randomUUID?.()||Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const options=(map,value)=>Object.entries(map).map(([k,v])=>`<option value="${k}" ${k===value?'selected':''}>${v}</option>`).join('');
// Imported media stay reusable; each subtitle owns its exact playback interval.
function assignAvailableCuts(){const used=new Set(cues.map(c=>c.sceneId));const available=scenes.filter(s=>!used.has(s.id));cues.forEach(c=>{if(c.sceneId===undefined&&available.length)c.sceneId=available.shift().id;});}
function timelineScenes(){return cues.length?cues.map((c,i)=>{const sourceIndex=scenes.findIndex(s=>s.id===c.sceneId),s=scenes[sourceIndex];return {...(s||{type:'missing',motion:'still',transition:'cut'}),transform:c.transform??s?.transform,motion:c.motion??s?.motion??'still',transition:c.transition??s?.transition??'cut',trimStart:(c.trimStart??s?.trimStart??0)+(c.mediaOffset||0),start:c.start,end:c.end,duration:c.end-c.start,cueIndex:i,sourceIndex};}):scenes;}
const cutDuration=()=>CutRenderer.cutDuration(timelineScenes());
const totalDuration=()=>Math.max(cutDuration(),audioBuffer?.duration||0,...cues.map(c=>c.end),0);
const sceneStart=index=>cues.length?(cues.find(c=>c.sceneId===scenes[index]?.id)?.start||0):scenes.slice(0,index).reduce((n,s)=>n+s.duration,0);
const timeText=t=>`${Math.floor(Math.max(0,t)/60)}:${(Math.max(0,t)%60).toFixed(1).padStart(4,'0')}`;
const currentTime=()=>playing?Math.min(totalDuration(),offset+(window.CutAudio?CutAudio.elapsed():(performance.now()-started)/1000)):offset;
let toastTimer;
function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),4500);}
function project(){return {titleStrokeEnabled:$('titleStrokeEnabled').checked,titleStrokeWidth:Math.max(0,Math.min(18,Number($('titleStrokeWidth').value)||0)),channelStrokeEnabled:$('channelStrokeEnabled').checked,channelStrokeWidth:Math.max(0,Math.min(18,Number($('channelStrokeWidth').value)||0)),bgm:window.bgmProject?.(),channelSize:Number($('channelSize').value)||43.2,channelItalic:$('channelItalic').checked,channelBold:$('channelBold').checked,channelColor:$('channelColor').value||'#dddddd',titleSize:Number($('titleSize').value)||86.4,titleItalic:$('titleItalic').checked,titleBold:$('titleBold').checked,titleColor:$('titleColor').value||'#ffe22e',titleFont:$('titleFont').value||'noto',channelFont:$('channelFont').value||'noto',scenes:timelineScenes(),cues,title:$('titleInput').value,channel:$('channelInput').value,layout:$('layoutSelect').value,fit:$('fitSelect').value,duration:totalDuration(),audioBuffer};}
function rememberCues(){cueHistory.push(structuredClone(cues));if(cueHistory.length>30)cueHistory.shift();$('undoCuesBtn').disabled=false;}
function repeatFlags(){const flags=new Set(),items=timelineScenes();items.forEach((s,i)=>{if(s.motion==='still')return;if(i&&s.motion===items[i-1].motion){flags.add(i);flags.add(i-1);}const hits=items.slice(Math.max(0,i-3),i+1).map((x,j)=>({x,j:Math.max(0,i-3)+j})).filter(x=>x.x.motion===s.motion);if(hits.length>=3)hits.forEach(x=>flags.add(x.j));});return flags;}
function changed(){dirty=true;stats();window.syncBgm?.();}
function stats(){
  const duration=totalDuration(),flags=repeatFlags();$('sceneCount').textContent=`${scenes.length} 컷`;$('totalDuration').textContent=`${duration.toFixed(2)}초`;$('endTime').textContent=timeText(duration);
  $('repeatCount').textContent=flags.size?`${flags.size}개 확인`:'없음';$('repeatCount').className=flags.size?'warn':'safe';
  const missing=cues.filter(c=>!scenes.some(s=>s.id===c.sceneId)).length;
  $('exportBtn').disabled=!scenes.length||missing>0||loading>0||exporting;
  $('audioStatus').textContent=audioBuffer?`${audioName} · ${audioBuffer.duration.toFixed(2)}초`:'오디오 없음';
  const delta=audioBuffer?cutDuration()-audioBuffer.duration:0;
  $('timingNotice').textContent=!audioBuffer?(window.bgmProject?.().buffer?'내레이션 없이 BGM만 포함해 MP4를 저장합니다.':'오디오 없이도 무음 MP4를 저장할 수 있습니다.'):Math.abs(delta)<.05?'컷 길이와 내레이션 길이가 일치합니다.':delta<0?`컷이 내레이션보다 ${(-delta).toFixed(2)}초 짧아 마지막 프레임을 유지합니다.`:`컷이 내레이션보다 ${delta.toFixed(2)}초 깁니다. 남은 구간은 무음입니다.`;
  if(cues.length)$('timingNotice').textContent=missing?`${missing}개 자막에 컷이 없습니다. 해당 구간에서 사용할 컷을 선택해 주세요.`:'자막 시작·종료와 연결된 컷 시간이 자동으로 일치합니다. 자막 사이 빈 구간에는 컷이 표시되지 않습니다.';
  $('randomMotionBtn').disabled=!scenes.some(s=>s.type==='image');
  $('fitCutsBtn').disabled=!scenes.length; $('applyTemplateBtn').disabled=!scenes.length;
}
function renderScenes(){
  const flags=repeatFlags();
  $('sceneList').hidden=!!cues.length;
  $('sceneList').innerHTML=cues.length?'':scenes.length?scenes.map((s,i)=>`<article class="scene-row ${flags.has(i)?'repeat':''}" data-index="${i}" draggable="true"><span class="drag-handle" title="끌어서 순서 변경">⋮⋮</span><img class="scene-thumb" src="${s.thumb}" alt="컷 ${i+1}"><div class="scene-meta"><strong>${String(i+1).padStart(2,'0')} · ${esc(s.name)}</strong><span>${s.type==='video'?'영상':'이미지'} · ${cues.length?(cues.filter(c=>c.sceneId===s.id).map(c=>`자막 ${cues.indexOf(c)+1}: ${c.start.toFixed(2)}–${c.end.toFixed(2)}초`).join(' / ')||'연결된 자막 없음'):`${sceneStart(i).toFixed(2)}초부터`}</span>${flags.has(i)?'<span class="repeat-tag">움직임 반복</span>':''}</div><div class="control-group duration-control"><label for="dur-${s.id}">${cues.length?'자막 연동 (초)':'컷 길이 (초)'}</label><input id="dur-${s.id}" data-action="duration" type="number" min="0.1" max="600" step="0.01" value="${(cues.length?cues.filter(c=>c.sceneId===s.id).reduce((n,c)=>n+c.end-c.start,0):s.duration).toFixed(2)}" ${cues.length?'readonly title="자막의 시작·종료 시간을 수정하면 자동으로 바뀝니다."':''}></div><div class="control-group motion-control"><label for="motion-${s.id}">움직임</label><select id="motion-${s.id}" data-action="motion">${options(motionLabels,s.motion)}</select></div><div class="control-group transition-control"><label for="trans-${s.id}">진입 전환</label><select id="trans-${s.id}" data-action="transition">${options(transitionLabels,s.transition)}</select></div><div class="row-actions"><button class="row-action" data-action="preview" aria-label="컷 ${i+1} 재생">▶</button><button class="row-action danger" data-action="delete" aria-label="컷 ${i+1} 삭제">×</button></div><div class="clip-extra">${s.type==='video'?`<label>원본 시작 <input data-action="trim" aria-label="컷 ${i+1} 원본 시작" type="number" min="0" max="${Math.max(0,s.sourceDuration-.04).toFixed(2)}" step="0.01" value="${s.trimStart.toFixed(2)}"> 초</label><span>원본 ${s.sourceDuration.toFixed(2)}초${s.trimStart+(cues.length?Math.max(0,...cues.filter(c=>c.sceneId===s.id).map(c=>c.end-c.start+(c.mediaOffset||0))):s.duration)>s.sourceDuration+.02?' · 끝 프레임 유지':''}</span>`:''}<button class="row-action" data-action="up" aria-label="컷 ${i+1} 위로" ${i===0?'disabled':''}>↑</button><button class="row-action" data-action="down" aria-label="컷 ${i+1} 아래로" ${i===scenes.length-1?'disabled':''}>↓</button></div></article>`).join(''):'<div class="empty-list">이미지 또는 영상 컷을 추가해 주세요.</div>';
  $('miniTimeline').innerHTML=timelineScenes().map((s,i)=>`<button class="mini-block ${flags.has(i)?'repeat':''}" data-index="${cues.length?s.sourceIndex:i}" data-time="${cues.length?s.start:sceneStart(i)}" style="width:${Math.max(30,s.duration*16)}px;background-image:url('${s.thumb||''}')" aria-label="${cues.length?'자막':'컷'} ${i+1}으로 이동"></button>`).join('');lastActive=-1;changed();
}
function captionColorOptions(c){const color=window.CaptionStyle?.resolve(c,project()).color||({white:'#ffffff',yellow:'#eeff00'}[c.color]||c.color);const map={'#ffffff':'흰색','#eeff00':'노란색','#b8ff38':'연두색','#70d6ff':'하늘색','#ff4949':'빨간색','#ff982f':'주황색'};if(!map[color])map[color]='직접 선택 색상';return options(map,color);}
function renderCues(){
  assignAvailableCuts();
  const timeline=timelineScenes(),flags=repeatFlags();
  $('cueList').hidden=!cues.length;
  $('cueList').innerHTML=cues.map((c,i)=>{
    const media=timeline[i],s=scenes[media.sourceIndex];
    return `<article class="cue-row editor-row ${flags.has(i)?'repeat':''}" data-index="${i}" aria-label="구간 ${i+1}">
      <div class="editor-row-heading">${s?`<img class="editor-thumb" src="${s.thumb}" alt="구간 ${i+1} 컷 미리보기">`:'<span class="editor-missing">컷 없음</span>'}<div><strong>구간 ${String(i+1).padStart(2,'0')}</strong><span>${c.start.toFixed(2)}–${c.end.toFixed(2)}초 · ${(c.end-c.start).toFixed(2)}초</span></div>${flags.has(i)?'<span class="repeat-tag">움직임 반복</span>':''}<button data-action="jump" class="button ghost small">구간 재생</button></div>
      <div class="editor-start"><label for="start-${c.id}">시작 (초)</label><input id="start-${c.id}" data-action="start" type="number" min="0" step="0.01" value="${c.start.toFixed(2)}"></div>
      <div class="editor-end"><label for="end-${c.id}">종료 (초)</label><input id="end-${c.id}" data-action="end" type="number" min="0.1" step="0.01" value="${c.end.toFixed(2)}"></div>
      <div class="editor-color"><label for="color-${c.id}">색상 · 이 구간</label><select id="color-${c.id}" data-action="color">${captionColorOptions(c)}</select></div>
      <div class="editor-text"><label for="text-${c.id}">자막 · [[강조]] 지원</label><textarea id="text-${c.id}" data-action="text" rows="2" maxlength="240">${esc(c.text)}</textarea><div class="selection-color-tools"><label>선택 글자색 <input type="color" data-action="selection-color" value="#eeff00" aria-label="구간 ${i+1} 선택 글자색"></label><button type="button" data-action="selection-apply">선택 글자에 적용</button><button type="button" data-action="selection-reset">선택 색상 해제</button><span class="field-help">자막에서 글자를 드래그한 뒤 적용하세요.</span></div></div>
      <div class="editor-media"><label for="media-${c.id}">이미지·영상</label><select id="media-${c.id}" data-action="media"><option value="">컷을 선택해 주세요</option>${scenes.map((source,j)=>`<option value="${source.id}" ${source.id===c.sceneId?'selected':''}>${j+1} · ${esc(source.name)}</option>`).join('')}</select></div>
      <div class="editor-motion"><label for="motion-${c.id}">움직임</label><select id="motion-${c.id}" data-action="motion" ${s?'':'disabled'}>${options(motionLabels,media.motion)}</select></div>
      <div class="editor-transition"><label for="transition-${c.id}">진입 전환</label><select id="transition-${c.id}" data-action="transition" ${s?'':'disabled'}>${options(transitionLabels,media.transition)}</select></div>
      ${s?.type==='video'?`<div class="editor-trim"><label for="trim-${c.id}">영상 원본 시작 (초)</label><input id="trim-${c.id}" data-action="trim" type="number" min="0" max="${Math.max(0,s.sourceDuration-.04).toFixed(2)}" step="0.01" value="${media.trimStart.toFixed(2)}"><span>원본 ${s.sourceDuration.toFixed(2)}초${media.trimStart+media.duration>s.sourceDuration+.02?' · 끝 프레임 유지':''}</span></div>`:''}
      <div class="cue-actions editor-actions"><button data-action="style">자막 스타일</button><button data-action="split">나누기</button><button data-action="merge" ${i===cues.length-1?'disabled':''}>다음과 합치기</button><button data-action="delete">구간 삭제</button></div>
    </article>`;
  }).join('');
  lastCue=-1;renderScenes();changed();window.syncStyleEditor?.();
}
function pause(){playRequest++;if(playing)offset=currentTime();playing=false;window.CutAudio?.stop();$('narration').pause();$('playBtn').textContent='▶';$('playBtn').setAttribute('aria-label','재생');dirty=true;}
async function play(){
  if(playing){pause();return;}if(exporting||loading)return;
  if(!totalDuration()){toast('먼저 컷이나 내레이션을 불러와 주세요.');return;}
  if(offset>=totalDuration()-.01)offset=0;
  const request=++playRequest;
  try{await CutAudio.unlock();const mixed=await CutAudio.mix(project());if(request!==playRequest||exporting)return;CutAudio.start(mixed,offset);}
  catch{toast('오디오를 재생하지 못했습니다. 재생 버튼을 다시 눌러 주세요.');return;}
  started=performance.now();playing=true;$('playBtn').textContent='Ⅱ';$('playBtn').setAttribute('aria-label','일시정지');
}
const desktopNavigation=()=>window.matchMedia?.('(min-width: 761px)').matches===true;
function selectNavigationCue(index,scroll=false){
  const cue=cues[index];if(!cue||exporting)return;
  jump(cue.start);
  document.querySelectorAll('.cue-row').forEach(row=>{
    const selected=Number(row.dataset.index)===index;
    row.classList.toggle('active',selected);
    if(selected&&scroll)row.scrollIntoView({behavior:'smooth',block:'center',inline:'nearest'});
  });
  lastCue=index;
  window.selectStyleCue?.(index);
  const sourceIndex=scenes.findIndex(scene=>scene.id===cue.sceneId);
  $('nowPlaying').textContent=`자막 ${index+1} · 컷 ${sourceIndex+1}`;
}
function navigateCut(direction){
  if(desktopNavigation()&&cues.length){
    const time=currentTime(),active=cues.findIndex(c=>time>=c.start&&time<c.end);
    let index;
    if(active>=0)index=Math.max(0,Math.min(cues.length-1,active+direction));
    else if(direction>0){index=cues.findIndex(c=>c.start>time);if(index<0)index=cues.length-1;}
    else{index=cues.findLastIndex(c=>c.start<time);if(index<0)index=0;}
    selectNavigationCue(index,true);return;
  }
  const starts=cues.length?cues.map(c=>c.start):scenes.map((s,i)=>sceneStart(i));const time=currentTime();const next=direction>0?starts.find(t=>t>time+.01):starts.filter(t=>t<time-.01).at(-1);jump(next??(direction>0?totalDuration():0));
}
function jump(time){pause();offset=Math.max(0,Math.min(totalDuration(),time));if(audioBuffer)$('narration').currentTime=Math.min(offset,audioBuffer.duration);dirty=true;}
async function tick(){
  const time=currentTime();
  if(playing&&time>=totalDuration()){pause();offset=totalDuration();}
  if(!exporting&&!rendering&&(dirty||playing)){
    rendering=true;dirty=false;
    try{await CutRenderer.draw($('stage'),project(),time);}catch(error){pause();toast(error.message);}finally{rendering=false;}
    $('currentTime').textContent=timeText(time);$('scrubber').value=totalDuration()?1000*time/totalDuration():0;
    const timeline=timelineScenes(),found=CutRenderer.locate(timeline,time),active=timeline[found.index];const loc={index:cues.length?(active?.sourceIndex??-1):found.index};$('nowPlaying').textContent=loc.index<0?'장면 없음':cues.length?`자막 ${active.cueIndex+1} · 컷 ${loc.index+1}`:`컷 ${loc.index+1} / ${scenes.length}`;
    if(loc.index!==lastActive){document.querySelectorAll('.scene-row,.mini-block').forEach(el=>el.classList.toggle('active',Number(el.dataset.index)===loc.index));lastActive=loc.index;}
    const cueIndex=cues.findIndex(c=>time>=c.start&&time<c.end);if(cueIndex!==lastCue){document.querySelectorAll('.cue-row').forEach(el=>el.classList.toggle('active',Number(el.dataset.index)===cueIndex));lastCue=cueIndex;}
    waveform(time);
  }
  requestAnimationFrame(tick);
}
function waveform(time=0){const canvas=$('waveform'),ctx=canvas.getContext('2d');ctx.clearRect(0,0,720,100);ctx.fillStyle='#687541';for(let i=0;i<envelope.length;i++){const amp=Math.max(1,envelope[i]*42);ctx.fillRect(i*720/envelope.length,50-amp,Math.max(1,720/envelope.length-1),amp*2);}if(audioBuffer){ctx.fillStyle='#e8693d';ctx.fillRect(Math.min(718,time/audioBuffer.duration*720),0,2,100);}}
function analyzeAudio(buffer){
  const data=buffer.getChannelData(0),sr=buffer.sampleRate,hop=Math.max(1,Math.floor(sr*.02));const rms=[];let peak=0;
  for(let i=0;i<data.length;i+=hop){let sum=0;for(let j=i;j<Math.min(data.length,i+hop);j++)sum+=data[j]*data[j];const v=Math.sqrt(sum/hop);rms.push(v);peak=Math.max(peak,v);}
  const threshold=Math.max(.001,peak*.07);silences=[];let begin=null;
  rms.forEach((v,i)=>{if(v<threshold){if(begin===null)begin=i*.02;}else if(begin!==null){if(i*.02-begin>=.14)silences.push((begin+i*.02)/2);begin=null;}});
  envelope=Array.from({length:360},(_,i)=>{const from=Math.floor(i*rms.length/360),to=Math.max(from+1,Math.floor((i+1)*rms.length/360));return Math.max(...rms.slice(from,to),0)/(peak||1);});
}
async function loadAudio(file){
  if(!file)return;pause();loading++;stats();$('audioStatus').textContent='오디오 읽는 중…';let context;
  try{context=new AudioContext();const decoded=await context.decodeAudioData(await file.arrayBuffer());if(!Number.isFinite(decoded.duration)||decoded.duration<=0)throw new Error('오디오 길이를 확인할 수 없습니다.');
    if(audioUrl)URL.revokeObjectURL(audioUrl);audioUrl=URL.createObjectURL(file);audioBuffer=decoded;audioName=file.name;$('narration').src=audioUrl;analyzeAudio(decoded);offset=0;toast('오디오를 불러왔습니다. 대본으로 자막 구간을 만들어 주세요.');
  }catch{toast('오디오를 읽지 못했습니다. MP3 또는 WAV 파일로 다시 시도해 주세요.');}finally{await context?.close();loading--;changed();waveform();$('audioInput').value='';}
}
function scriptLines(text){let lines=text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);if(lines.length===1)lines=lines[0].split(/(?<=[.!?。！？])\s+/).filter(Boolean);return lines.flatMap(line=>{if(line.length<=100)return [line];const result=[];while(line.length>100){let at=line.lastIndexOf(' ',90);if(at<30)at=80;result.push(line.slice(0,at).trim());line=line.slice(at).trim();}if(line)result.push(line);return result;});}
function buildCues(){
  const lines=scriptLines($('scriptInput').value);if(!audioBuffer||!lines.length){toast('대본과 내레이션 오디오를 모두 넣어 주세요.');return;}
  if(lines.length>audioBuffer.duration/.1){toast('자막 구간이 너무 많습니다. 대본의 줄 수를 줄여 주세요.');return;}
  pause();rememberCues();const inheritedStyle=window.newCueStyle?.()||{};const total=audioBuffer.duration,weights=lines.map(s=>Math.max(1,s.replace(/\[\[|\]\]|\s/g,'').length)),sum=weights.reduce((a,b)=>a+b,0);let weight=0,last=0;
  cues=lines.map((text,i)=>{weight+=weights[i];let end=i===lines.length-1?total:total*weight/sum;
    if(i<lines.length-1){const near=silences.filter(t=>t>last+.12&&Math.abs(t-end)<Math.min(.8,total/lines.length*.35)).sort((a,b)=>Math.abs(a-end)-Math.abs(b-end));if(near.length)end=near[0];}
    end=Math.max(last+.1,Math.min(total-(lines.length-i-1)*.1,end));const cue={id:uid(),start:last,end,text,color:'white',...structuredClone(inheritedStyle)};last=end;return cue;});
  offset=0;renderCues();toast('자막 시간 초안을 만들었습니다. 음성을 들으며 조정해 주세요.');
}
function fitCuts(message=true){
  if(!scenes.length)return;pause();if(cues.length){rememberCues();cues.forEach((c,i)=>{c.sceneId=scenes[i]?.id;c.mediaOffset=0;});renderCues();}else if(audioBuffer){scenes.forEach(s=>s.duration=audioBuffer.duration/scenes.length);renderScenes();}offset=0;if(message)toast('자막 1개에 컷 1개씩 순서대로 연결했습니다. 부족한 컷은 해당 구간에서 선택해 주세요.');
}
function waitMedia(element,event){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>finish(new Error('파일을 읽는 시간이 초과되었습니다.')),15000);const ok=()=>finish(),bad=()=>finish(new Error('브라우저에서 재생할 수 없는 파일입니다.'));function finish(error){clearTimeout(timer);element.removeEventListener(event,ok);element.removeEventListener('error',bad);error?reject(error):resolve();}element.addEventListener(event,ok,{once:true});element.addEventListener('error',bad,{once:true});});}
async function makeScene(file){
  const video=file.type.startsWith('video/')||/\.(mp4|mov|webm|m4v)$/i.test(file.name),url=URL.createObjectURL(file);const element=video?document.createElement('video'):new Image();
  try{if(video){element.muted=true;element.playsInline=true;element.preload='auto';}const ready=waitMedia(element,video?'loadeddata':'load');element.src=url;await ready;
    const sourceDuration=video?element.duration:0;if(video&&(!Number.isFinite(sourceDuration)||sourceDuration<=0))throw new Error('유효한 영상 길이가 아닙니다.');
    const canvas=document.createElement('canvas');canvas.width=120;canvas.height=90;canvas.getContext('2d').drawImage(element,0,0,120,90);
    return {id:uid(),name:file.name,url,element,type:video?'video':'image',sourceDuration,trimStart:0,duration:video?Math.min(2.4,sourceDuration):2.4,motion:'still',transition:'cut',thumb:canvas.toDataURL('image/jpeg',.65)};
  }catch(error){URL.revokeObjectURL(url);throw error;}
}
async function addFiles(files){
  const list=[...files].filter(f=>/^image\/|^video\//.test(f.type)||/\.(mp4|mov|webm|m4v)$/i.test(f.name));if(!list.length){toast('이미지 또는 영상 파일을 선택해 주세요.');return;}
  pause();loading++;stats();let success=0,errors=[];
  for(const file of list){try{const scene=await makeScene(file);const rhythm=rhythms[$('templateSelect').value];scene.motion=scene.type==='image'?rhythm.motions[scenes.length%rhythm.motions.length]:'still';scenes.push(scene);success++;}catch{errors.push(file.name);}}
  loading--;renderCues();$('fileInput').value='';toast(`${success}개 컷을 추가했습니다.${errors.length?' 읽기 실패: '+errors.join(', '):''}`);
}
function moveScene(from,to){if(to<0||to>=scenes.length)return;pause();const [scene]=scenes.splice(from,1);scenes.splice(to,0,scene);if(cues.length)fitCuts(false);offset=sceneStart(to);renderScenes();}
async function demo(){
  if(loading)return;loading++;stats();
  for(let i=0;i<4;i++){const canvas=document.createElement('canvas');canvas.width=600;canvas.height=900;const ctx=canvas.getContext('2d');const colors=['#244663','#674552','#526044','#61507b'];ctx.fillStyle=colors[i];ctx.fillRect(0,0,600,900);ctx.fillStyle='#f2d998';ctx.beginPath();ctx.arc(420,200,100,0,Math.PI*2);ctx.fill();ctx.fillStyle='#142930';ctx.beginPath();ctx.moveTo(0,620);ctx.lineTo(220,450);ctx.lineTo(600,800);ctx.lineTo(600,900);ctx.lineTo(0,900);ctx.fill();const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));scenes.push(await makeScene(new File([blob],`sample_${i+1}.png`,{type:'image/png'})));}
  if(!$('titleInput').value)$('titleInput').value='나만의 쇼츠 제목\n지금 만들어 보세요';if(!$('scriptInput').value)$('scriptInput').value='대본과 오디오를 함께 넣으세요.\n자막 시간을 자유롭게 조정하세요.\n이미지와 영상을 섞어 편집하세요.\n완성한 쇼츠를 MP4로 저장하세요.';
  if(!cues.length){rememberCues();cues=scriptLines($('scriptInput').value).map((text,i)=>({id:uid(),text,start:i*2.4,end:(i+1)*2.4,color:'white'}));}
  loading--;renderScenes();renderCues();applyRhythm();await CutRenderer.fonts(project());dirty=true;
}
function applyRhythm(){pause();const rhythm=rhythms[$('templateSelect').value];scenes.forEach((s,i)=>{if(s.type==='image')s.motion=rhythm.motions[i%rhythm.motions.length];s.transition=i?rhythm.transitions[i%rhythm.transitions.length]:'cut';});cues.forEach((c,i)=>{if(scenes.find(s=>s.id===c.sceneId)?.type==='image')c.motion=rhythm.motions[i%rhythm.motions.length];c.transition=i?rhythm.transitions[i%rhythm.transitions.length]:'cut';});renderCues();toast('길이는 유지하고 움직임·전환만 적용했습니다.');}
async function exportVideo(){
  if(exporting||loading||!scenes.length||cues.some(c=>!scenes.some(s=>s.id===c.sceneId)))return;
  pause();exporting=true;$('exportDialog').showModal();$('downloadLink').hidden=true;$('closeExportBtn').hidden=true;$('cancelExportBtn').hidden=false;$('exportProgress').value=0;if(downloadUrl){URL.revokeObjectURL(downloadUrl);downloadUrl=null;}stats();
  const token={cancelled:false};window.currentExport=token;let wakeLock;
  try{while(rendering)await new Promise(r=>setTimeout(r,20));await CutRenderer.fonts(project());try{wakeLock=await navigator.wakeLock?.request('screen');}catch{}
    const blob=await CutEncoder.exportMP4(project(),Number($('resolutionSelect').value),token,(progress,message)=>{$('exportProgress').value=progress;$('exportStatus').textContent=message;});
    if(token.cancelled)throw new Error('취소되었습니다.');downloadUrl=URL.createObjectURL(blob);const link=$('downloadLink');link.href=downloadUrl;link.download=`Cutflow_${new Date().toISOString().slice(0,10)}.mp4`;link.hidden=false;$('exportProgress').value=1;$('exportStatus').textContent='MP4 완성. 다운로드 버튼을 눌러 저장하세요.';toast('MP4 파일을 만들었습니다.');
  }catch(error){$('exportStatus').textContent=token.cancelled?'저장을 취소했습니다. 편집 내용은 유지됩니다.':`저장 실패: ${error.message}`;}
  finally{await wakeLock?.release();exporting=false;window.currentExport=null;$('cancelExportBtn').hidden=true;$('closeExportBtn').hidden=false;dirty=true;stats();}
}
$('uploadBtn').onclick=$('addMoreBtn').onclick=()=>$('fileInput').click();$('fileInput').onchange=e=>addFiles(e.target.files);
$('audioBtn').onclick=()=>$('audioInput').click();$('audioInput').onchange=e=>loadAudio(e.target.files[0]);$('scriptFileBtn').onclick=()=>$('scriptFile').click();$('scriptFile').onchange=async e=>{if(e.target.files[0])$('scriptInput').value=await e.target.files[0].text();e.target.value='';};
$('randomMotionBtn').onclick=()=>{
  pause();if(cues.length)rememberCues();let previous=[];
  const choose=()=>{const pool=Object.keys(motionLabels).filter(m=>m!=='still'&&!previous.includes(m));const next=pool[Math.floor(Math.random()*pool.length)];previous=[...previous,next].slice(-2);return next;};
  if(cues.length)cues.forEach(c=>{if(scenes.find(s=>s.id===c.sceneId)?.type==='image')c.motion=choose();});
  else scenes.forEach(s=>{if(s.type==='image')s.motion=choose();});
  renderCues();toast('전체 이미지에 겹치지 않는 랜덤 무빙을 적용했습니다. 영상은 유지했습니다.');
};
$('buildCuesBtn').onclick=buildCues;$('fitCutsBtn').onclick=()=>fitCuts();$('applyTemplateBtn').onclick=applyRhythm;$('demoBtn').onclick=demo;
$('playBtn').onclick=play;$('prevBtn').onclick=()=>navigateCut(-1);$('nextBtn').onclick=()=>navigateCut(1);$('scrubber').oninput=e=>jump(totalDuration()*Number(e.target.value)/1000);
$('waveform').onclick=e=>{if(audioBuffer)jump((e.clientX-e.target.getBoundingClientRect().left)/e.target.clientWidth*audioBuffer.duration);};
['titleInput','titleBold','titleItalic','titleSize','titleColor','channelInput','channelBold','channelItalic','channelSize','channelColor','fitSelect','layoutSelect'].forEach(id=>$(id).addEventListener('input',()=>{changed();if(id==='layoutSelect'){$('fitSelect').disabled=$('layoutSelect').value==='fullscreen';$('layoutDescription').textContent=$('layoutSelect').value==='framed'?'노란 제목 · 중앙 이미지 · 하단 자막과 채널명':$('layoutSelect').value==='fullscreen'?'이미지·영상 전체 채우기 · 자막 오버레이':'노란 제목 · 세로 확장 영상 · 강조 자막과 채널명';window.syncStyleEditor?.();}}));
$('miniTimeline').onclick=e=>{const target=e.target.closest('[data-index]');if(target)jump(Number(target.dataset.time));};
$('sceneList').onclick=e=>{const row=e.target.closest('.scene-row');if(!row)return;const i=Number(row.dataset.index),action=e.target.dataset.action;if(action==='preview'){jump(sceneStart(i));play();}if(action==='up')moveScene(i,i-1);if(action==='down')moveScene(i,i+1);if(action==='delete'){pause();const [scene]=scenes.splice(i,1);scene.element.src='';URL.revokeObjectURL(scene.url);cues.forEach(c=>{if(c.sceneId===scene.id)c.sceneId=null;});offset=Math.min(offset,totalDuration());renderCues();}};
$('sceneList').onchange=e=>{const row=e.target.closest('.scene-row');if(!row)return;pause();const i=Number(row.dataset.index),scene=scenes[i],action=e.target.dataset.action;if(action==='duration'&&!cues.length)scene.duration=Math.max(.1,Math.min(600,Number(e.target.value)||.1));if(action==='trim')scene.trimStart=Math.max(0,Math.min(scene.sourceDuration-.04,Number(e.target.value)||0));if(action==='motion')scene.motion=e.target.value;if(action==='transition')scene.transition=e.target.value;offset=sceneStart(i);renderScenes();};
$('sceneList').ondragstart=e=>{if(e.target.matches('input,textarea,select')){e.preventDefault();return;}dragIndex=Number(e.target.closest('.scene-row')?.dataset.index);};$('sceneList').ondragover=e=>e.preventDefault();$('sceneList').ondrop=e=>{e.preventDefault();const row=e.target.closest('.scene-row');if(row&&Number.isInteger(dragIndex))moveScene(dragIndex,Number(row.dataset.index));dragIndex=null;};$('sceneList').ondragend=()=>dragIndex=null;
$('clearBtn').onclick=()=>{pause();scenes.forEach(s=>{s.element.src='';URL.revokeObjectURL(s.url);});scenes=[];cues.forEach(c=>delete c.sceneId);offset=0;renderCues();};
$('cueList').onfocusin=e=>{const row=e.target.closest('.cue-row');if(row)window.selectStyleCue?.(Number(row.dataset.index));if(e.target.dataset.action==='text')rememberCues();};
$('cueList').oninput=e=>{const row=e.target.closest('.cue-row');if(row&&e.target.dataset.action==='text'){const cue=cues[Number(row.dataset.index)];cue.colorRanges=CaptionRanges.edit(cue.text,e.target.value,cue.colorRanges);cue.text=e.target.value;changed();}};
$('cueList').onchange=e=>{const row=e.target.closest('.cue-row');if(!row)return;const i=Number(row.dataset.index),cue=cues[i],action=e.target.dataset.action;if(action==='text'||action==='selection-color')return;const value=Number(e.target.value);if(action==='start'&&(!Number.isFinite(value)||value<0||value>=cue.end-.05||(i>0&&value<cues[i-1].end))||action==='end'&&(!Number.isFinite(value)||value<=cue.start+.05||(i<cues.length-1&&value>cues[i+1].start))){toast('자막 시간은 서로 겹치지 않고 시작보다 종료가 늦어야 합니다.');renderCues();return;}rememberCues();if(action==='start'||action==='end')cue[action]=value;else if(action==='color'){cue.color=e.target.value;cue.style={...cue.style,color:e.target.value};}else if(action==='motion'||action==='transition')cue[action]=e.target.value;else if(action==='trim'){const s=scenes.find(s=>s.id===cue.sceneId);if(s){cue.trimStart=Math.max(0,Math.min(s.sourceDuration-.04,value||0));cue.mediaOffset=0;}}else if(action==='media'){cue.sceneId=e.target.value||null;cue.mediaOffset=0;delete cue.trimStart;}jump(cue.start);renderCues();};
$('cueList').onclick=e=>{const row=e.target.closest('.cue-row');if(!row)return;const i=Number(row.dataset.index),cue=cues[i],action=e.target.dataset.action;if(action==='selection-apply'||action==='selection-reset'){const input=row.querySelector('textarea[data-action="text"]'),start=input.selectionStart,end=input.selectionEnd;if(start===end){toast('색상을 바꿀 글자를 먼저 선택해 주세요.');return;}pause();rememberCues();cue.colorRanges=CaptionRanges.apply(cue.text,cue.colorRanges,start,end,action==='selection-reset'?null:row.querySelector('[data-action="selection-color"]').value);jump(cue.start);changed();toast(action==='selection-reset'?'선택한 글자의 개별 색상을 해제했습니다.':'선택한 글자에 색상을 적용했습니다.');return;}if(action==='style'){window.selectStyleCue?.(i,true);return;}if(action==='jump'){jump(cue.start);play();return;}if(!['split','merge','delete'].includes(action)){if(desktopNavigation()&&!e.target.closest('button,a,input,textarea,select,label'))selectNavigationCue(i);return;}pause();rememberCues();if(action==='delete')cues.splice(i,1);if(action==='merge'&&cues[i+1]){cue.end=cues[i+1].end;cue.colorRanges=CaptionRanges.merge(cue,cues[i+1]);cue.text+='\n'+cues[i+1].text;cues.splice(i+1,1);}if(action==='split'){if(cue.end-cue.start<.2){toast('나눌 수 있는 최소 길이는 0.2초입니다.');return;}const [first,second]=CaptionRanges.split(cue.text,cue.colorRanges);const text2=second.text;const end=cue.end;cue.end=(cue.start+cue.end)/2;cue.text=first.text;cue.colorRanges=first.ranges;cues.splice(i+1,0,{...cue,id:uid(),start:cue.end,end,text:text2,colorRanges:second.ranges,mediaOffset:(cue.mediaOffset||0)+cue.end-cue.start});}renderCues();};
$('addCueBtn').onclick=()=>{rememberCues();const start=cues.at(-1)?.end||0;cues.push({id:uid(),start,end:start+2,text:'새 자막',color:'white',...window.newCueStyle?.()});renderCues();};$('undoCuesBtn').onclick=()=>{if(cueHistory.length){cues=cueHistory.pop();$('undoCuesBtn').disabled=!cueHistory.length;renderCues();}};
$('exportBtn').onclick=exportVideo;$('cancelExportBtn').onclick=()=>{if(window.currentExport){window.currentExport.cancelled=true;CutEncoder.cancel();$('exportStatus').textContent='취소하는 중…';}};$('closeExportBtn').onclick=()=>$('exportDialog').close();$('exportDialog').addEventListener('cancel',e=>{if(exporting){e.preventDefault();$('cancelExportBtn').click();}});
document.addEventListener('keydown',e=>{if(e.code==='Space'&&!exporting&&!['INPUT','TEXTAREA','SELECT','BUTTON'].includes(document.activeElement.tagName)){e.preventDefault();play();}});
window.addEventListener('beforeunload',e=>{if(scenes.length||audioBuffer||window.bgmProject?.().buffer){e.preventDefault();e.returnValue='';}});
document.fonts.ready.then(()=>dirty=true);document.fonts.addEventListener('loadingdone',()=>dirty=true);
renderScenes();renderCues();waveform();requestAnimationFrame(tick);
