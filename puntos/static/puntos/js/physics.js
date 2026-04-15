/**
 * physics.js — Cálculos electromagnéticos puros (sin dependencias DOM)
 * Ley de Coulomb + Campo Eléctrico (superposición vectorial)
 */

export const K = 8.99e9; // N·m²/C² — constante de Coulomb

// ── Fuerza entre dos cargas (magnitud escalar) ──────────────────────────────
export function coulombMag(q1, q2, r) {
  return K * Math.abs(q1 * q2) / (r * r);
}

// ── Fuerza neta sobre una carga objetivo (vector resultante) ─────────────────
export function netForce(charges, target) {
  let fx = 0, fy = 0;
  for (const c of charges) {
    if (c === target) continue;
    const dx = target.wx - c.wx;
    const dy = target.wy - c.wy;
    const r = Math.hypot(dx, dy);
    if (r < 1e-14) continue;
    const F = coulombMag(target.valor, c.valor, r);
    const sign = target.tipo === c.tipo ? 1 : -1; // repulsión vs atracción
    fx += sign * F * (dx / r);
    fy += sign * F * (dy / r);
  }
  return { fx, fy, mag: Math.hypot(fx, fy) };
}

// ── Fuerza escalar entre un par de cargas (para tabla) ──────────────────────
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

// ── Campo eléctrico en un punto P debido a UNA carga ─────────────────────────
// E = k·q / r² — dirección: alejándose de carga positiva, acercándose a negativa
export function electricFieldOne(charge, px, py) {
  const dx = px - charge.wx;
  const dy = py - charge.wy;
  const r2 = dx * dx + dy * dy;
  if (r2 < 1e-28) return { ex: 0, ey: 0 };
  // valor ya es signed (positivo/negativo), E = k*q/r³ * (r_vector)
  const factor = K * charge.valor / (r2 * Math.sqrt(r2));
  return { ex: factor * dx, ey: factor * dy };
}

// ── Campo eléctrico neto en P por superposición ──────────────────────────────
export function netElectricField(charges, px, py) {
  let ex = 0, ey = 0;
  for (const c of charges) {
    const e = electricFieldOne(c, px, py);
    ex += e.ex;
    ey += e.ey;
  }
  const mag = Math.hypot(ex, ey);
  return { ex, ey, mag };
}

// ── Potencial eléctrico en P (escalar, superposición) ───────────────────────
export function electricPotential(charges, px, py) {
  let V = 0;
  for (const c of charges) {
    const r = Math.hypot(px - c.wx, py - c.wy);
    if (r < 1e-14) continue;
    V += K * c.valor / r;
  }
  return V;
}
