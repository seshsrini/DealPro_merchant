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
    if (!isString(field) || !['gstin', 'pan'].includes(field)) {
      return new Response(JSON.stringify({ error: 'Invalid field. Must be "gstin" or "pan".' }), {
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

    const cleanValue = value.trim().toUpperCase(); // Normalize to uppercase

    // Check if GSTIN or PAN already exists in user_profiles table
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id')
      .eq(field, cleanValue)
      .maybeSingle();

    if (error) {
      console.error(`[validate-merchant-field] Database error checking ${field}:`, error);
      return new Response(JSON.stringify({ error: 'Database query failed.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // If data exists, it means the field is taken
    const isTaken = !!data;

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
