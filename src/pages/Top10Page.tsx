import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Loader2, ArrowLeft, Trophy, Lock, Pencil, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useUserData } from '../contexts/UserDataContext';
import { useSocialProfile } from '../hooks/useSocialProfile';
import { useTop10 } from '../hooks/useTop10';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { Top10Podium } from '../components/profile/Top10Podium';
import { Top10EditorModal } from '../components/profile/Top10EditorModal';
import type { SavedAnime } from '../types/profile';

interface MiniProfile {
  id: string;
  username: string;
  avatar_url: string | null;
  is_private: boolean;
}

const NotFound = ({ username }: { username?: string }) => (
  <div className="min-h-screen bg-[var(--kr-bg)] flex flex-col items-center justify-center gap-6 px-4">
    <div className="w-20 h-20 rounded-2xl bg-[var(--kr-surface)] border border-[#FF3B3B]/20 flex items-center justify-center text-4xl font-black text-zinc-700">
      ?
    </div>
    <div className="text-center">
      <h1 className="text-2xl font-black text-[var(--kr-text)] mb-2">Perfil no encontrado</h1>
      <p className="text-zinc-500 text-sm">@{username} no existe o no tiene perfil público.</p>
    </div>
    <Link
      to="/search"
      className="flex items-center gap-2 px-6 py-3 bg-[#FF3B3B] text-[var(--kr-text)] font-black text-xs uppercase tracking-widest rounded-xl hover:bg-[#FF6B6B] transition-colors"
    >
      <ArrowLeft size={14} /> Volver al inicio
    </Link>
  </div>
);

