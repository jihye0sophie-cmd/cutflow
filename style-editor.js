/* Common caption-style scope; interval editing remains in app.js. */
let styleCueId=null;
// Keep template defaults until the user explicitly chooses an outline setting.
const textStrokeOverrides={title:null,channel:null};
function syncTextStrokes(){
  const layout=$('layoutSelect').value;
  for(const kind of ['title','channel']){
    const enabled=$(kind+'StrokeEnabled'),width=$(kind+'StrokeWidth');
    enabled.checked=textStrokeOverrides[kind]??(layout==='fullscreen'||(kind==='channel'&&layout==='immersive'));
    width.disabled=!enabled.checked;
    $(kind+'StrokeValue').textContent=`${Number(width.value)}px`;
  }
}
for(const kind of ['title','channel']){
  $(kind+'StrokeEnabled').addEventListener('input',()=>{
    textStrokeOverrides[kind]=$(kind+'StrokeEnabled').checked;syncTextStrokes();changed();
  });
  $(kind+'StrokeWidth').addEventListener('input',()=>{
    textStrokeOverrides[kind]=$(kind+'StrokeEnabled').checked;syncTextStrokes();changed();
  });
}
$('layoutSelect').addEventListener('input',()=>{syncTextStrokes();changed();});
syncTextStrokes();
const styleFields={font:'captionFont',size:'captionSize',bold:'captionBold',italic:'captionItalic',color:'captionColor',strokeColor:'captionStrokeColor',strokeWidth:'captionStroke',background:'captionBackground',backgroundColor:'captionBackgroundColor',backgroundOpacity:'captionOpacity',padding:'captionPadding',radius:'captionRadius',y:'captionY'};
const fontOptions=CutFonts.list.map(f=>`<option value="${f.id}">${esc(f.label)}</option>`).join('');
['titleFont','channelFont','captionFont'].forEach(id=>$(id).innerHTML=fontOptions);
const paletteNames={white:'흰색',yellow:'노란색',lime:'연두색',sky:'하늘색',red:'빨간색',orange:'주황색'};
const paletteMarkup=action=>Object.entries(CaptionStyle.palette).map(([name,color])=>`<button type="button" class="color-swatch" ${action?`data-action="${action}"`:''} data-color="${color}" style="--swatch:${color}" aria-label="${paletteNames[name]}" title="${paletteNames[name]}"></button>`).join('');
$('captionPalette').innerHTML=paletteMarkup('caption-base');
$('titlePalette').innerHTML=paletteMarkup('title-base');
$('channelPalette').innerHTML=paletteMarkup('channel-base');
$('titleSelectionPalette').innerHTML=paletteMarkup('title-selection');
function styleCue(){return cues.find(c=>c.id===styleCueId)||cues[0];}
function fontNote(id){return CutFonts.get(id).fixedBold?'이 폰트는 굵은 글꼴만 제공됩니다. 일반 굵기는 Noto Sans KR을 선택해 주세요.':'';}
function syncTextStyleNotes(){
  ['title','channel'].forEach(kind=>$(kind+'FontNote').textContent=fontNote($(kind+'Font').value));
}
function styleOutputs(style){
  $('sizeValue').textContent=`${style.size}px`;$('strokeValue').textContent=`${Number(style.strokeWidth.toFixed(2))}px`;
  $('opacityValue').textContent=`${Math.round(style.backgroundOpacity*100)}%`;$('paddingValue').textContent=`${style.padding}px`;$('radiusValue').textContent=`${style.radius}px`;
  $('yValue').textContent=`${style.y??CaptionStyle.defaultY($('layoutSelect').value)}%`;
}
function syncStyleEditor(){
  const cue=styleCue();styleCueId=cue?.id||null;
  $('styleCue').innerHTML=cues.map((c,i)=>`<option value="${c.id}" ${c.id===styleCueId?'selected':''}>구간 ${i+1} · ${c.start.toFixed(2)}–${c.end.toFixed(2)}초</option>`).join('');
  $('styleCue').disabled=!cue;$('captionStyleFields').disabled=!cue;$('applyAllCaptionStyle').disabled=!cue;
  $('styleScopeNote').textContent=!cue?'자막 구간을 먼저 만들어 주세요.':$('styleScope').value==='all'?`전체 ${cues.length}개 자막에 변경한 항목을 즉시 적용합니다. 개별 수정 후에는 위 버튼으로 현재 스타일을 다시 통일할 수 있습니다.`:`구간 ${cues.indexOf(cue)+1}의 자막에만 적용합니다.`;
  const style=CaptionStyle.resolve(cue,project());
  for(const [key,id] of Object.entries(styleFields)){const input=$(id);if(input.type==='checkbox')input.checked=style[key];else input.value=key==='y'?(style.y??CaptionStyle.defaultY($('layoutSelect').value)):style[key];}
  $('captionPosition').value=style.y===null?'default':[20,50,82].includes(style.y)?String(style.y):'custom';
  $('stylePreset').value='';styleOutputs(style);$('captionFontNote').textContent=fontNote(style.font);
}
function selectStyleCue(index,open=false){if(!cues[index])return;styleCueId=cues[index].id;syncStyleEditor();if(open){$('captionStylePanel').open=true;$('captionStylePanel').scrollIntoView({behavior:'smooth',block:'start'});jump(cues[index].start);}}
async function applyCaptionStyle(patch,record=true){
  const cue=styleCue();if(!cue)return;pause();if(record)rememberCues();
  const targets=$('styleScope').value==='all'?cues:[cue];
  targets.forEach(c=>{c.style={...c.style,...patch};if(patch.color)c.color=patch.color;});
  jump(cue.start);renderCues();
  changed();
  try{await CutRenderer.fonts(project());changed();}catch{toast('폰트를 불러오지 못했습니다. 연결을 확인해 주세요.');}
}
function applyAllCaptionStyle(){
  const cue=styleCue();if(!cue)return;
  const style={...CaptionStyle.resolve(cue,project())};
  $('styleScope').value='all';
  applyCaptionStyle(style);
  toast(`${cues.length}개 자막에 현재 스타일을 적용했습니다. 선택 글자색과 [[강조]]는 유지됩니다.`);
}
// Newly created cues inherit the visible shared style only while editing all cues.
window.newCueStyle=()=>{
  const cue=styleCue();if($('styleScope').value!=='all'||!cue)return {};
  const style={...CaptionStyle.resolve(cue,project())};return {style,color:style.color};
};
let activeStyleGesture=null;
$('captionStyleFields').addEventListener('pointerdown',e=>{if(e.target.dataset.style){activeStyleGesture=e.target;rememberCues();}});
$('captionStyleFields').addEventListener('input',e=>{
  const key=e.target.dataset.style;if(!key)return;
  const value=e.target.type==='checkbox'?e.target.checked:['range','number'].includes(e.target.type)?Number(e.target.value):e.target.value;
  applyCaptionStyle({[key]:value},activeStyleGesture!==e.target);
});
document.addEventListener('pointerup',()=>activeStyleGesture=null);
$('captionPalette').onclick=e=>{const button=e.target.closest('[data-color]');if(button)applyCaptionStyle({color:button.dataset.color});};
$('titlePalette').onclick=e=>{const button=e.target.closest('[data-color]');if(!button)return;$('titleColor').value=button.dataset.color;changed();};
$('channelPalette').onclick=e=>{const button=e.target.closest('[data-color]');if(!button)return;$('channelColor').value=button.dataset.color;changed();};
$('titleSelectionPalette').onclick=e=>{const button=e.target.closest('[data-color]');if(!button)return;$('titleSelectionColor').value=button.dataset.color;$('titleSelectionApply')?.click();};
$('captionPosition').onchange=e=>{if(e.target.value!=='custom')applyCaptionStyle({y:e.target.value==='default'?null:Number(e.target.value)});};
$('stylePreset').onchange=e=>{const preset=CaptionStyle.presets[e.target.value];if(preset){const current=CaptionStyle.resolve(styleCue(),project());applyCaptionStyle({...preset,font:current.font,y:current.y});}};
$('styleScope').onchange=()=>{
  if($('styleScope').value==='all')applyAllCaptionStyle();else syncStyleEditor();
};
$('applyAllCaptionStyle').onclick=applyAllCaptionStyle;
$('styleCue').onchange=e=>{styleCueId=e.target.value;syncStyleEditor();jump(styleCue().start);};
const templateTypography={
  framed:{titleFont:'aggro',channelFont:'gangwon',captionFont:'danjunghae',captionBold:true,captionItalic:true},
  immersive:{titleFont:'aggro',channelFont:'gangwon',captionFont:'ohsquare',captionBold:false,captionItalic:true},
  fullscreen:{titleFont:'aggro',channelFont:'gangwon',captionFont:'danjunghae',captionBold:true,captionItalic:true}
};
async function applyTemplateTypography(layout,{applyCues=true,notify=false}={}){
  const preset=templateTypography[layout]||templateTypography.framed;
  const positions={framed:{titleY:4,channelY:81.7},immersive:{titleY:7,channelY:92},fullscreen:{titleY:4,channelY:92}}[layout]||{titleY:4,channelY:81.7};
  $('titleX').value='50';$('titleY').value=String(positions.titleY);$('channelX').value='50';$('channelY').value=String(positions.channelY);syncTextPositionUI();
  $('titleFont').value=preset.titleFont;$('titleBold').checked=true;$('titleItalic').checked=false;
  $('channelFont').value=preset.channelFont;$('channelBold').checked=true;$('channelItalic').checked=false;
  if(applyCues&&cues.length){rememberCues();cues.forEach(c=>{c.style={...c.style,font:preset.captionFont,bold:preset.captionBold,italic:preset.captionItalic};});renderCues();}
  else syncStyleEditor();
  syncTextStyleNotes();changed();
  try{await CutRenderer.fonts(project());changed();}catch{toast('폰트를 불러오지 못했습니다.');}
  if(notify)toast('영상 템플릿의 기본 폰트 스타일을 적용했습니다.');
}
window.applyTemplateTypography=applyTemplateTypography;
$('layoutSelect').addEventListener('input',()=>applyTemplateTypography($('layoutSelect').value,{applyCues:true,notify:true}));
['titleFont','channelFont'].forEach(id=>$(id).onchange=async()=>{syncTextStyleNotes();changed();try{await CutRenderer.fonts(project());changed();}catch{toast('폰트를 불러오지 못했습니다.');}});
function syncTextPositionUI(){for(const id of ['titleX','titleY','channelX','channelY']){const out=$(id+'Value');if(out)out.textContent=`${Number($(id).value).toFixed(Number($(id).value)%1?1:0)}%`;}}
['titleX','titleY','channelX','channelY'].forEach(id=>$(id).addEventListener('input',()=>{syncTextPositionUI();changed();}));
syncTextPositionUI();
['titleSize','channelSize'].forEach(id=>$(id).addEventListener('change',()=>{
  const input=$(id),fallback=id==='titleSize'?86.4:43.2;
  input.value=String(Math.min(Number(input.max),Math.max(Number(input.min),Number(input.value)||fallback)));changed();
}));
const typographyState=kind=>{
  const p=kind==='channel'?'channel':'title';
  return {
    kind:p,font:$(p+'Font').value,size:Number($(p+'Size').value),color:$(p+'Color').value,
    bold:$(p+'Bold').checked,italic:$(p+'Italic').checked,
    strokeEnabled:$(p+'StrokeEnabled').checked,strokeWidth:Number($(p+'StrokeWidth').value)||0,
    x:Number($(p+'X').value),y:Number($(p+'Y').value)
  };
};
window.CutflowTypography={
  async update(kind,patch={}){
    const p=kind==='channel'?'channel':'title';
    const fields={font:'Font',size:'Size',color:'Color',bold:'Bold',italic:'Italic',strokeEnabled:'StrokeEnabled',strokeWidth:'StrokeWidth',x:'X',y:'Y'};
    for(const [key,suffix] of Object.entries(fields)){
      if(patch[key]==null)continue;const el=$(p+suffix);if(!el)continue;
      if(el.type==='checkbox')el.checked=!!patch[key];else el.value=String(patch[key]);
      if(key==='strokeEnabled'||key==='strokeWidth')textStrokeOverrides[p]=key==='strokeEnabled'?!!patch[key]:$(p+'StrokeEnabled').checked;
      el.dispatchEvent(new Event(['font','size','strokeEnabled','strokeWidth'].includes(key)?'change':'input',{bubbles:true}));
    }
    syncTextStrokes();syncTextPositionUI();syncTextStyleNotes();changed();
    try{await CutRenderer.fonts(project());changed();}catch{}
    const state=typographyState(p);window.dispatchEvent(new CustomEvent('cutflow-typography-updated',{detail:{kind:p,state}}));return state;
  }
};

window.syncStyleEditor=syncStyleEditor;window.selectStyleCue=selectStyleCue;
syncStyleEditor();syncTextStyleNotes();

applyTemplateTypography($('layoutSelect').value,{applyCues:false,notify:false});
