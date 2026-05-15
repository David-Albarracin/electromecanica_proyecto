/**
 * physics.js — Cálculos electromagnéticos puros
 * Ley de Coulomb + Campo Eléctrico (superposición vectorial)
 */

export const K = 8.99e9; // N·m²/C²

// ── Magnitud de fuerza entre dos cargas ─────────────────────────────────────
export function coulombMag(q1, q2, r) {
  return K * Math.abs(q1 * q2) / (r * r);
}

// ── Aporte vectorial de UNA carga c sobre target (fuerza) ───────────────────
// target = { wx, wy, valor, tipo } (debe tener valor signed)
export function forceContribution(c, target) {
  const dx = target.wx - c.wx;
  const dy = target.wy - c.wy;
  const r = Math.hypot(dx, dy);
  if (r < 1e-14) return null;
  const F = coulombMag(target.valor, c.valor, r);
  const sign = target.tipo === c.tipo ? 1 : -1; // repulsión vs atracción
  const fx = sign * F * (dx / r);
  const fy = sign * F * (dy / r);
  return {
    fx, fy, F, r,
    mag: F,
    ang: ((Math.atan2(fy, fx) * 180 / Math.PI) + 360) % 360,
    attraction: target.tipo !== c.tipo,
  };
}

// ── Fuerza neta sobre una carga objetivo ─────────────────────────────────────
export function netForce(charges, target) {
  let fx = 0, fy = 0;
  const parts = [];
  for (const c of charges) {
    if (c === target) continue;
    const p = forceContribution(c, target);
    if (!p) continue;
    fx += p.fx; fy += p.fy;
    parts.push({ source: c, ...p });
  }
  return {
    fx, fy,
    mag: Math.hypot(fx, fy),
    ang: ((Math.atan2(fy, fx) * 180 / Math.PI) + 360) % 360,
    parts,
  };
}

// ── Fuerza escalar entre par (para tabla par a par) ──────────────────────────
export function pairForce(ci, cj) {
  const dx = cj.wx - ci.wx;
  const dy = cj.wy - ci.wy;
  const r = Math.hypot(dx, dy);
  if (r < 1e-14) return null;
  return {
    F: coulombMag(ci.valor, cj.valor, r),
    r,
    ang: ((Math.atan2(dy, dx) * 180 / Math.PI) + 360) % 360,
    attraction: ci.tipo !== cj.tipo,
  };
}

// ── Aporte vectorial de UNA carga al campo E en punto (px,py) ───────────────
export function efieldContribution(c, px, py) {
  const dx = px - c.wx;
  const dy = py - c.wy;
  const r2 = dx * dx + dy * dy;
  if (r2 < 1e-28) return null;
  const r = Math.sqrt(r2);
  // E = k*q/r² · r̂   (signed via c.valor)
  const Emag = K * Math.abs(c.valor) / r2;
  const factor = K * c.valor / (r2 * r);
  const ex = factor * dx;
  const ey = factor * dy;
  return {
    ex, ey, r,
    mag: Math.hypot(ex, ey) || Emag,
    Emag,
    ang: ((Math.atan2(ey, ex) * 180 / Math.PI) + 360) % 360,
  };
}

export function electricFieldOne(charge, px, py) {
  const r = efieldContribution(charge, px, py);
  return r ? { ex: r.ex, ey: r.ey } : { ex: 0, ey: 0 };
}

// ── Campo E neto en punto P por superposición ────────────────────────────────
export function netElectricField(charges, px, py) {
  let ex = 0, ey = 0;
  const parts = [];
  for (const c of charges) {
    const p = efieldContribution(c, px, py);
    if (!p) continue;
    ex += p.ex; ey += p.ey;
    parts.push({ source: c, ...p });
  }
  return {
    ex, ey,
    mag: Math.hypot(ex, ey),
    ang: ((Math.atan2(ey, ex) * 180 / Math.PI) + 360) % 360,
    parts,
  };
}
