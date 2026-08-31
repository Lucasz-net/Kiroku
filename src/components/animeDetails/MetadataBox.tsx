import { Link } from 'react-router-dom';

interface MetadataBoxProps {
  label: string;
  value: string | number;
  isLink?: boolean;
  link?: string;
}

export const MetadataBox = ({ label, value, isLink, link }: MetadataBoxProps) => (
  <div className="bg-[var(--kr-surface-2)] p-4 rounded-xl border border-[#FF3B3B]/15 flex flex-col items-center justify-center text-center transition-all hover:bg-[var(--kr-surface-2)]/80 hover:border-[#FF3B3B]/40 group">
    <span className="text-zinc-500 text-[11px] font-bold uppercase tracking-widest mb-1.5 group-hover:text-[#FF3B3B]/70 transition-colors">
      {label}
    </span>
    {isLink && link
      ? <Link to={link} className="text-lg font-black text-[var(--kr-text)] hover:text-[#FF3B3B] transition-colors truncate w-full px-2">{value}</Link>
      : <span className="text-lg font-black text-[var(--kr-text)]">{value}</span>
    }
  </div>
);
