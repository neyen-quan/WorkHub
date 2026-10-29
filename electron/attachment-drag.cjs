const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

// A short-lived capability bridges Chromium's separate WebContents. File bytes
// are read only after a real drop, never cached while hovering Documents.
function registerAttachmentDrag({ ipcMain, source, allowedPath, allowedTarget }) {
  const limit = 150 * 1024 * 1024;
  let pending = null;
  function status(message) {
    const contents = source();
    if (contents && !contents.isDestroyed()) contents.send('attachment-drag-status', message);
  }
  ipcMain.on('begin-attachment-drag', (event, rawPaths) => {
    try {
      if (event.sender !== source()) throw new Error('Origen de arrastre inválido.');
      pending = null;
      if (!Array.isArray(rawPaths) || !rawPaths.length || rawPaths.length > 20) throw new Error('Seleccioná entre 1 y 20 archivos.');
      let total = 0;
      const files = [...new Set(rawPaths)].map(value => {
        if (typeof value !== 'string' || !value || value.startsWith('zip://')) throw new Error('Primero extraé los archivos del ZIP.');
        const file = path.resolve(value);
        if (!allowedPath(file)) throw new Error('El archivo no pertenece a una carpeta habilitada.');
        const stat = fs.statSync(file);
        if (!stat.isFile()) throw new Error('Seleccioná archivos, no carpetas.');
        total += stat.size;
        if (total > limit) throw new Error('Arrastrá hasta 150 MB por operación.');
        return file;
      });
      const token = randomUUID();
      pending = { token, files, expires: Date.now() + 120000 };
      event.returnValue = { token };
    } catch (error) { event.returnValue = { error: error.message }; }
  });
  ipcMain.handle('consume-attachment-drag', async (event, token) => {
    try {
      if (!allowedTarget(event.sender)) throw new Error('El destino no es un chat habilitado.');
      if (!pending || token !== pending.token || Date.now() > pending.expires) throw new Error('El arrastre venció. Volvé a arrastrar el archivo.');
      const request = pending;
      pending = null;
      status('Preparando el adjunto en el chat…');
      let total = 0;
      const files = [];
      for (const file of request.files) {
        if (!allowedPath(file)) throw new Error('La carpeta del archivo ya no está habilitada.');
        const handle = await fs.promises.open(file, 'r');
        try {
          const stat = await handle.stat();
          total += stat.size;
          if (!stat.isFile() || total > limit) throw new Error('El archivo cambió o supera el límite de 150 MB.');
          const bytes = await handle.readFile();
          if (bytes.length !== stat.size) throw new Error('El archivo cambió mientras se leía. Volvé a intentarlo.');
          files.push({ name: path.basename(file), bytes, lastModified: stat.mtimeMs });
        } finally { await handle.close(); }
      }
      return { files };
    } catch (error) {
      status(error.message || 'No se pudo entregar el archivo al chat.');
      return { error: error.message };
    }
  });
  ipcMain.on('attachment-drag-result', (event, result) => {
    if (!allowedTarget(event.sender)) return;
    if (result?.ok) status('Archivo entregado al chat. Esperá a que termine de cargar.');
    else status(String(result?.error || 'El chat no pudo recibir el archivo.').slice(0, 300));
  });
}

module.exports = { registerAttachmentDrag };
