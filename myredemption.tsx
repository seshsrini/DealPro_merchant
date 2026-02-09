

import React, { useState, useEffect, useMemo } from 'react';
import { CampaignInteraction, AppView } from './types';
import { QRCanvas } from './components/QRCanvas';
import { useTranslation } from './contexts/LanguageContext';
import { 
  Ticket, 
  Store, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  Loader2,
  ChevronRight,
  ChevronLeft,
  ShoppingBag,
  Sparkles,
  X,
  QrCode,
  ShieldCheck,
  Star
} from 'lucide-react';
// NEW: Import the dedicated redemption history service
import { redemptionHistoryService } from './services/redemptionHistoryService';
// MyredeemService now only handles feedback/surveys, not history

interface MyRedemptionsProps {
  user: any;
  setView: (view: AppView) => void;
  initialFilterMode?: 'all' | 'pending';
  theme?: 'dark' | 'light';
}

const ITEMS_PER_PAGE = 10;

export const MyRedemptions: React.FC<MyRedemptionsProps> = ({ user, setView, initialFilterMode = 'all', theme = 'dark' }) => {
  const { t, getLocalizedText } = useTranslation();
  const isDark = theme === 'dark';
  const [history, setHistory] = useState<CampaignInteraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRedemption, setSelectedRedemption] = useState<CampaignInteraction | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'all' | 'pending'>(initialFilterMode);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (selectedRedemption) {
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';

      return () => {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [selectedRedemption]);

  useEffect(() => {
    const loadHistory = async () => {
      if (!user?.id) {
        console.log("MyRedemptions: User ID is not available yet.");
        return;
      }
      setLoading(true);
      try {
        console.log(`MyRedemptions: Loading history for user ID: ${user.id}`);
        const data = await redemptionHistoryService.getRedemptionHistory(user.id);
        console.log("MyRedemptions: Fetched history data (raw):", data); // This log should show the full array
        setHistory(data || []);
        setCurrentPage(1); 
      } catch (err) {
        console.error("MyRedemptions: Failed to load rewards history", err);
        setView('preferences'); 
      } finally {
        setLoading(false);
      }
    };
    loadHistory();
  }, [user?.id, setView]);

  useEffect(() => {
    setActiveTab(initialFilterMode);
  }, [initialFilterMode]);

  const filteredHistory = useMemo(() => {
    // The `get-redemptions` EF now strictly returns ALL interactions.
    // Frontend now handles filtering for 'all' vs 'pending'.
    const filtered = activeTab === 'all' ? history : history.filter(item => !item.is_redeemed);
    console.log("MyRedemptions: Filtered history (activeTab, count, data):", activeTab, filtered.length, filtered);
    return filtered;
  }, [history, activeTab]);

  const totalPages = Math.ceil(filteredHistory.length / ITEMS_PER_PAGE);
  
  const paginatedHistory = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginated = filteredHistory.slice(start, start + ITEMS_PER_PAGE);
    console.log("MyRedemptions: Paginated history (currentPage, count, data):", currentPage, paginated.length, paginated);
    return paginated;
  }, [filteredHistory, currentPage]);

  const formatDate = (dateStr?: string, isRedeemed?: boolean) => {
    // If no date or not explicitly redeemed, show "Awaiting Visit"
    if (!dateStr || !isRedeemed) {
      return t('history_status_awaiting');
    }
    try {
      return new Date(dateStr).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch (e) {
      console.error("Error formatting date:", dateStr, e);
      return dateStr;
    }
  };

  const formatEndDate = (endDateStr?: string) => {
    if (!endDateStr) return { text: 'No expiry', isExpired: false };
    try {
      const endDate = new Date(endDateStr);
      const now = new Date();
      const isExpired = endDate < now;
      const formattedDate = endDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      return { text: formattedDate, isExpired };
    } catch (e) {
      console.error("Error formatting end date:", endDateStr, e);
      return { text: endDateStr, isExpired: false };
    }
  };

  const getStatusBadge = (isRedeemed?: boolean) => {
    if (isRedeemed) {
      return (
        <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.1)]">
          <CheckCircle2 className="w-3 h-3" />
          <span className="text-[8px] font-black uppercase tracking-widest">{t('history_status_verified')}</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-500">
        <Clock className="w-3 h-3 animate-pulse" />
        <span className="text-[8px] font-black uppercase tracking-widest">{t('history_status_awaiting')}</span>
      </div>
    );
  };

  return (
    <div className="px-6 pt-6 animate-reveal pb-32">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20 shadow-lg">
              <Ticket className="w-5 h-5 text-yellow-500" />
            </div>
            <h2 className={`text-3xl font-black uppercase tracking-tighter leading-none ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {t('history_title_1')}<br/><span className="text-yellow-500">{t('history_title_2')}</span>
            </h2>
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 pl-1">{t('history_sub')}</p>
        </div>
        <div className="text-right">
           <p className={`text-3xl font-black tracking-tighter ${isDark ? 'text-white' : 'text-slate-900'}`}>{filteredHistory.length}</p>
           <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">{t('history_rewards_label')}</p>
        </div>
      </div>

      <div className="mb-8 glass p-1.5 rounded-2xl border-white/5 bg-white/5 flex gap-2">
         <button 
           onClick={() => { setActiveTab('all'); setCurrentPage(1); }}
           className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${activeTab === 'all' ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/20' : 'text-slate-500 hover:text-slate-300'}`}
         >
           {t('history_tab_all')}
         </button>
         <button 
           onClick={() => { setActiveTab('pending'); setCurrentPage(1); }}
           className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${activeTab === 'pending' ? 'bg-amber-600 text-white shadow-xl shadow-amber-500/20' : 'text-slate-500 hover:text-slate-300'}`}
         >
           {t('history_tab_pending')}
         </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-6">
          <div className="relative">
             <div className="w-16 h-16 rounded-full border-2 border-blue-500/20 border-t-blue-500 animate-spin"></div>
             <Sparkles className="w-6 h-6 text-blue-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-500 animate-pulse">{t('history_syncing')}</p>
        </div>
      ) : filteredHistory.length === 0 ? (
        <div className="text-center py-24 glass rounded-[3.5rem] border-white/5 bg-slate-950/40 shadow-2xl">
          <div className="w-20 h-20 rounded-full bg-slate-900 flex items-center justify-center mx-auto mb-8 border border-white/5">
             <ShoppingBag className="w-10 h-10 text-slate-700" />
          </div>
          <p className="text-xl font-black text-white uppercase tracking-tighter mb-2">{t('history_empty_title')}</p>
          <p className="text-xs font-bold text-slate-500 px-10 mb-10 leading-relaxed">
            {activeTab === 'pending' 
              ? t('history_empty_sub_pending')
              : t('history_empty_sub_all')}
          </p>
          <button onClick={() => setView('preferences')} className="btn-premium px-10 h-16 rounded-2xl mx-auto flex items-center gap-4 shadow-2xl shadow-blue-500/20 active:scale-95 transition-all">
             <span className="text-[11px] tracking-widest">{t('history_search_btn')}</span>
             <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {paginatedHistory.map((item) => {
            console.log("MyRedemptions: Attempting to render item:", item.campaign_id, item.campaign_details?.deal_heading); // Debug log // Fix: Use campaign_id
            const cd = item.campaign_details;
            const heading = getLocalizedText(cd?.localized_heading, cd?.deal_heading || 'Reward Node');
            const offer = getLocalizedText(cd?.localized_offer, cd?.offer_value || 'Special Offer');
            const shop = getLocalizedText(cd?.localized_shop_name, cd?.shop_name || 'Retail Partner');
            const displayId = item.claim_no || String(item.campaign_id || item.interaction_id || '').slice(0, 8); // Fix: Use campaign_id

            // Check if deal is expired
            const dateInfo = formatEndDate(cd?.endDate);
            const isExpired = dateInfo.isExpired;

            // ORIGINAL COMPLEX JSX (RESTORED)
            return (
              <button
                key={String(item.campaign_id || item.interaction_id)} // Fix: Use campaign_id
                onClick={isExpired ? undefined : () => setSelectedRedemption(item)}
                disabled={isExpired}
                className={`w-full text-left glass p-6 rounded-[2.5rem] border transition-all animate-reveal relative group overflow-hidden focus:outline-none focus:ring-2 focus:ring-yellow-500/30 ${
                  item.is_redeemed ? 'border-emerald-500/10 bg-emerald-500/5' : 'border-white/10 bg-white/[0.02]'
                } ${isExpired ? 'opacity-60 cursor-not-allowed' : 'active:scale-[0.98] cursor-pointer'}`}
              >
                 <div className="flex gap-6">
                    <div className="w-20 h-20 shrink-0 rounded-2xl overflow-hidden border border-white/10 relative shadow-2xl">
                       <img
                         src={cd?.image_url || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=400&q=80'}
                         className={`w-full h-full object-cover transition-transform duration-700 ${item.is_redeemed ? 'grayscale' : 'group-hover:scale-110'}`}
                         alt="Visual"
                       />
                       {item.is_redeemed && (
                         <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                         </div>
                       )}
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                       <div className="space-y-1">
                          <div className="flex items-center gap-2">
                             <Store className={`w-3 h-3 ${isDark ? 'text-yellow-500' : 'text-yellow-700'}`} />
                             <span className={`text-[8px] font-black uppercase tracking-widest truncate ${isDark ? 'text-yellow-500' : 'text-yellow-700'}`}>
                                {shop}
                             </span>
                          </div>
                          <h4 className={`text-sm font-black leading-none uppercase truncate ${item.is_redeemed ? 'text-slate-500' : (isDark ? 'text-white' : 'text-slate-900')}`}>
                            {heading}
                          </h4>
                          <p className={`text-[9px] font-black tracking-tighter uppercase ${item.is_redeemed ? 'text-slate-600' : (isDark ? 'text-yellow-500' : 'text-yellow-700')}`}>
                            {offer}
                          </p>
                       </div>
                       
                       <div className="flex items-center justify-between mt-5">
                          <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-white/5 border border-white/5">
                            <Calendar className="w-3 h-3 text-slate-500" />
                            <span className={`text-[8px] font-black uppercase tracking-tighter ${isExpired ? 'text-red-700' : 'text-emerald-700'}`}>
                              {isExpired ? 'Ended:' : 'Ends:'} {dateInfo.text}
                            </span>
                          </div>
                          {getStatusBadge(item.is_redeemed)}
                       </div>
                    </div>
                 </div>
              </button>
            );
          })}

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-10 glass p-5 rounded-[2.5rem] border-white/5 bg-white/2 shadow-2xl">
              <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
                className="w-14 h-14 flex items-center justify-center rounded-2xl glass border-white/10 disabled:opacity-10 active:scale-90 transition-all text-blue-500"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              
              <div className="flex flex-col items-center">
                <span className="text-[8px] font-black uppercase text-slate-600 tracking-[0.4em] mb-1">{t('history_page_label')}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-black text-white">{currentPage}</span>
                  <span className="text-slate-700 font-black text-xs uppercase tracking-tighter">{t('history_of')}</span>
                  <span className="text-xl font-black text-blue-500">{totalPages}</span>
                </div>
              </div>

              <button 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
                className="w-14 h-14 flex items-center justify-center rounded-2xl glass border-white/10 disabled:opacity-10 active:scale-90 transition-all text-blue-500"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>
          )}
        </div>
      )}

      {selectedRedemption && (
        <div className="fixed inset-0 z-[300] bg-slate-950/95 backdrop-blur-3xl flex items-center justify-center p-2 animate-reveal">
          <div className="w-full max-w-[340px] glass p-3 rounded-xl border-blue-500/30 relative text-center shadow-[0_0_100px_rgba(0,0,0,0.5)]">
            <button
              onClick={() => setSelectedRedemption(null)}
              className="absolute top-2 right-2 w-6 h-6 glass rounded-full flex items-center justify-center border-white/10 active:scale-90 transition-all z-10"
            >
              <X className="w-3 h-3 text-slate-400" />
            </button>

            <div className="mb-2 text-center">
              <h3 className="text-xs font-black uppercase text-white leading-none mb-2">
                {selectedRedemption.is_redeemed ? 'Visit Verified' : 'Voucher'}
              </h3>
              <div className="p-1.5 glass bg-white/5 rounded-lg border-white/5">
                   <p className="text-[6px] font-black uppercase tracking-wide text-slate-500 mb-0.5">ID</p>
                   <p className="text-[10px] font-black font-mono text-blue-500">
                     {(selectedRedemption.claim_no || String(selectedRedemption.campaign_id || selectedRedemption.interaction_id)).slice(0, 12).toUpperCase()}
                   </p>
              </div>
            </div>

            <div className="glass p-2 rounded-lg mb-2 w-full flex justify-center bg-white/5 border-white/5">
              {selectedRedemption.is_redeemed ? (
                <div className="flex flex-col items-center py-2">
                   <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-1.5" />
                   <button
                     onClick={() => setView('campaign_survey')}
                     className="btn-premium px-3 h-8 rounded-lg flex items-center gap-1.5 active:scale-95"
                   >
                      <Star className="w-2 h-2 fill-white" />
                      <span className="text-[7px] tracking-wider uppercase">Rate</span>
                   </button>
                </div>
              ) : (
                <QRCanvas value={{
                  campaign_id: selectedRedemption.campaign_id,
                  merchant_id: selectedRedemption.merchant_id,
                  consumer_id: user.id,
                  timestamp: Date.now(),
                  claim_no: selectedRedemption.claim_no,
                  interaction_id: selectedRedemption.interaction_id
                }} />
              )}
            </div>

            <button
              onClick={() => setSelectedRedemption(null)}
              className="w-full btn-premium h-8 rounded-lg"
            >
              <span className="text-[8px] font-black uppercase tracking-wide">Close</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};