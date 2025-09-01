'use client';

import { useState } from 'react';
import styles from './HomeButton.module.css';

export default function HomeButton({ className = '', showConfirm = true }) {
  const [isClearing, setIsClearing] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const handleGoHome = async () => {
    if (showConfirm && !showConfirmDialog) {
      setShowConfirmDialog(true);
      return;
    }

    setIsClearing(true);
    
    try {
      // Clear all files and storage
      const response = await fetch('/api/clear-files', {
        method: 'POST'
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log(`Cleared ${result.filesCleared} files`);
      }
    } catch (error) {
      console.error('Error clearing files:', error);
    } finally {
      // Navigate to home regardless of clear result
      window.location.href = '/';
    }
  };

  const handleCancel = () => {
    setShowConfirmDialog(false);
  };

  if (showConfirmDialog) {
    return (
      <div className={styles.confirmDialog}>
        <div className={styles.confirmContent}>
          <h3>Clear All Data?</h3>
          <p>This will clear all uploaded files and conversion data. Are you sure?</p>
          <div className={styles.confirmButtons}>
            <button 
              onClick={handleGoHome}
              className={styles.confirmButton}
              disabled={isClearing}
            >
              {isClearing ? 'Clearing...' : 'Yes, Clear & Go Home'}
            </button>
            <button 
              onClick={handleCancel}
              className={styles.cancelButton}
              disabled={isClearing}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={handleGoHome}
      className={`${styles.homeButton} ${className}`}
      disabled={isClearing}
      title="Clear all data and go to homepage"
    >
      {isClearing ? (
        <>
          <span className={styles.spinner}></span>
          Clearing...
        </>
      ) : (
        <>
          <span className={styles.homeIcon}>🏠</span>
          Home
        </>
      )}
    </button>
  );
}