/**
 * Session storage utility for environment persistence
 * Handles storing and retrieving environment selections with fallbacks
 */

import { DEFAULT_ENVIRONMENT, isValidEnvironment } from './environments.js';

const STORAGE_KEYS = {
  SELECTED_ENVIRONMENT: 'sitemap_selected_environment',
  URL_PATTERN: 'sitemap_url_pattern',
  IS_CUSTOM_PATTERN: 'sitemap_is_custom_pattern'
};

/**
 * Check if session storage is available
 * @returns {boolean} True if session storage is available
 */
function isSessionStorageAvailable() {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return false;
    }
    
    // Test if we can actually use it
    const testKey = '__test_session_storage__';
    window.sessionStorage.setItem(testKey, 'test');
    window.sessionStorage.removeItem(testKey);
    return true;
  } catch (error) {
    console.warn('Session storage not available:', error.message);
    return false;
  }
}

/**
 * Safely get item from session storage
 * @param {string} key - Storage key
 * @param {*} defaultValue - Default value if key not found or error occurs
 * @returns {*} Stored value or default value
 */
function safeGetItem(key, defaultValue = null) {
  if (!isSessionStorageAvailable()) {
    return defaultValue;
  }
  
  try {
    const value = window.sessionStorage.getItem(key);
    return value !== null ? value : defaultValue;
  } catch (error) {
    console.warn(`Error reading from session storage (${key}):`, error.message);
    return defaultValue;
  }
}

/**
 * Safely set item in session storage
 * @param {string} key - Storage key
 * @param {*} value - Value to store
 * @returns {boolean} True if successful, false otherwise
 */
function safeSetItem(key, value) {
  if (!isSessionStorageAvailable()) {
    return false;
  }
  
  try {
    window.sessionStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn(`Error writing to session storage (${key}):`, error.message);
    return false;
  }
}

/**
 * Get selected environment from session storage
 * @returns {string} Environment ID or default environment
 */
export function getSelectedEnvironment() {
  const stored = safeGetItem(STORAGE_KEYS.SELECTED_ENVIRONMENT, DEFAULT_ENVIRONMENT);
  
  // Validate the stored environment
  if (isValidEnvironment(stored)) {
    return stored;
  }
  
  console.warn(`Invalid environment in storage: ${stored}, using default: ${DEFAULT_ENVIRONMENT}`);
  return DEFAULT_ENVIRONMENT;
}

/**
 * Set selected environment in session storage
 * @param {string} environmentId - Environment ID to store
 * @returns {boolean} True if successful, false otherwise
 */
export function setSelectedEnvironment(environmentId) {
  if (!isValidEnvironment(environmentId)) {
    console.warn(`Attempted to store invalid environment: ${environmentId}`);
    return false;
  }
  
  return safeSetItem(STORAGE_KEYS.SELECTED_ENVIRONMENT, environmentId);
}

/**
 * Get URL pattern from session storage
 * @returns {string|null} Stored URL pattern or null
 */
export function getStoredUrlPattern() {
  return safeGetItem(STORAGE_KEYS.URL_PATTERN, null);
}

/**
 * Set URL pattern in session storage
 * @param {string} urlPattern - URL pattern to store
 * @returns {boolean} True if successful, false otherwise
 */
export function setStoredUrlPattern(urlPattern) {
  if (!urlPattern || typeof urlPattern !== 'string') {
    return false;
  }
  
  return safeSetItem(STORAGE_KEYS.URL_PATTERN, urlPattern);
}

/**
 * Get whether current pattern is custom (user-modified)
 * @returns {boolean} True if pattern is custom, false otherwise
 */
export function getIsCustomPattern() {
  const stored = safeGetItem(STORAGE_KEYS.IS_CUSTOM_PATTERN, 'false');
  return stored === 'true';
}

/**
 * Set whether current pattern is custom
 * @param {boolean} isCustom - Whether pattern is custom
 * @returns {boolean} True if successful, false otherwise
 */
export function setIsCustomPattern(isCustom) {
  return safeSetItem(STORAGE_KEYS.IS_CUSTOM_PATTERN, isCustom ? 'true' : 'false');
}

/**
 * Clear all environment-related session storage
 * @returns {boolean} True if successful, false otherwise
 */
export function clearEnvironmentStorage() {
  if (!isSessionStorageAvailable()) {
    return false;
  }
  
  try {
    Object.values(STORAGE_KEYS).forEach(key => {
      window.sessionStorage.removeItem(key);
    });
    return true;
  } catch (error) {
    console.warn('Error clearing environment storage:', error.message);
    return false;
  }
}

/**
 * Get all environment-related session data
 * @returns {Object} Object containing all stored environment data
 */
export function getEnvironmentSession() {
  return {
    selectedEnvironment: getSelectedEnvironment(),
    urlPattern: getStoredUrlPattern(),
    isCustomPattern: getIsCustomPattern()
  };
}

/**
 * Set all environment-related session data
 * @param {Object} sessionData - Object containing environment session data
 * @returns {boolean} True if all operations successful, false otherwise
 */
export function setEnvironmentSession(sessionData) {
  const results = [];
  
  if (sessionData.selectedEnvironment) {
    results.push(setSelectedEnvironment(sessionData.selectedEnvironment));
  }
  
  if (sessionData.urlPattern) {
    results.push(setStoredUrlPattern(sessionData.urlPattern));
  }
  
  if (sessionData.hasOwnProperty('isCustomPattern')) {
    results.push(setIsCustomPattern(sessionData.isCustomPattern));
  }
  
  return results.every(result => result === true);
}