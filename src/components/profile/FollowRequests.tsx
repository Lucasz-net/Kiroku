import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { UserPlus, Check, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import type { PublicProfileSummary } from '../../types/profile';

interface FollowRequest {
  id: string;
  follower: PublicProfileSummary;
}

interface FollowRequestsProps {
  profileId: string;
  /** Se llama al aceptar, para que el perfil refresque su conteo de seguidores. */
  onAccepted?: () => void;
}

/**
 * Solicitudes pendientes de seguir un perfil privado. Solo se renderiza si
 * hay alguna: un perfil público nunca acumula pendientes (el trigger
 * `set_follow_status` marca esas filas como 'accepted' de entrada), así que
 * la sección simplemente no aparece.
 */
export const FollowRequests = ({ profileId, onAccepted }: FollowRequestsProps) => {
  const [requests, setRequests] = useState<FollowRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    const { data } = await supabase
      .from('profile_followers')
      .select('id, follower_id')
      .eq('following_id', profileId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    const rows = data ?? [];
    if (rows.length === 0) { setRequests([]); setLoading(false); return; }

    // `profiles` solo deja leer la fila propia, así que el autor de cada
    // solicitud se resuelve contra la vista pública — mismo patrón que
    // ProfileComments y FollowersModal.
    const { data: profiles } = await supabase
      .from('public_profiles')
      .select('id, username, avatar_url')
      .in('id', rows.map(r => r.follower_id as string));

    const byId = new Map((profiles ?? []).map(p => [p.id as string, p as PublicProfileSummary]));
    setRequests(
      rows
        .map(r => {
          const follower = byId.get(r.follower_id as string);
          return follower ? { id: r.id as string, follower } : null;
        })
        .filter((r): r is FollowRequest => r !== null),
    );
    setLoading(false);
  }, [profileId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRequests();
  }, [fetchRequests]);

  const respond = async (id: string, accept: boolean) => {
    setBusyId(id);
    const { error } = accept
      ? await supabase.from('profile_followers').update({ status: 'accepted' }).eq('id', id)
      : await supabase.from('profile_followers').delete().eq('id', id);

    if (error) {
      toast.error(accept ? 'No se pudo aceptar la solicitud.' : 'No se pudo rechazar la solicitud.');
    } else {
      setRequests(prev => prev.filter(r => r.id !== id));
      if (accept) onAccepted?.();
    }
    setBusyId(null);
  };

  if (loading || requests.length === 0) return null;

  return (
    <section className="profile-section bg-[#11131A] border border-[#FF3B3B]/20 rounded-2xl overflow-hidden">
      <div className="px-6 py-5 border-b border-[#FF3B3B]/10 flex items-center gap-2">
        <UserPlus size={15} className="text-[#FF3B3B]/60" />
        <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400">
          Solicitudes de seguimiento
        </h3>
        <span className="ml-auto text-xs font-black text-[#FF3B3B] tabular-nums">{requests.length}</span>
      </div>

      <ul className="divide-y divide-[#FF3B3B]/5">
        {requests.map(({ id, follower }) => (
          <li key={id} className="px-6 py-4 flex items-center gap-4">
            <Link
              to={`/u/${follower.username}`}
              className="w-10 h-10 rounded-xl bg-[#0D0F15] border border-[#FF3B3B]/10 overflow-hidden shrink-0 flex items-center justify-center font-black text-white text-sm hover:border-[#FF3B3B]/30 transition-colors"
            >
              {follower.avatar_url
                ? <img src={follower.avatar_url} alt={follower.username} className="w-full h-full object-cover" />
                : follower.username?.charAt(0).toUpperCase()}
            </Link>

            <Link
              to={`/u/${follower.username}`}
              className="flex-1 min-w-0 font-bold text-white text-sm truncate hover:text-[#FF3B3B] transition-colors"
            >
              @{follower.username}
            </Link>

            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => respond(id, true)}
                disabled={busyId === id}
                title="Aceptar"
                className="flex items-center gap-1.5 px-3 py-2 bg-[#FF3B3B] hover:bg-[#FF6B6B] disabled:opacity-40 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors"
              >
                {busyId === id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                Aceptar
              </button>
              <button
                onClick={() => respond(id, false)}
                disabled={busyId === id}
                title="Rechazar"
                className="p-2 bg-[#0D0F15] border border-[#FF3B3B]/15 hover:border-[#FF3B3B]/40 text-zinc-500 hover:text-[#FF3B3B] disabled:opacity-40 rounded-lg transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
};
