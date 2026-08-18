import React, { useEffect, useState, useRef } from 'react';
import { Camera, Upload, Image as ImageIcon, Loader2, X, Sparkles, AlertCircle, CheckCircle2, ArrowRight, RotateCcw, Plus, Video, Play } from 'lucide-react';
import { floatIn } from './floatIn';
import { productLookupService, AiProductAnalysis, mapCategoryToSchemaId } from '../../services/productLookupService';
import { addCampaignService } from '../../services/addCampaignService';
import { supabase } from '../../services/supabaseClient';

const MAX_ADDITIONAL_IMAGES = 4;          // cover + 4 = 5 images total
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50 MB
const MAX_VIDEO_SECONDS = 30;

/**
 * Adds semi-transparent "DealFynd" watermarks to an image file.
 * Places 4 watermarks diagonally across the image.
 * Returns a new File with the watermarks baked in.
 */
async function addDealProWatermark(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(file); // fallback: return original

        // Draw original image
        ctx.drawImage(img, 0, 0);

        // Watermark settings
        const fontSize = Math.max(14, Math.min(img.width, img.height) * 0.045);
        ctx.font = `bold ${fontSize}px Arial, sans-serif`;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // 4 watermark positions — spread diagonally
        const positions = [
          { x: img.width * 0.25, y: img.height * 0.2 },
          { x: img.width * 0.75, y: img.height * 0.35 },
          { x: img.width * 0.3,  y: img.height * 0.65 },
          { x: img.width * 0.7,  y: img.height * 0.85 },
        ];

        positions.forEach(({ x, y }) => {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(-25 * Math.PI / 180); // slight diagonal tilt
          ctx.fillText('DealFynd', 0, 0);
          ctx.restore();
        });

        canvas.toBlob(
          (blob) => {
            if (!blob) return resolve(file);
            const watermarkedFile = new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() });
            resolve(watermarkedFile);
          },
          'image/jpeg',
          0.92
        );
      };
      img.onerror = () => resolve(file); // fallback: return original
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

export interface PhotoStepResult {
  imageUrl: string | null;
  additionalImages: string[];
  videoUrl: string | null;
  analysis: AiProductAnalysis | null;
}

interface StepProductPhotoProps {
  onResult: (result: PhotoStepResult) => void;
  onSkip: () => void;
  onBack: () => void;
  theme: 'light' | 'dark';
  // Edit-mode pre-fill (optional)
  initialImageUrl?: string | null;
  initialAdditionalImages?: string[];
  initialVideoUrl?: string | null;
}

