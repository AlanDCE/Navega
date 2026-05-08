const fs = require('node:fs/promises');
const path = require('node:path');
const { parse } = require('csv-parse/sync');
const axios = require('axios');
const geoip = require('geoip-lite');
const { HttpProxyAgent } = require('http-proxy-agent');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');

const IPIFY_ENDPOINT = 'https://api.ipify.org?format=json';

function normalizeProtocol(raw = '') {
  const p = raw.toLowerCase();
  if (p.startsWith('socks5')) return 'SOCKS5';
  if (p.startsWith('socks4')) return 'SOCKS4';
  if (p.startsWith('https')) return 'HTTPS';
  return 'HTTP';
}

function parseProxyLine(line) {
  const cleaned = line.trim();
  if (!cleaned || cleaned.startsWith('#')) return null;

  if (cleaned.includes('://')) {
    const url = new URL(cleaned);
    const protocol = normalizeProtocol(url.protocol);
    return {
      id: `${url.hostname}:${url.port}:${protocol}`,
      host: url.hostname,
      port: Number(url.port),
      username: url.username || '',
      password: url.password || '',
      protocol,
      source: cleaned
    };
  }

  const parts = cleaned.split(':');
  if (parts.length < 2) {
    throw new Error(`Formato inválido de proxy: ${cleaned}`);
  }

  const [host, port, username = '', password = ''] = parts;
  return {
    id: `${host}:${port}:HTTP`,
    host,
    port: Number(port),
    username,
    password,
    protocol: 'HTTP',
    source: cleaned
  };
}

async function parseProxyFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const content = await fs.readFile(filePath, 'utf8');
  if (ext === '.json') {
    const rows = JSON.parse(content);
    return rows.map((row) => parseProxyLine(typeof row === 'string' ? row : row.proxy)).filter(Boolean);
  }

  if (ext === '.csv') {
    const rows = parse(content, { relax_column_count: true, skip_empty_lines: true });
    return rows.map((r) => parseProxyLine(r[0])).filter(Boolean);
  }

  return content.split(/\r?\n/).map(parseProxyLine).filter(Boolean);
}

function proxyToUrl(proxy) {
  const protocol = proxy.protocol.toLowerCase();
  const auth = proxy.username ? `${encodeURIComponent(proxy.username)}:${encodeURIComponent(proxy.password)}@` : '';
  if (protocol.startsWith('socks')) return `${protocol}://${auth}${proxy.host}:${proxy.port}`;
  if (protocol === 'https') return `https://${auth}${proxy.host}:${proxy.port}`;
  return `http://${auth}${proxy.host}:${proxy.port}`;
}

function maskSecret(proxy) {
  return { ...proxy, password: proxy.password ? '***' : '' };
}

async function testProxy(proxy) {
  const proxyUrl = proxyToUrl(proxy);
  let agent;
  if (proxy.protocol.startsWith('SOCKS')) {
    agent = new SocksProxyAgent(proxyUrl);
  } else {
    agent = new HttpsProxyAgent(proxyUrl);
  }

  const started = Date.now();
  try {
    const response = await axios.get(IPIFY_ENDPOINT, {
      httpAgent: proxy.protocol.startsWith('SOCKS') ? new SocksProxyAgent(proxyUrl) : new HttpProxyAgent(proxyUrl),
      httpsAgent: agent,
      timeout: 10000
    });
    const latency = Date.now() - started;
    const ip = response.data.ip;
    const geo = geoip.lookup(ip);
    return {
      ...proxy,
      status: 'working',
      latency,
      lastCheckedAt: new Date().toISOString(),
      publicIp: ip,
      location: geo?.country || 'Unknown'
    };
  } catch (error) {
    return {
      ...proxy,
      status: 'down',
      latency: null,
      lastCheckedAt: new Date().toISOString(),
      publicIp: null,
      location: 'Unknown',
      error: error.message
    };
  }
}

module.exports = {
  parseProxyFile,
  parseProxyLine,
  proxyToUrl,
  maskSecret,
  testProxy
};
