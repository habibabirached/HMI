import React, { useState, useRef } from 'react';
import './CSVUploadDialog.css';

/**
 * CSV Upload Dialog Component
 * 
 * Allows users to:
 * 1. Select single CSV files or entire directories
 * 2. Upload CSV files to the backend
 * 3. See upload progress
 * 4. Handle filename conflicts (overwrite warning)
 * 5. View list of successfully uploaded CSVs
 * 
 * Props:
 * - onClose: Function to close the dialog
 * - onUploadComplete: Function called when uploads finish (for refresh)
 */
const CSVUploadDialog = ({ onClose, onUploadComplete }) => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});
  const [uploadResults, setUploadResults] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [conflictFile, setConflictFile] = useState(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState(null);
  
  const fileInputRef = useRef(null);
  const directoryInputRef = useRef(null);

  // ============================================================================
  // FILE SELECTION HANDLERS
  // ============================================================================
  
  /**
   * Handle single file selection
   * Opens native file picker limited to .csv files
   */
  const handleSelectFile = () => {
    fileInputRef.current?.click();
  };

  /**
   * Handle directory selection
   * Opens native directory picker, filters for .csv files
   */
  const handleSelectDirectory = () => {
    directoryInputRef.current?.click();
  };

  /**
   * Process selected files from file input
   * Filters to only include .csv files
   */
  const handleFileChange = (event) => {
    const files = Array.from(event.target.files);
    const csvFiles = files.filter(file => file.name.toLowerCase().endsWith('.csv'));
    
    if (csvFiles.length === 0) {
      alert('No CSV files selected. Please select .csv files.');
      return;
    }
    
    setSelectedFiles(prev => [...prev, ...csvFiles]);
    
    // Reset input so same file can be selected again
    event.target.value = '';
  };

  /**
   * Remove a file from the selected files list
   */
  const handleRemoveFile = (fileName) => {
    setSelectedFiles(prev => prev.filter(file => file.name !== fileName));
  };

  // ============================================================================
  // UPLOAD LOGIC
  // ============================================================================
  
  /**
   * Upload all selected files to the backend
   * 
   * For each file:
   * 1. Create FormData with the file
   * 2. POST to /api/csv/upload
   * 3. Handle success (add to results)
   * 4. Handle 409 conflict (show overwrite dialog)
   * 5. Handle other errors (show error message)
   */
  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      alert('Please select at least one CSV file to upload.');
      return;
    }

    setIsUploading(true);
    setUploadResults([]);
    
    for (const file of selectedFiles) {
      try {
        // Update progress (uploading)
        setUploadProgress(prev => ({
          ...prev,
          [file.name]: 'uploading'
        }));

        // Create FormData and append the file
        const formData = new FormData();
        formData.append('file', file);

        // Upload to backend
        const response = await fetch('http://localhost:5000/api/csv/upload', {
          method: 'POST',
          body: formData
        });

        if (response.ok) {
          // Success
          const result = await response.json();
          setUploadProgress(prev => ({
            ...prev,
            [file.name]: 'success'
          }));
          setUploadResults(prev => [...prev, {
            file: file.name,
            status: 'success',
            message: `Uploaded successfully (${result.row_count} rows)`
          }]);
        } else if (response.status === 409) {
          // Conflict - file already exists
          const error = await response.json();
          setUploadProgress(prev => ({
            ...prev,
            [file.name]: 'conflict'
          }));
          
          // Store conflict info and show warning
          setConflictFile({
            file: file,
            message: error.detail
          });
          
          // Stop uploading remaining files until conflict is resolved
          break;
        } else {
          // Other error
          const error = await response.json();
          setUploadProgress(prev => ({
            ...prev,
            [file.name]: 'error'
          }));
          setUploadResults(prev => [...prev, {
            file: file.name,
            status: 'error',
            message: error.detail || 'Upload failed'
          }]);
        }
      } catch (error) {
        // Network or other error
        console.error('Upload error:', error);
        setUploadProgress(prev => ({
          ...prev,
          [file.name]: 'error'
        }));
        setUploadResults(prev => [...prev, {
          file: file.name,
          status: 'error',
          message: error.message || 'Network error'
        }]);
      }
    }

    setIsUploading(false);
    
    // Check if all uploads were successful
    const allSuccess = uploadResults.every(r => r.status === 'success') &&
                       Object.values(uploadProgress).every(s => s === 'success');
    
    // Auto-close dialog after 2 seconds if all uploads succeeded
    if (allSuccess && uploadResults.length > 0) {
      setTimeout(() => {
        onClose();
      }, 2000);
    }
    
    // Notify parent that upload is complete (for refresh)
    if (onUploadComplete) {
      onUploadComplete();
    }
  };

  /**
   * Handle conflict resolution (user chose to overwrite)
   * 
   * Simplified workflow due to HTTP/2 connection issues:
   * 1. DELETE the existing CSV dataset
   * 2. Show success message and close dialog
   * 3. User can reopen and upload the new file
   */
  const handleOverwrite = async () => {
    if (!conflictFile) return;
    
    try {
      // ----------------------------------------------------------------
      // STEP 1: Delete the existing CSV dataset
      // ----------------------------------------------------------------
      console.log(`🗑️  Deleting existing CSV: ${conflictFile.file.name}`);
      
      const deleteResponse = await fetch(
        `http://localhost:5000/api/csv/${conflictFile.file.name}`,
        { method: 'DELETE' }
      );
      
      if (!deleteResponse.ok) {
        throw new Error('Failed to delete existing CSV');
      }
      
      console.log(`✅ Deleted existing CSV: ${conflictFile.file.name}`);
      
      // ----------------------------------------------------------------
      // STEP 2: Mark as deleted and show success
      // ----------------------------------------------------------------
      setUploadProgress(prev => ({
        ...prev,
        [conflictFile.file.name]: 'success'
      }));
      
      setUploadResults(prev => [...prev, {
        file: conflictFile.file.name,
        status: 'success',
        message: 'Old file deleted. Please close this dialog and upload the new file.'
      }]);
      
      setConflictFile(null);
      setIsUploading(false);
      
      // Remove the file from selected files so user knows it was handled
      setSelectedFiles(prev => prev.filter(f => f.name !== conflictFile.file.name));
      
      // Show styled success message instead of alert
      setShowSuccessMessage(
        `Old "${conflictFile.file.name}" has been deleted successfully. ` +
        `Please close this dialog and upload your new file again.`
      );
      
      if (onUploadComplete) {
        onUploadComplete();
      }
      
    } catch (error) {
      console.error('❌ Delete error:', error);
      setUploadProgress(prev => ({
        ...prev,
        [conflictFile.file.name]: 'error'
      }));
      setUploadResults(prev => [...prev, {
        file: conflictFile.file.name,
        status: 'error',
        message: error.message || 'Delete failed'
      }]);
      setConflictFile(null);
      setIsUploading(false);
    }
  };

  /**
   * Helper function to upload remaining files after conflict resolution
   */
  const uploadRemainingFiles = async (files) => {
    for (const file of files) {
      try {
        setUploadProgress(prev => ({
          ...prev,
          [file.name]: 'uploading'
        }));

        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('http://localhost:5000/api/csv/upload', {
          method: 'POST',
          body: formData
        });

        if (response.ok) {
          const result = await response.json();
          setUploadProgress(prev => ({
            ...prev,
            [file.name]: 'success'
          }));
          setUploadResults(prev => [...prev, {
            file: file.name,
            status: 'success',
            message: `Uploaded successfully (${result.row_count} rows)`
          }]);
        } else if (response.status === 409) {
          // Another conflict - show warning again
          const error = await response.json();
          setUploadProgress(prev => ({
            ...prev,
            [file.name]: 'conflict'
          }));
          setConflictFile({
            file: file,
            message: error.detail
          });
          break; // Stop and wait for user decision
        } else {
          const error = await response.json();
          setUploadProgress(prev => ({
            ...prev,
            [file.name]: 'error'
          }));
          setUploadResults(prev => [...prev, {
            file: file.name,
            status: 'error',
            message: error.detail || 'Upload failed'
          }]);
        }
      } catch (error) {
        console.error('Upload error:', error);
        setUploadProgress(prev => ({
          ...prev,
          [file.name]: 'error'
        }));
        setUploadResults(prev => [...prev, {
          file: file.name,
          status: 'error',
          message: error.message || 'Network error'
        }]);
      }
    }
    
    setIsUploading(false);
    if (onUploadComplete) {
      onUploadComplete();
    }
  };

  /**
   * Handle conflict resolution (user chose to cancel)
   */
  const handleCancelOverwrite = () => {
    // Remove the conflicting file from selected files
    setSelectedFiles(prev => prev.filter(f => f.name !== conflictFile.file.name));
    setConflictFile(null);
    setIsUploading(false);
  };

  // ============================================================================
  // DIALOG ACTIONS
  // ============================================================================
  
  /**
   * Close dialog
   */
  const handleClose = () => {
    if (isUploading) {
      if (!window.confirm('Upload in progress. Are you sure you want to close?')) {
        return;
      }
    }
    onClose();
  };

  // ============================================================================
  // RENDER
  // ============================================================================
  
  return (
    <div className="csv-dialog-overlay" onClick={handleClose}>
      <div className="csv-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="csv-dialog-header">
          <h2>📊 Load CSV Data Files</h2>
          <button className="csv-dialog-close" onClick={handleClose}>×</button>
        </div>

        <div className="csv-dialog-content">
          {/* Success Message Banner */}
          {showSuccessMessage && (
            <div className="csv-success-banner">
              <div className="csv-success-icon">✅</div>
              <div className="csv-success-text">{showSuccessMessage}</div>
              <button 
                className="csv-success-close" 
                onClick={() => setShowSuccessMessage(null)}
              >
                ×
              </button>
            </div>
          )}

          {/* Selection Buttons */}
          <div className="csv-selection-section">
            <p className="csv-help-text">
              Select CSV files to upload. These will be stored in the database and can be associated with components for real-time plotting.
            </p>
            
            <div className="csv-selection-buttons">
              <button 
                className="csv-btn csv-btn-file" 
                onClick={handleSelectFile}
                disabled={isUploading}
              >
                📄 Select File(s)
              </button>
              <button 
                className="csv-btn csv-btn-directory" 
                onClick={handleSelectDirectory}
                disabled={isUploading}
              >
                📁 Select Directory
              </button>
            </div>

            {/* Hidden file inputs */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv,application/csv,text/comma-separated-values"
              multiple
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <input
              ref={directoryInputRef}
              type="file"
              accept=".csv,text/csv,application/csv,text/comma-separated-values"
              webkitdirectory="true"
              directory="true"
              multiple
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </div>

          {/* Selected Files List */}
          {selectedFiles.length > 0 && (
            <div className="csv-files-section">
              <h3>Selected Files ({selectedFiles.length})</h3>
              <div className="csv-files-list">
                {selectedFiles.map((file) => (
                  <div key={file.name} className="csv-file-item">
                    <span className="csv-file-name">{file.name}</span>
                    <span className="csv-file-size">
                      {(file.size / 1024).toFixed(1)} KB
                    </span>
                    {uploadProgress[file.name] && (
                      <span className={`csv-file-status status-${uploadProgress[file.name]}`}>
                        {uploadProgress[file.name] === 'uploading' && '⏳ Uploading...'}
                        {uploadProgress[file.name] === 'success' && '✅ Success'}
                        {uploadProgress[file.name] === 'error' && '❌ Error'}
                        {uploadProgress[file.name] === 'conflict' && '⚠️ Conflict'}
                      </span>
                    )}
                    {!isUploading && !uploadProgress[file.name] && (
                      <button
                        className="csv-file-remove"
                        onClick={() => handleRemoveFile(file.name)}
                        title="Remove file"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload Results */}
          {uploadResults.length > 0 && (
            <div className="csv-results-section">
              <h3>Upload Results</h3>
              <div className="csv-results-list">
                {uploadResults.map((result, idx) => (
                  <div key={idx} className={`csv-result-item result-${result.status}`}>
                    <span className="csv-result-file">{result.file}</span>
                    <span className="csv-result-message">{result.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Dialog Actions */}
        <div className="csv-dialog-actions">
          <button 
            className="csv-btn csv-btn-upload" 
            onClick={handleUpload}
            disabled={selectedFiles.length === 0 || isUploading}
          >
            {isUploading ? (
              <>
                <span className="csv-spinner"></span>
                Uploading...
              </>
            ) : (
              `⬆️ Upload ${selectedFiles.length} File(s)`
            )}
          </button>
          <button 
            className="csv-btn csv-btn-cancel" 
            onClick={handleClose}
            disabled={isUploading}
          >
            Close
          </button>
        </div>

        {/* Conflict Warning Dialog */}
        {conflictFile && (
          <div className="csv-conflict-overlay">
            <div className="csv-conflict-dialog">
              <h3>⚠️ File Already Exists</h3>
              <p className="csv-conflict-filename">"{conflictFile.file.name}"</p>
              <p className="csv-conflict-question">
                Click "Delete Old File" to remove the existing file. 
                You can then upload your new version.
              </p>
              <div className="csv-conflict-actions">
                <button 
                  className="csv-btn csv-btn-overwrite" 
                  onClick={handleOverwrite}
                >
                  Delete Old File
                </button>
                <button 
                  className="csv-btn csv-btn-cancel" 
                  onClick={handleCancelOverwrite}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CSVUploadDialog;
