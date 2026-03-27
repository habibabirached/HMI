import React, { useState, useEffect } from 'react';
import './ColumnPickerDialog.css';

/**
 * STEP 4: Column Picker Dialog for single-component charts
 *
 * When the user right-clicks a component and selects a chart type (2D, histogram, etc.)
 * while in a simulation with CSV loaded, we show this dialog so they can pick which
 * columns to use for the X and Y axes. The columns come from simulationMetadata.columns
 * (the current simulation's CSV). On confirm, we pass the selection back so App.js can
 * add the chart and persist it to .sim.json.
 */
const ColumnPickerDialog = ({
  component,
  chartType,
  columns = [],
  csvName,
  onConfirm,
  onClose
}) => {
  const [xColumn, setXColumn] = useState('');
  const [yColumn, setYColumn] = useState('');
  const [title, setTitle] = useState('');
  const [alsoOpenInPanel, setAlsoOpenInPanel] = useState(false);
  const [error, setError] = useState(null);

  // Auto-select common columns when dialog opens (columns from simulation CSV)
  useEffect(() => {
    if (columns.length === 0) return;
    const timeCol = columns.find(c =>
      /time|timestamp|sec|_t$/i.test(String(c))
    );
    if (timeCol) setXColumn(timeCol);
    const firstOther = columns.find(c => c !== timeCol) || columns[0];
    if (firstOther) setYColumn(firstOther);
  }, [columns]);

  const chartTypeLabels = {
    '2d': '2D Plot (X vs Y)',
    histogram: 'Histogram',
    pie: 'Pie Chart',
    bar: 'Bar Chart',
    '3d': '3D Surface',
    heatmap: 'Heatmap',
    box: 'Box Plot'
  };

  const handleCreate = () => {
    setError(null);
    if (!xColumn || !yColumn) {
      setError('Please select both X and Y columns.');
      return;
    }
    onConfirm({
      xColumn,
      yColumn,
      title: title.trim() || undefined,
      ...(chartType === '2d' ? { alsoOpenInPanel } : {}),
    });
    onClose();
  };

  const handleOverlayClick = (e) => {
    if (e.target.classList.contains('dialog-overlay')) onClose();
  };

  return (
    <div className="dialog-overlay column-picker-overlay" onClick={handleOverlayClick}>
      <div className="column-picker-dialog" onClick={e => e.stopPropagation()}>
        <div className="dialog-header">
          <h2>📊 Select columns for {chartTypeLabels[chartType] || chartType}</h2>
          <button className="dialog-close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="dialog-body">
          <div className="column-picker-component">
            <span className="component-icon">⚡</span>
            <span>{component?.name || 'Component'}</span>
          </div>
          {error && (
            <div className="dialog-error">⚠️ {error}</div>
          )}
          <div className="dialog-section">
            <label className="dialog-label">X-Axis Column</label>
            <select
              className="dialog-select"
              value={xColumn}
              onChange={e => setXColumn(e.target.value)}
            >
              <option value="">-- Select X Column --</option>
              {columns.map(col => (
                <option key={col} value={col}>{col}</option>
              ))}
            </select>
          </div>
          <div className="dialog-section">
            <label className="dialog-label">Y-Axis Column</label>
            <select
              className="dialog-select"
              value={yColumn}
              onChange={e => setYColumn(e.target.value)}
            >
              <option value="">-- Select Y Column --</option>
              {columns.map(col => (
                <option key={col} value={col}>{col}</option>
              ))}
            </select>
          </div>
          <div className="dialog-section">
            <label className="dialog-label">Chart Title (optional)</label>
            <input
              type="text"
              className="dialog-input"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={`e.g. ${component?.name || 'Component'} - ${yColumn || 'value'}`}
            />
          </div>
          {chartType === '2d' && (
            <div className="dialog-section column-picker-embed-note">
              <label className="dialog-checkbox-row">
                <input
                  type="checkbox"
                  checked={alsoOpenInPanel}
                  onChange={e => setAlsoOpenInPanel(e.target.checked)}
                />
                <span>Also open full chart in plot panel</span>
              </label>
              <p className="dialog-hint">
                By default a minimal sparkline is drawn on the component only (no panel chart).
              </p>
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
            disabled={!xColumn || !yColumn}
          >
            {chartType === '2d' ? '✓ Add sparkline' : '✓ Add Chart'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ColumnPickerDialog;
