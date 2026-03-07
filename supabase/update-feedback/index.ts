// @ts-ignore: Deno is a global in Deno runtime
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// GLOBAL CORS HEADERS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Validation Helpers
export const isString = (value: any): value is string => typeof value === 'string';
export const isPositiveNumber = (value: any): value is number => typeof value === 'number' && value >= 0;

// Authenticate helper with CORS awareness
export async function authenticateRequest(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase environment variables are not set.');
  }

  const authHeader = req.headers.get('Authorization');
  const jwt = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: jwt ? { Authorization: `Bearer ${jwt}` } : {} },
  });

  const { data: { user }, error } = await supabase.auth.getUser(jwt);
  if (error || !user) throw new Error('Unauthorized: Invalid or expired token.');
  return user;
}

Deno.serve(async (req) => {
  // HANDLE CORS PREFLIGHT
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
    // AUTHENTICATION
    const user = await authenticateRequest(req);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
    });

    const { interactionId, rating, comments = "" } = await req.json();
    console.log('[UpdateFeedback] Rating:', rating, 'for interaction:', interactionId);

    // INPUT VALIDATION
    if (!isString(interactionId) || !isPositiveNumber(rating) || rating < 1 || rating > 5) {
      return new Response(JSON.stringify({ error: 'Valid Interaction ID and Rating (1-5) are required.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    // INTERACTION VERIFICATION
    // Ensure the interaction exists and belongs to the user before allowing a rating
    const { data: interaction, error: selectError } = await supabase
      .from('campaign_interactions')
      .select('merchant_id, campaign_id')
      .eq('interaction_id', interactionId)
      .eq('consumer_id', user.id)
      .single();

    if (selectError) {
      const status = selectError.code === 'PGRST116' ? 404 : 400;
      return new Response(JSON.stringify({ error: 'Interaction not found or unauthorized.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status
      });
    }

    // SUBMIT RATING
    const { error: insertError } = await supabase
      .from('merchant_ratings')
      .insert({
        consumer_id: user.id,
        merchant_id: interaction.merchant_id,
        campaign_id: interaction.campaign_id,
        rating,
        comments
      });

    if (insertError) {
      // Handle Postgres Unique Constraint (One rating per interaction/campaign)
      if (insertError.code === '23505') {
        return new Response(JSON.stringify({ error: 'Feedback already submitted for this interaction.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 409
        });
      }
      throw insertError;
    }

    return new Response(JSON.stringify({ message: 'Feedback submitted successfully.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('[update-feedback] Error:', error.message);
    const status = error.message.includes('Unauthorized') ? 401 : 500;
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status,
    });
  }
});
