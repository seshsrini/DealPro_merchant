import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const bucketName = Deno.env.get('STORAGE_BUCKET_NAME') || 'dealproDEV_Images'

    const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '')
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify User
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader)
    if (authError || !user) throw new Error('Auth failed: ' + authError?.message)

    const formData = await req.formData()
    const file = formData.get('file') as File
    const merchantId = formData.get('merchantId')

    if (!file) throw new Error('File object is missing in request')

    // DEBUG: Log the attempt
    console.log(`Attempting upload to bucket: "${bucketName}" for path: ${merchantId}/${file.name}`)

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(`${merchantId}/${Date.now()}_${file.name}`, file, {
        contentType: file.type,
        upsert: true
      })

    if (uploadError) {
        // This will print the exact reason (e.g., "Bucket not found") to your Supabase Logs
        console.error("Storage Error Details:", uploadError)
        throw new Error(`Storage Error: ${uploadError.message}`)
    }

    const { data: { publicUrl } } = supabase.storage.from(bucketName).getPublicUrl(uploadData.path)

    return new Response(JSON.stringify({ publicUrl, imageName: uploadData.path }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})