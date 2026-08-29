import {
  UserPlus, UserCheck, MessageSquare, BookmarkCheck, Plus, Trophy, Heart,
  type LucideIcon,
} from 'lucide-react';
import type { AppNotification, NotificationKind } from '../../hooks/useNotifications';

interface KindMeta {
  icon: LucideIcon;
  color: string;
  /** Texto que sigue al nombre de usuario. */
  text: (n: AppNotification) => string;
  /** A dónde lleva al tocarla. */
  href: (n: AppNotification) => string;
}

export const NOTIFICATION_META: Record<NotificationKind, KindMeta> = {
  follow: {
    icon: UserPlus,
    color: 'text-[#FF3B3B]',
    text: () => 'empezó a seguirte',
    href: n => `/u/${n.actor_username}`,
  },
  follow_request: {
    icon: UserCheck,
    color: 'text-amber-400',
    text: () => 'quiere seguirte',
    href: () => '/profile',
  },
  comment: {
    icon: MessageSquare,
    color: 'text-[#FF7777]',
    text: n => `comentó en tu perfil: “${n.subject_title ?? ''}”`,
    href: () => '/profile',
  },
  activity_completed: {
    icon: BookmarkCheck,
    color: 'text-emerald-400',
    text: n => `completó ${n.subject_title ?? 'un anime'}`,
    href: n => `/anime/${n.subject_id}`,
  },
  activity_added: {
    icon: Plus,
    color: 'text-[#FF9B9B]',
    text: n => `agregó ${n.subject_title ?? 'un anime'} a su lista`,
    href: n => `/anime/${n.subject_id}`,
  },
  activity_top10: {
    icon: Trophy,
    color: 'text-amber-400',
    text: n => `puso ${n.subject_title ?? 'un anime'} en su Top 10`,
    href: n => `/top10/${n.actor_username}`,
  },
  activity_character: {
    icon: Heart,
    color: 'text-[#FF3B3B]',
    text: n => `marcó a ${n.subject_title ?? 'un personaje'} como favorito`,
    href: n => `/u/${n.actor_username}`,
  },
};

export const relativeTime = (dateStr: string): string => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'ahora';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  if (d < 30) return `${Math.floor(d / 7)}sem`;
  return new Date(dateStr).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
};
