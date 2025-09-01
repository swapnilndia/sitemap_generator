/**
 * Excel parsing utilities using xlsx library
 */

import * as XLSX from 'xlsx';

/**
 * Extracts headers from Excel file buffer
 * @param {Buffer} fileBuffer - The Excel file buffer
 * @param {string} sheetName - Optional sheet name (uses first sheet if not provided)
 * @returns {Promise<string[]>} - Array of column headers
 */
export async function extractExcelHeaders(fileBuffer, sheetName = null) {
  try {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    
    // Use specified sheet or first sheet
    const targetSheetName = sheetName || workbook.SheetNames[0];
    const worksheet = workbook.Sheets[targetSheetName];
    
    if (!worksheet) {
      throw new Error(`Sheet "${targetSheetName}" not found`);
    }

    // Get the range of the worksheet
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
    
    // Extract headers from first row
    const headers = [];
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: range.s.r, c: col });
      const cell = worksheet[cellAddress];
      const headerValue = cell ? String(cell.v || '').trim() : '';
      
      if (headerValue) {
        headers.push(headerValue);
      }
    }

    return headers;
  } catch (error) {
    throw new Error(`Excel header extraction failed: ${error.message}`);
  }
}

/**
 * Parses Excel file and yields rows as objects
 * @param {Buffer} fileBuffer - The Excel file buffer
 * @param {string[]} headers - Column headers
 * @param {string} sheetName - Optional sheet name
 * @returns {AsyncGenerator<Object>} - Generator yielding row objects
 */
export async function* parseExcelRows(fileBuffer, headers, sheetName = null) {
  try {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    
    // Use specified sheet or first sheet
    const targetSheetName = sheetName || workbook.SheetNames[0];
    const worksheet = workbook.Sheets[targetSheetName];
    
    if (!worksheet) {
      throw new Error(`Sheet "${targetSheetName}" not found`);
    }

    // Get the range of the worksheet
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
    
    // Process rows starting from second row (skip headers)
    for (let row = range.s.r + 1; row <= range.e.r; row++) {
      const rowObject = {};
      let hasData = false;

      // Extract data for each column
      headers.forEach((header, colIndex) => {
        const col = range.s.c + colIndex;
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        const cell = worksheet[cellAddress];
        
        let cellValue = '';
        if (cell) {
          // Handle different cell types
          if (cell.t === 'n') {
            // Number
            cellValue = String(cell.v);
          } else if (cell.t === 'd') {
            // Date
            cellValue = cell.v.toISOString().split('T')[0]; // YYYY-MM-DD format
          } else {
            // String or other types
            cellValue = String(cell.v || '').trim();
          }
        }
        
        rowObject[header] = cellValue;
        if (cellValue) hasData = true;
      });

      // Only yield rows that have at least some data
      if (hasData) {
        yield { 
          data: rowObject, 
          rowNumber: row - range.s.r // Adjust for header row
        };
      }
    }
  } catch (error) {
    throw new Error(`Excel parsing failed: ${error.message}`);
  }
}

/**
 * Gets a preview of Excel data (first few rows)
 * @param {Buffer} fileBuffer - The Excel file buffer
 * @param {number} previewCount - Number of rows to preview (default: 5)
 * @param {string} sheetName - Optional sheet name
 * @returns {Promise<Object>} - Preview data with headers and sample rows
 */
export async function getExcelPreview(fileBuffer, previewCount = 5, sheetName = null) {
  try {
    const headers = await extractExcelHeaders(fileBuffer, sheetName);
    const previewRows = [];
    let count = 0;

    for await (const { data } of parseExcelRows(fileBuffer, headers, sheetName)) {
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
    throw new Error(`Failed to preview Excel: ${error.message}`);
  }
}

/**
 * Counts total rows in Excel file (excluding header)
 * @param {Buffer} fileBuffer - The Excel file buffer
 * @param {string} sheetName - Optional sheet name
 * @returns {Promise<number>} - Total number of data rows
 */
export async function countExcelRows(fileBuffer, sheetName = null) {
  try {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    
    // Use specified sheet or first sheet
    const targetSheetName = sheetName || workbook.SheetNames[0];
    const worksheet = workbook.Sheets[targetSheetName];
    
    if (!worksheet) {
      throw new Error(`Sheet "${targetSheetName}" not found`);
    }

    // Get the range of the worksheet
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
    
    // Count data rows (excluding header)
    return Math.max(0, range.e.r - range.s.r);
  } catch (error) {
    throw new Error(`Excel row counting failed: ${error.message}`);
  }
}

/**
 * Gets available sheet names from Excel file
 * @param {Buffer} fileBuffer - The Excel file buffer
 * @returns {Promise<string[]>} - Array of sheet names
 */
export async function getExcelSheetNames(fileBuffer) {
  try {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    return workbook.SheetNames;
  } catch (error) {
    throw new Error(`Failed to get sheet names: ${error.message}`);
  }
}

/**
 * Validates Excel file structure
 * @param {Buffer} fileBuffer - The Excel file buffer
 * @param {string} sheetName - Optional sheet name
 * @returns {Promise<Object>} - Validation result
 */
export async function validateExcelStructure(fileBuffer, sheetName = null) {
  try {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return {
        success: false,
        error: 'Excel file contains no worksheets'
      };
    }

    // Use specified sheet or first sheet
    const targetSheetName = sheetName || workbook.SheetNames[0];
    const worksheet = workbook.Sheets[targetSheetName];
    
    if (!worksheet) {
      return {
        success: false,
        error: `Sheet "${targetSheetName}" not found. Available sheets: ${workbook.SheetNames.join(', ')}`
      };
    }

    const headers = await extractExcelHeaders(fileBuffer, targetSheetName);
    
    if (!headers || headers.length === 0) {
      return {
        success: false,
        error: 'Excel sheet appears to be empty or has no headers'
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
        error: 'Excel sheet contains empty column headers'
      };
    }

    const rowCount = await countExcelRows(fileBuffer, targetSheetName);

    return {
      success: true,
      headers,
      rowCount,
      sheetNames: workbook.SheetNames,
      activeSheet: targetSheetName
    };
  } catch (error) {
    return {
      success: false,
      error: `Excel validation failed: ${error.message}`
    };
  }
}