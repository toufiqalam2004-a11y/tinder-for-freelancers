import { isDemoMode } from '../data/storage.js';

/**
 * YouTube Integration Service
 * Uses official YouTube Data API v3 search endpoint.
 * Never scrapes YouTube HTML.
 * Falls back to explicitly labeled realistic DEMO opportunities when API keys are absent.
 */

export class YouTubeService {
  /**
   * Validates or sanitizes search query.
   */
  validateQuery(query = '') {
    const clean = query.trim();
    return {
      isValid: clean.length >= 2,
      cleanedQuery: clean,
    };
  }

  /**
   * Checks if YouTube Data API v3 key is configured in environment variables.
   */
  checkApiConfig() {
    const apiKey = import.meta.env?.VITE_YOUTUBE_API_KEY;
    const isConfigured = !!apiKey;

    return {
      isConfigured,
      missing: isConfigured ? [] : ['VITE_YOUTUBE_API_KEY'],
    };
  }

  /**
   * Fetches videos using official YouTube Data API or realistic Demo Fallback.
   */
  async fetchVideos(source) {
    const { isConfigured } = this.checkApiConfig();
    const query = source.query || source.name || 'video editor hiring';

    // 1. LIVE OFFICIAL YOUTUBE DATA API v3
    if (isConfigured) {
      try {
        const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;
        const endpoint = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(
          query
        )}&type=video&maxResults=12&order=date&key=${apiKey}`;

        const res = await fetch(endpoint);
        if (!res.ok) {
          throw new Error(`YouTube Data API responded with HTTP status ${res.status}`);
        }

        const data = await res.json();
        const items = data.items || [];

        const posts = items.map((item) => {
          const snippet = item.snippet;
          const videoId = item.id.videoId;
          return {
            postId: `yt-${videoId}`,
            sourceId: source.id,
            title: snippet.title,
            postText: `${snippet.title}\n\n${snippet.description}`,
            postUrl: `https://www.youtube.com/watch?v=${videoId}`,
            author: snippet.channelTitle || 'YouTube Creator',
            channelUrl: snippet.channelId ? `https://www.youtube.com/channel/${snippet.channelId}` : '',
            thumbnail: snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || '',
            createdAt: snippet.publishedAt,
            fetchedAt: new Date().toISOString(),
            platform: 'youtube',
            isDemo: false,
          };
        });

        return { success: true, posts, isDemo: false };
      } catch (err) {
        console.warn('Live YouTube API error, evaluating demo fallback:', err.message);
        if (!isDemoMode()) {
          return {
            success: false,
            posts: [],
            error: 'Unable to fetch YouTube videos right now. Check your API key or switch to Demo Mode.',
          };
        }
      }
    }

    // 2. DEMO MODE FALLBACK (Explicitly labelled DEMO)
    if (isDemoMode() || !isConfigured) {
      const now = Date.now();
      const demoPosts = [
        {
          postId: `yt-demo-1-${source.id}`,
          sourceId: source.id,
          title: `WE ARE HIRING A FULL-TIME YOUTUBE VIDEO EDITOR! ($3,000 - $4,500/mo)`,
          postText: `WE ARE HIRING A FULL-TIME YOUTUBE VIDEO EDITOR! Join our production team creating documentary-style retention videos. Required skills: Adobe Premiere Pro, After Effects, sound design, storytelling pacing. 100% Remote opportunity. Apply with your portfolio in description link or email jobs@creatorstudios.io.`,
          postUrl: `https://www.youtube.com/watch?v=demo_video_editor_hiring`,
          author: 'Creator Studios (1.2M Subs)',
          channelUrl: 'https://www.youtube.com/@creatorstudios',
          thumbnail: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=500&auto=format&fit=crop&q=60',
          createdAt: new Date(now - 3600000 * 4).toISOString(),
          fetchedAt: new Date().toISOString(),
          platform: 'youtube',
          isDemo: true,
        },
        {
          postId: `yt-demo-2-${source.id}`,
          sourceId: source.id,
          title: `Looking for Short-Form Video Editor | Reels & TikToks for Fitness Channel`,
          postText: `Looking for a freelance video editor to repurpose workout and podcast highlights into engaging TikToks & Shorts. Need high energy, subtitles, sound effects, motion graphics. Paid per video ($45-$60/video). Remote. DM or email link in description.`,
          postUrl: `https://www.youtube.com/watch?v=demo_shortform_fitness`,
          author: 'Apex Fitness Media',
          channelUrl: 'https://www.youtube.com/@apexfitness',
          thumbnail: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=500&auto=format&fit=crop&q=60',
          createdAt: new Date(now - 3600000 * 10).toISOString(),
          fetchedAt: new Date().toISOString(),
          platform: 'youtube',
          isDemo: true,
        },
        {
          postId: `yt-demo-3-${source.id}`,
          sourceId: source.id,
          title: `Need an After Effects & Motion Graphic Designer for Tech Reviews`,
          postText: `We are scaling our tech reviews channel and need a dedicated motion graphics artist. 3D renders, spec sheets, animated callouts. Freelance retainer $2,000/mo. Remote worldwide. Send portfolio.`,
          postUrl: `https://www.youtube.com/watch?v=demo_motion_designer`,
          author: 'NextGen Tech Reviews',
          channelUrl: 'https://www.youtube.com/@nextgentech',
          thumbnail: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=500&auto=format&fit=crop&q=60',
          createdAt: new Date(now - 3600000 * 24).toISOString(),
          fetchedAt: new Date().toISOString(),
          platform: 'youtube',
          isDemo: true,
        },
        // Non-hiring tutorial video to verify filter works
        {
          postId: `yt-demo-tutorial-${source.id}`,
          sourceId: source.id,
          title: `How to Edit Like a Pro in Premiere Pro 2026 Tutorial`,
          postText: `In this video I will teach you the best tips and tricks to edit faster. No hiring, just tutorial!`,
          postUrl: `https://www.youtube.com/watch?v=demo_tutorial_only`,
          author: 'Tutorial Guru',
          createdAt: new Date(now - 3600000 * 30).toISOString(),
          fetchedAt: new Date().toISOString(),
          platform: 'youtube',
          isDemo: true,
        },
      ];

      return { success: true, posts: demoPosts, isDemo: true };
    }

    return {
      success: false,
      posts: [],
      error: 'YouTube API not configured. Please add VITE_YOUTUBE_API_KEY or enable Demo Mode.',
    };
  }
}

export const youtubeService = new YouTubeService();
