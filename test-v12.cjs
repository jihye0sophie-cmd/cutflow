// Browser regression: real uploads, style scopes, compositor pixels and MP4 exports.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {execFileSync}=require('node:child_process');
const {chromium}=require(path.join(process.env.CUTFLOW_QA_MODULES||process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright-core'));
const chromiumPackage=require(process.env.CUTFLOW_CHROMIUM||path.join(__dirname,'../qa-deps/node_modules/@sparticuz/chromium/build/index.js'));
const packaged=chromiumPackage.default||chromiumPackage;
const root=__dirname,out=process.env.CUTFLOW_QA_OUTPUT||path.join(__dirname,'../qa-results');fs.mkdirSync(out,{recursive:true});
const ff=(args)=>execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y',...args]);
ff(['-f','lavfi','-i','testsrc2=size=600x900:rate=1','-frames:v','1',`${out}/image.png`]);
ff(['-f','lavfi','-i','testsrc2=size=480x720:rate=30','-t','4','-c:v','libvpx-vp9','-b:v','400k',`${out}/video.webm`]);
ff(['-f','lavfi','-i','sine=frequency=440:duration=3','-c:a','pcm_s16le',`${out}/voice.wav`]);
ff(['-f','lavfi','-i','sine=frequency=220:duration=1','-c:a','pcm_s16le',`${out}/music.wav`]);
const server=http.createServer((req,res)=>{
  const file=path.join(root,new URL(req.url,'http://localhost').pathname==='/'?'index.html':decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':file.endsWith('.woff2')?'font/woff2':'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
const summary=[];
(async()=>{
  server.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));let browser;
  try{
    browser=await chromium.launch({executablePath:await packaged.executablePath(),args:packaged.args,headless:true});
    const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.addStyleTag({content:'html{scroll-behavior:auto!important}'});
    await page.locator('#titleInput').fill('매일 한 걸음씩');await page.locator('#channelInput').fill('@나의기록');
    await page.locator('#fileInput').setInputFiles([`${out}/image.png`,`${out}/video.webm`]);
    await page.waitForFunction(()=>scenes.length===2&&loading===0);
    assert.equal(await page.locator('.scene-row').count(),2);
    await page.locator('.scene-row').nth(1).locator('[data-action="trim"]').fill('0.3');
    await page.locator('.scene-row').nth(1).locator('[data-action="trim"]').dispatchEvent('change');
    await page.locator('#audioInput').setInputFiles(`${out}/voice.wav`);await page.waitForFunction(()=>audioBuffer&&loading===0);
    await page.locator('#bgmInput').setInputFiles(`${out}/music.wav`);await page.waitForFunction(()=>bgmBuffer&&loading===0);
    await page.locator('#scriptInput').fill('작은 시작이 만든 변화\n오늘의 한 걸음을 기록해요');await page.click('#buildCuesBtn');
    assert.equal(await page.locator('.cue-row').count(),2);assert.equal(await page.locator('.scene-row').count(),0);
    const slider=async(id,value)=>page.locator('#'+id).evaluate((input,value)=>{input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));},value);
    const initial=await page.evaluate(()=>cues.map(({style,color,...cue})=>cue));
    // All requested title/channel settings use the same project sent to export.
    await page.locator('#titleSize').fill('80');await page.locator('#titleItalic').check();await page.locator('#titleBold').uncheck();
    await page.locator('#titleColor').fill('#70d6ff');
    await page.locator('#channelSize').fill('40');await page.locator('#channelItalic').check();await page.locator('#channelBold').uncheck();
    await page.locator('#channelColor').fill('#b8ff38');
    assert.deepEqual(await page.evaluate(()=>[project().titleSize,project().titleBold,project().titleItalic,project().titleColor,project().channelSize,project().channelBold,project().channelItalic,project().channelColor]),[80,false,true,'#70d6ff',40,false,true,'#b8ff38']);
    // Capture real canvas operations as well as pixels, including the Simple->Bold regression.
    await page.locator('#captionStylePanel summary').click();await page.selectOption('#stylePreset','simple');await page.locator('#captionBold').check();
    await page.locator('#captionItalic').check();await page.locator('#captionBackground').check();
    await page.locator('#captionColor').fill('#ff982f');await page.locator('#captionStrokeColor').fill('#222222');
    await slider('captionSize',68);await slider('captionStroke',4);
    await page.locator('#captionBackgroundColor').fill('#152538');await slider('captionOpacity',0.6);
    await slider('captionPadding',20);await slider('captionRadius',8);
    await page.selectOption('#captionPosition','82');
    assert.equal(await page.evaluate(()=>cues[1].style),undefined);
    await page.selectOption('#styleScope','all');
    let styles=await page.evaluate(()=>cues.map(c=>CaptionStyle.resolve(c,project())));assert.deepEqual(styles[0],styles[1]);
    assert.deepEqual(await page.evaluate(()=>cues.map(({style,color,...cue})=>cue)),initial);
    await page.selectOption('#styleScope','current');await slider('captionSize',76);
    assert.equal(await page.evaluate(()=>cues[1].style.size),68);
    await page.click('#applyAllCaptionStyle');assert.equal(await page.evaluate(()=>cues.every(c=>c.style.size===76)),true);
    // An individual timeline edit followed by reapply in existing All mode.
    await page.locator('.cue-row').nth(1).locator('[data-action="color"]').selectOption('#ffffff');
    await page.selectOption('#styleCue',await page.evaluate(()=>cues[0].id));
    await page.click('#applyAllCaptionStyle');assert.equal(await page.evaluate(()=>cues.every(c=>c.style.color==='#ff982f')),true);
    await page.click('#undoCuesBtn');assert.equal(await page.evaluate(()=>cues[1].style.color),'#ffffff');await page.click('#applyAllCaptionStyle');
    await page.click('#addCueBtn');styles=await page.evaluate(()=>cues.map(c=>CaptionStyle.resolve(c,project())));assert.deepEqual(styles[0],styles[2]);
    await page.click('#undoCuesBtn');assert.equal(await page.locator('.cue-row').count(),2);
    await page.click('#buildCuesBtn');styles=await page.evaluate(()=>cues.map(c=>CaptionStyle.resolve(c,project())));assert.deepEqual(styles[0],styles[1]);assert.equal(styles[0].size,76);
    await page.click('#undoCuesBtn');
    const canvasChecks=await page.evaluate(async()=>{
      const p=project(),canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1920;const ctx=canvas.getContext('2d'),calls=[];
      const fill=ctx.fillText.bind(ctx);ctx.fillText=function(text,x,y){calls.push({text,font:this.font,color:this.fillStyle});fill(text,x,y);};
      await CutRenderer.draw(canvas,p,0);const regular=canvas.toDataURL();await CutRenderer.draw(canvas,{...p,titleBold:true},0);const bold=canvas.toDataURL();
      return {changed:regular!==bold,calls:calls.slice(0,[...p.title,...p.cues[0].text,...p.channel].length)};
    });
    assert.ok(canvasChecks.changed,'Title bold changes actual pixels');console.log('Canvas fonts',JSON.stringify([...new Set(canvasChecks.calls.map(c=>c.font+' '+c.color))]));
    assert.ok(canvasChecks.calls.some(c=>c.color==='#70d6ff'&&c.font.includes('italic')&&c.font.includes('80px')&&!c.font.includes('900')));
    assert.ok(canvasChecks.calls.some(c=>c.color==='#ff982f'&&c.font.includes('italic 900 76px')),'Simple preset must not pin bold to 400');
    assert.ok(canvasChecks.calls.some(c=>c.color==='#b8ff38'&&c.font.includes('italic')&&c.font.includes('40px')&&!c.font.includes('900')));
    for(const id of await page.evaluate(()=>CutFonts.list.map(f=>f.id))){
      await page.selectOption('#titleFont',id);await page.selectOption('#channelFont',id);await page.selectOption('#captionFont',id);
      await page.evaluate(()=>CutRenderer.fonts(project()));
    }
    await page.selectOption('#titleFont','noto');await page.selectOption('#channelFont','noto');await page.selectOption('#captionFont','noto');
    summary.push('All text controls, title bold pixels, Simple-to-Bold, current/all/reapply/undo/new cue/regeneration and all 7 fonts passed.');console.log(summary.at(-1));
    // Timeline/media regressions remain exercised through actual UI interactions.
    await page.locator('.cue-row').nth(0).locator('[data-action="end"]').fill('1.2');await page.locator('.cue-row').nth(0).locator('[data-action="end"]').dispatchEvent('change');
    await page.locator('.cue-row').nth(1).locator('[data-action="start"]').fill('1.5');await page.locator('.cue-row').nth(1).locator('[data-action="start"]').dispatchEvent('change');
    assert.equal(await page.evaluate(()=>CutRenderer.locate(project().scenes,1.3).index),-1);
    await page.locator('.cue-row').nth(1).locator('[data-action="trim"]').fill('0.6');await page.locator('.cue-row').nth(1).locator('[data-action="trim"]').dispatchEvent('change');
    await page.locator('.cue-row').nth(1).locator('[data-action="split"]').click();assert.equal(await page.locator('.cue-row').count(),3);
    assert.equal(await page.evaluate(()=>project().scenes[2].trimStart),1.35);await page.click('#undoCuesBtn');
    await page.locator('.cue-row').nth(0).locator('[data-action="merge"]').click();assert.equal(await page.locator('.cue-row').count(),1);await page.click('#undoCuesBtn');
    await page.locator('.cue-row').nth(1).locator('[data-action="media"]').selectOption('');assert.ok(await page.locator('#exportBtn').isDisabled());await page.click('#undoCuesBtn');
    for(const motion of await page.evaluate(()=>Object.keys(motionLabels))){await page.locator('.cue-row').nth(0).locator('[data-action="motion"]').selectOption(motion);await page.evaluate(()=>CutRenderer.draw($('stage'),project(),.4));}
    await page.click('#randomMotionBtn');assert.equal(await page.evaluate(()=>timelineScenes()[1].motion),'still');
    for(const transition of ['cut','dissolve','fade','flash','slide']){
      await page.locator('.cue-row').nth(0).locator('[data-action="end"]').fill('1.5');await page.locator('.cue-row').nth(0).locator('[data-action="end"]').dispatchEvent('change');
      await page.locator('.cue-row').nth(1).locator('[data-action="transition"]').selectOption(transition);await page.evaluate(()=>CutRenderer.draw($('stage'),project(),1.6));
    }
    await page.evaluate(()=>jump(0));await page.click('#playBtn');await page.waitForFunction(()=>playing&&currentTime()>.2);await page.click('#playBtn');assert.equal(await page.evaluate(()=>playing),false);
    await page.click('#nextBtn');assert.equal(await page.evaluate(()=>currentTime()),1.5);await page.click('#prevBtn');assert.equal(await page.evaluate(()=>currentTime()),0);
    await page.locator('#bgmStart').fill('0.2');await slider('bgmVolume',15);await page.selectOption('#bgmRepeat','stop');await page.selectOption('#bgmRepeat','loop');
    await page.locator('#bgmFadeIn').fill('0.1');await page.locator('#bgmFadeOut').fill('0.2');
    assert.equal(await page.evaluate(()=>totalDuration()),3);
    summary.push('Real image/video/audio/BGM uploads, clip-only and cue editing, gaps, trim, split/merge/undo, missing-media gate, all camera paths/transitions and playback passed.');console.log(summary.at(-1));
    await page.evaluate(()=>window.scrollTo(0,document.querySelector('#titleInput').getBoundingClientRect().top+scrollY-120));
    await page.screenshot({path:`${out}/desktop.png`});
    for(const width of [390,760,1024,1440]){
      await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`No overflow at ${width}`);
      assert.equal(await page.locator('.preview-panel').evaluate(e=>getComputedStyle(e).position),width<=760?'static':'fixed');
    }
    await page.setViewportSize({width:390,height:844});await page.locator('#titleInput').scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/mobile.png`});await page.setViewportSize({width:1440,height:1000});
    // Cancel an export, then perform actual H.264/AAC downloads from all templates.
    await page.click('#exportBtn');await page.click('#cancelExportBtn');await page.waitForFunction(()=>!exporting,null,{timeout:30000});assert.match(await page.locator('#exportStatus').textContent(),/취소/);await page.click('#closeExportBtn');
    for(const [layout,width] of [['framed',1080],['immersive',720],['fullscreen',720]]){
      await page.selectOption('#layoutSelect',layout);await page.selectOption('#resolutionSelect',String(width));
      const expected=await page.evaluate(async width=>{const c=document.createElement('canvas');c.width=width;c.height=width*16/9;await CutRenderer.draw(c,project(),0);return c.toDataURL().split(',')[1];},width);
      fs.writeFileSync(`${out}/${layout}-expected.png`,Buffer.from(expected,'base64'));
      await page.click('#exportBtn');await page.waitForFunction(()=>!exporting,null,{timeout:240000});assert.match(await page.locator('#exportStatus').textContent(),/MP4 완성/);
      const pending=page.waitForEvent('download');await page.click('#downloadLink');await(await pending).saveAs(`${out}/${layout}.mp4`);
      const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','stream=codec_name,codec_type,width,height:format=duration','-of','json',`${out}/${layout}.mp4`],{encoding:'utf8'}));
      assert.ok(probe.streams.some(s=>s.codec_name==='h264'&&s.width===width&&s.height===width*16/9));assert.ok(probe.streams.some(s=>s.codec_name==='aac'));assert.ok(Math.abs(Number(probe.format.duration)-3)<.08);
      ff(['-i',`${out}/${layout}.mp4`,'-frames:v','1',`${out}/${layout}-actual.png`]);
      const mae=Number(execFileSync(process.env.CODEX_PRIMARY_RUNTIME_PYTHON||'python3',['-c','from PIL import Image; import numpy as np,sys; a=np.array(Image.open(sys.argv[1]).convert("RGB"),dtype=float); b=np.array(Image.open(sys.argv[2]).convert("RGB"),dtype=float); print(np.abs(a-b).mean())',`${out}/${layout}-expected.png`,`${out}/${layout}-actual.png`],{encoding:'utf8'}));
      assert.ok(mae<8,`${layout} export/preview pixels MAE ${mae}`);summary.push(`${layout}: ${width}p H264/AAC, 3 seconds, preview/export pixel MAE ${mae.toFixed(3)}.`);console.log(summary.at(-1));await page.click('#closeExportBtn');
    }
    assert.deepEqual(errors,[]);summary.push('Desktop/mobile layout, cancellation/retry, all 3 exports and zero browser/resource errors passed.');
    fs.writeFileSync(`${out}/results.json`,JSON.stringify({passed:true,checks:summary},null,2));console.log(summary.at(-1));
  }finally{await browser?.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
