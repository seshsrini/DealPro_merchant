import React, { useRef, useEffect, useState } from 'react';
import { ImageIcon, Upload, Check, X, Loader2, Film, Plus, GripVertical, Tag, Percent } from 'lucide-react';
import { floatIn } from './floatIn';
import { addCampaignService } from '../../services/addCampaignService';
import { useTranslation } from '../../contexts/LanguageContext';
import { UploadVideoLoader } from '../UploadVideoLoader';

const MAX_IMAGES = 5;
const MAX_VIDEO_SIZE_MB = 50;
const ACCEPTED_VIDEO_TYPES = 'video/mp4,video/quicktime,video/webm';

export interface PromoBannerTagOverride {
  discountPct?: string;  // e.g. "30"
  offerPrice?: string;   // e.g. "699" (MRP auto = +30%)
}

export type BannerTextSide = 'left' | 'right';

/**
 * Where the deal text overlay sits on the cover banner.
 *   - 'auto'   → heuristic picks 'left' or 'right' based on image content
 *   - 'left'   → vertical band on left, image dominant on right
 *   - 'right'  → vertical band on right, image dominant on left
 *   - 'top'    → horizontal band across top, image dominant below
 *   - 'bottom' → horizontal band across bottom, image dominant above
 */
export type BannerPlacement = 'auto' | 'left' | 'right' | 'top' | 'bottom' | 'none';

export const ALL_BANNER_PLACEMENTS: BannerPlacement[] = ['auto', 'left', 'right', 'top', 'bottom', 'none'];

export const BANNER_PLACEMENT_LABELS: Record<BannerPlacement, string> = {
  auto:   'Auto',
  left:   'Left',
  right:  'Right',
  top:    'Top',
  bottom: 'Bottom',
  none:   'No Text',
};

// ────────────────────────────────────────────────────────────────────────────
// Placement heuristic — pick the side with the LESS visually busy content so
// the product stays visible. Uses Sobel edge density on the left/right thirds
// + the browser's native FaceDetector (when available) as a tie-breaker that
// pushes text away from people's faces.
// ────────────────────────────────────────────────────────────────────────────

async function detectFaceCentersIfPossible(img: HTMLImageElement): Promise<number[]> {
  const FD: any = (window as any).FaceDetector;
  if (typeof FD !== 'function') return [];
  try {
    const detector = new FD({ maxDetectedFaces: 5, fastMode: true });
    const faces = await detector.detect(img);
    const naturalW = img.naturalWidth || img.width;
    if (!naturalW) return [];
    return faces.map((f: any) => (f.boundingBox.x + f.boundingBox.width / 2) / naturalW);
  } catch {
    return [];
  }
}

function sobelEdgeDensity(ctx: CanvasRenderingContext2D, sx: number, sy: number, w: number, h: number): number {
  try {
    const data = ctx.getImageData(sx, sy, w, h).data;
    let total = 0;
    let count = 0;
    const step = 6;
    const lum = (a: number, b: number, c: number) => a * 0.299 + b * 0.587 + c * 0.114;
    for (let py = step; py < h - step; py += step) {
      for (let px = step; px < w - step; px += step) {
        const i = (py * w + px) * 4;
        const iL = i - 4;
        const iR = i + 4;
        const iT = ((py - 1) * w + px) * 4;
        const iB = ((py + 1) * w + px) * 4;
        const dx = lum(data[iR], data[iR + 1], data[iR + 2]) - lum(data[iL], data[iL + 1], data[iL + 2]);
        const dy = lum(data[iB], data[iB + 1], data[iB + 2]) - lum(data[iT], data[iT + 1], data[iT + 2]);
        total += Math.sqrt(dx * dx + dy * dy);
        count++;
      }
    }
    return count > 0 ? total / count : 0;
  } catch {
    return 0;
  }
}

function pickTextSide(ctx: CanvasRenderingContext2D, size: number, faceCenters: number[]): BannerTextSide {
  // Combine signals into a single interest score per side so neither faces nor edges dominate
  // alone — both contribute. Text goes on the side with the LOWER total interest.
  const thirdW = Math.floor(size / 3);
  const sampleH = Math.min(size, Math.floor(size * 0.7));
  const sampleY = Math.floor((size - sampleH) / 2);

  const leftEdge = sobelEdgeDensity(ctx, 0, sampleY, thirdW, sampleH);
  const rightEdge = sobelEdgeDensity(ctx, size - thirdW, sampleY, thirdW, sampleH);
  const centerEdge = sobelEdgeDensity(ctx, thirdW, sampleY, thirdW, sampleH);

  // Each face on a side adds a fixed bonus relative to the typical edge magnitude.
  // Tuned so a single face contributes roughly the weight of one moderately busy third.
  const refEdge = Math.max(centerEdge, (leftEdge + rightEdge) / 2, 1);
  const FACE_BONUS = refEdge * 0.6;
  const leftFaces = faceCenters.filter(x => x < 0.5).length;
  const rightFaces = faceCenters.filter(x => x >= 0.5).length;
  const leftScore = leftEdge + leftFaces * FACE_BONUS;
  const rightScore = rightEdge + rightFaces * FACE_BONUS;

  // Default to LEFT (natural reading direction). Flip to RIGHT when the left
  // side is meaningfully busier than the right.
  return leftScore > rightScore * 1.2 ? 'right' : 'left';
}

/**
 * Determine which side the deal text overlay should land on for a given image.
 * Exposed so the manual "Move text" toggle can know what `auto` would have chosen.
 */
export async function detectBannerTextSide(imageFile: File): Promise<BannerTextSide> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(imageFile);
    img.onload = async () => {
      try {
        const SIZE = Math.max(img.width, img.height, 1080);
        const canvas = document.createElement('canvas');
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve('left'); return; }
        // Mirror the cover-draw logic so the analyzed pixels match what generatePromoBanner sees.
        const aspect = img.width / img.height;
        let drawW: number, drawH: number, drawX: number, drawY: number;
        if (aspect >= 1) {
          drawH = SIZE; drawW = drawH * aspect;
          drawX = (SIZE - drawW) / 2; drawY = 0;
        } else {
          drawW = SIZE; drawH = drawW / aspect;
          drawX = 0; drawY = (SIZE - drawH) / 2;
        }
        ctx.drawImage(img, drawX, drawY, drawW, drawH);
        const faceCenters = await detectFaceCentersIfPossible(img);
        resolve(pickTextSide(ctx, SIZE, faceCenters));
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve('left'); };
    img.src = url;
  });
}

/**
 * Generates a professional promo banner by overlaying deal info on the product image.
 * The `placement` argument selects between four real layouts (left/right vertical bands,
 * top/bottom horizontal bands) plus 'auto' which falls back to the side-picking heuristic.
 *
 * When `tagOverride` is provided, the offer section is rendered from the structured tag
 * (big "% OFF" + offer price + slashed-through auto MRP) instead of the free-text offerValue.
 */
