
import React, { useState, useEffect } from 'react';
import { AppView } from './types';
import { MyredeemService } from './services/MyredeemService'; // New import
import { 
  Loader2, 
  X, 
  Star, 
  Store, 
  Tag, 
  ChevronRight,
  MessageSquare,
  Sparkles,
  Info
} from 'lucide-react';

interface CampaignSurveyProps {
  setView: (view: AppView) => void;
  user: any;
}

export const CampaignSurvey: React.FC<CampaignSurveyProps> = ({ setView, user }) => {
  const [surveys, setSurveys] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [selectedRating, setSelectedRating] = useState<number>(0);
  const [comment, setComment] = useState<string>('');
  const [hoveredStar, setHoveredStar] = useState<number | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    const loadInteractions = async () => {
      try {
        const data = await MyredeemService.getPendingRedemptionSurveys(user.id); // Using new service
        if (data && data.length > 0) {
          setSurveys(data);
        } else {
          setView('preferences');
        }
      } catch (err) {
        console.error("Survey Fetch Error:", err);
        setView('preferences');
      } finally {
        setLoading(false);
      }
    };
    loadInteractions();
  }, [user?.id, setView]);

  const handleSubmit = async () => {
    if (selectedRating === 0 || isSubmitting) return;

    const current = surveys[currentIndex];
    setIsSubmitting(true);
    
    try {
      // FIX: Use interaction_id or id from the current object which represents CampaignInteraction
      const interactionId = current.interaction_id || current.id;
      
      await MyredeemService.updateClaimFeedback( // Using new service
        String(interactionId), 
        selectedRating, 
        comment || "Verified Visit Feedback"
      );
      
      if (currentIndex < surveys.length - 1) {
        setCurrentIndex(prev => prev + 1);
        setSelectedRating(0);
        setComment('');
        setHoveredStar(null);
      } else {
        setView('preferences');
      }
    } catch (err) {
      console.error("Rating submission failed:", err);
      alert("Grid Sync Failure. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[600] bg-slate-950 flex flex-col items-center justify-center p-6">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
        <p className="text-[8px] font-black uppercase tracking-[0.5em] text-slate-500">Uplinking Intelligence</p>
      </div>
    );
  }

  if (surveys.length === 0) return null;

  const active = surveys[currentIndex];
  const campaign = active.campaign_details;
  // FIX: Use interaction_id or id from the current object
  const displayId = String(active.interaction_id || active.id || '').toUpperCase();

  return (
    <div className="fixed inset-0 z-[600] bg-black/90 backdrop-blur-2xl flex items-center justify-center p-3 animate-reveal overflow-hidden">
      <div className="w-full max-w-[340px] glass h-fit max-h-[90vh] rounded-[2.5rem] border-blue-500/20 bg-slate-900/95 shadow-[0_0_100px_rgba(0,0,0,1)] relative flex flex-col p-4 ring-1 ring-white/10">
        
        {/* Compact Header */}
        <div className="flex justify-between items-center mb-3 px-1">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
               <Store className="w-3 h-3 text-blue-500" />
            </div>
            <span className="text-[8px] font-black uppercase text-blue-500 tracking-widest">{campaign?.shop_name || 'Partner'}</span>
          </div>
          <button onClick={() => setView('preferences')} className="text-slate-500 hover:text-white p-1 active:scale-75 transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Compressed Banner */}
        <div className="relative h-24 rounded-2xl overflow-hidden border border-white/5 bg-black/40 mb-3 shrink-0">
          <img 
            src={campaign?.image_url || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=400&q=80'} 
            className="w-full h-full object-cover opacity-50" 
            alt="" 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent"></div>
          <div className="absolute bottom-2 left-3 right-3">
             <h4 className="text-sm font-black uppercase text-white leading-tight truncate">{campaign?.deal_heading}</h4>
          </div>
        </div>

        {/* Hyper-Condensed Intel Card */}
        <div className="bg-white/5 rounded-2xl border border-white/5 p-3 space-y-2 mb-3 shrink-0">
           <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-md w-fit">
              <Tag className="w-2.5 h-2.5 text-amber-500" />
              <span className="text-[7px] font-black text-amber-500 uppercase tracking-widest">{campaign?.offer_value}</span>
           </div>
           <p className="text-[8px] font-medium text-slate-400 leading-relaxed line-clamp-2 px-1 italic">
             "{campaign?.long_description || "Verified redemption completed."}"
           </p>
        </div>

        {/* Primary Interaction Area - NO SCROLL */}
        <div className="space-y-3 shrink-0">
           <div className="bg-white/[0.02] p-3 rounded-2xl border border-white/5 shadow-inner text-center">
              <div className="flex items-center justify-center gap-1.5 mb-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onMouseEnter={() => setHoveredStar(star)}
                    onMouseLeave={() => setHoveredStar(null)}
                    onClick={() => setSelectedRating(star)}
                    disabled={isSubmitting}
                    className="p-0.5 transition-all duration-200 active:scale-75"
                  >
                    <Star 
                      className={`w-8 h-8 ${
                        (hoveredStar !== null ? star <= hoveredStar : star <= selectedRating) 
                          ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]' 
                          : 'text-slate-700 fill-slate-800/40'
                      }`}
                      strokeWidth={2}
                    />
                  </button>
                ))}
              </div>
              <p className={`text-[7px] font-black uppercase tracking-[0.4em] h-2 transition-colors ${selectedRating > 0 ? 'text-amber-500' : 'text-slate-600'}`}>
                {selectedRating > 0 ? `${['Poor', 'Fair', 'Good', 'Elite', 'Premium'][selectedRating-1]} Node Experience` : 'Select Visit Rating'}
              </p>
           </div>

           <div className="relative">
              <MessageSquare className="absolute left-3 top-3 w-3 h-3 text-slate-600" />
              <textarea 
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Feedback (Optional)"
                className="input-premium pl-10 pt-2.5 min-h-[60px] h-16 text-[9px] resize-none bg-white/[0.01] border-white/5 rounded-xl py-2"
              />
           </div>
        </div>

        {/* Footer Action - Always visible */}
        <div className="pt-4 pb-2 mt-auto">
          <button 
            onClick={handleSubmit}
            disabled={selectedRating === 0 || isSubmitting}
            className="w-full btn-premium h-14 rounded-2xl shadow-xl flex items-center justify-between px-6 disabled:opacity-20 transition-all group overflow-hidden"
          >
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin mx-auto" />
            ) : (
              <>
                <span className="text-[10px] font-black uppercase tracking-widest text-white">Authorize Intel</span>
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center group-hover:translate-x-1 transition-transform border border-white/10">
                  <ChevronRight className="w-5 h-5 text-white" strokeWidth={4} />
                </div>
              </>
            )}
          </button>
          
          <div className="flex items-center justify-center gap-2 mt-4 opacity-30">
            <Sparkles className="w-2 h-2 text-slate-600" />
            <p className="text-[6px] font-black text-slate-600 uppercase tracking-[0.5em]">
              Grid ID: {displayId.slice(0, 10)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};