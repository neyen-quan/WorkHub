// CI-only preload. Injected using NODE_OPTIONS; never shipped in the app package.
if(process.env.WORKHUB_QA_HOME){const fs=require('node:fs'),path=require('node:path');fs.mkdirSync(process.env.WORKHUB_QA_HOME,{recursive:true});fs.appendFileSync(path.join(process.env.WORKHUB_QA_HOME,'hook-bootstrap.log'),JSON.stringify({pid:process.pid,type:process.type,argv:process.argv,electron:process.versions.electron,nodeMode:process.env.ELECTRON_RUN_AS_NODE})+'\n');}
if(process.type==='browser'){
 const Module=require('node:module'),load=Module._load;let installed=false;
 // NODE_OPTIONS preloads run before Electron registers its API module. Intercept
 // the application's first Electron require instead of requiring it too early.
 Module._load=function(request,...args){const result=load.call(this,request,...args);if(request==='electron'&&result?.app&&!installed){installed=true;install(result);}return result;};
 function install(electron){
 const fs=require('node:fs'),path=require('node:path');const {app,BrowserWindow,dialog,session}=electron;
 process.on('uncaughtException',error=>{fs.writeFileSync(path.join(process.env.WORKHUB_QA_HOME,'uncaught.json'),JSON.stringify({error:error.stack}));app.exit(1);});
 app.disableHardwareAcceleration();
 const qa=process.env.WORKHUB_QA_HOME,root=process.env.WORKHUB_QA_INSTALL;if(!qa||!root)throw Error('QA paths missing');fs.mkdirSync(qa,{recursive:true});
 // Hold progress.json without FILE_SHARE_DELETE for the complete real installer
 // transaction. An auxiliary progress file must never gate install or rollback.
 const job=process.argv.find(a=>a.includes('.workhub-updates')&&fs.existsSync(path.join(a,'journal.json')));
 if(job){
  const ready=path.join(job,'lock-ready'),stop=path.join(job,'lock-stop');fs.writeFileSync(path.join(job,'progress.json'),'{}');
  const locker=require('node:child_process').spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'hold-file.ps1'),'-File',path.join(job,'progress.json'),'-Ready',ready,'-Stop',stop],{windowsHide:true,stdio:'ignore'});let lockerError;locker.on('error',e=>{lockerError=e;});
  app.on('before-quit',()=>fs.writeFileSync(stop,'stop'));
  const register=electron.ipcMain.handle.bind(electron.ipcMain);electron.ipcMain.handle=(name,handler)=>register(name,name!=='installer-ready'?handler:async(...args)=>{const until=Date.now()+15000;while(!fs.existsSync(ready)){if(lockerError)throw lockerError;if(Date.now()>until)throw Error('Could not acquire Windows progress lock');await new Promise(r=>setTimeout(r,100));}write('progress-lock.json',{locked:true,denyDelete:true});return handler(...args);});
 }
 const original=app.getPath.bind(app);app.getPath=k=>k==='appData'?path.join(qa,'profile'):original(k);
 let movedShortcut,otherShortcut;
 if(!job)app.on('ready',()=>{
  const folder=path.join(app.getPath('appData'),'Microsoft','Internet Explorer','Quick Launch','User Pinned','TaskBar');fs.mkdirSync(folder,{recursive:true});
  movedShortcut=path.join(folder,'WorkHub-moved.lnk');otherShortcut=path.join(folder,'OtherHub.lnk');
  const old=path.join(qa,'old-location','WorkHub.exe'),icon=path.join(qa,'old-location','assets','workhub.ico');
  if(!electron.shell.writeShortcutLink(movedShortcut,'create',{target:old,icon,iconIndex:0,appUserModelId:'agency.neyen.workhub'}))throw Error('Could not create Windows relocation fixture');
  if(!electron.shell.writeShortcutLink(otherShortcut,'create',{target:old,icon,iconIndex:0,appUserModelId:'another.hub'}))throw Error('Could not create unrelated shortcut fixture');
 });

 const pkg=()=>JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
 const captured=new Set();const capture=(wc,role)=>{if(captured.has(role))return;captured.add(role);setTimeout(async()=>{try{fs.writeFileSync(path.join(path.dirname(qa),path.basename(qa)+'-'+role+'.png'),(await wc.capturePage()).toPNG());}catch{}},350);};
 const write=(file,obj)=>fs.writeFileSync(path.join(qa,file),JSON.stringify(obj,null,2));
 const realDialog=dialog.showMessageBox.bind(dialog);
 dialog.showMessageBox=async(win,options)=>['Confirmar actualización de WorkHub','Actualización de WorkHub'].includes(options.title)?{response:0}:realDialog(win,options);
 dialog.showOpenDialog=async()=>({canceled:false,filePaths:[process.env.WORKHUB_QA_PATCH]});
 app.on('web-contents-created',(_event,wc)=>{
  const load=wc.loadURL.bind(wc);wc.loadURL=(url,...args)=>/^https?:/i.test(url)&&!url.startsWith('http://127.0.0.1:5173')?Promise.resolve():load(url,...args);
  const send=wc.send.bind(wc);wc.send=(channel,...args)=>{if(channel==='update-center-state'){try{fs.appendFileSync(path.join(qa,'progress.log'),JSON.stringify(args[0])+'\n');if(['installation','startup-check'].includes(args[0]?.stage)&&wc.getURL().includes('/.workhub-updates/'))capture(wc,'installer');}catch{}}return send(channel,...args);};
 });
 app.on('browser-window-created',(_event,win)=>{
  win.webContents.on('did-finish-load',async()=>{
   try{
    const url=win.webContents.getURL();
    if(url==='http://127.0.0.1:5173/'){
     await new Promise(r=>setTimeout(r,700));const version=pkg().version,seed=!fs.existsSync(path.join(qa,'seeded'));capture(win.webContents,'main');
     const result=await win.webContents.executeJavaScript(`(async()=>{
       await window.workhub.desktopReady();
       const key='workhub-ci-preserved',old=localStorage.getItem(key);if(${seed}&&!old)localStorage.setItem(key,'retained');
       return {local:localStorage.getItem(key)};
     })()`);
     const cookies=session.fromPartition('persist:workhub-gpt-personal').cookies;let found=await cookies.get({name:'workhub-ci'});if(seed&&!found.length){await cookies.set({url:'https://example.com',name:'workhub-ci',value:'retained',expirationDate:Date.now()/1000+86400});found=await cookies.get({name:'workhub-ci'});}
     await cookies.flushStore();if(seed)fs.writeFileSync(path.join(qa,'seeded'),'yes');
     const handle=win.getNativeWindowHandle().readBigUInt64LE().toString();
     const windowIcon=JSON.parse(await new Promise((resolve,reject)=>require('node:child_process').execFile('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'window-icon.ps1'),'-WindowHandle',handle],{encoding:'utf8',timeout:15000},(error,stdout)=>error?reject(error):resolve(stdout))));
     const repaired=electron.shell.readShortcutLink(movedShortcut),untouched=electron.shell.readShortcutLink(otherShortcut);
     if(path.resolve(repaired.target).toLowerCase()!==path.resolve(root,'WorkHub.exe').toLowerCase()||repaired.icon!==path.join(root,'assets/workhub-shell.ico')||untouched.appUserModelId!=='another.hub')throw Error('Windows shortcut repair failed');
     write('shortcut-relocation.json',{ok:true,target:repaired.target,icon:repaired.icon,otherHubPreserved:true});
     const shellIcon=await app.getFileIcon(path.join(root,'assets/workhub-shell.ico'),{size:'normal'});const pixels=shellIcon.toBitmap();let shellYellow=0;for(let i=0;i<pixels.length;i+=4){if(pixels[i+3]>100&&pixels[i+2]>140&&pixels[i+1]>90&&pixels[i]<180&&pixels[i+2]>=pixels[i+1])shellYellow++;}
     write('launch-'+version+'.json',{ok:true,version,windowIcon,shellYellow,local:result.local,cookie:found[0]?.value,root});
     if(process.env.WORKHUB_QA_FROM===version&&process.env.WORKHUB_QA_PATCH&&!fs.existsSync(path.join(qa,'requested'))){fs.writeFileSync(path.join(qa,'requested'),'yes');await win.webContents.executeJavaScript('window.workhub.updateDesktop()');}
    }else if(url.endsWith('/electron/update-center.html')&&process.env.WORKHUB_QA_PATCH){
     capture(win.webContents,'center');await new Promise(r=>setTimeout(r,300));await win.webContents.executeJavaScript("window.workHubUpdater.command('local')");
    }
   }catch(e){write('hook-error.json',{error:e.stack});}
  });
 });
 setInterval(()=>{if(fs.existsSync(path.join(qa,'stop')))app.quit();},300).unref();
}
}

