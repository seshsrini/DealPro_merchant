import React, { useState, useEffect } from 'react';
import { Star, X, Loader2, CheckCircle2 } from 'lucide-react';
import { ratingService, PendingFeedbackClaim } from './services/ratingService';
import { useTranslation } from './contexts/LanguageContext';

interface RatingPopupProps {
  userId: string;
  onClose: () => void;
  theme?: 'dark' | 'light';
}

export const RatingPopup: React.FC<RatingPopupProps> = ({ userId, onClose, theme = 'dark' }) => {
  const [pendingClaims, setPendingClaims] = useState<PendingFeedbackClaim[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comments, setComments] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const { getLocalizedText } = useTranslation();

  const isDark = theme === 'dark';

  useEffect(() => {
    fetchPendingClaims();
  }, [userId]);

  const fetchPendingClaims = async () => {
    try {
      setIsLoading(true);
      console.log('[RatingPopup] Fetching pending claims for user:', userId);
      const claims = await ratingService.getPendingFeedbackClaims(userId);
      console.log('[RatingPopup] Fetched claims:', claims);
      setPendingClaims(claims);
      setIsLoading(false);

      // If no claims, close the popup
      if (!claims || claims.length === 0) {
        console.log('[RatingPopup] No pending claims found, closing popup');
        onClose();
      }
    } catch (error) {
      console.error('[RatingPopup] Failed to fetch pending claims:', error);
      setIsLoading(false);
      // On error, close the popup
      onClose();
    }
  };

  const handleSubmitRating = async () => {
    if (rating === 0) {
      alert('Please select a rating before submitting.');
      return;
    }

    const currentClaim = pendingClaims[currentIndex];
    if (!currentClaim) return;

    try {
      setIsSubmitting(true);
      await ratingService.submitRating(String(currentClaim.interaction_id), rating, comments.trim());

      // Show success animation
      setShowSuccess(true);
      await new Promise(resolve => setTimeout(resolve, 1500));
      setShowSuccess(false);

      // Move to next claim or close
      if (currentIndex < pendingClaims.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setRating(0);
        setComments('');
      } else {
        onClose(); // All done
      }
    } catch (error: any) {
      console.error('[RatingPopup] Failed to submit rating:', error);
      alert(error.message || 'Failed to submit rating. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    if (currentIndex < pendingClaims.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setRating(0);
      setComments('');
    } else {
      onClose();
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className={`p-6 rounded-2xl ${isDark ? 'bg-slate-900/95' : 'bg-white'} border ${isDark ? 'border-white/10' : 'border-gray-200'} shadow-2xl`}>
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto" />
          <p className={`text-xs font-bold mt-3 uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-gray-600'}`}>
            Loading...
          </p>
        </div>
      </div>
    );
  }

  // If no pending claims, don't show popup
  if (pendingClaims.length === 0) {
    return null;
  }

  const currentClaim = pendingClaims[currentIndex];
  const campaignDetails = currentClaim.campaign_details;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-reveal">
      <div className={`w-full max-w-md rounded-3xl ${isDark ? 'bg-slate-900/95' : 'bg-white'} border ${isDark ? 'border-white/10' : 'border-gray-200'} shadow-2xl overflow-hidden`}>
        {/* Header */}
        <div className={`p-4 ${isDark ? 'bg-gradient-to-r from-blue-900/50 to-purple-900/50' : 'bg-gradient-to-r from-blue-100 to-purple-100'} border-b ${isDark ? 'border-white/10' : 'border-gray-200'} relative`}>
          <button
            onClick={onClose}
            className={`absolute top-3 right-3 p-1.5 rounded-xl ${isDark ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'} transition-all active:scale-95`}
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 mb-1.5">
            <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
            <h2 className={`text-lg font-black uppercase tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Rate Your Experience
            </h2>
          </div>
          <p className={`text-xs font-bold uppercase tracking-widest ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
            {currentIndex + 1} of {pendingClaims.length} Pending
          </p>
        </div>

        {/* Success Animation */}
        {showSuccess && (
          <div className="absolute inset-0 flex items-center justify-center bg-green-500/20 backdrop-blur-sm z-10 animate-reveal">
            <div className={`p-6 rounded-2xl ${isDark ? 'bg-slate-900' : 'bg-white'} border-2 border-green-500 shadow-2xl`}>
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3 animate-bounce" />
              <p className="text-base font-black uppercase tracking-tight text-green-500">Rating Submitted!</p>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Deal Info */}
          <div className="flex gap-3">
            <img
              src={campaignDetails.image_url}
              alt={campaignDetails.shop_name}
              className="w-16 h-16 rounded-xl object-cover border-2 border-white/10"
              onError={(e) => {
                e.currentTarget.src = 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=600&q=80';
              }}
            />
            <div className="flex-1">
              <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                {getLocalizedText(campaignDetails.localized_shop_name, campaignDetails.shop_name)}
              </p>
              <h3 className={`text-sm font-black uppercase leading-tight mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {getLocalizedText(campaignDetails.localized_heading, campaignDetails.deal_heading)}
              </h3>
              <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">
                {getLocalizedText(campaignDetails.localized_offer, campaignDetails.offer_value)}
              </p>
            </div>
          </div>

          {/* Rating Stars */}
          <div className="space-y-2">
            <label className={`text-xs font-black uppercase tracking-wider ${isDark ? 'text-white' : 'text-gray-900'}`}>
              How was your experience?
            </label>
            <div className="flex gap-1.5 justify-center py-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="transition-all active:scale-95"
                >
                  <Star
                    className={`w-8 h-8 transition-all ${
                      star <= (hoverRating || rating)
                        ? 'text-amber-400 fill-amber-400 scale-110'
                        : isDark
                        ? 'text-slate-700'
                        : 'text-gray-300'
                    }`}
                  />
                </button>
              ))}
            </div>
            <p className={`text-center text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
              {rating === 0 ? 'Tap to rate' : rating === 5 ? 'Excellent!' : rating === 4 ? 'Great!' : rating === 3 ? 'Good' : rating === 2 ? 'Fair' : 'Needs Improvement'}
            </p>
          </div>

          {/* Comments */}
          <div className="space-y-1.5">
            <label className={`text-xs font-black uppercase tracking-wider ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Comments (Optional)
            </label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Share your thoughts..."
              rows={2}
              className={`w-full px-3 py-2 rounded-xl ${
                isDark
                  ? 'bg-slate-800/50 text-white border-white/10 placeholder:text-slate-500'
                  : 'bg-gray-100 text-gray-900 border-gray-300 placeholder:text-gray-400'
              } border-2 focus:border-blue-500 focus:outline-none text-xs font-medium resize-none`}
              maxLength={500}
            />
            <p className={`text-[10px] font-bold text-right ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>
              {comments.length}/500
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSkip}
              disabled={isSubmitting}
              className={`flex-1 py-2.5 px-3 rounded-xl font-black uppercase tracking-widest text-xs transition-all active:scale-95 ${
                isDark
                  ? 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-white/10'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300 border border-gray-300'
              } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Skip
            </button>
            <button
              onClick={handleSubmitRating}
              disabled={isSubmitting || rating === 0}
              className={`flex-1 py-2.5 px-3 rounded-xl font-black uppercase tracking-widest text-xs transition-all active:scale-95 shadow-lg ${
                isSubmitting || rating === 0
                  ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:shadow-xl shadow-blue-500/30'
              } flex items-center justify-center gap-2`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Rating'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
