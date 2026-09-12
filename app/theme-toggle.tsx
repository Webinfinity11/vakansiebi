'use client';
import { useSyncExternalStore } from 'react';
import { Moon, Sun } from 'lucide-react';
import { applyTheme, storeTheme, themeChanged } from '@/lib/theme';

/* The document is the source of truth: the inline script in the head has already written the
   theme onto <html> before the first paint, so the button reads it from there rather than
   keeping a second copy in state. Two things can change it afterwards — this button, and the
   same site in another tab. The device's own setting is deliberately not one of them. */
function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(themeChanged, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(themeChanged, onChange);
  };
}
const current = () =>
  document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';

export function ThemeToggle() {
  /* The server renders the light page, which is also what an unchosen browser gets, so the
     first client render agrees with it unless this reader has asked for the dark one. */
  const resolved = useSyncExternalStore(subscribe, current, () => 'light');
  const next = resolved === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={
        next === 'dark' ? 'მუქ თემაზე გადართვა' : 'ღია თემაზე გადართვა'
      }
      title={next === 'dark' ? 'მუქი თემა' : 'ღია თემა'}
      onClick={() => {
        storeTheme(window.localStorage, next);
        applyTheme(next);
        window.dispatchEvent(new Event(themeChanged));
      }}
    >
      {next === 'dark' ? <Moon size={17} /> : <Sun size={17} />}
    </button>
  );
}
