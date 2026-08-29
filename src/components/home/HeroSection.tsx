import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { AnimeScrollCanvas } from '../../ui/AnimeScrollCanvas';

export const HeroSection = () => {
  const heroRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power4.out' } });

    tl.fromTo('.hero-line',
      { scaleX: 0, opacity: 0 },
      { scaleX: 1, opacity: 1, duration: 0.5, transformOrigin: 'left center' }
    )
    .fromTo('.hero-welcome',
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: 0.5 },
      0.12
    )
    .fromTo('.hero-kiroku',
      { opacity: 0, y: 28, scale: 0.95 },
      { opacity: 1, y: 0, scale: 1, duration: 0.7 },
      0.22
    )
    .fromTo('.hero-cta',
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out' },
      0.46
    );
  }, { scope: heroRef });

  return (
    <AnimeScrollCanvas
      totalFrames={89}
      baseUrl="/sequence/"
      framePrefix="frame_"
      fileExtension=".webp"
      padLength={4}
      scrollDistance="400vh"
    >
      <div
        ref={heroRef}
        className="w-full h-full flex flex-col justify-center items-start pl-6 pr-6 md:pl-16 lg:pl-[8vw] relative z-10"
      >
        <div className="max-w-2xl">
          {/* Línea de acento */}
          <div className="flex items-center gap-4 mb-6 opacity-90">
            <span className="hero-line block w-10 h-[2px] bg-[#FF3B3B] shadow-[0_0_10px_rgba(255,59,59,0.8)]" />
          </div>

          <h1 className="flex flex-col gap-2 mb-10 drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
            <span className="hero-welcome text-3xl md:text-4xl lg:text-5xl font-mono font-bold text-[#FF3B3B] tracking-[0.2em] uppercase drop-shadow-[0_0_8px_rgba(255,59,59,0.5)]">
              Welcome To
            </span>
            {/* KIROKU: sin split de caracteres para mantener el gradiente bg-clip-text */}
            <span className="hero-kiroku text-6xl md:text-8xl lg:text-[8.5rem] font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-500 tracking-tighter leading-[0.85] uppercase mt-1">
              KIROKU
            </span>
          </h1>

          <Link
            to="/search"
            className="hero-cta inline-flex items-center gap-3 px-8 py-4 bg-[#FF3B3B] text-white font-black text-sm uppercase tracking-widest rounded-2xl hover:bg-[#FF5555] transition-colors shadow-[0_0_28px_rgba(255,59,59,0.4)] hover:shadow-[0_0_36px_rgba(255,59,59,0.55)]"
          >
            <Search size={17} />
            Iniciar Búsqueda
          </Link>
        </div>
      </div>
    </AnimeScrollCanvas>
  );
};
