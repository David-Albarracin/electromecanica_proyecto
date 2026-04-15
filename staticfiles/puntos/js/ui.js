/**
 * ui.js — Actualización del sidebar y CRUD de cargas
 */

import { state }                   from './state.js';
import { cam, w2s, s2w, S,
         BASE_SCALE, fitAll,
         zoomAt, initCamera }      from './camera.js';
import { formatQ, formatDist,
         niceNum }                 from './formatters.js';
import { renderForceTable,
         renderEFieldTable }       from './renderer.js';

// ── Helpers de referencia a q1 ────────────────────────────────────────────────
export function q1pos() {
  const { cargas } = state;
  return cargas.length > 0 ? { wx: cargas[0].wx, wy: cargas[0].wy } : { wx: 0, wy: 0 };
}

export function chargeRelative(c) {
  const o  = q1pos();
  const dx = c.wx - o.wx, dy = c.wy - o.wy;
  return { dx, dy, dist: Math.hypot(dx, dy),
           angle: ((Math.atan2(dy, dx) * 180 / Math.PI) + 360) % 360 };
}

export function placeFromQ1(dist, angleDeg) {
  const o = q1pos(), r = angleDeg * Math.PI / 180;
  return { wx: o.wx + dist * Math.cos(r), wy: o.wy + dist * Math.sin(r) };
}

// ── Modo de posicionamiento ───────────────────────────────────────────────────
export function setPosMode(m) {
  state.posMode = m;
  document.getElementById('btnModoCenter').classList.toggle('active', m === 'center');
  document.getElementById('btnModoCoord').classList.toggle('active',  m === 'coord');
  document.getElementById('panelCoord').style.display = m === 'coord' ? 'block' : 'none';
}

// ── CRUD cargas ───────────────────────────────────────────────────────────────
export function agregarCarga() {
  const v  = parseFloat(document.getElementById('valorCarga').value) || 1e-6;
  const t  = document.getElementById('tipoCarga').value;
  const q  = t === 'negativa' ? -Math.abs(v) : Math.abs(v);
  let wx, wy;
  if (state.cargas.length === 0) {
    wx = 0; wy = 0;
  } else if (state.posMode === 'coord') {
    const d = parseFloat(document.getElementById('inputDist').value)  || 1;
    const a = parseFloat(document.getElementById('inputAngle').value) || 0;
    const p = placeFromQ1(d, a); wx = p.wx; wy = p.wy;
  } else {
    const n = state.cargas.length;
    wx = Math.cos(n * 1.2) * n * 0.8;
    wy = Math.sin(n * 1.2) * n * 0.8;
  }
  state.cargas.push({ wx, wy, valor: q, tipo: t, id: Date.now() });
  actualizarLista();
}

export function eliminarCarga(id) {
  state.cargas = state.cargas.filter(c => c.id !== id);
  actualizarLista();
}

