/**
 * Generates printable A4 posters for a merchant deal. Opens a fresh popup
 * window with a self-contained HTML document, then auto-triggers the print
 * dialog. The merchant picks the template from a picker UI before this is
 * called.
 *
 * Why a new window: we need the full page area for the poster (the deal
 * detail modal is mobile-shaped, so window.print() on it would crop awkwardly)
 * and we want our @page rules to apply without fighting the host app's CSS.
 */

import type { Deal } from '../types';
import { Capacitor } from '@capacitor/core';

export type PosterTemplate = 'bold_promo' | 'discount_splash' | 'classic_frame' | 'side_by_side';

export interface PosterMeta {
  id: PosterTemplate;
  label: string;
  description: string;
}

export const POSTER_TEMPLATES: PosterMeta[] = [
  { id: 'bold_promo',      label: 'Bold Promo',      description: 'Big photo on top, large offer below — eye-catching from across the store.' },
  { id: 'discount_splash', label: 'Discount Splash', description: 'Photo with a bold discount burst overlay — perfect for steep-discount deals.' },
  { id: 'classic_frame',   label: 'Classic Frame',   description: 'Framed photo with elegant typography — refined, premium look.' },
  { id: 'side_by_side',    label: 'Side by Side',    description: 'Photo on the left, deal details on the right — magazine-style layout.' },
];

const escapeHtml = (s: unknown): string => {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

/**
 * Best-effort upgrade to a higher-resolution Cloudinary URL. Replaces any
 * existing `w_<n>` / `q_<n>` transformations with width=1600 + q_auto:best,
 * and inserts them if no transformations exist. No-op for non-Cloudinary URLs.
 */
const upscaleImage = (url: string | undefined): string => {
  if (!url) return '';
  if (!url.includes('cloudinary')) return url;
  // Look for /upload/<transforms>/<rest>
  return url.replace(/\/upload\/(?:[^/]*\/)?/, '/upload/w_1600,q_auto:best,f_auto/');
};

const formatDate = (dateStr?: string): string => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr + 'T00:00:00Z');
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  } catch {
    return dateStr;
  }
};

const plainText = (html?: string): string => {
  if (!html) return '';
  return html
    // Turn line-break markup into real newlines BEFORE stripping tags, so the
    // line breaks the merchant typed survive into the printed poster.
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li|h[1-6]|ul|ol)\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/[^\S\n]+/g, ' ')            // collapse spaces/tabs, keep newlines
    .replace(/[^\S\n]*\n[^\S\n]*/g, '\n') // trim spaces around newlines
    .replace(/\n{3,}/g, '\n\n')           // cap consecutive blank lines
    .trim();
};

