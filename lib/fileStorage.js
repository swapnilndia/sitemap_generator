import fs from 'fs/promises';
import path from 'path';
import { isValidBatchId } from './batchProcessing.js';

// Create temp directory for storing JSON files
// Use /tmp in deployment environments, fallback to local temp for development
const TEMP_DIR = process.env.NODE_ENV === 'production' 
  ? '/tmp' 
  : path.join(process.cwd(), 'temp');
const BATCH_DIR = path.join(TEMP_DIR, 'batches');

// Ensure temp directory exists
async function ensureTempDir() {
  try {
    await fs.access(TEMP_DIR);
  } catch {
    await fs.mkdir(TEMP_DIR, { recursive: true });
  }
}

// Ensure batch directory exists
async function ensureBatchDir() {
  try {
    await fs.access(BATCH_DIR);
  } catch {
    await fs.mkdir(BATCH_DIR, { recursive: true });
  }
}

// Get batch directory path
function getBatchDirPath(batchId) {
  return path.join(BATCH_DIR, batchId);
}

// Ensure specific batch directory exists
async function ensureBatchDirExists(batchId) {
  if (!isValidBatchId(batchId)) {
    throw new Error('Invalid batch ID');
  }

  const batchPath = getBatchDirPath(batchId);
  try {
    await fs.access(batchPath);
  } catch {
    await fs.mkdir(batchPath, { recursive: true });
  }
  return batchPath;
}

// Clean up old files (older than 1 hour)
async function cleanupOldFiles() {
  try {
    await ensureTempDir();
    const items = await fs.readdir(TEMP_DIR);
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    for (const item of items) {
      const itemPath = path.join(TEMP_DIR, item);
      const stats = await fs.stat(itemPath);

      if (now - stats.mtime.getTime() > oneHour) {
        if (stats.isDirectory()) {
          // Skip batch directory - it has its own cleanup
          if (item === 'batches') continue;

          await fs.rm(itemPath, { recursive: true, force: true });
          console.log(`Cleaned up old directory: ${item}`);
        } else {
          await fs.unlink(itemPath);
          console.log(`Cleaned up old file: ${item}`);
        }
      }
    }

    // Also cleanup old batches (older than 24 hours)
    await cleanupOldBatches();
  } catch (error) {
    console.error('Error cleaning up old files:', error);
  }
}

// Clear all files in temp directory
async function clearAllFiles() {
  try {
    await ensureTempDir();
    const files = await fs.readdir(TEMP_DIR);

    for (const file of files) {
      const filePath = path.join(TEMP_DIR, file);
      await fs.unlink(filePath);
    }

    console.log(`Cleared ${files.length} files from temp directory`);
    return { success: true, filesCleared: files.length };
  } catch (error) {
    console.error('Error clearing files:', error);
    return { success: false, error: error.message };
  }
}

// Save JSON data to file (optimized for sitemap creation only)
async function saveJsonFile(fileId, jsonData, config = {}) {
  try {
    await ensureTempDir();

    // Optimize JSON structure - keep only essential data for sitemap creation
    const optimizedData = {
      urls: [],
      statistics: {
        totalUrls: 0,
        validUrls: 0,
        excludedUrls: 0,
        duplicateUrls: 0,
        invalidLastmod: 0
      },
      metadata: {
        createdAt: new Date().toISOString(),
        fileId,
        config
      }
    };

    // Preserve original statistics if available, mapping field names correctly
    if (jsonData.statistics) {
      optimizedData.statistics = {
        totalUrls: jsonData.statistics.totalRows || 0,
        validUrls: jsonData.statistics.validUrls || 0,
        excludedUrls: jsonData.statistics.excludedRows || 0,
        duplicateUrls: jsonData.statistics.duplicateUrls || 0,
        invalidLastmod: jsonData.statistics.invalidLastmod || 0
      };
    }

    // Extract only essential URL data
    if (jsonData.data && Array.isArray(jsonData.data)) {
      for (const entry of jsonData.data) {
        if (entry.processed && entry.processed.url && !entry.processed.excluded && !entry.processed.isDuplicate) {
          // Only store essential sitemap fields for valid URLs
          optimizedData.urls.push({
            loc: entry.processed.url,
            lastmod: entry.processed.lastmod || null,
            changefreq: entry.processed.changefreq || null,
            priority: entry.processed.priority || null,
            group: entry.processed.group || 'default'
          });
        }
      }

      // Update the validUrls count to match the actual URLs we're storing
      optimizedData.statistics.validUrls = optimizedData.urls.length;
    }

    const filePath = path.join(TEMP_DIR, `${fileId}.json`);
    await fs.writeFile(filePath, JSON.stringify(optimizedData, null, 2));

    console.log(`Saved optimized JSON file: ${fileId}.json (${optimizedData.statistics.validUrls} URLs)`);

    return {
      success: true,
      filePath,
      statistics: optimizedData.statistics
    };
  } catch (error) {
    console.error('Error saving JSON file:', error);
    return { success: false, error: error.message };
  }
}

