/**
 * Batch Processing Utilities
 * Handles batch job management, ID generation, status tracking, and metadata management
 */

// Batch status constants
export const BATCH_STATUS = {
  QUEUED: 'queued',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

// File status constants
export const FILE_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  ERROR: 'error',
  SKIPPED: 'skipped'
};

// Error categories
export const ERROR_CATEGORIES = {
  UPLOAD: 'upload',
  PROCESSING: 'processing',
  STORAGE: 'storage',
  VALIDATION: 'validation',
  TIMEOUT: 'timeout'
};

/**
 * Generate a unique batch ID
 * @returns {string} Unique batch identifier
 */
export function generateBatchId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  return `batch_${timestamp}_${random}`;
}

/**
 * Generate a unique file ID within a batch
 * @param {string} batchId - The batch identifier
 * @param {string} originalName - Original filename
 * @returns {string} Unique file identifier
 */
export function generateFileId(batchId, originalName) {
  const timestamp = Date.now();
  const sanitized = sanitizeFilename(originalName);
  const random = Math.random().toString(36).substr(2, 6);
  return `${batchId}_file_${timestamp}_${random}_${sanitized}`;
}

/**
 * Validate batch ID format
 * @param {string} batchId - Batch ID to validate
 * @returns {boolean} True if valid, false otherwise
 */
export function isValidBatchId(batchId) {
  if (!batchId || typeof batchId !== 'string') {
    return false;
  }
  
  // Check format: batch_timestamp_random
  const batchIdPattern = /^batch_\d+_[a-z0-9]+$/;
  return batchIdPattern.test(batchId);
}

/**
 * Sanitize filename for safe storage and processing
 * @param {string} filename - Original filename
 * @returns {string} Sanitized filename
 */
