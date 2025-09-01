/**
 * URL pattern processing and validation utilities
 */

/**
 * Applies URL pattern to row data, replacing placeholders with actual values
 * @param {string} urlPattern - URL template with {placeholder} tokens
 * @param {Object} rowData - Row data object with column values
 * @param {Object} columnMapping - Column mapping configuration
 * @returns {Object} - Result with URL or exclusion reason
 */
export function applyUrlPattern(urlPattern, rowData, columnMapping) {
  try {
    let processedUrl = urlPattern;
    const missingFields = [];
    
    // Extract all placeholders from the pattern
    const placeholders = urlPattern.match(/\{([^}]+)\}/g) || [];
    
    for (const placeholder of placeholders) {
      const fieldName = placeholder.slice(1, -1); // Remove { and }
      let fieldValue = '';
      
      // Handle special 'link' placeholder
      if (fieldName === 'link') {
        fieldValue = rowData[columnMapping.link] || '';
      } else {
        // Check if fieldName matches a mapped column
        const mappedColumn = Object.entries(columnMapping).find(
          ([key, value]) => key === fieldName || value === fieldName
        );
        
        if (mappedColumn) {
          fieldValue = rowData[mappedColumn[1]] || '';
        } else {
          // Direct field name lookup
          fieldValue = rowData[fieldName] || '';
        }
      }
      
      // Track missing required fields
      if (!fieldValue || fieldValue.trim() === '') {
        missingFields.push(fieldName);
      } else {
        // Replace placeholder with actual value
        processedUrl = processedUrl.replace(placeholder, fieldValue.trim());
      }
    }
    
    // Return exclusion if any required fields are missing
    if (missingFields.length > 0) {
      return {
        success: false,
        excluded: true,
        reason: `Missing required fields: ${missingFields.join(', ')}`,
        url: null
      };
    }
    
    return {
      success: true,
      excluded: false,
      url: processedUrl,
      reason: null
    };
    
  } catch (error) {
    return {
      success: false,
      excluded: true,
      reason: `URL processing error: ${error.message}`,
      url: null
    };
  }
}

/**
 * Processes multiple rows and builds URLs with deduplication
 * @param {AsyncGenerator} rowGenerator - Generator yielding row data
 * @param {string} urlPattern - URL template
 * @param {Object} columnMapping - Column mapping configuration
 * @param {Object} options - Processing options
 * @returns {AsyncGenerator} - Generator yielding processed URL entries
 */
export async function* processUrlsFromRows(rowGenerator, urlPattern, columnMapping, options = {}) {
  const {
    includeLastmod = false,
    lastmodField = 'lastmod',
    changefreq = null,
    priority = null
  } = options;
  
  const seenUrls = new Set(); // For deduplication
  let processedCount = 0;
  let validCount = 0;
  let excludedCount = 0;
  let duplicateCount = 0;
  
  for await (const { data: rowData, rowNumber } of rowGenerator) {
    processedCount++;
    
    // Apply URL pattern
    const urlResult = applyUrlPattern(urlPattern, rowData, columnMapping);
    
    if (!urlResult.success) {
      excludedCount++;
      continue;
    }
    
    // Check for duplicates
    if (seenUrls.has(urlResult.url)) {
      duplicateCount++;
      continue;
    }
    
    seenUrls.add(urlResult.url);
    validCount++;
    
    // Build URL entry object
    const urlEntry = {
      loc: urlResult.url,
      rowNumber
    };
    
    // Add optional lastmod if enabled and valid
    if (includeLastmod && lastmodField) {
      const lastmodValue = rowData[columnMapping[lastmodField] || lastmodField];
      if (lastmodValue && isValidLastmod(lastmodValue)) {
        urlEntry.lastmod = lastmodValue.trim();
      }
    }
    
    // Add optional changefreq
    if (changefreq) {
      urlEntry.changefreq = changefreq;
    }
    
    // Add optional priority
    if (priority) {
      urlEntry.priority = priority;
    }
    
    yield urlEntry;
  }
  
  // Return final statistics
  return {
    processedCount,
    validCount,
    excludedCount,
    duplicateCount
  };
}

