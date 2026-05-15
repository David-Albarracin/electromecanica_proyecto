/**
 * renderer.js — Render del canvas: cargas, vectores, geometría auto, componentes
 * Visualización profesional. Target-céntrica (no Q1-fija).
 */

import { netForce, netElectricField,
         pairForce, forceContribution,
         efieldContribution }              from './physics.js';
import { cam, S, w2s, BASE_SCALE }         from './camera.js';
import { state, HALO_PALETTE }             from './state.js';
import { formatQ, formatDist, formatE,
         formatF, niceNum }                from './formatters.js';
import { rightTriangleAux, triangleAngles,
         quadGeometry }                    from './geometry.js';

// ── Paleta semántica ────────────────────────────────────────────────────────
const C = {
  grid:        'rgba(70,75,140,0.07)',
  gridAxis:    'rgba(130,120,220,0.20)',
  gridLabel:   'rgba(110,115,170,0.55)',
  distLine:    'rgba(140,150,200,0.32)',   // líneas distancia (tenues, auxiliares)
  distLabel:   'rgba(180,190,230,0.85)',
  triFill:     'rgba(140,160,250,0.04)',
  triStroke:   'rgba(140,160,250,0.45)',
  rectAux:     'rgba(180,180,230,0.32)',   // proyecciones X/Y
  forceArrow:  '#facc15',                  // amarillo
  forceGlow:   'rgba(250,204,21,0.35)',
  forceCompX:  'rgba(250,180,90,0.85)',
  forceCompY:  'rgba(250,220,120,0.85)',
  efieldArrow: '#22d3ee',                  // cian
  efieldGlow:  'rgba(34,211,238,0.35)',
  efieldCompX: 'rgba(96,200,230,0.85)',
  efieldCompY: 'rgba(150,220,240,0.85)',
  angleArc:    '#fcd34d',
  angleArcEF:  '#67e8f9',
  angleLabel:  '#fcd34d',
  pointP:      '#f472b6',                  // rosa magenta para P
  pointPGlow:  'rgba(244,114,182,0.4)',
};

// ── Polyfill roundRect ──────────────────────────────────────────────────────
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

// ── Flecha genérica con glow ─────────────────────────────────────────────────
export function drawArrow(ctx, x1, y1, x2, y2, col, lineWidth = 2.5, headSize = 11, glow = null) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  ctx.save();
  if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 8; }
  ctx.strokeStyle = ctx.fillStyle = col;
  ctx.lineWidth = lineWidth;
  ctx.lineCap   = 'round';
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - headSize * Math.cos(a - 0.36), y2 - headSize * Math.sin(a - 0.36));
  ctx.lineTo(x2 - headSize * Math.cos(a + 0.36), y2 - headSize * Math.sin(a + 0.36));
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

// ── Etiqueta con pill (caja redondeada) ──────────────────────────────────────
function drawPill(ctx, x, y, text, color, fontSize = 10) {
  ctx.font = `bold ${fontSize}px Segoe UI`;
  const tw = ctx.measureText(text).width;
  const padX = 6, h = fontSize + 6;
  ctx.beginPath();
  ctx.roundRect(x - tw/2 - padX, y - h/2, tw + padX*2, h, 4);
  ctx.fillStyle = 'rgba(10,12,28,0.88)'; ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

// ── Cuadrícula adaptativa ────────────────────────────────────────────────────
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
    ctx.strokeStyle = isO ? C.gridAxis : C.grid;
    ctx.lineWidth   = isO ? 1.4 : 1;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    if (ss > 26 && !isO) {
      ctx.fillStyle = C.gridLabel;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(niceNum(wx), x, 4);
    }
  }
  for (let y = cam.panY % ss - ss; y < canvas.height + ss; y += ss) {
    const wy  = -(y - cam.panY) / s;
    const isO = Math.abs(wy) < ws * 0.01;
    ctx.strokeStyle = isO ? C.gridAxis : C.grid;
    ctx.lineWidth   = isO ? 1.4 : 1;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    if (ss > 26 && !isO) {
      ctx.fillStyle = C.gridLabel;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(niceNum(wy), 4, y);
    }
  }
  ctx.fillStyle = 'rgba(80,85,130,0.5)';
  ctx.font = '8px Segoe UI';
  ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
  ctx.fillText('[m]', canvas.width - 4, canvas.height - 4);
  ctx.restore();
}

