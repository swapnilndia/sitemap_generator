/**
 * Utilities for generating sitemaps from JSON data
 */

import { chunkGroupedUrls } from './grouping.js';

/**
 * Processes JSON data and prepares it for sitemap generation
 * @param {Object} jsonData - JSON data from convertFileToJson
 * @param {number} maxPerFile - Maximum URLs per sitemap file
 * @returns {Object} - Processed data ready for XML generation
 */
export function processJsonForSitemap(jsonData, maxPerFile = 50000) {
  // Extract valid URLs grouped by their group names
  const groupedUrls = new Map();
  
  // Work with optimized structure (urls array instead of data array)
  const urls = jsonData.urls || [];
  
  for (const url of urls) {
    const groupName = url.group || 'default';
    
    if (!groupedUrls.has(groupName)) {
      groupedUrls.set(groupName, []);
    }

    // URL entry is already in the correct format
    const urlEntry = {
      loc: url.loc
    };

    // Add optional fields if they exist
    if (url.lastmod) {
      urlEntry.lastmod = url.lastmod;
    }
    if (url.changefreq) {
      urlEntry.changefreq = url.changefreq;
    }
    if (url.priority) {
      urlEntry.priority = url.priority;
    }

    groupedUrls.get(groupName).push(urlEntry);
  }

  // Chunk the grouped URLs
  const sitemapFiles = chunkGroupedUrls(groupedUrls, maxPerFile);

  return {
    metadata: jsonData.metadata,
    statistics: jsonData.statistics,
    sitemapFiles,
    groupedUrls,
    totalValidUrls: jsonData.statistics.validUrls
  };
}

/**
 * Creates a preview of what sitemaps will be generated from JSON
 * @param {Object} jsonData - JSON data from convertFileToJson
 * @param {number} maxPerFile - Maximum URLs per sitemap file
 * @returns {Object} - Preview information
 */
export function previewSitemapsFromJson(jsonData, maxPerFile = 50000) {
  const processed = processJsonForSitemap(jsonData, maxPerFile);
  
  const preview = {
    totalFiles: processed.sitemapFiles.length,
    needsIndex: processed.sitemapFiles.length > 1,
    files: processed.sitemapFiles.map(file => ({
      filename: file.filename,
      urlCount: file.urlCount,
      group: file.group,
      chunkNumber: file.chunkNumber
    })),
    groups: Array.from(processed.groupedUrls.keys()),
    statistics: processed.statistics
  };

  return preview;
}

/**
 * Extracts sample URLs from JSON data for preview
 * @param {Object} jsonData - JSON data from convertFileToJson
 * @param {number} sampleCount - Number of sample URLs to extract
 * @returns {Array} - Array of sample URL objects
 */
export function extractSampleUrlsFromJson(jsonData, sampleCount = 5) {
  const sampleUrls = [];
  let count = 0;

  for (const entry of jsonData.data) {
    if (count >= sampleCount) break;
    
    if (!entry.processed.excluded && !entry.processed.isDuplicate && entry.processed.url) {
      sampleUrls.push({
        url: entry.processed.url,
        group: entry.processed.group,
        rowNumber: entry.rowNumber,
        lastmod: entry.processed.lastmod,
        changefreq: entry.processed.changefreq,
        priority: entry.processed.priority
      });
      count++;
    }
  }

  return sampleUrls;
}

/**
 * Validates JSON data structure for sitemap generation
 * @param {Object} jsonData - JSON data to validate
 * @returns {Object} - Validation result
 */
export function validateJsonForSitemap(jsonData) {
  if (!jsonData || typeof jsonData !== 'object') {
    return {
      success: false,
      error: 'Invalid JSON data structure'
    };
  }

  // Check required properties
  const requiredProps = ['metadata', 'statistics', 'data'];
  for (const prop of requiredProps) {
    if (!jsonData[prop]) {
      return {
        success: false,
        error: `Missing required property: ${prop}`
      };
    }
  }

  // Check if data is an array
  if (!Array.isArray(jsonData.data)) {
    return {
      success: false,
      error: 'Data property must be an array'
    };
  }

  // Check if there are any valid URLs
  const validUrls = jsonData.data.filter(entry => 
    !entry.processed.excluded && 
    !entry.processed.isDuplicate && 
    entry.processed.url
  );

  if (validUrls.length === 0) {
    return {
      success: false,
      error: 'No valid URLs found in JSON data'
    };
  }

  return {
    success: true,
    validUrlCount: validUrls.length
  };
}

