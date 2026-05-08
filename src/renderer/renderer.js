const el = (id) => document.getElementById(id);
let state = { proxies: [], activeProxyId: null, leakDetails: [] };

function statusClass(s) { return s === 'working' ? 'text-emerald-400' : s === 'down' ? 'text-red-400' : 'text-amber-400'; }

function render() {
  el('proxyList').innerHTML = (state.proxies || []).map((p) => `<button data-id='${p.id}' class='w-full p-2 rounded border border-slate-700 text-left'>
    <div>${p.host}:${p.port} <span class='${statusClass(p.status)}'>● ${p.status}</span></div>
    <div class='text-xs text-slate-400'>${p.protocol} · ${p.location || '-'} · ${p.latency ?? '-'} ms</div>
  </button>`).join('');
  const active = (state.proxies || []).find((p) => p.id === state.activeProxyId);
  el('activeProxy').textContent = `Proxy activo: ${active ? `${active.host}:${active.port} (${active.protocol})` : 'Ninguno'}`;
  el('publicIp').textContent = `IP: ${active?.publicIp || '-'}`;
  el('location').textContent = `Ubicación: ${active?.location || '-'}`;
  el('privacy').textContent = `Privacidad: ${state.leakStatus || 'Riesgo'}`;
  el('killStatus').textContent = `Kill Switch: ${state.killSwitchActive ? 'ACTIVO' : 'INACTIVO'}`;
  el('trafficStatus').textContent = state.trafficStatus || '-';
  el('leakStatus').textContent = state.leakStatus || '-';
  el('leakDetails').innerHTML = (state.leakDetails || []).map((x) => `<div>${x.ok ? '✅' : '❌'} ${x.key}: ${x.value}</div>`).join('');
  el('browserFrame').src = state.currentUrl || 'about:blank';
}

window.navegaApi.onState((s) => { state = { ...state, ...s }; render(); });
el('importBtn').onclick = () => window.navegaApi.importProxies();
el('retestBtn').onclick = () => window.navegaApi.retestAll();
el('goBtn').onclick = () => window.navegaApi.navigate(el('urlInput').value);
el('clearBtn').onclick = () => window.navegaApi.clearBrowsingData();
el('leakBtn').onclick = () => window.navegaApi.runLeakTest();
el('privacyToggle').onchange = (e) => window.navegaApi.togglePrivacy(e.target.checked);
el('proxyList').addEventListener('click', async (e) => { const btn = e.target.closest('button[data-id]'); if (!btn) return; try { await window.navegaApi.selectProxy(btn.dataset.id); } catch (err) { alert(`Proxy caído. Navegación bloqueada. ${err.message}`); } });

render();
