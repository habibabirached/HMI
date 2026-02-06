import React, { useState, useEffect } from 'react';
import './ColumnPickerDialog.css';

/**
 * Column Picker Dialog Component
 * 
 * Shows columns from selected CSV and allows user to:
 * 1. Assign X-axis column
 * 2. Assign Y-axis column
 * 3. Preview data
 * 4. Confirm selection
 * 
 * Props:
 * - csvData: Selected CSV metadata (name, columns, etc.)
 * - componentName: Name of the component
 * - chartType: Type of chart
 * - onClose: Function to close the dialog
 * - onConfirm: Function called with { xColumn, yColumn, csvData }
 */
const ColumnPickerDialog = ({ csvData, componentName, chartType, onClose, onConfirm }) => {
  const [xColumn, setXColumn] = useState(null);
  const [yColumn, setYColumn] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Auto-select common time/x columns
   */
  useEffect(() => {
    // Common X-axis column names
    const timeColumns = ['time', 'time_sec', 'timestamp', 'hour', 'hour_of_day', 'date'];
    const autoXColumn = csvData.columns.find(col => 
      timeColumns.some(t => col.toLowerCase().includes(t))
    );
    
    if (autoXColumn) {
      setXColumn(autoXColumn);
      console.log('📊 Auto-selected X column:', autoXColumn);
    }
    
    // Auto-select first numeric-looking column for Y
    const numericColumns = csvData.columns.filter(col => 
      !timeColumns.some(t => col.toLowerCase().includes(t))
    );
    if (numericColumns.length > 0) {
      setYColumn(numericColumns[0]);
      console.log('📊 Auto-selected Y column:', numericColumns[0]);
    }
  }, [csvData.columns]);

  /**
   * Fetch preview data when columns change
   */
  useEffect(() => {
    if (xColumn && yColumn) {
      fetchPreview();
    }
  }, [xColumn, yColumn]);

  /**
   * Fetch preview data from backend
   */
  const fetchPreview = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`http://localhost:5000/api/csv/${csvData.name}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch CSV data');
      }

      const data = await response.json();
      
      // Take first 10 rows for preview
      const preview = data.data.slice(0, 10).map(row => ({
        x: row[xColumn],
        y: row[yColumn]
      }));
      
      setPreviewData(preview);
      console.log('📊 Preview data loaded:', preview.length, 'rows');
    } catch (error) {
      console.error('❌ Error fetching preview:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle confirm
   */
  const handleConfirm = () => {
    if (xColumn && yColumn) {
      onConfirm({
        xColumn,
        yColumn,
        csvData
      });
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
    <div className="column-picker-overlay" onClick={(e) => e.target.className === 'column-picker-overlay' && onClose()}>
      <div className="column-picker-dialog">
        <div className="column-picker-header">
          <div className="column-picker-title">
            Select Columns
          </div>
          <div className="column-picker-subtitle">
            {getChartTypeLabel()} for <strong>{componentName}</strong>
          </div>
          <div className="column-picker-csv">
            📄 {csvData.name}
          </div>
          <button className="column-picker-close" onClick={onClose}>×</button>
        </div>

        <div className="column-picker-content">
          <div className="column-picker-grid">
            {/* X-Axis Column Selector */}
            <div className="column-picker-section">
              <div className="column-picker-section-title">
                X-Axis (Horizontal)
              </div>
              <div className="column-picker-section-desc">
                Usually time, date, or independent variable
              </div>
              <div className="column-picker-columns">
                {csvData.columns.map((col) => (
                  <div
                    key={col}
                    className={`column-picker-column ${xColumn === col ? 'selected' : ''}`}
                    onClick={() => setXColumn(col)}
                  >
                    <div className="column-picker-column-name">{col}</div>
                    {xColumn === col && (
                      <div className="column-picker-column-check">✓</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Y-Axis Column Selector */}
            <div className="column-picker-section">
              <div className="column-picker-section-title">
                Y-Axis (Vertical)
              </div>
              <div className="column-picker-section-desc">
                Usually measured value or dependent variable
              </div>
              <div className="column-picker-columns">
                {csvData.columns.map((col) => (
                  <div
                    key={col}
                    className={`column-picker-column ${yColumn === col ? 'selected' : ''}`}
                    onClick={() => setYColumn(col)}
                  >
                    <div className="column-picker-column-name">{col}</div>
                    {yColumn === col && (
                      <div className="column-picker-column-check">✓</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Preview Section */}
          {xColumn && yColumn && (
            <div className="column-picker-preview">
              <div className="column-picker-preview-title">
                📊 Data Preview (First 10 Rows)
              </div>
              
              {loading && (
                <div className="column-picker-preview-loading">
                  <div className="column-picker-spinner"></div>
                  Loading preview...
                </div>
              )}
              
              {error && (
                <div className="column-picker-preview-error">
                  ⚠️ {error}
                </div>
              )}
              
              {!loading && !error && previewData.length > 0 && (
                <div className="column-picker-preview-table">
                  <table>
                    <thead>
                      <tr>
                        <th>{xColumn}</th>
                        <th>{yColumn}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.map((row, idx) => (
                        <tr key={idx}>
                          <td>{typeof row.x === 'number' ? row.x.toFixed(2) : row.x}</td>
                          <td>{typeof row.y === 'number' ? row.y.toFixed(2) : row.y}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="column-picker-actions">
          <button
            className="column-picker-btn column-picker-btn-confirm"
            onClick={handleConfirm}
            disabled={!xColumn || !yColumn}
          >
            Associate Chart
          </button>
          <button
            className="column-picker-btn column-picker-btn-cancel"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default ColumnPickerDialog;
