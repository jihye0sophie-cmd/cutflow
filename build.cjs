// Static distribution: publish only application code and bundled runtime assets.
const fs=require('node:fs'),path=require('node:path');
const root=__dirname,dist=path.join(root,'dist');
fs.rmSync(dist,{recursive:true,force:true});fs.mkdirSync(dist,{recursive:true});
for(const name of ['index.html','style.css','studio.css','font-catalog.js','caption-style.js','renderer.js','audio-mixer.js','encoder.js','caption-ranges.js','app.js','style-editor.js','bgm-editor.js','studio-tokens.css','scene-ui.js','mobile-ui.js','mobile-ui.css','desktop-ui.js','desktop-ui.css']){
  fs.copyFileSync(path.join(root,name),path.join(dist,name));
}
fs.cpSync(path.join(root,'assets'),path.join(dist,'assets'),{recursive:true});
console.log('Built static studio in dist/');
