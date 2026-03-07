import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { campaignId } = await req.json()

    // 1. Fetch Campaign
    const { data: campaign, error: cError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('campaign_id', campaignId)
      .single()

    if (cError) throw cError

    // 2. Fetch Store
    let store_details = null
    if (campaign.store_id) {
      const { data: store } = await supabase
        .from('merchant_stores')
        .select('*')
        .eq('id', campaign.store_id)
        .single()
      store_details = store
    }

    // 3. Universal Mapping (Sends everything to avoid "N/A" or blank fields)
    const responseData = {
      ...campaign,
      // Key mappings for safety
      id: campaign.campaign_id,
      campaignId: campaign.campaign_id,
      merchantId: campaign.merchant_id,
      shopName: campaign.shop_name,
      dealHeading: campaign.deal_heading,
      offerValue: campaign.offer_value,
      longDescription: campaign.long_description,
      thumbnail: campaign.image_url, // Maps image_url to thumbnail
      imageUrl: campaign.image_url,
      store_details: store_details,
      // Flattened address for the UI
      displayAddress: store_details
        ? [store_details.address, store_details.locality, store_details.city, store_details.state, store_details.pincode]
            .filter(Boolean).join(', ')
        : '',
      // Flattened store fields for Deal details page
      address: store_details
        ? [store_details.address, store_details.locality, store_details.city, store_details.state, store_details.pincode]
            .filter(Boolean).join(', ')
        : '',
      street: store_details?.address || '',
      locality: store_details?.locality || '',
      landmark: store_details?.landmark || '',
      storeHrs: store_details?.store_hours || store_details?.storeHrs || store_details?.store_hrs || '',
      pincode: store_details?.pincode || '',
      city: store_details?.city || campaign.city || '',
      state: store_details?.state || campaign.state || ''
    }

    return new Response(JSON.stringify(responseData), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400 
    })
  }
})