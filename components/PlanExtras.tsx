import React from 'react';
import { Megaphone, BookOpen } from 'lucide-react';
import { SubscriptionTier } from '../types';
import { planIncludesCatalogue } from '../hooks/useCatalogueAccess';

/** Announcements a plan includes per month, as shown on plan cards. */
export function announcementsLabel(tier: Pick<SubscriptionTier, 'max_announcements_per_month'>): string {
  const n = Number(tier.max_announcements_per_month ?? 0);
  if (n >= 999) return 'Unlimited announcements/month';
  if (n <= 0) return 'No announcements';
  return `${n} announcement${n === 1 ? '' : 's'}/month`;
}

/** Announcements count + (non-Basic plans) the Product Catalogue note, under a plan's limits. */
export const PlanExtras: React.FC<{ tier: SubscriptionTier; isDark: boolean; className?: string }> = ({ tier, isDark, className = '' }) => (
  <div className={`space-y-1.5 text-xs ${className}`}>
    <p className={`flex items-center gap-1.5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
      <Megaphone className="w-3.5 h-3.5 text-violet-400 shrink-0" /> {announcementsLabel(tier)}
    </p>
    {planIncludesCatalogue(tier) && (
      <p className={`flex items-start gap-1.5 font-medium ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
        <BookOpen className="w-3.5 h-3.5 shrink-0 mt-px" />
        <span>Includes Product Catalogue: showcase your products and items, with photos and prices, for customers to browse.</span>
      </p>
    )}
  </div>
);
