import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './MultiComponentChartDialog.css';

/**
 * MultiComponentChartDialog – configure a multi-component bar chart.
 *
 * DESIGN-DIR FLOW (preferred): When simulationColumns and simulationCsvName are provided,
 * we use the current simulation's CSV columns directly. No fetch to /api/csv/list.
 *
 * LEGACY FLOW: When not provided, we used to fetch from /api/csv/list (deprecated).
 * Now we require design-dir props – canAddCharts is only true when a simulation is loaded.
 */
const chartTypeConfig = {
  'multi-bar-chart': { defaultTitle: 'Multi-Component Bar Chart', header: 'Configure Multi-Component Bar Chart', previewLabel: 'bars', timeHint: '(for animation; chart X = components, Y = your chosen columns)' },
  'multi-line-chart': { defaultTitle: 'Multi-Line 2D Plot', header: 'Configure Multi-Line 2D Plot', previewLabel: 'lines', timeHint: '(X-axis = time; one line per component)' }
};

const MultiComponentChartDialog = ({
  chartType = 'multi-bar-chart',
  components,
  onClose,
  onCreateChart,
  simulationColumns = [],
  simulationCsvName = ''
}) => {
  const config = chartTypeConfig[chartType] || chartTypeConfig['multi-bar-chart'];
  const [selectedCsv, setSelectedCsv] = useState('');
  const [csvColumns, setCsvColumns] = useState([]);
  const [columnMappings, setColumnMappings] = useState({});
  const [timeColumn, setTimeColumn] = useState('');
  const [chartTitle, setChartTitle] = useState(config.defaultTitle);
  const [error, setError] = useState(null);

  const useDesignDir = simulationColumns.length > 0 && !!simulationCsvName;
  const initializedRef = useRef(false);

  // Initialize from design-dir simulation data (once per dialog open)
  useEffect(() => {
    if (useDesignDir && !initializedRef.current) {
      initializedRef.current = true;
      setSelectedCsv(simulationCsvName);
      setCsvColumns(simulationColumns);
      const timeCol = simulationColumns.find(col =>
        /time|timestamp|sec|_t$/i.test(String(col))
      );
      if (timeCol) setTimeColumn(timeCol);
      const initialMappings = {};
      components.forEach(comp => { initialMappings[comp.id] = ''; });
      setColumnMappings(initialMappings);
    }
  }, [useDesignDir, simulationColumns, simulationCsvName, components]);

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
    
    const chartConfig = {
      type: chartType,
      csvFile: useDesignDir ? simulationCsvName : selectedCsv,
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

  const dialogContent = (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="multi-chart-dialog" onClick={e => e.stopPropagation()}>
        <div className="dialog-header">
          <h2>📊 {config.header}</h2>
          <button className="dialog-close-btn" onClick={onClose}>✕</button>
        </div>
        
        <div className="dialog-body">
          {!useDesignDir && (
            <div className="dialog-error">
              ⚠️ No simulation data. Load a simulation scenario first, then try again.
            </div>
          )}
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

          {/* Data source – design-dir: show fixed CSV; no dropdown */}
          {useDesignDir && (
            <div className="dialog-section">
              <label className="dialog-label">Data Source</label>
              <div className="dialog-data-source">{simulationCsvName}</div>
            </div>
          )}
          
          {/* Time Column – drives animation when sim runs; chart X = components, Y = chosen column values */}
          {csvColumns.length > 0 && (
            <div className="dialog-section">
              <label className="dialog-label">
                Time Column
                <span className="dialog-label-hint">{config.timeHint}</span>
              </label>
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
          {csvColumns.length > 0 && (
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
          {Object.values(columnMappings).every(v => v) && timeColumn && (
            <div className="dialog-preview">
              <div className="preview-header">📋 Chart Preview</div>
              <div className="preview-content">
                <div className="preview-item">
                  <strong>Data Source:</strong> {useDesignDir ? simulationCsvName : selectedCsv}
                </div>
                <div className="preview-item">
                  <strong>Time Axis:</strong> {timeColumn}
                </div>
                <div className="preview-item">
                  <strong>Components:</strong> {components.length} {config.previewLabel}
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
            disabled={(!useDesignDir && !selectedCsv) || !timeColumn || Object.values(columnMappings).some(v => !v)}
          >
            ✓ Create Chart
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(dialogContent, document.body);
};

export default MultiComponentChartDialog;
