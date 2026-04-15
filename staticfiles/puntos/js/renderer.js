/**
 * renderer.js — Todas las funciones de dibujo en Canvas
 * Importa de: physics, camera, state, formatters
 */

import { netForce, netElectricField, pairForce } from './physics.js';
import { cam, S, w2s, BASE_SCALE }               from './camera.js';
import { state }                                  from './state.js';
import { formatQ, formatDist, formatE, niceNum }  from './formatters.js';

// ── Polyfill roundRect ────────────────────────────────────────────────────────
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    this.moveTo(x + r, y);
    this.lineTo(x + w - r, y);  this.arcTo(x + w, y,   x + w, y + r,   r);
    this.lineTo(x + w, y + h - r); this.arcTo(x + w, y + h, x + w - r, y + h, r);
    this.lineTo(x + r, y + h);  this.arcTo(x,   y + h, x,   y + h - r, r);
    this.lineTo(x, y + r);      this.arcTo(x,   y,     x + r, y,       r);
    this.closePath();
  };
}

// ── Colormap logarítmico para magnitudes de campo ────────────────────────────
// Retorna un color CSS interpolando entre azul (débil) → cian → amarillo (fuerte)
function fieldColor(logFrac) {
  // logFrac ∈ [0,1]
  const f = Math.max(0, Math.min(1, logFrac));
  let r, g, b;
  if (f < 0.33) {
    const t = f / 0.33;
    r = Math.round(30  + t * 0);
    g = Math.round(80  + t * 120);
    b = Math.round(220 - t * 20);
  } else if (f < 0.66) {
    const t = (f - 0.33) / 0.33;
    r = Math.round(30  + t * 220);
    g = Math.round(200 - t * 30);
    b = Math.round(200 - t * 180);
  } else {
    const t = (f - 0.66) / 0.34;
    r = 250;
    g = Math.round(170 - t * 100);
    b = Math.round(20  - t * 10);
  }
  return `rgb(${r},${g},${b})`;
}

// ── Flecha genérica ───────────────────────────────────────────────────────────
export function drawArrow(ctx, x1, y1, x2, y2, col, lineWidth = 2.5, headSize = 10) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  ctx.save();
  ctx.strokeStyle = ctx.fillStyle = col;
  ctx.lineWidth = lineWidth;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - headSize * Math.cos(a - 0.38), y2 - headSize * Math.sin(a - 0.38));
  ctx.lineTo(x2 - headSize * Math.cos(a + 0.38), y2 - headSize * Math.sin(a + 0.38));
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

// ── Cuadrícula adaptativa ─────────────────────────────────────────────────────
export function drawGrid(ctx, canvas) {
  const s = S();
  let ws = 60 / s;
  const mg = Math.pow(10, Math.floor(Math.log10(ws || 1)));
  const n  = ws / (mg || 1);
  ws = n < 1.5 ? mg : n < 3.5 ? 2 * mg : n < 7.5 ? 5 * mg : 10 * mg;
  const ss = ws * s;

  ctx.save();
  ctx.font = '9px Segoe UI';

  for (let x = cam.panX % ss - ss; x < canvas.width + ss; x += ss) {
    const wx  = (x - cam.panX) / s;
    const isO = Math.abs(wx) < ws * 0.01;
    ctx.strokeStyle = isO ? 'rgba(130,120,220,0.22)' : 'rgba(80,80,160,0.07)';
    ctx.lineWidth   = isO ? 1.5 : 1;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    if (ss > 26 && !isO) {
      ctx.fillStyle   = 'rgba(80,80,140,0.5)';
      ctx.textAlign   = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(niceNum(wx), x, 4);
    }
  }
  for (let y = cam.panY % ss - ss; y < canvas.height + ss; y += ss) {
    const wy  = -(y - cam.panY) / s;
    const isO = Math.abs(wy) < ws * 0.01;
    ctx.strokeStyle = isO ? 'rgba(130,120,220,0.22)' : 'rgba(80,80,160,0.07)';
    ctx.lineWidth   = isO ? 1.5 : 1;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    if (ss > 26 && !isO) {
      ctx.fillStyle   = 'rgba(80,80,140,0.5)';
      ctx.textAlign   = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(niceNum(wy), 4, y);
    }
  }
  ctx.fillStyle   = 'rgba(60,60,110,0.6)';
  ctx.font        = '8px Segoe UI';
  ctx.textAlign   = 'right'; ctx.textBaseline = 'bottom';
  ctx.fillText('[m]', canvas.width - 4, canvas.height - 4);
  ctx.restore();
}

