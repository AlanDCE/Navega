# ProxyBrowser Pro (Navega)

Navegador Electron orientado a privacidad con **proxy obligatorio**, **kill switch**, aislamiento de perfiles por proxy y verificación de fugas.

## Ejecutar

```bash
npm install
npm start
```

## Compilar para Windows

```bash
npm run package:win
```

## Seguridad implementada

- Kill switch: si no hay proxy funcional activo, navegación bloqueada automáticamente.
- Proxy obligatorio para todo tráfico HTTP/HTTPS de la sesión.
- Política WebRTC endurecida (`disable_non_proxied_udp`).
- Geolocalización y permisos sensibles bloqueados por defecto.
- Leak test interno (ipify/ifconfig/ipinfo + consistencia).
- Indicadores visibles de estado de proxy, leak test y bloqueo.
- Separación por partición `persist:proxy-<id>` para aislar datos por proxy.

## Formatos soportados

- HTTP / HTTPS / SOCKS4 / SOCKS5
- `ip:puerto`
- `ip:puerto:user:pass`
- `http://user:pass@ip:puerto`
- `socks5://ip:puerto`

## Limitaciones reales

El fingerprinting avanzado no puede ocultarse al 100% solo con configuración de Electron/Chromium.
Para máxima privacidad real, combinar con sistema operativo endurecido, red aislada y validaciones externas periódicas.

## Uso legítimo

Privacidad, QA, verificación geográfica y pruebas web legítimas.
No se incluye automatización de abuso/fraude.
