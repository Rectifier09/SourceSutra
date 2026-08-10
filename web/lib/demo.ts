// BP-1 seeded demo accounts (see supabase/seed.sql). No public signup yet — the
// login screen offers these personas. Shared password across all demo accounts.
export const DEMO_PASSWORD = "sourcesutra";

export type DemoPersona = {
  email: string;
  label: string;
  sublabel: string;
  role: "buyer" | "supplier";
};

export const DEMO_PERSONAS: DemoPersona[] = [
  {
    email: "priya.menon@vardhmantextiles.in",
    label: "Priya Menon",
    sublabel: "Buyer · Vardhman Textiles",
    role: "buyer",
  },
  {
    email: "suresh@anandknitfab.in",
    label: "Suresh Anand",
    sublabel: "Supplier · Anand Knitfab (verified)",
    role: "supplier",
  },
  {
    email: "anitha@tiruppurthreads.in",
    label: "Anitha Rao",
    sublabel: "Supplier · Tiruppur Threads (new — walk onboarding)",
    role: "supplier",
  },
];
