'use client';

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';
import { Download, X } from 'lucide-react';
import { useUi } from './ui-language';
import {
  installAcceptedKey,
  installDelayMs,
  installDismissed,
  installDismissKey,
  installPage,
  installSeenKey,
} from '@/lib/app-install';

type InstallEvent = Event & {
  prompt: () => Promise<void | { outcome: 'accepted' | 'dismissed' }>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};
const InstallContext = createContext<{
  available: boolean;
  install: () => void;
}>({ available: false, install: () => {} });

export function InstallAppProvider({ children }: { children: ReactNode }) {
  const { locale } = useUi();
  const pathname = usePathname();
  const pending = useRef<InstallEvent | null>(null);
  const [available, setAvailable] = useState(false);
  const [ready, setReady] = useState(false);
  const [eligibleVisit, setEligibleVisit] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [desktop, setDesktop] = useState(false);
  const [busy, setBusy] = useState(false);
  const accepted = useRef(false);
  const visited = useRef(new Set<string>());

  useEffect(() => {
    const screen = matchMedia('(min-width: 900px) and (pointer: fine)');
    const standalone = matchMedia('(display-mode: standalone)');
    const updateScreen = () =>
      setDesktop(screen.matches && !standalone.matches);
    updateScreen();
    screen.addEventListener('change', updateScreen);
    standalone.addEventListener('change', updateScreen);
    const initialise = setTimeout(() => {
      try {
        accepted.current = localStorage.getItem(installAcceptedKey) === '1';
        setDismissed(installDismissed(localStorage.getItem(installDismissKey)));
        setEligibleVisit(localStorage.getItem(installSeenKey) === '1');
        localStorage.setItem(installSeenKey, '1');
        if (accepted.current) {
          pending.current = null;
          setAvailable(false);
        }
      } catch {
        setDismissed(false);
      }
    }, 0);
    const timer = setTimeout(() => setReady(true), installDelayMs);
    const capture = (event: Event) => {
      const candidate = event as InstallEvent;
      if (typeof candidate.prompt !== 'function' || standalone.matches) return;
      event.preventDefault();
      if (accepted.current) return;
      pending.current = candidate;
      setAvailable(true);
    };
    const installed = () => {
      accepted.current = true;
      try {
        localStorage.setItem(installAcceptedKey, '1');
      } catch {
        /* Browser installation state is also checked. */
      }
      pending.current = null;
      setAvailable(false);
      setDismissed(true);
    };
    window.addEventListener('beforeinstallprompt', capture);
    window.addEventListener('appinstalled', installed);
    const sync = (event: StorageEvent) => {
      if (event.key === installAcceptedKey && event.newValue === '1')
        installed();
      if (event.key === installDismissKey)
        setDismissed(installDismissed(event.newValue));
    };
    window.addEventListener('storage', sync);
    return () => {
      clearTimeout(initialise);
      clearTimeout(timer);
      screen.removeEventListener('change', updateScreen);
      standalone.removeEventListener('change', updateScreen);
      window.removeEventListener('beforeinstallprompt', capture);
      window.removeEventListener('appinstalled', installed);
      window.removeEventListener('storage', sync);
    };
  }, []);

  useEffect(() => {
    if (!pathname || !installPage(pathname)) return;
    visited.current.add(pathname);
    if (visited.current.size > 1) setEligibleVisit(true);
  }, [pathname]);

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(installDismissKey, String(Date.now()));
    } catch {
      /* Once per visit without storage. */
    }
  }

  async function install() {
    const event = pending.current;
    if (!event || busy) return;
    // A browser event can be used only once. Keep prompt() in the click gesture.
    pending.current = null;
    setBusy(true);
    setAvailable(false);
    dismiss();
    try {
      await event.prompt();
      const choice = await event.userChoice;
      if (choice.outcome === 'accepted') {
        accepted.current = true;
        try {
          localStorage.setItem(installAcceptedKey, '1');
        } catch {
          /* Retained for this visit. */
        }
      }
    } catch {
      /* A cancelled or unavailable browser prompt leaves the page usable. */
    } finally {
      setBusy(false);
    }
  }

  const visible =
    available &&
    desktop &&
    ready &&
    eligibleVisit &&
    !dismissed &&
    !!pathname &&
    installPage(pathname);
  return (
    <InstallContext.Provider
      value={{ available: available && desktop, install }}
    >
      {children}
      {visible && (
        <aside className="install-app" aria-labelledby="install-app-title">
          <button
            type="button"
            className="install-app-close ds-btn ds-btn--ghost ds-btn--icon"
            aria-label={
              locale === 'en'
                ? 'Dismiss installation suggestion'
                : 'დაყენების შეთავაზების დახურვა'
            }
            onClick={dismiss}
          >
            <X size={18} aria-hidden="true" />
          </button>
          <Download size={24} aria-hidden="true" />
          <h2 id="install-app-title">
            {locale === 'en' ? 'JOBX on your desktop' : 'JOBX სამუშაო მაგიდაზე'}
          </h2>
          <p>
            {locale === 'en'
              ? 'Open jobs in their own window, straight from your desktop.'
              : 'გახსენი ვაკანსიები ცალკე ფანჯარაში, პირდაპირ სამუშაო მაგიდიდან.'}
          </p>
          <button
            type="button"
            className="ds-btn ds-btn--primary"
            disabled={busy}
            onClick={install}
          >
            {locale === 'en' ? 'Install JOBX' : 'დააყენე JOBX'}
          </button>
          <button
            type="button"
            className="ds-btn ds-btn--ghost"
            onClick={dismiss}
          >
            {locale === 'en' ? 'Not now' : 'ახლა არა'}
          </button>
        </aside>
      )}
    </InstallContext.Provider>
  );
}

export function InstallAppAction() {
  const { available, install } = useContext(InstallContext);
  const { locale } = useUi();
  if (!available) return null;
  return (
    <button type="button" onClick={install}>
      <Download size={16} aria-hidden="true" />
      {locale === 'en' ? 'Install JOBX' : 'დააყენე JOBX'}
    </button>
  );
}
