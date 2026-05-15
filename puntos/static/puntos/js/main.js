/**
 * main.js — Entry point: init, eventos, render loop
 */

import { state }                          from './state.js';
import { cam, S, w2s, s2w,
         initCamera, fitAll, zoomAt }     from './camera.js';
import { agregarCarga, eliminarCarga,
         limpiar, onEditField, onEditPointP,
         setMode, setTarget,
         actualizarLista, actualizarListaSilent,
         updateZoomHUD, setHint }         from './ui.js';
import { drawGrid, drawCharges, drawPointP,
         drawAnalysis, hitPointP }        from './renderer.js';
import { renderMathPanel }                from './mathPanel.js';

const canvas = document.getElementById('canvas');
const ctx    = canvas.getContext('2d');

// ── Render principal ────────────────────────────────────────────────────────
function dibujar() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid(ctx, canvas);
  drawAnalysis(ctx);
  drawCharges(ctx);
  if (state.mode === 'efield') drawPointP(ctx);
  updateZoomHUD();
}

// ── Resize ──────────────────────────────────────────────────────────────────
function resizeCanvas() {
  const wr = canvas.parentElement;
  canvas.width  = wr.clientWidth;
  canvas.height = wr.clientHeight;
  if (!cam._init) { initCamera(canvas.width, canvas.height); cam._init = true; }
  dibujar();
}
window.addEventListener('resize', resizeCanvas);

// ── Zoom helpers ────────────────────────────────────────────────────────────
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
  const pts = [...state.cargas];
  if (state.mode === 'efield') pts.push({ wx: state.pointP.wx, wy: state.pointP.wy });
  fitAll(pts, canvas.width, canvas.height);
  updateZoomHUD();
  dibujar();
}

// ── Pointer helpers ─────────────────────────────────────────────────────────
function getPos(e) {
  const r = canvas.getBoundingClientRect(), src = e.touches ? e.touches[0] : e;
  return { x: src.clientX - r.left, y: src.clientY - r.top };
}
function hitTestCharge(sx, sy) {
  for (let i = state.cargas.length - 1; i >= 0; i--) {
    const p = w2s(state.cargas[i].wx, state.cargas[i].wy);
    if (Math.hypot(sx - p.x, sy - p.y) <= 20) return state.cargas[i];
  }
  return null;
}

// ── Mouse ────────────────────────────────────────────────────────────────────
canvas.addEventListener('mousedown', e => {
  if (e.button !== 0) return;
  const { x, y } = getPos(e);
  // Punto P (sólo en modo campo)
  if (state.mode === 'efield' && hitPointP(x, y)) {
    state.dragging = { type: 'point' };
    canvas.classList.replace('grab', 'grabbing');
    setHint('🟣 Arrastrando P', true);
    e.preventDefault();
    return;
  }
  const hit = hitTestCharge(x, y);
  state.dragging = hit
    ? { type: 'charge', charge: hit }
    : { type: 'pan', mx0: x, my0: y, px0: cam.panX, py0: cam.panY };
  canvas.classList.replace('grab', 'grabbing');
  if (hit) {
    const idx = state.cargas.indexOf(hit);
    setHint(`Arrastrando Q${idx+1}`, true);
  }
  e.preventDefault();
});

canvas.addEventListener('mousemove', e => {
  const { x, y } = getPos(e);
  if (!state.dragging) {
    const overP = state.mode === 'efield' && hitPointP(x, y);
    canvas.style.cursor = (overP || hitTestCharge(x, y)) ? 'grab' : 'default';
    return;
  }
  if (state.dragging.type === 'charge') {
    const w = s2w(x, y);
    state.dragging.charge.wx = w.wx;
    state.dragging.charge.wy = w.wy;
    actualizarListaSilent();
    renderMathPanel();
  } else if (state.dragging.type === 'point') {
    const w = s2w(x, y);
    state.pointP.wx = w.wx;
    state.pointP.wy = w.wy;
    actualizarListaSilent();
    renderMathPanel();
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
  state.dragging = null;
  canvas.classList.replace('grabbing', 'grab');
  canvas.style.cursor = '';
  setHint('Arrastra cargas/P · espacio vacío = mover vista', false);
  actualizarLista();
  dibujar();
}

// ── Wheel zoom ──────────────────────────────────────────────────────────────
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const { x, y } = getPos(e);
  zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12, x, y);
}, { passive: false });

