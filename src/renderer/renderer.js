const { useEffect, useMemo, useState } = React;
const { motion } = Motion;

const navItems = ["Navegador", "Proxies", "Perfiles", "Leak Test", "Configuración", "Registros", "Herramientas"];
const quickLinks = ["Google", "YouTube", "Facebook", "Wikipedia", "Reddit", "Twitter/X"];

const fallbackProxies = [
  { id: "1", host: "138.197.23.45", port: 8080, protocol: "HTTP", country: "US", latency: 98, status: "working" },
  { id: "2", host: "45.156.12.10", port: 3128, protocol: "HTTP", country: "DE", latency: 112, status: "working" },
  { id: "3", host: "178.62.45.90", port: 8080, protocol: "HTTP", country: "FR", latency: 210, status: "slow" },
  { id: "4", host: "198.23.253.1", port: 1080, protocol: "SOCKS5", country: "CA", latency: null, status: "down" }
];

const statusClasses = {
  working: "text-emerald-400 bg-emerald-500/15",
  slow: "text-amber-300 bg-amber-500/15",
  down: "text-red-400 bg-red-500/15"
};

function App() {
  const [state, setState] = useState({ proxies: fallbackProxies, activeProxyId: "1", killSwitchActive: true, leakStatus: "Seguro", currentUrl: "", trafficStatus: "A través del proxy" });

  useEffect(() => {
    window.navegaApi.onState((s) => setState((prev) => ({ ...prev, ...s })));
  }, []);

  const proxies = state.proxies?.length ? state.proxies : fallbackProxies;
  const active = useMemo(() => proxies.find((p) => p.id === state.activeProxyId) || proxies[0], [proxies, state.activeProxyId]);

  return <div className="h-full p-2 bg-[radial-gradient(circle_at_top,#0e2445_0%,#070d19_50%,#05070f_100%)]">
    <div className="h-full rounded-2xl border border-slate-700/40 bg-slate-950/60 backdrop-blur-sm flex overflow-hidden">
      <aside className="w-56 border-r border-slate-700/30 p-4 flex flex-col justify-between">
        <div><h1 className="text-2xl font-semibold mb-5">🛡 ProxyBrowser Pro</h1>{navItems.map((item, i) => <button key={item} className={`w-full text-left px-3 py-3 mb-2 rounded-xl ${i === 0 ? "bg-blue-600/25 text-blue-100" : "hover:bg-slate-800/60 text-slate-300"}`}>{item}</button>)}</div>
        <div><div className="rounded-xl border border-red-500/30 bg-red-900/30 p-3 text-red-300">🔒 Kill Switch ACTIVO</div><div className="mt-4 text-xs text-slate-400">ProxyBrowser Pro 1.0.0</div></div>
      </aside>

      <main className="flex-1 flex flex-col">
        <header className="grid grid-cols-5 gap-2 p-2 border-b border-slate-700/30">
          <TopCard title="PROXY ACTIVO" value={`${active.host}:${active.port} (${active.protocol})`} sub={`${active.latency ?? "--"} ms`} />
          <TopCard title="IP PÚBLICA" value={active.host} sub="Verificada" />
          <TopCard title="UBICACIÓN" value="Estados Unidos" sub="Nueva York, NY" />
          <TopCard title="ESTADO DE PRIVACIDAD" value={state.leakStatus || "Seguro"} sub="Blindado" />
          <button onClick={() => window.navegaApi.runLeakTest()} className="rounded-xl border border-slate-600 bg-slate-800/60 hover:bg-slate-700">Leak Test</button>
        </header>

        <div className="flex flex-1 min-h-0">
          <section className="flex-1 p-2">
            <div className="h-full rounded-2xl border border-slate-700/50 bg-slate-950/50">
              <div className="p-3 border-b border-slate-700/50">Nueva pestaña</div>
              <div className="p-3 flex gap-2 items-center border-b border-slate-700/30"><span>← → ↻ ⌂</span><input className="flex-1 rounded-lg bg-slate-800/80 p-2" placeholder="Buscar o ingresar dirección web" /><span>🛡</span></div>
              <div className="h-[calc(100%-100px)] flex flex-col justify-center items-center gap-6 text-center">
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-5xl">🛡🌐</motion.div>
                <div><h2 className="text-5xl font-bold">ProxyBrowser Pro</h2><p className="text-xl text-slate-300">Navega seguro. Navega sin límites.</p></div>
                <input className="w-2/3 rounded-xl border border-slate-700 bg-slate-900/60 p-3" placeholder="Buscar con proxy..." />
                <div className="flex gap-4">{quickLinks.map((q) => <div key={q} className="w-24 h-20 rounded-xl border border-slate-700 bg-slate-900/70 grid place-content-center text-sm">{q}</div>)}</div>
              </div>
            </div>
          </section>

          <aside className="w-[520px] p-2 flex flex-col gap-2">
            <div className="rounded-2xl border border-slate-700/50 bg-slate-950/60 p-3 min-h-0">
              <div className="text-2xl mb-2">PROXIES</div>
              <div className="flex gap-2 mb-2"><button className="px-3 py-2 bg-blue-600 rounded-lg" onClick={() => window.navegaApi.importProxies()}>Agregar</button><button className="px-3 py-2 bg-slate-800 rounded-lg" onClick={() => window.navegaApi.retestAll()}>Probar todos</button><button className="px-3 py-2 bg-slate-800 rounded-lg">···</button></div>
              <div className="flex gap-2 mb-2"><input className="flex-1 rounded-lg bg-slate-800 p-2" value="Todos los proxies" readOnly /><input className="flex-1 rounded-lg bg-slate-800 p-2" placeholder="Buscar proxy..." /></div>
              <table className="w-full text-sm"><thead className="text-slate-400"><tr><th>Proxy</th><th>Tipo</th><th>País</th><th>Latencia</th><th>Estado</th></tr></thead><tbody>{proxies.map((p) => <tr key={p.id} className="border-t border-slate-800"><td>{p.host}:{p.port}</td><td>{p.protocol}</td><td>{p.country || "--"}</td><td>{p.latency ? `${p.latency} ms` : "-"}</td><td><span className={`px-2 py-1 rounded-full ${statusClasses[p.status]}`}>{p.status === "working" ? "Funcionando" : p.status === "slow" ? "Lento" : "Caído"}</span></td></tr>)}</tbody></table>
            </div>
            <div className="rounded-2xl border border-slate-700/50 bg-slate-950/60 p-3 flex-1">
              <div className="text-2xl mb-2">LEAK TEST</div><div className="text-6xl text-emerald-400">🛡</div><div className="text-3xl text-emerald-400 font-semibold">SEGURO</div><p className="text-slate-300">No se detectaron fugas</p><button className="mt-3 px-3 py-2 bg-blue-600 rounded-lg" onClick={() => window.navegaApi.runLeakTest()}>Ejecutar prueba</button>
            </div>
          </aside>
        </div>

        <footer className="border-t border-slate-700/40 p-3 grid grid-cols-4 text-sm">
          <div>Perfil activo: US_NY_1</div><div>Modo privacidad: Máxima</div><div>Tráfico: Descargado 15.4MB / Subido 2.7MB</div><div>Conexión: Todo el tráfico protegido</div>
        </footer>
        <div className="px-3 pb-2 text-sm text-slate-300 flex justify-between"><span>Kill Switch: <b className="text-emerald-400">ACTIVO</b></span><span>Proxy obligatorio: <b className="text-emerald-400">ACTIVO</b></span><span>DNS Seguro: <b className="text-emerald-400">ACTIVO</b></span></div>
      </main>
    </div>
  </div>;
}

function TopCard({ title, value, sub }) {
  return <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 p-3"><div className="text-xs text-slate-400">{title}</div><div className="text-lg">{value}</div><div className="text-emerald-400">{sub}</div></div>;
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