/**
 * Validates lastmod date format (YYYY-MM-DD)
 * @param {string} dateStr - Date string to validate
 * @returns {boolean} - True if valid format
 */
function isValidLastmod(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') {
    return false;
  }
  
  const trimmed = dateStr.trim();
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  
  if (!regex.test(trimmed)) {
    return false;
  }
  
  // Additional validation: check if it's a valid date
  const date = new Date(trimmed);
  return date instanceof Date && !isNaN(date) && date.toISOString().startsWith(trimmed);
}

/**
 * Generates preview URLs from sample data
 * @param {Object[]} sampleRows - Array of sample row data
 * @param {string} urlPattern - URL template
 * @param {Object} columnMapping - Column mapping configuration
 * @param {number} maxPreview - Maximum number of preview URLs (default: 5)
 * @returns {Object} - Preview result with URLs and statistics
 */
export function generateUrlPreview(sampleRows, urlPattern, columnMapping, maxPreview = 5) {
  const previewUrls = [];
  const excludedReasons = [];
  let validCount = 0;
  let excludedCount = 0;
  
  for (let i = 0; i < Math.min(sampleRows.length, maxPreview * 2); i++) {
    const rowData = sampleRows[i];
    const urlResult = applyUrlPattern(urlPattern, rowData, columnMapping);
    
    if (urlResult.success) {
      if (previewUrls.length < maxPreview) {
        previewUrls.push({
          url: urlResult.url,
          rowNumber: i + 1
        });
      }
      validCount++;
    } else {
      excludedCount++;
      if (excludedReasons.length < 3) { // Limit exclusion reasons shown
        excludedReasons.push(urlResult.reason);
      }
    }
  }
  
  return {
    previewUrls,
    validCount,
    excludedCount,
    excludedReasons: [...new Set(excludedReasons)], // Remove duplicates
    totalSampled: Math.min(sampleRows.length, maxPreview * 2)
  };
}

/**
 * Extracts placeholder tokens from URL pattern
 * @param {string} urlPattern - URL template
 * @returns {string[]} - Array of placeholder names
 */
export function extractPlaceholders(urlPattern) {
  if (!urlPattern || typeof urlPattern !== 'string') {
    return [];
  }
  
  const placeholders = urlPattern.match(/\{([^}]+)\}/g) || [];
  return placeholders.map(p => p.slice(1, -1)); // Remove { and }
}

/**
 * Validates that all placeholders in URL pattern can be resolved
 * @param {string} urlPattern - URL template
 * @param {Object} columnMapping - Column mapping configuration
 * @param {string[]} availableColumns - Available column headers
 * @returns {Object} - Validation result
 */
export function validateUrlPlaceholders(urlPattern, columnMapping, availableColumns) {
  const placeholders = extractPlaceholders(urlPattern);
  const unresolvedPlaceholders = [];
  
  for (const placeholder of placeholders) {
    let canResolve = false;
    
    // Check if it's the special 'link' placeholder
    if (placeholder === 'link' && columnMapping.link) {
      canResolve = availableColumns.includes(columnMapping.link);
    } else {
      // Check if placeholder matches a mapped column key
      const mappedColumn = columnMapping[placeholder];
      if (mappedColumn && availableColumns.includes(mappedColumn)) {
        canResolve = true;
      } else if (availableColumns.includes(placeholder)) {
        // Direct column name match
        canResolve = true;
      }
    }
    
    if (!canResolve) {
      unresolvedPlaceholders.push(placeholder);
    }
  }
  
  if (unresolvedPlaceholders.length > 0) {
    return {
      success: false,
      error: `Cannot resolve placeholders: {${unresolvedPlaceholders.join('}, {')}}`
    };
  }
  
  return { success: true };
}

export { isValidLastmod };