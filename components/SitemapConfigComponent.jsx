'use client';

import { useState, useEffect } from 'react';
import styles from './SitemapConfigComponent.module.css';

export default function SitemapConfigComponent({ 
  jsonData, 
  onConfigComplete, 
  currentConfig 
}) {
  const [config, setConfig] = useState({
    maxPerFile: currentConfig.maxPerFile || 50000,
    grouping: currentConfig.grouping || 'auto',
    ...currentConfig
  });

  const handleConfigChange = (key, value) => {
    setConfig(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleContinue = () => {
    onConfigComplete(config);
  };

  const formatNumber = (num) => {
    return num.toLocaleString();
  };

  return (
    <div className={styles.container}>
      <h2>Configure Sitemap Generation</h2>
      <p>Set up how your JSON data should be converted to XML sitemaps</p>

      {/* JSON Data Summary */}
      <div className={styles.summarySection}>
        <h3>JSON Data Summary</h3>
        <div className={styles.summaryGrid}>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Total Valid URLs:</span>
            <span className={styles.summaryValue}>
              {formatNumber(jsonData.totalValidUrls)}
            </span>
          </div>
          
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Groups Found:</span>
            <span className={styles.summaryValue}>
              {Object.keys(jsonData.groups || {}).length}
            </span>
          </div>
          
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>Has Grouping:</span>
            <span className={styles.summaryValue}>
              {jsonData.hasGrouping ? 'Yes' : 'No'}
            </span>
          </div>
        </div>

        {jsonData.groups && Object.keys(jsonData.groups).length > 0 && (
          <div className={styles.groupsSection}>
            <h4>Groups in your data:</h4>
            <div className={styles.groupsList}>
              {Object.entries(jsonData.groups).map(([group, count]) => (
                <div key={group} className={styles.groupItem}>
                  <span className={styles.groupName}>{group}</span>
                  <span className={styles.groupCount}>{formatNumber(count)} URLs</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Configuration Options */}
      <div className={styles.configSection}>
        <h3>Sitemap Configuration</h3>
        
        <div className={styles.configOption}>
          <label className={styles.configLabel}>
            Maximum URLs per Sitemap File:
            <input
              type="number"
              min="1"
              max="50000"
              value={config.maxPerFile}
              onChange={(e) => handleConfigChange('maxPerFile', parseInt(e.target.value))}
              className={styles.numberInput}
            />
          </label>
          <p className={styles.configDescription}>
            Search engines recommend maximum 50,000 URLs per sitemap file. 
            Large datasets will be split into multiple files with a sitemap index.
          </p>
        </div>

        <div className={styles.configOption}>
          <label className={styles.configLabel}>
            Grouping Strategy:
            <select
              value={config.grouping}
              onChange={(e) => handleConfigChange('grouping', e.target.value)}
              className={styles.select}
            >
              <option value="auto">Auto (preserve existing groups)</option>
              <option value="none">No grouping (single sitemap)</option>
              {jsonData.hasGrouping && (
                <option value="preserve">Preserve groups (separate files)</option>
              )}
            </select>
          </label>
          <p className={styles.configDescription}>
            Choose how to handle URL grouping in the generated sitemaps.
          </p>
        </div>
      </div>

      {/* Estimated Output */}
      <div className={styles.estimateSection}>
        <h3>Estimated Output</h3>
        <div className={styles.estimateGrid}>
          <div className={styles.estimateItem}>
            <div className={styles.estimateValue}>
              {Math.ceil(jsonData.totalValidUrls / config.maxPerFile)}
            </div>
            <div className={styles.estimateLabel}>Sitemap Files</div>
          </div>
          
          <div className={styles.estimateItem}>
            <div className={styles.estimateValue}>
              {Math.ceil(jsonData.totalValidUrls / config.maxPerFile) > 1 ? 'Yes' : 'No'}
            </div>
            <div className={styles.estimateLabel}>Sitemap Index</div>
          </div>
          
          <div className={styles.estimateItem}>
            <div className={styles.estimateValue}>
              {config.grouping === 'preserve' && jsonData.hasGrouping ? 
                Object.keys(jsonData.groups).length : 1}
            </div>
            <div className={styles.estimateLabel}>Group Files</div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        <button
          onClick={handleContinue}
          className={styles.continueButton}
        >
          Continue to Preview
        </button>
      </div>

      {/* Tips */}
      <div className={styles.tips}>
        <h4>💡 Tips:</h4>
        <ul>
          <li>Keep sitemap files under 50,000 URLs for optimal search engine processing</li>
          <li>Use grouping to organize URLs by category or content type</li>
          <li>Sitemap index files are automatically created for multiple sitemaps</li>
          <li>All generated files will be valid XML format</li>
        </ul>
      </div>
    </div>
  );
}