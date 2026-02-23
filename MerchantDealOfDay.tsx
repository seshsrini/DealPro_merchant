
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
  FileText,
  ArrowLeft
} from 'lucide-react';
import { ImageUpload } from './components/ImageUpload';
import { RichTextEditor } from './components/RichTextEditor';

interface MerchantDealOfDayProps {
  user: any;
  setView: (view: AppView) => void;
  theme?: 'light' | 'dark';
}

const DEFAULT_DEAL_IMAGE = 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=600&q=80';

export const MerchantDealOfDay: React.FC<MerchantDealOfDayProps> = ({ user, setView, theme = 'light' }) => {
  const { t } = useTranslation();
  const isDark = theme === 'dark';
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

  const inputClass = `w-full h-11 px-4 rounded-lg text-sm font-medium border outline-none transition-all ${
    isDark
      ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-slate-500'
      : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-slate-400'
  }`;

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
    <div className={`min-h-screen px-5 pb-32 pt-6 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => setView('merchant_dashboard')} className={`w-9 h-9 rounded-lg flex items-center justify-center active:scale-[0.95] transition-all ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
            <ArrowLeft className={`w-5 h-5 ${isDark ? 'text-white' : 'text-slate-700'}`} />
          </button>
          <div className="flex items-center gap-2.5 flex-1">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? 'bg-yellow-500/10' : 'bg-yellow-50'}`}>
              <Zap className="w-5 h-5 text-yellow-500" />
            </div>
            <div>
              <h1 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Deal of the Day
              </h1>
              <p className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Feature your best offer</p>
            </div>
          </div>
        </div>

        <div className={`p-4 rounded-xl border ${isDark ? 'bg-yellow-500/5 border-yellow-500/10' : 'bg-yellow-50 border-yellow-100'}`}>
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
            <div>
              <p className={`text-sm font-semibold ${isDark ? 'text-yellow-400' : 'text-yellow-700'}`}>Deal of the Day Benefits</p>
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Your campaign will be prominently featured to consumers searching for today's best deals!
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Store Selection */}
        <div className="space-y-1.5">
          <label className={`text-xs font-medium px-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Select Store Location</label>
          <select
            value={selectedStoreId}
            onChange={(e) => setSelectedStoreId(e.target.value)}
            className={inputClass}
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
            <div className={`mt-2 p-3 rounded-lg border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
              <p className={`text-xs font-medium mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Store Address</p>
              <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                {selectedStore.address}
                {selectedStore.landmark && `, ${selectedStore.landmark}`}
                {selectedStore.city && `, ${selectedStore.city}`}
                {selectedStore.state && `, ${selectedStore.state}`}
              </p>
            </div>
          )}
        </div>

        {/* Image Upload */}
        <div className="space-y-1.5">
          <label className={`text-xs font-medium px-1 flex items-center gap-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            <Tag className="w-3 h-3" />
            Campaign Image
          </label>
          <ImageUpload
            onImageSelected={handleImageSelect}
            previewUrl={imagePreview || undefined}
          />
        </div>

        {/* Campaign Title */}
        <div className="space-y-1.5">
          <label className={`text-xs font-medium px-1 flex items-center gap-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            <FileText className="w-3 h-3" />
            Campaign Title
          </label>
          <input
            type="text"
            placeholder="e.g., Flash Sale: 50% Off Everything!"
            className={inputClass}
            value={dealTitle}
            onChange={(e) => setDealTitle(e.target.value.slice(0, 100))}
            maxLength={100}
            required
          />
        </div>

        {/* Offer Value */}
        <div className="space-y-1.5">
          <label className={`text-xs font-medium px-1 flex items-center gap-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            <Tag className="w-3 h-3" />
            Offer Details
          </label>
          <input
            type="text"
            placeholder="e.g., Buy 1 Get 1 Free, 30% Off, ₹500 Cashback"
            className={inputClass}
            value={dealOffer}
            onChange={(e) => setDealOffer(e.target.value.slice(0, 50))}
            maxLength={50}
            required
          />
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className={`text-xs font-medium px-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Campaign Description</label>
          <RichTextEditor
            value={dealDescription}
            onChange={setDealDescription}
            placeholder="Describe your amazing deal! Use bullet points and emojis to make it stand out."
            maxLength={400}
          />
        </div>

        {/* Single Date Picker - Deal Live On */}
        <div className="space-y-1.5">
          <label className={`text-xs font-medium px-1 flex items-center gap-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            <Calendar className="w-3 h-3" />
            Deal Live On
          </label>
          <div className="space-y-1.5">
            <input
              type="date"
              className={inputClass}
              value={dealLiveDate}
              onChange={(e) => setDealLiveDate(e.target.value)}
              min={minDealDate}
              required
            />
            <p className={`text-xs px-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Deal can be scheduled from {new Date(minDealDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} onwards (minimum 2 days advance notice)
            </p>
          </div>
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div className={`p-3 rounded-lg border flex items-start gap-3 ${isDark ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-200'}`}>
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <p className={`text-sm ${isDark ? 'text-red-300' : 'text-red-600'}`}>{errorMessage}</p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting || merchantStores.length === 0}
          className="w-full h-12 rounded-xl bg-slate-900 text-white font-medium text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Creating Campaign...
            </>
          ) : (
            <>
              <Zap className="w-5 h-5" />
              Create Deal of the Day
            </>
          )}
        </button>
      </form>

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[500] bg-black/50 flex items-center justify-center p-6">
          <div className={`w-full max-w-sm p-8 rounded-xl border text-center ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className={`w-16 h-16 mx-auto rounded-xl flex items-center justify-center mb-4 ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
            <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Deal of the Day Created!
            </h3>
            <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
              Your campaign will be featured once approved by admin.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
