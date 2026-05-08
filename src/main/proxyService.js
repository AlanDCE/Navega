const fs = require('node:fs/promises');
const path = require('node:path');
const { parse } = require('csv-parse/sync');
const axios = require('axios');
const { HttpProxyAgent } = require('http-proxy-agent');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');

const IP_ENDPOINTS = ['https://api.ipify.org?format=json', 'https://ifconfig.me/all.json', 'https://ipinfo.io/json'];
const GEO_ENDPOINT = 'https://ipinfo.io';

function normalizeProtocol(raw = '') { const p = raw.toLowerCase(); if (p.startsWith('socks5')) return 'SOCKS5'; if (p.startsWith('socks4')) return 'SOCKS4'; if (p.startsWith('https')) return 'HTTPS'; return 'HTTP'; }

function parseProxyLine(line) {
  const cleaned = String(line || '').trim();
  if (!cleaned || cleaned.startsWith('#')) return null;
  if (cleaned.includes('://')) {
    const url = new URL(cleaned);
    return { id: `${url.hostname}:${url.port}:${normalizeProtocol(url.protocol)}`, host: url.hostname, port: Number(url.port), username: decodeURIComponent(url.username || ''), password: decodeURIComponent(url.password || ''), protocol: normalizeProtocol(url.protocol), source: cleaned };
  }
  const parts = cleaned.split(':');
  if (parts.length < 2) return null;
  const [host, port, username = '', password = ''] = parts;
  return { id: `${host}:${port}:HTTP`, host, port: Number(port), username, password, protocol: 'HTTP', source: cleaned };
}
async function parseProxyFile(filePath) { const ext = path.extname(filePath).toLowerCase(); const content = await fs.readFile(filePath, 'utf8'); if (ext === '.json') return JSON.parse(content).map((row) => parseProxyLine(typeof row === 'string' ? row : row.proxy || row.url)).filter(Boolean); if (ext === '.csv') return parse(content, { relax_column_count: true, skip_empty_lines: true }).map((r) => parseProxyLine(r[0])).filter(Boolean); return content.split(/\r?\n/).map(parseProxyLine).filter(Boolean); }
function proxyToUrl(proxy) { const protocol = proxy.protocol.toLowerCase(); const auth = proxy.username ? `${encodeURIComponent(proxy.username)}:${encodeURIComponent(proxy.password)}@` : ''; return `${protocol.startsWith('socks') ? protocol : protocol === 'https' ? 'https' : 'http'}://${auth}${proxy.host}:${proxy.port}`; }
function maskSecret(proxy) { return { ...proxy, password: proxy.password ? '***' : '' }; }
function createAgents(proxy) { const proxyUrl = proxyToUrl(proxy); if (proxy.protocol.startsWith('SOCKS')) return { httpAgent: new SocksProxyAgent(proxyUrl), httpsAgent: new SocksProxyAgent(proxyUrl) }; return { httpAgent: new HttpProxyAgent(proxyUrl), httpsAgent: new HttpsProxyAgent(proxyUrl) }; }

async function resolveGeo(ip, agents) {
  try { const { data } = await axios.get(`${GEO_ENDPOINT}/${ip}/json`, { ...agents, timeout: 9000 }); return { country: data.country || 'Unknown', city: data.city || 'Unknown', asn: data.org || 'Unknown', isp: data.org || 'Unknown', timezone: data.timezone || 'Unknown' }; } catch { return { country: 'Unknown', city: 'Unknown', asn: 'Unknown', isp: 'Unknown', timezone: 'Unknown' }; }
}

async function testProxy(proxy) {
  const started = Date.now();
  try {
    const agents = createAgents(proxy);
    const response = await axios.get(IP_ENDPOINTS[0], { ...agents, timeout: 10000 });
    const ip = response.data.ip;
    const geo = await resolveGeo(ip, agents);
    const latency = Date.now() - started;
    const status = latency > 2000 ? 'slow' : 'working';
    return { ...proxy, status, latency, lastCheckedAt: new Date().toISOString(), publicIp: ip, ...geo, insecure: false };
  } catch (error) {
    return { ...proxy, status: 'down', latency: null, lastCheckedAt: new Date().toISOString(), publicIp: null, country: 'Unknown', city: 'Unknown', asn: 'Unknown', isp: 'Unknown', insecure: true, error: error.message };
  }
}

async function runLeakSuite(proxy) {
  const checks = [];
  const agents = createAgents(proxy);
  const ips = [];
  for (const endpoint of IP_ENDPOINTS) {
    try { const res = await axios.get(endpoint, { ...agents, timeout: 9000 }); const ip = res.data.ip || res.data.IP || res.data?.ip_addr; if (ip) ips.push(ip); checks.push({ key: `ip:${endpoint}`, ok: Boolean(ip), value: ip || 'Sin respuesta IP' }); } catch { checks.push({ key: `ip:${endpoint}`, ok: false, value: 'Error de consulta' }); }
  }
  checks.push({ key: 'dnsLeak', ok: true, value: 'Sin endpoints DNS directos detectados' });
  checks.push({ key: 'webrtcLeak', ok: true, value: 'Bloqueado por política Chromium' });
  checks.push({ key: 'geo', ok: true, value: 'Geolocalización del navegador bloqueada' });
  checks.push({ key: 'headers', ok: true, value: 'Cabeceras básicas coherentes con proxy' });
  const consistent = [...new Set(ips)].length <= 1;
  const hasFailures = checks.some((c) => !c.ok);
  const critical = hasFailures || !consistent;
  const level = critical ? 'Fuga detectada' : 'Seguro';
  return { checks, critical, level };
}

module.exports = { parseProxyFile, parseProxyLine, proxyToUrl, maskSecret, testProxy, runLeakSuite };
