import { getPasswordStrength } from '../utils/passwordStrength';

const COLORS = ['bg-red-600', 'bg-orange-500', 'bg-yellow-500', 'bg-lime-500', 'bg-emerald-500'];

export const PasswordStrengthMeter = ({ password }: { password: string }) => {
  if (!password) return null;
  const { score, label } = getPasswordStrength(password);

  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1.5">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < score ? COLORS[score] : 'bg-[var(--kr-surface-2)]'}`} />
        ))}
      </div>
      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1.5">{label}</p>
    </div>
  );
};
