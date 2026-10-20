# Supabase-mails in het Nederlands

Supabase stuurt standaard Engelse mails ("Reset Password – Follow this link…"), midden in een
Nederlandse app. Hieronder staan Nederlandse versies van de drie mails die CoupleCart verstuurt,
klaar om te plakken in het Supabase-dashboard. Claude kan de Supabase-instellingen niet zelf
wijzigen; plakken doe je zelf.

| Mail in Supabase | Wanneer | In de code |
| --- | --- | --- |
| **Confirm sign up** | Account maken met e-mail op het inlogscherm, en ‘Stuur de bevestigingsmail opnieuw’ | `signUp` en `resend({ type: 'signup' })` in `src/pages/Auth.tsx` |
| **Reset password** | ‘Wachtwoord vergeten?’ | `resetPasswordForEmail` in `src/pages/Auth.tsx` |
| **Change email address** | Een gast maakt een account met e-mail (‘Maak je account’), en ‘Nieuwe mail’ daarna | `updateUser({ email })` in `src/components/AccountSheet.tsx` |

Let op die laatste: een gast die een account maakt, krijgt de mail **Change email address**, niet
Confirm sign up. Daarom kijkt die mail of er al een oud adres is (`{{ if .Email }}`). Bij een gast
is `{{ .Email }}` leeg en gaat de mail over een nieuw account; anders over een nieuw adres.

## Plakken

1. Open het Supabase-dashboard, project CoupleCart (`wguzdygvwtacfbzqwnxa`).
2. Ga naar **Authentication → Emails** (tab **Templates**; in oudere dashboards heet het
   **Email Templates**).
3. Kies per mail hieronder de template met dezelfde naam:
   - plak het **onderwerp** in **Subject**;
   - zet de inhoud op **Source** (de HTML-weergave), selecteer alles en plak de **HTML** eroverheen;
   - klik **Save**.
4. Kijk bij **Authentication → URL Configuration** of **Site URL** `https://www.couplecart.nl` is.
   De mails linken onderaan naar `{{ .SiteURL }}`.
5. Test: vraag in de app ‘Wachtwoord vergeten?’ aan voor je eigen adres en open de mail, ook op je
   telefoon.

Kun je de templates niet bewerken? Sinds 3 juni 2026 kunnen nieuwe gratis projecten die mailen via
de standaard-SMTP van Supabase hun templates niet meer aanpassen. Met een eigen SMTP-server
(**Authentication → Emails → SMTP Settings**) of een betaald plan kan het wel.

## Goed om te weten

- **Taal.** De taal van de app staat in de browser (`couplecart-taal`), niet bij het account. Wie
  de app in het Engels gebruikt, krijgt deze mails dus in het Nederlands. Voor Engelse mails moet de
  app de taal eerst in `user_metadata` bewaren, zodat de template kan kiezen met
  `{{ if eq .Data.taal "en" }}`.
- **Linkscanners.** Sommige zakelijke mailboxen (zoals Microsoft Defender Safe Links) openen links
  vooraf. Dan is de link al gebruikt voordat iemand erop tikt, en zegt de app dat de link verlopen
  is. Gebeurt dat vaak, dan kan de mail ook een code (`{{ .Token }}`) sturen in plaats van een link.
  Dat vraagt een aanpassing in de app.
- **Opmaak.** De mails gebruiken alleen inline styles en tabellen, zodat ze ook in Outlook en Gmail
  goed staan. De kleuren komen uit `src/index.css`: groen `#0E4D38` (`--primary`), crème `#F4F2EA`
  (`--background`), inkt `#10160F`, grijs `#5F6A5C` en rand `#E1DECF`. Onder elke knop staat de
  link nog eens als tekst, voor als de knop niet werkt.

---

## Confirm sign up

**Onderwerp**

```text
Bevestig je e-mailadres voor CoupleCart
```

**HTML**

