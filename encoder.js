/* All encoding runs in this browser. No media upload or paid API. */
window.CutEncoder=(()=>{
  let ffmpeg=null,activeEncoder=null,lastLogs=[];
  const assertActive=token=>{if(token.cancelled)throw new Error('취소되었습니다.');};
  async function init(token,progress){
    progress(.01,'영상 인코더 준비 중…');
    const parts=[];
    for(let i=0;i<4;i++){
      assertActive(token);const response=await fetch(`./assets/encoder/core.part${i}`);
      if(!response.ok)throw new Error('인코더를 내려받지 못했습니다. 연결을 확인한 뒤 다시 저장해 주세요.');
      parts.push(await response.arrayBuffer());progress(.015+.015*i,`인코더 준비 ${i+1}/4`);
    }
    assertActive(token);const wasmURL=URL.createObjectURL(new Blob(parts,{type:'application/wasm'}));
    ffmpeg=new FFmpegWASM.FFmpeg();lastLogs=[];
    ffmpeg.on('log',({message})=>{lastLogs.push(message);if(lastLogs.length>12)lastLogs.shift();});
    try{await ffmpeg.load({coreURL:new URL('./assets/encoder/ffmpeg-core.js',location.href).href,wasmURL});}finally{URL.revokeObjectURL(wasmURL);}
    assertActive(token);
  }
  async function exec(args){const code=await ffmpeg.exec(args);if(code!==0)throw new Error('MP4 인코딩에 실패했습니다. 720p로 낮춰 다시 저장해 주세요. '+lastLogs.filter(x=>/error|invalid|failed/i.test(x)).slice(-1).join(''));}
  function wav(buffer){
    const channels=Math.min(2,buffer.numberOfChannels),samples=buffer.length,rate=buffer.sampleRate;
    const data=new Uint8Array(44+samples*channels*2),v=new DataView(data.buffer);
    const str=(pos,text)=>[...text].forEach((c,i)=>v.setUint8(pos+i,c.charCodeAt(0)));
    str(0,'RIFF');v.setUint32(4,data.length-8,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,channels,true);v.setUint32(24,rate,true);v.setUint32(28,rate*channels*2,true);v.setUint16(32,channels*2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,data.length-44,true);
    const source=Array.from({length:channels},(_,i)=>buffer.getChannelData(i));let at=44;
    for(let i=0;i<samples;i++)for(let c=0;c<channels;c++){const x=Math.max(-1,Math.min(1,source[c][i]));v.setInt16(at,x<0?x*32768:x*32767,true);at+=2;}return data;
  }
  async function fastVideo(canvas,project,frames,fps,config,token,progress){
    const target=new Mp4Muxer.ArrayBufferTarget();const muxer=new Mp4Muxer.Muxer({target,video:{codec:'avc',width:canvas.width,height:canvas.height},fastStart:'in-memory',firstTimestampBehavior:'offset'});
    let failure=null;
    activeEncoder=new VideoEncoder({output:(chunk,meta)=>{try{muxer.addVideoChunk(chunk,meta);}catch(error){failure=error;}},error:error=>{failure=error;}});
    activeEncoder.configure(config);
    try{
      for(let i=0;i<frames;i++){
        assertActive(token);if(failure)throw failure;
        await CutRenderer.draw(canvas,project,i/fps);
        const frame=new VideoFrame(canvas,{timestamp:Math.round(i*1e6/fps),duration:Math.round(1e6/fps)});
        try{activeEncoder.encode(frame,{keyFrame:i%(fps*2)===0});}finally{frame.close();}
        if(activeEncoder.encodeQueueSize>=8)await activeEncoder.flush();
        if(i%10===0){progress(.08+.77*i/frames,`영상 만드는 중 ${Math.floor(100*i/frames)}% · 빠른 인코딩`);await new Promise(r=>setTimeout(r,0));}
      }
      await activeEncoder.flush();if(failure)throw failure;muxer.finalize();
      await ffmpeg.writeFile('video.mp4',new Uint8Array(target.buffer));
    }finally{if(activeEncoder?.state!=='closed')activeEncoder?.close();activeEncoder=null;}
  }
  async function softwareVideo(canvas,project,frames,fps,token,progress){
    const ctx=canvas.getContext('2d',{alpha:false}),bytesPerFrame=canvas.width*canvas.height*4;
    const batch=Math.max(1,Math.min(10,Math.floor(84_000_000/bytesPerFrame)));const segments=[];
    for(let begin=0;begin<frames;begin+=batch){
      assertActive(token);const count=Math.min(batch,frames-begin);const bytes=new Uint8Array(bytesPerFrame*count);
      for(let n=0;n<count;n++){assertActive(token);await CutRenderer.draw(canvas,project,(begin+n)/fps);bytes.set(ctx.getImageData(0,0,canvas.width,canvas.height).data,n*bytesPerFrame);}
      await ffmpeg.writeFile('frames.rgba',bytes);const name=`segment${segments.length}.mp4`;
      await exec(['-f','rawvideo','-pixel_format','rgba','-video_size',`${canvas.width}x${canvas.height}`,'-framerate',String(fps),'-i','frames.rgba','-frames:v',String(count),'-an','-c:v','libx264','-threads','1','-preset','ultrafast','-crf','20','-pix_fmt','yuv420p','-bf','0','-y',name]);
      await ffmpeg.deleteFile('frames.rgba');segments.push(name);progress(.08+.77*(begin+count)/frames,`영상 만드는 중 ${Math.floor(100*(begin+count)/frames)}% · 호환 인코딩`);
      await new Promise(r=>setTimeout(r,0));
    }
    assertActive(token);await ffmpeg.writeFile('concat.txt',new TextEncoder().encode(segments.map(n=>`file '${n}'`).join('\n')));
    await exec(['-f','concat','-safe','0','-i','concat.txt','-c','copy','-y','video.mp4']);
    for(const segment of segments)await ffmpeg.deleteFile(segment);await ffmpeg.deleteFile('concat.txt');
  }
  async function exportMP4(project,width,token,progress){
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=width*16/9;
    const fps=30,frames=Math.ceil(project.duration*fps);let codecConfig=null;
    try{
      progress(.005,'내레이션과 BGM 준비 중…');
      const mixedAudio=await CutAudio.mix(project);assertActive(token);
      await init(token,progress);
      if(window.VideoEncoder&&window.Mp4Muxer){
        for(const preference of ['prefer-hardware','prefer-software']){
          const config={codec:'avc1.42002a',width:canvas.width,height:canvas.height,framerate:fps,bitrate:width>=1080?8_000_000:4_000_000,hardwareAcceleration:preference,avc:{format:'avc'}};
          try{if((await VideoEncoder.isConfigSupported(config)).supported){codecConfig=config;break;}}catch{}
        }
      }
      assertActive(token);
      if(codecConfig){try{await fastVideo(canvas,project,frames,fps,codecConfig,token,progress);}catch(error){assertActive(token);progress(.08,'호환 인코딩으로 다시 만드는 중…');await softwareVideo(canvas,project,frames,fps,token,progress);}}
      else await softwareVideo(canvas,project,frames,fps,token,progress);
      assertActive(token);progress(.89,'내레이션·BGM을 합치고 MP4를 마무리하는 중…');
      if(mixedAudio){
        await ffmpeg.writeFile('narration.wav',wav(mixedAudio));
        await exec(['-i','video.mp4','-i','narration.wav','-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','192k','-af','apad','-t',String(project.duration),'-movflags','+faststart','-y','result.mp4']);
      }else await exec(['-i','video.mp4','-c','copy','-movflags','+faststart','-y','result.mp4']);
      assertActive(token);const data=await ffmpeg.readFile('result.mp4');progress(1,'MP4 완성');return new Blob([data],{type:'video/mp4'});
    }finally{ffmpeg?.terminate();ffmpeg=null;if(activeEncoder?.state!=='closed')activeEncoder?.close();activeEncoder=null;}
  }
  function cancel(){ffmpeg?.terminate();if(activeEncoder?.state!=='closed')activeEncoder?.close();}
  return {exportMP4,cancel,wav};
})();
