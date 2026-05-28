
import React from 'react';
import { AppView, Deal } from './types';
import { MerchantMyCampaigns } from './MerchantMyCampaigns.tsx';

interface MerchantDealOfDayProps {
  user: any;
  deals: Deal[];
  loading: boolean;
  setLoading: (loading: boolean) => void;
  refreshDeals: () => Promise<void>;
  setView: (view: AppView) => void;
  theme?: 'light' | 'dark';
  setDealIdToEdit?: (id: string | null) => void;
}

export const MerchantDealOfDay: React.FC<MerchantDealOfDayProps> = (props) => {
  return <MerchantMyCampaigns {...props} mode="dotd_only" />;
};
