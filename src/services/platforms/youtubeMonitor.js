import { BasePlatformMonitor } from './baseMonitor';
import { isDemoMode } from '../../data/storage';

export class YouTubeMonitor extends BasePlatformMonitor {
  constructor() {
    super('youtube');
  }

  /**
   * Evaluates official YouTube Data API access.
   */
  async checkApiFeasibility(source) {
    const apiKey = import.meta.env?.VITE_YOUTUBE_API_KEY;

    const missingConfig = [];
    if (!apiKey) {
      missingConfig.push('VITE_YOUTUBE_API_KEY (Google Cloud / YouTube Data API v3 Key)');
    }

    if (!apiKey) {
      const demoActive = isDemoMode();
      return {
        isFeasible: false,
        status: demoActive ? 'active' : 'api_required',
        headline: demoActive ? 'Demo Mode Active' : 'YouTube API configuration required.',
        message: demoActive
          ? 'YouTube Data API key not configured. Running in Demo Mode with simulated hiring posts.'
          : 'YouTube API configuration required.',
        missingConfig,
        policyNote: 'To comply with YouTube Terms of Service & Google Developer Policies, Tinder for Freelancers does not scrape YouTube pages.',
        details: {
          platform: 'youtube',
          query: source.query || source.sourceName,
          demoMode: demoActive,
        },
      };
    }

    return {
      isFeasible: true,
      status: 'active',
      headline: 'Official YouTube Data API Connected',
      message: 'Authenticated via YouTube Data API v3.',
      missingConfig: [],
      policyNote: 'Operating via official YouTube Data API v3.',
      details: { platform: 'youtube' },
    };
  }

  /**
   * Fetches search results through official YouTube Data API,
   * or returns realistic sample video descriptions in Demo Mode.
   */
  async fetchPosts(source) {
    const feasibility = await this.checkApiFeasibility(source);
    const query = source.query || 'video editor hiring';

    // Official API
    if (feasibility.isFeasible) {
      const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;
      try {
        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(
          query
        )}&type=video&maxResults=10&key=${apiKey}`;

        const res = await fetch(url);
        if (!res.ok) {
          return { success: false, posts: [], error: 'YouTube API request failed' };
        }

        const data = await res.json();
        const items = data.items || [];

        const posts = items.map((item) => ({
          postId: `yt-${item.id.videoId}`,
          sourceId: source.id,
          postText: `${item.snippet.title}\n\n${item.snippet.description}`,
          postUrl: `https://www.youtube.com/watch?v=${item.id.videoId}`,
          author: item.snippet.channelTitle,
          createdAt: item.snippet.publishedAt || new Date().toISOString(),
          fetchedAt: new Date().toISOString(),
          platform: 'youtube',
          isDemo: false,
        }));

        return { success: true, posts };
      } catch (err) {
        return { success: false, posts: [], error: err.message };
      }
    }

    // Demo Mode: Sample YouTube Creator Hiring Posts
    if (isDemoMode()) {
      const samplePosts = [
        {
          postId: `yt-sample-1-${source.id}`,
          sourceId: source.id,
          postText: `🔥 We Are Hiring a Full-Time Video Editor for our Tech Channel! We need someone with deep mastery in Adobe Premiere Pro, dynamic pacing, and After Effects motion graphics. Must be able to handle 2 videos/week (10-15 min long-form). 100% Remote worldwide. Budget: $2,500 - $3,500/month. Apply via link in description or email jobs@techtrends.io.`,
          postUrl: 'https://www.youtube.com/watch?v=demo_yt_tech_hiring',
          author: 'TechTrends Studios (850k Subs)',
          createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
          fetchedAt: new Date().toISOString(),
          platform: 'youtube',
          isDemo: true,
        },
        {
          postId: `yt-sample-2-${source.id}`,
          sourceId: source.id,
          postText: `Looking for a Freelance YouTube Video Editor specializing in storytelling and high retention documentary style editing (Magnates Media / James Jani style). Long-form project, paid per video ($500 - $800/video). Premiere Pro + After Effects required. Check description to submit your portfolio.`,
          postUrl: 'https://www.youtube.com/watch?v=demo_yt_doc_hiring',
          author: 'Founders Deep Dive (400k Subs)',
          createdAt: new Date(Date.now() - 3600000 * 8).toISOString(),
          fetchedAt: new Date().toISOString(),
          platform: 'youtube',
          isDemo: true,
        },
        {
          postId: `yt-sample-3-${source.id}`,
          sourceId: source.id,
          postText: `Short-form & Reels Editor Wanted! Repurposing our weekly podcast episodes into 15-30 viral shorts per month. Need someone who understands sound design, subtitles, and hook retention. Remote position. $40/hour or flat monthly retainer. Link below to apply.`,
          postUrl: 'https://www.youtube.com/watch?v=demo_yt_shorts_hiring',
          author: 'Creator Hub Podcast',
          createdAt: new Date(Date.now() - 3600000 * 18).toISOString(),
          fetchedAt: new Date().toISOString(),
          platform: 'youtube',
          isDemo: true,
        },
      ];

      return { success: true, posts: samplePosts };
    }

    return {
      success: false,
      posts: [],
      error: 'YouTube API configuration required.',
    };
  }
}

export const youtubeMonitor = new YouTubeMonitor();
