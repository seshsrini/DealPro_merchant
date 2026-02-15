
import React, { useState, useMemo } from 'react';
import { Deal } from './types';
import {
  MapPin,
  Calendar,
  Clock,
  Sparkles,
  Zap,
  Star,
  Heart,
  Share2,
  CheckCircle2,
  Flame,
  Award,
  TrendingUp,
  X,
  ShieldCheck,
  Loader2
} from 'lucide-react';
import { useTranslation } from './contexts/LanguageContext';
import { QRCanvas } from './components/QRCanvas';

interface DealOfTheDayDetailsProps {
  deal: Deal;
  user: any;
  onRedeem: (deal: Deal) => void;
  onToggleFavorite: (deal: Deal) => void;
  isFavorite: boolean;
  isRedeemed: boolean;
  isClaimed: boolean;
  isRedeeming: boolean;
  activeClaimId: string | null;
  onCloseClaim: () => void;
  theme: 'light' | 'dark';
}

export const DealOfTheDayDetails: React.FC<DealOfTheDayDetailsProps> = ({
  deal,
  user,
  onRedeem,
  onToggleFavorite,
  isFavorite,
  isRedeemed,
  isClaimed,
  isRedeeming,
  activeClaimId,
  onCloseClaim,
  theme
}) => {
  const { locale } = useTranslation();
  const isDark = theme === 'dark';
  const [showShareToast, setShowShareToast] = useState(false);

  // QR payload for the claim modal
  const qrPayload = useMemo(() => ({
    campaign_id: deal.campaign_id,
    merchant_id: deal.merchantId,
    consumer_id: user.id,
    timestamp: Date.now(),
    claim_no: activeClaimId
  }), [deal.campaign_id, deal.merchantId, user.id, activeClaimId]);

  const getLocalizedText = (field: any, fallback: string) => {
    if (!field) return fallback;
    if (typeof field === 'string') return field;
    return field[locale] || field['en'] || fallback;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(locale === 'en' ? 'en-US' : 'en-GB', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: getLocalizedText(deal.localized_heading, deal.deal_heading),
        text: `Check out this amazing Deal of the Day: ${getLocalizedText(deal.localized_offer, deal.offer_value)}`,
      }).catch(() => {});
    } else {
      setShowShareToast(true);
      setTimeout(() => setShowShareToast(false), 2000);
    }
  };

  const isFutureDeal = new Date(deal.start_date) > new Date();

  // Debug logging for store details
  console.log('[DealOfTheDayDetails] Store details:', {
    address: deal.address,
    landmark: deal.landmark,
    storeHrs: deal.storeHrs
  });

  return (
    <>
      <style>{`
        .deal-description div {
          margin-bottom: 0.5rem;
        }
        .deal-description br {
          display: block;
          content: "";
          margin: 0.25rem 0;
        }
        .deal-description ul,
        .deal-description ol {
          margin-left: 1.5rem;
          margin-bottom: 0.5rem;
        }
        .deal-description li {
          margin-bottom: 0.25rem;
        }
        .deal-description strong,
        .deal-description b {
          font-weight: 700;
          color: #fbbf24;
        }
      `}</style>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900">
        {/* Animated grid pattern */}
        <div className="fixed inset-0 opacity-10 pointer-events-none">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle, #eab308 1px, transparent 1px)',
            backgroundSize: '30px 30px'
          }}></div>
        </div>

      {/* Content */}
      <div className="relative min-h-screen pb-24">
        {/* Hero Image Section */}
        <div className="relative h-[35vh] overflow-hidden">
            <img
              src={deal.image_url || 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=800&q=80'}
              alt={getLocalizedText(deal.localized_heading, deal.deal_heading)}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.src = 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=800&q=80';
              }}
            />
            {/* Premium gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/70 to-transparent"></div>

            {/* Top badges */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
              {/* Deal of the Day Badge */}
              <div className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-yellow-500 via-amber-500 to-yellow-600 shadow-xl shadow-yellow-500/50 border-2 border-white/30">
                <div className="flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-white fill-white animate-pulse" />
                  <span className="text-[9px] font-black text-white uppercase tracking-wider">Deal of Day</span>
                  <Sparkles className="w-3 h-3 text-white fill-white" />
                </div>
              </div>

              {/* Status Badge - aligned with Deal of Day */}
              {isFutureDeal ? (
                <div className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 shadow-xl shadow-green-500/50 border-2 border-white/30">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-white" />
                    <span className="text-[9px] font-black text-white uppercase tracking-wider">Coming Soon</span>
                  </div>
                </div>
              ) : (
                <div className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-red-600 shadow-xl shadow-orange-500/50 border-2 border-white/30 animate-pulse">
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-3 h-3 text-white fill-white" />
                    <span className="text-[9px] font-black text-white uppercase tracking-wider">Live Now</span>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom premium card overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-6">
              {/* Shop name with premium badge */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center border-2 border-white/30 shadow-xl shadow-yellow-500/30">
                  <Award className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-yellow-400 uppercase tracking-widest">Featured Merchant</p>
                  <h2 className="text-xl font-black text-white leading-tight">
                    {getLocalizedText(deal.localized_shop_name, deal.shop_name)}
                  </h2>
                </div>
                {deal.rating > 0 && (
                  <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-yellow-500/20 backdrop-blur-md border border-yellow-400/30">
                    <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                    <span className="text-sm font-black text-yellow-300">{deal.rating.toFixed(1)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Content Section - Scrollable if needed */}
          <div className="relative px-6 pb-6 overflow-y-auto scrollbar-hide flex-1">
            {/* Mega Offer Display */}
            <div className="mb-6 mt-6">
              <div className="p-6 rounded-[2rem] bg-gradient-to-br from-yellow-500/20 via-amber-500/20 to-orange-500/20 border-2 border-yellow-500/30 shadow-2xl shadow-yellow-500/20 backdrop-blur-md">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Sparkles className="w-6 h-6 text-yellow-400 fill-yellow-400 animate-pulse" />
                  <h3 className="text-xs font-black text-yellow-300 uppercase tracking-[0.2em]">Exclusive Offer</h3>
                  <Sparkles className="w-6 h-6 text-yellow-400 fill-yellow-400 animate-pulse" />
                </div>
                <p className="text-3xl font-black text-center text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-yellow-400 to-amber-300 leading-tight">
                  {getLocalizedText(deal.localized_offer, deal.offer_value)}
                </p>
              </div>
            </div>

            {/* Action Buttons - Right below Exclusive Offer */}
            <div className="mb-6 flex items-center gap-2">
              {/* Favorite Button */}
              <button
                onClick={() => onToggleFavorite(deal)}
                className="w-12 h-12 rounded-xl glass border border-white/10 flex items-center justify-center transition-all active:scale-90 shadow-xl"
              >
                <Heart className={`w-5 h-5 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-slate-400'}`} />
              </button>

              {/* Share Button */}
              <button
                onClick={handleShare}
                className="w-12 h-12 rounded-xl glass border border-white/10 flex items-center justify-center transition-all active:scale-90 shadow-xl"
              >
                <Share2 className="w-5 h-5 text-slate-400" />
              </button>

              {/* Main Action Button */}
              {isRedeemed ? (
                <div className="flex-1 h-12 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 border-2 border-green-400/30 flex items-center justify-center gap-2 shadow-xl shadow-green-500/30">
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  <span className="text-xs font-black text-white uppercase tracking-widest">Redeemed</span>
                </div>
              ) : isClaimed ? (
                <div className="flex-1 h-12 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 border-2 border-blue-400/30 flex items-center justify-center gap-2 shadow-xl shadow-blue-500/30">
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  <span className="text-xs font-black text-white uppercase tracking-widest">Claimed</span>
                </div>
              ) : isFutureDeal ? (
                <div className="flex-1 h-12 rounded-xl bg-slate-700/50 border-2 border-slate-600/30 flex items-center justify-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-black text-white uppercase tracking-widest">Coming Soon</span>
                </div>
              ) : (
                <button
                  onClick={() => onRedeem(deal)}
                  disabled={isRedeeming}
                  className="flex-1 h-12 rounded-xl bg-gradient-to-r from-yellow-500 via-amber-500 to-yellow-600 border-2 border-yellow-400/50 flex items-center justify-center gap-2 shadow-2xl shadow-yellow-500/50 hover:shadow-yellow-500/70 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRedeeming ? (
                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4 text-white fill-white" />
                  )}
                  <span className="text-xs font-black text-white uppercase tracking-widest">
                    {isRedeeming ? 'Processing...' : 'Claim Now'}
                  </span>
                </button>
              )}
            </div>

            {/* Deal Title */}
            <h1 className="text-2xl font-black text-white mb-4 leading-tight">
              {getLocalizedText(deal.localized_heading, deal.deal_heading)}
            </h1>

            {/* Meta Info Cards */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              {/* Date Card */}
              <div className={`p-4 rounded-2xl border-2 ${
                isFutureDeal
                  ? 'bg-green-500/10 border-green-400/30'
                  : 'bg-orange-500/10 border-orange-400/30'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className={`w-4 h-4 ${isFutureDeal ? 'text-green-400' : 'text-orange-400'}`} />
                  <p className={`text-[9px] font-bold uppercase tracking-wider ${
                    isFutureDeal ? 'text-green-300' : 'text-orange-300'
                  }`}>
                    {isFutureDeal ? 'Live On' : 'Available'}
                  </p>
                </div>
                <p className={`text-sm font-black ${isFutureDeal ? 'text-green-400' : 'text-orange-400'}`}>
                  {formatDate(deal.start_date)}
                </p>
              </div>

              {/* Location Card */}
              <div className="p-4 rounded-2xl bg-blue-500/10 border-2 border-blue-400/30">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-4 h-4 text-blue-400" />
                  <p className="text-[9px] font-bold uppercase tracking-wider text-blue-300">Location</p>
                </div>
                <p className="text-sm font-black text-blue-400">{deal.city}</p>
              </div>
            </div>

            {/* Description */}
            <div className="mb-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5" />
                Deal Details
              </h3>
              <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/50">
                <div
                  className="text-sm text-slate-200 leading-relaxed deal-description"
                  dangerouslySetInnerHTML={{ __html: getLocalizedText(deal.localized_description, deal.long_description) }}
                />
              </div>
            </div>

            {/* Store Details */}
            {(deal.address || deal.landmark || deal.storeHrs) && (
              <div className="mb-4">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5" />
                  Store Information
                </h3>
                <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/50 space-y-2">
                  {deal.address && (
                    <div>
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Address</p>
                      <p className="text-sm text-slate-200">{deal.address}</p>
                    </div>
                  )}
                  {deal.landmark && (
                    <div>
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Landmark</p>
                      <p className="text-sm text-slate-200">{deal.landmark}</p>
                    </div>
                  )}
                  {deal.storeHrs && (
                    <div>
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Store Hours</p>
                      <p className="text-sm text-slate-200">{deal.storeHrs}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Share Toast */}
        {showShareToast && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl bg-slate-800 border border-slate-700 shadow-2xl animate-reveal z-50">
            <p className="text-sm font-bold text-white">Link copied to clipboard!</p>
          </div>
        )}

        {/* QR Code Modal - Shows after successful claim */}
        {activeClaimId && (
          <div className="fixed inset-0 z-[400] bg-slate-950/95 backdrop-blur-3xl flex items-center justify-center p-4 animate-reveal">
            <div className="w-full max-w-xs glass p-4 rounded-2xl border-2 border-yellow-500/40 relative text-center shadow-[0_0_100px_rgba(234,179,8,0.3)]">
              {/* Close button */}
              <button
                onClick={onCloseClaim}
                className="absolute top-2 right-2 w-7 h-7 glass rounded-full flex items-center justify-center border-white/20 hover:border-white/40 active:scale-90 transition-all z-10"
              >
                <X className="w-3.5 h-3.5 text-slate-300" />
              </button>

              {/* Header */}
              <div className="mb-3 text-center relative z-10">
                <div className="relative w-10 h-10 mx-auto mb-2">
                  <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-yellow-500/30 to-amber-500/30 blur-md animate-pulse"></div>
                  <div className="relative w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-500/40 to-amber-500/40 flex items-center justify-center border-2 border-yellow-500/50">
                    <ShieldCheck className="w-5 h-5 text-yellow-400" />
                  </div>
                </div>

                <h3 className="text-sm font-black uppercase leading-none text-white mb-2">
                  Deal Claimed!
                </h3>

                {/* Claim Code Display */}
                <div className="p-2 glass bg-gradient-to-br from-yellow-500/10 to-amber-500/10 rounded-lg border border-yellow-500/30">
                  <p className="text-[6px] font-black uppercase tracking-[0.3em] text-yellow-400 mb-0.5">Claim Code</p>
                  <p className="text-sm font-black font-mono text-yellow-400 tracking-wider">{String(activeClaimId).toUpperCase()}</p>
                </div>
              </div>

              {/* QR Code */}
              <div className="relative glass p-3 rounded-xl mb-3 w-full flex justify-center bg-white border border-yellow-500/20">
                <QRCanvas value={qrPayload} />
              </div>

              {/* Exit button */}
              <button
                onClick={onCloseClaim}
                className="relative w-full h-9 rounded-lg overflow-hidden group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-600 via-amber-600 to-yellow-600"></div>
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-500 to-amber-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <span className="relative text-[10px] font-black uppercase tracking-wider text-white">Close</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
