# Datos y compatibilidad

Se conservan `workhub-desktop` y AppUserModelID `agency.neyen.workhub`.

- `%APPDATA%\workhub-desktop`: perfil Chromium, Local Storage de `http://127.0.0.1:5173`, Cookies, cuentas y preferencias. No cambia el origen local ni los identificadores `persist:workhub-*`. Se conserva el mapeo histórico de Gmail y la partición compartida entre Gmail Personal y Gemini.
- `%APPDATA%\workhub-desktop\private-config.json`: correos privados extraídos localmente durante la transición; no se publica.
- `%APPDATA%\workhub-desktop\document-clipboard`: archivos locales temporales de copiado.
- `%APPDATA%\workhub-desktop\update-channel.json`: URL del canal guardada.
- `%APPDATA%\workhub-desktop\updates\downloads`: ZIP pendiente; permanece disponible durante la confirmación nativa y al cancelar.
- Carpetas elegidas por el usuario: documentos y archivos originales. Nunca se agregan al programa ni a GitHub.
- `%TEMP%\workhub-*`: trabajo temporal de arrastre, apertura y actualización antigua.
- `.workhub-updates` junto a WorkHub.exe: transacciones, respaldo y recuperación del programa. El progreso vive en memoria/IPC, no depende de progress.json.

Los perfiles antiguos no se renombran. La primera transición reorganiza únicamente archivos del programa y conserva el respaldo generado por el actualizador anterior. La instalación siempre sigue la ubicación real del ejecutable y no fija rutas de una PC.
