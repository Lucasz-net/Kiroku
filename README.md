<div align="center">

# KIROKU.

<p align="center">
  <img src="./public/Rei.gif" alt="Kiroku Anime Platform Demo" width="800" />
</p>

**Plataforma web minimalista para el descubrimiento, tracking y análisis estadístico de animes.**

[![React](https://img.shields.io/badge/React-18-0D0F15?style=flat-square&logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-0D0F15?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.0-0D0F15?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)
[![GSAP](https://img.shields.io/badge/GSAP-Animations-FF3B3B?style=flat-square&logo=greensock)](https://greensock.com/gsap/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-0D0F15?style=flat-square&logo=supabase)](https://supabase.com/)

</div>

---

### **CARACTERÍSTICAS**

* **Búsqueda Avanzada:** Filtrado instantáneo por múltiples formatos, temporadas, años y géneros.
* **Watchlist & Progreso:** Gestión de estados (*Mirando*, *Completado*, *Pendiente*, *Favoritos*) con conteo exacto de episodios.
* **Puntuación Decimal:** Sistema interactivo de estrellas con soporte para medios puntos (`0.5` a `10`).
* **Estadísticas de Perfil:** Métricas en tiempo real de episodios, horas vistas, días totales, estudios y géneros favoritos.
* **Exploración Estacional:** Navegación por temporadas pasadas, actuales y próximos estrenos.
* **Detalles Completos:** Sinopsis, plataformas de streaming disponibles, personajes, tráilers y contenido relacionado.

---

### **STACK TÉCNICO**

* **Frontend:** React + Vite, TypeScript, Tailwind CSS, Lucide Icons.
* **Animaciones:** GSAP + ScrollTrigger.
* **Backend & Auth:** Supabase (PostgreSQL).
* **APIs:** AniList (GraphQL) + Jikan API v4 (REST).

---

### **INSTALACIÓN Y EJECUCIÓN**

1. **Clonar el repositorio:**
```bash
git clone [https://github.com/tu-usuario/kiroku.git]
cd kiroku
```

2. **Instalar dependencias:**
```bash
npm install
```

3. **Variables de entorno:**
Crea un archivo `.env` en la raíz del proyecto:
```env
VITE_SUPABASE_URL=[https://tu-proyecto.supabase.co](https://tu-proyecto.supabase.co)
VITE_SUPABASE_ANON_KEY=tu-anon-key-de-supabase
```

4. **Configuración en Supabase (SQL):**
Asegúrate de que la columna de puntuación permita decimales:
```sql
ALTER TABLE saved_animes
ALTER COLUMN user_score TYPE NUMERIC;
```

5. **Iniciar en local:**
```bash
npm run dev
```
