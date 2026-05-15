/**
 * mathPanel.js — Renderiza fórmula, sustitución numérica y resultado.
 * Se actualiza en cada frame según mode + target.
 */

import { state, HALO_PALETTE }       from './state.js';
import { netForce, netElectricField,
         K }                          from './physics.js';
import { formatQ, formatDist,
         formatE, formatF }           from './formatters.js';
import { triangleAngles, quadGeometry,
         rightTriangleAux, dist }     from './geometry.js';

const fmtSci = v => (v === 0 ? '0' : v.toExponential(3).replace('e+', '×10^').replace('e-', '×10^−'));

function chargeLabel(i) { return `q<sub>${i+1}</sub>`; }

function targetInfo() {
  const { targetType, cargas, targetId, pointP } = state;
  if (targetType === 'point') {
    return { isPoint: true, point: pointP, label: 'P', wx: pointP.wx, wy: pointP.wy };
  }
  const idx = cargas.findIndex(c => c.id === targetId);
  if (idx < 0) return null;
  const c = cargas[idx];
  return { isPoint: false, charge: c, idx, label: `q<sub>${idx+1}</sub>`, wx: c.wx, wy: c.wy };
}

// ── Render principal ────────────────────────────────────────────────────────
export function renderMathPanel() {
  const cont = document.getElementById('mathPanel');
  if (!cont) return;
  const { mode, cargas } = state;
  const t = targetInfo();

  if (cargas.length < 1) {
    cont.innerHTML = empty('Agrega al menos 1 carga.');
    return;
  }
  if (mode === 'force') return renderForce(cont, t);
  if (mode === 'efield') return renderEField(cont, t);
}

function empty(msg) {
  return `<div class="math-empty">${msg}</div>`;
}

// ── Modo fuerza ──────────────────────────────────────────────────────────────
function renderForce(cont, t) {
  const { cargas } = state;
  if (!t || t.isPoint) {
    cont.innerHTML = empty('Selecciona una <b>carga</b> objetivo para calcular la fuerza neta.');
    return;
  }
  if (cargas.length < 2) {
    cont.innerHTML = empty('Agrega otra carga para calcular la fuerza.');
    return;
  }
  const target = t.charge;
  const res = netForce(cargas, target);

  let parts = '';
  res.parts.forEach((p, k) => {
    const sIdx = cargas.indexOf(p.source);
    parts += `
      <div class="math-step">
        <div class="step-head">
          <span class="step-dot" style="background:${HALO_PALETTE[sIdx]}"></span>
          F<sub>${sIdx+1}→${t.idx+1}</sub>
          <span class="step-type ${p.attraction ? 'atr':'rep'}">${p.attraction ? 'atrae':'repele'}</span>
        </div>
        <div class="step-formula">F = k · |q<sub>${sIdx+1}</sub>·${chargeLabel(t.idx)}| / r²</div>
        <div class="step-subst">
          = (8.99×10⁹) · |${fmtSci(p.source.valor)} · ${fmtSci(target.valor)}| / (${p.r.toPrecision(4)})²
        </div>
        <div class="step-result">
          |F| = <b>${formatF(p.F)}</b> · θ = ${p.ang.toFixed(2)}°<br>
          F<sub>x</sub> = ${formatF(p.fx)} &nbsp; F<sub>y</sub> = ${formatF(p.fy)}
        </div>
      </div>`;
  });

  cont.innerHTML = `
    <div class="math-head">
      <span class="math-title">Fuerza neta sobre ${t.label}</span>
      <span class="math-sub">superposición vectorial</span>
    </div>
    ${parts}
    <div class="math-total force">
      <div class="total-row">ΣF<sub>x</sub> = <b>${formatF(res.fx)}</b></div>
      <div class="total-row">ΣF<sub>y</sub> = <b>${formatF(res.fy)}</b></div>
      <div class="total-row big">|F<sub>neta</sub>| = <b>${formatF(res.mag)}</b></div>
      <div class="total-row">θ = <b>${res.ang.toFixed(2)}°</b></div>
    </div>
    ${renderGeomBlock()}
  `;
}

