'use client';

import { useState, useEffect } from 'react';
import { getBatchSummary, FILE_STATUS, BATCH_STATUS } from '../lib/batchClient.js';
import styles from './BatchResultsComponent.module.css';

export default function BatchResultsComponent({ 
  batchId, 
  onDownloadFile, 
  onDownloadBatch, 
  onRetryFile, 
  onRetryBatch,
  onGenerateSitemaps,
  sitemapConfig = {},
  refreshInterval = 2000 
}) {
  const [batchStatus, setBatchStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState(new Set());
  const [showDetails, setShowDetails] = useState(false);
  const [sortBy, setSortBy] = useState('name'); // name, status, size
  const [filterBy, setFilterBy] = useState('all'); // all, completed, error, processing
  const [sitemapJobId, setSitemapJobId] = useState(null);
  const [sitemapGenerating, setSitemapGenerating] = useState(false);

  // Fetch batch status
  const fetchBatchStatus = async () => {
    try {
      const response = await fetch(`/api/batch-status/${batchId}`);
      const result = await response.json();
      
      if (result.success) {
        setBatchStatus(result.batchStatus);
        setError(null);
      } else {
        setError(result.error || 'Failed to fetch batch status');
      }
    } catch (err) {
      console.error('Error fetching batch status:', err);
      setError('Failed to fetch batch status');
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-refresh batch status
  useEffect(() => {
    if (!batchId) return;
    
    fetchBatchStatus();
    
    const interval = setInterval(() => {
      if (batchStatus?.status === BATCH_STATUS.PROCESSING) {
        fetchBatchStatus();
      }
    }, refreshInterval);
    
    return () => clearInterval(interval);
  }, [batchId, refreshInterval, batchStatus?.status]);

  // Handle file selection
  const handleFileSelect = (fileId, selected) => {
    const newSelected = new Set(selectedFiles);
    if (selected) {
      newSelected.add(fileId);
    } else {
      newSelected.delete(fileId);
    }
    setSelectedFiles(newSelected);
  };

  // Select all files
  const handleSelectAll = (selected) => {
    if (selected) {
      const allFileIds = new Set(batchStatus.files.map(f => f.fileId));
      setSelectedFiles(allFileIds);
    } else {
      setSelectedFiles(new Set());
    }
  };

  // Filter and sort files
  const getFilteredAndSortedFiles = () => {
    if (!batchStatus?.files) return [];
    
    let filtered = batchStatus.files;
    
    // Apply filter
    if (filterBy !== 'all') {
      filtered = filtered.filter(file => file.status === filterBy);
    }
    
    // Apply sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.originalName.localeCompare(b.originalName);
        case 'status':
          return a.status.localeCompare(b.status);
        case 'size':
          return (b.statistics?.validUrls || 0) - (a.statistics?.validUrls || 0);
        default:
          return 0;
      }
    });
    
    return filtered;
  };

  // Get status icon
  const getStatusIcon = (status) => {
    switch (status) {
      case FILE_STATUS.COMPLETED:
        return '✅';
      case FILE_STATUS.ERROR:
        return '❌';
      case FILE_STATUS.PROCESSING:
        return '⏳';
      case FILE_STATUS.PENDING:
        return '⏸️';
      default:
        return '❓';
    }
  };

  // Get status color class
  const getStatusClass = (status) => {
    switch (status) {
      case FILE_STATUS.COMPLETED:
        return styles.statusCompleted;
      case FILE_STATUS.ERROR:
        return styles.statusError;
      case FILE_STATUS.PROCESSING:
        return styles.statusProcessing;
      case FILE_STATUS.PENDING:
        return styles.statusPending;
      default:
        return styles.statusUnknown;
    }
  };

  // Format file size
  const formatNumber = (num) => {
    if (!num) return '0';
    return num.toLocaleString();
  };

  // Calculate progress percentage
  const getProgressPercentage = () => {
    if (!batchStatus) return 0;
    
    // Handle both old format (progress object) and new format (progress number)
    if (typeof batchStatus.progress === 'number') {
      return batchStatus.progress;
    }
    
    if (batchStatus.progress && typeof batchStatus.progress === 'object') {
      const { totalFiles, completedFiles, failedFiles } = batchStatus.progress;
      return totalFiles > 0 ? Math.round(((completedFiles + failedFiles) / totalFiles) * 100) : 0;
    }
    
    // Fallback: calculate from files array
    if (batchStatus.files && batchStatus.files.length > 0) {
      const completedFiles = batchStatus.files.filter(f => f.status === FILE_STATUS.COMPLETED).length;
      const failedFiles = batchStatus.files.filter(f => f.status === FILE_STATUS.ERROR).length;
      const totalFiles = batchStatus.files.length;
      return totalFiles > 0 ? Math.round(((completedFiles + failedFiles) / totalFiles) * 100) : 0;
    }
    
    return 0;
  };

  // Get batch summary
  const getBatchSummaryData = () => {
    if (!batchStatus) return null;
    return getBatchSummary({ ...batchStatus, files: batchStatus.files });
  };

  // Handle sitemap generation
  const handleGenerateSitemaps = async () => {
    if (!batchId) return;
    
    setSitemapGenerating(true);
    try {
      const response = await fetch('/api/batch-sitemap-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          batchId,
          sitemapConfig: {
            maxPerFile: 50000,
            grouping: sitemapConfig.grouping || 'group',
            changefreq: sitemapConfig.changefreq || 'weekly',
            priority: sitemapConfig.priority || '0.8',
            includeLastmod: sitemapConfig.includeLastmod || false
          }
        })
      });
      
      const result = await response.json();
      if (result.success) {
        setSitemapJobId(result.jobId);
        alert(`Sitemap generation completed! Generated ${result.sitemapCount} sitemap files.`);
      } else {
        alert(`Sitemap generation failed: ${result.error}`);
      }
    } catch (err) {
      console.error('Error generating sitemaps:', err);
      alert('Failed to generate sitemaps');
    } finally {
      setSitemapGenerating(false);
    }
  };

  // Handle sitemap download
  const handleDownloadSitemaps = async () => {
    if (!sitemapJobId) return;
    
    try {
      const response = await fetch('/api/batch-sitemap-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: sitemapJobId })
      });
      
      const result = await response.json();
      if (result.success) {
        // Create download link
        const downloadUrl = `/api/batch-sitemap-download?token=${result.downloadToken}`;
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = result.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        alert(`Download failed: ${result.error}`);
      }
    } catch (err) {
      console.error('Error downloading sitemaps:', err);
      alert('Failed to download sitemaps');
    }
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Loading batch results...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h3>Error Loading Results</h3>
          <p>{error}</p>
          <button onClick={fetchBatchStatus} className={styles.retryButton}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!batchStatus) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h3>Batch Not Found</h3>
          <p>The requested batch could not be found.</p>
        </div>
      </div>
    );
  }

  const filteredFiles = getFilteredAndSortedFiles();
  const summary = getBatchSummaryData();
  const progressPercentage = getProgressPercentage();
  const completedFiles = batchStatus.files.filter(f => f.status === FILE_STATUS.COMPLETED);
  const errorFiles = batchStatus.files.filter(f => f.status === FILE_STATUS.ERROR);

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h2>Batch Processing Results</h2>
        <div className={styles.batchInfo}>
          <span className={styles.batchId}>Batch ID: {batchId}</span>
          <span className={`${styles.batchStatus} ${getStatusClass(batchStatus.status)}`}>
            {batchStatus.status.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Progress Overview */}
      <div className={styles.progressSection}>
        <div className={styles.progressHeader}>
          <h3>Progress Overview</h3>
          <span className={styles.progressText}>
            {progressPercentage}% Complete
          </span>
        </div>
        
        <div className={styles.progressBar}>
          <div 
            className={styles.progressFill}
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        
        <div className={styles.progressStats}>
          <div className={styles.stat}>
            <span className={styles.statValue}>{batchStatus.files?.length || 0}</span>
            <span className={styles.statLabel}>Total Files</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{completedFiles.length}</span>
            <span className={styles.statLabel}>Completed</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{errorFiles.length}</span>
            <span className={styles.statLabel}>Failed</span>
          </div>
          {batchStatus.files?.filter(f => f.status === FILE_STATUS.PROCESSING).length > 0 && (
            <div className={styles.stat}>
              <span className={styles.statValue}>{batchStatus.files.filter(f => f.status === FILE_STATUS.PROCESSING).length}</span>
              <span className={styles.statLabel}>Processing</span>
            </div>
          )}
        </div>
      </div>

      {/* Summary Statistics */}
      {summary && (
        <div className={styles.summarySection}>
          <h3>Summary Statistics</h3>
          <div className={styles.summaryGrid}>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Success Rate</span>
              <span className={styles.summaryValue}>{summary.successRate}%</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Total URLs</span>
              <span className={styles.summaryValue}>
                {formatNumber(completedFiles.reduce((sum, f) => sum + (f.statistics?.validUrls || 0), 0))}
              </span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Processing Time</span>
              <span className={styles.summaryValue}>
                {summary.duration ? `${Math.round(summary.duration / 1000)}s` : 'N/A'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className={styles.actionSection}>
        <div className={styles.actionButtons}>
          {completedFiles.length > 0 && (
            <>
              <button
                onClick={() => onDownloadBatch && onDownloadBatch(batchId)}
                className={styles.primaryButton}
              >
                📦 Download All JSON Files
              </button>
              
              <button
                onClick={handleGenerateSitemaps}
                disabled={sitemapGenerating}
                className={styles.secondaryButton}
              >
                {sitemapGenerating ? '⏳ Generating...' : '🗺️ Generate Sitemaps'}
              </button>
              
              {sitemapJobId && (
                <button
                  onClick={handleDownloadSitemaps}
                  className={styles.successButton}
                >
                  📥 Download All Sitemaps
                </button>
              )}
            </>
          )}
          
          {errorFiles.length > 0 && (
            <button
              onClick={() => onRetryBatch && onRetryBatch(batchId)}
              className={styles.retryButton}
            >
              🔄 Retry Failed Files
            </button>
          )}
        </div>
        
        <button
          onClick={() => setShowDetails(!showDetails)}
          className={styles.toggleButton}
        >
          {showDetails ? 'Hide Details' : 'Show Details'}
        </button>
      </div>

      {/* File Details */}
      {showDetails && (
        <div className={styles.detailsSection}>
          <div className={styles.detailsHeader}>
            <h3>File Details</h3>
            
            <div className={styles.controls}>
              <select
                value={filterBy}
                onChange={(e) => setFilterBy(e.target.value)}
                className={styles.filterSelect}
              >
                <option value="all">All Files</option>
                <option value={FILE_STATUS.COMPLETED}>Completed</option>
                <option value={FILE_STATUS.ERROR}>Failed</option>
                <option value={FILE_STATUS.PROCESSING}>Processing</option>
                <option value={FILE_STATUS.PENDING}>Pending</option>
              </select>
              
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className={styles.sortSelect}
              >
                <option value="name">Sort by Name</option>
                <option value="status">Sort by Status</option>
                <option value="size">Sort by URLs</option>
              </select>
            </div>
          </div>
          
          {filteredFiles.length > 0 && (
            <div className={styles.bulkActions}>
              <label className={styles.selectAllLabel}>
                <input
                  type="checkbox"
                  checked={selectedFiles.size === filteredFiles.length}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                />
                Select All ({selectedFiles.size} selected)
              </label>
              
              {selectedFiles.size > 0 && (
                <div className={styles.bulkButtons}>
                  <button
                    onClick={() => {
                      selectedFiles.forEach(fileId => {
                        const file = batchStatus.files.find(f => f.fileId === fileId);
                        if (file?.status === FILE_STATUS.COMPLETED) {
                          onDownloadFile && onDownloadFile(batchId, fileId);
                        }
                      });
                    }}
                    className={styles.bulkButton}
                  >
                    Download Selected
                  </button>
                </div>
              )}
            </div>
          )}
          
          <div className={styles.fileList}>
            {filteredFiles.map((file) => (
              <div key={file.fileId} className={`${styles.fileItem} ${getStatusClass(file.status)}`}>
                <div className={styles.fileHeader}>
                  <label className={styles.fileSelect}>
                    <input
                      type="checkbox"
                      checked={selectedFiles.has(file.fileId)}
                      onChange={(e) => handleFileSelect(file.fileId, e.target.checked)}
                    />
                    <span className={styles.statusIcon}>
                      {getStatusIcon(file.status)}
                    </span>
                    <span className={styles.fileName}>{file.originalName}</span>
                  </label>
                  
                  <div className={styles.fileActions}>
                    {file.status === FILE_STATUS.COMPLETED && (
                      <button
                        onClick={() => onDownloadFile && onDownloadFile(batchId, file.fileId)}
                        className={styles.downloadButton}
                      >
                        📥 Download
                      </button>
                    )}
                    
                    {file.status === FILE_STATUS.ERROR && (
                      <button
                        onClick={() => onRetryFile && onRetryFile(batchId, file.fileId)}
                        className={styles.retryFileButton}
                      >
                        🔄 Retry
                      </button>
                    )}
                  </div>
                </div>
                
                <div className={styles.fileDetails}>
                  <div className={styles.fileStats}>
                    {file.statistics && (
                      <>
                        <span>URLs: {formatNumber(file.statistics.validUrls)}</span>
                        <span>Total: {formatNumber(file.statistics.totalUrls)}</span>
                        {file.statistics.excludedUrls > 0 && (
                          <span>Excluded: {formatNumber(file.statistics.excludedUrls)}</span>
                        )}
                      </>
                    )}
                  </div>
                  
                  {file.error && (
                    <div className={styles.errorDetails}>
                      <strong>Error:</strong> {file.error.message}
                      {file.error.details && (
                        <div className={styles.errorMeta}>
                          Attempts: {file.error.details.attempts}/{file.error.details.maxRetries}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          {filteredFiles.length === 0 && (
            <div className={styles.emptyState}>
              <p>No files match the current filter.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}