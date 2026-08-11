// Plain (non-"use client") module so a Server Component can call
// mapRfqToWizardState directly — a Server Component can't invoke a function
// exported from a "use client" file (Next.js throws at request time, not
// build time, so this only surfaces when a draft is actually opened).

export type Cert = { category: string; name: string; priority: "must" | "nice" };
export type QtyRow = { colour: string; size: string; qty: string };
export type Doc = { fileName: string; docType: string };

export type WizardState = {
  // step 1
  title: string;
  productCategory: string;
  contractType: string;
  manufacturingArrangement: string;
  customizationNeeds: string[];
  primaryMaterial: string;
  fabricWeight: string;
  sizeRange: string[];
  colours: string[];
  targetMarket: string;
  additionalRequirements: string;
  // step 2
  quantity: string;
  unit: string;
  breakdownEnabled: boolean;
  quantityBreakdown: QtyRow[];
  pricingApproach: "target" | "quote" | "negotiable" | "";
  currency: string;
  targetPrice: string;
  bidStart: string;
  bidEnd: string;
  sampleRequired: boolean | null;
  sampleType: string;
  sampleCount: string;
  sampleDeadline: string;
  sampleShipPaidBy: string;
  // step 3
  requiredCerts: Cert[];
  complianceNotes: string;
  minYearsExperience: string;
  preferredLocation: string;
  whoCanRespond: "open" | "verified_only" | "invite";
  inviteOrgIds: string[];
  // step 4
  deliveryDate: string;
  leadTimeDays: string;
  deliveryCity: string;
  deliveryState: string;
  deliveryPincode: string;
  shippingMethod: string;
  incoterm: string;
  paymentTerms: string;
  packagingNotes: string;
  documents: Doc[];
};

export const emptyState: WizardState = {
  title: "", productCategory: "", contractType: "", manufacturingArrangement: "",
  customizationNeeds: [], primaryMaterial: "", fabricWeight: "", sizeRange: [], colours: [],
  targetMarket: "", additionalRequirements: "",
  quantity: "", unit: "Pieces", breakdownEnabled: false, quantityBreakdown: [],
  pricingApproach: "", currency: "INR", targetPrice: "", bidStart: "", bidEnd: "",
  sampleRequired: null, sampleType: "", sampleCount: "", sampleDeadline: "", sampleShipPaidBy: "",
  requiredCerts: [], complianceNotes: "", minYearsExperience: "", preferredLocation: "",
  whoCanRespond: "open", inviteOrgIds: [],
  deliveryDate: "", leadTimeDays: "", deliveryCity: "", deliveryState: "", deliveryPincode: "",
  shippingMethod: "", incoterm: "", paymentTerms: "", packagingNotes: "", documents: [],
};

// Inverse of CreateRfqWizard's payload() — resumes a saved draft into wizard
// state. Note: invitations for an invite-only draft are never persisted until
// publish (see saveRfqDraft/publishRfqWizard in actions.ts), so inviteOrgIds
// can't be recovered here — the buyer re-picks them if resuming an
// invite-only draft.
export function mapRfqToWizardState(rfq: Record<string, unknown>): Partial<WizardState> {
  const spec = (rfq.spec ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (v == null ? "" : String(v));
  const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  return {
    title: str(rfq.title),
    productCategory: str(spec.productCategory),
    contractType: str(rfq.contract_type),
    manufacturingArrangement: str(spec.manufacturingArrangement),
    customizationNeeds: arr<string>(rfq.customization_needs),
    primaryMaterial: str(spec.primaryMaterial),
    fabricWeight: str(spec.fabricWeight),
    sizeRange: arr<string>(spec.sizeRange),
    colours: arr<string>(spec.colours),
    targetMarket: str(spec.targetMarket),
    additionalRequirements: str(spec.additionalRequirements),
    quantity: str(rfq.quantity),
    unit: str(rfq.unit) || "Pieces",
    breakdownEnabled: arr(spec.quantityBreakdown).length > 0,
    quantityBreakdown: arr<QtyRow>(spec.quantityBreakdown),
    pricingApproach: (str(rfq.pricing_approach) || "") as WizardState["pricingApproach"],
    currency: str(rfq.currency) || "INR",
    targetPrice: str(rfq.target_price),
    bidStart: str(rfq.bid_start),
    bidEnd: str(rfq.bid_end),
    sampleRequired: typeof rfq.sample_required === "boolean" ? rfq.sample_required : null,
    sampleType: str(rfq.sample_type),
    sampleCount: str(rfq.sample_count),
    sampleDeadline: str(rfq.sample_deadline),
    sampleShipPaidBy: str(rfq.sample_ship_paid_by),
    requiredCerts: arr<Cert>(rfq.required_certs),
    complianceNotes: str(spec.complianceNotes),
    minYearsExperience: str(rfq.min_years_experience),
    preferredLocation: str(rfq.preferred_location),
    whoCanRespond: (str(rfq.who_can_respond) || "open") as WizardState["whoCanRespond"],
    inviteOrgIds: [],
    deliveryDate: str(rfq.delivery_date),
    leadTimeDays: str(spec.leadTimeDays),
    deliveryCity: str(spec.deliveryCity),
    deliveryState: str(spec.deliveryState),
    deliveryPincode: str(spec.deliveryPincode),
    shippingMethod: str(spec.shippingMethod),
    incoterm: str(spec.incoterm),
    paymentTerms: str(spec.paymentTerms),
    packagingNotes: str(spec.packagingNotes),
    documents: arr<Doc>(spec.documents),
  };
}
