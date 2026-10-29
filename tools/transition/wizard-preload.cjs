const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('transition',{start:()=>ipcRenderer.invoke('transition-start'),state:fn=>ipcRenderer.on('transition-state',(_e,s)=>fn(s))});
