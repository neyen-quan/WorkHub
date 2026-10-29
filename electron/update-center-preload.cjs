const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('workHubUpdater',{mode:'center',ready:()=>ipcRenderer.invoke('update-center-ready'),command:(name,arg)=>ipcRenderer.invoke('update-center-command',{name,arg}),onState:callback=>{const listener=(_event,state)=>callback(state);ipcRenderer.on('update-center-state',listener);return()=>ipcRenderer.removeListener('update-center-state',listener);}});

