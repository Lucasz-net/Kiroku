import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Loader2 } from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';
import { useUserData } from '../../contexts/UserDataContext';
import { NotificationItem } from './NotificationItem';

const PREVIEW_COUNT = 6;

export const NotificationBell = () => {
  const { session } = useUserData();
  const { items, unread, loading, markAllSeen, refresh } = useNotifications(PREVIEW_COUNT);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  if (!session) return null;

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    // Abrirla cuenta como verlas: se refresca primero para no marcar como
    // vista una notificación que llegó mientras el panel estaba cerrado.
    if (next) refresh().then(markAllSeen);
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        onClick={handleToggle}
        aria-label={unread > 0 ? `Notificaciones (${unread} sin leer)` : 'Notificaciones'}
        aria-expanded={open}
        className={`relative flex items-center justify-center w-9 h-9 md:w-10 md:h-10 bg-[var(--kr-glass-2)] border rounded-lg transition-colors ${
          open
            ? 'border-[#FF3B3B]/50 text-[#FF3B3B]'
            : 'border-[#FF3B3B]/20 text-zinc-400 hover:text-[#FF3B3B] hover:border-[#FF3B3B]/50'
        }`}
      >
        <Bell size={17} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 flex items-center justify-center rounded-full bg-[#FF3B3B] text-[var(--kr-text)] text-[9px] font-black tabular-nums border-2 border-[var(--kr-surface)]">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        // En celular el botón no siempre está pegado al borde derecho de la
        // pantalla (hay perfil/menú a su lado), así que anclar el panel con
        // `right-0` lo hacía salirse por la izquierda. Se fija al viewport
        // con márgenes parejos en mobile, y vuelve a anclarse al botón desde md.
        <div className="fixed inset-x-4 top-[84px] z-50 md:absolute md:inset-x-auto md:top-full md:right-0 md:mt-3 md:w-[22rem] bg-[var(--kr-surface)] border border-[#FF3B3B]/25 rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.7)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#FF3B3B]/10 flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-widest text-zinc-400">
              Notificaciones
            </span>
          </div>

          <div className="max-h-[22rem] overflow-y-auto divide-y divide-[#FF3B3B]/5">
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 size={18} className="animate-spin text-[#FF3B3B]" />
              </div>
            ) : items.length === 0 ? (
              <div className="py-10 px-6 text-center">
                <p className="text-xs font-bold text-zinc-500">Todavía no hay nada por acá.</p>
                <p className="text-[11px] text-zinc-700 mt-1 leading-relaxed">
                  Seguí a otras cuentas para ver qué están mirando.
                </p>
              </div>
            ) : (
              items.map((n, i) => (
                <NotificationItem
                  key={`${n.kind}-${n.actor_id}-${n.subject_id ?? ''}-${n.created_at}-${i}`}
                  notification={n}
                  onNavigate={() => setOpen(false)}
                />
              ))
            )}
          </div>

          <Link
            to="/notificaciones"
            onClick={() => setOpen(false)}
            className="block px-4 py-3 border-t border-[#FF3B3B]/10 text-center text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-[#FF3B3B] hover:bg-[var(--kr-text)]/[0.02] transition-colors"
          >
            Ver todas las notificaciones
          </Link>
        </div>
      )}
    </div>
  );
};
