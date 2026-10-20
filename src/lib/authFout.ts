/**
 * Wat er misging bij inloggen, een account maken of een nieuw wachtwoord kiezen, als
 * zin voor de gebruiker. Supabase Auth geeft naast een Engelse melding een foutcode
 * mee (error.code); de Engelse melding tonen we niet. De zinnen zijn Nederlands, de
 * aanroeper haalt ze door t(). Gaat het om hetzelfde als bij een gast die een account
 * maakt (accountFoutmelding), dan is de zin ook dezelfde, met één vertaling.
 */

/** Het deel van een AuthError van Supabase waar dit naar kijkt. */
export interface AuthFout {
  code?: string;
  name?: string;
}

/** Waar het misging. Een paar codes betekenen per scherm iets anders. */
export type AuthStap = 'inloggen' | 'aanmaken' | 'vergeten' | 'nieuw-wachtwoord';

const ZWAK_WACHTWOORD = 'Kies een sterker wachtwoord van minstens 6 tekens.';
const ADRES_KLOPT_NIET = 'Dit e-mailadres klopt niet. Kijk het nog even na.';
const ALGEMEEN = 'Er ging iets mis. Probeer het opnieuw.';

export const authFoutmelding = (fout: AuthFout | null | undefined, stap: AuthStap): string => {
  // Supabase niet bereikt: geen internet, of de server hapert even (502–504).
  if (fout?.name === 'AuthRetryableFetchError') {
    return 'Geen verbinding. Controleer je internet en probeer het opnieuw.';
  }
  // De sessie uit de mail is weg: uitgelogd, verlopen of op een ander toestel ingetrokken.
  const sessieWeg = fout?.name === 'AuthSessionMissingError'
    || ['session_not_found', 'session_expired', 'refresh_token_not_found', 'refresh_token_already_used', 'bad_jwt']
      .includes(fout?.code ?? '');
  if (sessieWeg) {
    return stap === 'nieuw-wachtwoord' ? 'Deze link werkt niet meer. Vraag via ‘Wachtwoord vergeten?’ een nieuwe aan.' : ALGEMEEN;
  }

  switch (fout?.code) {
    case 'invalid_credentials':
      return 'E-mailadres of wachtwoord klopt niet. Maakte je je account met Google? Kies dan ‘Doorgaan met Google’.';
    case 'email_not_confirmed':
      return 'Bevestig eerst je e-mailadres via de mail die we je stuurden.';
    case 'user_already_exists':
    case 'email_exists':
      return 'Er is al een account met dit e-mailadres. Log in, of kies ‘Wachtwoord vergeten?’.';
    case 'weak_password':
      return ZWAK_WACHTWOORD;
    case 'same_password':
      return 'Dit is je huidige wachtwoord. Kies een nieuw wachtwoord.';
    case 'email_address_invalid':
      return ADRES_KLOPT_NIET;
    case 'validation_failed':
      // Op het scherm voor een nieuw wachtwoord staat alleen een wachtwoord; elders gaat het om het adres.
      return stap === 'nieuw-wachtwoord' ? ZWAK_WACHTWOORD : ADRES_KLOPT_NIET;
    case 'email_address_not_authorized':
      return 'We kunnen nu geen mail naar dit adres sturen. Probeer het later opnieuw of gebruik Google.';
    case 'over_email_send_rate_limit':
      return 'Er zijn net te veel mails verstuurd. Probeer het over een paar minuten opnieuw.';
    case 'over_request_rate_limit':
      return 'Je probeerde het net te vaak. Wacht een paar minuten en probeer het dan opnieuw.';
    default:
      return ALGEMEEN;
  }
};
