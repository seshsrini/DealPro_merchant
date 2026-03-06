import React, { useEffect, useState } from 'react';
import { Eye, Loader2, CheckCircle2, Upload, Zap, AlertTriangle, TrendingUp } from 'lucide-react';
import { floatIn } from '../campaign-wizard/floatIn';
import { addCampaignService } from '../../services/addCampaignService';
import { dealOfDayService } from '../../services/dealOfDayService';
import { campaignOptimizerService, OptimizationResult } from '../../services/campaignOptimizerService';

interface MerchantStore {
  id?: string;
  store_name: string;
  address: string;
  city: string;
  state?: string;
  latitude?: number;
  longitude?: number;
}

interface DotdWizardState {
  dealHeading: string;
  offerValue: string;
  description: string;
  dealDate: string;
  selectedStoreId: string;
  selectedImageFile: File | null;
  existingThumbnail: string | null;
  existingImageName: string | null;
}

interface StepDotdReviewProps {
  wizardState: DotdWizardState;
  user: any;
  stores: MerchantStore[];
  onBack: () => void;
  onPublishSuccess: () => void;
  onPublishError: (error: string) => void;
  onModerationBlock: (field: string, message: string) => void;
  theme: 'light' | 'dark';
}

const stripHtml = (html: string): string =>
  html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();

const formatDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const StepDotdReview: React.FC<StepDotdReviewProps> = ({
  wizardState, user, stores,
  onBack, onPublishSuccess, onPublishError, onModerationBlock, theme,
}) => {
  const isDark = theme === 'dark';
  const [visible, setVisible] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [progress, setProgress] = useState<{ step: number; label: string } | null>(null);
  const [optimization, setOptimization] = useState<OptimizationResult | null>(null);
  const [optimizing, setOptimizing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  // Generate image preview
  useEffect(() => {
    if (wizardState.selectedImageFile) {
      const url = URL.createObjectURL(wizardState.selectedImageFile);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreviewUrl(null);
  }, [wizardState.selectedImageFile]);

  // Run optimizer on mount
  useEffect(() => {
    const run = async () => {
      setOptimizing(true);
      try {
        const discountMatch = wizardState.offerValue.match(/(\d+)/);
        const result = await campaignOptimizerService.optimize(user.id, {
          title: wizardState.dealHeading,
          discount: discountMatch ? parseInt(discountMatch[1]) : undefined,
          launch_date: wizardState.dealDate,
          end_date: wizardState.dealDate, // Same day
          category: user.category,
        });
        setOptimization(result);
      } catch {
        // Non-blocking
      } finally {
        setOptimizing(false);
      }
    };
    run();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const store = stores.find(s => s.id === wizardState.selectedStoreId);
  const imageUrl = previewUrl || wizardState.existingThumbnail;

  const handlePublish = async () => {
    setPublishing(true);
    try {
      // Phase 1: Content + Image moderation
      setProgress({ step: 1, label: 'Checking content...' });
      const plainDesc = stripHtml(wizardState.description);
      const moderationPromises: Promise<{ flagged: boolean; reason: string }>[] = [
        addCampaignService.moderateContent(wizardState.dealHeading, wizardState.offerValue, plainDesc),
      ];
      if (wizardState.selectedImageFile) {
        moderationPromises.push(addCampaignService.moderateImage(wizardState.selectedImageFile));
      }
      const results = await Promise.all(moderationPromises);
      if (results[0].flagged) throw new Error(results[0].reason);
      if (wizardState.selectedImageFile && results[1]?.flagged) throw new Error(results[1].reason);

      // Phase 2: Image upload
      setProgress({ step: 2, label: 'Uploading image...' });
      let finalImageUrl = wizardState.existingThumbnail;
      let finalImageName = wizardState.existingImageName;
      if (wizardState.selectedImageFile) {
        const upload = await dealOfDayService.uploadDealImage(user.id, wizardState.selectedImageFile);
        finalImageUrl = upload.publicUrl;
        finalImageName = upload.imageName;
      }

      if (!finalImageUrl || !finalImageName) {
        throw new Error('Image is required for Deal of the Day');
      }

      // Phase 3: Translate + Create DOTD
      setProgress({ step: 3, label: 'Publishing Deal of the Day...' });

      const translations = await addCampaignService.translateCampaignData(
        wizardState.dealHeading,
        wizardState.offerValue,
        wizardState.description,
        user.store_name
      );

      const payload = {
        shop_name: user.store_name,
        deal_heading: wizardState.dealHeading,
        offer_value: wizardState.offerValue,
        category: user.category,
        start_date: wizardState.dealDate,
        end_date: wizardState.dealDate, // Same day for DOTD
        long_description: wizardState.description,
        store_id: wizardState.selectedStoreId,
        image_url: finalImageUrl,
        image_name: finalImageName,
        latlong: store ? `${store.latitude}, ${store.longitude}` : '0.0, 0.0',
        localized_heading: translations.heading,
        localized_offer: translations.offer,
        localized_description: translations.description,
        localized_shop_name: translations.shop_name,
      };

      await dealOfDayService.createDealOfDay(user.id, payload);
      onPublishSuccess();
    } catch (err: any) {
      if (err.isModerationBlock && err.moderationField) {
        onModerationBlock(err.moderationField, err.message || 'This field contains content that violates our guidelines.');
      } else {
        onPublishError('Unable to publish. Please try again.');
      }
    } finally {
      setPublishing(false);
      setProgress(null);
    }
  };

  const scoreColor = optimization
    ? optimization.score >= 80 ? 'text-emerald-500' : optimization.score >= 60 ? 'text-amber-500' : 'text-red-500'
    : '';

  return (
    <div className="flex flex-col min-h-full px-6 pt-6">
      <div style={floatIn(0, visible)}>
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${isDark ? 'bg-yellow-500/10' : 'bg-yellow-50'}`}>
          <Eye className="w-8 h-8 text-yellow-500" />
        </div>
        <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
          Review your deal
        </h2>
        <p className={`text-sm mb-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Check everything looks good before publishing.
        </p>
      </div>

      {/* Deal Card Preview */}
      <div style={floatIn(150, visible)} className={`rounded-2xl overflow-hidden border mb-5 ${isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}`}>
        {imageUrl && (
          <img src={imageUrl} alt="Deal" className="w-full h-40 object-cover" />
        )}
        <div className="p-4">
          <div className="flex items-start justify-between mb-2">
            <h3 className={`font-bold text-base flex-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {wizardState.dealHeading}
            </h3>
            <span className="ml-2 px-2.5 py-1 rounded-lg bg-yellow-500 text-white text-xs font-bold shrink-0">
              {wizardState.offerValue}
            </span>
          </div>
          <p className={`text-xs line-clamp-2 mb-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {stripHtml(wizardState.description)}
          </p>
          <div className={`flex items-center justify-between text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            <span>{store?.store_name || 'Store'}, {store?.city}</span>
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-yellow-500" />
              {formatDate(wizardState.dealDate)}
            </span>
          </div>
        </div>
      </div>

      {/* Campaign Optimizer */}
      <div style={floatIn(300, visible)} className={`rounded-2xl p-4 border mb-5 ${isDark ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'}`}>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-yellow-500" />
          <p className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Campaign Score
          </p>
        </div>
        {optimizing ? (
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-yellow-500" />
            <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Analyzing...</span>
          </div>
        ) : optimization ? (
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className={`text-3xl font-black ${scoreColor}`}>{optimization.score}</span>
              <div>
                <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{optimization.grade}</span>
                <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Predicted: {optimization.predictedEngagement} engagement
                </p>
              </div>
            </div>
            {optimization.quickFixes.length > 0 && (
              <div className="space-y-1.5">
                {optimization.quickFixes.slice(0, 3).map((fix, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <AlertTriangle className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" />
                    <p className={`text-[11px] ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{fix}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Score unavailable</p>
        )}
      </div>

      {/* Publishing Progress */}
      {progress && (
        <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center px-8">
          <div className={`w-full max-w-sm rounded-2xl p-6 ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
            <div className="space-y-4">
              {[
                { step: 1, label: 'Checking content', icon: CheckCircle2 },
                { step: 2, label: 'Uploading image', icon: Upload },
                { step: 3, label: 'Publishing deal', icon: Zap },
              ].map((item) => {
                const Icon = item.icon;
                const isActive = progress.step === item.step;
                const isDone = progress.step > item.step;
                return (
                  <div key={item.step} className="flex items-center gap-3">
                    {isDone ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : isActive ? (
                      <Loader2 className="w-5 h-5 animate-spin text-yellow-500" />
                    ) : (
                      <Icon className={`w-5 h-5 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
                    )}
                    <span className={`text-sm font-medium ${
                      isDone ? 'text-emerald-500' : isActive ? (isDark ? 'text-white' : 'text-slate-900') : (isDark ? 'text-slate-600' : 'text-slate-300')
                    }`}>
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Publish button */}
      <div style={floatIn(450, visible)} className="mt-auto pb-8 flex gap-3">
        <button
          onClick={onBack}
          disabled={publishing}
          className={`flex-1 h-14 rounded-xl text-base font-semibold active:scale-[0.98] transition-all ${
            isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
          } disabled:opacity-40`}
        >
          Back
        </button>
        <button
          onClick={handlePublish}
          disabled={publishing}
          className="flex-[2] h-14 rounded-xl bg-yellow-500 text-white text-base font-bold active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {publishing ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Zap className="w-5 h-5" />
              Publish Deal of the Day
            </>
          )}
        </button>
      </div>
    </div>
  );
};
