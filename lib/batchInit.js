/**
 * Batch Processing System Initialization
 * Initializes all batch processing components and systems
 */

import { initializeBatchQueue, shutdownBatchQueue } from './batchQueue.js';
import { initializeDownloadManager, shutdownDownloadManager } from './batchDownload.js';
import { initializeSitemapSystem, shutdownSitemapSystem } from './batchSitemap.js';

let isInitialized = false;

/**
 * Initialize the complete batch processing system
 */
export function initializeBatchSystem() {
  if (isInitialized) {
    console.log('Batch system already initialized');
    return;
  }
  
  console.log('Initializing batch processing system...');
  
  try {
    // Initialize all subsystems
    initializeBatchQueue();
    initializeDownloadManager();
    initializeSitemapSystem();
    
    isInitialized = true;
    console.log('✅ Batch processing system initialized successfully');
    
  } catch (error) {
    console.error('❌ Failed to initialize batch processing system:', error);
    throw error;
  }
}

/**
 * Shutdown the complete batch processing system
 */
export function shutdownBatchSystem() {
  if (!isInitialized) {
    console.log('Batch system not initialized');
    return;
  }
  
  console.log('Shutting down batch processing system...');
  
  try {
    // Shutdown all subsystems
    shutdownBatchQueue();
    shutdownDownloadManager();
    shutdownSitemapSystem();
    
    isInitialized = false;
    console.log('✅ Batch processing system shutdown successfully');
    
  } catch (error) {
    console.error('❌ Error during batch system shutdown:', error);
  }
}

/**
 * Check if batch system is initialized
 */
export function isBatchSystemInitialized() {
  return isInitialized;
}

/**
 * Get batch system status
 */
export function getBatchSystemStatus() {
  return {
    initialized: isInitialized,
    timestamp: new Date().toISOString(),
    components: {
      batchQueue: isInitialized,
      downloadManager: isInitialized,
      sitemapSystem: isInitialized
    }
  };
}

// Auto-initialize on import in server environment
if (typeof window === 'undefined') {
  // Server-side initialization
  process.nextTick(() => {
    initializeBatchSystem();
  });
  
  // Graceful shutdown on process termination
  process.on('SIGTERM', shutdownBatchSystem);
  process.on('SIGINT', shutdownBatchSystem);
  process.on('exit', shutdownBatchSystem);
}