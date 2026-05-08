const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('navegaApi', {
  importProxies: () => ipcRenderer.invoke('proxy:import'),
  retestAll: () => ipcRenderer.invoke('proxy:retestAll'),
  selectProxy: (id) => ipcRenderer.invoke('proxy:select', id),
  navigate: (url) => ipcRenderer.send('nav:go', url),
  clearBrowsingData: () => ipcRenderer.invoke('browser:clearData'),
  runLeakTest: () => ipcRenderer.invoke('leak:test'),
  togglePrivacy: (enabled) => ipcRenderer.invoke('privacy:toggle', enabled),
  onState: (cb) => ipcRenderer.on('state:update', (_, state) => cb(state))
});
