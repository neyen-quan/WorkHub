const {app,BrowserWindow,dialog}=require('electron'),fs=require('node:fs'),path=require('node:path');
const home=process.env.WORKHUB_QA_HOME,original=app.getPath.bind(app);app.getPath=name=>name==='appData'?path.join(home,'profile'):original(name);
app.disableHardwareAcceleration();dialog.showMessageBox=async()=>({response:0});
app.on('browser-window-created',(_e,win)=>win.webContents.on('did-finish-load',async()=>{if(!win.webContents.getURL().endsWith('wizard.html'))return;try{const result=await win.webContents.executeJavaScript('window.transition.start()');fs.writeFileSync(path.join(home,'wizard-result.json'),JSON.stringify(result));}catch(e){fs.writeFileSync(path.join(home,'wizard-error.json'),JSON.stringify({error:e.stack}));}}));
