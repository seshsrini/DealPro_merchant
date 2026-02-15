

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Deal, AppView, User } from './types';
import { addCampaignService } from './services/addCampaignService';
import { useTranslation } from './contexts/LanguageContext';
import {
  ShieldCheck,
  Loader2,
  CheckCircle2,
  X,
  Edit2,
  Globe,
  Clock,
  AlertCircle,
  Megaphone,
  ChevronRight,
  Calendar
} from 'lucide-react';

interface DealAdminReviewDealsProps {
  user: User;
  deals: Deal[]; // These deals are already pre-filtered for 'review' status by App.tsx
  loading: boolean;
  setLoading: (loading: boolean) => void;
  refreshDeals: () => Promise<void>; // Refreshes the admin's deal list
  setView: (view: AppView) => void;
  setDealIdToEdit: (id: string | null) => void;
}

const DEFAULT_DEAL_IMAGE = 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=600&q=80';

// Helper to construct Supabase storage URL from image_name
const getSupabaseImageUrl = (imageName: string | undefined): string | null => {
  if (!imageName) return null;
  // Construct Supabase storage public URL
  // Format: https://<project-ref>.supabase.co/storage/v1/object/public/dealproDEV_Images/<merchant-id>/<image-name>
  const projectUrl = 'https://gkulyxglzqlhpqxlwjqw.supabase.co';
  return `${projectUrl}/storage/v1/object/public/dealproDEV_Images/${imageName}`;
};

