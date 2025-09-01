/**
 * Data grouping and sanitization utilities
 */

/**
 * Sanitizes group name to be filesystem and URL safe
 * @param {string} groupName - Raw group name
 * @returns {string} - Sanitized group name
 */
export function sanitizeGroupName(groupName) {
  if (!groupName || typeof groupName !== 'string') {
    return '';
  }
  
  return groupName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\-_]/g, '-') // Replace invalid chars with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Gets fallback group name for empty or invalid group values
 * @param {string} groupingType - Type of grouping ('category' or 'store_id')
 * @returns {string} - Fallback group name
 */
export function getFallbackGroupName(groupingType) {
  switch (groupingType) {
    case 'category':
      return 'uncategorized';
    case 'store_id':
      return 'unknown_store';
    default:
      return 'default';
  }
}

/**
 * Determines group name for a row based on grouping configuration
 * @param {Object} rowData - Row data object
 * @param {Object} columnMapping - Column mapping configuration
 * @param {string} groupingType - Grouping type ('none', 'category', 'store_id')
 * @returns {string} - Group name for the row
 */
export function getGroupName(rowData, columnMapping, groupingType) {
  if (groupingType === 'none') {
    return 'products'; // Default group name for ungrouped data
  }
  
  // Get the column name for the grouping field
  const groupingColumn = columnMapping[groupingType];
  if (!groupingColumn) {
    return getFallbackGroupName(groupingType);
  }
  
  // Get the raw group value from row data
  const rawGroupValue = rowData[groupingColumn];
  
  // Handle empty or invalid group values
  if (!rawGroupValue || typeof rawGroupValue !== 'string' || rawGroupValue.trim() === '') {
    return getFallbackGroupName(groupingType);
  }
  
  // Sanitize the group name
  const sanitized = sanitizeGroupName(rawGroupValue);
  
  // Return fallback if sanitization resulted in empty string
  return sanitized || getFallbackGroupName(groupingType);
}

/**
 * Groups URL entries by their group names
 * @param {AsyncGenerator} urlGenerator - Generator yielding URL entries
 * @param {Object} columnMapping - Column mapping configuration
 * @param {string} groupingType - Grouping type
 * @returns {Promise<Map>} - Map of group names to URL arrays
 */
export async function groupUrlEntries(urlGenerator, columnMapping, groupingType) {
  const groups = new Map();
  
  for await (const urlEntry of urlGenerator) {
    // Determine group name (we need the original row data for this)
    // Since urlEntry doesn't contain original row data, we'll need to modify this
    // For now, we'll use a simpler approach where group is determined earlier
    const groupName = urlEntry.group || 'products';
    
    if (!groups.has(groupName)) {
      groups.set(groupName, []);
    }
    
    groups.get(groupName).push(urlEntry);
  }
  
  return groups;
}

/**
 * Enhanced URL processing that includes grouping information
 * @param {AsyncGenerator} rowGenerator - Generator yielding row data
 * @param {string} urlPattern - URL template
 * @param {Object} columnMapping - Column mapping configuration
 * @param {string} groupingType - Grouping type
 * @param {Object} options - Processing options
 * @returns {AsyncGenerator} - Generator yielding URL entries with group info
 */
