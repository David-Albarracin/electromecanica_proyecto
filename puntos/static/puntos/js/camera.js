/**
 * camera.js — Estado de cámara y transformaciones coordenadas
 * mundo (metros) ↔ pantalla (píxeles)
 */

export const BASE_SCALE = 100; // px/m a zoom=1

export const cam = { zoom: 1, panX: 0, panY: 0, _init: false };

export const S    = ()         => cam.zoom * BASE_SCALE;
export const w2s  = (wx, wy)   => ({ x: cam.panX + wx * S(), y: cam.panY - wy * S() });
export const s2w  = (sx, sy)   => ({ wx: (sx - cam.panX) / S(), wy: -(sy - cam.panY) / S() });

export function initCamera(width, height) {
  cam.panX = width  / 2;
  cam.panY = height / 2;
}

// ── Zoom centrado en un punto de pantalla (cx, cy) ──────────────────────────
export function zoomAt(factor, cx, cy) {
  cam.zoom = Math.max(5e-5, Math.min(2e5, cam.zoom * factor));
  cam.panX = cx + (cam.panX - cx) * factor;
  cam.panY = cy + (cam.panY - cy) * factor;
}

// ── Ajustar vista para que todas las cargas quepan ──────────────────────────
export function fitAll(charges, canvasW, canvasH) {
  if (charges.length === 0) { initCamera(canvasW, canvasH); cam.zoom = 1; return; }
  if (charges.length === 1) {
    const p = w2s(charges[0].wx, charges[0].wy);
    cam.panX += canvasW / 2 - p.x;
    cam.panY += canvasH / 2 - p.y;
    return;
  }
  const xs = charges.map(c => c.wx), ys = charges.map(c => c.wy);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const y0 = Math.min(...ys), y1 = Math.max(...ys);
  const pad = 0.38;
  const zx = canvasW  / ((x1 - x0 || 0.001) * BASE_SCALE * (1 + 2 * pad));
  const zy = canvasH / ((y1 - y0 || 0.001) * BASE_SCALE * (1 + 2 * pad));
  cam.zoom = Math.max(5e-5, Math.min(2e5, Math.min(zx, zy)));
  cam.panX = canvasW  / 2 - (x0 + x1) / 2 * cam.zoom * BASE_SCALE;
  cam.panY = canvasH / 2 + (y0 + y1) / 2 * cam.zoom * BASE_SCALE;
}
