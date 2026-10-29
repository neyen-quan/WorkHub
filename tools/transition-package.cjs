const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const engine=require(fs.existsSync(path.join(__dirname,'engine.cjs'))?path.join(__dirname,'engine.cjs'):path.join(process.env.WORKHUB_SOURCE_ROOT||path.join(__dirname,'..'),'electron/desktop-update.cjs'));
function validate(buffer,from,to){const files=engine.unzip(buffer),m=JSON.parse(files.get('workhub-patch.json'));if(m.app!=='workhub-desktop'||m.from!==from||m.to!==to)throw Error('Transición de otra identidad o versión.');for(const f of m.files){if(!/^(electron\/transition\/|electron\/main.cjs$|package.json$)/.test(f.path))throw Error('Ruta de transición no permitida');const b=files.get('payload/'+f.path);if(!b||engine.sha(b)!==f.sha256)throw Error('Transición dañada');}if(files.size!==m.files.length+1)throw Error('Archivos extra en transición');return m;}
function build(out,releaseDir,repo,version){
 const root=process.env.WORKHUB_SOURCE_ROOT||path.resolve(__dirname,'..'),script=path.join(__dirname,'transition-package.py');
 const result=[];for(const from of ['0.7.2','0.7.3']){const name='WorkHub-'+version+'-from-'+from+'-transition.zip',file=path.join(releaseDir,name);execFileSync(process.env.PYTHON||'python',[script,out,file,from,version],{stdio:'inherit'});validate(fs.readFileSync(file),from,version);result.push({from,to:version,url:'https://github.com/'+repo+'/releases/download/v'+version+'/'+name,size:fs.statSync(file).size,sha256:engine.sha(fs.readFileSync(file))});}return result;
}
module.exports={build,validate};
