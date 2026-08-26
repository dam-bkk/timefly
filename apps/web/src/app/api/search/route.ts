import { db, schema } from "@timefly/db";
import { asc, eq, ilike, or, sql } from "drizzle-orm";
import { getPrincipal } from "@/lib/auth";

export async function GET(req: Request) {
  const me = await getPrincipal();
  if (!me) return Response.json({ projects: [], people: [] }, { status: 401 });
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) return Response.json({ projects: [], people: [] });
  const like = `%${q}%`;
  const projects = await db
    .select({ id: schema.projects.id, code: schema.projects.code, name: schema.projects.name, kind: schema.projects.kind, status: schema.projects.status })
    .from(schema.projects)
    .where(or(ilike(schema.projects.code, like), ilike(schema.projects.name, like), ilike(schema.projects.ticketRef, like)))
    .orderBy(sql`status = 'active' desc`, asc(schema.projects.code))
    .limit(8);
  const people =
    me.role === "member"
      ? []
      : await db
          .select({ id: schema.people.id, displayName: schema.people.displayName, jobTitle: schema.people.jobTitle, team: schema.teams.name })
          .from(schema.people)
          .leftJoin(schema.teams, eq(schema.teams.id, schema.people.teamId))
          .where(or(ilike(schema.people.displayName, like), ilike(schema.people.jobTitle, like), ilike(schema.people.email, like)))
          .orderBy(asc(schema.people.displayName))
          .limit(6);
  return Response.json({ projects, people });
}
