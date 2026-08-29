import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useUserData } from '../contexts/UserDataContext';

export type NotificationKind =
  | 'follow'
  | 'follow_request'
  | 'comment'
  | 'activity_added'
  | 'activity_completed'
  | 'activity_top10'
  | 'activity_character';

export interface AppNotification {
  kind: NotificationKind;
  actor_id: string;
  actor_username: string;
  actor_avatar: string | null;
  subject_id: string | null;
  subject_title: string | null;
  subject_image: string | null;
  created_at: string;
}

export const NOTIFICATIONS_PAGE_SIZE = 30;

/**
 * Feed unificado: lo que te pasó a vos (seguidores, solicitudes, comentarios)
 * y lo que hicieron las cuentas que seguís.
 *
 * No hay tabla de notificaciones: la función `get_notifications` las arma
 * cruzando las tablas que ya existen. Por eso dejar de seguir a alguien hace
 * desaparecer sus notificaciones al instante, sin ningún borrado.
 */
export function useNotifications(pageSize = NOTIFICATIONS_PAGE_SIZE) {
  const { session } = useUserData();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const fetchPage = useCallback(async (offset: number) => {
    const { data } = await supabase.rpc('get_notifications', {
      p_limit: pageSize,
      p_offset: offset,
    });
    return (data ?? []) as AppNotification[];
  }, [pageSize]);

  const refresh = useCallback(async () => {
    if (!session) {
      setItems([]); setUnread(0); setLoading(false); setHasMore(false);
      return;
    }
    const [page, { data: count }] = await Promise.all([
      fetchPage(0),
      supabase.rpc('count_unread_notifications'),
    ]);
    setItems(page);
    setHasMore(page.length === pageSize);
    setUnread(typeof count === 'number' ? count : 0);
    setLoading(false);
  }, [session, fetchPage, pageSize]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    const page = await fetchPage(items.length);
    setItems(prev => [...prev, ...page]);
    setHasMore(page.length === pageSize);
    setLoadingMore(false);
  }, [fetchPage, items.length, pageSize]);

  /**
   * Mueve la marca de "visto" a ahora. Es un solo timestamp en el perfil, no
   * un estado por notificación: alcanza para el contador y no deja estado
   * huérfano cuando una notificación deja de existir (por ejemplo al dejar de
   * seguir a alguien).
   */
  const markAllSeen = useCallback(async () => {
    if (!session || unread === 0) return;
    setUnread(0);
    await supabase
      .from('profiles')
      .update({ notifications_seen_at: new Date().toISOString() })
      .eq('id', session.user.id);
  }, [session, unread]);

  return { items, unread, loading, loadingMore, hasMore, refresh, loadMore, markAllSeen };
}
