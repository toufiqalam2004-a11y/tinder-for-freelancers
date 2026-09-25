/**
 * Device Identity Utility
 * Manages persistent client device identification for device binding security.
 */

const DEVICE_STORAGE_KEY = 'tf_device_id';

export function getOrCreateDeviceId() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return 'default-web-device';
  }

  try {
    let deviceId = window.localStorage.getItem(DEVICE_STORAGE_KEY);
    if (!deviceId) {
      deviceId = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      window.localStorage.setItem(DEVICE_STORAGE_KEY, deviceId);
    }
    return deviceId;
  } catch (err) {
    return 'fallback-device-id';
  }
}
