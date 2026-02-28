import React, { useEffect, useState } from 'react';
import { Sparkles, Zap, Gift, Star, Award, TrendingUp, Target, Loader2, ArrowRight } from 'lucide-react';
import { floatIn } from './floatIn';
import {
  campaignTemplatesService,
  CampaignTemplate,
  TemplatesResponse,
} from '../../services/campaignTemplatesService';

interface StepTemplateProps {
  merchantId: string;
  onSelectTemplate: (template: CampaignTemplate) => void;
  onSkip: () => void;
  onBack: () => void;
  theme: 'light' | 'dark';
}

export const StepTemplate: React.FC<StepTemplateProps> = ({
  merchantId, onSelectTemplate, onSkip, onBack, theme,
}) => {
  const isDark = theme === 'dark';
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<TemplatesResponse | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const data = await campaignTemplatesService.getTemplates(merchantId);
      setTemplates(data);
      setLoading(false);
    };
    load();
  }, [merchantId]);

  const handleSelect = async (template: CampaignTemplate) => {
    // Track usage in background
    campaignTemplatesService.trackUsage(template.id);
    onSelectTemplate(template);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'flash-sale': return <Zap className="w-4 h-4" />;
      case 'festival': return <Gift className="w-4 h-4" />;
      case 'clearance': return <TrendingUp className="w-4 h-4" />;
      case 'new-launch': return <Star className="w-4 h-4" />;
      case 'premium': return <Award className="w-4 h-4" />;
      case 'personal': return <Target className="w-4 h-4" />;
      default: return <Sparkles className="w-4 h-4" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'flash-sale': return { iconBg: 'bg-white/15', iconText: 'text-white', tileBg: 'bg-amber-700', tileBorder: 'border-amber-600', tileShadow: 'shadow-amber-800/40' };
      case 'festival': return { iconBg: 'bg-white/15', iconText: 'text-white', tileBg: 'bg-pink-700', tileBorder: 'border-pink-600', tileShadow: 'shadow-pink-800/40' };
      case 'clearance': return { iconBg: 'bg-white/15', iconText: 'text-white', tileBg: 'bg-emerald-700', tileBorder: 'border-emerald-600', tileShadow: 'shadow-emerald-800/40' };
      case 'new-launch': return { iconBg: 'bg-white/15', iconText: 'text-white', tileBg: 'bg-blue-700', tileBorder: 'border-blue-600', tileShadow: 'shadow-blue-800/40' };
      case 'premium': return { iconBg: 'bg-white/15', iconText: 'text-white', tileBg: 'bg-violet-700', tileBorder: 'border-violet-600', tileShadow: 'shadow-violet-800/40' };
      case 'personal': return { iconBg: 'bg-white/15', iconText: 'text-white', tileBg: 'bg-cyan-700', tileBorder: 'border-cyan-600', tileShadow: 'shadow-cyan-800/40' };
      default: return { iconBg: 'bg-white/15', iconText: 'text-white', tileBg: 'bg-purple-700', tileBorder: 'border-purple-600', tileShadow: 'shadow-purple-800/40' };
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'flash-sale': return 'Flash Sale';
      case 'festival': return 'Festival';
      case 'clearance': return 'Clearance';
      case 'new-launch': return 'New Launch';
      case 'premium': return 'Premium';
      case 'personal': return 'My Templates';
      default: return 'Other';
    }
  };

  const HIDDEN_TEMPLATES = ['premium product showcase', 'mid-week flash'];

  const filteredTemplates = (selectedCategory === 'all'
    ? templates?.templates || []
    : templates?.grouped[selectedCategory] || []
  ).filter(t => !HIDDEN_TEMPLATES.includes(t.name.toLowerCase()));

  const categories = Object.keys(templates?.grouped || {}).filter(
    cat => (templates?.grouped[cat]?.length || 0) > 0
  );

  return (
    <div className="flex flex-col min-h-full px-6 pt-6">
      <h2 style={floatIn(100, visible)} className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
        Start with a template
      </h2>
      <p style={floatIn(200, visible)} className={`text-sm mb-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        Pick a proven format or start from scratch.
      </p>

      {/* Category filter pills */}
      {!loading && categories.length > 0 && (
        <div style={floatIn(250, visible)} className="flex gap-2 overflow-x-auto no-scrollbar mb-4">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border ${
              selectedCategory === 'all'
                ? isDark ? 'border-slate-500 bg-slate-700 text-white' : 'border-slate-900 bg-slate-900 text-white'
                : isDark ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-500'
            }`}
          >
            All ({templates?.totalCount || 0})
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border ${
                selectedCategory === cat
                  ? isDark ? 'border-slate-500 bg-slate-700 text-white' : 'border-slate-900 bg-slate-900 text-white'
                  : isDark ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-500'
              }`}
            >
              {getCategoryLabel(cat)}
            </button>
          ))}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div style={floatIn(300, visible)} className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className={`w-7 h-7 animate-spin ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Loading templates...</p>
          </div>
        </div>
      )}

      {/* Template tiles - 2 column grid */}
      {!loading && (
        <div style={floatIn(300, visible)} className="flex-1 overflow-y-auto max-h-[50vh] -mx-1">
          {filteredTemplates.length === 0 ? (
            <div className="text-center py-10">
              <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>No templates available</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 px-1 pb-2">
              {filteredTemplates.map((template) => {
                const colors = getCategoryColor(template.category);
                return (
                  <button
                    key={template.id}
                    onClick={() => handleSelect(template)}
                    className={`aspect-square rounded-2xl p-3.5 border-2 text-left transition-all active:translate-y-0.5 active:shadow-none shadow-lg flex flex-col ${colors.tileBg} ${colors.tileBorder} ${colors.tileShadow}`}
                  >
                    {/* Icon */}
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${colors.iconBg}`}>
                      <span className={colors.iconText}>{getCategoryIcon(template.category)}</span>
                    </div>

                    {/* Name */}
                    <h3 className="text-[13px] font-bold leading-snug mb-0.5 line-clamp-2 text-white">
                      {template.name}
                    </h3>

                    {/* Description */}
                    <p className="text-[10px] leading-relaxed line-clamp-2 text-white/70">
                      {template.description}
                    </p>

                    {/* Bottom stats — pushed to bottom */}
                    <div className="mt-auto pt-2 flex items-center gap-2">
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white/20 text-white">
                        {template.suggestedDiscount}% off
                      </span>
                      <span className="text-[10px] font-medium text-white/60">
                        {template.durationDays}d
                      </span>
                      <span className="text-[9px] font-semibold ml-auto text-white/80">
                        {template.successRate}%
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Bottom buttons */}
      <div style={floatIn(500, visible)} className="mt-auto pb-8 pt-4 flex gap-3">
        <button
          onClick={onBack}
          className={`flex-1 h-14 rounded-xl text-base font-semibold active:scale-[0.98] transition-all ${
            isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
          }`}
        >
          Back
        </button>
        <button
          onClick={onSkip}
          className={`flex-[2] h-14 rounded-xl text-base font-semibold active:scale-[0.98] transition-all flex items-center justify-center gap-2 ${
            isDark ? 'bg-slate-700 text-white' : 'bg-slate-900 text-white'
          }`}
        >
          Start from scratch
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
