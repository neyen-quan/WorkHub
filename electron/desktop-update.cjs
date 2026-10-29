// WorkHub patch format 1. No shell, PowerShell, external unzip or npm dependency.
// Hash and replace physical ASAR bytes, bypassing Electron's virtual archive fs.
const fs = (()=>{try{return require('original-fs');}catch{return require('node:fs');}})();
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const APP_ID = 'agency.neyen.workhub';
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const MAX_BYTES = 1024 * 1024 * 1024;
function version(value) {
  if (typeof value !== 'string' || !/^\d{1,6}\.\d{1,6}\.\d{1,6}$/.test(value)) throw Error('Versión de parche inválida.');
  return value.split('.').map(Number);
}
function newer(a,b) { const x=version(a),y=version(b);for(let i=0;i<3;i++)if(x[i]!==y[i])return x[i]>y[i];return false; }
function safeName(name) {
  if(typeof name!=='string'||name.length>220||name.includes('\\')||name.startsWith('/')||/[\x00-\x1f:*?"<>|]/.test(name))throw Error('El ZIP contiene una ruta inválida.');
  const parts=name.split('/');
  if(parts.some(p=>!p||p==='.'||p==='..'||/[. ]$/.test(p)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p)))throw Error('El ZIP contiene una ruta insegura para Windows.');
  return name;
}
function allowedFile(name) {
  safeName(name);
  // The recovery bootstrap is deliberately immutable in format 1.
  if(name==='electron/desktop-bootstrap.cjs')return false;
  return /^(dist|electron|shared|src|scripts|assets|native)\//.test(name)||['package.json','package-lock.json','WorkHub.exe','LEEME.txt','INICIAR-WORKHUB.bat','index.html','vite.config.js'].includes(name);
}
const crcTable=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=(n&1)?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes)crc=crcTable[(crc^byte)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
function unzip(buffer) {
  if(!Buffer.isBuffer(buffer)||buffer.length<22||buffer.length>512*1024*1024)throw Error('El ZIP está vacío o supera 512 MB.');
  let end=-1;for(let i=buffer.length-22;i>=Math.max(0,buffer.length-65557);i--)if(buffer.readUInt32LE(i)===0x06054b50&&i+22+buffer.readUInt16LE(i+20)===buffer.length){end=i;break;}
  if(end<0)throw Error('No se pudo leer el ZIP. Volvé a descargar el parche.');
  const count=buffer.readUInt16LE(end+10),size=buffer.readUInt32LE(end+12),offset=buffer.readUInt32LE(end+16);
  if(buffer.readUInt16LE(end+4)||buffer.readUInt16LE(end+6)||count!==buffer.readUInt16LE(end+8)||count>10000||offset+size!==end)throw Error('ZIP dividido, ZIP64 o estructura no compatible.');
  const files=new Map(),seen=new Set();let cursor=offset,total=0;
  for(let i=0;i<count;i++){
    if(cursor+46>end||buffer.readUInt32LE(cursor)!==0x02014b50)throw Error('Directorio del ZIP dañado.');
    const flags=buffer.readUInt16LE(cursor+8),method=buffer.readUInt16LE(cursor+10),crc=buffer.readUInt32LE(cursor+16),compressed=buffer.readUInt32LE(cursor+20),length=buffer.readUInt32LE(cursor+24),nl=buffer.readUInt16LE(cursor+28),el=buffer.readUInt16LE(cursor+30),cl=buffer.readUInt16LE(cursor+32),local=buffer.readUInt32LE(cursor+42),mode=buffer.readUInt32LE(cursor+38)>>>16;
    if(cursor+46+nl+el+cl>end)throw Error('Nombre de archivo truncado.');
    let name=buffer.subarray(cursor+46,cursor+46+nl).toString('utf8');
    cursor+=46+nl+el+cl;
    const directory=name.endsWith('/');if(directory)name=name.slice(0,-1);safeName(name);
    if(seen.has(name.toLowerCase()))throw Error('El ZIP contiene nombres duplicados.');seen.add(name.toLowerCase());
    if((mode&0xf000)===0xa000||(flags&1)||![0,8].includes(method))throw Error('El ZIP contiene enlaces, cifrado o compresión no compatible.');
    if(directory)continue;
    total+=length;if(total>MAX_BYTES)throw Error('El parche descomprimido supera 1 GB.');
    if(local+30>offset||buffer.readUInt32LE(local)!==0x04034b50)throw Error('Cabecera del ZIP dañada.');
    const lnl=buffer.readUInt16LE(local+26),lel=buffer.readUInt16LE(local+28),start=local+30+lnl+lel;
    if(buffer.subarray(local+30,local+30+lnl).toString('utf8')!==name||buffer.readUInt16LE(local+8)!==method||start+compressed>offset)throw Error('El ZIP contiene cabeceras inconsistentes.');
    let bytes;try{const packed=buffer.subarray(start,start+compressed);bytes=method===0?packed:zlib.inflateRawSync(packed,{maxOutputLength:Math.max(1,length)});}catch{throw Error('No se pudo descomprimir un archivo del parche.');}
    if(bytes.length!==length||crc32(bytes)!==crc)throw Error('Un archivo del ZIP está dañado. Volvé a descargarlo.');
    files.set(name,bytes);
  }
  if(cursor!==end)throw Error('Directorio del ZIP inconsistente.');
  return files;
}
function validatePatch(buffer,currentVersion) {
  const files=unzip(buffer),manifestBytes=files.get('workhub-patch.json');
  if(!manifestBytes)throw Error('Este ZIP no es un parche del nuevo actualizador de WorkHub: falta workhub-patch.json. No se modificó el programa.');
  let m;try{m=JSON.parse(manifestBytes);}catch{throw Error('El manifiesto del parche no es válido.');}
  if(m.appId!==APP_ID||![1,2].includes(m.format))throw Error('El ZIP no corresponde a WorkHub o usa otro formato.');
  if(m.format===1&&newer(currentVersion,'0.1.35'))throw Error('Esta versión requiere un parche incremental con inventario (formato 2).');
  if(m.format===2)validateInventory(m.base,currentVersion);
  if(m.format===2){validateInventory(m.target,m.version);const oldNames=new Map(Object.keys(m.base.files).map(n=>[n.toLowerCase(),n]));for(const n of Object.keys(m.target.files))if(oldNames.has(n.toLowerCase())&&oldNames.get(n.toLowerCase())!==n)throw Error('No se admiten cambios de nombre solo por mayúsculas en un parche Windows.');}
  if(!newer(m.version,currentVersion))throw Error('El parche debe ser más nuevo que WorkHub '+currentVersion+'.');
  if(!Array.isArray(m.fromVersions)||!m.fromVersions.includes(currentVersion))throw Error('Este parche no es compatible con WorkHub '+currentVersion+'. Necesitás el parche para tu versión.');
  if(!Array.isArray(m.files)||!m.files.length||m.files.length>10000)throw Error('El parche no contiene una lista válida de archivos.');
  const names=new Set();
  for(const f of m.files){
    if(!f||!(m.format===2?ownedFile(f.path):allowedFile(f.path))||names.has(f.path.toLowerCase()))throw Error('El parche intenta cambiar archivos no permitidos.');
    names.add(f.path.toLowerCase());const bytes=files.get(f.path);
    if(!bytes||!Number.isSafeInteger(f.size)||f.size!==bytes.length||sha(bytes)!==f.sha256)throw Error('El parche está incompleto o falló la verificación de integridad: '+f.path);
  }
  if(files.size!==m.files.length+1)throw Error('El ZIP contiene archivos fuera del manifiesto.');
  let pkg;try{pkg=JSON.parse(files.get('package.json'));}catch{throw Error('El parche debe incluir package.json con su versión.');}
  if(pkg.name!=='workhub-desktop'||pkg.version!==m.version||pkg.main!=='electron/main.cjs')throw Error('La identidad o versión del programa no coincide con el parche.');
  if(m.format===2){
    if(!Array.isArray(m.remove)||new Set(m.remove).size!==m.remove.length)throw Error('Lista de eliminaciones inválida.');
    for(const name of m.remove)if(!ownedFile(name)||!m.base.files[name]||m.target.files[name]||names.has(name.toLowerCase()))throw Error('El parche intenta eliminar un archivo no permitido.');
    for(const f of m.files){if(f.path==='assets/workhub-installation.json')continue;const expected=m.target.files[f.path];if(!expected||expected.sha256!==f.sha256||expected.size!==f.size)throw Error('El inventario de destino no coincide con el parche.');}
    for(const [name,target]of Object.entries(m.target.files))if(!m.base.files[name]||m.base.files[name].sha256!==target.sha256){if(!files.has(name))throw Error('Falta un archivo modificado del inventario: '+name);}
    for(const name of Object.keys(m.base.files))if(!m.target.files[name]&&!m.remove.includes(name))throw Error('Falta declarar una eliminación.');
    const inventory=files.get('assets/workhub-installation.json');if(!inventory||JSON.stringify(JSON.parse(inventory))!==JSON.stringify(m.target))throw Error('Falta el inventario completo de destino.');
  }
  return {manifest:m,files};
}
function atomicJson(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.tmp';const fd=fs.openSync(tmp,'w',0o600);try{fs.writeFileSync(fd,JSON.stringify(value,null,2));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}fs.renameSync(tmp,file);}
function inside(root,name){safeName(name);let current=root;for(const part of name.split('/')){current=path.join(current,part);try{if(fs.lstatSync(current).isSymbolicLink())throw Error('No se actualizan rutas que contienen enlaces.');}catch(e){if(e.code!=='ENOENT')throw e;}}return current;}
module.exports={APP_ID,sha,crc32,version,newer,safeName,allowedFile,unzip,validatePatch,atomicJson,inside};

// Format 2 extends the same transaction engine with exact published inventories.
const nextTurn=()=>new Promise(resolve=>setImmediate(resolve));
async function retryFile(action,onWait=()=>{}){const until=Date.now()+8000;for(;;){try{return await action();}catch(e){if(!['EPERM','EBUSY','EACCES'].includes(e.code)||Date.now()>until)throw e;onWait();await new Promise(r=>setTimeout(r,200));}}}
// Unique staging names and asynchronous retry keep Windows sharing locks from
// corrupting a journal or blocking the installer UI while it waits.
async function atomicJsonAsync(file,value,onWait=()=>{}){
 await fs.promises.mkdir(path.dirname(file),{recursive:true});
 const temp=file+'.'+crypto.randomUUID()+'.tmp';let handle;
 try{
  handle=await fs.promises.open(temp,'wx',0o600);
  await handle.writeFile(JSON.stringify(value,null,2));await handle.sync();await handle.close();handle=null;
  await retryFile(()=>fs.promises.rename(temp,file),onWait);
 }finally{if(handle)await handle.close();await fs.promises.rm(temp,{force:true}).catch(()=>{});}
}
const IMMUTABLE=new Set(['electron/desktop-bootstrap.cjs','electron/desktop-start.cjs']);
function ownedFile(name,reference=false){
 safeName(name);if(IMMUTABLE.has(name))return reference;
 return allowedFile(name)||name.startsWith('runtime/');
}
function validateInventory(inventory,expectedVersion){
 if(!inventory||inventory.product!=='WorkHub'||inventory.appId!==APP_ID||inventory.version!==expectedVersion||!inventory.files||typeof inventory.files!=='object'||Array.isArray(inventory.files)||Object.keys(inventory.files).length>10000)throw Error('Inventario del programa inválido.');
 const seen=new Set();for(const [name,item]of Object.entries(inventory.files)){
  if(name==='assets/workhub-installation.json'||!ownedFile(name,true)||seen.has(name.toLowerCase())||!item||!Number.isSafeInteger(item.size)||item.size<0||!/^[a-f0-9]{64}$/.test(item.sha256))throw Error('Archivo inválido en el inventario.');seen.add(name.toLowerCase());
 }
 if(!inventory.files['package.json']||!inventory.files['electron/main.cjs'])throw Error('El inventario no contiene el programa.');
 return inventory;
}
async function hashFile(file){const hash=crypto.createHash('sha256');for await(const chunk of fs.createReadStream(file))hash.update(chunk);return hash.digest('hex');}
async function verifyInventory(root,inventory,onProgress=()=>{},signal){
 const entries=Object.entries(inventory.files);let count=0;
 for(const [name,item]of entries){
  if(signal?.aborted)throw Error('Operación cancelada.');const file=inside(root,name);
  if(!fs.existsSync(file)||!fs.statSync(file).isFile()||fs.statSync(file).size!==item.size||await hashFile(file)!==item.sha256)throw Error('La instalación no coincide con la versión publicada: '+name+'. Usá el paquete completo para repararla.');
  onProgress({stage:'verification',completed:++count,totalItems:entries.length,message:'Verificando la instalación: '+name});await nextTurn();
 }
}
async function prepareAsync(root,buffer,currentVersion,onProgress=()=>{},signal){
 const {manifest,files}=validatePatch(buffer,currentVersion);
 if(manifest.format!==2)throw Error('Necesitás un parche de formato 2.');
 const inventoryFile=path.join(root,'assets/workhub-installation.json');
 const installed=JSON.parse(await fs.promises.readFile(inventoryFile,'utf8'));
 if(JSON.stringify(installed)!==JSON.stringify(manifest.base))throw Error('El inventario instalado no coincide con la base del parche.');
 await verifyInventory(root,manifest.base,onProgress,signal);
 const updates=path.join(root,'.workhub-updates');fs.mkdirSync(updates,{recursive:true});const active=path.join(updates,'active.json');if(fs.existsSync(active))throw Error('Hay una actualización pendiente. Reiniciá WorkHub.exe.');
 const id=crypto.randomUUID(),job=path.join(updates,id);fs.mkdirSync(job);
 const journal={id,root,from:currentVersion,to:manifest.version,state:'prepared',workerPid:0,entries:[],targetInventory:manifest.target};
 try{
  const changes=[...manifest.files.map(f=>({...f,remove:false})),...manifest.remove.map(name=>({path:name,remove:true}))];
  let i=0;for(const f of changes){
   if(signal?.aborted)throw Error('Operación cancelada.');const target=inside(root,f.path),backup=path.join(job,'backup',f.path),staged=path.join(job,'stage',f.path);const existed=fs.existsSync(target);
   onProgress({stage:'preparation',completed:i,totalItems:changes.length,message:'Preparando '+f.path});
   if(!f.remove){fs.mkdirSync(path.dirname(staged),{recursive:true});await fs.promises.writeFile(staged,files.get(f.path));}
   onProgress({stage:'backup',completed:i,totalItems:changes.length,message:'Respaldando '+f.path});
   if(existed){if(!fs.statSync(target).isFile())throw Error('El destino es una carpeta: '+f.path);fs.mkdirSync(path.dirname(backup),{recursive:true});await fs.promises.copyFile(target,backup);}
   journal.entries.push({path:f.path,existed,remove:f.remove,sha256:f.sha256||null,touched:false});i++;await nextTurn();
  }
  for(const name of ['desktop-update.cjs','installer-main.cjs','installer-preload.cjs','update-center.html','update-center.css','update-center.js']){
   const target=name==='desktop-update.cjs'?'engine.cjs':name;await fs.promises.copyFile(path.join(__dirname,name),path.join(job,target));
  }
  await fs.promises.copyFile(path.join(__dirname,'../assets/workhub.png'),path.join(job,'workhub.png'));
  await atomicJsonAsync(path.join(job,'package.json'),{name:'workhub-installer',main:'installer-main.cjs',version:journal.to});
  // A changing runtime must not be used by the installer while it is replaced.
  if(journal.entries.some(e=>e.path.startsWith('runtime/'))){
   const runtimeEntries=[];async function visit(dir,relative=''){for(const entry of await fs.promises.readdir(dir,{withFileTypes:true})){const name=path.join(relative,entry.name);if(entry.isSymbolicLink())throw Error('El motor contiene un enlace.');if(entry.isDirectory())await visit(path.join(dir,entry.name),name);else runtimeEntries.push(name);}}await visit(path.join(root,'runtime'));
   let n=0;const recoveryReady=path.join(updates,'recovery-runtime','.ready');for(const name of (fs.existsSync(recoveryReady)?[]:runtimeEntries)){if(signal?.aborted)throw Error('Operación cancelada.');const target=path.join(updates,'recovery-runtime',name);fs.mkdirSync(path.dirname(target),{recursive:true});await fs.promises.copyFile(path.join(root,'runtime',name),target);onProgress({stage:'preparation',completed:++n,totalItems:runtimeEntries.length,message:'Preparando motor independiente del instalador…'});await nextTurn();}
   fs.writeFileSync(recoveryReady,'ready');journal.installerRuntime=path.join(updates,'recovery-runtime','WorkhubEngine.exe');
  }else journal.installerRuntime=path.join(root,'runtime','WorkhubEngine.exe');
  if(signal?.aborted)throw Error('Operación cancelada.');await atomicJsonAsync(path.join(job,'journal.json'),journal);await atomicJsonAsync(active,{id});return {id,job,version:journal.to,count:journal.entries.length,runtime:journal.installerRuntime};
 }catch(e){fs.rmSync(job,{recursive:true,force:true});throw e;}
}
async function applyAsync(job,journal,onProgress=()=>{}){
 journal.state='applying';await atomicJsonAsync(path.join(job,'journal.json'),journal);let done=0;
 for(const entry of journal.entries){
  if(!ownedFile(entry.path)&&!(journal.legacyBackup&&entry.path==='electron/desktop-start.cjs'))throw Error('Ruta de instalación no permitida.');const target=inside(journal.root,entry.path),staged=path.join(job,'stage',entry.path);
  if(!entry.remove&&await hashFile(staged)!==entry.sha256)throw Error('El archivo preparado está dañado: '+entry.path);
  entry.touched=true;await atomicJsonAsync(path.join(job,'journal.json'),journal);
  if(entry.remove)await fs.promises.rm(target,{force:true});else{fs.mkdirSync(path.dirname(target),{recursive:true});const temp=target+'.workhub-new';await fs.promises.copyFile(staged,temp);try{await retryFile(()=>fs.promises.rename(temp,target),()=>onProgress({stage:'installation',message:'Esperando que Windows libere '+entry.path+'…'}));}finally{await fs.promises.rm(temp,{force:true});}}
  onProgress({stage:'installation',completed:++done,totalItems:journal.entries.length,message:'Instalando '+entry.path});await nextTurn();
 }
 await verifyInventory(journal.root,journal.targetInventory,p=>onProgress({...p,stage:'startup-check',message:p.message.replace('instalación','versión nueva')}));
 journal.state='awaiting-health';await atomicJsonAsync(path.join(job,'journal.json'),journal);
}
async function rollbackAsync(job,journal,onProgress=()=>{}){
 let done=0;for(const entry of journal.entries.slice().reverse()){
  if(!entry.touched)continue;if(!ownedFile(entry.path)&&!(journal.legacyBackup&&entry.path==='electron/desktop-start.cjs'))throw Error('Ruta de recuperación no permitida.');const target=inside(journal.root,entry.path);
  if(entry.existed){fs.mkdirSync(path.dirname(target),{recursive:true});await retryFile(()=>fs.promises.copyFile(path.join(job,'backup',entry.path),target),()=>onProgress({stage:'recovery',message:'Esperando que Windows libere '+entry.path+'…'}));}else await fs.promises.rm(target,{force:true});
  onProgress({stage:'recovery',completed:++done,totalItems:journal.entries.filter(e=>e.touched).length,message:'Recuperando '+entry.path});await nextTurn();
 }
 journal.state='rolled-back';await atomicJsonAsync(path.join(job,'journal.json'),journal);
}
Object.assign(module.exports,{atomicJsonAsync,ownedFile,validateInventory,hashFile,verifyInventory,prepareAsync,applyAsync,rollbackAsync});

