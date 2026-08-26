import { useState, useEffect } from 'react';
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

export const FollowersModal = ({
  profileId,
  profileUsername,
  initialTab = 'followers',
  onClose,
}: FollowersModalProps) => {
  const [tab, setTab] = useState<'followers' | 'following'>(initialTab);
  const [followers, setFollowers] = useState<ProfileUser[]>([]);
  const [following, setFollowing] = useState<ProfileUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Two steps instead of an embedded (follower_id → profiles) select:
    // `profiles` itself only allows reading your own row now, so the
    // FK-embedded shorthand would return nothing for anyone else. Fetch the
    // id lists first, then batch-resolve them against the public view.
    const resolveProfiles = async (ids: string[]): Promise<Map<string, ProfileUser>> => {
      if (ids.length === 0) return new Map();
      const { data } = await supabase
        .from('public_profiles')
        .select('id, username, avatar_url')
        .in('id', ids);
      return new Map((data ?? []).map((p: ProfileUser) => [p.id, p]));
    };

    const fetchBoth = async () => {
      setLoading(true);
      const [followersRes, followingRes] = await Promise.all([
        supabase
          .from('profile_followers')
          .select('follower_id')
          .eq('following_id', profileId)
          .order('created_at', { ascending: false }),
        supabase
          .from('profile_followers')
          .select('following_id')
          .eq('follower_id', profileId)
          .order('created_at', { ascending: false }),
      ]);

      const followerIds = (followersRes.data ?? []).map(r => r.follower_id as string);
      const followingIds = (followingRes.data ?? []).map(r => r.following_id as string);
      const [followerProfiles, followingProfiles] = await Promise.all([
        resolveProfiles(followerIds),
        resolveProfiles(followingIds),
      ]);

      setFollowers(followerIds.map(id => followerProfiles.get(id)).filter((p): p is ProfileUser => !!p));
      setFollowing(followingIds.map(id => followingProfiles.get(id)).filter((p): p is ProfileUser => !!p));
      setLoading(false);
    };
    fetchBoth();
  }, [profileId]);

  const list = tab === 'followers' ? followers : following;

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
                <><Users size={13} /> Seguidores ({followers.length})</>
              ) : (
                <><UserCheck size={13} /> Siguiendo ({following.length})</>
              )}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="flex justify-center items-center py-16">
              <Loader2 className="animate-spin text-[#FF3B3B]" size={24} />
            </div>
          ) : list.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-zinc-600 text-sm font-bold">
                {tab === 'followers' ? 'Sin seguidores aún' : 'No sigue a nadie aún'}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-[#FF3B3B]/5">
              {list.map(user => (
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
          )}
        </div>
      </div>
    </div>
  );
};
