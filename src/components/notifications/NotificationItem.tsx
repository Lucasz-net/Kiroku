import { Link } from 'react-router-dom';
import type { AppNotification } from '../../hooks/useNotifications';
import { NOTIFICATION_META, relativeTime } from './notificationMeta';

interface NotificationItemProps {
  notification: AppNotification;
  /** Se resalta si es posterior a la última vez que se abrió la campanita. */
  unseen?: boolean;
  onNavigate?: () => void;
}

export const NotificationItem = ({ notification, unseen, onNavigate }: NotificationItemProps) => {
  const meta = NOTIFICATION_META[notification.kind];
  if (!meta) return null;
  const Icon = meta.icon;

  return (
    <Link
      to={meta.href(notification)}
      onClick={onNavigate}
      className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-[var(--kr-text)]/[0.03] ${
        unseen ? 'bg-[#FF3B3B]/[0.045]' : ''
      }`}
    >
      {/* Avatar de quien la generó */}
      <div className="relative shrink-0">
        <div className="w-9 h-9 rounded-lg bg-[var(--kr-surface-sunken)] border border-[#FF3B3B]/10 overflow-hidden flex items-center justify-center font-black text-[var(--kr-text)] text-xs">
          {notification.actor_avatar ? (
            <img src={notification.actor_avatar} alt="" aria-hidden className="w-full h-full object-cover" />
          ) : (
            notification.actor_username?.charAt(0).toUpperCase()
          )}
        </div>
        <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[var(--kr-surface)] border border-[#FF3B3B]/20 flex items-center justify-center ${meta.color}`}>
          <Icon size={9} />
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[13px] leading-snug text-zinc-300">
          <span className="font-black text-[var(--kr-text)]">@{notification.actor_username}</span>{' '}
          {meta.text(notification)}
        </p>
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mt-1">
          {relativeTime(notification.created_at)}
        </p>
      </div>

      {notification.subject_image && (
        <div className="w-8 h-11 shrink-0 rounded-md overflow-hidden bg-[var(--kr-surface-sunken)] border border-[#FF3B3B]/10">
          <img src={notification.subject_image} alt="" aria-hidden className="w-full h-full object-cover" />
        </div>
      )}

      {unseen && <span className="w-1.5 h-1.5 rounded-full bg-[#FF3B3B] shrink-0 mt-2" />}
    </Link>
  );
};
