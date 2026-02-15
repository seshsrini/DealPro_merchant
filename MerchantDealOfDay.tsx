
import React, { useState, useEffect } from 'react';
import { AppView, MerchantStore } from './types';
import { dealOfDayService } from './services/dealOfDayService';
import { addCampaignService } from './services/addCampaignService';
import { merchantService } from './services/merchantService';
import { useTranslation } from './contexts/LanguageContext';
import {
  Zap,
  Loader2,
  CheckCircle2,
  X,
  Sparkles,
  AlertCircle,
  Calendar,
  Tag,
  FileText
} from 'lucide-react';
import { ImageUpload } from './components/ImageUpload';
import { RichTextEditor } from './components/RichTextEditor';

interface MerchantDealOfDayProps {
  user: any;
  setView: (view: AppView) => void;
}

const DEFAULT_DEAL_IMAGE = 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=600&q=80';

export const MerchantDealOfDay: React.FC<MerchantDealOfDayProps> = ({ user, setView }) => {
  const { t } = useTranslation();
  // Deal should be selectable from 2 days after today
  const minDealDate = new Date(Date.now() + 172800000).toISOString().split('T')[0]; // +2 days

  const [dealTitle, setDealTitle] = useState('');
  const [dealOffer, setDealOffer] = useState('');
  const [dealLiveDate, setDealLiveDate] = useState('');
  const [dealDescription, setDealDescription] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [merchantStores, setMerchantStores] = useState<MerchantStore[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Get the selected store details
  const selectedStore = merchantStores.find(store => store.id === selectedStoreId);

  // Load merchant stores
  useEffect(() => {
    const loadStores = async () => {
      try {
        const stores = await merchantService.getMerchantStores(user.id);
        setMerchantStores(stores);
        if (stores.length > 0) {
          setSelectedStoreId(stores[0].id || '');
        }
      } catch (error) {
        console.error('Failed to load stores:', error);
      }
    };
    if (user?.id) {
      loadStores();
    }
  }, [user?.id]);

  const handleImageSelect = (file: File | null) => {
    setSelectedImageFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setImagePreview(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      if (!selectedStoreId) {
        throw new Error('Please select a store');
      }

      // Upload image first if selected
      let imageUrl = null;
      let imageName = null;
      if (selectedImageFile) {
        const uploadResult = await dealOfDayService.uploadDealImage(user.id, selectedImageFile);
        imageUrl = uploadResult.publicUrl;
        imageName = uploadResult.imageName;
      }

      // Image is required for campaigns
      if (!imageUrl || !imageName) {
        throw new Error('Please select an image for your campaign');
      }

      // Get store latlong
      const store = merchantStores.find(s => s.id === selectedStoreId);
      const latlong = store ? `${store.latitude}, ${store.longitude}` : "0.0, 0.0";

      // Translate campaign data for multi-language support
      const translations = await addCampaignService.translateCampaignData(
        dealTitle,
        dealOffer,
        dealDescription,
        user.store_name
      );

      const campaignPayload = {
        shop_name: user.store_name,
        deal_heading: dealTitle,
        offer_value: dealOffer,
        category: user.category,
        start_date: dealLiveDate,
        end_date: dealLiveDate, // Same as start_date for single day deal
        long_description: dealDescription,
        store_id: selectedStoreId,
        image_url: imageUrl,
        image_name: imageName,
        latlong: latlong,
        localized_heading: translations.heading,
        localized_offer: translations.offer,
        localized_description: translations.description,
        localized_shop_name: translations.shop_name,
      };

      // Use dedicated Deal of Day service which ensures is_deal_of_the_day is TRUE
      await dealOfDayService.createDealOfDay(user.id, campaignPayload);

      setShowSuccessModal(true);

      // Reset form
      setTimeout(() => {
        setDealTitle('');
        setDealOffer('');
        setDealLiveDate('');
        setDealDescription('');
        setSelectedImageFile(null);
        setImagePreview(null);
        setShowSuccessModal(false);
      }, 2000);
    } catch (error: any) {
      console.error('Failed to create Deal of the Day:', error);
      setErrorMessage(error.message || 'Failed to create campaign. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen px-6 pb-32 pt-28">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center shadow-lg shadow-yellow-500/30">
            <Zap className="w-6 h-6 text-white fill-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-white">
              Create Deal of the Day
            </h1>
            <p className="text-xs text-slate-400 uppercase tracking-wider">Feature your best offer</p>
          </div>
        </div>

        <div className="p-4 bg-gradient-to-r from-yellow-500/10 to-amber-500/10 rounded-2xl border border-yellow-500/20">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-yellow-300">Deal of the Day Benefits</p>
              <p className="text-xs text-slate-300 mt-1">
                Your campaign will be prominently featured to consumers searching for today's best deals!
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Store Selection */}
        <div className="space-y-2">
          <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 px-1">Select Store Location</label>
          <select
            value={selectedStoreId}
            onChange={(e) => setSelectedStoreId(e.target.value)}
            className="input-premium"
            required
          >
            {merchantStores.length === 0 ? (
              <option value="">No stores available</option>
            ) : (
              merchantStores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.store_name} - {store.city}
                </option>
              ))
            )}
          </select>

          {/* Display selected store address */}
          {selectedStore && (
            <div className="mt-3 p-4 bg-slate-800/50 border border-slate-700/50 rounded-xl">
              <p className="text-[8px] font-bold uppercase tracking-wider text-slate-500 mb-2">Store Address</p>
              <p className="text-sm text-slate-300 leading-relaxed">
                {selectedStore.address}
                {selectedStore.landmark && `, ${selectedStore.landmark}`}
                {selectedStore.city && `, ${selectedStore.city}`}
                {selectedStore.state && `, ${selectedStore.state}`}
              </p>
            </div>
          )}
        </div>

        {/* Image Upload */}
        <div className="space-y-2">
          <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 px-1 flex items-center gap-2">
            <Tag className="w-3 h-3" />
            Campaign Image
          </label>
          <ImageUpload
            onImageSelected={handleImageSelect}
            previewUrl={imagePreview || undefined}
          />
        </div>

        {/* Campaign Title */}
        <div className="space-y-2">
          <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 px-1 flex items-center gap-2">
            <FileText className="w-3 h-3" />
            Campaign Title
          </label>
          <input
            type="text"
            placeholder="e.g., Flash Sale: 50% Off Everything!"
            className="input-premium"
            value={dealTitle}
            onChange={(e) => setDealTitle(e.target.value.slice(0, 100))}
            maxLength={100}
            required
          />
        </div>

        {/* Offer Value */}
        <div className="space-y-2">
          <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 px-1 flex items-center gap-2">
            <Tag className="w-3 h-3" />
            Offer Details
          </label>
          <input
            type="text"
            placeholder="e.g., Buy 1 Get 1 Free, 30% Off, ₹500 Cashback"
            className="input-premium"
            value={dealOffer}
            onChange={(e) => setDealOffer(e.target.value.slice(0, 50))}
            maxLength={50}
            required
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 px-1">Campaign Description</label>
          <RichTextEditor
            value={dealDescription}
            onChange={setDealDescription}
            placeholder="Describe your amazing deal! Use bullet points and emojis to make it stand out."
            maxLength={400}
          />
        </div>

        {/* Single Date Picker - Deal Live On */}
        <div className="space-y-2">
          <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400 px-1 flex items-center gap-2">
            <Calendar className="w-3 h-3" />
            Deal Live On
          </label>
          <div className="space-y-2">
            <input
              type="date"
              className="input-premium"
              value={dealLiveDate}
              onChange={(e) => setDealLiveDate(e.target.value)}
              min={minDealDate}
              required
            />
            <p className="text-[10px] text-slate-500 px-1">
              ℹ️ Deal can be scheduled from {new Date(minDealDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} onwards (minimum 2 days advance notice)
            </p>
          </div>
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <p className="text-sm text-rose-300">{errorMessage}</p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting || merchantStores.length === 0}
          className="w-full h-16 rounded-2xl bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-white font-black uppercase tracking-wider text-sm shadow-xl shadow-yellow-500/30 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Creating Campaign...
            </>
          ) : (
            <>
              <Zap className="w-5 h-5 fill-white" />
              Create Deal of the Day
            </>
          )}
        </button>
      </form>

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[500] bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-6 animate-reveal">
          <div className="w-full max-w-sm glass p-10 rounded-[4rem] border-2 border-emerald-500/40 relative text-center shadow-2xl shadow-emerald-500/20">
            <div className="absolute inset-0 rounded-[4rem] border-2 border-emerald-500/20 animate-ping"></div>

            <div className="relative mb-6">
              <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-emerald-500/30 to-green-500/30 flex items-center justify-center border-2 border-emerald-500/50 shadow-2xl mb-4">
                <CheckCircle2 className="w-10 h-10 text-emerald-400" />
              </div>
              <h3 className="text-xl font-black uppercase text-white leading-none mb-3 tracking-wide">
                Deal of the Day Created!
              </h3>
              <p className="text-sm text-slate-300">
                Your campaign will be featured once approved by admin.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
