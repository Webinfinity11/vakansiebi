/* The stored theme choice and how it reaches the document.

   Two consumers have to agree: the inline script in the document head, which runs before the
   first paint so the page never flashes white, and the toggle button. The script cannot
   import this module — it is a string in the HTML — so `themeScript` below is generated from
   the same constants and the shapes are checked by tests/theme.test.ts. */
export const themeKey = 'ertad-theme';
/* Dispatched on window when this tab changes the theme; `storage` only fires in other tabs. */
export const themeChanged = 'ertad-theme-changed';
export type Theme = 'light' | 'dark' | 'system';

export function readTheme(storage: Pick<Storage, 'getItem'>): Theme {
  try {
    const value = storage.getItem(themeKey);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}
export function storeTheme(
  storage: Pick<Storage, 'setItem' | 'removeItem'>,
  theme: Theme,
) {
  try {
    if (theme === 'system') storage.removeItem(themeKey);
    else storage.setItem(themeKey, theme);
    return true;
  } catch {
    return false;
  }
}
/* Both switches are set together: `data-theme` drives the generated stylesheet, the `dark`
   class drives the component primitives, which carry their own palette. */
export function applyTheme(theme: Theme): 'light' | 'dark' {
  /* Nothing but an explicit choice turns the page dark: the light design is the one people
     know, and a device set to dark should not hand them a different-looking site. */
  const resolved = theme === 'dark' ? 'dark' : 'light';
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.classList.toggle('dark', resolved === 'dark');
  return resolved;
}

/* Runs before the first paint, so it is deliberately small and swallows every failure: a
   browser with storage disabled still renders, it just renders the light page. */
export const themeScript = `(function(){try{var d=localStorage.getItem(${JSON.stringify(themeKey)})==='dark';var r=document.documentElement;r.dataset.theme=d?'dark':'light';r.classList.toggle('dark',d);}catch(e){}})();`;
