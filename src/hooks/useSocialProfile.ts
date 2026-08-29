import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';

/**
 * `none`     — no hay relación.
 * `pending`  — se pidió seguir a un perfil privado y todavía no lo aceptaron.
 *              NO da visibilidad: `can_view_profile` solo cuenta las aceptadas.
 * `accepted` — se sigue de verdad.
 *
 * Quién puede estar en cada estado lo decide la base: un trigger fija
 * `status` al insertar según la privacidad del perfil destino, así que el
 * cliente no puede pedir 'accepted' por su cuenta.
 */
export type FollowState = 'none' | 'pending' | 'accepted';

export interface SocialStats {
  followersCount: number;
  followingCount: number;
  likesCount: number;
  followState: FollowState;
  /** Atajo para `followState === 'accepted'`. */
  isFollowing: boolean;
  isLiked: boolean;
  loading: boolean;
}

export interface UseSocialProfileReturn extends SocialStats {
  toggleFollow: () => Promise<void>;
  toggleLike: () => Promise<void>;
  refetch: () => Promise<void>;
}

export function useSocialProfile(
  profileId: string | null,
  currentUserId: string | null,
): UseSocialProfileReturn {
  const [stats, setStats] = useState<SocialStats>({
    followersCount: 0,
    followingCount: 0,
    likesCount: 0,
    followState: 'none',
    isFollowing: false,
    isLiked: false,
    loading: true,
  });
  const followPendingRef = useRef(false);
  const likePendingRef = useRef(false);

  const fetchStats = useCallback(async () => {
    if (!profileId) {
      setStats(s => ({ ...s, loading: false }));
      return;
    }

    const [followersRes, followingRes, likesRes, isFollowingRes, isLikedRes] =
      await Promise.all([
        // Las solicitudes pendientes no cuentan como seguidores: hasta que
        // se aceptan no dan visibilidad, así que tampoco tienen por qué
        // inflar el número que ve todo el mundo.
        supabase
          .from('profile_followers')
          .select('*', { count: 'exact', head: true })
          .eq('following_id', profileId)
          .eq('status', 'accepted'),
        supabase
          .from('profile_followers')
          .select('*', { count: 'exact', head: true })
          .eq('follower_id', profileId)
          .eq('status', 'accepted'),
        supabase
          .from('profile_likes')
          .select('*', { count: 'exact', head: true })
          .eq('profile_id', profileId),
        currentUserId
          ? supabase
              .from('profile_followers')
              .select('id, status')
              .eq('follower_id', currentUserId)
              .eq('following_id', profileId)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        currentUserId
          ? supabase
              .from('profile_likes')
              .select('id')
              .eq('user_id', currentUserId)
              .eq('profile_id', profileId)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

    const followRow = isFollowingRes.data as { status?: string } | null;
    const followState: FollowState =
      followRow?.status === 'accepted' ? 'accepted'
      : followRow ? 'pending'
      : 'none';

    setStats({
      followersCount: followersRes.count ?? 0,
      followingCount: followingRes.count ?? 0,
      likesCount: likesRes.count ?? 0,
      followState,
      isFollowing: followState === 'accepted',
      isLiked: !!isLikedRes.data,
      loading: false,
    });
  }, [profileId, currentUserId]);

  useEffect(() => {
    // fetchStats is async — its setState calls run after the awaited Supabase
    // requests resolve, not synchronously within this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchStats();
  }, [fetchStats]);

  const toggleFollow = async () => {
    if (!profileId || !currentUserId || followPendingRef.current) return;
    followPendingRef.current = true;
    const previous = stats.followState;

    // Dejar de seguir y cancelar una solicitud son el mismo DELETE, y se
    // pueden pintar de forma optimista porque el resultado es conocido.
    if (previous !== 'none') {
      setStats(prev => ({
        ...prev,
        followState: 'none',
        isFollowing: false,
        followersCount: previous === 'accepted' ? prev.followersCount - 1 : prev.followersCount,
      }));

      const { error } = await supabase
        .from('profile_followers')
        .delete()
        .eq('follower_id', currentUserId)
        .eq('following_id', profileId);

      if (error) {
        setStats(prev => ({
          ...prev,
          followState: previous,
          isFollowing: previous === 'accepted',
          followersCount: previous === 'accepted' ? prev.followersCount + 1 : prev.followersCount,
        }));
        toast.error(previous === 'accepted' ? 'Error al dejar de seguir.' : 'Error al cancelar la solicitud.');
      }
      followPendingRef.current = false;
      return;
    }

    // Al empezar a seguir no se puede ser optimista: si el perfil es privado
    // el trigger deja la fila en 'pending' y no en 'accepted'. Se lee el
    // estado que devolvió la base en vez de adivinarlo.
    const { data, error } = await supabase
      .from('profile_followers')
      .insert({ follower_id: currentUserId, following_id: profileId })
      .select('status')
      .single();

    if (error || !data) {
      toast.error('Error al seguir.');
    } else {
      const accepted = data.status === 'accepted';
      setStats(prev => ({
        ...prev,
        followState: accepted ? 'accepted' : 'pending',
        isFollowing: accepted,
        followersCount: accepted ? prev.followersCount + 1 : prev.followersCount,
      }));
      if (!accepted) toast.success('Solicitud enviada. Vas a poder ver el perfil cuando la acepten.');
    }
    followPendingRef.current = false;
  };

  const toggleLike = async () => {
    if (!profileId || !currentUserId || likePendingRef.current) return;
    likePendingRef.current = true;
    const wasLiked = stats.isLiked;

    setStats(prev => ({
      ...prev,
      isLiked: !wasLiked,
      likesCount: wasLiked ? prev.likesCount - 1 : prev.likesCount + 1,
    }));

    const { error } = wasLiked
      ? await supabase
          .from('profile_likes')
          .delete()
          .eq('user_id', currentUserId)
          .eq('profile_id', profileId)
      : await supabase
          .from('profile_likes')
          .insert({ user_id: currentUserId, profile_id: profileId });

    if (error) {
      setStats(prev => ({
        ...prev,
        isLiked: wasLiked,
        likesCount: wasLiked ? prev.likesCount + 1 : prev.likesCount - 1,
      }));
      toast.error(wasLiked ? 'Error al quitar el like.' : 'Error al dar like.');
    }
    likePendingRef.current = false;
  };

  return { ...stats, toggleFollow, toggleLike, refetch: fetchStats };
}
