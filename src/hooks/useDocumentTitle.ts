import { useEffect } from 'react';

// Sets the browser tab title per page — the app previously shared a single
// static "Kiroku" title across every route (SPA default). Cheap, no
// dependency needed for something this small.
export function useDocumentTitle(title: string) {
  useEffect(() => {
    const previous = document.title;
    document.title = title ? `${title} · Kiroku` : 'Kiroku';
    return () => { document.title = previous; };
  }, [title]);
}
