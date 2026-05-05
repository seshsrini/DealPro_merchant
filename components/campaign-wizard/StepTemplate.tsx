import React, { useEffect, useState } from 'react';
import { Sparkles, Zap, Gift, Star, Award, TrendingUp, Target, Loader2, ArrowRight, UserPen } from 'lucide-react';
import { floatIn } from './floatIn';
import { useTranslation } from '../../contexts/LanguageContext';
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
  onBuyGetFree?: () => void;
}

export const StepTemplate: React.FC<StepTemplateProps> = ({
  merchantId, onSelectTemplate, onSkip, onBack, theme, onBuyGetFree,
}) => {
  const isDark = theme === 'dark';
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<TemplatesResponse | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(timer);
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
      case 'flash-sale': return t('m_flash_sale');
      case 'festival': return t('m_festival');
      case 'clearance': return t('m_clearance');
      case 'new-launch': return t('m_new_launch');
      case 'premium': return t('m_premium');
      case 'personal': return t('m_my_templates');
      default: return t('m_other');
    }
  };

  const HIDDEN_TEMPLATES = ['premium product showcase', 'mid-week flash'];

  const allTemplates = (templates?.templates || [])
    .filter(tmpl => !HIDDEN_TEMPLATES.includes(tmpl.name.toLowerCase()));

  // Split into personal and general
  const personalTemplates = allTemplates.filter(tmpl => tmpl.templateType === 'personal');
  const generalTemplates = (selectedCategory === 'all'
    ? allTemplates.filter(tmpl => tmpl.templateType !== 'personal')
    : (templates?.grouped[selectedCategory] || []).filter(tmpl => tmpl.templateType !== 'personal' && !HIDDEN_TEMPLATES.includes(tmpl.name.toLowerCase()))
  );

  const categories = Object.keys(templates?.grouped || {}).filter(
    cat => cat !== 'personal' && (templates?.grouped[cat]?.length || 0) > 0
  );

  return (
    <div className="flex flex-col min-h-full px-6 pt-6">
      <h2 style={floatIn(100, visible)} className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
        {t('m_start_template')}
      </h2>
      <p style={floatIn(200, visible)} className={`text-sm mb-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        {t('m_pick_format')}
      </p>

      {/* Special template: Buy & Get Free Gift */}
      {onBuyGetFree && (
        <button
          onClick={onBuyGetFree}
          style={floatIn(230, visible)}
          className="w-full mb-4 p-4 rounded-2xl border-2 border-dashed flex items-center gap-4 transition-all active:scale-[0.98] border-pink-400 bg-gradient-to-r from-pink-50 to-orange-50 dark:from-pink-500/10 dark:to-orange-500/10 dark:border-pink-500/40"
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-orange-500 flex items-center justify-center shrink-0 shadow-lg shadow-pink-500/20">
            <Gift className="w-6 h-6 text-white" />
          </div>
          <div className="text-left flex-1">
            <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Buy & Get Free Gift</p>
            <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Combine product + gift into one eye-catching image</p>
          </div>
          <ArrowRight className={`w-4 h-4 shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
        </button>
      )}

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
            All ({(templates?.totalCount || 0) - personalTemplates.length})
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
            <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('m_loading_templates')}</p>
          </div>
        </div>
      )}

      {/* Template sections */}
      {!loading && (
        <div style={floatIn(300, visible)} className="flex-1 overflow-y-auto max-h-[50vh] -mx-1">
          {personalTemplates.length === 0 && generalTemplates.length === 0 ? (
            <div className="text-center py-10">
              <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('m_no_templates')}</p>
            </div>
          ) : (
            <div className="px-1 pb-2 space-y-5">
              {/* ── Your Templates section ── */}
              {personalTemplates.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <UserPen className={`w-3.5 h-3.5 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`} />
                    <p className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>
                      {t('m_your_templates')}
                    </p>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${isDark ? 'bg-cyan-500/10 text-cyan-400' : 'bg-cyan-50 text-cyan-600'}`}>
                      {personalTemplates.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {personalTemplates.map((template) => {
                      const colors = getCategoryColor('personal');
                      return (
                        <button
                          key={template.id}
                          onClick={() => handleSelect(template)}
                          className={`aspect-square rounded-2xl p-3.5 border-2 text-left transition-all active:translate-y-0.5 active:shadow-none shadow-lg flex flex-col ${colors.tileBg} ${colors.tileBorder} ${colors.tileShadow}`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colors.iconBg}`}>
                              <span className={colors.iconText}><UserPen className="w-4 h-4" /></span>
                            </div>
                            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white/20">
                              <UserPen className="w-2.5 h-2.5 text-white" />
                              <span className="text-[8px] font-bold uppercase tracking-wide text-white">{t('m_custom')}</span>
                            </div>
                          </div>
                          <h3 className="text-[13px] font-bold leading-snug mb-0.5 line-clamp-2 text-white">
                            {template.name}
                          </h3>
                          <p className="text-[10px] leading-relaxed line-clamp-2 text-white/70">
                            {template.description}
                          </p>
                          <div className="mt-auto pt-2 flex items-center gap-2">
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white/20 text-white">
                              {template.suggestedDiscount}% off
                            </span>
                            <span className="text-[10px] font-medium text-white/60">
                              {template.durationDays}d
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── General Templates section ── */}
              {generalTemplates.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className={`w-3.5 h-3.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                    <p className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {t('m_general_templates')}
                    </p>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                      {generalTemplates.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {generalTemplates.map((template) => {
                      const colors = getCategoryColor(template.category);
                      return (
                        <button
                          key={template.id}
                          onClick={() => handleSelect(template)}
                          className={`aspect-square rounded-2xl p-3.5 border-2 text-left transition-all active:translate-y-0.5 active:shadow-none shadow-lg flex flex-col ${colors.tileBg} ${colors.tileBorder} ${colors.tileShadow}`}
                        >
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${colors.iconBg}`}>
                            <span className={colors.iconText}>{getCategoryIcon(template.category)}</span>
                          </div>
                          <h3 className="text-[13px] font-bold leading-snug mb-0.5 line-clamp-2 text-white">
                            {template.name}
                          </h3>
                          <p className="text-[10px] leading-relaxed line-clamp-2 text-white/70">
                            {template.description}
                          </p>
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
                </div>
              )}
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
