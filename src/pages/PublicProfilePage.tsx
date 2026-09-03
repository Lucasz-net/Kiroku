import { useEffect, useState, useMemo, useRef } from 'react';
import { prefersReducedMotion } from '../utils/motion';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { useParams, Link } from 'react-router-dom';
import { Profile } from './Profile';
import { useUserData } from '../contexts/UserDataContext';
import { supabase } from '../lib/supabase';
import {
  Loader2, Tv, CheckCircle, Heart, Hourglass,
  Activity, ArrowLeft,
  Users, UserCheck, UserPlus, UserMinus, Lock, Clock,
} from 'lucide-react';
import type { UserProfile, SavedAnime, UserStats } from '../types/profile';
import { computeUserStats } from '../utils/animeUtils';
import { escapeLikePattern } from '../utils/likePattern';
import { ACHIEVEMENTS } from '../constants/profile';
import { AchievementGallery } from '../components/profile/AchievementGallery';
import { ActivityFeed } from '../components/profile/ActivityFeed';
import { AnimeGrid } from '../components/profile/AnimeGrid';
import { GenrePieChart } from '../components/profile/GenrePieChart';
import { StudioBarChart } from '../components/profile/StudioBarChart';
import { ProfileComments } from '../components/profile/ProfileComments';
import { FollowersModal } from '../components/profile/FollowersModal';
import { Top10Section } from '../components/profile/Top10Section';
import { FavoriteCharactersSection } from '../components/profile/FavoriteCharactersSection';
import { useSocialProfile } from '../hooks/useSocialProfile';
import { useTop10 } from '../hooks/useTop10';
import { useFavoriteCharacters } from '../hooks/useFavoriteCharacters';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

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

