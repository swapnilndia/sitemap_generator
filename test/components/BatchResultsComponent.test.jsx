import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BatchResultsComponent from '../../components/BatchResultsComponent.jsx';

// Mock dependencies
vi.mock('../../lib/batchClient.js', () => ({
  getBatchSummary: vi.fn(),
  FILE_STATUS: {
    PENDING: 'pending',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    ERROR: 'error'
  },
  BATCH_STATUS: {
    UPLOADED: 'uploaded',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed'
  }
}));

// Mock fetch
global.fetch = vi.fn();

describe('BatchResultsComponent', () => {
  const mockProps = {
    batchId: 'batch_123_abc',
    onDownloadFile: vi.fn(),
    onDownloadBatch: vi.fn(),
    onGenerateSitemaps: vi.fn(),
    sitemapConfig: {
      grouping: 'group',
      changefreq: 'weekly',
      priority: '0.8',
      includeLastmod: false
    }
  };

  const mockBatchStatus = {
    batchId: 'batch_123_abc',
    status: 'completed',
    progress: 100,
    files: [
      {
        fileId: 'file1',
        originalName: 'test1.xlsx',
        status: 'completed',
        statistics: { validUrls: 100, totalRows: 100 }
      },
      {
        fileId: 'file2',
        originalName: 'test2.xlsx',
        status: 'completed',
        statistics: { validUrls: 50, totalRows: 50 }
      }
    ],
    createdAt: '2023-01-01T00:00:00Z',
    completedAt: '2023-01-01T00:01:00Z'
  };

  const mockSummary = {
    totalFiles: 2,
    completedFiles: 2,
    failedFiles: 0,
    totalUrls: 150,
    validUrls: 150,
    progress: 100,
    successRate: 100,
    duration: 60000
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    const { getBatchSummary } = require('../../lib/batchClient.js');
    getBatchSummary.mockReturnValue(mockSummary);
    
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, ...mockBatchStatus })
    });
  });

  it('should render batch results with correct data', async () => {
    render(<BatchResultsComponent {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('Batch Conversion Results')).toBeInTheDocument();
      expect(screen.getByText('batch_123_abc')).toBeInTheDocument();
    });

    // Check summary statistics
    expect(screen.getByText('2')).toBeInTheDocument(); // Total files
    expect(screen.getByText('150')).toBeInTheDocument(); // Total URLs
    expect(screen.getByText('100%')).toBeInTheDocument(); // Success rate
  });

  it('should display progress overview correctly', async () => {
    render(<BatchResultsComponent {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('Progress Overview')).toBeInTheDocument();
    });

    // Check progress bar
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '100');
  });

  it('should handle different progress formats', async () => {
    const { getBatchSummary } = require('../../lib/batchClient.js');
    getBatchSummary.mockReturnValue({
      ...mockSummary,
      progress: { totalFiles: 2, completedFiles: 1, failedFiles: 0 }
    });

    render(<BatchResultsComponent {...mockProps} />);

    await waitFor(() => {
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '50');
    });
  });

  it('should display file list correctly', async () => {
    render(<BatchResultsComponent {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('test1.xlsx')).toBeInTheDocument();
      expect(screen.getByText('test2.xlsx')).toBeInTheDocument();
    });

    // Check file status indicators
    expect(screen.getAllByText('✅')).toHaveLength(2); // Completed files
  });

  it('should handle file download', async () => {
    render(<BatchResultsComponent {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('test1.xlsx')).toBeInTheDocument();
    });

    const downloadButtons = screen.getAllByText('📥 Download');
    fireEvent.click(downloadButtons[0]);

    expect(mockProps.onDownloadFile).toHaveBeenCalledWith('file1');
  });

  it('should handle batch download', async () => {
    render(<BatchResultsComponent {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('📦 Download All JSON Files')).toBeInTheDocument();
    });

    const downloadButton = screen.getByText('📦 Download All JSON Files');
    fireEvent.click(downloadButton);

    expect(mockProps.onDownloadBatch).toHaveBeenCalledWith('batch_123_abc');
  });

  it('should handle sitemap generation', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        jobId: 'sitemap_job_123',
        results: [{ sitemapCount: 2 }],
        errors: []
      })
    });

    render(<BatchResultsComponent {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('🗺️ Generate Sitemaps')).toBeInTheDocument();
    });

    const generateButton = screen.getByText('🗺️ Generate Sitemaps');
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(screen.getByText('⏳ Generating...')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('📥 Download All Sitemaps')).toBeInTheDocument();
    });
  });

  it('should handle sitemap download', async () => {
    // First generate sitemaps
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        jobId: 'sitemap_job_123',
        results: [{ sitemapCount: 2 }],
        errors: []
      })
    });

    render(<BatchResultsComponent {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('🗺️ Generate Sitemaps')).toBeInTheDocument();
    });

    const generateButton = screen.getByText('🗺️ Generate Sitemaps');
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(screen.getByText('📥 Download All Sitemaps')).toBeInTheDocument();
    });

    // Mock sitemap download
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        downloadToken: 'download_token_123',
        fileName: 'sitemaps.zip',
        fileSize: 1024
      })
    });

    const downloadButton = screen.getByText('📥 Download All Sitemaps');
    fireEvent.click(downloadButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/batch-sitemap-download', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: 'sitemap_job_123' })
      }));
    });
  });

  it('should handle sitemap generation errors', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({
        success: false,
        error: 'Sitemap generation failed'
      })
    });

    render(<BatchResultsComponent {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('🗺️ Generate Sitemaps')).toBeInTheDocument();
    });

    const generateButton = screen.getByText('🗺️ Generate Sitemaps');
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(screen.getByText('❌ Sitemap generation failed')).toBeInTheDocument();
    });
  });

  it('should handle sitemap download errors', async () => {
    // First generate sitemaps
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        jobId: 'sitemap_job_123',
        results: [{ sitemapCount: 2 }],
        errors: []
      })
    });

    render(<BatchResultsComponent {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('🗺️ Generate Sitemaps')).toBeInTheDocument();
    });

    const generateButton = screen.getByText('🗺️ Generate Sitemaps');
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(screen.getByText('📥 Download All Sitemaps')).toBeInTheDocument();
    });

    // Mock sitemap download error
    fetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({
        success: false,
        error: 'Download failed'
      })
    });

    const downloadButton = screen.getByText('📥 Download All Sitemaps');
    fireEvent.click(downloadButton);

    await waitFor(() => {
      expect(screen.getByText('❌ Download failed')).toBeInTheDocument();
    });
  });

  it('should display processing status correctly', async () => {
    const { getBatchSummary } = require('../../lib/batchClient.js');
    getBatchSummary.mockReturnValue({
      ...mockSummary,
      totalFiles: 3,
      completedFiles: 1,
      failedFiles: 0,
      progress: 33
    });

    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        ...mockBatchStatus,
        status: 'processing',
        files: [
          { fileId: 'file1', status: 'completed', originalName: 'test1.xlsx' },
          { fileId: 'file2', status: 'processing', originalName: 'test2.xlsx' },
          { fileId: 'file3', status: 'pending', originalName: 'test3.xlsx' }
        ]
      })
    });

    render(<BatchResultsComponent {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('Processing')).toBeInTheDocument();
      expect(screen.getByText('⏳')).toBeInTheDocument(); // Processing indicator
    });
  });

  it('should display error status correctly', async () => {
    const { getBatchSummary } = require('../../lib/batchClient.js');
    getBatchSummary.mockReturnValue({
      ...mockSummary,
      totalFiles: 2,
      completedFiles: 1,
      failedFiles: 1,
      progress: 50
    });

    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        ...mockBatchStatus,
        status: 'failed',
        files: [
          { fileId: 'file1', status: 'completed', originalName: 'test1.xlsx' },
          { fileId: 'file2', status: 'error', originalName: 'test2.xlsx', error: 'Processing failed' }
        ]
      })
    });

    render(<BatchResultsComponent {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('Failed')).toBeInTheDocument();
      expect(screen.getByText('❌')).toBeInTheDocument(); // Error indicator
    });
  });

  it('should handle missing sitemap config', async () => {
    const propsWithoutConfig = { ...mockProps };
    delete propsWithoutConfig.sitemapConfig;

    render(<BatchResultsComponent {...propsWithoutConfig} />);

    await waitFor(() => {
      expect(screen.getByText('🗺️ Generate Sitemaps')).toBeInTheDocument();
    });

    const generateButton = screen.getByText('🗺️ Generate Sitemaps');
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/batch-sitemap-generate', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchId: 'batch_123_abc',
          sitemapConfig: {
            grouping: 'group',
            changefreq: 'weekly',
            priority: '0.8',
            includeLastmod: false
          }
        })
      }));
    });
  });

  it('should refresh batch status periodically', async () => {
    vi.useFakeTimers();

    render(<BatchResultsComponent {...mockProps} />);

    await waitFor(() => {
      expect(screen.getByText('batch_123_abc')).toBeInTheDocument();
    });

    // Fast-forward time to trigger refresh
    vi.advanceTimersByTime(5000);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2); // Initial load + refresh
    });

    vi.useRealTimers();
  });
});
