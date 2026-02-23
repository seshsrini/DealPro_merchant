

import React, { useState, useCallback, useEffect } from 'react';
import { Deal, AppView, User } from './types';
import { addCampaignService } from './services/addCampaignService';
import { useTranslation } from './contexts/LanguageContext';
import {
  ShieldCheck,
  Loader2,
  CheckCircle2,
  Edit2,
  Globe,
  Clock,
  AlertCircle,
  Calendar
} from 'lucide-react';

interface DealAdminReviewDealsProps {
  user: User;
  deals: Deal[];
  loading: boolean;
  setLoading: (loading: boolean) => void;
  refreshDeals: () => Promise<void>;
  setView: (view: AppView) => void;
  setDealIdToEdit: (id: string | null) => void;
  theme: 'light' | 'dark';
}

const DEFAULT_DEAL_IMAGE = 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=600&q=80';

const getSupabaseImageUrl = (imageName: string | undefined): string | null => {
  if (!imageName) return null;
  const projectUrl = 'https://gkulyxglzqlhpqxlwjqw.supabase.co';
  return `${projectUrl}/storage/v1/object/public/dealproDEV_Images/${imageName}`;
};

export const DealAdminReviewDeals: React.FC<DealAdminReviewDealsProps> = ({
  user, deals, loading, setLoading, refreshDeals, setView, setDealIdToEdit, theme
}) => {
  const { t, getLocalizedText } = useTranslation();
  const isDark = theme === 'dark';
  const [showApprovalSuccess, setShowApprovalSuccess] = useState(false);
  const [activeProcessingDealId, setActiveProcessingDealId] = useState<string | null>(null);

  useEffect(() => {
    console.log("[DealAdminReviewDeals] Fetched 'in review' campaigns payload:", deals);
  }, [deals]);

  useEffect(() => {
    const intervalId = setInterval(() => { refreshDeals(); }, 15000);
    return () => clearInterval(intervalId);
  }, [refreshDeals]);

  const getCampaignImage = (deal: Deal) => {
    if (deal.thumbnail && deal.thumbnail.startsWith('http')) return deal.thumbnail;
    if (deal.image_name) {
      const constructedUrl = getSupabaseImageUrl(deal.image_name);
      if (constructedUrl) return constructedUrl;
    }
    return DEFAULT_DEAL_IMAGE;
  };

  const handleApproveCampaign = useCallback(async (deal: Deal) => {
    setActiveProcessingDealId(deal.campaign_id);
    setLoading(true);
    try {
      await addCampaignService.approveCampaign(deal.campaign_id, deal.merchantId);
      setShowApprovalSuccess(true);
      await refreshDeals();
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
    setDealIdToEdit(deal.campaign_id);
    setView('dealadmin_edit_deal');
  }, [setDealIdToEdit, setView]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) { return dateStr; }
  };

  return (
    <div className={`px-4 pt-4 pb-28 space-y-4 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
      {/* Approval Success Modal */}
      {showApprovalSuccess && (
        <div className="fixed inset-0 z-[500] bg-black/50 flex items-center justify-center p-6">
          <div className={`w-full max-w-xs rounded-xl p-6 text-center ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4 ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
              <CheckCircle2 className="w-7 h-7 text-emerald-500" />
            </div>
            <h3 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Campaign Approved</h3>
            <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>The campaign is now live.</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Admin Console</h2>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Campaign Oversight</p>
        </div>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-slate-100 border border-slate-200'}`}>
          <Globe className="w-4 h-4 text-slate-400" />
        </div>
      </div>

      {/* Section Title */}
      <div>
        <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Campaigns in Review</h3>
        <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Approve or modify pending campaigns</p>
      </div>

      {/* Content */}
      {loading && !activeProcessingDealId ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
          <p className={`text-xs font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Fetching review campaigns...</p>
        </div>
      ) : deals.length === 0 ? (
        <div className={`text-center py-12 rounded-xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto mb-3" />
          <p className={`text-sm font-medium px-6 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            All campaigns are up-to-date. No pending reviews.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {deals.map(deal => (
            <div key={deal.campaign_id} className={`flex flex-col rounded-xl border overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className="relative aspect-[4/3] overflow-hidden bg-slate-800">
                <img src={getCampaignImage(deal)} alt={deal.shopName} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent"></div>
                <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-blue-600 text-white text-[7px] font-medium">
                  {deal.category}
                </div>
                <div className="absolute bottom-1.5 left-1.5 right-1.5">
                  <p className="text-[7px] font-medium text-blue-300 mb-0.5 truncate">{deal.shopName}</p>
                  <h3 className="text-[10px] font-semibold text-white leading-tight line-clamp-2">
                    {getLocalizedText(deal.localized_heading, deal.deal_heading || deal.details)}
                  </h3>
                  <p className="text-amber-400 text-[8px] font-medium mt-0.5 truncate">
                    {getLocalizedText(deal.localized_offer, deal.offer_value)}
                  </p>
                </div>
              </div>

              <div className="p-2 space-y-1.5">
                <div className="flex items-center justify-between gap-1">
                  <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
                    <Calendar className="w-2 h-2 text-slate-400" />
                    <span className={`text-[6px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{formatDate(deal.start_date)}</span>
                  </div>
                  <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
                    <Clock className="w-2 h-2 text-slate-400" />
                    <span className={`text-[6px] font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{formatDate(deal.end_date)}</span>
                  </div>
                </div>
                <div className="flex items-center justify-center">
                  <span className="flex items-center gap-0.5 text-amber-500 text-[7px] font-medium"><AlertCircle className="w-2 h-2" /> In Review</span>
                </div>
                <div className="flex gap-1.5 pt-0.5">
                  <button
                    onClick={() => handleApproveCampaign(deal)}
                    disabled={loading && activeProcessingDealId === deal.campaign_id}
                    className="flex-1 h-7 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-500 flex items-center justify-center gap-1 active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {loading && activeProcessingDealId === deal.campaign_id ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <CheckCircle2 className="w-2.5 h-2.5" />}
                    <span className="text-[7px] font-semibold">Approve</span>
                  </button>
                  <button
                    onClick={() => handleEditCampaign(deal)}
                    disabled={loading && activeProcessingDealId === deal.campaign_id}
                    className="flex-1 h-7 rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-500 flex items-center justify-center gap-1 active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    <Edit2 className="w-2.5 h-2.5" />
                    <span className="text-[7px] font-semibold">Edit</span>
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