export const Top10Page = () => {
  const { username } = useParams<{ username: string }>();
  const { session } = useUserData();
  const currentUserId = session?.user?.id ?? null;

  const [profile, setProfile] = useState<MiniProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [ownAnimes, setOwnAnimes] = useState<SavedAnime[]>([]);
  const [showEditor, setShowEditor] = useState(false);

  useDocumentTitle(username ? `Top 10 de @${username}` : 'Top 10');

  useEffect(() => {
    if (!username) return;
    let cancelled = false;

    const fetchProfile = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('public_profiles')
        .select('id, username, avatar_url, is_private')
        .eq('username', username)
        .single();

      if (cancelled) return;
      if (!data) { setNotFound(true); setLoading(false); return; }
      setProfile(data as MiniProfile);
      setLoading(false);
    };
    fetchProfile();

    return () => { cancelled = true; };
  }, [username]);

  const social = useSocialProfile(profile?.id ?? null, currentUserId);
  const top10 = useTop10(profile?.id ?? null);
  const isOwner = !!profile && profile.id === currentUserId;
  const isLocked = !!profile && profile.is_private && !isOwner && !social.loading && !social.isFollowing;

  const fetchOwnAnimes = useCallback(async () => {
    if (!currentUserId) return;
    const { data } = await supabase
      .from('saved_animes').select('*')
      .eq('user_id', currentUserId)
      .order('created_at', { ascending: false });
    if (data) setOwnAnimes(data as SavedAnime[]);
  }, [currentUserId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isOwner) fetchOwnAnimes();
  }, [isOwner, fetchOwnAnimes]);

  if (loading) return (
    <div className="flex justify-center items-center h-screen bg-[var(--kr-bg)]">
      <Loader2 className="animate-spin text-[#FF3B3B]" size={28} />
    </div>
  );
  if (notFound || !profile) return <NotFound username={username} />;

  const rest = top10.entries.filter(e => e.rank > 5);

  return (
    <div className="min-h-screen bg-[var(--kr-bg)] font-sans">
      <div className="container mx-auto px-4 md:px-8 pt-32 md:pt-36 pb-24 max-w-[1100px]">

        <Link
          to={isOwner ? '/profile' : `/u/${username}`}
          className="inline-flex items-center gap-2 text-zinc-500 hover:text-[#FF3B3B] text-xs font-bold uppercase tracking-widest transition-colors mb-8"
        >
          <ArrowLeft size={14} /> Volver al perfil
        </Link>

        {/* Header */}
        <div className="flex items-center gap-4 mb-10 flex-wrap">
          <div className="w-14 h-14 rounded-xl overflow-hidden bg-[var(--kr-surface)] border border-[#FF3B3B]/20 flex items-center justify-center text-xl font-black text-[var(--kr-text)] shrink-0">
            {profile.avatar_url
              ? <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
              : profile.username.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#FF3B3B]/60 flex items-center gap-1.5 mb-1">
              <Trophy size={12} /> Top 10
            </p>
            <h1 className="text-2xl md:text-3xl font-black text-[var(--kr-text)] truncate">
              {isOwner ? 'Mi Top 10' : `Top 10 de @${profile.username}`}
            </h1>
          </div>
          {isOwner && !isLocked && (
            <button
              onClick={() => setShowEditor(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-[var(--kr-surface-sunken)] border border-[#FF3B3B]/20 hover:border-[#FF3B3B]/50 text-zinc-400 hover:text-[#FF3B3B] font-black text-[11px] uppercase tracking-widest rounded-xl transition-colors shrink-0"
            >
              {top10.entries.length > 0 ? <><Pencil size={13} /> Editar</> : <><Plus size={13} /> Crear mi Top 10</>}
            </button>
          )}
        </div>

        {isLocked ? (
          <div className="bg-[var(--kr-surface)] border border-[#FF3B3B]/10 rounded-2xl px-8 py-16 flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[var(--kr-surface-sunken)] border border-[#FF3B3B]/20 flex items-center justify-center">
              <Lock size={22} className="text-[#FF3B3B]/60" />
            </div>
            <div>
              <h2 className="text-lg font-black text-[var(--kr-text)] mb-1">Este perfil es privado</h2>
              <p className="text-zinc-500 text-sm max-w-sm">
                Seguí a @{profile.username} para ver su Top 10.
              </p>
            </div>
          </div>
        ) : top10.loading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="animate-spin text-[#FF3B3B]" size={24} />
          </div>
        ) : top10.entries.length === 0 ? (
          <div className="bg-[var(--kr-surface)] border border-[#FF3B3B]/10 rounded-2xl px-8 py-16 flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#FF3B3B]/10 border border-[#FF3B3B]/20 flex items-center justify-center">
              <Trophy size={22} className="text-[#FF3B3B]/60" />
            </div>
            <p className="text-zinc-400 text-sm font-bold max-w-xs">
              {isOwner
                ? 'Todavía no armaste tu Top 10. Elegí entre tus animes completados y ordenalos como quieras.'
                : `@${profile.username} todavía no armó su Top 10.`}
            </p>
          </div>
        ) : (
          <div className="bg-[var(--kr-surface)] border border-[#FF3B3B]/10 rounded-2xl p-6 md:p-10 relative overflow-hidden">
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-80 bg-[#FF3B3B]/10 blur-[110px] rounded-full pointer-events-none" />

            <div className="relative z-10">
              <Top10Podium entries={top10.entries.filter(e => e.rank <= 5)} size="large" />

              {rest.length > 0 && (
                <div className="mt-12 flex flex-col gap-2.5">
                  {rest.map(entry => (
                    <Link
                      key={entry.anime_id}
                      to={`/anime/${entry.anime_id}`}
                      className="group flex items-center gap-4 bg-[var(--kr-surface-sunken)] border border-[#FF3B3B]/[0.08] hover:border-[#FF3B3B]/40 rounded-xl p-2.5 pr-4 transition-colors"
                    >
                      <span className="w-8 shrink-0 text-center font-black text-[#FF3B3B]/70 text-lg tabular-nums">
                        {entry.rank}
                      </span>
                      <img
                        src={entry.image_url}
                        alt={entry.title}
                        loading="lazy"
                        className="w-12 h-16 object-cover rounded-lg shrink-0"
                      />
                      <span className="flex-1 min-w-0 text-sm font-bold text-[var(--kr-text)] group-hover:text-[#FF7777] transition-colors line-clamp-2">
                        {entry.title}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showEditor && isOwner && (
        <Top10EditorModal
          animes={ownAnimes}
          initialEntries={top10.entries}
          onClose={() => setShowEditor(false)}
          onSave={top10.save}
        />
      )}
    </div>
  );
};
