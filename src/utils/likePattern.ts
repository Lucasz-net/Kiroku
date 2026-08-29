/**
 * Escapa los comodines de LIKE/ILIKE para que el texto se compare literal.
 *
 * Hace falta porque los nombres de usuario admiten `_`, que en LIKE significa
 * "un carácter cualquiera". Sin escapar, `/u/a_b` matchearía también a `axb`:
 * o resuelve al perfil equivocado, o matchea dos filas y `maybeSingle()`
 * devuelve error, mostrando "perfil no encontrado" a alguien que sí existe.
 *
 * Postgres usa `\` como carácter de escape por defecto en LIKE, así que
 * alcanza con anteponerlo (y escapar el propio `\` primero).
 */
export const escapeLikePattern = (value: string): string =>
  value.replace(/[\\%_]/g, m => `\\${m}`);
