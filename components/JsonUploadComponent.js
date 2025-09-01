'use client';

import { useState, useRef } from 'react';
import styles from './JsonUploadComponent.module.css';

export default function JsonUploadComponent({ onJsonUpload }) {
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
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      setError(`File size exceeds 50MB limit. Current size: ${Math.round(file.size / (1024 * 1024))}MB`);
      return;
    }

    if (!file.name.toLowerCase().endsWith('.json')) {
      setError('Please upload a JSON file only.');
      return;
    }

    // Upload and validate JSON
    await uploadJson(file);
  };

  const uploadJson = async (file) => {
    setIsUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/json-upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        onJsonUpload(result);
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
      <h2>Upload JSON File</h2>
      <p>Upload a JSON file generated from the file converter or manually created</p>

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
          accept=".json"
          onChange={handleFileInputChange}
          className={styles.hiddenInput}
        />

        {isUploading ? (
          <div className={styles.uploadingState}>
            <div className={styles.spinner}></div>
            <p>Uploading and validating JSON...</p>
          </div>
        ) : (
          <div className={styles.dropContent}>
            <div className={styles.uploadIcon}>📄</div>
            <p className={styles.mainText}>
              {isDragging ? 'Drop your JSON file here' : 'Drag & drop your JSON file here'}
            </p>
            <p className={styles.subText}>or click to browse</p>
            <div className={styles.supportedFormats}>
              <span>Supported format: JSON</span>
              <span>Maximum size: 50MB</span>
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
        <h3>JSON File Requirements:</h3>
        <ul>
          <li>Must be valid JSON format</li>
          <li>Should contain URL data in the expected structure</li>
          <li>Can be generated from the File-to-JSON converter</li>
          <li>Must include processed URL entries</li>
        </ul>
        
        <div className={styles.exampleSection}>
          <h4>Expected JSON Structure:</h4>
          <pre className={styles.jsonExample}>
{`{
  "metadata": {
    "urlPattern": "https://example.com/{link}",
    "grouping": "category",
    "processedAt": "2024-01-09T..."
  },
  "statistics": {
    "totalRows": 1000,
    "validUrls": 950,
    "excludedRows": 50
  },
  "data": [
    {
      "rowNumber": 1,
      "processed": {
        "url": "https://example.com/product-1",
        "group": "electronics",
        "lastmod": "2024-01-01"
      }
    }
  ]
}`}
          </pre>
        </div>
      </div>
    </div>
  );
}