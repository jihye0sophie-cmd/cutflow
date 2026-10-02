const fs=require('node:fs'),assert=require('node:assert');
const js=fs.readFileSync('history.js','utf8'),app=fs.readFileSync('app.js','utf8'),html=fs.readFileSync('index.html','utf8'),build=fs.readFileSync('build.cjs','utf8');

assert(js.includes('async function undo()')&&js.includes('async function redo()'),'undo/redo functions missing');
assert(js.includes("key==='z'")&&js.includes("key==='y'"),'keyboard shortcuts missing');
assert(js.includes('beginScoped')&&js.includes('ensureScoped')&&js.includes('cancelPending'),'hybrid history API missing');
assert(js.includes('scopeBridge')&&js.includes("scope==='timeline'"),'timeline history scope missing');
assert(js.includes("'cutflow-history-updated'"),'history state event missing');
assert(js.includes('fileSig')&&js.includes('snapshot:current'),'history must fingerprint media metadata while retaining shared File references');
assert(!js.includes('structuredClone(snapshot)')&&!js.includes('new File([snapshot'),'history must not duplicate media bytes per entry');
assert(js.includes("function ensureScoped(label='편집',scope='timeline'){if(pending?.scope===scope)return true;"),'continuous live edits must preserve their first scoped snapshot');
assert(!js.includes("function start(label='편집',scope='project'){\n    if(applying||busy)return false;\n    if(pending?.scope===scope)return true;"),'a new user action must not reuse a stale pending snapshot');
assert(app.includes('window.CutflowTimelineBridge={'),'timeline-only restore bridge missing');
assert(app.includes('window.CutflowHistory?.commit?.()'),'changed() must commit history');
assert(/history\.js\?v=41(?:\.|")/.test(html),'current hybrid history runtime missing from html');
assert(!html.includes('history.css'),'retired history stylesheet returned to html');
assert(build.includes('runtimeRefs')&&build.includes('index.matchAll'),'build must derive runtime assets from index.html');
console.log('PASS: hybrid scoped undo/redo history architecture checks passed');
