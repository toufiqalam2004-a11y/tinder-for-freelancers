export class RedditService {
  isConfigured() {
    return !!(process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET);
  }

  async fetchSubredditPosts(subreddit = 'forhire', limit = 15) {
    const cleanSub = subreddit.replace(/^\/?r\//i, '').trim();

    if (!this.isConfigured()) {
      return {
        success: false,
        isDemo: true,
        error: 'Reddit API credentials (REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET) not configured.',
        posts: [],
      };
    }

    try {
      const userAgent = process.env.REDDIT_USER_AGENT || 'web:TinderForFreelancers:v6.0.0 (by /u/tinder_freelancers)';
      
      const endpoint = `https://www.reddit.com/r/${cleanSub}/new.json?limit=${limit}`;
      const res = await fetch(endpoint, {
        headers: {
          'User-Agent': userAgent,
        },
      });

      if (!res.ok) {
        if (res.status === 429) {
          return { success: false, error: 'Reddit API rate limit reached (429). Please retry shortly.', isDemo: true, posts: [] };
        }
        return { success: false, error: `Reddit returned status ${res.status}`, isDemo: true, posts: [] };
      }

      const data = await res.json();
      const children = data?.data?.children || [];

      const posts = children.map((item) => {
        const post = item.data;
        return {
          postId: `reddit-${post.id}`,
          title: post.title,
          postText: `${post.title}\n\n${post.selftext || ''}`,
          postUrl: `https://reddit.com${post.permalink}`,
          author: `u/${post.author}`,
          createdAt: new Date(post.created_utc * 1000).toISOString(),
          fetchedAt: new Date().toISOString(),
          platform: 'reddit',
          score: post.score || 0,
          subreddit: `r/${cleanSub}`,
          isDemo: false,
        };
      });

      return { success: true, isDemo: false, posts };
    } catch (err) {
      return { success: false, isDemo: true, error: err.message, posts: [] };
    }
  }
}

export const redditService = new RedditService();
