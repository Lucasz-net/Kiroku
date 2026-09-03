import { useState } from 'react';
import {
  X, CheckCircle2, AlertCircle, Loader2, Tv, Play, Clock, ListChecks, Download, ShieldCheck,
} from 'lucide-react';
import {
  fetchAniListUserList, getStatusCounts, getReclassifiedCounts,
  normalizeAniListUsername, RECLASSIFIED_STATUSES, AniListUserNotFoundError,
  type AniListImportEntry,
} from '../../services/aniListImport';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

interface ImportAniListModalProps {
  userId: string;
  existingAnimeIds: Set<number>;
  onClose: () => void;
  onImportComplete: () => void;
}

type Phase = 'pick' | 'fetching' | 'preview' | 'importing' | 'done';

interface ImportResult {
  imported: number;
  skipped: number;
  failed: number;
}

/** Filas por lote en el guardado. Mismo tamaño que la importación de MAL. */
const INSERT_BATCH = 100;

/**
 * Importar desde AniList.
 *
 * A diferencia del de MyAnimeList, este no pide ningún archivo: alcanza con
 * el nombre de usuario, porque AniList publica la lista de cualquier perfil
 * público en su API sin autenticación. Ver `src/services/aniListImport.ts`
 * para el porqué y para la parte de seguridad — acá nunca se pide una
 * contraseña ni se guarda ningún token.
 *
 * La otra diferencia es que la respuesta ya trae portada, géneros, estudios,
 * año y duración, así que las filas se guardan completas y **no** hace falta
 * el pase de completado en segundo plano que sí necesita la de MAL.
 */
