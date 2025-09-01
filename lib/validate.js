/**
 * File validation utilities for sitemap generator
 */

// File size limit in bytes (25MB default)
const MAX_FILE_SIZE = parseInt(process.env.NEXT_MAX_FILE_SIZE_MB || '25') * 1024 * 1024;

// Supported file types
const SUPPORTED_TYPES = {
  'text/csv': ['.csv'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
};

// Hard cap for chunk size
const MAX_CHUNK_SIZE = 50000;

// Date format regex for lastmod validation
const LASTMOD_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates uploaded file type and size
 * @param {File} file - The uploaded file
 * @returns {Object} - Validation result with success/error
 */
export function validateFile(file) {
  if (!file) {
    return { success: false, error: 'No file provided' };
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = Math.round(MAX_FILE_SIZE / (1024 * 1024));
    return { 
      success: false, 
      error: `File size exceeds ${sizeMB}MB limit. Current size: ${Math.round(file.size / (1024 * 1024))}MB` 
    };
  }

  // Check file type by MIME type and extension
  const isValidType = Object.keys(SUPPORTED_TYPES).includes(file.type) ||
    Object.values(SUPPORTED_TYPES).flat().some(ext => file.name.toLowerCase().endsWith(ext));

  if (!isValidType) {
    return { 
      success: false, 
      error: 'Unsupported file type. Please upload CSV or XLSX files only.' 
    };
  }

  return { success: true };
}

/**
 * Validates chunk size parameter
 * @param {number} chunkSize - The chunk size to validate
 * @returns {Object} - Validation result with success/error
 */
export function validateChunkSize(chunkSize) {
  const size = parseInt(chunkSize);
  
  if (isNaN(size) || size < 1) {
    return { success: false, error: 'Chunk size must be at least 1' };
  }
  
  if (size > MAX_CHUNK_SIZE) {
    return { 
      success: false, 
      error: `Chunk size cannot exceed ${MAX_CHUNK_SIZE.toLocaleString()}` 
    };
  }
  
  return { success: true, value: size };
}

/**
 * Validates URL pattern for required placeholders
 * @param {string} urlPattern - The URL pattern to validate
 * @param {Object} columnMapping - The column mapping configuration
 * @returns {Object} - Validation result with success/error
 */
export function validateUrlPattern(urlPattern, columnMapping) {
  if (!urlPattern || typeof urlPattern !== 'string') {
    return { success: false, error: 'URL pattern is required' };
  }

  // Extract placeholders from pattern
  const placeholders = urlPattern.match(/\{([^}]+)\}/g) || [];
  const placeholderKeys = placeholders.map(p => p.slice(1, -1));

  // Check if required link placeholder exists
  if (!placeholderKeys.includes('link') && !placeholderKeys.includes(columnMapping?.link)) {
    return { 
      success: false, 
      error: 'URL pattern must include {link} placeholder or reference the mapped link column' 
    };
  }

  // Validate that all placeholders have corresponding column mappings
  const availableColumns = Object.values(columnMapping || {}).filter(Boolean);
  const invalidPlaceholders = placeholderKeys.filter(key => 
    key !== 'link' && !availableColumns.includes(key)
  );

  if (invalidPlaceholders.length > 0) {
    return { 
      success: false, 
      error: `Invalid placeholders: {${invalidPlaceholders.join('}, {')}. Please map these columns or remove from URL pattern.` 
    };
  }

  return { success: true };
}

/**
 * Validates column mapping configuration
 * @param {Object} columnMapping - The column mapping to validate
 * @param {string[]} availableColumns - Available column headers from file
 * @returns {Object} - Validation result with success/error
 */
export function validateColumnMapping(columnMapping, availableColumns = []) {
  if (!columnMapping || typeof columnMapping !== 'object') {
    return { success: false, error: 'Column mapping is required' };
  }

  // Check required link field
  if (!columnMapping.link) {
    return { success: false, error: 'Link column mapping is required' };
  }

  // Validate that mapped columns exist in available columns
  const mappedColumns = Object.values(columnMapping).filter(Boolean);
  const invalidColumns = mappedColumns.filter(col => !availableColumns.includes(col));

  if (invalidColumns.length > 0) {
    return { 
      success: false, 
      error: `Invalid column mappings: ${invalidColumns.join(', ')}. These columns don't exist in the uploaded file.` 
    };
  }

  return { success: true };
}

/**
 * Validates lastmod date format
 * @param {string} dateStr - The date string to validate
 * @returns {boolean} - True if valid YYYY-MM-DD format
 */
export function validateLastmod(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') {
    return false;
  }
  return LASTMOD_REGEX.test(dateStr.trim());
}

/**
 * Validates grouping option
 * @param {string} grouping - The grouping option to validate
 * @returns {Object} - Validation result with success/error
 */
export function validateGrouping(grouping) {
  const validOptions = ['none', 'category', 'store_id'];
  
  if (!validOptions.includes(grouping)) {
    return { 
      success: false, 
      error: `Invalid grouping option. Must be one of: ${validOptions.join(', ')}` 
    };
  }
  
  return { success: true };
}

/**
 * Validates priority value for sitemaps
 * @param {string} priority - The priority value to validate
 * @returns {boolean} - True if valid priority (0.0-1.0)
 */
export function validatePriority(priority) {
  if (!priority) return true; // Optional field
  
  const num = parseFloat(priority);
  return !isNaN(num) && num >= 0.0 && num <= 1.0;
}

/**
 * Validates changefreq value for sitemaps
 * @param {string} changefreq - The changefreq value to validate
 * @returns {boolean} - True if valid changefreq
 */
export function validateChangefreq(changefreq) {
  if (!changefreq) return true; // Optional field
  
  const validFreqs = ['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'];
  return validFreqs.includes(changefreq.toLowerCase());
}

export { MAX_FILE_SIZE, MAX_CHUNK_SIZE, LASTMOD_REGEX };