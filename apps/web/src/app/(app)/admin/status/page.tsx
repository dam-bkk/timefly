import { APP_ENV, APP_VERSION } from "@/lib/auth";
import { dbStats, listJobs } from "@/lib/queries";
import { cn, relTime } from "@/lib/utils";
import { Tone } from "@/components/ui/pills";
import { Stat } from "@/components/ui/record";

export const metadata = { title: "System status" };

export default async function StatusPage() {
  const [jobs, stats] = await Promise.all([listJobs(), dbStats()]);
  const backup = jobs.find((j) => j.name === "json-backup");
  const backupAgeH = backup?.lastRunAt ? (Date.now() - backup.lastRunAt.getTime()) / 3_600_000 : null;
  const healthy = jobs.every((j) => j.lastStatus === "ok" || j.lastStatus === "warning" || j.lastStatus === "never") && (backupAgeH === null || backupAgeH < 26);
  return (
    <div className="max-w-3xl">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-[20px] font-semibold tracking-[-0.01em]">System status</h1>
          <p className="text-[13px] text-ink-3">What is running, when it last ran, and how old the offsite backup is.</p>
        </div>
        <Tone tone={healthy ? "ok" : "crit"}>
          <span className={cn("size-1.5 rounded-full", healthy ? "bg-ok" : "bg-crit")} /> {healthy ? "All systems normal" : "Attention needed"}
        </Tone>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Version" value={`v${APP_VERSION}`} sub={APP_ENV} mono />
        <Stat label="Offsite backup" value={backupAgeH === null ? "—" : `${Math.round(backupAgeH)}h ago`} sub={backup?.detail ?? ""} tone={backupAgeH !== null && backupAgeH > 26 ? "crit" : "ok"} />
        <Stat label="Database" value={stats.size} sub={`${stats.entries.toLocaleString()} entries · ${stats.imported.toLocaleString()} imported`} />
        <Stat label="Activity rows" value={stats.activity.toLocaleString()} sub="append-only" />
      </div>
      <section className="panel mt-6 overflow-hidden">
        <div className="px-4 py-3 hairline-b">
          <h2 className="text-[14px] font-semibold">Scheduled jobs</h2>
        </div>
        <table className="w-full text-[13px]">
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id} className="hairline-t align-top">
                <td className="px-4 py-3">
                  <span className={cn("mt-1.5 block size-2 rounded-full", j.lastStatus === "ok" ? "bg-ok" : j.lastStatus === "warning" ? "bg-warn" : j.lastStatus === "never" ? "bg-ink-4" : "bg-crit")} />
                </td>
                <td className="px-2 py-3">
                  <p className="font-mono text-[12.5px] font-medium">{j.name}</p>
                  <p className="text-[12px] text-ink-3">{j.description}</p>
                </td>
                <td className="px-4 py-3 text-ink-2">{j.schedule}</td>
                <td className="tnum px-4 py-3 text-ink-2">
                  <p>{j.lastRunAt ? relTime(j.lastRunAt) : "never"}</p>
                  <p className="text-[11.5px] text-ink-3">{j.lastDurationMs ? `${(j.lastDurationMs / 1000).toFixed(1)}s` : ""}</p>
                </td>
                <td className="px-4 py-3 text-[12.5px] text-ink-3">{j.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="panel mt-4 p-5">
        <h2 className="text-[14px] font-semibold">Data</h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-8 gap-y-2 text-[13px] md:grid-cols-3">
          {[
            ["Time entries", stats.entries],
            ["Imported from Harvest", stats.imported],
            ["Hours logged", Math.round(stats.hours)],
            ["Active people", stats.people],
            ["Projects & requests", stats.projects],
            ["Timesheets", stats.timesheets],
          ].map(([k, v]) => (
            <div key={k as string} className="flex justify-between">
              <dt className="text-ink-3">{k}</dt>
              <dd className="tnum font-medium">{(v as number).toLocaleString()}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
