'use client';
import { useEffect } from 'react';

const REVEAL_SELECTOR = [
  '.app-section-heading',
  '.service-controls',
  '.product-card',
  '.app-service-row',
  '.app-how > h2',
  '.app-how > p',
  '.app-how-list > div',
  '.app-contacts > h2',
  '.contact-item',
  '.messengers-row',
].join(',');

export function ScrollReveal() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const pending = new Set<HTMLElement>();
    const limit = () => window.innerHeight * 0.92;

    const check = () => {
      const max = limit();
      pending.forEach((el) => {
        if (el.getBoundingClientRect().top < max) {
          el.classList.add('is-visible');
          pending.delete(el);
        }
      });
    };

    const register = () => {
      const max = limit();
      document.querySelectorAll<HTMLElement>(REVEAL_SELECTOR).forEach((el) => {
        if (el.classList.contains('reveal')) {
          if (!el.classList.contains('is-visible')) pending.add(el);
          return;
        }
        if (el.dataset.revealBound) return;
        el.dataset.revealBound = '1';
        // Content already on screen stays visible; only below-the-fold items animate in.
        if (el.getBoundingClientRect().top < max) return;
        const siblings = el.parentElement
          ? Array.from(el.parentElement.children).filter((c) => c.matches(REVEAL_SELECTOR))
          : [el];
        const index = Math.min(Math.max(siblings.indexOf(el), 0), 8) % 4;
        el.style.setProperty('--reveal-delay', `${index * 80}ms`);
        el.classList.add('reveal');
        pending.add(el);
      });
      check();
    };

    register();
    const mo = new MutationObserver(register);
    mo.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);

    return () => {
      mo.disconnect();
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, []);

  return null;
}
