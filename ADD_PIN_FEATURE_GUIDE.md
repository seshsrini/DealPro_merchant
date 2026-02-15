# 📌 Add Pin Feature to Campaign Details

Complete guide to add a pin icon next to the favorites heart icon in the deal details page.

---

## 🎯 Overview

**What we're adding:**
- 📌 Pin icon next to the heart icon
- Allows users to pin deals for future reference
- Similar to bookmarks/saved items

---

## ✅ Step 1: Run SQL Migration

Create the `pinned_deals` table in your database:

1. Open Supabase SQL Editor
2. Copy contents from: `supabase/migrations/create_pinned_deals_table.sql`
3. Run the SQL
4. Verify table was created:
   ```sql
   SELECT * FROM pinned_deals;
   ```

---

## ✅ Step 2: Update CampaignDetails Component

### File: `CampaignDetails.tsx`

### 2.1: Add Imports

**At the top of the file** (around line 1-25), add:

```typescript
import { pinnedDealsService } from './services/pinnedDealsService';
import { Pin } from 'lucide-react'; // Add Pin to the imports from lucide-react
```

**Update the lucide-react import** (around line 9-25):
```typescript
import {
  Heart,
  Loader2,
  X,
  MapPin,
  Navigation,
  ShieldCheck,
  QrCode,
  Map,
  Clock,
  Info,
  Tag,
  Calendar,
  CheckCircle2,
  Star,
  Sparkles,
  Pin  // ← Add this
} from 'lucide-react';
```

---

### 2.2: Add Pin State

**Inside the component** (around line 53, after other state declarations):

```typescript
// Add this state
const [isPinned, setIsPinned] = useState(false);
const [isPinning, setIsPinning] = useState(false);
```

---

### 2.3: Check Pin Status on Mount

**Add this useEffect** (around line 79, after other useEffects):

```typescript
// Check if deal is pinned when component mounts
useEffect(() => {
  const checkPinStatus = async () => {
    if (user?.id && deal.campaign_id) {
      const pinned = await pinnedDealsService.isPinned(user.id, deal.campaign_id);
      setIsPinned(pinned);
    }
  };
  checkPinStatus();
}, [user?.id, deal.campaign_id]);
```

---

### 2.4: Add Toggle Pin Handler

**Add this function** (around line 100, after other handlers):

```typescript
const handleTogglePin = async () => {
  if (!user?.id || !deal.campaign_id || !deal.merchantId) {
    console.error('[Pin] Missing required data');
    return;
  }

  setIsPinning(true);
  try {
    const { success, isPinned: newPinState } = await pinnedDealsService.togglePin(
      user.id,
      deal.campaign_id,
      deal.merchantId
    );

    if (success) {
      setIsPinned(newPinState);
      console.log(`[Pin] Deal ${newPinState ? 'pinned' : 'unpinned'}`);
    } else {
      console.error('[Pin] Failed to toggle pin');
    }
  } catch (error) {
    console.error('[Pin] Error toggling pin:', error);
  } finally {
    setIsPinning(false);
  }
};
```

---

### 2.5: Add Pin Button in UI

**Find the favorites button** (around line 188-198), and **add the pin button right after it**:

```typescript
<div className="relative flex gap-4">
  {/* Enhanced favorite button */}
  <button
    onClick={() => onToggleFavorite(deal)}
    className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all active:scale-95 border-2 shadow-lg ${
      isFav
        ? 'bg-gradient-to-br from-rose-500/30 to-pink-500/30 text-rose-400 border-rose-500/50 shadow-rose-500/30'
        : 'glass text-slate-500 border-white/10 hover:border-rose-500/30 hover:text-rose-400'
    }`}
  >
    <Heart className={`w-7 h-7 transition-all ${isFav ? 'fill-current animate-pulse' : ''}`} />
  </button>

  {/* ✨ NEW: Pin button - ADD THIS */}
  <button
    onClick={handleTogglePin}
    disabled={isPinning}
    className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all active:scale-95 border-2 shadow-lg ${
      isPinned
        ? 'bg-gradient-to-br from-blue-500/30 to-indigo-500/30 text-blue-400 border-blue-500/50 shadow-blue-500/30'
        : 'glass text-slate-500 border-white/10 hover:border-blue-500/30 hover:text-blue-400'
    }`}
  >
    {isPinning ? (
      <Loader2 className="w-7 h-7 animate-spin" />
    ) : (
      <Pin className={`w-7 h-7 transition-all ${isPinned ? 'fill-current' : ''}`} />
    )}
  </button>

  {/* Existing redeem button continues here... */}
  <div className="flex-1">
    <button
      onClick={() => onRedeem(deal)}
      ...
```

