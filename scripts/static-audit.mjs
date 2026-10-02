import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const fail=message=>{console.error('AUDIT FAIL:',message);process.exitCode=1;};
const pass=message=>console.log('AUDIT PASS:',message);

const index=read('index.html');
const refs=[...index.matchAll(/(?:src|href)="\.\/([^"?]+\.(?:js|css))(?:\?[^"]*)?"/g)].map(m=>m[1]);
for(const file of refs){
  if(!fs.existsSync(path.join(root,file)))fail(`Referenced asset is missing: ${file}`);
}
if(!process.exitCode)pass('all referenced JS/CSS assets exist');

const duplicates=refs.filter((file,i,list)=>list.indexOf(file)!==i);
if(duplicates.length)fail(`duplicate asset includes: ${[...new Set(duplicates)].join(', ')}`);
else pass('no duplicate JS/CSS includes');

const htmlIds=[...index.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);
const duplicateIds=htmlIds.filter((id,i,list)=>list.indexOf(id)!==i);
if(duplicateIds.length)fail(`duplicate static HTML ids: ${[...new Set(duplicateIds)].join(', ')}`);
else pass('no duplicate static HTML ids');

const firstPartyJs=refs.filter(file=>file.endsWith('.js')&&!file.startsWith('assets/'));
for(const file of firstPartyJs){
  try{new Function(read(file));}
  catch(error){fail(`syntax error in ${file}: ${error.message}`);}
}
if(!process.exitCode)pass('all first-party JavaScript parses');

const mobile=read('mobile-v42.js');
const history=read('history.js');
const mobileCss=read('mobile-v42.css');

const retiredMarkers=[
  ['mobile-v42.js','mobile-editor',mobile],
  ['mobile-v42.js','requestFullscreen',mobile],
  ['mobile-v42.js','previewDialog.open',mobile],
  ['history.js','mobileOpen',history],
  ['history.js','mobileSettings',history],
  ['history.js','desktopSettings',history],
  ['history.js','mobileSceneGrid',history],
  ['history.js','mobileSceneStrip',history],
  ['history.js','mobileTiming',history],
  ['timing-editor.js','mobileEditor',read('timing-editor.js')],
  ['timing-editor.js','mobileTiming',read('timing-editor.js')],
  ['media-transform.css','mobileEditor',read('media-transform.css')],
  ['index.html','history.css',index],
  ['index.html','undoCuesBtn',index],
  ['app.js','cueHistory',read('app.js')],

  ['style-editor.js','CutflowCaptionStyle',read('style-editor.js')],
  ['project-store.css','.project-tools',read('project-store.css')],
  ['project-store.css','.project-save-status',read('project-store.css')],
  ['app.js','lastBlob',read('app.js')],
  ['app.js','lastFilename',read('app.js')],
];
for(const [file,marker,source] of retiredMarkers){
  if(source.includes(marker))fail(`retired marker "${marker}" returned in ${file}`);
}

if(/window\.CutflowTimeline\s*=/.test(read('app.js'))||/window\.CutflowTimeline\s*=/.test(read('timing-editor.js'))){
  fail('retired CutflowTimeline API returned');
}else pass('retired CutflowTimeline API remains removed while CutflowTimelineBridge is allowed');
if(!process.exitCode)pass('retired compatibility paths remain removed');

if(!/id="v42FullStage" width="1080" height="1920"/.test(mobile)){
  fail('fullscreen mobile canvas must stay 1080 x 1920');
}else pass('fullscreen mobile canvas is 1080 x 1920');

if(!mobile.includes("bindMobileTap($('v42FullPlay')")){
  fail('fullscreen play/pause control is not bound through the stable mobile tap handler');
}else pass('fullscreen play/pause uses stable mobile tap binding');

if(!mobileCss.includes('canonical mobile editing runtime')){
  fail('canonical mobile runtime block is missing');
}else pass('canonical mobile runtime block exists');

if(!mobileCss.includes('.v42-full-controls')){
  fail('persistent fullscreen playback bar styles are missing');
}else pass('persistent fullscreen playback bar exists');

if(/for\(const id of \[[^\]]*nowPlaying/.test(mobile)){
  fail('mobile UI must not observe nowPlaying because playback rewrites it every frame');
}else pass('mobile playback status is not tied to a frame-by-frame MutationObserver');

if(!mobile.includes('setSourcePreviewSize(1080,1920)')){
  fail('fullscreen open path no longer switches the source preview to 1080 x 1920');
}else pass('fullscreen open path switches to native 1080 x 1920');

if(!mobile.includes("setSourcePreviewSize(window.CutflowUI?.mobileActive?540:1080,window.CutflowUI?.mobileActive?960:1920)")){
  fail('fullscreen close path no longer restores the normal mobile preview size');
}else pass('fullscreen close path restores the normal mobile preview size');

const cssRefs=refs.filter(file=>file.endsWith('.css'));
for(const file of cssRefs){
  const css=read(file);
  if(/@media[^{}]+\{\s*\}/g.test(css))fail(`empty media query in ${file}`);
  if(/\/\*\s*v\d+(?:\.\d+)*/i.test(css))fail(`patch-history comment returned in ${file}`);
}
if(!process.exitCode)pass('stylesheets contain no empty media queries or version-patch comments');

if(process.exitCode){
  console.error('\nStatic audit failed.');
  process.exit(process.exitCode);
}
console.log('\nStatic audit completed successfully.');
