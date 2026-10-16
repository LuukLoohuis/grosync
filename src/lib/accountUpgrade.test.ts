import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EN } from '@/lib/en';
import {
  type AccountRoute, accountFoutmelding, accountStap, isGast, leesAuthTerugkeer, zonderAuthFout,
} from '@/lib/accountUpgrade';

const SITE = 'https://www.couplecart.nl/';

describe('accountStap', () => {
  it('laat een gast kiezen zolang er geen adres wacht', () => {
    expect(accountStap({ is_anonymous: true })).toBe('kiezen');
    expect(accountStap(null)).toBe('kiezen');
  });

  it('wacht op de bevestigingslink zodra een gast een adres opgaf', () => {
    expect(accountStap({ is_anonymous: true, new_email: 'sam@voorbeeld.nl' })).toBe('mail-verstuurd');
  });

  it('is klaar zodra de gebruiker geen gast meer is', () => {
    expect(accountStap({ is_anonymous: false, email: 'sam@voorbeeld.nl' })).toBe('klaar');
    expect(accountStap({ email: 'sam@voorbeeld.nl' })).toBe('klaar');
  });

  it('ziet alleen een anonieme gebruiker als gast', () => {
    expect(isGast({ is_anonymous: true })).toBe(true);
    expect(isGast({ is_anonymous: false })).toBe(false);
    expect(isGast({})).toBe(false);
    expect(isGast(null)).toBe(false);
  });
});

describe('accountFoutmelding', () => {
  it('zegt bij een bezet e-mailadres dat samenvoegen niet kan', () => {
    const melding = accountFoutmelding('email_exists', 'email');
    expect(melding).toContain('hoort al bij een ander CoupleCart-account');
    expect(melding).toContain('samenvoegen kan niet');
    expect(melding).toContain('kies een ander e-mailadres');
  });

  it('noemt Google wanneer het Google-account of zijn adres al bezet is', () => {
    expect(accountFoutmelding('identity_already_exists', 'google')).toContain('Dit Google-account hoort al bij');
    expect(accountFoutmelding('email_exists', 'google')).toContain('Het e-mailadres van dit Google-account');
  });

  it('legt uit dat Google nog niet kan als handmatig koppelen uit staat', () => {
    expect(accountFoutmelding('manual_linking_disabled', 'google')).toBe(
      'Een account maken met Google kan nog niet. Gebruik voorlopig je e-mailadres.',
    );
  });

  it('onderscheidt een afgebroken Google-koppeling van een verlopen link', () => {
    expect(accountFoutmelding('access_denied', 'google')).toContain('afgebroken');
    expect(accountFoutmelding('access_denied', 'email')).toContain('verlopen');
    expect(accountFoutmelding('otp_expired', 'email')).toContain('verlopen');
  });

  it('valt terug op een algemene melding', () => {
    expect(accountFoutmelding(undefined, 'email')).toBe('Er ging iets mis. Probeer het opnieuw.');
    expect(accountFoutmelding('iets_nieuws', 'google')).toBe('Er ging iets mis. Probeer het opnieuw.');
  });

  it('heeft voor elke melding een Engelse vertaling', () => {
    const codes = [
      'email_exists', 'user_already_exists', 'identity_already_exists', 'manual_linking_disabled',
      'email_address_not_authorized', 'over_email_send_rate_limit', 'over_request_rate_limit',
      'email_address_invalid', 'validation_failed', 'weak_password', 'otp_expired', 'email_not_confirmed',
      'access_denied', undefined,
    ];
    const routes: AccountRoute[] = ['email', 'google'];
    const zonderVertaling = codes
      .flatMap((code) => routes.map((route) => accountFoutmelding(code, route)))
      .filter((melding) => !EN[melding]);
    expect(zonderVertaling).toEqual([]);
  });
});

describe('leesAuthTerugkeer', () => {
  it('leest een fout van Google-koppelen uit de query en de #', () => {
    const href = `${SITE}?error=server_error&error_code=identity_already_exists&error_description=Identity+is+already+linked+to+another+user`
      + '#error=server_error&error_code=identity_already_exists&error_description=Identity+is+already+linked+to+another+user&sb=';
    expect(leesAuthTerugkeer(href)).toEqual({
      soort: 'fout',
      code: 'identity_already_exists',
      omschrijving: 'Identity is already linked to another user',
    });
  });

  it('leest een verlopen bevestigingslink, die alleen in de # staat', () => {
    const href = `${SITE}#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired&sb=`;
    expect(leesAuthTerugkeer(href)).toEqual({
      soort: 'fout',
      code: 'otp_expired',
      omschrijving: 'Email link is invalid or has expired',
    });
  });

  it('valt zonder error_code terug op error, zoals bij afbreken bij Google', () => {
    const href = `${SITE}?error=access_denied&error_description=The+user+denied+access#error=access_denied&error_description=The+user+denied+access&sb=`;
    expect(leesAuthTerugkeer(href)).toEqual({ soort: 'fout', code: 'access_denied', omschrijving: 'The user denied access' });
  });

  it('herkent de sessie na het bevestigen van het e-mailadres', () => {
    const href = `${SITE}#access_token=abc&expires_at=1760000000&expires_in=3600&refresh_token=def&token_type=bearer&type=email_change&sb=`;
    expect(leesAuthTerugkeer(href)).toEqual({ soort: 'email-bevestigd' });
  });

  it('herkent de sessie na Google', () => {
    const href = `${SITE}#access_token=abc&expires_at=1760000000&expires_in=3600&provider_token=g&refresh_token=def&token_type=bearer`;
    expect(leesAuthTerugkeer(href)).toEqual({ soort: 'ingelogd' });
  });

  it('laat de routes van de app met rust', () => {
    for (const route of ['', '#/', '#/shared/abc123', '#/info/privacy', '#/?import=https%3A%2F%2Fwww.instagram.com%2Freel%2Fx%2F', '#/?error=x']) {
      expect(leesAuthTerugkeer(`${SITE}${route}`)).toBeNull();
    }
    expect(leesAuthTerugkeer('geen url')).toBeNull();
  });
});

describe('Engelse teksten', () => {
  it('vertalen alles wat het account-scherm toont', () => {
    const bron = ['src/components/AccountSheet.tsx'].map((pad) => readFileSync(pad, 'utf8')).join('\n');
    const teksten = [...bron.matchAll(/\bt\((['"])((?:(?!\1)[^\\]|\\.)*)\1/g)].map((m) => m[2]);
    expect(teksten.length > 10).toBe(true);
    expect(teksten.filter((tekst) => !EN[tekst])).toEqual([]);
  });
});

describe('zonderAuthFout', () => {
  it('haalt de fout uit de query en zet de app terug op de start', () => {
    const href = `${SITE}?error=server_error&error_code=email_exists&error_description=x#error=server_error&error_code=email_exists&sb=`;
    expect(zonderAuthFout(href)).toBe(`${SITE}#/`);
  });

  it('laat andere query-parameters staan', () => {
    expect(zonderAuthFout(`${SITE}?bron=mail&error=access_denied#error=access_denied`)).toBe(`${SITE}?bron=mail#/`);
  });
});
