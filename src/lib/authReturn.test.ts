import { describe, expect, it } from 'vitest';
import { readAuthReturn } from '@/lib/authReturn';

describe('readAuthReturn', () => {
  it('herkent de terugkeer van Google', () => {
    const path = '/access_token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2ln&expires_at=1792400000&expires_in=3600'
      + '&provider_token=ya29.a0Af&refresh_token=v1abc&token_type=bearer';
    expect(readAuthReturn(path)).toEqual({ errorCode: null });
  });

  it('herkent een bevestigde e-mail', () => {
    expect(readAuthReturn('/access_token=x&expires_in=3600&refresh_token=y&token_type=bearer&type=signup'))
      .toEqual({ errorCode: null });
  });

  it('geeft de foutcode van een verlopen link', () => {
    const path = '/error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired';
    expect(readAuthReturn(path)).toEqual({ errorCode: 'otp_expired' });
  });

  it('valt zonder foutcode terug op de fout zelf', () => {
    expect(readAuthReturn('/error=access_denied&error_description=Denied')).toEqual({ errorCode: 'access_denied' });
  });

  it('leest ook de ruwe hash', () => {
    expect(readAuthReturn('#access_token=x&refresh_token=y')).toEqual({ errorCode: null });
  });

  it('laat gewone pagina’s met rust', () => {
    for (const path of ['/', '/auth', '/info/privacy', '/bestaat-niet', '/shared/abc123']) {
      expect(readAuthReturn(path)).toBe(null);
    }
  });
});
