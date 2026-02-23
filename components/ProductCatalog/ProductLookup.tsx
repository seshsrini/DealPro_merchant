/**
 * ProductLookup.tsx
 * Search panel for finding products via barcode or name.
 * Powered by Google Shopping (SerpApi) — no category selection needed.
 */

import React, { useState } from 'react';
import { Search, ScanLine, Loader2, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { productLookupService, ProductData } from '../../services/productLookupService';
import { CATEGORY_SCHEMAS, getSchemaForCategory } from '../../data/formSchema';

interface ProductLookupProps {
  hintCategory?: string;   // schema id or label — used as detectedSchemaId on results
  onResult: (product: ProductData) => void;
  theme: 'light' | 'dark';
}

type SearchMode = 'name' | 'barcode';

export const ProductLookup: React.FC<ProductLookupProps> = ({
  hintCategory = '',
  onResult,
  theme,
}) => {
  const isDark = theme === 'dark';
  const schemaId = getSchemaForCategory(hintCategory).id;

  const [mode, setMode] = useState<SearchMode>('name');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ProductData[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    setResults([]);
    try {
      if (mode === 'barcode') {
        const data = await productLookupService.lookupByBarcode(q);
        if (data) {
          setResults([data]);
        } else {
          setError('No product found for this barcode. Try searching by name.');
        }
      } else {
        const data = await productLookupService.lookupByNameMultiple(q, schemaId);
        if (data.length > 0) {
          setResults(data);
        } else {
          setError('No products found. Try a different search term.');
        }
      }
    } catch {
      setError('Search failed. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleSelect = (product: ProductData) => {
    onResult(product);
    setResults([]);
    setQuery('');
  };

  const clearAll = () => {
    setQuery('');
    setResults([]);
    setError(null);
  };

  return (
    <div className="space-y-3">

      {/* Mode toggle (name vs barcode) */}
      <div className={`flex rounded-lg p-1 gap-1 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
        {(['name', 'barcode'] as SearchMode[]).map(m => (
          <button
            key={m}
            type="button"
            onClick={() => { setMode(m); clearAll(); }}
            className={`flex-1 py-2 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
              mode === m
                ? 'bg-slate-900 text-white'
                : isDark ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            {m === 'name' ? <Search className="w-3.5 h-3.5" /> : <ScanLine className="w-3.5 h-3.5" />}
            {m === 'name' ? 'Search by Name' : 'Barcode / ISBN'}
          </button>
        ))}
      </div>

      {/* Search input — prominent with border */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
          <input
            type={mode === 'barcode' ? 'number' : 'text'}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={mode === 'barcode' ? 'Enter barcode or ISBN number...' : 'Type any product name to search...'}
            className={`w-full h-11 pl-10 pr-10 rounded-lg text-xs font-medium border outline-none transition-all ${
              isDark
                ? 'bg-slate-800 border-slate-600 text-white placeholder-slate-500 focus:border-slate-400'
                : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-slate-500'
            }`}
          />
          {(query || results.length > 0) && (
            <button
              type="button"
              onClick={clearAll}
              className={`absolute right-3 top-1/2 -translate-y-1/2 transition-colors ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={handleSearch}
          disabled={loading || !query.trim()}
          className="h-11 px-4 rounded-lg bg-slate-900 text-white shrink-0 disabled:opacity-40 active:scale-[0.97] transition-all"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className={`flex items-center gap-2 p-3 rounded-lg border ${
          isDark ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-200'
        }`}>
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <span className={`text-xs font-medium ${isDark ? 'text-red-300' : 'text-red-600'}`}>{error}</span>
        </div>
      )}

      {/* Results list */}
      {results.length > 0 && (
        <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
          {results.length > 1 && (
            <div className={`px-4 py-2 text-xs font-medium ${
              isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-50 text-slate-500'
            }`}>
              {results.length} results — tap to select
            </div>
          )}

          <div className={`divide-y overflow-y-auto max-h-[420px] ${isDark ? 'divide-slate-800' : 'divide-slate-100'}`}>
          {results.map((product, idx) => {
            const schemaLabel =
              CATEGORY_SCHEMAS.find(s => s.id === product.detectedSchemaId)?.label ?? product.category;

            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelect(product)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all active:scale-[0.99] ${
                  isDark
                    ? 'bg-slate-900 hover:bg-slate-800'
                    : 'bg-white hover:bg-slate-50'
                }`}
              >
                {/* Thumbnail */}
                <div className={`w-12 h-12 rounded-lg overflow-hidden shrink-0 flex items-center justify-center ${
                  isDark ? 'bg-slate-800' : 'bg-slate-100'
                }`}>
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-full object-contain"
                      onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <span className={`text-[8px] font-medium ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>IMG</span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 space-y-0.5">
                  <p className={`text-sm font-medium leading-snug line-clamp-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {product.name || 'Unknown'}
                  </p>
                  {product.brand && (
                    <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {product.brand}
                    </p>
                  )}
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                      isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
                    }`}>
                      <CheckCircle2 className="w-2.5 h-2.5" />{schemaLabel.split(' ')[0]}
                    </span>
                    <span className={`text-[10px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                      {product.sourceApi}
                    </span>
                  </div>
                </div>

                <span className={`shrink-0 text-xs font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Select</span>
              </button>
            );
          })}
          </div>
        </div>
      )}

      {/* Hint text */}
      {results.length === 0 && !error && !loading && (
        <p className={`text-xs text-center leading-relaxed ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          {mode === 'barcode'
            ? 'Enter any UPC / EAN barcode or ISBN to auto-fill product details.'
            : 'Powered by Google Shopping — search any product across all categories.'}
        </p>
      )}
    </div>
  );
};
