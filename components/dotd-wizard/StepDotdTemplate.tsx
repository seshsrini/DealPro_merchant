import React, { useEffect, useState } from 'react';
import { Zap, Clock, Flame, ShoppingBag, Utensils, Sparkles, Gift, Sun, ArrowRight } from 'lucide-react';
import { floatIn } from '../campaign-wizard/floatIn';
import { useTranslation } from '../../contexts/LanguageContext';

export interface DotdTemplate {
  id: string;
  name: string;
  tagline: string;
  heading: string;
  offer: string;
  description: string;
  category: 'flash' | 'lunch' | 'happy-hour' | 'doorbuster' | 'surprise' | 'seasonal' | 'clearance' | 'exclusive';
  discount: number;
  // Which store-category buckets this template is appropriate for. Templates
  // tagged with multiple buckets show up for all of them. A template with no
  // matches still shows for unknown categories (default = retail).
  buckets: Array<'retail' | 'food' | 'service' | 'pro' | 'hybrid'>;
}

type OfferBucket = 'retail' | 'food' | 'service' | 'pro' | 'hybrid';
function bucketForCategory(category?: string | null): OfferBucket {
  const c = (category || '').toLowerCase();
  if (!c) return 'retail';
  if (/restaurant|dining|cafe|bakery|chaat|juice|ice cream|tiffin|catering/.test(c)) return 'food';
  if (/professional|education|training|real estate|consult|legal|law|account|finance/.test(c)) return 'pro';
  if (/pharmacy|healthcare|automotive|optical|pet/.test(c)) return 'hybrid';
  if (/salon|beauty|parlor|travel|tour|entertainment|games|fitness|tailor|boutique/.test(c)) return 'service';
  return 'retail';
}