// ── Target actual (carga o punto P) ──────────────────────────────────────────
function getTarget() {
  const { targetType, cargas, targetId, pointP } = state;
  if (targetType === 'point') {
    return { isPoint: true, wx: pointP.wx, wy: pointP.wy, label: 'P' };
  }
  const c = cargas.find(c => c.id === targetId);
  if (!c) return null;
  const idx = cargas.indexOf(c);
  return { isPoint: false, charge: c, idx, wx: c.wx, wy: c.wy, label: `q${idx+1}` };
}

// ── Distancias auxiliares: líneas tenues entre fuentes y target ──────────────
export function drawDistanceLines(ctx) {
  const t = getTarget();
  if (!t) return;
  const tp = w2s(t.wx, t.wy);
  const { cargas } = state;
  ctx.save();
  ctx.setLineDash([3, 5]);
  ctx.strokeStyle = C.distLine;
  ctx.lineWidth   = 1.1;
  cargas.forEach((c) => {
    if (!t.isPoint && c === t.charge) return;
    const a = w2s(c.wx, c.wy);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(tp.x, tp.y); ctx.stroke();
  });
  ctx.setLineDash([]);
  // Etiquetas r
  ctx.font = '9.5px Segoe UI';
  ctx.fillStyle = C.distLabel;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  cargas.forEach((c, i) => {
    if (!t.isPoint && c === t.charge) return;
    const a = w2s(c.wx, c.wy);
    const r = Math.hypot(c.wx - t.wx, c.wy - t.wy);
    const dPx = Math.hypot(a.x - tp.x, a.y - tp.y);
    if (dPx < 50) return;
    const mx = (a.x + tp.x) / 2, my = (a.y + tp.y) / 2;
    drawPill(ctx, mx, my, `r${i+1} = ${formatDist(r)}`, 'rgba(180,190,230,0.7)', 9);
  });
  ctx.restore();
}

// ── Triángulo entre 3 cargas (lados + 3 ángulos internos) ───────────────────
export function drawTriangle3(ctx) {
  const { cargas } = state;
  if (cargas.length !== 3) return;
  const tri = triangleAngles(cargas[0], cargas[1], cargas[2]);
  if (!tri) return;
  const p = cargas.map(c => w2s(c.wx, c.wy));
  ctx.save();
  // Relleno
  ctx.beginPath();
  ctx.moveTo(p[0].x, p[0].y);
  ctx.lineTo(p[1].x, p[1].y);
  ctx.lineTo(p[2].x, p[2].y);
  ctx.closePath();
  ctx.fillStyle = C.triFill; ctx.fill();
  ctx.strokeStyle = C.triStroke; ctx.lineWidth = 1.3;
  ctx.setLineDash([6, 4]); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // Ángulos internos en cada vértice
  const angs = [tri.angles.A, tri.angles.B, tri.angles.C];
  for (let i = 0; i < 3; i++) {
    const v = cargas[i];
    const prev = cargas[(i+2) % 3];
    const next = cargas[(i+1) % 3];
    drawAngleArcAt(ctx, v, prev, next, angs[i], C.angleArc, 28);
  }
}

