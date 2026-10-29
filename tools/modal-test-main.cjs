const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');const {app,BrowserWindow,dialog}=require('electron');
const root=path.resolve(process.argv[2]),report=path.resolve(process.argv[3]),source=process.env.WORKHUB_SOURCE_ROOT;
const phase=message=>fs.writeFileSync(path.join(path.dirname(report),'modal-state.json'),JSON.stringify({message,argv:process.argv,pid:process.pid,electron:process.versions.electron}));
process.on('uncaughtException',error=>{fs.writeFileSync(report,JSON.stringify({ok:false,error:error.stack}));app.exit(1);});
process.on('unhandledRejection',error=>{fs.writeFileSync(report,JSON.stringify({ok:false,error:error.stack||String(error)}));app.exit(1);});
phase('script loaded');app.disableHardwareAcceleration();
let trackedManager;const nativeMessageBox=dialog.showMessageBox.bind(dialog);dialog.showMessageBox=(...args)=>{phase('native API called: '+args[1]?.title);return nativeMessageBox(...args);};
const {installDesktopUpdater}=require(path.join(source,'electron/desktop-update-ipc.cjs')),engine=require(path.join(source,'electron/desktop-update.cjs'));
fs.mkdirSync(path.join(root,'profile'),{recursive:true});app.setPath('userData',path.join(root,'profile'));phase('profile ready');app.setName('WorkHub Modal Test');
app.whenReady().then(async()=>{
 phase('app ready');const host=new BrowserWindow({width:550,height:350,title:'WorkHub Modal Test'});await host.loadURL('data:text/html,<h1>Prueba de confirmación nativa</h1>');
 phase('window loaded');const payload=fs.readFileSync(path.join(root,'patch.zip')),asset={from:'0.1.36',to:'0.1.37',sha256:engine.sha(payload),size:payload.length,url:'https://github.com/example/WorkHub/releases/download/v0.1.37/patch.zip'};
 const m=installDesktopUpdater({app,ipcMain:{handle(){}},dialog,host:()=>host,root,client:{options:{},check:async()=>({version:'0.1.37',available:true,patch:asset,full:asset}),request:async(_u,o)=>{fs.mkdirSync(path.dirname(o.destination),{recursive:true});fs.writeFileSync(o.destination,payload);}}});
 try{
  trackedManager=m;phase('manager ready');await m.command('channel','https://github.com/example/WorkHub/releases/latest/download/latest.json');await m.command('check');
  const observed=path.join(root,'modal-observed.txt');const automation=spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'native-modal.ps1'),'-Title','Confirmar actualización de WorkHub','-Button','Cancelar','-TargetProcessId',String(process.pid),'-Report',observed],{windowsHide:true,stdio:['ignore','pipe','pipe']});let automationError='';automation.stdout.on('data',b=>automationError+=b);automation.stderr.on('data',b=>automationError+=b);automation.on('exit',(code,signal)=>fs.writeFileSync(path.join(path.dirname(report),'modal-automation.json'),JSON.stringify({code,signal,error:automationError,observed:fs.existsSync(observed)})));
  let retainedWhileOpen=false;const monitor=setInterval(()=>{const p=m.getPending();if(m.getState().stage==='confirmation'&&p&&fs.existsSync(p.file))retainedWhileOpen=true;},100);
  phase('opening native confirmation');const result=await m.command('install');clearInterval(monitor);const pending=m.getPending();if(!result.canceled||!retainedWhileOpen||!pending||!fs.existsSync(pending.file)||!fs.existsSync(observed))throw Error('No se conservó la descarga durante el modal real: '+automationError);
  fs.writeFileSync(report,JSON.stringify({ok:true,nativeModal:true,zipRetained:true,canceled:true}));app.quit();
 }catch(e){fs.writeFileSync(report,JSON.stringify({ok:false,error:e.stack}));app.exit(1);}
});setTimeout(()=>{fs.writeFileSync(report,JSON.stringify({ok:false,error:'Native modal test timed out',state:trackedManager?.getState(),pending:trackedManager?.getPending(),windows:BrowserWindow.getAllWindows().map(w=>({title:w.getTitle(),url:w.webContents.getURL()}))}));app.exit(3);},35000).unref();