export function sanitizeFilename(filename) {
  if (!filename) return 'unnamed_file';
  
  // Remove file extension for processing
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
  
  // Replace unsafe characters with underscores
  const sanitized = nameWithoutExt
    .replace(/[^a-zA-Z0-9\-_\s]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();
  
  // Ensure minimum length
  return sanitized || 'file';
}

/**
 * Create a new batch job
 * @param {Array} files - Array of file objects
 * @param {Object} config - Batch configuration
 * @param {string} userId - Optional user identifier
 * @returns {Object} Batch job object
 */
export function createBatchJob(files, config, userId = null) {
  const batchId = generateBatchId();
  const now = new Date();
  
  // Process files and generate file IDs
  const batchFiles = files.map(file => ({
    fileId: generateFileId(batchId, file.name),
    originalName: file.name,
    sanitizedName: sanitizeFilename(file.name),
    size: file.size,
    type: file.type,
    status: FILE_STATUS.PENDING,
    uploadedAt: now,
    processingStarted: null,
    processingCompleted: null,
    error: null,
    resultFileId: null,
    statistics: null
  }));
  
  return {
    batchId,
    userId,
    createdAt: now,
    updatedAt: now,
    status: BATCH_STATUS.QUEUED,
    files: batchFiles,
    config: {
      ...config,
      maxConcurrentFiles: config.maxConcurrentFiles || 3,
      retryAttempts: config.retryAttempts || 2,
      timeoutMs: config.timeoutMs || 300000 // 5 minutes
    },
    progress: {
      totalFiles: batchFiles.length,
      completedFiles: 0,
      failedFiles: 0,
      skippedFiles: 0,
      currentFile: null,
      startedAt: null,
      estimatedCompletion: null
    },
    results: null,
    metadata: {
      totalSize: batchFiles.reduce((sum, file) => sum + file.size, 0),
      fileTypes: [...new Set(batchFiles.map(file => file.type))],
      averageFileSize: batchFiles.length > 0 ? 
        Math.round(batchFiles.reduce((sum, file) => sum + file.size, 0) / batchFiles.length) : 0
    }
  };
}

/**
 * Update batch job status
 * @param {Object} batchJob - Batch job object
 * @param {string} status - New status
 * @returns {Object} Updated batch job
 */
export function updateBatchStatus(batchJob, status) {
  const updatedJob = {
    ...batchJob,
    status,
    updatedAt: new Date()
  };
  
  // Update progress timestamps
  if (status === BATCH_STATUS.PROCESSING && !batchJob.progress.startedAt) {
    updatedJob.progress = {
      ...batchJob.progress,
      startedAt: new Date()
    };
  }
  
  return updatedJob;
}

/**
 * Update file status within a batch
 * @param {Object} batchJob - Batch job object
 * @param {string} fileId - File ID to update
 * @param {string} status - New file status
 * @param {Object} additionalData - Additional data to update (error, resultFileId, etc.)
 * @returns {Object} Updated batch job
 */
export function updateFileStatus(batchJob, fileId, status, additionalData = {}) {
  const updatedFiles = batchJob.files.map(file => {
    if (file.fileId === fileId) {
      const updatedFile = {
        ...file,
        status,
        ...additionalData
      };
      
      // Set timestamps based on status
      if (status === FILE_STATUS.PROCESSING) {
        updatedFile.processingStarted = new Date();
      } else if (status === FILE_STATUS.COMPLETED || status === FILE_STATUS.ERROR) {
        updatedFile.processingCompleted = new Date();
      }
      
      return updatedFile;
    }
    return file;
  });
  
  // Recalculate progress
  const progress = calculateBatchProgress(updatedFiles);
  
  // Determine overall batch status
  let batchStatus = batchJob.status;
  if (progress.completedFiles + progress.failedFiles + progress.skippedFiles === progress.totalFiles) {
    batchStatus = progress.failedFiles === progress.totalFiles ? BATCH_STATUS.FAILED : BATCH_STATUS.COMPLETED;
  } else if (progress.completedFiles > 0 || progress.failedFiles > 0) {
    batchStatus = BATCH_STATUS.PROCESSING;
  }
  
  return {
    ...batchJob,
    files: updatedFiles,
    progress,
    status: batchStatus,
    updatedAt: new Date()
  };
}

/**
 * Calculate batch progress from file statuses
 * @param {Array} files - Array of batch files
 * @returns {Object} Progress object
 */
export function calculateBatchProgress(files) {
  const progress = {
    totalFiles: files.length,
    completedFiles: 0,
    failedFiles: 0,
    skippedFiles: 0,
    processingFiles: 0,
    pendingFiles: 0,
    currentFile: null,
    startedAt: null,
    estimatedCompletion: null
  };
  
  let earliestStart = null;
  let totalProcessingTime = 0;
  let completedWithTime = 0;
  
  files.forEach(file => {
    switch (file.status) {
      case FILE_STATUS.COMPLETED:
        progress.completedFiles++;
        if (file.processingStarted && file.processingCompleted) {
          const processingTime = file.processingCompleted - file.processingStarted;
          totalProcessingTime += processingTime;
          completedWithTime++;
        }
        break;
      case FILE_STATUS.ERROR:
        progress.failedFiles++;
        break;
      case FILE_STATUS.SKIPPED:
        progress.skippedFiles++;
        break;
      case FILE_STATUS.PROCESSING:
        progress.processingFiles++;
        if (!progress.currentFile) {
          progress.currentFile = file.originalName;
        }
        break;
      case FILE_STATUS.PENDING:
        progress.pendingFiles++;
        break;
    }
    
    // Track earliest start time
    if (file.processingStarted && (!earliestStart || file.processingStarted < earliestStart)) {
      earliestStart = file.processingStarted;
    }
  });
  
  progress.startedAt = earliestStart;
  
  // Calculate estimated completion time
  if (completedWithTime > 0 && progress.pendingFiles > 0) {
    const averageProcessingTime = totalProcessingTime / completedWithTime;
    const remainingFiles = progress.pendingFiles + progress.processingFiles;
    const estimatedRemainingTime = remainingFiles * averageProcessingTime;
    progress.estimatedCompletion = new Date(Date.now() + estimatedRemainingTime);
  }
  
  return progress;
}

/**
 * Create batch processing error
 * @param {string} category - Error category
 * @param {string} message - Error message
 * @param {string} fileId - Optional file ID
 * @param {Object} details - Additional error details
 * @returns {Object} Error object
 */
export function createBatchError(category, message, fileId = null, details = {}) {
  return {
    id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    category,
    message,
    fileId,
    timestamp: new Date(),
    retryable: isRetryableError(category, message),
    details
  };
}

/**
 * Check if an error is retryable
 * @param {string} category - Error category
 * @param {string} message - Error message
 * @returns {boolean} True if retryable
 */
export function isRetryableError(category, message) {
  const retryableCategories = [ERROR_CATEGORIES.TIMEOUT, ERROR_CATEGORIES.STORAGE];
  const retryableMessages = ['network error', 'temporary failure', 'timeout'];
  
  if (retryableCategories.includes(category)) {
    return true;
  }
  
  return retryableMessages.some(retryableMsg => 
    message.toLowerCase().includes(retryableMsg)
  );
}

/**
 * Get batch summary statistics
 * @param {Object} batchJob - Batch job object
 * @returns {Object} Summary statistics
 */
export function getBatchSummary(batchJob) {
  const { progress, files, metadata } = batchJob;
  
  const successRate = progress.totalFiles > 0 ? 
    (progress.completedFiles / progress.totalFiles) * 100 : 0;
  
  const totalProcessingTime = files.reduce((total, file) => {
    if (file.processingStarted && file.processingCompleted) {
      return total + (file.processingCompleted - file.processingStarted);
    }
    return total;
  }, 0);
  
  const averageProcessingTime = progress.completedFiles > 0 ? 
    totalProcessingTime / progress.completedFiles : 0;
  
  return {
    batchId: batchJob.batchId,
    status: batchJob.status,
    totalFiles: progress.totalFiles,
    completedFiles: progress.completedFiles,
    failedFiles: progress.failedFiles,
    skippedFiles: progress.skippedFiles,
    successRate: Math.round(successRate * 100) / 100,
    totalSize: metadata.totalSize,
    averageFileSize: metadata.averageFileSize,
    totalProcessingTime,
    averageProcessingTime: Math.round(averageProcessingTime),
    createdAt: batchJob.createdAt,
    completedAt: batchJob.status === BATCH_STATUS.COMPLETED ? batchJob.updatedAt : null,
    duration: batchJob.progress.startedAt ? 
      (batchJob.updatedAt - batchJob.progress.startedAt) : null
  };
}

/**
 * Validate batch configuration for upload (minimal validation)
 * @param {Object} config - Batch configuration object
 * @returns {Object} Validation result with isValid and errors
 */
export function validateBatchUploadConfig(config) {
  const errors = [];
  
  // For upload, config can be empty or minimal
  if (!config) {
    return { isValid: true, errors: [] };
  }
  
  // Only validate processing options if provided
  if (config.maxConcurrentFiles && (config.maxConcurrentFiles < 1 || config.maxConcurrentFiles > 10)) {
    errors.push('Max concurrent files must be between 1 and 10');
  }
  
  if (config.retryAttempts && (config.retryAttempts < 0 || config.retryAttempts > 5)) {
    errors.push('Retry attempts must be between 0 and 5');
  }
  
  if (config.timeoutMs && (config.timeoutMs < 30000 || config.timeoutMs > 600000)) {
    errors.push('Timeout must be between 30 seconds and 10 minutes');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate batch configuration for conversion (full validation)
 * @param {Object} config - Batch configuration object
 * @returns {Object} Validation result with isValid and errors
 */
export function validateBatchConfig(config) {
  const errors = [];
  
  if (!config) {
    errors.push('Configuration is required');
    return { isValid: false, errors };
  }
  
  // Validate column mapping
  if (!config.columnMapping || typeof config.columnMapping !== 'object') {
    errors.push('Column mapping is required');
  }
  
  // Validate URL pattern
  if (!config.urlPattern || typeof config.urlPattern !== 'string') {
    errors.push('URL pattern is required');
  } else if (!config.urlPattern.includes('://')) {
    errors.push('URL pattern must include protocol (http:// or https://)');
  }
  
  // Validate environment
  if (!config.environment || typeof config.environment !== 'string') {
    errors.push('Environment selection is required');
  }
  
  // Validate processing options
  if (config.maxConcurrentFiles && (config.maxConcurrentFiles < 1 || config.maxConcurrentFiles > 10)) {
    errors.push('Max concurrent files must be between 1 and 10');
  }
  
  if (config.retryAttempts && (config.retryAttempts < 0 || config.retryAttempts > 5)) {
    errors.push('Retry attempts must be between 0 and 5');
  }
  
  if (config.timeoutMs && (config.timeoutMs < 30000 || config.timeoutMs > 600000)) {
    errors.push('Timeout must be between 30 seconds and 10 minutes');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Get files by status from batch
 * @param {Object} batchJob - Batch job object
 * @param {string} status - File status to filter by
 * @returns {Array} Array of files with the specified status
 */
export function getFilesByStatus(batchJob, status) {
  return batchJob.files.filter(file => file.status === status);
}

/**
 * Get next files to process (up to maxConcurrent)
 * @param {Object} batchJob - Batch job object
 * @param {number} maxConcurrent - Maximum concurrent files
 * @returns {Array} Array of files ready for processing
 */
export function getNextFilesToProcess(batchJob, maxConcurrent = 3) {
  const processingFiles = getFilesByStatus(batchJob, FILE_STATUS.PROCESSING);
  const availableSlots = maxConcurrent - processingFiles.length;
  
  if (availableSlots <= 0) {
    return [];
  }
  
  const pendingFiles = getFilesByStatus(batchJob, FILE_STATUS.PENDING);
  return pendingFiles.slice(0, availableSlots);
}

/**
 * Check if batch is complete (all files processed)
 * @param {Object} batchJob - Batch job object
 * @returns {boolean} True if batch is complete
 */
export function isBatchComplete(batchJob) {
  const { progress } = batchJob;
  return (progress.completedFiles + progress.failedFiles + progress.skippedFiles) === progress.totalFiles;
}

/**
 * Get retryable files from batch
 * @param {Object} batchJob - Batch job object
 * @returns {Array} Array of files that can be retried
 */
export function getRetryableFiles(batchJob) {
  return batchJob.files.filter(file => 
    file.status === FILE_STATUS.ERROR && 
    file.error && 
    isRetryableError(file.error.category, file.error.message)
  );
}

/**
 * Process batch preview - generate preview for batch files
 * @param {string} batchId - Batch ID
 * @param {Object} config - Configuration object
 * @returns {Object} Preview result
 */
export async function processBatchPreview(batchId, config) {
  try {
    // Get batch files from storage
    const batchFiles = [];
    const fileStorage = global.fileStorage || new Map();
    
    // Find all files belonging to this batch
    for (const [fileId, fileData] of fileStorage.entries()) {
      if (fileData.batchId === batchId) {
        batchFiles.push({
          fileId,
          ...fileData
        });
      }
    }
    
    if (batchFiles.length === 0) {
      return {
        success: false,
        error: 'No files found for batch'
      };
    }
    
    // Process first file for preview (similar to single file preview)
    const firstFile = batchFiles[0];
    const { processFilePreview } = await import('./jsonConverter.js');
    
    const previewResult = await processFilePreview(
      firstFile.buffer,
      firstFile.fileType,
      config,
      firstFile.originalName
    );
    
    if (!previewResult.success) {
      return {
        success: false,
        error: previewResult.error || 'Preview generation failed'
      };
    }
    
    // Add batch-specific information
    const batchPreview = {
      ...previewResult.preview,
      batchInfo: {
        batchId,
        totalFiles: batchFiles.length,
        previewFile: firstFile.originalName,
        fileTypes: [...new Set(batchFiles.map(f => f.fileType))]
      }
    };
    
    return {
      success: true,
      preview: batchPreview
    };
    
  } catch (error) {
    console.error('Batch preview error:', error);
    return {
      success: false,
      error: 'Failed to generate batch preview'
    };
  }
}

/**
 * Store a batch job without starting processing
 * This function should only be called from server-side code
 */
export async function storeBatchJob(batchJob) {
  try {
    // Store batch metadata using dynamic import to avoid client-side issues
    const { saveBatchMetadata } = await import('./fileStorage.js');
    await saveBatchMetadata(batchJob.batchId, {
      batchJob,
      status: BATCH_STATUS.QUEUED,
      queuedAt: new Date().toISOString()
    });

    return {
      success: true,
      batchId: batchJob.batchId,
      message: 'Batch stored successfully'
    };
  } catch (error) {
    console.error('Error storing batch job:', error);
    return {
      success: false,
      error: error.message
    };
  }
}