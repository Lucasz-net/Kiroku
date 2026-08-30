// Espejo de la política configurada en el dashboard de Supabase
// (Authentication → Providers → Email): mínimo 8 caracteres, con letras y
// dígitos. **Si cambiás la política allá, cambiá esto acá.**
//
// Hace falta validar del lado del cliente porque, si no, GoTrue rechaza el
// registro con un mensaje en inglés que enumera el alfabeto entero
// ("Password should contain at least one character of each: abcdefg…, 0123…"),
// y el formulario ya le había dicho al usuario que la contraseña estaba bien.
export const PASSWORD_MIN_LENGTH = 8;

/** Devuelve el error a mostrar, o null si la contraseña cumple. */
export const validatePassword = (password: string): string | null => {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  }
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return 'La contraseña debe combinar letras y números.';
  }
  return null;
};

/**
 * Red de seguridad por si la política del dashboard se endurece y este
 * archivo queda desactualizado: traduce el rechazo de GoTrue en vez de
 * mostrarlo crudo. Se mira el código del error, no el texto, que viene en
 * inglés y cambia entre versiones.
 */
export const weakPasswordMessage = (err: unknown): string | null => {
  const e = err as { name?: string; code?: string } | null;
  return e?.name === 'AuthWeakPasswordError' || e?.code === 'weak_password'
    ? `La contraseña es demasiado débil: usá al menos ${PASSWORD_MIN_LENGTH} caracteres, combinando letras y números.`
    : null;
};

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
