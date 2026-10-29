const path=require('node:path');
const fs=require('node:fs');
const APP_ID='agency.neyen.workhub';
function applyDesktopBranding({app,shell,win,exe=process.execPath,platform=process.platform}) {
 const icon=path.join(__dirname,'../assets/workhub.ico');
 win.setIcon(icon);
 if(platform!=='win32')return;
 win.setAppDetails({appId:APP_ID,appIconPath:icon,appIconIndex:0,relaunchCommand:`"${exe}"`,relaunchDisplayName:'Workhub'});
 const options={target:exe,cwd:path.dirname(exe),icon,iconIndex:0,appUserModelId:APP_ID,description:'Workhub · Espacio de trabajo'};
 const update=(file,create=false)=>{
  try {
   const exists=fs.existsSync(file);
   if(exists && path.resolve(shell.readShortcutLink(file).target).toLowerCase()!==path.resolve(exe).toLowerCase())return;
   if(exists || create) shell.writeShortcutLink(file,exists?'update':'create',options);
  }catch(error){console.warn('No se pudo actualizar el acceso directo de Workhub:',error.message);}
 };
 update(path.join(app.getPath('desktop'),'Workhub Escritorio.lnk'),true);
 // Refresh only this executable's existing pinned shortcut, preserving others.
 const pinned=path.join(app.getPath('appData'),'Microsoft','Internet Explorer','Quick Launch','User Pinned','TaskBar');
 try {for(const name of fs.readdirSync(pinned))if(name.toLowerCase().endsWith('.lnk'))update(path.join(pinned,name));}catch{}
}
module.exports={applyDesktopBranding};
