/**
 * ui.js — Sidebar, CRUD cargas, selectores modo/target, punto P
 */

import { state, MAX_CARGAS, HALO_PALETTE } from './state.js';
import { cam, S }                          from './camera.js';
import { formatQ, formatDist, formatF }    from './formatters.js';
import { renderForceTable }                from './renderer.js';
import { renderMathPanel }                 from './mathPanel.js';

// ── Helpers ─────────────────────────────────────────────────────────────────
export function ensureValidTarget() {
  const { targetType, cargas, targetId } = state;
  if (targetType === 'charge') {
    if (!cargas.find(c => c.id === targetId)) {
      state.targetId = cargas[0]?.id ?? null;
    }
  }
}

// ── Modo ────────────────────────────────────────────────────────────────────
export function setMode(m) {
  state.mode = m;
  document.querySelectorAll('[data-mode-btn]').forEach(b => {
    b.classList.toggle('active', b.dataset.modeBtn === m);
  });
  // En modo fuerza, target debe ser una carga (no punto)
  if (m === 'force' && state.targetType === 'point') {
    state.targetType = 'charge';
    ensureValidTarget();
  }
  actualizarLista();
  renderMathPanel();
}

// ── Target ──────────────────────────────────────────────────────────────────
export function setTarget(type, id = null) {
  state.targetType = type;
  if (type === 'charge') state.targetId = id;
  // Forzar modo campo si target es punto
  if (type === 'point' && state.mode === 'force') {
    state.mode = 'efield';
    document.querySelectorAll('[data-mode-btn]').forEach(b => {
      b.classList.toggle('active', b.dataset.modeBtn === 'efield');
    });
  }
  actualizarLista();
  renderMathPanel();
}

// ── CRUD cargas ─────────────────────────────────────────────────────────────
export function agregarCarga() {
  if (state.cargas.length >= MAX_CARGAS) {
    flash(`Máximo ${MAX_CARGAS} cargas.`);
    return;
  }
  const v = parseFloat(document.getElementById('valorCarga').value) || 1e-6;
  const t = document.getElementById('tipoCarga').value;
  const q = t === 'negativa' ? -Math.abs(v) : Math.abs(v);
  const n = state.cargas.length;
  // Posicionamiento: en círculo
  const angle = n * (2 * Math.PI / 4) + Math.PI / 6;
  const radius = n === 0 ? 0 : 1.4;
  const wx = Math.cos(angle) * radius;
  const wy = Math.sin(angle) * radius;
  const carga = { wx, wy, valor: q, tipo: t, id: Date.now() + n };
  state.cargas.push(carga);
  // Target por defecto = primera carga
  if (state.targetType === 'charge' && state.targetId === null) {
    state.targetId = carga.id;
  }
  actualizarLista();
  renderMathPanel();
}

export function eliminarCarga(id) {
  state.cargas = state.cargas.filter(c => c.id !== id);
  ensureValidTarget();
  actualizarLista();
  renderMathPanel();
}

