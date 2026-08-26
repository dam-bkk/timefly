import "server-only";
import { db, schema } from "@timefly/db";
import { asc, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { PERSONA_COOKIE, type Principal } from "./auth";

/** Data for the "View as" control: only admins get it; returns the people list and who is currently being viewed. */
export async function viewAsContext(me: Principal) {
  const realId = Number((await cookies()).get(PERSONA_COOKIE)?.value);
  const isAdmin = me.actor ? true : me.role === "admin";
  if (!isAdmin) return null;
  const people = await db
    .select({ id: schema.people.id, displayName: schema.people.displayName, role: schema.people.role, jobTitle: schema.people.jobTitle, department: schema.teams.name })
    .from(schema.people)
    .leftJoin(schema.teams, eq(schema.teams.id, schema.people.teamId))
    .where(eq(schema.people.status, "active"))
    .orderBy(asc(schema.people.displayName));
  return { people: people.filter((p) => p.id !== realId), viewing: me.actor ? { id: me.id, displayName: me.displayName, role: me.role } : null };
}
