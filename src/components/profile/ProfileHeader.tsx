import { useState, useRef, type ChangeEvent } from 'react';
import {
  Loader2, Camera, Edit2, X, LogOut, Share2, Check,
  ImagePlus, Users, UserCheck, Heart, Upload, AtSign, Lock, Unlock,
} from 'lucide-react';
import type { UserProfile, SocialCounts } from '../../types/profile';
import { supabase } from '../../lib/supabase';
import { useUserData } from '../../contexts/UserDataContext';

const USERNAME_RE = /^[a-zA-Z0-9_-]{3,20}$/;
type UsernameCheck = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

interface ProfileHeaderProps {
  profile: UserProfile;
  isEditingBio: boolean;
  newBio: string;
  uploadingAvatar: boolean;
  uploadingBanner: boolean;
  socialCounts?: SocialCounts;
  onBioChange: (value: string) => void;
  onEditBio: () => void;
  onBioSave: () => void;
  onBioCancel: () => void;
  onAvatarUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onBannerUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onSignOut: () => void;
  onUsernameUpdate?: (newUsername: string) => void;
  onFollowersClick?: () => void;
  onFollowingClick?: () => void;
  onImportClick?: () => void;
  onPrivacyToggle?: (isPrivate: boolean) => void;
}

export const ProfileHeader = ({
  profile, isEditingBio, newBio, uploadingAvatar, uploadingBanner,
  socialCounts,
  onBioChange, onEditBio, onBioSave, onBioCancel,
  onAvatarUpload, onBannerUpload, onSignOut,
  onUsernameUpdate,
  onFollowersClick, onFollowingClick, onImportClick, onPrivacyToggle,
}: ProfileHeaderProps) => {
  const [copied, setCopied] = useState(false);
  const [editingUsername, setEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState(profile.username);
  const [usernameCheck, setUsernameCheck] = useState<UsernameCheck>('idle');
  const [savingUsername, setSavingUsername] = useState(false);
  const [togglingPrivacy, setTogglingPrivacy] = useState(false);
  const { applyUsername } = useUserData();
  const usernameDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePrivacyToggle = async () => {
    const next = !profile.is_private;
    setTogglingPrivacy(true);
    const { error } = await supabase.from('profiles').update({ is_private: next }).eq('id', profile.id);
    if (!error) onPrivacyToggle?.(next);
    setTogglingPrivacy(false);
  };

  const handleUsernameChange = (val: string) => {
    const clean = val.replace(/\s/g, '');
    setNewUsername(clean);
    if (usernameDebounceRef.current) clearTimeout(usernameDebounceRef.current);
    if (!clean || clean === profile.username) { setUsernameCheck('idle'); return; }
    if (!USERNAME_RE.test(clean)) { setUsernameCheck('invalid'); return; }
    setUsernameCheck('checking');
    usernameDebounceRef.current = setTimeout(async () => {
      const { data: available } = await supabase
        .rpc('username_available', { p_username: clean });
      setUsernameCheck(available === false ? 'taken' : 'available');
    }, 500);
  };

  const handleUsernameSave = async () => {
    if (!newUsername || (usernameCheck !== 'available' && newUsername !== profile.username)) return;
    setSavingUsername(true);
    const { error } = await supabase
      .from('profiles')
      .update({ username: newUsername, username_confirmed: true })
      .eq('id', profile.id);
    if (!error) {
      onUsernameUpdate?.(newUsername);
      applyUsername(newUsername);
      setEditingUsername(false);
      setUsernameCheck('idle');
    }
    setSavingUsername(false);
  };

  const handleUsernameCancel = () => {
    setEditingUsername(false);
    setNewUsername(profile.username);
    setUsernameCheck('idle');
  };

  const handleShare = () => {
    navigator.clipboard.writeText(`${window.location.origin}/u/${profile.username}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative mb-12 rounded-2xl border border-[#FF3B3B]/20 overflow-hidden [transform:translateZ(0)]">

      {/* Banner */}
      {profile.banner_url && (
        <img src={profile.banner_url} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover" />
      )}
      <div className={`absolute inset-0 ${profile.banner_url ? 'bg-[#0D0F15]/70 backdrop-blur-[2px]' : 'bg-[#11131A]'}`} />

      {/* Change banner */}
      <label className="absolute top-3 right-3 z-20 flex items-center gap-2 px-3 py-2 bg-[#0D0F15]/70 backdrop-blur-sm border border-white/10 text-zinc-300 hover:text-white hover:bg-[#0D0F15]/90 cursor-pointer transition-all rounded-lg text-xs font-bold uppercase tracking-widest">
        {uploadingBanner ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
        <span className="hidden sm:inline">{uploadingBanner ? 'Subiendo...' : 'Cambiar banner'}</span>
        <input type="file" accept="image/*" className="hidden" onChange={onBannerUpload} disabled={uploadingBanner} />
      </label>

      {/* Sign out */}
      <button
        onClick={onSignOut}
        title="Cerrar sesión"
        className="absolute bottom-4 right-4 z-20 flex items-center gap-1.5 px-3 py-1.5 bg-[#0D0F15]/70 backdrop-blur-sm hover:bg-[#FF3B3B]/10 text-zinc-500 hover:text-[#FF3B3B] border border-[#FF3B3B]/15 hover:border-[#FF3B3B]/40 transition-all rounded-lg text-[10px] font-bold uppercase tracking-widest"
      >
        <LogOut size={12} /> Salir
      </button>

      {/* Content */}
      <div className="relative z-10 px-4 py-8 pb-6 md:px-8 md:py-12 flex flex-col md:flex-row items-center gap-6 md:gap-10">

        {/* Avatar */}
        <div className="relative shrink-0">
          <div className="w-32 h-32 md:w-44 md:h-44 bg-[#11131A] flex items-center justify-center text-5xl md:text-6xl font-black text-white rounded-xl border-4 border-[#0D0F15]/60 overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.7)]">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              profile.username?.charAt(0).toUpperCase()
            )}
          </div>
          <label className="absolute bottom-1 right-1 bg-[#FF3B3B] text-white p-2.5 cursor-pointer hover:bg-[#FF6B6B] transition-colors rounded-lg shadow-lg">
            {uploadingAvatar ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
            <input type="file" accept="image/*" className="hidden" onChange={onAvatarUpload} disabled={uploadingAvatar} />
          </label>
        </div>

        {/* Info */}
        <div className="flex-1 w-full text-center md:text-left max-w-2xl">
          {/* Username — editable */}
          <div className="mb-1 flex items-center gap-2 justify-center md:justify-start">
            {editingUsername ? (
              <div className="flex items-center gap-2">
                <div className="relative">
                  <AtSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
                  <input
                    autoFocus
                    value={newUsername}
                    onChange={e => handleUsernameChange(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleUsernameSave();
                      if (e.key === 'Escape') handleUsernameCancel();
                    }}
                    maxLength={20}
                    className="bg-[#0D0F15] border border-[#FF3B3B]/30 focus:border-[#FF3B3B]/60 text-white rounded-xl pl-8 pr-3 py-2 text-2xl font-black outline-none w-52 tracking-tight"
                  />
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={handleUsernameSave}
                    disabled={savingUsername || (usernameCheck !== 'available' && newUsername !== profile.username)}
                    className="p-2 bg-[#FF3B3B] hover:bg-[#FF6B6B] disabled:opacity-30 text-white rounded-lg transition-colors"
                  >
                    {savingUsername ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                  </button>
                  <button onClick={handleUsernameCancel} className="p-2 text-zinc-500 hover:text-white bg-[#0D0F15] border border-[#FF3B3B]/15 rounded-lg transition-colors">
                    <X size={15} />
                  </button>
                </div>
                {usernameCheck === 'taken' && <span className="text-xs text-[#FF7777] font-bold">Ya está en uso</span>}
                {usernameCheck === 'invalid' && <span className="text-xs text-[#FF7777] font-bold">Inválido</span>}
                {usernameCheck === 'available' && <span className="text-xs text-emerald-500 font-bold">Disponible</span>}
              </div>
            ) : (
              <div className="group flex items-center gap-2">
                <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">
                  {profile.username}
                </h1>
                <button
                  onClick={() => { setEditingUsername(true); setNewUsername(profile.username); }}
                  className="p-1.5 text-zinc-700 hover:text-[#FF3B3B] opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-[#FF3B3B]/10"
                  title="Cambiar nombre de usuario"
                >
                  <Edit2 size={16} />
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 mb-4 justify-center md:justify-start flex-wrap">
            <p className="text-zinc-400 font-sans font-medium text-sm">
              {profile.email}
            </p>
            {profile.username && (
              <button
                onClick={handleShare}
                className="flex items-center gap-1 text-[10px] font-bold text-zinc-600 hover:text-[#FF3B3B] uppercase tracking-widest transition-colors"
              >
                {copied ? <Check size={11} /> : <Share2 size={11} />}
                {copied ? '¡Copiado!' : 'Compartir perfil'}
              </button>
            )}
            {onImportClick && (
              <button
                onClick={onImportClick}
                className="flex items-center gap-1 text-[10px] font-bold text-zinc-600 hover:text-[#FF3B3B] uppercase tracking-widest transition-colors"
              >
                <Upload size={11} /> Importar lista
              </button>
            )}
            <button
              onClick={handlePrivacyToggle}
              disabled={togglingPrivacy}
              title={profile.is_private ? 'Tu perfil es privado — solo tus seguidores ven tu actividad' : 'Tu perfil es público — cualquiera puede ver tu actividad'}
              className="flex items-center gap-1 text-[10px] font-bold text-zinc-600 hover:text-[#FF3B3B] uppercase tracking-widest transition-colors disabled:opacity-50"
            >
              {togglingPrivacy ? (
                <Loader2 size={11} className="animate-spin" />
              ) : profile.is_private ? (
                <Lock size={11} />
              ) : (
                <Unlock size={11} />
              )}
              {profile.is_private ? 'Perfil privado' : 'Perfil público'}
            </button>
          </div>

          <div className="bg-[#0D0F15]/60 backdrop-blur-sm p-5 rounded-lg border-l-2 border-[#FF3B3B]/30 hover:border-[#FF3B3B]/70 transition-colors mb-4">
            {isEditingBio ? (
              <div>
                <textarea
                  autoFocus
                  value={newBio}
                  onChange={e => onBioChange(e.target.value)}
                  placeholder="Escribe algo sobre ti..."
                  className="w-full bg-[#1A1C24] text-white p-3 focus:outline-none focus:ring-1 focus:ring-[#FF3B3B] border border-[#FF3B3B]/20 focus:border-[#FF3B3B] rounded-lg min-h-[80px] mb-3 text-xs md:text-sm placeholder:text-zinc-600"
                  maxLength={160}
                />
                <div className="flex justify-end gap-2">
                  <button onClick={onBioCancel} className="p-2 text-zinc-500 hover:text-white transition-colors rounded-lg">
                    <X size={18} />
                  </button>
                  <button onClick={onBioSave} className="px-4 py-2 bg-[#FF3B3B] text-white hover:bg-[#FF6B6B] font-bold text-xs uppercase tracking-wider transition-colors rounded-lg">
                    Guardar
                  </button>
                </div>
              </div>
            ) : (
              <div className="group relative pr-10 cursor-pointer" onClick={onEditBio}>
                <p className="text-zinc-400 text-xs md:text-sm leading-relaxed">
                  {profile.bio ? profile.bio : 'Sin información. Haz clic para agregar una descripción.'}
                </p>
                <button className="absolute top-0 right-0 p-2 text-zinc-600 hover:text-[#FF3B3B] opacity-0 group-hover:opacity-100 transition-opacity">
                  <Edit2 size={16} />
                </button>
              </div>
            )}
          </div>

          {/* Social counts row */}
          {socialCounts !== undefined && (
            <div className="flex items-center gap-4 justify-center md:justify-start">
              <button
                onClick={onFollowersClick}
                className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-white transition-colors"
              >
                <Users size={13} className="text-[#FF3B3B]/40" />
                <span className="text-white font-black">{socialCounts.followersCount}</span>
                Seguidores
              </button>
              <span className="text-zinc-700">·</span>
              <button
                onClick={onFollowingClick}
                className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 hover:text-white transition-colors"
              >
                <UserCheck size={13} className="text-[#FF3B3B]/40" />
                <span className="text-white font-black">{socialCounts.followingCount}</span>
                Siguiendo
              </button>
              <span className="text-zinc-700">·</span>
              <span className="flex items-center gap-1.5 text-xs font-bold text-zinc-500">
                <Heart size={13} className="text-[#FF3B3B]/40" />
                <span className="text-white font-black">{socialCounts.likesCount}</span>
                Me gustas
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
