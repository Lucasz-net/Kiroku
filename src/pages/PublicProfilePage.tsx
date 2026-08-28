import { useEffect, useState, useMemo, useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { useParams, Link } from 'react-router-dom';
import { Profile } from './Profile';
import { useUserData } from '../contexts/UserDataContext';
import { supabase } from '../lib/supabase';
import {
  Loader2, Tv, CheckCircle, Heart, Hourglass,
  Activity, ArrowLeft,
  Users, UserCheck, UserPlus, UserMinus, Lock,
} from 'lucide-react';
import type { UserProfile, SavedAnime, UserStats } from '../types/profile';
import { parseDurationToMinutes } from '../utils/animeUtils';
import { ACHIEVEMENTS } from '../constants/profile';
import { AchievementGallery } from '../components/profile/AchievementGallery';
import { ActivityFeed } from '../components/profile/ActivityFeed';
import { AnimeGrid } from '../components/profile/AnimeGrid';
import { GenrePieChart } from '../components/profile/GenrePieChart';
import { StudioBarChart } from '../components/profile/StudioBarChart';
import { ProfileComments } from '../components/profile/ProfileComments';
import { FollowersModal } from '../components/profile/FollowersModal';
import { Top10Section } from '../components/profile/Top10Section';
import { useSocialProfile } from '../hooks/useSocialProfile';
import { useTop10 } from '../hooks/useTop10';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

const NotFound = ({ username }: { username?: string }) => (
  <div className="min-h-screen bg-[#080A0F] flex flex-col items-center justify-center gap-6 px-4">
    <div className="w-20 h-20 rounded-2xl bg-[#11131A] border border-[#FF3B3B]/20 flex items-center justify-center text-4xl font-black text-zinc-700">
      ?
    </div>
    <div className="text-center">
      <h1 className="text-2xl font-black text-white mb-2">Perfil no encontrado</h1>
      <p className="text-zinc-500 text-sm">@{username} no existe o no tiene perfil público.</p>
    </div>
    <Link
      to="/search"
      className="flex items-center gap-2 px-6 py-3 bg-[#FF3B3B] text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-[#FF6B6B] transition-colors"
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
    if (ownUsername === username) { setLoading(false); return; }
    if (!username) return;

    const fetchProfile = async () => {
      try {
        // `public_profiles` is a view that deliberately excludes `email` —
        // viewing someone else's profile has no business seeing their email.
        const { data: profileData } = await supabase
          .from('public_profiles').select('*').eq('username', username).single();

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
  }, [ownerChecked, ownUsername, username]);

  const social = useSocialProfile(profile?.id ?? null, currentUserId);
  const top10 = useTop10(profile?.id ?? null);

  const stats: UserStats = useMemo(() => {
    let episodes = 0, minutes = 0, completed = 0, favorites = 0, pending = 0, watching = 0;
    const genreCounts: Record<string, number> = {};
    const studioCounts: Record<string, number> = {};

    animes.forEach(anime => {
      if (anime.is_favorite) favorites++;
      if (anime.status === 'Pendiente') pending++;
      let epsWatched = 0;
      if (anime.status === 'Completado') {
        completed++;
        epsWatched = anime.episodes_total || anime.progress || 1;
        anime.genres?.forEach(g => { genreCounts[g] = (genreCounts[g] || 0) + 1; });
        anime.studios?.forEach(s => { studioCounts[s] = (studioCounts[s] || 0) + 1; });
      } else if (anime.status === 'Mirando') {
        watching++;
        epsWatched = anime.progress || 0;
      }
      if (epsWatched > 0) {
        episodes += epsWatched;
        minutes += epsWatched * parseDurationToMinutes(anime.duration);
      }
    });

    return {
      episodes, minutes,
      hours: Math.floor(minutes / 60),
      days: (minutes / 1440).toFixed(1),
      completed, pending, watching, favorites,
      topGenres: Object.entries(genreCounts)
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count).slice(0, 5),
      topStudios: Object.entries(studioCounts)
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count).slice(0, 5),
    };
  }, [animes]);

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
    <div className="flex justify-center items-center h-screen bg-[#080A0F]">
      <Loader2 className="animate-spin text-[#FF3B3B]" size={28} />
    </div>
  );
  if (ownUsername === username) return <Profile />;
  if (notFound || !profile) return <NotFound username={username} />;

  const isOwner = false;
  // While social.loading is true we don't yet know isFollowing, so hold off
  // deciding — otherwise a follower would flash the locked view for a beat.
  const isLocked = !!profile.is_private && !social.loading && !social.isFollowing;

  return (
    <div ref={pageRef} className="min-h-screen bg-[#080A0F] font-sans">
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
          <div className={`absolute inset-0 ${profile.banner_url ? 'bg-[#0D0F15]/70 backdrop-blur-[2px]' : 'bg-[#11131A]/90'}`} />

          <div className="relative z-10 p-8 flex flex-col md:flex-row items-center md:items-start gap-8">
            {/* Avatar */}
            <div className="shrink-0 w-36 h-36 md:w-48 md:h-48 bg-[#11131A] flex items-center justify-center text-6xl font-black text-white rounded-xl border-4 border-[#0D0F15]/60 overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.7)]">
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
              <h1 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight">
                {profile.username}
              </h1>
              {!isLocked && profile.bio && (
                <p className="text-zinc-400 text-sm leading-relaxed max-w-2xl bg-[#0D0F15]/60 backdrop-blur-sm p-4 rounded-lg border-l-2 border-[#FF3B3B]/30 mb-4">
                  {profile.bio}
                </p>
              )}

              {/* Social counts */}
              {!isLocked && (
                <div className="flex items-center gap-4 justify-center md:justify-start">
                  <button
                    onClick={() => { setFollowersInitialTab('followers'); setShowFollowersModal(true); }}
                    className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-white transition-colors"
                  >
                    <Users size={13} className="text-[#FF3B3B]/40" />
                    <span className="text-white font-black">{social.followersCount}</span>
                    Seguidores
                  </button>
                  <span className="text-zinc-700">·</span>
                  <button
                    onClick={() => { setFollowersInitialTab('following'); setShowFollowersModal(true); }}
                    className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-white transition-colors"
                  >
                    <UserCheck size={13} className="text-[#FF3B3B]/40" />
                    <span className="text-white font-black">{social.followingCount}</span>
                    Siguiendo
                  </button>
                  <span className="text-zinc-700">·</span>
                  <span className="flex items-center gap-1.5 text-xs font-bold text-zinc-500">
                    <Heart size={13} className="text-[#FF3B3B]/40" />
                    <span className="text-white font-black">{social.likesCount}</span>
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
                  <div className="bg-[#0D0F15]/80 border border-[#FF3B3B]/10 rounded-xl px-5 py-3 text-center">
                    <span className="block text-2xl font-black text-white tabular-nums">{animes.length}</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">en lista</span>
                  </div>
                  <div className="bg-[#0D0F15]/80 border border-[#FF3B3B]/10 rounded-xl px-5 py-3 text-center">
                    <span className="block text-2xl font-black text-white tabular-nums">{unlockedAchievements.length}</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">logros</span>
                  </div>
                </>
              )}

              {/* Follow button */}
              {currentUserId && (
                <button
                  onClick={social.toggleFollow}
                  disabled={social.loading}
                  className={`flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
                    social.isFollowing
                      ? 'bg-[#FF3B3B]/10 border border-[#FF3B3B]/30 text-[#FF3B3B] hover:bg-[#FF3B3B]/20'
                      : 'bg-[#FF3B3B] text-white hover:bg-[#FF6B6B]'
                  } disabled:opacity-50`}
                >
                  {social.isFollowing ? (
                    <><UserMinus size={14} /> Siguiendo</>
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
          <div className="profile-section bg-[#11131A] border border-[#FF3B3B]/10 rounded-2xl px-8 py-16 flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#0D0F15] border border-[#FF3B3B]/20 flex items-center justify-center">
              <Lock size={22} className="text-[#FF3B3B]/60" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white mb-1">Este perfil es privado</h2>
              <p className="text-zinc-500 text-sm max-w-sm">
                Seguí a @{profile.username} para ver su actividad, estadísticas, listas y comentarios.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Mi Top 10 + Métricas */}
            <div className="mb-8">
              <Top10Section
                entries={top10.entries}
                username={profile.username}
                isOwner={false}
                metrics={{ minutes: stats.minutes, days: stats.days, watching: stats.watching, pending: stats.pending }}
              />
            </div>

            {/* Hero stat bar */}
            <div className="profile-section grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
              {heroStats.map((stat, i) => (
                <div
                  key={stat.label}
                  className="relative bg-[#11131A] border border-[#FF3B3B]/10 rounded-xl px-5 py-4 overflow-hidden flex items-center gap-4"
                >
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#FF3B3B]/20 to-transparent" />
                  <stat.icon size={22} className="text-[#FF3B3B]/40 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-1 truncate">{stat.label}</p>
                    <span
                      ref={el => { counterRefs.current[i] = el; }}
                      className="block text-3xl xl:text-4xl font-black text-white tracking-tight leading-none tabular-nums"
                    >
                      0
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Main grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-4 flex flex-col gap-5">
                <GenrePieChart genres={stats.topGenres} />
                <StudioBarChart studios={stats.topStudios} />
                <div className="profile-section"><ActivityFeed animes={animes} /></div>
                <div className="profile-section"><AchievementGallery unlockedAchievements={unlockedAchievements} /></div>
              </div>

              <div className="profile-section lg:col-span-8">
                <AnimeGrid animes={animes} />
              </div>
            </div>

            {/* Comments */}
            <div className="mt-8">
              <ProfileComments
                profileId={profile.id}
                currentUserId={currentUserId}
                isOwner={isOwner}
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