export async function generatePromoBanner(
  imageFile: File,
  storeName: string,
  dealHeading: string,
  offerValue: string,
  trustBadgeLabels?: string[],
  tagOverride?: PromoBannerTagOverride,
  placement: BannerPlacement = 'auto',
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(imageFile);
    img.onload = async () => {
      const SIZE = Math.max(img.width, img.height, 1080);
      const canvas = document.createElement('canvas');
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(imageFile); return; }

      // Helper: word-wrap text
      const wrapText = (text: string, maxW: number): string[] => {
        const words = text.split(' ');
        const lines: string[] = [];
        let ln = '';
        for (const w of words) {
          const test = ln ? `${ln} ${w}` : w;
          if (ctx.measureText(test).width > maxW && ln) { lines.push(ln); ln = w; }
          else ln = test;
        }
        if (ln) lines.push(ln);
        return lines;
      };

      // === DARK BASE ===
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, SIZE, SIZE);

      // === DRAW FULL IMAGE — initial center-crop, used for the placement heuristic ===
      const imgAspect = img.width / img.height;
      let drawW: number, drawH: number, drawX: number, drawY: number;
      if (imgAspect >= 1) {
        drawH = SIZE; drawW = drawH * imgAspect;
        drawX = (SIZE - drawW) / 2; drawY = 0;
      } else {
        drawW = SIZE; drawH = drawW / imgAspect;
        drawX = 0; drawY = (SIZE - drawH) / 2;
      }
      ctx.drawImage(img, drawX, drawY, drawW, drawH);

      // === 'none' placement → image only, no gradient/text/badges ===
      // Some merchants want the photo to speak for itself. Return the cropped
      // square as-is, skipping every overlay below.
      if (placement === 'none') {
        URL.revokeObjectURL(url);
        canvas.toBlob(
          (blob) => {
            if (!blob) { resolve(imageFile); return; }
            resolve(new File([blob], `promo-banner-${Date.now()}.jpg`, { type: 'image/jpeg' }));
          },
          'image/jpeg',
          0.92,
        );
        return;
      }

      // === Resolve the placement ===
      // 'auto' → heuristic picks 'left' or 'right'. Explicit values bypass the heuristic.
      // 'top'/'bottom' use a horizontal band layout; 'left'/'right' use a vertical side layout.
      let resolvedSide: BannerTextSide = 'left';
      const isBand = placement === 'top' || placement === 'bottom';
      const onTop = placement === 'top';
      if (placement === 'left' || placement === 'right') {
        resolvedSide = placement;
      } else if (placement === 'auto') {
        const faceCenters = await detectFaceCentersIfPossible(img);
        resolvedSide = pickTextSide(ctx, SIZE, faceCenters);
      }
      const textOnRight = resolvedSide === 'right';

      // === Re-anchor the crop so the SUBJECT stays in the IMAGE area (opposite of band) ===
      if (isBand) {
        // Band mode: wide images keep the centered crop (full subject width is visible);
        // tall images anchor opposite the band so the subject lives in the picture half.
        if (drawH > SIZE) {
          const desiredDrawY = onTop ? SIZE - drawH : 0; // top band → image flush to bottom, etc.
          if (desiredDrawY !== drawY) {
            drawY = desiredDrawY;
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, SIZE, SIZE);
            ctx.drawImage(img, drawX, drawY, drawW, drawH);
          }
        }
      } else {
        // Side mode: shift wide images flush against the side OPPOSITE the text band;
        // shift tall images so the densest vertical third stays visible.
        if (drawW > SIZE) {
          const desiredDrawX = textOnRight ? 0 : SIZE - drawW;
          if (desiredDrawX !== drawX) {
            drawX = desiredDrawX;
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, SIZE, SIZE);
            ctx.drawImage(img, drawX, drawY, drawW, drawH);
          }
        } else if (drawH > SIZE) {
          const thirdH = Math.floor(SIZE / 3);
          const topEdge = sobelEdgeDensity(ctx, 0, 0, SIZE, thirdH);
          const bottomEdge = sobelEdgeDensity(ctx, 0, SIZE - thirdH, SIZE, thirdH);
          const desiredDrawY = topEdge >= bottomEdge ? 0 : SIZE - drawH;
          if (desiredDrawY !== drawY) {
            drawY = desiredDrawY;
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, SIZE, SIZE);
            ctx.drawImage(img, drawX, drawY, drawW, drawH);
          }
        }
      }

      // === GRADIENT + TEXT ===
      // Branch into side (left/right vertical band) vs band (top/bottom horizontal band).
      if (!isBand) {

      let blendGrad: CanvasGradient;
      if (textOnRight) {
        blendGrad = ctx.createLinearGradient(SIZE, 0, SIZE * 0.55, 0);
      } else {
        blendGrad = ctx.createLinearGradient(0, 0, SIZE * 0.45, 0);
      }
      blendGrad.addColorStop(0, 'rgba(15,23,42,0.95)');
      blendGrad.addColorStop(0.6, 'rgba(15,23,42,0.85)');
      blendGrad.addColorStop(0.8, 'rgba(15,23,42,0.4)');
      blendGrad.addColorStop(1, 'rgba(15,23,42,0)');
      ctx.fillStyle = blendGrad;
      if (textOnRight) {
        ctx.fillRect(SIZE * 0.55, 0, SIZE * 0.45, SIZE);
      } else {
        ctx.fillRect(0, 0, SIZE * 0.45, SIZE);
      }

      // Subtle bottom strip for branding bar
      const botV = ctx.createLinearGradient(0, SIZE * 0.9, 0, SIZE);
      botV.addColorStop(0, 'rgba(15,23,42,0)');
      botV.addColorStop(1, 'rgba(15,23,42,0.6)');
      ctx.fillStyle = botV;
      ctx.fillRect(0, SIZE * 0.9, SIZE, SIZE * 0.1);

      // === COMPACT TEXT — on the detected side (30% width) ===
      const pad = SIZE * 0.04;
      const leftMaxW = SIZE * 0.3;
      const textX = textOnRight ? SIZE - pad - leftMaxW : pad;
      const textAlign: CanvasTextAlign = textOnRight ? 'right' : 'left';
      const textAnchorX = textOnRight ? SIZE - pad : pad;

      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;

      // STORE NAME
      ctx.textAlign = textAlign;
      ctx.textBaseline = 'top';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = `700 ${SIZE * 0.016}px Arial, sans-serif`;
      ctx.fillText(storeName.toUpperCase(), textAnchorX, pad);

      // DEAL HEADING
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${SIZE * 0.035}px Arial, sans-serif`;
      const headingLines = wrapText(dealHeading, leftMaxW);
      let y = pad + SIZE * 0.04;
      headingLines.forEach(line => {
        ctx.fillText(line, textAnchorX, y);
        y += SIZE * 0.042;
      });

      // Gold separator
      y += SIZE * 0.008;
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(234,179,8,0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const sepStartX = textOnRight ? SIZE - pad - SIZE * 0.1 : pad;
      ctx.moveTo(sepStartX, y);
      ctx.lineTo(sepStartX + SIZE * 0.1, y);
      ctx.stroke();
      y += SIZE * 0.018;
      ctx.shadowBlur = 4;

      // OFFER VALUE — branch on structured tag override vs free-text offer
      ctx.textAlign = textAlign;
      const tagDiscount = tagOverride?.discountPct?.trim();
      const tagPrice = tagOverride?.offerPrice?.trim();
      if (tagDiscount || tagPrice) {
        if (tagDiscount) {
          ctx.fillStyle = '#eab308';
          ctx.font = `900 ${SIZE * 0.07}px Arial, sans-serif`;
          ctx.fillText(`${tagDiscount}%`, textAnchorX, y);
          y += SIZE * 0.07;
          ctx.font = `bold ${SIZE * 0.022}px Arial, sans-serif`;
          ctx.fillStyle = '#eab308';
          ctx.fillText('OFF', textAnchorX, y);
          y += SIZE * 0.032;
        }
        if (tagPrice) {
          const priceNum = parseFloat(tagPrice);
          const mrp = isFinite(priceNum) && priceNum > 0 ? Math.round(priceNum * 1.3) : null;
          ctx.fillStyle = '#ffffff';
          ctx.font = `bold ${SIZE * 0.045}px Arial, sans-serif`;
          ctx.fillText(`₹${tagPrice}`, textAnchorX, y);
          y += SIZE * 0.05;
          if (mrp) {
            ctx.font = `${SIZE * 0.022}px Arial, sans-serif`;
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            const mrpText = `MRP ₹${mrp}`;
            ctx.fillText(mrpText, textAnchorX, y);
            // Strikethrough on MRP
            const prevShadow = ctx.shadowBlur;
            ctx.shadowBlur = 0;
            const mrpW = ctx.measureText(mrpText).width;
            const strikeY = y + SIZE * 0.011;
            ctx.strokeStyle = 'rgba(255,255,255,0.6)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            if (textOnRight) {
              ctx.moveTo(textAnchorX - mrpW, strikeY);
              ctx.lineTo(textAnchorX, strikeY);
            } else {
              ctx.moveTo(textAnchorX, strikeY);
              ctx.lineTo(textAnchorX + mrpW, strikeY);
            }
            ctx.stroke();
            ctx.shadowBlur = prevShadow;
            y += SIZE * 0.028;
          }
        }
      } else {
        const offerMatch = offerValue.match(/(\d+)\s*%/);
        if (offerMatch) {
          ctx.fillStyle = '#eab308';
          ctx.font = `900 ${SIZE * 0.07}px Arial, sans-serif`;
          ctx.fillText(`${offerMatch[1]}%`, textAnchorX, y);
          y += SIZE * 0.075;
          const restText = offerValue.replace(/\d+\s*%/, '').trim();
          if (restText) {
            ctx.font = `bold ${SIZE * 0.022}px Arial, sans-serif`;
            ctx.fillStyle = '#eab308';
            const restLines = wrapText(restText, leftMaxW);
            restLines.forEach(ln => { ctx.fillText(ln, textAnchorX, y); y += SIZE * 0.028; });
          }
        } else {
          ctx.fillStyle = '#eab308';
          ctx.font = `900 ${SIZE * 0.04}px Arial, sans-serif`;
          const offerLines = wrapText(offerValue, leftMaxW);
          offerLines.forEach(ln => { ctx.fillText(ln, textAnchorX, y); y += SIZE * 0.048; });
        }
      }
      y += SIZE * 0.01;

      // LIMITED TIME OFFER badge
      ctx.fillStyle = '#ef4444';
      const badgeText = 'LIMITED TIME OFFER';
      ctx.font = `bold ${SIZE * 0.015}px Arial, sans-serif`;
      const badgeW = ctx.measureText(badgeText).width + SIZE * 0.025;
      const badgeH = SIZE * 0.03;
      const badgeX = textOnRight ? SIZE - pad - badgeW : pad;
      ctx.beginPath();
      ctx.roundRect(badgeX, y, badgeW, badgeH, badgeH / 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeText, badgeX + badgeW / 2, y + badgeH / 2);
      y += badgeH + SIZE * 0.03;

      // TRUST BADGES — compact vertical list
      const BADGE_ICONS: Record<string, string> = {
        'Premium Quality': '🏆', 'Genuine Product': '✅', '100% Natural': '🌿',
        'Free Delivery': '🚚', 'Fast & Safe Delivery': '⚡', 'Best Price Guarantee': '👍',
        'Trusted Seller': '🛡️', 'Hygiene Packaging': '✨', 'Customer Support': '🎧',
        'Top Rated': '⭐', 'Eco Friendly': '♻️', 'Handpicked Selection': '💎',
        'Limited Edition': '🎁', 'Warranty Included': '🛡️', 'Loved by Customers': '❤️',
      };
      ctx.textAlign = textAlign;
      ctx.textBaseline = 'top';
      const badges = trustBadgeLabels || [];
      badges.slice(0, 4).forEach((label, i) => {
        const by = y + i * SIZE * 0.035;
        if (textOnRight) {
          ctx.font = `500 ${SIZE * 0.015}px Arial`;
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          ctx.textAlign = 'right';
          ctx.fillText(label, SIZE - pad - SIZE * 0.035, by + SIZE * 0.003);
          ctx.font = `${SIZE * 0.02}px Arial`;
          ctx.fillStyle = '#ffffff';
          ctx.fillText(BADGE_ICONS[label] || '✅', SIZE - pad, by);
        } else {
          ctx.font = `${SIZE * 0.02}px Arial`;
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'left';
          ctx.fillText(BADGE_ICONS[label] || '✅', pad, by);
          ctx.font = `500 ${SIZE * 0.015}px Arial`;
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          ctx.fillText(label, pad + SIZE * 0.032, by + SIZE * 0.003);
        }
      });

      } else {
        // === BAND LAYOUT (top / bottom) — full-width horizontal band, centered text stack ===
        const bandH = SIZE * 0.45;
        const brandingReserve = SIZE * 0.05; // bottom branding bar height; leave clearance when band is on bottom
        const bandY = onTop ? 0 : SIZE - bandH - brandingReserve;

        // Gradient: opaque on the band edge, fading toward the image side.
        const grad = onTop
          ? ctx.createLinearGradient(0, bandY, 0, bandY + bandH)
          : ctx.createLinearGradient(0, bandY + bandH, 0, bandY);
        grad.addColorStop(0, 'rgba(15,23,42,0.95)');
        grad.addColorStop(0.6, 'rgba(15,23,42,0.8)');
        grad.addColorStop(0.85, 'rgba(15,23,42,0.45)');
        grad.addColorStop(1, 'rgba(15,23,42,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, bandY, SIZE, bandH);

        const pad = SIZE * 0.04;
        const centerX = SIZE / 2;
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        // Cursor — anchored to the opaque edge of the band so text reads naturally.
        let cy = onTop ? bandY + pad : bandY + bandH * 0.18;

        // STORE NAME
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = `700 ${SIZE * 0.018}px Arial, sans-serif`;
        ctx.fillText(storeName.toUpperCase(), centerX, cy);
        cy += SIZE * 0.03;

        // HEADING (max 2 centered lines)
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${SIZE * 0.038}px Arial, sans-serif`;
        const bandHeadingLines = wrapText(dealHeading, SIZE * 0.85).slice(0, 2);
        bandHeadingLines.forEach(line => { ctx.fillText(line, centerX, cy); cy += SIZE * 0.045; });

        // Gold separator
        cy += SIZE * 0.006;
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(234,179,8,0.55)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(centerX - SIZE * 0.05, cy);
        ctx.lineTo(centerX + SIZE * 0.05, cy);
        ctx.stroke();
        cy += SIZE * 0.018;
        ctx.shadowBlur = 4;

        // OFFER VALUE
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const bandTagDiscount = tagOverride?.discountPct?.trim();
        const bandTagPrice = tagOverride?.offerPrice?.trim();
        if (bandTagDiscount || bandTagPrice) {
          if (bandTagDiscount) {
            ctx.fillStyle = '#eab308';
            ctx.font = `900 ${SIZE * 0.075}px Arial, sans-serif`;
            ctx.fillText(`${bandTagDiscount}% OFF`, centerX, cy);
            cy += SIZE * 0.078;
          }
          if (bandTagPrice) {
            const priceNum = parseFloat(bandTagPrice);
            const mrp = isFinite(priceNum) && priceNum > 0 ? Math.round(priceNum * 1.3) : null;
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${SIZE * 0.038}px Arial, sans-serif`;
            const priceLine = mrp ? `₹${bandTagPrice}   (MRP ₹${mrp})` : `₹${bandTagPrice}`;
            ctx.fillText(priceLine, centerX, cy);
            cy += SIZE * 0.045;
          }
        } else {
          const offerMatch = offerValue.match(/(\d+)\s*%/);
          if (offerMatch) {
            ctx.fillStyle = '#eab308';
            ctx.font = `900 ${SIZE * 0.075}px Arial, sans-serif`;
            ctx.fillText(`${offerMatch[1]}% OFF`, centerX, cy);
            cy += SIZE * 0.078;
          } else {
            ctx.fillStyle = '#eab308';
            ctx.font = `900 ${SIZE * 0.038}px Arial, sans-serif`;
            wrapText(offerValue, SIZE * 0.85).slice(0, 2).forEach(ln => {
              ctx.fillText(ln, centerX, cy);
              cy += SIZE * 0.045;
            });
          }
        }
        cy += SIZE * 0.008;

        // LIMITED TIME OFFER badge (centered)
        ctx.fillStyle = '#ef4444';
        const bandBadgeText = 'LIMITED TIME OFFER';
        ctx.font = `bold ${SIZE * 0.015}px Arial, sans-serif`;
        const bandBadgeW = ctx.measureText(bandBadgeText).width + SIZE * 0.025;
        const bandBadgeH = SIZE * 0.03;
        const bandBadgeX = centerX - bandBadgeW / 2;
        ctx.beginPath();
        ctx.roundRect(bandBadgeX, cy, bandBadgeW, bandBadgeH, bandBadgeH / 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(bandBadgeText, centerX, cy + bandBadgeH / 2);
        cy += bandBadgeH + SIZE * 0.018;

        // TRUST BADGES — centered, up to 4, wrapped across lines so longer labels
        // (e.g. "Best Price Guarantee") never overflow the image edges and the 4th
        // badge isn't dropped.
        const bandBadges = (trustBadgeLabels || []).slice(0, 4);
        if (bandBadges.length > 0) {
          const ICONS_INLINE: Record<string, string> = {
            'Premium Quality': '🏆', 'Genuine Product': '✅', '100% Natural': '🌿',
            'Free Delivery': '🚚', 'Fast & Safe Delivery': '⚡', 'Best Price Guarantee': '👍',
            'Trusted Seller': '🛡️', 'Hygiene Packaging': '✨', 'Customer Support': '🎧',
            'Top Rated': '⭐', 'Eco Friendly': '♻️', 'Handpicked Selection': '💎',
            'Limited Edition': '🎁', 'Warranty Included': '🛡️', 'Loved by Customers': '❤️',
          };
          ctx.font = `500 ${SIZE * 0.014}px Arial`;
          ctx.fillStyle = 'rgba(255,255,255,0.75)';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          const sep = '   ·   ';
          const maxW = SIZE * 0.9;
          const items = bandBadges.map(l => `${ICONS_INLINE[l] || '✅'} ${l}`);
          // Greedily pack items onto centered lines that each fit within maxW.
          const lines: string[] = [];
          let cur = '';
          for (const it of items) {
            const test = cur ? cur + sep + it : it;
            if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = it; }
            else { cur = test; }
          }
          if (cur) lines.push(cur);
          lines.forEach(ln => { ctx.fillText(ln, centerX, cy); cy += SIZE * 0.024; });
        }
      }

      // === BOTTOM BAR — DealPro branding (always) ===
      ctx.shadowBlur = 0;
      const barH = SIZE * 0.05;
      const barY = SIZE - barH;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, barY, SIZE, barH);

      ctx.font = `bold ${SIZE * 0.02}px Arial, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#eab308';
      const brandingPad = SIZE * 0.04;
      ctx.fillText('DealPro', brandingPad, barY + barH / 2);

      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = `${SIZE * 0.014}px Arial, sans-serif`;
      ctx.fillText('Visit Store for this Deal', SIZE - brandingPad, barY + barH / 2);

      URL.revokeObjectURL(url);

      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(imageFile); return; }
          resolve(new File([blob], `promo-banner-${Date.now()}.jpg`, { type: 'image/jpeg' }));
        },
        'image/jpeg',
        0.92
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')); };
    img.src = url;
  });
}

