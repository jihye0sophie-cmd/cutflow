/* One sample-accurate mix is shared by preview and MP4; no external service. */
window.CutAudio=(()=>{
  let cached=null,context=null,source=null,clockStart=0;
  function settings(project){const b=project.bgm||{},buffer=b.buffer,duration=Math.max(0,project.duration||0),start=Math.min(Math.max(0,b.start||0),Math.max(0,(buffer?.duration||0)-.01)),available=Math.max(0,(buffer?.duration||0)-start),length=buffer?(b.loop?duration:Math.min(duration,available)):0;
    return {buffer,start,length,available,loop:!!b.loop,volume:Math.max(0,Math.min(1,b.volume??.2)),fadeIn:Math.min(length,Math.max(0,b.fadeIn||0)),fadeOut:Math.min(length,Math.max(0,b.fadeOut||0)),duration};}
  function schedule(ctx,project){
    const s=settings(project);
    if(project.audioBuffer){const voice=ctx.createBufferSource();voice.buffer=project.audioBuffer;voice.connect(ctx.destination);voice.start(0,0,Math.min(project.audioBuffer.duration,s.duration));}
    if(!s.buffer||!s.length||!s.volume)return;
    const music=ctx.createBufferSource(),gain=ctx.createGain(),fadeIn=ctx.createGain(),fadeOut=ctx.createGain();music.buffer=s.buffer;music.loop=s.loop;music.loopStart=s.start;music.loopEnd=s.buffer.duration;
    gain.gain.value=s.volume;fadeIn.gain.setValueAtTime(s.fadeIn?0:1,0);if(s.fadeIn)fadeIn.gain.linearRampToValueAtTime(1,s.fadeIn);
    fadeOut.gain.setValueAtTime(1,0);if(s.fadeOut){fadeOut.gain.setValueAtTime(1,s.length-s.fadeOut);fadeOut.gain.linearRampToValueAtTime(0,s.length);}
    music.connect(gain).connect(fadeIn).connect(fadeOut).connect(ctx.destination);music.start(0,s.start,s.length);
  }
  async function mix(project){
    if(!project.bgm?.buffer)return project.audioBuffer;
    const s=settings(project);if(!s.duration)return null;
    const key=JSON.stringify({...s,buffer:null});
    if(cached?.voice===project.audioBuffer&&cached?.music===s.buffer&&cached.key===key)return cached.promise;
    const entry={voice:project.audioBuffer,music:s.buffer,key};
    entry.promise=(async()=>{const OfflineCtx=window.OfflineAudioContext||window.webkitOfflineAudioContext;if(!OfflineCtx)throw new Error('이 브라우저는 오디오 믹싱을 지원하지 않습니다.');const ctx=new OfflineCtx(2,Math.ceil(s.duration*48000),48000);schedule(ctx,project);const buffer=await ctx.startRendering();let peak=1;for(let c=0;c<buffer.numberOfChannels;c++){const data=buffer.getChannelData(c);for(let i=0;i<data.length;i++)peak=Math.max(peak,Math.abs(data[i]));}if(peak>1)for(let c=0;c<buffer.numberOfChannels;c++){const data=buffer.getChannelData(c);for(let i=0;i<data.length;i++)data[i]/=peak;}return buffer;})();
    cached=entry;try{return await entry.promise;}catch(error){if(cached===entry)cached=null;throw error;}
  }
  async function unlock(){const AudioCtx=window.AudioContext||window.webkitAudioContext;if(!AudioCtx)throw new Error('이 브라우저는 오디오 재생을 지원하지 않습니다.');context??=new AudioCtx();if(context.state==='suspended')await context.resume();}
  function stop(){if(source){try{source.stop();}catch{}source.disconnect();source=null;}}
  function start(buffer,offset){stop();clockStart=context.currentTime;if(buffer&&offset<buffer.duration){source=context.createBufferSource();source.buffer=buffer;source.connect(context.destination);source.start(0,offset);}}
  const elapsed=()=>context?Math.max(0,context.currentTime-clockStart):0;
  function invalidate(){cached=null;}
  return {mix,settings,schedule,unlock,start,stop,elapsed,invalidate};
})();
