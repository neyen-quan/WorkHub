const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(process.env.WORKHUB_SOURCE_ROOT||path.join(__dirname,'..'));
const skipped=new Set(['.git','node_modules','dist','release','.build','.qa']);let count=0,issues=[];
function walk(folder,relative=''){for(const item of fs.readdirSync(folder,{withFileTypes:true})){
 if(skipped.has(item.name))continue;const name=(relative?relative+'/':'')+item.name,p=path.join(folder,item.name);
 if(item.isSymbolicLink()){issues.push('Enlace: '+name);continue;}
 if(item.isDirectory()){if(/^(Neyen\.Workhub2|browser|profiles|userData|cuentas-rina|document-edits|document-undo|document-thumbnails|document-clipboard|Descargas|Documentos)$/i.test(item.name))issues.push('Directorio privado: '+name);else walk(p,name);continue;}
 if(['history.json','sessions.json','metadata-downloads.json','cuentas-rina.json','Preferences','Cookies','Local State','Login Data'].includes(item.name)||item.name==='update-channel.json'&&name!=='assets/update-channel.json'){issues.push('Archivo de datos privado: '+name);continue;}
 if(/\.(zip|db|sqlite3?|pem|key|exe)$/i.test(name)||/^(\.env|cookies)/i.test(item.name)){issues.push('Archivo no permitido: '+name);continue;}
 if(/\.(ico|png)$/.test(name)){if(!name.startsWith('assets/'))issues.push('Imagen fuera de recursos auditados: '+name);continue;}
 if(fs.statSync(p).size>2*1024*1024){issues.push('Archivo de texto demasiado grande: '+name);continue;}
 const text=fs.readFileSync(p,'utf8');count++;
 const rules=[/gh[pousr]_[A-Za-z0-9]{25,}/,/github_pat_[A-Za-z0-9_]{30,}/,/sk-[A-Za-z0-9]{25,}/,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/C:\\\\Users\\\\(?!Public|Default)[^\\\s]+/i,/\/(?:home|Users)\/[a-zA-Z0-9_-]+\//,/neyenarjona(?:%40|@)/i,/micro-influs-git-/i];
 if(!name.endsWith('audit.cjs')&&(rules.some(rule=>rule.test(text))||/[A-Za-z0-9._%+-]+@(?:gmail\.com|quan\.agency|deva\.org\.ar)/i.test(text)))issues.push('Contenido potencialmente privado: '+name);
}}
walk(root);
if(issues.length){console.error(issues.join('\n'));process.exitCode=1;}else console.log('Auditoría aprobada: '+count+' archivos de texto; recursos limitados al logo y los iconos.');

