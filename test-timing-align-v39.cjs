const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert');
const ctx={window:{}};vm.createContext(ctx);vm.runInContext(fs.readFileSync('timing-align.js','utf8'),ctx);
const A=ctx.window.CutflowTimingAlign;assert(A&&typeof A.alignTexts==='function');
const candidates=[
  {time:2.05,strength:.95,type:'pause'},
  {time:4.12,strength:.9,type:'pause'}
];
let r=A.alignTexts(['짧은 문장','조금 더 긴 문장입니다','마지막 문장'],0,6,candidates);
assert.strictEqual(r.boundaries.length,4);assert(Math.abs(r.boundaries[1]-2.05)<.001);assert(Math.abs(r.boundaries[2]-4.12)<.001);assert.strictEqual(r.pauseHits,2);
r=A.alignTexts(['가','아주 아주 긴 문장입니다'],0,4,[]);assert(r.boundaries[1]>0&&r.boundaries[1]<2);assert.strictEqual(r.fallbackCount,1);

const sr=1000,dur=6,data=new Float32Array(sr*dur);for(let i=0;i<data.length;i++){const t=i/sr;const silent=(t>1.9&&t<2.15)||(t>3.95&&t<4.2);data[i]=silent?0.0002:0.08*Math.sin(i*.13);}
const fake={length:data.length,sampleRate:sr,numberOfChannels:1,getChannelData(){return data;}};const ana=A.analyze(fake);assert(ana.pauses.length>=2);assert(ana.pauses.some(p=>Math.abs(p.time-2.025)<.2));assert(ana.pauses.some(p=>Math.abs(p.time-4.075)<.2));

console.log('v39 timing align tests passed');
