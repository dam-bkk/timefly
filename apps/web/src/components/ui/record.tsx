import Link from "next/link";
import { cn } from "@/lib/utils";

export function PageHeader({ eyebrow, title, chips, actions, className }: { eyebrow?: React.ReactNode; title: string; chips?: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("shrink-0 px-6 pt-5 pb-4", className)}>
      {eyebrow && <div className="flex items-center gap-2 text-[12px] text-ink-3">{eyebrow}</div>}
      <div className="flex flex-wrap items-end gap-3">
        <h1 className="text-[20px] font-semibold leading-snug tracking-[-0.01em]" style={{ textWrap: "balance" }}>
          {title}
        </h1>
        {chips}
        {actions && <div className="ml-auto flex flex-wrap items-center gap-1.5">{actions}</div>}
      </div>
    </div>
  );
}

export function Prop({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] items-baseline gap-2 text-[13px]">
      <span className="text-ink-3">{label}</span>
      <span className="min-w-0 font-medium">{children}</span>
    </div>
  );
}

export function Block({ title, children, className, action, flush }: { title: string; children: React.ReactNode; className?: string; action?: React.ReactNode; flush?: boolean }) {
  return (
    <section className={cn("panel overflow-hidden", className)}>
      <div className="flex items-center justify-between px-4 py-2.5 hairline-b">
        <h2 className="text-[13px] font-semibold">{title}</h2>
        {action}
      </div>
      <div className={flush ? "" : "p-4"}>{children}</div>
    </section>
  );
}

export function RefLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={href} className={cn("font-medium text-accent-ink hover:underline", className)}>
      {children}
    </Link>
  );
}

export function Stat({ label, value, sub, tone, mono, href }: { label: string; value: string; sub?: string; tone?: "ok" | "warn" | "crit"; mono?: boolean; href?: string }) {
  const body = (
    <>
      <p className="label">{label}</p>
      <p className={cn("mt-2 text-[22px] font-semibold leading-none tracking-[-0.02em] tnum", mono && "font-mono", tone === "crit" && "text-crit", tone === "warn" && "text-warn", tone === "ok" && "text-ok")}>{value}</p>
      {sub && <p className="mt-1.5 truncate text-[11.5px] text-ink-3">{sub}</p>}
    </>
  );
  return href ? (
    <Link href={href} className="panel block p-4 transition-shadow hover:shadow-2">
      {body}
    </Link>
  ) : (
    <div className="panel p-4">{body}</div>
  );
}
