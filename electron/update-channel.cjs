const fs=require('node:fs'),path=require('node:path'),https=require('node:https'),http=require('node:http'),crypto=require('node:crypto');
const {APP_ID,newer}=require('./desktop-update.cjs');
const HASH=/^[a-f0-9]{64}$/;
function repositoryOf(value,{allowLocal=false}={}){
 const u=new URL(value);if(u.username||u.password||u.hash)throw Error('La URL del canal contiene credenciales o un fragmento.');
 if(allowLocal&&['127.0.0.1','localhost'].includes(u.hostname)&&['http:','https:'].includes(u.protocol))return {url:u.href,repository:'local/test'};
 if(u.protocol!=='https:')throw Error('El canal debe usar HTTPS.');
 let m;if(u.hostname==='github.com')m=u.pathname.match(/^\/([^/]+)\/([^/]+)\/releases\/(?:latest\/download|download\/[^/]+)\/latest\.json$/);
 else if(u.hostname==='raw.githubusercontent.com')m=u.pathname.match(/^\/([^/]+)\/([^/]+)\/[^/]+\/(?:.*\/)?latest\.json$/);
 if(!m||u.search)throw Error('Usá la URL de latest.json de un repositorio de GitHub.');
 if(!/^[\w.-]+$/.test(m[1])||!/^[\w.-]+$/.test(m[2]))throw Error('Repositorio del canal inválido.');
 return {url:u.href,repository:m[1]+'/'+m[2]};
}
function validateFeed(feed,current,channel,options={}){
 const {repository}=repositoryOf(channel,options);
 if(!feed||feed.schema!==1||feed.product!=='WorkHub'||feed.appId!==APP_ID||typeof feed.version!=='string'||!/^\d+\.\d+\.\d+$/.test(feed.version)||!Array.isArray(feed.patches))throw Error('El canal no corresponde a WorkHub o tiene un formato inválido.');
 const asset=(a,to,patch=false)=>{
  if(!a||!HASH.test(a.sha256)||!Number.isSafeInteger(a.size)||a.size<=0||a.size>1024*1024*1024)throw Error('El canal no informa tamaño y SHA-256 válidos.');
  const u=new URL(a.url);const local=options.allowLocal&&['localhost','127.0.0.1'].includes(u.hostname);
  if(!local&&(u.protocol!=='https:'||u.hostname!=='github.com'||!u.pathname.startsWith('/'+repository+'/releases/download/v'+to+'/')||u.username||u.password||u.search||u.hash))throw Error('La descarga no pertenece a la release indicada.');
  if(patch&&(a.to!==to||!/^\d+\.\d+\.\d+$/.test(a.from)))throw Error('Versiones del parche inconsistentes.');
  return a;
 };
 asset(feed.full,feed.version);feed.patches.forEach(p=>asset(p,feed.version,true));
 const patch=feed.patches.find(p=>p.from===current&&p.to===feed.version)||null;
 return {...feed,installed:current,available:newer(feed.version,current),upToDate:!newer(feed.version,current),patch};
}
function createChannelClient({allowLocal=false,connectionTimeout=20000,stallTimeout=30000}={}){
 const options={allowLocal};
 async function request(url,{signal,onProgress=()=>{},maxBytes=1024*1024*1024,destination,expectedSize,expectedHash}={}){
  let target=new URL(url);let response;
  const started=Date.now();
  for(let redirects=0;redirects<=8;redirects++){
   const local=allowLocal&&['localhost','127.0.0.1'].includes(target.hostname);
   if(!local&&(target.protocol!=='https:'||!['github.com','raw.githubusercontent.com','release-assets.githubusercontent.com','objects.githubusercontent.com'].includes(target.hostname)))throw Error('Redirección fuera de los servidores de GitHub permitidos.');
   onProgress({stage:'connection',received:0,total:expectedSize||null,elapsedMs:Date.now()-started,message:'Conectando con GitHub…'});
   response=await new Promise((resolve,reject)=>{
    const req=(target.protocol==='https:'?https:http).get(target,{headers:{'User-Agent':'WorkHub-Updater','Accept':'application/octet-stream'},signal},resolve);
    const timer=setTimeout(()=>req.destroy(Error('La conexión no respondió. Volvé a intentar.')),connectionTimeout);req.once('response',()=>clearTimeout(timer));req.once('error',e=>{clearTimeout(timer);reject(e);});
   });
   if([301,302,303,307,308].includes(response.statusCode)){const loc=response.headers.location;response.resume();if(!loc)throw Error('Redirección sin destino.');target=new URL(loc,target);continue;}break;
  }
  if(!response||response.statusCode!==200){response?.resume();throw Error('GitHub respondió '+(response?.statusCode||'sin conexión')+'.');}
  const contentLength=Number(response.headers['content-length'])||null;
  if(contentLength&&contentLength>maxBytes){response.destroy();throw Error('La descarga supera el límite permitido.');}
  if(expectedSize&&contentLength&&contentLength!==expectedSize){response.destroy();throw Error('El tamaño anunciado por GitHub no coincide con el canal.');}
  let handle,received=0;const chunks=[],digest=crypto.createHash('sha256');let last=Date.now();
  const heartbeat=setInterval(()=>onProgress({stage:'download',received,total:expectedSize||contentLength,elapsedMs:Date.now()-started,waiting:Date.now()-last>5000,message:Date.now()-last>5000?'Esperando datos de GitHub…':'Descargando…'}),1000);
  let stalled=false;
  const watchdog=setInterval(()=>{if(Date.now()-last>stallTimeout){stalled=true;response.destroy(Error('La descarga dejó de avanzar. Volvé a intentar.'));}},1000);
  const abort=()=>response.destroy(Error('Operación cancelada.'));signal?.addEventListener('abort',abort,{once:true});
  try{
   if(destination){await fs.promises.mkdir(path.dirname(destination),{recursive:true});handle=await fs.promises.open(destination,'wx',0o600);}
   for await(const chunk of response){if(signal?.aborted)throw Error('Operación cancelada.');last=Date.now();received+=chunk.length;if(received>maxBytes||expectedSize&&received>expectedSize)throw Error('La descarga excede el tamaño esperado.');digest.update(chunk);if(handle)await handle.write(chunk);else chunks.push(chunk);onProgress({stage:'download',received,total:expectedSize||contentLength,elapsedMs:Date.now()-started,message:'Descargando…'});}
   if(stalled)throw Error('La descarga dejó de avanzar.');if(expectedSize&&received!==expectedSize)throw Error('La descarga está incompleta.');
   onProgress({stage:'verification',received,total:expectedSize||received,elapsedMs:Date.now()-started,message:'Verificando SHA-256…'});
   const hash=digest.digest('hex');if(expectedHash&&hash!==expectedHash)throw Error('El SHA-256 del ZIP no coincide. No se modificó WorkHub.');
   // Opened writable. Never fsync a read-only descriptor on Windows.
   if(handle)await handle.sync();
   return destination?{file:destination,size:received,sha256:hash}:Buffer.concat(chunks);
  }catch(e){if(handle){await handle.close();handle=null;await fs.promises.rm(destination,{force:true});}throw e;}
  finally{clearInterval(heartbeat);clearInterval(watchdog);signal?.removeEventListener('abort',abort);if(handle)await handle.close();response.destroy();}
 }
 return {options,request,check:async(url,current,settings={})=>{repositoryOf(url,options);const b=await request(url,{...settings,maxBytes:2*1024*1024});let feed;try{feed=JSON.parse(b.toString('utf8').replace(/^\uFEFF/,''));}catch{throw Error('GitHub no devolvió un latest.json válido.');}return validateFeed(feed,current,url,options);}};
}
module.exports={repositoryOf,validateFeed,createChannelClient};

