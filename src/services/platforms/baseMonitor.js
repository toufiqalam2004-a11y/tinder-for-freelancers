/**
 * BasePlatformMonitor Interface
 * Future platforms (X, YouTube, LinkedIn, Reddit) implement this interface.
 */
export class BasePlatformMonitor {
  constructor(platform) {
    this.platform = platform;
  }

  /**
   * Evaluates whether official API access is supported and configured for the given source.
   * @param {Object} source - The JobSource object
   * @returns {Promise<{
   *   isFeasible: boolean,
   *   status: 'active' | 'api_required' | 'not_available',
   *   headline: string,
   *   message: string,
   *   missingConfig: string[],
   *   policyNote: string,
   *   details: Object
   * }>}
   */
  async checkApiFeasibility(source) {
    throw new Error('checkApiFeasibility must be implemented by subclass');
  }

  /**
   * Fetches latest posts through official supported API if available.
   * Never scrapes or bypasses login.
   * @param {Object} source
   * @returns {Promise<{
   *   success: boolean,
   *   posts: Array,
   *   error?: string
   * }>}
   */
  async fetchPosts(source) {
    throw new Error('fetchPosts must be implemented by subclass');
  }
}
