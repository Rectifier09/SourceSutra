// Shared "full RFQ details" renderer for both the buyer and supplier RFQ
// detail pages. Neither page previously rendered rfq.spec at all, or several
// structured columns (required_certs, customization_needs, sample_*,
// pricing_approach) -- most of what the 5-step wizard actually collects was
// invisible on both sides. Grouped roughly by the wizard's own steps.
const sectionHead = "text-[12px] font-semibold uppercase tracking-[0.02em] text-primary2";
const dl = "grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3";
const dt = "text-[11px] font-semibold uppercase tracking-wide text-muted";
const dd = "mt-0.5 text-[14px] font-medium text-ink";

function fmtList(v: unknown): string {
  return Array.isArray(v) && v.length ? v.join(", ") : "—";
}
function fmtCerts(v: unknown): string {
  if (!Array.isArray(v) || v.length === 0) return "—";
  return v.map((c: { name?: string; priority?: string }) => `${c.name ?? "?"}${c.priority === "must" ? " (must-have)" : ""}`).join(", ");
}
function fmtQtyBreakdown(v: unknown): string {
  if (!Array.isArray(v) || v.length === 0) return "—";
  return v.map((r: { colour?: string; size?: string; qty?: string }) => `${r.colour ?? "-"} / ${r.size ?? "-"}: ${r.qty ?? "-"}`).join("; ");
}
function fmtDocs(v: unknown): string {
  if (!Array.isArray(v) || v.length === 0) return "—";
  return v.map((d: { fileName?: string; docType?: string }) => `${d.fileName ?? "file"} (${d.docType ?? "?"})`).join(", ");
}

export function Row({ items }: { items: [string, string][] }) {
  return (
    <dl className={dl}>
      {items.map(([k, v]) => (
        <div key={k}>
          <dt className={dt}>{k}</dt>
          <dd className={dd}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function RfqDetails({ rfq }: { rfq: Record<string, any> }) {
  const spec = (rfq.spec ?? {}) as Record<string, unknown>;

  return (
    <div className="mt-6 flex flex-col gap-6 rounded-[14px] border border-line bg-cream p-5">
      <div>
        <h3 className={sectionHead}>Product &amp; requirements</h3>
        <div className="mt-3">
          <Row
            items={[
              ["Product category", (spec.productCategory as string) || "—"],
              ["Contract type", rfq.contract_type ?? "—"],
              ["Manufacturing arrangement", (spec.manufacturingArrangement as string) || "—"],
              ["Primary material", (spec.primaryMaterial as string) || "—"],
              ["Fabric weight", (spec.fabricWeight as string) || "—"],
              ["Size range", fmtList(spec.sizeRange)],
              ["Colours", fmtList(spec.colours)],
              ["Target market", (spec.targetMarket as string) || "—"],
              ["Customization needs", fmtList(rfq.customization_needs)],
            ]}
          />
          {!!spec.additionalRequirements && (
            <p className="mt-3 text-[13.5px] text-ink">{spec.additionalRequirements as string}</p>
          )}
        </div>
      </div>

      <div>
        <h3 className={sectionHead}>Quantity, pricing &amp; samples</h3>
        <div className="mt-3">
          <Row
            items={[
              ["Quantity", rfq.quantity ? `${rfq.quantity} ${rfq.unit ?? ""}` : "—"],
              ["Quantity breakdown", fmtQtyBreakdown(spec.quantityBreakdown)],
              ["Pricing approach", rfq.pricing_approach ? String(rfq.pricing_approach).replace("_", " ") : "—"],
              ["Target price", rfq.target_price ? `${rfq.currency ?? "INR"} ${rfq.target_price}` : "—"],
              ["Bid window", rfq.bid_start && rfq.bid_end ? `${rfq.bid_start} → ${rfq.bid_end}` : "—"],
              ["Sample required", rfq.sample_required == null ? "—" : rfq.sample_required ? "Yes" : "No"],
              ...(rfq.sample_required
                ? ([
                    ["Sample type", rfq.sample_type ?? "—"],
                    ["Sample count", rfq.sample_count ?? "—"],
                    ["Sample deadline", rfq.sample_deadline ?? "—"],
                    ["Sample shipping paid by", rfq.sample_ship_paid_by ?? "—"],
                  ] as [string, string][])
                : []),
            ]}
          />
        </div>
      </div>

      <div>
        <h3 className={sectionHead}>Compliance &amp; preferences</h3>
        <div className="mt-3">
          <Row
            items={[
              ["Required certifications", fmtCerts(rfq.required_certs)],
              ["Preferred location", rfq.preferred_location ?? "Any"],
              ["Min. supplier experience", rfq.min_years_experience ? `${rfq.min_years_experience} yrs` : "—"],
              ["Audience", rfq.who_can_respond ? String(rfq.who_can_respond).replace("_", " ") : "open"],
            ]}
          />
          {!!spec.complianceNotes && <p className="mt-3 text-[13.5px] text-ink">{spec.complianceNotes as string}</p>}
        </div>
      </div>

      <div>
        <h3 className={sectionHead}>Logistics &amp; documents</h3>
        <div className="mt-3">
          <Row
            items={[
              ["Delivery by", rfq.delivery_date ?? "—"],
              ["Lead time", spec.leadTimeDays ? `${spec.leadTimeDays} days` : "—"],
              [
                "Delivery address",
                [spec.deliveryCity, spec.deliveryState, spec.deliveryPincode].filter(Boolean).join(", ") || "—",
              ],
              ["Shipping method", (spec.shippingMethod as string) || "—"],
              ["Incoterm", (spec.incoterm as string) || "—"],
              ["Payment terms", (spec.paymentTerms as string) || "—"],
              ["Reference documents", fmtDocs(spec.documents)],
            ]}
          />
          {!!spec.packagingNotes && <p className="mt-3 text-[13.5px] text-ink">{spec.packagingNotes as string}</p>}
        </div>
      </div>
    </div>
  );
}
