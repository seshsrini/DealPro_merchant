import React, { useState } from 'react';
import { Tag } from 'lucide-react';

interface DealProLogoProps {
  /** Container className — controls size, shape, background. Applied to both the <img> and the fallback wrapper. */
  className?: string;
  /** Lucide icon className for the fallback. Defaults to a sensible size. */
  iconClassName?: string;
  /** Override the alt text. Default 'DealPro'. */
  alt?: string;
}

// Single source of truth for the merchant logo image. Wraps the <img> with an
// onError fallback so a missing/unsynced asset doesn't render a broken icon
// next to the brand text. The fallback is a styled gradient tile with a Lucide
// Tag icon — guaranteed to render because lucide-react is bundled JS, not an
// asset that needs to be served from /assets/.
export const DealProLogo: React.FC<DealProLogoProps> = ({ className, iconClassName, alt }) => {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className={`flex items-center justify-center bg-gradient-to-br from-emerald-500 to-emerald-600 ${className || ''}`}>
        <Tag className={iconClassName || 'w-1/2 h-1/2 text-white'} />
      </div>
    );
  }

  return (
    <img
      src="/assets/merchantlogo.svg"
      alt={alt || 'DealPro'}
      className={className}
      onError={() => setFailed(true)}
    />
  );
};
