/**
 * CSV parsing utilities using csv-parse for streaming
 */

import { parse } from 'csv-parse';
import { Readable } from 'stream';

/**
 * Extracts headers from CSV file buffer
 * @param {Buffer} fileBuffer - The CSV file buffer
 * @returns {Promise<string[]>} - Array of column headers
 */
export async function extractCsvHeaders(fileBuffer) {
  return new Promise((resolve, reject) => {
    const headers = [];
    let headersParsed = false;

    const parser = parse({
      delimiter: ',',
      quote: '"',
      escape: '"',
      skip_empty_lines: true,
      trim: true
    });

    parser.on('data', (row) => {
      if (!headersParsed) {
        headers.push(...row);
        headersParsed = true;
        parser.destroy(); // Stop after first row
      }
    });

    parser.on('error', (error) => {
      reject(new Error(`CSV parsing error: ${error.message}`));
    });

    parser.on('end', () => {
      resolve(headers);
    });

    parser.on('close', () => {
      resolve(headers);
    });

    // Create readable stream from buffer
    const readable = Readable.from(fileBuffer);
    readable.pipe(parser);
  });
}

/**
 * Parses CSV file and yields rows as objects
 * @param {Buffer} fileBuffer - The CSV file buffer
 * @param {string[]} headers - Column headers
 * @returns {AsyncGenerator<Object>} - Generator yielding row objects
 */
export async function* parseCsvRows(fileBuffer, headers) {
  let rowCount = 0;
  let isFirstRow = true;

  const parser = parse({
    delimiter: ',',
    quote: '"',
    escape: '"',
    skip_empty_lines: true,
    trim: true
  });

  const readable = Readable.from(fileBuffer);
  readable.pipe(parser);

  for await (const row of parser) {
    // Skip header row
    if (isFirstRow) {
      isFirstRow = false;
      continue;
    }

    rowCount++;

    // Convert array to object using headers
    const rowObject = {};
    headers.forEach((header, index) => {
      rowObject[header] = row[index] || '';
    });

    yield { data: rowObject, rowNumber: rowCount };
  }
}

/**
 * Gets a preview of CSV data (first few rows)
 * @param {Buffer} fileBuffer - The CSV file buffer
 * @param {number} previewCount - Number of rows to preview (default: 5)
 * @returns {Promise<Object>} - Preview data with headers and sample rows
 */
export async function getCsvPreview(fileBuffer, previewCount = 5) {
  try {
    const headers = await extractCsvHeaders(fileBuffer);
    const previewRows = [];
    let count = 0;

    for await (const { data } of parseCsvRows(fileBuffer, headers)) {
      if (count >= previewCount) break;
      previewRows.push(data);
      count++;
    }

    return {
      headers,
      previewRows,
      totalPreviewRows: count
    };
  } catch (error) {
    throw new Error(`Failed to preview CSV: ${error.message}`);
  }
}

/**
 * Counts total rows in CSV file (excluding header)
 * @param {Buffer} fileBuffer - The CSV file buffer
 * @returns {Promise<number>} - Total number of data rows
 */
export async function countCsvRows(fileBuffer) {
  let rowCount = 0;
  let isFirstRow = true;

  const parser = parse({
    delimiter: ',',
    quote: '"',
    escape: '"',
    skip_empty_lines: true,
    trim: true
  });

  const readable = Readable.from(fileBuffer);
  readable.pipe(parser);

  for await (const row of parser) {
    if (isFirstRow) {
      isFirstRow = false;
      continue;
    }
    rowCount++;
  }

  return rowCount;
}

/**
 * Validates CSV file structure
 * @param {Buffer} fileBuffer - The CSV file buffer
 * @returns {Promise<Object>} - Validation result
 */
export async function validateCsvStructure(fileBuffer) {
  try {
    const headers = await extractCsvHeaders(fileBuffer);
    
    if (!headers || headers.length === 0) {
      return {
        success: false,
        error: 'CSV file appears to be empty or has no headers'
      };
    }

    // Check for duplicate headers
    const duplicateHeaders = headers.filter((header, index) => 
      headers.indexOf(header) !== index
    );

    if (duplicateHeaders.length > 0) {
      return {
        success: false,
        error: `Duplicate column headers found: ${duplicateHeaders.join(', ')}`
      };
    }

    // Check for empty headers
    const emptyHeaders = headers.filter(header => !header || header.trim() === '');
    if (emptyHeaders.length > 0) {
      return {
        success: false,
        error: 'CSV file contains empty column headers'
      };
    }

    const rowCount = await countCsvRows(fileBuffer);

    return {
      success: true,
      headers,
      rowCount
    };
  } catch (error) {
    return {
      success: false,
      error: `CSV validation failed: ${error.message}`
    };
  }
}