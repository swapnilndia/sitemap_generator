'use client';

import { useState, useRef } from 'react';
import styles from './FileUploadComponent.module.css';

export default function FileUploadComponent({ onFileUpload }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileInputChange = (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileSelect = async (file) => {
    setError('');
    setSelectedFile(file);

    // Basic client-side validation
    const maxSize = 25 * 1024 * 1024; // 25MB
    if (file.size > maxSize) {
      setError(`File size exceeds 25MB limit. Current size: ${Math.round(file.size / (1024 * 1024))}MB`);
      return;
    }

    const validTypes = ['.csv', '.xls', '.xlsx'];
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
    if (!validTypes.includes(fileExtension)) {
      setError('Unsupported file type. Please upload CSV or XLSX files only.');
      return;
    }

    // Upload file
    await uploadFile(file);
  };

  const uploadFile = async (file) => {
    setIsUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        onFileUpload(result);
      } else {
        setError(result.error || 'Upload failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Upload error:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={styles.container}>
      <h2>Upload Your File</h2>
      <p>Upload a CSV or Excel file to convert to JSON format</p>

      <div
        className={`${styles.dropZone} ${isDragging ? styles.dragging : ''} ${
          isUploading ? styles.uploading : ''
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xls,.xlsx"
          onChange={handleFileInputChange}
          className={styles.hiddenInput}
        />

        {isUploading ? (
          <div className={styles.uploadingState}>
            <div className={styles.spinner}></div>
            <p>Uploading and processing file...</p>
          </div>
        ) : (
          <div className={styles.dropContent}>
            <div className={styles.uploadIcon}>📁</div>
            <p className={styles.mainText}>
              {isDragging ? 'Drop your file here' : 'Drag & drop your file here'}
            </p>
            <p className={styles.subText}>or click to browse</p>
            <div className={styles.supportedFormats}>
              <span>Supported formats: CSV, XLS, XLSX</span>
              <span>Maximum size: 25MB</span>
            </div>
          </div>
        )}
      </div>

      {selectedFile && !isUploading && (
        <div className={styles.fileInfo}>
          <h3>Selected File:</h3>
          <div className={styles.fileDetails}>
            <span className={styles.fileName}>{selectedFile.name}</span>
            <span className={styles.fileSize}>{formatFileSize(selectedFile.size)}</span>
          </div>
        </div>
      )}

      {error && (
        <div className={styles.error}>
          <span className={styles.errorIcon}>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <div className={styles.instructions}>
        <h3>Instructions:</h3>
        <ul>
          <li>Ensure your file has column headers in the first row</li>
          <li>CSV files should use comma separators</li>
          <li>Excel files can be .xls or .xlsx format</li>
          <li>Include a column with URLs or URL components</li>
        </ul>
      </div>
    </div>
  );
}