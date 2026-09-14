import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, RefreshCw, Search, Star } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppContext } from '@/contexts/AppContext';
import { supabase } from '@/integrations/supabase/client';

/** What a call costs us, in euros. A guess, but a documented one. */
const RATES: Record<string, number> = { recept: 0.02, kastfoto: 0.005 };

const FEATURES: Record<string, string> = { recept: 'Recept ophalen', kastfoto: 'Kastfoto' };

interface Overview {
  periode: string;
  huishoudens: number;
  nieuw_7d: number;
  nieuw_30d: number;
  actief_7d: number;
  actief_30d: number;
  plus_leden: number;
  delende_huishoudens: number;
  recepten: number;
  lijstitems: number;
  voorraaditems: number;
  acties_deze_maand: Record<string, number>;
  gebruikers_met_acties: number;
  op_hun_limiet: number;
}

interface AdminUser {
  user_id: string;
  email: string;
  is_gast: boolean;
  aangemaakt: string;
  laatst_gezien: string | null;
  plus: boolean;
  recepten: number;
  lijstitems: number;
  voorraad: number;
  acties_deze_maand: number;
}

interface UsageRow { period: string; feature: string; acties: number; gebruikers: number }

const euro = (value: number) => `€ ${value.toFixed(2).replace('.', ',')}`;
const datum = (value: string | null) => (value ? new Date(value).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }) : '—');

