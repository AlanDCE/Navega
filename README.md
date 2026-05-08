# Navega Proxy Browser

Navegador de escritorio basado en Electron con enrutamiento obligatorio por proxy, kill switch, aislamiento por perfil y panel de leak test.

## Características
- Dashboard con estado de proxy, IP pública, latencia y privacidad.
- Carga de proxies `.txt`, `.json`, `.csv`.
- Soporte HTTP/HTTPS/SOCKS4/SOCKS5 con y sin autenticación.
- Kill switch: bloquea navegación si no hay proxy operativo.
- Leak test básico (IP consistency, WebRTC/DNS/geoloc señales).
- Limpieza de caché y datos por perfil.

## Requisitos
- Node.js 20+
- npm 10+
- Windows/macOS/Linux (build instalable objetivo: Windows)

## Instalación
```bash
npm install
npm run dev
```

## Uso
1. Importar archivo de proxies.
2. Probar proxies.
3. Seleccionar proxy funcional.
4. Ejecutar Leak Test.

## Formato de proxies
Ver `docs/PROXY_FORMAT.md`.

## Scripts
- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run typecheck`
- `npm run dist`
- `npm run dist:win`

## Kill switch
Si el proxy activo cae o se detecta fuga crítica, la navegación HTTP/HTTPS se cancela automáticamente.

## Leak test
Evalúa IP visible, consistencia entre endpoints, señales de WebRTC/DNS/geolocalización y marca nivel de riesgo.

## Uso legítimo
Proyecto para privacidad defensiva y pruebas de red legítimas. No promete anonimato absoluto.
