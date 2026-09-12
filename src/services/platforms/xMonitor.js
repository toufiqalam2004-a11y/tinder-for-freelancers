import { BasePlatformMonitor } from './baseMonitor';
import { isDemoMode } from '../../data/storage.js';

export class XMonitor extends BasePlatformMonitor {
  constructor() {
    super('x');
  }

  /**
   * Evaluates official X (Twitter) API v2 access.
   */
  async checkApiFeasibility(source) {
    const bearerToken = import.meta.env?.VITE_X_BEARER_TOKEN;

    const missingConfig = [];
    if (!bearerToken) {
      missingConfig.push('VITE_X_BEARER_TOKEN (X Developer Portal API v2 Bearer Token)');
    }

    if (!bearerToken) {
      const demoActive = isDemoMode();
      return {
        isFeasible: false,
        status: demoActive ? 'active' : 'api_required',
        headline: demoActive ? 'Demo Mode Active' : 'X API configuration required.',
        message: demoActive
          ? 'X API Bearer token not configured. Running in Demo Mode with simulated hiring tweets.'
          : 'X API configuration required.',
        missingConfig,
        policyNote: 'To comply with X Developer Agreement & anti-scraping policies, Tinder for Freelancers does not scrape or mirror private feeds.',
        details: {
          platform: 'x',
          query: source.query || source.sourceName,
          demoMode: demoActive,
        },
      };
    }

    return {
      isFeasible: true,
      status: 'active',
      headline: 'Official X API Connected',
      message: 'Authenticated via X API v2 Public Search.',
      missingConfig: [],
      policyNote: 'Operating via official X API v2.',
      details: { platform: 'x' },
    };
  }

  /**
   * Fetches public search tweets through official X API v2,
   * or returns realistic sample tweets in Demo Mode.
   */
  async fetchPosts(source) {
    const feasibility = await this.checkApiFeasibility(source);
    const query = source.query || 'video editor hiring';

    // Official X API v2 Search
    if (feasibility.isFeasible) {
      const bearerToken = import.meta.env.VITE_X_BEARER_TOKEN;
      try {
        const url = `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(
          `${query} -is:retweet lang:en`
        )}&tweet.fields=created_at,author_id&max_results=10`;

        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${bearerToken}`,
          },
        });

        if (!res.ok) {
          return { success: false, posts: [], error: 'X API request failed' };
        }

        const data = await res.json();
        const tweets = data.data || [];

        const posts = tweets.map((tweet) => ({
          postId: `x-${tweet.id}`,
          sourceId: source.id,
          postText: tweet.text,
          postUrl: `https://x.com/i/web/status/${tweet.id}`,
          author: `@user_${tweet.author_id?.slice(0, 6) || 'creator'}`,
          createdAt: tweet.created_at || new Date().toISOString(),
          fetchedAt: new Date().toISOString(),
          platform: 'x',
          isDemo: false,
        }));

        return { success: true, posts };
      } catch (err) {
        return { success: false, posts: [], error: err.message };
      }
    }

    // Demo Mode: Sample X / Twitter Hiring Posts
    if (isDemoMode()) {
      const samplePosts = [
        {
          postId: `x-sample-1-${source.id}`,
          sourceId: source.id,
          postText: `🚨 HIRING: Looking for a dedicated YouTube Video Editor for our fast-paced tech agency. We need someone proficient in Premiere Pro, sound effects, and retention editing. $3,000/mo retainer. 100% remote. Drop your best edit below or DM me with past YouTube work!`,
          postUrl: 'https://x.com/creativelab_founder/status/17691238910',
          author: '@DanCreativeLead',
          createdAt: new Date(Date.now() - 3600000 * 1.5).toISOString(),
          fetchedAt: new Date().toISOString(),
          platform: 'x',
          isDemo: true,
        },
        {
          postId: `x-sample-2-${source.id}`,
          sourceId: source.id,
          postText: `Any cracked video editors looking for work? Need someone to edit 3-4 YouTube videos per month. Style: Ali Abdaal / Iman Gadzhi clean motion design & storytelling. Budget: $500 - $700 per video. Remote worldwide. Must know Premiere + After Effects. DMs open!`,
          postUrl: 'https://x.com/growthmarketer/status/17691249921',
          author: '@GrowthWithSam',
          createdAt: new Date(Date.now() - 3600000 * 6).toISOString(),
          fetchedAt: new Date().toISOString(),
          platform: 'x',
          isDemo: true,
        },
        {
          postId: `x-sample-3-${source.id}`,
          sourceId: source.id,
          postText: `Hiring 2 freelance video editors for short-form content (TikToks, Shorts, IG Reels). $40 - $50 per short. We provide footage and script prompts. Looking for someone with great taste and fast turnaround. RTs appreciated! Send portfolio.`,
          postUrl: 'https://x.com/agencycoo/status/17691258832',
          author: '@AgencyFoundersHQ',
          createdAt: new Date(Date.now() - 3600000 * 14).toISOString(),
          fetchedAt: new Date().toISOString(),
          platform: 'x',
          isDemo: true,
        },
      ];

      return { success: true, posts: samplePosts };
    }

    return {
      success: false,
      posts: [],
      error: 'X API configuration required.',
    };
  }
}

export const xMonitor = new XMonitor();
