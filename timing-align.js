/* v39 narration-aware caption timing alignment. Pure helper exposed as window.CutflowTimingAlign. */
(()=>{
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const median=a=>{if(!a.length)return 0;const b=[...a].sort((x,y)=>x-y),m=Math.floor(b.length/2);return b.length%2?b[m]:(b[m-1]+b[m])/2;};
  const quantile=(a,q)=>{if(!a.length)return 0;const b=[...a].sort((x,y)=>x-y),p=clamp(q,0,1)*(b.length-1),lo=Math.floor(p),hi=Math.ceil(p);return lo===hi?b[lo]:b[lo]+(b[hi]-b[lo])*(p-lo);};
  const chars=s=>Math.max(1,String(s||'').replace(/\[\[|\]\]|[\s\p{P}\p{S}]/gu,'').length);

  function analyze(buffer,{frameSec=.02,minPause=.06}={}){
    if(!buffer||!buffer.length||!buffer.sampleRate)return {candidates:[],pauses:[],frameSec,peak:0};
    const channels=Math.max(1,buffer.numberOfChannels||1),sr=buffer.sampleRate,hop=Math.max(1,Math.floor(sr*frameSec)),frames=Math.ceil(buffer.length/hop),rms=new Float32Array(frames);
    let peak=0;
    for(let fi=0;fi<frames;fi++){
      const a=fi*hop,b=Math.min(buffer.length,a+hop);let sum=0,count=0;
      for(let ch=0;ch<channels;ch++){
        const data=buffer.getChannelData(ch);
        for(let j=a;j<b;j+=2){const v=data[j]||0;sum+=v*v;count++;}
      }
      const value=Math.sqrt(sum/Math.max(1,count));rms[fi]=value;peak=Math.max(peak,value);
    }
    if(peak<=1e-8)return {candidates:[],pauses:[],frameSec,peak:0,rms};
    const positive=Array.from(rms).filter(v=>v>1e-7),p20=quantile(positive,.2),p35=quantile(positive,.35),med=median(positive);
    // Adaptive threshold: quiet enough relative to both the recording peak and its own noise floor.
    const threshold=clamp(Math.max(peak*.045,p20*1.35),peak*.018,Math.min(peak*.16,Math.max(p35*.9,med*.42)));
    const smooth=new Float32Array(frames);
    for(let i=0;i<frames;i++){let s=0,n=0;for(let k=Math.max(0,i-2);k<=Math.min(frames-1,i+2);k++){s+=rms[k];n++;}smooth[i]=s/n;}
    const pauses=[];let begin=-1;
    const finish=end=>{
      if(begin<0)return;const dur=(end-begin)*frameSec;
      if(dur>=minPause){
        let min=Infinity,avg=0;for(let k=begin;k<end;k++){min=Math.min(min,smooth[k]);avg+=smooth[k];}avg/=Math.max(1,end-begin);
        const center=(begin+end)*.5*frameSec,quiet=1-clamp(avg/Math.max(threshold,1e-8),0,1),strength=clamp(.35+dur/.45*.35+quiet*.3,0,1);
        pauses.push({time:center,start:begin*frameSec,end:end*frameSec,duration:dur,strength,type:'pause',energy:min/peak});
      }
      begin=-1;
    };
    for(let i=0;i<frames;i++){if(smooth[i]<=threshold){if(begin<0)begin=i;}else finish(i);}finish(frames);

    // Add soft valleys so natural phrase breaks still work when the narrator never becomes fully silent.
    const valleys=[];const radius=Math.max(3,Math.round(.10/frameSec));
    for(let i=radius;i<frames-radius;i++){
      const v=smooth[i];if(v>Math.max(threshold*2.4,peak*.22))continue;
      let local=true;for(let k=i-radius;k<=i+radius;k++){if(smooth[k]<v*.985){local=false;break;}}
      if(!local)continue;
      const away=pauses.some(p=>Math.abs(p.time-i*frameSec)<.18);if(away)continue;
      const quiet=1-clamp(v/Math.max(peak*.22,1e-8),0,1);valleys.push({time:i*frameSec,start:i*frameSec,end:i*frameSec,duration:0,strength:clamp(.12+quiet*.48,0,.58),type:'valley',energy:v/peak});
      i+=radius;
    }
    const candidates=[...pauses,...valleys].sort((a,b)=>a.time-b.time);
    return {candidates,pauses,frameSec,peak,threshold,rms};
  }

  function alignTexts(texts,start,end,candidates=[],opts={}){
    texts=(texts||[]).map(String);start=Number(start)||0;end=Number(end)||start;
    const n=texts.length,duration=Math.max(0,end-start);
    if(!n||duration<=0)return {boundaries:[start,end],pauseHits:0,valleyHits:0,fallbackCount:Math.max(0,n-1)};
    if(n===1)return {boundaries:[start,end],pauseHits:0,valleyHits:0,fallbackCount:0};
    const minDur=Math.min(Number(opts.minDuration)||.12,Math.max(.05,duration/(n*2.25)));
    const weights=texts.map(chars),sum=weights.reduce((a,b)=>a+b,0)||n,targets=[];let acc=0;
    for(let i=0;i<n-1;i++){acc+=weights[i];targets.push(start+duration*acc/sum);}
    const avg=duration/n,windowSec=clamp(Number(opts.searchWindow)||avg*.48,.28,1.15),boundaries=[start];
    let pauseHits=0,valleyHits=0,fallbackCount=0;
    for(let i=0;i<targets.length;i++){
      const target=targets[i],min=boundaries[i]+minDur,max=end-(n-i-1)*minDur;
      const eligible=candidates.filter(c=>c.time>=min&&c.time<=max&&Math.abs(c.time-target)<=windowSec);
      let best=null,bestScore=Infinity;
      for(const c of eligible){
        const dist=Math.abs(c.time-target)/windowSec;
        const typeBonus=c.type==='pause'?.24:0;
        const score=dist*.76-(Number(c.strength)||0)*.34-typeBonus;
        if(score<bestScore){bestScore=score;best=c;}
      }
      // Avoid snapping to weak valleys far away from the text-proportional target.
      const accept=best&&(best.type==='pause'||best.strength>=.34||Math.abs(best.time-target)<=windowSec*.35);
      const value=clamp(accept?best.time:target,min,max);boundaries.push(value);
      if(accept){if(best.type==='pause')pauseHits++;else valleyHits++;}else fallbackCount++;
    }
    boundaries.push(end);
    return {boundaries,pauseHits,valleyHits,fallbackCount,targets,searchWindow:windowSec};
  }

  window.CutflowTimingAlign={analyze,alignTexts,chars};
})();
