import React, { useEffect, useState, useCallback } from 'react';
import { Star, StarHalf, Loader2 } from 'lucide-react';
import { useTranslation } from '../contexts/LanguageContext';
import { reviewsService, MerchantReview } from '../services/reviewsService';

interface Props {
  merchantId: string;
  theme: 'light' | 'dark';
}

const FIRST_PAGE = 10;   // top 10 reviews
const NEXT_PAGE = 20;    // then 20 more per "show more"

// Render a 5-star row for `rating` (supports halves, since rating is numeric(2,1)).
function Stars({ rating, sizeClass, isDark }: { rating: number; sizeClass: string; isDark: boolean }) {
  const filled = isDark ? 'text-amber-400 fill-amber-400' : 'text-amber-500 fill-amber-500';
  const empty = isDark ? 'text-slate-600' : 'text-slate-300';
  return (
    <span className="inline-flex items-center">
      {[1, 2, 3, 4, 5].map((i) => {
        if (rating >= i) return <Star key={i} className={`${sizeClass} ${filled}`} />;
        if (rating >= i - 0.5) return <StarHalf key={i} className={`${sizeClass} ${filled}`} />;
        return <Star key={i} className={`${sizeClass} ${empty}`} />;
      })}
    </span>
  );
}

export const CustomerReviews: React.FC<Props> = ({ merchantId, theme }) => {
  const isDark = theme === 'dark';
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [average, setAverage] = useState(0);
  const [total, setTotal] = useState(0);
  const [breakdown, setBreakdown] = useState<Record<string, number>>({ '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 });
  const [reviews, setReviews] = useState<MerchantReview[]>([]);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const data = await reviewsService.getMerchantReviews(merchantId, 0, FIRST_PAGE);
      if (cancelled) return;
      if (data) {
        setAverage(data.average);
        setTotal(data.total);
        setBreakdown(data.breakdown || {});
        setReviews(data.reviews || []);
        setHasMore(!!data.has_more);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [merchantId]);

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    const data = await reviewsService.getMerchantReviews(merchantId, reviews.length, NEXT_PAGE);
    if (data) {
      setReviews((prev) => [...prev, ...(data.reviews || [])]);
      setHasMore(!!data.has_more);
    }
    setLoadingMore(false);
  }, [merchantId, reviews.length]);

  // Loading placeholder (keeps layout height stable on first paint).
  if (loading) {
    return (
      <div className="mt-8 mb-6 flex items-center justify-center py-6">
        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
      </div>
    );
  }

  // No ratings at all → hide the whole section (nothing to review yet).
  if (total === 0) return null;

  const fmtDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch { return ''; }
  };

  return (
    <div className="mt-8 mb-6">
      {/* Header */}
      <h3 className={`text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
        {t('reviews_title')}
      </h3>
      <div className="flex items-center gap-2 mb-1">
        <Stars rating={average} sizeClass="w-5 h-5" isDark={isDark} />
        <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
          {average.toFixed(1)} {t('reviews_out_of_5')}
        </span>
      </div>
      <p className={`text-xs mb-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        {total.toLocaleString()} {t('reviews_ratings')}
      </p>

      {/* Star breakdown bars, 5 → 1 */}
      <div className="space-y-1.5 mb-6">
        {[5, 4, 3, 2, 1].map((star) => {
          const count = breakdown[String(star)] || 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <div key={star} className="flex items-center gap-2">
              <span className={`text-xs w-12 shrink-0 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                {star} {t('reviews_star')}
              </span>
              <div className={`flex-1 h-3.5 rounded-sm overflow-hidden border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
                <div className="h-full bg-amber-500" style={{ width: `${pct}%` }} />
              </div>
              <span className={`text-xs w-9 text-right shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {pct}%
              </span>
            </div>
          );
        })}
      </div>

      {/* Written reviews */}
      {reviews.length === 0 ? (
        <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('reviews_no_written')}</p>
      ) : (
        <div className="space-y-4">
          {reviews.map((r, i) => (
            <div key={i} className={`pb-4 ${i < reviews.length - 1 ? `border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}` : ''}`}>
              <div className="flex items-center justify-between mb-1">
                <Stars rating={r.rating} sizeClass="w-3.5 h-3.5" isDark={isDark} />
                <span className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{fmtDate(r.created_at)}</span>
              </div>
              <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{r.comments}</p>
            </div>
          ))}
        </div>
      )}

      {/* Show more → loads 20 more */}
      {hasMore && (
        <button
          onClick={loadMore}
          disabled={loadingMore}
          className={`mt-4 w-full py-2.5 rounded-xl text-xs font-semibold border transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
            isDark ? 'border-slate-700 text-slate-200' : 'border-slate-200 text-slate-700'
          }`}
        >
          {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : t('reviews_show_more')}
        </button>
      )}
    </div>
  );
};