export function limpiar(canvas, ctx) {
  state.cargas = [];
  actualizarLista();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

export function onEditField(id, field, rawVal) {
  const idx = state.cargas.findIndex(c => c.id === id);
  if (idx <= 0) return;
  const val = parseFloat(rawVal);
  if (isNaN(val)) return;
  let { dist, angle } = chargeRelative(state.cargas[idx]);
  if (field === 'dist')  dist  = Math.max(1e-12, val);
  if (field === 'angle') angle = ((val % 360) + 360) % 360;
  const p = placeFromQ1(dist, angle);
  state.cargas[idx].wx = p.wx;
  state.cargas[idx].wy = p.wy;
  actualizarListaSilent();
}

// ── Sidebar completo ──────────────────────────────────────────────────────────
export function actualizarLista() {
  document.getElementById('numCargas').textContent = state.cargas.length;
  const cont = document.getElementById('listaCargas');
  cont.innerHTML = '';
  state.cargas.forEach((c, i) => {
    const col   = c.tipo === 'positiva' ? '#ef4444' : '#3b82f6';
    const isQ1  = i === 0;
    const isDrag = state.dragging?.charge === c;
    const div   = document.createElement('div');
    div.className = 'charge-item' + (isQ1 ? ' is-q1' : '') + (isDrag ? ' drag-active' : '');
    div.innerHTML = `
      <div class="charge-header">
        <div class="charge-dot" style="background:${col};box-shadow:0 0 6px ${col}60"></div>
        <span class="charge-name">q${i+1}${isQ1 ? ` <span class="q1-badge">ORIGEN</span>` : ''}</span>
        <span class="charge-sign" style="color:${col}">${c.tipo === 'positiva' ? '(+)' : '(−)'}</span>
        <span class="charge-qval">${formatQ(c.valor)}</span>
        <button class="charge-del" data-id="${c.id}">✕</button>
      </div>`;
    if (isQ1) {
      const d = document.createElement('div');
      d.className = 'charge-q1-pos';
      d.textContent = `Pos: (${c.wx.toFixed(5)}, ${c.wy.toFixed(5)}) m`;
      div.appendChild(d);
    } else {
      const { dx, dy, dist, angle } = chargeRelative(c);
      const f = document.createElement('div');
      f.className = 'charge-fields';
      f.innerHTML = `
        <div>
          <label>Dist. desde q1 (m)</label>
          <input type="number" data-id="${c.id}" data-field="dist" step="any" min="1e-12"
            value="${dist.toPrecision(6)}">
        </div>
        <div>
          <label>Ángulo (°)</label>
          <input type="number" data-id="${c.id}" data-field="angle" step="0.01" min="0" max="360"
            value="${angle.toFixed(3)}">
        </div>
        <div class="delta-row">
          <span style="color:#ef9999">Δx = ${formatDist(dx)}</span>
          <span style="color:#99ef99">Δy = ${formatDist(dy)}</span>
        </div>`;
      div.appendChild(f);
    }
    cont.appendChild(div);
  });

  renderForceTable(state.cargas);
  if (state.showEField) renderEFieldTable(state.cargas);
}

// Actualización silenciosa (sin re-crear DOM; solo actualiza valores)
export function actualizarListaSilent() {
  document.getElementById('numCargas').textContent = state.cargas.length;
  const focused = document.activeElement;
  document.querySelectorAll('#listaCargas .charge-item').forEach((item, i) => {
    const c = state.cargas[i]; if (!c) return;
    if (i === 0) {
      const p = item.querySelector('.charge-q1-pos');
      if (p) p.textContent = `Pos: (${c.wx.toFixed(5)}, ${c.wy.toFixed(5)}) m`;
      return;
    }
    const { dx, dy, dist, angle } = chargeRelative(c);
    item.querySelectorAll('input[data-field]').forEach(inp => {
      if (inp === focused) return;
      inp.value = inp.dataset.field === 'dist' ? dist.toPrecision(6) : angle.toFixed(3);
    });
    const sp = item.querySelectorAll('.delta-row span');
    if (sp[0]) sp[0].textContent = 'Δx = ' + formatDist(dx);
    if (sp[1]) sp[1].textContent = 'Δy = ' + formatDist(dy);
  });
  renderForceTable(state.cargas);
  if (state.showEField) renderEFieldTable(state.cargas);
}

// ── HUD de zoom ───────────────────────────────────────────────────────────────
export function updateZoomHUD() {
  const el = document.getElementById('zoomLevel');
  const si = document.getElementById('sinfo');
  if (!el) return;
  const z = cam.zoom;
  el.textContent = z >= 100 ? z.toFixed(0) + '×' : z >= 1 ? z.toFixed(2) + '×' : z.toPrecision(2) + '×';
  if (si) si.textContent = formatDist(100 / S()) + '/100px';
}

export function setHint(txt, on) {
  const el = document.getElementById('dragHint');
  if (!el) return;
  el.textContent = txt;
  el.classList.toggle('active-drag', on);
}
