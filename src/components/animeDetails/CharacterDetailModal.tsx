import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { X, Heart, Loader2, Images, Check, ImageDown, ExternalLink } from 'lucide-react';
import type { Character, CharacterDetail } from '../../types/anime';
import { getCharacterDetailMal } from '../../services/malApi';
import { translateToSpanish } from '../../services/translateApi';
import { translateRole } from '../../utils/translations';

interface CharacterDetailModalProps {
  character: Character;
  /** Anime de origen: la ficha del personaje lo necesita para poder guardarlo. */
  animeId: number;
  animeTitle: string;
  isFavorite: boolean;
  canFavorite: boolean;
  /** Imagen que el perfil muestra hoy para este personaje, si ya es favorito. */
  savedImage: string | null;
  /** Recibe la imagen visible en ese momento: es la que se guarda. */
  onToggleFavorite: (imageUrl: string) => void;
  onUpdateImage: (imageUrl: string) => void;
  onClose: () => void;
}

const GALLERY_LIMIT = 12;

export const CharacterDetailModal = ({
  character, animeId, animeTitle, isFavorite, canFavorite, savedImage, onToggleFavorite, onUpdateImage, onClose,
}: CharacterDetailModalProps) => {
  const [detail, setDetail] = useState<CharacterDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const { character: c, role } = character;
  const portrait = c.images.jpg.large_image_url || c.images.jpg.image_url;
  // Arranca en la imagen que el perfil ya muestra para este personaje (si es
  // favorito) y si no en el retrato de la tarjeta: así el panel se ve
  // completo desde el primer frame y refleja lo que el usuario tiene guardado.
  const [activeImage, setActiveImage] = useState(savedImage || portrait);

  // Ficha desde la API oficial de MAL (misma fuente que llena la grilla).
  useEffect(() => {
    let cancelled = false;

    getCharacterDetailMal(c.mal_id)
      .then(result => {
        if (cancelled || !result) return;
        setDetail(result);
        if (result.description) {
          translateToSpanish(result.description)
            .then(translated => {
              if (!cancelled) setDetail(prev => (prev ? { ...prev, description: translated } : prev));
            })
            .catch(() => { /* se queda la biografía original */ });
        }
      })
      .catch(error => console.error(error))
      .finally(() => { if (!cancelled) setLoadingDetail(false); });

    return () => { cancelled = true; };
  }, [c.mal_id]);

  // Cerrar con Escape y congelar el scroll del fondo mientras está abierto:
  // sin esto la página sigue desplazándose detrás del panel y el footer
  // termina montándose encima al llegar al final.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);

    // El contenedor de scroll de la página es <html>, no <body>: bloquear
    // solo el body deja el fondo desplazándose igual detrás del panel.
    const root = document.documentElement;
    const prevRootOverflow = root.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    const prevBodyPadding = document.body.style.paddingRight;
    // Compensa la barra de scroll que desaparece, para que el fondo no salte.
    const gap = window.innerWidth - root.clientWidth;

    root.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    if (gap > 0) document.body.style.paddingRight = `${gap}px`;

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      root.style.overflow = prevRootOverflow;
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.paddingRight = prevBodyPadding;
    };
  }, [onClose]);

  // `?.` también sobre `pictures`: una ficha cacheada por una versión
  // anterior puede no traer el campo, y sin esto el panel entero crashea.
  const gallery = detail?.pictures?.slice(0, GALLERY_LIMIT) ?? [];

  // Va montado en <body> por portal: dentro del árbol de AnimeDetails
  // quedaba atrapado por el `overflow-hidden` del contenedor de la página,
  // y aun escapando de eso el header (z-[100]) lo tapaba por arriba.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={c.name}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm animate-in fade-in" onClick={onClose} />

      {/* Tamaño fijo a propósito: el panel mide siempre lo mismo, sea el
          personaje que sea. Ni la imagen ni el largo de la biografía lo
          mueven. Solo se achica si la ventana es más chica. */}
      <div className="relative z-10 w-full max-w-5xl h-[42rem] max-h-[calc(100dvh-2rem)] bg-[#11131A] border border-[#FF3B3B]/20 rounded-2xl overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.85)] flex flex-col sm:flex-row animate-in fade-in zoom-in-95 duration-200">

        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute top-3 right-3 z-30 p-2 bg-[#0D0F15]/85 backdrop-blur-sm border border-white/10 text-zinc-300 hover:text-white hover:bg-[#0D0F15] transition-colors rounded-lg"
        >
          <X size={16} />
        </button>

        {/* ── Columna izquierda: retrato + galería ─────────────────────
            En escritorio es una columna con la galería en grilla vertical.
            En móvil se apila arriba, así que va a alto natural y la galería
            pasa a una tira horizontal: si creciera hacia abajo empujaría el
            nombre y la biografía fuera del panel. */}
        <div className="shrink-0 w-full sm:w-[19rem] flex flex-col bg-[#0D0F15]/50 sm:border-r border-b sm:border-b-0 border-[#FF3B3B]/10 min-h-0">
          {/* Retrato a tamaño contenido, no estirado a todo el panel */}
          <div className="p-4 sm:p-5 pb-3 sm:pb-4 shrink-0">
            <div className="relative w-32 sm:w-full mx-auto aspect-[3/4] rounded-xl overflow-hidden border border-[#FF3B3B]/15 bg-[#0D0F15] shadow-[0_8px_28px_rgba(0,0,0,0.5)]">
              <img
                key={activeImage}
                src={activeImage}
                alt={c.name}
                className="w-full h-full object-cover object-top animate-in fade-in duration-200"
              />
              {isFavorite && savedImage === activeImage && (
                <span className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-[#FF3B3B] bg-[#0D0F15]/90 backdrop-blur-sm border border-[#FF3B3B]/30 px-2 py-1 rounded-md whitespace-nowrap">
                  <Check size={9} /> En tu perfil
                </span>
              )}
            </div>

            {/* Solo aparece cuando hay un cambio real que aplicar */}
            {isFavorite && savedImage !== activeImage && (
              <button
                onClick={() => onUpdateImage(activeImage)}
                className="mt-2.5 w-32 sm:w-full mx-auto flex items-center justify-center gap-1.5 px-3 py-2 bg-[#FF3B3B]/10 border border-[#FF3B3B]/30 hover:bg-[#FF3B3B]/20 hover:border-[#FF3B3B]/50 text-[#FF3B3B] text-[10px] font-black uppercase tracking-widest rounded-lg transition-colors"
              >
                <ImageDown size={12} /> Usar en mi perfil
              </button>
            )}
          </div>

          {gallery.length > 0 && (
            <div className="flex-none sm:flex-1 min-h-0 sm:overflow-y-auto px-4 sm:px-5 pb-4 sm:pb-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2.5 flex items-center gap-1.5">
                <Images size={11} className="text-[#FF3B3B]/50" /> Galería
              </p>
              <div className="flex sm:grid sm:grid-cols-4 gap-2 overflow-x-auto sm:overflow-x-visible">
                {[portrait, ...gallery].map(src => (
                  <button
                    key={src}
                    onClick={() => setActiveImage(src)}
                    aria-label="Ver imagen"
                    className={`w-12 shrink-0 sm:w-auto aspect-[3/4] rounded-md overflow-hidden border transition-all ${
                      activeImage === src
                        ? 'border-[#FF3B3B] opacity-100'
                        : 'border-[#FF3B3B]/10 opacity-60 hover:opacity-100 hover:border-[#FF3B3B]/40'
                    }`}
                  >
                    <img src={src} alt="" loading="lazy" className="w-full h-full object-cover object-top" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Columna derecha: identidad + apodos + voz + biografía ──── */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col">

          {/* Encabezado fijo, no scrollea con la biografía */}
          <div className="shrink-0 px-6 pt-6 pb-4 border-b border-[#FF3B3B]/10">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 pr-6">
                <h2 className="text-2xl font-black text-white tracking-tight leading-tight mb-2">
                  {c.name}
                </h2>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#FF3B3B] bg-[#FF3B3B]/10 border border-[#FF3B3B]/25 px-2.5 py-1 rounded-lg">
                    {translateRole(role)}
                  </span>
                  {detail?.favorites != null && detail.favorites > 0 && (
                    <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                      <Heart size={11} className="text-[#FF3B3B]/40" />
                      {detail.favorites.toLocaleString('es-ES')} favoritos
                    </span>
                  )}
                  {/* El panel no tiene URL propia; esto lleva a la página que sí
                      se puede compartir. */}
                  <Link
                    to={`/personaje/${c.mal_id}?anime=${animeId}&titulo=${encodeURIComponent(animeTitle)}`}
                    onClick={onClose}
                    className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-[#FF3B3B] transition-colors"
                  >
                    <ExternalLink size={11} /> Ver ficha
                  </Link>
                </div>
              </div>

              {canFavorite && (
                <button
                  onClick={() => onToggleFavorite(activeImage)}
                  title={isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos con esta imagen'}
                  className={`shrink-0 flex items-center justify-center w-11 h-11 mt-9 rounded-xl border transition-all ${
                    isFavorite
                      ? 'bg-[#FF3B3B]/10 border-[#FF3B3B]/40 text-[#FF3B3B]'
                      : 'border-[#FF3B3B]/15 text-zinc-500 hover:border-[#FF3B3B]/40 hover:text-[#FF3B3B] hover:bg-[#FF3B3B]/5'
                  }`}
                >
                  <Heart size={18} className={isFavorite ? 'fill-current' : ''} />
                </button>
              )}
            </div>
          </div>

          {/* Cuerpo scrolleable */}
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
            {loadingDetail ? (
              <div className="flex justify-center py-12">
                <Loader2 className="animate-spin text-[#FF3B3B]" size={20} />
              </div>
            ) : (
              <>
                {detail?.nicknames && detail.nicknames.length > 0 && (
                  <div className="mb-5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">
                      También conocido como
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {detail.nicknames.slice(0, 8).map(nick => (
                        <span
                          key={nick}
                          className="text-[11px] font-bold text-zinc-300 bg-[#0D0F15] border border-[#FF3B3B]/15 px-2.5 py-1 rounded-lg"
                        >
                          {nick}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">
                  Biografía
                </p>
                <p className="text-zinc-400 text-sm leading-relaxed whitespace-pre-line">
                  {detail?.description || 'Sin biografía disponible.'}
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};
