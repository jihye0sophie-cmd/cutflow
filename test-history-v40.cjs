const fs=require('node:fs'),assert=require('node:assert');
const js=fs.readFileSync('history.js','utf8'),app=fs.readFileSync('app.js','utf8'),html=fs.readFileSync('index.html','utf8'),build=fs.readFileSync('build.cjs','utf8');
assert(js.includes('async function undo()')&&js.includes('async function redo()'),'undo/redo functions missing');
assert(js.includes("key==='z'")&&js.includes("key==='y'"),'keyboard shortcuts missing');
assert(js.includes("data-cutflow-history" )||js.includes('dataset.cutflowHistory'),'history buttons missing');
assert(app.includes('window.CutflowHistory?.commit?.()'),'changed() must commit history');
assert(html.includes('./history.js?v=40')&&html.includes('./history.css?v=40'),'history assets missing from html');
assert(build.includes("'history.js','history.css'"),'history assets missing from build');
console.log('v40 undo/redo history checks passed');