export const PublicProfilePage = () => {
  const { username } = useParams<{ username: string }>();
  const { session } = useUserData();
  const [ownUsername, setOwnUsername] = useState<string | null>(null);
  const [ownerChecked, setOwnerChecked] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [animes, setAnimes] = useState<SavedAnime[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [followersInitialTab, setFollowersInitialTab] = useState<'followers' | 'following'>('followers');

  // Comparación sin distinguir mayúsculas: la base trata los nombres de
  // usuario como case-insensitive, así que /u/luxioz siendo Luxioz también
  // es tu propio perfil y tiene que abrir la vista de dueño.
  const isOwnProfile = !!ownUsername && !!username
    && ownUsername.toLowerCase() === username.toLowerCase();

  const currentUserId = session?.user?.id ?? null;
  useDocumentTitle(username ? `@${username}` : 'Perfil');

  useEffect(() => {
    const checkOwner = async () => {
      if (!session) { setOwnerChecked(true); return; }
      const { data } = await supabase.from('profiles').select('username').eq('id', session.user.id).single();
      setOwnUsername(data?.username ?? null);
      setOwnerChecked(true);
    };
    checkOwner();
  }, [session]);

  useEffect(() => {
    if (!ownerChecked) return;
    if (isOwnProfile) { setLoading(false); return; }
    if (!username) return;

    const fetchProfile = async () => {
      try {
        // `public_profiles` is a view that deliberately excludes `email` —
        // viewing someone else's profile has no business seeing their email.
        // `ilike` sin comodines = igualdad sin distinguir mayúsculas, que es
        // como la base trata los nombres de usuario (el índice único es sobre
        // lower(username)). Con `eq`, /u/luxioz daba "perfil no encontrado"
        // para el usuario Luxioz — justo el link que reparte "Compartir perfil".
        // El escape es imprescindible: los nombres admiten `_`, que en LIKE
        // es comodín y haría resolver /u/a_b al perfil de axb.
        const { data: profileData } = await supabase
          .from('public_profiles').select('*')
          .ilike('username', escapeLikePattern(username))
          .maybeSingle();

        if (!profileData) { setNotFound(true); setLoading(false); return; }
        setProfile({ ...profileData, email: '' } as UserProfile);

        const { data: animesData } = await supabase
          .from('saved_animes').select('*')
          .eq('user_id', profileData.id)
          .order('created_at', { ascending: false });

        if (animesData) setAnimes(animesData as SavedAnime[]);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [ownerChecked, isOwnProfile, username]);

  const social = useSocialProfile(profile?.id ?? null, currentUserId);
  const top10 = useTop10(profile?.id ?? null);
  const favoriteCharacters = useFavoriteCharacters(profile?.id ?? null);

  const stats: UserStats = useMemo(() => computeUserStats(animes), [animes]);

  const unlockedAchievements = ACHIEVEMENTS.filter(ach => ach.req(stats));

  const heroStats = [
    { label: 'Completados',   value: stats.completed, icon: CheckCircle },
    { label: 'Episodios',     value: stats.episodes,  icon: Tv           },
    { label: 'Horas totales', value: stats.hours,     icon: Hourglass   },
    { label: 'Favoritos',     value: stats.favorites, icon: Heart        },
  ];

  const pageRef    = useRef<HTMLDivElement>(null);
  const counterRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useGSAP(() => {
    // Sin animaciones de entrada si el sistema pidió reducir el movimiento:
    // GSAP es quien pone el estado inicial, así que salir acá deja los
    // elementos directamente en su estado final. Ver utils/motion.ts.
    if (prefersReducedMotion()) return;
    if (loading || !pageRef.current) return;
    gsap.fromTo(
      '.profile-section',
      { y: 28, opacity: 0, filter: 'blur(6px)' },
      { y: 0, opacity: 1, filter: 'blur(0px)', stagger: 0.07, duration: 0.55, ease: 'power2.out', clearProps: 'all' }
    );
    counterRefs.current.forEach((el, i) => {
      if (!el) return;
      const target = heroStats[i].value;
      const obj = { val: 0 };
      gsap.to(obj, {
        val: target, duration: 1.35, ease: 'power2.out', delay: 0.18 + i * 0.08,
        onUpdate() { if (el) el.textContent = Math.round(obj.val).toLocaleString(); },
      });
    });
  }, { scope: pageRef, dependencies: [loading] });

  if (!ownerChecked || loading) return (
    <div className="flex justify-center items-center h-screen bg-[var(--kr-bg)]">
      <Loader2 className="animate-spin text-[#FF3B3B]" size={28} />
    </div>
  );
  if (isOwnProfile) return <Profile />;
  if (notFound || !profile) return <NotFound username={username} />;

  const isOwner = false;
  // While social.loading is true we don't yet know isFollowing, so hold off
  // deciding — otherwise a follower would flash the locked view for a beat.
  const isLocked = !!profile.is_private && !social.loading && !social.isFollowing;

  return (
    <div ref={pageRef} className="min-h-screen bg-[var(--kr-bg)] font-sans">
      <div className="container mx-auto px-4 md:px-8 pt-32 md:pt-36 pb-24 max-w-[1400px]">

        {/* Back link */}
        <Link
          to="/search"
          className="inline-flex items-center gap-2 text-zinc-500 hover:text-[#FF3B3B] text-xs font-bold uppercase tracking-widest transition-colors mb-8"
        >
          <ArrowLeft size={14} /> Volver
        </Link>

        {/* Profile header */}
        <div className="profile-section relative mb-8 rounded-2xl border border-[#FF3B3B]/20 overflow-hidden [transform:translateZ(0)]">
          {profile.banner_url && (
            <img src={profile.banner_url} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover" />
          )}
          <div className={`absolute inset-0 ${profile.banner_url ? 'bg-[var(--kr-glass-3)] backdrop-blur-[2px]' : 'bg-[var(--kr-glass-1)]'}`} />

          <div className="relative z-10 p-8 flex flex-col md:flex-row items-center md:items-start gap-8">
            {/* Avatar */}
            <div className="shrink-0 w-36 h-36 md:w-48 md:h-48 bg-[var(--kr-surface)] flex items-center justify-center text-6xl font-black text-[var(--kr-text)] rounded-xl border-4 border-[var(--kr-surface-sunken)]/60 overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.7)]">
              {profile.avatar_url
                ? <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                : profile.username?.charAt(0).toUpperCase()}
            </div>

            {/* Info */}
            <div className="flex-1 text-center md:text-left pt-2 md:pt-4">
              <p className="text-xs font-bold uppercase tracking-widest text-[#FF3B3B]/60 mb-1 flex items-center justify-center md:justify-start gap-1.5">
                {profile.is_private ? <Lock size={11} /> : <Activity size={11} />}
                {profile.is_private ? 'Perfil privado' : 'Perfil público'}
              </p>
              <h1 className="text-4xl md:text-5xl font-black text-[var(--kr-text)] mb-4 tracking-tight">
                {profile.username}
              </h1>
              {!isLocked && profile.bio && (
                <p className="text-zinc-400 text-sm leading-relaxed max-w-2xl bg-[var(--kr-glass-3)] backdrop-blur-sm p-4 rounded-lg border-l-2 border-[#FF3B3B]/30 mb-4">
                  {profile.bio}
                </p>
              )}

              {/* Social counts */}
              {!isLocked && (
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:flex sm:items-center sm:gap-4 justify-center md:justify-start">
                  <button
                    onClick={() => { setFollowersInitialTab('followers'); setShowFollowersModal(true); }}
                    className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-[var(--kr-text)] transition-colors"
                  >
                    <Users size={13} className="text-[#FF3B3B]/40" />
                    <span className="text-[var(--kr-text)] font-black">{social.followersCount}</span>
                    Seguidores
                  </button>
                  <span className="hidden sm:inline text-zinc-700">·</span>
                  <button
                    onClick={() => { setFollowersInitialTab('following'); setShowFollowersModal(true); }}
                    className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-[var(--kr-text)] transition-colors"
                  >
                    <UserCheck size={13} className="text-[#FF3B3B]/40" />
                    <span className="text-[var(--kr-text)] font-black">{social.followingCount}</span>
                    Siguiendo
                  </button>
                  <span className="hidden sm:inline text-zinc-700">·</span>
                  <span className="flex items-center gap-1.5 text-xs font-bold text-zinc-500">
                    <Heart size={13} className="text-[#FF3B3B]/40" />
                    <span className="text-[var(--kr-text)] font-black">{social.likesCount}</span>
                    Me gustas
                  </span>
                </div>
              )}
            </div>

            {/* Right actions */}
            <div className="shrink-0 flex flex-col gap-2">
              {/* Quick totals */}
              {!isLocked && (
                <>
                  <div className="bg-[var(--kr-glass-2)] border border-[#FF3B3B]/10 rounded-xl px-5 py-3 text-center">
                    <span className="block text-2xl font-black text-[var(--kr-text)] tabular-nums">{animes.length}</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">en lista</span>
                  </div>
                  <div className="bg-[var(--kr-glass-2)] border border-[#FF3B3B]/10 rounded-xl px-5 py-3 text-center">
                    <span className="block text-2xl font-black text-[var(--kr-text)] tabular-nums">{unlockedAchievements.length}</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">logros</span>
                  </div>
                </>
              )}

              {/* Follow button */}
              {currentUserId && (
                <button
                  onClick={social.toggleFollow}
                  disabled={social.loading}
                  title={social.followState === 'pending' ? 'Solicitud enviada — tocá para cancelarla' : undefined}
                  className={`flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
                    social.followState === 'accepted'
                      ? 'bg-[#FF3B3B]/10 border border-[#FF3B3B]/30 text-[#FF3B3B] hover:bg-[#FF3B3B]/20'
                      : social.followState === 'pending'
                        ? 'bg-[var(--kr-surface-sunken)] border border-[#FF3B3B]/20 text-zinc-400 hover:text-[#FF3B3B] hover:border-[#FF3B3B]/40'
                        : 'bg-[#FF3B3B] text-[var(--kr-text)] hover:bg-[#FF6B6B]'
                  } disabled:opacity-50`}
                >
                  {social.followState === 'accepted' ? (
                    <><UserMinus size={14} /> Siguiendo</>
                  ) : social.followState === 'pending' ? (
                    <><Clock size={14} /> Solicitado</>
                  ) : (
                    <><UserPlus size={14} /> Seguir</>
                  )}
                </button>
              )}

              {/* Like button */}
              {currentUserId && !isLocked && (
                <button
                  onClick={social.toggleLike}
                  disabled={social.loading}
                  className={`flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all border ${
                    social.isLiked
                      ? 'bg-[#FF3B3B]/10 border-[#FF3B3B]/40 text-[#FF3B3B]'
                      : 'border-[#FF3B3B]/15 text-zinc-500 hover:border-[#FF3B3B]/40 hover:text-[#FF3B3B] hover:bg-[#FF3B3B]/5'
                  } disabled:opacity-50`}
                >
                  <Heart size={14} className={social.isLiked ? 'fill-current' : ''} />
                  {social.isLiked ? 'Te gusta' : 'Me gusta'}
                </button>
              )}
            </div>
          </div>
        </div>

        {isLocked ? (
          <div className="profile-section bg-[var(--kr-surface)] border border-[#FF3B3B]/10 rounded-2xl px-8 py-16 flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[var(--kr-surface-sunken)] border border-[#FF3B3B]/20 flex items-center justify-center">
              <Lock size={22} className="text-[#FF3B3B]/60" />
            </div>
            <div>
              <h2 className="text-lg font-black text-[var(--kr-text)] mb-1">Este perfil es privado</h2>
              <p className="text-zinc-500 text-sm max-w-sm">
                {social.followState === 'pending'
                  ? `Tu solicitud está esperando que @${profile.username} la acepte. Cuando lo haga vas a ver su actividad, estadísticas, listas y comentarios.`
                  : `Pedile seguirlo a @${profile.username}. Cuando acepte tu solicitud vas a ver su actividad, estadísticas, listas y comentarios.`}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Hero stat bar */}
            <div className="profile-section grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
              {heroStats.map((stat, i) => (
                <div
                  key={stat.label}
                  className="relative bg-[var(--kr-surface)] border border-[#FF3B3B]/10 rounded-xl px-5 py-4 overflow-hidden flex items-center gap-4"
                >
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#FF3B3B]/20 to-transparent" />
                  <stat.icon size={22} className="text-[#FF3B3B]/40 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-1 truncate">{stat.label}</p>
                    <span
                      ref={el => { counterRefs.current[i] = el; }}
                      className="block text-3xl xl:text-4xl font-black text-[var(--kr-text)] tracking-tight leading-none tabular-nums"
                    >
                      0
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Mi Top 10 + Métricas */}
            <div className="mb-8">
              <Top10Section
                entries={top10.entries}
                username={profile.username}
                isOwner={false}
                metrics={{ minutes: stats.minutes, days: stats.days, watching: stats.watching, pending: stats.pending }}
              />
            </div>

            {/* Main grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-4 flex flex-col gap-5">
                <div className="profile-section"><FavoriteCharactersSection characters={favoriteCharacters.entries} /></div>
                <GenrePieChart genres={stats.topGenres} />
                <StudioBarChart studios={stats.topStudios} />
                <div className="profile-section"><ActivityFeed animes={animes} /></div>
                <div className="profile-section"><AchievementGallery unlockedAchievements={unlockedAchievements} /></div>
              </div>

              <div className="profile-section lg:col-span-8">
                <AnimeGrid animes={animes} sortPreference={profile.anime_sort ?? null} />
              </div>
            </div>

            {/* Comments */}
            <div className="mt-8">
              <ProfileComments
                profileId={profile.id}
                currentUserId={currentUserId}
                isOwner={isOwner}
                commentsEnabled={profile.comments_enabled !== false}
              />
            </div>
          </>
        )}
      </div>

      {showFollowersModal && (
        <FollowersModal
          profileId={profile.id}
          profileUsername={profile.username}
          initialTab={followersInitialTab}
          onClose={() => setShowFollowersModal(false)}
        />
      )}
    </div>
  );
};
