/**
 * Pick the corner of an image with the LOWEST visual density (= lightest pixels =
 * least likely to overlap a baked text band). Used to position the small DOTD
 * badge so it doesn't sit on top of the merchant's chosen text overlay.
 *
 * Works with any cover image. The merchant's chosen banner placement (left/right/
 * top/bottom) bakes a dark gradient on the text side, so the corner with the
 * brightest sampled pixels is the most visually safe spot for the badge.
 *
 * - Image source must be CORS-readable (Cloudinary serves with proper headers).
 * - Falls back to 'tl' on any error so the badge always renders.
 * - Sampling is fast (~few ms): one canvas, four corner reads, no full-image scan.
 */

export type BadgeCorner = 'tl' | 'tr' | 'bl' | 'br';

export async function pickBadgeCornerForImage(imageUrl: string): Promise<BadgeCorner> {
  return new Promise((resolve) => {
    if (!imageUrl) { resolve('tl'); return; }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const sample = 80; // canvas size for each corner sample
        const canvas = document.createElement('canvas');
        canvas.width = sample;
        canvas.height = sample;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve('tl'); return; }

        const w = img.width;
        const h = img.height;
        // Sample the corner 25% of each dimension (or up to 200px, whichever smaller)
        const cornerW = Math.min(Math.floor(w * 0.25), 200);
        const cornerH = Math.min(Math.floor(h * 0.25), 200);

        const brightness = (sx: number, sy: number): number => {
          ctx.clearRect(0, 0, sample, sample);
          ctx.drawImage(img, sx, sy, cornerW, cornerH, 0, 0, sample, sample);
          const data = ctx.getImageData(0, 0, sample, sample).data;
          let sum = 0;
          let count = 0;
          // Sample every 4th pixel (16 byte stride) — plenty for a brightness avg.
          for (let i = 0; i < data.length; i += 16) {
            sum += data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
            count++;
          }
          return count > 0 ? sum / count : 0;
        };

        const tl = brightness(0, 0);
        const tr = brightness(w - cornerW, 0);
        const bl = brightness(0, h - cornerH);
        const br = brightness(w - cornerW, h - cornerH);

        const max = Math.max(tl, tr, bl, br);
        let corner: BadgeCorner = 'tl';
        if (max === tr) corner = 'tr';
        else if (max === bl) corner = 'bl';
        else if (max === br) corner = 'br';
        resolve(corner);
      } catch (err) {
        console.warn('[pickBadgeCornerForImage] Failed:', err);
        resolve('tl');
      }
    };
    img.onerror = () => resolve('tl');
    img.src = imageUrl;
  });
}

/**
 * Map a corner enum to the Tailwind absolute-positioning utility classes.
 * Bottom corners are bumped up to clear the DealPro branding bar (~5% of the canvas).
 */
export function cornerClass(corner: BadgeCorner, theme: 'tight' | 'safe' = 'safe'): string {
  // 'safe' gives extra clearance from the bottom branding bar; 'tight' hugs the corner.
  const top = 'top-3';
  const right = 'right-3';
  const left = 'left-3';
  const bottom = theme === 'safe' ? 'bottom-12' : 'bottom-3';
  switch (corner) {
    case 'tl': return `${top} ${left}`;
    case 'tr': return `${top} ${right}`;
    case 'bl': return `${bottom} ${left}`;
    case 'br': return `${bottom} ${right}`;
  }
}