```html
<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>Bevestig je e-mailadres</title>
</head>
<body style="margin:0;padding:0;background-color:#F4F2EA;">
<div style="display:none;max-height:0;overflow:hidden;">Nog één stap, dan is je CoupleCart-account klaar.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F4F2EA;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">
        <tr>
          <td style="padding:0 4px 20px 4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:22px;font-weight:700;color:#0E4D38;">CoupleCart</td>
        </tr>
        <tr>
          <td style="background-color:#FFFFFF;border:1px solid #E1DECF;border-radius:16px;padding:28px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#10160F;">
            <h1 style="margin:0 0 12px 0;font-size:22px;line-height:1.3;font-weight:700;color:#10160F;">Bevestig je e-mailadres</h1>
            <p style="margin:0 0 24px 0;font-size:16px;line-height:1.5;">Welkom bij CoupleCart! Bevestig dat <strong>{{ .Email }}</strong> van jou is, dan is je account klaar.</p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" bgcolor="#0E4D38" style="border-radius:12px;">
                  <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;font-weight:600;line-height:1.2;color:#FFFFFF;text-decoration:none;border-radius:12px;">Bevestig e-mailadres</a>
                </td>
              </tr>
            </table>
            <p style="margin:24px 0 0 0;font-size:16px;line-height:1.5;">Daarna log je overal in met dit adres, ook in de app op je beginscherm.</p>
            <p style="margin:24px 0 0 0;font-size:14px;line-height:1.5;color:#5F6A5C;">Werkt de knop niet? Kopieer dan deze link en plak hem in de adresbalk van je browser:</p>
            <p style="margin:8px 0 0 0;font-size:13px;line-height:1.5;word-break:break-all;"><a href="{{ .ConfirmationURL }}" style="color:#0E4D38;">{{ .ConfirmationURL }}</a></p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 4px 0 4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.5;color:#5F6A5C;">
            <p style="margin:0 0 8px 0;">Heb je geen account gemaakt bij CoupleCart? Dan kun je deze mail negeren.</p>
            <p style="margin:0;">Hulp nodig? Mail <a href="mailto:info.couplecart@gmail.com" style="color:#0E4D38;">info.couplecart@gmail.com</a> · <a href="{{ .SiteURL }}" style="color:#0E4D38;">CoupleCart</a></p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>
```

---

## Reset password

**Onderwerp**

```text
Kies een nieuw wachtwoord voor CoupleCart
```

**HTML**

```html
<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>Kies een nieuw wachtwoord</title>
</head>
<body style="margin:0;padding:0;background-color:#F4F2EA;">
<div style="display:none;max-height:0;overflow:hidden;">Met de link in deze mail kies je een nieuw wachtwoord.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F4F2EA;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">
        <tr>
          <td style="padding:0 4px 20px 4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:22px;font-weight:700;color:#0E4D38;">CoupleCart</td>
        </tr>
        <tr>
          <td style="background-color:#FFFFFF;border:1px solid #E1DECF;border-radius:16px;padding:28px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#10160F;">
            <h1 style="margin:0 0 12px 0;font-size:22px;line-height:1.3;font-weight:700;color:#10160F;">Kies een nieuw wachtwoord</h1>
            <p style="margin:0 0 24px 0;font-size:16px;line-height:1.5;">Je vroeg om een nieuw wachtwoord voor je CoupleCart-account <strong>{{ .Email }}</strong>. Met de knop hieronder kies je er een.</p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" bgcolor="#0E4D38" style="border-radius:12px;">
                  <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;font-weight:600;line-height:1.2;color:#FFFFFF;text-decoration:none;border-radius:12px;">Kies een nieuw wachtwoord</a>
                </td>
              </tr>
            </table>
            <p style="margin:24px 0 0 0;font-size:16px;line-height:1.5;">De link werkt één keer. Werkt hij niet meer? Vraag dan in de app via ‘Wachtwoord vergeten?’ een nieuwe aan.</p>
            <p style="margin:24px 0 0 0;font-size:14px;line-height:1.5;color:#5F6A5C;">Werkt de knop niet? Kopieer dan deze link en plak hem in de adresbalk van je browser:</p>
            <p style="margin:8px 0 0 0;font-size:13px;line-height:1.5;word-break:break-all;"><a href="{{ .ConfirmationURL }}" style="color:#0E4D38;">{{ .ConfirmationURL }}</a></p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 4px 0 4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.5;color:#5F6A5C;">
            <p style="margin:0 0 8px 0;">Vroeg je niet om een nieuw wachtwoord? Dan kun je deze mail negeren. Je wachtwoord blijft hetzelfde.</p>
            <p style="margin:0;">Hulp nodig? Mail <a href="mailto:info.couplecart@gmail.com" style="color:#0E4D38;">info.couplecart@gmail.com</a> · <a href="{{ .SiteURL }}" style="color:#0E4D38;">CoupleCart</a></p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>
```

