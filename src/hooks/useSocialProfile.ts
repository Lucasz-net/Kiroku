import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';

export interface SocialStats {
  followersCount: number;
  followingCount: number;
  likesCount: number;
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
        supabase
          .from('profile_followers')
          .select('*', { count: 'exact', head: true })
          .eq('following_id', profileId),
        supabase
          .from('profile_followers')
          .select('*', { count: 'exact', head: true })
          .eq('follower_id', profileId),
        supabase
          .from('profile_likes')
          .select('*', { count: 'exact', head: true })
          .eq('profile_id', profileId),
        currentUserId
          ? supabase
              .from('profile_followers')
              .select('id')
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

    setStats({
      followersCount: followersRes.count ?? 0,
      followingCount: followingRes.count ?? 0,
      likesCount: likesRes.count ?? 0,
      isFollowing: !!isFollowingRes.data,
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
    const wasFollowing = stats.isFollowing;

    setStats(prev => ({
      ...prev,
      isFollowing: !wasFollowing,
      followersCount: wasFollowing
        ? prev.followersCount - 1
        : prev.followersCount + 1,
    }));

    const { error } = wasFollowing
      ? await supabase
          .from('profile_followers')
          .delete()
          .eq('follower_id', currentUserId)
          .eq('following_id', profileId)
      : await supabase
          .from('profile_followers')
          .insert({ follower_id: currentUserId, following_id: profileId });

    if (error) {
      setStats(prev => ({
        ...prev,
        isFollowing: wasFollowing,
        followersCount: wasFollowing
          ? prev.followersCount + 1
          : prev.followersCount - 1,
      }));
      toast.error(wasFollowing ? 'Error al dejar de seguir.' : 'Error al seguir.');
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
