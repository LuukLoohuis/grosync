import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const HERZIEN = '16 september 2026';
const MAIL = 'couplecart@gmail.com';

interface Deel {
  titel: string;
  inhoud: JSX.Element;
}

const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2 className="mt-6 font-display text-lg font-bold tracking-[-0.01em] text-foreground">{children}</h2>
);

const P = ({ children }: { children: React.ReactNode }) => (
  <p className="mt-2 text-[0.9375rem] leading-relaxed text-foreground/90">{children}</p>
);

const Lijst = ({ items }: { items: React.ReactNode[] }) => (
  <ul className="mt-2 space-y-1.5">
    {items.map((item, index) => (
      <li key={index} className="flex gap-2 text-[0.9375rem] leading-relaxed text-foreground/90">
        <span className="text-primary">•</span>
        <span>{item}</span>
      </li>
    ))}
  </ul>
);

const mail = <a className="font-medium text-primary hover:underline" href={`mailto:${MAIL}`}>{MAIL}</a>;

const DELEN: Record<string, Deel> = {
  voorwaarden: {
    titel: 'Algemene voorwaarden',
    inhoud: (
      <>
        <P>
          CoupleCart is een boodschappen-app voor huishoudens. Deze voorwaarden gelden voor iedereen die
          de app gebruikt, gratis of met een abonnement.
        </P>

        <H2>Wie we zijn</H2>
        <P>
          CoupleCart wordt aangeboden door Luuk Loohuis, ingeschreven bij de Kamer van Koophandel.
          Vragen gaan naar {mail}. Vul hier je KvK-nummer, btw-nummer en adres in voordat je de app
          betaald aanbiedt; zonder die gegevens mag je geen digitale dienst verkopen aan consumenten.
        </P>

        <H2>Wat je krijgt</H2>
        <P>
          Een gedeelde boodschappenlijst, een receptenboek, een voorraadkast en een overzicht van de
          bonus bij Albert Heijn. De gratis versie kent een maandelijkse grens voor het ophalen van
          recepten en het scannen van je kast; CoupleCart Plus haalt die grens weg voor het hele
          huishouden.
        </P>

        <H2>Prijzen en betalen</H2>
        <P>
          Prijzen staan in euro's en zijn inclusief 21% btw. Je betaalt vooraf per maand of per jaar.
          De betaling loopt via Stripe; wij zien je kaartgegevens nooit.
        </P>

        <H2>Opzeggen</H2>
        <P>
          Je zegt op wanneer je wil. Het abonnement loopt door tot het einde van de periode die je al
          betaald hebt; daarna wordt er niets meer afgeschreven en val je terug op de gratis versie. Je
          lijst, recepten en voorraad blijven gewoon van jou.
        </P>

        <H2>Bedenktijd</H2>
        <P>
          Bij een digitale dienst heb je veertien dagen bedenktijd. Omdat de dienst meteen begint, vragen
          we bij het afrekenen om daar uitdrukkelijk mee in te stemmen; daarmee doe je afstand van die
          bedenktijd. Stem je daar niet mee in, dan start Plus pas na veertien dagen.
        </P>

        <H2>Wat we niet beloven</H2>
        <Lijst
          items={[
            'Prijzen en aanbiedingen komen van Albert Heijn en kunnen afwijken van wat er in de winkel geldt. Reken erop dat de kassa gelijk heeft, niet de app.',
            'Recepten die uit een link of een foto worden gehaald, worden door een taalmodel gelezen. Controleer hoeveelheden en bereidingstijden zelf, zeker bij allergieën.',
            'De app kan tijdelijk onbereikbaar zijn door onderhoud of storing bij onze leveranciers.',
          ]}
        />

        <H2>Wat we van jou verwachten</H2>
        <P>
          Gebruik de app niet voor iets anders dan boodschappen doen en koken, en zet er geen gegevens in
          die niet van jou zijn. Deel je je lijst, dan kan iedereen met die link meekijken en wijzigen.
        </P>

        <H2>Aansprakelijkheid</H2>
        <P>
          We doen ons best, maar we zijn niet aansprakelijk voor schade door verkeerde prijzen, gemiste
          aanbiedingen of een recept dat anders uitpakte. Blijft er toch aansprakelijkheid over, dan is
          die beperkt tot wat je in de twaalf maanden ervoor hebt betaald.
        </P>

        <H2>Wijzigingen</H2>
        <P>
          We mogen deze voorwaarden aanpassen. Verandert er iets wezenlijks voor betalende gebruikers,
          dan laten we dat vooraf weten per e-mail, en mag je opzeggen.
        </P>

        <H2>Recht</H2>
        <P>Nederlands recht is van toepassing. Geschillen gaan naar de bevoegde Nederlandse rechter.</P>
      </>
    ),
  },

  privacy: {
    titel: 'Privacy',
    inhoud: (
      <>
        <P>
          Deze verklaring legt uit welke gegevens CoupleCart bewaart, waarom, en aan wie ze worden
          doorgegeven.
        </P>

        <H2>Wat we bewaren</H2>
        <Lijst
          items={[
            'Je e-mailadres, of alleen een anoniem account als je zonder account verdergaat.',
            'Je boodschappenlijst, recepten, voorraad, favorieten en wat je afvinkt.',
            'Hoe vaak je recepten ophaalt en je kast scant, om de maandelijkse grens bij te houden.',
            'Bij een abonnement: je klantnummer bij Stripe. Betaalgegevens blijven bij Stripe.',
          ]}
        />

        <H2>Waarom</H2>
        <P>
          Om de app te laten werken, om de gratis grens eerlijk toe te passen, en om een betaling te
          kunnen koppelen aan je account. We verkopen niets door en we volgen je niet over andere sites.
        </P>

        <H2>Foto's van je kast</H2>
        <P>
          Een foto die je maakt om je voorraad te vullen gaat naar OpenAI om gelezen te worden. Wij
          bewaren die foto niet: alleen de productnamen die jij daarna bevestigt komen in je kast. Maak
          geen foto's waar iets anders op staat dan je boodschappen.
        </P>

        <H2>Wie ze verder verwerken</H2>
        <Lijst
          items={[
            'Supabase — database en inloggen, servers in de Europese Unie.',
            'Vercel — de app zelf.',
            'OpenAI en Google — het lezen van recepten en kastfoto’s.',
            'Albert Heijn — prijzen opzoeken. Je lijst gaat als zoekterm mee, niet je account.',
            'Stripe — betalingen, als je Plus neemt.',
          ]}
        />

        <H2>Hoe lang</H2>
        <P>
          Zolang je je account gebruikt. Verwijder je je account, dan gaan je lijst, recepten en voorraad
          mee. Vraag dat aan via {mail} en het gebeurt binnen dertig dagen.
        </P>

        <H2>Je rechten</H2>
        <P>
          Je mag inzien, laten corrigeren en laten verwijderen wat we van je hebben, en je mag bezwaar
          maken tegen verwerking. Mail {mail}. Kom je er met ons niet uit, dan kun je klagen bij de
          Autoriteit Persoonsgegevens.
        </P>
      </>
    ),
  },

  cookies: {
    titel: 'Cookies',
    inhoud: (
      <>
        <P>
          CoupleCart gebruikt geen advertentiecookies en volgt je niet over andere sites. Wat er wel
          wordt opgeslagen, staat hieronder.
        </P>

        <H2>Wat er op je toestel staat</H2>
        <Lijst
          items={[
            'Een inlogtoken van Supabase, zodat je ingelogd blijft. Zonder dit werkt de app niet.',
            'Kleine voorkeuren: licht of donker thema, de volgorde van je lijst, en of je de uitleg over vegen al hebt gezien.',
            'Een offline wachtrij: wijzigingen die je zonder bereik maakt, tot ze verstuurd zijn.',
          ]}
        />
        <P>
          Dit is allemaal noodzakelijk om de app te laten werken of is een voorkeur die jij zelf hebt
          gezet. Daarvoor is geen toestemming nodig. Je kunt alles wissen door de sitegegevens in je
          browser te verwijderen; dan word je uitgelogd.
        </P>

        <H2>Geen advertenties</H2>
        <P>
          Er staan geen advertenties in CoupleCart en er wordt geen advertentienetwerk geladen. Mocht dat
          ooit veranderen, dan vragen we eerst je toestemming, met de mogelijkheid om nee te zeggen.
        </P>
      </>
    ),
  },
};

