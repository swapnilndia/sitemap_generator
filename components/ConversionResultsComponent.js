'use client';

import { useState, useEffect } from 'react';
import HomeButton from './HomeButton';
import styles from './ConversionResultsComponent.module.css';

export default function ConversionResultsComponent({ 
  fileId, 
  config, 
  onConversionComplete, 
  conversionResult 
}) {
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(conversionResult);
  const [downloadUrl, setDownloadUrl] = useState('');

  useEffect(() => {
    if (!result && fileId && config) {
      startConversion();
    }
  }, [fileId, config]);

  const startConversion = async () => {
    setIsConverting(true);
    setError('');

    try {
      const response = await fetch('/api/convert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileId,
          config
        }),
      });

      const conversionResult = await response.json();

      if (conversionResult.success) {
        setResult(conversionResult);
        setDownloadUrl(`/api/download/${conversionResult.conversionId}`);
        onConversionComplete(conversionResult);
      } else {
        setError(conversionResult.error || 'Conversion failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Conversion error:', err);
    } finally {
      setIsConverting(false);
    }
  };

  const handleDownload = () => {
    if (downloadUrl) {
      window.open(downloadUrl, '_blank');
    }
  };

  const handleStartOver = () => {
    window.location.reload();
  };

  const handleContinueToSitemap = () => {
    // Store the conversion result in sessionStorage for seamless transition
    if (result && result.conversionId) {
      sessionStorage.setItem('conversionData', JSON.stringify({
        conversionId: result.conversionId,
        fileName: `sitemap_${result.conversionId}`,
        statistics: result.statistics,
        metadata: result.metadata
      }));
      
      // Navigate to sitemap generation
      window.location.href = '/json-to-sitemap?from=conversion';
    }
  };

  const handleGoHome = () => {
    window.location.href = '/';
  };

  const formatNumber = (num) => {
    if (num === undefined || num === null || isNaN(num)) return '0';
    return Number(num).toLocaleString();
  };

  const formatPercentage = (value, total) => {
    if (total === 0) return '0%';
    return `${Math.round((value / total) * 100)}%`;
  };

  const getSuccessRate = () => {
    if (!result?.statistics) return 0;
    const { validUrls, totalUrls } = result.statistics;
    return totalUrls > 0 ? Math.round((validUrls / totalUrls) * 100) : 0;
  };

  return (
    <div className={styles.container}>
      <h2>Conversion Results</h2>
      
      {/* Converting State */}
      {isConverting && (
        <div className={styles.convertingState}>
          <div className={styles.spinner}></div>
          <h3>Converting Your File...</h3>
          <p>Processing all rows and generating JSON output. This may take a moment for large files.</p>
          <div className={styles.progressBar}>
            <div className={styles.progressFill}></div>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className={styles.errorState}>
          <div className={styles.errorIcon}>❌</div>
          <h3>Conversion Failed</h3>
          <p>{error}</p>
          <button onClick={startConversion} className={styles.retryButton}>
            Try Again
          </button>
        </div>
      )}

      {/* Success State */}
      {result && !isConverting && !error && (
        <div className={styles.successState}>
          <div className={styles.successIcon}>✅</div>
          <h3>Conversion Completed Successfully!</h3>
          
          {/* Summary Statistics */}
          <div className={styles.summarySection}>
            <div className={styles.summaryCard}>
              <div className={styles.successRate}>
                <div className={styles.rateCircle}>
                  <span className={styles.rateValue}>{getSuccessRate()}%</span>
                </div>
                <div className={styles.rateLabel}>Success Rate</div>
              </div>
            </div>
          </div>

          {/* Detailed Statistics */}
          <div className={styles.statisticsSection}>
            <h4>Detailed Statistics</h4>
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={styles.statValue}>
                  {formatNumber(result.statistics.totalUrls)}
                </div>
                <div className={styles.statLabel}>Total URLs Processed</div>
              </div>
              
              <div className={styles.statCard}>
                <div className={styles.statValue}>
                  {formatNumber(result.statistics.validUrls)}
                </div>
                <div className={styles.statLabel}>Valid URLs Generated</div>
                <div className={styles.statPercentage}>
                  {formatPercentage(result.statistics.validUrls, result.statistics.totalUrls)}
                </div>
              </div>
              
              <div className={styles.statCard}>
                <div className={styles.statValue}>
                  {formatNumber(result.statistics.excludedUrls)}
                </div>
                <div className={styles.statLabel}>URLs Excluded</div>
                <div className={styles.statPercentage}>
                  {formatPercentage(result.statistics.excludedUrls, result.statistics.totalUrls)}
                </div>
              </div>
              
              <div className={styles.statCard}>
                <div className={styles.statValue}>
                  {formatNumber(result.statistics.duplicateUrls)}
                </div>
                <div className={styles.statLabel}>Duplicate URLs Removed</div>
                <div className={styles.statPercentage}>
                  {formatPercentage(result.statistics.duplicateUrls, result.statistics.totalUrls)}
                </div>
              </div>

              {result.statistics.invalidLastmod > 0 && (
                <div className={styles.statCard}>
                  <div className={styles.statValue}>
                    {formatNumber(result.statistics.invalidLastmod)}
                  </div>
                  <div className={styles.statLabel}>Invalid Lastmod Dates</div>
                  <div className={styles.statPercentage}>
                    {formatPercentage(result.statistics.invalidLastmod, result.statistics.totalUrls)}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Configuration Summary */}
          <div className={styles.configSection}>
            <h4>Configuration Used</h4>
            <div className={styles.configGrid}>
              <div className={styles.configItem}>
                <span className={styles.configLabel}>URL Pattern:</span>
                <code className={styles.configValue}>{result.metadata.urlPattern}</code>
              </div>
              
              <div className={styles.configItem}>
                <span className={styles.configLabel}>Grouping:</span>
                <span className={styles.configValue}>
                  {result.metadata.grouping === 'none' ? 'No Grouping' : 
                   result.metadata.grouping === 'category' ? 'By Category' :
                   result.metadata.grouping === 'store_id' ? 'By Store ID' : 
                   result.metadata.grouping}
                </span>
              </div>
              
              <div className={styles.configItem}>
                <span className={styles.configLabel}>Include Lastmod:</span>
                <span className={styles.configValue}>
                  {result.metadata.includeLastmod ? 'Yes' : 'No'}
                </span>
              </div>
              
              {result.metadata.changefreq && (
                <div className={styles.configItem}>
                  <span className={styles.configLabel}>Change Frequency:</span>
                  <span className={styles.configValue}>{result.metadata.changefreq}</span>
                </div>
              )}
              
              {result.metadata.priority && (
                <div className={styles.configItem}>
                  <span className={styles.configLabel}>Priority:</span>
                  <span className={styles.configValue}>{result.metadata.priority}</span>
                </div>
              )}
            </div>
          </div>

          {/* Action Options Section */}
          <div className={styles.actionOptionsSection}>
            <h4>What would you like to do next?</h4>
            <p>Choose how to proceed with your converted data</p>
            
            <div className={styles.actionGrid}>
              <div className={styles.actionCard}>
                <div className={styles.actionIcon}>📥</div>
                <h5>Download JSON File</h5>
                <p>Download the converted JSON data for later use or external processing</p>
                <button 
                  onClick={handleDownload}
                  className={styles.downloadButton}
                  disabled={!downloadUrl}
                >
                  Download JSON
                </button>
              </div>
              
              <div className={styles.actionCard}>
                <div className={styles.actionIcon}>🗺️</div>
                <h5>Generate Sitemap Files</h5>
                <p>Continue to create XML sitemap files directly from this data</p>
                <button 
                  onClick={handleContinueToSitemap}
                  className={styles.sitemapButton}
                >
                  Create Sitemaps
                </button>
              </div>
            </div>
            
            <div className={styles.downloadInfo}>
              <p>File contains {formatNumber(result.statistics.validUrls)} valid URL entries</p>
              <p>Generated on {new Date(result.metadata.processedAt).toLocaleString()}</p>
            </div>
            
            <div className={styles.homeButtonContainer}>
              <HomeButton />
            </div>
          </div>

          {/* Next Steps */}
          <div className={styles.nextStepsSection}>
            <h4>What's Next?</h4>
            <div className={styles.nextStepsList}>
              <div className={styles.nextStep}>
                <span className={styles.stepIcon}>🔍</span>
                <div className={styles.stepContent}>
                  <h5>Review Your Data</h5>
                  <p>Open the JSON file to inspect the converted data and verify accuracy</p>
                </div>
              </div>
              
              <div className={styles.nextStep}>
                <span className={styles.stepIcon}>🗺️</span>
                <div className={styles.stepContent}>
                  <h5>Generate Sitemaps</h5>
                  <p>Use the JSON data to create XML sitemaps for search engines</p>
                </div>
              </div>
              
              <div className={styles.nextStep}>
                <span className={styles.stepIcon}>🔄</span>
                <div className={styles.stepContent}>
                  <h5>Process Another File</h5>
                  <p>Convert additional files using the same or different configurations</p>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className={styles.actions}>
            <button onClick={handleStartOver} className={styles.startOverButton}>
              Process Another File
            </button>
            <button onClick={handleGoHome} className={styles.homeButton}>
              Return to Home
            </button>
          </div>
        </div>
      )}
    </div>
  );
}