import React, { useState, useEffect } from 'react';
import { User } from './types';
import { hoardingService, Hoarding } from './services/hoardingService';
import { bannerService } from './services/bannerService';
import { Loader2, Upload, Image as ImageIcon, Save, AlertTriangle, CheckCircle2 } from 'lucide-react';

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

  const inputClass = `w-full h-11 px-3 rounded-lg text-sm outline-none transition-all ${
    isDark
      ? 'bg-slate-800 text-white placeholder-slate-500 border border-slate-700 focus:border-slate-500'
      : 'bg-white text-slate-900 placeholder-slate-400 border border-slate-200 focus:border-slate-400'
  }`;

  // Fetch all hoardings on mount
  useEffect(() => {
    const fetchHoardings = async () => {
      setLoading(true);
      const { data, error } = await hoardingService.getAllHoardings();
      if (data && data.length > 0) {
        console.log('[DealAdminBanners] Loaded hoardings:', data);
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
        setFormData({ topic: '', heading: '', description: '', images: [] });
        return;
      }

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
          setFormData({
            topic: hoarding.topic || '',
            heading: hoarding.heading || '',
            description: hoarding.description || '',
            images: hoarding.images || []
          });
        } else {
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

          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

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

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please upload an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Image size must be less than 5MB');
      return;
    }

    setUploading(true);
    setErrorMessage(null);

    try {
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
      await bannerService.updateBanner(selectedHoardingNo, {
        topic: formData.topic,
        heading: formData.heading,
        description: formData.description,
        images: formData.images
      });

      setSuccessMessage('Banner updated successfully!');

      const { data } = await hoardingService.getAllHoardings();
      if (data) {
        setHoardings(data);
      }

      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      console.error('[DealAdminBanners] Update error:', err);
      setErrorMessage(err.message || 'Failed to update banner');
    } finally {
      setSaving(false);
    }
  };

  if (loading && selectedHoardingNo === null && hoardings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
        <p className={`text-xs font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Loading banners...</p>
      </div>
    );
  }

  return (
    <div className={`px-4 pt-4 pb-28 space-y-4 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Banner Management</h2>
          <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Update promotional banners</p>
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? 'bg-amber-500/10' : 'bg-amber-50'}`}>
          <ImageIcon className="w-4 h-4 text-amber-500" />
        </div>
      </div>

      {/* Banner Selection Dropdown */}
      <div className="space-y-1.5">
        <label className={`text-xs font-medium pl-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Select Banner</label>
        <select
          value={selectedHoardingNo ?? ''}
          onChange={(e) => {
            const value = e.target.value ? Number(e.target.value) : null;
            setSelectedHoardingNo(value);
          }}
          className={inputClass}
        >
          <option value="">-- Select a banner --</option>
          {hoardings.map((hoarding) => (
            <option key={hoarding.id} value={hoarding.hoarding_no}>
              Banner {hoarding.hoarding_no}: {hoarding.topic}
            </option>
          ))}
        </select>
      </div>

      {/* Form - Only show when a banner is selected */}
      {selectedHoardingNo !== null && (
        <div className="space-y-4">
          {loading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
            </div>
          )}

          {!loading && (
            <>
              {/* Topic Field */}
              <div className="space-y-1.5">
                <label className={`text-xs font-medium pl-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Topic</label>
                <input
                  type="text"
                  value={formData.topic}
                  onChange={(e) => setFormData(prev => ({ ...prev, topic: e.target.value }))}
                  placeholder="e.g., Support Local. Save Big."
                  className={inputClass}
                />
              </div>

              {/* Heading Field */}
              <div className="space-y-1.5">
                <label className={`text-xs font-medium pl-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Heading</label>
                <input
                  type="text"
                  value={formData.heading}
                  onChange={(e) => setFormData(prev => ({ ...prev, heading: e.target.value }))}
                  placeholder="e.g., Hyper-local Discovery"
                  className={inputClass}
                />
              </div>

              {/* Description Field */}
              <div className="space-y-1.5">
                <label className={`text-xs font-medium pl-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter banner description..."
                  rows={4}
                  className={`${inputClass} h-auto pt-2 resize-none`}
                />
              </div>

              {/* Image Upload */}
              <div className="space-y-2">
                <label className={`text-xs font-medium pl-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Banner Image</label>

                {/* Current Image Preview */}
                {formData.images.length > 0 && (
                  <div className={`relative w-full aspect-video rounded-xl overflow-hidden border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
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
                  <div className={`w-full h-11 rounded-lg border flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] ${
                    isDark
                      ? 'bg-slate-800 border-slate-700 hover:border-slate-600'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}>
                    {uploading ? (
                      <>
                        <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                        <span className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 text-blue-500" />
                        <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-700'}`}>
                          {formData.images.length > 0 ? 'Change Image' : 'Upload Image'}
                        </span>
                      </>
                    )}
                  </div>
                </label>
                <p className={`text-[10px] pl-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Max size: 5MB. Supported: JPG, PNG, GIF</p>
              </div>

              {/* Error Message */}
              {errorMessage && (
                <div className={`p-3 rounded-lg flex items-center gap-2 ${isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'}`}>
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                  <span className="text-xs font-medium text-red-500">{errorMessage}</span>
                </div>
              )}

              {/* Success Message */}
              {successMessage && (
                <div className={`p-3 rounded-lg flex items-center gap-2 ${isDark ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-emerald-50 border border-emerald-200'}`}>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="text-xs font-medium text-emerald-500">{successMessage}</span>
                </div>
              )}

              {/* Update Button */}
              <button
                onClick={handleUpdate}
                disabled={saving || uploading}
                className="w-full h-12 rounded-xl bg-slate-900 text-white text-sm font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Update Banner</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      )}

      {/* Empty State */}
      {selectedHoardingNo === null && (
        <div className={`text-center py-12 rounded-xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className={`w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-4 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
            <ImageIcon className={`w-8 h-8 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
          </div>
          <p className={`text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            Select a banner to edit
          </p>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Choose a banner from the dropdown above
          </p>
        </div>
      )}
    </div>
  );
};
