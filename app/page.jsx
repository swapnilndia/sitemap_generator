'use client';

import { useState } from 'react';
import FileUploadComponent from '../components/FileUploadComponent.jsx';
import ColumnMappingComponent from '../components/ColumnMappingComponent.jsx';
import URLPatternComponent from '../components/URLPatternComponent.jsx';
import PreviewComponent from '../components/PreviewComponent.jsx';
import ConversionResultsComponent from '../components/ConversionResultsComponent.jsx';
import styles from "./page.module.css";

export default function Home() {
  const [currentStep, setCurrentStep] = useState(1);
  const [fileData, setFileData] = useState(null);
  const [config, setConfig] = useState({
    columnMapping: {},
    urlPattern: '',
    grouping: 'none',
    includeLastmod: false,
    lastmodField: '',
    changefreq: '',
    priority: ''
  });
  const [previewData, setPreviewData] = useState(null);
  const [conversionResult, setConversionResult] = useState(null);

  const steps = [
    { id: 1, title: 'Upload File', component: 'upload' },
    { id: 2, title: 'Configure Mapping', component: 'mapping' },
    { id: 3, title: 'URL Pattern', component: 'pattern' },
    { id: 4, title: 'Preview', component: 'preview' },
    { id: 5, title: 'Convert', component: 'convert' }
  ];

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

  const renderCurrentStep = () => {
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
  };

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.header}>
          <h1>File to JSON Converter</h1>
          <p>Convert CSV and Excel files to JSON format with URL processing</p>
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
              <h3>File to JSON Converter</h3>
              <p>Convert CSV/Excel files to JSON format with URL processing</p>
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
              onClick={() => setCurrentStep(currentStep - 1)}
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
