const {test}=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const mainSource=fs.readFileSync(path.join(__dirname,'../electron/main.cjs'),'utf8');
const createEditingController=new Function('fs','path',mainSource.slice(mainSource.indexOf('function createEditingController('),mainSource.indexOf('const editingController = createEditingController('))+';return createEditingController;')(require('node:fs/promises'),path);
function harness(overrides={}) {
  const menus=[],errors=[],writes=[];let bytes=null,formats=[];
  const clipboard={availableFormats:()=>formats,readImage:()=>({isEmpty:()=>!bytes,toPNG:()=>Buffer.from(bytes)}),writeText:text=>writes.push(text)};
  const controller=createEditingController({Menu:{buildFromTemplate:template=>({popup:options=>menus.push({template,options})})},clipboard,readFiles:async()=>({paths:[]}),reportError:message=>errors.push(message),...overrides});
  function view(){const wc=new EventEmitter();wc.calls=[];wc.dead=false;wc.isDestroyed=()=>wc.dead;wc.getOwnerBrowserWindow=()=>({id:'owner'});for(const cmd of ['focus','paste','copy','cut','selectAll','copyImageAt','send'])wc[cmd]=(...args)=>wc.calls.push([cmd,...args]);return wc;}
  return {controller,view,menus,errors,writes,image:value=>{bytes=value;formats=['image/png'];},formats:value=>formats=value};
}
test('right click installs once and always edits the clicked view, including image-only paste',async()=>{
 const h=harness(),a=h.view(),b=h.view();h.controller.install(a,{attachments:true});h.controller.install(a,{attachments:true});h.controller.install(b,{attachments:true});
 assert.equal(a.listenerCount('context-menu'),1);h.image([1,2,3]);
 a.emit('context-menu',{}, {isEditable:true,editFlags:{canCopy:true,canCut:true,canPaste:false}});
 const items=h.menus[0].template;assert.deepEqual(items.filter(i=>i.label).map(i=>i.label),['Copiar','Recortar','Pegar','Seleccionar todo']);
 items[0].click();items[1].click();await items[2].click();
 assert.equal(items[2].enabled,true);assert.deepEqual(b.calls,[]);assert.equal(a.calls.filter(c=>c[0]==='paste').length,1);assert.ok(!a.calls.some(c=>c[0]==='send'));
});
test('each paste reads the current screenshot and never clears or rewrites the clipboard',async()=>{
 const h=harness(),a=h.view(),b=h.view();h.image([1]);await h.controller.paste(a,true);h.image([2,3]);await h.controller.paste(b,true);h.image([4]);await h.controller.paste(a,true);
 assert.equal(a.calls.filter(c=>c[0]==='paste').length,2);
 assert.equal(b.calls.filter(c=>c[0]==='paste').length,1);assert.deepEqual(h.writes,[]);
});
test('Ctrl+V intercepts once; Ctrl+B and Ctrl+Shift+V keep their normal meaning',async()=>{
 const h=harness(),a=h.view();h.controller.install(a,{attachments:true});h.image([5]);let prevented=0;
 for(const input of [{key:'v',control:true},{key:'b',control:true},{key:'v',control:true,shift:true},{key:'v',control:true,type:'keyUp'}])a.emit('before-input-event',{preventDefault:()=>prevented++},{type:'keyDown',...input});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(prevented,1);assert.equal(a.calls.filter(c=>c[0]==='paste').length,1);
});
test('plain text and non-bridge views retain Chromium native paste',async()=>{
 const h=harness(),a=h.view();await h.controller.paste(a,true);assert.deepEqual(a.calls,[['focus'],['paste']]);
 h.image([8]);await h.controller.paste(a,false);assert.equal(a.calls.filter(c=>c[0]==='paste').length,2);
});
test('file-only clipboard attaches bytes, not path text, and takes priority over its preview image',async()=>{
 const h=harness({readFiles:async()=>({paths:['/docs/test.pdf']}),stat:async()=>({isFile:()=>true,size:3,mtimeMs:9}),readFile:async()=>Buffer.from('pdf')});
 const a=h.view();h.image([7]);h.formats(['FileNameW','image/png']);await h.controller.paste(a,true);
 const files=a.calls.find(c=>c[0]==='send')[2].files;assert.equal(files[0].name,'test.pdf');assert.deepEqual([...files[0].bytes],[112,100,102]);assert.ok(!a.calls.some(c=>c[0]==='paste'));
});
test('clipboard failure releases per-view lock so the next screenshot works without restart',async()=>{
 const h=harness({readFiles:async()=>{throw Error('Portapapeles ocupado');}}),a=h.view();h.formats(['CF_HDROP']);await h.controller.paste(a,true);assert.equal(h.errors.length,0);assert.equal(a.calls.filter(c=>c[0]==='paste').length,1);
 h.image([9]);await h.controller.paste(a,true);assert.equal(a.calls.filter(c=>c[0]==='paste').length,2);
});
test('pending file reads do not block other panes and destroyed views receive no attachment',async()=>{
 let resolve;const h=harness({readFiles:()=>new Promise(r=>resolve=r)}),a=h.view(),b=h.view();h.formats(['FileDrop']);const pending=h.controller.paste(a,true);
 h.image([6]);await h.controller.paste(b,true);a.dead=true;resolve({paths:[]});await pending;
 assert.ok(b.calls.some(c=>c[0]==='paste'));assert.ok(!a.calls.some(c=>c[0]==='send'||c[0]==='paste'));
});
test('host file and tab menus are preserved; text inputs receive editing menu',()=>{
 const h=harness(),a=h.view();h.controller.install(a,{host:true});a.emit('context-menu',{},{});assert.equal(h.menus.length,0);
 a.emit('context-menu',{}, {isEditable:true,editFlags:{}});assert.equal(h.menus.length,1);
 let prevented=false;a.emit('before-input-event',{preventDefault:()=>prevented=true},{type:'keyDown',key:'v',control:true});assert.equal(prevented,false);
});
function receiver(){
 const listeners={},ipc=new EventEmitter(),errors=[],events=[];
 ipc.send=(...args)=>errors.push(args);
 const input={isConnected:true,tagName:'DIV',focus(){},closest(){return this;},dispatchEvent:event=>events.push(event)};
 const document={activeElement:input};
 class Transfer {constructor(){this.files=[];this.items={add:file=>this.files.push(file)};}}
 class Paste {constructor(type,options){this.type=type;Object.assign(this,options);}}
 const context={require:()=>({ipcRenderer:ipc}),window:{addEventListener:(name,fn)=>listeners[name]=fn},document,File,Uint8Array,DataTransfer:Transfer,ClipboardEvent:Paste,setTimeout};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../electron/attachment-preload.cjs'),'utf8'),context);
 return {ipc,errors,events,input,document,listeners};
}
test('receiving renderer creates a real PNG File in one paste event without a path string',async()=>{
 const h=receiver();h.ipc.emit('workhub-paste-attachments',{}, {files:[{name:'shot.png',type:'image/png',bytes:new Uint8Array([1,2,3])}]});
 assert.equal(h.events.length,1);const e=h.events[0];assert.equal(e.type,'paste');assert.equal(e.bubbles,true);assert.equal(e.composed,true);
 const file=e.clipboardData.files[0];assert.ok(file instanceof File);assert.equal(file.type,'image/png');assert.deepEqual([...new Uint8Array(await file.arrayBuffer())],[1,2,3]);assert.deepEqual(h.errors,[]);
});
test('right-click paste remembers the editor; keyboard paste cannot target a stale editor',()=>{
 const h=receiver(),payload={files:[{name:'shot.png',bytes:new Uint8Array([1])}],contextMenu:true};
 h.listeners.contextmenu({target:h.input});h.document.activeElement={};h.ipc.emit('workhub-paste-attachments',{},payload);assert.equal(h.events.length,1);
 h.ipc.emit('workhub-paste-attachments',{}, {...payload,contextMenu:false});assert.equal(h.events.length,1);assert.equal(h.errors[0][0],'workhub-paste-error');
});
test('a removed editor never receives pasted files',()=>{
 const h=receiver();h.listeners.contextmenu({target:h.input});h.input.isConnected=false;
 h.ipc.emit('workhub-paste-attachments',{}, {files:[{name:'shot.png',bytes:new Uint8Array([1])}],contextMenu:true});assert.equal(h.events.length,0);assert.equal(h.errors.length,1);
});

