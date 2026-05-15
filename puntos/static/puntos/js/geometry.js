/**
 * geometry.js — Análisis geométrico automático
 * Triángulos, ángulos internos, configuraciones de cargas
 */

// ── Distancia entre dos puntos ───────────────────────────────────────────────
export function dist(a, b) {
  return Math.hypot(a.wx - b.wx, a.wy - b.wy);
}

// ── Vector a→b ───────────────────────────────────────────────────────────────
export function vec(a, b) {
  return { x: b.wx - a.wx, y: b.wy - a.wy };
}

// ── Triángulo rectángulo auxiliar (caso 2 puntos) ───────────────────────────
// Genera vértice ortogonal en (b.wx, a.wy) para visualizar Δx, Δy
export function rightTriangleAux(a, b) {
  const dx = b.wx - a.wx;
  const dy = b.wy - a.wy;
  const r  = Math.hypot(dx, dy);
  if (r < 1e-14) return null;
  // ángulos del rect-triángulo: 90° en corner, α en a, β en b
  const alpha = Math.atan2(Math.abs(dy), Math.abs(dx)) * 180 / Math.PI;
  const beta  = 90 - alpha;
  return {
    corner: { wx: b.wx, wy: a.wy },
    dx, dy, r,
    angleAtA: alpha,
    angleAtB: beta,
    angleAtCorner: 90,
    // ángulo absoluto del vector a→b (para etiqueta direccional)
    bearing: ((Math.atan2(dy, dx) * 180 / Math.PI) + 360) % 360,
  };
}

// ── Ángulos internos de triángulo formado por 3 puntos ──────────────────────
// Devuelve ángulo (en grados) en cada vértice, lados opuestos y perímetro
export function triangleAngles(p1, p2, p3) {
  const a = dist(p2, p3); // lado opuesto a p1
  const b = dist(p1, p3); // lado opuesto a p2
  const c = dist(p1, p2); // lado opuesto a p3
  if (a < 1e-14 || b < 1e-14 || c < 1e-14) return null;
  // Ley de cosenos
  const A = Math.acos(clamp((b*b + c*c - a*a) / (2*b*c)));
  const B = Math.acos(clamp((a*a + c*c - b*b) / (2*a*c)));
  const C = Math.acos(clamp((a*a + b*b - c*c) / (2*a*b)));
  return {
    vertices: [p1, p2, p3],
    sides: { a, b, c },
    angles: {
      A: A * 180 / Math.PI,
      B: B * 180 / Math.PI,
      C: C * 180 / Math.PI,
    },
    perimeter: a + b + c,
  };
}

function clamp(v) { return Math.max(-1, Math.min(1, v)); }

// ── Configuración de 4 puntos: detectar cuadrado/rectángulo ─────────────────
// Devuelve descripción + lados + 4 ángulos internos del polígono convexo
export function quadGeometry(pts) {
  if (pts.length !== 4) return null;
  // Ordenar por ángulo desde centroide → polígono convexo cíclico
  const cx = (pts[0].wx + pts[1].wx + pts[2].wx + pts[3].wx) / 4;
  const cy = (pts[0].wy + pts[1].wy + pts[2].wy + pts[3].wy) / 4;
  const sorted = [...pts].map((p, i) => ({
    p, i,
    ang: Math.atan2(p.wy - cy, p.wx - cx),
  })).sort((a, b) => a.ang - b.ang).map(o => o.p);

  const sides = [];
  for (let i = 0; i < 4; i++) {
    sides.push(dist(sorted[i], sorted[(i+1) % 4]));
  }
  // Ángulos internos en cada vértice (vía dot product de aristas)
  const angles = [];
  for (let i = 0; i < 4; i++) {
    const prev = sorted[(i+3) % 4], curr = sorted[i], next = sorted[(i+1) % 4];
    const v1 = vec(curr, prev), v2 = vec(curr, next);
    const dot = v1.x*v2.x + v1.y*v2.y;
    const m1  = Math.hypot(v1.x, v1.y), m2 = Math.hypot(v2.x, v2.y);
    if (m1 < 1e-14 || m2 < 1e-14) { angles.push(0); continue; }
    angles.push(Math.acos(clamp(dot / (m1*m2))) * 180 / Math.PI);
  }
  // Heurística forma
  const eqSides = sides.every((s, _, arr) => Math.abs(s - arr[0]) / arr[0] < 0.03);
  const eqAng   = angles.every(a => Math.abs(a - 90) < 1.5);
  let shape = 'irregular';
  if (eqAng && eqSides) shape = 'cuadrado';
  else if (eqAng)       shape = 'rectángulo';
  return {
    sortedVertices: sorted,
    sides, angles, shape,
    diag1: dist(sorted[0], sorted[2]),
    diag2: dist(sorted[1], sorted[3]),
  };
}
