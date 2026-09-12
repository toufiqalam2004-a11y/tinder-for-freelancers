import { isDemoMode } from '../data/storage';

/**
 * X (Twitter) Integration Service
 * Uses official X API v2 Public Recent Search endpoint.
 * Never scrapes X HTML or attempts to mirror private timelines.
 * Falls back to explicitly labeled realistic DEMO opportunities when Bearer token is absent.
 */

export class XService {
  /**
   * Validates or cleans the search query.
   */
  validateQuery(query = '') {
    const clean = query.trim();
    return {
      isValid: clean.length >= 2,
      cleanedQuery: clean,
    };
  }

  /**
   * Checks if X API v2 Bearer Token is configured in environment variables.
   */
  checkApiConfig() {
    const bearerToken = import.meta.env?.VITE_X_BEARER_TOKEN;
    const isConfigured = !!bearerToken;

    return {
      isConfigured,
      missing: isConfigured ? [] : ['VITE_X_BEARER_TOKEN'],
    };
  }

  /**
   * Fetches recent tweets matching the public query using official X API v2.
   */
  async fetchTweets(source) {
    const { isConfigured } = this.checkApiConfig();
    const query = source.query || source.name || 'video editor hiring';

    // 1. LIVE OFFICIAL X API v2 SEARCH
    if (isConfigured) {
      try {
        const bearerToken = import.meta.env.VITE_X_BEARER_TOKEN;
        const searchQuery = `${query} -is:retweet lang:en`;
        const endpoint = `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(
          searchQuery
        )}&tweet.fields=created_at,public_metrics,author_id&expansions=author_id&user.fields=username,name&max_results=15`;

        const res = await fetch(endpoint, {
          headers: {
            Authorization: `Bearer ${bearerToken}`,
          },
        });

        if (!res.ok) {
          throw new Error(`X API responded with HTTP status ${res.status}`);
        }

        const data = await res.json();
        const tweets = data.data || [];
        const users = data.includes?.users || [];
        const userMap = new Map(users.map((u) => [u.id, u]));

        const posts = tweets.map((tweet) => {
          const authorInfo = userMap.get(tweet.author_id);
          const username = authorInfo ? `@${authorInfo.username}` : 'Founders / Creators on X';
          return {
            postId: `x-${tweet.id}`,
            sourceId: source.id,
            title: tweet.text.slice(0, 80) + '...',
            postText: tweet.text,
            postUrl: authorInfo
              ? `https://x.com/${authorInfo.username}/status/${tweet.id}`
              : `https://x.com/i/web/status/${tweet.id}`,
            author: username,
            createdAt: tweet.created_at || new Date().toISOString(),
            fetchedAt: new Date().toISOString(),
            platform: 'x',
            engagement: tweet.public_metrics || {},
            isDemo: false,
          };
        });

        return { success: true, posts, isDemo: false };
      } catch (err) {
        console.warn('Live X API error, evaluating demo fallback:', err.message);
        if (!isDemoMode()) {
          return {
            success: false,
            posts: [],
            error: 'Unable to fetch X tweets right now. Check your Bearer token or switch to Demo Mode.',
          };
        }
      }
    }

    // 2. DEMO MODE FALLBACK (Explicitly labelled DEMO)
    if (isDemoMode() || !isConfigured) {
      const now = Date.now();
      const demoPosts = [
        {
          postId: `x-demo-1-${source.id}`,
          sourceId: source.id,
          title: `Hiring a Video Editor for founder personal brand videos!`,
          postText: `Hiring: Looking for a killer video editor to help with my personal brand content. 2 long-form YouTube videos + 10 vertical clips/month. Must be proficient in Premiere Pro, dynamic pacing, and retention editing. Paying $3,000/mo retainer. 100% remote. Drop your portfolio link below or DM me! 🚀`,
          postUrl: `https://x.com/techfounder/status/demo_tweet_1`,
          author: '@DanFounder (Building in public)',
          createdAt: new Date(now - 3600000 * 1).toISOString(),
          fetchedAt: new Date().toISOString(),
          platform: 'x',
          engagement: { likes: 84, retweets: 16 },
          isDemo: true,
        },
        {
          postId: `x-demo-2-${source.id}`,
          sourceId: source.id,
          title: `Need a freelance editor for short-form clips (TikTok/Reels)`,
          postText: `Need a freelance video editor ASAP! Repurposing our weekly podcast episodes into high-converting Shorts & Reels. Fast turnaround required. $50 per short. Remote worldwide. DM with your top 2 portfolio reels. #hiring #videoeditor`,
          postUrl: `https://x.com/podcasthost/status/demo_tweet_2`,
          author: '@CreatorNetwork',
          createdAt: new Date(now - 3600000 * 5).toISOString(),
          fetchedAt: new Date().toISOString(),
          platform: 'x',
          engagement: { likes: 42, retweets: 9 },
          isDemo: true,
        },
        {
          postId: `x-demo-3-${source.id}`,
          sourceId: source.id,
          title: `Looking for Motion Designer & After Effects Specialist`,
          postText: `We need a freelance Motion Designer for our crypto/fintech video explainer series. After Effects & 2D animation mastery required. Contract budget: $4,000. Remote. DM portfolio.`,
          postUrl: `https://x.com/fintechdesign/status/demo_tweet_3`,
          author: '@FintechDesignCo',
          createdAt: new Date(now - 3600000 * 14).toISOString(),
          fetchedAt: new Date().toISOString(),
          platform: 'x',
          engagement: { likes: 31, retweets: 6 },
          isDemo: true,
        },
        // Non-hiring discussion tweet to verify filter works
        {
          postId: `x-demo-discussion-${source.id}`,
          sourceId: source.id,
          title: `What is your favorite video editing software in 2026?`,
          postText: `Just curious: do you prefer Premiere Pro or DaVinci Resolve for YouTube video editing? Let's discuss!`,
          postUrl: `https://x.com/randomuser/status/demo_tweet_discussion`,
          author: '@CommunityChat',
          createdAt: new Date(now - 3600000 * 20).toISOString(),
          fetchedAt: new Date().toISOString(),
          platform: 'x',
          isDemo: true,
        },
      ];

      return { success: true, posts: demoPosts, isDemo: true };
    }

    return {
      success: false,
      posts: [],
      error: 'X API not configured. Please add VITE_X_BEARER_TOKEN or enable Demo Mode.',
    };
  }
}

export const xService = new XService();
