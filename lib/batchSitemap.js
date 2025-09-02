/**
 * Batch Sitemap Generation System
 * Handles parallel sitemap creation from multiple JSON files with batch configuration
 */

import { create } from 'xmlbuilder2';
import fs from 'fs/promises';
import path from 'path';
import archiver from 'archiver';
import { getBatchFiles, loadBatchFile, batchExists } from './fileStorage.js';
import { isValidBatchId, generateBatchId } from './batchProcessing.js';

// Sitemap generation storage
const sitemapJobs = new Map();
// Use /tmp in deployment environments, fallback to local temp for development
const TEMP_DIR = process.env.NODE_ENV === 'production' 
  ? '/tmp' 
  : path.join(process.cwd(), 'temp');
const SITEMAP_DIR = path.join(TEMP_DIR, 'sitemaps');

/**
 * Ensure sitemap directory exists
 */
async function ensureSitemapDir() {
  try {
    await fs.access(SITEMAP_DIR);
  } catch {
    await fs.mkdir(SITEMAP_DIR, { recursive: true });
  }
}

/**
 * Generate sitemaps for batch
 * @param {string} batchId - Batch identifier
 * @param {Object} sitemapConfig - Sitemap configuration
 * @param {Array} fileIds - Optional specific file IDs to process
 * @returns {Promise<Object>} Generation result
 */
