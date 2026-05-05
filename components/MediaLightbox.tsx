/**
 * MediaLightbox.tsx
 *
 * Full-screen image / video viewer with:
 * - Swipe left/right to navigate between slides
 * - Pinch-to-zoom on images (two-finger gesture)
 * - Double-tap to zoom in/out
 * - Pan when zoomed in
 * - Keyboard nav (arrows + Esc)
 */

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

export type LightboxSlide =
  | { kind: 'image'; url: string }
  | { kind: 'video'; url: string };

interface MediaLightboxProps {
  slides: LightboxSlide[];
  initialIndex?: number;
  onClose: () => void;
}

export const MediaLightbox: React.FC<MediaLightboxProps> = ({
  slides, initialIndex = 0, onClose,
}) => {
  const safeInitial = Math.max(0, Math.min(initialIndex, Math.max(0, slides.length - 1)));
  const [index, setIndex] = useState(safeInitial);

  // Zoom & pan state
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const lastPinchDist = useRef(0);
  const lastPanPos = useRef({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const lastTapTime = useRef(0);

  // Swipe state (single finger, only when not zoomed)
  const touchStartX = useRef<number | null>(null);
  const touchDeltaX = useRef(0);

  const resetZoom = () => { setScale(1); setTranslate({ x: 0, y: 0 }); };

  const next = () => { resetZoom(); setIndex(i => (i + 1) % slides.length); };
  const prev = () => { resetZoom(); setIndex(i => (i - 1 + slides.length) % slides.length); };

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, slides.length]);

  // Reset zoom when slide changes
  useEffect(() => { resetZoom(); }, [index]);

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch start
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastPinchDist.current = Math.sqrt(dx * dx + dy * dy);
      isPanning.current = false;
    } else if (e.touches.length === 1) {
      if (scale > 1) {
        // Pan start when zoomed
        isPanning.current = true;
        lastPanPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else {
        // Swipe start when not zoomed
        touchStartX.current = e.touches[0].clientX;
        touchDeltaX.current = 0;
      }

      // Double-tap detection
      const now = Date.now();
      if (now - lastTapTime.current < 300) {
        // Double-tap: toggle zoom
        if (scale > 1) {
          resetZoom();
        } else {
          setScale(2.5);
          // Center zoom on tap position
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const cx = e.touches[0].clientX - rect.left - rect.width / 2;
          const cy = e.touches[0].clientY - rect.top - rect.height / 2;
          setTranslate({ x: -cx, y: -cy });
        }
        lastTapTime.current = 0;
      } else {
        lastTapTime.current = now;
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch zoom
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (lastPinchDist.current > 0) {
        const newScale = Math.max(1, Math.min(5, scale * (dist / lastPinchDist.current)));
        setScale(newScale);
        if (newScale <= 1) setTranslate({ x: 0, y: 0 });
      }
      lastPinchDist.current = dist;
    } else if (e.touches.length === 1) {
      if (isPanning.current && scale > 1) {
        // Pan when zoomed
        const dx = e.touches[0].clientX - lastPanPos.current.x;
        const dy = e.touches[0].clientY - lastPanPos.current.y;
        setTranslate(prev => ({ x: prev.x + dx, y: prev.y + dy }));
        lastPanPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (touchStartX.current !== null && scale <= 1) {
        // Swipe tracking
        touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
      }
    }
  };

  const handleTouchEnd = () => {
    lastPinchDist.current = 0;
    isPanning.current = false;

    // Snap back to 1x if close
    if (scale < 1.1) resetZoom();

    // Swipe nav (only when not zoomed)
    if (touchStartX.current !== null && scale <= 1) {
      const SWIPE_THRESHOLD = 50;
      if (touchDeltaX.current > SWIPE_THRESHOLD) prev();
      else if (touchDeltaX.current < -SWIPE_THRESHOLD) next();
      touchStartX.current = null;
      touchDeltaX.current = 0;
    }
  };

  if (slides.length === 0) return null;
  const slide = slides[index];

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] bg-black/95 flex items-center justify-center select-none"
      onClick={scale <= 1 ? onClose : undefined}
    >
      {/* Close button */}
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all"
        aria-label="Close"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Counter */}
      {slides.length > 1 && (
        <div className="absolute top-5 left-1/2 -translate-x-1/2 z-20 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-medium">
          {index + 1} / {slides.length}
        </div>
      )}

      {/* Zoom hint */}
      {scale <= 1 && slide.kind === 'image' && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 px-3 py-1 rounded-full bg-white/10 text-white/50 text-[10px] font-medium">
          Pinch to zoom &middot; Double-tap to enlarge
        </div>
      )}

      {/* Slide */}
      <div
        className="w-full h-full flex items-center justify-center"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={(e) => e.stopPropagation()}
        style={{ touchAction: scale > 1 ? 'none' : 'pan-y' }}
      >
        {slide.kind === 'video' ? (
          <video
            key={slide.url}
            src={slide.url}
            controls
            playsInline
            autoPlay
            className="max-w-full max-h-full"
          />
        ) : (
          <img
            key={slide.url}
            src={slide.url}
            alt=""
            className="max-w-full max-h-full object-contain transition-transform duration-100"
            draggable={false}
            style={{
              transform: `scale(${scale}) translate(${translate.x / scale}px, ${translate.y / scale}px)`,
            }}
          />
        )}
      </div>

      {/* Nav arrows + dots */}
      {slides.length > 1 && scale <= 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); prev(); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all"
            aria-label="Previous"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); next(); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all"
            aria-label="Next"
          >
            <ChevronRight className="w-6 h-6" />
          </button>

          {/* Dots */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); resetZoom(); setIndex(i); }}
                className={`h-2 rounded-full transition-all ${
                  i === index ? 'w-6 bg-white' : 'w-2 bg-white/40 hover:bg-white/60'
                }`}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>,
    document.body
  );
};