// ── Ejes cartesianos desde q1 ────────────────────────────────────────────────
export function drawAxesQ1(ctx, canvas) {
  const { cargas } = state;
  if (cargas.length === 0) return;
  const o  = w2s(cargas[0].wx, cargas[0].wy);
  const ex = Math.max(canvas.width, canvas.height) * 1.6;
  ctx.save();
  ctx.lineWidth = 1.2; ctx.setLineDash([8, 6]);
  ctx.strokeStyle = 'rgba(239,80,80,0.4)';
  ctx.beginPath(); ctx.moveTo(o.x - ex, o.y); ctx.lineTo(o.x + ex, o.y); ctx.stroke();
  ctx.strokeStyle = 'rgba(80,210,80,0.4)';
  ctx.beginPath(); ctx.moveTo(o.x, o.y - ex); ctx.lineTo(o.x, o.y + ex); ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = 'bold 11px Segoe UI';
  ctx.fillStyle = 'rgba(239,100,100,0.75)'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
  ctx.fillText('+X', o.x + 16, o.y - 4);
  ctx.fillStyle = 'rgba(80,210,80,0.75)';
  ctx.fillText('+Y', o.x + 6, o.y - 20);
  ctx.strokeStyle = 'rgba(130,100,220,0.3)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(o.x, o.y, 24, 0, 2 * Math.PI); ctx.stroke();
  ctx.restore();
}

// ── Visualización de ángulos (proyecciones, sector, etiquetas) ───────────────
export function drawAngleViz(ctx) {
  const { cargas } = state;
  if (cargas.length < 2) return;
  const q1 = cargas[0], oS = w2s(q1.wx, q1.wy), s = S();

  cargas.forEach((c, i) => {
    if (i === 0) return;
    const cS  = w2s(c.wx, c.wy);
    const dx  = c.wx - q1.wx, dy = c.wy - q1.wy;
    const dist = Math.hypot(dx, dy);
    if (dist < 1e-14) return;
    const angle = ((Math.atan2(dy, dx) * 180 / Math.PI) + 360) % 360;
    const dPx  = dist * s;
    const arcR = Math.min(dPx * 0.32, 58);
    const endA = -angle * Math.PI / 180;
    ctx.save();

    // Proyecciones
    const crnS = w2s(c.wx, q1.wy);
    ctx.lineWidth = 1.3; ctx.setLineDash([5, 4]);
    ctx.strokeStyle = 'rgba(239,100,100,0.5)';
    ctx.beginPath(); ctx.moveTo(oS.x, oS.y); ctx.lineTo(crnS.x, crnS.y); ctx.stroke();
    ctx.strokeStyle = 'rgba(80,210,80,0.5)';
    ctx.beginPath(); ctx.moveTo(crnS.x, crnS.y); ctx.lineTo(cS.x, cS.y); ctx.stroke();
    ctx.setLineDash([]);

    // Cuadro ángulo recto
    const sz  = Math.max(4, Math.min(12, dPx * 0.055));
    const sgX = dx >= 0 ? -1 : 1, sgY = dy >= 0 ? -1 : 1;
    ctx.strokeStyle = 'rgba(200,190,80,0.55)'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(crnS.x + sgX * sz, crnS.y);
    ctx.lineTo(crnS.x + sgX * sz, crnS.y + sgY * sz);
    ctx.lineTo(crnS.x,            crnS.y + sgY * sz);
    ctx.stroke();

    // Sector ángulo
    if (arcR > 5 && angle > 0.02 && angle < 359.98) {
      ctx.beginPath();
      ctx.moveTo(oS.x, oS.y);
      ctx.arc(oS.x, oS.y, arcR, 0, endA, true);
      ctx.closePath();
      ctx.fillStyle = 'rgba(250,204,21,0.09)'; ctx.fill();
      ctx.beginPath();
      ctx.arc(oS.x, oS.y, arcR, 0, endA, true);
      ctx.strokeStyle = 'rgba(250,204,21,0.85)'; ctx.lineWidth = 1.8; ctx.stroke();
      ctx.strokeStyle = 'rgba(250,204,21,0.38)'; ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(oS.x + arcR - 5, oS.y); ctx.lineTo(oS.x + arcR + 5, oS.y); ctx.stroke();
    }

    // Etiqueta ángulo
    if (arcR > 4) {
      const midR = (angle / 2) * Math.PI / 180;
      const lr   = arcR + (arcR < 28 ? 17 : 21);
      const lx   = oS.x + lr * Math.cos(midR);
      const ly   = oS.y - lr * Math.sin(midR);
      ctx.font   = 'bold 11px Segoe UI';
      const txt  = angle.toFixed(2) + '°', tw = ctx.measureText(txt).width;
      ctx.beginPath();
      ctx.roundRect(lx - tw / 2 - 5, ly - 8, tw + 10, 16, 4);
      ctx.fillStyle = 'rgba(10,10,26,0.85)'; ctx.fill();
      ctx.strokeStyle = 'rgba(250,204,21,0.3)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#facc15';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(txt, lx, ly);
    }

    // Etiquetas Δx y Δy
    if (dPx > 38) {
      ctx.font = '9.5px Segoe UI'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(239,150,150,0.92)'; ctx.textAlign = 'center';
      ctx.fillText('Δx=' + formatDist(dx), (oS.x + crnS.x) / 2, oS.y + (dy >= 0 ? -11 : 12));
      ctx.fillStyle = 'rgba(130,230,130,0.92)';
      ctx.textAlign = dx >= 0 ? 'left' : 'right';
      ctx.fillText('Δy=' + formatDist(dy), crnS.x + (dx >= 0 ? 7 : -7), (crnS.y + cS.y) / 2);
    }

    // Distancia directa
    if (dPx > 60) {
      const ar = angle * Math.PI / 180;
      const px = (oS.x + cS.x) / 2 + 11 * Math.sin(ar);
      const py = (oS.y + cS.y) / 2 + 11 * Math.cos(ar);
      ctx.font = 'bold 9px Segoe UI';
      ctx.fillStyle = 'rgba(180,180,255,0.72)';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('r=' + formatDist(dist), px, py);
    }
    ctx.restore();
  });
}