export const ImportAniListModal = ({
  userId,
  existingAnimeIds,
  onClose,
  onImportComplete,
}: ImportAniListModalProps) => {
  const [phase, setPhase] = useState<Phase>('pick');
  const [username, setUsername] = useState('');
  const [entries, setEntries] = useState<AniListImportEntry[]>([]);
  const [toImport, setToImport] = useState<AniListImportEntry[]>([]);
  const [withoutMalId, setWithoutMalId] = useState(0);
  const [loaded, setLoaded] = useState(0);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const busy = phase === 'fetching' || phase === 'importing';

  const handleFetch = async () => {
    const name = normalizeAniListUsername(username);
    if (!name) {
      setError('Escribí tu nombre de usuario de AniList.');
      return;
    }

    setError(null);
    setLoaded(0);
    setPhase('fetching');

    try {
      const res = await fetchAniListUserList(name, setLoaded);

      if (res.entries.length === 0) {
        setError(
          `La cuenta "${name}" existe, pero su lista de anime está vacía o no es pública. ` +
          'Revisá en AniList que la lista se pueda ver sin iniciar sesión.',
        );
        setPhase('pick');
        return;
      }

      setEntries(res.entries);
      setWithoutMalId(res.withoutMalId);
      setToImport(res.entries.filter(e => !existingAnimeIds.has(e.malId)));
      setPhase('preview');
    } catch (err) {
      setError(
        err instanceof AniListUserNotFoundError
          ? `No encontramos la cuenta "${name}" en AniList. Fijate que esté bien escrita.`
          : err instanceof Error ? err.message : 'No se pudo leer la lista. Probá de nuevo.',
      );
      setPhase('pick');
    }
  };

  const handleImport = async () => {
    setPhase('importing');
    let imported = 0;
    let failed = 0;

    const rows = toImport.map(entry => ({
      user_id: userId,
      anime_id: entry.malId,
      title: entry.title,
      image_url: entry.imageUrl,
      status: entry.status,
      episodes_total: entry.totalEpisodes || null,
      score: entry.score,
      user_score: entry.userScore || null,
      is_favorite: false,
      year: entry.year,
      genres: entry.genres,
      studios: entry.studios,
      duration: entry.duration,
      progress: entry.watchedEpisodes || null,
    }));

    for (let i = 0; i < rows.length; i += INSERT_BATCH) {
      const chunk = rows.slice(i, i + INSERT_BATCH);
      // `ignoreDuplicates` para que una fila que ya existía no tire abajo el
      // lote entero (puede haberse agregado entre la vista previa y esto).
      const { error: insertError } = await supabase
        .from('saved_animes')
        .upsert(chunk, { onConflict: 'user_id,anime_id', ignoreDuplicates: true });

      if (insertError) failed += chunk.length;
      else imported += chunk.length;

      setProgress(Math.round(Math.min(i + INSERT_BATCH, rows.length) / rows.length * 100));
    }

    setResult({ imported, skipped: entries.length - toImport.length, failed });
    setPhase('done');
    if (imported > 0) {
      toast.success(`¡Listo! ${imported} anime${imported !== 1 ? 's' : ''} en tu lista.`);
      onImportComplete();
    }
  };

  const statusCounts = getStatusCounts(entries);
  const reclassified = getReclassifiedCounts(toImport);
  const reclassifiedTotal = Object.values(reclassified).reduce((a, b) => a + b, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget && !busy) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => !busy && onClose()} />

      <div className="relative z-10 w-full max-w-lg bg-[var(--kr-surface)] border border-[#02A9FF]/25 rounded-2xl overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.85)]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#02A9FF]/10">
          <div>
            <h2 className="font-black text-[var(--kr-text)] text-lg leading-tight">Importar desde AniList</h2>
            <p className="text-xs text-zinc-600 font-bold mt-0.5">Con tu nombre de usuario, sin archivos ni contraseñas</p>
          </div>
          {!busy && (
            <button
              onClick={onClose}
              className="p-2 text-zinc-500 hover:text-[var(--kr-text)] transition-colors rounded-lg hover:bg-[var(--kr-text)]/5"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <div className="px-6 py-6">

          {/* ── PHASE: pick ── */}
          {phase === 'pick' && (
            <div className="flex flex-col gap-5">
              <div>
                <label htmlFor="anilist-user" className="block text-xs font-black uppercase tracking-widest text-zinc-500 mb-2">
                  Tu usuario de AniList
                </label>
                <input
                  id="anilist-user"
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleFetch(); }}
                  placeholder="Nombre de usuario o enlace a tu perfil"
                  autoComplete="off"
                  autoFocus
                  className="w-full bg-[var(--kr-surface-sunken)] text-[var(--kr-text)] border border-[#02A9FF]/20 focus:border-[#02A9FF]/60 outline-none px-4 py-3.5 rounded-xl text-sm font-bold transition-colors placeholder:text-zinc-700 placeholder:font-normal"
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{error}</span>
                </div>
              )}

              <button
                onClick={handleFetch}
                className="w-full py-3.5 bg-[#02A9FF] hover:bg-[#3BBDFF] text-white font-black text-xs uppercase tracking-widest rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Download size={15} /> Buscar mi lista
              </button>

              {/* Lo primero que se pregunta cualquiera al ver un campo así. */}
              <div className="bg-[var(--kr-surface-sunken)] border border-[#02A9FF]/[0.12] rounded-xl p-4 text-xs text-zinc-500 leading-relaxed flex gap-3">
                <ShieldCheck size={15} className="text-[#02A9FF] shrink-0 mt-0.5" />
                <div>
                  <p className="font-black text-zinc-400 mb-1">Solo lectura, sin contraseñas</p>
                  Leemos tu lista pública desde la API de AniList, igual que si alguien entrara a tu
                  perfil. No te pedimos la contraseña, no se guarda ningún acceso y no podemos
                  modificar nada de tu cuenta. Lo que tengas marcado como privado no se importa.
                </div>
              </div>

              <div className="bg-[var(--kr-surface-sunken)] border border-[#02A9FF]/[0.07] rounded-xl p-4 text-xs text-zinc-600 leading-relaxed">
                <p className="font-black text-zinc-500 mb-1 flex items-center gap-1.5">
                  <ListChecks size={12} /> ¿Dónde encuentro mi usuario?
                </p>
                Es el nombre que aparece en la URL de tu perfil:{' '}
                <span className="text-zinc-400">anilist.co/user/<span className="text-[#02A9FF]">TuUsuario</span></span>.
                También podés pegar el enlace completo.
              </div>
            </div>
          )}

          {/* ── PHASE: fetching ── */}
          {phase === 'fetching' && (
            <div className="flex flex-col items-center gap-4 py-10">
              <Loader2 size={28} className="animate-spin text-[#02A9FF]" />
              <div className="text-center">
                <p className="font-bold text-[var(--kr-text)] text-sm">Leyendo tu lista en AniList...</p>
                <p className="text-xs text-zinc-600 mt-1">
                  {loaded > 0 ? `${loaded} animes encontrados` : 'Un momento, no cierres esta ventana.'}
                </p>
              </div>
            </div>
          )}

          {/* ── PHASE: preview ── */}
          {phase === 'preview' && (
            <div className="flex flex-col gap-5">
              <div className="bg-[var(--kr-surface-sunken)] border border-[#02A9FF]/10 rounded-xl p-5">
                <p className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-4">
                  Lista de {normalizeAniListUsername(username)}
                </p>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[
                    { label: 'Total', value: entries.length, icon: ListChecks },
                    { label: 'Completados', value: statusCounts['Completado'] || 0, icon: CheckCircle2 },
                    { label: 'Mirando', value: statusCounts['Mirando'] || 0, icon: Play },
                    { label: 'Pendientes', value: statusCounts['Pendiente'] || 0, icon: Clock },
                    { label: 'Ya guardados', value: entries.length - toImport.length, icon: Tv },
                    { label: 'A importar', value: toImport.length, icon: Download },
                  ].map(({ label, value, icon: Icon }) => (
                    <div key={label} className="bg-[var(--kr-surface)] border border-[#02A9FF]/[0.07] rounded-lg p-3">
                      <Icon size={13} className="text-[#02A9FF]/40 mb-2" />
                      <span className="block text-xl font-black text-[var(--kr-text)] tabular-nums">{value}</span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">{label}</span>
                    </div>
                  ))}
                </div>
                {toImport.length > 0 && (
                  <p className="text-xs text-zinc-600 leading-relaxed">
                    AniList devuelve también portadas, géneros, estudios y duración, así que la
                    lista entra completa de una: no hay que esperar a que se complete después.
                  </p>
                )}
              </div>

              {/* Kiroku no tiene "Abandonado" ni "En pausa": se avisa antes de
                  importar en vez de cambiarle la lista sin decir nada. */}
              {reclassifiedTotal > 0 && (
                <div className="flex items-start gap-2.5 text-sm text-amber-300/90 bg-amber-400/[0.07] border border-amber-400/25 rounded-xl px-4 py-3">
                  <AlertCircle size={15} className="shrink-0 mt-0.5 text-amber-400" />
                  <div className="leading-relaxed">
                    <p className="font-bold text-amber-200 mb-0.5">
                      {reclassifiedTotal} anime{reclassifiedTotal !== 1 ? 's' : ''} van a quedar como “Pendiente”
                    </p>
                    <p className="text-amber-300/70 text-xs">
                      Kiroku todavía no tiene los estados{' '}
                      {Object.entries(reclassified)
                        .map(([s, n]) => `${RECLASSIFIED_STATUSES[s]} (${n})`)
                        .join(' y ')}
                      , así que esas entradas se guardan como pendientes. Podés cambiarlas a mano después.
                    </p>
                  </div>
                </div>
              )}

              {/* Kiroku indexa por id de MyAnimeList, así que lo que solo
                  existe en AniList no se puede guardar. Mejor decirlo que
                  dejar que la cuenta no cierre. */}
              {withoutMalId > 0 && (
                <div className="flex items-start gap-2.5 text-xs text-zinc-500 bg-[var(--kr-surface-sunken)] border border-[#02A9FF]/[0.07] rounded-xl px-4 py-3 leading-relaxed">
                  <AlertCircle size={14} className="shrink-0 mt-0.5 text-zinc-600" />
                  <span>
                    {withoutMalId} entrada{withoutMalId !== 1 ? 's' : ''} de tu lista no{withoutMalId !== 1 ? ' tienen' : ' tiene'} equivalente
                    en MyAnimeList, que es el catálogo con el que trabaja Kiroku, así que no se{withoutMalId !== 1 ? ' pueden' : ' puede'} importar.
                  </span>
                </div>
              )}

              {toImport.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-zinc-400 bg-zinc-800/40 border border-zinc-700/30 rounded-xl px-4 py-3">
                  <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                  Todos los animes de esa lista ya están en la tuya.
                </div>
              ) : (
                <div className="bg-[var(--kr-surface-sunken)] border border-[#02A9FF]/[0.07] rounded-xl p-4 text-xs text-zinc-600">
                  Los animes ya guardados se omiten sin tocar tu progreso ni tus puntajes actuales.
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => { setPhase('pick'); setEntries([]); setToImport([]); setWithoutMalId(0); }}
                  className="flex-1 py-3 border border-[#02A9FF]/20 text-zinc-400 hover:text-[var(--kr-text)] font-black text-xs uppercase tracking-widest rounded-xl transition-colors hover:border-[#02A9FF]/40"
                >
                  Otra cuenta
                </button>
                {toImport.length > 0 && (
                  <button
                    onClick={handleImport}
                    className="flex-1 py-3 bg-[#02A9FF] hover:bg-[#3BBDFF] text-white font-black text-xs uppercase tracking-widest rounded-xl transition-colors"
                  >
                    Importar {toImport.length} anime{toImport.length !== 1 ? 's' : ''}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── PHASE: importing ── */}
          {phase === 'importing' && (
            <div className="flex flex-col gap-6 py-2">
              <div className="flex items-center gap-3">
                <Loader2 size={20} className="animate-spin text-[#02A9FF] shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[var(--kr-text)] text-sm">Guardando tu lista...</p>
                  <p className="text-xs text-zinc-600 mt-0.5">Un momento, no cierres esta ventana.</p>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-zinc-600 font-bold mb-2">
                  <span>Progreso</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 bg-[var(--kr-surface-sunken)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#02A9FF] to-[#3BBDFF] rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-zinc-700 mt-2">
                  {Math.round((progress / 100) * toImport.length)} / {toImport.length} animes
                </p>
              </div>
            </div>
          )}

          {/* ── PHASE: done ── */}
          {phase === 'done' && result && (
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <CheckCircle2 size={22} className="text-emerald-500" />
                </div>
                <div>
                  <p className="font-black text-[var(--kr-text)] text-base">¡Importación completada!</p>
                  <p className="text-xs text-zinc-600 mt-0.5">Tu lista fue actualizada exitosamente.</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Importados', value: result.imported, color: 'text-emerald-400' },
                  { label: 'Ya existían', value: result.skipped, color: 'text-zinc-400' },
                  { label: 'Fallidos', value: result.failed, color: result.failed > 0 ? 'text-red-400' : 'text-zinc-600' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-[var(--kr-surface-sunken)] border border-[#02A9FF]/[0.07] rounded-xl p-4 text-center">
                    <span className={`block text-2xl font-black tabular-nums ${color}`}>{value}</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">{label}</span>
                  </div>
                ))}
              </div>

              {result.failed > 0 && (
                <p className="text-xs text-zinc-600 leading-relaxed">
                  {result.failed} anime{result.failed !== 1 ? 's' : ''} no pudieron guardarse. Podés volver a
                  intentarlo: los que sí entraron se omiten solos.
                </p>
              )}

              <button
                onClick={onClose}
                className="w-full py-3 bg-[#02A9FF] hover:bg-[#3BBDFF] text-white font-black text-xs uppercase tracking-widest rounded-xl transition-colors"
              >
                Cerrar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
