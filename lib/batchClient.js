/**
 * Client-side Batch Utilities
 * Functions that can be safely imported in React components
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
  CANCELLED: 'cancelled'
};

/**
 * Generate a unique batch ID
 */
export function generateBatchId() {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 11);
  return `batch_${timestamp}_${randomId}`;
}

/**
 * Generate a unique file ID for batch processing
 */
export function generateBatchFileId(batchId, originalName, index) {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 8);
  const sanitizedName = originalName.replace(/[^a-zA-Z0-9]/g, '_');
  return `${batchId}_file_${timestamp}_${randomId}_${sanitizedName}`;
}

/**
 * Create a batch job object (client-side only)
 */
export function createBatchJob(files, config = {}) {
  const batchId = generateBatchId();
  const batchFiles = files.map((file, index) => ({
    fileId: generateBatchFileId(batchId, file.name, index),
    originalName: file.name,
    size: file.size,
    type: file.type,
    status: FILE_STATUS.PENDING
  }));

  return {
    batchId,
    files: batchFiles,
    config: {
      columnMapping: config.columnMapping || {},
      urlPattern: config.urlPattern || '',
      environment: config.environment || 'production',
      ...config
    },
    status: BATCH_STATUS.QUEUED,
    progress: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

/**
 * Validate batch ID format
 */
export function isValidBatchId(batchId) {
  if (!batchId || typeof batchId !== 'string') {
    return false;
  }
  
  // Check if it matches the expected format: batch_timestamp_randomId
  const batchIdPattern = /^batch_\d+_[a-z0-9]+$/;
  return batchIdPattern.test(batchId);
}

/**
 * Get batch summary for display
 */
export function getBatchSummary(batchStatus) {
  if (!batchStatus) {
    return {
      totalFiles: 0,
      completedFiles: 0,
      failedFiles: 0,
      totalUrls: 0,
      validUrls: 0,
      progress: 0
    };
  }

  const totalFiles = batchStatus.files?.length || 0;
  const completedFiles = batchStatus.files?.filter(f => f.status === FILE_STATUS.COMPLETED).length || 0;
  const failedFiles = batchStatus.files?.filter(f => f.status === FILE_STATUS.ERROR).length || 0;
  
  const totalUrls = batchStatus.files?.reduce((sum, file) => {
    return sum + (file.statistics?.totalRows || 0);
  }, 0) || 0;
  
  const validUrls = batchStatus.files?.reduce((sum, file) => {
    return sum + (file.statistics?.validUrls || 0);
  }, 0) || 0;

  const progress = totalFiles > 0 ? Math.round((completedFiles / totalFiles) * 100) : 0;
  const successRate = totalFiles > 0 ? Math.round((completedFiles / totalFiles) * 100) : 0;
  
  // Calculate duration if timestamps are available
  let duration = null;
  if (batchStatus.createdAt && batchStatus.completedAt) {
    const startTime = new Date(batchStatus.createdAt).getTime();
    const endTime = new Date(batchStatus.completedAt).getTime();
    duration = endTime - startTime;
  }

  return {
    totalFiles,
    completedFiles,
    failedFiles,
    totalUrls,
    validUrls,
    progress,
    successRate,
    duration
  };
}
