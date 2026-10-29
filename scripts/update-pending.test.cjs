const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const engine=require('../electron/desktop-update.cjs'),{fixture,patch}=require('../tools/lib/update-fixture.cjs'),{installDesktopUpdater}=require('../electron/desktop-update-ipc.cjs');
test('completed download survives an awaited confirmation, including asynchronous task completion and cancel/retry',async t=>{
 const f=fixture(t),payload=patch(f),asset={from:'0.1.36',to:'0.1.37',sha256:engine.sha(payload),size:payload.length,url:'https://github.com/example/WorkHub/releases/download/v0.1.37/patch.zip'};
 fs.writeFileSync(path.join(f.root,'update-channel.json'),JSON.stringify({channel:'https://github.com/example/WorkHub/releases/latest/download/latest.json'}));
 let finishDialog,dialogOpened=false,downloads=0;
 const m=installDesktopUpdater({app:{getPath:()=>f.root,quit:()=>assert.fail('must not quit after cancel')},ipcMain:{handle(){}},dialog:{showMessageBox:()=>{dialogOpened=true;return new Promise(r=>{finishDialog=r;});}},host:()=>({}),root:f.root,platform:'win32',BrowserWindow:null,client:{options:{},check:async()=>({version:'0.1.37',available:true,patch:asset,full:asset}),request:async(_url,o)=>{downloads++;fs.mkdirSync(path.dirname(o.destination),{recursive:true});fs.writeFileSync(o.destination,payload);}}});
 await m.command('check');const operation=m.command('install');while(!dialogOpened)await new Promise(r=>setTimeout(r,5));
 await new Promise(r=>setTimeout(r,100));const pending=m.getPending();assert.ok(fs.existsSync(pending.file));assert.equal(m.getState().stage,'confirmation');assert.equal(m.getState().busy,true);finishDialog({response:1});assert.equal((await operation).canceled,true);assert.ok(fs.existsSync(pending.file));
 dialogOpened=false;const retry=m.command('install');while(!dialogOpened)await new Promise(r=>setTimeout(r,5));finishDialog({response:1});await retry;assert.equal(downloads,1,'retry must reuse the verified bytes');
});

