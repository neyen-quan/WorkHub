const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const engine=require('./desktop-update.cjs'),{createChannelClient,repositoryOf}=require('./update-channel.cjs');
function installDesktopUpdater({app,ipcMain,dialog,host,root,runtime=process.execPath,platform=process.platform,BrowserWindow=require('electron').BrowserWindow,displayFor=bounds=>require('electron').screen.getDisplayMatching(bounds),client=createChannelClient()}){
 root=fs.realpathSync(root);let center,busy=false,abort,info=null,downloaded=null;
 const version=()=>JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version;
 const settings=path.join(app.getPath('userData'),'update-channel.json'),defaults=path.join(root,'assets/update-channel.json');
 let channel='';try{channel=JSON.parse(fs.readFileSync(settings,'utf8')).channel||'';}catch{try{channel=JSON.parse(fs.readFileSync(defaults,'utf8')).channel||'';}catch{}}
 let state={stage:'idle',installed:version(),available:null,channel,busy:false,canCancel:false,message:'Buscá una actualización o elegí un ZIP local.'};
 const notify=patch=>{state={...state,received:undefined,total:undefined,totalItems:undefined,completed:undefined,waiting:false,...patch,installed:version(),channel};if(center&&!center.isDestroyed())center.webContents.send('update-center-state',state);};
 function auth(event,contents){if(event.sender!==contents||event.senderFrame!==event.sender.mainFrame)throw Error('Acceso no autorizado al actualizador.');}
 const hostAuth=e=>auth(e,host()?.webContents),centerAuth=e=>auth(e,center?.webContents);
 const progress=p=>notify({...p,busy:true,canCancel:!['handoff'].includes(p.stage)});
 async function operation(action){if(busy)return {ok:false,error:'Ya hay una operación en curso.'};busy=true;abort=new AbortController();notify({busy:true,canCancel:true,startedAt:Date.now(),finishedAt:null,error:null});try{return await action(abort.signal);}catch(error){notify({stage:abort.signal.aborted?'canceled':'error',message:abort.signal.aborted?'Operación cancelada.':'No se completó la actualización.',error:abort.signal.aborted?null:error.message,busy:false,canCancel:false});return {ok:false,error:abort.signal.aborted?null:error.message};}finally{busy=false;if(state.stage!=='handoff')notify({busy:false,canCancel:false,finishedAt:Date.now()});}}
 async function check(signal){info=null;notify({canInstall:false,hasFull:false,available:null});if(!channel)throw Error('Guardá primero la URL de latest.json del repositorio de WorkHub.');info=await client.check(channel,version(),{signal,onProgress:progress});notify({stage:'idle',available:info.version,canInstall:info.available&&!!info.patch,hasFull:true,message:info.upToDate?'Ya tenés la última versión de WorkHub.':info.patch?'WorkHub '+info.version+' está disponible.': 'Hay una versión nueva, pero no hay un parche directo para esta instalación. Podés usar el paquete completo para repararla.'});return {ok:true};}
 async function installFile(file,signal,expected){
  notify({stage:'verification',message:'Verificando el ZIP y su inventario…',canCancel:true});
  if(fs.statSync(file).size>512*1024*1024)throw Error('El ZIP supera 512 MB.');
  const hash=await engine.hashFile(file);if(expected&&hash!==expected.sha256)throw Error('El SHA-256 del ZIP no coincide.');
  if(!expected&&fs.existsSync(file+'.sha256')){const digest=fs.readFileSync(file+'.sha256','utf8').trim().split(/\s+/)[0].toLowerCase();if(digest!==hash)throw Error('El ZIP no coincide con su archivo SHA-256.');}
  const buffer=await fs.promises.readFile(file),validated=engine.validatePatch(buffer,version());
  if(validated.manifest.format!==2)throw Error('Elegí un parche del nuevo canal online (formato 2).');
  if(expected&&(validated.manifest.version!==expected.to||!validated.manifest.fromVersions.includes(expected.from)))throw Error('Las versiones del ZIP no coinciden con el canal.');
  if(signal.aborted)throw Error('Operación cancelada.');
  // The download and pending state remain owned here across the awaited native modal.
  // Never launch a background task that deletes this ZIP when its own promise ends.
  notify({stage:'confirmation',message:'ZIP verificado. Esperando tu confirmación para instalar…',canCancel:false});
  const choice=await dialog.showMessageBox(center||host(),{type:'question',title:'Confirmar actualización de WorkHub',message:'Actualizar WorkHub '+version()+' → '+validated.manifest.version,detail:'Se respaldará la versión actual y se conservarán tus datos y preferencias. Guardá los formularios pendientes antes de continuar.\n\nZIP SHA-256: '+hash,buttons:['Descargar e instalar','Cancelar'],defaultId:0,cancelId:1,noLink:true});
  if(choice.response!==0||signal.aborted){notify({stage:'canceled',message:'Instalación cancelada. El ZIP verificado sigue disponible para reintentar.'});return {ok:true,canceled:true};}
  const pending=await engine.prepareAsync(root,buffer,version(),progress,signal);if(signal.aborted){fs.rmSync(path.join(root,'.workhub-updates/active.json'),{force:true});fs.rmSync(pending.job,{recursive:true,force:true});throw Error('Operación cancelada.');}const journalFile=path.join(pending.job,'journal.json'),journal=JSON.parse(fs.readFileSync(journalFile,'utf8'));journal.startedAt=state.startedAt;journal.hostBounds=host()?.getBounds();await engine.atomicJsonAsync(journalFile,journal);let worker;
  try{
   notify({stage:'handoff',message:'Abriendo el instalador independiente. WorkHub seguirá abierto hasta que esté listo.',canCancel:false});
   const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;worker=spawn(pending.runtime,[pending.job,'--parent='+process.pid],{cwd:pending.job,env,windowsHide:true,detached:true,stdio:'ignore'});let failed;worker.once('error',e=>{failed=e;});worker.unref();
   const until=Date.now()+20000;while(!fs.existsSync(path.join(pending.job,'ready'))){if(failed)throw failed;if(Date.now()>until)throw Error('El instalador no confirmó que pudo abrirse. WorkHub no se cerró.');await new Promise(r=>setTimeout(r,100));}
   notify({stage:'handoff',message:'Instalador listo. Cerrando WorkHub para aplicar el parche…',canCancel:false});setTimeout(()=>app.quit(),350);return {ok:true,restarting:true};
  }catch(e){if(worker?.pid){try{process.kill(worker.pid);}catch{}}fs.rmSync(path.join(root,'.workhub-updates/active.json'),{force:true});throw e;}
 }
 async function command(name,arg){
  if(name==='cancel'){abort?.abort();notify({canCancel:false,message:'Cancelación solicitada. Esperando el cierre de la operación…'});return {ok:true};}
  if(name==='channel'){if(busy)return {ok:false,error:'Esperá a que termine la operación.'};const value=repositoryOf(String(arg||''),client.options).url;channel=value;await engine.atomicJsonAsync(settings,{channel});info=null;downloaded=null;notify({stage:'idle',available:null,canInstall:false,hasFull:false,message:'Canal guardado. Buscá actualizaciones.'});return {ok:true};}
  return operation(async signal=>{
   if(name==='check')return check(signal);
   if(name==='install'){
    if(!info?.patch||!info.available)throw Error('Buscá una actualización compatible antes de instalar.');
    if(!downloaded||downloaded.hash!==info.patch.sha256||!fs.existsSync(downloaded.file)){
     const folder=path.join(app.getPath('userData'),'updates','downloads');fs.mkdirSync(folder,{recursive:true});const file=path.join(folder,crypto.randomUUID()+'.zip');
     await client.request(info.patch.url,{signal,destination:file,expectedHash:info.patch.sha256,expectedSize:info.patch.size,maxBytes:512*1024*1024,onProgress:progress});downloaded={file,hash:info.patch.sha256};
    }
    return installFile(downloaded.file,signal,info.patch);
   }
   if(name==='local'){
    const picked=await dialog.showOpenDialog(center||host(),{title:'Instalar parche ZIP de WorkHub',properties:['openFile'],filters:[{name:'Parche ZIP',extensions:['zip']}]});if(picked.canceled||!picked.filePaths?.[0]){notify({stage:'canceled',message:'No se seleccionó ningún ZIP.'});return {ok:true,canceled:true};}return installFile(picked.filePaths[0],signal);
   }
   if(name==='full'){
    if(!info?.full)throw Error('Buscá actualizaciones antes de descargar el paquete completo.');const pick=await dialog.showSaveDialog(center||host(),{title:'Guardar paquete completo de WorkHub',defaultPath:path.join(app.getPath('downloads'),'WorkHub-'+info.version+'-Windows-x64.zip'),filters:[{name:'ZIP',extensions:['zip']}]});if(pick.canceled||!pick.filePath){notify({stage:'canceled',message:'Descarga cancelada.'});return {ok:true,canceled:true};}
    if(fs.existsSync(pick.filePath))throw Error('Elegí un nombre nuevo para conservar el archivo existente.');await client.request(info.full.url,{signal,destination:pick.filePath,expectedHash:info.full.sha256,expectedSize:info.full.size,onProgress:progress});notify({stage:'complete',message:'Paquete completo verificado y guardado en '+pick.filePath+'. Es para instalaciones nuevas o reparación; no se instaló sobre tu programa.'});return {ok:true};
   }
   throw Error('Acción del actualizador desconocida.');
  });
 }
 function open(){
  const owner=host(),area=displayFor(owner.getBounds()).workArea,bounds=centeredBounds(area,810,650);
  if(center&&!center.isDestroyed()){center.setBounds(bounds);center.show();center.focus();return;}
  center=new BrowserWindow({...bounds,minWidth:Math.min(620,area.width),minHeight:Math.min(560,area.height),title:'Actualizar WorkHub',parent:host(),show:false,autoHideMenuBar:true,backgroundColor:'#10151d',icon:path.join(root,'assets/workhub.png'),webPreferences:{preload:path.join(__dirname,'update-center-preload.cjs'),contextIsolation:true,sandbox:true,nodeIntegration:false}});center.setMenu(null);center.once('ready-to-show',()=>center.show());center.on('closed',()=>{center=null;if(state.stage!=='handoff')abort?.abort();});center.loadFile(path.join(__dirname,'update-center.html'));
 }
 ipcMain.handle('desktop-update-install',async event=>{try{hostAuth(event);if(platform!=='win32')return {ok:false,error:'La actualización está disponible en Windows.'};open();return {ok:true};}catch(e){return {ok:false,error:e.message};}});
 ipcMain.handle('update-center-ready',event=>{centerAuth(event);return state;});
 ipcMain.handle('update-center-command',async(event,{name,arg}={})=>{try{centerAuth(event);return await command(name,arg);}catch(e){notify({stage:'error',error:e.message,message:'No se pudo completar la operación.'});return {ok:false,error:e.message};}});
 ipcMain.handle('desktop-update-ready',async event=>{
  hostAuth(event);const id=process.env.WORKHUB_UPDATE_JOB;
  if(id&&/^[\da-f-]{36}$/.test(id)){
   const job=path.join(root,'.workhub-updates',id),j=JSON.parse(fs.readFileSync(path.join(job,'journal.json'),'utf8'));
   if(j.id===id&&j.to===version()&&j.state==='awaiting-health')await engine.atomicJsonAsync(path.join(job,'healthy.json'),{id,version:version(),pid:process.pid});delete process.env.WORKHUB_UPDATE_JOB;
  }
  const result=path.join(root,'.workhub-updates/result.json');if(fs.existsSync(result)){try{const r=JSON.parse(fs.readFileSync(result,'utf8'));if(!r.ok)await dialog.showMessageBox(host(),{type:'warning',title:'Actualización de WorkHub',message:r.message,buttons:['Aceptar']});fs.rmSync(result,{force:true});}catch{}}
  return {ok:true,version:version()};
 });
 return {getState:()=>state,getPending:()=>downloaded,command,open};
}
function centeredBounds(area,width,height){width=Math.min(width,area.width);height=Math.min(height,area.height);return {x:area.x+Math.round((area.width-width)/2),y:area.y+Math.round((area.height-height)/2),width,height};}
module.exports={installDesktopUpdater,centeredBounds};

