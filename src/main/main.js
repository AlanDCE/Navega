const path = require('node:path');
const { app, BrowserWindow, ipcMain, dialog, session } = require('electron');
const Store = require('electron-store');
const { maskSecret, runLeakSuite } = require('./proxyService');
const { ProxyManager, SessionManager, SecurityManager } = require('./managers');

const store = new Store({ defaults: { proxies: [], activeProxyId: null, privacyMode: true } });
const proxyManager = new ProxyManager(store.get('proxies'));
const sessionManager = new SessionManager();
const securityManager = new SecurityManager();
let mainWindow;

const state = { proxies: proxyManager.proxies, activeProxyId: store.get('activeProxyId'), activeProxyLabel: 'Ninguno activo', currentUrl: 'about:blank', killSwitchActive: true, navigationBlocked: true, leakStatus: 'Riesgo bajo', leakDetails: [], privacyMode: store.get('privacyMode'), trafficStatus: 'Bloqueado', profile: 'none' };

const emitState = () => mainWindow?.webContents.send('state:update', state);
const activeProxy = () => proxyManager.getActiveById(state.activeProxyId);

async function enforceProxyOrBlock() {
  const proxy = activeProxy();
  if (!proxy || !['working', 'slow'].includes(proxy.status)) {
    await sessionManager.blockAll();
    state.navigationBlocked = true;
    state.trafficStatus = 'Bloqueado por Kill Switch';
    state.killSwitchActive = true;
    return;
  }
  await sessionManager.applyProxy(proxy);
  await session.defaultSession.setProxy({ proxyRules: require('./proxyService').proxyToUrl(proxy), proxyBypassRules: '<-loopback>' });
  state.navigationBlocked = false;
  state.trafficStatus = 'A través del proxy';
  state.profile = `proxy-${proxy.id}`;
}

async function createMainWindow() {
  mainWindow = new BrowserWindow({ width: 1700, height: 980, webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, webviewTag: false } });
  await mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
}

app.whenReady().then(async () => {
  securityManager.chromiumHardening(app);
  await createMainWindow();
  securityManager.hardenSession(session.defaultSession, () => state.navigationBlocked);
  await enforceProxyOrBlock();
  emitState();
});

ipcMain.handle('proxy:import', async () => {
  const pick = await dialog.showOpenDialog(mainWindow, { properties: ['openFile'], filters: [{ name: 'Proxy files', extensions: ['txt', 'json', 'csv'] }] });
  if (pick.canceled) return state.proxies;
  state.proxies = await proxyManager.importFromFile(pick.filePaths[0]);
  store.set('proxies', state.proxies.map(maskSecret));
  emitState();
  return state.proxies;
});
ipcMain.handle('proxy:retestAll', async () => { state.proxies = await proxyManager.retestAll(); await enforceProxyOrBlock(); store.set('proxies', state.proxies.map(maskSecret)); emitState(); return state.proxies; });
ipcMain.handle('proxy:select', async (_e, id) => { const proxy = proxyManager.getActiveById(id); if (!proxy || !['working', 'slow'].includes(proxy.status)) throw new Error('Seleccione un proxy funcional.'); state.activeProxyId = id; state.activeProxyLabel = `${proxy.protocol} ${proxy.host}:${proxy.port}`; store.set('activeProxyId', id); await enforceProxyOrBlock(); emitState(); return state; });
ipcMain.handle('leak:test', async () => { const proxy = activeProxy(); if (!proxy || state.navigationBlocked) { state.leakStatus = 'Fuga detectada'; state.leakDetails = [{ key: 'proxy', ok: false, value: 'No hay proxy funcional activo' }]; emitState(); return state; } const report = await runLeakSuite(proxy); state.leakDetails = report.checks; state.leakStatus = report.level; if (report.critical) { state.navigationBlocked = true; state.trafficStatus = 'Bloqueado por fuga crítica'; } emitState(); return state; });
ipcMain.on('nav:go', async (_e, rawUrl) => { await enforceProxyOrBlock(); state.currentUrl = state.navigationBlocked ? 'about:blank' : rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`; emitState(); });
ipcMain.handle('privacy:toggle', async (_e, enabled) => { state.privacyMode = Boolean(enabled); store.set('privacyMode', state.privacyMode); if (state.privacyMode) await session.defaultSession.clearCache(); emitState(); return state.privacyMode; });
ipcMain.handle('browser:clearData', async () => { await session.defaultSession.clearStorageData(); await sessionManager.clearActiveData(); return true; });
