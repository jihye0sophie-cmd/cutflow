// Static distribution: publish only runtime files referenced by index.html plus bundled assets.
const fs=require('node:fs'),path=require('node:path');
const root=__dirname,dist=path.join(root,'dist');
const indexPath=path.join(root,'index.html');
const index=fs.readFileSync(indexPath,'utf8');

fs.rmSync(dist,{recursive:true,force:true});
fs.mkdirSync(dist,{recursive:true});

const runtimeRefs=[...index.matchAll(/(?:src|href)="\.\/([^"?]+\.(?:js|css))(?:\?[^"]*)?"/g)]
  .map(match=>match[1])
  .filter(name=>!name.startsWith('assets/'));
const files=[...new Set(['index.html','favicon.svg','manifest.webmanifest',...runtimeRefs])];

for(const name of files){
  const source=path.join(root,name);
  if(!fs.existsSync(source))throw new Error(`Missing runtime file referenced by build: ${name}`);
  fs.copyFileSync(source,path.join(dist,name));
}

fs.cpSync(path.join(root,'assets'),path.join(dist,'assets'),{recursive:true});
console.log(`Built Cutflow static studio in dist/ (${files.length} root runtime files + assets/)`);
