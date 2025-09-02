/**
 * Batch Processing Queue System
 * Manages parallel file processing, progress tracking, and error handling
 */

import { convertFileToJson } from './jsonConverter.js';
import { saveBatchFile, saveBatchMetadata } from './fileStorage.js';
import { 
  updateBatchStatus, 
  updateFileStatus, 
  getNextFilesToProcess,
  isBatchComplete,
  createBatchError,
  BATCH_STATUS,
  FILE_STATUS,
  ERROR_CATEGORIES
} from './batchProcessing.js';

// Global batch storage for tracking active batches
const activeBatches = new Map();
const processingQueues = new Map();

/**
 * Queue configuration
 */
const QUEUE_CONFIG = {
  maxConcurrentFiles: 3,
  retryAttempts: 2,
  retryDelay: 2000, // 2 seconds
  timeoutMs: 300000, // 5 minutes
  progressUpdateInterval: 1000 // 1 second
};

/**
 * Add batch to processing queue
 * @param {Object} batchJob - Batch job object
 * @returns {Promise<Object>} Result object
 */
export async function queueBatch(batchJob) {
  try {
    // Validate batch job
    if (!batchJob || !batchJob.batchId) {
      throw new Error('Invalid batch job');
    }
    
    // Store batch in active batches
    activeBatches.set(batchJob.batchId, batchJob);
    
    // Save batch metadata
    await saveBatchMetadata(batchJob.batchId, {
      batchJob,
      status: BATCH_STATUS.QUEUED,
      queuedAt: new Date().toISOString()
    });
    
    // Start processing
    processBatch(batchJob.batchId);
    
    return {
      success: true,
      batchId: batchJob.batchId,
      message: 'Batch queued for processing'
    };
  } catch (error) {
    console.error('Error queuing batch:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Process batch files
 * @param {string} batchId - Batch identifier
 */
async function processBatch(batchId) {
  try {
    let batchJob = activeBatches.get(batchId);
    if (!batchJob) {
      throw new Error('Batch not found');
    }
    
    // Update batch status to processing
    batchJob = updateBatchStatus(batchJob, BATCH_STATUS.PROCESSING);
    activeBatches.set(batchId, batchJob);
    
    // Create processing queue for this batch
    const queue = {
      batchId,
      activeProcessors: new Map(),
      retryQueue: [],
      isProcessing: true
    };
    processingQueues.set(batchId, queue);
    
    // Start processing files
    await processNextFiles(batchId);
    
  } catch (error) {
    console.error(`Error processing batch ${batchId}:`, error);
    await handleBatchError(batchId, error);
  }
}

/**
 * Process next available files in the queue
 * @param {string} batchId - Batch identifier
 */
async function processNextFiles(batchId) {
  try {
    const batchJob = activeBatches.get(batchId);
    const queue = processingQueues.get(batchId);
    
    if (!batchJob || !queue || !queue.isProcessing) {
      return;
    }
    
    // Get next files to process
    const maxConcurrent = batchJob.config.maxConcurrentFiles || QUEUE_CONFIG.maxConcurrentFiles;
    const nextFiles = getNextFilesToProcess(batchJob, maxConcurrent);
    
    // Process each file
    for (const file of nextFiles) {
      processFile(batchId, file.fileId);
    }
    
    // Check if batch is complete
    if (isBatchComplete(batchJob)) {
      await completeBatch(batchId);
    } else {
      // Schedule next check
      setTimeout(() => processNextFiles(batchId), QUEUE_CONFIG.progressUpdateInterval);
    }
    
  } catch (error) {
    console.error(`Error processing next files for batch ${batchId}:`, error);
  }
}

/**
 * Process individual file
 * @param {string} batchId - Batch identifier
 * @param {string} fileId - File identifier
 */
async function processFile(batchId, fileId) {
  const queue = processingQueues.get(batchId);
  if (!queue) return;
  
  // Add to active processors
  queue.activeProcessors.set(fileId, {
    startTime: Date.now(),
    attempts: 0
  });
  
  try {
    let batchJob = activeBatches.get(batchId);
    const file = batchJob.files.find(f => f.fileId === fileId);
    
    if (!file) {
      throw new Error('File not found in batch');
    }
    
    // Update file status to processing
    batchJob = updateFileStatus(batchJob, fileId, FILE_STATUS.PROCESSING);
    activeBatches.set(batchId, batchJob);
    
    // Get file buffer from global storage (uploaded files)
    const fileBuffer = getFileBuffer(fileId);
    if (!fileBuffer) {
      throw new Error('File buffer not found');
    }
    
    // Convert file to JSON
    const conversionResult = await convertFileToJson(
      fileBuffer.buffer,
      fileBuffer.fileType,
      batchJob.config
    );
    
    if (!conversionResult.success) {
      throw new Error(conversionResult.error || 'Conversion failed');
    }
    
    // Save converted JSON file
    const saveResult = await saveBatchFile(
      batchId,
      fileId,
      conversionResult.json,
      batchJob.config
    );
    
    if (!saveResult.success) {
      throw new Error(saveResult.error || 'Failed to save converted file');
    }
    
    // Update file status to completed
    batchJob = updateFileStatus(batchJob, fileId, FILE_STATUS.COMPLETED, {
      resultFileId: fileId,
      statistics: saveResult.statistics
    });
    activeBatches.set(batchId, batchJob);
    
    console.log(`File ${fileId} processed successfully`);
    
  } catch (error) {
    console.error(`Error processing file ${fileId}:`, error);
    await handleFileError(batchId, fileId, error);
  } finally {
    // Remove from active processors
    queue.activeProcessors.delete(fileId);
  }
}

/**
 * Handle file processing error
 * @param {string} batchId - Batch identifier
 * @param {string} fileId - File identifier
 * @param {Error} error - Error object
 */
async function handleFileError(batchId, fileId, error) {
  try {
    let batchJob = activeBatches.get(batchId);
    const queue = processingQueues.get(batchId);
    
    if (!batchJob || !queue) return;
    
    const processor = queue.activeProcessors.get(fileId);
    const attempts = processor ? processor.attempts + 1 : 1;
    const maxRetries = batchJob.config.retryAttempts || QUEUE_CONFIG.retryAttempts;
    
    // Create error object
    const batchError = createBatchError(
      ERROR_CATEGORIES.PROCESSING,
      error.message,
      fileId,
      { attempts, maxRetries }
    );
    
    // Check if we should retry
    if (attempts <= maxRetries && batchError.retryable) {
      console.log(`Retrying file ${fileId} (attempt ${attempts}/${maxRetries})`);
      
      // Update processor attempts
      if (processor) {
        processor.attempts = attempts;
      }
      
      // Add to retry queue with delay
      setTimeout(() => {
        if (queue.isProcessing) {
          processFile(batchId, fileId);
        }
      }, QUEUE_CONFIG.retryDelay * attempts);
      
    } else {
      // Mark file as failed
      batchJob = updateFileStatus(batchJob, fileId, FILE_STATUS.ERROR, {
        error: batchError
      });
      activeBatches.set(batchId, batchJob);
      
      console.error(`File ${fileId} failed after ${attempts} attempts`);
    }
    
  } catch (err) {
    console.error(`Error handling file error for ${fileId}:`, err);
  }
}

/**
 * Handle batch processing error
 * @param {string} batchId - Batch identifier
 * @param {Error} error - Error object
 */
async function handleBatchError(batchId, error) {
  try {
    let batchJob = activeBatches.get(batchId);
    if (!batchJob) return;
    
    // Update batch status to failed
    batchJob = updateBatchStatus(batchJob, BATCH_STATUS.FAILED);
    activeBatches.set(batchId, batchJob);
    
    // Stop processing
    const queue = processingQueues.get(batchId);
    if (queue) {
      queue.isProcessing = false;
    }
    
    console.error(`Batch ${batchId} failed:`, error.message);
    
  } catch (err) {
    console.error(`Error handling batch error for ${batchId}:`, err);
  }
}

/**
 * Complete batch processing
 * @param {string} batchId - Batch identifier
 */
async function completeBatch(batchId) {
  try {
    let batchJob = activeBatches.get(batchId);
    const queue = processingQueues.get(batchId);
    
    if (!batchJob) return;
    
    // Stop processing
    if (queue) {
      queue.isProcessing = false;
    }
    
    // Update batch status
    const hasFailures = batchJob.files.some(f => f.status === FILE_STATUS.ERROR);
    const finalStatus = hasFailures ? BATCH_STATUS.COMPLETED : BATCH_STATUS.COMPLETED;
    
    batchJob = updateBatchStatus(batchJob, finalStatus);
    activeBatches.set(batchId, batchJob);
    
    // Save final batch metadata
    await saveBatchMetadata(batchId, {
      batchJob,
      status: finalStatus,
      completedAt: new Date().toISOString()
    });
    
    console.log(`Batch ${batchId} completed with status: ${finalStatus}`);
    
    // Clean up after delay
    setTimeout(() => {
      cleanupBatch(batchId);
    }, 60000); // 1 minute
    
  } catch (error) {
    console.error(`Error completing batch ${batchId}:`, error);
  }
}

/**
 * Get batch processing status
 * @param {string} batchId - Batch identifier
 * @returns {Object|null} Batch status or null if not found
 */
export function getBatchStatus(batchId) {
  const batchJob = activeBatches.get(batchId);
  if (!batchJob) return null;
  
  const queue = processingQueues.get(batchId);
  
  return {
    batchId: batchJob.batchId,
    status: batchJob.status,
    progress: batchJob.progress,
    files: batchJob.files.map(file => ({
      fileId: file.fileId,
      originalName: file.originalName,
      status: file.status,
      error: file.error,
      statistics: file.statistics
    })),
    activeProcessors: queue ? Array.from(queue.activeProcessors.keys()) : [],
    isProcessing: queue ? queue.isProcessing : false,
    createdAt: batchJob.createdAt,
    updatedAt: batchJob.updatedAt
  };
}

/**
 * Cancel batch processing
 * @param {string} batchId - Batch identifier
 * @returns {Object} Result object
 */
export function cancelBatch(batchId) {
  try {
    const batchJob = activeBatches.get(batchId);
    const queue = processingQueues.get(batchId);
    
    if (!batchJob) {
      return { success: false, error: 'Batch not found' };
    }
    
    // Stop processing
    if (queue) {
      queue.isProcessing = false;
    }
    
    // Update batch status
    const updatedBatch = updateBatchStatus(batchJob, BATCH_STATUS.CANCELLED);
    activeBatches.set(batchId, updatedBatch);
    
    console.log(`Batch ${batchId} cancelled`);
    
    return { success: true, message: 'Batch cancelled' };
    
  } catch (error) {
    console.error(`Error cancelling batch ${batchId}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Pause batch processing
 * @param {string} batchId - Batch identifier
 * @returns {Object} Result object
 */
export function pauseBatch(batchId) {
  try {
    const queue = processingQueues.get(batchId);
    
    if (!queue) {
      return { success: false, error: 'Batch not found' };
    }
    
    queue.isProcessing = false;
    
    console.log(`Batch ${batchId} paused`);
    
    return { success: true, message: 'Batch paused' };
    
  } catch (error) {
    console.error(`Error pausing batch ${batchId}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Resume batch processing
 * @param {string} batchId - Batch identifier
 * @returns {Object} Result object
 */
export function resumeBatch(batchId) {
  try {
    const queue = processingQueues.get(batchId);
    
    if (!queue) {
      return { success: false, error: 'Batch not found' };
    }
    
    queue.isProcessing = true;
    
    // Resume processing
    processNextFiles(batchId);
    
    console.log(`Batch ${batchId} resumed`);
    
    return { success: true, message: 'Batch resumed' };
    
  } catch (error) {
    console.error(`Error resuming batch ${batchId}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Get all active batches
 * @returns {Array} Array of active batch statuses
 */
export function getActiveBatches() {
  const batches = [];
  
  for (const [batchId] of activeBatches) {
    const status = getBatchStatus(batchId);
    if (status) {
      batches.push(status);
    }
  }
  
  return batches;
}

/**
 * Clean up completed batch from memory
 * @param {string} batchId - Batch identifier
 */
function cleanupBatch(batchId) {
  try {
    activeBatches.delete(batchId);
    processingQueues.delete(batchId);
    
    console.log(`Cleaned up batch ${batchId} from memory`);
  } catch (error) {
    console.error(`Error cleaning up batch ${batchId}:`, error);
  }
}

/**
 * Get file buffer from global storage (mock implementation)
 * In a real implementation, this would retrieve the uploaded file buffer
 * @param {string} fileId - File identifier
 * @returns {Object|null} File buffer object or null
 */
function getFileBuffer(fileId) {
  // This is a mock implementation
  // In reality, this would retrieve from global.fileStorage or similar
  if (typeof global !== 'undefined' && global.fileStorage) {
    return global.fileStorage.get(fileId);
  }
  return null;
}

/**
 * Initialize batch queue system
 */
export function initializeBatchQueue() {
  console.log('Batch queue system initialized');
  
  // Clean up any orphaned batches on startup
  setTimeout(() => {
    const activeBatchIds = Array.from(activeBatches.keys());
    console.log(`Found ${activeBatchIds.length} active batches on startup`);
  }, 1000);
}

/**
 * Shutdown batch queue system
 */
export function shutdownBatchQueue() {
  console.log('Shutting down batch queue system');
  
  // Cancel all active batches
  for (const [batchId] of activeBatches) {
    cancelBatch(batchId);
  }
  
  // Clear all data
  activeBatches.clear();
  processingQueues.clear();
}