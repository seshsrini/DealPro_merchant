/**
 * StepTrustBadges.tsx
 *
 * Lets the merchant select up to 4 trust/quality badges to display
 * on their deal banner and detail page.
 */

import React, { useEffect, useState } from 'react';
import {
  Shield, Award, Leaf, Truck, Clock, ThumbsUp,
  Heart, Star, BadgeCheck, Sparkles, Recycle, Gem,
  Headphones, Gift, Zap,
} from 'lucide-react';
import { floatIn } from './floatIn';

export interface TrustBadge {
  id: string;
  label: string;
  icon: React.ReactNode;
}

export const TRUST_BADGES: TrustBadge[] = [
  { id: 'premium_quality',     label: 'Premium Quality',       icon: <Award className="w-5 h-5" /> },
  { id: 'genuine_product',     label: 'Genuine Product',       icon: <BadgeCheck className="w-5 h-5" /> },
  { id: '100_natural',         label: '100% Natural',          icon: <Leaf className="w-5 h-5" /> },
  { id: 'free_delivery',       label: 'Free Delivery',         icon: <Truck className="w-5 h-5" /> },
  { id: 'fast_delivery',       label: 'Fast & Safe Delivery',  icon: <Zap className="w-5 h-5" /> },
  { id: 'best_price',          label: 'Best Price Guarantee',  icon: <ThumbsUp className="w-5 h-5" /> },
  { id: 'trusted_seller',      label: 'Trusted Seller',        icon: <Shield className="w-5 h-5" /> },
  { id: 'hygiene_packed',      label: 'Hygiene Packaging',     icon: <Sparkles className="w-5 h-5" /> },
  { id: 'customer_support',    label: 'Customer Support',      icon: <Headphones className="w-5 h-5" /> },
  { id: 'top_rated',           label: 'Top Rated',             icon: <Star className="w-5 h-5" /> },
  { id: 'eco_friendly',        label: 'Eco Friendly',          icon: <Recycle className="w-5 h-5" /> },
  { id: 'handpicked',          label: 'Handpicked Selection',  icon: <Gem className="w-5 h-5" /> },
  { id: 'limited_edition',     label: 'Limited Edition',       icon: <Gift className="w-5 h-5" /> },
  { id: 'warranty',            label: 'Warranty Included',     icon: <Shield className="w-5 h-5" /> },
  { id: 'loved_by_customers',  label: 'Loved by Customers',    icon: <Heart className="w-5 h-5" /> },
];

const MAX_BADGES = 4;

interface StepTrustBadgesProps {
  selectedBadgeIds: string[];
  onChange: (badgeIds: string[]) => void;
  onNext: () => void;
  onBack: () => void;
  theme: 'light' | 'dark';
}

export const StepTrustBadges: React.FC<StepTrustBadgesProps> = ({
  selectedBadgeIds, onChange, onNext, onBack, theme,
}) => {
  const isDark = theme === 'dark';
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  const toggleBadge = (id: string) => {
    if (selectedBadgeIds.includes(id)) {
      onChange(selectedBadgeIds.filter(b => b !== id));
    } else if (selectedBadgeIds.length < MAX_BADGES) {
      onChange([...selectedBadgeIds, id]);
    }
  };

  return (
    <div className="flex flex-col min-h-full px-6 pt-6">
      <div style={floatIn(0, visible)}>
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
          <BadgeCheck className="w-8 h-8 text-emerald-500" />
        </div>
        <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
          Trust badges
        </h2>
        <p className={`text-sm mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Select up to {MAX_BADGES} badges that best describe your offer. These appear on your deal to build trust.
        </p>
        <p className={`text-xs mb-5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          {selectedBadgeIds.length}/{MAX_BADGES} selected
          {selectedBadgeIds.length >= MAX_BADGES && ' (maximum reached)'}
        </p>
      </div>

      {/* Badge grid */}
      <div style={floatIn(200, visible)} className="flex-1 overflow-y-auto pb-4">
        <div className="grid grid-cols-2 gap-2.5">
          {TRUST_BADGES.map(badge => {
            const isSelected = selectedBadgeIds.includes(badge.id);
            const isDisabled = !isSelected && selectedBadgeIds.length >= MAX_BADGES;
            return (
              <button
                key={badge.id}
                onClick={() => !isDisabled && toggleBadge(badge.id)}
                disabled={isDisabled}
                className={`flex items-center gap-2.5 p-3 rounded-xl text-left transition-all active:scale-[0.98] border ${
                  isSelected
                    ? isDark
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-emerald-500 bg-emerald-50'
                    : isDisabled
                      ? isDark
                        ? 'border-slate-800 bg-slate-900 opacity-40'
                        : 'border-slate-200 bg-slate-50 opacity-40'
                      : isDark
                        ? 'border-slate-700 bg-slate-800/50 hover:bg-slate-800'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className={`shrink-0 ${
                  isSelected ? 'text-emerald-500' : isDark ? 'text-slate-400' : 'text-slate-500'
                }`}>
                  {badge.icon}
                </div>
                <span className={`text-xs font-medium leading-tight ${
                  isSelected
                    ? 'text-emerald-500'
                    : isDark ? 'text-white' : 'text-slate-900'
                }`}>
                  {badge.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Navigation */}
      <div style={floatIn(400, visible)} className="mt-auto pb-8 flex gap-3">
        <button
          onClick={onBack}
          className={`flex-1 h-14 rounded-xl text-base font-semibold active:scale-[0.98] transition-all ${
            isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
          }`}
        >
          Back
        </button>
        <button
          onClick={onNext}
          className="flex-[2] h-14 rounded-xl bg-slate-900 text-white text-base font-semibold active:scale-[0.98] transition-all"
        >
          {selectedBadgeIds.length > 0 ? 'Continue' : 'Skip'}
        </button>
      </div>
    </div>
  );
};
