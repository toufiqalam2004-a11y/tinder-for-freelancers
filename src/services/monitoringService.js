import { redditService } from './redditService';
import { youtubeService } from './youtubeService';
import { xService } from './xService';
import { facebookMonitor } from './platforms/facebookMonitor';
import { deduplicationService } from './deduplicationService';
import { processPostToJob } from './jobClassifier';
import { apiClient } from './apiClient';
import {
  getMonitoringState,
  saveMonitoringState,
  getPosts,
  addPost,
  getJobs,
  addJob,
  getUser,
} from '../data/storage';
import { createPost } from '../data/models';

/**
 * Modular Monitoring & Fetching Service (V2)
 * Coordinates platform fetchers, runs hiring intent detection, performs deduplication,
 * and maintains telemetry.
 */
export class MonitoringService {
  /**
   * Retrieves telemetry for a source.
   */
  getStatus(sourceId) {
    const saved = getMonitoringState(sourceId);
    const posts = getPosts(sourceId);
    const jobs = getJobs(sourceId);

    if (saved) {
      return {
        ...saved,
        postsFound: posts.length,
        relevantJobs: jobs.length,
      };
    }

    return {
      status: 'connected',
      headline: 'Ready to check',
      lastChecked: null,
      postsFound: posts.length,
      relevantJobs: jobs.length,
      isFeasible: true,
      missingConfig: [],
      hasBeenTested: false,
    };
  }

  /**
   * Checks or refreshes a source.
   * Dispatches to Reddit, YouTube, X, or Facebook fetchers.
   * Pipeline: Fetch -> Detect Job -> Normalize -> Deduplicate -> Add to Feed.
   */
  async checkSource(source) {
    if (!source || !source.id) {
      throw new Error('Invalid source object provided to checkSource');
    }

    let fetchResult = { success: false, posts: [], error: null, isDemo: false };
    const platform = source.platform;

    // Try backend API first for server-side secret management & rate limits
    try {
      const serverResult = await apiClient.syncSource(source);
      if (serverResult.success && serverResult.addedJobs && serverResult.addedJobs.length > 0) {
        for (const j of serverResult.addedJobs) {
          addJob(j);
        }
        const now = new Date().toISOString();
        const state = {
          status: serverResult.isDemo ? 'demo_mode' : 'active',
          headline: serverResult.isDemo ? 'Demo Mode Active' : 'Connected & Synced (Backend)',
          message: serverResult.error || (serverResult.isDemo ? 'Demo Mode: API not configured.' : 'Backend API connected.'),
          lastChecked: now,
          postsFound: getPosts(source.id).length,
          relevantJobs: getJobs(source.id).length,
          duplicatesRemoved: 0,
          lastAdded: serverResult.addedJobs.length,
          isDemo: serverResult.isDemo !== undefined ? serverResult.isDemo : true,
          hasBeenTested: true,
        };
        saveMonitoringState(source.id, state);
        return {
          ...state,
          rawPostsCount: serverResult.rawCount || serverResult.addedJobs.length,
          addedCount: serverResult.addedJobs.length,
          duplicatesRemoved: 0,
          error: serverResult.error,
        };
      }
    } catch {
      // Fall back to client fetcher
    }

    // Dispatch to dedicated platform fetcher
    if (platform === 'reddit') {
      fetchResult = await redditService.fetchSubredditPosts(source);
    } else if (platform === 'youtube') {
      fetchResult = await youtubeService.fetchVideos(source);
    } else if (platform === 'x') {
      fetchResult = await xService.fetchTweets(source);
    } else if (platform === 'facebook_group') {
      fetchResult = await facebookMonitor.fetchPosts(source);
    } else {
      fetchResult = { success: true, posts: [], error: null, isDemo: false };
    }

    const userProfile = getUser();
    const existingJobs = getJobs();
    let rawPostsCount = 0;
    let relevantJobsCandidate = [];
    let duplicatesRemoved = 0;
    let addedCount = 0;

    if (fetchResult.success && Array.isArray(fetchResult.posts)) {
      rawPostsCount = fetchResult.posts.length;

      // 1. Store raw posts and run AI Job Detection + Normalizer
      for (const rawPost of fetchResult.posts) {
        const post = createPost({
          ...rawPost,
          sourceId: source.id,
          platform: source.platform,
        });
        addPost(post);

        // Run smart detector & normalizer
        const job = processPostToJob(post, userProfile, source);
        if (job) {
          relevantJobsCandidate.push(job);
        }
      }

      // 2. Run Deduplication
      const dedupeResult = deduplicationService.filterDuplicates(relevantJobsCandidate, existingJobs);
      duplicatesRemoved = dedupeResult.duplicateCount;

      // 3. Add unique relevant jobs to feed
      for (const uJob of dedupeResult.uniqueJobs) {
        addJob(uJob);
        addedCount++;
      }
    }

    const now = new Date().toISOString();
    const isDemo = fetchResult.isDemo !== undefined ? fetchResult.isDemo : false;

    // Update telemetry state
    const state = {
      status: fetchResult.success ? (isDemo ? 'demo_mode' : 'active') : 'error',
      headline: fetchResult.success
        ? (isDemo ? 'Demo Mode Active' : 'Connected & Synced')
        : 'Sync Error',
      message: fetchResult.error || (isDemo ? 'Showing realistic sample opportunities.' : 'Live API connected.'),
      lastChecked: now,
      postsFound: getPosts(source.id).length,
      relevantJobs: getJobs(source.id).length,
      duplicatesRemoved,
      lastAdded: addedCount,
      isDemo,
      hasBeenTested: true,
    };

    saveMonitoringState(source.id, state);

    return {
      ...state,
      rawPostsCount,
      addedCount,
      duplicatesRemoved,
      error: fetchResult.error,
    };
  }

  /**
   * Manual fallback ingestion
   */
  ingestPost({ source, postText, postUrl, author = 'Member', title = '' }) {
    const userProfile = getUser();

    const post = createPost({
      sourceId: source.id,
      platform: source.platform,
      postText,
      postUrl,
      author,
      title,
      createdAt: new Date().toISOString(),
      fetchedAt: new Date().toISOString(),
    });
    addPost(post);

    const job = processPostToJob(post, userProfile, source);
    if (job) {
      addJob(job);
    }

    const currentState = this.getStatus(source.id);
    saveMonitoringState(source.id, {
      ...currentState,
      lastChecked: new Date().toISOString(),
      postsFound: getPosts(source.id).length,
      relevantJobs: getJobs(source.id).length,
    });

    return { post, job };
  }
}

export const monitoringService = new MonitoringService();
