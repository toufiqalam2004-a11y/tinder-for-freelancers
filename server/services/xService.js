export class XService {
  isConfigured() {
    return !!process.env.X_BEARER_TOKEN;
  }

  async fetchTweets(query = 'video editor hiring', maxResults = 15) {
    if (!this.isConfigured()) {
      return {
        success: false,
        isDemo: true,
        error: 'X (Twitter) API Bearer Token (X_BEARER_TOKEN) not configured.',
        posts: [],
      };
    }

    try {
      const bearerToken = process.env.X_BEARER_TOKEN;
      const cleanQuery = `${query} -is:retweet lang:en`;
      const endpoint = `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(
        cleanQuery
      )}&tweet.fields=created_at,public_metrics,author_id&expansions=author_id&user.fields=username,name&max_results=${maxResults}`;

      const res = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${bearerToken}`,
        },
      });

      if (!res.ok) {
        if (res.status === 429) {
          return { success: false, error: 'X API rate limit reached (429). Please wait for window reset.', isDemo: true, posts: [] };
        }
        return { success: false, error: `X API returned status ${res.status}`, isDemo: true, posts: [] };
      }

      const data = await res.json();
      const tweets = data.data || [];
      const users = data.includes?.users || [];
      const userMap = new Map(users.map((u) => [u.id, u]));

      const posts = tweets.map((tweet) => {
        const author = userMap.get(tweet.author_id);
        const username = author?.username || 'user';
        return {
          postId: `x-${tweet.id}`,
          title: tweet.text.slice(0, 80) + (tweet.text.length > 80 ? '...' : ''),
          postText: tweet.text,
          postUrl: `https://twitter.com/${username}/status/${tweet.id}`,
          author: author ? `@${author.username}` : '@hiring_lead',
          authorName: author?.name || 'Hiring Lead',
          createdAt: tweet.created_at,
          fetchedAt: new Date().toISOString(),
          platform: 'x',
          likes: tweet.public_metrics?.like_count || 0,
          retweets: tweet.public_metrics?.retweet_count || 0,
          isDemo: false,
        };
      });

      return { success: true, isDemo: false, posts };
    } catch (err) {
      return { success: false, isDemo: true, error: err.message, posts: [] };
    }
  }
}

export const xService = new XService();
