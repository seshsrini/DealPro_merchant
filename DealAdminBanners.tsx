import React, { useState, useEffect } from 'react';
import { User } from './types';
import { hoardingService, Hoarding } from './services/hoardingService';
import { bannerService } from './services/bannerService';
import { Loader2, Upload, Image as ImageIcon, Save } from 'lucide-react';

interface DealAdminBannersProps {
  user: User;
  theme: 'light' | 'dark';
}

export const DealAdminBanners: React.FC<DealAdminBannersProps> = ({ user, theme }) => {
  const [hoardings, setHoardings] = useState<Hoarding[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedHoardingNo, setSelectedHoardingNo] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    topic: '',
    heading: '',
    description: '',
    images: [] as string[]
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isDark = theme === 'dark';

  // Fetch all hoardings on mount
  useEffect(() => {
    const fetchHoardings = async () => {
      setLoading(true);
      const { data, error } = await hoardingService.getAllHoardings();
      if (data && data.length > 0) {
        console.log('[DealAdminBanners] Loaded hoardings:', data);
        console.log('[DealAdminBanners] First hoarding details:', {
          hoarding_no: data[0].hoarding_no,
          topic: data[0].topic,
          heading: data[0].heading,
          description: data[0].description,
          images: data[0].images
        });
        setHoardings(data);
      } else {
        console.error('[DealAdminBanners] Error loading hoardings:', error);
        setErrorMessage('Failed to load banners');
      }
      setLoading(false);
    };
    fetchHoardings();
  }, []);

  // Fetch specific banner when selected
  useEffect(() => {
    const fetchBanner = async () => {
      if (selectedHoardingNo === null) {
        console.log('[DealAdminBanners] Clearing form data');
        setFormData({ topic: '', heading: '', description: '', images: [] });
        return;
      }

      console.log('[DealAdminBanners] Fetching banner:', selectedHoardingNo);
      setLoading(true);

      try {
        const { data: hoarding, error } = await hoardingService.getHoardingByNumber(selectedHoardingNo);

        if (error) {
          console.error('[DealAdminBanners] Error fetching banner:', error);
          setErrorMessage(`Failed to load banner ${selectedHoardingNo}`);
          setLoading(false);
          return;
        }

        if (hoarding) {
          console.log('[DealAdminBanners] Fetched hoarding:', hoarding);
          const newFormData = {
            topic: hoarding.topic || '',
            heading: hoarding.heading || '',
            description: hoarding.description || '',
            images: hoarding.images || []
          };
          console.log('[DealAdminBanners] Setting form data:', newFormData);
          setFormData(newFormData);
        } else {
          console.warn('[DealAdminBanners] No hoarding found for number:', selectedHoardingNo);
          setErrorMessage(`Banner ${selectedHoardingNo} not found`);
        }
      } catch (err: any) {
        console.error('[DealAdminBanners] Exception fetching banner:', err);
        setErrorMessage(err.message || 'Failed to fetch banner');
      } finally {
        setLoading(false);
      }
    };

    fetchBanner();
  }, [selectedHoardingNo]);

  const compressImage = (file: File, maxWidth: number = 1200, quality: number = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Resize if image is larger than maxWidth
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          // Convert to base64 with compression
          const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedBase64);
        };
        img.onerror = () => reject(new Error('Failed to load image'));
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please upload an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Image size must be less than 5MB');
      return;
    }

    setUploading(true);
    setErrorMessage(null);

    try {
      // Compress image before storing
      const compressedBase64 = await compressImage(file, 1200, 0.7);
      setFormData(prev => ({
        ...prev,
        images: [compressedBase64]
      }));
      setUploading(false);
    } catch (err: any) {
      console.error('[DealAdminBanners] Image upload error:', err);
      setErrorMessage(err.message || 'Failed to upload image');
      setUploading(false);
    }
  };

  const handleUpdate = async () => {
    if (selectedHoardingNo === null) {
      setErrorMessage('Please select a banner to update');
      return;
    }

    if (!formData.topic.trim() || !formData.heading.trim() || !formData.description.trim()) {
      setErrorMessage('Please fill in all fields');
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      console.log('[DealAdminBanners] Updating banner:', selectedHoardingNo, formData);

      await bannerService.updateBanner(selectedHoardingNo, {
        topic: formData.topic,
        heading: formData.heading,
        description: formData.description,
        images: formData.images
      });

      setSuccessMessage('Banner updated successfully!');

      // Refresh hoardings list
      const { data } = await hoardingService.getAllHoardings();
      if (data) {
        setHoardings(data);
      }

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      console.error('[DealAdminBanners] Update error:', err);
      setErrorMessage(err.message || 'Failed to update banner');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="px-6 pt-6 pb-32 animate-reveal">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-black uppercase tracking-tighter leading-none text-white">
          Banner<br />
          <span className="text-yellow-500">Management</span>
        </h2>
        <div className="flex items-center gap-2 mt-2">
          <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
          <p className="text-[10px] font-black text-yellow-600 uppercase tracking-[0.3em]">ADMIN CONTROLS</p>
        </div>
      </div>

      {/* Banner Selection Dropdown */}
      <div className="mb-6">
        <label className="block text-sm font-black uppercase tracking-widest text-slate-300 mb-3">
          Select Banner
        </label>
        <select
          value={selectedHoardingNo ?? ''}
          onChange={(e) => {
            const value = e.target.value ? Number(e.target.value) : null;
            console.log('[DealAdminBanners] Dropdown changed to:', value);
            setSelectedHoardingNo(value);
          }}
          className="w-full h-14 px-4 glass rounded-2xl text-white text-sm font-medium outline-none border border-white/10 focus:border-blue-500/50 transition-all"
        >
          <option value="" className="bg-slate-900 text-slate-400">
            -- Select a banner --
          </option>
          {hoardings.map((hoarding) => (
            <option key={hoarding.id} value={hoarding.hoarding_no} className="bg-slate-900 text-white">
              Banner {hoarding.hoarding_no}: {hoarding.topic}
            </option>
          ))}
        </select>
      </div>

      {/* Form - Only show when a banner is selected */}
      {selectedHoardingNo !== null && (
        <div className="space-y-6">
          {/* Topic Field */}
          <div>
            <label className="block text-sm font-black uppercase tracking-widest text-slate-300 mb-3">
              Topic
            </label>
            <input
              type="text"
              value={formData.topic}
              onChange={(e) => setFormData(prev => ({ ...prev, topic: e.target.value }))}
              placeholder="e.g., SUPPORT LOCAL. SAVE BIG."
              className="w-full h-14 px-4 glass rounded-2xl text-white text-sm font-medium outline-none border border-white/10 focus:border-blue-500/50 transition-all"
            />
          </div>

          {/* Heading Field */}
          <div>
            <label className="block text-sm font-black uppercase tracking-widest text-slate-300 mb-3">
              Heading
            </label>
            <input
              type="text"
              value={formData.heading}
              onChange={(e) => setFormData(prev => ({ ...prev, heading: e.target.value }))}
              placeholder="e.g., Hyper-local Discovery"
              className="w-full h-14 px-4 glass rounded-2xl text-white text-sm font-medium outline-none border border-white/10 focus:border-blue-500/50 transition-all"
            />
          </div>

          {/* Description Field */}
          <div>
            <label className="block text-sm font-black uppercase tracking-widest text-slate-300 mb-3">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Enter banner description..."
              rows={4}
              className="w-full px-4 py-3 glass rounded-2xl text-white text-sm font-medium outline-none border border-white/10 focus:border-blue-500/50 transition-all resize-none"
            />
          </div>

          {/* Image Upload */}
          <div>
            <label className="block text-sm font-black uppercase tracking-widest text-slate-300 mb-3">
              Banner Image
            </label>

            {/* Current Image Preview */}
            {formData.images.length > 0 && (
              <div className="mb-4 relative w-full aspect-video rounded-2xl overflow-hidden border-2 border-white/10">
                <img
                  src={formData.images[0]}
                  alt="Banner preview"
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Upload Button */}
            <label className="relative block">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={uploading}
                className="hidden"
              />
              <div className="w-full h-14 px-4 glass rounded-2xl border border-white/10 flex items-center justify-center gap-3 cursor-pointer hover:border-blue-500/50 transition-all active:scale-95">
                {uploading ? (
                  <>
                    <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                    <span className="text-sm font-black uppercase tracking-wider text-slate-400">Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5 text-blue-500" />
                    <span className="text-sm font-black uppercase tracking-wider text-white">
                      {formData.images.length > 0 ? 'Change Image' : 'Upload Image'}
                    </span>
                  </>
                )}
              </div>
            </label>
            <p className="text-xs text-slate-500 mt-2">Max size: 5MB. Supported: JPG, PNG, GIF</p>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20">
              <p className="text-sm font-bold text-red-400">{errorMessage}</p>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-sm font-bold text-emerald-400">{successMessage}</p>
            </div>
          )}

          {/* Update Button */}
          <button
            onClick={handleUpdate}
            disabled={saving || uploading}
            className="w-full h-16 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-sm uppercase tracking-wider shadow-lg flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Updating...</span>
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                <span>Update Banner</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Empty State */}
      {selectedHoardingNo === null && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-24 h-24 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mb-6">
            <ImageIcon className="w-12 h-12 text-slate-600" />
          </div>
          <p className="text-lg font-black text-slate-400 uppercase tracking-wider">
            Select a banner to edit
          </p>
          <p className="text-sm text-slate-600 mt-2">
            Choose a banner from the dropdown above
          </p>
        </div>
      )}
    </div>
  );
};