/**
 * Converts JSON data back to the format expected by existing sitemap generators
 * @param {Object} jsonData - JSON data from convertFileToJson
 * @returns {AsyncGenerator} - Generator yielding URL entries compatible with existing code
 */
export async function* convertJsonToUrlGenerator(jsonData) {
  for (const entry of jsonData.data) {
    if (!entry.processed.excluded && !entry.processed.isDuplicate && entry.processed.url) {
      const urlEntry = {
        loc: entry.processed.url,
        group: entry.processed.group || 'products',
        rowNumber: entry.rowNumber
      };

      // Add optional fields
      if (entry.processed.lastmod) {
        urlEntry.lastmod = entry.processed.lastmod;
      }
      if (entry.processed.changefreq) {
        urlEntry.changefreq = entry.processed.changefreq;
      }
      if (entry.processed.priority) {
        urlEntry.priority = entry.processed.priority;
      }

      yield urlEntry;
    }
  }
}

/**
 * Creates a detailed report of exclusions from JSON data
 * @param {Object} jsonData - JSON data from convertFileToJson
 * @returns {Object} - Exclusion report
 */
export function createExclusionReport(jsonData) {
  const exclusions = {
    excluded: [],
    duplicates: [],
    invalidLastmod: []
  };

  for (const entry of jsonData.data) {
    if (entry.processed.excluded) {
      exclusions.excluded.push({
        rowNumber: entry.rowNumber,
        reason: entry.processed.exclusionReason,
        originalData: entry.originalData
      });
    }

    if (entry.processed.isDuplicate) {
      exclusions.duplicates.push({
        rowNumber: entry.rowNumber,
        url: entry.processed.url,
        originalData: entry.originalData
      });
    }

    if (entry.processed.invalidLastmod) {
      exclusions.invalidLastmod.push({
        rowNumber: entry.rowNumber,
        invalidValue: entry.processed.invalidLastmod,
        originalData: entry.originalData
      });
    }
  }

  return exclusions;
}

/**
 * Merges multiple JSON datasets (useful for processing multiple files)
 * @param {Array} jsonDatasets - Array of JSON data objects
 * @returns {Object} - Merged JSON data
 */
export function mergeJsonDatasets(jsonDatasets) {
  if (!jsonDatasets || jsonDatasets.length === 0) {
    throw new Error('No datasets provided for merging');
  }

  if (jsonDatasets.length === 1) {
    return jsonDatasets[0];
  }

  const merged = {
    metadata: {
      ...jsonDatasets[0].metadata,
      mergedFrom: jsonDatasets.length,
      processedAt: new Date().toISOString()
    },
    statistics: {
      totalRows: 0,
      validUrls: 0,
      excludedRows: 0,
      duplicateUrls: 0,
      invalidLastmod: 0
    },
    data: []
  };

  // Merge data and statistics
  let rowOffset = 0;
  for (const dataset of jsonDatasets) {
    // Update statistics
    merged.statistics.totalRows += dataset.statistics.totalRows;
    merged.statistics.validUrls += dataset.statistics.validUrls;
    merged.statistics.excludedRows += dataset.statistics.excludedRows;
    merged.statistics.duplicateUrls += dataset.statistics.duplicateUrls;
    merged.statistics.invalidLastmod += dataset.statistics.invalidLastmod;

    // Merge data with adjusted row numbers
    for (const entry of dataset.data) {
      merged.data.push({
        ...entry,
        rowNumber: entry.rowNumber + rowOffset
      });
    }

    rowOffset += dataset.statistics.totalRows;
  }

  return merged;
}