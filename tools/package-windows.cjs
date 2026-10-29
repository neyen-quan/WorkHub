const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const root=path.resolve(process.env.WORKHUB_SOURCE_ROOT||path.join(__dirname,'..')),pkg=require(path.join(root,'package.json')),out=path.join(root,'.build','WorkHub');
const run=(cmd,args,options={})=>execFileSync(cmd,args,{cwd:root,stdio:'inherit',...options});
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function nativeFingerprint(){return digest(Buffer.concat(['native/workhub-launcher.c','native/workhub-launcher.rc','assets/workhub.ico','electron/desktop-start.cjs'].map(name=>fs.readFileSync(path.join(root,name)))));}
function packageWindows(){
 if(process.platform!=='win32'&&!process.env.WORKHUB_QA_CROSS)throw Error('El paquete de entrega se compila en Windows.');
 fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});const release=path.join(root,'release');fs.mkdirSync(release,{recursive:true});
 run(process.execPath,[path.join(__dirname,'build-ui.cjs')]);
 for(const name of ['dist','electron','shared','assets'])fs.cpSync(path.join(root,name),path.join(out,name),{recursive:true});
 for(const name of ['package.json','package-lock.json','INICIAR-WORKHUB.bat','LEEME.txt'])fs.copyFileSync(path.join(root,name),path.join(out,name));
 for(const name of ['README.md','LICENSE','THIRD_PARTY.md'])fs.copyFileSync(path.join(root,name),path.join(out,'assets',name));
 const repo=process.env.GITHUB_REPOSITORY||null;
 fs.writeFileSync(path.join(out,'assets/update-channel.json'),JSON.stringify({product:'WorkHub',repository:repo,engineVersion:pkg.devDependencies.electron,channel:repo?'https://github.com/'+repo+'/releases/latest/download/latest.json':''},null,2)+'\n');
 const base=process.env.WORKHUB_PUBLISHED_BASE;let inventory;if(base)inventory=JSON.parse(fs.readFileSync(path.join(base,'assets/workhub-installation.json'),'utf8'));
 let runtime=base&&inventory.engineVersion===pkg.devDependencies.electron?path.join(base,'runtime'):path.join(root,'node_modules/electron/dist');
 if(!fs.existsSync(path.join(runtime,'electron.exe'))&&!fs.existsSync(path.join(runtime,'WorkhubEngine.exe')))throw Error('No se encontró el motor Windows. Ejecutá npm ci en Windows.');
 fs.cpSync(runtime,path.join(out,'runtime'),{recursive:true});if(fs.existsSync(path.join(out,'runtime/electron.exe')))fs.renameSync(path.join(out,'runtime/electron.exe'),path.join(out,'runtime/WorkhubEngine.exe'));
 const fingerprint=nativeFingerprint();
 if(base&&inventory.nativeFingerprint===fingerprint)fs.copyFileSync(path.join(base,'WorkHub.exe'),path.join(out,'WorkHub.exe'));
 else{
  const native=path.join(root,'.build','native');fs.mkdirSync(native,{recursive:true});
  run('rc.exe',['/nologo','/fo'+path.join(native,'launcher.res'),'workhub-launcher.rc'],{cwd:path.join(root,'native')});
  run('cl.exe',['/nologo','/utf-8','/O1','/MT','/DUNICODE','/D_UNICODE','/D_CRT_SECURE_NO_WARNINGS','/Fo'+path.join(native,'launcher.obj'),path.join(root,'native/workhub-launcher.c'),path.join(native,'launcher.res'),'/Fe'+path.join(out,'WorkHub.exe'),'/link','/SUBSYSTEM:WINDOWS','user32.lib']);
 }
 const python=process.env.PYTHON||'python';const zip=path.join(release,'WorkHub-'+pkg.version+'-Windows-x64.zip');
 run(python,[path.join(__dirname,'package-files.py'),'package',out,zip,pkg.version,pkg.devDependencies.electron,fingerprint]);return {out,zip};
}
if(require.main===module)packageWindows();
module.exports={packageWindows,nativeFingerprint};

