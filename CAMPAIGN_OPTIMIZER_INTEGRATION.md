# Campaign Optimizer Integration Guide

## ✅ What's Been Implemented

### 1. **Edge Function: `optimize-campaign`**
- Deployed to DEV and QA
- Real-time analysis of campaign data
- Returns optimization score (0-100) and specific suggestions

### 2. **Service Layer: `campaignOptimizerService.ts`**
- Type-safe interface
- Easy-to-use `optimize()` method

---

## 📋 Integration Steps for MerchantMyCampaigns.tsx

### Step 1: Import the Service

Add to imports at top of file:
```typescript
import { campaignOptimizerService, OptimizationResult, OptimizationSuggestion } from './services/campaignOptimizerService';
```

### Step 2: Add State Variables

Add these state variables with other form states:
```typescript
const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null);
const [isOptimizing, setIsOptimizing] = useState(false);
const [showOptimizer, setShowOptimizer] = useState(true); // Toggle optimizer panel
```

### Step 3: Create Optimization Function

Add this function to run real-time optimization:
```typescript
const runOptimization = useCallback(async () => {
  if (!user?.id) return;

  setIsOptimizing(true);

  const campaignData = {
    title: dealTitle,
    discount: dealOffer ? parseFloat(dealOffer) : undefined,
    launch_date: dealStartDate,
    end_date: dealEndDate,
    category: selectedCategory, // If you have category selection
  };

  try {
    const result = await campaignOptimizerService.optimize(user.id, campaignData);
    setOptimizationResult(result);
  } catch (error) {
    console.error('[MerchantMyCampaigns] Optimization error:', error);
  } finally {
    setIsOptimizing(false);
  }
}, [user?.id, dealTitle, dealOffer, dealStartDate, dealEndDate]);
```

### Step 4: Add useEffect to Trigger on Changes

Add this useEffect to run optimization when form fields change:
```typescript
useEffect(() => {
  // Debounce optimization (wait 500ms after user stops typing)
  const timer = setTimeout(() => {
    if (dealTitle || dealOffer || dealStartDate || dealEndDate) {
      runOptimization();
    }
  }, 500);

  return () => clearTimeout(timer);
}, [dealTitle, dealOffer, dealStartDate, dealEndDate, runOptimization]);
```

### Step 5: Add Optimizer UI Panel

Add this component ABOVE or BELOW your form (find the form JSX and insert this):

