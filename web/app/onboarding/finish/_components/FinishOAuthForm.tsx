"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { finishOAuthSignup } from "../actions";

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
      {pending ? "Saving…" : "Continue"}
    </button>
  );
}

export function FinishOAuthForm({
  initialRole,
  email,
  initialFirstName,
  initialLastName,
}: {
  initialRole: "buyer" | "supplier";
  email: string;
  initialFirstName: string;
  initialLastName: string;
}) {
  const [role, setRole] = useState<"buyer" | "supplier">(initialRole);
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [company, setCompany] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [areaCode, setAreaCode] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);

  const isSupplier = role === "supplier";

  const requiredFilled = useMemo(
    () => !!(firstName && lastName && company && tags.length && areaCode && phone && consent),
    [firstName, lastName, company, tags, areaCode, phone, consent],
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

  return (
    <form action={finishOAuthSignup} className="flex flex-col gap-3.5">
      <input type="hidden" name="role" value={role} />
      <input type="hidden" name="first_name" value={firstName} />
      <input type="hidden" name="last_name" value={lastName} />
      <input type="hidden" name="products_sourced" value={tags.join(", ")} />

      <div className="text-[11.5px] font-semibold uppercase tracking-[0.03em] text-primary2">Account information</div>

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

      <label className="flex flex-col gap-1.5">
        <span className={labelText}>Email address</span>
        <input value={email} readOnly className={`${input} bg-panel`} />
      </label>

      <div className="mt-0.5 text-[11.5px] font-semibold uppercase tracking-[0.03em] text-primary2">Business information</div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className={labelText}>First name {req}</span>
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" className={input} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelText}>Last name {req}</span>
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" className={input} />
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
    </form>
  );
}
