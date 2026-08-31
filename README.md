<div align="center">

# KIROKU<span>.</span>

<p align="center">
  <img src="./public/Rei.gif" alt="Demo de Kiroku" width="440" />
</p>

**Tu tracker personal de anime — buscá, seguí tu lista, mirá tus estadísticas y compartí tu perfil.**

[![Sitio en vivo](https://img.shields.io/badge/kiroku.pro-visitar_sitio-FF3B3B?style=flat-square&logo=vercel&logoColor=white)](https://kiroku.pro)
[![React](https://img.shields.io/badge/React-19-0D0F15?style=flat-square&logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-0D0F15?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-0D0F15?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)
[![GSAP](https://img.shields.io/badge/GSAP-Animations-FF3B3B?style=flat-square&logo=greensock)](https://greensock.com/gsap/)
[![Supabase](https://img.shields.io/badge/Supabase-Auth_%2B_DB-0D0F15?style=flat-square&logo=supabase)](https://supabase.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-0D0F15?style=flat-square)](./LICENSE)

</div>

---

### **QUÉ ES KIROKU**

Kiroku combina tres fuentes de datos de anime (AniList, MyAnimeList vía Jikan, y la API oficial de MAL para rankings) en una sola experiencia rápida y minimalista — sin el ruido de un catálogo tradicional. Guardá lo que estás viendo, llevá tu progreso, armá tu Top 10 y seguí a otras cuentas, todo con un diseño oscuro pensado para leerse bien tanto en desktop como en el celular.

---

### **CARACTERÍSTICAS**

**Descubrimiento**
* Búsqueda instantánea con filtros por formato, temporada, año y género.
* Rankings de mejor puntuados y más populares, calendario de estrenos por temporada.
* Ficha completa por anime: sinopsis, plataformas de streaming, personajes, tráiler y contenido relacionado.

**Tu lista**
* Estados de seguimiento (*Mirando*, *Completado*, *Pendiente*) con conteo exacto de episodios.
* Puntuación con soporte para medios puntos (`0.5` a `10`).
* Top 10 personal, personajes favoritos y estadísticas (episodios, horas vistas, estudios y géneros más vistos).
* Importar/exportar tu historial en XML (compatible con MyAnimeList) o JSON.

**Social**
* Perfiles públicos compartibles, con opción de hacerlos privados.
* Seguir cuentas, likes, comentarios y notificaciones derivadas de esa actividad.
* Búsqueda de usuarios y paginación en listas de seguidores/seguidos.

**Cuenta**
* Registro con confirmación por correo, recuperación de contraseña y borrado de cuenta en cascada.
* Row Level Security de punta a punta en Supabase — cada quien accede solo a lo que le corresponde.

---

### **STACK TÉCNICO**

* **Frontend:** React 19 + Vite, TypeScript, Tailwind CSS 4, Lucide Icons.
* **Animaciones:** GSAP + ScrollTrigger.
* **Backend & Auth:** Supabase (PostgreSQL, RLS, Auth) + funciones serverless en Vercel.
* **APIs externas:** AniList (GraphQL), Jikan API v4 (REST) y la API oficial de MyAnimeList (vía proxy propio).
* **Monitoreo:** Sentry + Vercel Analytics.
* **Tests:** Vitest + Testing Library.

---

### **INSTALACIÓN Y EJECUCIÓN**

1. **Clonar el repositorio**
   ```bash
   git clone https://github.com/Lucasz-net/Kiroku.git
   cd Kiroku
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Variables de entorno** — creá un archivo `.env` en la raíz:
   ```env
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_ANON_KEY=tu-anon-key-de-supabase
   ```
   Para correr localmente las funciones serverless (ranking de MAL, borrado de cuenta) hacen falta además
   `MAL_CLIENT_ID`, `MAL_CLIENT_SECRET` y `SUPABASE_SERVICE_ROLE_KEY` — estas nunca llevan el prefijo `VITE_`
   porque son server-only y no deben terminar en el bundle del cliente.

4. **Iniciar en local**
   ```bash
   npm run dev
   ```

---

<div align="center">

**[kiroku.pro](https://kiroku.pro)** — Distribuido bajo licencia [MIT](./LICENSE) · Datos de AniList y MyAnimeList

</div>
