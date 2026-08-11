"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";

type Props = {
  action: (formData: FormData) => void;
  fullName: string;
  email: string;
  orgName: string;
  location: string;
  phone: string;
  products: string[];
};

const label = "flex flex-col gap-1.5";
const labelText = "text-[13px] font-semibold text-muted";
const req = <span className="text-terra">*</span>;
const input =
  "rounded-lg border border-line bg-white px-3 py-2.5 text-[14.5px] text-ink placeholder:text-muted/60";

function SaveButton({ dirty }: { dirty: boolean }) {
  const { pending } = useFormStatus();
  return (
    <>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-primary px-5 py-3 text-[14.5px] font-semibold text-cream hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save changes"}
      </button>
      {dirty && !pending && <span className="text-[12.5px] text-muted">Unsaved changes</span>}
    </>
  );
}

export function BuyerProfileForm(props: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [products, setProducts] = useState<string[]>(props.products);
  const [draft, setDraft] = useState("");
  const [dirty, setDirty] = useState(false);
  const [passwordNote, setPasswordNote] = useState(false);

  const initials =
    props.fullName
      .split(" ")
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "VT";

  const addTag = () => {
    const v = draft.trim();
    if (!v || products.includes(v)) {
      setDraft("");
      return;
    }
    setProducts((p) => [...p, v]);
    setDraft("");
    setDirty(true);
  };
  const removeTag = (v: string) => {
    setProducts((p) => p.filter((t) => t !== v));
    setDirty(true);
  };
  const discard = () => {
    formRef.current?.reset();
    setProducts(props.products);
    setDraft("");
    setDirty(false);
    setPasswordNote(false);
  };

  return (
    <div className="mx-auto w-full max-w-[860px] flex-1 px-6 pb-20 pt-8">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center gap-4">
        <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-[16px] bg-lav1 font-display text-[22px] font-semibold text-primary">
          {initials}
        </div>
        <div>
          <h1 className="font-display text-[26px] font-medium text-ink">{props.fullName || "Your profile"}</h1>
          <p className="text-[13.5px] text-muted">
            {props.orgName} · {props.location || "—"}
          </p>
        </div>
        <span className="ml-auto whitespace-nowrap rounded-full bg-lav1 px-3 py-1.5 text-[11.5px] font-semibold text-primary">
          Customer (Buyer)
        </span>
      </div>

      <form
        ref={formRef}
        action={props.action}
        onChange={() => setDirty(true)}
        className="rounded-[16px] border border-line bg-cream px-6 py-7 sm:px-8"
      >
        <p className="mb-6 text-[12.5px] text-muted">
          Manage your account and business details. Fields marked with {req} are required.
        </p>

        <div className="flex flex-col gap-3.5">
          <div className="text-[11.5px] font-semibold uppercase tracking-[0.03em] text-primary2">
            Account information
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div className={label}>
              <span className={labelText}>Email address {req}</span>
              <div className="rounded-lg border border-line bg-panel px-3 py-2.5 text-[14px] text-ink">
                {props.email}
              </div>
            </div>
            <div className={label}>
              <span className={labelText}>Account type</span>
              <div className="rounded-lg border border-line bg-panel px-3 py-2.5 text-[14px] text-ink">
                Customer (Buyer)
              </div>
            </div>
          </div>

          <div>
            <span className={labelText}>Password</span>
            <div className="mt-1.5 flex flex-wrap items-center gap-3">
              <span className="font-mono text-[15px] tracking-[2px] text-muted">••••••••••</span>
              <button
                type="button"
                onClick={() => setPasswordNote(true)}
                className="rounded-[7px] border border-line bg-white px-3.5 py-2 text-[12.5px] text-primary hover:bg-panel"
              >
                Change password
              </button>
            </div>
            {passwordNote && (
              <div className="mt-2 rounded-[7px] border border-lav2 bg-lav1 px-2.5 py-2 text-[12px] text-muted">
                For security, passwords are changed via the &ldquo;Forgot password&rdquo; link on the sign-in
                page — not stored or edited here.
              </div>
            )}
          </div>

          <div className="mt-0.5 text-[11.5px] font-semibold uppercase tracking-[0.03em] text-primary2">
            Business information
          </div>

          <label className={label}>
            <span className={labelText}>Company name {req}</span>
            <input name="org_name" required defaultValue={props.orgName} placeholder="e.g. Vardhman Textiles" className={input} />
          </label>

          <label className={label}>
            <span className={labelText}>City / region</span>
            <input name="location" defaultValue={props.location} placeholder="e.g. Ludhiana, Punjab" className={input} />
          </label>

          <div>
            <span className={labelText}>Products you source {req}</span>
            <input type="hidden" name="products_sourced" value={products.join(", ")} />
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {products.map((t) => (
                <span
                  key={t}
                  className="flex items-center gap-1.5 rounded-full bg-lav1 px-2.5 py-1 text-[12px] text-primary"
                >
                  {t}
                  <button type="button" onClick={() => removeTag(t)} className="text-primary" aria-label={`Remove ${t}`}>
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="mt-1.5 flex gap-2">
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
                className={`flex-1 rounded-lg border border-line bg-white px-3 py-2.5 text-[14px] ${""}`}
              />
              <button
                type="button"
                onClick={addTag}
                className="whitespace-nowrap rounded-lg bg-primary px-3.5 py-2.5 text-[13px] text-cream hover:opacity-90"
              >
                Add
              </button>
            </div>
          </div>

          <label className={label}>
            <span className={labelText}>Phone number {req}</span>
            <input name="phone" defaultValue={props.phone} placeholder="Phone number" className={input} />
          </label>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2.5">
          <SaveButton dirty={dirty} />
          <button
            type="button"
            onClick={discard}
            className="rounded-lg border border-line px-4 py-3 text-[14px] text-muted hover:bg-panel"
          >
            Discard
          </button>
        </div>
      </form>
    </div>
  );
}
