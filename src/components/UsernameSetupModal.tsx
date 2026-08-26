import { useState, useEffect, useRef } from 'react';
import { Loader2, Check, X, AtSign } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useUserData } from '../contexts/UserDataContext';

const USERNAME_RE = /^[a-zA-Z0-9_-]{3,20}$/;

type CheckState = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

export const UsernameSetupModal = () => {
  const { session, applyUsername } = useUserData();
  const [value, setValue] = useState('');
  const [checkState, setCheckState] = useState<CheckState>('idle');
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const avatarUrl =
    session?.user.user_metadata?.avatar_url ||
    session?.user.user_metadata?.picture ||
    null;
  const displayName =
    session?.user.user_metadata?.full_name ||
    session?.user.email?.split('@')[0] ||
    '';

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!value) { setCheckState('idle'); return; }
    if (!USERNAME_RE.test(value)) { setCheckState('invalid'); return; }

    setCheckState('checking');
    debounceRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from('public_profiles')
        .select('id')
        .eq('username', value)
        .maybeSingle();
      setCheckState(data ? 'taken' : 'available');
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  const handleSave = async () => {
    if (!session || checkState !== 'available') return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ username: value, username_confirmed: true })
        .eq('id', session.user.id);

      if (error) throw error;
      applyUsername(value);
      window.location.replace('/profile');
    } catch (err) {
      console.error(err);
      setSaving(false);
    }
  };

  const statusIcon = () => {
    if (checkState === 'checking') return <Loader2 size={15} className="animate-spin text-zinc-500" />;
    if (checkState === 'available') return <Check size={15} className="text-emerald-500" />;
    if (checkState === 'taken' || checkState === 'invalid') return <X size={15} className="text-[#FF3B3B]" />;
    return null;
  };

  const statusMsg = () => {
    if (checkState === 'invalid') return 'Solo letras, números, _ y - (3-20 caracteres)';
    if (checkState === 'taken') return 'Este nombre ya está en uso';
    if (checkState === 'available') return '¡Disponible!';
    return null;
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[#080A0F]/95 backdrop-blur-md font-sans">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#FF3B3B]/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-sm bg-[#11131A] border border-[#FF3B3B]/20 rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.9)] overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#FF3B3B]/50 to-transparent" />

        <div className="p-8 flex flex-col items-center gap-6">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-2xl bg-[#0D0F15] border-2 border-[#FF3B3B]/20 overflow-hidden flex items-center justify-center text-3xl font-black text-white shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              displayName.charAt(0).toUpperCase()
            )}
          </div>

          {/* Copy */}
          <div className="text-center">
            <h2 className="text-xl font-black text-white mb-1">
              ¡Bienvenido{displayName ? `, ${displayName.split(' ')[0]}` : ''}!
            </h2>
            <p className="text-zinc-500 text-sm leading-relaxed">
              Elegí tu nombre de usuario para<br />completar tu perfil en Kiroku.
            </p>
          </div>

          {/* Input */}
          <div className="w-full">
            <div className="relative">
              <AtSign
                size={15}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none"
              />
              <input
                type="text"
                value={value}
                onChange={e => setValue(e.target.value.replace(/\s/g, ''))}
                placeholder="TuNombre"
                maxLength={20}
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
                className="w-full bg-[#0D0F15] border border-[#FF3B3B]/15 focus:border-[#FF3B3B]/50 focus:ring-1 focus:ring-[#FF3B3B]/20 text-white rounded-xl pl-10 pr-10 py-3 text-sm outline-none transition-all placeholder:text-zinc-700"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {statusIcon()}
              </div>
            </div>

            {statusMsg() && (
              <p className={`text-xs mt-2 font-bold ${checkState === 'available' ? 'text-emerald-500' : 'text-[#FF7777]'}`}>
                {statusMsg()}
              </p>
            )}

            <p className="text-[10px] text-zinc-700 mt-2">
              Letras, números, _ y -. Entre 3 y 20 caracteres. Distingue mayúsculas.
            </p>
          </div>

          {/* Submit */}
          <button
            onClick={handleSave}
            disabled={checkState !== 'available' || saving}
            className="w-full flex items-center justify-center gap-2 bg-[#FF3B3B] hover:bg-[#FF6B6B] disabled:opacity-30 disabled:cursor-not-allowed text-white font-black py-3.5 rounded-xl transition-all shadow-[0_0_20px_rgba(255,59,59,0.25)] text-sm uppercase tracking-widest"
          >
            {saving && <Loader2 size={15} className="animate-spin" />}
            {saving ? 'Guardando...' : 'Continuar'}
          </button>
        </div>
      </div>
    </div>
  );
};
