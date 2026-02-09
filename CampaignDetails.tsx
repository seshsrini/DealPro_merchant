
import React, { useState, useEffect, useMemo } from 'react';
import { Deal } from './types';
import { QRCanvas } from './components/QRCanvas';
import { LocationMap } from './components/LocationMap';
import { useTranslation } from './contexts/LanguageContext';
import { dealdetailsService } from './services/dealdetailsService'; 
import { redeemNowservice } from './services/redeemNowservice'; 
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
  Sparkles
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

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // FIX: Use campaign_id instead of id
  const isFullyRedeemed = redeemedIds.has(String(deal.campaign_id));
  const hasBeenClaimed = claimedIds.has(String(deal.campaign_id));

  // FIX: LOGIC - SHOW POPUP ONLY ON "NEXT VISIT" TO PREVENT AGGRESSIVE UX
  useEffect(() => {
    if (hasBeenClaimed && !activeClaimId) {
      // FIX: Use campaign_id
      const storageKey = `deal_visits_${user.id}_${deal.campaign_id}`; 
      const visitCount = parseInt(sessionStorage.getItem(storageKey) || '0', 10);
      
      if (visitCount >= 1) {
        // This is at least the "next" visit after initial claim
        setShowAlreadyClaimedPopup(true);
      }
      
      // Increment visit count for this specific deal node
      sessionStorage.setItem(storageKey, (visitCount + 1).toString());
    }
  // FIX: Use campaign_id
  }, [hasBeenClaimed, deal.campaign_id, user.id, activeClaimId]); 

  const shopName = getLocalizedText(deal.localized_shop_name, deal.shopName);
  // FIX: Use deal_heading property
  const heading = getLocalizedText(deal.localized_heading, deal.deal_heading || deal.details); 
  // FIX: Use offer_value property
  const offerValue = getLocalizedText(deal.localized_offer, deal.offer_value);
  const fullDescription = getLocalizedText(deal.localized_description, deal.longDescription);

  const qrPayload = useMemo(() => ({
    // FIX: Use campaign_id property
    campaign_id: deal.campaign_id,
    merchant_id: deal.merchantId,
    consumer_id: user.id,
    timestamp: Date.now(),
    claim_no: activeClaimId
  // FIX: Use campaign_id property
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

  return (
    <div className={`font-['Inter'] animate-reveal pb-32 transition-colors duration-500 ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
       <div className="relative h-[45vh] w-full overflow-hidden bg-slate-900">
          <img
            src={deal.thumbnail || DEFAULT_DEAL_IMAGE}
            onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_DEAL_IMAGE; }}
            className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-700"
            alt={shopName}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-slate-950/20"></div>

          {/* Animated gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 via-purple-500/10 to-pink-500/20 animate-pulse"></div>

          {/* Category badge with glow */}
          <div className="absolute top-6 left-6 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl shadow-2xl border border-white/20 backdrop-blur-sm">
             <span className="text-[11px] font-black uppercase tracking-[0.25em] text-white flex items-center gap-2">
               <Sparkles className="w-3 h-3" />
               {deal.category}
             </span>
          </div>

          {/* Rating badge - always show, display NA if no rating */}
          <div className="absolute top-6 right-6 px-4 py-2.5 bg-amber-500/90 backdrop-blur-sm rounded-2xl shadow-2xl border border-amber-400/30">
             <div className="flex items-center gap-2">
               <Star className="w-4 h-4 text-white fill-white" />
               <span className="text-sm font-black text-white">
                 {deal.rating && deal.rating > 0 ? deal.rating.toFixed(1) : 'NA'}
               </span>
             </div>
          </div>
       </div>

       <div className="px-6 -mt-16 relative z-10 space-y-8">
          <div className={`relative p-8 rounded-[3rem] border backdrop-blur-3xl shadow-2xl transform transition-all hover:shadow-3xl overflow-hidden ${isDark ? "bg-slate-900/90 border-white/10 shadow-blue-500/10" : "bg-white border-slate-200 shadow-xl"}`}>
             {/* Top glow effect */}
             <div className="absolute -top-px left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-blue-500 to-transparent"></div>

             {/* Floating decorative elements */}
             <div className="absolute top-8 right-8 w-32 h-32 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-full blur-3xl"></div>
             <div className="absolute bottom-8 left-8 w-24 h-24 bg-gradient-to-br from-purple-500/5 to-pink-500/5 rounded-full blur-2xl"></div>

             <div className="relative space-y-5 mb-8">
                {/* Shop name with enhanced styling */}
                <div className="flex items-center gap-3">
                   <div className="relative">
                     <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse shadow-[0_0_15px_rgba(59,130,246,1)]"></div>
                     <div className="absolute inset-0 w-2.5 h-2.5 bg-blue-500 rounded-full animate-ping opacity-75"></div>
                   </div>
                   <p className="text-blue-500 text-[11px] font-black uppercase tracking-[0.4em] leading-none">{shopName}</p>
                </div>

                {/* Deal heading with gradient */}
                <h2 className={`text-3xl font-black leading-[1.05] tracking-tighter uppercase bg-gradient-to-r ${isDark ? "from-white via-blue-100 to-white bg-clip-text text-transparent" : "from-slate-950 via-blue-900 to-slate-950 bg-clip-text text-transparent"}`}>
                   {heading}
                </h2>

                {/* Offer and validity badges with enhanced styling */}
                <div className="flex flex-wrap gap-3">
                  <div className="inline-flex items-center gap-2.5 px-5 py-3 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-2 border-amber-500/40 rounded-2xl shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 transition-all">
                     <Tag className="w-4 h-4 text-amber-400" />
                     <span className="text-xs font-black text-amber-400 uppercase tracking-widest">{offerValue}</span>
                  </div>
                  {/* FIX: Use end_date */}
                  {deal.end_date && (
                    <div className="inline-flex items-center gap-2.5 px-5 py-3 bg-gradient-to-r from-rose-500/20 to-pink-500/20 border-2 border-rose-500/40 rounded-2xl shadow-lg shadow-rose-500/20">
                       <Calendar className="w-4 h-4 text-rose-400" />
                       <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">
                         Valid Till {formatDate(deal.end_date)}
                       </span>
                    </div>
                  )}
                </div>
             </div>

             <div className="relative flex gap-4">
                {/* Enhanced favorite button */}
                <button
                  onClick={() => onToggleFavorite(deal)}
                  className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all active:scale-95 border-2 shadow-lg ${
                    isFav
                      ? 'bg-gradient-to-br from-rose-500/30 to-pink-500/30 text-rose-400 border-rose-500/50 shadow-rose-500/30'
                      : 'glass text-slate-500 border-white/10 hover:border-rose-500/30 hover:text-rose-400'
                  }`}
                >
                   <Heart className={`w-7 h-7 transition-all ${isFav ? 'fill-current animate-pulse' : ''}`} />
                </button>

                {/* Enhanced redeem button */}
                <div className="flex-1">
                  <button
                    onClick={() => onRedeem(deal)}
                    disabled={isRedeeming || hasBeenClaimed}
                    className={`relative w-full h-16 rounded-2xl shadow-xl flex items-center justify-center gap-3 overflow-hidden transition-all active:scale-[0.98] ${
                      hasBeenClaimed
                        ? 'bg-slate-700/50 text-slate-400 cursor-not-allowed border-2 border-slate-600/50'
                        : 'btn-premium shadow-blue-500/30 hover:shadow-blue-500/50 border-2 border-blue-500/30'
                    }`}
                  >
                     {/* Animated background gradient for active state */}
                     {!hasBeenClaimed && !isRedeeming && (
                       <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 animate-pulse opacity-90"></div>
                     )}

                     <div className="relative flex items-center gap-3">
                       {isRedeeming ? (
                         <Loader2 className="animate-spin w-5 h-5" />
                       ) : (
                         <QrCode className="w-5 h-5" />
                       )}
                       <span className="text-xs font-black uppercase tracking-[0.15em]">
                         {hasBeenClaimed ? 'Already Claimed' : (isRedeeming ? t('details_verifying') : t('details_redeem_btn'))}
                       </span>
                     </div>
                  </button>
                </div>
             </div>
          </div>

          {/* Redesigned description section */}
          <div className="space-y-4">
             <div className="flex items-center gap-3 px-2">
                <div className="w-1 h-8 bg-gradient-to-b from-blue-500 via-purple-500 to-pink-500 rounded-full shadow-lg shadow-blue-500/50"></div>
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-blue-400" />
                  <h4 className="text-xs font-black uppercase tracking-[0.3em] bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                    Deal Description
                  </h4>
                </div>
             </div>
             <div className={`relative px-6 py-6 rounded-3xl ${isDark ? 'bg-gradient-to-br from-slate-900/40 via-slate-900/30 to-slate-900/40' : 'bg-gradient-to-br from-slate-50 via-white to-slate-50'} border-l-4 border-blue-500/50 shadow-lg`}>
                {/* Decorative corner accent */}
                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-blue-500/10 to-transparent rounded-bl-full"></div>
                <div
                  className={`relative text-[15px] font-medium leading-relaxed ${isDark ? 'text-slate-200' : 'text-slate-700'} rich-text-content`}
                  dangerouslySetInnerHTML={{ __html: fullDescription }}
                />
             </div>
          </div>

          {/* Decorative divider */}
          <div className="flex items-center gap-4 px-4 py-2">
             <div className={`flex-1 h-px bg-gradient-to-r ${isDark ? 'from-transparent via-slate-700 to-transparent' : 'from-transparent via-slate-300 to-transparent'}`}></div>
             <div className="flex gap-1">
               <div className="w-1 h-1 rounded-full bg-blue-500/50"></div>
               <div className="w-1 h-1 rounded-full bg-purple-500/50"></div>
               <div className="w-1 h-1 rounded-full bg-pink-500/50"></div>
             </div>
             <div className={`flex-1 h-px bg-gradient-to-r ${isDark ? 'from-transparent via-slate-700 to-transparent' : 'from-transparent via-slate-300 to-transparent'}`}></div>
          </div>

          {/* Store details section - moved above map */}
          <div className={`relative rounded-3xl border-2 overflow-hidden shadow-xl ${isDark ? "bg-slate-900/90 border-white/10" : "bg-white border-slate-200"}`}>
             {/* Decorative corner accent */}
             <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-purple-500/5 to-transparent rounded-bl-full pointer-events-none"></div>

             <div className="relative p-8 space-y-6">
                <div className="flex items-start gap-5 group hover:bg-blue-500/5 p-4 rounded-2xl transition-all">
                   <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30 shrink-0 group-hover:scale-110 transition-transform">
                     <MapPin className="w-5 h-5 text-blue-400" />
                   </div>
                   <div className="flex-1">
                      <p className="text-[9px] font-black uppercase text-blue-400 mb-2 tracking-wider">{t('details_coordinates')}</p>
                      <p className={`text-sm font-semibold leading-relaxed ${isDark ? "text-white" : "text-slate-950"}`}>{storeAddress}</p>
                   </div>
                </div>

                <div className="flex items-start gap-5 group hover:bg-amber-500/5 p-4 rounded-2xl transition-all">
                   <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center border border-amber-500/30 shrink-0 group-hover:scale-110 transition-transform">
                     <Map className="w-5 h-5 text-amber-400" />
                   </div>
                   <div className="flex-1">
                      <p className="text-[9px] font-black uppercase text-amber-400 mb-2 tracking-wider">{t('details_landmark')}</p>
                      <p className={`text-sm font-semibold leading-relaxed ${isDark ? "text-white" : "text-slate-950"}`}>{landmark}</p>
                   </div>
                </div>

                <div className="flex items-start gap-5 group hover:bg-emerald-500/5 p-4 rounded-2xl transition-all">
                   <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30 shrink-0 group-hover:scale-110 transition-transform">
                     <Clock className="w-5 h-5 text-emerald-400" />
                   </div>
                   <div className="flex-1">
                      <p className="text-[9px] font-black uppercase text-emerald-400 mb-2 tracking-wider">{t('details_op_window')}</p>
                      <p className={`text-sm font-semibold leading-relaxed ${isDark ? "text-white" : "text-slate-950"}`}>{storeHrs}</p>
                   </div>
                </div>
             </div>
          </div>

          {/* Navigate to Store section with map */}
          <div className="space-y-5">
             <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-8 bg-gradient-to-b from-blue-500 to-purple-500 rounded-full shadow-lg shadow-blue-500/50"></div>
                  <h3 className="text-xs font-black uppercase tracking-[0.35em] bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                    Navigate to Store
                  </h3>
                </div>
                <button
                  onClick={() => handleGetDirections(storeAddress)}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 rounded-xl hover:shadow-lg hover:shadow-blue-500/20 transition-all active:scale-95"
                >
                  <Navigation className="w-4 h-4 text-blue-400" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">{t('details_start_gps')}</span>
                </button>
             </div>

             <div className={`relative rounded-[3rem] border-2 overflow-hidden shadow-2xl ${isDark ? "bg-slate-900/90 border-white/10" : "bg-white border-slate-200"}`}>
                {/* Decorative corner accent on map card */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-blue-500/5 to-transparent rounded-bl-full pointer-events-none"></div>

                {/* Map only */}
                <div className="relative h-80 w-full">
                   <LocationMap theme={theme} targetCoords={{ latitude: deal.latitude, longitude: deal.longitude }} selectedLocation={shopName} targetAddress={storeAddress} />
                   {/* Map overlay gradient */}
                   <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-slate-900/20 to-transparent"></div>
                </div>
             </div>
          </div>
       </div>

       {activeClaimId && (
         <div className="fixed inset-0 z-[400] bg-slate-950/95 backdrop-blur-3xl flex items-start justify-center p-4 pt-8 animate-reveal">
           {/* Enhanced QR modal */}
           <div className="w-full max-w-sm max-h-[90vh] glass p-8 rounded-[3rem] border-2 border-yellow-500/40 relative text-center shadow-[0_0_150px_rgba(234,179,8,0.3)]">
              {/* Animated glow rings */}
              <div className="absolute inset-0 rounded-[3rem] border-2 border-yellow-500/20 animate-ping"></div>
              <div className="absolute inset-0 rounded-[3rem] bg-gradient-to-br from-yellow-500/10 via-transparent to-amber-500/10"></div>

              <button
                onClick={onCloseClaim}
                className="absolute top-6 right-6 w-10 h-10 glass rounded-full flex items-center justify-center border-white/20 hover:border-white/40 active:scale-90 transition-all z-10 shadow-lg"
              >
                <X className="w-5 h-5 text-slate-300" />
              </button>

              <div className="mb-6 text-center relative z-10">
                {/* Enhanced shield icon */}
                <div className="relative w-16 h-16 mx-auto mb-4">
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-yellow-500/30 to-amber-500/30 blur-xl animate-pulse"></div>
                  <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-500/40 to-amber-500/40 flex items-center justify-center border-2 border-yellow-500/50 shadow-xl">
                    <ShieldCheck className="w-8 h-8 text-yellow-400" />
                  </div>
                </div>

                <h3 className="text-lg font-black uppercase leading-none text-white mb-4 tracking-wide">
                  Voucher Established
                </h3>

                {/* Enhanced claim ID card */}
                <div className="mt-4 p-4 glass bg-gradient-to-br from-yellow-500/10 to-amber-500/10 rounded-2xl border-2 border-yellow-500/30 shadow-inner">
                   <p className="text-[8px] font-black uppercase tracking-[0.4em] text-yellow-400 mb-1.5">Instance ID</p>
                   <p className="text-lg font-black font-mono text-yellow-400 tracking-wider">{String(activeClaimId).toUpperCase()}</p>
                </div>
              </div>

              {/* Enhanced QR code container */}
              <div className="relative glass p-6 rounded-3xl mb-6 w-full flex justify-center bg-white border-2 border-yellow-500/20 shadow-2xl">
                {/* Corner decorations */}
                <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-yellow-500/50 rounded-tl-2xl"></div>
                <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-yellow-500/50 rounded-tr-2xl"></div>
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-yellow-500/50 rounded-bl-2xl"></div>
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-yellow-500/50 rounded-br-2xl"></div>

                <QRCanvas value={qrPayload} />
              </div>

              {/* Enhanced exit button */}
              <button
                onClick={onCloseClaim}
                className="relative w-full h-14 rounded-2xl overflow-hidden group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-600 via-amber-600 to-yellow-600 animate-pulse"></div>
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-500 to-amber-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <span className="relative text-xs font-black uppercase tracking-[0.3em] text-white">Authorize Exit</span>
              </button>
           </div>
         </div>
       )}

       {showAlreadyClaimedPopup && (
         <div className="fixed inset-0 z-[400] bg-slate-950/95 backdrop-blur-3xl flex items-start justify-center p-6 pt-20 animate-reveal">
           {/* Enhanced already claimed popup */}
           <div className={`w-full max-w-sm glass p-10 rounded-[4rem] border-2 relative text-center shadow-2xl ${
             isFullyRedeemed
               ? 'border-emerald-500/40 shadow-emerald-500/20'
               : 'border-amber-500/40 shadow-amber-500/20'
           }`}>
              {/* Animated glow */}
              <div className={`absolute inset-0 rounded-[4rem] border-2 animate-ping ${
                isFullyRedeemed ? 'border-emerald-500/20' : 'border-amber-500/20'
              }`}></div>

              <button
                onClick={() => setShowAlreadyClaimedPopup(false)}
                className="absolute top-8 right-8 w-10 h-10 glass rounded-full flex items-center justify-center border-white/20 hover:border-white/40 active:scale-90 transition-all z-10 shadow-lg"
              >
                <X className="w-6 h-6 text-slate-300" />
              </button>

              <div className="mb-8 text-center relative z-10">
                {/* Enhanced status icon */}
                <div className="relative w-20 h-20 mx-auto mb-5">
                  <div className={`absolute inset-0 rounded-3xl blur-2xl animate-pulse ${
                    isFullyRedeemed ? 'bg-emerald-500/40' : 'bg-amber-500/40'
                  }`}></div>
                  <div className={`relative w-20 h-20 rounded-3xl flex items-center justify-center border-2 shadow-2xl ${
                    isFullyRedeemed
                      ? 'bg-gradient-to-br from-emerald-500/30 to-green-500/30 border-emerald-500/50'
                      : 'bg-gradient-to-br from-amber-500/30 to-orange-500/30 border-amber-500/50'
                  }`}>
                    {isFullyRedeemed ? (
                      <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                    ) : (
                      <Clock className="w-10 h-10 text-amber-400" />
                    )}
                  </div>
                </div>

                <h3 className="text-xl font-black uppercase text-white leading-none mb-6 tracking-wide">
                  Deal Already Claimed!
                </h3>

                {/* Enhanced status card */}
                <div className={`p-5 glass rounded-3xl border-2 shadow-inner ${
                  isFullyRedeemed
                    ? 'bg-gradient-to-br from-emerald-500/10 to-green-500/10 border-emerald-500/30'
                    : 'bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/30'
                }`}>
                   <p className={`text-[9px] font-black uppercase tracking-[0.45em] mb-2 ${
                     isFullyRedeemed ? 'text-emerald-400' : 'text-amber-400'
                   }`}>
                     Status
                   </p>
                   <p className={`text-xl font-black font-mono tracking-widest ${
                     isFullyRedeemed ? 'text-emerald-400' : 'text-amber-400'
                   }`}>
                     {isFullyRedeemed ? 'VERIFIED ✓' : 'AWAITING MERCHANT'}
                   </p>
                </div>
              </div>

              {/* Enhanced button */}
              <button
                onClick={() => setShowAlreadyClaimedPopup(false)}
                className={`relative w-full h-16 rounded-3xl overflow-hidden group shadow-xl ${
                  isFullyRedeemed ? 'shadow-emerald-500/30' : 'shadow-amber-500/30'
                }`}
              >
                <div className={`absolute inset-0 animate-pulse ${
                  isFullyRedeemed
                    ? 'bg-gradient-to-r from-emerald-600 via-green-600 to-emerald-600'
                    : 'bg-gradient-to-r from-amber-600 via-orange-600 to-amber-600'
                }`}></div>
                <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity ${
                  isFullyRedeemed
                    ? 'bg-gradient-to-r from-emerald-500 to-green-500'
                    : 'bg-gradient-to-r from-amber-500 to-orange-500'
                }`}></div>
                <span className="relative text-sm font-black uppercase tracking-[0.3em] text-white">Understood</span>
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