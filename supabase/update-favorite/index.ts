if (req.method === 'OPTIONS') {

return new Response('ok', { headers: corsHeaders });

}
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// 1. GLOBAL CORS HEADERS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Validation Helpers
export const isString = (value: any): value is string => typeof value === 'string';
export const isValidEmail = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
export const isValidPhoneNumber = (phone: string): boolean => /^\+[1-9]\d{1,14}$/.test(phone);
export const isValidPassword = (pw: string): boolean => /^(?=.*[A-Z])(?=.*\d)[^\s]{8,15}$/.test(pw);

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
  // 2. HANDLE CORS PREFLIGHT
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
    // 3. AUTHENTICATION
    const user = await authenticateRequest(req);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
    });

    const { id, role, data } = await req.json();
    console.log('[UpdateFavorite] Updating profile for:', id, 'role:', role);

    // 4. AUTHORIZATION CHECK
    if (!isString(id) || id !== user.id) {
       return new Response(JSON.stringify({ error: "Unauthorized: Profile ID mismatch." }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403 
      });
    }

    // 5. DATA SANITIZATION & VALIDATION
    const table = role?.startsWith('merchant') ? 'merchants' : 'consumers';
    const updatePayload: any = {};

    if (data.full_name !== undefined) {
      if (!isString(data.full_name) || data.full_name.length < 1) throw new Error("Invalid name");
      updatePayload.full_name = data.full_name;
    }

    if (data.email !== undefined) {
      if (!isValidEmail(data.email)) throw new Error("Invalid email format");
      updatePayload.email = data.email;
    }

    // MERCHANT SPECIFIC FIELDS
    if (table === 'merchants') {
        if (data.store_name) updatePayload.store_name = data.store_name;
        if (data.category) updatePayload.category = data.category;
    }

    if (Object.keys(updatePayload).length === 0 && !data.password) {
        return new Response(JSON.stringify({ error: 'No valid fields provided.' }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        });
    }

    // 6. DB UPDATE
    const { error: dbError } = await supabase.from(table).update(updatePayload).eq('id', id);
    if (dbError) throw dbError;

    // 7. OPTIONAL PASSWORD UPDATE (via Auth service, not custom table)
    if (data.password) {
        if (!isValidPassword(data.password)) throw new Error("Password does not meet requirements");
        const { error: authError } = await supabase.auth.updateUser({ password: data.password });
        if (authError) throw authError;
    }

    return new Response(JSON.stringify({ message: 'Profile updated successfully.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Update Error:', error.message);
    
    const status = error.message.includes('Unauthorized') ? 401 : 400;
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: status,
    });
  }
});