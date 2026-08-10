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
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        <Link href="/buyer" className="text-sm text-black/50 hover:underline dark:text-white/50">
          ← My RFQs
        </Link>
        <h2 className="mt-2 text-xl font-semibold tracking-tight">New RFQ</h2>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Create a draft, then publish it to eligible suppliers.
        </p>
        <div className="mt-6">
          <CreateRfqForm />
        </div>
      </main>
    </>
  );
}
