'use client';

import { useState, useEffect } from 'react';
import EnvironmentSelector from './EnvironmentSelector';
import { generateUrlPattern } from '../lib/environments.js';
import { setStoredUrlPattern, setIsCustomPattern, getSelectedEnvironment } from '../lib/sessionStorage.js';
import styles from './URLPatternComponent.module.css';

export default function URLPatternComponent({ 
  onPatternComplete, 
  availableColumns, 
  currentPattern, 
  columnMapping 
}) {
  const [urlPattern, setUrlPattern] = useState(currentPattern || '');
  const [selectedEnvironment, setSelectedEnvironment] = useState(getSelectedEnvironment());
  const [isCustomPattern, setIsCustomPatternState] = useState(false);
  const [errors, setErrors] = useState([]);
  const [isValid, setIsValid] = useState(false);
  const [placeholders, setPlaceholders] = useState([]);
  const [exampleUrls, setExampleUrls] = useState([]);

  // Generate common patterns based on selected environment
  const getCommonPatterns = () => {
    const basePattern = generateUrlPattern(selectedEnvironment, '');
    return [
      {
        name: 'Simple Product URL',
        pattern: `${basePattern}/products/{link}`,
        description: 'Basic product page URL'
      },
      {
        name: 'Category + Product',
        pattern: `${basePattern}/{category}/{link}`,
        description: 'URL with category path'
      },
      {
        name: 'Store + Category + Product',
        pattern: `${basePattern}/store/{store_id}/{category}/{link}`,
        description: 'Multi-level URL structure'
      },
      {
        name: 'Custom Path',
        pattern: `${basePattern}/{link}`,
        description: 'Direct path from base URL'
      }
    ];
  };

  useEffect(() => {
    validatePattern();
    extractPlaceholders();
    generateExampleUrls();
  }, [urlPattern, columnMapping]);

  const extractPlaceholders = () => {
    const matches = urlPattern.match(/\{([^}]+)\}/g) || [];
    const extractedPlaceholders = matches.map(match => match.slice(1, -1));
    setPlaceholders(extractedPlaceholders);
  };

  const validatePattern = () => {
    const newErrors = [];
    let valid = true;

    // Check if pattern is provided
    if (!urlPattern.trim()) {
      newErrors.push('URL pattern is required');
      valid = false;
    } else {
      // Check for valid URL format
      if (!urlPattern.includes('://')) {
        newErrors.push('URL pattern must include protocol (http:// or https://)');
        valid = false;
      }

      // Extract placeholders
      const matches = urlPattern.match(/\{([^}]+)\}/g) || [];
      const extractedPlaceholders = matches.map(match => match.slice(1, -1));

      // Check if link placeholder exists
      const hasLinkPlaceholder = extractedPlaceholders.includes('link') || 
        extractedPlaceholders.some(placeholder => 
          columnMapping[placeholder] === columnMapping.link
        );

      if (!hasLinkPlaceholder && !extractedPlaceholders.includes(columnMapping.link)) {
        newErrors.push('URL pattern must include {link} placeholder or reference the mapped link column');
        valid = false;
      }

      // Check if all placeholders can be resolved
      const availableMappings = Object.keys(columnMapping).filter(key => columnMapping[key]);
      const availableColumns = Object.values(columnMapping).filter(Boolean);
      
      const unresolvedPlaceholders = extractedPlaceholders.filter(placeholder => {
        // Check if it's a direct column mapping key
        if (availableMappings.includes(placeholder)) return false;
        // Check if it's a direct column name
        if (availableColumns.includes(placeholder)) return false;
        // Check if it's the special 'link' placeholder
        if (placeholder === 'link' && columnMapping.link) return false;
        return true;
      });

      if (unresolvedPlaceholders.length > 0) {
        newErrors.push(`Cannot resolve placeholders: {${unresolvedPlaceholders.join('}, {')}}`);
        valid = false;
      }
    }

    setErrors(newErrors);
    setIsValid(valid);
  };

  const generateExampleUrls = () => {
    if (!urlPattern || !isValid) {
      setExampleUrls([]);
      return;
    }

    const examples = [];
    const sampleData = [
      { link: 'product-123', category: 'electronics', store_id: 'store1' },
      { link: 'item-456', category: 'clothing', store_id: 'store2' },
      { link: 'gadget-789', category: 'accessories', store_id: 'store1' }
    ];

    sampleData.forEach((data, index) => {
      let exampleUrl = urlPattern;
      const matches = urlPattern.match(/\{([^}]+)\}/g) || [];
      
      matches.forEach(placeholder => {
        const fieldName = placeholder.slice(1, -1);
        let value = '';
        
        if (fieldName === 'link') {
          value = data[columnMapping.link] || data.link || 'sample-product';
        } else if (columnMapping[fieldName]) {
          value = data[columnMapping[fieldName]] || data[fieldName] || `sample-${fieldName}`;
        } else {
          value = data[fieldName] || `sample-${fieldName}`;
        }
        
        exampleUrl = exampleUrl.replace(placeholder, value);
      });
      
      examples.push(exampleUrl);
    });

    setExampleUrls(examples.slice(0, 3));
  };

  const handlePatternChange = (e) => {
    setUrlPattern(e.target.value);
  };

  const handlePatternSelect = (pattern) => {
    setUrlPattern(pattern);
  };

  const handleContinue = () => {
    if (isValid) {
      onPatternComplete(urlPattern);
    }
  };

  const insertPlaceholder = (placeholder) => {
    const textarea = document.getElementById('urlPatternInput');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newPattern = urlPattern.substring(0, start) + `{${placeholder}}` + urlPattern.substring(end);
    setUrlPattern(newPattern);
    
    // Restore cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + placeholder.length + 2, start + placeholder.length + 2);
    }, 0);
  };

  return (
    <div className={styles.container}>
      <h2>Configure URL Pattern</h2>
      <p>Define how your data should be converted into URLs using placeholders</p>

      <div className={styles.patternSection}>
        <h3>URL Pattern:</h3>
        <div className={styles.inputWrapper}>
          <textarea
            id="urlPatternInput"
            value={urlPattern}
            onChange={handlePatternChange}
            placeholder="https://example.com/products/{link}"
            className={`${styles.patternInput} ${errors.length > 0 ? styles.error : ''}`}
            rows={3}
          />
          
          {errors.length > 0 && (
            <div className={styles.errorMessages}>
              {errors.map((error, index) => (
                <div key={index} className={styles.errorMessage}>
                  ⚠️ {error}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={styles.placeholderSection}>
        <h3>Available Placeholders:</h3>
        <p>Click to insert into your URL pattern</p>
        <div className={styles.placeholderList}>
          <button
            onClick={() => insertPlaceholder('link')}
            className={styles.placeholderButton}
            title="Insert link placeholder"
          >
            {'{link}'}
          </button>
          
          {Object.entries(columnMapping)
            .filter(([key, value]) => key !== 'link' && value)
            .map(([key, value]) => (
              <button
                key={key}
                onClick={() => insertPlaceholder(key)}
                className={styles.placeholderButton}
                title={`Insert ${key} placeholder (mapped to ${value})`}
              >
                {`{${key}}`}
              </button>
            ))}
        </div>
      </div>

      <div className={styles.templatesSection}>
        <h3>Common Patterns:</h3>
        <div className={styles.templateList}>
          {getCommonPatterns().map((template, index) => (
            <div key={index} className={styles.templateItem}>
              <div className={styles.templateInfo}>
                <h4>{template.name}</h4>
                <p>{template.description}</p>
                <code>{template.pattern}</code>
              </div>
              <button
                onClick={() => handlePatternSelect(template.pattern)}
                className={styles.useTemplateButton}
              >
                Use This Pattern
              </button>
            </div>
          ))}
        </div>
      </div>

      {placeholders.length > 0 && (
        <div className={styles.placeholderInfo}>
          <h3>Detected Placeholders:</h3>
          <div className={styles.placeholderTags}>
            {placeholders.map((placeholder, index) => {
              const isMapped = placeholder === 'link' || 
                Object.keys(columnMapping).includes(placeholder) ||
                Object.values(columnMapping).includes(placeholder);
              
              return (
                <span
                  key={index}
                  className={`${styles.placeholderTag} ${
                    isMapped ? styles.mapped : styles.unmapped
                  }`}
                >
                  {placeholder}
                  {isMapped ? ' ✓' : ' ⚠️'}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {exampleUrls.length > 0 && (
        <div className={styles.exampleSection}>
          <h3>Example URLs:</h3>
          <div className={styles.exampleList}>
            {exampleUrls.map((url, index) => (
              <div key={index} className={styles.exampleUrl}>
                <code>{url}</code>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.actions}>
        <button
          onClick={handleContinue}
          disabled={!isValid}
          className={`${styles.continueButton} ${!isValid ? styles.disabled : ''}`}
        >
          Continue to Preview
        </button>
        
        {!isValid && (
          <p className={styles.validationMessage}>
            Please fix the errors above to continue
          </p>
        )}
      </div>

      <div className={styles.tips}>
        <h4>💡 Tips:</h4>
        <ul>
          <li>Use curly braces {} to define placeholders in your URL pattern</li>
          <li>The {'{link}'} placeholder is required and will be replaced with your mapped link column</li>
          <li>You can use any mapped column as a placeholder (e.g., {'{category}'}, {'{store_id}'})</li>
          <li>Make sure your URL pattern includes the full domain and protocol</li>
          <li>Test your pattern with the example URLs shown above</li>
        </ul>
      </div>
    </div>
  );
}