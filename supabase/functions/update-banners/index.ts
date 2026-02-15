// @ts-ignore
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  try {
    const body = await req.json();
    const { hoarding_no, topic, heading, description, images } = body;

    console.log('[update-banners] Request:', { hoarding_no, topic, heading, description, hasImages: !!images });

    // Validate required fields
    if (!hoarding_no || !topic || !heading || !description) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: hoarding_no, topic, heading, description' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Update the hoarding record
    const { data: updatedHoarding, error } = await supabase
      .from('hoardings')
      .update({
        topic,
        heading,
        description,
        images: images || [],
        modified_at: new Date().toISOString()
      })
      .eq('hoarding_no', hoarding_no)
      .select()
      .single();

    if (error) {
      console.error('[update-banners] Error updating hoarding:', error);
      throw error;
    }

    console.log('[update-banners] Successfully updated hoarding:', hoarding_no);
    return new Response(
      JSON.stringify({ success: true, hoarding: updatedHoarding }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('[update-banners] Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal Server Error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
