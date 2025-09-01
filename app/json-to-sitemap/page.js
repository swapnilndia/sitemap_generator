'use client';

import { useState, useEffect } from 'react';
import JsonUploadComponent from '../../components/JsonUploadComponent';
import SitemapConfigComponent from '../../components/SitemapConfigComponent';
import SitemapPreviewComponent from '../../components/SitemapPreviewComponent';
import SitemapGenerationComponent from '../../components/SitemapGenerationComponent';
import HomeButton from '../../components/HomeButton';
import styles from './page.module.css';

export default function JsonToSitemap() {
  const [currentStep, setCurrentStep] = useState(1);
  const [jsonData, setJsonData] = useState(null);
  const [config, setConfig] = useState({
    maxPerFile: 50000,
    grouping: 'auto' // auto, none, or specific group field
  });
  const [previewData, setPreviewData] = useState(null);
  const [generationResult, setGenerationResult] = useState(null);
  const [isLoadingFromConversion, setIsLoadingFromConversion] = useState(false);

  const steps = [
    { id: 1, title: 'Upload JSON', component: 'upload' },
    { id: 2, title: 'Configure', component: 'config' },
    { id: 3, title: 'Preview', component: 'preview' },
    { id: 4, title: 'Generate', component: 'generate' }
  ];

  // Check if coming from conversion process
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const fromConversion = urlParams.get('from') === 'conversion';
    
    if (fromConversion) {
      const conversionData = sessionStorage.getItem('conversionData');
      if (conversionData) {
        loadFromConversion(JSON.parse(conversionData));
      }
    }
  }, []);

  const loadFromConversion = async (conversionData) => {
    setIsLoadingFromConversion(true);
    
    try {
      const response = await fetch(`/api/conversion-data/${conversionData.conversionId}`);
      const result = await response.json();
      
      if (result.success) {
        // Set up the data as if it was uploaded
        setJsonData({
          fileId: conversionData.conversionId, // Use the conversionId directly
          fileName: conversionData.fileName,
          totalValidUrls: result.totalValidUrls,
          hasGrouping: result.hasGrouping,
          groups: result.groups,
          metadata: result.jsonData.metadata,
          statistics: result.jsonData.statistics
        });
        
        // Store the JSON data for processing - this is client-side, we need to handle it differently
        // The data will be accessed via the conversion-data API route
        
        // Skip to configuration step
        setCurrentStep(2);
        
        // Clear session storage
        sessionStorage.removeItem('conversionData');
      } else {
        console.error('Failed to load conversion data:', result.error);
        // Fall back to normal upload flow
      }
    } catch (error) {
      console.error('Error loading conversion data:', error);
      // Fall back to normal upload flow
    } finally {
      setIsLoadingFromConversion(false);
    }
  };

  const handleJsonUpload = (data) => {
    setJsonData(data);
    setCurrentStep(2);
  };

  const handleConfigComplete = (newConfig) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
    setCurrentStep(3);
  };

  const handlePreviewComplete = (preview) => {
    setPreviewData(preview);
    setCurrentStep(4);
  };

  const handleGenerationComplete = (result) => {
    setGenerationResult(result);
  };

  const renderCurrentStep = () => {
    if (isLoadingFromConversion) {
      return (
        <div className={styles.loadingState}>
          <div className={styles.spinner}></div>
          <h3>Loading your conversion data...</h3>
          <p>Setting up sitemap generation from your converted file</p>
        </div>
      );
    }

    switch (currentStep) {
      case 1:
        return <JsonUploadComponent onJsonUpload={handleJsonUpload} />;
      case 2:
        return (
          <SitemapConfigComponent
            jsonData={jsonData}
            onConfigComplete={handleConfigComplete}
            currentConfig={config}
          />
        );
      case 3:
        return (
          <SitemapPreviewComponent
            fileId={jsonData?.fileId}
            config={config}
            onPreviewComplete={handlePreviewComplete}
            onConfigChange={(newConfig) => setConfig(prev => ({ ...prev, ...newConfig }))}
          />
        );
      case 4:
        return (
          <SitemapGenerationComponent
            fileId={jsonData?.fileId}
            config={config}
            onGenerationComplete={handleGenerationComplete}
            generationResult={generationResult}
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
          <div className={styles.headerContent}>
            <h1>JSON to Sitemap Converter</h1>
            <p>Convert JSON data to XML sitemap files for search engines</p>
          </div>
          <div className={styles.headerActions}>
            <HomeButton showConfirm={false} />
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

        {/* Current Step Content */}
        <div className={styles.stepContent}>
          {renderCurrentStep()}
        </div>

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