/**
 * Batch Download Manager
 * Handles individual and batch downloads, ZIP archive creation, and download URL management
 */

import archiver from 'archiver';
import fs from 'fs/promises';
import path from 'path';
import { getBatchFiles, loadBatchFile, batchExists } from './fileStorage.js';
import { isValidBatchId } from './batchProcessing.js';

// Download URL storage (in production, use Redis or database)
const downloadUrls = new Map();
const DOWNLOAD_URL_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Generate secure download URL
 * @param {string} type - Download type ('file' or 'batch')
 * @param {string} id - File or batch ID
 * @returns {string} Secure download URL
 */
export function generateDownloadUrl(type, id, filePath = null) {
  const token = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 12)}`;
  const expiresAt = Date.now() + DOWNLOAD_URL_EXPIRY;
  
  downloadUrls.set(token, {
    type,
    id,
    filePath, // Store the actual file path
    expiresAt,
    createdAt: Date.now()
  });
  
  return token;
}

/**
 * Validate download token
 * @param {string} token - Download token
 * @returns {Object|null} Download info or null if invalid
 */
export function validateDownloadToken(token) {
  const downloadInfo = downloadUrls.get(token);
  
  if (!downloadInfo) {
    return null;
  }
  
  if (Date.now() > downloadInfo.expiresAt) {
    downloadUrls.delete(token);
    return null;
  }
  
  return downloadInfo;
}

/**
 * Create ZIP archive for batch download
 * @param {string} batchId - Batch identifier
 * @param {Array} fileIds - Optional array of specific file IDs to include
 * @returns {Promise<Object>} Result with ZIP file path
 */
export async function createBatchZip(batchId, fileIds = null) {
  try {
    if (!isValidBatchId(batchId)) {
      throw new Error('Invalid batch ID');
    }
    
    if (!await batchExists(batchId)) {
      throw new Error('Batch not found');
    }
    
    // Get batch files
    const batchFilesResult = await getBatchFiles(batchId);
    if (!batchFilesResult.success) {
      throw new Error('Failed to get batch files');
    }
    
    let filesToInclude = batchFilesResult.files;
    
    // Filter by specific file IDs if provided
    if (fileIds && Array.isArray(fileIds)) {
      filesToInclude = filesToInclude.filter(file => 
        fileIds.includes(file.fileId)
      );
    }
    
    if (filesToInclude.length === 0) {
      throw new Error('No files to include in ZIP');
    }
    
    // Create ZIP file
    const zipFileName = `batch_${batchId}_${Date.now()}.zip`;
    // Use /tmp in deployment environments, fallback to local temp for development
    const TEMP_DIR = process.env.NODE_ENV === 'production' 
      ? '/tmp' 
      : path.join(process.cwd(), 'temp');
    const zipPath = path.join(TEMP_DIR, zipFileName);
    
    await createZipArchive(batchId, filesToInclude, zipPath);
    
    return {
      success: true,
      zipPath,
      zipFileName,
      fileCount: filesToInclude.length
    };
    
  } catch (error) {
    console.error('Error creating batch ZIP:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Create ZIP archive from files
 * @param {string} batchId - Batch identifier
 * @param {Array} files - Array of file info objects
 * @param {string} outputPath - Output ZIP file path
 * @returns {Promise<void>}
 */
async function createZipArchive(batchId, files, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const output = await fs.open(outputPath, 'w');
      const archive = archiver('zip', {
        zlib: { level: 9 } // Maximum compression
      });
      
      // Handle archive events
      archive.on('error', (err) => {
        output.close();
        reject(err);
      });
      
      archive.on('end', () => {
        output.close();
        resolve();
      });
      
      // Pipe archive to file
      archive.pipe(output.createWriteStream());
      
      // Add files to archive
      for (const fileInfo of files) {
        try {
          const loadResult = await loadBatchFile(batchId, fileInfo.fileId);
          
          if (loadResult.success) {
            // Create a clean filename for the JSON
            const originalName = fileInfo.fileId.split('_').pop() || fileInfo.fileId;
            const cleanFileName = `${sanitizeFileName(originalName)}.json`;
            
            // Add JSON content to ZIP
            archive.append(
              JSON.stringify(loadResult.data, null, 2),
              { name: cleanFileName }
            );
          } else {
            console.warn(`Failed to load file ${fileInfo.fileId} for ZIP`);
          }
        } catch (fileError) {
          console.warn(`Error processing file ${fileInfo.fileId}:`, fileError);
        }
      }
      
      // Finalize the archive
      await archive.finalize();
      
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Download single file
 * @param {string} batchId - Batch identifier
 * @param {string} fileId - File identifier
 * @returns {Promise<Object>} Download result
 */
export async function downloadSingleFile(batchId, fileId) {
  try {
    if (!isValidBatchId(batchId)) {
      throw new Error('Invalid batch ID');
    }
    
    const loadResult = await loadBatchFile(batchId, fileId);
    
    if (!loadResult.success) {
      throw new Error('File not found or could not be loaded');
    }
    
    // Generate download token
    const downloadToken = generateDownloadUrl('file', `${batchId}/${fileId}`);
    
    // Create filename
    const originalName = fileId.split('_').pop() || fileId;
    const fileName = `${sanitizeFileName(originalName)}.json`;
    
    return {
      success: true,
      downloadToken,
      fileName,
      fileSize: JSON.stringify(loadResult.data).length,
      data: loadResult.data
    };
    
  } catch (error) {
    console.error('Error downloading single file:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Download batch as ZIP
 * @param {string} batchId - Batch identifier
 * @param {Array} fileIds - Optional specific file IDs
 * @returns {Promise<Object>} Download result
 */
export async function downloadBatch(batchId, fileIds = null) {
  try {
    const zipResult = await createBatchZip(batchId, fileIds);
    
    if (!zipResult.success) {
      throw new Error(zipResult.error);
    }
    
    // Generate download token with file path
    const downloadToken = generateDownloadUrl('batch', batchId, zipResult.zipPath);
    
    // Get file stats
    const stats = await fs.stat(zipResult.zipPath);
    
    return {
      success: true,
      downloadToken,
      fileName: zipResult.zipFileName,
      fileSize: stats.size,
      fileCount: zipResult.fileCount,
      zipPath: zipResult.zipPath
    };
    
  } catch (error) {
    console.error('Error downloading batch:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get download file info
 * @param {string} token - Download token
 * @returns {Promise<Object>} File info or error
 */
export async function getDownloadFileInfo(token) {
  try {
    const downloadInfo = validateDownloadToken(token);
    
    if (!downloadInfo) {
      throw new Error('Invalid or expired download token');
    }
    
    if (downloadInfo.type === 'file') {
      const [batchId, fileId] = downloadInfo.id.split('/');
      const loadResult = await loadBatchFile(batchId, fileId);
      
      if (!loadResult.success) {
        throw new Error('File not found');
      }
      
      const originalName = fileId.split('_').pop() || fileId;
      const fileName = `${sanitizeFileName(originalName)}.json`;
      
      return {
        success: true,
        type: 'file',
        fileName,
        fileSize: JSON.stringify(loadResult.data).length,
        data: loadResult.data
      };
      
    } else if (downloadInfo.type === 'batch') {
      const batchId = downloadInfo.id;
      
      // Use stored file path if available, otherwise reconstruct
      let zipPath = downloadInfo.filePath;
      if (!zipPath) {
        const zipFileName = `batch_${batchId}_${Date.now()}.zip`;
        // Use /tmp in deployment environments, fallback to local temp for development
        const TEMP_DIR = process.env.NODE_ENV === 'production' 
          ? '/tmp' 
          : path.join(process.cwd(), 'temp');
        zipPath = path.join(TEMP_DIR, zipFileName);
      }
      
      // Check if ZIP file exists, create if not
      try {
        await fs.access(zipPath);
      } catch {
        const zipResult = await createBatchZip(batchId);
        if (!zipResult.success) {
          throw new Error('Failed to create ZIP file');
        }
        zipPath = zipResult.zipPath; // Use the actual created path
      }
      
      const stats = await fs.stat(zipPath);
      const zipFileName = path.basename(zipPath);
      
      return {
        success: true,
        type: 'batch',
        fileName: zipFileName,
        fileSize: stats.size,
        filePath: zipPath
      };
    }
    
    throw new Error('Unknown download type');
    
  } catch (error) {
    console.error('Error getting download file info:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Clean up expired download URLs
 */
export function cleanupExpiredDownloads() {
  const now = Date.now();
  let cleanedCount = 0;
  
  for (const [token, info] of downloadUrls.entries()) {
    if (now > info.expiresAt) {
      downloadUrls.delete(token);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`Cleaned up ${cleanedCount} expired download URLs`);
  }
  
  return cleanedCount;
}

/**
 * Clean up temporary ZIP files
 * @param {number} maxAgeMs - Maximum age in milliseconds
 */
export async function cleanupTempZipFiles(maxAgeMs = 24 * 60 * 60 * 1000) {
  try {
    // Use /tmp in deployment environments, fallback to local temp for development
    const TEMP_DIR = process.env.NODE_ENV === 'production' 
      ? '/tmp' 
      : path.join(process.cwd(), 'temp');
    const tempDir = TEMP_DIR;
    const files = await fs.readdir(tempDir);
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const file of files) {
      if (file.startsWith('batch_') && file.endsWith('.zip')) {
        const filePath = path.join(tempDir, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtime.getTime() > maxAgeMs) {
          await fs.unlink(filePath);
          cleanedCount++;
          console.log(`Cleaned up temp ZIP file: ${file}`);
        }
      }
    }
    
    return { success: true, cleanedCount };
    
  } catch (error) {
    console.error('Error cleaning up temp ZIP files:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get download statistics
 * @returns {Object} Download statistics
 */
export function getDownloadStats() {
  const now = Date.now();
  let activeUrls = 0;
  let expiredUrls = 0;
  
  for (const [token, info] of downloadUrls.entries()) {
    if (now > info.expiresAt) {
      expiredUrls++;
    } else {
      activeUrls++;
    }
  }
  
  return {
    activeUrls,
    expiredUrls,
    totalUrls: downloadUrls.size
  };
}

/**
 * Sanitize filename for safe download
 * @param {string} filename - Original filename
 * @returns {string} Sanitized filename
 */
function sanitizeFileName(filename) {
  if (!filename) return 'download';
  
  return filename
    .replace(/[^a-zA-Z0-9\-_\s]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase() || 'download';
}

/**
 * Initialize download manager
 */
export function initializeDownloadManager() {
  console.log('Download manager initialized');
  
  // Set up periodic cleanup
  setInterval(() => {
    cleanupExpiredDownloads();
    cleanupTempZipFiles();
  }, 60 * 60 * 1000); // Every hour
}

/**
 * Shutdown download manager
 */
export function shutdownDownloadManager() {
  console.log('Shutting down download manager');
  downloadUrls.clear();
}