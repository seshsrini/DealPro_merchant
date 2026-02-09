
import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, ImageIcon, Loader2 } from 'lucide-react';

interface ImageUploadProps {
  onImageSelected: (file: File | null) => void;
  previewUrl?: string;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({ onImageSelected, previewUrl }) => {
  const [internalPreview, setInternalPreview] = useState<string | null>(previewUrl || null);
  const [isCompressing, setIsCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Requirement: Populate visual box when external URL is provided
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
        <div className="relative group aspect-[16/10] rounded-[2.5rem] overflow-hidden border-2 border-white/10 shadow-2xl animate-reveal bg-slate-900/40">
          <img src={internalPreview} className="w-full h-full object-cover" alt="Preview" />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-5 py-2.5 bg-blue-600 rounded-xl text-white text-[10px] font-black uppercase tracking-widest border border-white/20 shadow-xl active:scale-95 transition-all"
            >
              Replace Photo
            </button>
          </div>
          <button
            type="button"
            onClick={removeImage}
            className="absolute top-5 right-5 w-10 h-10 bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/10 hover:bg-rose-500 transition-colors shadow-lg active:scale-90"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isCompressing}
          className="w-full aspect-[16/10] glass border-2 border-dashed border-white/10 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all group active:scale-[0.98] shadow-inner"
        >
          {isCompressing ? (
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
          ) : (
            <div className="w-16 h-16 rounded-3xl bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg border border-blue-500/20">
              <Camera className="w-8 h-8 text-blue-500" />
            </div>
          )}
          <div className="text-center">
            <p className="text-xs font-black uppercase tracking-widest text-slate-300">
              {isCompressing ? 'Optimizing Grid Image...' : 'Capture Campaign Visual'}
            </p>
            <p className="text-[9px] font-bold text-slate-500 mt-1 uppercase tracking-tighter">
              JPEG/PNG up to 500KB (Auto-compressed)
            </p>
          </div>
        </button>
      )}
    </div>
  );
};
