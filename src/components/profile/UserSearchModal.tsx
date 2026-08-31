import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import debounce from 'lodash.debounce';
import { X, Search, Loader2, Lock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { PublicProfileSummary } from '../../types/profile';
import { escapeLikePattern } from '../../utils/likePattern';

const RESULTS_LIMIT = 20;
const MIN_QUERY_LENGTH = 2;

interface UserSearchModalProps {
  excludeUserId?: string | null;
  onClose: () => void;
}

export const UserSearchModal = ({ excludeUserId, onClose }: UserSearchModalProps) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PublicProfileSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const debouncedSearch = useMemo(() =>
    debounce(async (term: string) => {
      let request = supabase
        .from('public_profiles')
        .select('id, username, avatar_url, is_private')
        // Escapado para que un `_` escrito por el usuario se busque literal
        // en vez de comportarse como comodín (ver utils/likePattern.ts).
        .ilike('username', `%${escapeLikePattern(term)}%`)
        .order('username', { ascending: true })
        .limit(RESULTS_LIMIT);

      if (excludeUserId) request = request.neq('id', excludeUserId);

      const { data } = await request;
      setResults((data ?? []) as PublicProfileSummary[]);
      setLoading(false);
      setSearched(true);
    }, 300),
  [excludeUserId]);

  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch]);

  const handleChange = (value: string) => {
    setQuery(value);
    const term = value.trim();
    if (term.length < MIN_QUERY_LENGTH) {
      debouncedSearch.cancel();
      setResults([]);
      setLoading(false);
      setSearched(false);
      return;
    }
    setLoading(true);
    debouncedSearch(term);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-md bg-[var(--kr-surface)] border border-[#FF3B3B]/20 rounded-2xl overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.8)]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#FF3B3B]/10">
          <h2 className="font-black text-[var(--kr-text)] text-lg flex items-center gap-2">
            <Search size={16} className="text-[#FF3B3B]/60" /> Buscar usuarios
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-zinc-500 hover:text-[var(--kr-text)] transition-colors rounded-lg hover:bg-[var(--kr-text)]/5"
          >
            <X size={18} />
          </button>
        </div>

        {/* Input */}
        <div className="px-6 py-4 border-b border-[#FF3B3B]/10">
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
            <input
              autoFocus
              value={query}
              onChange={e => handleChange(e.target.value)}
              placeholder="Nombre de usuario..."
              maxLength={20}
              className="w-full bg-[var(--kr-surface-sunken)] border border-[#FF3B3B]/15 focus:border-[#FF3B3B]/50 text-[var(--kr-text)] rounded-xl pl-10 pr-3 py-2.5 text-sm font-bold outline-none placeholder:text-zinc-600 placeholder:font-medium transition-colors"
            />
          </div>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="flex justify-center items-center py-16">
              <Loader2 className="animate-spin text-[#FF3B3B]" size={24} />
            </div>
          ) : !searched ? (
            <div className="py-16 text-center px-6">
              <p className="text-zinc-600 text-sm font-bold">
                Escribe al menos {MIN_QUERY_LENGTH} caracteres para buscar
              </p>
            </div>
          ) : results.length === 0 ? (
            <div className="py-16 text-center px-6">
              <p className="text-zinc-600 text-sm font-bold">
                Ningún usuario coincide con "{query.trim()}"
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-[#FF3B3B]/5">
              {results.map(user => (
                <li key={user.id}>
                  <Link
                    to={`/u/${user.username}`}
                    onClick={onClose}
                    className="flex items-center gap-4 px-6 py-4 hover:bg-[var(--kr-text)]/[0.03] transition-colors"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[var(--kr-surface-sunken)] border border-[#FF3B3B]/10 overflow-hidden shrink-0 flex items-center justify-center font-black text-[var(--kr-text)] text-sm">
                      {user.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt={user.username}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        user.username?.charAt(0).toUpperCase()
                      )}
                    </div>
                    <span className="font-bold text-[var(--kr-text)] text-sm flex-1">@{user.username}</span>
                    {user.is_private && <Lock size={13} className="text-zinc-600 shrink-0" />}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
