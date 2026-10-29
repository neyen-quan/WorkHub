const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
test('window, desktop shortcut and own pinned shortcut share the Workhub icon and identity',()=>{
 const writes=[],details=[],icons=[];
 const source=fs.readFileSync(path.join(__dirname,'../electron/desktop-branding.cjs'),'utf8');
 const scope={module:{exports:{}},__dirname:'/app/electron',console,process,require:name=>name==='node:fs'?{existsSync:()=>true,readdirSync:()=>['Workhub.lnk','WorkHub.lnk']} : require(name)};
 vm.runInNewContext(source,scope);
 scope.module.exports.applyDesktopBranding({exe:'/app/Workhub.exe',platform:'win32',app:{getPath:n=>'/'+n},win:{setIcon:p=>icons.push(p),setAppDetails:d=>details.push(d)},shell:{readShortcutLink:p=>({target:p.endsWith('WorkHub.lnk')?'/docs/WorkHub.exe':'/app/Workhub.exe'}),writeShortcutLink:(...args)=>writes.push(args)}});
 assert.equal(writes.length,2);assert.ok(writes.every(([p,,o])=>!p.endsWith('WorkHub.lnk')&&o.icon===icons[0]&&o.appUserModelId===details[0].appId));
 assert.equal(details[0].relaunchCommand,'"/app/Workhub.exe"');
});
test('ICO contains small taskbar sizes and high DPI artwork',()=>{
 const data=fs.readFileSync(path.join(__dirname,'../assets/workhub.ico'));
 assert.equal(data.readUInt16LE(2),1);const n=data.readUInt16LE(4),sizes=[];
 for(let i=0;i<n;i++){const p=6+i*16;sizes.push(data[p]||256);assert.ok(data.readUInt32LE(p+12)+data.readUInt32LE(p+8)<=data.length);}
 for(const size of [16,24,32,48,64,128,256])assert.ok(sizes.includes(size));
});