// Model the documented modern Electron surface exactly: no availableFormats
// and no readImage. The previous tests only covered the obsolete sync API.
test('modern Electron clipboard pastes PNG without any legacy methods',async()=>{
 const h=harness({clipboard:{read:async()=>[{types:['image/png'],getType:async()=>new Blob([new Uint8Array([8,9])],{type:'image/png'})}]}}),a=h.view();
 await h.controller.paste(a,true);assert.deepEqual(h.errors,[]);assert.equal(a.calls.filter(c=>c[0]==='paste').length,1);assert.ok(!a.calls.some(c=>c[0]==='send'));
});
test('modern Electron text-only clipboard uses native paste',async()=>{
 const h=harness({clipboard:{read:async()=>[{types:['text/plain'],getType:async()=>{throw Error('text must stay native');}}]}}),a=h.view();
 await h.controller.paste(a,true);assert.equal(a.calls.filter(c=>c[0]==='paste').length,1);assert.deepEqual(h.errors,[]);
});
test('missing clipboard read APIs fall back to native paste without blocking the next paste',async()=>{
 const h=harness({clipboard:{}}),a=h.view();await h.controller.paste(a,true);await h.controller.paste(a,true);
 assert.equal(a.calls.filter(c=>c[0]==='paste').length,2);assert.deepEqual(h.errors,[]);
});
test('modern clipboard read rejection falls back exactly once and subsequent screenshot works',async()=>{
 let fail=true;const clipboard={read:async()=>{if(fail)throw Error('Clipboard busy');return [{types:['image/png'],getType:async()=>new Blob(['png'],{type:'image/png'})}];}};
 const h=harness({clipboard}),a=h.view();await h.controller.paste(a,true);fail=false;await h.controller.paste(a,true);
 assert.equal(a.calls.filter(c=>c[0]==='paste').length,2);assert.equal(a.calls.filter(c=>c[0]==='send').length,0);assert.deepEqual(h.errors,[]);
});
test('modern raw Windows file format uses file reader and real PDF bytes',async()=>{
 const h=harness({clipboard:{read:async()=>[{types:['electron application/osclipboard;format="FileNameW"']}]},readFiles:async()=>({paths:['/docs/test.pdf']}),stat:async()=>({isFile:()=>true,size:3,mtimeMs:9}),readFile:async()=>Buffer.from('pdf')}),a=h.view();
 await h.controller.paste(a,true);assert.equal(a.calls.find(c=>c[0]==='send')[2].files[0].name,'test.pdf');assert.deepEqual(h.errors,[]);
});
test('modern image payload read failure uses native paste without duplicate attachments',async()=>{
 const h=harness({clipboard:{read:async()=>[{types:['image/png'],getType:async()=>{throw Error('Image busy');}}]}}),a=h.view();
 await h.controller.paste(a,true);assert.equal(a.calls.filter(c=>c[0]==='paste').length,1);assert.ok(!a.calls.some(c=>c[0]==='send'));assert.deepEqual(h.errors,[]);
});

test('screenshots never decode or construct a synthetic paste, even for editors that ignore synthetic events',async()=>{
 let decoded=0;
 const h=harness({clipboard:{read:async()=>[{types:['image/png'],getType:async()=>{decoded++;throw Error('Must not decode screenshot');}}]}}),a=h.view(),b=h.view();
 await h.controller.paste(a,true);await h.controller.paste(b,true,true);
 assert.equal(decoded,0);for(const v of [a,b]){assert.equal(v.calls.filter(c=>c[0]==='paste').length,1);assert.equal(v.calls.filter(c=>c[0]==='send').length,0);}
});
