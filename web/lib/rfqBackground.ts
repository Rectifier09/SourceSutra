// Shared banner background for every RFQ-related page (buyer + supplier):
// My RFQs, Create/edit RFQ, RFQ detail, Discover RFQs, Quotations, Invitations.
// Raw image, no tint on top — same treatment as every other page background
// (see lib/appBackground.ts).
import { APP_BG_CLASS } from "./appBackground";

export const RFQ_BANNER = "url('/img/rfq-bg.png')";
export const rfqBannerClass = APP_BG_CLASS;
