// @ts-ignore
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  try {
    const body = await req.json().catch(() => ({}));
    const { hoarding_no } = body;

    console.log('[get-hoardings] Request:', { hoarding_no });

    // If hoarding_no is provided, fetch specific hoarding
    if (hoarding_no !== undefined && hoarding_no !== null) {
      const { data: hoarding, error } = await supabase
        .from('hoardings')
        .select('*')
        .eq('hoarding_no', hoarding_no)
        .single();

      if (error) {
        console.error('[get-hoardings] Error fetching hoarding:', error);
        throw error;
      }

      console.log('[get-hoardings] Successfully fetched hoarding:', hoarding_no);
      return new Response(
        JSON.stringify({ hoarding }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Otherwise, fetch all hoardings ordered by hoarding_no
    const { data: hoardings, error } = await supabase
      .from('hoardings')
      .select('*')
      .order('hoarding_no', { ascending: true });

    if (error) {
      console.error('[get-hoardings] Error fetching hoardings:', error);
      throw error;
    }

    console.log('[get-hoardings] Successfully fetched all hoardings:', hoardings?.length || 0);
    return new Response(
      JSON.stringify({ hoardings }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('[get-hoardings] Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal Server Error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
