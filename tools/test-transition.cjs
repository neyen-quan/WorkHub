const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const root=path.resolve(process.env.WORKHUB_SOURCE_ROOT||path.join(__dirname,'..')),engine=require(path.join(root,'electron/desktop-update.cjs'));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,timeout=90000){const end=Date.now()+timeout;while(Date.now()<end){const value=fn();if(value)return value;await wait(100);}throw Error('Timeout de transición real');}
async function testTransition(){
 const filename=fs.readdirSync(path.join(root,'release')).find(n=>n.includes('-from-0.7.3-transition.zip'));if(!filename)return;
 const archive=engine.unzip(fs.readFileSync(path.join(root,'release',filename))),built=path.join(root,'.build/WorkHub'),home=path.join(root,'.qa/transition'),install=path.join(home,'WorkHub á space'),appDir=path.join(install,'resources/app');fs.mkdirSync(appDir,{recursive:true});
 // Create the pre-transition runtime layout using the exact runtime being tested.
 fs.cpSync(path.join(built,'runtime'),install,{recursive:true});fs.renameSync(path.join(install,'WorkhubEngine.exe'),path.join(install,'WorkHub.exe'));
 const profile=path.join(home,'profile/workhub-desktop');fs.mkdirSync(profile,{recursive:true});
 const oldScript=`const {app,BrowserWindow,session}=require('electron');const fs=require('node:fs'),path=require('node:path');const gmailAccounts = {'gmail-neyen':'account@example.invalid'};app.setPath('userData',${JSON.stringify(profile)});app.disableHardwareAcceleration();app.whenReady().then(async()=>{await require(${JSON.stringify(path.join(root,'electron/desktop-runtime.cjs'))}).serveDesktop(${JSON.stringify(path.join(built,'dist'))});const win=new BrowserWindow({webPreferences:{contextIsolation:true}});await win.loadURL('http://127.0.0.1:5173');await win.webContents.executeJavaScript("localStorage.setItem('workhub-ci-preserved','retained')");const cookies=session.fromPartition('persist:workhub-gpt-personal').cookies;await cookies.set({url:'https://example.com',name:'workhub-ci',value:'retained',expirationDate:Date.now()/1000+86400});await cookies.flushStore();fs.writeFileSync(${JSON.stringify(path.join(home,'seed-ready'))},'ready');app.quit();});`;
 fs.writeFileSync(path.join(appDir,'main.cjs'),oldScript);fs.writeFileSync(path.join(appDir,'package.json'),JSON.stringify({name:'workhub-desktop',version:'0.7.3',main:'main.cjs'}));fs.mkdirSync(path.join(appDir,'electron'));fs.writeFileSync(path.join(appDir,'electron/main.cjs'),oldScript);
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
 const seeded=spawn(path.join(install,'WorkHub.exe'),[],{cwd:install,env,stdio:'ignore'});await until(()=>fs.existsSync(path.join(home,'seed-ready')));if(seeded.exitCode===null)await new Promise(r=>seeded.once('exit',r));await wait(1500);
 const backup=path.join(install,'resources/backup-transition-ci');fs.cpSync(appDir,backup,{recursive:true});
 // Apply the exact public legacy archive, then instrument only this disposable fixture.
 const m=require('./transition-package.cjs').validate(fs.readFileSync(path.join(root,'release',filename)),'0.7.3',JSON.parse(fs.readFileSync(path.join(built,'package.json'))).version);
 for(const f of m.files){const file=path.join(appDir,f.path);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,archive.get('payload/'+f.path));}
 const payload=path.join(appDir,'electron/transition/app'),invPath=path.join(payload,'assets/workhub-installation.json'),inv=JSON.parse(fs.readFileSync(invPath));
 for(const name of ['electron/main.cjs','electron/installer-main.cjs']){const file=path.join(payload,name),hook=path.join(__dirname,'packaged-test-hook.cjs');fs.writeFileSync(file,'require('+JSON.stringify(hook)+');\n'+fs.readFileSync(file));const b=fs.readFileSync(file);inv.files[name]={sha256:engine.sha(b),size:b.length};}fs.writeFileSync(invPath,JSON.stringify(inv,null,2)+'\n');
 const wizard=path.join(appDir,'electron/transition/wizard.cjs');fs.writeFileSync(wizard,'require('+JSON.stringify(path.join(__dirname,'transition-test-hook.cjs'))+');\n'+fs.readFileSync(wizard));
 const qaEnv={...env,WORKHUB_QA_HOME:home,WORKHUB_QA_INSTALL:install,WORKHUB_QA_FROM:'0.7.3'};
 const child=spawn(path.join(install,'WorkHub.exe'),[],{cwd:install,env:qaEnv,stdio:'ignore'});child.on('error',e=>fs.writeFileSync(path.join(home,'child-error.json'),JSON.stringify({error:e.stack})));
 try{
  await until(()=>{const p=path.join(install,'.workhub-updates/result.json');return fs.existsSync(p)&&JSON.parse(fs.readFileSync(p)).ok;},150000);
  const receipt=await until(()=>{const p=path.join(home,'launch-'+inv.version+'.json');return fs.existsSync(p)&&JSON.parse(fs.readFileSync(p));});assert.equal(receipt.local,'retained');assert.equal(receipt.cookie,'retained');assert.equal(receipt.root,install);
  const cfg=JSON.parse(fs.readFileSync(path.join(profile,'private-config.json')));assert.equal(cfg.emails['gmail-neyen'],'account@example.invalid');
  await engine.verifyInventory(install,inv);assert.ok(JSON.parse(fs.readFileSync(path.join(home,'progress-lock.json'))).locked);
  fs.writeFileSync(path.join(root,'.qa/legacy-transition.json'),JSON.stringify({ok:true,realLegacyLayout:true,exactArchive:true,localRuntimeReuse:true,privateConfigLocal:true,cookiesAndLocalStoragePreserved:true,standaloneInstaller:true}));
 }catch(error){const transactions=path.join(install,'.workhub-updates');if(fs.existsSync(transactions)){for(const n of fs.readdirSync(transactions)){const p=path.join(transactions,n,'journal.json');if(fs.existsSync(p))fs.copyFileSync(p,path.join(home,'transition-journal.json'));}const result=path.join(transactions,'result.json');if(fs.existsSync(result))fs.copyFileSync(result,path.join(home,'transition-result.json'));}throw error;}finally{fs.writeFileSync(path.join(home,'stop'),'stop');await wait(2500);try{child.kill();}catch{}}
}
module.exports={testTransition};
