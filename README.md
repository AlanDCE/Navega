# Navega Proxy Browser

Aplicación de escritorio con Electron + Chromium + Node.js que fuerza el uso de proxy para navegar.

## Instalación

```bash
npm install
npm start
```

## Compilar en Windows

```bash
npm run package:win
```

Genera un binario portable con `electron-builder` en `dist/`.

## Uso básico

1. Haz clic en **Importar proxies** y selecciona un archivo `.txt`, `.json` o `.csv`.
2. La app prueba automáticamente cada proxy (estado, latencia, IP pública y país estimado).
3. Elige un proxy funcional en la lista lateral.
4. Navega en la barra de URL. Si no hay proxy activo, la app bloquea la navegación.

## Formatos de proxies soportados

- `ip:puerto`
- `ip:puerto:usuario:contraseña`
- `http://usuario:contraseña@ip:puerto`
- `socks5://ip:puerto`

## Cambiar proxy activo

- Haz clic en el proxy de la lista.
- Solo proxies con estado `working` se pueden activar.
- El indicador superior muestra el proxy activo, IP pública observada y URL actual.

## Mitigación de fugas de IP real

- La navegación se bloquea si no hay proxy funcional activo.
- Electron se lanza con políticas WebRTC `disable_non_proxied_udp`.
- Se usa una partición persistente por proxy (`persist:proxy-<id>`) para aislar cookies/sesión.
- Se aplica `session.setProxy` por partición antes de navegar.

> Nota: En escritorio no existe garantía 100% contra leaks en todos los escenarios/redes. Se recomienda validar con pruebas externas de DNS/WebRTC.

## Uso legítimo

Diseñado para privacidad, QA, pruebas geográficas, debugging de contenido regional y administración de conexiones.
No incluye automatización de abuso, fraude ni bypass de seguridad.
