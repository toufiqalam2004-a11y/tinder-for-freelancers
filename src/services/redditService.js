import { isDemoMode } from '../data/storage';

/**
 * Reddit Integration Service
 * Uses official Reddit JSON API / OAuth with secure environment credentials.
 * Never scrapes HTML or bypasses Reddit restrictions.
 * Falls back to explicitly labeled realistic DEMO opportunities when credentials are not configured.
 */

export class RedditService {
  /**
   * Validates subreddit format. Accepts 'r/name', 'name', or 'https://www.reddit.com/r/name/'
   */
  validateSubreddit(input = '') {
    if (!input || typeof input !== 'string') return { isValid: false, cleanedName: '' };
    
    let clean = input.trim();
    // Strip trailing slash
    clean = clean.replace(/\/+$/, '');
    
    // Check if full URL
    const matchUrl = clean.match(/reddit\.com\/r\/([a-zA-Z0-9_]+)/i);
    if (matchUrl) {
      return { isValid: true, cleanedName: `r/${matchUrl[1]}` };
    }

    // Strip leading r/ or /r/
    clean = clean.replace(/^\/?r\//i, '');
    if (/^[a-zA-Z0-9_]{3,30}$/.test(clean)) {
      return { isValid: true, cleanedName: `r/${clean}` };
    }

    return { isValid: false, cleanedName: '' };
  }

  /**
   * Evaluates if official Reddit API credentials are configured in environment variables.
   */
  checkApiConfig() {
    const clientId = import.meta.env?.VITE_REDDIT_CLIENT_ID;
    const clientSecret = import.meta.env?.VITE_REDDIT_CLIENT_SECRET;
    const isConfigured = !!(clientId && clientSecret);

    return {
      isConfigured,
      clientId: clientId || null,
      missing: isConfigured ? [] : ['VITE_REDDIT_CLIENT_ID', 'VITE_REDDIT_CLIENT_SECRET'],
    };
  }

  /**
   * Fetches latest posts from Reddit using official JSON endpoint or Demo Fallback.
   */
  async fetchSubredditPosts(source) {
    const { isConfigured } = this.checkApiConfig();
    const cleanSub = (source.name || source.sourceName || 'r/forhire').replace(/^\/?r\//i, '');

    // 1. LIVE OFFICIAL REDDIT API
    if (isConfigured) {
      try {
        const userAgent = import.meta.env?.VITE_REDDIT_USER_AGENT || 'web:TinderForFreelancers:v6.0.0 (by /u/tinder_for_freelancers)';
        const res = await fetch(`https://www.reddit.com/r/${cleanSub}/new.json?limit=15`, {
          headers: {
            'User-Agent': userAgent,
          },
        });

        if (!res.ok) {
          throw new Error(`Reddit API responded with status ${res.status}`);
        }

        const data = await res.json();
        const children = data?.data?.children || [];

        const posts = children.map((item) => {
          const post = item.data;
          return {
            postId: `reddit-${post.id}`,
            sourceId: source.id,
            title: post.title,
            postText: `${post.title}\n\n${post.selftext || ''}`,
            postUrl: `https://reddit.com${post.permalink}`,
            author: `u/${post.author}`,
            createdAt: new Date(post.created_utc * 1000).toISOString(),
            fetchedAt: new Date().toISOString(),
            platform: 'reddit',
            score: post.score || 0,
            numComments: post.num_comments || 0,
            subreddit: `r/${cleanSub}`,
            isDemo: false,
          };
        });

        return { success: true, posts, isDemo: false };
      } catch (err) {
        console.warn('Live Reddit API error, evaluating demo fallback:', err.message);
        if (!isDemoMode()) {
          return {
            success: false,
            posts: [],
            error: 'Unable to fetch live Reddit posts right now. Check your API credentials or switch to Demo Mode.',
          };
        }
      }
    }

    // 2. DEMO MODE FALLBACK (Explicitly labelled DEMO)
    if (isDemoMode() || !isConfigured) {
      const now = Date.now();
      const demoPosts = [
        {
          postId: `reddit-demo-1-${source.id}`,
          sourceId: source.id,
          title: `[Hiring] Lead YouTube Video Editor for fast-growing Tech & AI channel (350k subs)`,
          postText: `[Hiring] Lead YouTube Video Editor for fast-growing Tech & AI channel. We produce weekly deep-dives and need dynamic motion graphics, sound design, and retention hooks in Premiere Pro + After Effects. 100% Remote. Weekly commitment: 1-2 videos. Budget: $450 - $700 per video. Drop your portfolio link below or DM me.`,
          postUrl: `https://reddit.com/r/${cleanSub}/comments/lead_video_editor_hiring`,
          author: 'u/TechExploredStudio',
          createdAt: new Date(now - 3600000 * 2).toISOString(),
          fetchedAt: new Date().toISOString(),
          platform: 'reddit',
          score: 24,
          numComments: 8,
          subreddit: `r/${cleanSub}`,
          isDemo: true,
        },
        {
          postId: `reddit-demo-2-${source.id}`,
          sourceId: source.id,
          title: `[Hiring] Urgent: Short-form Video Editor for Viral Podcasts & TikTok Series`,
          postText: `[Hiring] Urgent: Looking for an experienced short-form editor who understands viral pacing, Alex Hormozi style dynamic subtitles, sound effects, and color grading. Paid: $40/hr or $65/reel. Fully remote worldwide. Please send your best 3 samples.`,
          postUrl: `https://reddit.com/r/${cleanSub}/comments/shortform_editor_needed`,
          author: 'u/MediaAgencyLead',
          createdAt: new Date(now - 3600000 * 6).toISOString(),
          fetchedAt: new Date().toISOString(),
          platform: 'reddit',
          score: 18,
          numComments: 14,
          subreddit: `r/${cleanSub}`,
          isDemo: true,
        },
        {
          postId: `reddit-demo-3-${source.id}`,
          sourceId: source.id,
          title: `[Hiring] Motion Graphics Designer & Video Editor for B2B SaaS launch video`,
          postText: `[Hiring] We are launching a new AI SaaS product next month and need a polished 90-second product demo video with 2D motion graphics and UI animations. Contract budget: $2,500 - $3,500. Remote. Send portfolio to DM.`,
          postUrl: `https://reddit.com/r/${cleanSub}/comments/motion_designer_b2b`,
          author: 'u/SaaSScalingCo',
          createdAt: new Date(now - 3600000 * 16).toISOString(),
          fetchedAt: new Date().toISOString(),
          platform: 'reddit',
          score: 35,
          numComments: 19,
          subreddit: `r/${cleanSub}`,
          isDemo: true,
        },
        // Non-hiring post to verify detector filters it out
        {
          postId: `reddit-demo-spam-${source.id}`,
          sourceId: source.id,
          title: `[For Hire] Video editor available for hire! Check my portfolio`,
          postText: `[For Hire] I am looking for freelance work as an editor. Hire me! Here is my reel.`,
          postUrl: `https://reddit.com/r/${cleanSub}/comments/for_hire_portfolio`,
          author: 'u/EditorLookingForWork',
          createdAt: new Date(now - 3600000 * 20).toISOString(),
          fetchedAt: new Date().toISOString(),
          platform: 'reddit',
          score: 2,
          numComments: 1,
          subreddit: `r/${cleanSub}`,
          isDemo: true,
        }
      ];

      return { success: true, posts: demoPosts, isDemo: true };
    }

    return {
      success: false,
      posts: [],
      error: 'Reddit API not configured. Please add VITE_REDDIT_CLIENT_ID or enable Demo Mode.',
    };
  }
}

export const redditService = new RedditService();
