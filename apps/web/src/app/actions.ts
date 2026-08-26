"use server";

import { db, schema } from "@timefly/db";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getPrincipal, PERSONA_COOKIE, THEME_COOKIE, VIEW_AS_COOKIE } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

export async function setTheme(theme: "light" | "dark") {
  (await cookies()).set(THEME_COOKIE, theme, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}

export async function signInAs(personId: number) {
  const [p] = await db.select().from(schema.people).where(eq(schema.people.id, personId)).limit(1);
  if (!p) redirect("/login");
  const jar = await cookies();
  jar.set(PERSONA_COOKIE, String(personId), { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 7 });
  jar.delete(VIEW_AS_COOKIE);
  await logActivity({ id: p.id, displayName: p.displayName, email: p.email, role: p.role, jobTitle: p.jobTitle, teamId: p.teamId, managerId: p.managerId, weeklyHours: p.weeklyHours }, { action: "auth.login", category: "auth", targetType: "person", targetId: p.id });
  redirect(p.role === "member" ? "/time" : "/team");
}

export async function signOut() {
  const p = await getPrincipal();
  if (p) await logActivity(p, { action: "auth.logout", category: "auth", targetType: "person", targetId: p.id });
  const jar = await cookies();
  jar.delete(PERSONA_COOKIE);
  jar.delete(VIEW_AS_COOKIE);
  redirect("/login");
}

/** "View as" — admins only. Persists until Exit; every page follows the viewed person's role. */
export async function setViewAs(personId: number | null) {
  const jar = await cookies();
  const realId = Number(jar.get(PERSONA_COOKIE)?.value);
  const [real] = realId ? await db.select({ role: schema.people.role, displayName: schema.people.displayName }).from(schema.people).where(eq(schema.people.id, realId)).limit(1) : [];
  if (!real || real.role !== "admin") return;
  if (!personId) {
    jar.delete(VIEW_AS_COOKIE);
    redirect("/team");
  }
  const [target] = await db.select({ id: schema.people.id, role: schema.people.role, displayName: schema.people.displayName }).from(schema.people).where(eq(schema.people.id, personId)).limit(1);
  if (!target) return;
  jar.set(VIEW_AS_COOKIE, String(personId), { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 8 });
  await logActivity({ id: realId, displayName: real.displayName, email: "", role: "admin", jobTitle: null, teamId: null, managerId: null, weeklyHours: 40 }, { action: "auth.view_as", category: "auth", targetType: "person", targetId: personId, after: { as: target.displayName, role: target.role } });
  redirect(target.role === "member" ? "/time" : "/team");
}
