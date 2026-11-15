import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Cloudflare Turnstile voor de inlogstappen die Supabase Auth met een captcha
 * beschermt: account maken, inloggen met wachtwoord, wachtwoord vergeten, de
 * bevestigingsmail opnieuw sturen en als gast beginnen. Supabase controleert het
 * token zelf (Auth → captcha, met de geheime sleutel van deze widget); de app
 * geeft het alleen mee als `captchaToken`.
 *
 * De widget staat op 'interaction-only': meestal ziet niemand iets, alleen als
 * Cloudflare twijfelt verschijnt er een vinkje. Een token werkt één keer, dus na
 * elke poging (gelukt of niet) roept de aanroeper `reset()` aan.
 */

const SITEKEY = import.meta.env.VITE_TURNSTILE_SITEKEY || '0x4AAAAAAGCOIvNNjilhtupd';
const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

interface TurnstileOpties {
  sitekey: string;
  action?: string;
  appearance?: 'always' | 'execute' | 'interaction-only';
  size?: 'normal' | 'flexible' | 'compact';
  theme?: 'auto' | 'light' | 'dark';
  language?: string;
  callback?: (token: string) => void;
  'expired-callback'?: () => void;
  'error-callback'?: () => void;
}

interface TurnstileApi {
  render: (el: HTMLElement, opties: TurnstileOpties) => string | undefined;
  reset: (id: string) => void;
  remove: (id: string) => void;
}

declare global {
  interface Window { turnstile?: TurnstileApi }
}

let laden: Promise<TurnstileApi> | null = null;

const laadTurnstile = (): Promise<TurnstileApi> => {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!laden) {
    laden = new Promise<TurnstileApi>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SCRIPT;
      script.async = true;
      script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile ontbreekt')));
      script.onerror = () => {
        laden = null;
        script.remove();
        reject(new Error('Turnstile laden mislukt'));
      };
      document.head.appendChild(script);
    });
  }
  return laden;
};

/**
 * @param action  label dat Cloudflare in zijn statistieken toont ('auth', 'gast').
 * @param actief  false: geen widget (bijvoorbeeld als er al een sessie is).
 * @param zwevend true: de widget krijgt een eigen plek onderin het scherm, los van
 *                React, voor pagina's die tussendoor van scherm wisselen. Anders
 *                komt hij in het element met `ref`.
 */
export const useTurnstile = (action: string, actief = true, zwevend = false) => {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const token = useRef<string | null>(null);
  const wachtend = useRef<((token: string) => void)[]>([]);
  const [mislukt, setMislukt] = useState(false);

  useEffect(() => {
    if (!actief) return;
    let weg = false;
    let eigen: HTMLDivElement | null = null;
    if (zwevend) {
      eigen = document.createElement('div');
      eigen.className = 'fixed inset-x-0 bottom-4 z-50 mx-auto w-full max-w-sm px-5 empty:hidden';
      document.body.appendChild(eigen);
    }
    laadTurnstile()
      .then((api) => {
        const plek = eigen ?? ref.current;
        if (weg || !plek) return;
        widgetId.current = api.render(plek, {
          sitekey: SITEKEY,
          action,
          appearance: 'interaction-only',
          size: 'flexible',
          theme: 'auto',
          language: 'auto',
          callback: (nieuw) => {
            token.current = nieuw;
            setMislukt(false);
            wachtend.current.splice(0).forEach((klaar) => klaar(nieuw));
          },
          'expired-callback': () => { token.current = null; },
          'error-callback': () => { token.current = null; setMislukt(true); },
        }) ?? null;
      })
      .catch(() => { if (!weg) setMislukt(true); });
    return () => {
      weg = true;
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
      eigen?.remove();
      widgetId.current = null;
      token.current = null;
    };
  }, [action, actief, zwevend]);

  /**
   * Het token voor één verzoek. Is de check nog bezig, dan wacht dit even; lukt hij
   * niet op tijd, dan komt er undefined en zegt Supabase zelf dat het niet mag.
   */
  const neemToken = useCallback(async (wachtMs = 15_000): Promise<string | undefined> => {
    const klaar = token.current ?? await new Promise<string | null>((resolve) => {
      const opTijd = (nieuw: string) => { clearTimeout(timer); resolve(nieuw); };
      const timer = setTimeout(() => {
        wachtend.current = wachtend.current.filter((w) => w !== opTijd);
        resolve(null);
      }, wachtMs);
      wachtend.current.push(opTijd);
    });
    token.current = null;
    return klaar ?? undefined;
  }, []);

  /** Na elke poging: een token werkt maar één keer. */
  const reset = useCallback(() => {
    token.current = null;
    if (widgetId.current) window.turnstile?.reset(widgetId.current);
  }, []);

  return { ref, neemToken, reset, mislukt };
};