// ── Líneas de conexión entre pares ───────────────────────────────────────────
export function drawConnections(ctx) {
  const { cargas } = state;
  for (let i = 0; i < cargas.length; i++) {
    for (let j = i + 1; j < cargas.length; j++) {
      const a    = w2s(cargas[i].wx, cargas[i].wy);
      const b    = w2s(cargas[j].wx, cargas[j].wy);
      const same = cargas[i].tipo === cargas[j].tipo;
      ctx.save();
      ctx.setLineDash([4, 5]);
      ctx.strokeStyle = same ? 'rgba(239,68,68,0.2)' : 'rgba(52,211,153,0.2)';
      ctx.lineWidth   = 1.5;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.restore();
    }
  }
}

// ── Círculos de carga ────────────────────────────────────────────────────────
export function drawCharges(ctx) {
  const { cargas, dragging } = state;
  cargas.forEach((c, i) => {
    const sp  = w2s(c.wx, c.wy);
    const col = c.tipo === 'positiva' ? '#ef4444' : '#3b82f6';
    const glow= c.tipo === 'positiva' ? 'rgba(239,68,68,0.38)' : 'rgba(59,130,246,0.38)';
    const drag = dragging?.charge === c, r = drag ? 17 : 14;
    const g = ctx.createRadialGradient(sp.x, sp.y, r * .3, sp.x, sp.y, 33);
    g.addColorStop(0, glow); g.addColorStop(1, 'transparent');
    ctx.beginPath(); ctx.arc(sp.x, sp.y, 33, 0, 2 * Math.PI);
    ctx.fillStyle = g; ctx.fill();
    ctx.beginPath(); ctx.arc(sp.x, sp.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = col;
    if (drag) { ctx.shadowColor = col; ctx.shadowBlur = 22; }
    ctx.fill(); ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = 'white';
    ctx.font = `bold ${drag ? 15 : 13}px Segoe UI`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(c.tipo === 'positiva' ? '+' : '−', sp.x, sp.y);
    ctx.font      = 'bold 11px Segoe UI';
    ctx.fillStyle = drag ? '#a78bfa' : '#c0c0e0';
    ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.fillText('q' + (i + 1), sp.x + r + 4, sp.y);
    ctx.font      = '9px Segoe UI'; ctx.fillStyle = '#606090';
    ctx.textBaseline = 'top';
    ctx.fillText(formatQ(c.valor), sp.x + r + 4, sp.y + 1);
  });
}

// ── Flechas de fuerza resultante sobre cada carga ────────────────────────────
export function drawForceArrows(ctx) {
  const { cargas } = state;
  cargas.forEach(ci => {
    const { fx, fy, mag } = netForce(cargas, ci);
    if (mag < 1e-30) return;
    const len = Math.min(65, Math.max(22, 28 + Math.log10(mag + 1) * 9));
    const nx  = fx / mag, ny = fy / mag;
    const sp  = w2s(ci.wx, ci.wy);
    drawArrow(ctx,
      sp.x + nx * 19,         sp.y - ny * 19,
      sp.x + nx * (19 + len), sp.y - ny * (19 + len),
      '#facc15');
  });
}

// ── Campo eléctrico: cuadrícula de flechas ───────────────────────────────────
export function drawElectricFieldGrid(ctx, canvas) {
  const { cargas } = state;
  if (cargas.length === 0) return;

  const s     = S();
  const cols  = Math.ceil(canvas.width  / 52) + 1;
  const rows  = Math.ceil(canvas.height / 52) + 1;
  const stepX = canvas.width  / cols;
  const stepY = canvas.height / rows;

  // Rango logarítmico para normalizar colores
  let logMin = Infinity, logMax = -Infinity;
  const samples = [];

  for (let row = 0; row <= rows; row++) {
    for (let col = 0; col <= cols; col++) {
      const sx = col * stepX;
      const sy = row * stepY;
      const { wx, wy } = { wx: (sx - cam.panX) / s, wy: -(sy - cam.panY) / s };

      // Saltar puntos muy cercanos a las cargas
      const tooClose = cargas.some(c => Math.hypot(wx - c.wx, wy - c.wy) < 0.15 / (s / BASE_SCALE));
      if (tooClose) { samples.push(null); continue; }

      const { ex, ey, mag } = netElectricField(cargas, wx, wy);
      if (mag < 1e-10) { samples.push(null); continue; }
      const logM = Math.log10(mag + 1);
      if (logM < logMin) logMin = logM;
      if (logM > logMax) logMax = logM;
      samples.push({ sx, sy, ex, ey, mag, logM });
    }
  }

  const logRange = (logMax - logMin) || 1;

  for (const s_ of samples) {
    if (!s_) continue;
    const { sx, sy, ex, ey, mag, logM } = s_;
    const frac  = (logM - logMin) / logRange;
    const color = fieldColor(frac);
    const nx    = ex / mag, ny = ey / mag;
    // Longitud de flecha: 10..22 px según magnitud
    const len   = 10 + frac * 12;
    const x1    = sx - nx * len * 0.4;
    const y1    = sy + ny * len * 0.4;
    const x2    = sx + nx * len * 0.6;
    const y2    = sy - ny * len * 0.6;
    drawArrow(ctx, x1, y1, x2, y2, color, 1.3, 5);
  }

  // Leyenda
  _drawEFieldLegend(ctx, canvas, logMin, logMax);
}

function _drawEFieldLegend(ctx, canvas, logMin, logMax) {
  const W = 110, H = 14, x0 = canvas.width - W - 12, y0 = canvas.height - 40;
  const grad = ctx.createLinearGradient(x0, 0, x0 + W, 0);
  grad.addColorStop(0,    fieldColor(0));
  grad.addColorStop(0.5,  fieldColor(0.5));
  grad.addColorStop(1,    fieldColor(1));
  ctx.save();
  ctx.fillStyle   = 'rgba(10,10,30,0.7)';
  ctx.fillRect(x0 - 6, y0 - 16, W + 18, H + 26);
  ctx.fillStyle = grad;
  ctx.fillRect(x0, y0, W, H);
  ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1;
  ctx.strokeRect(x0, y0, W, H);
  ctx.fillStyle = 'rgba(180,180,220,0.7)'; ctx.font = '8px Segoe UI';
  ctx.textAlign = 'left';  ctx.textBaseline = 'top';
  ctx.fillText(formatE(Math.pow(10, logMin)), x0, y0 + H + 3);
  ctx.textAlign = 'right';
  ctx.fillText(formatE(Math.pow(10, logMax)), x0 + W, y0 + H + 3);
  ctx.fillStyle = 'rgba(180,180,220,0.5)'; ctx.font = '7px Segoe UI';
  ctx.textAlign = 'center';
  ctx.fillText('|E| N/C', x0 + W / 2, y0 - 12);
  ctx.restore();
}

// ── Líneas de campo eléctrico (trazado por integración de Euler) ─────────────
export function drawFieldLines(ctx, canvas) {
  const { cargas } = state;
  if (cargas.length === 0) return;

  const s       = S();
  const N_LINES = 12;       // líneas por carga positiva
  const MAX_STEPS = 600;
  const DT_BASE   = 0.8 / (s || 1); // paso en metros

  const positives = cargas.filter(c => c.tipo === 'positiva');

  for (const src of positives) {
    for (let k = 0; k < N_LINES; k++) {
      const theta = (2 * Math.PI * k) / N_LINES;
      // Punto de inicio ligeramente fuera de la carga
      const startDist = 0.18 / (s / BASE_SCALE);
      let px = src.wx + startDist * Math.cos(theta);
      let py = src.wy + startDist * Math.sin(theta);

      ctx.save();
      ctx.strokeStyle = 'rgba(250,204,21,0.35)';
      ctx.lineWidth   = 1;
      ctx.setLineDash([]);
      ctx.beginPath();
      const pScreen = w2s(px, py);
      ctx.moveTo(pScreen.x, pScreen.y);

      for (let step = 0; step < MAX_STEPS; step++) {
        const { ex, ey, mag } = netElectricField(cargas, px, py);
        if (mag < 1e-10) break;

        const nx = ex / mag, ny = ey / mag;
        const dt = DT_BASE * Math.max(0.5, Math.min(3, mag < 1 ? 1 : Math.log10(mag)));
        px += nx * dt;
        py += ny * dt;

        const sc = w2s(px, py);
        // Salir si fuera de pantalla con margen
        if (sc.x < -80 || sc.x > canvas.width + 80 ||
            sc.y < -80 || sc.y > canvas.height + 80) break;

        ctx.lineTo(sc.x, sc.y);

        // Terminar si llegamos cerca de una carga negativa
        const hitNeg = cargas.some(c => c.tipo === 'negativa' &&
          Math.hypot(px - c.wx, py - c.wy) < 0.12 / (s / BASE_SCALE));
        if (hitNeg) break;
      }
      ctx.stroke();
      ctx.restore();
    }
  }
}

// ── Tabla de fuerzas entre pares ─────────────────────────────────────────────
export function renderForceTable(cargas) {
  const cont = document.getElementById('resultados');
  if (cargas.length < 2) {
    cont.innerHTML = '<p style="color:#303060;font-size:.72rem">Coloca al menos 2 cargas.</p>';
    return;
  }
  let rows = '';
  for (let i = 0; i < cargas.length; i++) {
    for (let j = i + 1; j < cargas.length; j++) {
      const res = pairForce(cargas[i], cargas[j]);
      if (!res) continue;
      const { F, r, ang, attraction } = res;
      const typ = attraction
        ? '<span class="tag-atr">Atracción</span>'
        : '<span class="tag-rep">Repulsión</span>';
      rows += `<tr>
        <td>q${i+1}–q${j+1}</td>
        <td>${formatDist(r)}</td>
        <td>${ang.toFixed(2)}°</td>
        <td>${F.toExponential(3)} N</td>
        <td>${typ}</td></tr>`;
    }
  }
  cont.innerHTML = `
    <table class="result-table">
      <thead><tr><th>Par</th><th>Dist.</th><th>Ángulo</th><th>Fuerza</th><th>Tipo</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ── Tabla de campo eléctrico en la posición de cada carga ────────────────────
export function renderEFieldTable(cargas) {
  const cont = document.getElementById('resultados-efield');
  if (!cont) return;
  if (cargas.length === 0) {
    cont.innerHTML = '<p style="color:#303060;font-size:.72rem">Sin cargas.</p>';
    return;
  }
  let rows = '';
  cargas.forEach((c, i) => {
    // Campo por las demás cargas en la posición de ci
    const others = cargas.filter(x => x !== c);
    if (others.length === 0) return;
    const { ex, ey, mag } = netElectricField(others, c.wx, c.wy);
    const ang = ((Math.atan2(ey, ex) * 180 / Math.PI) + 360) % 360;
    rows += `<tr>
      <td>q${i+1}</td>
      <td>${formatE(mag)}</td>
      <td>${ang.toFixed(2)}°</td>
      <td>${formatE(ex)}</td>
      <td>${formatE(ey)}</td></tr>`;
  });
  if (!rows) { cont.innerHTML = '<p style="color:#303060;font-size:.72rem">Agrega otra carga.</p>'; return; }
  cont.innerHTML = `
    <table class="result-table">
      <thead><tr><th>Sobre</th><th>|E|</th><th>Ángulo</th><th>Ex</th><th>Ey</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}