/**
 * Generates a "tag-only" image for ADDITIONAL deal photos: the clean product
 * photo plus a compact price-tag pill (top-left) — discount % / offer price only.
 * Deliberately omits the store name, heading, trust badges, "LIMITED TIME OFFER",
 * and branding bar so additional images never duplicate the cover's full banner.
 * (The cover image still uses generatePromoBanner with the merchant's chosen placement.)
 */
export async function generatePriceTagImage(
  imageFile: File,
  tag: { discountPct?: string; offerPrice?: string },
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(imageFile);
    img.onload = () => {
      const SIZE = Math.max(img.width, img.height, 1080);
      const canvas = document.createElement('canvas');
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) { URL.revokeObjectURL(url); resolve(imageFile); return; }

      // Dark base + center-crop the photo to a square (same framing as the cover).
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, SIZE, SIZE);
      const imgAspect = img.width / img.height;
      let drawW: number, drawH: number, drawX: number, drawY: number;
      if (imgAspect >= 1) {
        drawH = SIZE; drawW = drawH * imgAspect; drawX = (SIZE - drawW) / 2; drawY = 0;
      } else {
        drawW = SIZE; drawH = drawW / imgAspect; drawX = 0; drawY = (SIZE - drawH) / 2;
      }
      ctx.drawImage(img, drawX, drawY, drawW, drawH);

      // Compact price-tag pill, top-left. Nothing else is drawn.
      const disc = tag.discountPct?.trim();
      const price = tag.offerPrice?.trim();
      if (disc || price) {
        ctx.textBaseline = 'top';
        type TagLine = { t: string; f: string; c: string; h: number; strike?: boolean };
        const lines: TagLine[] = [];
        if (disc) lines.push({ t: `${disc}% OFF`, f: `900 ${SIZE * 0.058}px Arial, sans-serif`, c: '#eab308', h: SIZE * 0.062 });
        if (price) {
          const n = parseFloat(price);
          const mrp = isFinite(n) && n > 0 ? Math.round(n * 1.3) : null;
          lines.push({ t: `₹${price}`, f: `bold ${SIZE * 0.042}px Arial, sans-serif`, c: '#ffffff', h: SIZE * 0.05 });
          if (mrp) lines.push({ t: `MRP ₹${mrp}`, f: `${SIZE * 0.02}px Arial, sans-serif`, c: 'rgba(255,255,255,0.65)', h: SIZE * 0.028, strike: true });
        }
        let maxW = 0;
        lines.forEach(l => { ctx.font = l.f; maxW = Math.max(maxW, ctx.measureText(l.t).width); });
        const boxPad = SIZE * 0.025;
        const boxW = maxW + boxPad * 2;
        const boxH = lines.reduce((a, l) => a + l.h, 0) + boxPad * 2;
        const pad = SIZE * 0.045;
        ctx.fillStyle = 'rgba(15,23,42,0.82)';
        ctx.beginPath();
        ctx.roundRect(pad, pad, boxW, boxH, SIZE * 0.03);
        ctx.fill();
        const tx = pad + boxPad;
        let ty = pad + boxPad;
        ctx.textAlign = 'left';
        lines.forEach(l => {
          ctx.font = l.f;
          ctx.fillStyle = l.c;
          ctx.fillText(l.t, tx, ty);
          if (l.strike) {
            const w = ctx.measureText(l.t).width;
            ctx.strokeStyle = l.c;
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(tx, ty + l.h * 0.45);
            ctx.lineTo(tx + w, ty + l.h * 0.45);
            ctx.stroke();
          }
          ty += l.h;
        });
      }

      URL.revokeObjectURL(url);
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(imageFile); return; }
          // Keep the promo-banner-* name so the already-baked guard recognizes it.
          resolve(new File([blob], `promo-banner-${Date.now()}.jpg`, { type: 'image/jpeg' }));
        },
        'image/jpeg',
        0.92,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')); };
    img.src = url;
  });
}

