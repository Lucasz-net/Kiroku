import { useEffect, useState, useMemo, useRef, type ChangeEvent } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import {
  Tv, CheckCircle, Heart, Hourglass,
  CalendarDays, Timer, Play, Clock, Activity,
} from 'lucide-react';
import type { UserProfile, SavedAnime, UserStats } from '../types/profile';
import { toWebP } from '../utils/imageUtils';
import { ACHIEVEMENTS } from '../constants/profile';
import { parseDurationToMinutes } from '../utils/animeUtils';
import { ProfileHeader } from '../components/profile/ProfileHeader';
import { AchievementGallery } from '../components/profile/AchievementGallery';
import { AnimeGrid } from '../components/profile/AnimeGrid';
import { ActivityFeed } from '../components/profile/ActivityFeed';
import { ProfileOnboarding } from '../components/profile/ProfileOnboarding';
import { GenrePieChart } from '../components/profile/GenrePieChart';
import { StudioBarChart } from '../components/profile/StudioBarChart';
import { ProfileComments } from '../components/profile/ProfileComments';
import { ImportXMLModal } from '../components/profile/ImportXMLModal';
import { FollowersModal } from '../components/profile/FollowersModal';
import { DeleteAccountModal } from '../components/profile/DeleteAccountModal';
import { useSocialProfile } from '../hooks/useSocialProfile';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export const Profile = () => {

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [animes, setAnimes] = useState<SavedAnime[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [newBio, setNewBio] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [followersInitialTab, setFollowersInitialTab] = useState<'followers' | 'following'>('followers');
  const navigate = useNavigate();

  const pageRef = useRef<HTMLDivElement>(null);
  const counterRefs = useRef<(HTMLSpanElement | null)[]>([]);

  const social = useSocialProfile(profile?.id ?? null, profile?.id ?? null);
  useDocumentTitle(profile?.username ? `@${profile.username}` : 'Mi Perfil');

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (!currentSession) { navigate('/search'); return; }

        const { data: profileData } = await supabase
          .from('profiles').select('*').eq('id', currentSession.user.id).single();

        if (profileData) {
          setProfile(profileData as UserProfile);
          setNewBio(profileData.bio || '');
        } else {
          setProfile({
            id: currentSession.user.id,
            email: currentSession.user.email || '',
            username: currentSession.user.email?.split('@')[0] || 'usuario',
            avatar_url: null,
            banner_url: null,
            bio: null,
          });
        }

        const { data: animesData } = await supabase
          .from('saved_animes').select('*')
          .eq('user_id', currentSession.user.id)
          .order('created_at', { ascending: false });

        if (animesData) setAnimes(animesData as SavedAnime[]);
      } catch (error) {
        console.error('Error cargando perfil:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchUserData();
  }, [navigate]);

  const handleSignOut = async () => { await supabase.auth.signOut(); navigate('/'); };

  const handleRemove = async (id: string) => {
    const { error } = await supabase.from('saved_animes').delete().eq('id', id);
    if (!error) setAnimes(prev => prev.filter(a => a.id !== id));
  };

  const handleUpdateBio = async () => {
    if (!profile) return;
    try {
      const { error } = await supabase.from('profiles').update({ bio: newBio }).eq('id', profile.id);
      if (error) throw error;
      setProfile({ ...profile, bio: newBio });
      setIsEditingBio(false);
    } catch (error) { console.error(error); }
  };

  const handleBannerUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    try {
      setUploadingBanner(true);
      if (!event.target.files || event.target.files.length === 0 || !profile) return;
      const webp = await toWebP(event.target.files[0], 0.85, 1920);
      const filePath = `${profile.id}-${Date.now()}.webp`;
      const { error: uploadError } = await supabase.storage.from('banners').upload(filePath, webp, { contentType: 'image/webp', upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('banners').getPublicUrl(filePath);
      const { error: updateError } = await supabase.from('profiles').update({ banner_url: publicUrl }).eq('id', profile.id);
      if (updateError) throw updateError;
      setProfile({ ...profile, banner_url: publicUrl });
    } catch (error) {
      console.error(error);
      alert('Hubo un error al subir el banner.');
    } finally { setUploadingBanner(false); }
  };

  const handleAvatarUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    try {
      setUploadingAvatar(true);
      if (!event.target.files || event.target.files.length === 0 || !profile) return;
      const webp = await toWebP(event.target.files[0], 0.88, 800);
      const filePath = `${profile.id}-${Date.now()}.webp`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, webp, { contentType: 'image/webp', upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const { error: updateError } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', profile.id);
      if (updateError) throw updateError;
      setProfile({ ...profile, avatar_url: publicUrl });
    } catch (error) {
      console.error(error);
      alert('Hubo un error al subir la imagen.');
    } finally { setUploadingAvatar(false); }
  };

  const handleImportComplete = async () => {
    if (!profile) return;
    const { data: animesData } = await supabase
      .from('saved_animes').select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false });
    if (animesData) setAnimes(animesData as SavedAnime[]);
  };

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

  useGSAP(() => {
    if (loading || !pageRef.current) return;

    gsap.fromTo(
      '.profile-section',
      { y: 28, opacity: 0, filter: 'blur(6px)' },
      {
        y: 0, opacity: 1, filter: 'blur(0px)',
        stagger: 0.07, duration: 0.55, ease: 'power2.out',
        clearProps: 'all',
      }
    );

    counterRefs.current.forEach((el, i) => {
      if (!el) return;
      const target = heroStats[i].value;
      const obj = { val: 0 };
      gsap.to(obj, {
        val: target,
        duration: 1.35,
        ease: 'power2.out',
        delay: 0.18 + i * 0.08,
        onUpdate() { if (el) el.textContent = Math.round(obj.val).toLocaleString(); },
      });
    });
  }, { scope: pageRef, dependencies: [loading] });

  if (loading) return (
    <div className="relative min-h-screen bg-[#080A0F] font-sans">
      <div className="container mx-auto px-4 md:px-8 pt-32 md:pt-36 pb-24 max-w-[1400px]">
        <div className="mb-10 h-56 bg-[#11131A] rounded-2xl border border-[#FF3B3B]/10 animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-[#11131A] rounded-xl border border-[#FF3B3B]/10 animate-pulse" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 flex flex-col gap-5">
            {[...Array(3)].map((_, i) => <div key={i} className="h-44 bg-[#11131A] rounded-2xl border border-[#FF3B3B]/10 animate-pulse" />)}
          </div>
          <div className="lg:col-span-8 h-[500px] bg-[#11131A] rounded-2xl border border-[#FF3B3B]/10 animate-pulse" />
        </div>
      </div>
    </div>
  );
  if (!profile) return null;

  const spring = 'transform 220ms cubic-bezier(0.34,1.56,0.64,1), box-shadow 200ms ease, border-color 150ms ease';
  const existingAnimeIds = new Set(animes.map(a => a.anime_id));

  return (
    <div ref={pageRef} className="relative min-h-screen bg-[#080A0F] font-sans">
      <div className="relative z-10 container mx-auto px-4 md:px-8 pt-32 md:pt-36 pb-24 max-w-[1400px]">

        {/* ── PROFILE HEADER ─────────────────────────────────────────── */}
        <div className="profile-section mb-10">
          <ProfileHeader
            profile={profile}
            isEditingBio={isEditingBio}
            newBio={newBio}
            uploadingAvatar={uploadingAvatar}
            uploadingBanner={uploadingBanner}
            socialCounts={{
              followersCount: social.followersCount,
              followingCount: social.followingCount,
              likesCount: social.likesCount,
            }}
            onBioChange={setNewBio}
            onEditBio={() => setIsEditingBio(true)}
            onBioSave={handleUpdateBio}
            onBioCancel={() => { setIsEditingBio(false); setNewBio(profile.bio || ''); }}
            onAvatarUpload={handleAvatarUpload}
            onBannerUpload={handleBannerUpload}
            onSignOut={handleSignOut}
            onUsernameUpdate={u => setProfile(prev => prev ? { ...prev, username: u } : prev)}
            onPrivacyToggle={v => setProfile(prev => prev ? { ...prev, is_private: v } : prev)}
            onFollowersClick={() => { setFollowersInitialTab('followers'); setShowFollowersModal(true); }}
            onFollowingClick={() => { setFollowersInitialTab('following'); setShowFollowersModal(true); }}
            onImportClick={() => setShowImportModal(true)}
          />
        </div>

        {/* ── HERO STATS BAR ─────────────────────────────────────────── */}
        <div className="profile-section grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {heroStats.map((stat, i) => (
            <div
              key={stat.label}
              className="relative bg-[#11131A] border border-[#FF3B3B]/10 rounded-xl px-5 py-4 overflow-hidden cursor-default select-none flex items-center gap-4"
              style={{ transition: spring }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.transform = 'translateY(-3px)';
                el.style.boxShadow = '0 16px 36px rgba(255,59,59,0.07)';
                el.style.borderColor = 'rgba(255,59,59,0.24)';
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.transform = '';
                el.style.boxShadow = '';
                el.style.borderColor = '';
              }}
            >
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#FF3B3B]/20 to-transparent" />
              <stat.icon size={22} className="text-[#FF3B3B]/40 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-1 truncate">
                  {stat.label}
                </p>
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

        {/* ── ONBOARDING ─────────────────────────────────────────────── */}
        {animes.length === 0 && (
          <div className="profile-section mb-6">
            <ProfileOnboarding username={profile.username} onImportClick={() => setShowImportModal(true)} />
          </div>
        )}

        {/* ── MAIN GRID ──────────────────────────────────────────────── */}
        <div className={`grid grid-cols-1 lg:grid-cols-12 gap-6 ${animes.length === 0 ? 'hidden' : ''}`}>

          <div className="lg:col-span-4 flex flex-col gap-5">
            <div className="profile-section bg-[#11131A] border border-[#FF3B3B]/10 rounded-2xl p-6">
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-5 flex items-center gap-2">
                <Activity size={14} className="text-[#FF3B3B]/50" /> Métricas detalladas
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                {([
                  { label: 'Total en minutos', value: stats.minutes.toLocaleString(), icon: Timer       },
                  { label: 'Total en días',    value: stats.days,                     icon: CalendarDays },
                  { label: 'Mirando',    value: stats.watching,                 icon: Play         },
                  { label: 'Pendientes', value: stats.pending,                  icon: Clock        },
                ] as const).map(({ label, value, icon: Icon }) => (
                  <div
                    key={label}
                    className="bg-[#0D0F15] border border-[#FF3B3B]/[0.07] rounded-xl p-4 cursor-default"
                    style={{ transition: spring }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.transform = 'scale(1.04)';
                      el.style.borderColor = 'rgba(255,59,59,0.2)';
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.transform = '';
                      el.style.borderColor = '';
                    }}
                  >
                    <Icon size={16} className="text-[#FF3B3B]/50 mb-3" />
                    <span className="block text-2xl font-black text-white tracking-tight leading-none mb-2 tabular-nums">
                      {value}
                    </span>
                    <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <GenrePieChart genres={stats.topGenres} />
            <StudioBarChart studios={stats.topStudios} />
            <ActivityFeed animes={animes} />
            <div className="profile-section">
              <AchievementGallery unlockedAchievements={unlockedAchievements} />
            </div>
          </div>

          <div className="profile-section lg:col-span-8">
            <AnimeGrid animes={animes} onRemove={handleRemove} />
          </div>
        </div>

        {/* ── COMMENTS ───────────────────────────────────────────────── */}
        <div className="mt-8">
          <ProfileComments
            profileId={profile.id}
            currentUserId={profile.id}
            isOwner={true}
          />
        </div>

        {/* ── DANGER ZONE ────────────────────────────────────────────── */}
        <div className="mt-8 bg-[#11131A] border border-[#FF3B3B]/10 rounded-2xl px-6 py-5 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-black text-white mb-1">Eliminar cuenta</p>
            <p className="text-xs text-zinc-500">Borra tu cuenta y todos tus datos de forma permanente.</p>
          </div>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="px-4 py-2.5 bg-[#0D0F15] border border-[#FF3B3B]/20 hover:border-[#FF3B3B]/50 text-[#FF7777] hover:text-[#FF3B3B] font-black text-xs uppercase tracking-widest rounded-xl transition-colors shrink-0"
          >
            Eliminar cuenta
          </button>
        </div>
      </div>

      {/* ── MODALS ─────────────────────────────────────────────────── */}
      {showImportModal && (
        <ImportXMLModal
          userId={profile.id}
          existingAnimeIds={existingAnimeIds}
          onClose={() => setShowImportModal(false)}
          onImportComplete={handleImportComplete}
        />
      )}

      {showFollowersModal && (
        <FollowersModal
          profileId={profile.id}
          profileUsername={profile.username}
          initialTab={followersInitialTab}
          onClose={() => setShowFollowersModal(false)}
        />
      )}

      {showDeleteModal && (
        <DeleteAccountModal
          username={profile.username}
          onClose={() => setShowDeleteModal(false)}
        />
      )}
    </div>
  );
};
