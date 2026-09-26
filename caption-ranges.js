/* UTF-16 offsets match textarea selectionStart/End. Formatting never changes text. */
window.CaptionRanges=(()=>{
  const valid=color=>/^#[0-9a-f]{6}$/i.test(color||'');
  function expand(text,ranges=[]){const colors=Array(text.length).fill(null);for(const r of ranges){if(valid(r.color))for(let i=Math.max(0,r.start);i<Math.min(text.length,r.end);i++)colors[i]=r.color;}return colors;}
  function pack(colors){const out=[];for(let i=0;i<colors.length;){const start=i,color=colors[i];while(i<colors.length&&colors[i]===color)i++;if(color)out.push({start,end:i,color});}return out;}
  function apply(text,ranges,start,end,color){const colors=expand(text,ranges);for(let i=Math.max(0,start);i<Math.min(text.length,end);i++)colors[i]=valid(color)?color:null;return pack(colors);}
  function edit(before,after,ranges){let a=0;while(a<before.length&&a<after.length&&before[a]===after[a])a++;let b=before.length,c=after.length;while(b>a&&c>a&&before[b-1]===after[c-1]){b--;c--;}const colors=expand(before,ranges);return pack([...colors.slice(0,a),...Array(c-a).fill(null),...colors.slice(b)]);}
  function split(text,ranges){const colors=expand(text,ranges),chars=[],kept=[];for(let i=0;i<text.length;){if(['[[',']]'].includes(text.slice(i,i+2))){i+=2;continue;}chars.push(text[i]);kept.push(colors[i++]);}const clean=chars.join(''),middle=Math.floor(clean.length/2);let at=clean.lastIndexOf(' ',middle);if(at<=0)at=middle;if(at>0&&/[\uDC00-\uDFFF]/.test(clean[at])&&/[\uD800-\uDBFF]/.test(clean[at-1]))at--;
    return [[0,at],[at,clean.length]].map(([start,end])=>{while(start<end&&/\s/.test(clean[start]))start++;while(end>start&&/\s/.test(clean[end-1]))end--;return {text:clean.slice(start,end),ranges:pack(kept.slice(start,end))};});}
  function merge(a,b){return pack([...expand(a.text,a.colorRanges),null,...expand(b.text,b.colorRanges)]);}
  return {apply,edit,split,merge};
})();
