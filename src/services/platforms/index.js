import { facebookMonitor } from './facebookMonitor';
import { redditMonitor } from './redditMonitor';
import { youtubeMonitor } from './youtubeMonitor';
import { xMonitor } from './xMonitor';
import { PLATFORMS } from '../../utils/constants';

/**
 * Registry of platform monitors.
 * Supports Facebook Groups, Reddit, YouTube, and X.
 * Future: LinkedIn, Instagram, Threads, Job Boards.
 */
const platformMonitors = {
  [PLATFORMS.FACEBOOK_GROUP]: facebookMonitor,
  [PLATFORMS.REDDIT]: redditMonitor,
  [PLATFORMS.YOUTUBE]: youtubeMonitor,
  [PLATFORMS.X]: xMonitor,
};

export function getPlatformMonitor(platform) {
  return platformMonitors[platform] || null;
}
