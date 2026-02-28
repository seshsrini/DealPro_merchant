
import React, { useState, useEffect, useMemo } from 'react';
import { Deal } from './types';
import { QRCanvas } from './components/QRCanvas';
import { LocationMap } from './components/LocationMap';
import { useTranslation } from './contexts/LanguageContext';
import { dealdetailsService } from './services/dealdetailsService';
import { redeemNowservice } from './services/redeemNowservice';
import { pinnedDealsService } from './services/pinnedDealsService';
import {
  Heart,
  Loader2,
  X,
  MapPin,
  Navigation,
  ShieldCheck,
  QrCode,
  Map,
  Clock,
  Info,
  Tag,
  Calendar,
  CheckCircle2,
  Star,
  Pin
} from 'lucide-react';

interface CampaignDetailsProps {
  deal: Deal;
  user: any;
  theme: 'light' | 'dark';
  isFav: boolean;
  isRedeeming: boolean;
  activeClaimId: string | null;
  onRedeem: (deal: Deal) => void;
  onToggleFavorite: (deal: Deal) => void;
  onCloseClaim: () => void;
  redeemedIds: Set<string>;
  claimedIds: Set<string>;
}

const DEFAULT_DEAL_IMAGE = 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=600&q=80';

export const CampaignDetails: React.FC<CampaignDetailsProps> = ({
  deal, user, theme, isFav, isRedeeming, activeClaimId, onRedeem, onToggleFavorite, onCloseClaim,
  redeemedIds, claimedIds
}) => {
  const { t, getLocalizedText } = useTranslation();
  const isDark = theme === 'dark';
  const storeAddress = deal.address || deal.location || 'Address not registered';
  const landmark = deal.landmark || 'No landmark specified';
  const storeHrs = deal.storeHrs || 'Timing not available';

  const [showAlreadyClaimedPopup, setShowAlreadyClaimedPopup] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [isPinning, setIsPinning] = useState(false);
  const [showPinTooltip, setShowPinTooltip] = useState(false);
  const [showFavoriteTooltip, setShowFavoriteTooltip] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const tooltipsShown = localStorage.getItem('deal_tooltips_shown');

    if (!tooltipsShown) {
      setTimeout(() => {
        setShowPinTooltip(true);
        setShowFavoriteTooltip(true);
      }, 500);

      setTimeout(() => {
        setShowPinTooltip(false);
        setShowFavoriteTooltip(false);
        localStorage.setItem('deal_tooltips_shown', 'true');
      }, 10500);
    }
  }, []);

  const isFullyRedeemed = redeemedIds.has(String(deal.campaign_id));
  const hasBeenClaimed = claimedIds.has(String(deal.campaign_id));

  useEffect(() => {
    const checkPinStatus = async () => {
      if (user?.id && deal.campaign_id) {
        const pinned = await pinnedDealsService.isPinned(user.id, deal.campaign_id);
        setIsPinned(pinned);
      }
    };
    checkPinStatus();
  }, [user?.id, deal.campaign_id]);

  useEffect(() => {
    if (hasBeenClaimed && !activeClaimId) {
      const storageKey = `deal_visits_${user.id}_${deal.campaign_id}`;
      const visitCount = parseInt(sessionStorage.getItem(storageKey) || '0', 10);

      if (visitCount >= 1) {
        setShowAlreadyClaimedPopup(true);
      }

      sessionStorage.setItem(storageKey, (visitCount + 1).toString());
    }
  }, [hasBeenClaimed, deal.campaign_id, user.id, activeClaimId]);

  const shopName = getLocalizedText(deal.localized_shop_name, deal.shopName);
  const heading = getLocalizedText(deal.localized_heading, deal.deal_heading || deal.details);
  const offerValue = getLocalizedText(deal.localized_offer, deal.offer_value);
  const fullDescription = getLocalizedText(deal.localized_description, deal.longDescription);

  const qrPayload = useMemo(() => ({
    campaign_id: deal.campaign_id,
    merchant_id: deal.merchantId,
    consumer_id: user.id,
    timestamp: Date.now(),
    claim_no: activeClaimId
  }), [deal.campaign_id, deal.merchantId, user.id, activeClaimId]);

  const handleGetDirections = (address: string) => {
    const encoded = encodeURIComponent(address);
    const platform = (window as any).Capacitor?.getPlatform() || 'web';
    window.location.href = platform === 'android' ? `google.navigation:q=${encoded}` : `maps://?daddr=${encoded}`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) { return null; }
  };

  const handleTogglePin = async () => {
    if (!user?.id || !deal.campaign_id || !deal.merchantId) {
      console.error('[Pin] Missing required data', {
        userId: user?.id,
        campaignId: deal.campaign_id,
        merchantId: deal.merchantId
      });
      return;
    }

    console.log('[Pin] Attempting to toggle pin with:', {
      userId: user.id,
      campaignId: deal.campaign_id,
      merchantId: deal.merchantId
    });

    setIsPinning(true);
    try {
      const { success, isPinned: newPinState } = await pinnedDealsService.togglePin(
        user.id,
        deal.campaign_id,
        deal.merchantId
      );

      if (success) {
        setIsPinned(newPinState);
        console.log(`[Pin] Deal ${newPinState ? 'pinned' : 'unpinned'}`);
      } else {
        console.error('[Pin] Failed to toggle pin');
      }
    } catch (error) {
      console.error('[Pin] Error toggling pin:', error);
    } finally {
      setIsPinning(false);
    }
  };

  return (
    <div className={`font-['Inter'] pb-32 transition-colors duration-300 ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
       {/* Hero Image */}
       <div className="relative h-[45vh] w-full overflow-hidden bg-slate-900">
          <img
            src={deal.thumbnail || DEFAULT_DEAL_IMAGE}
            onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_DEAL_IMAGE; }}
            className="w-full h-full object-cover"
            alt={shopName}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-transparent"></div>

          {/* Category badge */}
          <div className={`absolute top-6 left-6 px-4 py-2 rounded-lg ${isDark ? 'bg-slate-900/80 border border-slate-700' : 'bg-white/90 border border-slate-200'}`}>
             <span className={`text-xs font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
               {deal.category}
             </span>
          </div>

          {/* Rating badge */}
          <div className="absolute top-6 right-6 px-3 py-2 bg-amber-500 rounded-lg">
             <div className="flex items-center gap-1.5">
               <Star className="w-3.5 h-3.5 text-white fill-white" />
               <span className="text-sm font-semibold text-white">
                 {deal.rating && deal.rating > 0 ? deal.rating.toFixed(1) : 'NA'}
               </span>
             </div>
          </div>
       </div>

       <div className="px-6 -mt-16 relative z-10 space-y-6">
          {/* Main Content Card */}
          <div className={`relative p-6 pb-28 rounded-xl border ${isDark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"}`}>
             <div className="space-y-4 mb-6">
                {/* Shop name */}
                <p className="text-blue-500 text-xs font-medium">{shopName}</p>

                {/* Deal heading */}
                <h2 className={`text-2xl font-semibold leading-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                   {heading}
                </h2>

                {/* Offer and validity badges */}
                <div className="flex flex-wrap gap-2">
                  <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border ${isDark ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-200'}`}>
                     <Tag className="w-4 h-4 text-amber-500" />
                     <span className="text-xs font-medium text-amber-500">{offerValue}</span>
                  </div>
                  {deal.end_date && (
                    <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border ${isDark ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-200'}`}>
                       <Calendar className="w-4 h-4 text-red-500" />
                       <span className="text-[11px] font-medium text-red-500">
                         Valid Till {formatDate(deal.end_date)}
                       </span>
                    </div>
                  )}
                </div>
             </div>

             {/* Action buttons */}
             <div className="flex gap-3">
                {/* Favorite button with tooltip */}
                <div className="relative">
                  <button
                    onClick={() => onToggleFavorite(deal)}
                    className={`w-14 h-14 rounded-xl flex items-center justify-center transition-all active:scale-[0.98] border ${
                      isFav
                        ? isDark ? 'bg-red-500/10 text-red-400 border-red-500/30' : 'bg-red-50 text-red-500 border-red-200'
                        : isDark ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}
                  >
                     <Heart className={`w-6 h-6 ${isFav ? 'fill-current' : ''}`} />
                  </button>

                  {showFavoriteTooltip && (
                    <div className="absolute top-full mt-2 left-0 z-50">
                      <div className={`px-3 py-2 rounded-lg border whitespace-nowrap ${
                        isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-700 shadow-lg'
                      }`}>
                        <p className="text-xs font-medium">Click to save as favorite</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Pin button with tooltip */}
                <div className="relative">
                  <button
                    onClick={handleTogglePin}
                    disabled={isPinning}
                    className={`w-14 h-14 rounded-xl flex items-center justify-center transition-all active:scale-[0.98] border ${
                      isPinned
                        ? isDark ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' : 'bg-blue-50 text-blue-500 border-blue-200'
                        : isDark ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}
                  >
                    {isPinning ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      <Pin className={`w-6 h-6 ${isPinned ? 'fill-current' : ''}`} />
                    )}
                  </button>

                  {showPinTooltip && (
                    <div className="absolute top-full mt-2 left-0 z-50">
                      <div className={`px-3 py-2 rounded-lg border whitespace-nowrap ${
                        isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-700 shadow-lg'
                      }`}>
                        <p className="text-xs font-medium">Click to pin this deal</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Redeem button */}
                <div className="flex-1">
                  <button
                    onClick={() => onRedeem(deal)}
                    disabled={isRedeeming || hasBeenClaimed}
                    className={`w-full h-14 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
                      hasBeenClaimed
                        ? isDark ? 'bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed' : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                        : 'bg-slate-900 text-white'
                    }`}
                  >
                     {isRedeeming ? (
                       <Loader2 className="animate-spin w-5 h-5" />
                     ) : (
                       <QrCode className="w-5 h-5" />
                     )}
                     <span className="text-sm font-medium">
                       {hasBeenClaimed ? 'Already Claimed' : (isRedeeming ? t('details_verifying') : t('details_redeem_btn'))}
                     </span>
                  </button>
                </div>
             </div>
          </div>

          {/* Description section */}
          <div className="space-y-3">
             <div className="flex items-center gap-2 px-1">
                <Info className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                <h4 className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Deal Description
                </h4>
             </div>
             <div className={`px-5 py-5 rounded-xl border ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                <div
                  className={`text-sm font-normal leading-relaxed ${isDark ? 'text-slate-200' : 'text-slate-700'} rich-text-content`}
                  dangerouslySetInnerHTML={{ __html: fullDescription }}
                />
             </div>
          </div>

          {/* Store details */}
          <div className={`rounded-xl border overflow-hidden ${isDark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"}`}>
             <div className="p-5 space-y-1">
                <div className="flex items-start gap-4 p-3 rounded-lg">
                   <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
                     <MapPin className="w-5 h-5 text-blue-500" />
                   </div>
                   <div className="flex-1">
                      <p className={`text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('details_coordinates')}</p>
                      <p className={`text-sm font-medium leading-relaxed ${isDark ? "text-white" : "text-slate-900"}`}>{storeAddress}</p>
                   </div>
                </div>

                <div className="flex items-start gap-4 p-3 rounded-lg">
                   <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isDark ? 'bg-amber-500/10' : 'bg-amber-50'}`}>
                     <Map className="w-5 h-5 text-amber-500" />
                   </div>
                   <div className="flex-1">
                      <p className={`text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('details_landmark')}</p>
                      <p className={`text-sm font-medium leading-relaxed ${isDark ? "text-white" : "text-slate-900"}`}>{landmark}</p>
                   </div>
                </div>

                <div className="flex items-start gap-4 p-3 rounded-lg">
                   <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
                     <Clock className="w-5 h-5 text-emerald-500" />
                   </div>
                   <div className="flex-1">
                      <p className={`text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('details_op_window')}</p>
                      <p className={`text-sm font-medium leading-relaxed ${isDark ? "text-white" : "text-slate-900"}`}>{storeHrs}</p>
                   </div>
                </div>
             </div>
          </div>

          {/* Navigate to Store section with map */}
          <div className="space-y-4">
             <div className="flex items-center justify-between px-1">
                <h3 className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Navigate to Store
                </h3>
                <button
                  onClick={() => handleGetDirections(storeAddress)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border active:scale-[0.98] transition-all ${
                    isDark ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-blue-50 border-blue-200 text-blue-600'
                  }`}
                >
                  <Navigation className="w-4 h-4" />
                  <span className="text-xs font-medium">{t('details_start_gps')}</span>
                </button>
             </div>

             <div className={`rounded-xl border overflow-hidden ${isDark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"}`}>
                <div className="relative h-80 w-full">
                   <LocationMap theme={theme} targetCoords={{ latitude: deal.latitude, longitude: deal.longitude }} selectedLocation={shopName} targetAddress={storeAddress} />
                </div>

                <div className="flex justify-end px-4 py-2">
                  <span className={`text-[8px] font-medium ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>
                    Map data &copy;{' '}
                    <span className="font-semibold text-blue-500">OpenStreetMap</span>
                  </span>
                </div>
             </div>
          </div>
       </div>

       {/* QR Voucher Modal */}
       {activeClaimId && (
         <div className="fixed inset-0 z-[400] bg-black/50 flex items-start justify-center p-4 pt-8">
           <div className={`w-full max-w-sm max-h-[90vh] p-6 rounded-2xl relative text-center ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
              <button
                onClick={onCloseClaim}
                className={`absolute top-4 right-4 w-9 h-9 rounded-lg flex items-center justify-center active:scale-[0.98] transition-all z-10 ${
                  isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'
                }`}
              >
                <X className="w-5 h-5" />
              </button>

              <div className="mb-5 text-center">
                <div className={`w-14 h-14 mx-auto mb-4 rounded-xl flex items-center justify-center ${isDark ? 'bg-amber-500/10' : 'bg-amber-50'}`}>
                  <ShieldCheck className="w-7 h-7 text-amber-500" />
                </div>

                <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Voucher Established
                </h3>

                <div className={`p-3 rounded-xl border ${isDark ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-200'}`}>
                   <p className={`text-[10px] font-medium mb-1 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>Instance ID</p>
                   <p className={`text-base font-semibold font-mono ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>{String(activeClaimId).toUpperCase()}</p>
                </div>
              </div>

              <div className="p-4 rounded-xl mb-5 w-full flex justify-center bg-white border border-slate-200">
                <QRCanvas value={qrPayload} />
              </div>

              <button
                onClick={onCloseClaim}
                className="w-full h-12 rounded-xl bg-slate-900 text-white text-sm font-medium active:scale-[0.98] transition-all"
              >
                Close
              </button>
           </div>
         </div>
       )}

       {/* Already Claimed Popup */}
       {showAlreadyClaimedPopup && (
         <div className="fixed inset-0 z-[400] bg-black/50 flex items-center justify-center p-6">
           <div className={`w-full max-w-sm p-8 rounded-2xl relative text-center ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
              <button
                onClick={() => setShowAlreadyClaimedPopup(false)}
                className={`absolute top-4 right-4 w-9 h-9 rounded-lg flex items-center justify-center active:scale-[0.98] transition-all z-10 ${
                  isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'
                }`}
              >
                <X className="w-5 h-5" />
              </button>

              <div className="mb-6 text-center">
                <div className={`w-16 h-16 mx-auto mb-4 rounded-xl flex items-center justify-center ${
                  isFullyRedeemed
                    ? isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'
                    : isDark ? 'bg-amber-500/10' : 'bg-amber-50'
                }`}>
                  {isFullyRedeemed ? (
                    <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                  ) : (
                    <Clock className="w-8 h-8 text-amber-500" />
                  )}
                </div>

                <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Deal Already Claimed!
                </h3>

                <div className={`p-4 rounded-xl border ${
                  isFullyRedeemed
                    ? isDark ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200'
                    : isDark ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-200'
                }`}>
                   <p className={`text-xs font-medium mb-1 ${
                     isFullyRedeemed ? 'text-emerald-500' : 'text-amber-500'
                   }`}>
                     Status
                   </p>
                   <p className={`text-base font-semibold ${
                     isFullyRedeemed ? 'text-emerald-500' : 'text-amber-500'
                   }`}>
                     {isFullyRedeemed ? 'Verified' : 'Awaiting Merchant'}
                   </p>
                </div>
              </div>

              <button
                onClick={() => setShowAlreadyClaimedPopup(false)}
                className={`w-full h-12 rounded-xl text-sm font-medium active:scale-[0.98] transition-all ${
                  isFullyRedeemed ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
                }`}
              >
                Understood
              </button>
           </div>
         </div>
       )}

      {/* Rich Text Content Styles */}
      <style>{`
        .rich-text-content ul {
          list-style-type: disc;
          padding-left: 1.5rem;
          margin: 0.75rem 0;
        }
        .rich-text-content li {
          margin: 0.5rem 0;
        }
        .rich-text-content strong {
          font-weight: 700;
        }
        .rich-text-content em {
          font-style: italic;
        }
        .rich-text-content p {
          margin: 0.5rem 0;
        }
      `}</style>
    </div>
  );
};
