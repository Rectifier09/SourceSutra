import { redirect } from "next/navigation";
import { getMe } from "@/lib/me";
import { Intro } from "./_components/Intro";

// The one-time onboarding welcome animation (ports ScreenIntro). Shown right after a
// supplier signs up, before the onboarding dashboard.
export default async function SupplierWelcome() {
  const me = await getMe();
  if (!me) redirect("/login");
  if (me.role !== "supplier") redirect("/buyer");
  return <Intro />;
}
