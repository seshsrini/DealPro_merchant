/**
 * Tiny visual mocks shown in the poster picker so the merchant can tell the
 * four layouts apart at a glance. Pure CSS, no real deal data here.
 *
 * Lives in its own file (instead of inline) so both MerchantMyCampaigns and
 * MerchantDashboard can render the picker without duplicating the markup.
 */

import React from 'react';
import type { PosterTemplate } from '../utils/printDealPoster';

export const renderPosterMiniMock = (id: PosterTemplate): React.ReactElement => {
  if (id === 'bold_promo') {
    return (
      <div className="aspect-[3/4] w-full rounded-lg overflow-hidden bg-slate-200 flex flex-col">
        <div className="h-3 bg-slate-900" />
        <div className="flex-[3] bg-gradient-to-br from-yellow-300 to-amber-500" />
        <div className="flex-[2] bg-white p-1.5 flex flex-col gap-1">
          <div className="h-2 w-12 bg-red-500 rounded-sm" />
          <div className="h-2 w-full bg-slate-700 rounded-sm" />
          <div className="h-1.5 w-3/4 bg-slate-400 rounded-sm" />
          <div className="mt-auto h-1.5 w-full bg-slate-200 rounded-sm" />
        </div>
        <div className="h-2 bg-amber-100" />
      </div>
    );
  }
  if (id === 'discount_splash') {
    return (
      <div className="aspect-[3/4] w-full rounded-lg overflow-hidden bg-slate-200 flex flex-col">
        <div className="h-3 bg-slate-900" />
        <div className="flex-[3] bg-gradient-to-br from-amber-400 to-red-500 relative">
          <div className="absolute right-1 bottom-1 w-6 h-6 rounded-full bg-red-600 border-2 border-white" />
        </div>
        <div className="flex-[2] bg-white p-1.5 flex flex-col gap-1">
          <div className="h-2 w-full bg-slate-700 rounded-sm" />
          <div className="h-3 w-12 bg-slate-900 rounded-sm" />
          <div className="mt-auto h-3 w-full bg-slate-900 rounded-sm" />
        </div>
      </div>
    );
  }
  if (id === 'classic_frame') {
    return (
      <div className="aspect-[3/4] w-full rounded-lg overflow-hidden bg-amber-50 p-2 flex flex-col">
        <div className="h-1.5 bg-amber-700 mb-1.5" />
        <div className="flex-[3] border-2 border-amber-800 p-0.5">
          <div className="w-full h-full bg-gradient-to-br from-yellow-300 to-amber-500" />
        </div>
        <div className="flex-[2] flex flex-col items-center gap-1 pt-2">
          <div className="h-1.5 w-10 bg-amber-700 rounded-sm" />
          <div className="h-2 w-3/4 bg-stone-800 rounded-sm" />
          <div className="h-3 w-1/2 bg-amber-700 rounded-sm" />
          <div className="mt-auto h-px w-6 bg-amber-700" />
        </div>
      </div>
    );
  }
  // side_by_side
  return (
    <div className="aspect-[3/4] w-full rounded-lg overflow-hidden bg-slate-200 flex">
      <div className="w-1/2 bg-gradient-to-br from-yellow-300 to-amber-500" />
      <div className="flex-1 bg-white p-1.5 flex flex-col gap-1">
        <div className="h-1.5 w-12 bg-slate-900 rounded-sm mb-1" />
        <div className="h-1 w-8 bg-amber-500 rounded-sm" />
        <div className="h-2 w-full bg-slate-700 rounded-sm" />
        <div className="h-3 w-full bg-amber-100 rounded-sm border-l-2 border-amber-500" />
        <div className="mt-auto h-2 w-full bg-slate-900 rounded-sm" />
      </div>
    </div>
  );
};
