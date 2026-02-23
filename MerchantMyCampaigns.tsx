
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Deal, MerchantStore, AppView } from './types';
import { userService } from './services/userService';
import { addCampaignService } from './services/addCampaignService';
import { merchantService } from './services/merchantService';
import { mDashboardService } from './services/mDashboardService';
import { merchantSubscriptionService } from './services/merchantSubscriptionService';
import { useTranslation } from './contexts/LanguageContext';
import {
  Megaphone,
  Loader2,
  Plus,
  CheckCircle2,
  X,
  Edit2,
  RefreshCw,
  History,
  Info,
  Clock,
  AlertCircle,
  Zap,
  Calculator,
  MousePointer2,
  TicketCheck,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Sparkles,
  ArrowLeft
} from 'lucide-react';
import { ImageUpload } from './components/ImageUpload';
import { RichTextEditor } from './components/RichTextEditor';
import { campaignOptimizerService, OptimizationResult } from './services/campaignOptimizerService';
import { TemplateGallery } from './components/TemplateGallery';
import { campaignTemplatesService, CampaignTemplate } from './services/campaignTemplatesService';


interface MerchantMyCampaignsProps {
  user: any;
  deals: Deal[];
  loading: boolean;
  setLoading: (loading: boolean) => void;
  refreshDeals: () => Promise<void>;
  setView: (view: AppView) => void;
  preSelectedEditDealId?: string | null;
  onClearPreSelected?: () => void;
  preSelectedTab?: CampaignTab | null;
  theme?: 'light' | 'dark';
}

type CampaignTab = 'review' | 'active' | 'expired' | 'needs review';

const DEFAULT_DEAL_IMAGE = 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=600&q=80';

const getFileNameFromUrl = (url: string | null): string | null => {
  if (!url) return null;
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    return pathParts[pathParts.length - 1];
  } catch {
    return null;
  }
};