// ── Arco de ángulo en vértice v entre lados v→prev y v→next ─────────────────
function drawAngleArcAt(ctx, v, prev, next, angDeg, color, baseR = 26) {
  const vs = w2s(v.wx, v.wy);
  const a1 = Math.atan2(-(prev.wy - v.wy), prev.wx - v.wx); // pantalla (Y invertido)
  const a2 = Math.atan2(-(next.wy - v.wy), next.wx - v.wx);
  // Arco va del menor al mayor (sentido más corto)
  let da = a2 - a1;
  while (da >  Math.PI) da -= 2 * Math.PI;
  while (da < -Math.PI) da += 2 * Math.PI;
  const r = baseR;
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(vs.x, vs.y, r, a1, a1 + da, da < 0);
  ctx.stroke();
  // Etiqueta en bisectriz
  const mid = a1 + da / 2;
  const lr  = r + 14;
  const lx  = vs.x + lr * Math.cos(mid);
  const ly  = vs.y + lr * Math.sin(mid);
  drawPill(ctx, lx, ly, `${angDeg.toFixed(2)}°`, color, 9.5);
  ctx.restore();
}

// ── Cuadrilátero entre 4 cargas ──────────────────────────────────────────────
export function drawQuad4(ctx) {
  const { cargas } = state;
  if (cargas.length !== 4) return;
  const q = quadGeometry(cargas);
  if (!q) return;
  const p = q.sortedVertices.map(v => w2s(v.wx, v.wy));
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(p[0].x, p[0].y);
  for (let i = 1; i < 4; i++) ctx.lineTo(p[i].x, p[i].y);
  ctx.closePath();
  ctx.fillStyle   = C.triFill; ctx.fill();
  ctx.strokeStyle = C.triStroke; ctx.lineWidth = 1.3;
  ctx.setLineDash([6, 4]); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  for (let i = 0; i < 4; i++) {
    const v = q.sortedVertices[i];
    const prev = q.sortedVertices[(i+3) % 4];
    const next = q.sortedVertices[(i+1) % 4];
    drawAngleArcAt(ctx, v, prev, next, q.angles[i], C.angleArc, 22);
  }
  // Forma
  const cx = (p[0].x+p[1].x+p[2].x+p[3].x)/4;
  const cy = (p[0].y+p[1].y+p[2].y+p[3].y)/4;
  drawPill(ctx, cx, cy, q.shape, 'rgba(180,190,255,0.7)', 9.5);
}

// ── Triángulo rectángulo auxiliar (caso 2 cargas) ────────────────────────────
export function drawAuxRightTriangle2(ctx) {
  const { cargas } = state;
  if (cargas.length !== 2) return;
  const tri = rightTriangleAux(cargas[0], cargas[1]);
  if (!tri) return;
  const a = w2s(cargas[0].wx, cargas[0].wy);
  const b = w2s(cargas[1].wx, cargas[1].wy);
  const c = w2s(tri.corner.wx, tri.corner.wy);
  ctx.save();
  ctx.setLineDash([5, 4]);
  ctx.strokeStyle = C.rectAux; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  ctx.setLineDash([]);
  // Indicador 90°
  const sz = 9;
  const sx = c.x < a.x ? sz : -sz;
  const sy = c.y < b.y ? sz : -sz;
  ctx.strokeStyle = 'rgba(200,200,140,0.55)'; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(c.x + sx, c.y);
  ctx.lineTo(c.x + sx, c.y + sy);
  ctx.lineTo(c.x,      c.y + sy);
  ctx.stroke();
  // Ángulos α en a y β en b
  drawAngleArcAt(ctx, cargas[0], cargas[1], tri.corner, tri.angleAtA, C.angleArc, 24);
  drawAngleArcAt(ctx, cargas[1], cargas[0], tri.corner, tri.angleAtB, C.angleArc, 24);
  // Etiquetas Δx Δy
  ctx.font = '10px Segoe UI'; ctx.fillStyle = 'rgba(200,210,255,0.78)';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  drawPill(ctx, (a.x + c.x)/2, a.y + (b.y > a.y ? -10 : 10),
    'Δx = ' + formatDist(Math.abs(tri.dx)), 'rgba(239,150,150,0.85)', 9);
  drawPill(ctx, c.x + (b.x > a.x ? 14 : -14), (c.y + b.y)/2,
    'Δy = ' + formatDist(Math.abs(tri.dy)), 'rgba(130,230,130,0.85)', 9);
  ctx.restore();
}