const DOTD_TEMPLATES: DotdTemplate[] = [
  {
    id: 'flash-24',
    name: 'Flash 24',
    tagline: 'Gone in a day — max urgency',
    heading: '24-Hour Flash Deal',
    offer: 'Flat Deal — Today Only!',
    description: '⚡ 24-Hour Flash Deal!\n\nThis deal vanishes at midnight. No extensions, no repeats.\n\n✅ One-day-only pricing\n✅ Walk in anytime today\n✅ First come, first served\n\n⏰ Hurry — once it\'s gone, it\'s gone!',
    category: 'flash',
    discount: 40,
    buckets: ['retail', 'food', 'service', 'pro', 'hybrid'],
  },
  {
    id: 'lunch-rush',
    name: 'Lunch Rush Special',
    tagline: 'Midday crowd puller',
    heading: 'Lunch Rush Deal',
    offer: 'Buy 1 Get 1 FREE on <Your Item>',
    description: '🍽️ Lunch Rush Special!\n\nShake off the afternoon slump with an unbeatable deal.\n\n🕐 Valid 11 AM – 3 PM today\n🎁 Buy 1, Get 1 FREE\n📍 Dine-in & takeaway\n\n💡 Perfect for lunch with colleagues or friends!',
    category: 'lunch',
    discount: 50,
    buckets: ['food'],
  },
  {
    id: 'happy-hour',
    name: 'Happy Hour Blitz',
    tagline: 'Limited window, big savings',
    heading: 'Happy Hour Blitz',
    offer: 'Happy Hour Deal — 4 PM – 8 PM',
    description: '🎉 Happy Hour Blitz!\n\nThe best 4 hours of the day just got better.\n\n⏰ 4 PM – 8 PM only\n💰 Massive discounts on everything\n🛍️ No minimum purchase\n\n🔥 Walk in, save big, walk out happy!',
    category: 'happy-hour',
    discount: 35,
    buckets: ['retail', 'food', 'service'],
  },
  {
    id: 'doorbuster',
    name: 'Doorbuster Deal',
    tagline: 'One item, one insane price',
    heading: 'Doorbuster — One Day Only',
    offer: '<Your Product> at just ₹<Price>!',
    description: '💥 Doorbuster Deal!\n\nOne hero product. One jaw-dropping price. One day.\n\n🏷️ Limited quantity available\n⚡ First 50 customers only\n🚫 No rain checks\n\n🏃 Get here early — this won\'t last!',
    category: 'doorbuster',
    discount: 60,
    buckets: ['retail', 'hybrid'],
  },
  {
    id: 'mystery-deal',
    name: 'Mystery Deal',
    tagline: 'Surprise discount — fun & viral',
    heading: 'Mystery Deal Day',
    offer: 'Scratch & Save — Today Only!',
    description: '🎲 Mystery Deal Day!\n\nEvery customer gets a surprise discount. What will YOU get?\n\n🎁 Scratch card at checkout\n💰 Discounts range from 10% to 50%\n✨ Everyone\'s a winner!\n\n🤩 Come try your luck today!',
    category: 'surprise',
    discount: 30,
    buckets: ['retail', 'food', 'hybrid'],
  },
  {
    id: 'sunrise-sale',
    name: 'Early Bird Special',
    tagline: 'Reward the morning crowd',
    heading: 'Early Bird Special',
    offer: 'Early Bird Deal — before 11 AM',
    description: '🌅 Early Bird Special!\n\nThe early bird gets the deal. Show up before 11 AM for exclusive savings.\n\n☀️ Valid 8 AM – 11 AM\n💰 Extra discount for morning shoppers\n☕ Start your day with savings\n\n⏰ Morning only — no exceptions!',
    category: 'seasonal',
    discount: 25,
    buckets: ['retail', 'food', 'service', 'hybrid'],
  },
  {
    id: 'stock-clear',
    name: 'One-Day Clearance',
    tagline: 'Clear stock fast at deep discounts',
    heading: 'Clearance Blowout — Today Only',
    offer: 'Clearance — Everything Must Go!',
    description: '🏷️ One-Day Clearance Blowout!\n\nMassive markdowns across the store. Today only.\n\n📦 Selected items up to 70% OFF\n🔖 Prices slashed on all categories\n❌ No further discounts apply\n\n💨 When it\'s sold, it\'s sold. No restocking!',
    category: 'clearance',
    discount: 50,
    buckets: ['retail', 'hybrid'],
  },
  {
    id: 'vip-day',
    name: 'VIP Customer Day',
    tagline: 'Make regulars feel special',
    heading: 'VIP Customer Appreciation Day',
    offer: 'Exclusive Deal for You!',
    description: '👑 VIP Customer Day!\n\nA special thank-you to our loyal customers.\n\n🎖️ Exclusive one-day pricing\n🎁 Free gift with every purchase over ₹500\n💎 Premium service all day\n\n❤️ Because you deserve the best!',
    category: 'exclusive',
    discount: 20,
    buckets: ['retail', 'food', 'service', 'pro', 'hybrid'],
  },
  // Service- & pro-friendly templates so those buckets aren't too sparse.
  {
    id: 'free-consultation',
    name: 'Free Consultation Day',
    tagline: 'Win new clients with a free first session',
    heading: 'Free Consultation Today',
    offer: 'Free 30-min consultation — Today Only!',
    description: '📅 Free Consultation Day!\n\nBook a complimentary 30-minute session with us today.\n\n✅ No obligation\n✅ Personalized advice\n✅ Limited slots available\n\n💼 Reserve your slot now!',
    category: 'exclusive',
    discount: 100,
    buckets: ['service', 'pro', 'hybrid'],
  },
  {
    id: 'first-visit-special',
    name: 'First-Visit Special',
    tagline: 'Welcome offer for new customers',
    heading: 'New Customer? Save Big Today',
    offer: 'Special Deal on your first visit',
    description: '🎉 First-Visit Special!\n\nA warm welcome from us — enjoy big savings on your first visit today.\n\n👋 New customers only\n💰 Up to 30% OFF\n📍 In-store only\n\n💡 Show this offer at checkout.',
    category: 'exclusive',
    discount: 30,
    buckets: ['service', 'pro', 'hybrid'],
  },
];

interface StepDotdTemplateProps {
  onSelectTemplate: (template: DotdTemplate) => void;
  onSkip: () => void;
  onBack: () => void;
  theme: 'light' | 'dark';
  onBuyGetFree?: () => void;
  storeCategory?: string | null;
}

const getCategoryStyle = (category: DotdTemplate['category']) => {
  switch (category) {
    case 'flash':      return { bg: 'bg-amber-600', border: 'border-amber-500', shadow: 'shadow-amber-700/40' };
    case 'lunch':      return { bg: 'bg-orange-600', border: 'border-orange-500', shadow: 'shadow-orange-700/40' };
    case 'happy-hour': return { bg: 'bg-violet-600', border: 'border-violet-500', shadow: 'shadow-violet-700/40' };
    case 'doorbuster': return { bg: 'bg-red-600', border: 'border-red-500', shadow: 'shadow-red-700/40' };
    case 'surprise':   return { bg: 'bg-pink-600', border: 'border-pink-500', shadow: 'shadow-pink-700/40' };
    case 'seasonal':   return { bg: 'bg-sky-600', border: 'border-sky-500', shadow: 'shadow-sky-700/40' };
    case 'clearance':  return { bg: 'bg-emerald-600', border: 'border-emerald-500', shadow: 'shadow-emerald-700/40' };
    case 'exclusive':  return { bg: 'bg-indigo-600', border: 'border-indigo-500', shadow: 'shadow-indigo-700/40' };
  }
};

