/* Shared deterministic compositor: preview and export use the same pixels. */
window.CutRenderer = (() => {
  function cutDuration(scenes) { return scenes.some(s=>Number.isFinite(s.start))?Math.max(0,...scenes.map(s=>s.end)):scenes.reduce((n,s)=>n+s.duration,0); }
  function locate(scenes,time) {
    if(scenes.some(s=>Number.isFinite(s.start))){const index=scenes.findIndex(s=>time>=s.start&&time<s.end);return {index,start:index<0?0:scenes[index].start,elapsed:index<0?0:time-scenes[index].start};}
    let start=0;
    for(let i=0;i<scenes.length;i++) {
      if(time<start+scenes[i].duration || i===scenes.length-1) return {index:i,start,elapsed:Math.max(0,Math.min(scenes[i].duration,time-start))};
      start+=scenes[i].duration;
    }
    return {index:-1,start:0,elapsed:0};
  }
  function motion(scene,elapsed) {
    const motionElapsed=Math.max(0,elapsed+(Number(scene.motionOffset)||0)),motionDuration=Math.max(.001,Number(scene.motionDuration)||scene.duration||.001);
    const p=Math.max(0,Math.min(1,motionElapsed/motionDuration));
    const m={scale:1,x:0,y:0};
    if(scene.motion==='zoom-in') m.scale=1+.13*p;
    if(scene.motion==='zoom-out') m.scale=1.13-.13*p;
    if(scene.motion.startsWith('pan-')) {
      m.scale=1.13;
      if(scene.motion==='pan-left') m.x=.04-.08*p;
      if(scene.motion==='pan-right') m.x=-.04+.08*p;
      if(scene.motion==='pan-up') m.y=.04-.08*p;
      if(scene.motion==='pan-down') m.y=-.04+.08*p;
    }
    const quick=Math.min(1,p*3);
    if(scene.motion==='zoom-in-slow')m.scale=1+.08*p;
    if(scene.motion==='zoom-in-fast')m.scale=1+.22*quick;
    if(scene.motion==='zoom-in-strong')m.scale=1+.45*p;
    if(scene.motion==='zoom-out-slow')m.scale=1.08-.08*p;
    if(scene.motion==='zoom-out-fast')m.scale=1.22-.22*quick;
    if(scene.motion==='zoom-pan-right'){m.scale=1.16+.18*p;m.x=-.045+.09*p;}
    if(scene.motion==='zoom-pan-left'){m.scale=1.16+.18*p;m.x=.045-.09*p;}
    if(scene.motion==='punch-hold')m.scale=1+.4*Math.min(1,elapsed/.22);
    return m;
  }
  async function seek(scene,elapsed) {
    if(scene.type!=='video') return;
    const video=scene.element;
    const trimStart=Math.max(0,Number(scene.trimStart)||0),trimEnd=Math.min(Number(scene.sourceDuration)||Infinity,Number(scene.trimEnd)||Number(scene.sourceDuration)||Infinity);const target=Math.max(trimStart,Math.min(trimEnd-.02,trimStart+elapsed));
    if(video.readyState>=2 && Math.abs(video.currentTime-target)<.002) return;
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>done(new Error('영상 프레임을 읽지 못했습니다. 다른 MP4 코덱으로 변환해 주세요.')),12000);
      function done(error){clearTimeout(timer);video.removeEventListener('seeked',ok);video.removeEventListener('error',bad);error?reject(error):resolve();}
      function ok(){done();}function bad(){done(new Error('영상 파일을 재생할 수 없습니다.'));}
      video.addEventListener('seeked',ok,{once:true});video.addEventListener('error',bad,{once:true});video.currentTime=target;
    });
  }
  // Normalized offsets are relative to the media viewport, independent of export resolution.
  function transform(value={}) {
    const finite=(v,d)=>Number.isFinite(v)?v:d;
    return {scale:Math.max(.1,Math.min(5,finite(value?.scale,1))),x:Math.max(-2,Math.min(2,finite(value?.x,0))),y:Math.max(-2,Math.min(2,finite(value?.y,0)))};
  }
  function mediaRect(w,h,layout) {
    return layout==='fullscreen'?{x:0,y:0,w,h}:{x:0,y:h*(layout==='immersive'?.237:.203),w,h:h*(layout==='immersive'?.763:.594)};
  }
  function mediaGeometry(scene,elapsed,rect,fit) {
    const el=scene?.element;if(!el)return null;
    const sw=el.videoWidth||el.naturalWidth||el.width,sh=el.videoHeight||el.naturalHeight||el.height;
    if(!sw||!sh)return null;
    const factor=fit==='contain'?Math.min(rect.w/sw,rect.h/sh):Math.max(rect.w/sw,rect.h/sh);
    const m=motion(scene,elapsed),base=transform(scene.transform);
    const dw=sw*factor*m.scale*base.scale,dh=sh*factor*m.scale*base.scale;
    return {x:rect.x+(rect.w-dw)/2+base.x*rect.w+m.x*rect.w*m.scale*base.scale,
      y:rect.y+(rect.h-dh)/2+base.y*rect.h+m.y*rect.h*m.scale*base.scale,w:dw,h:dh};
  }
  function drawMedia(ctx,scene,elapsed,rect,fit) {
    const box=mediaGeometry(scene,elapsed,rect,fit);if(!box)return;
    ctx.save();ctx.beginPath();ctx.rect(rect.x,rect.y,rect.w,rect.h);ctx.clip();
    ctx.drawImage(scene.element,box.x,box.y,box.w,box.h);ctx.restore();
  }
  function glyphs(text,highlight,base,ranges=[]) {
    const out=[];let marked=false;
    for(let i=0;i<text.length;) {
      if(text.slice(i,i+2)==='[['){marked=true;i+=2;continue;}
      if(text.slice(i,i+2)===']]'){marked=false;i+=2;continue;}
      const at=i,c=String.fromCodePoint(text.codePointAt(i));i+=c.length;
      out.push({c,color:ranges.find(r=>at>=r.start&&at<r.end)?.color||(highlight&&marked?'#eeff00':base)});
    }return out;
  }
  function drawText(ctx,text,{x,y,w,h,size,color='#fff',italic=false,outline=false,highlight=false,align='center',font='noto',weight=900,strokeColor='#111111',strokeWidth=null,background=null,padding=0,radius=0,colorRanges=[]}) {
    if(!text)return;
    const fontInfo=window.CutFonts?.get(font);
    // Single-weight custom faces must never request OS-dependent synthetic bold.
    const nativeWeight=fontInfo?.file?400:weight;
    const extraBold=fontInfo?.file&&!fontInfo.fixedBold&&weight>=700;
    const chars=glyphs(text,highlight,color,colorRanges);let lines=[],fontSize=size;
    function wrap(){
      ctx.font=`${italic?'italic ':''}${nativeWeight} ${fontSize}px "${window.CutFonts?.get(font).family||'Noto Sans KR'}", sans-serif`;
      lines=[];let line=[],width=0;
      for(const char of chars){
        if(char.c==='\n'){lines.push({glyphs:line,width});line=[];width=0;continue;}
        const cw=ctx.measureText(char.c).width;
        if(width+cw>w && line.length){lines.push({glyphs:line,width});line=[];width=0;}
        line.push({...char,width:cw});width+=cw;
      }lines.push({glyphs:line,width});
    }
    wrap();while(lines.length*fontSize*1.25>h && fontSize>size*.35){fontSize*=.94;wrap();}
    const fullHeight=lines.length*fontSize*1.25;
    let yy=align==='bottom'?y+h-fullHeight:y+(h-fullHeight)/2;
    ctx.save();
    if(background){
      const bw=Math.min(w,Math.max(...lines.map(l=>l.width),0))+padding*2,bh=fullHeight+padding*2,bx=x+(w-bw)/2,by=yy-padding;
      ctx.globalAlpha=background.opacity;ctx.fillStyle=background.color;ctx.beginPath();
      if(ctx.roundRect)ctx.roundRect(bx,by,bw,bh,Math.min(radius,bh/2));else ctx.rect(bx,by,bw,bh);
      ctx.fill();ctx.globalAlpha=1;
    }
    ctx.textBaseline='top';ctx.lineJoin='round';ctx.miterLimit=2;
    for(const line of lines){let xx=x+(w-line.width)/2;
      for(const g of line.glyphs){if(outline){ctx.strokeStyle=strokeColor;ctx.lineWidth=strokeWidth??fontSize*.11;ctx.strokeText(g.c,xx,yy);}if(extraBold){ctx.strokeStyle=g.color;ctx.lineWidth=fontSize*.018;ctx.strokeText(g.c,xx,yy);}ctx.fillStyle=g.color;ctx.fillText(g.c,xx,yy);xx+=g.width;}yy+=fontSize*1.25;
    }ctx.restore();
  }
  function textStroke(project,kind,templateDefault,scale){
    const value=project[kind+'StrokeWidth'];
    const strokeWidth=Number.isFinite(value)?Math.max(0,value)*scale:null;
    return {outline:(project[kind+'StrokeEnabled']??templateDefault)&&strokeWidth!==0,strokeWidth};
  }
  async function draw(canvas,project,time) {
    await fonts(project);
    const ctx=canvas.getContext('2d',{alpha:false});const w=canvas.width,h=canvas.height;
    const loc=locate(project.scenes,time),scene=project.scenes[loc.index],portrait=project.layout==='immersive',fullscreen=project.layout==='fullscreen';
    const rect=mediaRect(w,h,project.layout);
    const fit=fullscreen?'cover':project.fit;
    if(scene?.element) {
      await seek(scene,loc.elapsed);
      const candidate=project.scenes[loc.index-1],prior=candidate?.element&&(!Number.isFinite(scene.start)||Math.abs(candidate.end-scene.start)<.001)?candidate:null;const progress=Math.min(1,loc.elapsed/Math.min(.35,scene.duration/2));
      ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);drawMedia(ctx,scene,loc.elapsed,rect,fit);
      if(prior&&progress<1&&['dissolve','slide'].includes(scene.transition))await seek(prior,prior.duration);
      if(prior&&progress<1&&scene.transition!=='cut') {
        ctx.save();
        if(scene.transition==='dissolve'){ctx.globalAlpha=1-progress;drawMedia(ctx,prior,prior.duration,rect,fit);}
        else if(scene.transition==='slide'){ctx.beginPath();ctx.rect(0,rect.y,w*(1-progress),rect.h);ctx.clip();drawMedia(ctx,prior,prior.duration,rect,fit);}
        else{ctx.globalAlpha=1-progress;ctx.fillStyle=scene.transition==='flash'?'#fff':'#000';ctx.fillRect(0,rect.y,w,rect.h);}
        ctx.restore();
      }
    }else{ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);if(!project.scenes.length)drawText(ctx,'이미지·영상 컷을\n불러와 주세요',{x:w*.1,y:h*.35,w:w*.8,h:h*.25,size:w*.065,color:'#b9b9b9'});}
    drawText(ctx,project.title,{x:w*((project.titleX??50)/100-.45),y:h*((project.titleY??((portrait?.07:.04)*100))/100),w:w*.90,h:h*(portrait?.155:.15),size:(project.titleSize||86.4)*w/1080,italic:!!project.titleItalic,color:project.titleColor||'#ffe22e',colorRanges:project.titleColorRanges||[],weight:project.titleBold===false?400:900,align:'bottom',font:project.titleFont||'noto',...textStroke(project,'title',fullscreen,w/1080)});
    const cue=project.cues.find(c=>time>=c.start&&time<c.end);
    if(cue){
      const style=window.CaptionStyle.resolve(cue,project),scale=w/1080;
      const customPosition=Number.isFinite(style.y)||fullscreen;
      const center=(style.y??window.CaptionStyle.defaultY(project.layout))/100*h;
      const areaH=customPosition?Math.min(h*.30,center*2,(h-center)*2):h*(portrait?.16:.14);
      const y=customPosition?Math.max(0,Math.min(h-areaH,center-areaH/2)):(portrait?h*.635:h*.64);
      drawText(ctx,cue.text,{x:w*.07,y,w:w*.86,h:areaH,size:style.size*scale,color:style.color,colorRanges:cue.colorRanges||[],highlight:true,italic:style.italic,outline:style.strokeWidth>0,strokeColor:style.strokeColor,strokeWidth:style.strokeWidth*scale,align:customPosition||portrait?'center':'bottom',font:style.font,weight:style.bold?900:400,background:style.background?{color:style.backgroundColor,opacity:style.backgroundOpacity}:null,padding:style.padding*scale,radius:style.radius*scale});
    }
    drawText(ctx,project.channel,{x:w*((project.channelX??50)/100-.46),y:h*((project.channelY??((fullscreen||portrait?.92:.817)*100))/100),w:w*.92,h:h*.06,size:(project.channelSize||43.2)*w/1080,italic:!!project.channelItalic,color:project.channelColor||'#dddddd',weight:project.channelBold===false?400:900,font:project.channelFont||'noto',...textStroke(project,'channel',fullscreen||portrait,w/1080)});
    return loc;
  }
  let fontSignature='',fontPromise=Promise.resolve();
  async function fonts(project){
    const text=[project.title,project.channel,...project.cues.map(c=>c.text)].join('')||'가나다';
    const ids=[...new Set([project.titleFont||'noto',project.channelFont||'noto',...project.cues.map(c=>window.CaptionStyle.resolve(c,project).font)])];
    const signature=ids.join('|')+'::'+text;
    if(signature!==fontSignature){
      fontSignature=signature;
      fontPromise=(async()=>{await Promise.all(ids.map(id=>window.CutFonts.ensure(id,text)));await document.fonts.ready;})();
    }
    await fontPromise;
  }
  return {draw,locate,motion,cutDuration,fonts,transform,mediaRect,mediaGeometry};
})();
