import React, { useState, useEffect } from 'react';
import './MultiComponentChartDialog.css';

const MultiComponentChartDialog = ({ 
  components, 
  onClose, 
  onCreateChart 
}) => {
  const [csvFiles, setCsvFiles] = useState([]);
  const [csvObjects, setCsvObjects] = useState([]); // Store full CSV objects
  const [selectedCsv, setSelectedCsv] = useState(null);
  const [csvColumns, setCsvColumns] = useState([]);
  const [columnMappings, setColumnMappings] = useState({});
  const [timeColumn, setTimeColumn] = useState('');
  const [chartTitle, setChartTitle] = useState('Multi-Component Bar Chart');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch available CSV files on mount
  useEffect(() => {
    fetchCsvFiles();
  }, []);

  const fetchCsvFiles = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:5000/api/csv/list');
      const data = await response.json();
      
      // API returns array of CSV objects: [{ id, name, columns, ... }]
      if (Array.isArray(data)) {
        setCsvObjects(data); // Store full objects
        const csvNames = data.map(csv => csv.name);
        setCsvFiles(csvNames);
        
        // Auto-select the first CSV if only one exists
        if (csvNames.length === 1) {
          handleCsvSelect(csvNames[0]);
        }
      }
      
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch CSV files:', err);
      setError('Failed to load CSV files');
      setLoading(false);
    }
  };

  const handleCsvSelect = (csvName) => {
    setSelectedCsv(csvName);
    setError(null);
    
    // Find the CSV object by name
    const csvObj = csvObjects.find(csv => csv.name === csvName);
    
    if (csvObj && csvObj.columns) {
      // Columns are already in the object from /api/csv/list
      setCsvColumns(csvObj.columns);
      
      // Auto-detect time column
      const timeCol = csvObj.columns.find(col => 
        col.toLowerCase().includes('time') || 
        col.toLowerCase().includes('timestamp') ||
        col.toLowerCase().includes('seconds') ||
        col.toLowerCase().includes('minute')
      );
      if (timeCol) {
        setTimeColumn(timeCol);
      }
      
      // Initialize column mappings with empty values
      const initialMappings = {};
      components.forEach(comp => {
        initialMappings[comp.id] = '';
      });
      setColumnMappings(initialMappings);
    } else {
      setError('Failed to load CSV columns');
    }
  };

  const handleColumnMapping = (componentId, columnName) => {
    setColumnMappings(prev => ({
      ...prev,
      [componentId]: columnName
    }));
  };

  const handleCreate = () => {
    // Validate all components have columns assigned
    const missingMappings = components.filter(comp => !columnMappings[comp.id]);
    if (missingMappings.length > 0) {
      setError(`Please assign columns for: ${missingMappings.map(c => c.name).join(', ')}`);
      return;
    }
    
    if (!timeColumn) {
      setError('Please select a time column');
      return;
    }
    
    // Build chart configuration
    const chartConfig = {
      type: 'multi-bar-chart',
      csvFile: selectedCsv,
      timeColumn,
      title: chartTitle,
      components: components.map(comp => ({
        id: comp.id,
        name: comp.name,
        type: comp.type,
        columnName: columnMappings[comp.id]
      }))
    };
    
    console.log('📊 Creating multi-component chart:', chartConfig);
    onCreateChart(chartConfig);
    onClose();
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="multi-chart-dialog" onClick={e => e.stopPropagation()}>
        <div className="dialog-header">
          <h2>📊 Configure Multi-Component Bar Chart</h2>
          <button className="dialog-close-btn" onClick={onClose}>✕</button>
        </div>
        
        <div className="dialog-body">
          {error && (
            <div className="dialog-error">
              ⚠️ {error}
            </div>
          )}
          
          {/* Chart Title */}
          <div className="dialog-section">
            <label className="dialog-label">Chart Title</label>
            <input 
              type="text"
              className="dialog-input"
              value={chartTitle}
              onChange={e => setChartTitle(e.target.value)}
              placeholder="Enter chart title..."
            />
          </div>
          
          {/* CSV File Selection */}
          <div className="dialog-section">
            <label className="dialog-label">
              Select CSV Data Source
              {loading && <span className="loading-spinner">⏳</span>}
            </label>
            <select 
              className="dialog-select"
              value={selectedCsv || ''}
              onChange={e => handleCsvSelect(e.target.value)}
              disabled={loading}
            >
              <option value="">-- Select CSV File --</option>
              {csvFiles.map(csv => (
                <option key={csv} value={csv}>{csv}</option>
              ))}
            </select>
          </div>
          
          {/* Time Column Selection */}
          {selectedCsv && csvColumns.length > 0 && (
            <div className="dialog-section">
              <label className="dialog-label">Time Column (X-Axis)</label>
              <select 
                className="dialog-select"
                value={timeColumn}
                onChange={e => setTimeColumn(e.target.value)}
              >
                <option value="">-- Select Time Column --</option>
                {csvColumns.map(col => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>
          )}
          
          {/* Component-to-Column Mapping */}
          {selectedCsv && csvColumns.length > 0 && (
            <div className="dialog-section">
              <label className="dialog-label">
                Map Components to CSV Columns
                <span className="dialog-label-hint">
                  ({components.length} components selected)
                </span>
              </label>
              
              <div className="component-mappings">
                {components.map(comp => (
                  <div key={comp.id} className="mapping-row">
                    <div className="mapping-component">
                      <span className="component-icon">⚡</span>
                      <span className="component-name">{comp.name}</span>
                      <span className="component-type">({comp.type})</span>
                    </div>
                    <span className="mapping-arrow">→</span>
                    <select 
                      className="mapping-select"
                      value={columnMappings[comp.id] || ''}
                      onChange={e => handleColumnMapping(comp.id, e.target.value)}
                    >
                      <option value="">-- Select Column --</option>
                      {csvColumns
                        .filter(col => col !== timeColumn)
                        .map(col => (
                          <option key={col} value={col}>{col}</option>
                        ))
                      }
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Preview Info */}
          {selectedCsv && Object.values(columnMappings).every(v => v) && timeColumn && (
            <div className="dialog-preview">
              <div className="preview-header">📋 Chart Preview</div>
              <div className="preview-content">
                <div className="preview-item">
                  <strong>Data Source:</strong> {selectedCsv}
                </div>
                <div className="preview-item">
                  <strong>Time Axis:</strong> {timeColumn}
                </div>
                <div className="preview-item">
                  <strong>Components:</strong> {components.length} bars
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="dialog-footer">
          <button className="dialog-btn dialog-btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button 
            className="dialog-btn dialog-btn-create" 
            onClick={handleCreate}
            disabled={!selectedCsv || !timeColumn || Object.values(columnMappings).some(v => !v)}
          >
            ✓ Create Chart
          </button>
        </div>
      </div>
    </div>
  );
};

export default MultiComponentChartDialog;
