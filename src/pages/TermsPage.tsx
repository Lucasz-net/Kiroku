import { useDocumentTitle } from '../hooks/useDocumentTitle';

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mb-10">
    <h2 className="text-xl font-black text-white mb-4">{title}</h2>
    <div className="text-zinc-400 text-sm leading-relaxed flex flex-col gap-3">{children}</div>
  </section>
);

export const TermsPage = () => {
  useDocumentTitle('Términos de Servicio');
  return (
    <div className="min-h-screen bg-[#080A0F] font-sans pt-28 md:pt-36 pb-24 px-4">
      <div className="container mx-auto max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-widest text-[#FF3B3B]/60 mb-3">Legal</p>
        <h1 className="text-3xl md:text-4xl font-black text-white mb-2 tracking-tight">Términos de Servicio</h1>
        <p className="text-zinc-600 text-xs font-bold uppercase tracking-widest mb-12">Última actualización: [completar fecha]</p>

        <Section title="1. Aceptación">
          <p>
            Al crear una cuenta o usar Kiroku aceptás estos términos. Si no estás de acuerdo, por favor
            no uses la app.
          </p>
        </Section>

        <Section title="2. Qué es Kiroku">
          <p>
            Kiroku es un tracker personal de anime: te permite buscar animes, llevar el control de qué
            estás viendo, marcar puntuaciones y favoritos, y compartir tu lista en un perfil público. La
            información de los animes (títulos, imágenes, sinopsis) proviene de AniList y MyAnimeList vía
            sus APIs públicas — Kiroku no es el titular de esos derechos ni está afiliado a esos servicios.
          </p>
        </Section>

        <Section title="3. Tu cuenta">
          <ul className="list-disc list-inside flex flex-col gap-1.5 ml-2">
            <li>Sos responsable de mantener segura tu contraseña y de toda actividad en tu cuenta.</li>
            <li>Debés dar un email válido y un nombre de usuario que no suplante a otra persona o marca.</li>
            <li>Podés cerrar sesión o dejar de usar la app cuando quieras.</li>
          </ul>
        </Section>

        <Section title="4. Contenido que subís">
          <p>
            Sos el único responsable del contenido que publiques en Kiroku: tu biografía, tu foto de
            perfil, tu banner y los comentarios que dejes en perfiles ajenos. Al usar la app te comprometés a:
          </p>
          <ul className="list-disc list-inside flex flex-col gap-1.5 ml-2">
            <li>No subir contenido ilegal, difamatorio, de odio o sexualmente explícito.</li>
            <li>No acosar, amenazar ni suplantar a otros usuarios.</li>
            <li>No hacer spam ni publicar el mismo comentario repetidamente.</li>
            <li>No usar la app para actividades automatizadas que sobrecarguen el servicio.</li>
          </ul>
          <p>
            Nos reservamos el derecho de eliminar contenido que viole estas normas y, en casos graves o
            reiterados, de suspender la cuenta correspondiente.
          </p>
        </Section>

        <Section title="5. Servicios de terceros">
          <p>
            Kiroku depende de servicios externos (AniList, Jikan/MyAnimeList, Google, Supabase) que están
            fuera de nuestro control. Si alguno de estos servicios no está disponible o cambia sus
            condiciones, algunas funciones de Kiroku pueden verse afectadas temporalmente.
          </p>
        </Section>

        <Section title="6. Disponibilidad del servicio">
          <p>
            Hacemos lo posible por mantener Kiroku disponible y funcionando correctamente, pero no
            garantizamos un servicio ininterrumpido ni libre de errores. La app se ofrece "tal cual",
            sin garantías de ningún tipo.
          </p>
        </Section>

        <Section title="7. Limitación de responsabilidad">
          <p>
            En la medida permitida por la ley, Kiroku no se hace responsable por pérdidas indirectas
            derivadas del uso (o la imposibilidad de uso) de la app, incluyendo pérdida de datos por
            fallas de terceros.
          </p>
        </Section>

        <Section title="8. Cambios a estos términos">
          <p>
            Podemos actualizar estos términos a medida que la app evoluciona. Si hacemos cambios
            importantes, vamos a actualizar la fecha en esta página.
          </p>
        </Section>

        <Section title="9. Contacto">
          <p>
            Para cualquier consulta sobre estos términos, escribinos a{' '}
            <strong className="text-zinc-300">[completar email de contacto]</strong>.
          </p>
        </Section>
      </div>
    </div>
  );
};
