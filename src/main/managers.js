const { session } = require('electron');
const { parseProxyFile, testProxy, proxyToUrl } = require('./proxyService');

class ProxyManager {
  constructor(initial = []) { this.proxies = initial; }
  async importFromFile(filePath) { this.proxies = (await parseProxyFile(filePath)).map((p) => ({ ...p, status: 'untested' })); return this.retestAll(); }
  async retestAll() { this.proxies = await Promise.all(this.proxies.map((p) => testProxy(p))); return this.proxies; }
  getActiveById(id) { return this.proxies.find((p) => p.id === id) || null; }
  getBestAvailable() { return this.proxies.find((p) => p.status === 'working') || null; }
}

class SessionManager {
  constructor() { this.sessions = new Map(); this.activePartition = null; }
  partitionFor(proxyId) { return `persist:proxy-${proxyId}`; }
  getOrCreate(proxyId) {
    const partition = this.partitionFor(proxyId);
    if (!this.sessions.has(partition)) this.sessions.set(partition, session.fromPartition(partition));
    return this.sessions.get(partition);
  }
  async applyProxy(proxy) {
    if (!proxy) return this.blockAll();
    const s = this.getOrCreate(proxy.id);
    await s.setProxy({ proxyRules: proxyToUrl(proxy), proxyBypassRules: '<-loopback>' });
    this.activePartition = this.partitionFor(proxy.id);
    return s;
  }
  async blockAll() { await session.defaultSession.setProxy({ mode: 'direct' }); }
  async clearActiveData() { if (!this.activePartition) return; const s = session.fromPartition(this.activePartition); await s.clearStorageData(); await s.clearCache(); }
}

class SecurityManager {
  constructor() { this.killSwitch = true; }
  chromiumHardening(app) {
    app.commandLine.appendSwitch('force-webrtc-ip-handling-policy', 'disable_non_proxied_udp');
    app.commandLine.appendSwitch('webrtc-ip-handling-policy', 'disable_non_proxied_udp');
    app.commandLine.appendSwitch('disable-features', 'WebRtcHideLocalIpsWithMdns,DNSPrefetch,NetworkPrediction,PrefetchPrivacyChanges,SpeculationRulesPrefetchProxy');
    app.commandLine.appendSwitch('disable-quic');
    app.commandLine.appendSwitch('disable-background-networking');
  }
  hardenSession(targetSession, isNavigationBlocked) {
    targetSession.setPermissionRequestHandler((_, __, cb) => cb(false));
    targetSession.webRequest.onBeforeRequest((details, callback) => {
      if (isNavigationBlocked() && details.url.startsWith('http')) return callback({ cancel: true });
      callback({});
    });
  }
}

module.exports = { ProxyManager, SessionManager, SecurityManager };
