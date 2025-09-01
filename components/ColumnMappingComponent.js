'use client';

import { useState, useEffect } from 'react';
import styles from './ColumnMappingComponent.module.css';

export default function ColumnMappingComponent({ 
  headers, 
  onMappingComplete, 
  currentMapping 
}) {
  const [mapping, setMapping] = useState({
    link: '',
    category: '',
    store_id: '',
    lastmod: '',
    ...currentMapping
  });
  const [errors, setErrors] = useState({});
  const [isValid, setIsValid] = useState(false);

  const mappingFields = [
    {
      key: 'link',
      label: 'Link/URL Column',
      description: 'Column containing URLs or URL components (Required)',
      required: true
    },
    {
      key: 'category',
      label: 'Category Column',
      description: 'Column for grouping URLs by category (Optional)',
      required: false
    },
    {
      key: 'store_id',
      label: 'Store ID Column',
      description: 'Column for grouping URLs by store (Optional)',
      required: false
    },
    {
      key: 'lastmod',
      label: 'Last Modified Column',
      description: 'Column containing last modification dates (YYYY-MM-DD format)',
      required: false
    }
  ];

  useEffect(() => {
    validateMapping();
  }, [mapping]);

  const validateMapping = () => {
    const newErrors = {};
    let valid = true;

    // Check required fields
    if (!mapping.link) {
      newErrors.link = 'Link column is required';
      valid = false;
    }

    // Check for duplicate mappings
    const usedColumns = Object.values(mapping).filter(Boolean);
    const duplicates = usedColumns.filter((col, index) => 
      usedColumns.indexOf(col) !== index
    );

    if (duplicates.length > 0) {
      mappingFields.forEach(field => {
        if (duplicates.includes(mapping[field.key])) {
          newErrors[field.key] = 'Column already mapped to another field';
          valid = false;
        }
      });
    }

    setErrors(newErrors);
    setIsValid(valid);
  };

  const handleMappingChange = (field, value) => {
    setMapping(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleContinue = () => {
    if (isValid) {
      // Filter out empty mappings
      const cleanMapping = Object.fromEntries(
        Object.entries(mapping).filter(([key, value]) => value !== '')
      );
      onMappingComplete(cleanMapping);
    }
  };

  const getAvailableColumns = (currentField) => {
    const usedColumns = Object.entries(mapping)
      .filter(([key, value]) => key !== currentField && value !== '')
      .map(([key, value]) => value);
    
    return headers.filter(header => !usedColumns.includes(header));
  };

  return (
    <div className={styles.container}>
      <h2>Map Your Columns</h2>
      <p>Map your file columns to the required fields for processing</p>

      <div className={styles.previewSection}>
        <h3>Available Columns in Your File:</h3>
        <div className={styles.columnList}>
          {headers.map((header, index) => (
            <span key={index} className={styles.columnTag}>
              {header}
            </span>
          ))}
        </div>
      </div>

      <div className={styles.mappingSection}>
        <h3>Field Mapping:</h3>
        
        {mappingFields.map((field) => (
          <div key={field.key} className={styles.mappingField}>
            <div className={styles.fieldInfo}>
              <label className={styles.fieldLabel}>
                {field.label}
                {field.required && <span className={styles.required}>*</span>}
              </label>
              <p className={styles.fieldDescription}>{field.description}</p>
            </div>
            
            <div className={styles.selectWrapper}>
              <select
                value={mapping[field.key]}
                onChange={(e) => handleMappingChange(field.key, e.target.value)}
                className={`${styles.select} ${errors[field.key] ? styles.error : ''}`}
              >
                <option value="">-- Select Column --</option>
                {getAvailableColumns(field.key).map((header) => (
                  <option key={header} value={header}>
                    {header}
                  </option>
                ))}
                {mapping[field.key] && !getAvailableColumns(field.key).includes(mapping[field.key]) && (
                  <option value={mapping[field.key]}>
                    {mapping[field.key]}
                  </option>
                )}
              </select>
              
              {errors[field.key] && (
                <div className={styles.errorMessage}>
                  {errors[field.key]}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className={styles.mappingSummary}>
        <h3>Mapping Summary:</h3>
        <div className={styles.summaryList}>
          {Object.entries(mapping)
            .filter(([key, value]) => value !== '')
            .map(([key, value]) => {
              const field = mappingFields.find(f => f.key === key);
              return (
                <div key={key} className={styles.summaryItem}>
                  <span className={styles.summaryLabel}>{field?.label}:</span>
                  <span className={styles.summaryValue}>{value}</span>
                </div>
              );
            })}
        </div>
        
        {Object.keys(mapping).filter(key => mapping[key] !== '').length === 0 && (
          <p className={styles.noMappings}>No columns mapped yet</p>
        )}
      </div>

      <div className={styles.actions}>
        <button
          onClick={handleContinue}
          disabled={!isValid}
          className={`${styles.continueButton} ${!isValid ? styles.disabled : ''}`}
        >
          Continue to URL Pattern
        </button>
        
        {!isValid && (
          <p className={styles.validationMessage}>
            Please map the required Link column to continue
          </p>
        )}
      </div>

      <div className={styles.tips}>
        <h4>💡 Tips:</h4>
        <ul>
          <li>The Link column should contain URLs or URL components that will be used in your URL pattern</li>
          <li>Category and Store ID columns are used for grouping URLs into separate sitemap files</li>
          <li>Last Modified dates should be in YYYY-MM-DD format for valid sitemaps</li>
          <li>You can leave optional fields unmapped if not needed</li>
        </ul>
      </div>
    </div>
  );
}