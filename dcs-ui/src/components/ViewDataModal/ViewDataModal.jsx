/**
 * ViewDataModal - Popup showing first 200 rows of simulation CSV data in a table.
 */
import React from 'react';
import './ViewDataModal.css';

const MAX_ROWS = 200;

function ViewDataModal({ simName, displayName, data, loading, onClose }) {
  if (loading) {
    return (
      <div className="view-data-overlay" onClick={onClose}>
        <div className="view-data-modal view-data-modal-loading" onClick={(e) => e.stopPropagation()}>
          <div className="view-data-header">
            <h2>📊 {displayName || simName}</h2>
            <button className="view-data-close" onClick={onClose}>×</button>
          </div>
          <div className="view-data-body">
            <div className="view-data-spinner"></div>
            <p className="view-data-loading-text">Loading data...</p>
          </div>
        </div>
      </div>
    );
  }
  if (!data || data.length === 0) {
    return (
      <div className="view-data-overlay" onClick={onClose}>
        <div className="view-data-modal" onClick={(e) => e.stopPropagation()}>
          <div className="view-data-header">
            <h2>📊 {displayName || simName}</h2>
            <button className="view-data-close" onClick={onClose}>×</button>
          </div>
          <div className="view-data-body">
            <p className="view-data-empty">No data to display.</p>
          </div>
        </div>
      </div>
    );
  }

  const columns = Object.keys(data[0] || {});
  const rows = data.slice(0, MAX_ROWS);
  const totalRows = data.length;
  const showingAll = rows.length >= totalRows;

  return (
    <div className="view-data-overlay" onClick={onClose}>
      <div className="view-data-modal" onClick={(e) => e.stopPropagation()}>
        <div className="view-data-header">
          <h2>📊 {displayName || simName}</h2>
          <button className="view-data-close" onClick={onClose}>×</button>
        </div>
        <div className="view-data-subtitle">
          Showing first {rows.length} of {totalRows} rows
          {!showingAll && ` (max ${MAX_ROWS})`}
        </div>
        <div className="view-data-table-wrap">
          <table className="view-data-table">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col} title={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  {columns.map((col) => (
                    <td key={col} title={String(row[col] ?? '')}>
                      {String(row[col] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default ViewDataModal;
