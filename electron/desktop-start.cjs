// Stable recovery entry point for online releases. Never replaced by format-2 patches.
// It uses only Node built-ins so it can repair a partially applied app.
const fs=require('node:fs');const path=require('node:path');const {spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),updates=path.join(root,'.workhub-updates');
const alive=pid=>{if(!Number.isSafeInteger(pid)||pid<1)return false;try{process.kill(pid,0);return true;}catch{return false;}};
async function recover(){
  const active=path.join(updates,'active.json');if(!fs.existsSync(active))return;
  const {id}=JSON.parse(fs.readFileSync(active,'utf8'));if(!/^[\da-f-]{36}$/.test(id))throw Error('Identificador de recuperación inválido.');
  const job=path.join(updates,id),j=JSON.parse(fs.readFileSync(path.join(job,'journal.json'),'utf8'));
  if(alive(j.workerPid))throw Error('La actualización está en curso. Esperá a que WorkHub se abra automáticamente.');
  if(path.resolve(j.root)!==root||!Array.isArray(j.entries))throw Error('El registro de recuperación no coincide con esta instalación.');
  if(j.state!=='complete'&&j.state!=='rolled-back'){
    if(alive(j.appPid))throw Error('Cerrá WorkHub antes de recuperar una actualización interrumpida.');
    for(const e of j.entries.slice().reverse()){
      if(!e.touched)continue;
      if(typeof e.path!=='string'||e.path.includes('\\')||e.path.includes(':')||e.path.split('/').some(x=>!x||x==='.'||x==='..')||!( /^(dist|electron|shared|src|scripts|assets|native|runtime)\//.test(e.path)||['package.json','package-lock.json','WorkHub.exe','LEEME.txt','INICIAR-WORKHUB.bat','index.html','vite.config.js'].includes(e.path))||(e.path==='electron/desktop-start.cjs'&&!j.legacyBackup))throw Error('Ruta de recuperación inválida.');
      const target=path.join(root,e.path);let current=root;for(const part of e.path.split('/')){current=path.join(current,part);if(fs.existsSync(current)&&fs.lstatSync(current).isSymbolicLink())throw Error('No se recuperan rutas con enlaces.');}
      if(e.existed){fs.mkdirSync(path.dirname(target),{recursive:true});await retry(()=>fs.promises.copyFile(path.join(job,'backup',e.path),target));}else await retry(()=>fs.promises.rm(target,{force:true}));
    }
    await atomic(path.join(updates,'result.json'),{ok:false,message:'Se recuperó la versión anterior después de una actualización interrumpida.'});
  }
  await retry(()=>fs.promises.rm(active,{force:true}));
}
function launch(){
  const runtime=path.join(root,'runtime','WorkhubEngine.exe');
  if(!fs.existsSync(runtime)||!fs.existsSync(path.join(root,'dist','index.html')))throw Error('Faltan archivos de WorkHub. Extraé el parche de transición dentro de la carpeta existente del programa.');
  const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.WORKHUB_UPDATE_JOB;
  const child=spawn(runtime,[root],{cwd:root,env,windowsHide:true,detached:true,stdio:'ignore'});child.once('error',error=>{fs.writeFileSync(path.join(root,'WorkHub-inicio-error.txt'),error.stack);process.exitCode=1;});child.unref();
}
function showError(error){
 if(process.platform!=='win32')return;
 const text=String(error.message||error).replace(/'/g,"''");
 const script="Add-Type -AssemblyName PresentationFramework;[System.Windows.MessageBox]::Show('"+text+"','WorkHub')|Out-Null";
 try{require('node:child_process').spawnSync('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{windowsHide:true,timeout:120000});}catch{}
}
async function retry(action){const until=Date.now()+8000;for(;;){try{return await action();}catch(e){if(!['EPERM','EBUSY','EACCES'].includes(e.code)||Date.now()>until)throw e;await new Promise(r=>setTimeout(r,200));}}}
async function atomic(file,value){const temporary=file+'.'+require('node:crypto').randomUUID()+'.tmp';let h;try{h=await fs.promises.open(temporary,'wx');await h.writeFile(JSON.stringify(value));await h.sync();await h.close();h=null;await retry(()=>fs.promises.rename(temporary,file));}finally{if(h)await h.close();await fs.promises.rm(temporary,{force:true}).catch(()=>{});}}
if(require.main===module)recover().then(launch).catch(error=>{fs.writeFileSync(path.join(root,'WorkHub-inicio-error.txt'),error.stack||String(error));showError(error);process.exitCode=1;});
module.exports={recover};
