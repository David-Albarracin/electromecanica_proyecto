/**
 * main.js — Punto de entrada: inicialización, eventos, bucle de render
 */

import { state }                          from './state.js';
import { cam, S, w2s, s2w, BASE_SCALE,
         initCamera, fitAll, zoomAt }     from './camera.js';
import { agregarCarga, eliminarCarga,
         limpiar, onEditField,
         setPosMode, actualizarLista,
         actualizarListaSilent,
         updateZoomHUD, setHint }         from './ui.js';
import { drawGrid, drawAxesQ1,
         drawAngleViz, drawConnections,
         drawCharges, drawForceArrows,
         drawElectricFieldGrid,
         drawFieldLines,
         renderForceTable,
         renderEFieldTable }              from './renderer.js';

const canvas = document.getElementById('canvas');
const ctx    = canvas.getContext('2d');

// ── Render principal ──────────────────────────────────────────────────────────
function dibujar() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid(ctx, canvas);
  if (state.cargas.length >= 1) drawAxesQ1(ctx, canvas);
  if (state.cargas.length >= 2) {
    drawConnections(ctx);
    drawAngleViz(ctx);
    drawForceArrows(ctx);
    renderForceTable(state.cargas);
  } else {
    renderForceTable(state.cargas);
  }
  // Campo eléctrico (opcional)
  if (state.showEField && state.cargas.length >= 1) {
    if (state.showFieldLines) drawFieldLines(ctx, canvas);
    drawElectricFieldGrid(ctx, canvas);
    renderEFieldTable(state.cargas);
  }
  drawCharges(ctx);
  updateZoomHUD();
}

// ── Resize ────────────────────────────────────────────────────────────────────
function resizeCanvas() {
  const wr = canvas.parentElement;
  canvas.width  = wr.clientWidth;
  canvas.height = wr.clientHeight;
  if (!cam._init) { initCamera(canvas.width, canvas.height); cam._init = true; }
  dibujar();
}
window.addEventListener('resize', resizeCanvas);

// ── Zoom helpers (expuestos globalmente para botones HTML) ────────────────────
function zoomBy(factor, cx, cy) {
  if (cx == null) { cx = canvas.width / 2; cy = canvas.height / 2; }
  zoomAt(factor, cx, cy);
  updateZoomHUD();
  scheduleFrame();
}

function resetView() {
  initCamera(canvas.width, canvas.height);
  cam.zoom = 1;
  updateZoomHUD();
  dibujar();
}

function fitAllView() {
  fitAll(state.cargas, canvas.width, canvas.height);
  updateZoomHUD();
  dibujar();
}

// ── Pointer helpers ───────────────────────────────────────────────────────────
function getPos(e) {
  const r = canvas.getBoundingClientRect(), src = e.touches ? e.touches[0] : e;
  return { x: src.clientX - r.left, y: src.clientY - r.top };
}
function hitTest(sx, sy) {
  for (let i = state.cargas.length - 1; i >= 0; i--) {
    const p = w2s(state.cargas[i].wx, state.cargas[i].wy);
    if (Math.hypot(sx - p.x, sy - p.y) <= 20) return state.cargas[i];
  }
  return null;
}

// ── Mouse ─────────────────────────────────────────────────────────────────────
canvas.addEventListener('mousedown', e => {
  if (e.button !== 0) return;
  const { x, y } = getPos(e), hit = hitTest(x, y);
  state.dragging = hit
    ? { type: 'charge', charge: hit }
    : { type: 'pan', mx0: x, my0: y, px0: cam.panX, py0: cam.panY };
  canvas.classList.replace('grab', 'grabbing');
  if (hit) setHint('🟡 Arrastrando q' + (state.cargas.indexOf(hit) + 1), true);
  e.preventDefault();
});

canvas.addEventListener('mousemove', e => {
  const { x, y } = getPos(e);
  if (!state.dragging) { canvas.style.cursor = hitTest(x, y) ? 'grab' : 'default'; return; }
  if (state.dragging.type === 'charge') {
    const w = s2w(x, y);
    state.dragging.charge.wx = w.wx;
    state.dragging.charge.wy = w.wy;
    actualizarListaSilent();
  } else {
    cam.panX = state.dragging.px0 + (x - state.dragging.mx0);
    cam.panY = state.dragging.py0 + (y - state.dragging.my0);
  }
  scheduleFrame();
});

canvas.addEventListener('mouseup',    stopDrag);
canvas.addEventListener('mouseleave', stopDrag);

function stopDrag() {
  if (!state.dragging) return;
  const wasCharge = state.dragging.type === 'charge';
  state.dragging = null;
  canvas.classList.replace('grabbing', 'grab');
  canvas.style.cursor = '';
  setHint('☝ Arrastra cargas · espacio vacío = mover vista', false);
  if (wasCharge) actualizarLista();
  dibujar();
}

