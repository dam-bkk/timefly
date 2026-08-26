import { redirect } from "next/navigation";
import { getPrincipal } from "@/lib/auth";

export default async function Home() {
  const me = await getPrincipal();
  redirect(me ? "/time" : "/login");
}
