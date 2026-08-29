// Simple, dependency-free heuristic: length + character variety.
// Not meant to replace Supabase's HaveIBeenPwned leaked-password check
// (enabled separately in the Auth dashboard) -- just gives the user
// feedback before they submit.
export const getPasswordStrength = (password: string): { score: 0 | 1 | 2 | 3 | 4; label: string } => {
  if (!password) return { score: 0, label: '' };

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const capped = Math.min(score, 4) as 0 | 1 | 2 | 3 | 4;
  const labels = ['Muy débil', 'Débil', 'Media', 'Fuerte', 'Muy fuerte'];
  return { score: capped, label: labels[capped] };
};
