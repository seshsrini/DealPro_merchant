import React, { useRef, useEffect, useState } from 'react';
import { ImageIcon, Upload, Check, X, Loader2 } from 'lucide-react';
import { floatIn } from './floatIn';
import { addCampaignService } from '../../services/addCampaignService';

interface StepImageProps {
  selectedFile: File | null;
  existingThumbnail: string | null;
  imageLibrary: { url: string; name?: string }[];
  isLibraryLoading: boolean;
  onFileSelected: (file: File | null) => void;
  onExistingSelected: (url: string, name: string | null) => void;
  onNext: () => void;
  onBack: () => void;
  theme: 'light' | 'dark';
}

export const StepImage: React.FC<StepImageProps> = ({
  selectedFile, existingThumbnail, imageLibrary, isLibraryLoading,
  onFileSelected, onExistingSelected, onNext, onBack, theme,
}) => {
  const isDark = theme === 'dark';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [visible, setVisible] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [moderationError, setModerationError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  // Generate preview for selected file
  useEffect(() => {
    if (selectedFile) {
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreviewUrl(null);
  }, [selectedFile]);

  const hasImage = !!selectedFile || !!existingThumbnail;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelected(file);
      setModerationError(null);
    }
  };

  const handleContinue = async () => {
    // Only moderate newly uploaded files (existing library images were already approved)
    if (selectedFile) {
      setChecking(true);
      setModerationError(null);
      try {
        const result = await addCampaignService.moderateImage(selectedFile);
        if (result.flagged) {
          setModerationError(result.reason || 'This image contains inappropriate content. Please choose a different image.');
          // Clear the flagged image
          onFileSelected(null);
          onExistingSelected('', null);
          if (fileInputRef.current) fileInputRef.current.value = '';
          setChecking(false);
          return;
        }
      } catch {
        setModerationError('Unable to verify image. Please try again.');
        onFileSelected(null);
        onExistingSelected('', null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setChecking(false);
        return;
      } finally {
        setChecking(false);
      }
    }
    onNext();
  };

  const handleLibrarySelect = (url: string, name?: string) => {
    onFileSelected(null); // Clear any uploaded file
    onExistingSelected(url, name || null);
  };

  const handleClearImage = () => {
    onFileSelected(null);
    onExistingSelected('', null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const displayUrl = previewUrl || existingThumbnail;

  return (
    <div className="flex flex-col min-h-full px-6 pt-6">
      <div style={floatIn(0, visible)} className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
        <ImageIcon className="w-8 h-8 text-blue-500" />
      </div>
      <h2 style={floatIn(100, visible)} className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
        Choose a campaign image
      </h2>
      <p style={floatIn(200, visible)} className={`text-sm mb-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        Select from your library or upload a new one.
      </p>

      {/* Current selection preview */}
      {displayUrl && (
        <div style={floatIn(250, visible)} className="relative mb-5">
          <img
            src={displayUrl}
            alt="Selected"
            className="w-full h-48 object-cover rounded-xl"
          />
          <button
            onClick={handleClearImage}
            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      )}

      {/* Image library */}
      {imageLibrary.length > 0 && (
        <div style={floatIn(300, visible)} className="mb-5">
          <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            Your images
          </p>
          <div className="grid grid-cols-3 gap-2 max-h-44 overflow-y-auto">
            {imageLibrary.map((img, i) => {
              const isSelected = existingThumbnail === img.url && !selectedFile;
              return (
                <button
                  key={img.url + i}
                  onClick={() => handleLibrarySelect(img.url, img.name)}
                  className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                    isSelected
                      ? 'border-blue-500 ring-2 ring-blue-500/30'
                      : isDark ? 'border-slate-700' : 'border-slate-200'
                  }`}
                >
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                  {isSelected && (
                    <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                      <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 text-white" />
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {isLibraryLoading && (
        <div style={floatIn(300, visible)} className="mb-5">
          <div className={`h-24 rounded-xl animate-pulse ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`} />
        </div>
      )}

      {/* Upload new */}
      <div style={floatIn(400, visible)}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className={`w-full h-14 rounded-xl border-2 border-dashed flex items-center justify-center gap-3 transition-all active:scale-[0.98] ${
            isDark
              ? 'border-slate-700 hover:border-slate-500 text-slate-300'
              : 'border-slate-300 hover:border-slate-400 text-slate-600'
          }`}
        >
          <Upload className="w-5 h-5" />
          <span className="text-sm font-semibold">Upload new image</span>
        </button>
      </div>

      {/* Moderation error */}
      {moderationError && (
        <div style={floatIn(0, true)} className={`mt-4 p-3 rounded-xl ${isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'}`}>
          <p className={`text-xs ${isDark ? 'text-red-400' : 'text-red-600'}`}>{moderationError}</p>
        </div>
      )}

      <div style={floatIn(500, visible)} className="mt-auto pb-8 flex gap-3">
        <button
          onClick={onBack}
          className={`flex-1 h-14 rounded-xl text-base font-semibold active:scale-[0.98] transition-all ${
            isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
          }`}
        >
          Back
        </button>
        <button
          onClick={handleContinue}
          disabled={!hasImage || checking}
          className="flex-[2] h-14 rounded-xl bg-slate-900 text-white text-base font-semibold active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {checking ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Continue'}
        </button>
      </div>
    </div>
  );
};
