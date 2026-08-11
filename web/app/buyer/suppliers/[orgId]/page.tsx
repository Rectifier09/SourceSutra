import { redirect } from "next/navigation";
import { getMe } from "@/lib/me";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/app/_components/Header";
import {
  SupplierProfileView,
  type CertCard,
  type CertGroup,
  type ProfileData,
} from "./_components/SupplierProfileView";

// Category display order — ported from the prototype (CustomerSupplierProfile).
const CERT_CATEGORIES_ORDER = [
  "Quality Management",
  "Environmental Management",
  "Health & Safety",
  "Social Compliance",
  "Sustainable & Organic Textiles",
  "Recycled Materials",
  "Chemical & Product Safety",
  "Responsible Materials",
  "Indian Regulatory & Legal Compliance",
  "Buyer / Brand Audits",
  "Other",
];

const AUDIT_OUTCOME_LABEL: Record<string, string> = {
  passed: "Passed",
  passed_with_corrective: "Passed with corrective actions",
  failed: "Failed",
  pending: "Pending",
};

function initials(name: string, max = 2): string {
  return name
    .split(" ")
    .slice(0, max)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

// Row from the certifications table (0004 + 0008 columns).
type CertRow = {
  id: string;
  kind: string;
  category: string;
  name: string | null;
  issuer: string | null;
  number: string | null;
  scope: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  does_not_expire: boolean;
  field_status: string;
  audit_outcome: string | null;
  verification_url: string | null;
  audit_buyer: string | null;
  audit_type: string | null;
  audit_date: string | null;
};

// Replicates the prototype's badge + grouping logic against DB rows.
function shapeCerts(rows: CertRow[]): {
  groups: CertGroup[];
  summary: ProfileData["certSummary"];
} {
  const today = new Date();
  const DAY = 86_400_000;

  const computed = rows.map((c): CertCard & { category: string; expired: boolean } => {
    const isAudit = c.kind === "audit" || c.category === "Buyer / Brand Audits";
    if (isAudit) {
      const outcome = AUDIT_OUTCOME_LABEL[c.audit_outcome ?? "pending"] ?? "Pending";
      const badge =
        outcome === "Passed"
          ? { label: outcome, bg: "#EFF3EE", fg: "#5B7A5B" }
          : outcome === "Failed"
            ? { label: outcome, bg: "#F7ECE8", fg: "#B5654A" }
            : { label: outcome, bg: "#F2EEE6", fg: "#6B6A78" };
      return {
        key: c.id,
        category: c.category,
        isAudit: true,
        badge,
        opacity: 1,
        expired: false,
        buyerName: c.audit_buyer ?? "—",
        auditType: c.audit_type ?? "",
        auditDate: c.audit_date ?? "",
      };
    }

    const expired = !c.does_not_expire && !!c.expiry_date && new Date(c.expiry_date) < today;
    const isRegulatory = c.category === "Indian Regulatory & Legal Compliance";
    let badge: CertCard["badge"];
    if (expired) badge = { label: "Expired", bg: "#F7ECE8", fg: "#B5654A" };
    else if (isRegulatory)
      badge =
        c.field_status === "verified"
          ? { label: "Registered", bg: "#EFF3EE", fg: "#5B7A5B" }
          : { label: "Claimed", bg: "#EDECF6", fg: "#403A77" };
    else if (c.field_status === "verified") badge = { label: "Certified", bg: "#EFF3EE", fg: "#5B7A5B" };
    else badge = { label: "Claimed", bg: "#EDECF6", fg: "#403A77" };

    const validityLabel = c.does_not_expire
      ? "Does not expire"
      : c.issue_date && c.expiry_date
        ? `${c.issue_date} – ${c.expiry_date}`
        : "—";

    return {
      key: c.id,
      category: c.category,
      isAudit: false,
      badge,
      opacity: expired ? 0.65 : 1,
      expired,
      name: c.name ?? "—",
      issuingBody: c.issuer ?? "—",
      certNumber: c.number ?? "—",
      scope: c.scope ?? "",
      validityLabel,
      verificationUrl: c.verification_url,
    };
  });

  const groups: CertGroup[] = CERT_CATEGORIES_ORDER.map((category) => ({
    category,
    records: computed.filter((c) => c.category === category),
  })).filter((g) => g.records.length > 0);

  const verified = computed.filter(
    (c) => !c.isAudit && (c.badge.label === "Certified" || c.badge.label === "Registered"),
  ).length;
  const expiringSoon = rows.filter((c) => {
    if (c.kind === "audit" || c.does_not_expire || !c.expiry_date) return false;
    const days = (new Date(c.expiry_date).getTime() - today.getTime()) / DAY;
    return days >= 0 && days <= 60;
  }).length;
  const expired = computed.filter((c) => c.expired).length;

  return {
    groups,
    summary: {
      total: computed.length,
      verified,
      expiringSoon,
      expired,
      categoriesCovered: new Set(computed.map((c) => c.category)).size,
      categoriesTotal: CERT_CATEGORIES_ORDER.length,
    },
  };
}

export default async function SupplierProfile({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const me = await getMe();
  if (!me) redirect("/login");
  if (me.role !== "buyer") redirect("/supplier");

  const supabase = await createClient();

  // v_supplier_directory = verified suppliers only. If the org isn't in it, the
  // profile isn't buyer-visible — bounce back to discover.
  const { data: dir } = await supabase
    .from("v_supplier_directory")
    .select("org_id, name, location, mission, company_type, logo_bg, logo_fg")
    .eq("org_id", orgId)
    .maybeSingle();
  if (!dir) redirect("/buyer/suppliers");

  const [{ data: prof }, { data: certs }] = await Promise.all([
    supabase
      .from("supplier_profiles")
      .select("production, trade_terms, customization_capabilities, products, facility_photos, work_history, contact")
      .eq("org_id", orgId)
      .maybeSingle(),
    supabase.from("certifications").select("*").eq("org_id", orgId),
  ]);

  const prod = (prof?.production ?? {}) as Record<string, unknown>;
  const trade = (prof?.trade_terms ?? {}) as Record<string, unknown>;
  const contact = (prof?.contact ?? {}) as Record<string, string>;
  const dash = (v: unknown) => (v === undefined || v === null || v === "" ? "—" : String(v));

  const { groups, summary } = shapeCerts((certs ?? []) as CertRow[]);

  const data: ProfileData = {
    orgId,
    name: dir.name,
    mission: dir.mission,
    companyType: dir.company_type,
    location: dir.location,
    logoBg: dir.logo_bg ?? "#EDECF6",
    logoFg: dir.logo_fg ?? "#403A77",
    initials: initials(dir.name),
    production: {
      factoryArea: dash(prod.factoryArea),
      employees: dash(prod.employees),
      monthlyCapacity: dash(prod.monthlyCapacity),
      productionLines: dash(prod.productionLines),
    },
    trade: {
      moq: dash(trade.moq),
      incoterms: dash(trade.incoterms),
      paymentTerms: dash(trade.paymentTerms),
      leadTime: dash(trade.leadTime),
    },
    customization: (prof?.customization_capabilities ?? []) as string[],
    products: (prof?.products ?? []) as ProfileData["products"],
    facilityCount: ((prof?.facility_photos ?? []) as unknown[]).length,
    certGroups: groups,
    certSummary: summary,
    hasCerts: summary.total > 0,
    workHistory: ((prof?.work_history ?? []) as { start: string; end: string }[]).map((w) => ({
      ...(w as object),
      years: `${w.start}–${w.end}`,
    })) as ProfileData["workHistory"],
    contact: {
      name: dash(contact.name),
      title: dash(contact.title),
      email: dash(contact.email),
      phone: dash(contact.phone),
      languages: dash(contact.languages),
      responseTime: dash(contact.responseTime),
      initials: contact.name ? initials(contact.name) : "",
    },
  };

  return (
    <>
      <Header me={me} />
      <SupplierProfileView data={data} />
    </>
  );
}
