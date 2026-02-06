import React, { useState, useEffect } from 'react';
import './CSVPickerDialog.css';

/**
 * CSV Picker Dialog Component
 * 
 * Shows list of available CSV datasets from the database.
 * Allows user to select one for chart association.
 * 
 * Props:
 * - onClose: Function to close the dialog
 * - onSelectCSV: Function called with selected CSV metadata
 * - componentName: Name of the component (for display)
 * - chartType: Type of chart being associated (e.g., '2d', 'histogram')
 */
const CSVPickerDialog = ({ onClose, onSelectCSV, componentName, chartType }) => {
  const [csvDatasets, setCsvDatasets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCSV, setSelectedCSV] = useState(null);

  /**
   * Fetch CSV datasets from backend on mount
   */
  useEffect(() => {
    fetchCSVDatasets();
  }, []);

  const fetchCSVDatasets = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:5000/api/csv/list');
      
      if (!response.ok) {
        throw new Error('Failed to fetch CSV datasets');
      }

      const data = await response.json();
      console.log('📊 Loaded CSV datasets:', data.length);
      setCsvDatasets(data);
    } catch (error) {
      console.error('❌ Error fetching CSV datasets:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Filter datasets based on search term
   */
  const filteredDatasets = csvDatasets.filter(dataset =>
    dataset.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  /**
   * Handle CSV selection
   */
  const handleSelect = (dataset) => {
    setSelectedCSV(dataset);
  };

  /**
   * Handle confirm selection
   */
  const handleConfirm = () => {
    if (selectedCSV) {
      onSelectCSV(selectedCSV);
    }
  };

  /**
   * Handle overlay click to close
   */
  const handleOverlayClick = (e) => {
    if (e.target.className === 'csv-picker-overlay') {
      onClose();
    }
  };

  /**
   * Get chart type label
   */
  const getChartTypeLabel = () => {
    const labels = {
      '2d': '2D Plot',
      'histogram': 'Histogram',
      'pie': 'Pie Chart',
      'bar': 'Bar Chart',
      '3d': '3D Surface',
      'heatmap': 'Heatmap',
      'box': 'Box Plot'
    };
    return labels[chartType] || chartType;
  };

  return (
    <div className="csv-picker-overlay" onClick={handleOverlayClick}>
      <div className="csv-picker-dialog">
        <div className="csv-picker-header">
          <div className="csv-picker-title">
            Select CSV Dataset
          </div>
          <div className="csv-picker-subtitle">
            {getChartTypeLabel()} for <strong>{componentName}</strong>
          </div>
          <button className="csv-picker-close" onClick={onClose}>×</button>
        </div>

        <div className="csv-picker-content">
          {/* Search Bar */}
          <div className="csv-picker-search">
            <input
              type="text"
              className="csv-picker-search-input"
              placeholder="🔍 Search CSV files..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Loading State */}
          {loading && (
            <div className="csv-picker-loading">
              <div className="csv-picker-spinner"></div>
              <div>Loading CSV datasets...</div>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="csv-picker-error">
              <div className="csv-picker-error-icon">⚠️</div>
              <div className="csv-picker-error-message">{error}</div>
              <button className="csv-picker-retry" onClick={fetchCSVDatasets}>
                Retry
              </button>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && csvDatasets.length === 0 && (
            <div className="csv-picker-empty">
              <div className="csv-picker-empty-icon">📊</div>
              <div className="csv-picker-empty-title">No CSV Datasets</div>
              <div className="csv-picker-empty-message">
                Upload CSV files using the "Load CSV" button in the toolbar.
              </div>
            </div>
          )}

          {/* Dataset List */}
          {!loading && !error && filteredDatasets.length > 0 && (
            <div className="csv-picker-list">
              {filteredDatasets.map((dataset) => (
                <div
                  key={dataset.id}
                  className={`csv-picker-item ${selectedCSV?.id === dataset.id ? 'selected' : ''}`}
                  onClick={() => handleSelect(dataset)}
                >
                  <div className="csv-picker-item-main">
                    <div className="csv-picker-item-icon">📄</div>
                    <div className="csv-picker-item-info">
                      <div className="csv-picker-item-name">{dataset.name}</div>
                      <div className="csv-picker-item-meta">
                        <span className="csv-picker-item-rows">
                          {dataset.row_count.toLocaleString()} rows
                        </span>
                        <span className="csv-picker-item-sep">•</span>
                        <span className="csv-picker-item-cols">
                          {dataset.columns.length} columns
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="csv-picker-item-columns">
                    {dataset.columns.map((col, idx) => (
                      <span key={idx} className="csv-picker-column-tag">
                        {col}
                      </span>
                    ))}
                  </div>
                  {selectedCSV?.id === dataset.id && (
                    <div className="csv-picker-item-check">✓</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* No Search Results */}
          {!loading && !error && csvDatasets.length > 0 && filteredDatasets.length === 0 && (
            <div className="csv-picker-empty">
              <div className="csv-picker-empty-icon">🔍</div>
              <div className="csv-picker-empty-title">No Results</div>
              <div className="csv-picker-empty-message">
                No CSV files match "{searchTerm}"
              </div>
            </div>
          )}
        </div>

        <div className="csv-picker-actions">
          <button
            className="csv-picker-btn csv-picker-btn-confirm"
            onClick={handleConfirm}
            disabled={!selectedCSV}
          >
            Next: Select Columns
          </button>
          <button
            className="csv-picker-btn csv-picker-btn-cancel"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default CSVPickerDialog;
