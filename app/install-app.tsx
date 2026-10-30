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
import { Download, Share, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useUi } from './ui-language';
import {
  installAcceptedKey,
  installDelayMs,
  installDismissed,
  installDismissKey,
  installPage,
  installSeenKey,
  installPlatform,
  type InstallPlatform,
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
  const [platform, setPlatform] = useState<InstallPlatform>('desktop');
  const [standalone, setStandalone] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [instructions, setInstructions] = useState(false);
  const [busy, setBusy] = useState(false);
  const accepted = useRef(false);
  const visited = useRef(new Set<string>());

  useEffect(() => {
    const appMode = matchMedia('(display-mode: standalone)');
    const isApp = () =>
      appMode.matches ||
      !!(navigator as Navigator & { standalone?: boolean }).standalone;
    const updateMode = () => setStandalone(isApp());
    updateMode();
    appMode.addEventListener?.('change', updateMode);
    const initialise = setTimeout(() => {
      setPlatform(
        installPlatform(navigator.userAgent, navigator.maxTouchPoints),
      );
      try {
        accepted.current = localStorage.getItem(installAcceptedKey) === '1';
        setInstalled(accepted.current);
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
      if (typeof candidate.prompt !== 'function' || isApp()) return;
      event.preventDefault();
      if (accepted.current) return;
      pending.current = candidate;
      setAvailable(true);
    };
    const onInstalled = () => {
      accepted.current = true;
      setInstalled(true);
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
    window.addEventListener('appinstalled', onInstalled);
    const sync = (event: StorageEvent) => {
      if (event.key === installAcceptedKey && event.newValue === '1')
        onInstalled();
      if (event.key === installDismissKey)
        setDismissed(installDismissed(event.newValue));
    };
    window.addEventListener('storage', sync);
    return () => {
      clearTimeout(initialise);
      clearTimeout(timer);
      appMode.removeEventListener?.('change', updateMode);
      window.removeEventListener('beforeinstallprompt', capture);
      window.removeEventListener('appinstalled', onInstalled);
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
    if (busy) return;
    if (!event) {
      if (platform !== 'desktop') {
        dismiss();
        setInstructions(true);
      }
      return;
    }
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
        setInstalled(true);
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

  const canInstall =
    !standalone && !installed && (available || platform !== 'desktop');
  const nativeInstall = available;
  const visible =
    canInstall &&
    ready &&
    (eligibleVisit || platform !== 'desktop') &&
    !dismissed &&
    !!pathname &&
    installPage(pathname);
  return (
    <InstallContext.Provider
      value={{ available: canInstall && !busy, install }}
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
            {platform === 'desktop'
              ? locale === 'en'
                ? 'JOBX on your desktop'
                : 'JOBX სამუშაო მაგიდაზე'
              : locale === 'en'
                ? 'JOBX on your home screen'
                : 'JOBX მთავარ ეკრანზე'}
          </h2>
          <p>
            {platform !== 'desktop'
              ? locale === 'en'
                ? 'Add JOBX to your home screen and open jobs with one tap.'
                : 'დაამატე JOBX მთავარ ეკრანზე და ვაკანსიები ერთი შეხებით გახსენი.'
              : locale === 'en'
                ? 'Open jobs in their own window, straight from your desktop.'
                : 'გახსენი ვაკანსიები ცალკე ფანჯარაში, პირდაპირ სამუშაო მაგიდიდან.'}
          </p>
          <button
            type="button"
            className="ds-btn ds-btn--primary"
            disabled={busy}
            onClick={install}
          >
            {nativeInstall
              ? locale === 'en'
                ? 'Install JOBX'
                : 'დააყენე JOBX'
              : locale === 'en'
                ? 'How to install'
                : 'როგორ დავაყენო'}
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
      <Dialog
        open={instructions && !standalone && !installed}
        onOpenChange={setInstructions}
      >
        <DialogContent className="install-instructions">
          <DialogHeader>
            <DialogTitle>
              {locale === 'en'
                ? 'Add JOBX to your home screen'
                : 'დაამატე JOBX მთავარ ეკრანზე'}
            </DialogTitle>
            <DialogDescription>
              {platform === 'ios'
                ? locale === 'en'
                  ? 'Use Safari to add JOBX, then open it from its home screen icon.'
                  : 'Safari-დან დაამატე JOBX და შემდეგ მთავარ ეკრანზე მისი ხატულიდან გახსენი.'
                : locale === 'en'
                  ? 'Use your browser’s installation menu to add JOBX.'
                  : 'JOBX ბრაუზერის დაყენების მენიუდან დაამატე.'}
            </DialogDescription>
          </DialogHeader>
          <ol>
            <li>
              {platform === 'ios'
                ? locale === 'en'
                  ? 'Open jobx.ge in Safari.'
                  : 'გახსენი jobx.ge Safari-ში.'
                : locale === 'en'
                  ? 'Open jobx.ge in Chrome.'
                  : 'გახსენი jobx.ge Chrome-ში.'}
            </li>
            <li>
              {platform === 'ios' ? (
                <>
                  <Share size={16} aria-hidden="true" />
                  {locale === 'en'
                    ? 'Tap Share, directly or from the page menu.'
                    : 'დააჭირე გაზიარებას (Share), პირდაპირ ან გვერდის მენიუდან.'}
                </>
              ) : locale === 'en' ? (
                'Open the ⋮ menu and select “Install and create shortcut”.'
              ) : (
                'მენიუში (⋮) აირჩიე „დაყენება ან მალსახმობის შექმნა“ (Install and create shortcut).'
              )}
            </li>
            <li>
              {platform === 'ios'
                ? locale === 'en'
                  ? 'Choose “Add to Home Screen”, keep “Open as Web App” enabled if shown, then tap “Add”.'
                  : 'აირჩიე „მთავარ ეკრანზე დამატება“ (Add to Home Screen), თუ ჩანს „Open as Web App“, ჩართული დატოვე და დააჭირე „დამატებას“ (Add).'
                : locale === 'en'
                  ? 'Choose “Install” and follow the on-screen instructions.'
                  : 'აირჩიე „დაყენება“ (Install) და მიჰყევი ეკრანზე მითითებებს.'}
            </li>
          </ol>
          <button
            type="button"
            className="ds-btn ds-btn--primary"
            onClick={() => setInstructions(false)}
          >
            {locale === 'en' ? 'Got it' : 'გასაგებია'}
          </button>
        </DialogContent>
      </Dialog>
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
