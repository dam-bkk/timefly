import { db, schema } from "@timefly/db";
import { desc } from "drizzle-orm";
import { APP_ENV, APP_VERSION } from "@/lib/auth";
import { longTime } from "@/lib/utils";
import { Tag } from "@/components/ui/pills";

export const metadata = { title: "Releases" };

export default async function ReleasesPage() {
  const rows = await db.select().from(schema.releases).orderBy(desc(schema.releases.releasedAt));
  return (
    <div className="max-w-3xl">
      <h1 className="text-[20px] font-semibold tracking-[-0.01em]">Releases</h1>
      <p className="text-[13px] text-ink-3">
        Versions come from Conventional Commits (fix → patch, feat → minor, breaking → major) — never typed by hand. Running v{APP_VERSION} on {APP_ENV}.
      </p>
      <div className="mt-6 space-y-3">
        {rows.map((r) => (
          <section key={r.id} className="panel p-5">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[15px] font-semibold">v{r.version}</span>
              <Tag>{r.bump}</Tag>
              <Tag>{r.environment}</Tag>
              {r.commitSha && <span className="font-mono text-[11px] text-ink-3">{r.commitSha}</span>}
              <span className="ml-auto text-[12.5px] text-ink-3">{longTime(r.releasedAt)}</span>
            </div>
            {r.notes && <p className="mt-2 text-[13px] text-ink-2">{r.notes}</p>}
            <ul className="mt-3 space-y-1 text-[13px]">
              {r.changes.map((c, i) => (
                <li key={i} className="flex gap-2">
                  <span className="w-12 shrink-0 font-mono text-[11.5px] text-ink-3">{c.type}</span>
                  <span>
                    {c.scope && <span className="text-ink-3">{c.scope}: </span>}
                    {c.subject}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