// ── Touch ───────────────────────────────────────────────────────────────────
let _ptDist = null;
canvas.addEventListener('touchstart', e => {
  if (e.touches.length === 2) {
    const t = e.touches;
    _ptDist = Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    state.dragging = null; e.preventDefault(); return;
  }
  const { x, y } = getPos(e);
  if (state.mode === 'efield' && hitPointP(x, y)) {
    state.dragging = { type: 'point' };
    e.preventDefault();
    return;
  }
  const hit = hitTestCharge(x, y);
  state.dragging = hit
    ? { type: 'charge', charge: hit }
    : { type: 'pan', mx0: x, my0: y, px0: cam.panX, py0: cam.panY };
  e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  if (e.touches.length === 2) {
    const t = e.touches;
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
    renderMathPanel();
  } else if (state.dragging.type === 'point') {
    const w = s2w(x, y);
    state.pointP.wx = w.wx;
    state.pointP.wy = w.wy;
    actualizarListaSilent();
    renderMathPanel();
  } else {
    cam.panX = state.dragging.px0 + (x - state.dragging.mx0);
    cam.panY = state.dragging.py0 + (y - state.dragging.my0);
  }
  scheduleFrame();
  e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchend', () => { _ptDist = null; stopDrag(); });

// ── Teclado ─────────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  if (e.key === '+' || e.key === '=') zoomBy(1.5);
  if (e.key === '-') zoomBy(1 / 1.5);
  if (e.key === '0') resetView();
  if (e.key === 'f' || e.key === 'F') fitAllView();
  if (e.key === '1') setMode('force');
  if (e.key === '2') setMode('efield');
});

// ── Delegación: lista de cargas ─────────────────────────────────────────────
document.getElementById('listaCargas').addEventListener('click', e => {
  const del = e.target.closest('.charge-del');
  if (del) { eliminarCarga(Number(del.dataset.id)); dibujar(); return; }
  const pick = e.target.closest('.target-pick');
  if (pick) { setTarget('charge', Number(pick.dataset.targetId)); dibujar(); }
});

document.getElementById('listaCargas').addEventListener('input', e => {
  const inp = e.target.closest('input[data-field]');
  if (inp) {
    onEditField(Number(inp.dataset.id), inp.dataset.field, inp.value);
    dibujar();
  }
});

// ── Punto P inputs ───────────────────────────────────────────────────────────
document.getElementById('pointPSection')?.addEventListener('input', e => {
  if (e.target.matches('[data-px]')) { onEditPointP('wx', e.target.value); dibujar(); }
  if (e.target.matches('[data-py]')) { onEditPointP('wy', e.target.value); dibujar(); }
});

document.getElementById('pointPSection')?.addEventListener('click', e => {
  if (e.target.closest('.point-pick')) {
    setTarget('point');
    dibujar();
  }
});

// ── Botones globales ────────────────────────────────────────────────────────
document.getElementById('btnAgregarCarga').addEventListener('click', () => { agregarCarga(); dibujar(); });
document.getElementById('btnLimpiar').addEventListener('click', () => { limpiar(canvas, ctx); dibujar(); });
document.getElementById('btnZoomMinus').addEventListener('click', () => zoomBy(0.5));
document.getElementById('btnZoomPlus').addEventListener('click',  () => zoomBy(2));
document.getElementById('btnFit').addEventListener('click',       fitAllView);
document.getElementById('btnReset').addEventListener('click',     resetView);

// Modo selectores
document.querySelectorAll('[data-mode-btn]').forEach(b => {
  b.addEventListener('click', () => { setMode(b.dataset.modeBtn); dibujar(); });
});

// ── scheduleFrame helper ────────────────────────────────────────────────────
function scheduleFrame() {
  if (!state.animFrame)
    state.animFrame = requestAnimationFrame(() => { dibujar(); state.animFrame = null; });
}

// ── Arranque ────────────────────────────────────────────────────────────────
resizeCanvas();
actualizarLista();
renderMathPanel();
