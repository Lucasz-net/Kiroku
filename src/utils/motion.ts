/**
 * ¿El sistema pidió reducir el movimiento?
 *
 * La app anima con GSAP en casi todas las pantallas: el hero de la home con
 * scroll fijado durante 400vh, los contadores del perfil, las transiciones
 * entre rutas y varios ScrollTrigger. Para alguien con sensibilidad
 * vestibular eso va de molesto a inusable, y hasta ahora no había una sola
 * consulta de `prefers-reduced-motion` en todo el proyecto.
 *
 * Los `useGSAP` que animan entradas cortan temprano cuando esto da true. Como
 * es GSAP el que pone el estado inicial (opacity 0, y 28, blur), no animar
 * significa que el elemento se renderiza directamente en su estado final —
 * no hace falta CSS de respaldo para que se vea bien.
 *
 * Se consulta en cada llamada y no una sola vez al cargar: la preferencia se
 * puede cambiar con la página abierta.
 */
export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** `behavior` para scrollTo/scrollIntoView, respetando la preferencia. */
export const scrollBehavior = (): ScrollBehavior =>
  prefersReducedMotion() ? 'auto' : 'smooth';
