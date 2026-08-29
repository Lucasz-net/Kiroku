import { useId, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Lock, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { PasswordStrengthMeter } from '../components/PasswordStrengthMeter';

export const ResetPasswordPage = () => {
  useDocumentTitle('Restablecer contraseña');
  const navigate = useNavigate();
  const newPasswordId = useId();
  const confirmPasswordId = useId();

  const [sessionReady, setSessionReady] = useState(false);
  const [invalidLink, setInvalidLink] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // El link del correo (?code=...) genera una sesión de recuperación
    // automáticamente al cargar el cliente de Supabase (detectSessionInUrl).
    // Si no hay sesión acá, el link es inválido, expiró, o ya se usó.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true);
      else setInvalidLink(true);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setSuccess(true);
      setTimeout(() => navigate('/profile'), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error inesperado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080A0F] flex items-center justify-center px-4 font-sans pt-24 md:pt-0">
      <div className="relative w-full max-w-md">
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-48 h-6 bg-[#FF3B3B] blur-2xl opacity-20 rounded-full pointer-events-none" />

        <div className="relative bg-[#11131A] border border-[#FF3B3B]/20 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.9)] overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#FF3B3B]/50 to-transparent" />

          <div className="p-8">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-[#FF3B3B]/10 border border-[#FF3B3B]/30 flex items-center justify-center shadow-[0_0_15px_rgba(255,59,59,0.15)]">
                <span className="text-[#FF3B3B] font-black text-lg leading-none">K</span>
              </div>
              <div>
                <div className="text-white font-black text-lg leading-tight tracking-tight">KIROKU</div>
                <div className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">Restablecer contraseña</div>
              </div>
            </div>

            {invalidLink && (
              <div className="text-center py-4">
                <p className="text-[#FF7777] text-sm mb-6">
                  Este enlace no es válido o ya expiró. Pedí uno nuevo desde la pantalla de inicio de sesión.
                </p>
                <button
                  onClick={() => navigate('/')}
                  className="w-full bg-[#FF3B3B] text-white font-black py-3.5 rounded-xl hover:bg-[#e02d2d] transition-all text-sm uppercase tracking-widest"
                >
                  Volver al inicio
                </button>
              </div>
            )}

            {sessionReady && success && (
              <div className="text-center py-4">
                <CheckCircle2 size={40} className="text-emerald-500 mx-auto mb-4" />
                <p className="text-emerald-400 text-sm">Contraseña actualizada. Te llevamos a tu perfil...</p>
              </div>
            )}

            {sessionReady && !success && (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <p className="text-zinc-500 text-sm mb-1">Elegí tu nueva contraseña.</p>

                {error && (
                  <div className="p-3 bg-[#FF3B3B]/8 border border-[#FF3B3B]/30 rounded-xl text-[#FF7777] text-sm text-center">
                    {error}
                  </div>
                )}

                <div>
                  <label htmlFor={newPasswordId} className="block text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Nueva contraseña</label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
                    <input
                      id={newPasswordId}
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={8}
                      autoComplete="new-password"
                      autoFocus
                      className="w-full bg-[#0D0F15] border border-[#FF3B3B]/15 text-white rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-[#FF3B3B]/50 focus:ring-1 focus:ring-[#FF3B3B]/20 transition-all placeholder:text-zinc-700"
                    />
                  </div>
                  <PasswordStrengthMeter password={password} />
                </div>

                <div>
                  <label htmlFor={confirmPasswordId} className="block text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Confirmar contraseña</label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
                    <input
                      id={confirmPasswordId}
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={8}
                      autoComplete="new-password"
                      className="w-full bg-[#0D0F15] border border-[#FF3B3B]/15 text-white rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-[#FF3B3B]/50 focus:ring-1 focus:ring-[#FF3B3B]/20 transition-all placeholder:text-zinc-700"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-[#FF3B3B] text-white font-black py-3.5 rounded-xl hover:bg-[#e02d2d] transition-all shadow-[0_0_20px_rgba(255,59,59,0.25)] hover:shadow-[0_0_30px_rgba(255,59,59,0.4)] mt-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm uppercase tracking-widest"
                >
                  {loading && <Loader2 size={16} className="animate-spin" />}
                  Guardar contraseña
                </button>
              </form>
            )}

            {!sessionReady && !invalidLink && (
              <div className="flex justify-center py-8">
                <Loader2 size={24} className="animate-spin text-[#FF3B3B]" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