export function limpiar(canvas, ctx) {
  state.cargas = [];
  state.targetId = null;
  actualizarLista();
  renderMathPanel();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

export function onEditField(id, field, rawVal) {
  const c = state.cargas.find(c => c.id === id);
  if (!c) return;
  const val = parseFloat(rawVal);
  if (isNaN(val)) return;
  if (field === 'wx')    c.wx = val;
  if (field === 'wy')    c.wy = val;
  if (field === 'valor') c.valor = c.tipo === 'negativa' ? -Math.abs(val) : Math.abs(val);
  actualizarListaSilent();
  renderMathPanel();
}

// ── Punto P ─────────────────────────────────────────────────────────────────
export function onEditPointP(field, rawVal) {
  const val = parseFloat(rawVal);
  if (isNaN(val)) return;
  state.pointP[field] = val;
  renderMathPanel();
}

// ── Lista de cargas ─────────────────────────────────────────────────────────
export function actualizarLista() {
  document.getElementById('numCargas').textContent = `${state.cargas.length}/${MAX_CARGAS}`;
  const btnAdd = document.getElementById('btnAgregarCarga');
  if (btnAdd) {
    btnAdd.disabled = state.cargas.length >= MAX_CARGAS;
    btnAdd.classList.toggle('disabled', state.cargas.length >= MAX_CARGAS);
  }

  const cont = document.getElementById('listaCargas');
  cont.innerHTML = '';

  state.cargas.forEach((c, i) => {
    const halo = HALO_PALETTE[i];
    const isTarget = state.targetType === 'charge' && c.id === state.targetId;
    const isDrag   = state.dragging?.charge === c;
    const div = document.createElement('div');
    div.className = 'charge-item' + (isTarget ? ' is-target' : '') + (isDrag ? ' drag-active' : '');
    div.style.setProperty('--halo', halo);
    div.innerHTML = `
      <div class="charge-header">
        <button class="target-pick" data-target-id="${c.id}"
                title="Establecer como objetivo">
          <span class="charge-dot" style="background:${halo};box-shadow:0 0 6px ${halo}80"></span>
        </button>
        <span class="charge-name">Q${i+1}</span>
        <span class="charge-sign ${c.tipo}">${c.tipo === 'positiva' ? '+' : '−'}</span>
        <span class="charge-qval">${formatQ(c.valor)}</span>
        ${isTarget ? '<span class="target-badge">TARGET</span>' : ''}
        <button class="charge-del" data-id="${c.id}" title="Eliminar">✕</button>
      </div>
      <div class="charge-fields">
        <div>
          <label>x (m)</label>
          <input type="number" data-id="${c.id}" data-field="wx" step="any" value="${c.wx.toPrecision(5)}">
        </div>
        <div>
          <label>y (m)</label>
          <input type="number" data-id="${c.id}" data-field="wy" step="any" value="${c.wy.toPrecision(5)}">
        </div>
        <div class="full">
          <label>|q| (C)</label>
          <input type="number" data-id="${c.id}" data-field="valor" step="any" value="${Math.abs(c.valor)}">
        </div>
      </div>`;
    cont.appendChild(div);
  });

  // Sección punto P (visible solo en modo campo)
  const pSection = document.getElementById('pointPSection');
  if (pSection) {
    pSection.style.display = state.mode === 'efield' ? 'block' : 'none';
    const isP = state.targetType === 'point';
    pSection.querySelector('.point-card').classList.toggle('is-target', isP);
    pSection.querySelector('[data-px]').value = state.pointP.wx.toPrecision(5);
    pSection.querySelector('[data-py]').value = state.pointP.wy.toPrecision(5);
  }

  renderForceTable(state.cargas);
}

// Actualización silenciosa: sólo valores numéricos (no reconstruye DOM)
export function actualizarListaSilent() {
  document.querySelectorAll('#listaCargas .charge-item').forEach((item, i) => {
    const c = state.cargas[i]; if (!c) return;
    const focused = document.activeElement;
    item.querySelectorAll('input[data-field]').forEach(inp => {
      if (inp === focused) return;
      if (inp.dataset.field === 'wx')    inp.value = c.wx.toPrecision(5);
      if (inp.dataset.field === 'wy')    inp.value = c.wy.toPrecision(5);
      if (inp.dataset.field === 'valor') inp.value = Math.abs(c.valor);
    });
  });
  const pSection = document.getElementById('pointPSection');
  if (pSection && state.mode === 'efield') {
    const focused = document.activeElement;
    const px = pSection.querySelector('[data-px]');
    const py = pSection.querySelector('[data-py]');
    if (px && px !== focused) px.value = state.pointP.wx.toPrecision(5);
    if (py && py !== focused) py.value = state.pointP.wy.toPrecision(5);
  }
  renderForceTable(state.cargas);
}

// ── HUD de zoom ─────────────────────────────────────────────────────────────
export function updateZoomHUD() {
  const el = document.getElementById('zoomLevel');
  if (!el) return;
  const z = cam.zoom;
  el.textContent = z >= 100 ? z.toFixed(0) + '×' : z >= 1 ? z.toFixed(2) + '×' : z.toPrecision(2) + '×';
  const si = document.getElementById('sinfo');
  if (si) si.textContent = formatDist(100 / S()) + '/100px';
}

export function setHint(txt, on) {
  const el = document.getElementById('dragHint');
  if (!el) return;
  el.textContent = txt;
  el.classList.toggle('active-drag', on);
}

function flash(msg) {
  const el = document.getElementById('dragHint');
  if (!el) return;
  const prev = el.textContent;
  el.textContent = msg;
  el.classList.add('flash-warn');
  setTimeout(() => { el.textContent = prev; el.classList.remove('flash-warn'); }, 1800);
}
