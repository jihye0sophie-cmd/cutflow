/* Music is independent of narration and never determines timeline duration. */
let bgmBuffer=null,bgmName='',bgmFile=null,bgmLoadId=0;
function bgmProject(){return {buffer:bgmBuffer,start:Number($('bgmStart').value)||0,volume:(Number($('bgmVolume').value)||0)/100,loop:$('bgmRepeat').value==='loop',fadeIn:Number($('bgmFadeIn').value)||0,fadeOut:Number($('bgmFadeOut').value)||0};}
const setBgmText=(id,text)=>{const el=$(id);if(el&&el.textContent!==text)el.textContent=text;};
function syncBgm({emit=true}={}){
  $('bgmFields').disabled=!bgmBuffer;$('bgmRemove').disabled=!bgmBuffer;setBgmText('bgmVolumeValue',`${$('bgmVolume').value}%`);
  setBgmText('bgmStatus',bgmBuffer?`${bgmName} · ${bgmBuffer.duration.toFixed(2)}초`:'음악 없음');
  const s=CutAudio.settings({duration:totalDuration(),bgm:bgmProject()});
  setBgmText('bgmSummary',!bgmBuffer?'음악을 추가하면 쇼츠 길이에 맞춰 자동으로 잘립니다.':!s.duration?'컷이나 내레이션을 추가하면 사용할 길이가 정해집니다.':s.loop?`${s.start.toFixed(2)}초부터 원본 끝까지 반복 · 쇼츠 ${s.duration.toFixed(2)}초에 맞춰 종료`:`원본 ${s.start.toFixed(2)}~${(s.start+s.length).toFixed(2)}초 사용 · ${s.length.toFixed(2)}초 재생${s.length<s.duration?' 후 음악 종료':''}`);
  if(emit&&typeof CustomEvent==='function')window.dispatchEvent(new CustomEvent('cutflow-bgm-updated',{detail:{loaded:!!bgmBuffer,name:bgmName,duration:bgmBuffer?.duration||0}}));
}
$('bgmBtn').onclick=()=>$('bgmInput').click();
$('bgmInput').onchange=async e=>{const file=e.target.files[0];if(!file)return;pause();const id=++bgmLoadId;loading++;stats();$('bgmStatus').textContent='음악 읽는 중…';let ctx,loaded=false;
  try{ctx=new AudioContext();const buffer=await ctx.decodeAudioData(await file.arrayBuffer());if(!Number.isFinite(buffer.duration)||buffer.duration<=.01)throw new Error();if(id!==bgmLoadId)return;bgmBuffer=buffer;bgmName=file.name;bgmFile=file;$('bgmStart').value='0';$('bgmStart').max=Math.max(0,buffer.duration-.01).toFixed(2);CutAudio.invalidate();loaded=true;toast('BGM을 추가했습니다. 미리보기 재생으로 함께 들어보세요.');}
  catch{toast('음악을 읽지 못했습니다. MP3 또는 WAV 파일로 다시 시도해 주세요.');}
  finally{await ctx?.close();loading--;e.target.value='';if(loaded)changed();else stats();syncBgm();}
};
$('bgmRemove').onclick=()=>{pause();bgmLoadId++;bgmBuffer=null;bgmName='';bgmFile=null;CutAudio.invalidate();changed({syncBgm:false});syncBgm();};
['bgmStart','bgmVolume','bgmRepeat','bgmFadeIn','bgmFadeOut'].forEach(id=>$(id).addEventListener('input',()=>{pause();const input=$(id);if(id==='bgmStart')input.value=String(Math.min(Math.max(0,Number(input.value)||0),Math.max(0,(bgmBuffer?.duration||0)-.01)));if(id==='bgmFadeIn'||id==='bgmFadeOut')input.value=String(Math.max(0,Math.min(30,Number(input.value)||0)));CutAudio.invalidate();changed({syncBgm:false});syncBgm();}));

