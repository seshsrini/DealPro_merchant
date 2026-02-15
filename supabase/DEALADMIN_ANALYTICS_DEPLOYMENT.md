# DealAdmin Analytics Deployment Guide

## What Was Added

### 1. **New Analytics Tab in Bottom Navigation**
   - Added "Analytics" icon to DealAdmin bottom navigation
   - Uses TrendingUp icon from lucide-react
   - Positioned between "Console" and "Admin" tabs

### 2. **Analytics Dashboard Component** (`DealAdminAnalytics.tsx`)
   - **Key Metrics Cards:**
     - Total Campaigns
     - Active Campaigns
     - Total Merchants
     - Categories with deals

   - **Status Breakdown:**
     - Approved campaigns (green)
     - Pending campaigns (yellow)
     - Needs Review (orange)
     - Rejected campaigns (red)

   - **Campaign Creation Trend Chart:**
     - Horizontal bar chart showing campaigns created per day
     - Selectable periods: 7, 30, or 90 days
     - Color gradient from blue to purple

   - **Category Distribution:**
     - Horizontal bar chart showing campaigns per store category
     - Percentage breakdown
     - Donut/pie chart visualization
     - Shows only categories that have at least one campaign
     - Color-coded with 8 distinct colors

### 3. **Edge Function** (`dealadmin-analytics`)
   - Fetches analytics data from Supabase
   - Requires dealadmin role
   - Provides data for:
     - Total and active campaign counts
     - Merchant counts
     - Category distribution (only categories with deals)
     - Campaign creation trends over time
     - Campaign status breakdown

## Files Modified

1. **components/Navigation.tsx**
   - Added TrendingUp icon import
   - Added Analytics tab to DealAdminBottomNav

2. **types.ts**
   - Added 'dealadmin_analytics' to AppView type

3. **App.tsx**
   - Added 'dealadmin_analytics' to navigation list

4. **DealAdminStack.tsx**
   - Imported DealAdminAnalytics component
   - Added routing for dealadmin_analytics view

## Files Created

1. **DealAdminAnalytics.tsx**
   - Main analytics dashboard component
   - Period selector (7/30/90 days)
   - Multiple chart visualizations
   - Responsive grid layout

2. **supabase/dealadmin-analytics/index.ts**
   - Edge Function for fetching analytics data
   - Authenticates dealadmin users
   - Aggregates data from campaigns and user_profiles tables

## Deployment Steps

### 1. Deploy the Edge Function

```bash
cd C:/Srini/dealpro/dev/dealpro
supabase functions deploy dealadmin-analytics
```

### 2. Verify Deployment

```bash
supabase functions list
```

You should see `dealadmin-analytics` in the list.

### 3. Test the Analytics Page

1. Login as a dealadmin user
2. Navigate to the Analytics tab (3rd icon from left in bottom nav)
3. Verify that:
   - Key metrics display correctly
   - Status breakdown shows campaign counts
   - Campaign trend chart renders
   - Category pie chart and bars render
   - Period selector (7/30/90 days) works

### 4. Verify Data

The analytics show:
- **Total Campaigns**: All campaigns in the database
- **Active Campaigns**: Approved campaigns with end_date >= today
- **Total Merchants**: All users with role='merchant'
- **Categories with Deals**: Only store categories that have at least 1 campaign
- **Campaign Trend**: Campaigns created in the selected period (7/30/90 days)
- **Status Breakdown**: Count of campaigns by status (approved, pending, needs_review, rejected)

## Features

### Visual Design
- Glass morphism effect matching app theme
- Dark mode compatible
- Color-coded charts with 8 distinct colors
- Animated transitions
- Responsive layout

### Chart Types
1. **Horizontal Bar Charts**: Campaign trend and category distribution
2. **Donut/Pie Chart**: Category distribution with SVG rendering
3. **Metric Cards**: Key statistics with icons

### Period Selection
- 7 days - Recent short-term trends
- 30 days - Monthly overview (default)
- 90 days - Quarterly trends

### Error Handling
- Loading state with spinner
- Error state with retry button
- Graceful handling of missing data

## Database Schema Requirements

The Edge Function expects these tables:
- **campaigns**: campaign_id, merchant_id, status, created_at, start_date, end_date
- **user_profiles**: id, role, category

Statuses expected:
- 'approved'
- 'pending'
- 'needs_review'
- 'rejected'

## Testing Checklist

- [ ] Analytics tab appears in DealAdmin bottom navigation
- [ ] Clicking Analytics tab navigates to dashboard
- [ ] Key metrics display with correct counts
- [ ] Status breakdown shows color-coded counts
- [ ] Campaign trend chart renders with bars
- [ ] Category distribution shows bars and percentages
- [ ] Donut chart renders in center
- [ ] Period selector changes data (7/30/90 days)
- [ ] Loading state shows when fetching data
- [ ] Error state shows if Edge Function fails
- [ ] Works in both dark and light themes

## Troubleshooting

### Issue: Analytics shows error
**Solution:**
1. Check Edge Function is deployed: `supabase functions list`
2. Check browser console for errors
3. Verify dealadmin user is authenticated
4. Check Edge Function logs in Supabase dashboard

### Issue: Charts show no data
**Solution:**
1. Verify campaigns exist in database
2. Check that merchants have category set in user_profiles
3. Verify campaigns have valid created_at dates
4. Check browser console for data structure

### Issue: 401 Unauthorized
**Solution:**
1. Verify user has role='dealadmin' in user_profiles table
2. Check authentication token is being passed
3. Verify Edge Function authentication logic

## Future Enhancements

Potential additions:
- Export analytics as PDF/CSV
- More granular date range selector
- Campaign performance metrics (views, redemptions)
- Merchant leaderboard
- Revenue/subscription analytics
- Geographic distribution map
- Time-of-day analysis
- Comparative period analysis (vs previous period)
