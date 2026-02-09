// This file is no longer used by Supabase Edge Functions.
// Each Edge Function and the `auth.ts` utility now directly initializes
// its Supabase client using `createClient` from `@supabase/supabase-js` CDN
// and retrieves environment variables via `Deno.env.get` internally.