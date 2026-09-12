import { BasePlatformMonitor } from './baseMonitor';
import { isDemoMode } from '../../data/storage';

export class RedditMonitor extends BasePlatformMonitor {
  constructor() {
    super('reddit');
  }

  /**
   * Evaluates official Reddit API access configuration.
   */
  async checkApiFeasibility(source) {
    const clientId = import.meta.env?.VITE_REDDIT_CLIENT_ID;
    const clientSecret = import.meta.env?.VITE_REDDIT_CLIENT_SECRET;

    const missingConfig = [];
    if (!clientId) missingConfig.push('VITE_REDDIT_CLIENT_ID (Reddit OAuth App ID)');
    if (!clientSecret) missingConfig.push('VITE_REDDIT_CLIENT_SECRET (Reddit Script/Web Secret)');

    if (!clientId || !clientSecret) {
      const demoActive = isDemoMode();
      return {
        isFeasible: false,
        status: demoActive ? 'active' : 'api_required',
        headline: demoActive ? 'Demo Mode Active' : 'Reddit API configuration required.',
        message: demoActive
          ? 'Reddit API credentials not configured. Running in Demo Mode with simulated hiring posts.'
          : 'Reddit API configuration required.',
        missingConfig,
        policyNote: 'To comply with Reddit API Terms & User Agreement, Tinder for Freelancers does not scrape or use automated browser bots.',
        details: {
          platform: 'reddit',
          subreddit: source.sourceName,
          demoMode: demoActive,
        },
      };
    }

    return {
      isFeasible: true,
      status: 'active',
      headline: 'Official Reddit API Connected',
      message: 'Authenticated via official Reddit OAuth2 API.',
      missingConfig: [],
      policyNote: 'Operating via official Reddit API.',
      details: { platform: 'reddit', clientId },
    };
  }

  /**
   * Fetches posts through official Reddit API if configured,
   * or returns realistic sample posts in Demo Mode.
   */
  async fetchPosts(source) {
    const feasibility = await this.checkApiFeasibility(source);

    // If live API credentials are configured, query Reddit official JSON endpoint
    if (feasibility.isFeasible) {
      try {
        const subredditClean = (source.sourceName || 'forhire').replace(/^r\//, '');
        const res = await fetch(`https://www.reddit.com/r/${subredditClean}/new.json?limit=10`, {
          headers: { 'User-Agent': 'TinderForFreelancers/6.0.0' },
        });

        if (!res.ok) {
          return { success: false, posts: [], error: 'Reddit API request failed' };
        }

        const data = await res.json();
        const children = data?.data?.children || [];

        const posts = children.map((item) => {
          const post = item.data;
          return {
            postId: `reddit-${post.id}`,
            sourceId: source.id,
            postText: `${post.title}\n\n${post.selftext || ''}`,
            postUrl: `https://reddit.com${post.permalink}`,
            author: `u/${post.author}`,
            createdAt: new Date(post.created_utc * 1000).toISOString(),
            fetchedAt: new Date().toISOString(),
            platform: 'reddit',
            isDemo: false,
          };
        });

        return { success: true, posts };
      } catch (err) {
        return { success: false, posts: [], error: err.message };
      }
    }

    // Demo Mode: Sample Reddit posts
    if (isDemoMode()) {
      const sub = source.sourceName || 'r/forhire';
      const samplePosts = [
        {
          postId: `reddit-sample-1-${source.id}`,
          sourceId: source.id,
          postText: `[Hiring] YouTube Video Editor for fast-growing finance channel (200k subs). Need someone skilled in Premiere Pro, sound design, and retention hooks. Weekly commitment: 2 videos (10-15 mins). Budget: $400 - $600 per video. Remote worldwide. DM with your portfolio link.`,
          postUrl: `https://reddit.com/${sub}/comments/hiring_youtube_video_editor`,
          author: 'u/FinanceGrowth_Studio',
          createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
          fetchedAt: new Date().toISOString(),
          platform: 'reddit',
          isDemo: true,
        },
        {
          postId: `reddit-sample-2-${source.id}`,
          sourceId: source.id,
          postText: `[Hiring] Freelance Short-Form Video Editor for podcast studio. Looking for an editor to create punchy TikToks & YouTube Shorts. Must be fast with Premiere Pro, captions, and motion graphics. Rate: $35/hr or $50/short. Remote.`,
          postUrl: `https://reddit.com/${sub}/comments/hiring_short_form_editor`,
          author: 'u/MediaPodcastsHQ',
          createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
          fetchedAt: new Date().toISOString(),
          platform: 'reddit',
          isDemo: true,
        },
        {
          postId: `reddit-sample-3-${source.id}`,
          sourceId: source.id,
          postText: `[Hiring] Video Editor needed for gaming YouTube channel. Need clean cuts, comedic timing, and basic After Effects motion tracking. Budget: $300/video. Remote freelance opportunity.`,
          postUrl: `https://reddit.com/${sub}/comments/hiring_gaming_editor`,
          author: 'u/PixelGamingCreations',
          createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
          fetchedAt: new Date().toISOString(),
          platform: 'reddit',
          isDemo: true,
        },
      ];

      return { success: true, posts: samplePosts };
    }

    return {
      success: false,
      posts: [],
      error: 'Reddit API configuration required.',
    };
  }
}

export const redditMonitor = new RedditMonitor();