function bgmSnapshot(){return bgmBuffer?{file:bgmFile,name:bgmName,start:Number($('bgmStart').value)||0,volume:Number($('bgmVolume').value)||0,repeat:$('bgmRepeat').value,fadeIn:Number($('bgmFadeIn').value)||0,fadeOut:Number($('bgmFadeOut').value)||0}:null;}
async function restoreBgmSnapshot(snapshot,{silent=false}={}){
  bgmLoadId++;bgmBuffer=null;bgmName='';bgmFile=null;
  if(!snapshot?.file){CutAudio.invalidate();syncBgm();return;}
  let ctx;
  try{
    const file=snapshot.file instanceof File?snapshot.file:new File([snapshot.file],snapshot.name||'bgm.wav',{type:snapshot.file.type||'audio/wav'});
    ctx=new AudioContext();const buffer=await ctx.decodeAudioData(await file.arrayBuffer());
    bgmBuffer=buffer;bgmFile=file;bgmName=snapshot.name||file.name;
    $('bgmStart').max=Math.max(0,buffer.duration-.01).toFixed(2);$('bgmStart').value=String(Math.min(Math.max(0,Number(snapshot.start)||0),Math.max(0,buffer.duration-.01)));
    $('bgmVolume').value=String(Math.max(0,Math.min(100,Number(snapshot.volume)||0)));$('bgmRepeat').value=snapshot.repeat==='loop'?'loop':'stop';$('bgmFadeIn').value=String(Math.max(0,Math.min(30,Number(snapshot.fadeIn)||0)));$('bgmFadeOut').value=String(Math.max(0,Math.min(30,Number(snapshot.fadeOut)||0)));
    CutAudio.invalidate();syncBgm();if(!silent)toast('BGM을 복원했습니다.');
  }catch(error){bgmBuffer=null;bgmName='';bgmFile=null;syncBgm();throw new Error('저장된 BGM을 복원하지 못했습니다.');}
  finally{await ctx?.close();}
}
async function loadBgmFile(file){
  if(!file)return false;pause();const id=++bgmLoadId;loading++;stats();$('bgmStatus').textContent='음악 읽는 중…';let ctx;
  try{ctx=new AudioContext();const buffer=await ctx.decodeAudioData(await file.arrayBuffer());if(!Number.isFinite(buffer.duration)||buffer.duration<=.01)throw new Error();if(id!==bgmLoadId)return false;bgmBuffer=buffer;bgmName=file.name;bgmFile=file;$('bgmStart').value='0';$('bgmStart').max=Math.max(0,buffer.duration-.01).toFixed(2);CutAudio.invalidate();changed({syncBgm:false});syncBgm();return true;}
  catch{return false;}finally{await ctx?.close();loading--;stats();}
}
window.loadBgmFile=loadBgmFile;
window.bgmSnapshot=bgmSnapshot;window.restoreBgmSnapshot=restoreBgmSnapshot;

window.CutflowBgm={
  remove(){pause();bgmLoadId++;bgmBuffer=null;bgmName='';bgmFile=null;CutAudio.invalidate();changed({syncBgm:false});syncBgm();return true;},
  update(patch={}){
    if(!bgmBuffer)return false;pause();
    if(patch.start!=null)$('bgmStart').value=String(Math.min(Math.max(0,Number(patch.start)||0),Math.max(0,bgmBuffer.duration-.01)));
    if(patch.volume!=null)$('bgmVolume').value=String(Math.max(0,Math.min(100,Number(patch.volume)||0)));
    if(patch.repeat!=null)$('bgmRepeat').value=patch.repeat==='loop'?'loop':'stop';
    if(patch.fadeIn!=null)$('bgmFadeIn').value=String(Math.max(0,Math.min(30,Number(patch.fadeIn)||0)));
    if(patch.fadeOut!=null)$('bgmFadeOut').value=String(Math.max(0,Math.min(30,Number(patch.fadeOut)||0)));
    CutAudio.invalidate();changed({syncBgm:false});syncBgm();return true;
  }
};

window.bgmProject=bgmProject;window.syncBgm=syncBgm;syncBgm();
