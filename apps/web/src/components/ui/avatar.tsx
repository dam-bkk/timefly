import { cn, hueFor, initials } from "@/lib/utils";

export function Avatar({ name, size = 24, className, muted }: { name: string; size?: number; className?: string; muted?: boolean }) {
  const h = hueFor(name);
  const style = muted
    ? { background: "var(--surface-3)", color: "var(--ink-3)" }
    : { background: `oklch(0.93 0.045 ${h})`, color: `oklch(0.38 0.11 ${h})` };
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 select-none items-center justify-center rounded-full font-medium dark:brightness-[0.92]", className)}
      style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.4)), letterSpacing: "0.01em", ...style }}
    >
      {initials(name)}
    </span>
  );
}

export function AvatarStack({ names, size = 20 }: { names: string[]; size?: number }) {
  return (
    <span className="inline-flex -space-x-1.5">
      {names.slice(0, 4).map((n) => (
        <Avatar key={n} name={n} size={size} className="ring-2 ring-surface" />
      ))}
      {names.length > 4 && (
        <span className="inline-flex items-center justify-center rounded-full bg-surface-3 text-[10px] text-ink-2 ring-2 ring-surface" style={{ width: size, height: size }}>
          +{names.length - 4}
        </span>
      )}
    </span>
  );
}