const getCategoryIcon = (category: DotdTemplate['category']) => {
  switch (category) {
    case 'flash':      return <Zap className="w-4 h-4" />;
    case 'lunch':      return <Utensils className="w-4 h-4" />;
    case 'happy-hour': return <Clock className="w-4 h-4" />;
    case 'doorbuster': return <Flame className="w-4 h-4" />;
    case 'surprise':   return <Gift className="w-4 h-4" />;
    case 'seasonal':   return <Sun className="w-4 h-4" />;
    case 'clearance':  return <ShoppingBag className="w-4 h-4" />;
    case 'exclusive':  return <Sparkles className="w-4 h-4" />;
  }
};

export const StepDotdTemplate: React.FC<StepDotdTemplateProps> = ({
  onSelectTemplate, onSkip, onBack, theme, onBuyGetFree, storeCategory,
}) => {
  const isDark = theme === 'dark';
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const bucket = bucketForCategory(storeCategory);
  const visibleTemplates = DOTD_TEMPLATES.filter((tpl) => tpl.buckets.includes(bucket));

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex flex-col min-h-full px-6 pt-6">
      <h2 style={floatIn(100, visible)} className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
        {t('m_pick_deal_template')}
      </h2>
      <p style={floatIn(200, visible)} className={`text-sm mb-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        {t('m_dotd_foot_traffic')}
      </p>

      {/* Buy & Get Free Gift button */}
      {onBuyGetFree && (
        <div style={floatIn(250, visible)} className="mb-3">
          <button
            onClick={onBuyGetFree}
            className="w-full h-14 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 text-white flex items-center justify-center gap-2.5 text-base font-bold active:scale-[0.98] transition-all shadow-lg shadow-pink-500/30"
          >
            <Gift className="w-5 h-5" />
            {t('m_buy_get_free_gift')}
          </button>
        </div>
      )}

      {/* Template grid */}
      <div style={floatIn(300, visible)} className="flex-1 overflow-y-auto max-h-[55vh] -mx-1">
        <div className="grid grid-cols-2 gap-3 px-1 pb-2">
          {visibleTemplates.map((template) => {
            const style = getCategoryStyle(template.category);
            return (
              <button
                key={template.id}
                onClick={() => onSelectTemplate(template)}
                className={`aspect-square rounded-2xl p-3.5 border-2 text-left transition-all active:translate-y-0.5 active:shadow-none shadow-lg flex flex-col ${style.bg} ${style.border} ${style.shadow}`}
              >
                {/* Icon */}
                <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-2 bg-white/15">
                  <span className="text-white">{getCategoryIcon(template.category)}</span>
                </div>

                {/* Name */}
                <h3 className="text-[13px] font-bold leading-snug mb-0.5 line-clamp-2 text-white">
                  {template.name}
                </h3>

                {/* Tagline */}
                <p className="text-[10px] leading-relaxed line-clamp-2 text-white/70">
                  {template.tagline}
                </p>

                {/* Bottom stats */}
                <div className="mt-auto pt-2 flex items-center gap-2">
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white/20 text-white">
                    {t('m_approx_off').replace('{0}', String(template.discount))}
                  </span>
                  <span className="text-[10px] font-medium text-white/60">
                    {t('m_one_day')}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom buttons */}
      <div style={floatIn(500, visible)} className="mt-auto pb-8 pt-4 flex gap-3">
        <button
          onClick={onBack}
          className={`flex-1 h-14 rounded-xl text-base font-semibold active:scale-[0.98] transition-all ${
            isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
          }`}
        >
          {t('m_back')}
        </button>
        <button
          onClick={onSkip}
          className={`flex-[2] h-14 rounded-xl text-base font-semibold active:scale-[0.98] transition-all flex items-center justify-center gap-2 ${
            isDark ? 'bg-slate-700 text-white' : 'bg-slate-900 text-white'
          }`}
        >
          {t('m_start_scratch')}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
