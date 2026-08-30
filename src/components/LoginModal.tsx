import { X, Loader2, Mail, Lock, User, AtSign } from 'lucide-react';
import { useId, useState } from 'react';
import { supabase } from '../lib/supabase';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';
import { PASSWORD_MIN_LENGTH, validatePassword, weakPasswordMessage } from '../utils/passwordStrength';

// Mismo formato que exige la base (profiles_username_format) y que ya validan
// UsernameSetupModal y ProfileHeader.
const USERNAME_RE = /^[a-zA-Z0-9_-]{3,20}$/;

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const InputField = ({
  icon: Icon,
  label,
  type,
  value,
  onChange,
  placeholder,
  required,
  minLength,
}: {
  icon: React.ElementType;
  label: string;
  type: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  required?: boolean;
  minLength?: number;
}) => {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-2">{label}</label>
      <div className="relative">
        <Icon size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          minLength={minLength}
          className="w-full bg-[#0D0F15] border border-[#FF3B3B]/15 text-white rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-[#FF3B3B]/50 focus:ring-1 focus:ring-[#FF3B3B]/20 transition-all placeholder:text-zinc-700"
        />
      </div>
    </div>
  );
};

export const LoginModal = ({ isOpen, onClose }: LoginModalProps) => {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);

  const [identifier, setIdentifier] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');

  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const passwordFieldId = useId();

  if (!isOpen) return null;

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      // El nombre de usuario se resuelve a email del lado del servidor
      // (api/auth/reset-password.ts). Antes se hacía acá con una RPC que
      // cualquier visitante anónimo podía llamar para leer el email de
      // cualquier cuenta.
      await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier }),
      });

      setMessage('Si el usuario o correo existe, te enviamos un enlace para restablecer tu contraseña.');
    } catch (err: unknown) {
      // No revelar si el usuario/correo existe o no (evita enumeración de cuentas).
      setMessage('Si el usuario o correo existe, te enviamos un enlace para restablecer tu contraseña.');
      void err;
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isLogin) {
        // El login pasa por nuestro propio endpoint: resolver un nombre de
        // usuario a su email necesita la service-role key, y ese email nunca
        // vuelve al navegador. El endpoint devuelve los tokens de una sesión
        // normal de Supabase, que instalamos acá — de ahí en adelante el
        // resto de la app funciona igual que siempre.
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier, password }),
        });
        const payload = await res.json().catch(() => null);

        if (!res.ok || !payload?.access_token) {
          throw new Error(payload?.error || 'Usuario o contraseña incorrectos.');
        }

        const { error: sessionError } = await supabase.auth.setSession({
          access_token: payload.access_token,
          refresh_token: payload.refresh_token,
        });
        if (sessionError) throw sessionError;

        onClose();

      } else {
        // La base ahora exige este formato (constraint profiles_username_format).
        // Antes que nada y sin ir a la red: la política de contraseñas del
        // dashboard rechaza en inglés y sin traducir. Ver passwordStrength.ts.
        const passwordError = validatePassword(password);
        if (passwordError) throw new Error(passwordError);

        // Sin este chequeo, un nombre inválido revienta dentro del trigger
        // handle_new_user y Supabase devuelve un "Database error saving new
        // user" que no le dice nada a nadie.
        if (!USERNAME_RE.test(username)) {
          throw new Error('El nombre de usuario debe tener entre 3 y 20 caracteres, solo letras, números, guion y guion bajo.');
        }

        const { data: usernameAvailable } = await supabase
          .rpc('username_available', { p_username: username });

        if (usernameAvailable === false) {
          throw new Error('Este nombre de usuario ya está en uso. Por favor, elige otro.');
        }

        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username },
          },
        });

        if (signUpError) throw signUpError;

        setMessage('¡Cuenta creada! Revisa tu correo electrónico para confirmar tu cuenta.');
      }
    } catch (err: unknown) {
      let errorMessage = 'Ocurrió un error inesperado.';
      if (err instanceof Error) errorMessage = err.message;

      // Ojo: el error de login llega ya traducido y deliberadamente ambiguo
      // desde /api/auth/login ("Usuario o contraseña incorrectos"). No lo
      // afines a "contraseña incorrecta": eso confirmaría que la cuenta
      // existe, que es justo lo que el endpoint evita revelar.
      const weak = weakPasswordMessage(err);
      if (errorMessage.includes('User already registered')) {
        setError('Este correo ya está registrado.');
      } else if (weak) {
        setError(weak);
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setIsForgotPassword(false);
    setError(null);
    setMessage(null);
    setIdentifier('');
    setUsername('');
    setEmail('');
    setPassword('');
  };

  const openForgotPassword = () => {
    setIsForgotPassword(true);
    setError(null);
    setMessage(null);
    setPassword('');
  };

  const closeForgotPassword = () => {
    setIsForgotPassword(false);
    setError(null);
    setMessage(null);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center font-sans">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-md m-4 animate-in fade-in zoom-in duration-200">
        {/* Glow ambiental superior */}
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-48 h-6 bg-[#FF3B3B] blur-2xl opacity-20 rounded-full pointer-events-none" />

        <div className="relative bg-[#11131A] border border-[#FF3B3B]/20 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.9)] overflow-hidden">
          {/* Línea de acento superior */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#FF3B3B]/50 to-transparent" />

          <div className="p-8">
            {/* Header con logo y close */}
            <div className="flex items-start justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FF3B3B]/10 border border-[#FF3B3B]/30 flex items-center justify-center shadow-[0_0_15px_rgba(255,59,59,0.15)]">
                  <span className="text-[#FF3B3B] font-black text-lg leading-none">K</span>
                </div>
                <div>
                  <div className="text-white font-black text-lg leading-tight tracking-tight">KIROKU</div>
                  <div className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">Tu colección de anime</div>
                </div>
              </div>
              <button
                onClick={onClose}
                type="button"
                className="text-zinc-600 hover:text-white transition-colors bg-[#0D0F15] hover:bg-[#1A1C24] border border-[#FF3B3B]/10 hover:border-[#FF3B3B]/30 p-2 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            {!isForgotPassword && (
              <div className="bg-[#0D0F15] border border-[#FF3B3B]/10 rounded-xl p-1 flex mb-7">
                <button
                  type="button"
                  onClick={() => !isLogin && toggleMode()}
                  className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all duration-200 ${
                    isLogin
                      ? 'bg-[#FF3B3B]/10 text-white border border-[#FF3B3B]/25 shadow-[0_0_10px_rgba(255,59,59,0.1)]'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Iniciar Sesión
                </button>
                <button
                  type="button"
                  onClick={() => isLogin && toggleMode()}
                  className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all duration-200 ${
                    !isLogin
                      ? 'bg-[#FF3B3B]/10 text-white border border-[#FF3B3B]/25 shadow-[0_0_10px_rgba(255,59,59,0.1)]'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Registrarse
                </button>
              </div>
            )}

            {/* Mensajes de error/éxito */}
            {error && (
              <div className="mb-5 p-3 bg-[#FF3B3B]/8 border border-[#FF3B3B]/30 rounded-xl text-[#FF7777] text-sm text-center">
                {error}
              </div>
            )}
            {message && (
              <div className="mb-5 p-3 bg-emerald-500/8 border border-emerald-500/30 rounded-xl text-emerald-400 text-sm text-center">
                {message}
              </div>
            )}

            {isForgotPassword ? (
              <form onSubmit={handleForgotPassword} className="flex flex-col gap-4">
                <p className="text-zinc-500 text-sm -mt-1 mb-1">
                  Ingresá tu usuario o correo electrónico y te mandamos un enlace para restablecer tu contraseña.
                </p>
                <InputField
                  icon={AtSign}
                  label="Usuario o Correo Electrónico"
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder=""
                  required
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-[#FF3B3B] text-white font-black py-3.5 rounded-xl hover:bg-[#e02d2d] transition-all shadow-[0_0_20px_rgba(255,59,59,0.25)] hover:shadow-[0_0_30px_rgba(255,59,59,0.4)] mt-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm uppercase tracking-widest"
                >
                  {loading && <Loader2 size={16} className="animate-spin" />}
                  Enviar Enlace
                </button>
                <button
                  type="button"
                  onClick={closeForgotPassword}
                  className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors font-bold uppercase tracking-wider text-center"
                >
                  Volver a iniciar sesión
                </button>
              </form>
            ) : (
              <>
                {/* Google OAuth */}
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  className="w-full flex items-center justify-center gap-3 bg-white hover:bg-zinc-100 text-zinc-900 font-bold py-3 rounded-xl border border-transparent transition-all duration-200 text-sm mb-5 hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(255,59,59,0.2)] hover:border-[#FF3B3B]/30 active:scale-[0.98]"
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
                    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
                    <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
                    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
                  </svg>
                  Continuar con Google
                </button>

                <div className="flex items-center gap-3 mb-1">
                  <div className="flex-1 h-px bg-[#FF3B3B]/10" />
                  <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">o</span>
                  <div className="flex-1 h-px bg-[#FF3B3B]/10" />
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  {isLogin ? (
                    <InputField
                      icon={AtSign}
                      label="Usuario o Correo Electrónico"
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder=""
                      required
                    />
                  ) : (
                    <>
                      <InputField
                        icon={User}
                        label="Nombre de Usuario"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="@user"
                        required
                      />
                      <InputField
                        icon={Mail}
                        label="Correo Electrónico"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="tu@email.com"
                        required
                      />
                    </>
                  )}

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label htmlFor={passwordFieldId} className="block text-[11px] font-bold text-zinc-500 uppercase tracking-widest">Contraseña</label>
                      {isLogin && (
                        <button
                          type="button"
                          onClick={openForgotPassword}
                          className="text-[11px] text-[#FF7777]/70 hover:text-[#FF7777] transition-colors font-bold uppercase tracking-wider"
                        >
                          ¿Olvidaste tu contraseña?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Lock size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
                      <input
                        id={passwordFieldId}
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        minLength={isLogin ? undefined : PASSWORD_MIN_LENGTH}
                        autoComplete={isLogin ? 'current-password' : 'new-password'}
                        className="w-full bg-[#0D0F15] border border-[#FF3B3B]/15 text-white rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-[#FF3B3B]/50 focus:ring-1 focus:ring-[#FF3B3B]/20 transition-all placeholder:text-zinc-700"
                      />
                    </div>
                    {!isLogin && <PasswordStrengthMeter password={password} />}
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 bg-[#FF3B3B] text-white font-black py-3.5 rounded-xl hover:bg-[#e02d2d] transition-all shadow-[0_0_20px_rgba(255,59,59,0.25)] hover:shadow-[0_0_30px_rgba(255,59,59,0.4)] mt-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm uppercase tracking-widest"
                  >
                    {loading && <Loader2 size={16} className="animate-spin" />}
                    {isLogin ? 'Entrar' : 'Crear Cuenta'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
