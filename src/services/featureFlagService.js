/**
 * Feature Flag Service (V6)
 * Controls modular feature rollout and enterprise capability toggles.
 */

const DEFAULT_FLAGS = {
  enableAutopilot: true,
  enableAdvancedMatching: true,
  enableClientProfiles: true,
  enableAgencyProfiles: true,
  enablePWA: true,
  enableGlobalSearch: true,
  enableSourceHealth: true,
  enableMultiProfile: true,
  enableWorkspaces: true,
};

class FeatureFlagService {
  constructor() {
    this.flags = { ...DEFAULT_FLAGS };
  }

  isEnabled(featureName) {
    if (this.flags[featureName] !== undefined) {
      return this.flags[featureName];
    }
    return true;
  }

  setFlag(featureName, value) {
    this.flags[featureName] = Boolean(value);
  }

  getAllFlags() {
    return { ...this.flags };
  }
}

export const featureFlagService = new FeatureFlagService();
