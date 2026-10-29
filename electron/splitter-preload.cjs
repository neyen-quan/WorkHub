const { ipcRenderer } = require('electron');

let activeGrip = null;
let pointerId = null;

function sendPointer(event) {
  if (!activeGrip) return;
  ipcRenderer.send('splitter-pointer', {
    axis: activeGrip.dataset.axis,
    screenX: event.screenX,
    screenY: event.screenY
  });
}

window.addEventListener('pointerdown', event => {
  if (event.target.closest('button[aria-label="Actualizar Microinfluencers"]')) {
    event.preventDefault();
    ipcRenderer.send('micro-preview-refresh');
    return;
  }
  const grip = event.target.closest('.grip');
  if (!grip || event.button !== 0) return;
  event.preventDefault();
  activeGrip = grip;
  pointerId = event.pointerId;
  grip.setPointerCapture(pointerId);
  grip.classList.add('dragging');
  ipcRenderer.send('splitter-drag-state', grip.dataset.axis);
  sendPointer(event);
});

window.addEventListener('pointermove', event => {
  if (!activeGrip || event.pointerId !== pointerId) return;
  event.preventDefault();
  sendPointer(event);
});

function endDrag(event) {
  if (!activeGrip || (event.pointerId !== undefined && event.pointerId !== pointerId)) return;
  if (event.type === 'pointerup') sendPointer(event);
  activeGrip.classList.remove('dragging');
  ipcRenderer.send('splitter-drag-state', null);
  activeGrip = null;
  pointerId = null;
}

window.addEventListener('pointerup', endDrag);
window.addEventListener('pointercancel', endDrag);
