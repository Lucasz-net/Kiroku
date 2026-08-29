import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, Loader2, Users } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import { useUserData } from '../contexts/UserDataContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { NotificationItem } from '../components/notifications/NotificationItem';

export const NotificationsPage = () => {
  useDocumentTitle('Notificaciones');
  const navigate = useNavigate();
  const { session, authReady } = useUserData();
  const { items, loading, loadingMore, hasMore, loadMore, markAllSeen } = useNotifications();

  useEffect(() => {
    if (authReady && !session) navigate('/');
  }, [authReady, session, navigate]);

  // Entrar a la pantalla completa cuenta como haberlas visto.
  useEffect(() => {
    if (!loading) markAllSeen();
  }, [loading, markAllSeen]);

  return (
    <div className="min-h-screen bg-[#080A0F] font-sans pt-28 md:pt-32 pb-24">
      <div className="container mx-auto px-4 md:px-8 max-w-3xl">
        <div className="mb-8">
          <p className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-3 flex items-center gap-2">
            <Bell size={15} className="text-[#FF3B3B]/50" /> Tu actividad
          </p>
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight leading-none">
            Notificaciones
          </h1>
        </div>

        <div className="bg-[#11131A] border border-[#FF3B3B]/10 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 size={22} className="animate-spin text-[#FF3B3B]" />
            </div>
          ) : items.length === 0 ? (
            <div className="py-20 px-6 flex flex-col items-center text-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[#0D0F15] border border-[#FF3B3B]/15 flex items-center justify-center">
                <Bell size={22} className="text-[#FF3B3B]/50" />
              </div>
              <div>
                <p className="text-white font-black text-lg mb-1">Nada por acá todavía</p>
                <p className="text-zinc-500 text-sm max-w-sm leading-relaxed">
                  Acá vas a ver qué animes están mirando las cuentas que seguís, además de
                  seguidores nuevos y comentarios en tu perfil.
                </p>
              </div>
              <Link
                to="/profile"
                className="mt-1 flex items-center gap-2 px-5 py-2.5 bg-[#FF3B3B] text-white font-black text-[11px] uppercase tracking-widest rounded-xl hover:bg-[#FF6B6B] transition-colors"
              >
                <Users size={13} /> Buscar usuarios
              </Link>
            </div>
          ) : (
            <>
              <ul className="divide-y divide-[#FF3B3B]/5">
                {items.map((n, i) => (
                  <li key={`${n.kind}-${n.actor_id}-${n.subject_id ?? ''}-${n.created_at}-${i}`}>
                    <NotificationItem notification={n} />
                  </li>
                ))}
              </ul>

              {hasMore && (
                <div className="py-4 flex justify-center border-t border-[#FF3B3B]/5">
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-colors disabled:opacity-50"
                  >
                    {loadingMore && <Loader2 size={13} className="animate-spin" />}
                    Cargar más
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