/** Algemene voorwaarden, privacy en cookies. Bereikbaar zonder in te loggen. */
const Legal = () => {
  const { deel } = useParams<{ deel: string }>();
  const gekozen = DELEN[deel ?? 'voorwaarden'] ?? DELEN.voorwaarden;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-2 px-4">
          <Link
            to="/"
            aria-label="Terug naar de app"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="flex-1 truncate font-display text-xl font-bold tracking-[-0.01em] text-foreground">
            {gekozen.titel}
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-16 pt-4">
        <nav aria-label="Juridisch" className="flex flex-wrap gap-2">
          {Object.entries(DELEN).map(([sleutel, item]) => (
            <Link
              key={sleutel}
              to={`/info/${sleutel}`}
              aria-current={item === gekozen ? 'page' : undefined}
              className={`inline-flex min-h-11 items-center rounded-full px-3.5 font-display text-xs font-bold transition-colors duration-150 ease-smooth ${
                item === gekozen ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {item.titel}
            </Link>
          ))}
        </nav>

        <p className="mt-4 text-xs text-muted-foreground">Laatst herzien op {HERZIEN}</p>

        <article>{gekozen.inhoud}</article>

        <p className="mt-8 rounded-[14px] border border-border bg-card p-4 text-sm text-muted-foreground">
          Hulp nodig of een vraag over je abonnement? Mail {mail} en je krijgt binnen een paar dagen
          antwoord.
        </p>
      </main>
    </div>
  );
};

export default Legal;
