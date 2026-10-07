/* Shared caption defaults and presets for the editor, preview and MP4. */
window.CaptionStyle=(()=>{
  const palette={white:'#ffffff',yellow:'#eeff00',lime:'#b8ff38',sky:'#70d6ff',red:'#ff4949',orange:'#ff982f'};
  const defaults={font:'noto',size:66,letterSpacing:2,bold:true,italic:true,color:'#ffffff',strokeColor:'#111111',strokeWidth:15,background:false,backgroundColor:'#000000',backgroundOpacity:.55,padding:18,radius:12,y:null,weight:900};
  const templateDefaults={
    framed:{font:'danjunghae',bold:true,italic:true},
    immersive:{font:'ohsquare',bold:false,italic:true},
    fullscreen:{font:'danjunghae',bold:true,italic:true},
    story:{font:'noto',size:55,letterSpacing:1.5,bold:true,italic:false,color:'#111111',strokeWidth:0}
  };
  const presets={
    basic:{...defaults},
    emphasis:{...defaults,color:palette.yellow},
    impact:{...defaults,size:80,strokeWidth:12,italic:false,weight:900},
    box:{...defaults,italic:false,strokeWidth:1,background:true,backgroundOpacity:.6},
    simple:{...defaults,bold:false,italic:false,strokeWidth:0,weight:400}
  };
  function resolve(cue={},project={}){const template=templateDefaults[project.layout]||{};return {...defaults,...template,font:cue.style?.font||template.font||project.subtitleFont||defaults.font,color:palette[cue.color]||cue.color||defaults.color,...cue.style};}
  function defaultY(layout){return layout==='framed'?74.2:layout==='fullscreen'?82:layout==='story'?34:71.5;}
  return {palette,defaults,templateDefaults,presets,resolve,defaultY};
})();
