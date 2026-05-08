const path = require('node:path');
const { app, BrowserWindow, ipcMain, dialog, session } = require('electron');
const Store = require('electron-store');
const { parseProxyFile, testProxy, proxyToUrl, maskSecret, runLeakSuite } = require('./proxyService');

const store = new Store({ defaults: { proxies: [], activeProxyId: null, privacyMode: true } });
let mainWindow;

let state = {
  proxies: [],
  activeProxyId: null,
  activeProxyLabel: 'Ninguno activo',
  currentUrl: 'about:blank',
  killSwitchActive: true,
  navigationBlocked: true,
  leakStatus: 'Riesgo',
  leakDetails: [],
  privacyMode: true,
  trafficStatus: 'Bloqueado'
};

const emitState = () => mainWindow?.webContents.send('state:update', state);
const activeProxy = () => state.proxies.find((p) => p.id === state.activeProxyId) || null;

function hardenSession(targetSession) {
  targetSession.setPermissionRequestHandler((_, permission, cb) => {
    const blocked = ['geolocation', 'media', 'display-capture', 'midi', 'notifications'];
    if (blocked.includes(permission)) return cb(false);
    cb(false);
  });
  targetSession.webRequest.onBeforeRequest((details, callback) => {
    if (state.navigationBlocked && details.url.startsWith('http')) return callback({ cancel: true });
    callback({});
  });
}

async function enforceProxyOrBlock() {
  const proxy = activeProxy();
  const defaultSession = session.defaultSession;
  if (!proxy || proxy.status !== 'working') {
    await defaultSession.setProxy({ mode: 'direct' });
    state.navigationBlocked = true;
    state.trafficStatus = 'Bloqueado por Kill Switch';
    state.killSwitchActive = true;
    return;
  }

  await defaultSession.setProxy({ proxyRules: proxyToUrl(proxy), proxyBypassRules: '<-loopback>' });
  state.navigationBlocked = false;
  state.trafficStatus = 'A través del proxy';
}

async function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1700,
    height: 980,
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
  app.commandLine.appendSwitch('disable-features', 'WebRtcHideLocalIpsWithMdns,DNSPrefetch,NetworkServiceInProcess');
  app.commandLine.appendSwitch('disable-quic');
  app.commandLine.appendSwitch('disable-background-networking');
  app.commandLine.appendSwitch('disable-client-side-phishing-detection');

  await createMainWindow();
  hardenSession(session.defaultSession);

  state.proxies = store.get('proxies');
  state.activeProxyId = store.get('activeProxyId');
  state.privacyMode = store.get('privacyMode');

  await enforceProxyOrBlock();
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

ipcMain.handle('proxy:retestAll', async () => {
  state.proxies = await Promise.all(state.proxies.map((p) => testProxy(p)));
  if (activeProxy() && activeProxy().status !== 'working') {
    state.navigationBlocked = true;
  }
  await enforceProxyOrBlock();
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
  await enforceProxyOrBlock();
  emitState();
  return state;
});

ipcMain.handle('leak:test', async () => {
  const proxy = activeProxy();
  if (!proxy || state.navigationBlocked) {
    state.leakStatus = 'Fuga detectada';
    state.leakDetails = [{ key: 'proxy', ok: false, value: 'No hay proxy funcional activo' }];
    emitState();
    return state;
  }

  const report = await runLeakSuite(proxy);
  state.leakDetails = report.checks;
  state.leakStatus = report.level;
  if (report.critical) {
    state.navigationBlocked = true;
    state.trafficStatus = 'Bloqueado por fuga crítica';
  }
  emitState();
  return state;
});

ipcMain.on('nav:go', async (_e, rawUrl) => {
  await enforceProxyOrBlock();
  if (state.navigationBlocked) {
    state.currentUrl = 'about:blank';
    emitState();
    return;
  }
  const url = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
  state.currentUrl = url;
  emitState();
});

ipcMain.handle('privacy:toggle', async (_e, enabled) => {
  state.privacyMode = Boolean(enabled);
  store.set('privacyMode', state.privacyMode);
  if (state.privacyMode) {
    await session.defaultSession.clearCache();
  }
  emitState();
  return state.privacyMode;
});

ipcMain.handle('browser:clearData', async () => {
  await session.defaultSession.clearStorageData();
  await Promise.all(state.proxies.map((p) => session.fromPartition(`persist:proxy-${p.id}`).clearStorageData()));
  return true;
});
