/**
 * MerchantProductPreview.tsx
 *
 * Modal that lets a merchant see one of their own catalogue products exactly
 * the way a consumer would see it. Mirrors the consumer's ProductDetailsModal
 * (image carousel + lightbox + price + stock + description + specs) but drops
 * the favorite button and the "Sold by" merchant card since the merchant is
 * looking at their own product, and adds Edit / Close actions at the bottom.
 */

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Tag, Package, ChevronLeft, ChevronRight, Edit2, Play } from 'lucide-react';
import { CatalogueItem } from '../MerchantCatalogue';
import { MediaLightbox, LightboxSlide } from './MediaLightbox';

interface Props {
  item: CatalogueItem;
  theme: 'light' | 'dark';
  onClose: () => void;
  onEdit: () => void;
}

export const MerchantProductPreview: React.FC<Props> = ({ item, theme, onClose, onEdit }) => {
  const isDark = theme === 'dark';
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Build the media carousel: cover + extras + optional video at the end.
  const slides: LightboxSlide[] = [];
  if (item.imageUrl) slides.push({ kind: 'image', url: item.imageUrl });
  for (const url of item.additionalImages || []) {
    if (url) slides.push({ kind: 'image', url });
  }
  if (item.videoUrl) slides.push({ kind: 'video', url: item.videoUrl });
  if (slides.length === 0) {
    slides.push({ kind: 'image', url: 'https://via.placeholder.com/400x400?text=No+Image' });
  }

  const next = () => setCurrentIndex(i => (i + 1) % slides.length);
  const prev = () => setCurrentIndex(i => (i - 1 + slides.length) % slides.length);

  // Same display semantics as the consumer side:
  //   stockCount: null = "In Stock" (green), 0 = Out of Stock, 1..10 = exact remaining
  const stockCount = item.stockCount;
  const isLowStock = stockCount !== null && stockCount > 0 && stockCount <= 10;
  const isOutOfStock = stockCount === 0;
  const inStock = !isLowStock && !isOutOfStock;

  const priceNum = parseFloat(item.price) || 0;
  const mrpNum = parseFloat(item.mrp) || 0;
  const discountPct = mrpNum > priceNum && mrpNum > 0
    ? Math.round(((mrpNum - priceNum) / mrpNum) * 100)
    : 0;

  // Specs to show (hide internal fields like ai_description / schemaId).
  const specEntries = Object.entries(item.specs || {}).filter(
    ([key, value]) =>
      key !== 'ai_description' &&
      key !== 'schemaId' &&
      value !== null && value !== undefined && String(value).trim() !== ''
  );

  const slide = slides[currentIndex];

  return createPortal(
    <div
      className="fixed inset-0 z-[500] bg-black/50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-t-xl sm:rounded-xl ${
          isDark ? 'bg-slate-900' : 'bg-white'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image / Video carousel */}
        <div className={`relative aspect-square overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
          {/* Close */}
          <button
            onClick={onClose}
            className={`absolute top-4 right-4 z-10 w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-all shadow-sm ${
              isDark ? 'bg-slate-900/80 text-white' : 'bg-white/90 text-slate-700'
            }`}
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>

          {/* PREVIEW badge so merchant knows this is what the consumer sees */}
          <span className="absolute top-4 left-4 z-10 px-2.5 py-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-wider">
            Consumer Preview
          </span>

          {slide.kind === 'video' ? (
            <video
              src={slide.url}
              controls
              playsInline
              className="w-full h-full object-contain bg-black"
            />
          ) : (
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              className="w-full h-full focus:outline-none"
              title="Tap to view full screen"
            >
              <img
                src={slide.url}
                alt={item.name}
                className="w-full h-full object-cover"
              />
            </button>
          )}

          {/* Carousel arrows + dots */}
          {slides.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); prev(); }}
                className={`absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition-all shadow-sm ${
                  isDark ? 'bg-slate-900/80 text-white' : 'bg-white/90 text-slate-700'
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); next(); }}
                className={`absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition-all shadow-sm ${
                  isDark ? 'bg-slate-900/80 text-white' : 'bg-white/90 text-slate-700'
                }`}
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {slides.map((s, index) => (
                  <button
                    key={index}
                    onClick={(e) => { e.stopPropagation(); setCurrentIndex(index); }}
                    className={`h-1.5 rounded-full transition-all ${
                      index === currentIndex
                        ? `w-4 ${isDark ? 'bg-white' : 'bg-slate-900'}`
                        : `w-1.5 ${isDark ? 'bg-white/40' : 'bg-slate-400'}`
                    }`}
                    aria-label={`Slide ${index + 1}`}
                  >
                    {s.kind === 'video' && (
                      <Play className={`w-2 h-2 ${isDark ? 'text-white' : 'text-slate-900'}`} />
                    )}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Stock badge */}
          {isLowStock && (
            <div className="absolute bottom-4 left-4 px-2 py-1 rounded-md bg-red-500">
              <span className="text-[10px] font-medium text-white">Only {stockCount} left</span>
            </div>
          )}
          {isOutOfStock && (
            <div className="absolute bottom-4 left-4 px-2 py-1 rounded-md bg-red-500">
              <span className="text-[10px] font-medium text-white">Out of Stock</span>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* Product name + brand + category */}
          <div>
            {item.brand && (
              <p className={`text-[10px] font-medium uppercase tracking-wider mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {item.brand}
              </p>
            )}
            <h2 className={`text-lg font-semibold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {item.name}
            </h2>
            <div className="flex items-center gap-1.5">
              <Tag className={`w-3 h-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
              <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {item.category}
              </span>
            </div>
          </div>

          {/* Price */}
          {priceNum > 0 && (
            <div className={`p-3 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-2xl font-semibold text-yellow-600">₹{item.price}</span>
                {mrpNum > priceNum && (
                  <span className={`text-sm line-through ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    ₹{item.mrp}
                  </span>
                )}
              </div>
              {discountPct > 0 && (
                <span className="text-xs font-medium text-emerald-600">{discountPct}% OFF</span>
              )}
            </div>
          )}

          {/* Description (AI-generated or manual) */}
          {item.specs?.ai_description && (
            <div>
              <h3 className={`text-sm font-medium mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Description
              </h3>
              <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                {item.specs.ai_description}
              </p>
            </div>
          )}

          {/* Stock */}
          <div className={`flex items-center gap-3 p-3 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
            <Package className={`w-4 h-4 ${inStock ? 'text-emerald-500' : 'text-red-500'}`} />
            <div>
              <p className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Availability</p>
              <p className={`text-sm font-medium ${inStock ? 'text-emerald-600' : 'text-red-600'}`}>
                {isOutOfStock ? 'Out of Stock' : isLowStock ? `Only ${stockCount} left` : 'In Stock'}
              </p>
            </div>
          </div>

          {/* Specifications */}
          {specEntries.length > 0 && (
            <div>
              <h3 className={`text-sm font-medium mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Product Details
              </h3>
              <div className={`rounded-lg ${isDark ? 'bg-slate-800/50' : 'bg-slate-50'} divide-y ${isDark ? 'divide-slate-700/50' : 'divide-slate-200'}`}>
                {specEntries.map(([key, value]) => (
                  <div key={key} className="flex items-start justify-between gap-4 px-3 py-2">
                    <span className={`text-xs capitalize ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {key.replace(/_/g, ' ')}
                    </span>
                    <span className={`text-xs text-right ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {value === 'true' ? 'Yes' : value === 'false' ? 'No' : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sticky action bar */}
        <div className={`sticky bottom-0 px-4 py-3 border-t flex gap-3 ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <button
            onClick={onClose}
            className={`flex-1 h-11 rounded-xl text-sm font-semibold active:scale-[0.98] transition-all ${
              isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
            }`}
          >
            Close
          </button>
          <button
            onClick={onEdit}
            className="flex-1 h-11 rounded-xl bg-slate-900 text-white text-sm font-semibold active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <Edit2 className="w-4 h-4" />
            Edit Product
          </button>
        </div>
      </div>

      {/* Full-screen lightbox */}
      {lightboxOpen && (
        <MediaLightbox
          slides={slides}
          initialIndex={currentIndex}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>,
    document.body
  );
};
