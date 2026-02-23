
import React, { useState, useEffect } from 'react';
import { User, MerchantStore } from './types';
import { addCampaignService } from './services/addCampaignService';
import { merchantService } from './services/merchantService';
import { useTranslation } from './contexts/LanguageContext';
import {
  Loader2,
  CheckCircle2,
  Edit2,
  AlertTriangle,
  Store,
  MapPin,
  Calendar,
  ArrowLeft
} from 'lucide-react';
import { ImageUpload } from './components/ImageUpload';

interface DealAdminEditCampaignProps {
  user: User;
  campaignIdToEdit: string;
  onCloseEdit: () => void;
  refreshAdminDeals: () => Promise<void>;
  setLoading: (loading: boolean) => void;
  loading: boolean;
  theme: 'light' | 'dark';
}

const getFileNameFromUrl = (url: string | null): string | null => {
  if (!url) return null;
  try {
    const urlObj = new URL(url);
    return urlObj.pathname.split('/').pop() || null;
  } catch { return null; }
};

export const DealAdminEditCampaign: React.FC<DealAdminEditCampaignProps> = ({
  user, campaignIdToEdit, onCloseEdit, refreshAdminDeals, setLoading, loading, theme
}) => {
  const { t } = useTranslation();
  const isDark = theme === 'dark';
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const inputClass = `w-full h-11 px-3 rounded-lg text-sm outline-none transition-all ${
    isDark
      ? 'bg-slate-800 text-white placeholder-slate-500 border border-slate-700 focus:border-slate-500'
      : 'bg-white text-slate-900 placeholder-slate-400 border border-slate-200 focus:border-slate-400'
  }`;

  const [campaign, setCampaign] = useState<any | null>(null);
  const [dealTitle, setDealTitle] = useState('');
  const [dealOffer, setDealOffer] = useState('');
  const [dealDescription, setDealDescription] = useState('');
  const [dealStartDate, setDealStartDate] = useState(tomorrow);
  const [dealEndDate, setDealEndDate] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [comments, setComments] = useState<string>('');
  const [merchantStores, setMerchantStores] = useState<MerchantStore[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [displayStoreAddress, setDisplayStoreAddress] = useState('');
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [existingThumbnail, setExistingThumbnail] = useState<string | null>(null);
  const [existingImageName, setExistingImageName] = useState<string | null>(null);
  const [imageLibrary, setImageLibrary] = useState<{url: string, name?: string}[]>([]);
  const [isLibraryLoading, setIsLibraryLoading] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCampaignDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await addCampaignService.getCampaignDetails(campaignIdToEdit);
        setCampaign(data);
        setDealTitle(data.deal_heading || '');
        setDealOffer(data.offerValue || '');
        setDealDescription(data.longDescription || '');
        setDealStartDate(data.start_date || tomorrow);
        setDealEndDate(data.end_date || '');
        setComments(data.comments || '');
        setSelectedStoreId(data.store_id || '');
        const img = data.thumbnail;
        setExistingThumbnail(img || null);
        setExistingImageName(data.image_name || getFileNameFromUrl(img) || null);
        const address = data.merchant_stores?.address || (data as any).address;
        const city = data.merchant_stores?.city || (data as any).city;
        setDisplayStoreAddress(address ? `${address}${city ? `, ${city}` : ''}` : "Address not assigned");
      } catch (e: any) {
        setError(e.message || "Failed to load campaign.");
      } finally {
        setLoading(false);
      }
    };
    fetchCampaignDetails();
  }, [campaignIdToEdit, setLoading, tomorrow]);

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
        if (results[0].status === 'fulfilled') setMerchantStores(results[0].value);
        if (results[1].status === 'fulfilled') setImageLibrary(results[1].value);
      } catch { console.warn("Background asset fetch failed."); }
      finally { setIsLibraryLoading(false); }
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
      const payload: any = {
        merchant_id: campaign.merchant_id, shop_name: campaign.shopName,
        deal_heading: dealTitle, offer_value: dealOffer, category: campaign.category,
        long_description: dealDescription, start_date: dealStartDate, end_date: dealEndDate,
        store_id: selectedStoreId, image_url: imageUrl, image_name: imageName,
        latlong: campaign.latlong, status: selectedStatus, comments: comments,
      };
      const hasContentChanged = dealTitle !== campaign.deal_heading || dealOffer !== campaign.offerValue || dealDescription !== campaign.longDescription;
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
      setTimeout(() => { setShowSuccessModal(false); onCloseEdit(); }, 1500);
    } catch (e: any) {
      setError(e.message || "Update failed.");
    } finally { setLoading(false); }
  };

  if (loading && !campaign) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
        <p className={`text-xs font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Loading campaign...</p>
      </div>
    );
  }

  return (
    <div className={`px-4 pt-4 pb-28 space-y-4 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={onCloseEdit} className={`w-10 h-10 rounded-lg border flex items-center justify-center active:scale-90 transition-all ${isDark ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-white border-slate-200 text-slate-500'}`}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Edit Campaign</h2>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
          <Edit2 className="w-4 h-4 text-blue-500" />
        </div>
      </div>

      {error && (
        <div className={`p-3 rounded-lg flex items-center gap-2 ${isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'}`}>
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
          <span className="text-xs font-medium text-red-500">{error}</span>
        </div>
      )}

      <form onSubmit={handleUpdateCampaign} className="space-y-4">
        <div className="space-y-2">
          <ImageUpload
            onImageSelected={(file) => { setSelectedImageFile(file); if (file) setExistingThumbnail(null); }}
            previewUrl={selectedImageFile ? URL.createObjectURL(selectedImageFile) : existingThumbnail || undefined}
          />
          {isLibraryLoading ? (
            <div className="flex items-center justify-center p-3"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
          ) : imageLibrary.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto pb-1.5">
              {imageLibrary.map((img, i) => (
                <button key={i} type="button" onClick={() => { setExistingThumbnail(img.url); setSelectedImageFile(null); }} className={`shrink-0 w-12 h-12 rounded-lg border-2 transition-all ${existingThumbnail === img.url ? 'border-blue-500 scale-105' : 'border-transparent opacity-50'}`}>
                  <img src={img.url} className="w-full h-full object-cover rounded-md" alt="" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="relative">
            <Store className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            <input type="text" className={`${inputClass} pl-9 opacity-60`} value={campaign?.merchant_stores?.store_name || campaign?.shopName || "Store"} readOnly disabled />
          </div>
          <div className="relative">
            <MapPin className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            <input type="text" className={`${inputClass} pl-9 opacity-60`} value={displayStoreAddress} readOnly disabled />
          </div>
        </div>

        <div className="space-y-2">
          <input type="text" placeholder="Headline" className={inputClass} value={dealTitle} onChange={(e) => setDealTitle(e.target.value)} required />
          <input type="text" placeholder="Incentive" className={inputClass} value={dealOffer} onChange={(e) => setDealOffer(e.target.value)} required />
          <textarea placeholder="Description" className={`${inputClass} h-20 pt-2 resize-none`} value={dealDescription} onChange={(e) => setDealDescription(e.target.value)} required />
          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <Calendar className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
              <input type="date" className={`${inputClass} pl-9 text-xs`} value={dealStartDate} onChange={(e) => setDealStartDate(e.target.value)} required />
            </div>
            <div className="relative">
              <Calendar className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
              <input type="date" className={`${inputClass} pl-9 text-xs`} value={dealEndDate} onChange={(e) => setDealEndDate(e.target.value)} required />
            </div>
          </div>
          <select className={inputClass} value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
            <option value="" disabled>Select Action</option>
            <option value="needs review">Needs Review</option>
            <option value="active">Approve</option>
          </select>
          {selectedStatus === 'needs review' && (
            <div className="space-y-1.5">
              <label className={`text-xs font-medium pl-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Review Comments</label>
              <textarea className={`${inputClass} h-20 pt-2 resize-none`} placeholder="Explain what needs to be reviewed or fixed" value={comments} onChange={(e) => setComments(e.target.value)} />
              <p className={`text-[10px] pl-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>This feedback will be sent to the merchant</p>
            </div>
          )}
        </div>

        <button type="submit" disabled={loading || isTranslating} className="w-full h-12 rounded-xl bg-slate-900 text-white text-sm font-medium flex items-center justify-center active:scale-[0.98] transition-all disabled:opacity-50">
          {loading || isTranslating ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save Changes"}
        </button>
      </form>

      {showSuccessModal && (
        <div className="fixed inset-0 z-[600] bg-black/50 flex items-center justify-center">
          <div className={`rounded-xl p-6 text-center ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Campaign Updated</h3>
          </div>
        </div>
      )}
    </div>
  );
};
