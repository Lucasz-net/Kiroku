import React from 'react';
import { Star } from 'lucide-react';

export const StatBox = ({ title, value, color, icon: Icon }: { title: string; value: number | string; color: string; icon: React.ElementType }) => (
  <div className="bg-[var(--kr-surface)] p-4 rounded-lg flex flex-col items-center justify-center text-center transition-all hover:bg-[#FF3B3B]/5 border border-[#FF3B3B]/15 hover:border-[#FF3B3B]/40 group">
    <span className="flex items-center gap-1.5 text-zinc-500 text-[10px] md:text-[11px] font-bold uppercase tracking-widest mb-2 group-hover:text-[#FF8A8A] transition-colors">
      <Icon size={14} className="opacity-70 group-hover:opacity-100 transition-opacity" />
      {title}
    </span>
    <span className={`text-2xl font-black ${color}`}>{value}</span>
  </div>
);

export const PodiumCard = ({ title, data }: { title: string; data: { label: string; count: number }[] }) => {
  const first = data[0]; const second = data[1]; const third = data[2];
  return (
    <div className="bg-[var(--kr-glass-1)] backdrop-blur-xl p-6 rounded-xl border border-[#FF3B3B]/20 flex flex-col justify-center h-full min-h-[250px]">
      <p className="text-[#FF3B3B] font-bold text-sm mb-6 flex items-center gap-2">
        <Star size={16} /> {title}
      </p>
      <div className="flex items-end justify-center gap-2 md:gap-4 h-full mt-auto pt-4">
        {second ? (
          <div className="flex flex-col items-center w-1/3">
            <span className="text-[10px] md:text-xs font-bold text-zinc-400 text-center mb-2 truncate w-full px-1">{second.label}</span>
            <div className="w-full bg-gradient-to-t from-[#2A1414] to-[#1E1111]/60 h-20 flex items-start justify-center pt-2 border-t border-[#FF3B3B]/30 rounded-t-sm">
              <span className="text-[#FF8A8A] font-black text-xl">2</span>
            </div>
          </div>
        ) : <div className="w-1/3"></div>}
        {first ? (
          <div className="flex flex-col items-center w-1/3">
            <span className="text-[11px] md:text-sm font-black text-[#FF3B3B] text-center mb-2 truncate w-full px-1">{first.label}</span>
            <div className="w-full bg-gradient-to-t from-[#4A0A0A] to-[#FF3B3B]/30 h-28 flex items-start justify-center pt-2 border-t-2 border-[#FF3B3B]/70 rounded-t-sm z-10">
              <span className="text-[var(--kr-text)] font-black text-2xl">1</span>
            </div>
          </div>
        ) : (
          <div className="w-1/3 flex items-center justify-center">
            <p className="text-[10px] text-zinc-600">No hay datos</p>
          </div>
        )}
        {third ? (
          <div className="flex flex-col items-center w-1/3">
            <span className="text-[10px] md:text-xs font-bold text-zinc-500 text-center mb-2 truncate w-full px-1">{third.label}</span>
            <div className="w-full bg-gradient-to-t from-[#0D0F14] to-[var(--kr-surface)] h-14 flex items-start justify-center pt-2 border-t border-[#FF3B3B]/15 rounded-t-sm">
              <span className="text-[#FF6B6B]/60 font-black text-lg">3</span>
            </div>
          </div>
        ) : <div className="w-1/3"></div>}
      </div>
    </div>
  );
};