const fs=require('node:fs'),{execFileSync}=require('node:child_process');
function run(command,args){return execFileSync(command,args,{encoding:'utf8'}).trim();}
function plan({execute=run,env=process.env}={}){
 const requested=(env.RELEASE_TAG||'').trim(),dispatch=env.GITHUB_EVENT_NAME==='workflow_dispatch';
 if(dispatch&&!/^v\d+\.\d+\.\d+$/.test(requested))throw Error('Indicá un tag existente con formato vX.Y.Z.');
 let source=dispatch?requested:'HEAD',pkg=JSON.parse(execute('git',['show',source+':package.json']));
 if(!/^\d+\.\d+\.\d+$/.test(pkg.version)||dispatch&&requested!=='v'+pkg.version)throw Error('El tag no coincide con la versión del código.');
 const tag='v'+pkg.version;let existing=null;
 try{existing=JSON.parse(execute('gh',['release','view',tag,'--json','isDraft,assets,tagName']));}catch{}
 let tagged=false;try{execute('git',['rev-parse','--verify','refs/tags/'+tag]);tagged=true;}catch{}
 if(tagged)source=tag;
 const result={version:pkg.version,tag,source:execute('git',['rev-parse',source+'^{commit}']),publish:existing&&!existing.isDraft?'false':'true',verify:existing&&!existing.isDraft?'true':'false'};
 if(env.GITHUB_OUTPUT)fs.appendFileSync(env.GITHUB_OUTPUT,Object.entries(result).map(([k,v])=>k+'='+v).join('\n')+'\n');
 console.log(JSON.stringify(result));return result;
}
if(require.main===module)plan();module.exports={plan};

