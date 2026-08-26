import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db, schema } from "@timefly/db";
import { eq } from "drizzle-orm";

/**
 * Dev-mode identity: a persona cookie stands in for the Entra ID OIDC session.
 * Production swaps this for the openid-client session lookup; call sites do not change.
 */
export type Role = "member" | "manager" | "admin";
export type Principal = {
  id: number;
  displayName: string;
  email: string;
  role: Role;
  jobTitle: string | null;
  teamId: number | null;
  managerId: number | null;
  weeklyHours: number;
  /** Set when an admin is using "View as": the real signed-in admin. */
  actor?: { id: number; displayName: string };
};

export const PERSONA_COOKIE = "tl_persona";
export const VIEW_AS_COOKIE = "tl_view_as";
export const THEME_COOKIE = "tl_theme";

async function loadPerson(id: number) {
  const [p] = await db.select().from(schema.people).where(eq(schema.people.id, id)).limit(1);
  return p ?? null;
}

const base = (p: typeof schema.people.$inferSelect): Principal => ({ id: p.id, displayName: p.displayName, email: p.email, role: p.role, jobTitle: p.jobTitle, teamId: p.teamId, managerId: p.managerId, weeklyHours: p.weeklyHours });

/**
 * Identity for this request. "View as": an admin can render the app from any person's seat;
 * authorisation follows the viewed person, the activity log keeps the admin as the actor.
 */
export async function getPrincipal(): Promise<Principal | null> {
  const jar = await cookies();
  const id = Number(jar.get(PERSONA_COOKIE)?.value);
  if (!id) return null;
  const real = await loadPerson(id);
  if (!real) return null;
  const viewAs = Number(jar.get(VIEW_AS_COOKIE)?.value);
  if (viewAs && viewAs !== real.id && real.role === "admin") {
    const target = await loadPerson(viewAs);
    if (target) return { ...base(target), actor: { id: real.id, displayName: real.displayName } };
  }
  return base(real);
}

export async function requirePrincipal(): Promise<Principal> {
  const p = await getPrincipal();
  if (!p) redirect("/login");
  return p;
}

export async function requireManager(): Promise<Principal> {
  const p = await requirePrincipal();
  if (p.role === "member") redirect("/time");
  return p;
}

export async function requireAdmin(): Promise<Principal> {
  const p = await requirePrincipal();
  if (p.role !== "admin") redirect("/time");
  return p;
}

export function isManager(p: Principal): boolean {
  return p.role === "manager" || p.role === "admin";
}

/** Can `me` see / act on `target`'s timesheets? Self, admin, or the person's manager (direct or team lead). */
export function canSee(me: Principal, target: { id: number; managerId: number | null; teamId: number | null }): boolean {
  if (me.id === target.id || me.role === "admin") return true;
  if (me.role === "manager") return target.managerId === me.id || (me.teamId !== null && target.teamId === me.teamId);
  return false;
}

export async function requestMeta(): Promise<{ ip: string | null; userAgent: string | null; requestId: string }> {
  const h = await headers();
  return {
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "127.0.0.1",
    userAgent: h.get("user-agent"),
    requestId: `req_${Math.random().toString(36).slice(2, 10)}`,
  };
}

export const APP_VERSION = process.env.APP_VERSION ?? "0.1.0";
export const APP_ENV = process.env.APP_ENV ?? "dev";
export const APP_TZ = process.env.APP_TZ ?? "Asia/Kuala_Lumpur";

/** Today's civil date in the organisation's timezone (timesheets are civil dates, not instants). */
export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
