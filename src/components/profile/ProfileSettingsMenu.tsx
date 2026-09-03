import { useEffect, useId, useRef, useState } from 'react';
import {
  Settings, Loader2, Lock, Unlock, MessageSquare, MessageSquareOff,
  Upload, Download, LogOut, Sun, Moon,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { reportError } from '../../lib/monitoring';
import { useTheme } from '../../contexts/ThemeContext';
import type { UserProfile } from '../../types/profile';

interface ProfileSettingsMenuProps {
  profile: UserProfile;
  /** Importar desde un archivo exportado de MyAnimeList. */
  onImportClick?: () => void;
  /** Importar desde una cuenta de AniList, por nombre de usuario. */
  onAniListImportClick?: () => void;
  onExport?: (format: 'xml' | 'json') => void;
  onPrivacyToggle?: (isPrivate: boolean) => void;
  onCommentsToggle?: (enabled: boolean) => void;
  onSignOut: () => void;
}

/**
 * Interruptor de un flag booleano del perfil.
 *
 * El cambio se aplica primero en pantalla y después se guarda: un switch que
 * tarda medio segundo en moverse se siente roto y la gente lo vuelve a
 * apretar. Si el guardado falla se revierte y se avisa — antes el `update`
 * silencioso dejaba al usuario creyendo que su perfil era privado cuando
 * seguía siendo público, que es el peor final posible para un ajuste de
 * privacidad.
 */
const useProfileFlag = (
  profileId: string,
  column: 'is_private' | 'comments_enabled',
  value: boolean,
  onChange?: (next: boolean) => void,
) => {
  const [saving, setSaving] = useState(false);

  const toggle = async () => {
    if (saving) return;
    const next = !value;
    setSaving(true);
    onChange?.(next);

    const { error } = await supabase
      .from('profiles').update({ [column]: next }).eq('id', profileId);

    if (error) {
      onChange?.(value);
      toast.error('No se pudo guardar el cambio. Revisá tu conexión e intentá de nuevo.');
      reportError(error, { column, next });
    }
    setSaving(false);
  };

  return { saving, toggle };
};

interface SettingSwitchProps {
  checked: boolean;
  saving: boolean;
  label: string;
  description: string;
  icon: typeof Lock;
  onToggle: () => void;
}

const SettingSwitch = ({ checked, saving, label, description, icon: Icon, onToggle }: SettingSwitchProps) => (
  <button
    role="switch"
    aria-checked={checked}
    disabled={saving}
    onClick={onToggle}
    className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-[#FF3B3B]/[0.06] transition-colors disabled:opacity-60"
  >
    {saving
      ? <Loader2 size={15} className="shrink-0 mt-0.5 text-[#FF3B3B] animate-spin" />
      : <Icon size={15} className={`shrink-0 mt-0.5 ${checked ? 'text-[#FF3B3B]' : 'text-zinc-600'}`} />}
    <span className="flex-1 min-w-0">
      <span className="block text-xs font-black text-[var(--kr-text)]">{label}</span>
      <span className="block text-[11px] text-zinc-500 leading-snug mt-0.5">{description}</span>
    </span>
    <span
      aria-hidden
      className={`shrink-0 mt-0.5 relative w-9 h-5 rounded-full transition-colors ${checked ? 'bg-[#FF3B3B]' : 'bg-zinc-700'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : ''}`}
      />
    </span>
  </button>
);

const ACTION_ROW =
  'w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#FF3B3B]/[0.06] transition-colors';

const SECTION_LABEL =
  'px-4 pt-3 pb-1.5 text-[10px] font-black uppercase tracking-widest text-zinc-600';

/**
 * Todas las opciones del perfil en un solo lugar. Antes vivían sueltas como
 * cinco botones grises idénticos que mezclaban acciones instantáneas con
 * ajustes permanentes; acá los ajustes son interruptores (se ve el estado sin
 * tener que leer el texto) y las acciones son filas.
 */
export const ProfileSettingsMenu = ({
  profile, onImportClick, onAniListImportClick, onExport, onPrivacyToggle, onCommentsToggle, onSignOut,
}: ProfileSettingsMenuProps) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const { theme, toggleTheme } = useTheme();

  const isPrivate = !!profile.is_private;
  const commentsEnabled = profile.comments_enabled !== false;

  const privacy = useProfileFlag(profile.id, 'is_private', isPrivate, onPrivacyToggle);
  const comments = useProfileFlag(profile.id, 'comments_enabled', commentsEnabled, onCommentsToggle);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  // Las acciones que abren un modal o disparan una descarga cierran el menú;
  // los interruptores no, para poder tocar los dos ajustes de una sentada.
  const runAndClose = (action: () => void) => () => { action(); setOpen(false); };

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={triggerRef}
        onClick={() => setOpen(v => !v)}
        aria-label="Configuración del perfil"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className={`flex items-center gap-2 px-3 h-[34px] backdrop-blur-sm border cursor-pointer rounded-lg transition-all text-xs font-bold uppercase tracking-widest ${
          open
            ? 'bg-[var(--kr-glass-1)] border-[#FF3B3B]/50 text-[#FF3B3B]'
            : 'bg-[var(--kr-glass-3)] border-[var(--kr-text)]/10 text-zinc-300 hover:text-[var(--kr-text)] hover:bg-[var(--kr-glass-1)]'
        }`}
      >
        <Settings size={13} className={`shrink-0 transition-transform ${open ? 'rotate-45' : ''}`} />
        <span className="hidden sm:inline">Configuración</span>
      </button>

      {open && (
        <div
          id={menuId}
          aria-label="Configuración del perfil"
          className="absolute top-full right-0 mt-2 w-[min(20rem,calc(100vw-2.5rem))] bg-[var(--kr-surface-sunken)] border border-[#FF3B3B]/25 rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.75)] overflow-hidden z-50 text-left normal-case tracking-normal"
        >
          <p className={SECTION_LABEL}>Privacidad</p>
          <SettingSwitch
            checked={isPrivate}
            saving={privacy.saving}
            onToggle={privacy.toggle}
            icon={isPrivate ? Lock : Unlock}
            label="Perfil privado"
            description={isPrivate
              ? 'Solo tus seguidores ven tu actividad.'
              : 'Cualquiera puede ver tu actividad.'}
          />
          <SettingSwitch
            checked={commentsEnabled}
            saving={comments.saving}
            onToggle={comments.toggle}
            icon={commentsEnabled ? MessageSquare : MessageSquareOff}
            label="Comentarios abiertos"
            description={commentsEnabled
              ? 'Cualquiera puede dejarte comentarios en el perfil.'
              : 'Nadie puede escribirte comentarios nuevos. Los que ya están siguen visibles.'}
          />

          {(onImportClick || onAniListImportClick || onExport) && (
            <>
              <div className="border-t border-[#FF3B3B]/10" />
              <p className={SECTION_LABEL}>Tu lista</p>
              {onImportClick && (
                <button onClick={runAndClose(onImportClick)} className={`${ACTION_ROW} items-start`}>
                  <Upload size={15} className="shrink-0 mt-0.5 text-zinc-600" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-black text-[var(--kr-text)]">Importar desde MyAnimeList</span>
                    <span className="block text-[11px] text-zinc-500 leading-snug mt-0.5">
                      Con el archivo .xml que exportás de MAL
                    </span>
                  </span>
                </button>
              )}
              {/* AniList no necesita archivo: alcanza el nombre de usuario,
                  porque su API publica la lista de cualquier perfil público.
                  Ver src/services/aniListImport.ts. */}
              {onAniListImportClick && (
                <button onClick={runAndClose(onAniListImportClick)} className={`${ACTION_ROW} items-start`}>
                  <Download size={15} className="shrink-0 mt-0.5 text-[#02A9FF]/70" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-black text-[var(--kr-text)]">Importar desde AniList</span>
                    <span className="block text-[11px] text-zinc-500 leading-snug mt-0.5">
                      Solo con tu usuario, sin archivos
                    </span>
                  </span>
                </button>
              )}
              {onExport && (
                <>
                  <button onClick={runAndClose(() => onExport('xml'))} className={`${ACTION_ROW} items-start`}>
                    <Download size={15} className="shrink-0 mt-0.5 text-zinc-600" />
                    <span className="flex-1 min-w-0">
                      <span className="block text-xs font-black text-[var(--kr-text)]">Exportar XML de MyAnimeList</span>
                      <span className="block text-[11px] text-zinc-500 leading-snug mt-0.5">
                        Para llevártela a MAL, AniList u otra app
                      </span>
                    </span>
                  </button>
                  <button onClick={runAndClose(() => onExport('json'))} className={`${ACTION_ROW} items-start`}>
                    <Download size={15} className="shrink-0 mt-0.5 text-zinc-600" />
                    <span className="flex-1 min-w-0">
                      <span className="block text-xs font-black text-[var(--kr-text)]">Exportar JSON completo</span>
                      <span className="block text-[11px] text-zinc-500 leading-snug mt-0.5">
                        Respaldo con favoritos, géneros y portadas
                      </span>
                    </span>
                  </button>
                </>
              )}
            </>
          )}

          <div className="border-t border-[#FF3B3B]/10" />
          <p className={SECTION_LABEL}>Apariencia</p>
          <SettingSwitch
            checked={theme === 'light'}
            saving={false}
            onToggle={toggleTheme}
            icon={theme === 'light' ? Sun : Moon}
            label="Modo claro"
            description={theme === 'light'
              ? 'Estás usando el tema claro.'
              : 'Oscuro es el tema por defecto de Kiroku.'}
          />

          <div className="border-t border-[#FF3B3B]/10" />
          <button
            onClick={runAndClose(onSignOut)}
            className={`${ACTION_ROW} text-zinc-500 hover:text-[#FF3B3B] hover:bg-[#FF3B3B]/10`}
          >
            <LogOut size={15} className="shrink-0" />
            <span className="text-xs font-black">Cerrar sesión</span>
          </button>
        </div>
      )}
    </div>
  );
};
