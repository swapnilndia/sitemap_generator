/**
 * Serverless-Compatible Storage System
 * Replaces global memory storage with persistent file-based storage
 * Designed specifically for serverless environments (Vercel, Netlify, etc.)
 */

import fs from 'fs/promises';
import path from 'path';

// Environment-specific configuration
const ENV_CONFIG = {
  development: {
    tempDir: path.join(process.cwd(), 'temp'),
    maxFileSize: 50 * 1024 * 1024, // 50MB
    cleanupInterval: 300000 // 5 minutes
  },
  production: {
    tempDir: '/tmp',
    maxFileSize: 10 * 1024 * 1024, // 10MB (serverless limit)
    cleanupInterval: 0 // No cleanup in serverless
  }
};

const config = ENV_CONFIG[process.env.NODE_ENV] || ENV_CONFIG.development;

class ServerlessStorage {
  constructor() {
    this.tempDir = config.tempDir;
    this.maxFileSize = config.maxFileSize;
    this.ensureTempDir();
  }

  /**
   * Ensure temp directory exists
   */
  async ensureTempDir() {
    try {
      await fs.access(this.tempDir);
    } catch {
      await fs.mkdir(this.tempDir, { recursive: true });
    }
  }

  /**
   * Save file data to persistent storage
   * @param {string} fileId - Unique file identifier
   * @param {Object} data - File data to store
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Save result
   */
  async saveFile(fileId, data, metadata = {}) {
    try {
      await this.ensureTempDir();
      
      const filePath = path.join(this.tempDir, `${fileId}.json`);
      const fileData = {
        data,
        metadata: {
          ...metadata,
          fileId,
          createdAt: new Date().toISOString(),
          size: JSON.stringify(data).length
        }
      };

      await fs.writeFile(filePath, JSON.stringify(fileData, null, 2));
      
      console.log(`Saved file ${fileId} to ${filePath}`);
      return { success: true, filePath, size: fileData.metadata.size };
    } catch (error) {
      console.error(`Error saving file ${fileId}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Load file data from persistent storage
   * @param {string} fileId - Unique file identifier
   * @returns {Promise<Object>} Load result
   */
  async loadFile(fileId) {
    try {
      const filePath = path.join(this.tempDir, `${fileId}.json`);
      const content = await fs.readFile(filePath, 'utf8');
      const fileData = JSON.parse(content);
      
      return {
        success: true,
        data: fileData.data,
        metadata: fileData.metadata,
        filePath
      };
    } catch (error) {
      console.error(`Error loading file ${fileId}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if file exists
   * @param {string} fileId - Unique file identifier
   * @returns {Promise<boolean>} True if file exists
   */
  async fileExists(fileId) {
    try {
      const filePath = path.join(this.tempDir, `${fileId}.json');
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete file from storage
   * @param {string} fileId - Unique file identifier
   * @returns {Promise<Object>} Delete result
   */
  async deleteFile(fileId) {
    try {
      const filePath = path.join(this.tempDir, `${fileId}.json`);
      await fs.unlink(filePath);
      
      console.log(`Deleted file ${fileId}`);
      return { success: true };
    } catch (error) {
      console.error(`Error deleting file ${fileId}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get file info without loading full data
   * @param {string} fileId - Unique file identifier
   * @returns {Promise<Object>} File info result
   */
  async getFileInfo(fileId) {
    try {
      const filePath = path.join(this.tempDir, `${fileId}.json`);
      const stats = await fs.stat(filePath);
      const content = await fs.readFile(filePath, 'utf8');
      const fileData = JSON.parse(content);

      return {
        success: true,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        metadata: fileData.metadata
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * List all files in storage
   * @returns {Promise<Array>} Array of file info objects
   */
  async listFiles() {
    try {
      await this.ensureTempDir();
      const files = await fs.readdir(this.tempDir);
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      
      const fileInfos = [];
      for (const file of jsonFiles) {
        const fileId = path.basename(file, '.json');
        const info = await this.getFileInfo(fileId);
        if (info.success) {
          fileInfos.push({
            fileId,
            ...info.metadata,
            ...info
          });
        }
      }
      
      return fileInfos;
    } catch (error) {
      console.error('Error listing files:', error);
      return [];
    }
  }

  /**
   * Clean up old files (only in development)
   * @param {number} maxAgeMs - Maximum age in milliseconds
   * @returns {Promise<Object>} Cleanup result
   */
  async cleanupOldFiles(maxAgeMs = 24 * 60 * 60 * 1000) {
    if (config.cleanupInterval === 0) {
      // Skip cleanup in production/serverless
      return { success: true, cleanedCount: 0 };
    }

    try {
      const files = await this.listFiles();
      const now = Date.now();
      let cleanedCount = 0;

      for (const file of files) {
        if (now - new Date(file.created).getTime() > maxAgeMs) {
          await this.deleteFile(file.fileId);
          cleanedCount++;
        }
      }

      console.log(`Cleaned up ${cleanedCount} old files`);
      return { success: true, cleanedCount };
    } catch (error) {
      console.error('Error cleaning up files:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get storage statistics
   * @returns {Promise<Object>} Storage stats
   */
  async getStorageStats() {
    try {
      const files = await this.listFiles();
      const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);
      
      return {
        success: true,
        fileCount: files.length,
        totalSize,
        averageFileSize: files.length > 0 ? Math.round(totalSize / files.length) : 0,
        tempDir: this.tempDir,
        maxFileSize: this.maxFileSize
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

// Create singleton instance
const serverlessStorage = new ServerlessStorage();

export default serverlessStorage;

// Export individual methods for convenience
export const {
  saveFile,
  loadFile,
  fileExists,
  deleteFile,
  getFileInfo,
  listFiles,
  cleanupOldFiles,
  getStorageStats
} = serverlessStorage;
