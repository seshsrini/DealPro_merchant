
import React, { useState, useEffect } from 'react';
import { User, MerchantStore } from './types';
import { addCampaignService } from './services/addCampaignService';
import { merchantService } from './services/merchantService'; 
import { useTranslation } from './contexts/LanguageContext';
import {
  Loader2,
  CheckCircle2,
  Edit2,
  ChevronRight,
  AlertTriangle,
  Store,
  MapPin,
  Calendar
} from 'lucide-react';
import { ImageUpload } from './components/ImageUpload';

interface DealAdminEditCampaignProps {
  user: User;
  campaignIdToEdit: string;
  onCloseEdit: () => void;
  refreshAdminDeals: () => Promise<void>;
  setLoading: (loading: boolean) => void;
  loading: boolean; 
}

const getFileNameFromUrl = (url: string | null): string | null => {
  if (!url) return null;
  try {
    const urlObj = new URL(url);
    return urlObj.pathname.split('/').pop() || null;
  } catch {
    return null;
  }
};

export const DealAdminEditCampaign: React.FC<DealAdminEditCampaignProps> = ({
  user, campaignIdToEdit, onCloseEdit, refreshAdminDeals, setLoading, loading
}) => {
  const { t } = useTranslation();
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  // Campaign State
  const [campaign, setCampaign] = useState<any | null>(null);
  const [dealTitle, setDealTitle] = useState('');
  const [dealOffer, setDealOffer] = useState('');
  const [dealDescription, setDealDescription] = useState('');
  const [dealStartDate, setDealStartDate] = useState(tomorrow);
  const [dealEndDate, setDealEndDate] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [comments, setComments] = useState<string>('');
  
  // Store State
  const [merchantStores, setMerchantStores] = useState<MerchantStore[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [displayStoreAddress, setDisplayStoreAddress] = useState('');

  // Media State
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [existingThumbnail, setExistingThumbnail] = useState<string | null>(null);
  const [existingImageName, setExistingImageName] = useState<string | null>(null);
  const [imageLibrary, setImageLibrary] = useState<{url: string, name?: string}[]>([]);
  const [isLibraryLoading, setIsLibraryLoading] = useState(false);

  // UI State
  const [isTranslating, setIsTranslating] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Effect 1: Primary Data Fetch
  useEffect(() => {
    const fetchCampaignDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await addCampaignService.getCampaignDetails(campaignIdToEdit);
        setCampaign(data);
        
        // Map Universal Fields
        // FIX: Use deal_heading property
        setDealTitle(data.deal_heading || '');
        // FIX: Use offer_value property
        setDealOffer(data.offerValue || ''); 
        // FIX: Use long_description property
        setDealDescription(data.longDescription || ''); 
        setDealStartDate(data.start_date || tomorrow);
        setDealEndDate(data.end_date || '');
        // Keep "Select Action" as default - don't pre-fill with existing status
        // setSelectedStatus(data.status || 'review');
        setComments(data.comments || '');
        // FIX: Use store_id property
        setSelectedStoreId(data.store_id || '');
        
        // Image logic
        // FIX: Prioritize thumbnail from the Deal interface
        const img = data.thumbnail;
        setExistingThumbnail(img || null);
        setExistingImageName(data.image_name || getFileNameFromUrl(img) || null);

        // ADDRESS LOGIC: Check both nested merchant_stores and flat structure
        console.log("[DealAdminEditCampaign] Campaign data received:", data);
        console.log("[DealAdminEditCampaign] Address fields:", {
          nested_address: data.merchant_stores?.address,
          flat_address: (data as any).address,
          nested_city: data.merchant_stores?.city,
          flat_city: (data as any).city
        });

        // Try nested structure first (from join), then flat structure (direct columns)
        const address = data.merchant_stores?.address || (data as any).address;
        const city = data.merchant_stores?.city || (data as any).city;

        if (address) {
          const cityPart = city ? `, ${city}` : '';
          setDisplayStoreAddress(`${address}${cityPart}`);
        } else {
          setDisplayStoreAddress("Address not assigned to campaign");
        }

      } catch (e: any) {
        console.error("Fetch Error:", e);
        setError(e.message || "Failed to load campaign.");
      } finally {
        setLoading(false);
      }
    };

    fetchCampaignDetails();
  }, [campaignIdToEdit, setLoading, tomorrow]);

  // Effect 2: Secondary Assets (Resilient to failure)
  useEffect(() => {
    const fetchMerchantAssets = async () => {
      const mId = campaign?.merchant_id;
      if (!mId) return;
      
      setIsLibraryLoading(true);
      try {
        const results = await Promise.allSettled([
          merchantService.getMerchantStores(mId),
          addCampaignService.getMerchantImages(mId)
        ]);

        if (results[0].status === 'fulfilled') {
          setMerchantStores(results[0].value);
        }
        if (results[1].status === 'fulfilled') {
          setImageLibrary(results[1].value);
        }
      } catch (e: any) {
        console.warn("Background asset fetch failed, continuing with primary data.");
      } finally {
        setIsLibraryLoading(false);
      }
    };

    fetchMerchantAssets();
  }, [campaign?.merchant_id]);

  const handleUpdateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaign) return;

    setLoading(true);
    setError(null);

    try {
      let imageUrl = existingThumbnail;
      let imageName = existingImageName;

      if (selectedImageFile) {
        const upload = await addCampaignService.uploadDealImage(campaign.merchant_id, selectedImageFile);
        imageUrl = upload.publicUrl;
        imageName = upload.imageName;
      }

      // Preserve existing latlong - don't recalculate from store
      // Deal Admin should not modify location data during approval
      const latlong = campaign.latlong;

      const payload: any = {
        merchant_id: campaign.merchant_id,
        shop_name: campaign.shopName,
        deal_heading: dealTitle,
        offer_value: dealOffer,
        category: campaign.category,
        long_description: dealDescription,
        start_date: dealStartDate,
        end_date: dealEndDate,
        store_id: selectedStoreId,
        image_url: imageUrl,
        image_name: imageName,
        latlong: latlong,
        status: selectedStatus,
        comments: comments,
      };

      // Translation detection
      const hasContentChanged = 
        dealTitle !== campaign.deal_heading ||
        dealOffer !== campaign.offerValue ||
        dealDescription !== campaign.longDescription;

      if (hasContentChanged) {
        setIsTranslating(true);
        const trans = await addCampaignService.translateCampaignData(dealTitle, dealOffer, dealDescription, campaign.shopName);
        payload.localized_heading = trans.heading;
        payload.localized_offer = trans.offer;
        payload.localized_description = trans.description;
        payload.localized_shop_name = trans.shop_name;
        setIsTranslating(false);
      } else {
        payload.localized_heading = campaign.localized_heading;
        payload.localized_offer = campaign.localized_offer;
        payload.localized_description = campaign.localized_description;
        payload.localized_shop_name = campaign.localized_shop_name;
      }

      await addCampaignService.adminUpdateCampaign(campaignIdToEdit, payload);

      setShowSuccessModal(true);
      await refreshAdminDeals();
      setTimeout(() => {
        setShowSuccessModal(false);
        onCloseEdit();
      }, 1500);

    } catch (e: any) {
      setError(e.message || "Update failed.");
    } finally {
      setLoading(false);
    }
  };

  if (loading && !campaign) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Accessing Data...</p>
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 pb-24 animate-reveal space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={onCloseEdit} className="w-10 h-10 glass rounded-xl flex items-center justify-center border-white/10 active:scale-90 transition-transform">
          <ChevronRight className="w-4 h-4 text-slate-400 rotate-180" />
        </button>
        <h2 className="text-lg font-black uppercase tracking-tighter text-white">Edit <span className="text-indigo-500">Campaign</span></h2>
        <div className="w-10 h-10 glass rounded-xl flex items-center justify-center border-white/10">
          <Edit2 className="w-4 h-4 text-indigo-500" />
        </div>
      </div>

      {error && (
        <div className="p-3 glass border-rose-500/20 text-rose-500 text-[9px] font-black uppercase rounded-xl animate-shake flex items-center gap-2">
          <AlertTriangle className="w-3 h-3" />
          {error}
        </div>
      )}

      <form onSubmit={handleUpdateCampaign} className="space-y-4">
        {/* Media Selection */}
        <div className="space-y-2">
          <ImageUpload
            onImageSelected={(file) => {
                setSelectedImageFile(file);
                if (file) setExistingThumbnail(null);
            }}
            previewUrl={selectedImageFile ? URL.createObjectURL(selectedImageFile) : existingThumbnail || undefined}
          />

          {isLibraryLoading ? (
              <div className="flex items-center justify-center p-3">
                <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              </div>
            ) : imageLibrary.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto pb-1.5 hide-scrollbar">
              {imageLibrary.map((img, i) => (
                <button key={i} type="button" onClick={() => { setExistingThumbnail(img.url); setSelectedImageFile(null); }} className={`shrink-0 w-12 h-12 rounded-lg border-2 transition-all ${existingThumbnail === img.url ? 'border-indigo-500 scale-105' : 'border-transparent opacity-50'}`}>
                  <img src={img.url} className="w-full h-full object-cover rounded-md" alt="" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Store Information (Read-Only) */}
        <div className="space-y-2">
          <div className="relative">
            <Store className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
            <input
              type="text"
              className="input-premium pl-9 h-8 text-[10px] opacity-70"
              value={campaign?.merchant_stores?.store_name || campaign?.shopName || "Merchant Node"}
              readOnly
              disabled
            />
          </div>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
            <input
              type="text"
              className="input-premium pl-9 h-8 text-[10px] opacity-70"
              value={displayStoreAddress}
              readOnly
              disabled
            />
          </div>
        </div>

        {/* Campaign Details */}
        <div className="space-y-2">
          <input type="text" placeholder="Headline" className="input-premium h-8 text-[10px] px-3" value={dealTitle} onChange={(e) => setDealTitle(e.target.value)} required />
          <input type="text" placeholder="Incentive" className="input-premium h-8 text-[10px] px-3" value={dealOffer} onChange={(e) => setDealOffer(e.target.value)} required />
          <textarea placeholder="Description" className="input-premium h-16 pt-2 px-3 text-[10px] resize-none leading-tight" value={dealDescription} onChange={(e) => setDealDescription(e.target.value)} required />

          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
              <input type="date" className="input-premium pl-8 h-8 text-[9px]" value={dealStartDate} onChange={(e) => setDealStartDate(e.target.value)} required />
            </div>
            <div className="relative">
              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
              <input type="date" className="input-premium pl-8 h-8 text-[9px]" value={dealEndDate} onChange={(e) => setDealEndDate(e.target.value)} required />
            </div>
          </div>

          <select className="input-premium h-8 text-[10px] px-3" value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
            <option value="" disabled>Select Action</option>
            <option value="needs review">Needs Review</option>
            <option value="active">Approve</option>
          </select>

          {/* Comments field - only show when "Needs Review" is selected */}
          {selectedStatus === 'needs review' && (
            <div className="space-y-1 animate-reveal">
              <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 pl-1">
                Review Comments
              </label>
              <textarea
                className="input-premium h-20 text-[10px] px-3 py-2 resize-none"
                placeholder="Explain what needs to be reviewed or fixed"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
              />
              <p className="text-[8px] text-slate-500 pl-1">
                This feedback will be sent to the merchant
              </p>
            </div>
          )}
        </div>

        <button type="submit" disabled={loading || isTranslating} className="w-full btn-premium h-12 rounded-xl shadow-lg shadow-indigo-500/20">
          {loading || isTranslating ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : <span className="text-sm">Sync Changes</span>}
        </button>
      </form>

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[600] bg-black/90 backdrop-blur-sm flex items-center justify-center animate-reveal">
          <div className="text-center">
            <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto mb-3" />
            <h3 className="text-white font-black uppercase text-base">Database Updated</h3>
          </div>
        </div>
      )}
    </div>
  );
};