import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MultiFileUploadComponent from '../../components/MultiFileUploadComponent.jsx';

// Mock dependencies
vi.mock('../../lib/batchClient.js', () => ({
  generateBatchId: vi.fn(() => 'batch_123_abc'),
  createBatchJob: vi.fn(() => ({
    batchId: 'batch_123_abc',
    files: [],
    status: 'uploaded',
    createdAt: new Date()
  }))
}));

// Mock fetch
global.fetch = vi.fn();

describe('MultiFileUploadComponent', () => {
  const mockProps = {
    onUploadComplete: vi.fn(),
    onError: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        batchId: 'batch_123_abc',
        fileCount: 2,
        headers: ['url', 'title', 'description']
      })
    });
  });

  it('should render file upload interface', () => {
    render(<MultiFileUploadComponent {...mockProps} />);

    expect(screen.getByText('Upload Multiple Files')).toBeInTheDocument();
    expect(screen.getByText('Select multiple CSV or Excel files to upload')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /select files/i })).toBeInTheDocument();
  });

  it('should handle file selection', async () => {
    render(<MultiFileUploadComponent {...mockProps} />);

    const fileInput = screen.getByLabelText(/select files/i);
    const file1 = new File(['url,title\nhttps://example.com/1,Test 1'], 'test1.csv', { type: 'text/csv' });
    const file2 = new File(['url,title\nhttps://example.com/2,Test 2'], 'test2.csv', { type: 'text/csv' });

    fireEvent.change(fileInput, { target: { files: [file1, file2] } });

    await waitFor(() => {
      expect(screen.getByText('test1.csv')).toBeInTheDocument();
      expect(screen.getByText('test2.csv')).toBeInTheDocument();
    });

    expect(screen.getByText('2 files selected')).toBeInTheDocument();
  });

  it('should handle drag and drop', async () => {
    render(<MultiFileUploadComponent {...mockProps} />);

    const dropZone = screen.getByText('Select multiple CSV or Excel files to upload').closest('div');
    const file1 = new File(['url,title\nhttps://example.com/1,Test 1'], 'test1.csv', { type: 'text/csv' });
    const file2 = new File(['url,title\nhttps://example.com/2,Test 2'], 'test2.csv', { type: 'text/csv' });

    fireEvent.dragOver(dropZone);
    fireEvent.drop(dropZone, { dataTransfer: { files: [file1, file2] } });

    await waitFor(() => {
      expect(screen.getByText('test1.csv')).toBeInTheDocument();
      expect(screen.getByText('test2.csv')).toBeInTheDocument();
    });
  });

  it('should validate file types', async () => {
    render(<MultiFileUploadComponent {...mockProps} />);

    const fileInput = screen.getByLabelText(/select files/i);
    const invalidFile = new File(['content'], 'test.txt', { type: 'text/plain' });

    fireEvent.change(fileInput, { target: { files: [invalidFile] } });

    await waitFor(() => {
      expect(screen.getByText(/unsupported file type/i)).toBeInTheDocument();
    });
  });

  it('should handle file removal', async () => {
    render(<MultiFileUploadComponent {...mockProps} />);

    const fileInput = screen.getByLabelText(/select files/i);
    const file1 = new File(['url,title\nhttps://example.com/1,Test 1'], 'test1.csv', { type: 'text/csv' });
    const file2 = new File(['url,title\nhttps://example.com/2,Test 2'], 'test2.csv', { type: 'text/csv' });

    fireEvent.change(fileInput, { target: { files: [file1, file2] } });

    await waitFor(() => {
      expect(screen.getByText('test1.csv')).toBeInTheDocument();
      expect(screen.getByText('test2.csv')).toBeInTheDocument();
    });

    const removeButton = screen.getAllByText('❌')[0];
    fireEvent.click(removeButton);

    await waitFor(() => {
      expect(screen.queryByText('test1.csv')).not.toBeInTheDocument();
      expect(screen.getByText('test2.csv')).toBeInTheDocument();
    });

    expect(screen.getByText('1 files selected')).toBeInTheDocument();
  });

  it('should handle file upload', async () => {
    render(<MultiFileUploadComponent {...mockProps} />);

    const fileInput = screen.getByLabelText(/select files/i);
    const file1 = new File(['url,title\nhttps://example.com/1,Test 1'], 'test1.csv', { type: 'text/csv' });
    const file2 = new File(['url,title\nhttps://example.com/2,Test 2'], 'test2.csv', { type: 'text/csv' });

    fireEvent.change(fileInput, { target: { files: [file1, file2] } });

    await waitFor(() => {
      expect(screen.getByText('test1.csv')).toBeInTheDocument();
    });

    const uploadButton = screen.getByText('📤 Upload Files');
    fireEvent.click(uploadButton);

    await waitFor(() => {
      expect(screen.getByText('⏳ Uploading...')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(mockProps.onUploadComplete).toHaveBeenCalledWith({
        batchId: 'batch_123_abc',
        fileCount: 2,
        headers: ['url', 'title', 'description']
      });
    });
  });

  it('should handle upload errors', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({
        success: false,
        error: 'Upload failed'
      })
    });

    render(<MultiFileUploadComponent {...mockProps} />);

    const fileInput = screen.getByLabelText(/select files/i);
    const file1 = new File(['url,title\nhttps://example.com/1,Test 1'], 'test1.csv', { type: 'text/csv' });

    fireEvent.change(fileInput, { target: { files: [file1] } });

    await waitFor(() => {
      expect(screen.getByText('test1.csv')).toBeInTheDocument();
    });

    const uploadButton = screen.getByText('📤 Upload Files');
    fireEvent.click(uploadButton);

    await waitFor(() => {
      expect(screen.getByText('❌ Upload failed')).toBeInTheDocument();
    });

    expect(mockProps.onError).toHaveBeenCalledWith('Upload failed');
  });

  it('should handle network errors', async () => {
    fetch.mockRejectedValueOnce(new Error('Network error'));

    render(<MultiFileUploadComponent {...mockProps} />);

    const fileInput = screen.getByLabelText(/select files/i);
    const file1 = new File(['url,title\nhttps://example.com/1,Test 1'], 'test1.csv', { type: 'text/csv' });

    fireEvent.change(fileInput, { target: { files: [file1] } });

    await waitFor(() => {
      expect(screen.getByText('test1.csv')).toBeInTheDocument();
    });

    const uploadButton = screen.getByText('📤 Upload Files');
    fireEvent.click(uploadButton);

    await waitFor(() => {
      expect(screen.getByText('❌ Network error')).toBeInTheDocument();
    });
  });

  it('should show upload progress', async () => {
    // Mock progress events
    let progressCallback;
    fetch.mockImplementationOnce((url, options) => {
      const formData = options.body;
      progressCallback = formData.onProgress;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          batchId: 'batch_123_abc',
          fileCount: 1,
          headers: ['url', 'title']
        })
      });
    });

    render(<MultiFileUploadComponent {...mockProps} />);

    const fileInput = screen.getByLabelText(/select files/i);
    const file1 = new File(['url,title\nhttps://example.com/1,Test 1'], 'test1.csv', { type: 'text/csv' });

    fireEvent.change(fileInput, { target: { files: [file1] } });

    await waitFor(() => {
      expect(screen.getByText('test1.csv')).toBeInTheDocument();
    });

    const uploadButton = screen.getByText('📤 Upload Files');
    fireEvent.click(uploadButton);

    // Simulate progress
    if (progressCallback) {
      progressCallback({ loaded: 50, total: 100 });
    }

    await waitFor(() => {
      expect(screen.getByText('⏳ Uploading...')).toBeInTheDocument();
    });
  });

  it('should handle empty file selection', () => {
    render(<MultiFileUploadComponent {...mockProps} />);

    const uploadButton = screen.getByText('📤 Upload Files');
    fireEvent.click(uploadButton);

    expect(screen.getByText(/please select files/i)).toBeInTheDocument();
  });

  it('should handle large file warnings', async () => {
    // Create a large file (simulate)
    const largeContent = 'url,title\n' + Array.from({ length: 10000 }, (_, i) => `https://example.com/${i},Title ${i}`).join('\n');
    const largeFile = new File([largeContent], 'large.csv', { type: 'text/csv' });

    render(<MultiFileUploadComponent {...mockProps} />);

    const fileInput = screen.getByLabelText(/select files/i);
    fireEvent.change(fileInput, { target: { files: [largeFile] } });

    await waitFor(() => {
      expect(screen.getByText('large.csv')).toBeInTheDocument();
    });

    // Should show warning for large files
    expect(screen.getByText(/large file detected/i)).toBeInTheDocument();
  });

  it('should handle duplicate file names', async () => {
    render(<MultiFileUploadComponent {...mockProps} />);

    const fileInput = screen.getByLabelText(/select files/i);
    const file1 = new File(['url,title\nhttps://example.com/1,Test 1'], 'test.csv', { type: 'text/csv' });
    const file2 = new File(['url,title\nhttps://example.com/2,Test 2'], 'test.csv', { type: 'text/csv' });

    fireEvent.change(fileInput, { target: { files: [file1, file2] } });

    await waitFor(() => {
      expect(screen.getByText(/duplicate file names detected/i)).toBeInTheDocument();
    });
  });

  it('should clear files after successful upload', async () => {
    render(<MultiFileUploadComponent {...mockProps} />);

    const fileInput = screen.getByLabelText(/select files/i);
    const file1 = new File(['url,title\nhttps://example.com/1,Test 1'], 'test1.csv', { type: 'text/csv' });

    fireEvent.change(fileInput, { target: { files: [file1] } });

    await waitFor(() => {
      expect(screen.getByText('test1.csv')).toBeInTheDocument();
    });

    const uploadButton = screen.getByText('📤 Upload Files');
    fireEvent.click(uploadButton);

    await waitFor(() => {
      expect(mockProps.onUploadComplete).toHaveBeenCalled();
    });

    // Files should be cleared after successful upload
    expect(screen.queryByText('test1.csv')).not.toBeInTheDocument();
    expect(screen.getByText('0 files selected')).toBeInTheDocument();
  });
});
