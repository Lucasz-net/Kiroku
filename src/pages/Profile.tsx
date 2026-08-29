import { useEffect, useState, useMemo, useRef, type ChangeEvent } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import {
  Tv, CheckCircle, Heart, Hourglass,
} from 'lucide-react';
import type { UserProfile, SavedAnime, UserStats } from '../types/profile';
import { toWebP } from '../utils/imageUtils';
import { ACHIEVEMENTS } from '../constants/profile';
import { computeUserStats } from '../utils/animeUtils';
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
import { FollowRequests } from '../components/profile/FollowRequests';
import { UserSearchModal } from '../components/profile/UserSearchModal';
import { DeleteAccountModal } from '../components/profile/DeleteAccountModal';
import { Top10Section } from '../components/profile/Top10Section';
import { Top10EditorModal } from '../components/profile/Top10EditorModal';
import { FavoriteCharactersSection } from '../components/profile/FavoriteCharactersSection';
import { useSocialProfile } from '../hooks/useSocialProfile';
import { useTop10 } from '../hooks/useTop10';
import { useFavoriteCharacters } from '../hooks/useFavoriteCharacters';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

// Nombre del objeto dentro del bucket, extraído de la URL pública que el
// perfil tiene guardada. Solo se usa para borrar restos del esquema viejo
// (`<id>-<timestamp>.webp` en la raíz del bucket); devuelve null para
// cualquier URL que no sea de nuestro Storage — por ejemplo el avatar de
// Google que llega por OAuth, que no nos toca borrar.
const legacyObjectName = (url: string | null | undefined, bucket: string): string | null => {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${bucket}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  const name = url.slice(index + marker.length).split('?')[0];
  return name ? decodeURIComponent(name) : null;
};

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
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showTop10Editor, setShowTop10Editor] = useState(false);
  const [followersInitialTab, setFollowersInitialTab] = useState<'followers' | 'following'>('followers');
  const navigate = useNavigate();

  const pageRef = useRef<HTMLDivElement>(null);
  const counterRefs = useRef<(HTMLSpanElement | null)[]>([]);

  const social = useSocialProfile(profile?.id ?? null, profile?.id ?? null);
  const top10 = useTop10(profile?.id ?? null);
  const favoriteCharacters = useFavoriteCharacters(profile?.id ?? null);
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

  // Una imagen por usuario y por bucket, en una ruta fija bajo su propio id.
  //
  // Antes cada subida creaba un archivo nuevo (`<id>-<timestamp>.webp`) y el
  // anterior quedaba en un bucket público para siempre: cambiar de avatar diez
  // veces dejaba diez fotos tuyas accesibles por URL, y el almacenamiento
  // crecía sin techo. Con una ruta fija, `upsert` sobrescribe la anterior y no
  // se acumula nada. La carpeta `<id>/` además permite que las policies del
  // bucket exijan que cada quien escriba solo dentro de la suya.
  //
  // Como la URL ahora es estable, se le agrega `?v=` para que el navegador y
  // el CDN no sigan sirviendo la imagen vieja después de cambiarla.
  const uploadProfileImage = async (
    bucket: 'avatars' | 'banners',
    file: File,
    quality: number,
    maxWidth: number,
    column: 'avatar_url' | 'banner_url',
  ) => {
    if (!profile) return;
    const webp = await toWebP(file, quality, maxWidth);
    const filePath = `${profile.id}/${bucket === 'avatars' ? 'avatar' : 'banner'}.webp`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, webp, { contentType: 'image/webp', upsert: true });
    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(filePath);
    const versionedUrl = `${publicUrl}?v=${Date.now()}`;

    const { error: updateError } = await supabase
      .from('profiles').update({ [column]: versionedUrl }).eq('id', profile.id);
    if (updateError) throw updateError;

    // Limpieza del esquema viejo: si el perfil todavía apuntaba a un archivo
    // con el nombre anterior, se borra ahora que ya no lo referencia nadie.
    const previous = legacyObjectName(profile[column], bucket);
    if (previous && previous !== filePath) {
      await supabase.storage.from(bucket).remove([previous]);
    }

    setProfile({ ...profile, [column]: versionedUrl });
  };

  const handleBannerUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setUploadingBanner(true);
      await uploadProfileImage('banners', file, 0.85, 1920, 'banner_url');
    } catch (error) {
      console.error(error);
      alert('Hubo un error al subir el banner.');
    } finally { setUploadingBanner(false); }
  };

  const handleAvatarUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setUploadingAvatar(true);
      await uploadProfileImage('avatars', file, 0.88, 800, 'avatar_url');
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

  const stats: UserStats = useMemo(() => computeUserStats(animes), [animes]);

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
            onCommentsToggle={v => setProfile(prev => prev ? { ...prev, comments_enabled: v } : prev)}
            onFollowersClick={() => { setFollowersInitialTab('followers'); setShowFollowersModal(true); }}
            onFollowingClick={() => { setFollowersInitialTab('following'); setShowFollowersModal(true); }}
            onImportClick={() => setShowImportModal(true)}
            onSearchUsersClick={() => setShowUserSearch(true)}
          />
        </div>

        {/* ── SOLICITUDES DE SEGUIMIENTO ─────────────────────────────── */}
        {/* Se renderiza a sí misma como null si no hay ninguna pendiente. */}
        <div className="mb-8">
          <FollowRequests profileId={profile.id} onAccepted={social.refetch} />
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

        {/* ── MI TOP 10 + MÉTRICAS ──────────────────────────────────────── */}
        {animes.length > 0 && (
          <div className="mb-8">
            <Top10Section
              entries={top10.entries}
              username={profile.username}
              isOwner
              onEditClick={() => setShowTop10Editor(true)}
              metrics={{ minutes: stats.minutes, days: stats.days, watching: stats.watching, pending: stats.pending }}
            />
          </div>
        )}

        {/* ── MAIN GRID ──────────────────────────────────────────────── */}
        <div className={`grid grid-cols-1 lg:grid-cols-12 gap-6 ${animes.length === 0 ? 'hidden' : ''}`}>

          <div className="lg:col-span-4 flex flex-col gap-5">
            <div className="profile-section">
              <FavoriteCharactersSection characters={favoriteCharacters.entries} />
            </div>
            <GenrePieChart genres={stats.topGenres} />
            <StudioBarChart studios={stats.topStudios} />
            <ActivityFeed animes={animes} />
            <div className="profile-section">
              <AchievementGallery unlockedAchievements={unlockedAchievements} />
            </div>
          </div>

          <div className="profile-section lg:col-span-8">
            <AnimeGrid animes={animes} onRemove={handleRemove} isOwner />
          </div>
        </div>

        {/* ── COMMENTS ───────────────────────────────────────────────── */}
        <div className="mt-8">
          <ProfileComments
            profileId={profile.id}
            currentUserId={profile.id}
            isOwner={true}
            commentsEnabled={profile.comments_enabled !== false}
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

      {showUserSearch && (
        <UserSearchModal
          excludeUserId={profile.id}
          onClose={() => setShowUserSearch(false)}
        />
      )}

      {showDeleteModal && (
        <DeleteAccountModal
          username={profile.username}
          onClose={() => setShowDeleteModal(false)}
        />
      )}

      {showTop10Editor && (
        <Top10EditorModal
          animes={animes}
          initialEntries={top10.entries}
          onClose={() => setShowTop10Editor(false)}
          onSave={top10.save}
        />
      )}
    </div>
  );
};
