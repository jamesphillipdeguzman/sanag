import { apiFetch } from './apiService';

export interface GroundImageResult {
  id: string;
  title: string;
  thumbnailUrl: string;
  imageUrl?: string;
  sourceUrl: string;
  domain: string;
}

/**
 * Keyless photojournalism image search pipeline powered by DuckDuckGo backend route.
 * Calls /api/search-event-images?q=${encodeURIComponent(cleanEventName)}.
 */
export async function searchGroundImages(
  eventName: string,
  customQuery?: string
): Promise<GroundImageResult[]> {
  const cleanEventName = (customQuery || eventName).replace(/\(.*?\)/g, '').trim();

  try {
    const res = await apiFetch(`/api/search-event-images?q=${encodeURIComponent(cleanEventName)}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        return data;
      }
    }
  } catch (err) {
    console.warn('Backend image search proxy unreachable:', err);
  }

  return [];
}