// Load JSON data from file
async function loadJsonFile(fileId) {
  try {
    const filePath = path.join(TEMP_DIR, `${fileId}.json`);
    const data = await fs.readFile(filePath, 'utf8');
    const jsonData = JSON.parse(data);

    return {
      success: true,
      data: jsonData,
      filePath
    };
  } catch (error) {
    console.error('Error loading JSON file:', error);
    return { success: false, error: error.message };
  }
}

// Check if file exists
async function fileExists(fileId) {
  try {
    const filePath = path.join(TEMP_DIR, `${fileId}.json`);
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// Get file info
async function getFileInfo(fileId) {
  try {
    const filePath = path.join(TEMP_DIR, `${fileId}.json`);
    const stats = await fs.stat(filePath);

    return {
      success: true,
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Batch file operations

// Save batch metadata
async function saveBatchMetadata(batchId, metadata) {
  try {
    const batchPath = await ensureBatchDirExists(batchId);
    const metadataPath = path.join(batchPath, 'metadata.json');

    const batchMetadata = {
      ...metadata,
      batchId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await fs.writeFile(metadataPath, JSON.stringify(batchMetadata, null, 2));

    return {
      success: true,
      filePath: metadataPath
    };
  } catch (error) {
    console.error('Error saving batch metadata:', error);
    return { success: false, error: error.message };
  }
}

// Load batch metadata
async function loadBatchMetadata(batchId) {
  try {
    const batchPath = getBatchDirPath(batchId);
    const metadataPath = path.join(batchPath, 'metadata.json');

    const data = await fs.readFile(metadataPath, 'utf8');
    const metadata = JSON.parse(data);

    return {
      success: true,
      metadata
    };
  } catch (error) {
    console.error('Error loading batch metadata:', error);
    return { success: false, error: error.message };
  }
}

// Save batch file (individual file within a batch)
async function saveBatchFile(batchId, fileId, jsonData, config = {}) {
  try {
    const batchPath = await ensureBatchDirExists(batchId);

    // Create optimized data structure for batch files
    const optimizedData = {
      urls: [],
      statistics: {
        totalUrls: 0,
        validUrls: 0,
        excludedUrls: 0,
        duplicateUrls: 0,
        invalidLastmod: 0
      },
      metadata: {
        createdAt: new Date().toISOString(),
        fileId,
        batchId,
        config
      }
    };

    // Preserve original statistics if available
    if (jsonData.statistics) {
      optimizedData.statistics = {
        totalUrls: jsonData.statistics.totalRows || 0,
        validUrls: jsonData.statistics.validUrls || 0,
        excludedUrls: jsonData.statistics.excludedRows || 0,
        duplicateUrls: jsonData.statistics.duplicateUrls || 0,
        invalidLastmod: jsonData.statistics.invalidLastmod || 0
      };
    }

    // Extract URL data
    if (jsonData.data && Array.isArray(jsonData.data)) {
      for (const entry of jsonData.data) {
        if (entry.processed && entry.processed.url && !entry.processed.excluded && !entry.processed.isDuplicate) {
          optimizedData.urls.push({
            loc: entry.processed.url,
            lastmod: entry.processed.lastmod || null,
            changefreq: entry.processed.changefreq || null,
            priority: entry.processed.priority || null,
            group: entry.processed.group || 'default'
          });
        }
      }

      optimizedData.statistics.validUrls = optimizedData.urls.length;
    }

    const filePath = path.join(batchPath, `${fileId}.json`);
    await fs.writeFile(filePath, JSON.stringify(optimizedData, null, 2));

    console.log(`Saved batch file: ${batchId}/${fileId}.json (${optimizedData.statistics.validUrls} URLs)`);

    return {
      success: true,
      filePath,
      statistics: optimizedData.statistics
    };
  } catch (error) {
    console.error('Error saving batch file:', error);
    return { success: false, error: error.message };
  }
}

// Load batch file
async function loadBatchFile(batchId, fileId) {
  try {
    // First check in-memory storage
    if (global.fileStorage) {
      // Look for JSON file with this original file ID
      for (const [jsonFileId, fileData] of global.fileStorage.entries()) {
        if (fileData.batchId === batchId && 
            fileData.originalFileId === fileId && 
            jsonFileId.endsWith('_json')) {
          return {
            success: true,
            data: fileData.jsonData,
            filePath: `memory:${jsonFileId}`
          };
        }
      }
    }

    // Fallback to file system
    const batchPath = getBatchDirPath(batchId);
    const filePath = path.join(batchPath, `${fileId}.json`);

    const data = await fs.readFile(filePath, 'utf8');
    const jsonData = JSON.parse(data);

    return {
      success: true,
      data: jsonData,
      filePath
    };
  } catch (error) {
    console.error('Error loading batch file:', error);
    return { success: false, error: error.message };
  }
}

// Get all files in a batch
async function getBatchFiles(batchId) {
  try {
    // First check in-memory storage for converted JSON files
    const memoryFiles = [];
    if (global.fileStorage) {
      for (const [fileId, fileData] of global.fileStorage.entries()) {
        if (fileData.batchId === batchId && fileId.endsWith('_json')) {
          memoryFiles.push({
            fileId: fileData.originalFileId, // Use original file ID
            jsonFileId: fileId, // Store the JSON file ID
            fileName: `${fileData.originalName}.json`,
            size: JSON.stringify(fileData.jsonData).length,
            created: fileData.convertedAt || new Date(),
            modified: fileData.convertedAt || new Date(),
            data: fileData.jsonData, // Include the actual data
            stats: fileData.stats
          });
        }
      }
    }

    // If we found files in memory, return them
    if (memoryFiles.length > 0) {
      return {
        success: true,
        files: memoryFiles
      };
    }

    // Fallback to file system (for backward compatibility)
    const batchPath = getBatchDirPath(batchId);
    const files = await fs.readdir(batchPath);

    // Filter out metadata.json and only return .json files
    const jsonFiles = files.filter(file =>
      file.endsWith('.json') && file !== 'metadata.json'
    );

    const fileInfos = [];
    for (const file of jsonFiles) {
      const filePath = path.join(batchPath, file);
      const stats = await fs.stat(filePath);
      const fileId = path.basename(file, '.json');

      fileInfos.push({
        fileId,
        fileName: file,
        filePath,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime
      });
    }

    return {
      success: true,
      files: fileInfos
    };
  } catch (error) {
    console.error('Error getting batch files:', error);
    return { success: false, error: error.message };
  }
}

// Check if batch exists
async function batchExists(batchId) {
  try {
    // First check in-memory storage
    if (global.fileStorage) {
      for (const [fileId, fileData] of global.fileStorage.entries()) {
        if (fileData.batchId === batchId) {
          return true;
        }
      }
    }

    // Fallback to file system
    const batchPath = getBatchDirPath(batchId);
    await fs.access(batchPath);
    return true;
  } catch {
    return false;
  }
}

// Check if batch file exists
async function batchFileExists(batchId, fileId) {
  try {
    const batchPath = getBatchDirPath(batchId);
    const filePath = path.join(batchPath, `${fileId}.json`);
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// Delete batch file
async function deleteBatchFile(batchId, fileId) {
  try {
    const batchPath = getBatchDirPath(batchId);
    const filePath = path.join(batchPath, `${fileId}.json`);
    await fs.unlink(filePath);

    return { success: true };
  } catch (error) {
    console.error('Error deleting batch file:', error);
    return { success: false, error: error.message };
  }
}

// Delete entire batch directory
async function deleteBatch(batchId) {
  try {
    const batchPath = getBatchDirPath(batchId);
    await fs.rm(batchPath, { recursive: true, force: true });

    console.log(`Deleted batch directory: ${batchId}`);
    return { success: true };
  } catch (error) {
    console.error('Error deleting batch:', error);
    return { success: false, error: error.message };
  }
}

// Clean up old batches (older than specified time)
async function cleanupOldBatches(maxAgeMs = 24 * 60 * 60 * 1000) { // Default 24 hours
  try {
    await ensureBatchDir();
    const batches = await fs.readdir(BATCH_DIR);
    const now = Date.now();
    let cleanedCount = 0;

    for (const batchId of batches) {
      const batchPath = path.join(BATCH_DIR, batchId);
      const stats = await fs.stat(batchPath);

      if (now - stats.mtime.getTime() > maxAgeMs) {
        await fs.rm(batchPath, { recursive: true, force: true });
        console.log(`Cleaned up old batch: ${batchId}`);
        cleanedCount++;
      }
    }

    return { success: true, cleanedCount };
  } catch (error) {
    console.error('Error cleaning up old batches:', error);
    return { success: false, error: error.message };
  }
}

// Get batch storage statistics
async function getBatchStorageStats(batchId) {
  try {
    const batchPath = getBatchDirPath(batchId);
    const files = await fs.readdir(batchPath);

    let totalSize = 0;
    let fileCount = 0;

    for (const file of files) {
      const filePath = path.join(batchPath, file);
      const stats = await fs.stat(filePath);
      totalSize += stats.size;
      if (file.endsWith('.json') && file !== 'metadata.json') {
        fileCount++;
      }
    }

    return {
      success: true,
      stats: {
        batchId,
        fileCount,
        totalSize,
        averageFileSize: fileCount > 0 ? Math.round(totalSize / fileCount) : 0
      }
    };
  } catch (error) {
    console.error('Error getting batch storage stats:', error);
    return { success: false, error: error.message };
  }
}

// Validate batch storage integrity
async function validateBatchStorage(batchId) {
  try {
    const batchPath = getBatchDirPath(batchId);
    const issues = [];

    // Check if batch directory exists
    if (!await batchExists(batchId)) {
      issues.push('Batch directory does not exist');
      return { success: false, issues };
    }

    // Check if metadata exists
    const metadataPath = path.join(batchPath, 'metadata.json');
    try {
      await fs.access(metadataPath);
    } catch {
      issues.push('Batch metadata file missing');
    }

    // Check file integrity
    const filesResult = await getBatchFiles(batchId);
    if (filesResult.success) {
      for (const fileInfo of filesResult.files) {
        try {
          const loadResult = await loadBatchFile(batchId, fileInfo.fileId);
          if (!loadResult.success) {
            issues.push(`File ${fileInfo.fileId} is corrupted or unreadable`);
          }
        } catch (error) {
          issues.push(`File ${fileInfo.fileId} validation failed: ${error.message}`);
        }
      }
    }

    return {
      success: issues.length === 0,
      issues
    };
  } catch (error) {
    console.error('Error validating batch storage:', error);
    return { success: false, issues: [error.message] };
  }
}

export {
  ensureTempDir,
  ensureBatchDir,
  cleanupOldFiles,
  clearAllFiles,
  saveJsonFile,
  loadJsonFile,
  fileExists,
  getFileInfo,
  // Batch operations
  saveBatchMetadata,
  loadBatchMetadata,
  saveBatchFile,
  loadBatchFile,
  getBatchFiles,
  batchExists,
  batchFileExists,
  deleteBatchFile,
  deleteBatch,
  cleanupOldBatches,
  getBatchStorageStats,
  validateBatchStorage
};