import { redirect } from "next/navigation";
import { getMe } from "@/lib/me";

export default async function Home() {
  const me = await getMe();
  if (!me) redirect("/login");
  redirect(me.role === "buyer" ? "/buyer" : "/supplier");
}
