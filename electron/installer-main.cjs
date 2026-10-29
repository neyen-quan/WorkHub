const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const {app,BrowserWindow,ipcMain,screen}=require('electron'),engine=require('./engine.cjs');
const job=__dirname,journalFile=path.join(job,'journal.json'),journal=JSON.parse(fs.readFileSync(journalFile,'utf8'));
const parent=Number(process.argv.find(a=>a.startsWith('--parent='))?.slice(9));
app.setName('WorkHub Actualizador');app.setPath('userData',path.join(job,'.installer-profile'));app.setAppUserModelId('agency.neyen.workhub.updater');
const delay=ms=>new Promise(r=>setTimeout(r,ms)),alive=pid=>{try{process.kill(pid,0);return true;}catch{return false;}};
let win,finished=false,cancel=false,running=false,state={stage:'handoff',busy:true,canCancel:true,startedAt:journal.startedAt||Date.now(),message:'Esperando que WorkHub se cierre…'};
function status(p){state={...state,received:undefined,total:undefined,completed:undefined,totalItems:undefined,...p};win?.webContents.send('update-center-state',state);/* Progress is live UI state, never a prerequisite for install or recovery. */}
function auth(event){if(event.sender!==win?.webContents||event.senderFrame!==event.sender.mainFrame)throw Error('Solicitud inválida.');}
function launch(token){if(journal.legacyBackup&&!fs.existsSync(path.join(journal.root,'package.json'))){const old=spawn(path.join(journal.root,'WorkHub.exe'),[],{cwd:journal.root,detached:true,windowsHide:true,stdio:'ignore'});old.on('error',()=>{});return old;}const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.WORKHUB_UPDATE_JOB;const child=spawn(path.join(journal.root,'runtime','WorkhubEngine.exe'),[journal.root],{cwd:journal.root,env:{...env,...(token?{WORKHUB_UPDATE_JOB:token}:{})},detached:true,windowsHide:true,stdio:'ignore'});child.on('error',()=>{});return child;}
async function run(){
 if(running)return;running=true;let child;
 try{
  if(!Number.isSafeInteger(parent)||parent<1)throw Error('No se recibió el proceso de WorkHub.');
  journal.workerPid=process.pid;await engine.atomicJsonAsync(journalFile,journal);
  // This receipt is emitted only after the independent installer UI has loaded.
  const shownUntil=Date.now()+5000;while(!win.isVisible()){if(Date.now()>shownUntil)throw Error('No se pudo mostrar la ventana del instalador.');await delay(50);}
  fs.writeFileSync(path.join(job,'ready'),'ready');
  const until=Date.now()+60000;while(alive(parent)){if(Date.now()>until)throw Error('WorkHub no se cerró a tiempo. No se aplicó el parche.');if(cancel)throw Error('Actualización cancelada.');await delay(150);}
  if(cancel)throw Error('Actualización cancelada.');
  await engine.applyAsync(job,journal,p=>{status({...p,busy:true,canCancel:p.stage==='installation'});if(cancel)throw Error('Actualización cancelada.');});
  status({stage:'restart',busy:true,canCancel:false,message:'Abriendo la nueva versión de WorkHub…'});
  child=launch(journal.id);await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});journal.appPid=child.pid;await engine.atomicJsonAsync(journalFile,journal);
  status({stage:'startup-check',busy:true,canCancel:false,message:'Esperando la confirmación de la interfaz. Esto puede tardar hasta un minuto.'});
  let healthy=false;const end=Date.now()+60000;
  while(Date.now()<end){try{const h=JSON.parse(fs.readFileSync(path.join(job,'healthy.json'),'utf8'));if(h.id===journal.id&&h.version===journal.to){healthy=true;break;}}catch{}if(!alive(child.pid))break;await delay(200);}
  if(!healthy)throw Error('La nueva versión no confirmó un inicio correcto.');
  journal.state='complete';await engine.atomicJsonAsync(journalFile,journal);await engine.atomicJsonAsync(path.join(journal.root,'.workhub-updates/result.json'),{ok:true,version:journal.to,message:'WorkHub se actualizó a '+journal.to+'.'});fs.rmSync(path.join(journal.root,'.workhub-updates/active.json'),{force:true});
  child.unref();status({stage:'complete',busy:false,canCancel:false,finishedAt:Date.now(),completed:1,totalItems:1,message:'WorkHub '+journal.to+' está funcionando. Tus datos se conservaron.'});finished=true;await delay(2000);app.quit();
 }catch(error){
  try{
   if(child?.pid&&alive(child.pid)){try{process.kill(child.pid);}catch{}const until=Date.now()+8000;while(alive(child.pid)&&Date.now()<until)await delay(100);if(alive(child.pid))throw Error('Cerrá la nueva versión y abrí WorkHub.exe para recuperar la anterior.');}
   status({stage:'recovery',busy:true,canCancel:false,message:'Recuperando la versión anterior…'});await engine.rollbackAsync(job,journal,p=>status({...p,busy:true,canCancel:false}));
   await engine.atomicJsonAsync(path.join(journal.root,'.workhub-updates/result.json'),{ok:false,message:error.message+' Se conservó la versión anterior.'});fs.rmSync(path.join(journal.root,'.workhub-updates/active.json'),{force:true});
   if(journal.legacyBackup){const backup=path.resolve(journal.legacyBackup),resources=path.join(journal.root,'resources');if(!backup.startsWith(resources+path.sep)||!path.basename(backup).startsWith('backup-'))throw Error('Respaldo de transición inválido');fs.cpSync(backup,path.join(resources,'app'),{recursive:true});}
   if(!alive(parent)){status({stage:'restart',busy:true,canCancel:false,message:'Abriendo la versión anterior…'});launch().unref();}
   status({stage:cancel?'canceled':'error',finishedAt:Date.now(),busy:false,canCancel:false,message:cancel?'Actualización cancelada. Se recuperó la versión anterior.':'La actualización falló y se recuperó la versión anterior.',error:error.message});finished=true;
  }catch(recoveryError){status({stage:'error',busy:false,canCancel:false,message:'No se pudo completar la recuperación. Abrí WorkHub.exe para continuar.',error:recoveryError.message});finished=true;}
 }
}
ipcMain.handle('installer-ready',event=>{auth(event);setTimeout(()=>void run(),50);return state;});
ipcMain.handle('installer-command',(event,name)=>{auth(event);if(name==='cancel'&&state.canCancel){cancel=true;status({message:'Cancelación solicitada. Esperando un punto seguro para recuperar…',canCancel:false});}return {ok:true};});
app.whenReady().then(()=>{const area=screen.getPrimaryDisplay().workArea;win=new BrowserWindow({width:640,height:410,minWidth:550,minHeight:370,x:area.x+Math.round((area.width-640)/2),y:area.y+Math.round((area.height-410)/2),show:false,title:'Instalando WorkHub',icon:path.join(job,'workhub.png'),autoHideMenuBar:true,backgroundColor:'#10151d',webPreferences:{preload:path.join(job,'installer-preload.cjs'),contextIsolation:true,sandbox:true,nodeIntegration:false}});win.setMenu(null);win.once('ready-to-show',()=>win.show());win.on('close',event=>{if(!finished){event.preventDefault();if(state.canCancel)cancel=true;}});win.loadFile(path.join(job,'update-center.html')).then(()=>{win.show();win.focus();});});
app.on('window-all-closed',()=>app.quit());

