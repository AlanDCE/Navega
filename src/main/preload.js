const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('navegaApi', {
  importProxies: () => ipcRenderer.invoke('proxy:import'),
  getProxies: () => ipcRenderer.invoke('proxy:list'),
  retestAll: () => ipcRenderer.invoke('proxy:retestAll'),
  selectProxy: (id) => ipcRenderer.invoke('proxy:select', id),
  navigate: (url) => ipcRenderer.send('nav:go', url),
  navCommand: (cmd) => ipcRenderer.send('nav:command', cmd),
  clearBrowsingData: () => ipcRenderer.invoke('browser:clearData'),
  getActiveProxyInfo: () => ipcRenderer.invoke('proxy:activeInfo'),
  onState: (cb) => ipcRenderer.on('state:update', (_, state) => cb(state))
});