export async function generateBatchSitemaps(batchId, sitemapConfig = {}, fileIds = null) {
  try {
    if (!isValidBatchId(batchId)) {
      throw new Error('Invalid batch ID');
    }
    
    if (!await batchExists(batchId)) {
      throw new Error('Batch not found');
    }
    
    await ensureSitemapDir();
    
    // Get batch files
    const batchFilesResult = await getBatchFiles(batchId);
    if (!batchFilesResult.success) {
      throw new Error('Failed to get batch files');
    }
    
    let filesToProcess = batchFilesResult.files;
    
    // Filter by specific file IDs if provided
    if (fileIds && Array.isArray(fileIds)) {
      filesToProcess = filesToProcess.filter(file => 
        fileIds.includes(file.fileId)
      );
    }
    
    if (filesToProcess.length === 0) {
      throw new Error('No files to process for sitemap generation');
    }
    
    // Create sitemap job
    const sitemapJobId = `sitemap_${batchId}_${Date.now()}`;
    const sitemapJob = {
      jobId: sitemapJobId,
      batchId,
      status: 'processing',
      config: {
        maxPerFile: sitemapConfig.maxPerFile || 50000,
        grouping: sitemapConfig.grouping || 'group', // Use 'group' to group by the group property
        changefreq: sitemapConfig.changefreq || 'weekly',
        priority: sitemapConfig.priority || '0.8',
        includeLastmod: sitemapConfig.includeLastmod || false,
        ...sitemapConfig
      },
      files: filesToProcess,
      results: [],
      createdAt: new Date(),
      startedAt: new Date()
    };
    
    sitemapJobs.set(sitemapJobId, sitemapJob);
    
    // Process files in parallel
    const results = await Promise.allSettled(
      filesToProcess.map(file => 
        generateSitemapForFile(batchId, file, sitemapJob.config, sitemapJobId)
      )
    );
    
    // Process results
    const sitemapResults = [];
    const errors = [];
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        sitemapResults.push(result.value);
      } else {
        errors.push({
          fileId: filesToProcess[index].fileId,
          error: result.reason.message
        });
      }
    });
    
    // Update job status
    sitemapJob.status = errors.length === results.length ? 'failed' : 'completed';
    sitemapJob.results = sitemapResults;
    sitemapJob.errors = errors;
    sitemapJob.completedAt = new Date();
    
    sitemapJobs.set(sitemapJobId, sitemapJob);
    
    return {
      success: true,
      jobId: sitemapJobId,
      sitemapCount: sitemapResults.length,
      errorCount: errors.length,
      results: sitemapResults,
      errors
    };
    
  } catch (error) {
    console.error('Error generating batch sitemaps:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Generate sitemap for individual file
 * @param {string} batchId - Batch identifier
 * @param {Object} fileInfo - File information
 * @param {Object} config - Sitemap configuration
 * @param {string} jobId - Sitemap job ID
 * @returns {Promise<Object>} Sitemap generation result
 */
async function generateSitemapForFile(batchId, fileInfo, config, jobId) {
  try {
    // Load JSON file
    const loadResult = await loadBatchFile(batchId, fileInfo.fileId);
    if (!loadResult.success) {
      throw new Error('Failed to load JSON file');
    }
    
    const jsonData = loadResult.data;
    
    // Check for both 'urls' and 'data' properties for backward compatibility
    let urlsArray = jsonData.urls || jsonData.data;
    
    if (!urlsArray || !Array.isArray(urlsArray)) {
      throw new Error('Invalid JSON structure - missing URLs array (expected "urls" or "data" property)');
    }
    
    // Transform data structure if needed (for new format with processed URLs)
    if (jsonData.data && urlsArray.length > 0 && urlsArray[0].processed) {
      // Extract URLs from processed data
      urlsArray = urlsArray
        .filter(item => item.processed && item.processed.url && !item.processed.excluded)
        .map(item => ({
          url: item.processed.url,
          lastmod: item.processed.lastmod || null,
          changefreq: item.processed.changefreq || null,
          priority: item.processed.priority || null,
          group: item.processed.group || 'default'
        }));
    }
    
    if (urlsArray.length === 0) {
      throw new Error('No valid URLs found in the data');
    }
    
    // Group URLs if needed
    const urlGroups = groupUrls(urlsArray, config);
    
    // Generate sitemaps for each group
    const sitemapFiles = [];
    const sitemapErrors = [];
    
    for (const [groupName, urls] of Object.entries(urlGroups)) {
      const sitemapResult = await createSitemapFile(
        urls,
        config,
        fileInfo.fileId,
        groupName,
        jobId
      );
      
      if (sitemapResult.success) {
        sitemapFiles.push(sitemapResult);
      } else {
        sitemapErrors.push({
          groupName,
          error: sitemapResult.error,
          debug: sitemapResult.debug
        });
      }
    }
    
    return {
      success: true,
      fileId: fileInfo.fileId,
      originalName: fileInfo.fileId,
      sitemapCount: sitemapFiles.length,
      sitemapFiles,
      urlCount: urlsArray.length,
      errors: sitemapErrors
    };
    
  } catch (error) {
    console.error(`Error generating sitemap for file ${fileInfo.fileId}:`, error);
    throw error;
  }
}

/**
 * Group URLs based on configuration
 * @param {Array} urls - Array of URL objects
 * @param {Object} config - Grouping configuration
 * @returns {Object} Grouped URLs
 */
function groupUrls(urls, config) {
  const groups = {};
  
  if (config.grouping === 'none') {
    groups['sitemap'] = urls;
  } else if (config.grouping === 'auto') {
    // Auto-group by splitting large sets
    const maxPerFile = config.maxPerFile || 50000;
    
    if (urls.length <= maxPerFile) {
      groups['sitemap'] = urls;
    } else {
      // Split into multiple groups
      const groupCount = Math.ceil(urls.length / maxPerFile);
      
      for (let i = 0; i < groupCount; i++) {
        const start = i * maxPerFile;
        const end = Math.min(start + maxPerFile, urls.length);
        groups[`sitemap_${i + 1}`] = urls.slice(start, end);
      }
    }
  } else if (config.grouping === 'group') {
    // Group by the 'group' property in the URL data
    urls.forEach(url => {
      const groupValue = url.group || 'default';
      if (!groups[groupValue]) {
        groups[groupValue] = [];
      }
      groups[groupValue].push(url);
    });
  } else {
    // Group by specific field
    const groupField = config.grouping;
    
    urls.forEach(url => {
      const groupValue = url[groupField] || 'default';
      if (!groups[groupValue]) {
        groups[groupValue] = [];
      }
      groups[groupValue].push(url);
    });
    
    // Split large groups
    const maxPerFile = config.maxPerFile || 50000;
    const splitGroups = {};
    
    for (const [groupName, groupUrls] of Object.entries(groups)) {
      if (groupUrls.length <= maxPerFile) {
        splitGroups[groupName] = groupUrls;
      } else {
        const subGroupCount = Math.ceil(groupUrls.length / maxPerFile);
        
        for (let i = 0; i < subGroupCount; i++) {
          const start = i * maxPerFile;
          const end = Math.min(start + maxPerFile, groupUrls.length);
          splitGroups[`${groupName}_${i + 1}`] = groupUrls.slice(start, end);
        }
      }
    }
    
    return splitGroups;
  }
  
  return groups;
}

/**
 * Create sitemap XML file
 * @param {Array} urls - URLs for this sitemap
 * @param {Object} config - Sitemap configuration
 * @param {string} fileId - Original file ID
 * @param {string} groupName - Group name
 * @param {string} jobId - Job ID
 * @returns {Promise<Object>} Sitemap file result
 */
async function createSitemapFile(urls, config, fileId, groupName, jobId) {
  try {
    // Create XML document
    const root = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('urlset', {
        xmlns: 'http://www.sitemaps.org/schemas/sitemap/0.9'
      });
    
    // Add URLs to sitemap
    urls.forEach(urlData => {
      const urlElement = root.ele('url');
      
      // Required loc element
      urlElement.ele('loc').txt(urlData.url || urlData.loc);
      
      // Optional elements based on config and data
      if (config.includeLastmod && urlData.lastmod) {
        urlElement.ele('lastmod').txt(formatDate(urlData.lastmod));
      }
      
      if (urlData.changefreq || config.changefreq) {
        urlElement.ele('changefreq').txt(urlData.changefreq || config.changefreq);
      }
      
      if (urlData.priority || config.priority) {
        const priority = urlData.priority || config.priority;
        urlElement.ele('priority').txt(priority.toString());
      }
    });
    
    // Generate XML string
    const xmlContent = root.end({ prettyPrint: true });
    
    // Create filename
    const sanitizedFileId = sanitizeFileName(fileId);
    const sanitizedGroupName = sanitizeFileName(groupName);
    const fileName = `${sanitizedFileId}_${sanitizedGroupName}.xml`;
    const filePath = path.join(SITEMAP_DIR, jobId, fileName);
    
    // Ensure job directory exists
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    
    // Write sitemap file
    await fs.writeFile(filePath, xmlContent, 'utf8');
    
    // Get file stats
    const stats = await fs.stat(filePath);
    
    return {
      success: true,
      fileName,
      filePath,
      fileSize: stats.size,
      urlCount: urls.length,
      groupName
    };
    
  } catch (error) {
    console.error('Error creating sitemap file:', error);
    return {
      success: false,
      error: error.message,
      debug: {
        urlsLength: urls.length,
        config: config,
        fileId: fileId,
        groupName: groupName,
        jobId: jobId
      }
    };
  }
}

/**
 * Create ZIP archive of all sitemaps for a job
 * @param {string} jobId - Sitemap job ID
 * @returns {Promise<Object>} ZIP creation result
 */
export async function createSitemapZip(jobId) {
  try {
    const sitemapJob = sitemapJobs.get(jobId);
    if (!sitemapJob) {
      console.log(`Sitemap job ${jobId} not found in memory, checking for files on disk...`);
    }
    
    const jobDir = path.join(SITEMAP_DIR, jobId);
    const zipFileName = `sitemaps_${jobId}_${Date.now()}.zip`;
    const zipPath = path.join(SITEMAP_DIR, zipFileName);
    
    // Check if job directory exists
    try {
      await fs.access(jobDir);
    } catch {
      throw new Error('No sitemap files found for this job');
    }
    
    // Create ZIP archive
    await createZipFromDirectory(jobDir, zipPath);
    
    // Get ZIP file stats
    const stats = await fs.stat(zipPath);
    
    return {
      success: true,
      zipPath,
      zipFileName,
      fileSize: stats.size
    };
    
  } catch (error) {
    console.error('Error creating sitemap ZIP:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Create ZIP archive from directory
 * @param {string} sourceDir - Source directory
 * @param {string} outputPath - Output ZIP path
 * @returns {Promise<void>}
 */
async function createZipFromDirectory(sourceDir, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const output = await fs.open(outputPath, 'w');
      const archive = archiver('zip', {
        zlib: { level: 9 }
      });
      
      archive.on('error', (err) => {
        output.close();
        reject(err);
      });
      
      archive.on('end', () => {
        output.close();
        resolve();
      });
      
      archive.pipe(output.createWriteStream());
      
      // Add all files from directory
      archive.directory(sourceDir, false);
      
      await archive.finalize();
      
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Get sitemap job status
 * @param {string} jobId - Sitemap job ID
 * @returns {Object|null} Job status or null if not found
 */
export function getSitemapJobStatus(jobId) {
  const job = sitemapJobs.get(jobId);
  if (!job) return null;
  
  return {
    jobId: job.jobId,
    batchId: job.batchId,
    status: job.status,
    config: job.config,
    fileCount: job.files.length,
    sitemapCount: job.results ? job.results.reduce((sum, r) => sum + r.sitemapCount, 0) : 0,
    errorCount: job.errors ? job.errors.length : 0,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    results: job.results,
    errors: job.errors
  };
}

/**
 * Get all sitemap files for a job
 * @param {string} jobId - Sitemap job ID
 * @returns {Promise<Object>} Sitemap files result
 */
export async function getSitemapFiles(jobId) {
  try {
    const job = sitemapJobs.get(jobId);
    if (!job) {
      console.log(`Sitemap job ${jobId} not found in memory, checking for files on disk...`);
    }
    
    const jobDir = path.join(SITEMAP_DIR, jobId);
    
    try {
      const files = await fs.readdir(jobDir);
      const sitemapFiles = [];
      
      for (const file of files) {
        if (file.endsWith('.xml')) {
          const filePath = path.join(jobDir, file);
          const stats = await fs.stat(filePath);
          
          sitemapFiles.push({
            fileName: file,
            filePath,
            fileSize: stats.size,
            created: stats.birthtime
          });
        }
      }
      
      return {
        success: true,
        files: sitemapFiles
      };
      
    } catch {
      return {
        success: true,
        files: []
      };
    }
    
  } catch (error) {
    console.error('Error getting sitemap files:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Clean up old sitemap jobs and files
 * @param {number} maxAgeMs - Maximum age in milliseconds
 */
export async function cleanupOldSitemaps(maxAgeMs = 24 * 60 * 60 * 1000) {
  try {
    const now = Date.now();
    let cleanedJobs = 0;
    let cleanedFiles = 0;
    
    // Clean up job data from memory
    for (const [jobId, job] of sitemapJobs.entries()) {
      if (now - job.createdAt.getTime() > maxAgeMs) {
        sitemapJobs.delete(jobId);
        cleanedJobs++;
      }
    }
    
    // Clean up sitemap files
    try {
      const jobDirs = await fs.readdir(SITEMAP_DIR);
      
      for (const jobDir of jobDirs) {
        if (jobDir.startsWith('sitemap_')) {
          const jobDirPath = path.join(SITEMAP_DIR, jobDir);
          const stats = await fs.stat(jobDirPath);
          
          if (now - stats.mtime.getTime() > maxAgeMs) {
            await fs.rm(jobDirPath, { recursive: true, force: true });
            cleanedFiles++;
          }
        }
      }
    } catch (error) {
      console.warn('Error cleaning up sitemap files:', error);
    }
    
    console.log(`Cleaned up ${cleanedJobs} sitemap jobs and ${cleanedFiles} file directories`);
    
    return { cleanedJobs, cleanedFiles };
    
  } catch (error) {
    console.error('Error cleaning up old sitemaps:', error);
    return { cleanedJobs: 0, cleanedFiles: 0 };
  }
}

/**
 * Format date for sitemap lastmod
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date
 */
function formatDate(date) {
  if (!date) return '';
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  
  return d.toISOString().split('T')[0]; // YYYY-MM-DD format
}

/**
 * Sanitize filename for safe file creation
 * @param {string} filename - Original filename
 * @returns {string} Sanitized filename
 */
function sanitizeFileName(filename) {
  if (!filename) return 'sitemap';
  
  return filename
    .replace(/[^a-zA-Z0-9\-_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase() || 'sitemap';
}

/**
 * Initialize sitemap generation system
 */
export function initializeSitemapSystem() {
  console.log('Sitemap generation system initialized');
  
  // Set up periodic cleanup
  setInterval(() => {
    cleanupOldSitemaps();
  }, 60 * 60 * 1000); // Every hour
}

/**
 * Shutdown sitemap generation system
 */
export function shutdownSitemapSystem() {
  console.log('Shutting down sitemap generation system');
  sitemapJobs.clear();
}