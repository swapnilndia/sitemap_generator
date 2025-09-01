'use client';

import { useState, useEffect } from 'react';
import { 
  getEnvironments, 
  getEnvironment, 
  generateUrlPattern,
  DEFAULT_ENVIRONMENT 
} from '../lib/environments.js';
import { 
  getSelectedEnvironment, 
  setSelectedEnvironment,
  setIsCustomPattern 
} from '../lib/sessionStorage.js';
import styles from './EnvironmentSelector.module.css';

export default function EnvironmentSelector({ 
  onEnvironmentChange, 
  selectedEnvironment: propSelectedEnvironment,
  urlPattern,
  onUrlPatternChange,
  pathPattern = '{URL}'
}) {
  const [selectedEnvironment, setSelectedEnvironmentState] = useState(DEFAULT_ENVIRONMENT);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [environments] = useState(getEnvironments());

  // Initialize selected environment from props or session storage
  useEffect(() => {
    const initialEnvironment = propSelectedEnvironment || getSelectedEnvironment();
    setSelectedEnvironmentState(initialEnvironment);
    
    // Notify parent component of initial environment
    if (onEnvironmentChange && !propSelectedEnvironment) {
      onEnvironmentChange(initialEnvironment);
    }
  }, [propSelectedEnvironment, onEnvironmentChange]);

  // Handle environment selection
  const handleEnvironmentSelect = (environmentId) => {
    setSelectedEnvironmentState(environmentId);
    setIsDropdownOpen(false);
    
    // Store in session storage
    setSelectedEnvironment(environmentId);
    setIsCustomPattern(false);
    
    // Generate new URL pattern
    const newUrlPattern = generateUrlPattern(environmentId, pathPattern);
    
    // Notify parent components
    if (onEnvironmentChange) {
      onEnvironmentChange(environmentId);
    }
    
    if (onUrlPatternChange) {
      onUrlPatternChange(newUrlPattern);
    }
  };

  // Get current environment details
  const currentEnvironment = getEnvironment(selectedEnvironment);
  
  // Generate preview URL pattern
  const previewPattern = generateUrlPattern(selectedEnvironment, pathPattern);

  return (
    <div className={styles.container}>
      <div className={styles.field}>
        <label htmlFor="environment-selector" className={styles.label}>
          Environment
        </label>
        <div className={styles.dropdownContainer}>
          <button
            id="environment-selector"
            type="button"
            className={`${styles.dropdownButton} ${isDropdownOpen ? styles.open : ''}`}
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            aria-haspopup="listbox"
            aria-expanded={isDropdownOpen}
            aria-label={`Selected environment: ${currentEnvironment?.name || 'Unknown'}`}
          >
            <div className={styles.selectedOption}>
              <span className={styles.environmentName}>
                {currentEnvironment?.name || 'Select Environment'}
              </span>
              <span className={styles.environmentUrl}>
                {currentEnvironment?.baseUrl}
              </span>
            </div>
            <svg 
              className={`${styles.chevron} ${isDropdownOpen ? styles.rotated : ''}`}
              width="20" 
              height="20" 
              viewBox="0 0 20 20" 
              fill="none"
              aria-hidden="true"
            >
              <path 
                d="M5 7.5L10 12.5L15 7.5" 
                stroke="currentColor" 
                strokeWidth="1.5" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
            </svg>
          </button>
          
          {isDropdownOpen && (
            <div className={styles.dropdownMenu} role="listbox">
              {environments.map((environment) => (
                <button
                  key={environment.id}
                  type="button"
                  className={`${styles.dropdownOption} ${
                    selectedEnvironment === environment.id ? styles.selected : ''
                  }`}
                  onClick={() => handleEnvironmentSelect(environment.id)}
                  role="option"
                  aria-selected={selectedEnvironment === environment.id}
                >
                  <div className={styles.optionContent}>
                    <span className={styles.optionName}>
                      {environment.name}
                    </span>
                    <span className={styles.optionUrl}>
                      {environment.baseUrl}
                    </span>
                    <span className={styles.optionDescription}>
                      {environment.description}
                    </span>
                  </div>
                  {selectedEnvironment === environment.id && (
                    <svg 
                      className={styles.checkIcon}
                      width="16" 
                      height="16" 
                      viewBox="0 0 16 16" 
                      fill="none"
                      aria-hidden="true"
                    >
                      <path 
                        d="M13.5 4.5L6 12L2.5 8.5" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* URL Pattern Preview */}
      <div className={styles.previewContainer}>
        <label className={styles.previewLabel}>
          Generated URL Pattern
        </label>
        <div className={styles.previewBox}>
          <code className={styles.previewCode}>
            {previewPattern}
          </code>
        </div>
        <p className={styles.previewHelp}>
          URLs will be generated using this pattern. The <code>{pathPattern}</code> placeholder 
          will be replaced with values from your data.
        </p>
      </div>
    </div>
  );
}

// Close dropdown when clicking outside
if (typeof window !== 'undefined') {
  document.addEventListener('click', (event) => {
    const dropdowns = document.querySelectorAll(`.${styles.dropdownContainer}`);
    dropdowns.forEach(dropdown => {
      if (!dropdown.contains(event.target)) {
        const button = dropdown.querySelector(`.${styles.dropdownButton}`);
        if (button && button.getAttribute('aria-expanded') === 'true') {
          button.click();
        }
      }
    });
  });
}