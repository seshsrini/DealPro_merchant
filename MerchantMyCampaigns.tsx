
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Deal, MerchantStore, AppView } from './types';
import { userService } from './services/userService';
import { addCampaignService } from './services/addCampaignService';
import { merchantService } from './services/merchantService';
import { mDashboardService } from './services/mDashboardService';
import { useTranslation } from './contexts/LanguageContext';
import { 
  Megaphone, 
  Loader2, 
  Plus,
  CheckCircle2,
  X,
  Edit2,
  Globe,
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
  Activity
} from 'lucide-react';
import { ImageUpload } from './components/ImageUpload';
import { RichTextEditor } from './components/RichTextEditor';

interface MerchantMyCampaignsProps {
  user: any;
  deals: Deal[]; 
  loading: boolean;
  setLoading: (loading: boolean) => void;
  refreshDeals: () => Promise<void>;
  setView: (view: AppView) => void;
  preSelectedEditDealId?: string | null;
  onClearPreSelected?: () => void;
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
  preSelectedEditDealId, onClearPreSelected
}) => {
  const { t, getLocalizedText } = useTranslation();
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const formRef = useRef<HTMLDivElement>(null);
  
  const [dealTitle, setDealTitle] = useState('');
  const [dealOffer, setDealOffer] = useState('');
  const [dealStartDate, setDealStartDate] = useState(tomorrow);
  const [dealEndDate, setDealEndDate] = useState('');
  const [dealDescription, setDealDescription] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isBulkTranslating, setIsBulkTranslating] = useState(false);
  
  const [merchantStores, setMerchantStores] = useState<MerchantStore[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [editingDealId, setEditingDealId] = useState<string | null>(null);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [existingThumbnail, setExistingThumbnail] = useState<string | null>(null);
  const [existingImageName, setExistingImageName] = useState<string | null>(null);

  const [imageLibrary, setImageLibrary] = useState<{url: string, name?: string}[]>([]);
  const [isLibraryLoading, setIsLibraryLoading] = useState(false);
  
  const [activeListTab, setActiveListTab] = useState<CampaignTab>('active');

  // ROI states
  const [roiInputs, setRoiInputs] = useState<Record<string, {
    expectedRedemptions: number;
    averageTransactionValue: number;
    profitMarginPercentage: number;
  }>>({});
  const [showRoiCalculator, setShowRoiCalculator] = useState<Record<string, boolean>>({}); 
  
  const [perCampaignClickCounts, setPerCampaignClickCounts] = useState<Record<string, number>>({});
  const [perCampaignRedemptionCounts, setPerCampaignRedemptionCounts] = useState<Record<string, number>>({});

  const getStatusDisplay = (status: string) => {
    switch (status.toLowerCase()) {
      case 'review': return <span className="flex items-center gap-1 text-amber-500"><AlertCircle className="w-3 h-3" /> In Review</span>;
      case 'active': return <span className="flex items-center gap-1 text-emerald-500"><CheckCircle2 className="w-3 h-3" /> Active</span>;
      case 'expired': return <span className="flex items-center gap-1 text-rose-500"><History className="w-3 h-3" /> Expired</span>;
      default: return <span className="text-slate-500">{status}</span>;
    }
  };

  const getCampaignImage = (deal: Deal) => {
    const libImage = imageLibrary.find(img => img.name === deal.image_name);
    return libImage?.url || deal.thumbnail || DEFAULT_DEAL_IMAGE;
  };

  // Pulse Sync Loop (10s)
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      if (!isTranslating && !isBulkTranslating && !editingDealId) {
        refreshDeals();
      }
    }, 10000);

    return () => clearInterval(refreshInterval);
  }, [refreshDeals, isTranslating, isBulkTranslating, editingDealId]);

  // Load Merchant Assets
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

  const handleImageSelected = (file: File | null) => {
    setSelectedImageFile(file);
    if (file) {
      setExistingThumbnail(null);
      setExistingImageName(null);
    }
  };

  const handleEditClick = useCallback((deal: Deal) => {
    // FIX: Use campaign_id instead of id
    setEditingDealId(deal.campaign_id);
    // FIX: Use deal_heading instead of dealHeading - with null safety
    setDealTitle(deal.deal_heading || '');
    // Support both camelCase and snake_case for backward compatibility
    setDealOffer(deal.offerValue || (deal as any).offer_value || '');
    setDealDescription(deal.longDescription || (deal as any).long_description || '');
    // FIX: Use start_date and end_date instead of startDate and endDate
    setDealStartDate(deal.start_date ? new Date(deal.start_date).toISOString().split('T')[0] : tomorrow);
    setDealEndDate(deal.end_date ? new Date(deal.end_date).toISOString().split('T')[0] : '');
    setSelectedStoreId(deal.store_id || '');
    // The category is derived from user.category, not deal.category, so removed direct setCategory(deal.category || '') here.
    // Assuming `user.category` is the canonical one for new campaigns/updates.
    setExistingThumbnail(deal.thumbnail || (deal as any).image_url || null);
    setExistingImageName(deal.image_name || getFileNameFromUrl(deal.thumbnail) || null);
    setSelectedImageFile(null);
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [tomorrow]);

  useEffect(() => {
    if (preSelectedEditDealId && deals.length > 0) {
      // FIX: Use campaign_id for finding the deal to edit
      const dealToEdit = deals.find(d => d.campaign_id === preSelectedEditDealId); 
      if (dealToEdit) {
        handleEditClick(dealToEdit);
        if (onClearPreSelected) onClearPreSelected();
      }
    }
  }, [preSelectedEditDealId, deals, onClearPreSelected, handleEditClick]);

  // Grid Data Mapping
  const merchantDeals = useMemo(() => {
    if (!deals || !user.id) return [];
    return deals.filter(d => {
      const dMerchantId = String(d.merchantId || (d as any).merchant_id).toLowerCase();
      return dMerchantId === String(user.id).toLowerCase();
    // FIX: Use campaign_id for sorting
    }).sort((a, b) => (b.campaign_id || '').localeCompare(a.campaign_id || '')); 
  }, [deals, user.id]);

  const filteredDeals = useMemo(() => {
    return merchantDeals.filter(d => {
      const status = (d.status || 'active').toLowerCase();
      return status === activeListTab;
    });
  }, [merchantDeals, activeListTab]);

  // REQUIRED: Sync Click and Redemption Counts for each campaign
  useEffect(() => {
    const fetchCampaignStats = async () => {
      if (user?.id && filteredDeals.length > 0) {
        // FIX: Use campaign_id for mapping
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
  }, [user?.id, filteredDeals, deals]); // Re-fetch when global deals update

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
      }

      setShowSuccessModal(true);
      await refreshDeals();
      handleClearForm();
      setTimeout(() => setShowSuccessModal(false), 2000);

    } catch (e: any) {
      console.error("Campaign save error:", e);
      alert(e.message || "Failed to save campaign. Please try again.");
    } finally {
      setLoading(false);
      setIsTranslating(false);
    }
  };

  const updateRoiInput = (campaignId: string, field: string, value: number) => { // FIX: Renamed dealId to campaignId for clarity
    setRoiInputs(prev => ({
      ...prev,
      [campaignId]: { // FIX: Use campaignId
        ...(prev[campaignId] || { expectedRedemptions: 0, averageTransactionValue: 0, profitMarginPercentage: 0 }), // FIX: Use campaignId
        [field]: value
      }
    }));
  };

  const calculateROI = (campaignId: string) => { // FIX: Renamed dealId to campaignId for clarity
    const inputs = roiInputs[campaignId]; // FIX: Use campaignId
    if (!inputs) return { projectedRevenue: 0, projectedProfit: 0 };
    const projectedRevenue = inputs.expectedRedemptions * inputs.averageTransactionValue;
    const projectedProfit = projectedRevenue * (inputs.profitMarginPercentage / 100);
    return { projectedRevenue, projectedProfit };
  };

  const handleBulkTranslate = async () => {
    setIsBulkTranslating(true);
    setLoading(true);
    try {
      await addCampaignService.repairCampaignTranslations(user.id);
      await refreshDeals(); 
      alert("Missing translations synchronized.");
    } catch (e: any) {
      console.error("Sync error:", e);
    } finally {
      setIsBulkTranslating(false);
      setLoading(false);
    }
  };

  return (
    <div className="px-6 pt-6 pb-32 animate-reveal space-y-8">
      {showSuccessModal && (
        <div className="fixed inset-0 z-[500] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-reveal">
          <div className="w-full max-w-sm glass rounded-[3rem] border-white/10 p-10 relative overflow-hidden shadow-[0_0_50px_rgba(59,130,246,0.2)] text-center">
            <div className="w-24 h-24 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(16,185,129,0.3)] border border-emerald-500/30">
              <CheckCircle2 className="w-14 h-14 text-emerald-500" />
            </div>
            <h3 className="text-2xl font-black uppercase text-white">Wave Synchronized</h3>
            <p className="text-slate-400 text-xs mt-2 leading-relaxed">Grid uplink established. Campaign nodes successfully updated.</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black uppercase tracking-tighter leading-none text-white">My<br/><span className="text-blue-500">Campaigns</span></h2>
          <div className="flex items-center gap-2 mt-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em]">Grid Node Control</p>
          </div>
        </div>
        <button onClick={() => setView('merchant_dashboard')} className="w-14 h-14 glass rounded-2xl flex items-center justify-center border-white/10 active:scale-90 transition-transform">
          <Globe className="w-6 h-6 text-slate-400" />
        </button>
      </div>

      {/* Campaign Form */}
      <div ref={formRef} className="glass p-8 rounded-[3.5rem] border-white/10 bg-slate-900/40 shadow-2xl space-y-6">
        <h3 className="text-xl font-black uppercase tracking-tighter text-white text-center">
          {editingDealId ? 'Update Grid Node' : 'Broadcast New Wave'}
        </h3>
        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 text-center -mt-4">
          Synchronize your offer to the DealPro grid
        </p>

        <form onSubmit={handleAddUpdateCampaign} className="space-y-4">
          <div className="space-y-4">
            {isLibraryLoading ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              </div>
            ) : imageLibrary.length > 0 && (
              <div className="space-y-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 px-1">Visual Archive</p>
                <div className="flex overflow-x-auto hide-scrollbar gap-3 pb-2 px-1">
                  {imageLibrary.map((img, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setExistingThumbnail(img.url);
                        setExistingImageName(img.name || getFileNameFromUrl(img.url));
                        setSelectedImageFile(null); 
                      }}
                      className={`shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${
                        existingThumbnail === img.url ? 'border-blue-500 scale-105 shadow-[0_0_15px_rgba(59,130,246,0.4)]' : 'border-white/5 opacity-40'
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
          </div>

          {/* Moved: Store Location Dropdown */}
          <select 
            className="input-premium" 
            value={selectedStoreId} 
            onChange={(e) => setSelectedStoreId(e.target.value)}
            required
            disabled={merchantStores.length === 0}
          >
            <option value="">Select Retail Node</option>
            {merchantStores.map(store => (
              <option key={store.id} value={store.id}>{store.address}, {store.city}</option>
            ))}
          </select>
          {/* End Moved Section */}

          <div className="space-y-5">
            {/* Campaign Headline with character counter */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Campaign Headline</label>
                <span className={`text-[9px] font-bold ${dealTitle.length > 50 ? 'text-rose-400' : 'text-slate-500'}`}>
                  {dealTitle.length}/50
                </span>
              </div>
              <input
                type="text"
                placeholder="Enter compelling campaign title"
                className="input-premium"
                value={dealTitle}
                onChange={(e) => setDealTitle(e.target.value.slice(0, 50))}
                maxLength={50}
                required
              />
            </div>

            {/* Incentive Value with character counter */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Incentive Value</label>
                <span className={`text-[9px] font-bold ${dealOffer.length > 50 ? 'text-rose-400' : 'text-slate-500'}`}>
                  {dealOffer.length}/50
                </span>
              </div>
              <input
                type="text"
                placeholder="e.g., 50% OFF or Buy 1 Get 1 Free"
                className="input-premium"
                value={dealOffer}
                onChange={(e) => setDealOffer(e.target.value.slice(0, 50))}
                maxLength={50}
                required
              />
            </div>

            {/* Description with rich text editor */}
            <div className="space-y-2">
              <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 px-1">Campaign Description</label>
              <RichTextEditor
                value={dealDescription}
                onChange={setDealDescription}
                placeholder="Describe your offer in detail. What makes it special? Use bullet points and emojis to make it engaging!"
                maxLength={400}
              />
            </div>

            {/* Date Range */}
            <div className="space-y-2">
              <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 px-1">Campaign Duration</label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <span className="text-[8px] font-bold uppercase tracking-wide text-slate-500 px-1">Start Date</span>
                  <input
                    type="date"
                    className="input-premium text-sm"
                    value={dealStartDate}
                    onChange={(e) => setDealStartDate(e.target.value)}
                    min={tomorrow}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <span className="text-[8px] font-bold uppercase tracking-wide text-slate-500 px-1">End Date</span>
                  <input
                    type="date"
                    className="input-premium text-sm"
                    value={dealEndDate}
                    onChange={(e) => setDealEndDate(e.target.value)}
                    min={dealStartDate}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Business Category (read-only) */}
            <div className="space-y-2">
              <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 px-1">Business Category</label>
              <div className="input-premium flex items-center justify-between text-slate-300 pointer-events-none bg-white/[0.02]">
                <span className="text-sm font-semibold text-slate-400">Category:</span>
                <span className="text-sm font-bold text-blue-400">{user.category || 'N/A'}</span>
              </div>
            </div>
          </div>

          <button type="submit" disabled={loading || isTranslating} className="w-full btn-premium h-16 rounded-2xl shadow-xl shadow-blue-500/20 active:scale-95 transition-all mt-4">
            {loading || isTranslating ? <Loader2 className="w-5 h-5 animate-spin" /> : (
              <div className="flex items-center gap-3">
                <Megaphone className="w-5 h-5" />
                <span className="text-[11px] font-black uppercase tracking-widest">{editingDealId ? 'Update Protocol' : 'Broadcast Wave'}</span>
              </div>
            )}
          </button>
          {editingDealId && (
            <button type="button" onClick={handleClearForm} className="w-full text-center text-rose-500 text-[10px] font-black uppercase tracking-widest mt-2">
              <X className="w-3 h-3 inline-block mr-2" /> Cancel Edit
            </button>
          )}
        </form>
      </div>

      {/* Bulk Translation Button */}
      <div className="text-center px-4">
        <button 
          onClick={handleBulkTranslate}
          disabled={isBulkTranslating || loading}
          className="text-blue-500 text-[10px] font-black uppercase tracking-widest hover:text-blue-400 active:scale-95 transition-all flex items-center gap-2 mx-auto"
        >
          {isBulkTranslating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Re-translate missing data
        </button>
      </div>

      {/* Campaigns List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-3">
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-emerald-500">Live Grid Sync Active</span>
            </div>
            <p className="text-[8px] font-black uppercase tracking-[0.15em] text-slate-600 flex items-center gap-1">
                <Activity className="w-3 h-3" /> Auto-Refresh: 10s
            </p>
        </div>

        <div className="glass p-1.5 rounded-2xl border-white/5 bg-white/5 flex gap-2">
          <button
            onClick={() => setActiveListTab('active')}
            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${activeListTab === 'active' ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/20' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Live ({merchantDeals.filter(d => (d.status || 'active').toLowerCase() === 'active').length})
          </button>
          <button
            onClick={() => setActiveListTab('review')}
            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${activeListTab === 'review' ? 'bg-amber-600 text-white shadow-xl shadow-amber-500/20' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Audit ({merchantDeals.filter(d => (d.status || 'active').toLowerCase() === 'review').length})
          </button>
          {/* Show Needs Review tab only if there are campaigns with that status */}
          {merchantDeals.filter(d => (d.status || '').toLowerCase() === 'needs review').length > 0 && (
            <button
              onClick={() => setActiveListTab('needs review')}
              className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${activeListTab === 'needs review' ? 'bg-orange-600 text-white shadow-xl shadow-orange-500/20' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Needs Review ({merchantDeals.filter(d => (d.status || '').toLowerCase() === 'needs review').length})
            </button>
          )}
          <button
            onClick={() => setActiveListTab('expired')}
            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${activeListTab === 'expired' ? 'bg-rose-600 text-white shadow-xl shadow-rose-500/20' : 'text-slate-500 hover:text-slate-300'}`}
          >
            History ({merchantDeals.filter(d => (d.status || 'active').toLowerCase() === 'expired').length})
          </button>
        </div>

        {filteredDeals.length === 0 ? (
          <div className="text-center py-20 glass rounded-[2.5rem] border-white/10 mx-1 bg-slate-950/40">
            <Megaphone className="w-10 h-10 text-slate-700 mx-auto mb-4" />
            <p className="text-xs font-bold text-slate-300 mb-4 px-8 leading-relaxed">
              No active waves detected in this sector.
            </p>
            <button 
              onClick={() => { setEditingDealId(null); formRef.current?.scrollIntoView({ behavior: 'smooth' }); }}
              className="text-[9px] font-black uppercase text-blue-400 tracking-widest underline decoration-blue-400/30 underline-offset-4"
            >
              CREATE NEW CAMPAIGN
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredDeals.map(deal => {
              // FIX: Use campaign_id consistently
              const roiData = calculateROI(deal.campaign_id);
              const clicks = perCampaignClickCounts[deal.campaign_id] || 0;
              const redemptions = perCampaignRedemptionCounts[deal.campaign_id] || 0;

              return (
                <div key={deal.campaign_id} className="group animate-reveal">
                  {/* Modern Horizontal Card */}
                  <div className="flex gap-4 p-4 bg-gradient-to-br from-white/[0.05] to-white/[0.02] border border-white/10 rounded-2xl overflow-hidden shadow-xl hover:shadow-2xl hover:border-white/20 transition-all duration-300">
                    {/* Image Section - Compact */}
                    <div className="relative w-32 h-32 flex-shrink-0 rounded-xl overflow-hidden bg-slate-800">
                      <img src={getCampaignImage(deal)} alt={deal.shopName} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      <div className="absolute inset-0 bg-gradient-to-br from-black/40 to-transparent"></div>

                      {/* Category Badge */}
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-blue-600/90 backdrop-blur-sm border border-white/20 text-white text-[8px] font-black uppercase tracking-wider shadow-lg">
                        {deal.category}
                      </div>

                      {/* Status Badge on Image */}
                      <div className="absolute bottom-2 left-2 right-2">
                        {getStatusDisplay(deal.status || 'active')}
                      </div>
                    </div>

                    {/* Content Section */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      {/* Header */}
                      <div>
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-[9px] font-black uppercase tracking-wider text-blue-400 mb-1">{deal.shopName}</p>
                            <h3 className="text-sm font-black text-white leading-tight line-clamp-2 mb-1">
                              {getLocalizedText(deal.localized_heading, deal.deal_heading || deal.details)}
                            </h3>
                            <p className="text-amber-400 text-[10px] font-bold uppercase tracking-wide">
                              {getLocalizedText(deal.localized_offer, deal.offerValue)}
                            </p>
                          </div>

                          {/* Date Range */}
                          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/5 rounded-lg border border-white/10 flex-shrink-0">
                            <Clock className="w-3 h-3 text-blue-400" />
                            <span className="text-[9px] font-bold text-white uppercase tracking-tight whitespace-nowrap">
                              {deal.start_date && deal.end_date ? (
                                (() => {
                                  const formatDateUTC = (dateStr: string, includeYear: boolean = false) => {
                                    const date = new Date(dateStr + 'T00:00:00Z');
                                    const options: Intl.DateTimeFormatOptions = {
                                      day: '2-digit',
                                      month: 'short',
                                      timeZone: 'UTC'
                                    };
                                    if (includeYear) options.year = 'numeric';
                                    return date.toLocaleDateString('en-GB', options);
                                  };
                                  return `${formatDateUTC(deal.start_date!, true)} - ${formatDateUTC(deal.end_date!)}`;
                                })()
                              ) : 'No dates set'}
                            </span>
                          </div>
                        </div>

                        {/* Stats Grid - Compact */}
                        <div className="flex items-center gap-3 mt-3">
                          <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg border border-white/10">
                            <div className="text-center">
                              <p className="text-[8px] font-bold uppercase tracking-wider text-slate-500">Clicks</p>
                              <p className="text-white text-sm font-black mt-0.5">{clicks}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                            <div className="text-center">
                              <p className="text-[8px] font-bold uppercase tracking-wider text-emerald-400">Claims</p>
                              <p className="text-emerald-400 text-sm font-black mt-0.5">{redemptions}</p>
                            </div>
                          </div>

                          {/* Action Buttons - Inline */}
                          <div className="ml-auto flex items-center gap-3">
                            {/* Show Edit button for Review and Needs Review tabs */}
                            {(activeListTab === 'review' || activeListTab === 'needs review') && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleEditClick(deal); }}
                                className="px-4 py-2 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-lg flex items-center gap-2 hover:bg-indigo-600/30 transition-colors active:scale-95"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                                <span className="text-[10px] font-black uppercase tracking-wider">Edit</span>
                              </button>
                            )}

                            {/* Show ROI calculator toggle only for Active and Expired tabs */}
                            {(activeListTab === 'active' || activeListTab === 'expired') && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setShowRoiCalculator(prev => ({...prev, [deal.campaign_id]: !prev[deal.campaign_id]})); }}
                                className="px-3 py-2 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg flex items-center gap-2 hover:bg-blue-500/20 transition-colors active:scale-95"
                              >
                                <Calculator className="w-3.5 h-3.5" />
                                <span className="text-[10px] font-black uppercase tracking-wider">{showRoiCalculator[deal.campaign_id] ? 'Hide ROI' : 'ROI'}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Deal Admin Comments - Show for "needs review" status */}
                  {deal.status?.toLowerCase() === 'needs review' && deal.comments && (
                    <div className="mt-3 p-4 rounded-xl bg-gradient-to-br from-orange-500/10 to-amber-500/10 border border-orange-500/30 backdrop-blur-sm animate-reveal">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center shrink-0 mt-0.5">
                          <AlertCircle className="w-4 h-4 text-orange-400" />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-sm font-bold text-orange-400 mb-2 flex items-center gap-2">
                            Deal Admin Feedback
                          </h4>
                          <p className="text-xs text-slate-300 leading-relaxed">
                            {deal.comments}
                          </p>
                          <p className="text-[9px] text-slate-500 mt-2 italic">
                            Please review the feedback above, make necessary changes, and resubmit your campaign.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Modern ROI Calculator - Outside card for full width */}
                  {showRoiCalculator[deal.campaign_id] && (
                    <div className="mt-3 p-5 rounded-xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/20 backdrop-blur-sm animate-reveal">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                            <Calculator className="w-4 h-4 text-blue-400" />
                          </div>
                          <span className="text-sm font-bold text-slate-200">ROI Calculator</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3 mb-4 items-end">
                        <div>
                          <label className="text-[9px] text-slate-400 uppercase tracking-wide block mb-1.5 h-[26px] flex items-end">Expected Claims</label>
                          <input
                            type="number"
                            placeholder="100"
                            className="w-full h-9 px-3 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 outline-none transition-all"
                            value={roiInputs[deal.campaign_id]?.expectedRedemptions || ''}
                            onChange={(e) => updateRoiInput(deal.campaign_id, 'expectedRedemptions', parseInt(e.target.value) || 0)}
                          />
                        </div>
                        <div>
                          <label className="text-[9px] text-slate-400 uppercase tracking-wide block mb-1.5 leading-tight h-[26px] flex items-start">Avg Spend per<br/>Customer (₹)</label>
                          <input
                            type="number"
                            placeholder="500"
                            className="w-full h-9 px-3 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 outline-none transition-all"
                            value={roiInputs[deal.campaign_id]?.averageTransactionValue || ''}
                            onChange={(e) => updateRoiInput(deal.campaign_id, 'averageTransactionValue', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div>
                          <label className="text-[9px] text-slate-400 uppercase tracking-wide block mb-1.5 h-[26px] flex items-end">Margin %</label>
                          <input
                            type="number"
                            placeholder="20"
                            className="w-full h-9 px-3 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 outline-none transition-all"
                            value={roiInputs[deal.campaign_id]?.profitMarginPercentage || ''}
                            onChange={(e) => updateRoiInput(deal.campaign_id, 'profitMarginPercentage', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                      </div>

                      {roiData && roiData.projectedRevenue > 0 && (
                        <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/10">
                          <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Projected Revenue</p>
                            <p className="text-xl font-black text-white">₹{Math.round(roiData.projectedRevenue).toLocaleString('en-IN')}</p>
                          </div>
                          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                            <p className="text-[10px] text-emerald-400 uppercase tracking-wider mb-1">Projected Profit</p>
                            <p className="text-xl font-black text-emerald-400">₹{Math.round(roiData.projectedProfit).toLocaleString('en-IN')}</p>
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
    </div>
  );
};