import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, Trash2, Send, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

interface ProfileComment {
  id: string;
  content: string;
  created_at: string;
  author_id: string;
  author: {
    username: string;
    avatar_url: string | null;
  } | null;
}

interface ProfileCommentsProps {
  profileId: string;
  currentUserId: string | null;
  isOwner: boolean;
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'ahora mismo';
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `hace ${d}d`;
  return new Date(dateStr).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
  });
}

export const ProfileComments = ({
  profileId,
  currentUserId,
  isOwner,
}: ProfileCommentsProps) => {
  const [comments, setComments] = useState<ProfileComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Two steps instead of an embedded (author_id → profiles) select:
  // `profiles` itself only allows reading your own row now, so comments by
  // other authors need their profile resolved against the public view.
  const resolveAuthors = async (ids: string[]) => {
    if (ids.length === 0) return new Map<string, { username: string; avatar_url: string | null }>();
    const { data } = await supabase
      .from('public_profiles')
      .select('id, username, avatar_url')
      .in('id', ids);
    return new Map((data ?? []).map(p => [p.id as string, { username: p.username, avatar_url: p.avatar_url }]));
  };

  useEffect(() => {
    const fetchComments = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('profile_comments')
        .select('id, content, created_at, author_id')
        .eq('profile_id', profileId)
        .order('created_at', { ascending: false })
        .limit(50);

      const rows = data ?? [];
      const authors = await resolveAuthors([...new Set(rows.map(r => r.author_id as string))]);
      setComments(rows.map(r => ({ ...r, author: authors.get(r.author_id as string) ?? null } as ProfileComment)));
      setLoading(false);
    };
    fetchComments();
  }, [profileId]);

  const handleSubmit = async () => {
    if (!currentUserId || !text.trim()) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('profile_comments')
        .insert({
          profile_id: profileId,
          author_id: currentUserId,
          content: text.trim(),
        })
        .select('id, content, created_at, author_id')
        .single();

      if (error) throw error;
      const authors = await resolveAuthors([currentUserId]);
      setComments(prev => [{ ...data, author: authors.get(currentUserId) ?? null } as ProfileComment, ...prev]);
      setText('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    } catch {
      toast.error('Error al publicar el comentario.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const { error } = await supabase
      .from('profile_comments')
      .delete()
      .eq('id', id);

    if (!error) {
      setComments(prev => prev.filter(c => c.id !== id));
    } else {
      toast.error('Error al eliminar el comentario.');
    }
    setDeletingId(null);
  };

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  return (
    <section className="profile-section bg-[#11131A] border border-[#FF3B3B]/10 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-[#FF3B3B]/10 flex items-center gap-2">
        <MessageSquare size={15} className="text-[#FF3B3B]/50" />
        <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500">
          Comentarios
        </h3>
        {!loading && (
          <span className="ml-auto text-xs font-bold text-zinc-600">
            {comments.length}
          </span>
        )}
      </div>

      {/* Form */}
      {currentUserId ? (
        <div className="px-6 py-4 border-b border-[#FF3B3B]/[0.07] bg-[#0D0F15]/40">
          <div className="flex gap-3">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={e => { setText(e.target.value); autoResize(); }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey && !submitting) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="Escribe un comentario... (Enter para enviar)"
              maxLength={500}
              rows={1}
              className="flex-1 bg-[#11131A] border border-[#FF3B3B]/15 focus:border-[#FF3B3B]/40 text-white placeholder:text-zinc-600 rounded-xl px-4 py-3 text-sm resize-none outline-none transition-colors leading-relaxed"
            />
            <button
              onClick={handleSubmit}
              disabled={!text.trim() || submitting}
              className="shrink-0 self-end px-4 py-3 bg-[#FF3B3B] hover:bg-[#FF6B6B] disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
            >
              {submitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
            </button>
          </div>
          {text.length > 400 && (
            <p className="text-right text-xs text-zinc-600 mt-1">
              {500 - text.length} caracteres restantes
            </p>
          )}
        </div>
      ) : (
        <div className="px-6 py-4 border-b border-[#FF3B3B]/[0.07] text-center">
          <p className="text-xs text-zinc-600 font-bold">
            Inicia sesión para comentar
          </p>
        </div>
      )}

      {/* Comments list */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="animate-spin text-[#FF3B3B]" size={20} />
        </div>
      ) : comments.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-zinc-700 text-sm font-bold">Sin comentarios aún.</p>
          <p className="text-zinc-700 text-xs mt-1">¡Sé el primero en comentar!</p>
        </div>
      ) : (
        <ul className="divide-y divide-[#FF3B3B]/5">
          {comments.map(c => {
            const canDelete =
              currentUserId === c.author_id || isOwner;
            return (
              <li key={c.id} className="px-6 py-4 flex gap-4 group">
                {/* Avatar */}
                <Link
                  to={`/u/${c.author?.username}`}
                  className="shrink-0 w-9 h-9 rounded-lg bg-[#0D0F15] border border-[#FF3B3B]/10 overflow-hidden flex items-center justify-center font-black text-white text-xs hover:border-[#FF3B3B]/30 transition-colors"
                >
                  {c.author?.avatar_url ? (
                    <img
                      src={c.author.avatar_url}
                      alt={c.author.username}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    c.author?.username?.charAt(0).toUpperCase() ?? '?'
                  )}
                </Link>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Link
                      to={`/u/${c.author?.username}`}
                      className="text-xs font-black text-white hover:text-[#FF3B3B] transition-colors"
                    >
                      @{c.author?.username ?? 'usuario'}
                    </Link>
                    <span className="text-[10px] text-zinc-600 font-bold">
                      {relativeTime(c.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-300 leading-relaxed break-words">
                    {c.content}
                  </p>
                </div>

                {/* Delete */}
                {canDelete && (
                  <button
                    onClick={() => handleDelete(c.id)}
                    disabled={deletingId === c.id}
                    className="shrink-0 self-start p-1.5 text-zinc-700 hover:text-[#FF3B3B] opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-[#FF3B3B]/10"
                    title="Eliminar comentario"
                  >
                    {deletingId === c.id ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Trash2 size={13} />
                    )}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