// ── Dirección pantalla del vector resultante en target (para alejar labels) ──
function targetResultantScreenDir(c) {
  const { mode, cargas, targetType, targetId } = state;
  if (targetType !== 'charge' || c.id !== targetId) return null;
  let vx = 0, vy = 0;
  if (mode === 'force') {
    const r = netForce(cargas, c);
    if (r.mag < 1e-30) return null;
    vx = r.fx; vy = r.fy;
  } else {
    const others = cargas.filter(x => x !== c);
    if (!others.length) return null;
    const r = netElectricField(others, c.wx, c.wy);
    if (r.mag < 1e-30) return null;
    vx = r.ex; vy = r.ey;
  }
  const m = Math.hypot(vx, vy);
  // Eje pantalla: y invertida
  return { sx: vx / m, sy: -vy / m };
}

// ── Cargas (con halo identificador por índice) ───────────────────────────────
export function drawCharges(ctx) {
  const { cargas, dragging, targetType, targetId } = state;
  cargas.forEach((c, i) => {
    const sp   = w2s(c.wx, c.wy);
    const col  = c.tipo === 'positiva' ? '#ef4444' : '#3b82f6';
    const halo = HALO_PALETTE[i] || '#a78bfa';
    const drag = dragging?.charge === c;
    const isTarget = targetType === 'charge' && c.id === targetId;
    const r = drag ? 17 : 14;

    // Halo identificador
    const haloR = isTarget ? 44 : 32;
    const g = ctx.createRadialGradient(sp.x, sp.y, r * 0.5, sp.x, sp.y, haloR);
    g.addColorStop(0, halo + 'aa');
    g.addColorStop(0.6, halo + '22');
    g.addColorStop(1, 'transparent');
    ctx.beginPath(); ctx.arc(sp.x, sp.y, haloR, 0, 2*Math.PI);
    ctx.fillStyle = g; ctx.fill();

    // Anillo target
    if (isTarget) {
      ctx.beginPath(); ctx.arc(sp.x, sp.y, r + 8, 0, 2*Math.PI);
      ctx.strokeStyle = halo; ctx.lineWidth = 2; ctx.setLineDash([3, 3]);
      ctx.stroke(); ctx.setLineDash([]);
    }

    // Cuerpo carga
    ctx.beginPath(); ctx.arc(sp.x, sp.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = col;
    if (drag) { ctx.shadowColor = col; ctx.shadowBlur = 22; }
    ctx.fill(); ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1.5; ctx.stroke();

    // Símbolo +/−
    ctx.fillStyle = 'white';
    ctx.font = `bold ${drag ? 16 : 14}px Segoe UI`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(c.tipo === 'positiva' ? '+' : '−', sp.x, sp.y);

    // Etiqueta Q + valor — target: pill combinada lejos del vector
    if (isTarget) {
      const dir = targetResultantScreenDir(c);
      const dx  = dir ? -dir.sx : 0.7;
      const dy  = dir ? -dir.sy : 0.7;
      const D   = r + 56;
      const lx  = sp.x + dx * D;
      const ly  = sp.y + dy * D;
      drawPill(ctx, lx, ly, `Q${i+1} · ${formatQ(c.valor)}`, halo, 10);
    } else {
      ctx.font = 'bold 11px Segoe UI';
      ctx.fillStyle = halo;
      ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
      ctx.fillText('Q' + (i + 1), sp.x + r + 5, sp.y);
      ctx.font = '9px Segoe UI'; ctx.fillStyle = '#8a8ab0';
      ctx.textBaseline = 'top';
      ctx.fillText(formatQ(c.valor), sp.x + r + 5, sp.y + 1);
    }
  });
}

// ── Punto libre P (target en modo campo) ─────────────────────────────────────
export function drawPointP(ctx) {
  const { pointP, targetType, dragging } = state;
  const sp = w2s(pointP.wx, pointP.wy);
  const isTarget = targetType === 'point';
  const drag = dragging?.type === 'point';

  ctx.save();
  // Halo si target
  if (isTarget) {
    const g = ctx.createRadialGradient(sp.x, sp.y, 4, sp.x, sp.y, 30);
    g.addColorStop(0, C.pointPGlow);
    g.addColorStop(1, 'transparent');
    ctx.beginPath(); ctx.arc(sp.x, sp.y, 30, 0, 2*Math.PI);
    ctx.fillStyle = g; ctx.fill();
  }
  // Cruz
  const sz = drag ? 10 : 8;
  ctx.strokeStyle = C.pointP;
  ctx.lineWidth   = 2.2;
  ctx.lineCap     = 'round';
  ctx.beginPath();
  ctx.moveTo(sp.x - sz, sp.y); ctx.lineTo(sp.x + sz, sp.y);
  ctx.moveTo(sp.x, sp.y - sz); ctx.lineTo(sp.x, sp.y + sz);
  ctx.stroke();
  // Círculo
  ctx.beginPath(); ctx.arc(sp.x, sp.y, drag ? 6 : 4.5, 0, 2*Math.PI);
  ctx.fillStyle = '#0a0a18'; ctx.fill();
  ctx.strokeStyle = C.pointP; ctx.lineWidth = 1.8; ctx.stroke();
  // Anillo target
  if (isTarget) {
    ctx.beginPath(); ctx.arc(sp.x, sp.y, 16, 0, 2*Math.PI);
    ctx.strokeStyle = C.pointP; ctx.setLineDash([3,3]); ctx.lineWidth = 1.5; ctx.stroke();
    ctx.setLineDash([]);
  }
  // Etiqueta
  ctx.font = 'bold 11px Segoe UI';
  ctx.fillStyle = C.pointP;
  ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
  ctx.fillText('P', sp.x + 11, sp.y - 4);
  ctx.font = '9px Segoe UI'; ctx.fillStyle = '#7a5a80';
  ctx.textBaseline = 'top';
  ctx.fillText(`(${pointP.wx.toPrecision(3)}, ${pointP.wy.toPrecision(3)})`, sp.x + 11, sp.y + 4);
  ctx.restore();
}

// ── Hit-test punto P ─────────────────────────────────────────────────────────
export function hitPointP(sx, sy) {
  const sp = w2s(state.pointP.wx, state.pointP.wy);
  return Math.hypot(sx - sp.x, sy - sp.y) <= 16;
}

// ── Vectores de aporte + resultante (modo fuerza) ────────────────────────────
function drawForceVectors(ctx) {
  const t = getTarget();
  if (!t || t.isPoint) return;
  const target = t.charge;
  const { cargas } = state;
  const res = netForce(cargas, target);
  const tp  = w2s(target.wx, target.wy);

  // Escala visual: log para que vectores grandes no salgan de canvas
  const scaleLen = m => Math.min(140, Math.max(28, 30 + Math.log10(m + 1) * 11));

  // Aportes parciales (más finos)
  res.parts.forEach(p => {
    const sIdx = cargas.indexOf(p.source);
    const halo = HALO_PALETTE[sIdx];
    const L = scaleLen(p.F) * 0.7;
    const nx = p.fx / p.F, ny = p.fy / p.F;
    drawArrow(ctx,
      tp.x + nx * 18,         tp.y - ny * 18,
      tp.x + nx * (18 + L),   tp.y - ny * (18 + L),
      halo, 1.6, 8, halo + '44');
  });

  // Resultante (gruesa)
  if (res.mag > 1e-30) {
    const L = scaleLen(res.mag);
    const nx = res.fx / res.mag, ny = res.fy / res.mag;
    const x2 = tp.x + nx * (22 + L);
    const y2 = tp.y - ny * (22 + L);
    drawArrow(ctx, tp.x + nx * 22, tp.y - ny * 22, x2, y2,
      C.forceArrow, 3, 13, C.forceGlow);

    // Componentes X/Y resultantes
    drawComponents(ctx, tp, x2, y2, C.forceCompX, C.forceCompY, res.fx, res.fy, 'F');

    // Etiqueta magnitud — alineada con flecha, beyond tip para no chocar con componentes
    drawPill(ctx, x2 + nx * 22, y2 - ny * 22,
      formatF(res.mag), C.forceArrow, 10);
  }
}

// ── Vectores de aporte + resultante (modo campo) ─────────────────────────────
function drawEFieldVectors(ctx) {
  const t = getTarget();
  if (!t) return;
  const px = t.wx, py = t.wy;
  const { cargas } = state;
  const sources = t.isPoint ? cargas : cargas.filter(c => c !== t.charge);
  if (sources.length === 0) return;
  const res = netElectricField(sources, px, py);
  const tp  = w2s(px, py);

  const scaleLen = m => Math.min(150, Math.max(28, 32 + Math.log10(m + 1) * 9));

  res.parts.forEach(p => {
    const sIdx = cargas.indexOf(p.source);
    const halo = HALO_PALETTE[sIdx];
    const L = scaleLen(p.Emag) * 0.7;
    const nx = p.ex / p.mag, ny = p.ey / p.mag;
    drawArrow(ctx,
      tp.x + nx * 14,         tp.y - ny * 14,
      tp.x + nx * (14 + L),   tp.y - ny * (14 + L),
      halo, 1.6, 8, halo + '44');
  });

  if (res.mag > 1e-30) {
    const L = scaleLen(res.mag);
    const nx = res.ex / res.mag, ny = res.ey / res.mag;
    const x2 = tp.x + nx * (18 + L);
    const y2 = tp.y - ny * (18 + L);
    drawArrow(ctx, tp.x + nx * 18, tp.y - ny * 18, x2, y2,
      C.efieldArrow, 3, 13, C.efieldGlow);
    drawComponents(ctx, tp, x2, y2, C.efieldCompX, C.efieldCompY, res.ex, res.ey, 'E');
    drawPill(ctx, x2 + nx * 22, y2 - ny * 22,
      formatE(res.mag), C.efieldArrow, 10);
  }
}

// ── Componentes X/Y (líneas punteadas + etiquetas) ───────────────────────────
function drawComponents(ctx, origin, x2, y2, colX, colY, valX, valY, sym) {
  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1.4;
  // Línea X (horizontal)
  ctx.strokeStyle = colX;
  ctx.beginPath(); ctx.moveTo(origin.x, origin.y); ctx.lineTo(x2, origin.y); ctx.stroke();
  // Línea Y (vertical)
  ctx.strokeStyle = colY;
  ctx.beginPath(); ctx.moveTo(x2, origin.y); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.setLineDash([]);

  const fmt   = sym === 'F' ? formatF : formatE;
  const dx    = x2 - origin.x;
  const dy    = y2 - origin.y;
  const signX = Math.sign(dx) || 1;
  const signY = Math.sign(dy) || 1;
  const CHARGE_PAD = 38; // libra cuerpo carga + halo

  // Ex pill — en extremo lejano de línea X (corner), empujado hacia afuera
  //   en X y opuesto al rectángulo en Y → lejos del cuerpo de la carga
  let exX = x2 + signX * 16;
  // Si componente X muy corta, forzar pill fuera del halo
  if (Math.abs(exX - origin.x) < CHARGE_PAD) exX = origin.x + signX * CHARGE_PAD;
  const exY = origin.y - signY * 18;
  drawPill(ctx, exX, exY, `${sym}x = ${fmt(valX)}`, colX, 9);

  // Ey pill — fuera del rectángulo en X, mitad Y de línea vertical
  let eyY = origin.y + dy * 0.5;
  if (Math.abs(eyY - origin.y) < CHARGE_PAD * 0.4) eyY = origin.y + signY * CHARGE_PAD * 0.5;
  const eyX = x2 + signX * 42;
  drawPill(ctx, eyX, eyY, `${sym}y = ${fmt(valY)}`, colY, 9);
  ctx.restore();
}

// ── Ángulo θ de la resultante (desde eje +X local del target) ───────────────
function drawResultantAngle(ctx) {
  const t = getTarget();
  if (!t) return;
  const { cargas, mode } = state;

  let vec = null, color = null;
  if (mode === 'force' && !t.isPoint) {
    const r = netForce(cargas, t.charge);
    if (r.mag > 1e-30) vec = { x: r.fx, y: r.fy, mag: r.mag, ang: r.ang };
    color = C.angleArc;
  } else if (mode === 'efield') {
    const sources = t.isPoint ? cargas : cargas.filter(c => c !== t.charge);
    if (sources.length) {
      const r = netElectricField(sources, t.wx, t.wy);
      if (r.mag > 1e-30) vec = { x: r.ex, y: r.ey, mag: r.mag, ang: r.ang };
    }
    color = C.angleArcEF;
  }
  if (!vec) return;
  const tp = w2s(t.wx, t.wy);
  // Línea eje +X local (corta)
  ctx.save();
  ctx.strokeStyle = 'rgba(160,160,200,0.28)';
  ctx.setLineDash([3, 4]); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(tp.x, tp.y); ctx.lineTo(tp.x + 36, tp.y); ctx.stroke();
  ctx.setLineDash([]);
  // Arco θ — radio compacto, label colocada radialmente más afuera en bisectriz
  const r = 22;
  const aEnd = -vec.ang * Math.PI / 180;
  ctx.strokeStyle = color; ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(tp.x, tp.y, r, 0, aEnd, aEnd < 0);
  ctx.stroke();
  const mid = aEnd / 2;
  // Label θ — distancia que la separa de cuerpo carga (r+14 mínimo) y de eje X label area
  const lx = tp.x + (r + 18) * Math.cos(mid);
  const ly = tp.y + (r + 18) * Math.sin(mid);
  drawPill(ctx, lx, ly, `θ = ${vec.ang.toFixed(1)}°`, color, 9);
  ctx.restore();
}

// ── Render principal por modo ────────────────────────────────────────────────
export function drawAnalysis(ctx) {
  const { cargas, mode } = state;
  if (cargas.length < 1) return;

  // Geometría auto según cantidad de cargas
  if (cargas.length === 2) drawAuxRightTriangle2(ctx);
  if (cargas.length === 3) drawTriangle3(ctx);
  if (cargas.length === 4) drawQuad4(ctx);

  // Líneas de distancia tenues al target
  drawDistanceLines(ctx);

  // Vectores según modo
  if (mode === 'force')  drawForceVectors(ctx);
  if (mode === 'efield') drawEFieldVectors(ctx);

  // Ángulo θ resultante
  drawResultantAngle(ctx);
}

// ── Tabla de fuerzas por par (sidebar) ───────────────────────────────────────
export function renderForceTable(cargas) {
  const cont = document.getElementById('resultados');
  if (!cont) return;
  if (cargas.length < 2) {
    cont.innerHTML = '<p class="muted">Coloca al menos 2 cargas.</p>';
    return;
  }
  let rows = '';
  for (let i = 0; i < cargas.length; i++) {
    for (let j = i + 1; j < cargas.length; j++) {
      const res = pairForce(cargas[i], cargas[j]);
      if (!res) continue;
      const { F, r, ang, attraction } = res;
      const typ = attraction
        ? '<span class="tag-atr">Atrae</span>'
        : '<span class="tag-rep">Repele</span>';
      rows += `<tr>
        <td>Q${i+1}–Q${j+1}</td>
        <td>${formatDist(r)}</td>
        <td>${ang.toFixed(1)}°</td>
        <td>${formatF(F)}</td>
        <td>${typ}</td></tr>`;
    }
  }
  cont.innerHTML = `
    <table class="result-table">
      <thead><tr><th>Par</th><th>r</th><th>θ</th><th>|F|</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}
