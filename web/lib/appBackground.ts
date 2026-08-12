// The shared "page has a background image" treatment (matches buyer/suppliers'
// DiscoverClient, the original reference): a raw image, no tint/overlay on top
// of it, cover + fixed + centered. Any page without its own dedicated banner
// image falls back to DEFAULT_BG.
export const APP_BG_CLASS = "bg-cover bg-center bg-fixed";
export const DEFAULT_BG = "url('/img/discover-bg.png')";
