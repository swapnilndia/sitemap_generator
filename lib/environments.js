/**
 * Environment configuration for URL generation
 * Provides predefined environment URLs for sitemap generation
 */

export const ENVIRONMENTS = {
  dev: {
    id: 'dev',
    name: 'Development',
    baseUrl: 'https://bajaj-retail-dev.easypay.co.in',
    description: 'Development environment for testing and development'
  },
  uat: {
    id: 'uat',
    name: 'UAT',
    baseUrl: 'https://bajaj-retail-uat.easypay.co.in',
    description: 'User Acceptance Testing environment'
  },
  prod: {
    id: 'prod',
    name: 'Production',
    baseUrl: 'https://ondc.bajajfinservmarkets.in',
    description: 'Production environment for live deployment'
  }
};

export const DEFAULT_ENVIRONMENT = 'uat';

/**
 * Get all available environments as an array
 * @returns {Array} Array of environment objects
 */
export function getEnvironments() {
  return Object.values(ENVIRONMENTS);
}

/**
 * Get environment by ID
 * @param {string} environmentId - The environment ID
 * @returns {Object|null} Environment object or null if not found
 */
export function getEnvironment(environmentId) {
  return ENVIRONMENTS[environmentId] || null;
}

/**
 * Get environment base URL
 * @param {string} environmentId - The environment ID
 * @returns {string} Base URL for the environment
 */
export function getEnvironmentBaseUrl(environmentId) {
  const environment = getEnvironment(environmentId);
  return environment ? environment.baseUrl : ENVIRONMENTS[DEFAULT_ENVIRONMENT].baseUrl;
}

/**
 * Validate environment ID
 * @param {string} environmentId - The environment ID to validate
 * @returns {boolean} True if valid, false otherwise
 */
export function isValidEnvironment(environmentId) {
  return environmentId && ENVIRONMENTS.hasOwnProperty(environmentId);
}

/**
 * Generate URL pattern for environment
 * @param {string} environmentId - The environment ID
 * @param {string} pathPattern - The path pattern (e.g., '{URL}')
 * @returns {string} Complete URL pattern
 */
export function generateUrlPattern(environmentId, pathPattern = '{URL}') {
  const baseUrl = getEnvironmentBaseUrl(environmentId);
  
  // Ensure pathPattern starts with / if it doesn't already
  const cleanPath = pathPattern.startsWith('/') ? pathPattern : `/${pathPattern}`;
  
  return `${baseUrl}${cleanPath}`;
}

/**
 * Get default environment configuration
 * @returns {Object} Default environment object
 */
export function getDefaultEnvironment() {
  return ENVIRONMENTS[DEFAULT_ENVIRONMENT];
}