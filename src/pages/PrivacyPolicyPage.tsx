import { useDocumentTitle } from '../hooks/useDocumentTitle';

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mb-10">
    <h2 className="text-xl font-black text-white mb-4">{title}</h2>
    <div className="text-zinc-400 text-sm leading-relaxed flex flex-col gap-3">{children}</div>
  </section>
);

export const PrivacyPolicyPage = () => {
  useDocumentTitle('Política de Privacidad');
  return (
    <div className="min-h-screen bg-[#080A0F] font-sans pt-28 md:pt-36 pb-24 px-4">
      <div className="container mx-auto max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-widest text-[#FF3B3B]/60 mb-3">Legal</p>
        <h1 className="text-3xl md:text-4xl font-black text-white mb-2 tracking-tight">Política de Privacidad</h1>
        <p className="text-zinc-600 text-xs font-bold uppercase tracking-widest mb-12">Última actualización: 27/08/2026</p>

        <Section title="1. Qué datos recopilamos">
          <p>Cuando creás una cuenta en Kiroku, recopilamos:</p>
          <ul className="list-disc list-inside flex flex-col gap-1.5 ml-2">
            <li>Email y nombre de usuario (obligatorios para crear la cuenta).</li>
            <li>Si iniciás sesión con Google, tu nombre y foto de perfil de Google (solo para completar tu perfil inicial).</li>
            <li>Contenido que subís vos mismo: foto de perfil, banner, biografía, comentarios en perfiles.</li>
            <li>Tu lista de anime: qué animes guardaste, estado (viendo/pendiente/completado), progreso de episodios, puntuaciones y favoritos.</li>
            <li>Relaciones sociales dentro de la app: a quién seguís, quién te sigue, qué perfiles marcaste con "me gusta".</li>
          </ul>
          <p>No recopilamos datos de pago ni información financiera — Kiroku no procesa pagos.</p>
        </Section>

        <Section title="2. Cómo usamos tus datos">
          <p>
            Usamos tu información exclusivamente para operar la app: mostrarte tu lista y estadísticas,
            mostrar tu perfil público a otros usuarios (si así lo configurás), permitir el inicio de
            sesión, y calcular logros y estadísticas de visualización. No vendemos tus datos a terceros
            ni los usamos con fines publicitarios.
          </p>
        </Section>

        <Section title="3. Qué es público y qué no">
          <p>
            Tu nombre de usuario, avatar, banner, biografía y tu lista de anime son visibles públicamente
            en tu perfil (<code className="text-zinc-300 bg-[#11131A] px-1.5 py-0.5 rounded text-xs">kiroku.app/u/tu-usuario</code>),
            incluso para visitantes sin cuenta. Tu email nunca se muestra públicamente ni se comparte con otros usuarios.
          </p>
        </Section>

        <Section title="4. Servicios de terceros que usamos">
          <ul className="list-disc list-inside flex flex-col gap-1.5 ml-2">
            <li><strong className="text-zinc-300">Supabase</strong> — aloja nuestra base de datos, autenticación y almacenamiento de imágenes.</li>
            <li><strong className="text-zinc-300">Google (OAuth)</strong> — si elegís iniciar sesión con Google, Google procesa esa autenticación según su propia política de privacidad.</li>
            <li><strong className="text-zinc-300">AniList y Jikan (MyAnimeList)</strong> — proveen la información pública de los animes (títulos, imágenes, sinopsis, personajes). No reciben datos personales tuyos.</li>
            <li><strong className="text-zinc-300">Google Translate</strong> — usamos su servicio público para traducir sinopsis de animes al español; solo se envía el texto de la sinopsis, nunca datos personales.</li>
          </ul>
        </Section>

        <Section title="5. Cookies y almacenamiento local">
          <p>
            Usamos el almacenamiento local del navegador (localStorage) para mantener tu sesión iniciada
            y para guardar en caché datos de animes y evitar pedirlos de nuevo innecesariamente. No usamos
            cookies de publicidad ni de seguimiento de terceros.
          </p>
        </Section>

        <Section title="6. Tus derechos">
          <p>
            Podés editar o eliminar tu biografía, avatar, banner, comentarios y elementos de tu lista en
            cualquier momento desde tu perfil. Si querés corregir, exportar o eliminar por completo tu
            cuenta y todos tus datos, escribinos a <strong className="text-zinc-300">lucasszdev@gmail.com</strong>.
          </p>
        </Section>

        <Section title="7. Seguridad">
          <p>
            Tus datos se almacenan con controles de acceso a nivel de fila (Row Level Security) —
            solo vos podés leer o modificar tu propia información privada. Aun así, ningún sistema es
            100% infalible; si notás algo que parezca un problema de seguridad, avisanos.
          </p>
        </Section>

        <Section title="8. Cambios a esta política">
          <p>
            Podemos actualizar esta política a medida que la app evoluciona. Los cambios importantes se
            van a reflejar en esta misma página con una nueva fecha de actualización.
          </p>
        </Section>

        <Section title="9. Contacto">
          <p>
            Para cualquier consulta sobre privacidad o tus datos, escribinos a{' '}
            <strong className="text-zinc-300">lucasszdev@gmail.com</strong>.
          </p>
        </Section>
      </div>
    </div>
  );
};
