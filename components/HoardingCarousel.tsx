import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { hoardingService, Hoarding } from '../services/hoardingService';

interface HoardingCarouselProps {
  onClose: () => void;
}

export const HoardingCarousel: React.FC<HoardingCarouselProps> = ({ onClose }) => {
  const [hoardings, setHoardings] = useState<Hoarding[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHoardings = async () => {
      const { data, error } = await hoardingService.getAllHoardings();
      if (data) {
        console.log('[HoardingCarousel] Loaded hoardings:', data.length);
        setHoardings(data);
      } else {
        console.error('[HoardingCarousel] Error loading hoardings:', error);
      }
      setLoading(false);
    };

    fetchHoardings();
  }, []);

  const handleNext = () => {
    if (currentIndex < hoardings.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleSkip = () => {
    onClose();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[1000] bg-black/95 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-sm font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (hoardings.length === 0) {
    onClose();
    return null;
  }

  const currentHoarding = hoardings[currentIndex];

  return (
    <div className="fixed inset-0 z-[1000] bg-black/95 flex items-center justify-center p-6">
      {/* Close Button */}
      <button
        onClick={handleSkip}
        className="absolute top-6 right-6 w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center active:scale-[0.98] transition-all z-10"
      >
        <X className="w-5 h-5 text-white" />
      </button>

      {/* Hoarding Content */}
      <div className="max-w-2xl w-full">
        {/* Topic */}
        <div className="text-center mb-6">
          <p className="text-blue-400 text-sm font-medium mb-2">
            {currentHoarding.topic}
          </p>
        </div>

        {/* Main Image */}
        {currentHoarding.images && currentHoarding.images.length > 0 && (
          <div className="relative aspect-video rounded-xl overflow-hidden mb-8 border border-white/10">
            <img
              src={currentHoarding.images[0]}
              alt={currentHoarding.heading}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
          </div>
        )}

        {/* Heading */}
        <h2 className="text-3xl md:text-4xl font-semibold text-white text-center mb-4 leading-tight">
          {currentHoarding.heading}
        </h2>

        {/* Description */}
        <p className="text-slate-300 text-center text-base leading-relaxed mb-8 max-w-xl mx-auto">
          {currentHoarding.description}
        </p>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8">
          {/* Previous Button */}
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
              currentIndex === 0
                ? 'bg-white/5 opacity-50 cursor-not-allowed'
                : 'bg-white/10 hover:bg-white/20'
            }`}
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>

          {/* Dots Indicator */}
          <div className="flex gap-2">
            {hoardings.map((_, index) => (
              <div
                key={index}
                className={`h-2 rounded-full transition-all ${
                  index === currentIndex
                    ? 'w-8 bg-blue-500'
                    : 'w-2 bg-white/30'
                }`}
              />
            ))}
          </div>

          {/* Next/Done Button */}
          {currentIndex === hoardings.length - 1 ? (
            <button
              onClick={handleSkip}
              className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl active:scale-[0.98] transition-all"
            >
              Get Started
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all"
            >
              <ChevronRight className="w-5 h-5 text-white" />
            </button>
          )}
        </div>

        {/* Skip Button */}
        <div className="text-center mt-6">
          <button
            onClick={handleSkip}
            className="text-slate-400 hover:text-white text-sm font-medium transition-colors"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
};
