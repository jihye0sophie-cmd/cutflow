const fs=require('node:fs'),assert=require('node:assert/strict');
const js=fs.readFileSync('timing-editor.js','utf8'),html=fs.readFileSync('index.html','utf8'),build=fs.readFileSync('build.cjs','utf8');
assert.ok(js.includes('data-boundary-caption'));assert.ok(js.includes('data-boundary-scene'));assert.ok(js.includes('내레이션에 맞춤'));assert.ok(js.includes("b.dataset.tab='timing'"));assert.ok(js.includes("id='mobileTiming'")||js.includes("id=\"mobileTiming\"")||js.includes("q('mobileTiming')"));assert.ok(!js.includes("dataset.mobileTab='timing'"));
assert.ok(html.includes('timing-editor.js?v=41.3'));assert.ok(html.includes('timing-editor.css?v=41.3'));assert.ok(build.includes("'timing-editor.js'"));assert.ok(build.includes("'timing-editor.css'"));
console.log('PASS: timing workspace is wired into desktop/mobile; mobile timing remains a caption subview.');