// ── Cloudinary upload helper ─────────────────────────────────────────────────
// Uploads a file to Cloudinary using a signed URL from cloudinary-sign.
// Same signature works for both image and video — only the endpoint differs.
async function uploadToCloudinary(file: File, kind: 'image' | 'video'): Promise<string> {
  // Retry transient failures (slow networks / timeouts) before giving up.
  const ATTEMPTS = kind === 'image' ? 3 : 2;
  let lastErr: any = null;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const { data: signData, error: signErr } = await supabase.functions.invoke('cloudinary-sign', {
        body: { folder: 'dealpro-products' },
      });
      if (signErr) throw new Error('Upload preparation failed');

      const { signature, timestamp, api_key, cloud_name, folder } = signData;
      const form = new FormData();
      form.append('file', file);
      form.append('signature', signature);
      form.append('timestamp', String(timestamp));
      form.append('api_key', api_key);
      form.append('folder', folder);

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${cloud_name}/${kind}/upload`,
        { method: 'POST', body: form, signal: AbortSignal.timeout(kind === 'video' ? 90000 : 45000) }
      );
      if (!res.ok) throw new Error('Upload failed');

      const json = await res.json();
      return json.secure_url as string;
    } catch (e) {
      lastErr = e;
      if (attempt < ATTEMPTS) await new Promise(r => setTimeout(r, 700 * attempt));
    }
  }
  throw lastErr || new Error('Upload failed');
}

// Reads a video file's duration via a hidden <video> element.
function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to read video metadata'));
    };
    video.src = url;
  });
}

export const StepProductPhoto: React.FC<StepProductPhotoProps> = ({
  onResult, onBack, theme,
  initialImageUrl, initialAdditionalImages, initialVideoUrl,
}) => {
  const isDark = theme === 'dark';
  const [visible, setVisible] = useState(false);

  // ── Cover image state (the AI subject) ─────────────────────────────────────
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialImageUrl || null);
  const [coverUrl, setCoverUrl] = useState<string | null>(initialImageUrl || null); // already-uploaded cover
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AiProductAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  // Set when the cover image upload fails after retries — lets the merchant
  // continue without the photo instead of being stuck.
  const [coverUploadFailed, setCoverUploadFailed] = useState(false);

  // ── Additional media state ─────────────────────────────────────────────────
  const [additionalImages, setAdditionalImages] = useState<string[]>(initialAdditionalImages || []);
  const [videoUrl, setVideoUrl] = useState<string | null>(initialVideoUrl || null);
  const [extraUploading, setExtraUploading] = useState(false);
  const [videoUploading, setVideoUploading] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  // Source picker for an additional photo — camera (live) vs gallery, same as the cover.
  const [extraSourceOpen, setExtraSourceOpen] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const extraImageInputRef = useRef<HTMLInputElement>(null);
  const extraCameraInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  // Generate preview URL from cover file (only for newly-picked files; in edit mode
  // previewUrl is already the remote URL).
  useEffect(() => {
    if (selectedFile) {
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [selectedFile]);

  // ── Cover photo handlers ────────────────────────────────────────────────────
  const handleCoverSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (file.size > MAX_IMAGE_BYTES) {
      setError('Image too large. Please use a photo under 10 MB.');
      return;
    }

    setSelectedFile(file);
    setCoverUrl(null); // invalidate any previously-uploaded cover
    setAnalysis(null);
    setError(null);
    setCoverUploadFailed(false);
    setAnalyzing(true);

    try {
      // Step 1: Moderate (block inappropriate images before sending to AI)
      const mod = await addCampaignService.moderateImage(file);
      if (mod.flagged) {
        setError(mod.reason || 'This image cannot be used.');
        setSelectedFile(null);
        setAnalyzing(false);
        return;
      }

      // Step 2: Copyright check (block watermarked/scraped images)
      const copyright = await addCampaignService.checkImageCopyright(file);
      if (copyright.flagged) {
        setError(copyright.reason || 'This image appears to be copyrighted. Please use your own photo.');
        setSelectedFile(null);
        setAnalyzing(false);
        return;
      }

      // Step 3: Analyze with Gemini Vision
      const { analysis: ai, error: aiError } = await productLookupService.analyzeProductImage(file);

      if (aiError) {
        setError(aiError);
        setAnalysis(null);
      } else if (ai) {
        setAnalysis(ai);
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong analyzing the image.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleRetake = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setCoverUrl(null);
    setAnalysis(null);
    setError(null);
    setCoverUploadFailed(false);
  };

  // ── Additional image handlers ───────────────────────────────────────────────
  const handleExtraImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setMediaError(null);

    if (additionalImages.length >= MAX_ADDITIONAL_IMAGES) {
      setMediaError(`You can add at most ${MAX_ADDITIONAL_IMAGES} extra images.`);
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setMediaError('Image too large. Please use a photo under 10 MB.');
      return;
    }

    setExtraUploading(true);
    try {
      const mod = await addCampaignService.moderateImage(file);
      if (mod.flagged) {
        setMediaError(mod.reason || 'This image cannot be used.');
        return;
      }

      // Relevance check — extra photos must be the SAME kind of product as the
      // recognised cover (e.g. block a TV added to a shirt). Only runs when the
      // cover was identified by AI; fails open if the check itself errors.
      if (analysis?.category) {
        try {
          const { analysis: extraAi } = await productLookupService.analyzeProductImage(file);
          if (extraAi?.category) {
            const coverSchema = mapCategoryToSchemaId(analysis.category);
            const extraSchema = mapCategoryToSchemaId(extraAi.category);
            if (coverSchema !== 'general' && extraSchema !== 'general' && coverSchema !== extraSchema) {
              setMediaError(
                `That looks like a different product. Please add more photos of "${analysis.product_name || analysis.category}" — not ${extraAi.product_name || extraAi.category}.`
              );
              return;
            }
          }
        } catch {
          /* relevance check failed (network/AI) — don't block the upload */
        }
      }

      const url = await uploadToCloudinary(file, 'image');
      setAdditionalImages(prev => [...prev, url]);
    } catch (err: any) {
      console.error('[StepProductPhoto] Extra image upload failed:', err);
      setMediaError('Image upload failed. Please try again.');
    } finally {
      setExtraUploading(false);
    }
  };

  const removeExtraImage = (idx: number) => {
    setAdditionalImages(prev => prev.filter((_, i) => i !== idx));
  };

  // ── Video handlers ──────────────────────────────────────────────────────────
  const handleVideoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setMediaError(null);

    if (file.size > MAX_VIDEO_BYTES) {
      setMediaError('Video too large. Please use a clip under 50 MB.');
      return;
    }

    setVideoUploading(true);
    try {
      const duration = await getVideoDuration(file);
      if (duration > MAX_VIDEO_SECONDS) {
        setMediaError(`Video too long. Please trim it to under ${MAX_VIDEO_SECONDS} seconds.`);
        return;
      }
      const url = await uploadToCloudinary(file, 'video');
      setVideoUrl(url);
    } catch (err: any) {
      console.error('[StepProductPhoto] Video upload failed:', err);
      setMediaError('Video upload failed. Please try again.');
    } finally {
      setVideoUploading(false);
    }
  };

  const removeVideo = () => setVideoUrl(null);

  // ── Continue: upload cover (if needed) and pass everything back ─────────────
  const handleContinue = async () => {
    if (!previewUrl) return;
    setUploading(true);
    setCoverUploadFailed(false);
    try {
      let finalCoverUrl = coverUrl;
      // If the merchant just picked a new cover file, upload it now.
      if (selectedFile && !finalCoverUrl) {
        finalCoverUrl = await uploadToCloudinary(selectedFile, 'image');
        setCoverUrl(finalCoverUrl); // cache so a retry doesn't re-upload
      }
      if (!finalCoverUrl) throw new Error('Missing cover image');

      onResult({
        imageUrl: finalCoverUrl,
        additionalImages,
        videoUrl,
        analysis,
      });
    } catch (err: any) {
      // Don't block — surface a fallback so the merchant can retry or continue
      // without the photo (the product supports a null cover image).
      console.error('[StepProductPhoto] Cover upload failed:', err);
      setCoverUploadFailed(true);
    } finally {
      setUploading(false);
    }
  };

  // Fallback when the cover image just won't upload: proceed without it,
  // keeping any extra images / video / AI analysis already gathered.
  const continueWithoutPhoto = () => {
    onResult({ imageUrl: null, additionalImages, videoUrl, analysis });
  };

  const confidenceColor = analysis?.confidence === 'high'
    ? 'text-emerald-500' : analysis?.confidence === 'medium'
    ? 'text-amber-500' : 'text-red-500';

  // Show the extras gallery once we have a cover image and AI analysis is done
  // (or skipped via "Continue Manually"). This keeps the empty state clean.
  const showExtras = !!previewUrl && !analyzing;

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 pt-6 pb-4">
        <div style={floatIn(0, visible)} className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
          <Sparkles className="w-8 h-8 text-emerald-500" />
        </div>
        <h2 style={floatIn(100, visible)} className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
          Snap your product
        </h2>
        <p style={floatIn(200, visible)} className={`text-sm mb-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Take a photo and our AI will identify the product, category, and details automatically.
        </p>

        {/* Hidden file inputs */}
        <input ref={cameraInputRef}     type="file" accept="image/*" capture="environment" onChange={handleCoverSelected}   className="hidden" />
        <input ref={galleryInputRef}    type="file" accept="image/*"                       onChange={handleCoverSelected}   className="hidden" />
        <input ref={extraImageInputRef}  type="file" accept="image/*"                       onChange={handleExtraImageSelected} className="hidden" />
        <input ref={extraCameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleExtraImageSelected} className="hidden" />
        <input ref={videoInputRef}       type="file" accept="video/*"                       onChange={handleVideoSelected}   className="hidden" />

        {!previewUrl ? (
          // ── Empty state — show camera + gallery buttons ──
          <div style={floatIn(300, visible)} className="space-y-3">
            <button
              onClick={() => cameraInputRef.current?.click()}
              className={`w-full p-5 rounded-2xl border-2 border-dashed flex items-center gap-4 transition-all active:scale-[0.98] ${
                isDark
                  ? 'border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10'
                  : 'border-emerald-300 bg-emerald-50/50 hover:bg-emerald-50'
              }`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-emerald-500/20' : 'bg-emerald-100'}`}>
                <Camera className="w-6 h-6 text-emerald-500" />
              </div>
              <div className="text-left flex-1">
                <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Take Photo</p>
                <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Use your camera</p>
              </div>
              <ArrowRight className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            </button>

            <button
              onClick={() => galleryInputRef.current?.click()}
              className={`w-full p-5 rounded-2xl border-2 border-dashed flex items-center gap-4 transition-all active:scale-[0.98] ${
                isDark
                  ? 'border-slate-700 bg-slate-800/40 hover:bg-slate-800/60'
                  : 'border-slate-300 bg-slate-50 hover:bg-slate-100'
              }`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
                <Upload className={`w-6 h-6 ${isDark ? 'text-slate-300' : 'text-slate-600'}`} />
              </div>
              <div className="text-left flex-1">
                <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Upload from Gallery</p>
                <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Choose existing photo</p>
              </div>
              <ArrowRight className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
            </button>

            {/* Tips */}
            <div className={`mt-4 p-3 rounded-xl ${isDark ? 'bg-slate-800/50 border border-slate-700' : 'bg-blue-50 border border-blue-100'}`}>
              <p className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>For best results</p>
              <ul className={`text-[11px] space-y-0.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                <li>• Good lighting, no shadows</li>
                <li>• Product fills most of the frame</li>
                <li>• Plain background if possible</li>
                <li>• Clear view of label/packaging</li>
              </ul>
            </div>
          </div>
        ) : (
          // ── Photo selected — show preview + AI analysis ──
          <div style={floatIn(0, true)} className="space-y-4">
            <div className={`relative rounded-2xl overflow-hidden border-2 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
              <img src={previewUrl} alt="Product" className="w-full h-64 object-contain bg-slate-900" />
              {!analyzing && !error && (
                <button
                  onClick={handleRetake}
                  className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/60 flex items-center justify-center"
                >
                  <RotateCcw className="w-4 h-4 text-white" />
                </button>
              )}
              <span className="absolute top-3 left-3 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold">COVER</span>
            </div>

            {/* Analyzing state */}
            {analyzing && (
              <div className={`p-4 rounded-xl flex items-center gap-3 ${isDark ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-blue-50 border border-blue-200'}`}>
                <Loader2 className="w-5 h-5 animate-spin text-blue-500 shrink-0" />
                <div>
                  <p className={`text-sm font-semibold ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>Analyzing image...</p>
                  <p className={`text-[11px] ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>Gemini AI is identifying the product</p>
                </div>
              </div>
            )}

            {/* Error state */}
            {error && !analyzing && (
              <div className={`p-4 rounded-xl ${isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'}`}>
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className={`text-sm font-semibold ${isDark ? 'text-red-300' : 'text-red-700'}`}>Couldn't identify product</p>
                    <p className={`text-[11px] mt-0.5 ${isDark ? 'text-red-400' : 'text-red-600'}`}>{error}</p>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleRetake}
                    className="flex-1 h-10 rounded-lg bg-red-500 text-white text-xs font-semibold active:scale-[0.98] transition-all"
                  >
                    Retake Photo
                  </button>
                  <button
                    onClick={() => { setError(null); /* allow continuing without AI */ }}
                    className={`flex-1 h-10 rounded-lg text-xs font-semibold active:scale-[0.98] transition-all ${
                      isDark ? 'bg-slate-800 text-slate-300 border border-slate-700' : 'bg-white text-slate-700 border border-slate-200'
                    }`}
                  >
                    Continue Manually
                  </button>
                </div>
              </div>
            )}

            {/* Cover upload failed — fallback so the merchant is never stuck */}
            {coverUploadFailed && !uploading && (
              <div className={`p-4 rounded-xl ${isDark ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-amber-50 border border-amber-200'}`}>
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className={`text-sm font-semibold ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>Couldn't upload your photo</p>
                    <p className={`text-[11px] mt-0.5 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                      Check your connection and tap Continue to retry — or add this product now and attach a photo later.
                    </p>
                  </div>
                </div>
                <button
                  onClick={continueWithoutPhoto}
                  className={`mt-3 w-full h-10 rounded-lg text-xs font-semibold active:scale-[0.98] transition-all ${
                    isDark ? 'bg-slate-800 text-slate-200 border border-slate-700' : 'bg-white text-slate-700 border border-slate-200'
                  }`}
                >
                  Continue without photo
                </button>
              </div>
            )}

            {/* Success state — show AI analysis */}
            {analysis && !analyzing && !error && (
              <div className={`p-4 rounded-xl ${isDark ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-emerald-50 border border-emerald-200'}`}>
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  <p className={`text-sm font-bold ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>Product identified</p>
                  <span className={`ml-auto text-[10px] font-semibold uppercase ${confidenceColor}`}>
                    {analysis.confidence} confidence
                  </span>
                </div>
                <div className="space-y-2">
                  <div>
                    <p className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Product</p>
                    <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{analysis.product_name}</p>
                  </div>
                  <div>
                    <p className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Category</p>
                    <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{analysis.category}</p>
                  </div>
                  {analysis.description && (
                    <div>
                      <p className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Description</p>
                      <p className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{analysis.description}</p>
                    </div>
                  )}
                  {Object.keys(analysis.suggested_attributes || {}).length > 0 && (
                    <div>
                      <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Detected attributes</p>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(analysis.suggested_attributes).map(([k, v]) => (
                          <span key={k} className={`text-[10px] px-2 py-0.5 rounded-full ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-white text-slate-600 border border-slate-200'}`}>
                            <span className="font-semibold">{k}:</span> {v}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {analysis.suggested_price && (
                    <div>
                      <p className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Detected price</p>
                      <p className={`text-sm font-semibold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>₹{analysis.suggested_price}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Extra media gallery (4 images + 1 video) ─────────────────── */}
            {showExtras && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    More photos & video
                  </p>
                  <p className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    {additionalImages.length}/{MAX_ADDITIONAL_IMAGES} photos · {videoUrl ? '1' : '0'}/1 video
                  </p>
                </div>

                {/* Image slots */}
                <div className="grid grid-cols-4 gap-2">
                  {additionalImages.map((url, idx) => (
                    <div key={url} className={`relative aspect-square rounded-xl overflow-hidden border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                      <img src={url} alt={`Extra ${idx + 1}`} className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeExtraImage(idx)}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center"
                        title="Remove"
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  ))}
                  {additionalImages.length < MAX_ADDITIONAL_IMAGES && (
                    <button
                      onClick={() => setExtraSourceOpen(true)}
                      disabled={extraUploading}
                      className={`aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 active:scale-[0.98] transition-all ${
                        isDark ? 'border-slate-700 bg-slate-800/40 hover:bg-slate-800' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'
                      } disabled:opacity-50`}
                    >
                      {extraUploading ? (
                        <Loader2 className={`w-5 h-5 animate-spin ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                      ) : (
                        <>
                          <Plus className={`w-5 h-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                          <span className={`text-[9px] font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Photo</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Video slot */}
                {videoUrl ? (
                  <div className={`relative aspect-video rounded-xl overflow-hidden border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                    <video src={videoUrl} className="w-full h-full object-cover bg-black" muted playsInline />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center">
                        <Play className="w-5 h-5 text-white fill-white" />
                      </div>
                    </div>
                    <button
                      onClick={removeVideo}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 flex items-center justify-center"
                      title="Remove video"
                    >
                      <X className="w-3.5 h-3.5 text-white" />
                    </button>
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-blue-500 text-white text-[10px] font-bold">VIDEO</span>
                  </div>
                ) : (
                  <button
                    onClick={() => videoInputRef.current?.click()}
                    disabled={videoUploading}
                    className={`w-full p-4 rounded-xl border-2 border-dashed flex items-center justify-center gap-3 active:scale-[0.98] transition-all ${
                      isDark ? 'border-slate-700 bg-slate-800/40 hover:bg-slate-800' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'
                    } disabled:opacity-50`}
                  >
                    {videoUploading ? (
                      <>
                        <Loader2 className={`w-5 h-5 animate-spin ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                        <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Uploading video...</span>
                      </>
                    ) : (
                      <>
                        <Video className={`w-5 h-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                        <span className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Add a short video (max 30s, 50 MB)</span>
                      </>
                    )}
                  </button>
                )}

                {mediaError && (
                  <div className={`p-3 rounded-lg flex items-start gap-2 ${isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'}`}>
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <p className={`text-[11px] ${isDark ? 'text-red-300' : 'text-red-700'}`}>{mediaError}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sticky bottom buttons */}
      <div className={`shrink-0 px-6 pt-3 pb-8 flex gap-3 border-t ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <button
          onClick={onBack}
          className={`flex-1 h-14 rounded-xl text-base font-semibold active:scale-[0.98] transition-all ${
            isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
          }`}
        >
          Back
        </button>
        {previewUrl && !error ? (
          <button
            onClick={handleContinue}
            disabled={analyzing || uploading}
            className="flex-[2] h-14 rounded-xl bg-emerald-600 text-white text-base font-semibold active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {uploading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
            ) : analyzing ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</>
            ) : (
              <>Continue <ArrowRight className="w-4 h-4" /></>
            )}
          </button>
        ) : (
          // A product needs at least one photo — keep the action grayed out and
          // unclickable until the merchant has added a cover image.
          <button
            disabled
            aria-disabled="true"
            className={`flex-[2] h-14 rounded-xl text-base font-semibold transition-all flex items-center justify-center gap-2 opacity-50 cursor-not-allowed ${
              isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-500'
            }`}
          >
            Continue <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Action sheet: pick camera (live) or gallery for an additional photo —
          mirrors the cover photo's two options so every photo can be shot live. */}
      {extraSourceOpen && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setExtraSourceOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className={`relative w-full rounded-t-2xl p-4 pb-8 space-y-2 ${isDark ? 'bg-slate-900 border-t border-slate-800' : 'bg-white'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Add a photo</p>
            <button
              onClick={() => { setExtraSourceOpen(false); extraCameraInputRef.current?.click(); }}
              className={`w-full p-4 rounded-xl flex items-center gap-3 active:scale-[0.98] transition-all ${isDark ? 'bg-emerald-500/10 hover:bg-emerald-500/15' : 'bg-emerald-50 hover:bg-emerald-100'}`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-emerald-500/20' : 'bg-emerald-100'}`}>
                <Camera className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="text-left">
                <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Take Photo</p>
                <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Use your camera</p>
              </div>
            </button>
            <button
              onClick={() => { setExtraSourceOpen(false); extraImageInputRef.current?.click(); }}
              className={`w-full p-4 rounded-xl flex items-center gap-3 active:scale-[0.98] transition-all ${isDark ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-50 hover:bg-slate-100'}`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
                <Upload className={`w-5 h-5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`} />
              </div>
              <div className="text-left">
                <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Choose from Gallery</p>
                <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Pick an existing photo</p>
              </div>
            </button>
            <button
              onClick={() => setExtraSourceOpen(false)}
              className={`w-full h-11 rounded-xl text-sm font-semibold mt-1 ${isDark ? 'bg-slate-800/60 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
