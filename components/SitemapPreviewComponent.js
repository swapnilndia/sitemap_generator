'use client';

import { useState, useEffect } from 'react';
import styles from './SitemapPreviewComponent.module.css';

export default function SitemapPreviewComponent({ 
  fileId, 
  config, 
  onPreviewComplete, 
  onConfigChange 
}) {
  const [previewData, setPreviewData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (fileId && config) {
      generatePreview();
    }
  }, [fileId, config]);

  const generatePreview = async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/sitemap-preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileId,
          config
        }),
      });

      const result = await response.json();

      if (result.success) {
        setPreviewData(result.preview);
      } else {
        setError(result.error || 'Preview generation failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Preview error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinue = () => {
    if (previewData) {
      onPreviewComplete(previewData);
    }
  };

  const formatNumber = (num) => {
    return num.toLocaleString();
  };

  return (
    <div className={styles.container}>
      <h2>Sitemap Preview</h2>
      <p>Review the structure of your generated sitemaps before final creation</p>

      {/* Loading State */}
      {isLoading && (
        <div className={styles.loadingState}>
          <div className={styles.spinner}></div>
          <p>Generating sitemap preview...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className={styles.error}>
          <span className={styles.errorIcon}>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Preview Results */}
      {previewData && !isLoading && (
        <div className={styles.previewResults}>
          {/* Overview Statistics */}
          <div className={styles.overviewSection}>
            <h3>Sitemap Overview</h3>
            <div className={styles.overviewGrid}>
              <div className={styles.overviewItem}>
                <div className={styles.overviewValue}>{previewData.totalFiles}</div>
                <div className={styles.overviewLabel}>Sitemap Files</div>
              </div>
              
              <div className={styles.overviewItem}>
                <div className={styles.overviewValue}>
                  {previewData.needsIndex ? 'Yes' : 'No'}
                </div>
                <div className={styles.overviewLabel}>Index Required</div>
              </div>
              
              <div className={styles.overviewItem}>
                <div className={styles.overviewValue}>
                  {formatNumber(previewData.statistics?.validUrls || 0)}
                </div>
                <div className={styles.overviewLabel}>Total URLs</div>
              </div>
              
              <div className={styles.overviewItem}>
                <div className={styles.overviewValue}>{previewData.groups?.length || 0}</div>
                <div className={styles.overviewLabel}>Groups</div>
              </div>
            </div>
          </div>

          {/* File Structure */}
          <div className={styles.filesSection}>
            <h3>Generated Files</h3>
            <div className={styles.filesList}>
              {previewData.needsIndex && (
                <div className={styles.fileItem}>
                  <div className={styles.fileIcon}>📋</div>
                  <div className={styles.fileInfo}>
                    <div className={styles.fileName}>sitemap_index.xml</div>
                    <div className={styles.fileDescription}>
                      Sitemap index file (references all sitemap files)
                    </div>
                  </div>
                  <div className={styles.fileType}>Index</div>
                </div>
              )}
              
              {previewData.files?.map((file, index) => (
                <div key={index} className={styles.fileItem}>
                  <div className={styles.fileIcon}>🗺️</div>
                  <div className={styles.fileInfo}>
                    <div className={styles.fileName}>{file.filename}</div>
                    <div className={styles.fileDescription}>
                      {formatNumber(file.urlCount)} URLs
                      {file.group && ` • Group: ${file.group}`}
                      {file.chunkNumber > 1 && ` • Part ${file.chunkNumber}`}
                    </div>
                  </div>
                  <div className={styles.fileType}>Sitemap</div>
                </div>
              ))}
            </div>
          </div>

          {/* Sample URLs */}
          {previewData.sampleUrls && previewData.sampleUrls.length > 0 && (
            <div className={styles.sampleSection}>
              <h3>Sample URLs</h3>
              <div className={styles.sampleList}>
                {previewData.sampleUrls.map((urlData, index) => (
                  <div key={index} className={styles.sampleItem}>
                    <div className={styles.sampleUrl}>
                      <code>{urlData.url}</code>
                    </div>
                    <div className={styles.sampleMeta}>
                      {urlData.group && (
                        <span className={styles.sampleGroup}>Group: {urlData.group}</span>
                      )}
                      {urlData.lastmod && (
                        <span className={styles.sampleLastmod}>Modified: {urlData.lastmod}</span>
                      )}
                      {urlData.changefreq && (
                        <span className={styles.sampleChangefreq}>Frequency: {urlData.changefreq}</span>
                      )}
                      {urlData.priority && (
                        <span className={styles.samplePriority}>Priority: {urlData.priority}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Groups Breakdown */}
          {previewData.groups && previewData.groups.length > 1 && (
            <div className={styles.groupsSection}>
              <h3>Groups Breakdown</h3>
              <div className={styles.groupsList}>
                {previewData.groups.map((group, index) => (
                  <div key={index} className={styles.groupItem}>
                    <span className={styles.groupName}>{group}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      {previewData && !isLoading && (
        <div className={styles.actions}>
          <button
            onClick={handleContinue}
            className={styles.continueButton}
          >
            Generate Sitemaps
          </button>
          
          <button
            onClick={generatePreview}
            className={styles.refreshButton}
          >
            Refresh Preview
          </button>
        </div>
      )}

      {/* Tips */}
      <div className={styles.tips}>
        <h4>💡 What happens next:</h4>
        <ul>
          <li>XML sitemap files will be generated with proper formatting</li>
          <li>All URLs will include appropriate metadata (lastmod, changefreq, priority)</li>
          <li>Files will be packaged in a ZIP archive for easy download</li>
          <li>Sitemap index will be created if multiple files are generated</li>
        </ul>
      </div>
    </div>
  );
}