import { supabase } from './supabaseClient';

/**
 * Upload a product photo to Cloudinary (folder dealpro-products) with a signature from the
 * cloudinary-sign edge function — the same path the product wizard uses — and return its URL
 * and pixel size. Retries transient failures.
 */
export async function uploadProductPhoto(file: File): Promise<{ url: string; width: number | null; height: number | null }> {
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { data: signData, error: signErr } = await supabase.functions.invoke('cloudinary-sign', {
        body: { folder: 'dealpro-products' },
      });
      if (signErr) throw new Error('Upload preparation failed');
      const { signature, timestamp, api_key, cloud_name, folder } = signData;
      const form = new FormData();
      form.append('file', file);
      form.append('signature', signature);
      form.append('timestamp', String(timestamp));
      form.append('api_key', api_key);
      form.append('folder', folder);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`, {
        method: 'POST', body: form, signal: AbortSignal.timeout(45000),
      });
      if (!res.ok) throw new Error('Upload failed');
      const json = await res.json();
      return { url: json.secure_url as string, width: Number(json.width) || null, height: Number(json.height) || null };
    } catch (e) {
      lastErr = e;
      if (attempt < 3) await new Promise((r) => setTimeout(r, 700 * attempt));
    }
  }
  throw lastErr || new Error('Upload failed');
}
