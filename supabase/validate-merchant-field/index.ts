// @ts-ignore: Deno global
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const isString = (value: any): boolean => typeof value === 'string';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { field, value } = body;

    // Validation
    const allowedFields = ['gstin', 'pan', 'udyam_no', 'fssai_no', 'trade_license_no', 'legal_name'];
    if (!isString(field) || !allowedFields.includes(field)) {
      return new Response(JSON.stringify({ error: `Invalid field. Must be one of: ${allowedFields.join(', ')}.` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    if (!isString(value) || value.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Value is required.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Resolve the caller so we never flag their OWN saved profile as a conflict.
    let selfId: string | null = null;
    try {
      const authHeader = req.headers.get('Authorization') || '';
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
      if (authHeader && anonKey) {
        const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
        const { data: { user } } = await userClient.auth.getUser();
        selfId = user?.id ?? null;
      }
    } catch { /* ignore — fall back to no self-exclusion */ }

    const dbFail = () => new Response(JSON.stringify({ error: 'Database query failed.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    });

    let isTaken = false;

    if (field === 'legal_name') {
      // Business-name uniqueness: case-insensitive, and also matched against the
      // legacy store_name (so pre-existing merchants' names count). Exclude self.
      const v = value.trim();
      for (const col of ['legal_name', 'store_name']) {
        let q = supabase.from('merchant_profiles').select('id').ilike(col, v).limit(1);
        if (selfId) q = q.neq('id', selfId);
        const { data, error } = await q;
        if (error) { console.error(`[validate-merchant-field] DB error checking ${col}:`, error); return dbFail(); }
        if (data && data.length > 0) { isTaken = true; break; }
      }
    } else {
      const cleanValue = value.trim().toUpperCase(); // Normalize to uppercase
      let q = supabase.from('merchant_profiles').select('id').eq(field, cleanValue).limit(1);
      if (selfId) q = q.neq('id', selfId);
      const { data, error } = await q;
      if (error) { console.error(`[validate-merchant-field] Database error checking ${field}:`, error); return dbFail(); }
      isTaken = !!(data && data.length > 0);
    }

    return new Response(JSON.stringify({ isTaken }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('[validate-merchant-field] Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