// ── Wheel zoom ────────────────────────────────────────────────────────────────
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const { x, y } = getPos(e);
  zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12, x, y);
}, { passive: false });

// ── Touch ─────────────────────────────────────────────────────────────────────
let _ptDist = null;
canvas.addEventListener('touchstart', e => {
  if (e.touches.length === 2) {
    const t = e.touches;
    _ptDist   = Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    state.dragging = null; e.preventDefault(); return;
  }
  const { x, y } = getPos(e), hit = hitTest(x, y);
  state.dragging = hit
    ? { type: 'charge', charge: hit }
    : { type: 'pan', mx0: x, my0: y, px0: cam.panX, py0: cam.panY };
  e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  if (e.touches.length === 2) {
    const t  = e.touches;
    const nd = Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    if (_ptDist) {
      const r = canvas.getBoundingClientRect();
      zoomBy(nd / _ptDist,
        (t[0].clientX + t[1].clientX) / 2 - r.left,
        (t[0].clientY + t[1].clientY) / 2 - r.top);
    }
    _ptDist = nd; e.preventDefault(); return;
  }
  if (!state.dragging) return;
  const { x, y } = getPos(e);
  if (state.dragging.type === 'charge') {
    const w = s2w(x, y);
    state.dragging.charge.wx = w.wx;
    state.dragging.charge.wy = w.wy;
    actualizarListaSilent();
  } else {
    cam.panX = state.dragging.px0 + (x - state.dragging.mx0);
    cam.panY = state.dragging.py0 + (y - state.dragging.my0);
  }
  scheduleFrame();
  e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchend', () => { _ptDist = null; stopDrag(); });

// ── Teclado ───────────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  if (e.key === '+' || e.key === '=') zoomBy(1.5);
  if (e.key === '-') zoomBy(1 / 1.5);
  if (e.key === '0') resetView();
  if (e.key === 'f' || e.key === 'F') fitAllView();
  if (e.key === 'e' || e.key === 'E') toggleEField();
});

// ── Delegación de eventos en la lista de cargas ───────────────────────────────
document.getElementById('listaCargas').addEventListener('click', e => {
  const btn = e.target.closest('.charge-del');
  if (btn) { eliminarCarga(Number(btn.dataset.id)); dibujar(); }
});

document.getElementById('listaCargas').addEventListener('input', e => {
  const inp = e.target.closest('input[data-field]');
  if (inp) { onEditField(Number(inp.dataset.id), inp.dataset.field, inp.value); dibujar(); }
});

// ── Botones globales ──────────────────────────────────────────────────────────
document.getElementById('btnAgregarCarga').addEventListener('click', () => { agregarCarga(); dibujar(); });
document.getElementById('btnLimpiar').addEventListener('click', () => { limpiar(canvas, ctx); dibujar(); });
document.getElementById('btnModoCenter').addEventListener('click', () => setPosMode('center'));
document.getElementById('btnModoCoord').addEventListener('click',  () => setPosMode('coord'));
document.getElementById('btnZoomMinus').addEventListener('click', () => zoomBy(0.5));
document.getElementById('btnZoomPlus').addEventListener('click',  () => zoomBy(2));
document.getElementById('btnFit').addEventListener('click',       fitAllView);
document.getElementById('btnReset').addEventListener('click',     resetView);

// ── Toggle campo eléctrico ────────────────────────────────────────────────────
function toggleEField() {
  state.showEField = !state.showEField;
  const btn = document.getElementById('btnToggleEField');
  if (btn) btn.classList.toggle('active', state.showEField);
  // Mostrar/ocultar sección de resultados de campo
  const sec = document.getElementById('secEField');
  if (sec) sec.style.display = state.showEField ? 'block' : 'none';
  if (state.showEField) renderEFieldTable(state.cargas);
  dibujar();
}

function toggleFieldLines() {
  state.showFieldLines = !state.showFieldLines;
  const btn = document.getElementById('btnToggleFieldLines');
  if (btn) btn.classList.toggle('active', state.showFieldLines);
  dibujar();
}

document.getElementById('btnToggleEField')?.addEventListener('click', toggleEField);
document.getElementById('btnToggleFieldLines')?.addEventListener('click', toggleFieldLines);

// ── scheduleFrame helper ──────────────────────────────────────────────────────
function scheduleFrame() {
  if (!state.animFrame)
    state.animFrame = requestAnimationFrame(() => { dibujar(); state.animFrame = null; });
}

// ── Arranque ──────────────────────────────────────────────────────────────────
resizeCanvas();