export const MerchantMyCampaigns: React.FC<MerchantMyCampaignsProps> = ({
  user, deals = [], loading, setLoading, refreshDeals, setView,
  preSelectedEditDealId, onClearPreSelected, preSelectedTab, theme = 'dark'
}) => {
  const { t, getLocalizedText } = useTranslation();
  const isDark = theme === 'dark';
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const formRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  const [dealTitle, setDealTitle] = useState('');
  const [dealOffer, setDealOffer] = useState('');
  const [dealStartDate, setDealStartDate] = useState(tomorrow);
  const [dealEndDate, setDealEndDate] = useState('');
  const [dealDescription, setDealDescription] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);

  const [merchantStores, setMerchantStores] = useState<MerchantStore[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [editingDealId, setEditingDealId] = useState<string | null>(null);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [existingThumbnail, setExistingThumbnail] = useState<string | null>(null);
  const [existingImageName, setExistingImageName] = useState<string | null>(null);

  const [imageLibrary, setImageLibrary] = useState<{url: string, name?: string}[]>([]);
  const [isLibraryLoading, setIsLibraryLoading] = useState(false);

  const [activeListTab, setActiveListTab] = useState<CampaignTab>(preSelectedTab || 'active');

  const [roiInputs, setRoiInputs] = useState<Record<string, {
    expectedRedemptions: number;
    averageTransactionValue: number;
    profitMarginPercentage: number;
  }>>({});
  const [showRoiCalculator, setShowRoiCalculator] = useState<Record<string, boolean>>({});

  const [perCampaignClickCounts, setPerCampaignClickCounts] = useState<Record<string, number>>({});
  const [perCampaignRedemptionCounts, setPerCampaignRedemptionCounts] = useState<Record<string, number>>({});

  const [campaignUsage, setCampaignUsage] = useState({
    campaigns_used: 0,
    campaigns_limit: 0,
    dotd_used: 0,
    dotd_limit: 0,
    has_subscription: false,
  });

  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [showOptimizer, setShowOptimizer] = useState(true);

  const [showTemplateGallery, setShowTemplateGallery] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<CampaignTemplate | null>(null);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [savedCampaignData, setSavedCampaignData] = useState<any>(null);

  const inputClass = `w-full h-11 px-4 rounded-lg text-sm outline-none border transition-all ${
    isDark
      ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-slate-500'
      : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-slate-400'
  }`;

  const getStatusDisplay = (status: string) => {
    switch (status.toLowerCase()) {
      case 'review': return <span className="flex items-center gap-1 text-amber-500 text-xs font-medium"><AlertCircle className="w-3 h-3" /> In Review</span>;
      case 'active': return <span className="flex items-center gap-1 text-emerald-500 text-xs font-medium"><CheckCircle2 className="w-3 h-3" /> Active</span>;
      case 'expired': return <span className="flex items-center gap-1 text-rose-500 text-xs font-medium"><History className="w-3 h-3" /> Expired</span>;
      case 'needs review': return <span className="flex items-center gap-1 text-orange-500 text-xs font-medium"><AlertCircle className="w-3 h-3" /> Needs Review</span>;
      default: return <span className="text-slate-500 text-xs">{status}</span>;
    }
  };

  const getCampaignImage = (deal: Deal) => {
    const libImage = imageLibrary.find(img => img.name === deal.image_name);
    return libImage?.url || deal.thumbnail || DEFAULT_DEAL_IMAGE;
  };

  useEffect(() => {
    if (preSelectedTab && tabsRef.current) {
      setTimeout(() => {
        tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [preSelectedTab]);

  useEffect(() => {
    const refreshInterval = setInterval(() => {
      if (!isTranslating && !editingDealId) {
        refreshDeals();
      }
    }, 10000);
    return () => clearInterval(refreshInterval);
  }, [refreshDeals, isTranslating, editingDealId]);

  useEffect(() => {
    if (user.id) {
      merchantService.getMerchantStores(user.id).then(stores => {
        setMerchantStores(stores);
        if (stores.length > 0 && !selectedStoreId) setSelectedStoreId(stores[0].id || '');
      }).catch(err => console.error("Error fetching merchant stores:", err));

      setIsLibraryLoading(true);
      addCampaignService.getMerchantImages(user.id).then(images => {
        const uniqueImages = Array.from(new Set(images.map(i => i.url)))
          .map(url => images.find(i => i.url === url)!);
        setImageLibrary(uniqueImages);
        setIsLibraryLoading(false);
      }).catch(err => {
        console.error("Error fetching image library:", err);
        setIsLibraryLoading(false);
      });
    }
  }, [user.id]);

  useEffect(() => {
    const fetchCampaignUsage = async () => {
      try {
        const usage = await merchantSubscriptionService.getCampaignUsage();
        setCampaignUsage(usage);
      } catch (err) {
        console.error("Error fetching campaign usage:", err);
      }
    };
    if (user.id) fetchCampaignUsage();
  }, [user.id, deals]);

  const handleImageSelected = (file: File | null) => {
    setSelectedImageFile(file);
    if (file) {
      setExistingThumbnail(null);
      setExistingImageName(null);
    }
  };

  const handleEditClick = useCallback((deal: Deal) => {
    setEditingDealId(deal.campaign_id);
    setDealTitle(deal.deal_heading || '');
    setDealOffer(deal.offerValue || (deal as any).offer_value || '');
    setDealDescription(deal.longDescription || (deal as any).long_description || '');
    setDealStartDate(deal.start_date ? new Date(deal.start_date).toISOString().split('T')[0] : tomorrow);
    setDealEndDate(deal.end_date ? new Date(deal.end_date).toISOString().split('T')[0] : '');
    setSelectedStoreId(deal.store_id || '');
    setExistingThumbnail(deal.thumbnail || (deal as any).image_url || null);
    setExistingImageName(deal.image_name || getFileNameFromUrl(deal.thumbnail) || null);
    setSelectedImageFile(null);
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [tomorrow]);

  useEffect(() => {
    if (preSelectedEditDealId && deals.length > 0) {
      const dealToEdit = deals.find(d => d.campaign_id === preSelectedEditDealId);
      if (dealToEdit) {
        handleEditClick(dealToEdit);
        if (onClearPreSelected) onClearPreSelected();
      }
    }
  }, [preSelectedEditDealId, deals, onClearPreSelected, handleEditClick]);

  useEffect(() => {
    if (!dealTitle && !dealOffer && !dealStartDate && !dealEndDate) {
      setOptimizationResult(null);
      return;
    }
    const timer = setTimeout(async () => {
      if (!user?.id) return;
      setIsOptimizing(true);
      const campaignData = {
        title: dealTitle,
        discount: dealOffer ? parseFloat(dealOffer.replace(/[^0-9.]/g, '')) : undefined,
        launch_date: dealStartDate,
        end_date: dealEndDate,
        category: user.category,
      };
      try {
        const result = await campaignOptimizerService.optimize(user.id, campaignData);
        setOptimizationResult(result);
      } catch (error) {
        console.error('[MerchantMyCampaigns] Optimization error:', error);
      } finally {
        setIsOptimizing(false);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [dealTitle, dealOffer, dealStartDate, dealEndDate, user?.id, user?.category]);

  const merchantDeals = useMemo(() => {
    if (!deals || !user.id) return [];
    return deals.filter(d => {
      const dMerchantId = String(d.merchantId || (d as any).merchant_id).toLowerCase();
      return dMerchantId === String(user.id).toLowerCase();
    }).sort((a, b) => (b.campaign_id || '').localeCompare(a.campaign_id || ''));
  }, [deals, user.id]);

  const filteredDeals = useMemo(() => {
    return merchantDeals.filter(d => {
      const status = (d.status || 'active').toLowerCase();
      return status === activeListTab;
    });
  }, [merchantDeals, activeListTab]);

  useEffect(() => {
    const fetchCampaignStats = async () => {
      if (user?.id && filteredDeals.length > 0) {
        const campaignIds = filteredDeals.map(deal => deal.campaign_id);
        try {
          const [clicks, redemptions] = await Promise.all([
            mDashboardService.getCampaignSpecificClicks(campaignIds),
            mDashboardService.getCampaignSpecificRedemptions(user.id, campaignIds)
          ]);
          setPerCampaignClickCounts(clicks);
          setPerCampaignRedemptionCounts(redemptions);
        } catch (error: any) {
          console.error("[MerchantMyCampaigns] Stats sync error:", error);
        }
      }
    };
    fetchCampaignStats();
  }, [user?.id, filteredDeals, deals]);

  const handleClearForm = () => {
    setEditingDealId(null);
    setDealTitle('');
    setDealOffer('');
    setDealDescription('');
    setDealStartDate(tomorrow);
    setDealEndDate('');
    setSelectedStoreId(merchantStores.length > 0 ? merchantStores[0].id || '' : '');
    setSelectedImageFile(null);
    setExistingThumbnail(null);
    setExistingImageName(null);
    setSelectedTemplate(null);
  };

  const handleTemplateSelect = (template: CampaignTemplate) => {
    setSelectedTemplate(template);
    const applied = campaignTemplatesService.applyTemplate(template);
    setDealTitle(applied.title.slice(0, 50));
    setDealOffer(applied.dealOffer.slice(0, 50));
    setDealDescription(applied.description);
    setDealStartDate(applied.launchDate.split('T')[0]);
    setDealEndDate(applied.endDate.split('T')[0]);
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleAddUpdateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedImageFile && !existingThumbnail) {
      alert("Please upload an image or select an existing one.");
      return;
    }
    if (!selectedStoreId) {
      alert("Please select a store location.");
      return;
    }

    setLoading(true);
    let imageUrl = existingThumbnail;
    let imageName = existingImageName;
    try {
      if (selectedImageFile) {
        const uploadResult = await addCampaignService.uploadDealImage(user.id, selectedImageFile);
        imageUrl = uploadResult.publicUrl;
        imageName = uploadResult.imageName;
        setImageLibrary(prev => [...prev, { url: imageUrl!, name: imageName }]);
      }

      if (!imageUrl || !imageName) throw new Error("Image uplink failed.");

      const store = merchantStores.find(s => s.id === selectedStoreId);
      const latlong = store ? `${store.latitude}, ${store.longitude}` : "0.0, 0.0";

      const campaignPayload: any = {
        merchant_id: user.id,
        shop_name: user.store_name,
        deal_heading: dealTitle,
        offer_value: dealOffer,
        category: user.category,
        long_description: dealDescription,
        start_date: dealStartDate,
        end_date: dealEndDate,
        store_id: selectedStoreId,
        image_url: imageUrl,
        image_name: imageName,
        latlong: latlong,
        is_deal_of_the_day: false,
      };

      if (!editingDealId || isTranslating) {
        setIsTranslating(true);
        const translations = await addCampaignService.translateCampaignData(
          dealTitle, dealOffer, dealDescription, user.store_name
        );
        campaignPayload.localized_heading = translations.heading;
        campaignPayload.localized_offer = translations.offer;
        campaignPayload.localized_description = translations.description;
        campaignPayload.localized_shop_name = translations.shop_name;
        setIsTranslating(false);
      }

      if (editingDealId) {
        await addCampaignService.updateCampaign(editingDealId, campaignPayload);
      } else {
        await addCampaignService.createCampaign(campaignPayload);
        setActiveListTab('review');
        setSavedCampaignData({
          title: dealTitle,
          deal_offer: dealOffer,
          launch_date: dealStartDate,
          end_date: dealEndDate,
          category: user.category,
        });
      }

      setShowSuccessModal(true);
      await refreshDeals();
      handleClearForm();
      setTimeout(() => setShowSuccessModal(false), 3000);

    } catch (e: any) {
      console.error("Campaign save error:", e);
      alert(e.message || "Failed to save campaign. Please try again.");
    } finally {
      setLoading(false);
      setIsTranslating(false);
    }
  };

  const updateRoiInput = (campaignId: string, field: string, value: number) => {
    setRoiInputs(prev => ({
      ...prev,
      [campaignId]: {
        ...(prev[campaignId] || { expectedRedemptions: 0, averageTransactionValue: 0, profitMarginPercentage: 0 }),
        [field]: value
      }
    }));
  };

  const calculateROI = (campaignId: string) => {
    const inputs = roiInputs[campaignId];
    if (!inputs) return { projectedRevenue: 0, projectedProfit: 0 };
    const projectedRevenue = inputs.expectedRedemptions * inputs.averageTransactionValue;
    const projectedProfit = projectedRevenue * (inputs.profitMarginPercentage / 100);
    return { projectedRevenue, projectedProfit };
  };

  return (
    <div className={`px-6 pt-6 pb-32 space-y-6 ${isDark ? 'bg-slate-950' : 'bg-white'}`}>

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[500] bg-black/50 flex items-center justify-center p-6">
          <div className={`w-full max-w-sm rounded-xl p-8 text-center ${isDark ? 'bg-slate-900 border border-slate-800' : 'bg-white border border-slate-200'}`}>
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
            <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Campaign Submitted!</h3>
            <p className={`text-sm mt-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Your campaign has been submitted for review.</p>

            {savedCampaignData && !editingDealId && (
              <button
                onClick={() => {
                  setShowSuccessModal(false);
                  setShowSaveTemplateModal(true);
                }}
                className="mt-4 h-10 px-5 rounded-xl bg-slate-900 text-white text-sm font-medium flex items-center gap-2 mx-auto active:scale-[0.98] transition-all"
              >
                <Sparkles className="w-4 h-4" />
                Save as Template
              </button>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>My Campaigns</h1>
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Create and manage your deals</p>
        </div>
        <button
          onClick={() => setView('merchant_dashboard')}
          className={`w-9 h-9 rounded-lg flex items-center justify-center active:scale-90 transition-all ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      {/* Campaign Usage */}
      {campaignUsage.has_subscription && (
        <div className={`rounded-xl p-4 border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
                <Megaphone className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Campaigns</p>
                <p className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  <span className={campaignUsage.campaigns_used >= campaignUsage.campaigns_limit ? 'text-rose-500' : 'text-emerald-500'}>
                    {campaignUsage.campaigns_used}
                  </span>
                  <span className={isDark ? 'text-slate-600' : 'text-slate-400'}>/{campaignUsage.campaigns_limit}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? 'bg-amber-500/10' : 'bg-amber-50'}`}>
                <Zap className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Deal of the Day</p>
                <p className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  <span className={campaignUsage.dotd_used >= campaignUsage.dotd_limit ? 'text-rose-500' : 'text-emerald-500'}>
                    {campaignUsage.dotd_used}
                  </span>
                  <span className={isDark ? 'text-slate-600' : 'text-slate-400'}>/{campaignUsage.dotd_limit}</span>
                </p>
              </div>
            </div>
          </div>

          {(campaignUsage.campaigns_used >= campaignUsage.campaigns_limit || campaignUsage.dotd_used >= campaignUsage.dotd_limit) && (
            <div className="mt-3 space-y-2">
              {campaignUsage.campaigns_used >= campaignUsage.campaigns_limit && (
                <div className={`flex items-start gap-2 p-3 rounded-lg border ${isDark ? 'bg-rose-500/10 border-rose-500/20' : 'bg-rose-50 border-rose-200'}`}>
                  <AlertCircle className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
                  <p className={`text-xs ${isDark ? 'text-rose-300' : 'text-rose-700'}`}>
                    Campaign limit reached ({campaignUsage.campaigns_used}/{campaignUsage.campaigns_limit}). <button onClick={() => setView('merchant_subscriptions')} className="underline font-medium">Upgrade</button> your plan.
                  </p>
                </div>
              )}
              {campaignUsage.dotd_used >= campaignUsage.dotd_limit && (
                <div className={`flex items-start gap-2 p-3 rounded-lg border ${isDark ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-200'}`}>
                  <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                  <p className={`text-xs ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
                    Deal of the Day limit reached ({campaignUsage.dotd_used}/{campaignUsage.dotd_limit}). <button onClick={() => setView('merchant_subscriptions')} className="underline font-medium">Upgrade</button> your plan.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Campaign Form */}
      <div ref={formRef} className={`p-6 rounded-xl border space-y-5 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="text-center">
          <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {editingDealId ? 'Update Campaign' : 'Create New Campaign'}
          </h3>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Fill in the details below to submit your campaign for review
          </p>
        </div>

        {/* Use Template Button */}
        {!editingDealId && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setShowTemplateGallery(true)}
              className="h-10 px-5 rounded-xl bg-slate-900 text-white text-sm font-medium flex items-center gap-2 active:scale-[0.98] transition-all"
            >
              <Sparkles className="w-4 h-4" />
              Use Template
            </button>
          </div>
        )}

        {/* Template Badge */}
        {selectedTemplate && (
          <div className="flex items-center justify-center">
            <div className={`px-3 py-1.5 rounded-full flex items-center gap-2 ${isDark ? 'bg-purple-500/10 border border-purple-500/20' : 'bg-purple-50 border border-purple-200'}`}>
              <CheckCircle2 className="w-3.5 h-3.5 text-purple-500" />
              <span className="text-xs font-medium text-purple-500">Using: {selectedTemplate.name}</span>
              <button type="button" onClick={() => setSelectedTemplate(null)} className="ml-1">
                <X className="w-3 h-3 text-purple-500" />
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleAddUpdateCampaign} className="space-y-4">
          {/* Image Library */}
          {isLibraryLoading ? (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : imageLibrary.length > 0 && (
            <div className="space-y-2">
              <p className={`text-xs font-medium px-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Your Images</p>
              <div className="flex overflow-x-auto hide-scrollbar gap-2 pb-2 px-1">
                {imageLibrary.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setExistingThumbnail(img.url);
                      setExistingImageName(img.name || getFileNameFromUrl(img.url));
                      setSelectedImageFile(null);
                    }}
                    className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                      existingThumbnail === img.url
                        ? 'border-blue-500 scale-105'
                        : isDark ? 'border-slate-700 opacity-50' : 'border-slate-200 opacity-50'
                    }`}
                  >
                    <img src={img.url} className="w-full h-full object-cover" alt="Lib" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <ImageUpload
            onImageSelected={handleImageSelected}
            previewUrl={selectedImageFile ? URL.createObjectURL(selectedImageFile) : existingThumbnail || undefined}
          />

          {/* Store Location */}
          <select
            className={inputClass}
            value={selectedStoreId}
            onChange={(e) => setSelectedStoreId(e.target.value)}
            required
            disabled={merchantStores.length === 0}
          >
            <option value="">Select Store Location</option>
            {merchantStores.map(store => (
              <option key={store.id} value={store.id}>{store.address}, {store.city}</option>
            ))}
          </select>

          {/* Campaign Optimizer */}
          {showOptimizer && optimizationResult && (
            <div className={`rounded-xl p-4 border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-blue-500" />
                  <h4 className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>Campaign Optimizer</h4>
                  {isOptimizing && <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />}
                </div>
                <button type="button" onClick={() => setShowOptimizer(false)}>
                  <X className={`w-4 h-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                </button>
              </div>

              {/* Score */}
              <div className={`flex items-center gap-3 mb-3 p-3 rounded-lg ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
                <div className="relative w-14 h-14">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="28" cy="28" r="24" stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'} strokeWidth="6" fill="none" />
                    <circle cx="28" cy="28" r="24"
                      stroke={optimizationResult.score >= 85 ? '#10b981' : optimizationResult.score >= 70 ? '#3b82f6' : optimizationResult.score >= 50 ? '#f59e0b' : '#ef4444'}
                      strokeWidth="6" fill="none"
                      strokeDasharray={`${2 * Math.PI * 24}`}
                      strokeDashoffset={`${2 * Math.PI * 24 * (1 - optimizationResult.score / 100)}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <p className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{optimizationResult.score}</p>
                  </div>
                </div>
                <div>
                  <p className={`text-sm font-medium ${
                    optimizationResult.grade === 'Excellent' ? 'text-emerald-500' :
                    optimizationResult.grade === 'Good' ? 'text-blue-500' :
                    optimizationResult.grade === 'Fair' ? 'text-amber-500' : 'text-red-500'
                  }`}>
                    {optimizationResult.grade} Campaign
                  </p>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Predicted engagement: <span className={`font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>{optimizationResult.predictedEngagement}</span>
                  </p>
                </div>
              </div>

              {/* Quick Fixes */}
              {optimizationResult.quickFixes.length > 0 && (
                <div className={`p-3 rounded-lg border mb-3 ${isDark ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-200'}`}>
                  <p className={`text-xs font-medium mb-1.5 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>Quick Fixes</p>
                  <ul className="space-y-1">
                    {optimizationResult.quickFixes.map((fix, idx) => (
                      <li key={idx} className={`text-xs flex items-start gap-1.5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                        <span className="text-amber-500 mt-0.5">*</span>
                        <span>{fix}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Suggestions */}
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {optimizationResult.suggestions
                  .filter(s => s.field !== 'overall')
                  .map((suggestion, idx) => (
                    <div key={idx} className={`p-3 rounded-lg border ${
                      suggestion.severity === 'error' ? isDark ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-200' :
                      suggestion.severity === 'warning' ? isDark ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-200' :
                      suggestion.severity === 'success' ? isDark ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200' :
                      isDark ? 'bg-blue-500/10 border-blue-500/20' : 'bg-blue-50 border-blue-200'
                    }`}>
                      <div className="flex items-start gap-2">
                        {suggestion.severity === 'error' && <AlertCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />}
                        {suggestion.severity === 'warning' && <AlertCircle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />}
                        {suggestion.severity === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />}
                        {suggestion.severity === 'info' && <Info className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />}
                        <div>
                          <p className={`text-xs font-medium ${
                            suggestion.severity === 'error' ? 'text-red-500' :
                            suggestion.severity === 'warning' ? 'text-amber-500' :
                            suggestion.severity === 'success' ? 'text-emerald-500' : 'text-blue-500'
                          }`}>{suggestion.message}</p>
                          <p className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{suggestion.suggestion}</p>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Show Optimizer Button */}
          {!showOptimizer && (dealTitle || dealOffer || dealStartDate || dealEndDate) && (
            <button
              type="button"
              onClick={() => setShowOptimizer(true)}
              className={`w-full h-10 rounded-lg text-sm font-medium flex items-center justify-center gap-2 border ${
                isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <Zap className="w-4 h-4" />
              Show Campaign Optimizer
            </button>
          )}

          {/* Form Fields */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between px-1 mb-1.5">
                <label className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Campaign Headline</label>
                <span className={`text-[10px] font-medium ${dealTitle.length > 50 ? 'text-rose-500' : isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {dealTitle.length}/50
                </span>
              </div>
              <input
                type="text"
                placeholder="Enter compelling campaign title"
                className={inputClass}
                value={dealTitle}
                onChange={(e) => setDealTitle(e.target.value.slice(0, 50))}
                maxLength={50}
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between px-1 mb-1.5">
                <label className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Offer Value</label>
                <span className={`text-[10px] font-medium ${dealOffer.length > 50 ? 'text-rose-500' : isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  {dealOffer.length}/50
                </span>
              </div>
              <input
                type="text"
                placeholder="e.g., 50% OFF or Buy 1 Get 1 Free"
                className={inputClass}
                value={dealOffer}
                onChange={(e) => setDealOffer(e.target.value.slice(0, 50))}
                maxLength={50}
                required
              />
            </div>

            <div>
              <label className={`text-xs font-medium px-1 mb-1.5 block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Campaign Description</label>
              <RichTextEditor
                value={dealDescription}
                onChange={setDealDescription}
                placeholder="Describe your offer in detail..."
                maxLength={400}
              />
            </div>

            <div>
              <label className={`text-xs font-medium px-1 mb-1.5 block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Campaign Duration</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className={`text-[10px] font-medium px-1 block mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Start Date</span>
                  <input type="date" className={inputClass} value={dealStartDate} onChange={(e) => setDealStartDate(e.target.value)} min={tomorrow} required />
                </div>
                <div>
                  <span className={`text-[10px] font-medium px-1 block mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>End Date</span>
                  <input type="date" className={inputClass} value={dealEndDate} onChange={(e) => setDealEndDate(e.target.value)} min={dealStartDate} required />
                </div>
              </div>
            </div>

            <div>
              <label className={`text-xs font-medium px-1 mb-1.5 block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Business Category</label>
              <div className={`h-11 px-4 rounded-lg flex items-center justify-between border ${
                isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
              }`}>
                <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Category:</span>
                <span className={`text-sm font-medium ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{user.category || 'N/A'}</span>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || isTranslating}
            className="w-full h-12 rounded-xl bg-slate-900 text-white text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {loading || isTranslating ? <Loader2 className="w-5 h-5 animate-spin" /> : (
              <>
                <Megaphone className="w-4 h-4" />
                Submit for Review
              </>
            )}
          </button>

          {editingDealId && (
            <button type="button" onClick={handleClearForm} className="w-full text-center text-rose-500 text-xs font-medium mt-1">
              Cancel Edit
            </button>
          )}
        </form>
      </div>

      {/* Campaigns List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
            <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Auto-refresh active</span>
          </div>
        </div>

        {/* Tabs */}
        <div ref={tabsRef} className={`p-1 rounded-lg border flex gap-1 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
          {[
            { key: 'active' as CampaignTab, label: 'Live' },
            { key: 'review' as CampaignTab, label: 'Review' },
            ...(merchantDeals.filter(d => (d.status || '').toLowerCase() === 'needs review').length > 0
              ? [{ key: 'needs review' as CampaignTab, label: 'Needs Review' }]
              : []),
            { key: 'expired' as CampaignTab, label: 'Expired' },
          ].map(tab => {
            const count = merchantDeals.filter(d => (d.status || 'active').toLowerCase() === tab.key).length;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveListTab(tab.key)}
                className={`flex-1 py-2 rounded-md text-xs font-medium transition-all ${
                  activeListTab === tab.key
                    ? 'bg-slate-900 text-white'
                    : isDark ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                {tab.label} ({count})
              </button>
            );
          })}
        </div>

        {/* Needs Review Guide */}
        {activeListTab === 'needs review' && (
          <div className={`p-4 rounded-xl border ${isDark ? 'bg-orange-500/10 border-orange-500/20' : 'bg-orange-50 border-orange-200'}`}>
            <div className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isDark ? 'bg-orange-500/20' : 'bg-orange-100'}`}>
                <AlertCircle className="w-4 h-4 text-orange-500" />
              </div>
              <div>
                <p className={`text-sm font-medium ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>Action Required</p>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  Click Edit on each campaign to review and fix the issues mentioned by the admin.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Campaign Cards */}
        {filteredDeals.length === 0 ? (
          <div className={`text-center py-16 rounded-xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <Megaphone className={`w-8 h-8 mx-auto mb-3 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>No campaigns in this category</p>
            <button
              onClick={() => { setEditingDealId(null); formRef.current?.scrollIntoView({ behavior: 'smooth' }); }}
              className="text-xs font-medium text-blue-500 mt-2"
            >
              Create New Campaign
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredDeals.map(deal => {
              const roiData = calculateROI(deal.campaign_id);
              const clicks = perCampaignClickCounts[deal.campaign_id] || 0;
              const redemptions = perCampaignRedemptionCounts[deal.campaign_id] || 0;

              return (
                <div key={deal.campaign_id}>
                  <div className={`flex gap-3 p-3 rounded-xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                    {/* Image */}
                    <div className={`relative w-28 h-28 shrink-0 rounded-lg overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                      <img src={getCampaignImage(deal)} alt={deal.shopName} className="w-full h-full object-cover" />
                      <div className={`absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-medium ${isDark ? 'bg-slate-900/80 text-white' : 'bg-white/80 text-slate-700'}`}>
                        {deal.category}
                      </div>
                      <div className="absolute bottom-1.5 left-1.5">
                        {getStatusDisplay(deal.status || 'active')}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        <p className={`text-[10px] font-medium ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{deal.shopName}</p>
                        <h3 className={`text-sm font-medium leading-tight line-clamp-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {getLocalizedText(deal.localized_heading, deal.deal_heading || deal.details)}
                        </h3>
                        <p className="text-amber-500 text-xs font-medium mt-0.5">
                          {getLocalizedText(deal.localized_offer, deal.offerValue)}
                        </p>
                      </div>

                      {/* Date + Stats */}
                      <div className="flex items-center gap-2 mt-2">
                        <div className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-medium ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-50 text-slate-600'}`}>
                          <Clock className="w-3 h-3" />
                          {deal.start_date && deal.end_date ? (
                            (() => {
                              const formatDateUTC = (dateStr: string) => {
                                const date = new Date(dateStr + 'T00:00:00Z');
                                return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' });
                              };
                              return `${formatDateUTC(deal.start_date!)} - ${formatDateUTC(deal.end_date!)}`;
                            })()
                          ) : 'No dates'}
                        </div>
                        <div className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-medium ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-50 text-slate-600'}`}>
                          <MousePointer2 className="w-3 h-3" /> {clicks}
                        </div>
                        <div className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-medium ${isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
                          <TicketCheck className="w-3 h-3" /> {redemptions}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 mt-2">
                        {(activeListTab === 'review' || activeListTab === 'needs review') && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleEditClick(deal); }}
                            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-medium active:scale-95 transition-all ${
                              isDark ? 'bg-slate-800 text-slate-300 border border-slate-700' : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            <Edit2 className="w-3 h-3" /> Edit
                          </button>
                        )}
                        {(activeListTab === 'active' || activeListTab === 'expired') && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setShowRoiCalculator(prev => ({...prev, [deal.campaign_id]: !prev[deal.campaign_id]})); }}
                            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-medium active:scale-95 transition-all ${
                              isDark ? 'bg-slate-800 text-slate-300 border border-slate-700' : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            <Calculator className="w-3 h-3" /> {showRoiCalculator[deal.campaign_id] ? 'Hide ROI' : 'ROI'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Admin Comments */}
                  {deal.status?.toLowerCase() === 'needs review' && deal.comments && (
                    <div className={`mt-2 p-3 rounded-lg border ${isDark ? 'bg-orange-500/10 border-orange-500/20' : 'bg-orange-50 border-orange-200'}`}>
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
                        <div>
                          <p className={`text-xs font-medium ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>Admin Feedback</p>
                          <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{deal.comments}</p>
                          <p className={`text-[10px] mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Please review and resubmit.</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ROI Calculator */}
                  {showRoiCalculator[deal.campaign_id] && (
                    <div className={`mt-2 p-4 rounded-lg border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="flex items-center gap-2 mb-3">
                        <Calculator className="w-4 h-4 text-blue-500" />
                        <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>ROI Calculator</span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 mb-3">
                        <div>
                          <label className={`text-[9px] font-medium block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Expected Claims</label>
                          <input
                            type="number"
                            placeholder="100"
                            className={`w-full h-9 px-2 rounded-lg text-sm outline-none border ${
                              isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
                            }`}
                            value={roiInputs[deal.campaign_id]?.expectedRedemptions || ''}
                            onChange={(e) => updateRoiInput(deal.campaign_id, 'expectedRedemptions', parseInt(e.target.value) || 0)}
                          />
                        </div>
                        <div>
                          <label className={`text-[9px] font-medium block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Avg Spend (₹)</label>
                          <input
                            type="number"
                            placeholder="500"
                            className={`w-full h-9 px-2 rounded-lg text-sm outline-none border ${
                              isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
                            }`}
                            value={roiInputs[deal.campaign_id]?.averageTransactionValue || ''}
                            onChange={(e) => updateRoiInput(deal.campaign_id, 'averageTransactionValue', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div>
                          <label className={`text-[9px] font-medium block mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Margin %</label>
                          <input
                            type="number"
                            placeholder="20"
                            className={`w-full h-9 px-2 rounded-lg text-sm outline-none border ${
                              isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
                            }`}
                            value={roiInputs[deal.campaign_id]?.profitMarginPercentage || ''}
                            onChange={(e) => updateRoiInput(deal.campaign_id, 'profitMarginPercentage', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                      </div>

                      {roiData && roiData.projectedRevenue > 0 && (
                        <div className={`grid grid-cols-2 gap-2 pt-3 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                          <div className={`p-3 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
                            <p className={`text-[10px] font-medium mb-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Projected Revenue</p>
                            <p className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>₹{Math.round(roiData.projectedRevenue).toLocaleString('en-IN')}</p>
                          </div>
                          <div className={`p-3 rounded-lg ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
                            <p className={`text-[10px] font-medium mb-0.5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>Projected Profit</p>
                            <p className="text-lg font-semibold text-emerald-500">₹{Math.round(roiData.projectedProfit).toLocaleString('en-IN')}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Template Gallery Modal */}
      {showTemplateGallery && (
        <TemplateGallery
          merchantId={user.id}
          onSelect={handleTemplateSelect}
          onClose={() => setShowTemplateGallery(false)}
          isDark={isDark}
        />
      )}

      {/* Save Template Modal */}
      {showSaveTemplateModal && savedCampaignData && (
        <div className="fixed inset-0 z-[9999] bg-black/50 flex items-start justify-center pt-20 pb-6 overflow-y-auto">
          <div className={`w-full max-w-md rounded-xl p-6 ${isDark ? 'bg-slate-900 border border-slate-800' : 'bg-white border border-slate-200'}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-500" />
                <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Save as Template</h3>
              </div>
              <button onClick={() => { setShowSaveTemplateModal(false); setSavedCampaignData(null); }}>
                <X className={`w-5 h-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
              </button>
            </div>

            <p className={`text-xs mb-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Save this successful campaign as a template for future use.
            </p>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const templateName = formData.get('templateName') as string;
                const templateDescription = formData.get('templateDescription') as string;
                if (!templateName) { alert('Please enter a template name'); return; }
                setLoading(true);
                const result = await campaignTemplatesService.saveTemplate({
                  merchantId: user.id, templateName, templateDescription, campaignData: savedCampaignData,
                });
                setLoading(false);
                if (result.success) {
                  alert('Template saved successfully!');
                  setShowSaveTemplateModal(false);
                  setSavedCampaignData(null);
                } else {
                  alert(result.message || 'Failed to save template');
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className={`text-xs font-medium block mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Template Name *
                </label>
                <input
                  type="text"
                  name="templateName"
                  placeholder="e.g., My Summer Sale Template"
                  className={inputClass}
                  required
                  maxLength={50}
                />
              </div>

              <div>
                <label className={`text-xs font-medium block mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Description (Optional)
                </label>
                <textarea
                  name="templateDescription"
                  placeholder="Describe when to use this template..."
                  rows={3}
                  className={`w-full px-4 py-3 rounded-lg text-sm outline-none border resize-none ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                  }`}
                  maxLength={200}
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowSaveTemplateModal(false); setSavedCampaignData(null); }}
                  className={`flex-1 h-11 rounded-xl text-sm font-medium border ${isDark ? 'border-slate-700 text-slate-400' : 'border-slate-200 text-slate-500'}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 h-11 rounded-xl bg-slate-900 text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {loading ? 'Saving...' : 'Save Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
