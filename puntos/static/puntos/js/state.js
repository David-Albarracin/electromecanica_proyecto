/**
 * state.js — Estado mutable compartido
 */

export const MAX_CARGAS = 4;

// Paleta halo por índice de carga (Q1..Q4)
export const HALO_PALETTE = [
  '#a78bfa', // violeta
  '#22d3ee', // cian
  '#fbbf24', // ámbar
  '#34d399', // verde
];

export const state = {
  cargas:        [],            // { wx, wy, valor, tipo, id }
  dragging:      null,          // null | { type:'charge'|'pan'|'point', ... }
  animFrame:     null,

  // Modo del simulador
  mode:          'force',       // 'force' | 'efield'

  // Target de análisis
  targetType:    'charge',      // 'charge' | 'point'
  targetId:      null,          // id de carga objetivo (cuando targetType='charge')

  // Punto libre P (target en modo campo)
  pointP:        { wx: 1.5, wy: 0.8 },
};
