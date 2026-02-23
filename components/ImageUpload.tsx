
import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, Loader2 } from 'lucide-react';

interface ImageUploadProps {
  onImageSelected: (file: File | null) => void;
  previewUrl?: string;
  theme?: 'light' | 'dark';
}

export const ImageUpload: React.FC<ImageUploadProps> = ({ onImageSelected, previewUrl, theme = 'dark' }) => {
  const [internalPreview, setInternalPreview] = useState<string | null>(previewUrl || null);
  const [isCompressing, setIsCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isDark = theme === 'dark';

  useEffect(() => {
    if (previewUrl) {
      setInternalPreview(previewUrl);
    }
  }, [previewUrl]);

  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              } else {
                resolve(file);
              }
            },
            'image/jpeg',
            0.7
          );
        };
      };
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressing(true);
    try {
      const compressed = await compressImage(file);
      const url = URL.createObjectURL(compressed);
      setInternalPreview(url);
      onImageSelected(compressed);
    } catch (err) {
      console.error("Compression failed", err);
    } finally {
      setIsCompressing(false);
    }
  };

  const removeImage = () => {
    setInternalPreview(null);
    onImageSelected(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="w-full">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />

      {internalPreview ? (
        <div className={`relative group aspect-[16/10] rounded-xl overflow-hidden border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
          <img src={internalPreview} className="w-full h-full object-cover" alt="Preview" />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-blue-600 rounded-lg text-white text-xs font-medium active:scale-[0.98] transition-all"
            >
              Replace Photo
            </button>
          </div>
          <button
            type="button"
            onClick={removeImage}
            className="absolute top-3 right-3 w-8 h-8 bg-black/60 rounded-lg flex items-center justify-center text-white hover:bg-red-500 transition-colors active:scale-[0.98]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isCompressing}
          className={`w-full aspect-[16/10] border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-3 transition-all group active:scale-[0.98] ${
            isDark
              ? 'border-slate-700 hover:border-blue-500/50 hover:bg-blue-500/5'
              : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50'
          }`}
        >
          {isCompressing ? (
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          ) : (
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
              <Camera className="w-7 h-7 text-blue-500" />
            </div>
          )}
          <div className="text-center">
            <p className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              {isCompressing ? 'Optimizing image...' : 'Upload Campaign Image'}
            </p>
            <p className={`text-[10px] mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              JPEG/PNG up to 500KB (Auto-compressed)
            </p>
          </div>
        </button>
      )}
    </div>
  );
};
