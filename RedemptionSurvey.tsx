

import React, { useState, useEffect } from 'react';
import { AppView } from './types';
import { MyredeemService } from './services/MyredeemService'; // New import
import { 
  Store, 
  Loader2,
  Star,
  Zap,
  MessageSquare,
  CheckCircle2,
  ChevronRight,
  ArrowRightCircle
} from 'lucide-react';

export const RedemptionSurvey: React.FC<any> = ({ user, setView }) => {
  const [surveys, setSurveys] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Feedback states
  const [rating, setRating] = useState(5);
  const [comments, setComments] = useState('');

  useEffect(() => {
    if (!user?.id) return;
    const loadSurveys = async () => {
      try {
        setLoading(true);
        // Specifically find 'redeemed' claims that lack a rating
        const data = await MyredeemService.getPendingFeedbackClaims(user.id); // Using new service
        if (data.length === 0) {
          setView('preferences');
        } else {
          setSurveys(data);
          setLoading(false);
        }
      } catch (err) {
        setView('preferences');
      }
    };
    loadSurveys();
  }, [user?.id, setView]);

  const handleFinalize = async () => {
    const current = surveys[currentIndex];
    // FIX: Use interaction_id
    if (!current || isSubmitting) return;

    setIsSubmitting(true);
    try {
      // FIX: Use interaction_id
      await MyredeemService.updateClaimFeedback(current.interaction_id, rating, comments); 
      
      const nextIdx = currentIndex + 1;
      if (nextIdx < surveys.length) {
        setCurrentIndex(nextIdx);
        setRating(5);
        setComments('');
      } else {
        setView('preferences');
      }
    } catch (e) {
      alert("Submission failed. Grid timeout.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[400] bg-slate-950 flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
        <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-500">Retrieving Visit Intel</p>
      </div>
    );
  }

  if (surveys.length === 0) return null;

  const active = surveys[currentIndex];
  const campaign = active.campaign_details;

  return (
    <div className="fixed inset-0 z-[400] bg-black/80 backdrop-blur-xl flex items-center justify-center p-6 animate-reveal">
      <div className="w-full max-w-[340px] glass rounded-[3rem] border-white/10 overflow-hidden shadow-2xl flex flex-col bg-slate-900/95 ring-1 ring-white/10">
        
        <div className="p-8 flex flex-col overflow-y-auto hide-scrollbar">
          <div className="text-center mb-6">
            <h2 className="text-lg font-black uppercase tracking-tighter text-white leading-none">Post-Visit Rating</h2>
            <p className="text-[8px] font-black uppercase text-blue-500 tracking-[0.4em] mt-2">Verified at {active.redeemed_at?.slice(11,16)}</p>
          </div>

          <div className="relative aspect-[16/10] rounded-[2rem] overflow-hidden border border-white/10 mb-8">
            <img 
              src={campaign?.image_url || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=400&q=80'} 
              className="w-full h-full object-cover" 
              alt="Visual"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent"></div>
            <div className="absolute bottom-4 left-5 right-5 text-white">
               <div className="flex items-center gap-1.5 mb-1">
                  <Store className="w-3 h-3 text-blue-500" />
                  <p className="text-blue-500 text-[8px] font-black uppercase tracking-widest">{campaign?.shop_name}</p>
               </div>
               <h3 className="text-xs font-black uppercase truncate">{campaign?.deal_heading}</h3>
            </div>
          </div>

          <div className="space-y-6">
             <div className="text-center">
                <div className="flex justify-center gap-2 mb-2">
                   {[1, 2, 3, 4, 5].map((s) => (
                      <button key={s} onClick={() => setRating(s)} className="active:scale-90 transition-transform">
                         <Star className={`w-8 h-8 ${rating >= s ? 'text-amber-500 fill-amber-500' : 'text-slate-700'}`} />
                      </button>
                   ))}
                </div>
                <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Rate your experience</p>
             </div>

             <div className="relative group">
                <MessageSquare className="absolute left-4 top-4 w-4 h-4 text-slate-500" />
                <textarea 
                  value={comments} 
                  onChange={e => setComments(e.target.value)} 
                  placeholder="Share details about your visit..." 
                  className="input-premium pl-12 pt-4 min-h-[100px] text-xs resize-none"
                />
             </div>

             <button 
               onClick={handleFinalize}
               disabled={isSubmitting}
               className="w-full btn-premium h-16 rounded-2xl shadow-2xl active:scale-95 transition-all"
             >
                {isSubmitting ? (
                   <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                   <div className="flex items-center justify-center gap-3">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="text-xs font-black uppercase tracking-widest">Submit Feedback</span>
                   </div>
                )}
             </button>
          </div>
        </div>

        <div className="p-4 bg-white/5 text-center border-t border-white/5">
           <button onClick={() => setView('preferences')} className="flex items-center gap-2 text-[8px] font-black uppercase tracking-[0.4em] text-slate-600 hover:text-blue-500 transition-colors mx-auto">
             <span>Skip for now</span>
             <ArrowRightCircle className="w-3 h-3" />
           </button>
        </div>
      </div>
    </div>
  );
};