import React, { useRef, useState, type ReactNode } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { prefersReducedMotion } from '../utils/motion';

gsap.registerPlugin(ScrollTrigger);

export interface AnimeScrollCanvasProps {
  totalFrames: number;
  baseUrl: string;
  framePrefix?: string;
  fileExtension?: string;
  padLength?: number;
  scrollDistance?: string;
  children?: ReactNode;
}

// La secuencia completa son ~10,4 MB en 90 archivos WebP. Antes se disparaban
// los 89 restantes en paralelo apenas cargaba la home: decenas de segundos en
// una conexión móvil y una porción real del plan de datos de alguien que
// todavía no sabe qué es Kiroku, todo antes de ver un solo anime.
//
// Ahora:
//   · En pantallas chicas o con "reducir movimiento" activo no se descarga la
//     secuencia: se muestra el primer frame como imagen fija (~118 KB) y no
//     se fija el scroll. Es donde el costo dolía más y donde la animación
//     menos se aprecia.
//   · En escritorio se cargan de a tandas, no todas de una, así la página
//     sigue teniendo ancho de banda para lo que el usuario vino a ver.
//   · Mientras un frame no llegó se dibuja el más cercano ya cargado, así el
//     scrub se ve continuo en vez de congelarse.
const MOBILE_BREAKPOINT = 768;
const CONCURRENCY = 4;

export const AnimeScrollCanvas: React.FC<AnimeScrollCanvasProps> = ({
  totalFrames,
  baseUrl,
  framePrefix = 'frame_',
  fileExtension = '.webp',
  padLength = 4,
  scrollDistance = '400vh',
  children,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<(HTMLImageElement | null)[]>([]);
  const animationRef = useRef({ frame: 0 });
  const [isLoaded, setIsLoaded] = useState(false);

  const getImageUrl = (index: number) => {
    const paddedIndex = padLength > 0
      ? (index + 1).toString().padStart(padLength, '0')
      : (index + 1).toString();
    return `${baseUrl}${framePrefix}${paddedIndex}${fileExtension}`;
  };

  /** Frame pedido, o el ya cargado más cercano, o null si todavía no hay ninguno. */
  const nearestLoaded = (index: number): HTMLImageElement | null => {
    const images = imagesRef.current;
    if (images[index]) return images[index];
    for (let offset = 1; offset < totalFrames; offset++) {
      if (images[index - offset]) return images[index - offset]!;
      if (images[index + offset]) return images[index + offset]!;
    }
    return null;
  };

  const renderFrame = (frameIndex: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { alpha: false });
    const img = nearestLoaded(frameIndex);

    if (!canvas || !ctx || !img) return;

    const canvasRatio = canvas.width / canvas.height;
    const imgRatio = img.width / img.height;
    let drawWidth, drawHeight, offsetX, offsetY;

    if (canvasRatio > imgRatio) {
      drawWidth = canvas.width;
      drawHeight = canvas.width / imgRatio;
      offsetX = 0;
      offsetY = (canvas.height - drawHeight) / 2;
    } else {
      drawWidth = canvas.height * imgRatio;
      drawHeight = canvas.height;
      offsetX = (canvas.width - drawWidth) / 2;
      offsetY = 0;
    }

    ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
  };

  const handleResize = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    renderFrame(Math.round(animationRef.current.frame));
  };

  useGSAP(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;

    const loadImage = (index: number) => new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.src = getImageUrl(index);
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
    });

    // El primer frame siempre: es lo que se ve antes de scrollear, y también
    // la imagen fija cuando la secuencia no se carga.
    const showFirstFrame = async () => {
      imagesRef.current[0] = await loadImage(0);
      if (cancelled) return;
      setIsLoaded(true);
      handleResize();
    };

    const animate =
      window.innerWidth >= MOBILE_BREAKPOINT && !prefersReducedMotion();

    if (!animate) {
      showFirstFrame();
      window.addEventListener('resize', handleResize);
      return () => {
        cancelled = true;
        window.removeEventListener('resize', handleResize);
      };
    }

    const absorbTl = gsap.timeline({
      scrollTrigger: {
        trigger: containerRef.current,
        start: 'top top',
        end: `+=${scrollDistance}`,
        scrub: 0.5,
        pin: true,
      },
    });

    absorbTl.to(animationRef.current, {
      frame: totalFrames - 1,
      snap: 'frame',
      ease: 'none',
      duration: 1,
      onUpdate: () => renderFrame(Math.round(animationRef.current.frame)),
    });

    // Tandas de CONCURRENCY en vez de las 89 peticiones simultáneas de antes.
    const loadRest = async () => {
      for (let start = 1; start < totalFrames; start += CONCURRENCY) {
        if (cancelled) return;
        const batch = [];
        for (let i = start; i < Math.min(start + CONCURRENCY, totalFrames); i++) {
          batch.push(loadImage(i).then(img => { imagesRef.current[i] = img; }));
        }
        await Promise.all(batch);
        if (cancelled) return;
        // Repinta con lo que ya haya: si el usuario scrolleó mientras se
        // descargaba, el frame correcto puede haber llegado recién ahora.
        renderFrame(Math.round(animationRef.current.frame));
      }
    };

    showFirstFrame().then(() => { if (!cancelled) loadRest(); });
    window.addEventListener('resize', handleResize);

    return () => {
      cancelled = true;
      window.removeEventListener('resize', handleResize);
    };
  }, { scope: containerRef });

  return (
    <div ref={containerRef} className="relative w-full h-[100dvh] bg-[#0a0a0a] overflow-hidden">
      {/* CAPA 1: EL CANVAS (z-10) */}
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 w-full h-full block z-10 transition-opacity duration-700 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
      />

      {/* CAPA 2: CONTENIDO SUPERPUESTO (z-20) */}
      {children && (
        <div className="absolute inset-0 z-20 pointer-events-none">
          <div className="pointer-events-auto w-full h-full">
            {children}
          </div>
        </div>
      )}
    </div>
  );
};
