// supabase/get-merchant-payments
// Returns the authenticated merchant's payment activity for the last 12 months
// from merchant_payments (the ledger written by the razorpay-webhook on each
// subscription.charged). Includes the Razorpay confirmation code (transaction_id).
// @ts-ignore
declare const Deno: { env: { get(k: string): string | undefined }; serve: (h: (r: Request) => Promise<Response> | Response) => void };
import { createClient } from 'https://esm.sh/@supabase/supabase-js@^2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // Authenticate the merchant from their JWT.
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return json({ error: 'Unauthorized' }, 401);
  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401);

  // Last 12 months.
  const since = new Date();
  since.setMonth(since.getMonth() - 12);

  const { data, error } = await supabaseAdmin
    .from('merchant_payments')
    .select('id, transaction_id, order_id, amount_base, amount_total, currency, payment_method, payment_status, failure_reason, created_at')
    .eq('merchant_id', user.id)
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    console.error('[get-merchant-payments] query failed:', error.message);
    return json({ error: 'Could not load payment activity.' }, 500);
  }

  const payments = data || [];
  const captured = payments.filter((p) => p.payment_status === 'captured');
  const totalPaid = captured.reduce((sum, p) => sum + Number(p.amount_total || 0), 0);

  return json({
    payments,
    summary: {
      total_count: payments.length,
      captured_count: captured.length,
      total_paid: totalPaid,
      currency: payments[0]?.currency || 'INR',
      last_payment_at: payments[0]?.created_at || null,
      window_months: 12,
    },
  });
});
