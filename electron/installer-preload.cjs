const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('workHubUpdater',{mode:'installer',ready:()=>ipcRenderer.invoke('installer-ready'),command:name=>ipcRenderer.invoke('installer-command',name),onState:callback=>{const listener=(_event,state)=>callback(state);ipcRenderer.on('update-center-state',listener);return()=>ipcRenderer.removeListener('update-center-state',listener);}});

