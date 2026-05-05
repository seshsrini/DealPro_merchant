import { supabase } from './supabaseClient';

// ────────────────────────────────────────────────────────────────────────
// draftService — server-side persistence for in-flight wizards.
//
// Public surface:
//   - Campaign drafts (regular + DOTD + Buy & Get Free):
//       campaignDraftService.save / load / delete
//       campaignDraftService.scheduleSave(...)         // debounced 2 s
//
//   - Signup drafts (merchant onboarding, pre-registration):
//       signupDraftService.save / load / delete
//       signupDraftService.scheduleSave(...)
//
// All network failures are caught and logged — drafts are best-effort, the
// wizard's localStorage path remains the immediate fallback.
// ────────────────────────────────────────────────────────────────────────

export type CampaignDraftKind = 'regular' | 'dotd' | 'buy_get_free_regular' | 'buy_get_free_dotd';

export interface CampaignDraftRow {
  id: string;
  merchant_id: string;
  kind: CampaignDraftKind;
  current_step: number;
  payload: Record<string, any>;
  cover_image_url: string | null;
  additional_image_urls: string[];
  free_gift_image_urls: string[];
  created_at: string;
  updated_at: string;
}

export interface CampaignDraftSaveInput {
  kind: CampaignDraftKind;
  current_step: number;
  payload: Record<string, any>;
  cover_image_url?: string | null;
  additional_image_urls?: string[];
  free_gift_image_urls?: string[];
}

// ── Internal: debounce helper ──
const DEBOUNCE_MS = 2000;

function makeDebouncedSaver<T>(saveFn: (payload: T) => Promise<void>) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: T | null = null;

  return {
    schedule(payload: T) {
      pending = payload;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (pending) saveFn(pending).catch(err => {
          console.warn('[draftService] Debounced save failed (best-effort):', err?.message || err);
        });
        timer = null;
      }, DEBOUNCE_MS);
    },
    /** Force a flush immediately (e.g. before navigating away or on unmount). */
    async flush(): Promise<void> {
      if (timer) { clearTimeout(timer); timer = null; }
      if (!pending) return;
      const toSave = pending;
      pending = null;
      try { await saveFn(toSave); } catch (err: any) {
        console.warn('[draftService] Flush save failed (best-effort):', err?.message || err);
      }
    },
    /** Drop any pending save without firing it. */
    cancel() {
      if (timer) { clearTimeout(timer); timer = null; }
      pending = null;
    },
  };
}

// ── Campaign drafts ──
const _saveCampaign = async (input: CampaignDraftSaveInput): Promise<void> => {
  const { error } = await supabase.functions.invoke('manage-draft', {
    body: {
      action: 'save',
      kind: input.kind,
      current_step: input.current_step,
      payload: input.payload,
      cover_image_url: input.cover_image_url ?? null,
      additional_image_urls: input.additional_image_urls ?? [],
      free_gift_image_urls: input.free_gift_image_urls ?? [],
    },
  });
  if (error) throw error;
};

const _campaignSaver = makeDebouncedSaver(_saveCampaign);

export const campaignDraftService = {
  save: _saveCampaign,

  /** Schedule a save 2 s in the future, coalescing multiple rapid edits. */
  scheduleSave: (input: CampaignDraftSaveInput) => _campaignSaver.schedule(input),

  /** Force any pending save to fire now. Call before navigating away. */
  flushPendingSave: () => _campaignSaver.flush(),

  /** Drop any pending save (used on Start Over before delete). */
  cancelPendingSave: () => _campaignSaver.cancel(),

  /** Load the current draft for the merchant + kind, or null if none. */
  load: async (kind: CampaignDraftKind): Promise<CampaignDraftRow | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('manage-draft', {
        body: { action: 'load', kind },
      });
      if (error) throw error;
      return (data?.draft as CampaignDraftRow) || null;
    } catch (err: any) {
      console.warn('[campaignDraftService.load] Failed (best-effort):', err?.message || err);
      return null;
    }
  },

  /**
   * Delete the draft. Returns the list of orphaned Cloudinary URLs the caller
   * should pass to `addCampaignService.destroyDraftImages` for cleanup.
   */
  delete: async (kind: CampaignDraftKind): Promise<{ orphaned_image_urls: string[] }> => {
    _campaignSaver.cancel(); // Don't let a pending save resurrect the draft we just deleted.
    try {
      const { data, error } = await supabase.functions.invoke('manage-draft', {
        body: { action: 'delete', kind },
      });
      if (error) throw error;
      return { orphaned_image_urls: (data?.orphaned_image_urls as string[]) || [] };
    } catch (err: any) {
      console.warn('[campaignDraftService.delete] Failed (best-effort):', err?.message || err);
      return { orphaned_image_urls: [] };
    }
  },
};

// ── Signup drafts (JWT-keyed; merchant has already completed phone OTP) ──
export interface SignupDraftRow {
  id: string;
  user_id: string;
  current_step: number;
  payload: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface SignupDraftSaveInput {
  current_step: number;
  payload: Record<string, any>;
}

const _saveSignup = async (input: SignupDraftSaveInput): Promise<void> => {
  const { error } = await supabase.functions.invoke('manage-signup-draft', {
    body: {
      action: 'save',
      current_step: input.current_step,
      payload: input.payload,
    },
  });
  if (error) throw error;
};

const _signupSaver = makeDebouncedSaver(_saveSignup);

export const signupDraftService = {
  save: _saveSignup,
  scheduleSave: (input: SignupDraftSaveInput) => _signupSaver.schedule(input),
  flushPendingSave: () => _signupSaver.flush(),
  cancelPendingSave: () => _signupSaver.cancel(),

  load: async (): Promise<SignupDraftRow | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('manage-signup-draft', {
        body: { action: 'load' },
      });
      if (error) throw error;
      return (data?.draft as SignupDraftRow) || null;
    } catch (err: any) {
      console.warn('[signupDraftService.load] Failed (best-effort):', err?.message || err);
      return null;
    }
  },

  delete: async (): Promise<void> => {
    _signupSaver.cancel();
    try {
      const { error } = await supabase.functions.invoke('manage-signup-draft', {
        body: { action: 'delete' },
      });
      if (error) throw error;
    } catch (err: any) {
      console.warn('[signupDraftService.delete] Failed (best-effort):', err?.message || err);
    }
  },
};
