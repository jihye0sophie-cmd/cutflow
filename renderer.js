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
    if(scene.motion==='zoom-pan-up'){m.scale=1.16+.18*p;m.y=.045-.09*p;}
    if(scene.motion==='zoom-pan-down'){m.scale=1.16+.18*p;m.y=-.045+.09*p;}
    if(scene.motion==='handheld-subtle'){
      // Deterministic low-amplitude handheld drift. Keeping this time-based makes preview/export identical.
      const t=p*Math.PI*2;
      m.scale=1.025+.004*Math.sin(t*1.7+.4);
      m.x=.0045*Math.sin(t*2.1+.2)+.0022*Math.sin(t*4.7+1.1);
      m.y=.0035*Math.sin(t*1.6+1.4)+.0018*Math.sin(t*3.9+.5);
    }
    if(scene.motion==='punch-hold')m.scale=1+.4*Math.min(1,elapsed/.22);
    return m;
  }
  async function seek(scene,elapsed) {
    if(scene.type==='gif'&&scene.gifDecoder){
      const total=Math.max(.001,Number(scene.sourceDuration)||.001),local=((Math.max(0,elapsed)%total)+total)%total,durations=scene.gifFrameDurations||[];
      let acc=0,index=0;for(;index<durations.length-1;index++){acc+=durations[index];if(local<acc)break;}
      if(scene.gifFrameIndex===index&&scene.gifFrame)return;
      const decoded=await scene.gifDecoder.decode({frameIndex:index});scene.gifFrame?.close?.();scene.gifFrame=decoded.image;scene.gifFrameIndex=index;return;
    }
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
  function storyCaptionText(project,time){
    const index=(project.cues||[]).findIndex(c=>time>=c.start&&time<c.end);if(index<0)return '';
    if(project.storyCaptionMode!=='cumulative')return project.cues[index]?.text||'';
    return project.cues.slice(0,index+1).map(c=>String(c.text||'').trim()).filter(Boolean).join('\n');
  }
  function storyLayout(w,h,project,time){
    const text=storyCaptionText(project,time),fontSize=Math.max(24,Number(window.CaptionStyle?.resolve?.((project.cues||[]).find(c=>time>=c.start&&time<c.end)||{},project)?.size)||60);
    const charsPerLine=Math.max(10,Math.floor((w*.86)/(fontSize*.92))),logical=String(text||'').split('\n');let lines=0;for(const line of logical)lines+=Math.max(1,Math.ceil([...line].length/charsPerLine));
    lines=Math.max(1,lines);
    // Story Shorts uses a YouTube-safe vertical composition: header 13.5%, post info to 27%, body to 82%, bottom 18% kept clear for platform UI.
    const captionTop=h*.305,captionH=Math.min(h*.225,Math.max(h*.105,lines*fontSize*1.30+h*.018));
    const mediaY=Math.min(h*.575,captionTop+captionH+h*.018),mediaBottom=h*.82,mediaH=Math.max(h*.18,mediaBottom-mediaY);
    return {text,lines,captionTop,captionH,media:{x:w*.07,y:mediaY,w:w*.86,h:mediaH},safeBottom:h*.18};
  }
  function mediaRect(w,h,layout,project=null,time=0) {
    if(layout==='story')return project?storyLayout(w,h,project,time).media:{x:w*.07,y:h*.48,w:w*.86,h:h*.43};
    return layout==='fullscreen'?{x:0,y:0,w,h}:{x:0,y:h*(layout==='immersive'?.237:.203),w,h:h*(layout==='immersive'?.763:.594)};
  }
  function mediaGeometry(scene,elapsed,rect,fit) {
    const el=scene?.type==='gif'?(scene.gifFrame||scene.element):scene?.element;if(!el)return null;
    const sw=el.videoWidth||el.naturalWidth||el.displayWidth||el.codedWidth||el.width,sh=el.videoHeight||el.naturalHeight||el.displayHeight||el.codedHeight||el.height;
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
    ctx.drawImage(scene.type==='gif'?(scene.gifFrame||scene.element):scene.element,box.x,box.y,box.w,box.h);ctx.restore();
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
  function drawText(ctx,text,{x,y,w,h,size,letterSpacing=0,color='#fff',italic=false,outline=false,highlight=false,align='center',textAlign='center',font='noto',weight=900,strokeColor='#111111',strokeWidth=null,background=null,padding=0,radius=0,colorRanges=[]}) {
    if(!text)return;
    const fontInfo=window.CutFonts?.get(font);
    // Single-weight custom faces must never request OS-dependent synthetic bold.
    const nativeWeight=fontInfo?.file?400:weight;
    const extraBold=fontInfo?.file&&!fontInfo.fixedBold&&weight>=700;
    const chars=glyphs(text,highlight,color,colorRanges);let lines=[],fontSize=size;
    const spacing=Number.isFinite(letterSpacing)?letterSpacing:0;
    function wrap(){
      ctx.font=`${italic?'italic ':''}${nativeWeight} ${fontSize}px "${window.CutFonts?.get(font).family||'Noto Sans KR'}", sans-serif`;
      lines=[];let line=[],width=0;
      for(const char of chars){
        if(char.c==='\n'){lines.push({glyphs:line,width});line=[];width=0;continue;}
        const cw=ctx.measureText(char.c).width,advance=cw+(line.length?spacing:0);
        if(width+advance>w && line.length){lines.push({glyphs:line,width});line=[];width=0;}
        const nextAdvance=cw+(line.length?spacing:0);
        line.push({...char,width:cw});width+=nextAdvance;
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
    for(const line of lines){let xx=textAlign==='left'?x:textAlign==='right'?x+w-line.width:x+(w-line.width)/2;
      line.glyphs.forEach((g,index)=>{if(outline){ctx.strokeStyle=strokeColor;ctx.lineWidth=strokeWidth??fontSize*.11;ctx.strokeText(g.c,xx,yy);}if(extraBold){ctx.strokeStyle=g.color;ctx.lineWidth=fontSize*.018;ctx.strokeText(g.c,xx,yy);}ctx.fillStyle=g.color;ctx.fillText(g.c,xx,yy);xx+=g.width+(index<line.glyphs.length-1?spacing:0);});yy+=fontSize*1.25;
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
    const loc=locate(project.scenes,time),scene=project.scenes[loc.index],portrait=project.layout==='immersive',fullscreen=project.layout==='fullscreen',story=project.layout==='story';
    const rect=mediaRect(w,h,project.layout,project,time);
    const fit=fullscreen?'cover':project.fit;
    if(scene?.element) {
      await seek(scene,loc.elapsed);
      const candidate=project.scenes[loc.index-1],prior=candidate?.element&&(!Number.isFinite(scene.start)||Math.abs(candidate.end-scene.start)<.001)?candidate:null;const progress=Math.min(1,loc.elapsed/Math.min(.35,scene.duration/2));
      ctx.fillStyle=story?'#fff':'#000';ctx.fillRect(0,0,w,h);drawMedia(ctx,scene,loc.elapsed,rect,fit);
      if(prior&&progress<1&&['dissolve','slide'].includes(scene.transition))await seek(prior,prior.duration);
      if(prior&&progress<1&&scene.transition!=='cut') {
        ctx.save();
        if(scene.transition==='dissolve'){ctx.globalAlpha=1-progress;drawMedia(ctx,prior,prior.duration,rect,fit);}
        else if(scene.transition==='slide'){ctx.beginPath();ctx.rect(0,rect.y,w*(1-progress),rect.h);ctx.clip();drawMedia(ctx,prior,prior.duration,rect,fit);}
        else{ctx.globalAlpha=1-progress;ctx.fillStyle=scene.transition==='flash'?'#fff':'#000';ctx.fillRect(0,rect.y,w,rect.h);}
        ctx.restore();
      }
    }else{ctx.fillStyle=story?'#fff':'#000';ctx.fillRect(0,0,w,h);if(!project.scenes.length)drawText(ctx,'이미지·영상 컷을\n불러와 주세요',{x:story?rect.x:w*.1,y:story?rect.y:h*.35,w:story?rect.w:w*.8,h:story?rect.h:h*.25,size:w*.065,color:'#b9b9b9'});}
    if(story){
      const scale=w/1080,headerH=h*.135,headerColor=project.storyHeaderTextColor||'#ffffff';
      ctx.fillStyle=project.storyHeaderColor||'#d94b53';ctx.fillRect(0,0,w,headerH);
      // Fixed story-board navigation marks, kept inside the header safe area.
      ctx.save();ctx.strokeStyle=headerColor;ctx.lineWidth=Math.max(3,7*scale);ctx.lineCap='round';ctx.lineJoin='round';
      const cy=headerH*.52,chevX=w*.075,chevW=w*.022,chevH=headerH*.18;
      ctx.beginPath();ctx.moveTo(chevX+chevW,cy-chevH);ctx.lineTo(chevX,cy);ctx.lineTo(chevX+chevW,cy+chevH);ctx.stroke();
      const menuX=w*.89,menuW=w*.055,menuGap=headerH*.105;for(let k=-1;k<=1;k++){ctx.beginPath();ctx.moveTo(menuX,cy+k*menuGap);ctx.lineTo(menuX+menuW,cy+k*menuGap);ctx.stroke();}ctx.restore();
      drawText(ctx,project.storyChannel||'채널명',{x:w*.16,y:0,w:w*.68,h:headerH,size:(project.storyChannelSize||42)*scale,color:headerColor,weight:900,font:project.storyChannelFont||'noto'});
      drawText(ctx,project.storyTitle||'썰쇼츠 제목',{x:w*.055,y:h*.155,w:w*.89,h:h*.075,size:(project.storyTitleSize||76)*scale,color:'#111111',weight:900,font:project.storyTitleFont||'ohsquare',textAlign:'left'});
      drawText(ctx,project.storyMeta||'19:00 | 조회수 : 132,343 | 댓글 : 33',{x:w*.055,y:h*.225,w:w*.89,h:h*.028,size:28*scale,color:'#777777',weight:400,font:'noto',textAlign:'left'});
      ctx.strokeStyle='#c9c9c9';ctx.lineWidth=Math.max(1,2*scale);ctx.beginPath();ctx.moveTo(w*.035,h*.27);ctx.lineTo(w*.965,h*.27);ctx.stroke();
      const cue=project.cues.find(c=>time>=c.start&&time<c.end),layout=storyLayout(w,h,project,time);
      if(cue){const style=window.CaptionStyle.resolve(cue,project);drawText(ctx,layout.text,{x:w*.07,y:layout.captionTop,w:w*.86,h:layout.captionH,size:style.size*scale,letterSpacing:style.letterSpacing*scale,color:style.color,colorRanges:project.storyCaptionMode==='cumulative'?[]:(cue.colorRanges||[]),highlight:project.storyCaptionMode!=='cumulative',italic:style.italic,outline:style.strokeWidth>0,strokeColor:style.strokeColor,strokeWidth:style.strokeWidth*scale,align:'center',font:style.font,weight:style.bold?900:400,background:style.background?{color:style.backgroundColor,opacity:style.backgroundOpacity}:null,padding:style.padding*scale,radius:style.radius*scale});}
      return loc;
    }
    drawText(ctx,project.title,{x:w*((project.titleX??50)/100-.45),y:h*((project.titleY??((portrait?.07:.04)*100))/100),w:w*.90,h:h*(portrait?.155:.15),size:(project.titleSize||86.4)*w/1080,italic:!!project.titleItalic,color:project.titleColor||'#ffe22e',colorRanges:project.titleColorRanges||[],weight:project.titleBold===false?400:900,align:'bottom',font:project.titleFont||'noto',...textStroke(project,'title',fullscreen,w/1080)});
    const cue=project.cues.find(c=>time>=c.start&&time<c.end);
    if(cue){
      const style=window.CaptionStyle.resolve(cue,project),scale=w/1080;
      const customPosition=Number.isFinite(style.y)||fullscreen;
      const center=(style.y??window.CaptionStyle.defaultY(project.layout))/100*h;
      const areaH=customPosition?Math.min(h*.30,center*2,(h-center)*2):h*(portrait?.16:.14);
      const y=customPosition?Math.max(0,Math.min(h-areaH,center-areaH/2)):(portrait?h*.635:h*.64);
      drawText(ctx,cue.text,{x:w*.07,y,w:w*.86,h:areaH,size:style.size*scale,letterSpacing:style.letterSpacing*scale,color:style.color,colorRanges:cue.colorRanges||[],highlight:true,italic:style.italic,outline:style.strokeWidth>0,strokeColor:style.strokeColor,strokeWidth:style.strokeWidth*scale,align:customPosition||portrait?'center':'bottom',font:style.font,weight:style.bold?900:400,background:style.background?{color:style.backgroundColor,opacity:style.backgroundOpacity}:null,padding:style.padding*scale,radius:style.radius*scale});
    }
    drawText(ctx,project.channel,{x:w*((project.channelX??50)/100-.46),y:h*((project.channelY??((fullscreen||portrait?.92:.817)*100))/100),w:w*.92,h:h*.06,size:(project.channelSize||43.2)*w/1080,italic:!!project.channelItalic,color:project.channelColor||'#dddddd',weight:project.channelBold===false?400:900,font:project.channelFont||'noto',...textStroke(project,'channel',fullscreen||portrait,w/1080)});
    return loc;
  }
  let fontSignature='',fontPromise=Promise.resolve();
  async function fonts(project){
    const text=[project.title,project.channel,project.storyChannel,project.storyTitle,project.storyMeta,...project.cues.map(c=>c.text)].join('')||'가나다';
    const ids=[...new Set([project.titleFont||'noto',project.channelFont||'noto',project.storyTitleFont||'ohsquare',project.storyChannelFont||'noto',...project.cues.map(c=>window.CaptionStyle.resolve(c,project).font)])];
    const signature=ids.join('|')+'::'+text;
    if(signature!==fontSignature){
      fontSignature=signature;
      fontPromise=(async()=>{await Promise.all(ids.map(id=>window.CutFonts.ensure(id,text)));await document.fonts.ready;})();
    }
    await fontPromise;
  }
  return {draw,locate,motion,cutDuration,fonts,transform,mediaRect,mediaGeometry,storyLayout,storyCaptionText};
})();
