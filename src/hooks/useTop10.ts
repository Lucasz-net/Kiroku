import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Top10Entry } from '../types/profile';

export function useTop10(userId: string | null) {
  const [entries, setEntries] = useState<Top10Entry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTop10 = useCallback(async () => {
    if (!userId) { setEntries([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('profile_top10')
      .select('*')
      .eq('user_id', userId)
      .order('rank', { ascending: true });
    setEntries((data as Top10Entry[]) ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTop10();
  }, [fetchTop10]);

  // Reemplaza el top 10 completo: se borra todo y se reinserta con el
  // rank recalculado por posición — más simple que diffear altas/bajas/
  // reordenamientos contra lo que había antes.
  const save = async (newEntries: Top10Entry[]) => {
    if (!userId) return false;

    const { error: delError } = await supabase.from('profile_top10').delete().eq('user_id', userId);
    if (delError) return false;

    if (newEntries.length === 0) { setEntries([]); return true; }

    const rows = newEntries.map((entry, i) => ({
      user_id: userId,
      rank: i + 1,
      anime_id: entry.anime_id,
      title: entry.title,
      image_url: entry.image_url,
    }));

    const { data, error } = await supabase.from('profile_top10').insert(rows).select('*');
    if (error) return false;

    setEntries(((data as Top10Entry[]) ?? rows).slice().sort((a, b) => a.rank - b.rank));
    return true;
  };

  return { entries, loading, save, refetch: fetchTop10 };
}
