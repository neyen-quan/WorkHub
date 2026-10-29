// One-time bridge from the exact legacy ZIP updater to the stable native launcher.
const fs=require('original-fs'),path=require('node:path'),{spawn}=require('node:child_process'),{app,BrowserWindow,ipcMain,dialog}=require('electron');
const engine=require('./app/electron/desktop-update.cjs'),{createChannelClient}=require('./app/electron/update-channel.cjs');
const root=path.dirname(process.execPath),payload=path.join(__dirname,'app'),inventory=JSON.parse(fs.readFileSync(path.join(payload,'assets/workhub-installation.json'))),version=inventory.version;
let win,busy=false;app.setAppUserModelId('agency.neyen.workhub');app.setPath('userData',path.join(app.getPath('appData'),'workhub-desktop'));
const progress=s=>win.webContents.send('transition-state',s),tick=()=>new Promise(r=>setImmediate(r));
async function start(){
 if(busy)return {};busy=true;let job;const startedAt=Date.now();
 try{
  const choice=await dialog.showMessageBox(win,{type:'question',message:'Instalar WorkHub '+version+' y activar las actualizaciones online',detail:'Se respaldará el programa actual. Se conservan los perfiles de cuentas y las preferencias. Se verificará el arranque de la versión nueva.',buttons:['Instalar','Cancelar'],cancelId:1,defaultId:0});if(choice.response!==0)return {};
  const resources=path.join(root,'resources');
  const backups=fs.readdirSync(resources).filter(n=>n.startsWith('backup-')).map(n=>path.join(resources,n)).filter(p=>fs.existsSync(path.join(p,'package.json'))).sort((a,b)=>fs.statSync(b).mtimeMs-fs.statSync(a).mtimeMs);
  const legacyBackup=backups.find(p=>{try{return ['0.7.2','0.7.3'].includes(JSON.parse(fs.readFileSync(path.join(p,'package.json'))).version);}catch{return false;}});
  if(!legacyBackup)throw Error('No se encontró el respaldo 0.7.2/0.7.3 del actualizador anterior. No se modificó el programa.');
  const oldMain=fs.readFileSync(path.join(legacyBackup,'electron/main.cjs'),'utf8');
  const literal=oldMain.match(/const gmailAccounts = (\{[\s\S]*?\});/);if(literal){const emails=require('node:vm').runInNewContext('('+literal[1]+')',{}, {timeout:100});const cfg=path.join(app.getPath('userData'),'private-config.json');if(!fs.existsSync(cfg))await engine.atomicJsonAsync(cfg,{emails});}
  const updates=path.join(root,'.workhub-updates');fs.mkdirSync(updates,{recursive:true});if(fs.existsSync(path.join(updates,'active.json')))throw Error('Hay una instalación pendiente. Cerrá y volvé a abrir WorkHub.');
  const id=require('node:crypto').randomUUID();job=path.join(updates,id);fs.mkdirSync(job);const stage=path.join(job,'stage');
  // Verify app payload and every exact runtime file before touching the installation.
  let runtimeSource=null;const runtimeEntries=Object.entries(inventory.files).filter(([n])=>n.startsWith('runtime/'));
  for(const [name,record]of runtimeEntries){progress({message:'Verificando motor local: '+name});const relative=name.slice(8),file=path.join(root,relative==='WorkhubEngine.exe'?path.basename(process.execPath):relative);if(!fs.existsSync(file)||fs.statSync(file).size!==record.size||await engine.hashFile(file)!==record.sha256){runtimeSource=false;break;}}
  if(runtimeSource===false){
   const client=createChannelClient(),channel=JSON.parse(fs.readFileSync(path.join(payload,'assets/update-channel.json'))).channel,info=await client.check(channel.replace('/releases/latest/download/latest.json','/releases/download/v'+version+'/latest.json'),'0.0.0');
   if(info.version!==version)throw Error('El canal cambió de versión. Usá el ZIP de transición más reciente.');
   const file=path.join(job,'runtime-download.zip');await client.request(info.full.url,{destination:file,expectedHash:info.full.sha256,expectedSize:info.full.size,onProgress:p=>progress({message:p.message||'Descargando motor compatible…',received:p.received,size:p.total})});
   runtimeSource=engine.unzip(await fs.promises.readFile(file));
  }
  const journal={id,root,from:JSON.parse(fs.readFileSync(path.join(legacyBackup,'package.json'))).version,to:version,state:'prepared',workerPid:0,entries:[],targetInventory:inventory,legacyBackup,startedAt};
  const records=[...Object.entries(inventory.files),['assets/workhub-installation.json',{sha256:engine.sha(fs.readFileSync(path.join(payload,'assets/workhub-installation.json')))}]];let done=0;
  for(const [name,record]of records){
   const dest=engine.inside(stage,name);fs.mkdirSync(path.dirname(dest),{recursive:true});
   if(name.startsWith('runtime/')){const rel=name.slice(8);if(runtimeSource){const bytes=runtimeSource.get(name);if(!bytes||engine.sha(bytes)!==record.sha256)throw Error('Motor descargado inválido');await fs.promises.writeFile(dest,bytes);}else await fs.promises.copyFile(path.join(root,rel==='WorkhubEngine.exe'?path.basename(process.execPath):rel),dest);}
   else await fs.promises.copyFile(path.join(payload,name),dest);
   if(await engine.hashFile(dest)!==record.sha256)throw Error('Hash de transición incorrecto: '+name);
   const target=engine.inside(root,name),existed=fs.existsSync(target);if(existed){const backup=path.join(job,'backup',name);fs.mkdirSync(path.dirname(backup),{recursive:true});await fs.promises.copyFile(target,backup);}
   journal.entries.push({path:name,existed,remove:false,sha256:record.sha256,touched:false});progress({message:'Verificando y respaldando '+name,completed:++done,total:records.length});await tick();
  }
  // The worker runs from a local copy, so it can replace the old root EXE safely.
  const recovery=path.join(job,'installer-runtime');fs.cpSync(path.join(stage,'runtime'),recovery,{recursive:true});
  for(const name of ['desktop-update.cjs','installer-main.cjs','installer-preload.cjs','update-center.html','update-center.css','update-center.js'])fs.copyFileSync(path.join(payload,'electron',name),path.join(job,name==='desktop-update.cjs'?'engine.cjs':name));
  fs.copyFileSync(path.join(payload,'assets/workhub.png'),path.join(job,'workhub.png'));await engine.atomicJsonAsync(path.join(job,'package.json'),{name:'workhub-transition-installer',version,main:'installer-main.cjs'});await engine.atomicJsonAsync(path.join(job,'journal.json'),journal);await engine.atomicJsonAsync(path.join(updates,'active.json'),{id});
  const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;const child=spawn(path.join(recovery,'WorkhubEngine.exe'),[job,'--parent='+process.pid],{cwd:job,env,detached:true,windowsHide:true,stdio:'ignore'});let error;child.on('error',e=>error=e);child.unref();
  const until=Date.now()+25000;while(!fs.existsSync(path.join(job,'ready'))){if(error)throw error;if(Date.now()>until)throw Error('El instalador no confirmó una ventana visible. WorkHub sigue abierto.');await new Promise(r=>setTimeout(r,100));}
  app.quit();return {ok:true};
 }catch(e){progress({message:'No se completó la transición. '+e.message});return {error:e.message};}finally{busy=false;}
}
ipcMain.handle('transition-start',event=>{if(event.sender!==win.webContents)return {error:'Acceso inválido'};return start();});
app.whenReady().then(()=>{win=new BrowserWindow({width:650,height:500,title:'Actualizar WorkHub',icon:path.join(payload,'assets/workhub.png'),webPreferences:{preload:path.join(__dirname,'wizard-preload.cjs'),sandbox:true,contextIsolation:true}});win.setMenu(null);win.loadFile(path.join(__dirname,'wizard.html'));});app.on('window-all-closed',()=>app.quit());