export async function* processUrlsWithGrouping(rowGenerator, urlPattern, columnMapping, groupingType, options = {}) {
  const {
    includeLastmod = false,
    lastmodField = 'lastmod',
    changefreq = null,
    priority = null
  } = options;
  
  const seenUrls = new Set();
  let processedCount = 0;
  let validCount = 0;
  let excludedCount = 0;
  let duplicateCount = 0;
  let invalidLastmodCount = 0;
  
  for await (const { data: rowData, rowNumber } of rowGenerator) {
    processedCount++;
    
    // Apply URL pattern (using the function from buildUrls.js)
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
    
    // Determine group name
    const groupName = getGroupName(rowData, columnMapping, groupingType);
    
    // Build URL entry object
    const urlEntry = {
      loc: urlResult.url,
      group: groupName,
      rowNumber
    };
    
    // Add optional lastmod if enabled and valid
    if (includeLastmod && lastmodField) {
      const lastmodColumn = columnMapping[lastmodField] || lastmodField;
      const lastmodValue = rowData[lastmodColumn];
      if (lastmodValue && isValidLastmod(lastmodValue)) {
        urlEntry.lastmod = lastmodValue.trim();
      } else if (lastmodValue) {
        invalidLastmodCount++;
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
    duplicateCount,
    invalidLastmodCount
  };
}

/**
 * Collects URLs into groups for chunking
 * @param {AsyncGenerator} urlGenerator - Generator yielding URL entries
 * @returns {Promise<Map>} - Map of group names to URL arrays
 */
export async function collectUrlsByGroup(urlGenerator) {
  const groups = new Map();
  
  for await (const urlEntry of urlGenerator) {
    const groupName = urlEntry.group || 'products';
    
    if (!groups.has(groupName)) {
      groups.set(groupName, []);
    }
    
    groups.get(groupName).push(urlEntry);
  }
  
  return groups;
}

/**
 * Chunks URLs within each group according to size limits
 * @param {Map} groupedUrls - Map of group names to URL arrays
 * @param {number} maxPerFile - Maximum URLs per sitemap file
 * @returns {Array} - Array of sitemap file objects
 */
export function chunkGroupedUrls(groupedUrls, maxPerFile = 50000) {
  const sitemapFiles = [];
  
  for (const [groupName, urls] of groupedUrls) {
    if (urls.length === 0) continue;
    
    // Split URLs into chunks
    for (let i = 0; i < urls.length; i += maxPerFile) {
      const chunk = urls.slice(i, i + maxPerFile);
      const chunkNumber = Math.floor(i / maxPerFile) + 1;
      
      // Generate filename based on grouping
      let filename;
      const totalChunksForGroup = Math.ceil(urls.length / maxPerFile);
      
      if (groupedUrls.size === 1 && totalChunksForGroup === 1) {
        // Single group, single file
        filename = 'sitemap.xml';
      } else if (groupedUrls.size === 1) {
        // Single group, multiple files
        filename = `sitemap_${groupName}_${chunkNumber}.xml`;
      } else {
        // Multiple groups
        filename = `sitemap_${groupName}_${chunkNumber}.xml`;
      }
      
      sitemapFiles.push({
        filename,
        urls: chunk,
        urlCount: chunk.length,
        group: groupName,
        chunkNumber
      });
    }
  }
  
  return sitemapFiles;
}

/**
 * Simple URL pattern application (imported from buildUrls.js)
 * This is a placeholder - the actual implementation should import from buildUrls.js
 */
function applyUrlPattern(urlPattern, rowData, columnMapping) {
  // This should be imported from buildUrls.js
  // Placeholder implementation for now
  try {
    let processedUrl = urlPattern;
    const missingFields = [];
    
    const placeholders = urlPattern.match(/\{([^}]+)\}/g) || [];
    
    for (const placeholder of placeholders) {
      const fieldName = placeholder.slice(1, -1);
      let fieldValue = '';
      
      if (fieldName === 'link') {
        fieldValue = rowData[columnMapping.link] || '';
      } else {
        const mappedColumn = Object.entries(columnMapping).find(
          ([key, value]) => key === fieldName || value === fieldName
        );
        
        if (mappedColumn) {
          fieldValue = rowData[mappedColumn[1]] || '';
        } else {
          fieldValue = rowData[fieldName] || '';
        }
      }
      
      if (!fieldValue || fieldValue.trim() === '') {
        missingFields.push(fieldName);
      } else {
        processedUrl = processedUrl.replace(placeholder, fieldValue.trim());
      }
    }
    
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
 * Simple lastmod validation (should be imported from buildUrls.js)
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
  
  const date = new Date(trimmed);
  return date instanceof Date && !isNaN(date) && date.toISOString().startsWith(trimmed);
}