'use client';

import { useState, useCallback, useEffect } from 'react';

export function MobileNav() {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const sidebar = document.querySelector('.app-sidebar');
    if (sidebar) {
      sidebar.classList.toggle('open', open);
    }
  }, [open]);

  // Close on route change
  useEffect(() => {
    const handler = () => setOpen(false);
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);

  // Close on link clicks inside sidebar
  useEffect(() => {
    if (!open) return;
    const sidebar = document.querySelector('.app-sidebar');
    if (!sidebar) return;
    const handler = (e: Event) => {
      if ((e.target as HTMLElement)?.closest('a')) {
        setOpen(false);
      }
    };
    sidebar.addEventListener('click', handler);
    return () => sidebar.removeEventListener('click', handler);
  }, [open]);

  return (
    <>
      <button
        className="mobile-menu-btn"
        onClick={() => setOpen((v) => !v)}
        aria-label="Toggle menu"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {open ? <path d="M18 6L6 18M6 6l12 12" /> : <path d="M3 12h18M3 6h18M3 18h18" />}
        </svg>
      </button>
      {open && <div className="sidebar-overlay open" onClick={close} />}
    </>
  );
}
