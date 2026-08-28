import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface DeleteAccountModalProps {
  username: string;
  onClose: () => void;
}

export const DeleteAccountModal = ({ username, onClose }: DeleteAccountModalProps) => {
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const canDelete = confirmText === username;

  const handleDelete = async () => {
    if (!canDelete || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Tu sesión expiró. Volvé a iniciar sesión.');

      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || 'No se pudo eliminar la cuenta.');

      await supabase.auth.signOut();
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error inesperado.');
      setDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm font-sans"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-md bg-[#11131A] border border-[#FF3B3B]/30 rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.9)] overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#FF3B3B]/60 to-transparent" />

        <div className="p-8">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FF3B3B]/10 border border-[#FF3B3B]/30 flex items-center justify-center">
                <AlertTriangle size={18} className="text-[#FF3B3B]" />
              </div>
              <h2 className="text-lg font-black text-white">Eliminar cuenta</h2>
            </div>
            <button
              onClick={onClose}
              type="button"
              className="text-zinc-600 hover:text-white transition-colors bg-[#0D0F15] hover:bg-[#1A1C24] border border-[#FF3B3B]/10 hover:border-[#FF3B3B]/30 p-2 rounded-lg"
            >
              <X size={16} />
            </button>
          </div>

          <p className="text-zinc-400 text-sm leading-relaxed mb-2">
            Esto borra tu cuenta y todo lo asociado a ella de forma permanente: tu perfil, tu lista de animes,
            seguidores/siguiendo, likes y comentarios — incluidos los que dejaste en otros perfiles.
          </p>
          <p className="text-[#FF7777] text-sm font-bold mb-6">
            Esta acción no se puede deshacer.
          </p>

          <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-2">
            Escribí <span className="text-white normal-case">{username}</span> para confirmar
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
            autoFocus
            className="w-full bg-[#0D0F15] border border-[#FF3B3B]/15 focus:border-[#FF3B3B]/50 focus:ring-1 focus:ring-[#FF3B3B]/20 text-white rounded-xl px-4 py-3 text-sm outline-none transition-all mb-4"
          />

          {error && (
            <div className="mb-4 p-3 bg-[#FF3B3B]/8 border border-[#FF3B3B]/30 rounded-xl text-[#FF7777] text-sm text-center">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              type="button"
              className="flex-1 py-3 bg-[#0D0F15] border border-[#FF3B3B]/15 text-zinc-400 hover:text-white font-black text-xs uppercase tracking-widest rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleDelete}
              disabled={!canDelete || deleting}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#FF3B3B] hover:bg-[#e02d2d] disabled:opacity-30 disabled:cursor-not-allowed text-white font-black text-xs uppercase tracking-widest rounded-xl transition-colors"
            >
              {deleting && <Loader2 size={14} className="animate-spin" />}
              Eliminar para siempre
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