const Tile = ({ label, value, hint }: { label: string; value: string | number; hint?: string }) => (
  <div className="rounded-[14px] border border-border bg-card p-3">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="mt-1 font-display text-2xl font-bold tabular-nums text-foreground">{value}</p>
    {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
  </div>
);

const Admin = () => {
  const { isAdmin } = useAppContext();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [kpi, months, people] = await Promise.all([
      supabase.rpc('admin_overview'),
      supabase.rpc('admin_usage', { _months: 6 }),
      supabase.rpc('admin_users', { _search: search.trim() || null, _limit: 50 }),
    ]);
    if (kpi.error) toast.error(kpi.error.message);
    setOverview((kpi.data as unknown as Overview) ?? null);
    setUsage((months.data as UsageRow[]) ?? []);
    setUsers((people.data as AdminUser[]) ?? []);
    setLoading(false);
  }, [search]);

  useEffect(() => { if (isAdmin) void load(); }, [isAdmin, load]);

  const togglePlus = async (person: AdminUser) => {
    const { error } = await supabase.rpc('admin_set_plus', { _user: person.user_id, _on: !person.plus });
    if (error) { toast.error(error.message); return; }
    setUsers((prev) => prev.map((row) => (row.user_id === person.user_id ? { ...row, plus: !row.plus } : row)));
    toast.success(person.plus ? `Plus ingetrokken bij ${person.email || 'gast'}` : `Plus gegeven aan ${person.email || 'gast'}`);
  };

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
        <div>
          <p className="font-display text-xl text-foreground">Geen toegang</p>
          <Link to="/" className="mt-3 inline-block min-h-11 text-primary hover:underline">Terug naar de app</Link>
        </div>
      </div>
    );
  }

  const kosten = Object.entries(overview?.acties_deze_maand ?? {})
    .reduce((sum, [feature, acties]) => sum + acties * (RATES[feature] ?? 0), 0);

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-4">
          <Link to="/" aria-label="Terug" className="flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="flex-1 font-display text-xl font-bold tracking-[-0.01em] text-foreground">Beheer</h1>
          <button onClick={load} aria-label="Vernieuwen" className="flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-5">
        {loading && !overview && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-20 rounded-[14px]" />)}
          </div>
        )}

        {overview && (
          <>
            <section>
              <h2 className="mb-2 font-display text-[0.9375rem] font-bold text-foreground">Huishoudens</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Tile label="Totaal" value={overview.huishoudens} hint={`+${overview.nieuw_7d} deze week`} />
                <Tile label="Actief (7 dagen)" value={overview.actief_7d} hint={`${overview.actief_30d} in 30 dagen`} />
                <Tile label="Plus" value={overview.plus_leden} hint={`${overview.delende_huishoudens} delen samen`} />
              </div>
            </section>

            <section>
              <h2 className="mb-2 font-display text-[0.9375rem] font-bold text-foreground">Deze maand ({overview.periode})</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {Object.entries(FEATURES).map(([key, label]) => (
                  <Tile
                    key={key}
                    label={label}
                    value={overview.acties_deze_maand?.[key] ?? 0}
                    hint={`${euro((overview.acties_deze_maand?.[key] ?? 0) * (RATES[key] ?? 0))} aan kosten`}
                  />
                ))}
                <Tile label="Geschatte kosten" value={euro(kosten)} hint="alleen de gemeten functies" />
                <Tile label="Gebruikers met acties" value={overview.gebruikers_met_acties} />
                <Tile label="Tegen hun limiet" value={overview.op_hun_limiet} hint="kandidaten voor Plus" />
              </div>
            </section>

            <section>
              <h2 className="mb-2 font-display text-[0.9375rem] font-bold text-foreground">Inhoud</h2>
              <div className="grid grid-cols-3 gap-3">
                <Tile label="Recepten" value={overview.recepten} />
                <Tile label="Lijstitems" value={overview.lijstitems} />
                <Tile label="Voorraad" value={overview.voorraaditems} />
              </div>
            </section>
          </>
        )}

        {usage.length > 0 && (
          <section>
            <h2 className="mb-2 font-display text-[0.9375rem] font-bold text-foreground">Verbruik per maand</h2>
            <div className="overflow-x-auto rounded-[14px] border border-border bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Maand</th>
                    <th className="px-3 py-2 font-medium">Functie</th>
                    <th className="px-3 py-2 text-right font-medium">Acties</th>
                    <th className="px-3 py-2 text-right font-medium">Huishoudens</th>
                    <th className="px-3 py-2 text-right font-medium">Kosten</th>
                  </tr>
                </thead>
                <tbody>
                  {usage.map((row) => (
                    <tr key={`${row.period}-${row.feature}`} className="border-b border-border/60 last:border-0">
                      <td className="px-3 py-2 tabular-nums">{row.period}</td>
                      <td className="px-3 py-2">{FEATURES[row.feature] ?? row.feature}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{row.acties}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{row.gebruikers}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{euro(row.acties * (RATES[row.feature] ?? 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section>
          <div className="mb-2 flex items-center gap-2">
            <h2 className="flex-1 font-display text-[0.9375rem] font-bold text-foreground">Gebruikers</h2>
          </div>
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Zoek op e-mail"
              aria-label="Zoek op e-mail"
              className="bg-card pl-9 font-body"
            />
          </div>

          <ul className="space-y-2">
            {users.map((person) => (
              <li key={person.user_id} className="rounded-[14px] border border-border bg-card p-3">
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.9375rem] text-foreground">
                      {person.email || <span className="text-muted-foreground">gast</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      sinds {datum(person.aangemaakt)} · laatst {datum(person.laatst_gezien)} ·{' '}
                      <span className="tabular-nums">{person.acties_deze_maand}</span> acties
                    </p>
                  </div>
                  <Button
                    variant={person.plus ? 'default' : 'outline'}
                    className="min-h-11 shrink-0 gap-1.5"
                    onClick={() => togglePlus(person)}
                  >
                    <Star className={`h-4 w-4 ${person.plus ? 'fill-current' : ''}`} />
                    {person.plus ? 'Plus' : 'Geef Plus'}
                  </Button>
                </div>
                <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                  {person.recepten} recepten · {person.lijstitems} lijst · {person.voorraad} voorraad
                </p>
              </li>
            ))}
            {!loading && users.length === 0 && (
              <li className="py-6 text-center text-sm text-muted-foreground">Niemand gevonden.</li>
            )}
          </ul>
        </section>
      </main>
    </div>
  );
};

export default Admin;
