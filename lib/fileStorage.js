import fs from 'fs/promises';
import path from 'path';

// Create temp directory for storing JSON files
const TEMP_DIR = path.join(process.cwd(), 'temp');

// Ensure temp directory exists
async function ensureTempDir() {
  try {
    await fs.access(TEMP_DIR);
  } catch {
    await fs.mkdir(TEMP_DIR, { recursive: true });
  }
}

// Clean up old files (older than 1 hour)
async function cleanupOldFiles() {
  try {
    await ensureTempDir();
    const files = await fs.readdir(TEMP_DIR);
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    for (const file of files) {
      const filePath = path.join(TEMP_DIR, file);
      const stats = await fs.stat(filePath);
      
      if (now - stats.mtime.getTime() > oneHour) {
        await fs.unlink(filePath);
        console.log(`Cleaned up old file: ${file}`);
      }
    }
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

export {
  ensureTempDir,
  cleanupOldFiles,
  clearAllFiles,
  saveJsonFile,
  loadJsonFile,
  fileExists,
  getFileInfo
};