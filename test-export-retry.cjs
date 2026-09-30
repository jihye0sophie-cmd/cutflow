const fs=require('node:fs'),assert=require('node:assert');
const app=fs.readFileSync('app.js','utf8');
const encoder=fs.readFileSync('encoder.js','utf8');
const mobile=fs.readFileSync('mobile-v42.js','utf8');

assert.ok(app.includes("if(exporting||loading)"),'export must reject concurrent starts');
assert.ok(app.includes("const token={cancelled:false};window.currentExport=token"),'export cancellation token missing');
assert.ok(app.includes("window.currentExport=null"),'export token must reset after completion/cancel');
assert.ok(app.includes("exporting=false"),'export busy state must reset in finally');
assert.ok(app.includes("CutEncoder.cancel()"),'export cancellation must terminate encoder');
assert.ok(encoder.includes("if(token.cancelled)throw new Error('취소되었습니다.')"),'encoder cancellation checkpoints missing');
assert.ok(encoder.includes("ffmpeg?.terminate();ffmpeg=null"),'ffmpeg must terminate and reset after each export');
assert.ok(encoder.includes("activeEncoder=null"),'VideoEncoder state must reset after each export');
assert.ok(mobile.includes("mobileExportUi=()=>window.CutflowUI?.mode==='mobile'"),'mobile export UI must be mode scoped');
assert.ok(mobile.includes("const exportBusy=!!window.CutflowExport?.busy"),'responsive export handoff missing');

console.log('MP4 cancel/retry lifecycle checks passed');
