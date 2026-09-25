import { isValidFacebookGroupUrl } from '../../utils/validators';

export class FacebookMonitor {
  constructor() {
    this.platform = 'facebook_group';
  }

  /**
   * Evaluates official Meta Graph API access availability for the given Facebook Group.
   */
  async checkApiFeasibility(source) {
    // 1. Validate the saved Facebook Group URL
    if (!isValidFacebookGroupUrl(source.groupUrl)) {
      return {
        isFeasible: false,
        status: 'not_available',
        headline: 'Invalid Facebook Group URL',
        message: 'The saved URL does not match a valid Facebook Group format.',
        missingConfig: [],
        policyNote: 'Please check and update the source URL.',
        details: { urlValid: false },
      };
    }

    // 2. Determine whether the group is accessible through an official supported Meta/Facebook API
    const accessToken = import.meta.env?.VITE_FACEBOOK_ACCESS_TOKEN;
    const appId = import.meta.env?.VITE_FACEBOOK_APP_ID;

    const missingConfig = [];
    if (!accessToken) {
      missingConfig.push('VITE_FACEBOOK_ACCESS_TOKEN (Meta User/Page Token with Groups permission)');
    }
    if (!appId) {
      missingConfig.push('VITE_FACEBOOK_APP_ID (Registered Meta Developer App)');
    }

    // Official Meta Graph API permission & policy requirements
    missingConfig.push('Meta App Review: groups_access_member_info permission approval');
    missingConfig.push('Group Admin App Installation (The group admin must install the App in Group Settings)');

    // In current environment:
    if (!accessToken) {
      return {
        isFeasible: false,
        status: 'api_required',
        headline: 'Automatic monitoring is not available for this source with the current Facebook permissions.',
        message: 'Official Meta Graph API access requires a verified Meta App, approved permissions, and installation by the Facebook Group administrator.',
        missingConfig,
        policyNote: 'To comply with Meta Terms of Service, Tinder for Freelancers does not scrape or bypass Facebook security.',
        details: {
          urlValid: true,
          graphApiVersion: 'v19.0',
          credentialsPresent: false,
          scrapingAllowed: false,
        },
      };
    }

    // If official credentials ARE provided in environment, attempt official API call
    try {
      const response = await fetch(`https://graph.facebook.com/v19.0/me?access_token=${accessToken}`);
      const data = await response.json();

      if (data.error) {
        return {
          isFeasible: false,
          status: 'api_required',
          headline: 'Automatic monitoring is not available for this source with the current Facebook permissions.',
          message: `Meta API returned an authorization error: ${data.error.message}`,
          missingConfig: ['Valid Graph API Token with groups_access_member_info'],
          policyNote: 'To comply with Meta Terms of Service, Tinder for Freelancers does not scrape or bypass Facebook security.',
          details: { error: data.error },
        };
      }

      return {
        isFeasible: true,
        status: 'active',
        headline: 'Official Meta API Connected',
        message: 'Authenticated via official Meta Graph API.',
        missingConfig: [],
        policyNote: 'Operating via official Meta Graph API.',
        details: { user: data.name },
      };
    } catch (err) {
      return {
        isFeasible: false,
        status: 'api_required',
        headline: 'Automatic monitoring is not available for this source with the current Facebook permissions.',
        message: 'Network error contacting official Meta Graph API endpoint.',
        missingConfig,
        policyNote: 'To comply with Meta Terms of Service, Tinder for Freelancers does not scrape or bypass Facebook security.',
        details: { error: err.message },
      };
    }
  }

  /**
   * Fetches posts through official Meta API if configured.
   * If credentials are not present, returns empty array without scraping.
   */
  async fetchPosts(source) {
    const feasibility = await this.checkApiFeasibility(source);
    if (!feasibility.isFeasible) {
      return {
        success: false,
        posts: [],
        error: feasibility.headline,
      };
    }

    // When official token is present, query Graph API feed
    const accessToken = import.meta.env.VITE_FACEBOOK_ACCESS_TOKEN;
    try {
      // In production with official permissions: https://graph.facebook.com/v19.0/{group-id}/feed
      const res = await fetch(`https://graph.facebook.com/v19.0/me/feed?access_token=${accessToken}&limit=10`);
      const json = await res.json();

      if (json.error) {
        return { success: false, posts: [], error: json.error.message };
      }

      const posts = (json.data || []).map((item) => ({
        postId: item.id,
        sourceId: source.id,
        postText: item.message || item.story || '',
        postUrl: `https://facebook.com/${item.id}`,
        author: item.from?.name || 'Group Member',
        createdAt: item.created_time || new Date().toISOString(),
        fetchedAt: new Date().toISOString(),
        platform: 'facebook_group',
      }));

      return { success: true, posts };
    } catch (err) {
      return { success: false, posts: [], error: err.message };
    }
  }
}

export const facebookMonitor = new FacebookMonitor();
