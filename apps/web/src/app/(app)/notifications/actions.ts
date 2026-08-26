"use server";

import { db, schema } from "@timefly/db";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requirePrincipal } from "@/lib/auth";

export async function markRead(id: number) {
  const me = await requirePrincipal();
  await db.update(schema.notifications).set({ readAt: new Date() }).where(and(eq(schema.notifications.id, id), eq(schema.notifications.personId, me.id)));
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}

export async function markAllRead() {
  const me = await requirePrincipal();
  await db.update(schema.notifications).set({ readAt: new Date() }).where(and(eq(schema.notifications.personId, me.id), isNull(schema.notifications.readAt)));
  revalidatePath("/notifications");
  revalidatePath("/", "layout");
}
