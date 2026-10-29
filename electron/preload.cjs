const { contextBridge, ipcRenderer, webUtils } = require('electron');
contextBridge.exposeInMainWorld('workhub', {
  desktopReady:()=>ipcRenderer.invoke('desktop-update-ready'),
  updateDesktop: () => ipcRenderer.invoke('desktop-update-install'),
  layout: (ids, top, splitIds = null, splitRatio = 50, aiLayoutIds = null, aiRatios = null, aiViewTargets = null) => ipcRenderer.invoke('layout-views', { ids, top, splitIds, splitRatio, aiLayoutIds, aiRatios, aiViewTargets }),
  onSplitRatiosChanged: callback => {
    const listener = (_event, ratios) => callback(ratios);
    ipcRenderer.on('split-ratios-changed', listener);
    return () => ipcRenderer.removeListener('split-ratios-changed', listener);
  },
  reloadView: (viewId, login = false) => ipcRenderer.invoke('reload-view', { viewId, login }),
  closeAiView: viewId => ipcRenderer.invoke('close-ai-view', viewId),
  readPersonalUsage: (force = false) => ipcRenderer.invoke('read-personal-usage', { force: Boolean(force) }),
  onPersonalUsage: callback => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('personal-usage', listener);
    return () => ipcRenderer.removeListener('personal-usage', listener);
  },
  setTheme: theme => ipcRenderer.invoke('set-theme', theme),
  setWorkMode: enabled => ipcRenderer.invoke('set-work-mode', Boolean(enabled)),
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
  ensurePatchFolder: folder => ipcRenderer.invoke('ensure-patch-folder', folder),
  stagePatches: files => ipcRenderer.invoke('stage-patches', files),
  applyPatch: file => ipcRenderer.invoke('apply-patch', file),
  listFolder: folder => ipcRenderer.invoke('list-folder', folder),
  createFolder: (parent, name) => ipcRenderer.invoke('create-folder', { parent, name }),
  moveFile: (source, destinationFolder) => ipcRenderer.invoke('move-file', { source, destinationFolder }),
  trashFiles: items => ipcRenderer.invoke('trash-files', items),
  transferFiles: (items, destinationFolder, operation = 'auto') => ipcRenderer.invoke('transfer-files', { items, destinationFolder, operation }),
  readFileClipboard: () => ipcRenderer.invoke('file-clipboard-read'),
  writeFileClipboard: (items, operation) => ipcRenderer.invoke('file-clipboard-write', { items, operation }),
  clearFileClipboard: () => ipcRenderer.invoke('file-clipboard-clear'),
  startFileDrag: (items, operation = 'auto') => ipcRenderer.invoke('start-file-drag', { items, operation }),
  beginAttachmentDrag: paths => ipcRenderer.sendSync('begin-attachment-drag', paths),
  onAttachmentDragStatus: callback => {
    const listener = (_event, message) => callback(message);
    ipcRenderer.on('attachment-drag-status', listener);
    return () => ipcRenderer.removeListener('attachment-drag-status', listener);
  },
  getPathForFile: file => webUtils.getPathForFile(file),
  openFile: file => ipcRenderer.invoke('open-file', file),
  windowControl: action => ipcRenderer.invoke('window-control', action),
  openExternal: url => ipcRenderer.invoke('open-external', url),
  onViewError: callback => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('view-error', listener);
    return () => ipcRenderer.removeListener('view-error', listener);
  },
  onViewReady: callback => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('view-ready', listener);
    return () => ipcRenderer.removeListener('view-ready', listener);
  },
  onAiViewNavigation: callback => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('ai-view-navigation', listener);
    return () => ipcRenderer.removeListener('ai-view-navigation', listener);
  }
});
