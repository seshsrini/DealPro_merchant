
// @ts-ignore: Deno is a global in Deno runtime, but TS might not resolve 'deno.ns' lib
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve: (handler: (req: Request) => Promise<Response> | Response) => void;
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.49.1';

// Inlined content of validation.ts
export function isValidUUID(uuid: string): boolean {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return regex.test(uuid);
}

export function isValidEmail(email: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

export function isValidPhoneNumber(phone: string): boolean {
  const regex = /^\+[1-9]\d{1,14}$/; // E.g., +919999999999
  return regex.test(phone);
}

export function isPositiveNumber(value: number): boolean {
  return typeof value === 'number' && value >= 0;
}

export function isString(value: any): boolean {
  return typeof value === 'string';
}

export function isBoolean(value: any): boolean {
  return typeof value === 'boolean';
}

export function isObject(value: any): boolean {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isArray(value: any): boolean {
  return Array.isArray(value);
}

export function isDateString(value: string): boolean {
  return !isNaN(new Date(value).getTime());
}

export function isValidPassword(password: string): boolean {
  // At least 8 characters, at most 15, one uppercase, one number, and no spaces.
  const regex = /^(?=.*[A-Z])(?=.*\d)[^\s]{8,15}$/;
  return regex.test(password);
}
// End of inlined validation.ts

// Inlined content of authenticateRequest
export async function authenticateRequest(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase environment variables are not set.');
  }

  const authHeader = req.headers.get('Authorization');
  const jwt = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!jwt) {
    throw new Error('Unauthorized: No access token provided.');
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { Authorization: `Bearer ${jwt}` },
    },
  });

  const { data: { user }, error } = await supabase.auth.getUser(jwt);

  if (error || !user) {
    console.error('JWT authentication failed:', error?.message);
    throw new Error('Unauthorized: Invalid or expired token.');
  }

  return user;
}
// End of inlined authenticateRequest

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

Deno.serve(async (req) => {
  // 1. MUST HAVE THIS FOR EVERY FUNCTION
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(JSON.stringify({ error: 'Supabase environment variables are not set.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }

  try {
    const user = await authenticateRequest(req);
    // Extract the JWT from the incoming request's Authorization header again
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: { Authorization: `Bearer ${jwt}` }, // Pass the JWT here!
      },
    });

    const { userId, campaignId, merchantId } = await req.json();
    console.log('[ToggleFavorite] User:', userId, 'campaign:', campaignId);

    // 1. Validate Input Data
    if (!isString(userId as string) || (userId as string).length < 1) {
      return new Response(JSON.stringify({ error: 'User ID is required.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }
    // Authorization check
    if (userId !== user.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Cannot toggle favorites for another user.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 });
    }
    if (!isString(campaignId as string) || (campaignId as string).length < 1) {
      return new Response(JSON.stringify({ error: 'Campaign ID is required.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }
    if (!isString(merchantId as string) || (merchantId as string).length < 1) {
      return new Response(JSON.stringify({ error: 'Merchant ID is required.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }

    // Check if the favorite already exists
    const { data: existingFavorite, error: selectError } = await supabase
      .from('favorites')
      .select('id, active_favorite')
      .eq('user_id', userId)
      .eq('campaign_id', campaignId)
      .maybeSingle();

    if (selectError) {
      throw selectError;
    }

    if (existingFavorite) {
      // Toggle the active_favorite status
      const { error: updateError } = await supabase
        .from('favorites')
        .update({ active_favorite: !existingFavorite.active_favorite })
        .eq('id', existingFavorite.id);
      
      if (updateError) {
        throw updateError;
      }
      return new Response(JSON.stringify({ 
        message: 'Favorite status toggled successfully.', 
        active_favorite: !existingFavorite.active_favorite 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    } else {
      // Create a new favorite entry
      const { data: newFavorite, error: insertError } = await supabase
        .from('favorites')
        .insert([{ 
          user_id: userId, 
          campaign_id: campaignId, 
          merchant_id: merchantId, 
          active_favorite: true 
        }])
        .select()
        .single();
      
      if (insertError) {
        throw insertError;
      }
      return new Response(JSON.stringify({ 
        message: 'Campaign added to favorites.', 
        active_favorite: true, 
        favorite: newFavorite 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 201,
      });
    }
  } catch (error: any) {
    console.error('Failed to toggle favorite:', error.message);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: error.message.includes('Unauthorized') ? 401 : error.message.includes('Method Not Allowed') ? 405 : 500,
    });
  }
});
