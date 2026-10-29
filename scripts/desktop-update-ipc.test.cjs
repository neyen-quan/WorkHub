const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const os=require('node:os');
const {installDesktopUpdater}=require('../electron/desktop-update-ipc.cjs');
function fixture(t,options={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'WorkHub IPC '));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({version:'0.1.34'}));
 const handlers=new Map(),mainFrame={},wc={mainFrame},host={webContents:wc};let picks=0,quits=0;
 const manager=installDesktopUpdater({app:{quit:()=>quits++,getPath:()=>root},ipcMain:{handle:(key,fn)=>handlers.set(key,fn)},dialog:{showOpenDialog:async()=>{picks++;return options.pick||{canceled:true};},showMessageBox:async()=>({response:1})},host:()=>host,root,platform:'win32'});
 return {root,event:{sender:wc,senderFrame:mainFrame},install:handlers.get('desktop-update-install'),command:manager.command,ready:handlers.get('desktop-update-ready'),picks:()=>picks,quits:()=>quits};
}
test('remote views and subframes cannot invoke the installer or health receipt',async t=>{
 const h=fixture(t);assert.equal((await h.install({sender:{},senderFrame:{}})).ok,false);assert.equal((await h.install({...h.event,senderFrame:{}})).ok,false);assert.equal(h.picks(),0);await assert.rejects(()=>h.ready({sender:{},senderFrame:{}}),/autorizado/);
});
test('canceling the ZIP picker leaves the app running with no transaction',async t=>{
 const h=fixture(t);assert.deepEqual(await h.command('local'),{ok:true,canceled:true});assert.equal(h.quits(),0);assert.equal(fs.existsSync(path.join(h.root,'.workhub-updates')),false);
});
test('an invalid selected ZIP reports the error and never quits or stages files',async t=>{
 const file=path.join(os.tmpdir(),'workhub-bad-'+Date.now()+'.zip');fs.writeFileSync(file,'not a zip');t.after(()=>fs.rmSync(file,{force:true}));const h=fixture(t,{pick:{filePaths:[file]}});const result=await h.command('local');assert.equal(result.ok,false);assert.ok(result.error);assert.equal(h.quits(),0);assert.equal(fs.existsSync(path.join(h.root,'.workhub-updates')),false);
});