export const DealAdminReviewDeals: React.FC<DealAdminReviewDealsProps> = ({
  user, deals, loading, setLoading, refreshDeals, setView, setDealIdToEdit
}) => {
  const { t, getLocalizedText } = useTranslation();
  const [showApprovalSuccess, setShowApprovalSuccess] = useState(false);
  const [activeProcessingDealId, setActiveProcessingDealId] = useState<string | null>(null);

  // Console log the fetched deals payload
  useEffect(() => {
    console.log("[DealAdminReviewDeals] Fetched 'in review' campaigns payload:", deals);
    console.log("[DealAdminReviewDeals] Image debugging:", deals.map((d: any) => ({
      campaign_id: d.campaign_id,
      thumbnail: d.thumbnail,
      image_name: d.image_name,
      merchantId: d.merchantId,
      merchant_id: d.merchant_id
    })));
  }, [deals]);

  const getCampaignImage = (deal: Deal) => {
    // Try thumbnail field first (should be full URL from database)
    if (deal.thumbnail && deal.thumbnail.startsWith('http')) {
      console.log(`[DealAdminReviewDeals] Using thumbnail URL for campaign ${deal.campaign_id}:`, deal.thumbnail);
      return deal.thumbnail;
    }

    // Try constructing from image_name as fallback
    if (deal.image_name) {
      const constructedUrl = getSupabaseImageUrl(deal.image_name);
      console.log(`[DealAdminReviewDeals] Constructed URL for campaign ${deal.campaign_id}:`, constructedUrl);
      if (constructedUrl) return constructedUrl;
    }

    // Fallback to default
    console.log(`[DealAdminReviewDeals] Using default image for campaign ${deal.campaign_id}`);
    return DEFAULT_DEAL_IMAGE;
  };

  const handleApproveCampaign = useCallback(async (deal: Deal) => {
    // Fix: Use campaign_id
    setActiveProcessingDealId(deal.campaign_id); 
    setLoading(true);
    try {
      // NEW: Call the specific approveCampaign service
      // Fix: Use campaign_id and merchantId
      await addCampaignService.approveCampaign(deal.campaign_id, deal.merchantId); 
      setShowApprovalSuccess(true);
      await refreshDeals(); // Refresh the list to remove the approved deal
      setTimeout(() => setShowApprovalSuccess(false), 2000);
    } catch (e: any) {
      console.error("Failed to approve campaign:", e);
      alert(e.message || "Failed to approve campaign. Please try again.");
    } finally {
      setLoading(false);
      setActiveProcessingDealId(null);
    }
  }, [setLoading, refreshDeals]);

  const handleEditCampaign = useCallback((deal: Deal) => {
    // Fix: Use campaign_id
    setDealIdToEdit(deal.campaign_id); 
    setView('dealadmin_edit_deal'); // Navigate to the admin edit view
  }, [setDealIdToEdit, setView]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) {
      console.error("Error formatting date:", dateStr, e);
      return dateStr;
    }
  };

  return (
    <div className="px-3 pt-3 pb-24 animate-reveal space-y-3">
      {showApprovalSuccess && (
        <div className="fixed inset-0 z-[500] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-reveal">
          <div className="w-full max-w-xs glass rounded-2xl border-white/10 p-6 relative overflow-hidden shadow-[0_0_30px_rgba(16,185,129,0.2)] text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4 shadow-[0_0_20px_rgba(16,185,129,0.3)] border border-emerald-500/30">
              <CheckCircle2 className="w-10 h-10 text-emerald-500" />
            </div>
            <h3 className="text-lg font-black uppercase text-white">Campaign Approved</h3>
            <p className="text-slate-400 text-[10px] mt-1 leading-relaxed">The campaign is now live on the grid!</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black uppercase tracking-tighter leading-none text-white">Admin<br/><span className="text-emerald-500">Console</span></h2>
          <div className="flex items-center gap-1.5 mt-1">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
            <p className="text-[8px] font-black text-emerald-600 uppercase tracking-[0.2em]">Campaign Oversight</p>
          </div>
        </div>
        <div className="w-8 h-8 glass rounded-xl flex items-center justify-center border-white/10">
          <Globe className="w-4 h-4 text-slate-400" />
        </div>
      </div>

      <h3 className="text-sm font-black uppercase tracking-tighter text-white">Campaigns in Review</h3>
      <p className="text-[7px] font-black uppercase tracking-widest text-slate-500 -mt-2">
        Approve or modify pending campaigns
      </p>

      {loading && !activeProcessingDealId ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
          <p className="text-[8px] font-black uppercase tracking-[0.3em] text-slate-500 animate-pulse">Fetching review campaigns...</p>
        </div>
      ) : deals.length === 0 ? (
        <div className="text-center py-8 glass rounded-2xl border-white/10 mx-1 bg-slate-950/40">
          <ShieldCheck className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
          <p className="text-[9px] font-bold text-slate-300 mb-2 px-4 leading-relaxed">
            All campaigns are up-to-date and approved. No pending reviews.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {deals.map(deal => (
            <div key={deal.campaign_id} className="deal-card group animate-reveal flex flex-col bg-white/[0.03] border border-white/10 rounded-lg overflow-hidden shadow-xl">
              <div className="relative aspect-[4/3] overflow-hidden bg-slate-800">
                <img src={getCampaignImage(deal)} alt={deal.shopName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent"></div>

                <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-blue-600/90 backdrop-blur-md border border-white/20 text-white text-[7px] font-black uppercase tracking-wide shadow-md">
                  {deal.category}
                </div>

                <div className="absolute bottom-1.5 left-1.5 right-1.5">
                  <p className="text-[7px] font-black uppercase tracking-[0.1em] text-blue-400 mb-0.5 truncate">{deal.shopName}</p>
                  <h3 className="text-[10px] font-black text-white leading-tight uppercase line-clamp-2">
                    {getLocalizedText(deal.localized_heading, deal.deal_heading || deal.details)}
                  </h3>
                  <p className="text-amber-400 text-[8px] font-black uppercase tracking-wide mt-0.5 truncate">
                    {getLocalizedText(deal.localized_offer, deal.offer_value)}
                  </p>
                </div>
              </div>

              <div className="p-2 space-y-1.5">
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1 px-1.5 py-0.5 glass rounded border-white/10">
                    <Calendar className="w-2 h-2 text-slate-500" />
                    <span className="text-[6px] font-black text-slate-400 uppercase tracking-tight">
                       {formatDate(deal.start_date)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 px-1.5 py-0.5 glass rounded border-white/10">
                    <Clock className="w-2 h-2 text-slate-500" />
                    <span className="text-[6px] font-black text-slate-400 uppercase tracking-tight">
                       {formatDate(deal.end_date)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-center">
                  <span className="flex items-center gap-0.5 text-amber-500 text-[7px]"><AlertCircle className="w-2 h-2" /> In Review</span>
                </div>

                <div className="flex gap-1.5 pt-0.5">
                  <button
                    onClick={() => handleApproveCampaign(deal)}
                    disabled={loading && activeProcessingDealId === deal.campaign_id}
                    className="flex-1 btn-premium bg-emerald-600/20 text-emerald-400 shadow-none border border-emerald-500/30 h-7 rounded-lg flex items-center justify-center gap-1 active:scale-[0.98]"
                  >
                    {loading && activeProcessingDealId === deal.campaign_id ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <CheckCircle2 className="w-2.5 h-2.5" />}
                    <span className="text-[7px] font-black uppercase tracking-wider">Approve</span>
                  </button>
                  <button
                    onClick={() => handleEditCampaign(deal)}
                    disabled={loading && activeProcessingDealId === deal.campaign_id}
                    className="flex-1 btn-premium bg-indigo-600/20 text-indigo-400 shadow-none border border-indigo-500/30 h-7 rounded-lg flex items-center justify-center gap-1 active:scale-[0.98]"
                  >
                    <Edit2 className="w-2.5 h-2.5" />
                    <span className="text-[7px] font-black uppercase tracking-wider">Edit</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};