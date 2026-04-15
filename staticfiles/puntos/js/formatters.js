/**
 * formatters.js — Formato automático de unidades físicas
 */

export function formatQ(v) {
  const a = Math.abs(v);
  if (a >= 1)    return v.toFixed(3)          + ' C';
  if (a >= 1e-3) return (v * 1e3).toFixed(2)  + ' mC';
  if (a >= 1e-6) return (v * 1e6).toFixed(2)  + ' μC';
  if (a >= 1e-9) return (v * 1e9).toFixed(2)  + ' nC';
  return v.toExponential(2) + ' C';
}

export function formatDist(v) {
  const a = Math.abs(v), sg = v < 0 ? '−' : '';
  if (a < 1e-14)  return '0 m';
  if (a >= 1)     return sg + a.toPrecision(4)         + ' m';
  if (a >= 0.01)  return sg + (a * 100).toPrecision(3) + ' cm';
  if (a >= 1e-3)  return sg + (a * 1e3).toPrecision(3) + ' mm';
  if (a >= 1e-6)  return sg + (a * 1e6).toPrecision(3) + ' μm';
  if (a >= 1e-9)  return sg + (a * 1e9).toPrecision(3) + ' nm';
  return sg + a.toExponential(2) + ' m';
}

export function formatE(v) {
  const a = Math.abs(v);
  if (a < 1e-14)  return '0 N/C';
  if (a >= 1e9)   return v.toExponential(2) + ' GN/C';
  if (a >= 1e6)   return (v / 1e6).toPrecision(3)  + ' MN/C';
  if (a >= 1e3)   return (v / 1e3).toPrecision(3)  + ' kN/C';
  if (a >= 1)     return v.toPrecision(3)           + ' N/C';
  return v.toExponential(2) + ' N/C';
}

export function niceNum(v) {
  if (Math.abs(v) < 1e-14) return '0';
  const a = Math.abs(v);
  if (a >= 1e4 || a < 1e-3) return v.toExponential(1);
  return parseFloat(v.toPrecision(3)).toString();
}
