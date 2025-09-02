'use client';

import { useState, useEffect } from 'react';
import styles from './PreviewComponent.module.css';

export default function PreviewComponent({ 
  fileId, 
  config, 
  onPreviewComplete, 
  onConfigChange,
  isBatchMode = false,
  batchData = null
}) {
  const [previewData, setPreviewData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [advancedConfig, setAdvancedConfig] = useState({
    grouping: config.grouping || 'none',
    includeLastmod: config.includeLastmod || false,
    lastmodField: config.lastmodField || 'lastmod',
    changefreq: config.changefreq || '',
    priority: config.priority || ''
  });

  useEffect(() => {
    if (fileId && config.urlPattern && config.columnMapping.link) {
      generatePreview();
    }
  }, [fileId, config]);

  const generatePreview = async () => {
    setIsLoading(true);
    setError('');

    try {
      const endpoint = isBatchMode ? '/api/batch-preview' : '/api/preview';
      const requestBody = isBatchMode ? {
        batchId: fileId,
        config: { ...config, ...advancedConfig }
      } : {
        fileId,
        config: { ...config, ...advancedConfig }
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
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

  const handleAdvancedConfigChange = (key, value) => {
    const newConfig = { ...advancedConfig, [key]: value };
    setAdvancedConfig(newConfig);
    onConfigChange(newConfig);
  };

  const handleContinue = () => {
    if (previewData) {
      onPreviewComplete(previewData);
    }
  };

  const handleRegeneratePreview = () => {
    generatePreview();
  };

  const formatPercentage = (value, total) => {
    if (total === 0) return '0%';
    return `${Math.round((value / total) * 100)}%`;
  };

  return (
    <div className={styles.container}>
      <h2>{isBatchMode ? 'Preview Your Batch URLs' : 'Preview Your URLs'}</h2>
      <p>{isBatchMode ? 'Review sample URLs from your batch files and configure optional settings before full conversion' : 'Review sample URLs and configure optional settings before full conversion'}</p>

      {/* Advanced Options */}
      <div className={styles.advancedSection}>
        <button
          onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
          className={styles.toggleButton}
        >
          {showAdvancedOptions ? '▼' : '▶'} Advanced Options
        </button>

        {showAdvancedOptions && (
          <div className={styles.advancedOptions}>
            <div className={styles.optionGroup}>
              <label className={styles.optionLabel}>
                Grouping:
                <select
                  value={advancedConfig.grouping}
                  onChange={(e) => handleAdvancedConfigChange('grouping', e.target.value)}
                  className={styles.select}
                >
                  <option value="none">No Grouping</option>
                  <option value="category">Group by Category</option>
                  <option value="store_id">Group by Store ID</option>
                </select>
              </label>
              <p className={styles.optionDescription}>
                Group URLs into separate sitemap files
              </p>
            </div>

            <div className={styles.optionGroup}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={advancedConfig.includeLastmod}
                  onChange={(e) => handleAdvancedConfigChange('includeLastmod', e.target.checked)}
                />
                Include Last Modified Dates
              </label>
              <p className={styles.optionDescription}>
                Add lastmod tags to sitemap entries (requires YYYY-MM-DD format)
              </p>
            </div>

            {advancedConfig.includeLastmod && (
              <div className={styles.optionGroup}>
                <label className={styles.optionLabel}>
                  Last Modified Field:
                  <select
                    value={advancedConfig.lastmodField}
                    onChange={(e) => handleAdvancedConfigChange('lastmodField', e.target.value)}
                    className={styles.select}
                  >
                    {Object.entries(config.columnMapping)
                      .filter(([key, value]) => value)
                      .map(([key, value]) => (
                        <option key={key} value={key}>
                          {key} ({value})
                        </option>
                      ))}
                  </select>
                </label>
              </div>
            )}

            <div className={styles.optionGroup}>
              <label className={styles.optionLabel}>
                Change Frequency:
                <select
                  value={advancedConfig.changefreq}
                  onChange={(e) => handleAdvancedConfigChange('changefreq', e.target.value)}
                  className={styles.select}
                >
                  <option value="">Not specified</option>
                  <option value="always">Always</option>
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                  <option value="never">Never</option>
                </select>
              </label>
              <p className={styles.optionDescription}>
                How frequently the page is likely to change
              </p>
            </div>

            <div className={styles.optionGroup}>
              <label className={styles.optionLabel}>
                Priority:
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={advancedConfig.priority}
                  onChange={(e) => handleAdvancedConfigChange('priority', e.target.value)}
                  className={styles.numberInput}
                  placeholder="0.5"
                />
              </label>
              <p className={styles.optionDescription}>
                Priority of this URL relative to other URLs (0.0 to 1.0)
              </p>
            </div>

            <button
              onClick={handleRegeneratePreview}
              className={styles.regenerateButton}
              disabled={isLoading}
            >
              {isLoading ? 'Regenerating...' : 'Update Preview'}
            </button>
          </div>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className={styles.loadingState}>
          <div className={styles.spinner}></div>
          <p>Generating preview...</p>
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
          {/* Batch Info */}
          {isBatchMode && previewData.batchInfo && (
            <div className={styles.batchInfoSection}>
              <h3>Batch Information</h3>
              <div className={styles.batchInfo}>
                <div className={styles.batchInfoItem}>
                  <span className={styles.batchInfoLabel}>Total Files:</span>
                  <span className={styles.batchInfoValue}>{previewData.batchInfo.totalFiles}</span>
                </div>
                <div className={styles.batchInfoItem}>
                  <span className={styles.batchInfoLabel}>Preview File:</span>
                  <span className={styles.batchInfoValue}>{previewData.batchInfo.previewFile}</span>
                </div>
                <div className={styles.batchInfoItem}>
                  <span className={styles.batchInfoLabel}>File Types:</span>
                  <span className={styles.batchInfoValue}>{previewData.batchInfo.fileTypes.join(', ')}</span>
                </div>
              </div>
            </div>
          )}

          {/* Statistics */}
          <div className={styles.statisticsSection}>
            <h3>Preview Statistics</h3>
            <div className={styles.statsGrid}>
              <div className={styles.statItem}>
                <div className={styles.statValue}>{previewData.validCount}</div>
                <div className={styles.statLabel}>Valid URLs</div>
                <div className={styles.statPercentage}>
                  {formatPercentage(previewData.validCount, previewData.totalSampled)}
                </div>
              </div>
              <div className={styles.statItem}>
                <div className={styles.statValue}>{previewData.excludedCount}</div>
                <div className={styles.statLabel}>Excluded</div>
                <div className={styles.statPercentage}>
                  {formatPercentage(previewData.excludedCount, previewData.totalSampled)}
                </div>
              </div>
              <div className={styles.statItem}>
                <div className={styles.statValue}>{previewData.totalSampled}</div>
                <div className={styles.statLabel}>Total Sampled</div>
                <div className={styles.statPercentage}>100%</div>
              </div>
            </div>
          </div>

          {/* Sample URLs */}
          {previewData.sampleUrls && previewData.sampleUrls.length > 0 && (
            <div className={styles.urlsSection}>
              <h3>Sample URLs</h3>
              <div className={styles.urlList}>
                {previewData.sampleUrls.map((urlData, index) => (
                  <div key={index} className={styles.urlItem}>
                    <div className={styles.urlText}>
                      <code>{urlData.url}</code>
                    </div>
                    <div className={styles.urlMeta}>
                      Row {urlData.rowNumber}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Exclusion Reasons */}
          {previewData.excludedReasons && previewData.excludedReasons.length > 0 && (
            <div className={styles.exclusionsSection}>
              <h3>Exclusion Reasons</h3>
              <div className={styles.exclusionList}>
                {previewData.excludedReasons.map((reason, index) => (
                  <div key={index} className={styles.exclusionItem}>
                    <span className={styles.exclusionIcon}>⚠️</span>
                    <span>{reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sample Data */}
          {previewData.sampleData && previewData.sampleData.length > 0 && (
            <div className={styles.sampleDataSection}>
              <h3>Sample Source Data</h3>
              <div className={styles.dataTable}>
                <div className={styles.tableHeader}>
                  {Object.keys(previewData.sampleData[0]).map((header) => (
                    <div key={header} className={styles.headerCell}>
                      {header}
                    </div>
                  ))}
                </div>
                {previewData.sampleData.slice(0, 3).map((row, index) => (
                  <div key={index} className={styles.tableRow}>
                    {Object.values(row).map((value, cellIndex) => (
                      <div key={cellIndex} className={styles.dataCell}>
                        {value || '-'}
                      </div>
                    ))}
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
            {isBatchMode ? 'Proceed with Batch Conversion' : 'Proceed with Full Conversion'}
          </button>
          
          <p className={styles.actionNote}>
            {isBatchMode 
              ? 'This preview shows a sample from your first file. The batch conversion will process all files with the same configuration.'
              : 'This preview shows a sample of your data. The full conversion will process all rows.'
            }
          </p>
        </div>
      )}
    </div>
  );
}