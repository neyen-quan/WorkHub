// Real Chromium/OS clipboard regression. Runs in Electron, not in a DOM mock.
const {app,BrowserWindow,WebContentsView,clipboard,ClipboardItem,session,ipcMain}=require('electron');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const option=name=>process.argv.find(a=>a.startsWith('--'+name+'=')).slice(name.length+3);
const report=path.resolve(option('report')),root=path.resolve(option('source')),wait=ms=>new Promise(r=>setTimeout(r,ms));
app.setPath('userData',path.join(path.dirname(report),'clipboard-profile'));
app.disableHardwareAcceleration();
const source=fs.readFileSync(path.join(root,'electron/main.cjs'),'utf8');
const factory=new Function('fs','path',source.slice(source.indexOf('function createEditingController('),source.indexOf('const editingController = createEditingController('))+';return createEditingController;')(require('node:fs/promises'),path);
let win;const menus=[],errors=[],results=[];
function osFiles(action,payload={}){return JSON.parse(execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-STA','-ExecutionPolicy','Bypass','-File',path.join(root,'electron/file-clipboard.ps1'),action],{input:Buffer.from(JSON.stringify(payload)).toString('base64'),encoding:'utf8',windowsHide:true,timeout:15000}));}
const controller=factory({Menu:{buildFromTemplate:items=>({popup:()=>menus.push(items)})},clipboard,readFiles:async()=>process.platform==='win32'?osFiles('read'):{paths:[]},reportError:e=>errors.push(e)});
ipcMain.on('workhub-paste-error',(_event,message)=>errors.push(message));
const html=`<!doctype html><meta charset="utf-8"><style>body{background:#202125;color:white}#prompt-textarea{min-height:150px;border:1px solid gray;padding:20px}</style>
<button id="new" onclick="newChat()">New chat</button><input id="search" placeholder="Search"><main></main><script>
window.records=[];window.keys=0;window.guarded=false;
function newChat(){document.querySelector('main').innerHTML='<div id="prompt-textarea" contenteditable="true" role="textbox">';}
newChat();
window.addEventListener('keydown',e=>{if(e.ctrlKey&&e.key.toLowerCase()==='v'){window.keys++;window.keySeen=true;}},true);
window.addEventListener('paste',async e=>{
 e.preventDefault();
 const key=window.keySeen;window.keySeen=false;
 const entry={trusted:e.isTrusted,keySeen:key,target:e.target.id,types:[...e.clipboardData.types],files:[],text:e.clipboardData.getData('text/plain')};
 for(const f of e.clipboardData.files)entry.files.push({name:f.name,type:f.type,bytes:[...new Uint8Array(await f.arrayBuffer())]});
 // Editors may use their key handler to prepare an upload. Merely calling
 // webContents.paste after swallowing keydown skips that path entirely.
 entry.accepted=!window.guarded||key;window.records.push(entry);
},true);
</script>`;
async function read(wc,script){return wc.executeJavaScript(script);}
async function check(wc,{mode='keyboard',guarded=false,focus='composer'}={}){
 await read(wc,`window.records=[];window.guarded=${guarded};window.keySeen=false;${focus==='body'?'document.activeElement.blur()':`document.querySelector(${JSON.stringify(focus==='search'?'#search':'#prompt-textarea')}).focus()`}`);
 win.focus();wc.focus();await wait(80);
 if(mode==='menu'){
  wc.emit('context-menu',{}, {isEditable:true,editFlags:{canPaste:true}});
  await menus.pop().find(x=>x.label==='Pegar').click();
 }else{
  const modifiers=mode==='insert'?['shift']:['control'];const keyCode=mode==='insert'?'Insert':'V';
  wc.sendInputEvent({type:'keyDown',keyCode,modifiers});wc.sendInputEvent({type:'keyUp',keyCode,modifiers});
 }
 const until=Date.now()+5000;let records=[];
 while(Date.now()<until){records=await read(wc,'window.records');if(records.length)break;await wait(50);}
 assert.equal(records.length,1,JSON.stringify({mode,records,errors}));
 await wait(150);assert.equal((await read(wc,'window.records')).length,1,'exactly one paste');
 return records[0];
}
async function main(){
 await app.whenReady();
 // Intercept HTTPS inside this isolated, nonpersistent test session. No request
 // reaches ChatGPT and no user account/profile is used by this fixture.
 const ses=session.fromPartition('clipboard-regression');ses.protocol.handle('https',()=>new Response(html,{headers:{'content-type':'text/html'}}));
 win=new BrowserWindow({width:1050,height:650,show:true});
 const views=[];
 function create(){const v=new WebContentsView({webPreferences:{session:ses,preload:path.join(root,'electron/attachment-preload.cjs'),contextIsolation:true,sandbox:true}});views.push(v);win.contentView.addChildView(v);v.setBounds({x:(views.length-1)*510,y:0,width:505,height:600});controller.install(v.webContents,{attachments:true});return v;}
 const a=create(),b=create();for(const [i,v]of [a,b].entries())await v.webContents.loadURL('https://chatgpt.com/chat/'+i);
 const png=fs.readFileSync(path.join(root,'assets/workhub.png'));
 for(const [name,v,options]of [['existing',a,{}],['new guarded editor',b,{guarded:true}],['switch back',a,{}],['Shift Insert',b,{mode:'insert'}],['context menu',a,{mode:'menu'}],['SPA new composer',b,{focus:'body'}]]){
  if(name==='SPA new composer')await read(b.webContents,"newChat();history.pushState({},'', '/chat/new')");
  await clipboard.write([new ClipboardItem({'image/png':new Blob([png],{type:'image/png'})})]);
  const r=await check(v.webContents,options);assert.equal(r.trusted,true,name);assert.equal(r.accepted,true,name);assert.equal(r.target,'prompt-textarea',name);assert.equal(r.files.length,1,name);assert.equal(r.files[0].type,'image/png',name);assert.ok(r.files[0].bytes.length>100,name);assert.equal(r.text,'',name);
  results.push({name,trusted:r.trusted,accepted:r.accepted,files:r.files.length,bytes:r.files[0].bytes.length,keySeen:r.keySeen});
 }
 // New WebContents created after the first two panels; reload the surviving
 // panel too, ensuring no one-time listener or stale composer is involved.
 win.contentView.removeChildView(b);b.webContents.close();const c=create();c.setBounds({x:510,y:0,width:505,height:600});await c.webContents.loadURL('https://chatgpt.com/chat/fresh');
 for(const v of [c,a]){if(v===a)await v.webContents.loadURL('https://chatgpt.com/chat/reloaded');await clipboard.write([new ClipboardItem({'image/png':new Blob([png],{type:'image/png'})})]);const r=await check(v.webContents,{guarded:true});assert.equal(r.files.length,1);assert.equal(r.trusted,true);assert.equal(r.accepted,true);results.push({name:v===c?'new panel':'reloaded panel',files:1,trusted:true});}
 if(process.platform==='win32'){
  const file=path.join(path.dirname(report),'clipboard-fixture.pdf'),bytes=Buffer.from('%PDF-1.4\nWorkHub clipboard test\n%%EOF');fs.writeFileSync(file,bytes);
  for(const mode of ['keyboard','menu']){osFiles('write',{paths:[file],operation:'copy'});const r=await check(c.webContents,{mode});assert.equal(r.files.length,1,'Windows FileDrop '+mode);assert.deepEqual(r.files[0].bytes,[...bytes]);assert.equal(r.text,'');results.push({name:'Windows PDF '+mode,files:1,bytes:bytes.length});}
 }
 await clipboard.writeText('clipboard text');const text=await check(c.webContents);assert.equal(text.text,'clipboard text');assert.equal(text.files.length,0);
 const search=await check(c.webContents,{focus:'search'});assert.equal(search.target,'search','never steal focus from search');
 assert.deepEqual(errors,[]);fs.writeFileSync(report,JSON.stringify({ok:true,platform:process.platform,electron:process.versions.electron,results,textPreserved:true},null,2));
}
main().then(()=>app.exit(0)).catch(error=>{fs.writeFileSync(report,JSON.stringify({ok:false,error:error.stack,results},null,2));console.error(error);app.exit(1);});