---

## Change email address

Een gast die een account maakt, krijgt deze mail (zonder oud adres). Wie al een account heeft en
een ander adres kiest, krijgt de tweede tekst.

**Onderwerp**

```text
Bevestig je e-mailadres voor CoupleCart
```

**HTML**

```html
<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>{{ if .Email }}Bevestig je nieuwe e-mailadres{{ else }}Bevestig je e-mailadres{{ end }}</title>
</head>
<body style="margin:0;padding:0;background-color:#F4F2EA;">
<div style="display:none;max-height:0;overflow:hidden;">{{ if .Email }}Bevestig je nieuwe e-mailadres voor CoupleCart.{{ else }}Nog één stap, dan is je CoupleCart-account klaar.{{ end }}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F4F2EA;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">
        <tr>
          <td style="padding:0 4px 20px 4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:22px;font-weight:700;color:#0E4D38;">CoupleCart</td>
        </tr>
        <tr>
          <td style="background-color:#FFFFFF;border:1px solid #E1DECF;border-radius:16px;padding:28px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#10160F;">
            {{ if .Email }}
            <h1 style="margin:0 0 12px 0;font-size:22px;line-height:1.3;font-weight:700;color:#10160F;">Bevestig je nieuwe e-mailadres</h1>
            <p style="margin:0 0 24px 0;font-size:16px;line-height:1.5;">Je wilt het e-mailadres van je CoupleCart-account veranderen van <strong>{{ .Email }}</strong> naar <strong>{{ .NewEmail }}</strong>. Bevestig dat met de knop hieronder.</p>
            {{ else }}
            <h1 style="margin:0 0 12px 0;font-size:22px;line-height:1.3;font-weight:700;color:#10160F;">Bevestig je e-mailadres</h1>
            <p style="margin:0 0 24px 0;font-size:16px;line-height:1.5;">Je maakt een CoupleCart-account met <strong>{{ .NewEmail }}</strong>. Bevestig dat dit adres van jou is, dan is je account klaar.</p>
            {{ end }}
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" bgcolor="#0E4D38" style="border-radius:12px;">
                  <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;font-weight:600;line-height:1.2;color:#FFFFFF;text-decoration:none;border-radius:12px;">{{ if .Email }}Bevestig nieuw e-mailadres{{ else }}Bevestig e-mailadres{{ end }}</a>
                </td>
              </tr>
            </table>
            {{ if .Email }}
            <p style="margin:24px 0 0 0;font-size:16px;line-height:1.5;">Kreeg je deze mail op allebei je adressen? Bevestig dan in allebei de mails.</p>
            {{ else }}
            <p style="margin:24px 0 0 0;font-size:16px;line-height:1.5;">Je lijst, recepten en kast blijven gewoon staan. Het maakt niet uit op welk toestel je de link opent.</p>
            {{ end }}
            <p style="margin:24px 0 0 0;font-size:14px;line-height:1.5;color:#5F6A5C;">Werkt de knop niet? Kopieer dan deze link en plak hem in de adresbalk van je browser:</p>
            <p style="margin:8px 0 0 0;font-size:13px;line-height:1.5;word-break:break-all;"><a href="{{ .ConfirmationURL }}" style="color:#0E4D38;">{{ .ConfirmationURL }}</a></p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 4px 0 4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.5;color:#5F6A5C;">
            <p style="margin:0 0 8px 0;">{{ if .Email }}Wil je je e-mailadres niet veranderen? Dan kun je deze mail negeren. Er verandert dan niets.{{ else }}Heb je geen account gemaakt bij CoupleCart? Dan kun je deze mail negeren.{{ end }}</p>
            <p style="margin:0;">Hulp nodig? Mail <a href="mailto:info.couplecart@gmail.com" style="color:#0E4D38;">info.couplecart@gmail.com</a> · <a href="{{ .SiteURL }}" style="color:#0E4D38;">CoupleCart</a></p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>
```
