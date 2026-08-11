import { redirect } from "next/navigation";
import { getMe } from "@/lib/me";
import { RegisterForm } from "./_components/RegisterForm";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const me = await getMe();
  if (me) redirect(me.role === "buyer" ? "/buyer" : "/supplier");

  const { role } = await searchParams;
  const initialRole = role === "supplier" ? "supplier" : "buyer";

  return (
    <main
      className="min-h-screen bg-cover bg-fixed bg-center"
      style={{ backgroundImage: "url('/img/register-bg.png')" }}
    >
      <div className="mx-auto flex max-w-[1080px] flex-col px-4 pb-16 pt-4">
        <div className="mb-5 font-display text-[21px] font-semibold text-primary">SourceSutra</div>
        <div className="flex justify-center">
          <div
            className="max-h-[92vh] w-full max-w-[680px] overflow-y-auto rounded-[16px] px-5 py-6 sm:px-8"
            style={{ background: "rgba(250,248,244,0.94)" }}
          >
            <RegisterForm initialRole={initialRole} />
          </div>
        </div>
      </div>
    </main>
  );
}
