/**
 * JSON conversion utilities for CSV/XLSX to JSON transformation
 */

import { parseCsvRows, extractCsvHeaders } from './csv.js';
import { parseExcelRows, extractExcelHeaders } from './excel.js';
import { applyUrlPattern } from './buildUrls.js';
import { getGroupName } from './grouping.js';

/**
 * Converts CSV/XLSX file to JSON format with URL processing
 * @param {Buffer} fileBuffer - The file buffer
 * @param {string} fileType - File type ('csv' or 'xlsx')
 * @param {Object} config - Configuration object
 * @returns {Promise<Object>} - JSON conversion result
 */
export async function convertFileToJson(fileBuffer, fileType, config) {
  const {
    columnMapping,
    urlPattern,
    grouping = 'none',
    includeLastmod = false,
    lastmodField = 'lastmod',
    changefreq = null,
    priority = null
  } = config;

  try {
    // Extract headers based on file type
    let headers;
    let rowGenerator;

    if (fileType === 'csv') {
      headers = await extractCsvHeaders(fileBuffer);
      rowGenerator = parseCsvRows(fileBuffer, headers);
    } else if (fileType === 'xlsx') {
      headers = await extractExcelHeaders(fileBuffer);
      rowGenerator = parseExcelRows(fileBuffer, headers);
    } else {
      throw new Error(`Unsupported file type: ${fileType}`);
    }

    // Process rows and convert to JSON
    const jsonData = {
      metadata: {
        originalHeaders: headers,
        columnMapping,
        urlPattern,
        grouping,
        includeLastmod,
        lastmodField,
        changefreq,
        priority,
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

    const seenUrls = new Set();
    let rowCount = 0;
    let validCount = 0;
    let excludedCount = 0;
    let duplicateCount = 0;
    let invalidLastmodCount = 0;

    // Process each row
    for await (const { data: rowData, rowNumber } of rowGenerator) {
      rowCount++;

      // Create base entry with original data
      const entry = {
        rowNumber,
        originalData: { ...rowData },
        processed: {
          excluded: false,
          exclusionReason: null,
          isDuplicate: false
        }
      };

      // Apply URL pattern
      const urlResult = applyUrlPattern(urlPattern, rowData, columnMapping);

      if (!urlResult.success) {
        entry.processed.excluded = true;
        entry.processed.exclusionReason = urlResult.reason;
        excludedCount++;
      } else {
        // Check for duplicates
        if (seenUrls.has(urlResult.url)) {
          entry.processed.isDuplicate = true;
          duplicateCount++;
        } else {
          seenUrls.add(urlResult.url);
          validCount++;

          // Add processed URL data
          entry.processed.url = urlResult.url;
          
          // Determine group
          entry.processed.group = getGroupName(rowData, columnMapping, grouping);

          // Handle lastmod
          if (includeLastmod && lastmodField) {
            const lastmodColumn = columnMapping[lastmodField] || lastmodField;
            const lastmodValue = rowData[lastmodColumn];
            if (lastmodValue) {
              if (isValidLastmod(lastmodValue)) {
                entry.processed.lastmod = lastmodValue.trim();
              } else {
                entry.processed.invalidLastmod = lastmodValue;
                invalidLastmodCount++;
              }
            }
          }

          // Add optional fields
          if (changefreq) {
            entry.processed.changefreq = changefreq;
          }
          if (priority) {
            entry.processed.priority = priority;
          }
        }
      }

      jsonData.data.push(entry);
    }

    // Update statistics
    jsonData.statistics = {
      totalRows: rowCount,
      validUrls: validCount,
      excludedRows: excludedCount,
      duplicateUrls: duplicateCount,
      invalidLastmod: invalidLastmodCount
    };

    return {
      success: true,
      json: jsonData
    };

  } catch (error) {
    return {
      success: false,
      error: `JSON conversion failed: ${error.message}`
    };
  }
}

/**
 * Converts JSON data to sitemap-ready format
 * @param {Object} jsonData - The JSON data from convertFileToJson
 * @returns {Object} - Sitemap-ready data structure
 */
export function convertJsonToSitemapData(jsonData) {
  const sitemapData = {
    metadata: jsonData.metadata,
    statistics: jsonData.statistics,
    groups: new Map()
  };

  // Group valid URLs by their group names
  for (const entry of jsonData.data) {
    if (!entry.processed.excluded && !entry.processed.isDuplicate && entry.processed.url) {
      const groupName = entry.processed.group || 'products';
      
      if (!sitemapData.groups.has(groupName)) {
        sitemapData.groups.set(groupName, []);
      }

      // Create URL entry for sitemap
      const urlEntry = {
        loc: entry.processed.url,
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

      sitemapData.groups.get(groupName).push(urlEntry);
    }
  }

  return sitemapData;
}

/**
 * Saves JSON data to file (for debugging/inspection)
 * @param {Object} jsonData - The JSON data to save
 * @param {string} filename - Output filename
 * @returns {string} - JSON string
 */
export function formatJsonForOutput(jsonData, pretty = true) {
  if (pretty) {
    return JSON.stringify(jsonData, null, 2);
  }
  return JSON.stringify(jsonData);
}

/**
 * Creates a summary report from JSON data
 * @param {Object} jsonData - The JSON data
 * @returns {string} - Human-readable summary
 */
export function createJsonSummary(jsonData) {
  const { metadata, statistics } = jsonData;
  
  const summary = [
    '=== Sitemap Generation Summary ===',
    '',
    `Processed at: ${metadata.processedAt}`,
    `URL Pattern: ${metadata.urlPattern}`,
    `Grouping: ${metadata.grouping}`,
    `Include lastmod: ${metadata.includeLastmod}`,
    '',
    '=== Statistics ===',
    `Total rows processed: ${statistics.totalRows.toLocaleString()}`,
    `Valid URLs generated: ${statistics.validUrls.toLocaleString()}`,
    `Excluded rows: ${statistics.excludedRows.toLocaleString()}`,
    `Duplicate URLs removed: ${statistics.duplicateUrls.toLocaleString()}`,
    `Invalid lastmod dates: ${statistics.invalidLastmod.toLocaleString()}`,
    '',
    '=== Column Mapping ===',
    ...Object.entries(metadata.columnMapping)
      .filter(([key, value]) => value)
      .map(([key, value]) => `${key}: ${value}`)
  ];

  return summary.join('\n');
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
  
  const date = new Date(trimmed);
  return date instanceof Date && !isNaN(date) && date.toISOString().startsWith(trimmed);
}

/**
 * Filters JSON data to show only specific types of entries
 * @param {Object} jsonData - The JSON data
 * @param {Object} filters - Filter options
 * @returns {Object} - Filtered JSON data
 */
export function filterJsonData(jsonData, filters = {}) {
  const {
    showExcluded = true,
    showDuplicates = true,
    showValid = true,
    groupFilter = null,
    maxRows = null
  } = filters;

  const filteredData = {
    ...jsonData,
    data: []
  };

  let count = 0;
  for (const entry of jsonData.data) {
    if (maxRows && count >= maxRows) break;

    const isExcluded = entry.processed.excluded;
    const isDuplicate = entry.processed.isDuplicate;
    const isValid = !isExcluded && !isDuplicate;

    // Apply filters
    if (isExcluded && !showExcluded) continue;
    if (isDuplicate && !showDuplicates) continue;
    if (isValid && !showValid) continue;

    // Group filter
    if (groupFilter && entry.processed.group !== groupFilter) continue;

    filteredData.data.push(entry);
    count++;
  }

  // Update statistics for filtered data
  filteredData.statistics = {
    ...jsonData.statistics,
    filteredRows: filteredData.data.length,
    originalTotalRows: jsonData.statistics.totalRows
  };

  return filteredData;
}

/**
 * Process file preview - generates a preview of the conversion result
 * @param {Buffer} fileBuffer - The file buffer
 * @param {string} fileType - File type ('csv' or 'xlsx')
 * @param {Object} config - Configuration object
 * @param {string} fileName - Original file name
 * @returns {Promise<Object>} - Preview result
 */
export async function processFilePreview(fileBuffer, fileType, config, fileName) {
  try {
    const {
      columnMapping,
      urlPattern,
      grouping = 'none',
      includeLastmod = false,
      lastmodField = 'lastmod',
      changefreq = null,
      priority = null
    } = config;

    // Extract headers based on file type
    let headers;
    let rowGenerator;

    if (fileType === 'csv') {
      headers = await extractCsvHeaders(fileBuffer);
      rowGenerator = parseCsvRows(fileBuffer, headers);
    } else if (fileType === 'xlsx') {
      headers = await extractExcelHeaders(fileBuffer);
      rowGenerator = parseExcelRows(fileBuffer, headers);
    } else {
      throw new Error(`Unsupported file type: ${fileType}`);
    }

    // Collect all rows first (since generators can only be iterated once)
    const allRows = [];
    for await (const rowResult of rowGenerator) {
      allRows.push(rowResult);
    }
    
    const totalRows = allRows.length;
    
    // Process first 5 rows for preview
    const sampleUrls = [];
    const excludedReasons = [];
    const sampleData = [];
    let validCount = 0;
    let excludedCount = 0;
    const maxPreviewRows = 5;

    for (let i = 0; i < Math.min(maxPreviewRows, allRows.length); i++) {
      const rowResult = allRows[i];
      const rowData = rowResult.data; // Extract the data object
      const rowNumber = rowResult.rowNumber;
      
      sampleData.push(rowData);

      // Apply URL pattern
      const urlResult = applyUrlPattern(urlPattern, rowData, columnMapping);
      
      if (urlResult.success) {
        validCount++;
        sampleUrls.push({
          url: urlResult.url,
          rowNumber: rowNumber
        });
      } else {
        excludedCount++;
        excludedReasons.push(`Row ${rowNumber}: ${urlResult.error}`);
      }
    }

    const preview = {
      sampleUrls: sampleUrls.slice(0, 5), // Show max 5 sample URLs
      validCount,
      excludedCount,
      excludedReasons: [...new Set(excludedReasons)], // Remove duplicates
      totalSampled: Math.min(sampleData.length, maxPreviewRows),
      totalRows,
      sampleData: sampleData.slice(0, 3), // Show max 3 sample data rows
      metadata: {
        fileName,
        fileType,
        headers,
        columnMapping,
        urlPattern,
        grouping,
        includeLastmod,
        lastmodField,
        changefreq,
        priority
      }
    };

    return {
      success: true,
      preview
    };

  } catch (error) {
    console.error('Preview processing error:', error);
    return {
      success: false,
      error: error.message || 'Preview generation failed'
    };
  }
}