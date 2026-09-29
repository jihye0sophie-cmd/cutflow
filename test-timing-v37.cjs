const fs=require('node:fs'),assert=require('node:assert/strict');
const js=fs.readFileSync('timing-editor.js','utf8'),html=fs.readFileSync('index.html','utf8'),build=fs.readFileSync('build.cjs','utf8');
assert.ok(js.includes('data-boundary-caption'));assert.ok(js.includes('data-boundary-scene'));assert.ok(js.includes('내레이션에 맞춤'));assert.ok(js.includes("b.dataset.tab='timing'"));assert.ok(js.includes("dataset.mobileTab='timing'"));
assert.ok(html.includes('timing-editor.js?v=39'));assert.ok(html.includes('timing-editor.css?v=38'));assert.ok(build.includes("'timing-editor.js'"));assert.ok(build.includes("'timing-editor.css'"));
console.log('PASS: v37 timing workspace is wired into desktop/mobile and static build.');
