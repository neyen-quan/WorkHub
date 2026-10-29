const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawn}=require('node:child_process');
const engine=require('../electron/desktop-update.cjs');
test('asynchronous durable JSON replaces an existing journal without leaving temporary files',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'workhub-atomic-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const file=path.join(dir,'journal.json');fs.writeFileSync(file,'{"old":true}');await engine.atomicJsonAsync(file,{new:true});assert.deepEqual(JSON.parse(fs.readFileSync(file)),{new:true});assert.deepEqual(fs.readdirSync(dir),['journal.json']);
});
test('Windows sharing lock on a critical journal retries while the UI event loop can run',{skip:process.platform!=='win32'},async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'workhub-locked-'));const file=path.join(dir,'journal.json'),ready=path.join(dir,'ready'),stop=path.join(dir,'stop');fs.writeFileSync(file,'{"old":true}');const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'../tools/hold-file.ps1'),'-File',file,'-Ready',ready,'-Stop',stop],{stdio:'ignore'});const closed=new Promise(r=>child.on('close',r));t.after(async()=>{fs.writeFileSync(stop,'stop');await closed;fs.rmSync(dir,{recursive:true,force:true,maxRetries:20,retryDelay:100});});let until=Date.now()+10000;while(!fs.existsSync(ready)){if(Date.now()>until)throw Error('lock timeout');await new Promise(r=>setTimeout(r,30));}
 let waiting=false,uiRan=false;setTimeout(()=>{uiRan=true;fs.writeFileSync(stop,'stop');},700);await engine.atomicJsonAsync(file,{updated:true},()=>{waiting=true;});assert.ok(waiting);assert.ok(uiRan);assert.deepEqual(JSON.parse(fs.readFileSync(file)),{updated:true});await closed;
});

