export class YouTubeService {
  isConfigured() {
    return !!process.env.YOUTUBE_API_KEY;
  }

  async fetchVideos(query = 'video editor hiring', maxResults = 12) {
    if (!this.isConfigured()) {
      return {
        success: false,
        isDemo: true,
        error: 'YouTube Data API key (YOUTUBE_API_KEY) not configured.',
        posts: [],
      };
    }

    try {
      const apiKey = process.env.YOUTUBE_API_KEY;
      const endpoint = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=${maxResults}&order=date&key=${apiKey}`;

      const res = await fetch(endpoint);
      if (!res.ok) {
        if (res.status === 403) {
          return { success: false, error: 'YouTube Data API quota exceeded or key restricted (403).', isDemo: true, posts: [] };
        }
        return { success: false, error: `YouTube API returned status ${res.status}`, isDemo: true, posts: [] };
      }

      const data = await res.json();
      const items = data.items || [];

      const posts = items.map((item) => {
        const snippet = item.snippet;
        const videoId = item.id.videoId;
        return {
          postId: `yt-${videoId}`,
          title: snippet.title,
          postText: `${snippet.title}\n\n${snippet.description}`,
          postUrl: `https://www.youtube.com/watch?v=${videoId}`,
          author: snippet.channelTitle,
          channelId: snippet.channelId,
          createdAt: snippet.publishedAt,
          fetchedAt: new Date().toISOString(),
          platform: 'youtube',
          thumbnail: snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url,
          isDemo: false,
        };
      });

      return { success: true, isDemo: false, posts };
    } catch (err) {
      return { success: false, isDemo: true, error: err.message, posts: [] };
    }
  }
}

export const youtubeService = new YouTubeService();
