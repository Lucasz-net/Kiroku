import { Activity, Timer, CalendarDays, Play, Clock } from 'lucide-react';

interface DetailedMetricsProps {
  minutes: number;
  days: string;
  watching: number;
  pending: number;
}

const SPRING = 'transform 220ms cubic-bezier(0.34,1.56,0.64,1), box-shadow 200ms ease, border-color 150ms ease';

export const DetailedMetrics = ({ minutes, days, watching, pending }: DetailedMetricsProps) => (
  <div className="h-full flex flex-col">
    <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-5 flex items-center gap-2 shrink-0">
      <Activity size={14} className="text-[#FF3B3B]/50" /> Métricas detalladas
    </p>
    <div className="flex-1 flex items-center justify-center">
      <div className="grid grid-cols-2 gap-2.5 w-full max-w-sm">
        {([
          { label: 'Total en minutos', value: minutes.toLocaleString(), icon: Timer       },
          { label: 'Total en días',    value: days,                     icon: CalendarDays },
          { label: 'Mirando',          value: watching,                 icon: Play         },
          { label: 'Pendientes',       value: pending,                  icon: Clock        },
        ] as const).map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="bg-[var(--kr-surface-sunken)] border border-[#FF3B3B]/[0.07] rounded-xl p-4 cursor-default"
            style={{ transition: SPRING }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.transform = 'scale(1.04)';
              el.style.borderColor = 'rgba(255,59,59,0.2)';
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.transform = '';
              el.style.borderColor = '';
            }}
          >
            <Icon size={16} className="text-[#FF3B3B]/50 mb-3" />
            <span className="block text-2xl font-black text-[var(--kr-text)] tracking-tight leading-none mb-2 tabular-nums">
              {value}
            </span>
            <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">{label}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);
