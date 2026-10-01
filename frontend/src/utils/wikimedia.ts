import { searchGroundImages, type GroundImageResult } from '../services/imageSearch';

export interface WikimediaMediaItem {
  id: string | number;
  title: string;
  thumbUrl: string;
  fullUrl: string;
  sourceUrl: string;
  license: string;
  artist: string;
  description?: string;
  isVideo: boolean;
}

/**
 * Replaced Wikimedia Commons fetching with real web search / Brave Search API
 * via `searchGroundImages` service for photojournalistic news coverage.
 */
export async function fetchEventMedia(
  eventName: string,
  _limit: number = 8
): Promise<WikimediaMediaItem[]> {
  try {
    const results: GroundImageResult[] = await searchGroundImages(eventName);
    return results.map((r) => ({
      id: r.id,
      title: r.title,
      thumbUrl: r.thumbnailUrl,
      fullUrl: r.thumbnailUrl,
      sourceUrl: r.sourceUrl,
      license: 'News Editorial / Fair Use',
      artist: r.domain,
      description: r.title,
      isVideo: false,
    }));
  } catch (error) {
    console.error(`Failed to fetch media for ${eventName}:`, error);
    return [];
  }
}
