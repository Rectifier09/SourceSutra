import Link from "next/link";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/me";
import { Header } from "@/app/_components/Header";
import { CreateRfqForm } from "@/app/buyer/_components/CreateRfqForm";

export default async function NewRfq() {
  const me = await getMe();
  if (!me) redirect("/login");
  if (me.role !== "buyer") redirect("/supplier");

  return (
    <>
      <Header me={me} />
      <main className="mx-auto w-full max-w-[860px] flex-1 px-6 pb-20 pt-8">
        <Link href="/buyer" className="text-[14px] text-primary underline">
          ← My RFQs
        </Link>
        <h1 className="mt-3 font-display text-[28px] font-medium text-ink">New RFQ</h1>
        <p className="mb-6 mt-1 text-[14px] text-muted">Create a draft, then publish it to eligible suppliers.</p>
        <CreateRfqForm />
      </main>
    </>
  );
}
