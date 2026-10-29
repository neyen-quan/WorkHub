const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const tools=__dirname,root=path.resolve(process.env.WORKHUB_SOURCE_ROOT||process.env.GITHUB_WORKSPACE||path.join(tools,'..')),repo=process.env.GITHUB_REPOSITORY;
const engine=require(fs.existsSync(path.join(tools,'engine.cjs'))?path.join(tools,'engine.cjs'):path.join(root,'electron/desktop-update.cjs'));
const pkg=()=>JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')),hash=file=>engine.sha(fs.readFileSync(file));
function gh(...args){return execFileSync('gh',args,{cwd:root,encoding:'utf8',maxBuffer:10*1024*1024}).trim();}
function run(command,args){execFileSync(command,args,{cwd:root,stdio:'inherit'});}
function api(endpoint){return JSON.parse(gh('api',endpoint));}
const knownReleases=new Map();
function getRelease(tag){
 if(knownReleases.has(tag))return api('repos/'+repo+'/releases/'+knownReleases.get(tag));
 // Draft tags are not resolvable through releases/tags until publication.
 // The authenticated collection includes drafts and prevents duplicate creation.
 const releases=api('repos/'+repo+'/releases?per_page=100');const found=releases.find(r=>r.tag_name===tag);if(found){knownReleases.set(tag,found.id);return found;}
 try{return api('repos/'+repo+'/releases/tags/'+tag);}catch{return null;}
}
function filesOfRelease(release){return new Map(release.assets.map(a=>[a.name,a]));}
function downloadAsset(release,name,directory){
 fs.mkdirSync(directory,{recursive:true});const destination=path.join(directory,name);if(fs.existsSync(destination))fs.unlinkSync(destination);
 const published=release.assets.find(a=>a.name===name);if(!published)throw Error('Falta el asset '+name);
 const fd=fs.openSync(destination,'w');try{execFileSync('gh',['api','repos/'+repo+'/releases/assets/'+published.id,'-H','Accept: application/octet-stream'],{cwd:root,stdio:['ignore',fd,'pipe']});}finally{fs.closeSync(fd);}
 const asset=release.assets.find(a=>a.name===name);if(!asset||fs.statSync(destination).size!==asset.size)throw Error('El tamaño del asset publicado no coincide: '+name);
 if(asset.digest?.startsWith('sha256:')&&hash(destination)!==asset.digest.slice(7))throw Error('SHA-256 de GitHub incorrecto: '+name);
 return destination;
}
async function extractFull(file,destination,expectedVersion){
 const files=engine.unzip(fs.readFileSync(file));let inventory;try{inventory=JSON.parse(files.get('assets/workhub-installation.json'));}catch{throw Error('El paquete completo no tiene inventario.');}
 engine.validateInventory(inventory,expectedVersion);
 const identity=JSON.parse(files.get('package.json'));if(identity.name!=='workhub-desktop'||identity.main!=='electron/main.cjs'||identity.version!==expectedVersion)throw Error('La identidad del paquete completo no coincide con su inventario.');
 if(files.size!==Object.keys(inventory.files).length+1)throw Error('El paquete completo contiene archivos sin inventario.');
 for(const [name,record]of Object.entries(inventory.files)){const b=files.get(name);if(!b||b.length!==record.size||engine.sha(b)!==record.sha256)throw Error('El paquete completo está dañado: '+name);}
 fs.mkdirSync(destination,{recursive:true});for(const [name,b]of files){const target=engine.inside(destination,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,b);}return inventory;
}
function verifyRepair(file,expectedVersion){
 const files=engine.unzip(fs.readFileSync(file)),inventory=JSON.parse(files.get('assets/workhub-installation.json'));engine.validateInventory(inventory,expectedVersion);
 const expected=Object.keys(inventory.files).filter(n=>!n.startsWith('runtime/')&&n!=='WorkHub.exe');if(files.size!==expected.length+1)throw Error('Invalid repair inventory');
 for(const name of expected){const record=inventory.files[name],bytes=files.get(name);if(!bytes||bytes.length!==record.size||engine.sha(bytes)!==record.sha256)throw Error('Damaged repair file: '+name);}
 return {files,inventory};
}
function readSettings(){return fs.existsSync(path.join(root,'.build/release-plan.json'))?JSON.parse(fs.readFileSync(path.join(root,'.build/release-plan.json'))):{};}
async function prepare(){
 if(!repo||!/^[\w.-]+\/[\w.-]+$/.test(repo))throw Error('No se configuró el repositorio real de GitHub.');
 const p=pkg(),tag='v'+p.version,baseDir=path.join(root,'.build/published-base'),downloadDir=path.join(root,'.build/downloads');fs.mkdirSync(path.join(root,'.build'),{recursive:true});
 const own=getRelease(tag),ownFull=own?.assets.find(a=>a.name==='WorkHub-'+p.version+'-Windows-x64.zip');
 const result={reuseOwn:false,base:null};
 if(ownFull){const zip=downloadAsset(own,ownFull.name,path.join(downloadDir,'own'));await extractFull(zip,path.join(root,'.build/WorkHub'),p.version);fs.mkdirSync(path.join(root,'release'),{recursive:true});fs.copyFileSync(zip,path.join(root,'release',ownFull.name));result.reuseOwn=true;}
 const releases=api('repos/'+repo+'/releases?per_page=100').filter(r=>!r.draft&&!r.prerelease&&/^v\d+\.\d+\.\d+$/.test(r.tag_name)&&engine.newer(p.version,r.tag_name.slice(1))).sort((a,b)=>engine.newer(a.tag_name.slice(1),b.tag_name.slice(1))?-1:1);
 if(releases.length){const release=releases[0],v=release.tag_name.slice(1),name='WorkHub-'+v+'-Windows-x64.zip';const zip=downloadAsset(release,name,path.join(downloadDir,v));const inventory=await extractFull(zip,baseDir,v);result.base={version:v,directory:baseDir,inventory};if(process.env.GITHUB_ENV)fs.appendFileSync(process.env.GITHUB_ENV,'WORKHUB_PUBLISHED_BASE='+baseDir+'\n');}
 fs.writeFileSync(path.join(root,'.build/release-plan.json'),JSON.stringify(result,null,2));
 if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,'reuse='+result.reuseOwn+'\n');console.log(result.reuseOwn?'Se reutiliza el paquete exacto ya subido de esta versión.':'Se compilará un paquete nuevo.');
}
async function build(){
 const p=pkg(),tag='v'+p.version,out=path.join(root,'.build/WorkHub'),releaseDir=path.join(root,'release'),settings=readSettings();
 fs.mkdirSync(releaseDir,{recursive:true});const full=path.join(releaseDir,'WorkHub-'+p.version+'-Windows-x64.zip');
 if(!fs.existsSync(full))throw Error('Falta el paquete completo.');const target=JSON.parse(fs.readFileSync(path.join(out,'assets/workhub-installation.json')));
 const asset=file=>({url:'https://github.com/'+repo+'/releases/download/'+tag+'/'+path.basename(file),size:fs.statSync(file).size,sha256:hash(file)});
 const feed={schema:1,product:'WorkHub',appId:engine.APP_ID,version:p.version,patches:[],full:asset(full)};
 if(settings.base){
  const base=settings.base;const file=path.join(releaseDir,'WorkHub-'+p.version+'-from-'+base.version+'-patch.zip');
  run(process.env.PYTHON||'python',[path.join(tools,'package-files.py'),'patch',out,path.join(base.directory,'assets/workhub-installation.json'),file]);
  engine.validatePatch(fs.readFileSync(file),base.version);feed.patches.push({from:base.version,to:p.version,...asset(file)});
 }else{
  feed.transitions=require(path.join(tools,'transition-package.cjs')).build(out,releaseDir,repo,p.version);
 }
 // One-time rescue for installations whose old worker cannot install its own fix.
 if(p.version==='0.1.39'&&settings.base){const repair=path.join(releaseDir,'WorkHub-'+p.version+'-repair.zip');run(process.env.PYTHON||'python',[path.join(tools,'package-files.py'),'repair',out,repair,path.join(settings.base.directory,'assets/workhub-installation.json')]);verifyRepair(repair,p.version);feed.repair=asset(repair);}
 for(const file of fs.readdirSync(releaseDir).filter(n=>n.endsWith('.zip')))fs.writeFileSync(path.join(releaseDir,file+'.sha256'),hash(path.join(releaseDir,file))+'  '+file+'\n');
 fs.writeFileSync(path.join(releaseDir,'latest.json'),JSON.stringify(feed,null,2)+'\n');
 console.log('Paquete completo, parche exacto y canal generados.');
 return {feed,target};
}
async function verifyRelease(tag,{publicChannel=false}={}){
 const release=getRelease(tag);if(!release)throw Error('No existe la release esperada.');const directory=path.join(root,'.build/verify-release',tag);const feedPath=downloadAsset(release,'latest.json',directory),feed=JSON.parse(fs.readFileSync(feedPath,'utf8'));
 if(feed.version!==tag.slice(1)||feed.product!=='WorkHub'||feed.appId!==engine.APP_ID)throw Error('El canal publicado tiene otra identidad.');
 const all=[feed.full,...feed.patches,...(feed.transitions||[]),...(feed.repair?[feed.repair]:[])];
 for(const asset of all){const prefix='https://github.com/'+repo+'/releases/download/'+tag+'/';if(!asset.url.startsWith(prefix))throw Error('URL de asset fuera de la release.');const name=asset.url.slice(prefix.length);if(name.includes('/')||name.includes('..'))throw Error('Nombre de asset inválido.');const file=downloadAsset(release,name,directory);if(fs.statSync(file).size!==asset.size||hash(file)!==asset.sha256)throw Error('El asset publicado no coincide con el canal: '+name);const side=downloadAsset(release,name+'.sha256',directory);if(fs.readFileSync(side,'utf8').split(/\s/)[0]!==asset.sha256)throw Error('El archivo SHA-256 no coincide.');
  if(asset===feed.full)await extractFull(file,path.join(directory,'full'),feed.version);
  else if(asset===feed.repair)verifyRepair(file,feed.version);
  else if((feed.transitions||[]).includes(asset))require(path.join(tools,'transition-package.cjs')).validate(fs.readFileSync(file),asset.from,feed.version);
  else engine.validatePatch(fs.readFileSync(file),asset.from);
 }
 if(publicChannel){const {createChannelClient}=require(path.join(root,'electron/update-channel.cjs'));const client=createChannelClient();let failure;for(let i=0;i<8;i++){try{const info=await client.check('https://github.com/'+repo+'/releases/latest/download/latest.json',feed.version);if(info.version===feed.version&&info.upToDate){failure=null;break;}throw Error('El canal todavía no anuncia la release esperada.');}catch(e){failure=e;await new Promise(r=>setTimeout(r,3000));}}if(failure)throw failure;}
 console.log('PASS: release '+tag+', inventarios, tamaños, SHA-256 y assets completos.');return feed;
}
async function publish(){
 const tag='v'+pkg().version,source=process.env.WORKHUB_SOURCE_SHA||process.env.GITHUB_SHA,dir=path.join(root,'release');let release=getRelease(tag);
 if(release&&!release.draft){await verifyRelease(tag);console.log('Release publicada inmutable: no se sobrescribe ningún archivo.');return;}
 if(!release){release=JSON.parse(gh('api','--method','POST','repos/'+repo+'/releases','-f','tag_name='+tag,'-f','target_commitish='+source,'-f','name=WorkHub '+pkg().version,'-f','body=Instalación nueva o reparación: Windows-x64.zip. Actualización: Actualizar programa → Buscar actualizaciones → Descargar e instalar. ZIP local disponible.','-F','draft=true'));knownReleases.set(tag,release.id);}

 const entries=fs.readdirSync(dir).filter(n=>n.endsWith('.zip')||n.endsWith('.zip.sha256'));entries.push('latest.json');
 const existing=filesOfRelease(release);
 for(const name of entries){const local=path.join(dir,name);if(existing.has(name)){const previous=downloadAsset(release,name,path.join(root,'.build/existing-assets'));if(hash(previous)!==hash(local))throw Error('El asset '+name+' ya existe con otros bytes; se conserva, no se sobrescribe.');}else gh('api','--method','POST','https://uploads.github.com/repos/'+repo+'/releases/'+release.id+'/assets?name='+encodeURIComponent(name),'--input',local,'-H','Content-Type: application/octet-stream');}
 await verifyRelease(tag);let latest;try{latest=api('repos/'+repo+'/releases/latest');}catch{}
 const isLatest=!latest||engine.newer(pkg().version,latest.tag_name.slice(1))||latest.tag_name===tag;
 gh('release','edit',tag,'--repo',repo,'--draft=false',isLatest?'--latest=true':'--latest=false');await verifyRelease(tag,{publicChannel:isLatest});
}
async function main(){const action=process.argv[2];if(action==='prepare')await prepare();else if(action==='build')await build();else if(action==='publish')await publish();else if(action==='verify')await verifyRelease(process.argv[3]||'v'+pkg().version);else throw Error('Acción desconocida.');}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={verifyRepair,extractFull,prepare,build,publish,verifyRelease};

