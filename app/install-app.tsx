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
import {
  ArrowDown,
  ArrowUp,
  Check,
  Download,
  EllipsisVertical,
  Share,
  SquarePlus,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useUi } from './ui-language';
import {
  canWaitForInstall,
  canPromptAfterWait,
  chromeInstallIntent,
  isInAppBrowser,
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
  busy: boolean;
  install: () => void;
}>({ available: false, busy: false, install: () => {} });

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
  const [embedded, setEmbedded] = useState(false);
  const [chromium, setChromium] = useState(false);
  const [ipad, setIpad] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const waitForEvent = useRef<((event: InstallEvent | null) => void) | null>(
    null,
  );
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
      setEmbedded(isInAppBrowser(navigator.userAgent));
      setChromium(
        canWaitForInstall(navigator.userAgent, navigator.maxTouchPoints),
      );
      setIpad(/iPad|Macintosh/i.test(navigator.userAgent));
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
      waitForEvent.current?.(candidate);
    };
    const onInstalled = () => {
      waitForEvent.current?.(null);
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
      waitForEvent.current?.(null);
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
    let event = pending.current;
    if (busy) return;
    if (embedded) {
      dismiss();
      setCopyStatus('');
      setInstructions(true);
      return;
    }
    if (!event && chromium) {
      setBusy(true);
      event = await new Promise<InstallEvent | null>((resolve) => {
        const timer = setTimeout(() => finish(null), 3000);
        const finish = (candidate: InstallEvent | null) => {
          clearTimeout(timer);
          waitForEvent.current = null;
          resolve(candidate);
        };
        waitForEvent.current = finish;
      });
      setBusy(false);
      if (accepted.current) return;
      if (event && !canPromptAfterWait(navigator.userActivation)) {
        dismiss();
        setInstructions(true);
        return;
      }
    }
    if (!event) {
      dismiss();
      setInstructions(true);
      return;
    }
    setInstructions(false);
    // Use the event once, during a fresh tap or while transient activation remains.
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
    } catch (error) {
      // Activation rejection does not consume the event; other errors may.
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        pending.current = event;
        setAvailable(true);
      }
      setInstructions(true);
    } finally {
      setBusy(false);
    }
  }

  const canInstall =
    !standalone &&
    !installed &&
    (available || chromium || platform !== 'desktop');

  const visible =
    canInstall &&
    !instructions &&
    ready &&
    (eligibleVisit || platform !== 'desktop') &&
    !dismissed &&
    !!pathname &&
    installPage(pathname);
  return (
    <InstallContext.Provider value={{ available: canInstall, busy, install }}>
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
            {busy
              ? locale === 'en'
                ? 'Preparing…'
                : 'მზადდება…'
              : locale === 'en'
                ? 'Install JOBX'
                : 'დააყენე JOBX'}
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
              {embedded
                ? locale === 'en'
                  ? 'Installation is not available inside this app’s browser. Open this page in your browser.'
                  : 'ამ აპის შიდა ბრაუზერში JOBX ვერ დაყენდება. გახსენი გვერდი ბრაუზერში.'
                : available
                  ? locale === 'en'
                    ? 'Ready to install.'
                    : 'ყველაფერი მზადაა დასაყენებლად.'
                  : platform === 'ios'
                    ? locale === 'en'
                      ? 'Open jobx.ge in Safari and follow these three steps.'
                      : 'გახსენი jobx.ge Safari-ში და მიჰყევი ამ სამ ნაბიჯს.'
                    : locale === 'en'
                      ? 'Open jobx.ge in Chrome and follow these three steps.'
                      : 'გახსენი jobx.ge Chrome-ში და მიჰყევი ამ სამ ნაბიჯს.'}
            </DialogDescription>
          </DialogHeader>
          {embedded ? (
            <div className="install-browser-help">
              {platform === 'android' ? (
                <button
                  type="button"
                  className="ds-btn ds-btn--primary"
                  onClick={() => {
                    window.location.href = chromeInstallIntent(
                      window.location.href,
                    );
                  }}
                >
                  {locale === 'en' ? 'Open in Chrome' : 'გახსენი Chrome-ში'}
                </button>
              ) : (
                <>
                  <p>
                    {locale === 'en'
                      ? 'Open the ⋯ or Share menu and choose “Open in Safari”. If it is missing, copy the link and paste it in Safari.'
                      : 'გახსენი ⋯ ან გაზიარების მენიუ და აირჩიე „Open in Safari“. თუ ეს პუნქტი არ ჩანს, დააკოპირე ბმული და ჩასვი Safari-ში.'}
                  </p>
                  <button
                    type="button"
                    className="ds-btn ds-btn--primary"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(
                          window.location.href,
                        );
                        setCopyStatus(
                          locale === 'en'
                            ? 'Link copied'
                            : 'ბმული დაკოპირებულია',
                        );
                      } catch {
                        setCopyStatus(
                          locale === 'en'
                            ? 'Copy the link from the address bar.'
                            : 'დააკოპირე ბმული მისამართის ველიდან.',
                        );
                      }
                    }}
                  >
                    {locale === 'en' ? 'Copy link' : 'ბმულის კოპირება'}
                  </button>
                  <p role="status">{copyStatus}</p>
                </>
              )}
            </div>
          ) : available ? (
            <button
              type="button"
              className="ds-btn ds-btn--primary"
              onClick={install}
              disabled={busy}
            >
              {locale === 'en' ? 'Install JOBX' : 'დააყენე JOBX'}
            </button>
          ) : (
            <>
              {platform === 'ios' && (
                <div className="install-share-pointer">
                  {ipad ? (
                    <ArrowUp aria-hidden="true" />
                  ) : (
                    <ArrowDown aria-hidden="true" />
                  )}
                  <Share aria-hidden="true" />
                  <span>
                    {locale === 'en'
                      ? ipad
                        ? 'Look for Share in Safari’s top toolbar.'
                        : 'Look for Share in Safari’s bottom toolbar, or open ⋯ first.'
                      : ipad
                        ? 'გაზიარების ღილაკი Safari-ის ზედა პანელზეა.'
                        : 'გაზიარების ღილაკი Safari-ის ქვედა პანელზეა; თუ არ ჩანს, ჯერ გახსენი ⋯.'}
                  </span>
                </div>
              )}
              <ol className="install-steps">
                <li>
                  <span className="install-step-icon" aria-hidden="true">
                    {platform === 'ios' ? (
                      <Share size={22} />
                    ) : (
                      <EllipsisVertical size={22} />
                    )}
                  </span>
                  <div>
                    <strong>
                      {platform === 'ios'
                        ? locale === 'en'
                          ? 'Tap Share'
                          : 'დააჭირე გაზიარებას'
                        : locale === 'en'
                          ? 'Open the menu'
                          : 'გახსენი მენიუ'}
                    </strong>
                    <span>{platform === 'ios' ? 'Share' : '⋮'}</span>
                  </div>
                </li>
                <li>
                  <span className="install-step-icon" aria-hidden="true">
                    <SquarePlus size={22} />
                  </span>
                  <div>
                    <strong>
                      {platform === 'ios'
                        ? locale === 'en'
                          ? 'Add to Home Screen'
                          : 'დაამატე მთავარ ეკრანზე'
                        : locale === 'en'
                          ? 'Choose installation'
                          : 'აირჩიე დაყენება'}
                    </strong>
                    <span>
                      {platform === 'ios'
                        ? 'Add to Home Screen'
                        : platform === 'desktop'
                          ? 'Cast, save, and share → Install page as app'
                          : 'Add to home screen → Install'}
                    </span>
                  </div>
                </li>
                <li>
                  <span className="install-step-icon" aria-hidden="true">
                    <Check size={22} />
                  </span>
                  <div>
                    <strong>
                      {platform === 'ios'
                        ? locale === 'en'
                          ? 'Tap Add'
                          : 'დააჭირე დამატებას'
                        : locale === 'en'
                          ? 'Tap Install'
                          : 'დააჭირე დაყენებას'}
                    </strong>
                    <span>{platform === 'ios' ? 'Add' : 'Install'}</span>
                  </div>
                </li>
              </ol>
              <p className="install-step-note">
                {platform === 'ios'
                  ? locale === 'en'
                    ? 'If shown, keep “Open as Web App” enabled. JOBX will appear on your home screen.'
                    : 'თუ ჩანს, „Open as Web App“ ჩართული დატოვე. JOBX-ის აიქონი მთავარ ეკრანზე გამოჩნდება.'
                  : locale === 'en'
                    ? 'JOBX will appear on your home screen.'
                    : 'JOBX-ის აიქონი მთავარ ეკრანზე გამოჩნდება.'}
              </p>
            </>
          )}
          {!available && (
            <button
              type="button"
              className={`ds-btn ${embedded ? 'ds-btn--secondary' : 'ds-btn--primary'}`}
              onClick={() => setInstructions(false)}
            >
              {locale === 'en' ? 'Got it' : 'გასაგებია'}
            </button>
          )}
        </DialogContent>
      </Dialog>
    </InstallContext.Provider>
  );
}

export function InstallAppAction() {
  const { available, busy, install } = useContext(InstallContext);
  const { locale } = useUi();
  if (!available) return null;
  return (
    <button type="button" onClick={install} disabled={busy} aria-busy={busy}>
      <Download size={16} aria-hidden="true" />
      {busy
        ? locale === 'en'
          ? 'Preparing…'
          : 'მზადდება…'
        : locale === 'en'
          ? 'Install JOBX'
          : 'დააყენე JOBX'}
    </button>
  );
}
