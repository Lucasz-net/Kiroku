import { useEffect, useRef, useState } from 'react';

/**
 * ¿El elemento entró (alguna vez) en el viewport?
 *
 * Una vez que entra queda en true para siempre: se usa para disparar trabajo
 * diferido, y volver a false al salir de pantalla solo lo repetiría.
 *
 * `rootMargin` generoso a propósito para que lo que está por aparecer empiece
 * a cargar antes de que el usuario llegue.
 */
export function useInView<T extends Element>(rootMargin = '300px') {
  const ref = useRef<T | null>(null);
  // Sin IntersectionObserver (navegadores viejos, jsdom en los tests) el
  // comportamiento correcto es "visible": mejor hacer el trabajo de más que no
  // hacerlo nunca. Se resuelve en el estado inicial y no dentro del efecto,
  // para no encadenar un render extra.
  const [inView, setInView] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    if (inView) return;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [inView, rootMargin]);

  return { ref, inView };
}
