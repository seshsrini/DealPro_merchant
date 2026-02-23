/**
 * Template Gallery Component
 * Browse and select campaign templates
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  TrendingUp,
  Zap,
  Gift,
  Star,
  Clock,
  Target,
  Award,
  Loader2,
  ChevronRight,
  Trash2,
} from 'lucide-react';
import {
  campaignTemplatesService,
  CampaignTemplate,
  TemplatesResponse,
} from '../services/campaignTemplatesService';

interface TemplateGalleryProps {
  merchantId: string;
  onSelect: (template: CampaignTemplate) => void;
  onClose: () => void;
  isDark: boolean;
}

export const TemplateGallery: React.FC<TemplateGalleryProps> = ({
  merchantId,
  onSelect,
  onClose,
  isDark,
}) => {
  const [templates, setTemplates] = useState<TemplatesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    fetchTemplates();
  }, [merchantId]);

  const fetchTemplates = async () => {
    setLoading(true);
    const data = await campaignTemplatesService.getTemplates(merchantId);
    setTemplates(data);
    setLoading(false);
  };

  const handleSelectTemplate = async (template: CampaignTemplate) => {
    await campaignTemplatesService.trackUsage(template.id);
    onSelect(template);
    onClose();
  };

  const handleDeleteTemplate = async (templateId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this template? This cannot be undone.')) return;

    const result = await campaignTemplatesService.deleteTemplate(templateId, merchantId);
    if (result.success) {
      fetchTemplates();
    } else {
      alert(result.message || 'Failed to delete template');
    }
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

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'flash-sale': return 'Flash Sales';
      case 'festival': return 'Festival Deals';
      case 'clearance': return 'Clearance';
      case 'new-launch': return 'New Launch';
      case 'premium': return 'Premium';
      case 'personal': return 'My Templates';
      default: return 'Other';
    }
  };

  const getDayName = (day: number) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[day];
  };

  const formatTime = (hour: number) => {
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:00 ${ampm}`;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center">
        <div className={`w-full max-w-md mx-4 rounded-xl p-8 ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
          <div className="flex flex-col items-center gap-3">
            <Loader2 className={`w-8 h-8 animate-spin ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
            <p className={`text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Loading templates...</p>
          </div>
        </div>
      </div>
    );
  }

  const filteredTemplates = selectedCategory === 'all'
    ? templates?.templates || []
    : templates?.grouped[selectedCategory] || [];

  return (
    <div className="fixed inset-0 bg-black/50 z-[9999]">
      {/* Mobile-constrained container */}
      <div className="max-w-md mx-auto w-full h-full relative">
        {/* Slide-up panel */}
        <div
          className={`absolute bottom-0 left-0 right-0 rounded-t-2xl overflow-hidden flex flex-col ${
            isDark ? 'bg-slate-900' : 'bg-white'
          }`}
          style={{ maxHeight: '92dvh' }}
        >
          {/* Panel handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className={`w-12 h-1.5 rounded-full ${isDark ? 'bg-slate-700' : 'bg-slate-300'}`} />
          </div>

          {/* Header */}
          <div className="px-6 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? 'bg-purple-500/10' : 'bg-purple-50'}`}>
                <Sparkles className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Templates</h2>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Start with proven formats</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className={`w-9 h-9 rounded-lg flex items-center justify-center ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Category Filter */}
          <div className="px-6 pb-3">
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border ${
                  selectedCategory === 'all'
                    ? isDark ? 'border-slate-500 bg-slate-800 text-white' : 'border-slate-900 bg-slate-900 text-white'
                    : isDark ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-500'
                }`}
              >
                All ({templates?.totalCount || 0})
              </button>
              {Object.keys(templates?.grouped || {}).filter(cat => (templates?.grouped[cat]?.length || 0) > 0).map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap flex items-center gap-1.5 transition-all border ${
                    selectedCategory === category
                      ? isDark ? 'border-slate-500 bg-slate-800 text-white' : 'border-slate-900 bg-slate-900 text-white'
                      : isDark ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-500'
                  }`}
                >
                  {getCategoryLabel(category)} ({templates?.grouped[category]?.length || 0})
                </button>
              ))}
            </div>
          </div>

          {/* Templates List */}
          <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-4 space-y-3">
            {filteredTemplates.length === 0 ? (
              <div className="text-center py-12">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-3 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                  <Sparkles className={`w-7 h-7 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
                </div>
                <p className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>No templates in this category</p>
                <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Create a campaign and save it as a template!</p>
              </div>
            ) : (
              filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  onClick={() => handleSelectTemplate(template)}
                  className={`rounded-xl p-4 border cursor-pointer active:scale-[0.98] transition-all ${
                    isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'
                  }`}
                >
                  {/* Template Header */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        template.templateType === 'system'
                          ? isDark ? 'bg-purple-500/10 text-purple-400' : 'bg-purple-50 text-purple-500'
                          : isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-500'
                      }`}>
                        {getCategoryIcon(template.category)}
                      </div>
                      <div className="min-w-0">
                        <h3 className={`text-sm font-semibold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{template.name}</h3>
                        <p className={`text-xs truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{template.description}</p>
                      </div>
                    </div>
                    {template.templateType === 'personal' && (
                      <button
                        onClick={(e) => handleDeleteTemplate(template.id, e)}
                        className={`p-1.5 rounded-lg shrink-0 ml-2 ${isDark ? 'hover:bg-red-500/10' : 'hover:bg-red-50'}`}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    )}
                  </div>

                  {/* Success Metrics */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex items-center gap-1">
                      <Award className="w-3 h-3 text-emerald-500" />
                      <span className={`text-[10px] font-medium ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{template.successRate}% success</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Target className="w-3 h-3 text-blue-500" />
                      <span className={`text-[10px] font-medium ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{template.avgRedemptions} avg</span>
                    </div>
                    {template.timesUsed > 0 && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-purple-500" />
                        <span className={`text-[10px] font-medium ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>Used {template.timesUsed}x</span>
                      </div>
                    )}
                  </div>

                  {/* Template Settings */}
                  <div className={`grid grid-cols-4 gap-2 p-2.5 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
                    <div>
                      <p className={`text-[10px] mb-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Discount</p>
                      <p className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{template.suggestedDiscount}%</p>
                    </div>
                    <div>
                      <p className={`text-[10px] mb-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Duration</p>
                      <p className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{template.durationDays}d</p>
                    </div>
                    <div>
                      <p className={`text-[10px] mb-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Day</p>
                      <p className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{getDayName(template.launchDayOfWeek).slice(0, 3)}</p>
                    </div>
                    <div>
                      <p className={`text-[10px] mb-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Time</p>
                      <p className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{formatTime(template.launchHour)}</p>
                    </div>
                  </div>

                  {/* Tips */}
                  {template.tips.length > 0 && (
                    <div className="mt-2.5 space-y-1">
                      {template.tips.slice(0, 2).map((tip, idx) => (
                        <div key={idx} className="flex items-start gap-1.5">
                          <ChevronRight className={`w-3 h-3 shrink-0 mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                          <p className={`text-[10px] leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{tip}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className={`shrink-0 px-6 py-4 border-t flex items-center justify-between ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
          }`}>
            <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {templates?.systemCount || 0} system + {templates?.personalCount || 0} personal
            </p>
            <button
              onClick={onClose}
              className={`h-10 px-5 rounded-xl text-sm font-medium border ${
                isDark ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-500'
              }`}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
