import { supabase } from "./supabaseClient";

export type AnnouncementUsage = { used: number; limit: number; hasSubscription: boolean };
export type NearbyArea = { locality: string; pincode: string };
export type TargetingOptions = { city: string | null; anchorPincode: string | null; nearbyAreas: NearbyArea[] };
export type LinkableDeal = { campaign_id: string; deal_heading: string };
export type MerchantStore = { id: string; store_name: string; locality: string; city: string; state: string; pincode: string; phone: string };

/** The merchant's stores, for the store selector. */
export async function fetchStores(merchantId: string): Promise<MerchantStore[]> {
  const { data } = await supabase
    .from("merchant_stores")
    .select("id, store_name, locality, city, state, pincode, store_phone")
    .eq("merchant_id", merchantId)
    .order("created_at", { ascending: true });
  return (data || []).map((s: any) => ({
    id: s.id,
    store_name: s.store_name || "Store",
    locality: s.locality || "",
    city: s.city || "",
    state: s.state || "",
    pincode: s.pincode ? String(s.pincode) : "",
    phone: s.store_phone ? String(s.store_phone) : "",
  }));
}

/** The given store's own area + geographically nearest areas in the same city,
 *  plus the city (for the "All of <city>" option). Fails open so the wizard
 *  still renders even if the geo function is unavailable. */
export async function fetchNearbyAreas(store: { pincode: string; city: string; locality: string }): Promise<TargetingOptions> {
  const fallback: TargetingOptions = {
    city: store.city || null,
    anchorPincode: store.pincode || null,
    nearbyAreas: store.locality && store.pincode ? [{ locality: store.locality, pincode: store.pincode }] : [],
  };
  try {
    if (!store.pincode) return fallback;
    const { data, error } = await supabase.functions.invoke("get-nearby-areas", {
      body: { pincode: store.pincode, city: store.city || "", locality: store.locality || "" },
    });
    if (error || !data) return fallback;
    return {
      city: (data as any).city || store.city || null,
      anchorPincode: (data as any).anchorPincode || store.pincode,
      nearbyAreas: ((data as any).areas || []) as NearbyArea[],
    };
  } catch {
    return fallback;
  }
}

export type AnnouncementStatus = 'active' | 'scheduled' | 'expired';
export type MyAnnouncement = {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  send_from: string;
  send_to: string;
  target_type: 'area' | 'city';
  target_city: string | null;
  target_localities: string[] | null;
  target_pincodes: string[] | null;
  linked_campaign_id: string | null;
  show_store_contact: boolean;
  created_at: string;
  status: AnnouncementStatus;
};

/** All of the merchant's announcements (RLS: merchant reads own), newest first,
 *  with a computed status. Sorted active/scheduled before expired. */
export async function fetchMyAnnouncements(merchantId: string): Promise<MyAnnouncement[]> {
  const { data } = await supabase
    .from("announcements")
    .select("id, title, description, image_url, send_from, send_to, target_type, target_city, target_localities, target_pincodes, linked_campaign_id, show_store_contact, created_at")
    .eq("merchant_id", merchantId)
    .order("created_at", { ascending: false });
  const today = new Date().toISOString().slice(0, 10);
  const rows: MyAnnouncement[] = (data || []).map((a: any) => ({
    ...a,
    status: (a.send_to < today ? "expired" : a.send_from > today ? "scheduled" : "active") as AnnouncementStatus,
  }));
  // Active + scheduled first (non-expired), expired last; recency within each.
  const rank = (s: AnnouncementStatus) => (s === "expired" ? 1 : 0);
  return rows.sort((a, b) =>
    rank(a.status) - rank(b.status) || (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
}

/** The merchant's active deals, for the optional "link to a deal" picker. */
export async function fetchLinkableDeals(merchantId: string): Promise<LinkableDeal[]> {
  const { data } = await supabase
    .from("campaigns")
    .select("campaign_id, deal_heading")
    .eq("merchant_id", merchantId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(50);
  return (data || []).map((d: any) => ({ campaign_id: d.campaign_id, deal_heading: d.deal_heading || "Untitled deal" }));
}

/** Upload one image to Cloudinary via the signed cloudinary-sign function. */
export async function uploadAnnouncementImage(file: File): Promise<string> {
  const { data: sign, error } = await supabase.functions.invoke("cloudinary-sign", { body: { folder: "dealpro-announcements" } });
  if (error || !sign) throw new Error("Could not prepare the image upload. Please try again.");
  const form = new FormData();
  form.append("file", file);
  form.append("api_key", sign.api_key);
  form.append("timestamp", String(sign.timestamp));
  form.append("signature", sign.signature);
  form.append("folder", sign.folder);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${sign.cloud_name}/image/upload`, { method: "POST", body: form });
  const json = await res.json();
  if (!res.ok || !json.secure_url) throw new Error("Image upload failed. Please try again.");
  return json.secure_url as string;
}

export type CreateAnnouncementInput = {
  title: string;
  description: string;
  image_url?: string | null;
  linked_campaign_id?: string | null;
  send_from: string; // YYYY-MM-DD
  target_type: "area" | "city";
  target_city?: string | null;         // for 'city'
  target_localities?: string[];        // for 'area' (1..3)
  target_pincodes?: string[];          // for 'area' (1..3), parallel to localities
  store_id?: string | null;            // selected store; null = all stores
  show_store_contact?: boolean;        // include address + phone in the banner
  contact_store_id?: string | null;    // which store's contact to show
};

/** Current-cycle announcement allowance/usage for gating the UI. Fails open. */
export async function fetchAnnouncementUsage(): Promise<AnnouncementUsage> {
  try {
    const { data, error } = await supabase.functions.invoke("create-announcement", { body: { check: true } });
    const u = (data as any)?.usage;
    if (error || !u) return { used: 0, limit: 0, hasSubscription: false };
    return { used: Number(u.used ?? 0), limit: Number(u.limit ?? 0), hasSubscription: !!u.hasSubscription };
  } catch {
    return { used: 0, limit: 0, hasSubscription: false };
  }
}

export async function createAnnouncement(input: CreateAnnouncementInput) {
  const { data, error } = await supabase.functions.invoke("create-announcement", { body: input });
  const body = data || (error as any)?.context;
  if (body?.error) throw new Error(body.error);
  if (error && !body?.success) throw new Error(error.message || "Could not create the announcement.");
  return body as { success: true; announcement: any; remaining: number };
}