```tsx
{/* Real-time Campaign Optimizer */}
{showOptimizer && optimizationResult && (
  <div className="mb-6 rounded-xl border-2 border-cyan-500/30 bg-gradient-to-br from-cyan-900/10 to-blue-900/10 p-5">
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <Zap className="w-5 h-5 text-cyan-500" />
        <h3 className="text-sm font-black uppercase tracking-widest text-white">
          Live Optimizer
        </h3>
        {isOptimizing && <Loader2 className="w-4 h-4 text-cyan-500 animate-spin" />}
      </div>
      <button
        onClick={() => setShowOptimizer(false)}
        className="text-slate-400 hover:text-white transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>

    {/* Score Gauge */}
    <div className="flex items-center gap-4 mb-4 p-4 rounded-xl bg-slate-900/50">
      <div className="relative w-20 h-20">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="40"
            cy="40"
            r="35"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="8"
            fill="none"
          />
          <circle
            cx="40"
            cy="40"
            r="35"
            stroke={
              optimizationResult.score >= 85 ? '#10b981' :
              optimizationResult.score >= 70 ? '#3b82f6' :
              optimizationResult.score >= 50 ? '#f59e0b' : '#ef4444'
            }
            strokeWidth="8"
            fill="none"
            strokeDasharray={`${2 * Math.PI * 35}`}
            strokeDashoffset={`${2 * Math.PI * 35 * (1 - optimizationResult.score / 100)}`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-2xl font-black text-white">{optimizationResult.score}</p>
        </div>
      </div>
      <div className="flex-1">
        <p className={`text-sm font-black mb-1 ${
          optimizationResult.grade === 'Excellent' ? 'text-green-400' :
          optimizationResult.grade === 'Good' ? 'text-blue-400' :
          optimizationResult.grade === 'Fair' ? 'text-yellow-400' : 'text-red-400'
        }`}>
          {optimizationResult.grade} Campaign
        </p>
        <p className="text-xs text-slate-400">
          Predicted Engagement: <span className="font-bold text-white">{optimizationResult.predictedEngagement}</span>
        </p>
      </div>
    </div>

    {/* Quick Fixes */}
    {optimizationResult.quickFixes.length > 0 && (
      <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
        <p className="text-xs font-black uppercase tracking-wider text-amber-400 mb-2">
          ⚡ Quick Fixes
        </p>
        <ul className="space-y-1">
          {optimizationResult.quickFixes.map((fix, idx) => (
            <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
              <span className="text-amber-500 mt-0.5">•</span>
              <span>{fix}</span>
            </li>
          ))}
        </ul>
      </div>
    )}

    {/* Suggestions */}
    <div className="space-y-2 max-h-60 overflow-y-auto">
      {optimizationResult.suggestions
        .filter(s => s.field !== 'overall')
        .map((suggestion, idx) => (
          <div
            key={idx}
            className={`p-3 rounded-lg border ${
              suggestion.severity === 'error' ? 'bg-red-900/10 border-red-500/30' :
              suggestion.severity === 'warning' ? 'bg-yellow-900/10 border-yellow-500/30' :
              suggestion.severity === 'success' ? 'bg-green-900/10 border-green-500/30' :
              'bg-blue-900/10 border-blue-500/30'
            }`}
          >
            <div className="flex items-start gap-2">
              {suggestion.severity === 'error' && <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />}
              {suggestion.severity === 'warning' && <AlertCircle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />}
              {suggestion.severity === 'success' && <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />}
              {suggestion.severity === 'info' && <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />}

              <div className="flex-1 min-w-0">
                <p className={`text-xs font-bold mb-1 ${
                  suggestion.severity === 'error' ? 'text-red-400' :
                  suggestion.severity === 'warning' ? 'text-yellow-400' :
                  suggestion.severity === 'success' ? 'text-green-400' :
                  'text-blue-400'
                }`}>
                  {suggestion.message}
                </p>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  {suggestion.suggestion}
                </p>
                {suggestion.impact && (
                  <p className="text-[9px] text-slate-500 mt-1">
                    Impact: {suggestion.impact}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
    </div>
  </div>
)}

{/* Show Optimizer Button (if hidden) */}
{!showOptimizer && (
  <button
    onClick={() => setShowOptimizer(true)}
    className="mb-4 w-full px-4 py-2 rounded-lg bg-cyan-600 text-white text-sm font-bold hover:bg-cyan-500 transition-colors flex items-center justify-center gap-2"
  >
    <Zap className="w-4 h-4" />
    Show Campaign Optimizer
  </button>
)}
```

---

## 🎯 How It Works

1. **User starts filling form** → Title, discount, dates
2. **After 500ms of no changes** → Optimization runs automatically
3. **Edge Function analyzes** → Returns score and suggestions
4. **UI updates in real-time** → Shows what's good/bad
5. **User sees instant feedback** → Can adjust before submitting

---

## 📊 What Gets Analyzed

### ✅ Discount Percentage
- ❌ Below 5%: "Too low, won't attract"
- ⚠️ 5-10%: "Below optimal"
- ✅ 10-30%: "Perfect range!"
- ⚠️ 30-50%: "Higher than needed"
- ❌ Above 50%: "Too high, margin concerns"

### ✅ Launch Date
- ❌ Less than 2 days ahead: "Required minimum"
- ⚠️ Not Friday: "Friday gets 4.5x better results"
- ⚠️ Not 6-8 PM: "Evening launch recommended"
- ✅ Friday 6-8 PM: "Perfect timing!"

### ✅ Duration
- ❌ Not 15 days: "Must be exactly 15 days"
- ✅ Exactly 15 days: "Optimal duration"

### ✅ Title
- ⚠️ < 10 chars: "Too short"
- ℹ️ 10-30 chars: "Could be longer"
- ✅ 30-60 chars: "Perfect length!"
- ⚠️ > 60 chars: "Too long, will be cut off"
- ⚠️ ALL CAPS: "Appears spammy"

### ✅ Category
- ℹ️ Matches top inventory: "Good choice!"
- ℹ️ Doesn't match: "Consider your top category"

---

## 🚀 Testing

1. **Open Campaigns page**
2. **Click "Create New Campaign"**
3. **Start filling the form:**
   - Enter a short title (< 10 chars) → See warning
   - Enter 5% discount → See warning
   - Pick tomorrow as start date → See error
   - Pick Friday + 3 days from now → See warning change to success
   - Change discount to 20% → See success
   - Enter a 40-character title → See success

4. **Watch the score update** as you improve fields
5. **See "Quick Fixes"** for biggest improvements

---

## 💡 Future Enhancements

- Auto-apply suggested values with one click
- Historical performance comparison
- A/B test suggestions
- Image quality analysis
- SEO optimization tips

---

**Status:** ✅ Backend Complete, 🔧 Frontend Integration Needed
