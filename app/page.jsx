'use client';

import { useState, useEffect } from 'react';
import FileUploadComponent from '../components/FileUploadComponent.jsx';
import MultiFileUploadComponent from '../components/MultiFileUploadComponent.jsx';
import ColumnMappingComponent from '../components/ColumnMappingComponent.jsx';
import URLPatternComponent from '../components/URLPatternComponent.jsx';
import PreviewComponent from '../components/PreviewComponent.jsx';
import ConversionResultsComponent from '../components/ConversionResultsComponent.jsx';
import BatchResultsComponent from '../components/BatchResultsComponent.jsx';
import styles from "./page.module.css";

export default function Home() {
  const [processingMode, setProcessingMode] = useState('single'); // 'single' or 'batch'
  const [currentStep, setCurrentStep] = useState(1);
  const [fileData, setFileData] = useState(null);
  const [batchData, setBatchData] = useState(null);
  const [config, setConfig] = useState({
    columnMapping: {},
    urlPattern: '',
    environment: 'dev',
    grouping: 'none',
    includeLastmod: false,
    lastmodField: '',
    changefreq: '',
    priority: ''
  });
  const [previewData, setPreviewData] = useState(null);
  const [conversionResult, setConversionResult] = useState(null);

  // Effect to handle batch data changes
  useEffect(() => {
    if (processingMode === 'batch' && currentStep > 1 && (!batchData || !batchData.files || batchData.files.length === 0)) {
      setCurrentStep(1);
    }
  }, [batchData, processingMode, currentStep]);

  const singleSteps = [
    { id: 1, title: 'Upload File', component: 'upload' },
    { id: 2, title: 'Configure Mapping', component: 'mapping' },
    { id: 3, title: 'URL Pattern', component: 'pattern' },
    { id: 4, title: 'Preview', component: 'preview' },
    { id: 5, title: 'Convert', component: 'convert' }
  ];

  const batchSteps = [
    { id: 1, title: 'Upload Files', component: 'batch-upload' },
    { id: 2, title: 'Configure Mapping', component: 'batch-mapping' },
    { id: 3, title: 'URL Pattern', component: 'batch-pattern' },
    { id: 4, title: 'Preview', component: 'batch-preview' },
    { id: 5, title: 'Convert Batch', component: 'batch-convert' },
    { id: 6, title: 'Batch Results', component: 'batch-results' }
  ];

  const steps = processingMode === 'batch' ? batchSteps : singleSteps;

  // Single file handlers
  const handleFileUpload = (data) => {
    setFileData(data);
    setCurrentStep(2);
  };

  const handleMappingComplete = (mapping) => {
    setConfig(prev => ({ ...prev, columnMapping: mapping }));
    setCurrentStep(3);
  };

  const handlePatternComplete = (pattern) => {
    setConfig(prev => ({ ...prev, urlPattern: pattern }));
    setCurrentStep(4);
  };

  const handlePreviewComplete = (preview) => {
    setPreviewData(preview);
    setCurrentStep(5);
  };

  const handleConversionComplete = (result) => {
    setConversionResult(result);
  };

  // Batch processing handlers
  const handleBatchUpload = (batchResult) => {
    setBatchData(batchResult);
    setCurrentStep(2);
  };

  const handleBatchClear = () => {
    setBatchData(null);
    setConfig(prev => ({
      ...prev,
      columnMapping: {},
      urlPattern: ''
    }));
  };

  const handleBatchMappingComplete = (mapping) => {
    setConfig(prev => ({ ...prev, columnMapping: mapping }));
    setCurrentStep(3);
  };

  const handleBatchPatternComplete = (pattern) => {
    setConfig(prev => ({ ...prev, urlPattern: pattern }));
    setCurrentStep(4);
  };

  const handleBatchPreviewComplete = (preview) => {
    setPreviewData(preview);
    setCurrentStep(5); // Go to conversion step
  };

  const handleBatchConversionComplete = (result) => {
    setConversionResult(result);
    setCurrentStep(6); // Go to results
  };

  // Mode switching
  const switchMode = (mode) => {
    setProcessingMode(mode);
    setCurrentStep(1);
    setFileData(null);
    setBatchData(null);
    setPreviewData(null);
    setConversionResult(null);
  };

  // Download handlers for batch results
  const handleDownloadFile = async (batchId, fileId) => {
    try {
      const response = await fetch('/api/batch-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId, fileId })
      });
      
      const result = await response.json();
      if (result.success) {
        window.open(`/api/batch-download?token=${result.downloadToken}`, '_blank');
      }
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  const handleDownloadBatch = async (batchId) => {
    try {
      const response = await fetch('/api/batch-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId })
      });
      
      const result = await response.json();
      if (result.success) {
        window.open(`/api/batch-download?token=${result.downloadToken}`, '_blank');
      }
    } catch (error) {
      console.error('Batch download error:', error);
    }
  };

  const handleGenerateSitemaps = async (batchId) => {
    // This function is now handled internally by BatchResultsComponent
    // We just need to pass the config to the component
    console.log('Sitemap generation requested for batch:', batchId);
  };

  const renderCurrentStep = () => {
    if (processingMode === 'batch') {
      switch (currentStep) {
        case 1:
          return (
            <MultiFileUploadComponent 
              onFilesUpload={handleBatchUpload}
              onFilesClear={handleBatchClear}
            />
          );
        case 2:
          // If no batch data, return null (useEffect will handle redirect)
          if (!batchData || !batchData.files || batchData.files.length === 0) {
            return null;
          }
          
          return (
            <ColumnMappingComponent
              headers={batchData?.headers || ['url', 'title', 'description']}
              onMappingComplete={handleBatchMappingComplete}
              currentMapping={config.columnMapping}
            />
          );
        case 3:
          return (
            <URLPatternComponent
              onPatternComplete={handleBatchPatternComplete}
              availableColumns={batchData?.headers || []}
              currentPattern={config.urlPattern}
              columnMapping={config.columnMapping}
            />
          );
        case 4:
          return (
            <PreviewComponent
              fileId={batchData?.batchId}
              config={config}
              onPreviewComplete={handleBatchPreviewComplete}
              onConfigChange={(newConfig) => setConfig(prev => ({ ...prev, ...newConfig }))}
              isBatchMode={true}
              batchData={batchData}
            />
          );
        case 5:
          return (
            <ConversionResultsComponent
              fileId={batchData?.batchId}
              config={config}
              onConversionComplete={handleBatchConversionComplete}
              conversionResult={conversionResult}
              isBatchMode={true}
              batchData={batchData}
            />
          );
        case 6:
          return (
            <BatchResultsComponent
              batchId={batchData?.batchId}
              onDownloadFile={handleDownloadFile}
              onDownloadBatch={handleDownloadBatch}
              onGenerateSitemaps={handleGenerateSitemaps}
              sitemapConfig={config}
            />
          );
        default:
          return null;
      }
    } else {
      // Single file mode
      switch (currentStep) {
        case 1:
          return <FileUploadComponent onFileUpload={handleFileUpload} />;
        case 2:
          return (
            <ColumnMappingComponent
              headers={fileData?.headers || []}
              onMappingComplete={handleMappingComplete}
              currentMapping={config.columnMapping}
            />
          );
        case 3:
          return (
            <URLPatternComponent
              onPatternComplete={handlePatternComplete}
              availableColumns={fileData?.headers || []}
              currentPattern={config.urlPattern}
              columnMapping={config.columnMapping}
            />
          );
        case 4:
          return (
            <PreviewComponent
              fileId={fileData?.fileId}
              config={config}
              onPreviewComplete={handlePreviewComplete}
              onConfigChange={(newConfig) => setConfig(prev => ({ ...prev, ...newConfig }))}
            />
          );
        case 5:
          return (
            <ConversionResultsComponent
              fileId={fileData?.fileId}
              config={config}
              onConversionComplete={handleConversionComplete}
              conversionResult={conversionResult}
            />
          );
        default:
          return null;
      }
    }
  };

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.header}>
          <h1>File to JSON Converter</h1>
          <p>Convert CSV and Excel files to JSON format with URL processing</p>
          
          {/* Mode Selection */}
          <div className={styles.modeSelection}>
            <button
              onClick={() => switchMode('single')}
              className={`${styles.modeButton} ${processingMode === 'single' ? styles.active : ''}`}
            >
              📄 Single File Mode
            </button>
            <button
              onClick={() => switchMode('batch')}
              className={`${styles.modeButton} ${processingMode === 'batch' ? styles.active : ''}`}
            >
              📁 Batch Processing Mode
            </button>
          </div>
        </div>

        {/* Progress Steps */}
        <div className={styles.progressSteps}>
          {steps.map((step) => (
            <div
              key={step.id}
              className={`${styles.step} ${
                currentStep === step.id ? styles.active : ''
              } ${currentStep > step.id ? styles.completed : ''}`}
            >
              <div className={styles.stepNumber}>{step.id}</div>
              <div className={styles.stepTitle}>{step.title}</div>
            </div>
          ))}
        </div>

        {/* Feature Selection */}
        {currentStep === 1 && (
          <div className={styles.featureSelection}>
            <div className={styles.featureCard}>
              <h3>
                {processingMode === 'batch' ? 'Batch File Processing' : 'Single File Processing'}
              </h3>
              <p>
                {processingMode === 'batch' 
                  ? 'Upload and process multiple Excel/CSV files simultaneously'
                  : 'Convert individual CSV/Excel files to JSON format with URL processing'
                }
              </p>
              <div className={styles.featureActions}>
                {renderCurrentStep()}
              </div>
            </div>
            
            <div className={styles.featureCard}>
              <h3>JSON to Sitemap Converter</h3>
              <p>Convert JSON data to XML sitemap files for search engines</p>
              <div className={styles.featureActions}>
                <a href="/json-to-sitemap" className={styles.featureButton}>
                  Start JSON to Sitemap
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Current Step Content */}
        {currentStep > 1 && (
          <div className={styles.stepContent}>
            {renderCurrentStep()}
          </div>
        )}

        {/* Navigation */}
        {currentStep > 1 && (
          <div className={styles.navigation}>
            <button
              onClick={() => {
                if (processingMode === 'batch' && currentStep === 2) {
                  // Going back from batch mapping to upload - clear batch data
                  setBatchData(null);
                  setConfig(prev => ({
                    ...prev,
                    columnMapping: {},
                    urlPattern: ''
                  }));
                }
                setCurrentStep(currentStep - 1);
              }}
              className={styles.backButton}
            >
              Back
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
