import { useState, useEffect, useCallback, useRef, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Camera,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  RefreshCw,
  Image as ImageIcon,
  AlertCircle,
  Globe,
  Search,
  Download,
  Info,
  Newspaper,
} from 'lucide-react';
import { searchGroundImages, type GroundImageResult } from '../services/imageSearch';

interface MediaGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventName: string;
  eventDate?: string;
  eventType?: string;
  eventSeverity?: string;
}

export default function MediaGalleryModal({
  isOpen,
  onClose,
  eventName,
  eventDate,
  eventType,
  eventSeverity,
}: MediaGalleryModalProps) {
  const [items, setItems] = useState<GroundImageResult[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [inputValue, setInputValue] = useState<string>('');
  const [activeQuery, setActiveQuery] = useState<string>('');
  const [refreshIndex, setRefreshIndex] = useState<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Default query pattern for disaster damage/aftermath photojournalism
  const buildDefaultQuery = useCallback((name: string) => {
    return name.replace(/\(.*?\)/g, '').trim();
  }, []);

  // Fetch real web images based on query with AbortController cancellation
  const performSearch = useCallback(
    async (queryToRun: string, options?: { forceRefresh?: boolean }, signal?: AbortSignal) => {
      const cleanQuery = queryToRun.trim();
      if (!cleanQuery || cleanQuery.length < 2) return;

      // Abort any prior in-flight search request to prevent race conditions
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const combinedSignal = signal || controller.signal;

      setLoading(true);
      setError(null);
      setSelectedIndex(null);
      setActiveQuery(cleanQuery);

      try {
        const results = await searchGroundImages(eventName, cleanQuery, combinedSignal, {
          forceRefresh: options?.forceRefresh,
          eventType,
        });
        if (!combinedSignal.aborted) {
          setItems(results);
        }
      } catch (err: any) {
        if (err.name === 'AbortError' || combinedSignal.aborted) {
          // Silently ignore superseded or aborted requests
          return;
        }
        console.error('Image search failed:', err);
        setError('Unable to load ground imagery at this time. Please check your connection or try another search.');
      } finally {
        if (!combinedSignal.aborted) {
          setLoading(false);
        }
      }
    },
    [eventName, eventType]
  );

  // Trigger search with cache busting on refresh
  const handleRefresh = useCallback(() => {
    if (loading) return;
    const target = inputValue.trim() || activeQuery.trim() || buildDefaultQuery(eventName);
    if (!target) return;
    setActiveQuery(target);
    setRefreshIndex((prev) => prev + 1);
    performSearch(target, { forceRefresh: true });
  }, [loading, inputValue, activeQuery, eventName, buildDefaultQuery, performSearch]);

  // Reset and search when modal opens or event settles
  useEffect(() => {
    if (isOpen && eventName) {
      const initialQuery = buildDefaultQuery(eventName);
      setInputValue(initialQuery);
      setActiveQuery(initialQuery);
      performSearch(initialQuery);
    } else {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setSelectedIndex(null);
      setItems([]);
      setError(null);
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [isOpen, eventName, buildDefaultQuery, performSearch]);

  // Manage body overflow and touchAction styles cleanly when modal opens/closes
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    return () => {
      document.body.style.overflow = originalOverflow || '';
      document.body.style.touchAction = originalTouchAction || '';
    };
  }, [isOpen]);

  useEffect(() => {
    return () => {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }, []);

  // Handle keyboard navigation for Lightbox
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedIndex !== null) {
          setSelectedIndex(null);
        } else {
          onClose();
        }
      } else if (selectedIndex !== null) {
        if (e.key === 'ArrowRight') {
          setSelectedIndex((prev) =>
            prev !== null && prev < items.length - 1 ? prev + 1 : 0
          );
        } else if (e.key === 'ArrowLeft') {
          setSelectedIndex((prev) =>
            prev !== null && prev > 0 ? prev - 1 : items.length - 1
          );
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, items.length, onClose]);

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  const currentItem = selectedIndex !== null ? items[selectedIndex] : null;

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    const target = inputValue.trim();
    if (target) {
      setActiveQuery(target);
      performSearch(target);
    }
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="media-gallery-title"
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm overflow-hidden h-[100dvh]"
    >
      {/* Backdrop touch target */}
      <div
        className="fixed inset-0 -z-10 cursor-pointer"
        onClick={() => {
          if (selectedIndex !== null) {
            setSelectedIndex(null);
          } else {
            onClose();
          }
        }}
      />

      <div
        className="relative w-full sm:max-w-4xl lg:max-w-5xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-2xl sm:rounded-2xl flex flex-col h-[85dvh] max-h-[85dvh] sm:h-auto sm:max-h-[85vh] shadow-2xl overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex-shrink-0 flex items-start justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/90 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
              <Camera className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2
                  id="media-gallery-title"
                  className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate"
                >
                  Ground Images &amp; News Coverage
                </h2>
                {eventType && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    {eventType}
                  </span>
                )}
                {eventSeverity && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    {eventSeverity} Severity
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {eventName} {eventDate ? `· ${eventDate}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              title="Refresh Image Search"
              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-emerald-500' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Close modal (Esc)"
              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Manual Search Query Bar */}
        <div className="flex-shrink-0 px-4 sm:px-5 py-2.5 bg-slate-50 dark:bg-slate-950/40 border-b border-slate-100 dark:border-slate-800">
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Search ground photojournalism, flood aftermath, disaster damage..."
                className="w-full pl-9 pr-9 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={handleRefresh}
                disabled={loading}
                title="Refresh image search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-emerald-500' : ''}`} />
              </button>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-all disabled:opacity-50 cursor-pointer shadow-sm shrink-0"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </form>
          {activeQuery && (
            <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 px-0.5">
              <div className="flex items-center gap-2 truncate">
                <span className="truncate">
                  Showing results for: <span className="font-mono text-emerald-600 dark:text-emerald-400 font-medium">"{activeQuery}"</span>
                </span>
                {items.some((it) => it.domain === 'commons.wikimedia.org') && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 shrink-0">
                    <Globe className="h-2.5 w-2.5 text-emerald-500" />
                    <span>Wikimedia Commons</span>
                  </span>
                )}
                {items.some((it) => it.isFallback) && (
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium shrink-0">
                    · Regional archive imagery
                  </span>
                )}
              </div>
              <span className="shrink-0 font-medium">
                {items.length} photo{items.length !== 1 ? 's' : ''} found
              </span>
            </div>
          )}
        </div>

        {/* Scrollable Gallery Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4">
          {/* Lightbox / Detail view */}
          {currentItem ? (
            <div className="flex flex-col lg:flex-row gap-4 h-full animate-fade-in">
              {/* Image Display */}
              <div className="relative flex-1 flex flex-col items-center justify-center bg-black/95 rounded-xl overflow-hidden min-h-[220px] sm:min-h-[320px] max-h-[40vh] sm:max-h-[58vh]">
                <img
                  src={currentItem.imageUrl || currentItem.thumbnailUrl}
                  alt={currentItem.title}
                  className="max-h-[54vh] w-auto max-w-full object-contain select-none"
                  loading="lazy"
                  onError={(e) => {
                    if (e.currentTarget.src !== currentItem.thumbnailUrl && currentItem.thumbnailUrl) {
                      e.currentTarget.src = currentItem.thumbnailUrl;
                    } else if (e.currentTarget.src !== currentItem.imageUrl && currentItem.imageUrl) {
                      e.currentTarget.src = currentItem.imageUrl;
                    } else {
                      e.currentTarget.classList.add('hidden');
                    }
                  }}
                />

                {/* Lightbox Navigation Buttons */}
                <button
                  type="button"
                  onClick={() =>
                    setSelectedIndex((prev) =>
                      prev !== null && prev > 0 ? prev - 1 : items.length - 1
                    )
                  }
                  title="Previous (Arrow Left)"
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 hover:bg-black/90 text-white/80 hover:text-white transition-all cursor-pointer backdrop-blur-sm"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedIndex((prev) =>
                      prev !== null && prev < items.length - 1 ? prev + 1 : 0
                    )
                  }
                  title="Next (Arrow Right)"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 hover:bg-black/90 text-white/80 hover:text-white transition-all cursor-pointer backdrop-blur-sm"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>

                <div className="absolute bottom-2 left-3 text-[11px] font-mono text-white/60 bg-black/50 px-2 py-0.5 rounded backdrop-blur-sm">
                  {((selectedIndex ?? 0) + 1)} / {items.length}
                </div>
              </div>

              {/* Sidebar Info Drawer */}
              <div className="w-full lg:w-80 flex flex-col justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 p-4">
                <div className="space-y-3 overflow-y-auto max-h-[45vh] pr-1">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                      <Newspaper className="h-3 w-3" />
                      <span>{currentItem.domain}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedIndex(null)}
                      className="text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white underline cursor-pointer"
                    >
                      Back to grid
                    </button>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug break-words">
                      {currentItem.title}
                    </h4>
                  </div>

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <Globe className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">
                        <strong>Publisher:</strong> {currentItem.domain}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 mt-2">
                  {currentItem.sourceUrl && (
                    <a
                      href={currentItem.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-sm"
                    >
                      <span>
                        {currentItem.domain === 'commons.wikimedia.org'
                          ? 'View on Wikimedia Commons'
                          : 'Read Source Article'}
                      </span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  <a
                    href={currentItem.imageUrl || currentItem.thumbnailUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                    title="Open original resolution image"
                  >
                    <Download className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </div>
          ) : loading ? (
            /* Skeleton Loading Grid */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
              {Array.from({ length: 8 }).map((_, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 overflow-hidden animate-pulse flex flex-col"
                >
                  <div className="aspect-[4/3] bg-slate-200 dark:bg-slate-800" />
                  <div className="p-3 space-y-2">
                    <div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded w-3/4" />
                    <div className="h-2.5 bg-slate-200 dark:bg-slate-800 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            /* Error State */
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-3 rounded-full bg-rose-500/10 text-rose-500 mb-3">
                <AlertCircle className="h-8 w-8" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Image Search Error</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1">{error}</p>
              <button
                type="button"
                onClick={handleRefresh}
                className="mt-4 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors shadow-sm cursor-pointer"
              >
                Try Again
              </button>
            </div>
          ) : items.length === 0 ? (
            /* Empty State */
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-3 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 mb-3">
                <ImageIcon className="h-8 w-8" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                No Ground Photos Found
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mt-1">
                No photos returned for "{activeQuery}". Try one of the regional disaster queries below:
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const q = 'Iloilo flood';
                    setInputValue(q);
                    setActiveQuery(q);
                    performSearch(q);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors shadow-sm cursor-pointer"
                >
                  <Search className="h-3.5 w-3.5" />
                  <span>Iloilo Floods</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const q = 'Western Visayas typhoon';
                    setInputValue(q);
                    setActiveQuery(q);
                    performSearch(q);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors shadow-sm cursor-pointer"
                >
                  <Search className="h-3.5 w-3.5" />
                  <span>Western Visayas Typhoon</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const q = 'Panay flood';
                    setInputValue(q);
                    setActiveQuery(q);
                    performSearch(q);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors shadow-sm cursor-pointer"
                >
                  <Search className="h-3.5 w-3.5" />
                  <span>Panay Flood</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const broader = `${eventName.replace(/\(.*?\)/g, '').trim()} Philippines`;
                    setInputValue(broader);
                    setActiveQuery(broader);
                    performSearch(broader);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shadow-sm cursor-pointer"
                >
                  <Search className="h-3.5 w-3.5" />
                  <span>Broader Search</span>
                </button>
              </div>
            </div>
          ) : (
            /* News Wire Image Cards Grid */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
              {items.map((item, index) => (
                <div
                  key={`${item.id}-${index}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedIndex(index)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedIndex(index);
                    }
                  }}
                  className="group relative flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-emerald-500/60 dark:hover:border-emerald-500/50 hover:shadow-lg dark:hover:shadow-emerald-950/20 transition-all overflow-hidden cursor-pointer text-left"
                >
                  {/* Thumbnail Container */}
                  <div className="relative aspect-[4/3] bg-slate-950/80 overflow-hidden flex items-center justify-center">
                    {/* Fallback styled placeholder when image fails and is hidden */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-slate-500 pointer-events-none select-none">
                      <ImageIcon className="h-8 w-8 text-slate-600 mb-1" />
                      <span className="text-[10px] text-slate-400 text-center line-clamp-2">{item.title}</span>
                    </div>

                    <img
                      src={item.thumbnailUrl}
                      alt={item.title}
                      loading="lazy"
                      onError={(e) => {
                        // Fallback to full image URL or hide if CDN thumbnail fails
                        if (e.currentTarget.src !== item.imageUrl && item.imageUrl) {
                          e.currentTarget.src = item.imageUrl;
                        } else {
                          e.currentTarget.classList.add('hidden');
                        }
                      }}
                      className="relative z-1 h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 z-2 bg-gradient-to-t from-black/70 via-transparent to-black/20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                    {/* Publisher Domain Tag Pill (Brave / Google Images style) */}
                    <div className="absolute top-2 left-2 z-3 flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/75 text-white/95 text-[10px] font-semibold tracking-wide backdrop-blur-xs shadow-sm border border-white/10">
                      <Globe className="h-2.5 w-2.5 text-emerald-400 shrink-0" />
                      <span className="truncate max-w-[125px]">{item.domain}</span>
                    </div>

                    {/* Hover Expand Icon */}
                    <div className="absolute bottom-2 right-2 z-3 p-1.5 rounded-md bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-xs">
                      <Maximize2 className="h-3.5 w-3.5" />
                    </div>
                  </div>

                  {/* Card Meta */}
                  <div className="p-3 flex-1 flex flex-col justify-between">
                    <div>
                      <h4
                        className="text-xs font-semibold text-slate-800 dark:text-slate-100 line-clamp-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors leading-snug"
                        title={item.title}
                      >
                        {item.title}
                      </h4>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-400 mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                      <span className="truncate max-w-[140px] font-medium" title={item.domain}>
                        {item.domain}
                      </span>
                      <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 font-medium">
                        <span>Inspect</span>
                        <ChevronRight className="h-2.5 w-2.5" />
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 p-3 px-4 sm:px-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/90 flex flex-wrap items-center justify-between text-xs text-slate-500 dark:text-slate-400 gap-2 sm:gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 flex-1 min-w-[240px]">
            <Info className="w-4 h-4 shrink-0 text-slate-400" />
            <span>
              Disaster aftermath imagery indexed from news and wire services. If images appear irrelevant or outdated, click the <strong>Refresh</strong> button to pull alternative coverage.
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer shrink-0"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export { MediaGalleryModal };
