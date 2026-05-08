const path = require('node:path');
const { app, BrowserWindow, ipcMain, dialog, session } = require('electron');
const Store = require('electron-store');
const { parseProxyFile, testProxy, proxyToUrl, maskSecret } = require('./proxyService');

const store = new Store({ defaults: { proxies: [], activeProxyId: null } });
let mainWindow;
let state = { proxies: [], activeProxyId: null, activeProxyLabel: 'Ninguno activo', currentUrl: 'https://example.com' };

const emitState = () => mainWindow?.webContents.send('state:update', state);

async function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: false
    }
  });
  await mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
}

app.whenReady().then(async () => {
  app.commandLine.appendSwitch('force-webrtc-ip-handling-policy', 'disable_non_proxied_udp');
  app.commandLine.appendSwitch('webrtc-ip-handling-policy', 'disable_non_proxied_udp');
  await createMainWindow();
  state.proxies = store.get('proxies');
  state.activeProxyId = store.get('activeProxyId');
  emitState();
});

ipcMain.handle('proxy:import', async () => {
  const pick = await dialog.showOpenDialog(mainWindow, { properties: ['openFile'], filters: [{ name: 'Proxy files', extensions: ['txt', 'json', 'csv'] }] });
  if (pick.canceled) return state.proxies;
  const parsed = await parseProxyFile(pick.filePaths[0]);
  state.proxies = await Promise.all(parsed.map((proxy) => testProxy({ ...proxy, status: 'untested' })));
  store.set('proxies', state.proxies.map(maskSecret));
  emitState();
  return state.proxies;
});

ipcMain.handle('proxy:list', async () => state.proxies);
ipcMain.handle('proxy:retestAll', async () => {
  state.proxies = await Promise.all(state.proxies.map((p) => testProxy(p)));
  store.set('proxies', state.proxies.map(maskSecret));
  emitState();
  return state.proxies;
});

ipcMain.handle('proxy:select', async (_e, id) => {
  const proxy = state.proxies.find((p) => p.id === id);
  if (!proxy || proxy.status !== 'working') throw new Error('Seleccione un proxy funcional.');
  state.activeProxyId = id;
  state.activeProxyLabel = `${proxy.protocol} ${proxy.host}:${proxy.port}`;
  store.set('activeProxyId', id);
  emitState();
  return state;
});

ipcMain.on('nav:go', async (_e, rawUrl) => {
  const proxy = state.proxies.find((p) => p.id === state.activeProxyId);
  if (!proxy || proxy.status !== 'working') {
    emitState();
    return;
  }
  const navSession = session.fromPartition(`persist:proxy-${proxy.id}`);
  await navSession.setProxy({ proxyRules: proxyToUrl(proxy), proxyBypassRules: '<-loopback>' });
  const url = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
  state.currentUrl = url;
  emitState();
});

ipcMain.handle('browser:clearData', async () => {
  await Promise.all(state.proxies.map((p) => session.fromPartition(`persist:proxy-${p.id}`).clearStorageData()));
  return true;
});

ipcMain.handle('proxy:activeInfo', async () => state.proxies.find((p) => p.id === state.activeProxyId) || null);
