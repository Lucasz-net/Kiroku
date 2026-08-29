import { Link } from 'react-router-dom';
import { Search, Trophy, CalendarDays, BookOpen, ArrowRight, Upload, Sparkles } from 'lucide-react';
import { QuickStartPicker } from './QuickStartPicker';

const steps = [
  {
    num: '01',
    icon: Search,
    title: 'Busca tu primer anime',
    desc: 'Explora el catálogo, filtra por género, estudio o año, y encuentra algo que te llame la atención.',
    cta: 'Ir al buscador',
    to: '/search',
    accent: 'from-[#FF3B3B]/20 to-transparent',
    border: 'border-[#FF3B3B]/30',
    btnClass: 'bg-[#FF3B3B] hover:bg-[#FF5555] text-white',
  },
  {
    num: '02',
    icon: Trophy,
    title: 'Descubre los más populares',
    desc: 'Mira el ranking de los animes mejor valorados y más populares de todos los tiempos.',
    cta: 'Ver el ranking',
    to: '/top/rated',
    accent: 'from-amber-500/10 to-transparent',
    border: 'border-amber-500/20',
    btnClass: 'bg-[#11131A] hover:bg-amber-500/10 text-amber-400 border border-amber-500/20',
  },
  {
    num: '03',
    icon: CalendarDays,
    title: 'Mira la temporada actual',
    desc: 'Entérate de qué animes se están emitiendo ahora mismo y no te pierdas los estrenos.',
    cta: 'Ver temporada',
    to: '/seasonal',
    accent: 'from-violet-500/10 to-transparent',
    border: 'border-violet-500/20',
    btnClass: 'bg-[#11131A] hover:bg-violet-500/10 text-violet-400 border border-violet-500/20',
  },
];

const HowItWorksCard = () => (
  <div className="bg-[#11131A] border border-[#FF3B3B]/10 rounded-2xl p-6 md:p-8 relative overflow-hidden">
    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#FF3B3B]/20 to-transparent" />
    <div className="flex items-center gap-3 mb-6">
      <BookOpen size={16} className="text-[#FF3B3B]/60" />
      <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Cómo funciona Kiroku</p>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
      {[
        { step: '1', text: 'Busca un anime y abre su página de detalles' },
        { step: '2', text: 'Guárdalo como Mirando, Pendiente o Completado' },
        { step: '3', text: 'Tu perfil se actualiza con estadísticas y logros' },
      ].map(({ step, text }) => (
        <div key={step} className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 rounded-full border border-[#FF3B3B]/30 bg-[#FF3B3B]/5 flex items-center justify-center text-[#FF3B3B] font-black text-sm">
            {step}
          </div>
          <p className="text-zinc-400 text-sm leading-relaxed">{text}</p>
        </div>
      ))}
    </div>
  </div>
);

interface ProfileOnboardingProps {
  username: string;
  /** Necesario para el selector rápido, que guarda directo en la lista. */
  userId: string;
  onImportClick?: () => void;
  onQuickStart: () => void | Promise<void>;
}

export const ProfileOnboarding = ({ username, userId, onImportClick, onQuickStart }: ProfileOnboardingProps) => (
  <div className="flex flex-col gap-6">

    {/* Bienvenida */}
    <div className="bg-[#11131A] border border-[#FF3B3B]/20 rounded-2xl p-8 md:p-10 relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#FF3B3B]/30 to-transparent" />
      <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-[#FF3B3B]/[0.04] blur-3xl pointer-events-none" />
      <p className="text-xs font-bold uppercase tracking-widest text-[#FF3B3B]/60 mb-3">Bienvenido</p>
      <h2 className="text-3xl md:text-4xl font-black text-white mb-3 tracking-tight">
        Hola, <span className="text-[#FF3B3B]">{username}</span>
      </h2>
      <p className="text-zinc-400 text-base max-w-lg leading-relaxed">
        Tu lista está vacía. Empieza agregando animes para llevar el control de lo que ves y desbloquear estadísticas y logros.
      </p>
    </div>

    {/* Lo primero, porque es lo que menos cuesta: cinco clics y el perfil
        deja de estar vacío. Importar sigue siendo mejor si ya tenés lista. */}
    <QuickStartPicker userId={userId} onSaved={onQuickStart} />

    {/* Importar desde MyAnimeList — destacado */}
    {onImportClick && (
      <div className="bg-gradient-to-br from-[#FF3B3B]/15 via-[#11131A] to-[#11131A] border border-[#FF3B3B]/40 rounded-2xl p-8 md:p-10 relative overflow-hidden flex flex-col md:flex-row items-center gap-6 md:gap-10 justify-between">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#FF3B3B]/50 to-transparent" />
        <div className="absolute -left-20 -bottom-20 w-72 h-72 rounded-full bg-[#FF3B3B]/[0.08] blur-3xl pointer-events-none" />
        <div className="relative flex items-start gap-4">
          <div className="w-12 h-12 shrink-0 rounded-xl bg-[#FF3B3B]/15 border border-[#FF3B3B]/30 flex items-center justify-center">
            <Upload size={20} className="text-[#FF3B3B]" />
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-[#FF3B3B] mb-2">
              <Sparkles size={12} /> Atajo recomendado
            </p>
            <h3 className="text-white font-black text-xl mb-2">¿Ya tenés una lista en MyAnimeList?</h3>
            <p className="text-zinc-400 text-sm leading-relaxed max-w-md">
              Importá tu lista exportada (.xml o .xml.gz) y armá tu perfil, estadísticas y logros al instante, sin agregar animes uno por uno.
            </p>
          </div>
        </div>
        <button
          onClick={onImportClick}
          className="relative shrink-0 inline-flex items-center gap-2 px-6 py-3.5 bg-[#FF3B3B] hover:bg-[#FF5555] text-white rounded-xl font-black text-xs uppercase tracking-widest transition-colors shadow-[0_8px_30px_rgba(255,59,59,0.25)]"
        >
          <Upload size={15} /> Importar mi lista
        </button>
      </div>
    )}

    {/* Pasos */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {steps.map(({ num, icon: Icon, title, desc, cta, to, accent, border, btnClass }) => (
        <div
          key={num}
          className={`bg-[#11131A] border ${border} rounded-2xl p-6 flex flex-col gap-4 relative overflow-hidden`}
        >
          <div className={`absolute inset-0 bg-gradient-to-br ${accent} pointer-events-none`} />
          <div className="relative flex items-start justify-between">
            <div className="w-10 h-10 rounded-xl bg-[#0D0F15] border border-[#FF3B3B]/10 flex items-center justify-center">
              <Icon size={18} className="text-zinc-400" />
            </div>
            <span className="text-4xl font-black text-white/[0.04] select-none leading-none">{num}</span>
          </div>
          <div className="relative flex-1">
            <h3 className="text-white font-black text-base mb-2">{title}</h3>
            <p className="text-zinc-500 text-sm leading-relaxed">{desc}</p>
          </div>
          <Link
            to={to}
            className={`relative inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${btnClass}`}
          >
            {cta} <ArrowRight size={13} />
          </Link>
        </div>
      ))}
    </div>

    {/* Cómo funciona */}
    <HowItWorksCard />
  </div>
);
