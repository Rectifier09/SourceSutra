"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { signUp } from "@/app/register/actions";
import { createClient } from "@/lib/supabase/client";

const COUNTRIES = ["India", "United States", "United Kingdom", "United Arab Emirates", "Bangladesh", "Sri Lanka", "Other"];

const labelText = "text-[13px] font-semibold text-muted";
const req = <span className="text-terra">*</span>;
const input = "rounded-lg border border-line bg-white px-3 py-2.5 text-[14.5px] text-ink placeholder:text-muted/60";

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="mt-1 rounded-lg bg-primary px-5 py-3 text-[15px] font-semibold text-cream hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Creating account…" : "Create my account"}
    </button>
  );
}

export function RegisterForm({ initialRole }: { initialRole: "buyer" | "supplier" }) {
  const [role, setRole] = useState<"buyer" | "supplier">(initialRole);
  const [country, setCountry] = useState("India");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [company, setCompany] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [areaCode, setAreaCode] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);

  const pwMismatch = !!password && !!confirm && password !== confirm;
  const isSupplier = role === "supplier";

  const requiredFilled = useMemo(
    () =>
      !!(
        country &&
        email &&
        firstName &&
        lastName &&
        company &&
        tags.length &&
        areaCode &&
        phone &&
        consent &&
        password &&
        confirm &&
        password === confirm
      ),
    [country, email, firstName, lastName, company, tags, areaCode, phone, consent, password, confirm],
  );

  const addTag = () => {
    const v = draft.trim();
    if (!v || tags.includes(v)) {
      setDraft("");
      return;
    }
    setTags((t) => [...t, v]);
    setDraft("");
  };
  const continueWithGoogle = async () => {
    setGoogleError(null);
    setGoogleLoading(true);
    // Supabase's redirect-URL allow-list match failed whenever redirectTo carried a
    // query string (?role=...) — it doesn't match the allow-listed bare path, and
    // Supabase silently falls back to the first configured URL instead of erroring,
    // dropping the user on the homepage with an unconsumed auth code. redirectTo
    // must be the exact allow-listed URL with nothing appended; carry role via a
    // short-lived cookie instead, read by /auth/callback (a plain server route, so
    // cookies work — sessionStorage would not, since that's browser-only state a
    // server route can't see).
    document.cookie = `oauth_role=${role}; path=/; max-age=600; SameSite=Lax`;
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    // On success the browser navigates to Google — nothing left to do here.
    if (error) {
      setGoogleError(error.message);
      setGoogleLoading(false);
    }
  };

  return (
    <form action={signUp} className="flex flex-col gap-3.5">
      {/* hidden fields the server action reads */}
      <input type="hidden" name="role" value={role} />
      <input type="hidden" name="products_sourced" value={tags.join(", ")} />

      <h1 className="font-display text-[32px] font-medium text-ink">Create your account</h1>
      <p className="text-[12.5px] text-muted">Fields marked with {req} are required.</p>

      {/* Account type toggle */}
      <div className="flex w-full items-center gap-0.5 rounded-lg border border-line bg-panel p-0.5">
        {(["buyer", "supplier"] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRole(r)}
            className={`flex-1 rounded-md px-3 py-2 text-[13px] font-semibold transition-colors ${
              role === r ? "bg-primary text-cream" : "text-muted hover:text-primary"
            }`}
          >
            {r === "buyer" ? "Customer (Buyer)" : "Supplier (Vendor)"}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={continueWithGoogle}
        disabled={googleLoading}
        className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-line bg-white px-4 py-3 text-[14.5px] font-semibold text-ink hover:bg-panel disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="font-display text-[16px] text-primary">G</span> {googleLoading ? "Redirecting…" : "Continue with Google"}
      </button>
      {googleError && <div className="-mt-1 text-[12px] text-terra">{googleError}</div>}

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-line" />
        <span className="text-[12px] text-muted">or</span>
        <div className="h-px flex-1 bg-line" />
      </div>

      <div className="text-[11.5px] font-semibold uppercase tracking-[0.03em] text-primary2">Account information</div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className={labelText}>Country / region {req}</span>
          <select name="country" value={country} onChange={(e) => setCountry(e.target.value)} className={input}>
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-col gap-1.5">
          <span className={labelText}>Account type</span>
          <div className="rounded-lg border border-line bg-panel px-3 py-2.5 text-[14px] text-ink">
            {isSupplier ? "Supplier (Vendor)" : "Customer (Buyer)"}
          </div>
        </div>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className={labelText}>Email address {req}</span>
        <input
          type="email"
          name="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          className={input}
        />
      </label>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className={labelText}>Create password {req}</span>
          <input type="password" name="password" value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelText}>Confirm password {req}</span>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={`rounded-lg border bg-white px-3 py-2.5 text-[14.5px] text-ink ${pwMismatch ? "border-terra" : "border-line"}`}
          />
        </label>
      </div>
      {pwMismatch && <div className="-mt-1 text-[12px] text-terra">Passwords don&apos;t match.</div>}

      <div className="mt-0.5 text-[11.5px] font-semibold uppercase tracking-[0.03em] text-primary2">Business information</div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className={labelText}>First name {req}</span>
          <input name="first_name" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" className={input} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelText}>Last name {req}</span>
          <input name="last_name" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" className={input} />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className={labelText}>Company name {req}</span>
        <input name="company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. Vardhman Textiles" className={input} />
      </label>

      <div>
        <span className={labelText}>{isSupplier ? "Products you make" : "Products you're looking to source"} {req}</span>
        <div className="mb-1.5 mt-1.5 flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span key={t} className="flex items-center gap-1.5 rounded-full bg-lav1 px-2.5 py-1 text-[12px] text-primary">
              {t}
              <button type="button" onClick={() => setTags((x) => x.filter((y) => y !== t))} className="text-primary" aria-label={`Remove ${t}`}>
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
            placeholder="e.g. knit t-shirts, denim, trims"
            className="flex-1 rounded-lg border border-line bg-white px-3 py-2.5 text-[14px]"
          />
          <button type="button" onClick={addTag} className="whitespace-nowrap rounded-lg bg-primary px-3.5 py-2.5 text-[13px] text-cream hover:opacity-90">
            Add
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className={labelText}>Area code {req}</span>
          <input name="area_code" value={areaCode} onChange={(e) => setAreaCode(e.target.value)} placeholder="Area code" className={input} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelText}>Phone number {req}</span>
          <input name="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" className={input} />
        </label>
      </div>

      <label className="flex items-start gap-2 text-[12px] text-muted">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 cursor-pointer" />
        <span>
          I agree to the <span className="text-primary underline">Terms &amp; Conditions</span> and have read the{" "}
          <span className="text-primary underline">Privacy Policy</span>. {req}
        </span>
      </label>

      <SubmitButton disabled={!requiredFilled} />

      <p className="mt-1.5 text-center text-[12px] text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-primary underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
