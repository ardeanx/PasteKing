'use client';

import { Suspense, useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import NProgress from 'nprogress';

NProgress.configure({ showSpinner: false, speed: 300, minimum: 0.1 });

function ProgressBarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isFirst = useRef(true);

  // Finish progress when pathname/searchParams change (navigation completed)
  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    NProgress.done();
  }, [pathname, searchParams]);

  useEffect(() => {
    // Start progress bar on link clicks that trigger client-side navigation
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement)?.closest('a');
      if (
        !anchor ||
        anchor.target === '_blank' ||
        anchor.hasAttribute('download') ||
        e.ctrlKey ||
        e.metaKey ||
        e.shiftKey ||
        e.altKey ||
        e.button !== 0
      )
        return;

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('http'))
        return;

      // Same-page navigation — skip
      if (href === window.location.pathname + window.location.search) return;

      NProgress.start();
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, []);

  return null;
}

export function ProgressBar() {
  return (
    <Suspense fallback={null}>
      <ProgressBarInner />
    </Suspense>
  );
}
