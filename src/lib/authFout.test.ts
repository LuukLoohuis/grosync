import { describe, expect, it } from 'vitest';
import { authFoutmelding, type AuthStap } from '@/lib/authFout';
import { EN } from '@/lib/en';

describe('authFoutmelding', () => {
  it('zegt in het Nederlands wat Supabase in het Engels meldt', () => {
    expect(authFoutmelding({ code: 'invalid_credentials' }, 'inloggen'))
      .toBe('E-mailadres of wachtwoord klopt niet. Maakte je je account met Google? Kies dan ‘Doorgaan met Google’.');
    expect(authFoutmelding({ code: 'email_not_confirmed' }, 'inloggen'))
      .toBe('Bevestig eerst je e-mailadres via de mail die we je stuurden.');
    expect(authFoutmelding({ code: 'user_already_exists' }, 'aanmaken'))
      .toBe('Er is al een account met dit e-mailadres. Log in, of kies ‘Wachtwoord vergeten?’.');
    expect(authFoutmelding({ code: 'email_exists' }, 'aanmaken'))
      .toBe(authFoutmelding({ code: 'user_already_exists' }, 'aanmaken'));
  });

  it('herkent geen verbinding aan de soort fout, die geen code heeft', () => {
    expect(authFoutmelding({ name: 'AuthRetryableFetchError' }, 'inloggen'))
      .toBe('Geen verbinding. Controleer je internet en probeer het opnieuw.');
  });

  it('noemt een verlopen sessie alleen bij een nieuw wachtwoord een verlopen link', () => {
    const verlopen = 'Deze link werkt niet meer. Vraag via ‘Wachtwoord vergeten?’ een nieuwe aan.';
    expect(authFoutmelding({ name: 'AuthSessionMissingError' }, 'nieuw-wachtwoord')).toBe(verlopen);
    expect(authFoutmelding({ name: 'AuthApiError', code: 'refresh_token_already_used' }, 'nieuw-wachtwoord')).toBe(verlopen);
    expect(authFoutmelding({ name: 'AuthSessionMissingError' }, 'inloggen')).toBe('Er ging iets mis. Probeer het opnieuw.');
  });

  it('leest validation_failed bij een nieuw wachtwoord als het wachtwoord, elders als het adres', () => {
    expect(authFoutmelding({ code: 'validation_failed' }, 'nieuw-wachtwoord'))
      .toBe('Kies een sterker wachtwoord van minstens 6 tekens.');
    expect(authFoutmelding({ code: 'validation_failed' }, 'vergeten'))
      .toBe('Dit e-mailadres klopt niet. Kijk het nog even na.');
  });

  it('houdt te veel mails en te vaak proberen uit elkaar', () => {
    expect(authFoutmelding({ code: 'over_email_send_rate_limit' }, 'vergeten')).toMatch(/te veel mails/);
    expect(authFoutmelding({ code: 'over_request_rate_limit' }, 'inloggen')).toMatch(/te vaak/);
  });

  it('valt terug op een algemene zin, ook zonder fout', () => {
    expect(authFoutmelding({ code: 'iets_nieuws' }, 'inloggen')).toBe('Er ging iets mis. Probeer het opnieuw.');
    expect(authFoutmelding(new TypeError('Failed to fetch'), 'aanmaken')).toBe('Er ging iets mis. Probeer het opnieuw.');
    expect(authFoutmelding(null, 'vergeten')).toBe('Er ging iets mis. Probeer het opnieuw.');
  });

  it('heeft voor elke zin een Engelse vertaling', () => {
    const codes = [
      'invalid_credentials', 'email_not_confirmed', 'user_already_exists', 'email_exists', 'weak_password',
      'same_password', 'email_address_invalid', 'validation_failed', 'email_address_not_authorized',
      'over_email_send_rate_limit', 'over_request_rate_limit', 'session_expired', 'onbekend',
    ];
    const namen = ['AuthRetryableFetchError', 'AuthSessionMissingError'];
    const stappen: AuthStap[] = ['inloggen', 'aanmaken', 'vergeten', 'nieuw-wachtwoord'];
    for (const stap of stappen) {
      const zinnen = [...codes.map((code) => authFoutmelding({ code }, stap)), ...namen.map((name) => authFoutmelding({ name }, stap))];
      for (const zin of zinnen) expect(Object.keys(EN)).toContain(zin);
    }
  });
});
