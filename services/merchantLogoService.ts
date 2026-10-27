import { supabase } from './supabaseClient';

/** Logo edge length after cropping (px). Small enough to upload fast, sharp at any size we show. */
const LOGO_SIZE = 512;

/**
 * Center-crops an image file to a square and scales it to LOGO_SIZE, as a JPEG
 * data URI. Transparent PNGs are flattened onto white so they don't turn black.
 */
export async function squareLogoDataUri(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('This file could not be read as an image.'));
      i.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    if (!side) throw new Error('This file could not be read as an image.');
    const sx = (img.naturalWidth - side) / 2;
    const sy = (img.naturalHeight - side) / 2;
    const canvas = document.createElement('canvas');
    canvas.width = LOGO_SIZE;
    canvas.height = LOGO_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Image processing is not available on this device.');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, LOGO_SIZE, LOGO_SIZE);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, side, side, 0, 0, LOGO_SIZE, LOGO_SIZE);
    return canvas.toDataURL('image/jpeg', 0.88);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function call(body: Record<string, unknown>): Promise<{ logo_url: string | null }> {
  const { data, error } = await supabase.functions.invoke('set-merchant-logo', { body });
  if (!error && data && !data.error) return { logo_url: data.logo_url ?? null };
  let msg = data?.error as string | undefined;
  if (!msg && error && (error as any).context) {
    try { msg = (await (error as any).context.json())?.error; } catch { /* not JSON */ }
  }
  throw new Error(msg || 'Could not save the logo. Please try again.');
}

export const merchantLogoService = {
  /** Crops, content-checks (server) and saves the logo. Throws with a merchant-friendly message on rejection. */
  setLogo: async (file: File) => call({ action: 'set', image: await squareLogoDataUri(file) }),
  removeLogo: async () => call({ action: 'remove' }),
};
