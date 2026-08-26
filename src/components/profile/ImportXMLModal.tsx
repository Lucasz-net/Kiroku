import { useState, useRef } from 'react';
import {
  X, Upload, FileText, CheckCircle2, AlertCircle,
  Loader2, Tv, Play, Clock,
} from 'lucide-react';
import { parseMalXml, getMalStatusCounts, readMalListFile, type MalAnimeEntry } from '../../utils/malXmlParser';
import { getAnimeById, getMediaImage } from '../../services/jikanApi';
import { getAnimeFullByMalId, type AniListAnimeBundle } from '../../services/aniListApi';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import type { JikanFullResponse } from '../../types/anime';

interface ImportXMLModalProps {
  userId: string;
  existingAnimeIds: Set<number>;
  onClose: () => void;
  onImportComplete: () => void;
}

type Phase = 'pick' | 'preview' | 'importing' | 'done';

interface ImportResult {
  imported: number;
  skipped: number;
  failed: number;
}

const DELAY_MS = 370;

async function delay(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

export const ImportXMLModal = ({
  userId,
  existingAnimeIds,
  onClose,
  onImportComplete,
}: ImportXMLModalProps) => {
  const [phase, setPhase] = useState<Phase>('pick');
  const [entries, setEntries] = useState<MalAnimeEntry[]>([]);
  const [toImport, setToImport] = useState<MalAnimeEntry[]>([]);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith('.xml') && !name.endsWith('.xml.gz') && !name.endsWith('.gz')) {
      setParseError('Por favor seleccioná un archivo .xml o .xml.gz exportado desde MyAnimeList.');
      return;
    }
    setParseError(null);
    try {
      const text = await readMalListFile(file);
      const parsed = parseMalXml(text);
      setEntries(parsed);
      const newOnes = parsed.filter(e => !existingAnimeIds.has(e.malId));
      setToImport(newOnes);
      setPhase('preview');
    } catch (err: unknown) {
      setParseError(err instanceof Error ? err.message : 'Error al leer el archivo.');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleImport = async () => {
    setPhase('importing');
    abortRef.current = false;
    let imported = 0;
    let failed = 0;

    for (let i = 0; i < toImport.length; i++) {
      if (abortRef.current) break;
      const entry = toImport[i];

      try {
        // AniList first — its own database, not a live proxy to MAL, so a
        // large import isn't as exposed to Jikan's occasional outages.
        let bundle: AniListAnimeBundle | null = null;
        try { bundle = await getAnimeFullByMalId(entry.malId); } catch { bundle = null; }

        let title: string, imageUrl: string, episodesTotal: number | null, score: number | null,
          year: number | null, genres: string[], studios: string[], duration: string | null;

        if (bundle) {
          const { anime } = bundle;
          title = anime.title_english || anime.title;
          imageUrl = anime.images.jpg.large_image_url || anime.images.jpg.image_url || '';
          episodesTotal = anime.episodes || entry.totalEpisodes || null;
          score = anime.score ?? null;
          year = anime.year ?? (anime.aired?.from ? new Date(anime.aired.from).getFullYear() : null);
          genres = anime.genres?.map(g => g.name) ?? [];
          studios = anime.studios?.map(s => s.name) ?? [];
          duration = anime.duration || null;

          // Prefer Jikan's cover (usually has the title logo baked in) when
          // it's reachable; otherwise the AniList cover above stands.
          try {
            const jikanImg = await getMediaImage('anime', entry.malId);
            const jUrl = jikanImg.data?.images?.jpg?.large_image_url || jikanImg.data?.images?.jpg?.image_url;
            if (jUrl) imageUrl = jUrl;
          } catch { /* keep AniList cover */ }
        } else {
          // AniList has no mapping for this MAL id (or errored) — fall back
          // to Jikan directly.
          const { data } = await getAnimeById(String(entry.malId)) as JikanFullResponse;
          title = data.title_english || data.title;
          imageUrl = data.images?.webp?.large_image_url || data.images?.jpg?.large_image_url || '';
          episodesTotal = data.episodes || entry.totalEpisodes || null;
          score = data.score ?? null;
          year = data.year ?? (data.aired?.from ? new Date(data.aired.from).getFullYear() : null);
          genres = data.genres?.map(g => g.name) ?? [];
          studios = data.studios?.map(s => s.name) ?? [];
          duration = data.duration || null;
        }

        await supabase.from('saved_animes').insert({
          user_id: userId,
          anime_id: entry.malId,
          title,
          image_url: imageUrl,
          status: entry.status,
          episodes_total: episodesTotal,
          score,
          user_score: entry.userScore || null,
          is_favorite: false,
          year,
          genres,
          studios,
          duration,
          progress: entry.watchedEpisodes || null,
        });

        imported++;
      } catch {
        failed++;
      }

      setProgress(Math.round(((i + 1) / toImport.length) * 100));

      if (i < toImport.length - 1) await delay(DELAY_MS);
    }

    setResult({ imported, skipped: entries.length - toImport.length, failed });
    setPhase('done');
    if (imported > 0) {
      toast.success(`¡Importación completada! ${imported} anime${imported !== 1 ? 's' : ''} añadidos.`);
      onImportComplete();
    }
  };

  const statusCounts = getMalStatusCounts(entries);
  const estimatedMinutes = Math.ceil((toImport.length * DELAY_MS) / 60000);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget && phase !== 'importing') onClose(); }}
    >
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => phase !== 'importing' && onClose()} />

      <div className="relative z-10 w-full max-w-lg bg-[#11131A] border border-[#FF3B3B]/20 rounded-2xl overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.85)]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#FF3B3B]/10">
          <div>
            <h2 className="font-black text-white text-lg leading-tight">Importar lista de anime</h2>
            <p className="text-xs text-zinc-600 font-bold mt-0.5">Compatible con MyAnimeList y otros exportadores XML</p>
          </div>
          {phase !== 'importing' && (
            <button
              onClick={onClose}
              className="p-2 text-zinc-500 hover:text-white transition-colors rounded-lg hover:bg-white/5"
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
                  <Upload size={24} className="text-[#FF3B3B]" />
                </div>
                <p className="text-white font-bold text-sm text-center">
                  Seleccioná tu archivo XML o XML.GZ
                </p>
                <p className="text-zinc-600 text-xs text-center">
                  Exportá desde MyAnimeList → Perfil → Exportar lista de anime
                </p>
                <span className="px-4 py-2 bg-[#FF3B3B] text-white text-xs font-black uppercase tracking-widest rounded-lg">
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
              <div className="bg-[#0D0F15] border border-[#FF3B3B]/[0.07] rounded-xl p-4 text-xs text-zinc-600 leading-relaxed">
                <p className="font-black text-zinc-500 mb-1 flex items-center gap-1.5">
                  <FileText size={12} /> ¿Cómo exportar desde MAL?
                </p>
                Ingresá a <span className="text-zinc-400">myanimelist.net</span> → Perfil → Lista de anime → Exportar → descargá el archivo (puede venir comprimido como .xml.gz, no hace falta descomprimirlo) y seleccionalo aquí.
              </div>
            </div>
          )}

          {/* ── PHASE: preview ── */}
          {phase === 'preview' && (
            <div className="flex flex-col gap-5">
              <div className="bg-[#0D0F15] border border-[#FF3B3B]/10 rounded-xl p-5">
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
                    { label: 'A importar', value: toImport.length, icon: Upload },
                  ].map(({ label, value, icon: Icon }) => (
                    <div key={label} className="bg-[#11131A] border border-[#FF3B3B]/[0.07] rounded-lg p-3">
                      <Icon size={13} className="text-[#FF3B3B]/40 mb-2" />
                      <span className="block text-xl font-black text-white tabular-nums">{value}</span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">{label}</span>
                    </div>
                  ))}
                </div>
                {toImport.length > 0 && (
                  <p className="text-xs text-zinc-600 leading-relaxed">
                    La importación obtendrá datos desde Jikan API (imágenes, géneros, estudios).
                    {toImport.length > 20
                      ? ` Tiempo estimado: ~${estimatedMinutes} minuto${estimatedMinutes !== 1 ? 's' : ''}.`
                      : ' Solo tomará unos segundos.'}
                  </p>
                )}
              </div>

              {toImport.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-zinc-400 bg-zinc-800/40 border border-zinc-700/30 rounded-xl px-4 py-3">
                  <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                  Todos los animes del archivo ya están en tu lista.
                </div>
              ) : (
                <div className="bg-[#0D0F15] border border-[#FF3B3B]/[0.07] rounded-xl p-4 text-xs text-zinc-600">
                  Los animes ya guardados se omitirán sin modificar tu progreso o puntajes actuales.
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => { setPhase('pick'); setEntries([]); setToImport([]); }}
                  className="flex-1 py-3 border border-[#FF3B3B]/20 text-zinc-400 hover:text-white font-black text-xs uppercase tracking-widest rounded-xl transition-colors hover:border-[#FF3B3B]/40"
                >
                  Cambiar archivo
                </button>
                {toImport.length > 0 && (
                  <button
                    onClick={handleImport}
                    className="flex-1 py-3 bg-[#FF3B3B] hover:bg-[#FF6B6B] text-white font-black text-xs uppercase tracking-widest rounded-xl transition-colors"
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
                <div>
                  <p className="font-bold text-white text-sm">Importando tu lista...</p>
                  <p className="text-xs text-zinc-600 mt-0.5">No cierres esta ventana.</p>
                </div>
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-xs text-zinc-600 font-bold mb-2">
                  <span>Progreso</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 bg-[#0D0F15] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#FF3B3B] to-[#FF6B6B] rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-zinc-700 mt-2">
                  {Math.round((progress / 100) * toImport.length)} / {toImport.length} animes procesados
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
                  <p className="font-black text-white text-base">¡Importación completada!</p>
                  <p className="text-xs text-zinc-600 mt-0.5">Tu lista fue actualizada exitosamente.</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Importados', value: result.imported, color: 'text-emerald-400' },
                  { label: 'Ya existían', value: result.skipped, color: 'text-zinc-400' },
                  { label: 'Fallidos', value: result.failed, color: result.failed > 0 ? 'text-red-400' : 'text-zinc-600' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-[#0D0F15] border border-[#FF3B3B]/[0.07] rounded-xl p-4 text-center">
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

              <button
                onClick={onClose}
                className="w-full py-3 bg-[#FF3B3B] hover:bg-[#FF6B6B] text-white font-black text-xs uppercase tracking-widest rounded-xl transition-colors"
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