/** Truncate at the nearest word boundary so the poster never ends mid-word. */
const truncateAtWord = (s: string, max: number): string => {
  if (!s || s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  const safe = (lastSpace > max - 30 ? cut.slice(0, lastSpace) : cut).replace(/[,;:.\-—\s]+$/, '');
  return safe + '…';
};

/**
 * Pull the merchant-relevant fields out of a Deal, with safe fallbacks.
 * The Deal object's exact shape varies (server response vs editor draft),
 * so this normalizes the few fields the poster needs.
 */
const extract = (deal: Deal) => {
  const d: any = deal;
  const coverImage = upscaleImage(d.image_url || d.thumbnail || (d.media_urls && d.media_urls[0]) || '');
  const heading = d.localized_heading?.en || d.deal_heading || d.details || '';
  const offer = (d.localized_offer?.en || d.offerValue || d.offer_value || '').trim();
  const description = plainText(d.longDescription || d.long_description || '');
  const overlay0 = d.image_price_overlays?.['0'] || {};

  // Pull a numeric % out of the offer text so the Discount Splash burst can
  // show a punchy "30%" / "OFF" pair instead of cramming "30% OFF all items"
  // into a 70mm circle. The leftover words become the burst's subtitle.
  let burstPct = '';
  let burstRest = '';
  if (overlay0.discountPct) {
    burstPct = String(overlay0.discountPct);
    burstRest = 'OFF';
  } else {
    const m = offer.match(/(\d{1,3})\s*%/);
    if (m) {
      burstPct = m[1];
      // Everything that isn't the percentage — usually "OFF all items" or similar.
      burstRest = offer.replace(/\d{1,3}\s*%\s*/, '').trim() || 'OFF';
    } else {
      burstPct = '';
      burstRest = offer;
    }
  }

  return {
    coverImage,
    heading,
    offer,
    description,
    shopName: d.shopName || d.shop_name || d.storeName || '',
    address: d.address || d.location || '',
    landmark: d.landmark || '',
    phone: d.storePhone || d.store_phone || '',
    phoneAlt: d.storePhoneAlt || d.store_phone_alt || '',
    storeHrs: d.storeHrs || d.store_hrs || '',
    startDate: d.start_date || '',
    endDate: d.end_date || '',
    discountCode: d.discountCode || d.discount_code || '',
    category: d.category || '',
    isDotd: !!d.is_deal_of_the_day,
    discountPct: overlay0.discountPct || burstPct || '',
    offerPrice: overlay0.offerPrice || '',
    burstPct,
    burstRest,
  };
};

/**
 * Sreshta logo (inlined SVG). Inlining lets the popup window render the brand
 * mark instantly without a network fetch — important because the print dialog
 * fires as soon as images load, and an external <img> from /assets/logo.svg
 * would either flash blank or block the print trigger.
 */
const DEALPRO_LOGO_SVG = `<svg version="1.1" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
<path transform="translate(485,215)" d="m0 0h50l16 3 13 4 15 8 16 13 9 10 7 11 8 16 6 19 2 12h110l5 4 2 5v18l12 2 4 2 2 6 3 52 3 36 2 29 3 49 3 46 3 37 4 65 1 8 4 73v21l-6 12-7 6-8 3h-508l-9-4-8-7-4-7-1-6 1-32 2-43 10-165 3-49 3-63 3-41 1-23 4-5 14-2 1-21 3-5 3-1h107l2-11 5-17 7-16 6-10 7-7 7-8 8-7 15-9 13-6 14-4z" fill="#FACA1B"/>
<path transform="translate(511,234)" d="m0 0 8 1 16 8 9 7v2l4 2 7 8 11 21 6 16 2 7v5h-126l1-9 5-16 11-21 8-10 10-8 14-8 11-4z" fill="#FFFFFF"/>
<path transform="translate(408,318)" d="m0 0h170l3 17 1 6-4 1-172-1v-11z" fill="#DF8F08"/>
<path transform="translate(327,456)" d="m0 0h19l9 4 7 6 4 8 1 4v23l-4 11-6 8-8 5-8 2h-8l-9-2-9-6-6-7-4-12v-18l4-12 9-10z" fill="#090908"/>
<path transform="translate(401,528)" d="m0 0h12l9 3 8 8 4 9 1 4v19l-4 13-6 8-6 5-8 3h-12l-9-3-7-7-4-9-1-6v-17l3-12 6-10 6-5z" fill="#090908"/>
<path transform="translate(405,457)" d="m0 0h20l-2 6-19 32-8 13-18 30-32 54-4 6h-21l2-5 14-24 8-13 17-28 13-22 11-18 17-29z" fill="#090908"/>
<path transform="translate(594,318)" d="m0 0h129l3 2-8 5-16 8-9 5 50 1 4 2h-150l-3-21z" fill="#DF8F08"/>
<path transform="translate(295,318)" d="m0 0h96l-1 22-1 1h-114v-1l5-1 47-1-3-3-17-9-12-6z" fill="#DF8F08"/>
<path transform="translate(475,525)" d="m0 0h8l2 1v70l-1 1h-9l-1-3-6 3h-9l-6-5-3-7-1-6v-11l3-12 5-6 4-2h7l5 2v-21z" fill="#090908"/>
<path transform="translate(587,549)" d="m0 0h13l8 6 4 9v17l-4 10-6 5-10 2-9-3-5-6-2-5-1-7v-8l2-9 5-8z" fill="#090908"/>
<path transform="translate(465,237)" d="m0 0 2 1-10 10-9 12-8 16-7 21-2 12-1 2h-20l1-6 3-12 7-17 8-12 7-8 11-9 13-8z" fill="#090908"/>
<path transform="translate(619,549)" d="m0 0h10l1 1 1 34 1 2 7-1 2-5 1-31h10l1 1v46l-1 1h-10v-4l-6 4-7 1-5-2-4-5-1-3z" fill="#090908"/>
<path transform="translate(682,548)" d="m0 0 7 2 4 5 1 5v36h-11l-1-32-1-3-6-1-3 3-1 34h-10l-1-1v-46l1-1h9v4h3v-2z" fill="#090908"/>
<path transform="translate(558,240)" d="m0 0 9 3 9 7 6 5 9 11 4 5 8 16 6 17 1 7h-17l-4-15-5-13-9-20-6-8-11-13z" fill="#090908"/>
<path transform="translate(582,370)" d="m0 0h2v13l-1 2v8l1 4 9 3 8-2 3-4v-8l-3-4v-12l4 1 7 6 3 6v13l-5 8-6 5-6 2h-9l-8-3-7-7-3-8v-7l3-8 4-5z" fill="#090908"/>
<path transform="translate(714,532)" d="m0 0h1v17h8v10h-8l1 25 1 2 6 1v9l-2 1h-12l-4-4-1-3v-30l-6-1v-10h6v-12z" fill="#090908"/>
<path transform="translate(405,370)" d="m0 0 5 2 5 5 3 4 1 3v12l-4 7-7 6-5 2h-10l-7-3-6-5-4-8v-11l3-6 7-7h3v12l-2 4 1 7 5 5 2 1h6l6-4 1-2v-7l-3-8z" fill="#090908"/>
<path transform="translate(523,548)" d="m0 0 10 1 4 2v8l-3 1-5-2h-6v5l12 9 4 6v10l-4 6-6 3-8 1-9-3v-9h3l5 2 7-1-1-7-10-7-4-5-1-8 3-7 5-4z" fill="#090908"/>
<path transform="translate(556,549)" d="m0 0h12l4 2-2 9h-9l-3 1-1 5v16l3 4 6 1 5-1v9l-3 2-6 1-9-2-5-5-3-6-1-5v-13l3-9 4-6z" fill="#090908"/>
<path transform="translate(334,472)" d="m0 0 8 1 5 5 1 3v17l-3 8-4 3h-8l-5-4-3-7v-15l4-8z" fill="#F8C61A"/>
<path transform="translate(405,545)" d="m0 0 6 1 4 4 2 6v13l-3 9-4 4-5 1-6-3-3-7v-18l3-6 3-3z" fill="#F8C61A"/>
<path transform="translate(494,549)" d="m0 0h10l1 1v46h-12v-46z" fill="#090908"/>
<path transform="translate(600,369)" d="m0 0 2 1v12l3 4v8l-4 5-8 2-7-3-3-3-1-2v-8l3-3h3l1-2 6-2 1-3 3-1z" fill="#F8C61A"/>
<path transform="translate(405,379)" d="m0 0 4 8v7l-4 5-4 2h-6l-6-4-3-6 1-6 1-2h9l3-3 5 2z" fill="#F7C219"/>
<path transform="translate(590,559)" d="m0 0h6l3 3 1 2v17l-3 6-5 1-5-6v-19z" fill="#F9C61A"/>
<path transform="translate(466,558)" d="m0 0 6 2 2 5v16l-3 5-1 1-7-1-2-3v-19l3-5z" fill="#F8C51A"/>
<path transform="translate(600,369)" d="m0 0 2 1v13l-3 8-2 1h-8l-3-3v-7h2l1-2 6-2 1-3 3-1z" fill="#DF8F08"/>
<path transform="translate(497,529)" d="m0 0 6 1 3 4-1 7-2 2h-7l-3-3-1-5 3-5z" fill="#090908"/>
<path transform="translate(615,297)" d="m0 0 1 2 4 1v2l3-1 2 5v5h-14l-1-9 1 2h2z" fill="#DF8F08"/>
<path transform="translate(400,380)" d="m0 0 5 2v7l-3 3-6 1-6-3v-7h7z" fill="#DF8F08"/>
<path transform="translate(447,299)" d="m0 0 1 4-2 8h-14l1-2 2 1 1-3 2-3 5-1 2-2 1 1z" fill="#DF8F08"/>
</svg>`;

/** Inlined SVG icons — popup window can't load external assets reliably. */
const icons = {
  pin:   '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>',
  phone: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M6.62 10.79a15.5 15.5 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24 11.36 11.36 0 0 0 3.57.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.24 1.02l-2.21 2.2z"/></svg>',
  clock: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm4.24 13.66L11 12.41V6h2v5.59l4.24 2.62z"/></svg>',
  store: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M21 7l-1.5-4.5A2 2 0 0 0 17.6 1H6.4a2 2 0 0 0-1.9 1.5L3 7v2a3 3 0 0 0 2 2.83V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8.17A3 3 0 0 0 21 9V7zM5 9V7.5L6.4 3h11.2L19 7.5V9a1 1 0 0 1-2 0V7H7v2a1 1 0 0 1-2 0z"/></svg>',
  zap:   '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L4.5 14H11l-1 8 8.5-12H12l1-8z"/></svg>',
};

const brandHeader = (): string => `
  <div class="brand-bar">
    <div class="brand-lockup">
      <div class="brand-mark">${DEALPRO_LOGO_SVG}</div>
      <div class="brand-logo">
        <span>DEAL</span><span class="brand-accent">PRO</span>
      </div>
    </div>
    <div class="brand-tag">Local deals, simplified</div>
  </div>
`;

const brandFooter = (d: ReturnType<typeof extract>): string => `
  <div class="brand-footer">
    <div class="brand-footer-cta">
      Get the Sreshta app — discover more deals near you
    </div>
    ${d.discountCode ? `<div class="brand-footer-code">Code: <strong>${escapeHtml(d.discountCode)}</strong></div>` : ''}
  </div>
`;

/* ------------------------------------------------------------------ */
/* TEMPLATE 1 — Bold Promo: photo on top, massive offer + heading below */
/* ------------------------------------------------------------------ */
const renderBoldPromo = (d: ReturnType<typeof extract>): string => `
  <div class="page page-bold-promo">
    ${brandHeader()}
    ${d.coverImage ? `
      <div class="hero">
        <img src="${escapeHtml(d.coverImage)}" alt="Deal" />
        ${d.isDotd ? '<div class="dotd-badge">⚡ DEAL OF THE DAY</div>' : ''}
      </div>` : '<div class="hero hero-blank"></div>'}

    <div class="bp-body">
      <div class="bp-offer-row">
        ${d.discountPct ? `<div class="bp-discount-pill">${escapeHtml(d.discountPct)}% OFF</div>` : ''}
        <div class="bp-offer">${escapeHtml(d.offer || 'Great Deal')}</div>
      </div>
      <h1 class="bp-heading">${escapeHtml(d.heading)}</h1>
      ${d.description ? `<p class="bp-description">${escapeHtml(truncateAtWord(d.description, 220))}</p>` : ''}

      <div class="bp-store-info">
        ${d.shopName ? `<div class="info-row"><span class="info-icon">${icons.store}</span><span class="info-text"><strong>${escapeHtml(d.shopName)}</strong></span></div>` : ''}
        ${d.address ? `<div class="info-row"><span class="info-icon">${icons.pin}</span><span class="info-text">${escapeHtml(d.address)}${d.landmark ? ' &middot; ' + escapeHtml(d.landmark) : ''}</span></div>` : ''}
        ${d.phone ? `<div class="info-row"><span class="info-icon">${icons.phone}</span><span class="info-text">${escapeHtml(d.phone)}${d.phoneAlt ? ' / ' + escapeHtml(d.phoneAlt) : ''}</span></div>` : ''}
        ${d.endDate ? `<div class="info-row"><span class="info-icon">${icons.clock}</span><span class="info-text">Valid till <strong>${escapeHtml(formatDate(d.endDate))}</strong></span></div>` : ''}
      </div>
    </div>
    ${brandFooter(d)}
  </div>
`;

/* ------------------------------------------------------------------ */
/* TEMPLATE 2 — Discount Splash: huge discount burst overlaid on photo */
/* ------------------------------------------------------------------ */
const renderDiscountSplash = (d: ReturnType<typeof extract>): string => {
  // When there's a percentage, the burst displays "30%" big + "OFF / OFF all items" small.
  // When there isn't (e.g. "Buy 1 Get 1"), fall back to the full offer text — and pick a
  // smaller font automatically so longer phrases still fit inside the circle.
  const hasPct = !!d.burstPct;
  const mainText = hasPct ? `${d.burstPct}%` : d.burstRest;
  const subText = hasPct ? d.burstRest : '';
  const mainLen = mainText.length;
  // Auto-scaled main font tuned for the 52mm burst. Caps via the discrete tiers
  // below so a long offer phrase ("Buy 1 Get 1 Free") still fits the circle.
  const mainFontPt = mainLen <= 4 ? 36 : mainLen <= 7 ? 26 : mainLen <= 12 ? 17 : 13;
  // Subtitle font shrinks if the rest-text is verbose ("OFF all items" vs just "OFF").
  const subFontPt = !subText ? 0 : subText.length <= 6 ? 12 : subText.length <= 16 ? 9 : 7;

  return `
  <div class="page page-discount-splash">
    ${brandHeader()}
    <div class="ds-stage">
      ${d.coverImage ? `<img class="ds-bg" src="${escapeHtml(d.coverImage)}" alt="Deal" />` : '<div class="ds-bg ds-bg-blank"></div>'}
      <div class="ds-overlay"></div>
      <div class="ds-burst">
        <div class="ds-burst-main" style="font-size:${mainFontPt}pt;">${escapeHtml(mainText)}</div>
        ${subText ? `<div class="ds-burst-sub" style="font-size:${subFontPt}pt;">${escapeHtml(subText)}</div>` : ''}
      </div>
      ${d.isDotd ? '<div class="dotd-badge ds-dotd">⚡ DEAL OF THE DAY</div>' : ''}
    </div>

    <div class="ds-body">
      <h1 class="ds-heading">${escapeHtml(d.heading)}</h1>
      ${d.offerPrice ? `<div class="ds-price">Now <span class="ds-price-big">₹${escapeHtml(d.offerPrice)}</span></div>` : ''}
      ${d.description ? `<p class="ds-description">${escapeHtml(truncateAtWord(d.description, 180))}</p>` : ''}

      <div class="ds-store-strip">
        ${d.shopName ? `<div><strong>${escapeHtml(d.shopName)}</strong></div>` : ''}
        ${d.address ? `<div>${escapeHtml(d.address)}</div>` : ''}
        <div class="ds-store-row">
          ${d.phone ? `<span>${escapeHtml(d.phone)}</span>` : ''}
          ${d.endDate ? `<span>Till ${escapeHtml(formatDate(d.endDate))}</span>` : ''}
        </div>
      </div>
    </div>
    ${brandFooter(d)}
  </div>
  `;
};

/* ------------------------------------------------------------------ */
/* TEMPLATE 3 — Classic Frame: refined, elegant typography             */
/* ------------------------------------------------------------------ */
const renderClassicFrame = (d: ReturnType<typeof extract>): string => `
  <div class="page page-classic-frame">
    <div class="cf-inner">
      <div class="cf-mast">
        <div class="cf-mast-mark">${DEALPRO_LOGO_SVG}</div>
        <div class="cf-mast-line"></div>
        <div class="cf-brand">DEAL<span>PRO</span></div>
        <div class="cf-mast-line"></div>
      </div>

      ${d.coverImage ? `
        <div class="cf-frame">
          <img src="${escapeHtml(d.coverImage)}" alt="Deal" />
        </div>` : '<div class="cf-frame cf-frame-blank"></div>'}

      <div class="cf-category">${escapeHtml(d.category || 'Special Offer')}</div>
      <h1 class="cf-heading">${escapeHtml(d.heading)}</h1>
      <div class="cf-offer">${escapeHtml(d.offer || '')}</div>

      ${d.description ? `<p class="cf-description">${escapeHtml(truncateAtWord(d.description, 180))}</p>` : ''}

      <div class="cf-divider"></div>

      <div class="cf-footer">
        ${d.shopName ? `<div class="cf-store-name">${escapeHtml(d.shopName)}</div>` : ''}
        <div class="cf-store-meta">
          ${d.address ? `<div>${escapeHtml(d.address)}</div>` : ''}
          ${d.phone ? `<div>${escapeHtml(d.phone)}${d.phoneAlt ? ' / ' + escapeHtml(d.phoneAlt) : ''}</div>` : ''}
          ${d.endDate ? `<div><em>Valid till ${escapeHtml(formatDate(d.endDate))}</em></div>` : ''}
        </div>
      </div>
    </div>
  </div>
`;

/* ------------------------------------------------------------------ */
/* TEMPLATE 4 — Side by Side: photo on left, details on right         */
/* ------------------------------------------------------------------ */
const renderSideBySide = (d: ReturnType<typeof extract>): string => `
  <div class="page page-side-by-side">
    ${d.coverImage ? `
      <div class="sbs-photo">
        <img src="${escapeHtml(d.coverImage)}" alt="Deal" />
        <div class="sbs-logo-chip">${DEALPRO_LOGO_SVG}</div>
        ${d.isDotd ? '<div class="dotd-badge sbs-dotd">⚡ DOTD</div>' : ''}
      </div>` : `<div class="sbs-photo sbs-photo-blank"><div class="sbs-logo-chip">${DEALPRO_LOGO_SVG}</div></div>`}

    <div class="sbs-details">
      <div class="sbs-brand">
        <span>DEAL</span><span class="brand-accent">PRO</span>
      </div>
      ${d.category ? `<div class="sbs-category">${escapeHtml(d.category)}</div>` : ''}
      <h1 class="sbs-heading">${escapeHtml(d.heading)}</h1>

      <div class="sbs-offer-block">
        ${d.discountPct ? `<div class="sbs-discount">${escapeHtml(d.discountPct)}% OFF</div>` : ''}
        <div class="sbs-offer">${escapeHtml(d.offer || '')}</div>
        ${d.offerPrice ? `<div class="sbs-price">₹${escapeHtml(d.offerPrice)}</div>` : ''}
      </div>

      ${d.description ? `<p class="sbs-description">${escapeHtml(truncateAtWord(d.description, 200))}</p>` : ''}

      <div class="sbs-store">
        ${d.shopName ? `<div class="sbs-row"><span class="sbs-icon">${icons.store}</span><strong>${escapeHtml(d.shopName)}</strong></div>` : ''}
        ${d.address ? `<div class="sbs-row"><span class="sbs-icon">${icons.pin}</span>${escapeHtml(d.address)}</div>` : ''}
        ${d.phone ? `<div class="sbs-row"><span class="sbs-icon">${icons.phone}</span>${escapeHtml(d.phone)}${d.phoneAlt ? ' / ' + escapeHtml(d.phoneAlt) : ''}</div>` : ''}
        ${d.endDate ? `<div class="sbs-row"><span class="sbs-icon">${icons.clock}</span>Valid till <strong>${escapeHtml(formatDate(d.endDate))}</strong></div>` : ''}
      </div>

      <div class="sbs-cta">Get the Sreshta app for more deals near you</div>
    </div>
  </div>
`;

/** Shared CSS for all templates. */
const sharedCss = `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    color: #0f172a;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  @page { size: A4 portrait; margin: 0; }
  @media print { body { background: white; } }
  @media screen {
    body { background: #e5e7eb; padding: 24px; }
    .page { box-shadow: 0 10px 30px rgba(0,0,0,0.15); margin: 0 auto; }
  }
  .page {
    width: 210mm;
    min-height: 297mm;
    background: white;
    page-break-after: always;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
  }
  .page:last-child { page-break-after: auto; }

  /* Brand header (used by some templates) */
  .brand-bar {
    background: #0f172a;
    color: white;
    padding: 6mm 10mm;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
  }
  .brand-lockup { display: flex; align-items: center; gap: 2.5mm; }
  .brand-mark { width: 9mm; height: 9mm; background: white; border-radius: 2mm; padding: 0.8mm; display: flex; align-items: center; justify-content: center; box-shadow: 0 0.6mm 1.5mm rgba(0,0,0,0.2); }
  .brand-mark svg { width: 100%; height: 100%; display: block; }
  .brand-logo { font-size: 18pt; font-weight: 900; letter-spacing: -0.02em; }
  .brand-accent { color: #eab308; }
  .brand-tag { font-size: 8pt; opacity: 0.65; letter-spacing: 0.1em; text-transform: uppercase; }
  .dotd-badge {
    position: absolute;
    top: 14mm;
    right: 8mm;
    background: #f59e0b;
    color: white;
    padding: 2mm 4mm;
    border-radius: 4mm;
    font-size: 9pt;
    font-weight: 800;
    letter-spacing: 0.05em;
    box-shadow: 0 2mm 4mm rgba(0,0,0,0.2);
  }

  .brand-footer {
    margin-top: auto;
    background: #fef3c7;
    padding: 6mm 12mm;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-top: 0.5mm solid #fcd34d;
  }
  .brand-footer-cta { font-size: 10pt; font-weight: 600; color: #92400e; }
  .brand-footer-code { font-size: 10pt; color: #78350f; }

  .info-row { display: flex; align-items: center; gap: 3mm; margin: 1.5mm 0; }
  .info-icon { width: 5mm; height: 5mm; flex-shrink: 0; color: #475569; display: flex; align-items: center; }
  .info-icon svg { width: 100%; height: 100%; }
  .info-text { font-size: 11pt; color: #0f172a; }

  /* ===== TEMPLATE 1 — Bold Promo ===== */
  .page-bold-promo .hero { width: 100%; height: 130mm; background: #f1f5f9; position: relative; overflow: hidden; flex-shrink: 0; }
  .page-bold-promo .hero img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .page-bold-promo .hero-blank { background: linear-gradient(135deg, #fde68a, #fbbf24); }
  .page-bold-promo .bp-body { padding: 8mm 12mm; flex: 1; }
  .page-bold-promo .bp-offer-row { display: flex; align-items: center; gap: 4mm; margin-bottom: 5mm; flex-wrap: wrap; }
  .page-bold-promo .bp-discount-pill { background: #dc2626; color: white; font-weight: 900; font-size: 18pt; padding: 2mm 4mm; border-radius: 3mm; }
  .page-bold-promo .bp-offer { font-size: 26pt; font-weight: 800; color: #b45309; line-height: 1; }
  .page-bold-promo .bp-heading { font-size: 22pt; font-weight: 700; line-height: 1.1; margin: 0 0 4mm 0; color: #0f172a; }
  .page-bold-promo .bp-description { white-space: pre-line; font-size: 11pt; line-height: 1.5; color: #475569; margin: 0 0 6mm 0; }
  .page-bold-promo .bp-store-info { padding: 5mm; background: #f8fafc; border: 0.3mm solid #e2e8f0; border-radius: 3mm; }

  /* ===== TEMPLATE 2 — Discount Splash ===== */
  .page-discount-splash .ds-stage { width: 100%; height: 140mm; position: relative; overflow: hidden; flex-shrink: 0; }
  .page-discount-splash .ds-bg { width: 100%; height: 100%; object-fit: cover; }
  .page-discount-splash .ds-bg-blank { background: linear-gradient(135deg, #fbbf24, #dc2626); }
  .page-discount-splash .ds-overlay { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,0.05) 30%, rgba(0,0,0,0.6) 100%); }
  .page-discount-splash .ds-burst {
    position: absolute;
    right: 8mm;
    bottom: 8mm;
    width: 52mm;
    height: 52mm;
    background: #dc2626;
    color: white;
    border-radius: 50%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    overflow: hidden;
    padding: 5mm;
    box-shadow: 0 3mm 8mm rgba(220,38,38,0.45);
    border: 2.5mm solid white;
    box-sizing: border-box;
  }
  .page-discount-splash .ds-burst-main { font-weight: 900; line-height: 1; text-transform: uppercase; word-break: break-word; }
  .page-discount-splash .ds-burst-sub { font-weight: 700; letter-spacing: 0.1em; margin-top: 1.5mm; line-height: 1.15; text-transform: uppercase; }
  .page-discount-splash .ds-dotd { top: 8mm; left: 8mm; right: auto; }
  .page-discount-splash .ds-body { padding: 8mm 12mm; flex: 1; }
  .page-discount-splash .ds-heading { font-size: 24pt; font-weight: 800; margin: 0 0 4mm 0; line-height: 1.1; }
  .page-discount-splash .ds-price { font-size: 12pt; color: #475569; margin-bottom: 4mm; }
  .page-discount-splash .ds-price-big { font-size: 28pt; font-weight: 900; color: #0f172a; }
  .page-discount-splash .ds-description { white-space: pre-line; font-size: 11pt; line-height: 1.5; color: #475569; margin: 0 0 5mm 0; }
  .page-discount-splash .ds-store-strip { background: #0f172a; color: white; padding: 5mm 6mm; border-radius: 3mm; font-size: 10pt; line-height: 1.5; }
  .page-discount-splash .ds-store-row { display: flex; gap: 6mm; margin-top: 2mm; font-size: 10pt; }

  /* ===== TEMPLATE 3 — Classic Frame ===== */
  .page-classic-frame { background: #fffbeb; }
  .page-classic-frame .cf-inner { padding: 18mm 16mm; display: flex; flex-direction: column; flex: 1; }
  .page-classic-frame .cf-mast { display: flex; align-items: center; gap: 5mm; margin-bottom: 10mm; }
  .page-classic-frame .cf-mast-mark { width: 14mm; height: 14mm; flex-shrink: 0; }
  .page-classic-frame .cf-mast-mark svg { width: 100%; height: 100%; display: block; }
  .page-classic-frame .cf-mast-line { flex: 1; height: 0.4mm; background: #92400e; }
  .page-classic-frame .cf-brand { font-size: 14pt; font-weight: 900; letter-spacing: 0.4em; color: #92400e; }
  .page-classic-frame .cf-brand span { color: #b45309; }
  .page-classic-frame .cf-frame { width: 100%; height: 110mm; border: 1.5mm solid #92400e; padding: 2mm; background: white; flex-shrink: 0; }
  .page-classic-frame .cf-frame img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .page-classic-frame .cf-frame-blank { background: #fde68a; }
  .page-classic-frame .cf-category { text-align: center; margin-top: 8mm; font-size: 10pt; letter-spacing: 0.25em; text-transform: uppercase; color: #92400e; font-weight: 700; }
  .page-classic-frame .cf-heading { text-align: center; font-size: 28pt; font-weight: 800; color: #1c1917; margin: 4mm 0 4mm 0; line-height: 1.1; font-family: Georgia, 'Times New Roman', serif; }
  .page-classic-frame .cf-offer { text-align: center; font-size: 36pt; font-weight: 900; color: #b45309; line-height: 1; margin-bottom: 5mm; font-family: Georgia, 'Times New Roman', serif; }
  .page-classic-frame .cf-description { white-space: pre-line; text-align: center; font-size: 11pt; line-height: 1.6; color: #57534e; max-width: 140mm; margin: 0 auto 8mm; font-style: italic; }
  .page-classic-frame .cf-divider { width: 30mm; height: 0.5mm; background: #92400e; margin: 0 auto 6mm; }
  .page-classic-frame .cf-footer { text-align: center; margin-top: auto; padding-top: 4mm; }
  .page-classic-frame .cf-store-name { font-size: 16pt; font-weight: 800; color: #1c1917; margin-bottom: 2mm; }
  .page-classic-frame .cf-store-meta { font-size: 10pt; color: #78716c; line-height: 1.6; }

  /* ===== TEMPLATE 4 — Side by Side ===== */
  .page-side-by-side { flex-direction: row; }
  .page-side-by-side .sbs-photo { width: 100mm; height: 297mm; position: relative; flex-shrink: 0; background: #f1f5f9; }
  .page-side-by-side .sbs-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .page-side-by-side .sbs-photo-blank { background: linear-gradient(180deg, #fbbf24, #b45309); }
  .page-side-by-side .sbs-logo-chip { position: absolute; top: 6mm; left: 6mm; width: 14mm; height: 14mm; background: white; border-radius: 3mm; padding: 1.5mm; box-shadow: 0 2mm 4mm rgba(0,0,0,0.25); display: flex; align-items: center; justify-content: center; }
  .page-side-by-side .sbs-logo-chip svg { width: 100%; height: 100%; display: block; }
  .page-side-by-side .sbs-dotd { top: 8mm; right: 6mm; left: auto; }
  .page-side-by-side .sbs-details { flex: 1; padding: 14mm 12mm; display: flex; flex-direction: column; }
  .page-side-by-side .sbs-brand { font-size: 18pt; font-weight: 900; letter-spacing: -0.02em; margin-bottom: 8mm; }
  .page-side-by-side .sbs-category { font-size: 9pt; letter-spacing: 0.2em; text-transform: uppercase; color: #eab308; font-weight: 800; margin-bottom: 3mm; }
  .page-side-by-side .sbs-heading { font-size: 22pt; font-weight: 800; line-height: 1.1; margin: 0 0 6mm 0; color: #0f172a; }
  .page-side-by-side .sbs-offer-block { background: #fef3c7; padding: 5mm; border-radius: 3mm; margin-bottom: 6mm; border-left: 1.5mm solid #eab308; }
  .page-side-by-side .sbs-discount { display: inline-block; background: #dc2626; color: white; font-weight: 900; font-size: 14pt; padding: 1.5mm 3mm; border-radius: 2mm; margin-bottom: 2mm; }
  .page-side-by-side .sbs-offer { font-size: 20pt; font-weight: 800; color: #b45309; line-height: 1.2; }
  .page-side-by-side .sbs-price { font-size: 24pt; font-weight: 900; color: #0f172a; margin-top: 2mm; }
  .page-side-by-side .sbs-description { white-space: pre-line; font-size: 11pt; line-height: 1.5; color: #475569; margin: 0 0 6mm 0; }
  .page-side-by-side .sbs-store { margin-bottom: 6mm; }
  .page-side-by-side .sbs-row { display: flex; align-items: center; gap: 3mm; font-size: 10.5pt; line-height: 1.5; color: #334155; margin: 1.5mm 0; }
  .page-side-by-side .sbs-icon { width: 4mm; height: 4mm; color: #64748b; flex-shrink: 0; display: flex; align-items: center; }
  .page-side-by-side .sbs-icon svg { width: 100%; height: 100%; }
  .page-side-by-side .sbs-cta { margin-top: auto; padding: 4mm; background: #0f172a; color: #fef3c7; border-radius: 2mm; font-size: 10pt; text-align: center; font-weight: 600; }
`;

const renderForTemplate = (template: PosterTemplate, d: ReturnType<typeof extract>): string => {
  switch (template) {
    case 'bold_promo':      return renderBoldPromo(d);
    case 'discount_splash': return renderDiscountSplash(d);
    case 'classic_frame':   return renderClassicFrame(d);
    case 'side_by_side':    return renderSideBySide(d);
  }
};

export interface BuildPosterOptions {
  /** Auto-trigger window.print() once images load. Default true. Set false for preview iframes. */
  autoPrint?: boolean;
}

export function buildPosterHtml(deal: Deal, template: PosterTemplate, opts: BuildPosterOptions = {}): string {
  const { autoPrint = true } = opts;
  const d = extract(deal);
  const body = renderForTemplate(template, d);
  const printScript = autoPrint ? `
  <script>
    // Wait for the cover image to load (or fail) before triggering print so
    // the merchant doesn't get a poster with a missing photo.
    function triggerPrint() {
      setTimeout(function() { window.print(); }, 250);
    }
    var imgs = document.images;
    if (imgs.length === 0) { window.addEventListener('load', triggerPrint); }
    else {
      var remaining = imgs.length;
      var done = function() { if (--remaining <= 0) triggerPrint(); };
      for (var i = 0; i < imgs.length; i++) {
        if (imgs[i].complete) done();
        else { imgs[i].addEventListener('load', done); imgs[i].addEventListener('error', done); }
      }
    }
  </script>` : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(d.heading || 'Sreshta Poster')}</title>
  <style>${sharedCss}</style>
</head>
<body>
  ${body}${printScript}
</body>
</html>`;
}

/**
 * Renders the poster in an off-screen iframe inside the current document and
 * triggers the browser/OS print dialog from that iframe.
 *
 * Why an iframe (and not window.open):
 *   • On Capacitor / mobile WebViews, window.open('', '_blank') hands the new
 *     tab off to the system browser (Chrome / Samsung Internet) with a blank
 *     URL — and our `document.write(html)` call can't reach that out-of-process
 *     window, so the new tab just sits there empty.
 *   • An iframe stays in the same WebView, runs same-origin (via srcdoc), and
 *     window.print() on it triggers the Android Print Service dialog
 *     (Save-as-PDF / Bluetooth printer / etc.) directly.
 *   • Same code path works on desktop too — the browser's print dialog opens
 *     scoped to the iframe document, no popup-blocker concerns.
 */
export function openDealPoster(deal: Deal, template: PosterTemplate): boolean {
  // We DON'T want the HTML's inline auto-print script firing inside the
  // iframe — we'll call print() from the parent so we have control over
  // when it happens (after images load) and can clean up the iframe.
  const html = buildPosterHtml(deal, template, { autoPrint: false });

  // --- Native (Capacitor Android) path -------------------------------------
  // The Android System WebView does NOT route window.print() (or an iframe's
  // print()) to the OS print framework, so the printer-chooser dialog never
  // appears on the app. Use cordova-plugin-printer, which calls Android's
  // PrintManager directly and shows the standard "select printer / Save as PDF"
  // sheet. Falls through to the iframe path below on web or if the plugin is
  // unavailable.
  if (Capacitor.isNativePlatform()) {
    const printer = (window as any)?.cordova?.plugins?.printer;
    if (printer?.print) {
      try {
        printer.print(html, { name: `Sreshta Poster — ${deal && (deal as any).deal_heading ? (deal as any).deal_heading : 'Deal'}` }, () => {});
        return true;
      } catch (err) {
        console.error('[printDealPoster] cordova printer failed, falling back to iframe:', err);
        // fall through to the iframe path
      }
    } else {
      console.warn('[printDealPoster] cordova-plugin-printer not found on native — install it (npm i cordova-plugin-printer && npx cap sync android). Falling back to window.print(), which may be a no-op in the Android WebView.');
    }
  }

  // Tear down any orphan iframe from a previous attempt.
  const prior = document.getElementById('dealpro-poster-print-frame');
  if (prior?.parentNode) prior.parentNode.removeChild(prior);

  const iframe = document.createElement('iframe');
  iframe.id = 'dealpro-poster-print-frame';
  iframe.setAttribute('aria-hidden', 'true');
  // Off-screen but full A4 dimensions so the browser renders it at print quality.
  // Tiny 1px iframes can cause Chrome to skip rendering for the print preview.
  iframe.style.position = 'fixed';
  iframe.style.left = '-9999px';
  iframe.style.top = '0';
  iframe.style.width = '210mm';
  iframe.style.height = '297mm';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  // srcdoc makes the iframe same-origin so we can call print() on its window.
  iframe.srcdoc = html;

  let printFired = false;
  let cleanupTimer: number | null = null;

  const cleanup = () => {
    if (cleanupTimer != null) {
      clearTimeout(cleanupTimer);
      cleanupTimer = null;
    }
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
  };

  const triggerPrint = () => {
    if (printFired) return;
    printFired = true;
    try {
      const cw = iframe.contentWindow;
      if (!cw) {
        console.error('[printDealPoster] iframe.contentWindow unavailable');
        cleanup();
        return;
      }
      // Some Android WebViews need the iframe focused before print() will
      // route the dialog to its document rather than the parent's.
      try { cw.focus(); } catch { /* best-effort */ }
      // Remove the iframe shortly after the print dialog closes. Use
      // afterprint when available; fall back to a 60s safety timer.
      const onAfterPrint = () => { cleanup(); };
      try { cw.addEventListener('afterprint', onAfterPrint, { once: true }); } catch { /* ignore */ }
      cw.print();
    } catch (err) {
      console.error('[printDealPoster] window.print() threw:', err);
      cleanup();
    }
  };

  iframe.onload = () => {
    // Wait for the cover image inside the iframe to finish loading (or fail)
    // before firing print — otherwise the print preview shows a blank rectangle
    // where the image should be.
    try {
      const doc = iframe.contentDocument;
      if (!doc) { triggerPrint(); return; }
      const imgs = Array.from(doc.images);
      if (imgs.length === 0) {
        // Small delay so any final layout settles.
        setTimeout(triggerPrint, 150);
        return;
      }
      let remaining = imgs.length;
      const done = () => {
        if (--remaining <= 0) {
          // Brief settle delay for fonts + layout.
          setTimeout(triggerPrint, 150);
        }
      };
      for (const img of imgs) {
        if (img.complete) done();
        else {
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
        }
      }
    } catch (err) {
      console.warn('[printDealPoster] image-wait failed, printing anyway:', err);
      triggerPrint();
    }
  };

  document.body.appendChild(iframe);

  // Safety net: if afterprint never fires (some Android WebView builds drop
  // the event when the user cancels via system back), remove the iframe.
  cleanupTimer = window.setTimeout(cleanup, 60000);

  return true;
}