// ── Modo campo eléctrico ─────────────────────────────────────────────────────
function renderEField(cont, t) {
  const { cargas } = state;
  if (!t) {
    cont.innerHTML = empty('Selecciona target (carga o punto P).');
    return;
  }
  const px = t.wx, py = t.wy;
  // Si target es carga, excluirla (no se calcula campo sobre sí misma)
  const sources = t.isPoint ? cargas : cargas.filter(c => c !== t.charge);
  if (sources.length === 0) {
    cont.innerHTML = empty('Necesitas al menos una carga fuente.');
    return;
  }
  const res = netElectricField(sources, px, py);

  let parts = '';
  res.parts.forEach(p => {
    const sIdx = cargas.indexOf(p.source);
    const sign = p.source.valor >= 0 ? 'aleja de' : 'apunta hacia';
    parts += `
      <div class="math-step">
        <div class="step-head">
          <span class="step-dot" style="background:${HALO_PALETTE[sIdx]}"></span>
          E<sub>${sIdx+1}</sub>
          <span class="step-type ${p.source.valor>=0?'rep':'atr'}">${sign} q<sub>${sIdx+1}</sub></span>
        </div>
        <div class="step-formula">E = k · q<sub>${sIdx+1}</sub> / r²</div>
        <div class="step-subst">
          = (8.99×10⁹) · ${fmtSci(p.source.valor)} / (${p.r.toPrecision(4)})²
        </div>
        <div class="step-result">
          |E| = <b>${formatE(p.Emag)}</b> · θ = ${p.ang.toFixed(2)}°<br>
          E<sub>x</sub> = ${formatE(p.ex)} &nbsp; E<sub>y</sub> = ${formatE(p.ey)}
        </div>
      </div>`;
  });

  cont.innerHTML = `
    <div class="math-head">
      <span class="math-title">Campo eléctrico en ${t.label}</span>
      <span class="math-sub">${t.isPoint
          ? `P = (${px.toPrecision(4)}, ${py.toPrecision(4)}) m`
          : 'sobre carga objetivo'}</span>
    </div>
    ${parts}
    <div class="math-total efield">
      <div class="total-row">ΣE<sub>x</sub> = <b>${formatE(res.ex)}</b></div>
      <div class="total-row">ΣE<sub>y</sub> = <b>${formatE(res.ey)}</b></div>
      <div class="total-row big">|E<sub>neto</sub>| = <b>${formatE(res.mag)}</b></div>
      <div class="total-row">θ = <b>${res.ang.toFixed(2)}°</b></div>
    </div>
    ${renderGeomBlock()}
  `;
}

// ── Bloque geométrico (distancias + ángulos) ────────────────────────────────
function renderGeomBlock() {
  const { cargas } = state;
  if (cargas.length === 2) {
    const tri = rightTriangleAux(cargas[0], cargas[1]);
    if (!tri) return '';
    return `
      <div class="math-geom">
        <div class="geom-title">Geometría · triángulo rectángulo auxiliar</div>
        <div class="geom-row">
          <span>r = ${formatDist(tri.r)}</span>
          <span>|Δx| = ${formatDist(Math.abs(tri.dx))}</span>
          <span>|Δy| = ${formatDist(Math.abs(tri.dy))}</span>
        </div>
        <div class="geom-row">
          <span>α (en q<sub>1</sub>) = ${tri.angleAtA.toFixed(2)}°</span>
          <span>β (en q<sub>2</sub>) = ${tri.angleAtB.toFixed(2)}°</span>
          <span>γ = 90°</span>
        </div>
      </div>`;
  }
  if (cargas.length === 3) {
    const tri = triangleAngles(cargas[0], cargas[1], cargas[2]);
    if (!tri) return '';
    return `
      <div class="math-geom">
        <div class="geom-title">Geometría · triángulo entre cargas</div>
        <div class="geom-row">
          <span>q<sub>1</sub>q<sub>2</sub> = ${formatDist(tri.sides.c)}</span>
          <span>q<sub>2</sub>q<sub>3</sub> = ${formatDist(tri.sides.a)}</span>
          <span>q<sub>1</sub>q<sub>3</sub> = ${formatDist(tri.sides.b)}</span>
        </div>
        <div class="geom-row">
          <span>∠q<sub>1</sub> = ${tri.angles.A.toFixed(2)}°</span>
          <span>∠q<sub>2</sub> = ${tri.angles.B.toFixed(2)}°</span>
          <span>∠q<sub>3</sub> = ${tri.angles.C.toFixed(2)}°</span>
        </div>
        <div class="geom-row sum">Σ = ${(tri.angles.A+tri.angles.B+tri.angles.C).toFixed(2)}° (180°)</div>
      </div>`;
  }
  if (cargas.length === 4) {
    const q = quadGeometry(cargas);
    if (!q) return '';
    return `
      <div class="math-geom">
        <div class="geom-title">Geometría · ${q.shape}</div>
        <div class="geom-row">
          ${q.sides.map((s,i) => `<span>L${i+1} = ${formatDist(s)}</span>`).join('')}
        </div>
        <div class="geom-row">
          ${q.angles.map((a,i) => `<span>∠${i+1} = ${a.toFixed(2)}°</span>`).join('')}
        </div>
        <div class="geom-row">
          <span>diag₁ = ${formatDist(q.diag1)}</span>
          <span>diag₂ = ${formatDist(q.diag2)}</span>
        </div>
      </div>`;
  }
  return '';
}
