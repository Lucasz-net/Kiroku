import { useState, useRef } from 'react';
import {
  X, Download, FileText, CheckCircle2, AlertCircle,
  Loader2, Tv, Play, Clock,
} from 'lucide-react';
import { parseMalXml, getMalStatusCounts, getReclassifiedCounts, readMalListFile, type MalAnimeEntry } from '../../utils/malXmlParser';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { useUserData } from '../../contexts/UserDataContext';

interface ImportXMLModalProps {
  userId: string;
  existingAnimeIds: Set<number>;
  onClose: () => void;
  onImportComplete: () => void;
}

type Phase = 'pick' | 'parsing' | 'preview' | 'importing' | 'done';

interface ImportResult {
  imported: number;
  skipped: number;
  failed: number;
}

/** Filas por lote en el guardado inicial. */
const INSERT_BATCH = 100;

export const ImportXMLModal = ({
  userId,
  existingAnimeIds,
  onClose,
  onImportComplete,
}: ImportXMLModalProps) => {
  const { startImportEnrichment } = useUserData();
  const [phase, setPhase] = useState<Phase>('pick');
  const [entries, setEntries] = useState<MalAnimeEntry[]>([]);
  const [toImport, setToImport] = useState<MalAnimeEntry[]>([]);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith('.xml') && !name.endsWith('.xml.gz') && !name.endsWith('.gz')) {
      setParseError('Por favor seleccioná un archivo .xml o .xml.gz exportado desde MyAnimeList.');
      return;
    }
    setParseError(null);
    setPhase('parsing');
    try {
      const text = await readMalListFile(file);
      const parsed = parseMalXml(text);
      setEntries(parsed);
      const newOnes = parsed.filter(e => !existingAnimeIds.has(e.malId));
      setToImport(newOnes);
      setPhase('preview');
    } catch (err: unknown) {
      setParseError(err instanceof Error ? err.message : 'Error al leer el archivo.');
      setPhase('pick');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // ── Fase 1: guardar la lista ───────────────────────────────────────────
  // Solo con lo que ya trae el XML (título, episodios, progreso, nota,
  // estado) y en lotes: cero llamadas a APIs externas, así que una lista de
  // 500 animes entra en segundos.
  //
  // Antes se consultaba AniList y Jikan por cada anime, con 370 ms de pausa
  // entre uno y otro. Medido contra la API: AniList está limitando a 30
  // peticiones por minuto (cabecera X-RateLimit-Limit), o sea 2 segundos por
  // pedido — con esa pausa la importación no solo tardaba, se comía 429s. Las
  // portadas ahora se resuelven al mostrarse (ver SavedAnimeCover) y el resto
  // de los datos queda para la fase 2, opcional.
  const handleImport = async () => {
    setPhase('importing');
    let imported = 0;
    let failed = 0;

    const rows = toImport.map(entry => ({
      user_id: userId,
      anime_id: entry.malId,
      title: entry.title || `Anime ${entry.malId}`,
      image_url: '',
      status: entry.status,
      episodes_total: entry.totalEpisodes || null,
      score: null,
      user_score: entry.userScore || null,
      is_favorite: false,
      year: null,
      genres: [],
      studios: [],
      duration: null,
      progress: entry.watchedEpisodes || null,
    }));

    for (let i = 0; i < rows.length; i += INSERT_BATCH) {
      const chunk = rows.slice(i, i + INSERT_BATCH);
      // `ignoreDuplicates` para que una fila ya existente no tire el lote
      // entero abajo (puede haberse agregado entre la vista previa y esto).
      const { error } = await supabase
        .from('saved_animes')
        .upsert(chunk, { onConflict: 'user_id,anime_id', ignoreDuplicates: true });

      if (error) failed += chunk.length;
      else imported += chunk.length;

      setProgress(Math.round(Math.min(i + INSERT_BATCH, rows.length) / rows.length * 100));
    }

    setResult({ imported, skipped: entries.length - toImport.length, failed });
    setPhase('done');
    if (imported > 0) {
      toast.success(`¡Listo! ${imported} anime${imported !== 1 ? 's' : ''} en tu lista.`);
      onImportComplete();
      // Géneros, estudios y portadas se completan en segundo plano — el
      // usuario ya puede cerrar este modal y seguir usando Kiroku mientras
      // tanto; el progreso se ve en su perfil (ver UserDataContext).
      startImportEnrichment(userId, toImport);
    }
  };

  const statusCounts = getMalStatusCounts(entries);
  const reclassified = getReclassifiedCounts(toImport);
  const reclassifiedTotal = Object.values(reclassified).reduce((a, b) => a + b, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget && phase !== 'parsing' && phase !== 'importing') onClose(); }}
    >
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => phase !== 'parsing' && phase !== 'importing' && onClose()} />

      <div className="relative z-10 w-full max-w-lg bg-[var(--kr-surface)] border border-[#FF3B3B]/20 rounded-2xl overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.85)]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#FF3B3B]/10">
          <div>
            <h2 className="font-black text-[var(--kr-text)] text-lg leading-tight">Importar lista de anime</h2>
            <p className="text-xs text-zinc-600 font-bold mt-0.5">Compatible con MyAnimeList y otros exportadores XML</p>
          </div>
          {phase !== 'parsing' && phase !== 'importing' && (
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
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-[#FF3B3B]/20 hover:border-[#FF3B3B]/50 rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-colors group"
              >
                <div className="w-14 h-14 rounded-2xl bg-[#FF3B3B]/10 flex items-center justify-center group-hover:bg-[#FF3B3B]/20 transition-colors">
                  <Download size={24} className="text-[#FF3B3B]" />
                </div>
                <p className="text-[var(--kr-text)] font-bold text-sm text-center">
                  Seleccioná tu archivo XML o XML.GZ
                </p>
                <p className="text-zinc-600 text-xs text-center">
                  Exportá desde MyAnimeList → Perfil → Exportar lista de anime
                </p>
                <span className="px-4 py-2 bg-[#FF3B3B] text-[var(--kr-text)] text-xs font-black uppercase tracking-widest rounded-lg">
                  Elegir archivo
                </span>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".xml,.gz,.xml.gz"
                className="hidden"
                onChange={handleFile}
              />
              {parseError && (
                <div className="flex items-start gap-2 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  {parseError}
                </div>
              )}
              <div className="bg-[var(--kr-surface-sunken)] border border-[#FF3B3B]/[0.07] rounded-xl p-4 text-xs text-zinc-600 leading-relaxed">
                <p className="font-black text-zinc-500 mb-1 flex items-center gap-1.5">
                  <FileText size={12} /> ¿Cómo exportar desde MAL?
                </p>
                Ingresá a <span className="text-zinc-400">myanimelist.net</span> → Perfil → Lista de anime → Exportar → descargá el archivo (puede venir comprimido como .xml.gz, no hace falta descomprimirlo) y seleccionalo aquí.
              </div>
            </div>
          )}

          {/* ── PHASE: parsing ── */}
          {phase === 'parsing' && (
            <div className="flex flex-col items-center gap-4 py-10">
              <Loader2 size={28} className="animate-spin text-[#FF3B3B]" />
              <div className="text-center">
                <p className="font-bold text-[var(--kr-text)] text-sm">Leyendo tu archivo...</p>
                <p className="text-xs text-zinc-600 mt-1">Un momento, no cierres esta ventana.</p>
              </div>
            </div>
          )}

          {/* ── PHASE: preview ── */}
          {phase === 'preview' && (
            <div className="flex flex-col gap-5">
              <div className="bg-[var(--kr-surface-sunken)] border border-[#FF3B3B]/10 rounded-xl p-5">
                <p className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-4">
                  Resumen del archivo
                </p>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[
                    { label: 'Total', value: entries.length, icon: FileText },
                    { label: 'Completados', value: statusCounts['Completado'] || 0, icon: CheckCircle2 },
                    { label: 'Mirando', value: statusCounts['Mirando'] || 0, icon: Play },
                    { label: 'Pendientes', value: statusCounts['Pendiente'] || 0, icon: Clock },
                    { label: 'Ya guardados', value: entries.length - toImport.length, icon: Tv },
                    { label: 'A importar', value: toImport.length, icon: Download },
                  ].map(({ label, value, icon: Icon }) => (
                    <div key={label} className="bg-[var(--kr-surface)] border border-[#FF3B3B]/[0.07] rounded-lg p-3">
                      <Icon size={13} className="text-[#FF3B3B]/40 mb-2" />
                      <span className="block text-xl font-black text-[var(--kr-text)] tabular-nums">{value}</span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">{label}</span>
                    </div>
                  ))}
                </div>
                {toImport.length > 0 && (
                  <p className="text-xs text-zinc-600 leading-relaxed">
                    Se guarda todo lo que trae el archivo —título, episodios, progreso y tu
                    puntuación— en unos segundos. Las portadas aparecen solas a medida que
                    mirás la lista.
                  </p>
                )}
              </div>

              {/* Kiroku no tiene "Abandonado" ni "En pausa", así que esas
                  entradas entran como "Pendiente". Se avisa antes de importar
                  en vez de cambiarle la lista sin decir nada. */}
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
                        .map(([s, n]) => `${s === 'Dropped' ? 'Abandonado' : 'En pausa'} (${n})`)
                        .join(' y ')}
                      , así que esas entradas se guardan como pendientes. Podés cambiarlas a mano después.
                    </p>
                  </div>
                </div>
              )}

              {toImport.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-zinc-400 bg-zinc-800/40 border border-zinc-700/30 rounded-xl px-4 py-3">
                  <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                  Todos los animes del archivo ya están en tu lista.
                </div>
              ) : (
                <div className="bg-[var(--kr-surface-sunken)] border border-[#FF3B3B]/[0.07] rounded-xl p-4 text-xs text-zinc-600">
                  Los animes ya guardados se omitirán sin modificar tu progreso o puntajes actuales.
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => { setPhase('pick'); setEntries([]); setToImport([]); }}
                  className="flex-1 py-3 border border-[#FF3B3B]/20 text-zinc-400 hover:text-[var(--kr-text)] font-black text-xs uppercase tracking-widest rounded-xl transition-colors hover:border-[#FF3B3B]/40"
                >
                  Cambiar archivo
                </button>
                {toImport.length > 0 && (
                  <button
                    onClick={handleImport}
                    className="flex-1 py-3 bg-[#FF3B3B] hover:bg-[#FF6B6B] text-[var(--kr-text)] font-black text-xs uppercase tracking-widest rounded-xl transition-colors"
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
                <Loader2 size={20} className="animate-spin text-[#FF3B3B] shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[var(--kr-text)] text-sm">Guardando tu lista...</p>
                  <p className="text-xs text-zinc-600 mt-0.5">Un momento, no cierres esta ventana.</p>
                </div>
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-xs text-zinc-600 font-bold mb-2">
                  <span>Progreso</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 bg-[var(--kr-surface-sunken)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#FF3B3B] to-[#FF6B6B] rounded-full transition-all duration-300"
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
                  <div key={label} className="bg-[var(--kr-surface-sunken)] border border-[#FF3B3B]/[0.07] rounded-xl p-4 text-center">
                    <span className={`block text-2xl font-black tabular-nums ${color}`}>{value}</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">{label}</span>
                  </div>
                ))}
              </div>

              {result.failed > 0 && (
                <p className="text-xs text-zinc-600 leading-relaxed">
                  {result.failed} anime{result.failed !== 1 ? 's' : ''} no pudieron importarse (probablemente removidos de MAL o problemas de red).
                </p>
              )}

              {/* Géneros, estudios y portadas se completan solos en segundo
                  plano (ver UserDataContext) — no hace falta esperar acá. */}
              {result.imported > 0 && (
                <p className="text-xs text-zinc-600 leading-relaxed">
                  Los géneros, estudios y portadas se están completando en segundo plano.
                  Podés cerrar esta ventana y seguir usando Kiroku — vas a ver el progreso
                  en tu perfil.
                </p>
              )}

              <button
                onClick={onClose}
                className="w-full py-3 bg-[#FF3B3B] hover:bg-[#FF6B6B] text-[var(--kr-text)] font-black text-xs uppercase tracking-widest rounded-xl transition-colors"
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
