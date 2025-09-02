'use client';

import { useState, useRef, useCallback } from 'react';
import { generateBatchId, createBatchJob } from '../lib/batchClient.js';
import styles from './MultiFileUploadComponent.module.css';

const ACCEPTED_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
  'text/csv' // .csv
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_FILES = 20;

export default function MultiFileUploadComponent({ 
  onFilesUpload, 
  onFilesClear,
  maxFiles = MAX_FILES,
  maxFileSize = MAX_FILE_SIZE,
  acceptedTypes = ACCEPTED_TYPES
}) {
  const [files, setFiles] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errors, setErrors] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});
  
  const fileInputRef = useRef(null);
  const dropZoneRef = useRef(null);

  // Validate file
  const validateFile = useCallback((file) => {
    const errors = [];
    
    // Check file type
    if (!acceptedTypes.includes(file.type)) {
      errors.push(`Invalid file type. Accepted types: ${acceptedTypes.join(', ')}`);
    }
    
    // Check file size
    if (file.size > maxFileSize) {
      errors.push(`File size exceeds limit of ${Math.round(maxFileSize / 1024 / 1024)}MB`);
    }
    
    // Check if file already exists
    if (files.some(f => f.name === file.name && f.size === file.size)) {
      errors.push('File already selected');
    }
    
    return errors;
  }, [acceptedTypes, maxFileSize, files]);

  // Process selected files
  const processFiles = useCallback((fileList) => {
    const newFiles = [];
    const newErrors = [];
    
    // Convert FileList to Array
    const filesArray = Array.from(fileList);
    
    // Check total file count
    if (files.length + filesArray.length > maxFiles) {
      newErrors.push(`Maximum ${maxFiles} files allowed. Please remove some files first.`);
      setErrors(prev => [...prev, ...newErrors]);
      return;
    }
    
    filesArray.forEach((file, index) => {
      const fileErrors = validateFile(file);
      
      if (fileErrors.length === 0) {
        const fileId = `file_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 6)}`;
        newFiles.push({
          id: fileId,
          file,
          name: file.name,
          size: file.size,
          type: file.type,
          status: 'ready',
          progress: 0,
          error: null
        });
      } else {
        newErrors.push(`${file.name}: ${fileErrors.join(', ')}`);
      }
    });
    
    if (newFiles.length > 0) {
      setFiles(prev => [...prev, ...newFiles]);
    }
    
    if (newErrors.length > 0) {
      setErrors(prev => [...prev, ...newErrors]);
    }
  }, [files, maxFiles, validateFile]);

  // Handle file input change
  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
      e.target.value = ''; // Reset input
    }
  };

  // Handle drag and drop
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  // Remove file
  const removeFile = (fileId) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
    setUploadProgress(prev => {
      const newProgress = { ...prev };
      delete newProgress[fileId];
      return newProgress;
    });
  };

  // Clear all files
  const clearAllFiles = () => {
    setFiles([]);
    setErrors([]);
    setUploadProgress({});
    
    // Notify parent component about clearing files
    if (onFilesClear) {
      onFilesClear();
    }
  };

  // Clear errors
  const clearErrors = () => {
    setErrors([]);
  };

  // Simulate file upload progress
  const simulateUploadProgress = (fileId) => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 30;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
      }
      
      setUploadProgress(prev => ({
        ...prev,
        [fileId]: Math.round(progress)
      }));
    }, 200);
    
    return interval;
  };

  // Handle upload
  const handleUpload = async () => {
    if (files.length === 0) {
      setErrors(['Please select at least one file']);
      return;
    }
    
    // Note: Configuration validation happens during conversion, not upload
    
    setIsUploading(true);
    setErrors([]);
    
    try {
      // Update file statuses to uploading
      setFiles(prev => prev.map(f => ({ ...f, status: 'uploading' })));
      
      // Simulate upload progress for each file
      const progressIntervals = files.map(file => simulateUploadProgress(file.id));
      
      // Create FormData for batch upload
      const formData = new FormData();
      files.forEach((fileItem, index) => {
        formData.append(`files`, fileItem.file);
        formData.append(`fileIds`, fileItem.id);
      });
      
      // No config needed during upload - configuration happens in later steps
      
      // Upload files
      const response = await fetch('/api/batch-upload', {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      
      // Clear progress intervals
      progressIntervals.forEach(interval => clearInterval(interval));
      
      if (result.success) {
        // Update file statuses to completed
        setFiles(prev => prev.map(f => ({ ...f, status: 'completed', progress: 100 })));
        
        // Create batch job with minimal config (full config will be set during conversion)
        const batchJob = createBatchJob(
          files.map(f => f.file),
          {}, // Empty config - will be populated during conversion step
          null // userId - can be added later
        );
        
        // Notify parent component
        if (onFilesUpload) {
          onFilesUpload({
            batchId: result.batchId || batchJob.batchId,
            files: result.files || files,
            headers: result.headers || ['url', 'title', 'description'], // Headers from API or default
            batchJob: result.batchJob || batchJob
          });
        }
      } else {
        setErrors([result.error || 'Upload failed']);
        setFiles(prev => prev.map(f => ({ ...f, status: 'error' })));
      }
    } catch (error) {
      console.error('Upload error:', error);
      setErrors(['Upload failed. Please try again.']);
      setFiles(prev => prev.map(f => ({ ...f, status: 'error' })));
    } finally {
      setIsUploading(false);
    }
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Get file type icon
  const getFileTypeIcon = (type) => {
    if (type.includes('spreadsheet') || type.includes('excel')) {
      return '📊';
    } else if (type.includes('csv')) {
      return '📄';
    }
    return '📁';
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Upload Multiple Files</h2>
        <p>Select multiple Excel (.xlsx, .xls) or CSV files to process in batch</p>
      </div>

      {/* Upload Area */}
      <div
        ref={dropZoneRef}
        className={`${styles.dropZone} ${isDragOver ? styles.dragOver : ''} ${isUploading ? styles.uploading : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedTypes.join(',')}
          onChange={handleFileInputChange}
          className={styles.hiddenInput}
          disabled={isUploading}
        />
        
        <div className={styles.dropZoneContent}>
          <div className={styles.uploadIcon}>📁</div>
          <h3>Drop files here or click to browse</h3>
          <p>
            Supports: Excel (.xlsx, .xls) and CSV files<br/>
            Max {maxFiles} files, {Math.round(maxFileSize / 1024 / 1024)}MB each
          </p>
        </div>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className={styles.fileList}>
          <div className={styles.fileListHeader}>
            <h3>Selected Files ({files.length}/{maxFiles})</h3>
            <button
              onClick={clearAllFiles}
              className={styles.clearButton}
              disabled={isUploading}
            >
              Clear All
            </button>
          </div>
          
          <div className={styles.files}>
            {files.map((fileItem) => (
              <div key={fileItem.id} className={`${styles.fileItem} ${styles[fileItem.status]}`}>
                <div className={styles.fileInfo}>
                  <div className={styles.fileIcon}>
                    {getFileTypeIcon(fileItem.type)}
                  </div>
                  <div className={styles.fileDetails}>
                    <div className={styles.fileName}>{fileItem.name}</div>
                    <div className={styles.fileSize}>{formatFileSize(fileItem.size)}</div>
                  </div>
                </div>
                
                <div className={styles.fileStatus}>
                  {fileItem.status === 'uploading' && (
                    <div className={styles.progressContainer}>
                      <div className={styles.progressBar}>
                        <div 
                          className={styles.progressFill}
                          style={{ width: `${uploadProgress[fileItem.id] || 0}%` }}
                        />
                      </div>
                      <span className={styles.progressText}>
                        {uploadProgress[fileItem.id] || 0}%
                      </span>
                    </div>
                  )}
                  
                  {fileItem.status === 'completed' && (
                    <span className={styles.statusIcon}>✅</span>
                  )}
                  
                  {fileItem.status === 'error' && (
                    <span className={styles.statusIcon}>❌</span>
                  )}
                  
                  {fileItem.status === 'ready' && (
                    <button
                      onClick={() => removeFile(fileItem.id)}
                      className={styles.removeButton}
                      disabled={isUploading}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <div className={styles.errorContainer}>
          <div className={styles.errorHeader}>
            <h4>Upload Errors</h4>
            <button onClick={clearErrors} className={styles.clearErrorsButton}>
              Clear
            </button>
          </div>
          <ul className={styles.errorList}>
            {errors.map((error, index) => (
              <li key={index} className={styles.errorItem}>
                {error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Upload Button */}
      {files.length > 0 && (
        <div className={styles.uploadSection}>
          <button
            onClick={handleUpload}
            disabled={isUploading || files.length === 0}
            className={`${styles.uploadButton} ${isUploading ? styles.uploading : ''}`}
          >
            {isUploading ? (
              <>
                <span className={styles.spinner}></span>
                Uploading {files.length} files...
              </>
            ) : (
              `Upload ${files.length} file${files.length > 1 ? 's' : ''}`
            )}
          </button>
          
          <div className={styles.uploadInfo}>
            <p>
              Total size: {formatFileSize(files.reduce((sum, f) => sum + f.size, 0))}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}