import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { X, Users, UserCheck, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ProfileUser {
  id: string;
  username: string;
  avatar_url: string | null;
}

interface FollowersModalProps {
  profileId: string;
  profileUsername: string;
  initialTab?: 'followers' | 'following';
  onClose: () => void;
}

const PAGE_SIZE = 30;

type TabKey = 'followers' | 'following';

interface TabState {
  items: ProfileUser[];
  count: number;
  hasMore: boolean;
  loaded: boolean;
}

const emptyTabState: TabState = { items: [], count: 0, hasMore: true, loaded: false };

// `profiles` itself only allows reading your own row now, so an FK-embedded
// select (follower_id → profiles) would return nothing for anyone else.
// Fetch the id page first, then batch-resolve it against the public view.
const resolveProfiles = async (ids: string[]): Promise<Map<string, ProfileUser>> => {
  if (ids.length === 0) return new Map();
  const { data } = await supabase
    .from('public_profiles')
    .select('id, username, avatar_url')
    .in('id', ids);
  return new Map((data ?? []).map((p: ProfileUser) => [p.id, p]));
};

export const FollowersModal = ({
  profileId,
  profileUsername,
  initialTab = 'followers',
  onClose,
}: FollowersModalProps) => {
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [followers, setFollowers] = useState<TabState>(emptyTabState);
  const [following, setFollowing] = useState<TabState>(emptyTabState);
  const [loadingMore, setLoadingMore] = useState(false);

  const idColumn: Record<TabKey, 'follower_id' | 'following_id'> = {
    followers: 'follower_id',
    following: 'following_id',
  };
  const filterColumn: Record<TabKey, 'following_id' | 'follower_id'> = {
    followers: 'following_id',
    following: 'follower_id',
  };

  const fetchPage = useCallback(async (t: TabKey, offset: number) => {
    const { data } = await supabase
      .from('profile_followers')
      .select(idColumn[t])
      .eq(filterColumn[t], profileId)
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    const ids = (data ?? []).map(r => (r as Record<string, string>)[idColumn[t]]);
    const profiles = await resolveProfiles(ids);
    const items = ids.map(id => profiles.get(id)).filter((p): p is ProfileUser => !!p);
    return items;
  }, [profileId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadTab = useCallback(async (t: TabKey) => {
    const [{ count }, items] = await Promise.all([
      supabase
        .from('profile_followers')
        .select('*', { count: 'exact', head: true })
        .eq(filterColumn[t], profileId),
      fetchPage(t, 0),
    ]);
    const state: TabState = { items, count: count ?? 0, hasMore: items.length < (count ?? 0), loaded: true };
    (t === 'followers' ? setFollowers : setFollowing)(state);
  }, [profileId, fetchPage]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFollowers(emptyTabState);
    setFollowing(emptyTabState);
    setTab(initialTab);
    // loadTab is async — its setState calls run after the awaited Supabase
    // requests resolve, not synchronously within this effect.
    loadTab(initialTab);
  }, [profileId, initialTab, loadTab]);

  useEffect(() => {
    const current = tab === 'followers' ? followers : following;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!current.loaded) loadTab(tab);
  }, [tab, followers, following, loadTab]);

  const handleLoadMore = async () => {
    const current = tab === 'followers' ? followers : following;
    setLoadingMore(true);
    const items = await fetchPage(tab, current.items.length);
    const mergedItems = [...current.items, ...items];
    const merged: TabState = { ...current, items: mergedItems, hasMore: mergedItems.length < current.count };
    (tab === 'followers' ? setFollowers : setFollowing)(merged);
    setLoadingMore(false);
  };

  const current = tab === 'followers' ? followers : following;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-md bg-[#11131A] border border-[#FF3B3B]/20 rounded-2xl overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.8)]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#FF3B3B]/10">
          <h2 className="font-black text-white text-lg">@{profileUsername}</h2>
          <button
            onClick={onClose}
            className="p-2 text-zinc-500 hover:text-white transition-colors rounded-lg hover:bg-white/5"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#FF3B3B]/10">
          {(['followers', 'following'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 ${
                tab === t
                  ? 'text-[#FF3B3B] border-b-2 border-[#FF3B3B]'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {t === 'followers' ? (
                <><Users size={13} /> Seguidores ({followers.count})</>
              ) : (
                <><UserCheck size={13} /> Siguiendo ({following.count})</>
              )}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="max-h-[60vh] overflow-y-auto">
          {!current.loaded ? (
            <div className="flex justify-center items-center py-16">
              <Loader2 className="animate-spin text-[#FF3B3B]" size={24} />
            </div>
          ) : current.items.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-zinc-600 text-sm font-bold">
                {tab === 'followers' ? 'Sin seguidores aún' : 'No sigue a nadie aún'}
              </p>
            </div>
          ) : (
            <>
              <ul className="divide-y divide-[#FF3B3B]/5">
                {current.items.map(user => (
                  <li key={user.id}>
                    <Link
                      to={`/u/${user.username}`}
                      onClick={onClose}
                      className="flex items-center gap-4 px-6 py-4 hover:bg-white/[0.03] transition-colors"
                    >
                      <div className="w-10 h-10 rounded-xl bg-[#0D0F15] border border-[#FF3B3B]/10 overflow-hidden shrink-0 flex items-center justify-center font-black text-white text-sm">
                        {user.avatar_url ? (
                          <img
                            src={user.avatar_url}
                            alt={user.username}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          user.username?.charAt(0).toUpperCase()
                        )}
                      </div>
                      <span className="font-bold text-white text-sm">@{user.username}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              {current.hasMore && (
                <div className="py-4 flex justify-center">
                  <button
                    onClick={handleLoadMore}
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
