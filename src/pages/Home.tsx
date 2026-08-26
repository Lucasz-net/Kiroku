import { useCallback, useEffect, useRef, useState } from 'react';
import { getCurrentSeason } from '../services/jikanApi';
import { getTopRatedAniList, getTopPopularAniList, getSeasonAniList } from '../services/aniListApi';
import { getCachedSync } from '../utils/queryCache';
import type { Anime } from '../types/anime';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { HeroSection } from '../components/home/HeroSection';
import { SeasonalCarousel } from '../components/home/SeasonalCarousel';
import { RankingsSection } from '../components/home/RankingsSection';

gsap.registerPlugin(ScrollTrigger);

export const Home = () => {
  const { year, season } = getCurrentSeason();

  // Initialise from localStorage-backed cache so data shows on first render
  const [upcoming,   setUpcoming]   = useState<Anime[]>(
    () => getCachedSync<{ data: Anime[] }>(`anilist:season:${year}:${season}:1:`, 10 * 60 * 1000)?.data ?? []
  );
  const [topRated,   setTopRated]   = useState<Anime[]>(
    () => (getCachedSync<{ data: Anime[] }>('anilist:top:SCORE_DESC:1', 15 * 60 * 1000)?.data ?? []).slice(0, 10)
  );
  const [topPopular, setTopPopular] = useState<Anime[]>(
    () => (getCachedSync<{ data: Anime[] }>('anilist:top:POPULARITY_DESC:1', 15 * 60 * 1000)?.data ?? []).slice(0, 10)
  );
  const [errors, setErrors] = useState({ upcoming: false, topRated: false, topPopular: false });
  const mainRef = useRef<HTMLDivElement>(null);

  const loadHomeData = useCallback(async () => {
    const [upcomingRes, topRatedRes, topPopularRes] = await Promise.all([
      getSeasonAniList(year, season, 1).catch(() => null),
      getTopRatedAniList(1).catch(() => null),
      getTopPopularAniList(1).catch(() => null),
    ]);

    setErrors({ upcoming: !upcomingRes, topRated: !topRatedRes, topPopular: !topPopularRes });

    if (upcomingRes?.data) {
      const seen = new Set<number>();
      setUpcoming(upcomingRes.data.filter(a => seen.has(a.mal_id) ? false : (seen.add(a.mal_id), true)));
    }
    if (topRatedRes?.data)   setTopRated(topRatedRes.data.slice(0, 10));
    if (topPopularRes?.data) setTopPopular(topPopularRes.data.slice(0, 10));
  }, [year, season]);

  useEffect(() => {
    let cancelled = false;
    (async () => { if (!cancelled) await loadHomeData(); })();
    return () => { cancelled = true; };
  }, [loadHomeData]);

  useGSAP(() => {
    ['.estrenos-section', '.rankings-section'].forEach((sel) => {
      gsap.fromTo(sel,
        { borderTopLeftRadius: '50% 120px', borderTopRightRadius: '50% 120px', y: 100 },
        {
          borderTopLeftRadius: '0% 0px', borderTopRightRadius: '0% 0px', y: 0,
          ease: 'none',
          scrollTrigger: { trigger: sel, start: 'top 95%', end: 'top 10%', scrub: 1 },
        }
      );
    });

    gsap.fromTo('.seasonal-label',
      { x: -28, opacity: 0 },
      { x: 0, opacity: 1, ease: 'power2.out', scrollTrigger: { trigger: '.estrenos-section', start: 'top 80%', end: 'top 42%', scrub: 0.8 } }
    );
    gsap.fromTo('.seasonal-title',
      { x: -36, opacity: 0 },
      { x: 0, opacity: 1, ease: 'power2.out', scrollTrigger: { trigger: '.estrenos-section', start: 'top 75%', end: 'top 38%', scrub: 0.8 } }
    );
    gsap.fromTo('.seasonal-carousel',
      { y: 50, opacity: 0 },
      { y: 0, opacity: 1, ease: 'power2.out', scrollTrigger: { trigger: '.estrenos-section', start: 'top 70%', end: 'top 25%', scrub: 1 } }
    );
    gsap.fromTo('.ranking-card-left',
      { x: -55, opacity: 0, filter: 'blur(5px)' },
      { x: 0, opacity: 1, filter: 'blur(0px)', ease: 'power2.out', scrollTrigger: { trigger: '.rankings-section', start: 'top 90%', end: 'top 52%', scrub: 0.9 } }
    );
    gsap.fromTo('.ranking-card-right',
      { x: 55, opacity: 0, filter: 'blur(5px)' },
      { x: 0, opacity: 1, filter: 'blur(0px)', ease: 'power2.out', scrollTrigger: { trigger: '.rankings-section', start: 'top 90%', end: 'top 52%', scrub: 0.9 } }
    );
    gsap.fromTo('.ranking-label',
      { y: -14, opacity: 0 },
      { y: 0, opacity: 1, stagger: 0.15, ease: 'power2.out', scrollTrigger: { trigger: '.rankings-section', start: 'top 85%', end: 'top 58%', scrub: 0.8 } }
    );
    gsap.fromTo('.ranking-title',
      { y: -10, opacity: 0 },
      { y: 0, opacity: 1, stagger: 0.15, ease: 'power2.out', scrollTrigger: { trigger: '.rankings-section', start: 'top 82%', end: 'top 55%', scrub: 0.8 } }
    );

    ScrollTrigger.refresh();
  }, { scope: mainRef, dependencies: [upcoming, topRated, topPopular] });

  return (
    <div ref={mainRef} className="block font-sans bg-[#0D0F15] overflow-hidden relative w-full">
      <HeroSection />
      <SeasonalCarousel upcoming={upcoming} hasError={errors.upcoming && upcoming.length === 0} onRetry={loadHomeData} />
      <RankingsSection
        topRated={topRated}
        topPopular={topPopular}
        topRatedError={errors.topRated && topRated.length === 0}
        topPopularError={errors.topPopular && topPopular.length === 0}
        onRetry={loadHomeData}
      />
    </div>
  );
};