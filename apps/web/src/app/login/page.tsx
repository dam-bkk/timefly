import { db, schema } from "@timefly/db";
import { eq, inArray } from "drizzle-orm";
import { signInAs } from "@/app/actions";
import { Avatar } from "@/components/ui/avatar";
import { Logo } from "@/components/ui/logo";
import { ROLE_LABEL } from "@/lib/utils";

export const metadata = { title: "Sign in" };

export default async function Login() {
  const personas = await db
    .select({ id: schema.people.id, displayName: schema.people.displayName, jobTitle: schema.people.jobTitle, role: schema.people.role, team: schema.teams.name })
    .from(schema.people)
    .leftJoin(schema.teams, eq(schema.teams.id, schema.people.teamId))
    .where(inArray(schema.people.displayName, ["Nada Haddad", "Wei Chen", "Priya Sharma", "Siti Abdullah", "Rahul Sharma", "Farah Ismail"]));
  const order = ["admin", "manager", "member"];
  personas.sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role) || a.displayName.localeCompare(b.displayName));
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-ink text-canvas lg:block dark:bg-surface">
        <WeekField />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Logo plate className="[&>span:last-child]:text-canvas dark:[&>span:last-child]:text-ink" />
          <div className="max-w-md">
            <p className="text-[40px] font-semibold leading-[1.08] tracking-[-0.03em]">
              Every hour, <span className="font-normal text-canvas/60 dark:text-ink-3">on the work it went to.</span>
            </p>
            <p className="mt-4 text-[13.5px] leading-relaxed text-canvas/70 dark:text-ink-2">A daily log of what each developer worked on — by project and work request — with the Harvest history behind it.</p>
          </div>
          <p className="font-mono text-[11px] text-canvas/40 dark:text-ink-3">IT QI Group · internal · dev environment</p>
        </div>
      </section>
      <section className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <Logo className="mb-8 lg:hidden" />
          <h1 className="text-[22px] font-semibold tracking-[-0.01em]">Sign in</h1>
          <p className="mt-1 text-[13.5px] text-ink-3">Production uses your Microsoft account. In dev, pick a persona to see the product from their seat.</p>
          <div className="mt-6 space-y-1.5">
            {personas.map((p) => (
              <form key={p.id} action={signInAs.bind(null, p.id)}>
                <button className="persona-row group flex w-full items-center gap-3 rounded-lg bg-surface px-3 py-2.5 text-left hairline">
                  <Avatar name={p.displayName} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-medium">{p.displayName}</span>
                    <span className="block truncate text-[12.5px] text-ink-3">
                      {p.jobTitle}
                      {p.team ? ` · ${p.team}` : ""}
                    </span>
                  </span>
                  <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-ink-2">{ROLE_LABEL[p.role]}</span>
                </button>
              </form>
            ))}
          </div>
          <p className="mt-8 text-center text-[12.5px] text-ink-3">Entra ID · single sign-on · no passwords stored</p>
        </div>
      </section>
    </main>
  );
}

function WeekField() {
  // Decorative: a faint week grid with a few filled cells, generated deterministically.
  const cols = 7;
  const rows = 9;
  const filled = new Set([3, 4, 5, 10, 11, 12, 13, 17, 19, 24, 25, 26, 27, 31, 32, 38, 39, 40, 45, 46, 47, 52, 54, 59, 60, 61]);
  return (
    <svg className="absolute inset-0 h-full w-full opacity-[0.16]" viewBox="0 0 860 720" preserveAspectRatio="xMidYMid slice" aria-hidden>
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => {
          const i = r * cols + c;
          const x = 120 + c * 96;
          const y = 60 + r * 70;
          return <rect key={i} x={x} y={y} width={84} height={56} rx={6} fill={filled.has(i) ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1} strokeDasharray={filled.has(i) ? undefined : "2 5"} opacity={filled.has(i) ? 0.55 : 1} />;
        }),
      )}
    </svg>
  );
}