---

## 🎨 Styling Notes

The pin button uses:
- **Blue gradient** when pinned (vs pink for favorites)
- **Same size and style** as favorites button
- **Loading spinner** when pinning/unpinning
- **Fill animation** when pinned (like favorites)

---

## 🧪 Testing

### Test 1: Pin a Deal
1. Open a deal details page
2. Click the pin icon 📌
3. Icon should turn blue and fill
4. Check database:
   ```sql
   SELECT * FROM pinned_deals WHERE user_id = 'YOUR_USER_ID';
   ```

### Test 2: Unpin a Deal
1. Click the blue pin icon again
2. Icon should turn gray and unfill
3. Check database - pin should be deleted

### Test 3: Pin Persistence
1. Pin a deal
2. Close the deal details page
3. Reopen the same deal
4. Pin icon should still be blue (pinned state restored)

---

## 📊 Database Queries

### Get all pinned deals for a user:
```sql
SELECT
  pd.campaign_id,
  c.deal_heading,
  c.offer_value,
  c.shop_name,
  pd.created_at
FROM pinned_deals pd
INNER JOIN campaigns c ON pd.campaign_id = c.campaign_id
WHERE pd.user_id = 'YOUR_USER_ID'
ORDER BY pd.created_at DESC;
```

### Check pin count:
```sql
SELECT COUNT(*) FROM pinned_deals WHERE user_id = 'YOUR_USER_ID';
```

---

## 🚀 Optional: Add "My Pins" Page

To show all pinned deals in a dedicated page, use:

```typescript
import { pinnedDealsService } from './services/pinnedDealsService';

const MyPinsPage = ({ user }) => {
  const [pinnedDeals, setPinnedDeals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPinnedDeals();
  }, []);

  const loadPinnedDeals = async () => {
    const deals = await pinnedDealsService.getUserPinnedDeals(user.id);
    setPinnedDeals(deals);
    setLoading(false);
  };

  if (loading) return <div>Loading pins...</div>;

  return (
    <div>
      <h1>My Pinned Deals ({pinnedDeals.length})</h1>
      {pinnedDeals.map(item => (
        <div key={item.id}>
          <h3>{item.campaigns?.deal_heading}</h3>
          <p>{item.campaigns?.offer_value}</p>
        </div>
      ))}
    </div>
  );
};
```

---

## ✅ Complete Checklist

```
[ ] SQL migration run (pinned_deals table created)
[ ] pinnedDealsService.ts imported in CampaignDetails.tsx
[ ] Pin icon imported from lucide-react
[ ] isPinned state added
[ ] isPinning state added
[ ] useEffect to check pin status added
[ ] handleTogglePin function added
[ ] Pin button UI added (after favorites button)
[ ] Tested pinning a deal
[ ] Tested unpinning a deal
[ ] Tested pin persistence (close/reopen)
```

---

## 🎯 Summary

**What Users Can Do:**
- ✅ Pin deals they want to reference later
- ✅ Unpin deals they no longer need
- ✅ See pinned status immediately (blue icon)
- ✅ Pins persist across sessions

**Technical Implementation:**
- Database: `pinned_deals` table
- Service: `pinnedDealsService` with pin/unpin methods
- UI: Blue pin icon next to pink heart icon
- State: Real-time pin status tracking

---

All set! Users can now pin deals for future reference! 📌
