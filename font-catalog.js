/* Add a bundled font here; no user upload or remote font service is required. */
window.CutFonts=(()=>{
  const list=[
    {id:'noto',label:'Noto Sans KR · 기본',family:'Noto Sans KR'},
    {id:'gangwon',label:'강원교육모두 Bold',family:'CF Gangwon',file:'gangwon-modu-bold-fixed.woff2',fixedBold:true},
    {id:'konkon',label:'온글잎 콘콘체',family:'CF Konkon',file:'ongleip-konkon.woff2'},
    {id:'aggro',label:'SB 어그로 Bold',family:'CF Aggro',file:'sb-aggro-bold.woff2',fixedBold:true},
    {id:'danjunghae',label:'카페24 단정해',family:'CF Danjunghae',file:'cafe24-danjunghae.woff2'},
    {id:'ohsquare',label:'Cafe24 Ohsquare',family:'CF Ohsquare',file:'cafe24-ohsquare.woff2'},
    {id:'euljiro',label:'배민 을지로체',family:'CF Euljiro',file:'bm-euljiro.woff2'}
  ];
  const pending=new Map();
  const loadedText=new Set();
  const get=id=>list.find(f=>f.id===id)||list[0];
  async function ensure(id,text='가나다'){
    const f=get(id);
    if(f.file&&!pending.has(f.id)){
      const face=new FontFace(f.family,`url("./assets/fonts/custom/${f.file}")`,{weight:"400",style:"normal"});
      pending.set(f.id,face.load().then(loaded=>{document.fonts.add(loaded);return loaded;}).catch(error=>{pending.delete(f.id);throw error;}));
    }
    if(f.file)await pending.get(f.id);
    else if(!loadedText.has(text)){await Promise.all([document.fonts.load(`400 40px "${f.family}"`,text),document.fonts.load(`900 40px "${f.family}"`,text)]);loadedText.add(text);}
  }
  return {list,get,ensure};
})();
