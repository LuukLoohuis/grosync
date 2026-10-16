/**
 * Van gast naar account. Een gast is een anonieme Supabase-gebruiker; door er
 * een e-mailadres of Google-account aan te koppelen houdt hij hetzelfde id, en
 * dus zijn lijst, recepten, kast en koppeling. Hier staat alleen de logica,
 * zonder React of Supabase-client, zodat hij los te testen is.
 */

/** Het deel van een Supabase-gebruiker waar de upgrade naar kijkt. */
export interface AccountGebruiker {
  is_anonymous?: boolean;
  email?: string;
  /** Het adres dat wacht op de bevestigingslink. */
  new_email?: string;
}

export type AccountStap = 'kiezen' | 'mail-verstuurd' | 'klaar';
export type AccountRoute = 'email' | 'google';

export const isGast = (user: AccountGebruiker | null | undefined): boolean => user?.is_anonymous === true;

/** Nog kiezen, wachten tot de bevestigingslink is geopend, of klaar. */
export const accountStap = (user: AccountGebruiker | null | undefined): AccountStap => {
  if (user && !isGast(user)) return 'klaar';
  return user?.new_email ? 'mail-verstuurd' : 'kiezen';
};

const ANDER_GOOGLE_ACCOUNT =
  'Dit Google-account hoort al bij een ander CoupleCart-account. Accounts samenvoegen kan niet: kies een ander Google-account of maak je account met e-mail.';

/**
 * Een foutcode van Supabase Auth als zin voor de gebruiker. Nederlands; de
 * aanroeper haalt hem door t(). Een adres of Google-account dat al bij een
 * ander account hoort, is het belangrijkste geval: samenvoegen kan niet.
 */
export const accountFoutmelding = (code: string | undefined, route: AccountRoute): string => {
  switch (code) {
    case 'email_exists':
    case 'user_already_exists':
      return route === 'google'
        ? 'Het e-mailadres van dit Google-account hoort al bij een ander CoupleCart-account. Accounts samenvoegen kan niet: kies een ander Google-account of maak je account met e-mail.'
        : 'Dit e-mailadres hoort al bij een ander CoupleCart-account. Accounts samenvoegen kan niet: kies een ander e-mailadres.';
    case 'identity_already_exists':
      return ANDER_GOOGLE_ACCOUNT;
    case 'manual_linking_disabled':
      return 'Een account maken met Google kan nog niet. Gebruik voorlopig je e-mailadres.';
    case 'email_address_not_authorized':
      return 'We kunnen nu geen mail naar dit adres sturen. Probeer het later opnieuw of gebruik Google.';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'Er zijn net te veel mails verstuurd. Probeer het over een paar minuten opnieuw.';
    case 'email_address_invalid':
    case 'validation_failed':
      return 'Dit e-mailadres klopt niet. Kijk het nog even na.';
    case 'weak_password':
      return 'Kies een sterker wachtwoord van minstens 6 tekens.';
    case 'otp_expired':
      return 'Deze bevestigingslink is verlopen of al gebruikt. Vraag een nieuwe aan.';
    case 'email_not_confirmed':
      return 'Bevestig eerst je e-mailadres via de mail die we je stuurden.';
    case 'access_denied':
      return route === 'google'
        ? 'Koppelen met Google is afgebroken. Er is niets veranderd.'
        : 'Deze bevestigingslink is verlopen of al gebruikt. Vraag een nieuwe aan.';
    default:
      return 'Er ging iets mis. Probeer het opnieuw.';
  }
};

export type AuthTerugkeer =
  | { soort: 'fout'; code: string; omschrijving: string }
  | { soort: 'email-bevestigd' }
  | { soort: 'ingelogd' };

/**
 * Wat Supabase Auth na een redirect in de URL zet: een fout (in de query én
 * na de #) of een nieuwe sessie, bijvoorbeeld na het openen van de
 * bevestigingslink. De app gebruikt de # ook voor routes (#/, #/shared/…);
 * die leveren hier niets op.
 */
export const leesAuthTerugkeer = (href: string): AuthTerugkeer | null => {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  const params = new URLSearchParams(url.hash.replace(/^#/, ''));
  // Net als in auth-js wint de query van de #.
  url.searchParams.forEach((waarde, sleutel) => params.set(sleutel, waarde));

  const code = params.get('error_code') || params.get('error');
  if (code || params.get('error_description')) {
    return { soort: 'fout', code: code || 'onbekend', omschrijving: params.get('error_description') ?? '' };
  }
  if (params.get('access_token')) {
    return params.get('type') === 'email_change' ? { soort: 'email-bevestigd' } : { soort: 'ingelogd' };
  }
  return null;
};

/** De URL zonder de fout van Supabase Auth, terug op de startpagina van de app. */
export const zonderAuthFout = (href: string): string => {
  const url = new URL(href);
  for (const sleutel of ['error', 'error_code', 'error_description']) url.searchParams.delete(sleutel);
  url.hash = '#/';
  return url.toString();
};

const GOOGLE_SLEUTEL = 'couplecart-account-google';

/** Onthoudt dat deze tab naar Google gaat voor een account; sessionStorage blijft bij de tab. */
export const markeerGoogleKoppeling = () => {
  try {
    sessionStorage.setItem(GOOGLE_SLEUTEL, '1');
  } catch {
    // Zonder opslag volgt er na terugkeer alleen geen melding.
  }
};

export interface AccountTerugkeer {
  terugkeer: AuthTerugkeer;
  viaGoogle: boolean;
}

let bewaard: AccountTerugkeer | null = null;

/**
 * Eén keer bij het laden, vóór React rendert: bewaart wat Supabase Auth na
 * een redirect meegaf, zodat het account-scherm het kan tonen. Een fout gaat
 * meteen uit de URL — anders leest de HashRouter "#error=…" als route en toont
 * hij de 404-pagina. Een sessie in de URL blijft staan; die leest Supabase zelf.
 */
export const vangAuthTerugkeer = () => {
  if (typeof window === 'undefined') return;
  let viaGoogle = false;
  try {
    viaGoogle = sessionStorage.getItem(GOOGLE_SLEUTEL) === '1';
    sessionStorage.removeItem(GOOGLE_SLEUTEL);
  } catch {
    // Geen opslag: dan weten we niet of dit een terugkeer van Google is.
  }
  const terugkeer = leesAuthTerugkeer(window.location.href);
  if (!terugkeer) return;
  bewaard = { terugkeer, viaGoogle };
  if (terugkeer.soort === 'fout') {
    window.history.replaceState(window.history.state, '', zonderAuthFout(window.location.href));
  }
};

/** De bewaarde terugkeer, één keer. */
export const neemAuthTerugkeer = (): AccountTerugkeer | null => {
  const terugkeer = bewaard;
  bewaard = null;
  return terugkeer;
};
