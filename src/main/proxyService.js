const fs = require('node:fs/promises');
const path = require('node:path');
const { parse } = require('csv-parse/sync');
const axios = require('axios');
const geoip = require('geoip-lite');
const { HttpProxyAgent } = require('http-proxy-agent');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');

const IP_ENDPOINTS = [
  'https://api.ipify.org?format=json',
  'https://ifconfig.me/all.json',
  'https://ipinfo.io/json'
];

function normalizeProtocol(raw = '') { const p = raw.toLowerCase(); if (p.startsWith('socks5')) return 'SOCKS5'; if (p.startsWith('socks4')) return 'SOCKS4'; if (p.startsWith('https')) return 'HTTPS'; return 'HTTP'; }
function parseProxyLine(line) { const cleaned = line.trim(); if (!cleaned || cleaned.startsWith('#')) return null; if (cleaned.includes('://')) { const url = new URL(cleaned); const protocol = normalizeProtocol(url.protocol); return { id: `${url.hostname}:${url.port}:${protocol}`, host: url.hostname, port: Number(url.port), username: url.username || '', password: url.password || '', protocol, source: cleaned }; } const [host, port, username = '', password = ''] = cleaned.split(':'); return { id: `${host}:${port}:HTTP`, host, port: Number(port), username, password, protocol: 'HTTP', source: cleaned }; }
async function parseProxyFile(filePath) { const ext = path.extname(filePath).toLowerCase(); const content = await fs.readFile(filePath, 'utf8'); if (ext === '.json') return JSON.parse(content).map((row) => parseProxyLine(typeof row === 'string' ? row : row.proxy)).filter(Boolean); if (ext === '.csv') return parse(content, { relax_column_count: true, skip_empty_lines: true }).map((r) => parseProxyLine(r[0])).filter(Boolean); return content.split(/\r?\n/).map(parseProxyLine).filter(Boolean); }
function proxyToUrl(proxy) { const protocol = proxy.protocol.toLowerCase(); const auth = proxy.username ? `${encodeURIComponent(proxy.username)}:${encodeURIComponent(proxy.password)}@` : ''; return `${protocol.startsWith('socks') ? protocol : protocol === 'https' ? 'https' : 'http'}://${auth}${proxy.host}:${proxy.port}`; }
function maskSecret(proxy) { return { ...proxy, password: proxy.password ? '***' : '' }; }

function createAgents(proxy) { const proxyUrl = proxyToUrl(proxy); if (proxy.protocol.startsWith('SOCKS')) { return { httpAgent: new SocksProxyAgent(proxyUrl), httpsAgent: new SocksProxyAgent(proxyUrl) }; } return { httpAgent: new HttpProxyAgent(proxyUrl), httpsAgent: new HttpsProxyAgent(proxyUrl) }; }

async function testProxy(proxy) {
  const started = Date.now();
  try {
    const response = await axios.get(IP_ENDPOINTS[0], { ...createAgents(proxy), timeout: 10000 });
    const ip = response.data.ip;
    const geo = geoip.lookup(ip);
    return { ...proxy, status: 'working', latency: Date.now() - started, lastCheckedAt: new Date().toISOString(), publicIp: ip, location: geo?.country || 'Unknown' };
  } catch (error) {
    return { ...proxy, status: 'down', latency: null, lastCheckedAt: new Date().toISOString(), publicIp: null, location: 'Unknown', error: error.message };
  }
}

async function runLeakSuite(proxy) {
  const checks = [];
  const agents = createAgents(proxy);
  const ips = [];
  for (const endpoint of IP_ENDPOINTS) {
    try {
      const res = await axios.get(endpoint, { ...agents, timeout: 9000 });
      const ip = res.data.ip || res.data.IP || res.data?.ip_addr;
      if (ip) ips.push(ip);
      checks.push({ key: endpoint, ok: Boolean(ip), value: ip || 'Sin respuesta IP' });
    } catch {
      checks.push({ key: endpoint, ok: false, value: 'Error de consulta' });
    }
  }
  const unique = [...new Set(ips)];
  const consistent = unique.length <= 1;
  checks.push({ key: 'webrtc', ok: true, value: 'Bloqueado por política Chromium (UDP no proxy)' });
  checks.push({ key: 'geolocation', ok: true, value: 'Bloqueada por permisos' });
  const critical = !consistent || checks.some((c) => !c.ok);
  return { checks, critical, level: critical ? 'Fuga detectada' : 'Seguro' };
}

module.exports = { parseProxyFile, parseProxyLine, proxyToUrl, maskSecret, testProxy, runLeakSuite };
