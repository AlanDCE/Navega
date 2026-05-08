const proxyList = document.getElementById('proxyList');
const statusBar = document.getElementById('statusBar');
const frame = document.getElementById('browserFrame');
const urlInput = document.getElementById('urlInput');
const sortSelect = document.getElementById('sortSelect');

let state = { proxies: [], activeProxyId: null, activeProxyLabel: 'Ninguno activo', currentUrl: 'https://example.com' };

function paint() {
  const ordered = [...state.proxies].sort((a, b) => {
    const mode = sortSelect.value;
    if (mode === 'latency') return (a.latency ?? 999999) - (b.latency ?? 999999);
    if (mode === 'location') return (a.location || '').localeCompare(b.location || '');
    return (a.status || '').localeCompare(b.status || '');
  });

  proxyList.innerHTML = ordered.map((p) => `
    <button data-id="${p.id}" class="w-full text-left p-2 rounded border ${p.status === 'working' ? 'border-emerald-500' : p.status === 'down' ? 'border-red-500' : 'border-slate-500'}">
      <div class="font-semibold">${p.protocol} ${p.host}:${p.port}</div>
      <div class="text-xs">Estado: ${p.status} | Latencia: ${p.latency ?? '-'} ms</div>
      <div class="text-xs">País: ${p.location || 'N/D'} | Última prueba: ${p.lastCheckedAt || 'Nunca'}</div>
      ${state.activeProxyId === p.id ? '<div class="text-cyan-300 text-xs">Proxy activo</div>' : ''}
    </button>
  `).join('');

  statusBar.textContent = `Proxy activo: ${state.activeProxyLabel || 'Ninguno'} | URL: ${state.currentUrl || '-'} | IP proxy: ${state.proxies.find(p => p.id === state.activeProxyId)?.publicIp || 'N/D'}`;
}

window.navegaApi.onState((newState) => {
  state = { ...state, ...newState };
  if (state.currentUrl) frame.src = state.currentUrl;
  paint();
});

proxyList.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-id]');
  if (!button) return;
  try {
    await window.navegaApi.selectProxy(button.dataset.id);
  } catch (error) {
    alert(`No se puede activar proxy: ${error.message}`);
  }
});

document.getElementById('importBtn').onclick = () => window.navegaApi.importProxies();
document.getElementById('retestBtn').onclick = () => window.navegaApi.retestAll();
document.getElementById('goBtn').onclick = async () => {
  if (!state.activeProxyId) return alert('Debes seleccionar un proxy activo.');
  window.navegaApi.navigate(urlInput.value);
};
document.getElementById('homeBtn').onclick = () => { urlInput.value = 'https://example.com'; window.navegaApi.navigate(urlInput.value); };
document.querySelectorAll('.nav').forEach((btn) => btn.onclick = () => frame.contentWindow?.history?.[btn.dataset.cmd === 'back' ? 'back' : 'forward']?.());
document.getElementById('clearBtn').onclick = async () => { await window.navegaApi.clearBrowsingData(); alert('Cookies/caché limpiadas por partición de proxy.'); };
sortSelect.onchange = paint;

paint();