/**
 * Generates a standalone "Free Gifts" showcase image.
 * Shows gift items horizontally with names, styled like a promotional banner.
 * Added as a separate image in the deal carousel.
 */
export async function generateFreeGiftsImage(
  gifts: { imageUrl: string; name: string }[],
  storeName: string
): Promise<File> {
  return new Promise((resolve, reject) => {
    if (gifts.length === 0) { reject(new Error('No gifts')); return; }

    // Load all gift images
    const images: HTMLImageElement[] = [];
    let loaded = 0;
    const onLoad = () => {
      loaded++;
      if (loaded < gifts.length) return;

      const SIZE = 1080;
      const canvas = document.createElement('canvas');
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('No canvas context')); return; }

      const pad = SIZE * 0.06;

      // ─── Background ───
      // Gradient from soft pink-white to white
      const bgGrad = ctx.createLinearGradient(0, 0, 0, SIZE);
      bgGrad.addColorStop(0, '#fff5f7');
      bgGrad.addColorStop(0.5, '#ffffff');
      bgGrad.addColorStop(1, '#fef2f4');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, SIZE, SIZE);

      // Subtle pattern dots
      ctx.fillStyle = 'rgba(236,72,153,0.04)';
      for (let x = 0; x < SIZE; x += 40) {
        for (let y = 0; y < SIZE; y += 40) {
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // ─── Top section: "Choose your" + "FREE GIFT" ───
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // "Choose your"
      const chooseFS = SIZE * 0.055;
      ctx.font = `600 ${chooseFS}px Arial, sans-serif`;
      ctx.fillStyle = '#64748b';
      ctx.fillText('Choose your', SIZE / 2, SIZE * 0.12);

      // "FREE GIFT" — big bold pink
      const freeFS = SIZE * 0.11;
      ctx.font = `900 ${freeFS}px Arial, sans-serif`;
      ctx.fillStyle = '#ec4899';
      ctx.fillText('FREE GIFT', SIZE / 2, SIZE * 0.21);

      // Decorative line under title
      const lineW = SIZE * 0.3;
      ctx.strokeStyle = '#ec4899';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(SIZE / 2 - lineW / 2, SIZE * 0.265);
      ctx.lineTo(SIZE / 2 + lineW / 2, SIZE * 0.265);
      ctx.stroke();

      // "with your purchase" subtitle
      const subFS = SIZE * 0.028;
      ctx.font = `500 ${subFS}px Arial, sans-serif`;
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('with your purchase at this store', SIZE / 2, SIZE * 0.30);

      // ─── Gift items section ───
      const giftCount = Math.min(gifts.length, 3);
      const giftAreaTop = SIZE * 0.36;
      const giftAreaH = SIZE * 0.45;
      const giftImgSize = giftCount === 1 ? SIZE * 0.35 : giftCount === 2 ? SIZE * 0.30 : SIZE * 0.24;
      const totalGiftWidth = giftCount * giftImgSize + (giftCount - 1) * (giftCount <= 2 ? SIZE * 0.12 : SIZE * 0.06);
      const startX = (SIZE - totalGiftWidth) / 2;
      const giftCenterY = giftAreaTop + giftAreaH * 0.4;

      gifts.slice(0, 3).forEach((gift, i) => {
        const spacing = giftCount <= 2 ? giftImgSize + SIZE * 0.12 : giftImgSize + SIZE * 0.06;
        const cx = startX + giftImgSize / 2 + i * spacing;
        const cy = giftCenterY;

        // White circle background with shadow
        ctx.save();
        ctx.shadowColor = 'rgba(236,72,153,0.15)';
        ctx.shadowBlur = 25;
        ctx.shadowOffsetY = 8;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cx, cy, giftImgSize / 2 + 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Pink border ring
        ctx.strokeStyle = '#fda4af';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, giftImgSize / 2 + 8, 0, Math.PI * 2);
        ctx.stroke();

        // Gift image — circular clip
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, giftImgSize / 2, 0, Math.PI * 2);
        ctx.clip();

        const gImg = images[i];
        if (gImg) {
          const gAspect = gImg.width / gImg.height;
          let gw, gh, gx, gy;
          if (gAspect > 1) {
            gh = giftImgSize;
            gw = giftImgSize * gAspect;
            gx = cx - gw / 2;
            gy = cy - gh / 2;
          } else {
            gw = giftImgSize;
            gh = giftImgSize / gAspect;
            gx = cx - gw / 2;
            gy = cy - gh / 2;
          }
          ctx.drawImage(gImg, gx, gy, gw, gh);
        }
        ctx.restore();

        // Gift name label below
        const nameY = cy + giftImgSize / 2 + SIZE * 0.04;
        const nameFS = SIZE * 0.025;
        ctx.font = `700 ${nameFS}px Arial, sans-serif`;
        ctx.fillStyle = '#334155';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        // Word wrap if needed
        const nameMaxW = giftImgSize + SIZE * 0.04;
        const nameWords = gift.name.split(' ');
        let nameLine = '';
        let nameLineY = nameY;
        for (const word of nameWords) {
          const test = nameLine ? `${nameLine} ${word}` : word;
          if (ctx.measureText(test).width > nameMaxW && nameLine) {
            ctx.fillText(nameLine, cx, nameLineY);
            nameLine = word;
            nameLineY += nameFS * 1.4;
          } else {
            nameLine = test;
          }
        }
        if (nameLine) ctx.fillText(nameLine, cx, nameLineY);

        // "or" text between items (not after last)
        if (i < giftCount - 1) {
          const orX = cx + spacing / 2;
          const orFS = SIZE * 0.03;
          ctx.font = `600 ${orFS}px Arial, sans-serif`;
          ctx.fillStyle = '#cbd5e1';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('or', orX, cy);
        }
      });

      // ─── Bottom bar — DealPro branding ───
      const barH = SIZE * 0.07;
      const barY = SIZE - barH;
      // Pink gradient bar
      const barGrad = ctx.createLinearGradient(0, barY, SIZE, barY);
      barGrad.addColorStop(0, '#ec4899');
      barGrad.addColorStop(1, '#f43f5e');
      ctx.fillStyle = barGrad;
      ctx.fillRect(0, barY, SIZE, barH);

      const barFS = SIZE * 0.025;
      ctx.font = `bold ${barFS}px Arial, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('DealPro', pad, barY + barH / 2);

      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = `${barFS * 0.85}px Arial, sans-serif`;
      ctx.fillText(storeName, SIZE - pad, barY + barH / 2);

      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error('Failed to create image')); return; }
          resolve(new File([blob], `free-gifts-${Date.now()}.jpg`, { type: 'image/jpeg' }));
        },
        'image/jpeg',
        0.92
      );
    };

    gifts.forEach((gift, i) => {
      const gImg = new Image();
      gImg.crossOrigin = 'anonymous';
      gImg.onload = onLoad;
      gImg.onerror = () => {
        // Create blank placeholder on error
        images[i] = new Image(1, 1);
        onLoad();
      };
      images[i] = gImg;
      gImg.src = gift.imageUrl;
    });
  });
}

export interface ImagePriceOverlay {
  discountPct: string;   // e.g. "30"
  offerPrice: string;    // e.g. "699"
}

interface MediaItem {
  type: 'file' | 'url';
  file?: File;
  url?: string;
  preview: string;
}

interface StepImageProps {
  selectedFile: File | null;
  existingThumbnail: string | null;
  additionalImageFiles: File[];
  additionalImageUrls: string[];
  selectedVideoFile: File | null;
  existingVideoUrl: string | null;
  imageLibrary: { url: string; name?: string }[];
  isLibraryLoading: boolean;
  imagePriceOverlays?: Record<number, ImagePriceOverlay>;
  onFileSelected: (file: File | null) => void;
  onExistingSelected: (url: string, name: string | null) => void;
  onAdditionalImagesChange: (files: File[], urls: string[]) => void;
  onVideoChange: (file: File | null, url: string | null) => void;
  onPriceOverlayChange?: (overlays: Record<number, ImagePriceOverlay>) => void;
  onNext: () => void;
  onBack: () => void;
  theme: 'light' | 'dark';
  // Optional deal info for promo banner generation
  storeName?: string;
  dealHeading?: string;
  offerValue?: string;
  /**
   * Merchant ID. When provided, files are uploaded to the `dealpro-drafts/`
   * Cloudinary folder once moderation passes — converting Files to URLs in
   * wizard state so server-side drafts can survive close/reopen.
   */
  merchantId?: string;
}

export const StepImage: React.FC<StepImageProps> = ({
  selectedFile, existingThumbnail, additionalImageFiles, additionalImageUrls,
  selectedVideoFile, existingVideoUrl, imageLibrary, isLibraryLoading,
  imagePriceOverlays, onFileSelected, onExistingSelected, onAdditionalImagesChange,
  onVideoChange, onPriceOverlayChange, onNext, onBack, theme,
  storeName, dealHeading, offerValue, merchantId,
}) => {
  const isDark = theme === 'dark';
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [editingOverlayIdx, setEditingOverlayIdx] = useState<number | null>(null);
  const overlays = imagePriceOverlays || {};
  const [visible, setVisible] = useState(false);
  const [checking, setChecking] = useState(false);
  const [moderationError, setModerationError] = useState<string | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [generatingBanner, setGeneratingBanner] = useState(false);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  // Drives the fullscreen video distraction overlay while images are being
  // moderated and then uploaded as drafts. Two phases mirror the work done in
  // handleContinue below.
  const [checkingPhase, setCheckingPhase] = useState<{ step: number; label: string } | null>(null);

  // Can generate banner if we have an image + at least store name or offer
  const canGenerateBanner = !!(selectedFile || existingThumbnail) && !!(storeName || offerValue || dealHeading);

  const handleGenerateBanner = async () => {
    const sourceFile = selectedFile || (existingThumbnail ? await urlToFile(existingThumbnail) : null);
    if (!sourceFile) return;
    setGeneratingBanner(true);
    try {
      const banner = await generatePromoBanner(
        sourceFile,
        storeName || 'Your Store',
        dealHeading || 'Special Deal',
        offerValue || 'Great Offer'
      );
      onFileSelected(banner);
      // Show preview
      const previewUrl = URL.createObjectURL(banner);
      setBannerPreview(previewUrl);
    } catch (err) {
      console.error('[StepImage] Banner generation failed:', err);
    } finally {
      setGeneratingBanner(false);
    }
  };

  // Helper: fetch a URL as a File (for existing thumbnails)
  async function urlToFile(url: string): Promise<File | null> {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      return new File([blob], 'existing-image.jpg', { type: blob.type });
    } catch { return null; }
  }

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  // Build the combined images list for display
  const allImages: MediaItem[] = [];

  // Primary image (slot 0)
  if (selectedFile) {
    allImages.push({ type: 'file', file: selectedFile, preview: URL.createObjectURL(selectedFile) });
  } else if (existingThumbnail) {
    allImages.push({ type: 'url', url: existingThumbnail, preview: existingThumbnail });
  }

  // Additional images
  for (const url of additionalImageUrls) {
    allImages.push({ type: 'url', url, preview: url });
  }
  for (const file of additionalImageFiles) {
    allImages.push({ type: 'file', file, preview: URL.createObjectURL(file) });
  }

  const totalImages = allImages.length;
  const canAddMore = totalImages < MAX_IMAGES;
  const hasImage = totalImages > 0;

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      allImages.forEach(item => {
        if (item.type === 'file' && item.preview) {
          URL.revokeObjectURL(item.preview);
        }
      });
    };
  }, [selectedFile, additionalImageFiles]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setModerationError(null);

    if (!hasImage) {
      // First image goes to primary slot
      onFileSelected(files[0]);
      if (files.length > 1) {
        const remaining = files.slice(1, MAX_IMAGES);
        onAdditionalImagesChange([...additionalImageFiles, ...remaining], additionalImageUrls);
      }
    } else {
      // Add to additional images
      const slotsAvailable = MAX_IMAGES - totalImages;
      const toAdd = files.slice(0, slotsAvailable);
      if (toAdd.length > 0) {
        onAdditionalImagesChange([...additionalImageFiles, ...toAdd], additionalImageUrls);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setVideoError(null);
    if (!file) return;

    if (file.size > MAX_VIDEO_SIZE_MB * 1024 * 1024) {
      setVideoError(`Video must be under ${MAX_VIDEO_SIZE_MB}MB`);
      if (videoInputRef.current) videoInputRef.current.value = '';
      return;
    }
    onVideoChange(file, null);
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  const removeImage = (index: number) => {
    if (index === 0) {
      // Removing primary image
      onFileSelected(null);
      onExistingSelected('', null);
      // Promote first additional to primary if available
      if (additionalImageUrls.length > 0) {
        const [promoUrl, ...restUrls] = additionalImageUrls;
        onExistingSelected(promoUrl, null);
        onAdditionalImagesChange(additionalImageFiles, restUrls);
      } else if (additionalImageFiles.length > 0) {
        const [promoFile, ...restFiles] = additionalImageFiles;
        onFileSelected(promoFile);
        onAdditionalImagesChange(restFiles, additionalImageUrls);
      }
    } else {
      // Removing an additional image
      const additionalIndex = index - (selectedFile || existingThumbnail ? 1 : 0);
      const urlCount = additionalImageUrls.length;

      if (additionalIndex < urlCount) {
        const newUrls = [...additionalImageUrls];
        newUrls.splice(additionalIndex, 1);
        onAdditionalImagesChange(additionalImageFiles, newUrls);
      } else {
        const fileIndex = additionalIndex - urlCount;
        const newFiles = [...additionalImageFiles];
        newFiles.splice(fileIndex, 1);
        onAdditionalImagesChange(newFiles, additionalImageUrls);
      }
    }
  };

  const removeVideo = () => {
    onVideoChange(null, null);
    setVideoError(null);
  };

  const handleLibrarySelect = (url: string, name?: string) => {
    setModerationError(null);
    if (!hasImage) {
      onFileSelected(null);
      onExistingSelected(url, name || null);
    } else if (canAddMore) {
      onAdditionalImagesChange(additionalImageFiles, [...additionalImageUrls, url]);
    }
    setShowLibrary(false);
  };

  const handleContinue = async () => {
    // Run profanity + copyright checks for every newly uploaded image, in parallel.
    // Same upload-time gate as the existing profanity check — gives the merchant
    // immediate feedback instead of waiting until the Review/Publish step to find out.
    // When a file fails, it's auto-removed from the list and the error names which
    // ones were dropped (so the merchant doesn't have to guess across N thumbnails).
    const filesToCheck = [selectedFile, ...additionalImageFiles].filter(Boolean) as File[];
    if (filesToCheck.length === 0) { onNext(); return; }

    setChecking(true);
    setCheckingPhase({ step: 1, label: t('m_checking_content') });
    setModerationError(null);
    try {
      // Run both checks per file, in parallel across all files. Whichever check
      // flags first wins for that file's `reason` field.
      const fileResults = await Promise.all(
        filesToCheck.map(async (file) => {
          const [profanity, copyright] = await Promise.all([
            addCampaignService.moderateImage(file),
            addCampaignService.checkImageCopyright(file),
          ]);
          if (profanity.flagged) return { file, flagged: true, reason: profanity.reason };
          if (copyright.flagged) return { file, flagged: true, reason: copyright.reason };
          return { file, flagged: false, reason: '' };
        }),
      );

      const flagged = fileResults.filter(r => r.flagged);
      if (flagged.length === 0) {
        // All files passed moderation. If we have a merchantId, upload to the
        // `dealpro-drafts/` Cloudinary folder and replace File refs with URLs in
        // wizard state — that way the server-side draft can persist them and the
        // merchant can resume after closing the app.
        if (merchantId && filesToCheck.length > 0) {
          setCheckingPhase({ step: 2, label: t('m_uploading_media') });
          try {
            const uploads = await Promise.all(
              filesToCheck.map(async (file) => {
                try {
                  const { publicUrl, imageName } = await addCampaignService.uploadDealImageDraft(merchantId, file);
                  return { file, url: publicUrl, name: imageName };
                } catch (err) {
                  console.warn('[StepImage] Draft upload failed (file will stay as File in state):', err);
                  return { file, url: null, name: null };
                }
              }),
            );

            // Convert cover File → URL (if uploaded successfully).
            // Only a CLEAN (un-baked) cover may become the existingThumbnail source.
            // Promoting an already-baked banner here would make the clean-source URL a
            // baked image, so a later placement re-bake would stack a second layer of
            // text (the "double text" bug). A baked cover stays as selectedImageFile.
            const coverUpload = (selectedFile && !selectedFile.name.startsWith('promo-banner-'))
              ? uploads.find(u => u.file === selectedFile)
              : null;
            const newAdditionalUploads = uploads.filter(u => u.file !== selectedFile && u.url);
            const remainingAdditionalFiles = additionalImageFiles.filter(f =>
              !uploads.some(u => u.file === f && u.url),
            );

            if (coverUpload?.url) {
              onFileSelected(null);
              onExistingSelected(coverUpload.url, coverUpload.name ?? null);
            }

            if (newAdditionalUploads.length > 0 || remainingAdditionalFiles.length !== additionalImageFiles.length) {
              const newUrls = newAdditionalUploads.map(u => u.url!).filter(Boolean);
              onAdditionalImagesChange(remainingAdditionalFiles, [...additionalImageUrls, ...newUrls]);
            }
          } catch (err) {
            // Hard failure of the upload phase shouldn't block navigation — files
            // are still in state and will be uploaded normally at publish time.
            console.warn('[StepImage] Draft uploads failed wholesale, continuing with Files in state:', err);
          }
        }
        onNext();
        return;
      }

      // Strip the flagged files from wizard state. Preserve URL slots and unflagged files.
      const flaggedSet = new Set(flagged.map(r => r.file));
      const coverFlagged = !!(selectedFile && flaggedSet.has(selectedFile));
      const cleanedFiles = additionalImageFiles.filter(f => !flaggedSet.has(f));

      if (coverFlagged) {
        // Cover removed — promote first surviving slot if any (URL first, then File).
        if (additionalImageUrls.length > 0) {
          const [promoUrl, ...restUrls] = additionalImageUrls;
          onFileSelected(null);
          onExistingSelected(promoUrl, null);
          onAdditionalImagesChange(cleanedFiles, restUrls);
        } else if (cleanedFiles.length > 0) {
          const [promoFile, ...restFiles] = cleanedFiles;
          onFileSelected(promoFile);
          onAdditionalImagesChange(restFiles, additionalImageUrls);
        } else {
          // Nothing left at all.
          onFileSelected(null);
          onAdditionalImagesChange([], additionalImageUrls);
        }
      } else if (cleanedFiles.length !== additionalImageFiles.length) {
        // Cover survived; just drop the flagged additional files.
        onAdditionalImagesChange(cleanedFiles, additionalImageUrls);
      }

      // Build the error message — list the unique reasons returned by the AI.
      const reasons = Array.from(new Set(flagged.map(r => r.reason).filter(Boolean)));
      const summary = flagged.length === 1
        ? `1 image was removed: ${reasons[0] || t('m_img_inappropriate')}`
        : `${flagged.length} images were removed: ${reasons.join(' · ') || t('m_img_inappropriate')}`;
      setModerationError(summary);
      // Stay on the step so the merchant can see the message + re-upload if needed.
    } catch {
      setModerationError(t('m_img_verify_fail'));
    } finally {
      setChecking(false);
      setCheckingPhase(null);
    }
  };

  const hasVideo = !!selectedVideoFile || !!existingVideoUrl;
  const videoPreviewUrl = selectedVideoFile ? URL.createObjectURL(selectedVideoFile) : existingVideoUrl;

  return (
    <>
    {checkingPhase && (
      <UploadVideoLoader
        step={checkingPhase.step}
        totalSteps={2}
        label={checkingPhase.label}
        theme={theme}
      />
    )}
    <div className="flex flex-col min-h-full px-6 pt-6">
      <div style={floatIn(0, visible)} className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
        <ImageIcon className="w-8 h-8 text-blue-500" />
      </div>
      <h2 style={floatIn(100, visible)} className={`text-2xl font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
        {t('m_add_media')}
      </h2>
      <p style={floatIn(200, visible)} className={`text-sm mb-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        {t('m_upload_hint')}
      </p>

      {/* ── Image Grid ── */}
      <div style={floatIn(250, visible)} className="mb-4">
        <div className="flex items-center justify-between mb-2.5">
          <p className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {t('m_images')} ({totalImages}/{MAX_IMAGES})
          </p>
          {imageLibrary.length > 0 && (
            <button
              onClick={() => setShowLibrary(!showLibrary)}
              className={`text-xs font-semibold ${isDark ? 'text-blue-400' : 'text-blue-500'}`}
            >
              {showLibrary ? t('m_hide_library') : t('m_your_images')}
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {/* Existing images */}
          {allImages.map((img, i) => {
            const overlay = overlays[i];
            const hasOverlay = overlay && (overlay.discountPct || overlay.offerPrice);
            const mrp = overlay?.offerPrice ? Math.round(parseFloat(overlay.offerPrice) * 1.3) : null;
            return (
              <div
                key={`img-${i}`}
                className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                  i === 0
                    ? 'border-blue-500 ring-2 ring-blue-500/20'
                    : isDark ? 'border-slate-700' : 'border-slate-200'
                }`}
              >
                <img src={img.preview} alt="" className="w-full h-full object-cover" />
                {/* Price overlay on image — custom tag or fallback to deal heading + offer */}
                {hasOverlay ? (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent pt-4 pb-1.5 px-2">
                    {overlay.discountPct && (
                      <span className="inline-block bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded mb-0.5">
                        {overlay.discountPct}% OFF
                      </span>
                    )}
                    <div className="flex items-center gap-1.5">
                      {overlay.offerPrice && (
                        <span className="text-white text-[10px] font-bold">₹{overlay.offerPrice}</span>
                      )}
                      {mrp && (
                        <span className="text-white/50 text-[8px] line-through">₹{mrp}</span>
                      )}
                    </div>
                  </div>
                ) : (offerValue || dealHeading) ? (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent pt-3 pb-1.5 px-2">
                    {offerValue && (
                      <p className="text-yellow-400 text-[9px] font-bold truncate">{offerValue}</p>
                    )}
                    {dealHeading && (
                      <p className="text-white text-[8px] truncate opacity-80">{dealHeading}</p>
                    )}
                  </div>
                ) : null}
                {i === 0 && (
                  <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-blue-500 text-[9px] font-bold text-white uppercase tracking-wide">
                    {t('m_cover')}
                  </div>
                )}
                {/* Tag button to add/edit price overlay */}
                <button
                  onClick={(e) => { e.stopPropagation(); setEditingOverlayIdx(editingOverlayIdx === i ? null : i); }}
                  className={`absolute bottom-1.5 right-1.5 px-1.5 py-1 rounded-md flex items-center gap-1 transition-colors ${
                    hasOverlay ? 'bg-emerald-500' : 'bg-black/50 hover:bg-black/70'
                  }`}
                >
                  <Tag className="w-3 h-3 text-white" />
                  <span className="text-[7px] font-bold text-white">{hasOverlay ? 'Edit' : 'Tag'}</span>
                </button>
                <button
                  onClick={() => removeImage(i)}
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            );
          })}

          {/* Add more button */}
          {canAddMore && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className={`aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1.5 transition-all active:scale-95 ${
                isDark
                  ? 'border-slate-700 hover:border-slate-500 text-slate-400'
                  : 'border-slate-300 hover:border-slate-400 text-slate-400'
              }`}
            >
              <Plus className="w-5 h-5" />
              <span className="text-[10px] font-semibold">{t('m_add')}</span>
            </button>
          )}
        </div>

        {/* Price overlay editor — shown when tag button tapped */}
        {editingOverlayIdx !== null && editingOverlayIdx < totalImages && (
          <div className={`mt-3 p-3 rounded-xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center justify-between mb-2.5">
              <p className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Price tag — Image {editingOverlayIdx + 1}
              </p>
              <div className="flex items-center gap-2">
                {overlays[editingOverlayIdx]?.discountPct || overlays[editingOverlayIdx]?.offerPrice ? (
                  <button
                    onClick={() => {
                      const updated = { ...overlays };
                      delete updated[editingOverlayIdx!];
                      onPriceOverlayChange?.(updated);
                    }}
                    className="text-[10px] font-medium text-red-400"
                  >
                    Clear
                  </button>
                ) : null}
                <button onClick={() => setEditingOverlayIdx(null)}>
                  <X className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className={`text-[10px] font-medium block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>% Off</label>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="30"
                    value={overlays[editingOverlayIdx]?.discountPct || ''}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 2);
                      const updated = { ...overlays, [editingOverlayIdx!]: { ...overlays[editingOverlayIdx!], discountPct: val } } as Record<number, ImagePriceOverlay>;
                      onPriceOverlayChange?.(updated);
                    }}
                    className={`w-full h-9 px-3 pr-7 rounded-lg text-sm outline-none border ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                  />
                  <Percent className={`absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                </div>
              </div>
              <div className="flex-1">
                <label className={`text-[10px] font-medium block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Offer Price (₹)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="699"
                  value={overlays[editingOverlayIdx]?.offerPrice || ''}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 7);
                    const updated = { ...overlays, [editingOverlayIdx!]: { ...overlays[editingOverlayIdx!], offerPrice: val } } as Record<number, ImagePriceOverlay>;
                    onPriceOverlayChange?.(updated);
                  }}
                  className={`w-full h-9 px-3 rounded-lg text-sm outline-none border ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                />
              </div>
              <div className="flex-1">
                <label className={`text-[10px] font-medium block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>MRP (auto)</label>
                <div className={`w-full h-9 px-3 rounded-lg text-sm flex items-center border ${isDark ? 'bg-slate-700/50 border-slate-600 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
                  {overlays[editingOverlayIdx]?.offerPrice
                    ? `₹${Math.round(parseFloat(overlays[editingOverlayIdx].offerPrice) * 1.3)}`
                    : '—'}
                </div>
              </div>
            </div>
            <p className={`text-[9px] mt-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Optional — adds price tag overlay on the image. MRP = offer price + 30%.
            </p>
          </div>
        )}
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        ref={videoInputRef}
        type="file"
        accept={ACCEPTED_VIDEO_TYPES}
        onChange={handleVideoChange}
        className="hidden"
      />

      {/* ── Image Library ── */}
      {showLibrary && (
        <div style={floatIn(0, true)} className="mb-4">
          {isLibraryLoading ? (
            <div className={`h-20 rounded-xl animate-pulse ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`} />
          ) : (
            <div className="grid grid-cols-4 gap-1.5 max-h-32 overflow-y-auto">
              {imageLibrary.map((img, i) => {
                const alreadyUsed = allImages.some(a => a.url === img.url);
                return (
                  <button
                    key={img.url + i}
                    onClick={() => !alreadyUsed && handleLibrarySelect(img.url, img.name)}
                    disabled={alreadyUsed || !canAddMore}
                    className={`relative aspect-square rounded-lg overflow-hidden border transition-all ${
                      alreadyUsed
                        ? 'opacity-40 border-emerald-500'
                        : !canAddMore
                          ? 'opacity-30 cursor-not-allowed border-slate-300'
                          : isDark ? 'border-slate-700 hover:border-blue-500' : 'border-slate-200 hover:border-blue-500'
                    }`}
                  >
                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                    {alreadyUsed && (
                      <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
                        <Check className="w-4 h-4 text-emerald-500" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Video Section ── */}
      <div style={floatIn(350, visible)} className="mb-4">
        <p className={`text-xs font-semibold uppercase tracking-wider mb-2.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          {t('m_video_optional')}
        </p>

        {hasVideo ? (
          <div className={`relative rounded-xl overflow-hidden border-2 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
            <video
              src={videoPreviewUrl || undefined}
              className="w-full h-32 object-cover bg-black"
              muted
              playsInline
              onMouseEnter={(e) => (e.target as HTMLVideoElement).play().catch(() => {})}
              onMouseLeave={(e) => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0; }}
            />
            <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 flex items-center gap-1">
              <Film className="w-3 h-3 text-white" />
              <span className="text-[10px] font-semibold text-white">
                {selectedVideoFile ? selectedVideoFile.name.slice(0, 20) : 'Video'}
              </span>
            </div>
            <button
              onClick={removeVideo}
              className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center hover:bg-black/80 transition-colors"
            >
              <X className="w-3 h-3 text-white" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => videoInputRef.current?.click()}
            className={`w-full h-14 rounded-xl border-2 border-dashed flex items-center justify-center gap-3 transition-all active:scale-[0.98] ${
              isDark
                ? 'border-slate-700 hover:border-slate-500 text-slate-400'
                : 'border-slate-300 hover:border-slate-400 text-slate-500'
            }`}
          >
            <Film className="w-5 h-5" />
            <span className="text-sm font-semibold">{t('m_add_video')}</span>
            <span className={`text-[10px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{t('m_video_max')} {MAX_VIDEO_SIZE_MB}MB</span>
          </button>
        )}

        {videoError && (
          <p className={`text-xs mt-2 ${isDark ? 'text-red-400' : 'text-red-500'}`}>{videoError}</p>
        )}
      </div>

      {/* Moderation error */}
      {moderationError && (
        <div style={floatIn(0, true)} className={`mb-4 p-3 rounded-xl ${isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'}`}>
          <p className={`text-xs ${isDark ? 'text-red-400' : 'text-red-600'}`}>{moderationError}</p>
        </div>
      )}

      {/* Hint */}
      {totalImages > 0 && totalImages < 3 && (
        <div style={floatIn(400, visible)} className={`mb-4 p-3 rounded-xl ${isDark ? 'bg-blue-500/5 border border-blue-500/10' : 'bg-blue-50/50 border border-blue-100'}`}>
          <p className={`text-[11px] ${isDark ? 'text-blue-400/70' : 'text-blue-500/70'}`}>
            {t('m_img_tip')}
          </p>
        </div>
      )}

      {/* Navigation */}
      <div style={floatIn(500, visible)} className="mt-auto pb-8 flex gap-3">
        <button
          onClick={onBack}
          className={`flex-1 h-14 rounded-xl text-base font-semibold active:scale-[0.98] transition-all ${
            isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
          }`}
        >
          {t('m_back')}
        </button>
        <button
          onClick={handleContinue}
          disabled={!hasImage || checking}
          className="flex-[2] h-14 rounded-xl bg-slate-900 text-white text-base font-semibold active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {checking ? <Loader2 className="w-5 h-5 animate-spin" /> : t('m_continue')}
        </button>
      </div>
    </div>
    </>
  );
};
