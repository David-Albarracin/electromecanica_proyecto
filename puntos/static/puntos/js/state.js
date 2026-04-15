/**
 * state.js — Estado mutable compartido de la aplicación
 * Usar como objeto mutable (no reasignar la referencia).
 */

export const state = {
  cargas:          [],      // { wx, wy, valor, tipo, id }
  dragging:        null,    // null | { type:'charge'|'pan', ... }
  posMode:         'center',
  animFrame:       null,
  showEField:      false,   // mostrar flechas de campo eléctrico
  showFieldLines:  false,   // mostrar líneas de campo
};
