'use client';

import { useState, useEffect } from 'react';
import styles from './SitemapGenerationComponent.module.css';

export default function SitemapGenerationComponent({ 
  fileId, 
  config, 
  onGenerationComplete, 
  generationResult 
}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(generationResult);
  const [downloadUrls, setDownloadUrls] = useState({});

  useEffect(() => {
    if (!result && fileId && config) {
      startGeneration();
    }
  }, [fileId, config]);

  const startGeneration = async () => {
    setIsGenerating(true);
    setError('');

    try {
      const response = await fetch('/api/generate-sitemap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileId,
          config
        }),
      });

      const generationResult = await response.json();

      if (generationResult.success) {
        setResult(generationResult);
        
        // Set up download URLs
        const urls = {
          zip: `/api/download-sitemap/${generationResult.generationId}?type=zip`,
        };
        
        if (generationResult.hasIndex) {
          urls.index = `/api/download-sitemap/${generationResult.generationId}?type=single&filename=sitemap_index.xml`;
        }
        
        setDownloadUrls(urls);
        onGenerationComplete(generationResult);
      } else {
        setError(generationResult.error || 'Generation failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Generation error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = (type) => {
    const url = downloadUrls[type];
    if (url) {
      window.open(url, '_blank');
    }
  };

  const handleStartOver = () => {
    window.location.href = '/json-to-sitemap';
  };

  const handleGoHome = () => {
    window.location.href = '/';
  };

  const formatNumber = (num) => {
    return num.toLocaleString();
  };

  return (
    <div className={styles.container}>
      <h2>Sitemap Generation</h2>
      
      {/* Generating State */}
      {isGenerating && (
        <div className={styles.generatingState}>
          <div className={styles.spinner}></div>
          <h3>Generating Your Sitemaps...</h3>
          <p>Creating XML files and packaging them for download. This may take a moment for large datasets.</p>
          <div className={styles.progressBar}>
            <div className={styles.progressFill}></div>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className={styles.errorState}>
          <div className={styles.errorIcon}>❌</div>
          <h3>Generation Failed</h3>
          <p>{error}</p>
          <button onClick={startGeneration} className={styles.retryButton}>
            Try Again
          </button>
        </div>
      )}

      {/* Success State */}
      {result && !isGenerating && !error && (
        <div className={styles.successState}>
          <div className={styles.successIcon}>✅</div>
          <h3>Sitemaps Generated Successfully!</h3>
          
          {/* Summary Statistics */}
          <div className={styles.summarySection}>
            <div className={styles.summaryCard}>
              <div className={styles.successRate}>
                <div className={styles.rateCircle}>
                  <span className={styles.rateValue}>{result.totalFiles}</span>
                </div>
                <div className={styles.rateLabel}>Files Generated</div>
              </div>
            </div>
          </div>

          {/* Detailed Statistics */}
          <div className={styles.statisticsSection}>
            <h4>Generation Summary</h4>
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={styles.statValue}>
                  {formatNumber(result.statistics.totalUrls)}
                </div>
                <div className={styles.statLabel}>Total URLs</div>
              </div>
              
              <div className={styles.statCard}>
                <div className={styles.statValue}>
                  {result.statistics.filesGenerated}
                </div>
                <div className={styles.statLabel}>Sitemap Files</div>
              </div>
              
              <div className={styles.statCard}>
                <div className={styles.statValue}>
                  {result.statistics.hasIndex ? 'Yes' : 'No'}
                </div>
                <div className={styles.statLabel}>Index File</div>
              </div>
              
              <div className={styles.statCard}>
                <div className={styles.statValue}>XML</div>
                <div className={styles.statLabel}>Format</div>
              </div>
            </div>
          </div>

          {/* Download Section */}
          <div className={styles.downloadSection}>
            <h4>Download Your Sitemap Files</h4>
            <p>Your XML sitemap files are ready for download and use.</p>
            
            <div className={styles.downloadActions}>
              <button 
                onClick={() => handleDownload('zip')}
                className={styles.downloadButton}
                disabled={!downloadUrls.zip}
              >
                📦 Download All Files (ZIP)
              </button>
              
              {result.hasIndex && (
                <button 
                  onClick={() => handleDownload('index')}
                  className={styles.downloadButtonSecondary}
                  disabled={!downloadUrls.index}
                >
                  📋 Download Sitemap Index
                </button>
              )}
            </div>
            
            <div className={styles.downloadInfo}>
              <p>ZIP contains {result.totalFiles} sitemap file{result.totalFiles > 1 ? 's' : ''}</p>
              {result.hasIndex && <p>Sitemap index references all generated files</p>}
            </div>
          </div>

          {/* Usage Instructions */}
          <div className={styles.instructionsSection}>
            <h4>How to Use Your Sitemaps</h4>
            <div className={styles.instructionsList}>
              <div className={styles.instruction}>
                <span className={styles.stepNumber}>1</span>
                <div className={styles.stepContent}>
                  <h5>Upload to Your Website</h5>
                  <p>Place the sitemap files in your website's root directory (e.g., yoursite.com/sitemap.xml)</p>
                </div>
              </div>
              
              <div className={styles.instruction}>
                <span className={styles.stepNumber}>2</span>
                <div className={styles.stepContent}>
                  <h5>Submit to Search Engines</h5>
                  <p>Submit your sitemap URL to Google Search Console, Bing Webmaster Tools, and other search engines</p>
                </div>
              </div>
              
              <div className={styles.instruction}>
                <span className={styles.stepNumber}>3</span>
                <div className={styles.stepContent}>
                  <h5>Update robots.txt</h5>
                  <p>Add "Sitemap: https://yoursite.com/sitemap.xml" to your robots.txt file</p>
                </div>
              </div>
              
              <div className={styles.instruction}>
                <span className={styles.stepNumber}>4</span>
                <div className={styles.stepContent}>
                  <h5>Monitor Performance</h5>
                  <p>Check search console regularly to monitor indexing status and any issues</p>
                </div>
              </div>
            </div>
          </div>

          {/* File Details */}
          <div className={styles.detailsSection}>
            <h4>File Details</h4>
            <div className={styles.detailsList}>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Format:</span>
                <span className={styles.detailValue}>XML (Sitemap Protocol 0.9)</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Encoding:</span>
                <span className={styles.detailValue}>UTF-8</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Compression:</span>
                <span className={styles.detailValue}>ZIP Archive</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Generated:</span>
                <span className={styles.detailValue}>{new Date().toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className={styles.actions}>
            <button onClick={handleStartOver} className={styles.startOverButton}>
              Generate Another Sitemap
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