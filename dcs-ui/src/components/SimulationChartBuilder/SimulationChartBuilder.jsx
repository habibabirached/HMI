/**
 * SimulationChartBuilder - Shows when a simulation is loaded.
 * Two columns: CSV titles | Plot types.
 * When user picks a plot type, dims everything except titles, cursor hint guides selection.
 */
import React, { useState, useEffect } from 'react';
import './SimulationChartBuilder.css';

const CHART_TYPES = [
  { id: '2d', label: '2D Plot', icon: '📈', selections: [{ hint: 'Pick X axis' }, { hint: 'Pick Y axis' }] },
  { id: 'histogram', label: 'Histogram', icon: '📊', selections: [{ hint: 'Pick column to bin' }] },
  { id: 'bar', label: 'Bar Chart', icon: '📊', selections: [{ hint: 'Pick X axis' }, { hint: 'Pick Y axis' }] },
  { id: 'pie', label: 'Pie Chart', icon: '🥧', selections: [{ hint: 'Pick values' }] },
  { id: 'box', label: 'Box Plot', icon: '📦', selections: [{ hint: 'Pick column' }] },
];

function SimulationChartBuilder({ columns = [], displayName, onAddChart, onCancel }) {
  const [selectedChartType, setSelectedChartType] = useState(null);
  const [selections, setSelections] = useState([]);
  const [cursorHint, setCursorHint] = useState({ x: 0, y: 0, text: '', visible: false });

  const currentChart = selectedChartType ? CHART_TYPES.find(c => c.id === selectedChartType) : null;
  const needed = currentChart?.selections?.length ?? 0;
  const step = selections.length;
  const inSelectionMode = !!(selectedChartType && step < needed);

  useEffect(() => {
    if (inSelectionMode) {
      const hintText = currentChart.selections[step].hint;
      setCursorHint(prev => ({ ...prev, text: hintText, visible: true }));
    } else {
      setCursorHint(prev => ({ ...prev, visible: false }));
    }
  }, [inSelectionMode, step, currentChart]);

  useEffect(() => {
    if (!cursorHint.visible) return;
    const onMove = (e) => setCursorHint(prev => ({ ...prev, x: e.clientX, y: e.clientY }));
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [cursorHint.visible]);

  const handleChartTypeClick = (typeId) => {
    setSelectedChartType(typeId);
    setSelections([]);
  };

  const handleTitleClick = (col) => {
    if (!currentChart || step >= needed) return;
    const next = [...selections, col];
    setSelections(next);
    if (next.length >= needed) {
      // Create chart
      const chart = { chartType: selectedChartType, selections: next };
      onAddChart(chart);
      setSelectedChartType(null);
      setSelections([]);
    }
  };

  const handleCancelSelection = () => {
    setSelectedChartType(null);
    setSelections([]);
    onCancel?.();
  };

  if (columns.length === 0) {
    return (
      <div className="sim-chart-builder">
        <div className="sim-chart-builder-header">
          <h3>📊 {displayName || 'Simulation'}</h3>
        </div>
        <div className="sim-chart-builder-empty">
          No columns available.
        </div>
      </div>
    );
  }

  return (
    <div className={`sim-chart-builder ${inSelectionMode ? 'sim-chart-builder-selecting' : ''}`}>
      <div className="sim-chart-builder-header">
        <h3>📊 {displayName || 'Simulation'}</h3>
        {inSelectionMode && (
          <button className="sim-chart-builder-cancel" onClick={handleCancelSelection} title="Cancel">
            ✕
          </button>
        )}
      </div>

      <div className="sim-chart-builder-columns">
        {/* Titles column */}
        <div className={`sim-chart-builder-col sim-chart-builder-titles ${inSelectionMode ? 'sim-chart-builder-lit' : ''}`}>
          <h4>Columns</h4>
          <div className="sim-chart-builder-list">
            {columns.map((col) => {
              const idx = selections.indexOf(col);
              const isSelected = idx >= 0;
              const label = isSelected ? (currentChart?.selections[idx]?.hint.replace('Pick ', '') + ' ✓') : col;
              return (
                <button
                  key={col}
                  type="button"
                  className={`sim-chart-builder-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleTitleClick(col)}
                  disabled={!inSelectionMode}
                  title={col}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Plot types column */}
        <div className={`sim-chart-builder-col sim-chart-builder-plots ${inSelectionMode ? 'sim-chart-builder-dim' : ''}`}>
          <h4>Plot types</h4>
          <div className="sim-chart-builder-list">
            {CHART_TYPES.map((ct) => (
              <button
                key={ct.id}
                type="button"
                className={`sim-chart-builder-plot ${selectedChartType === ct.id ? 'active' : ''}`}
                onClick={() => handleChartTypeClick(ct.id)}
                disabled={inSelectionMode}
                title={ct.selections.length === 1 ? `Pick 1 column` : `Pick ${ct.selections.length} columns (first = X, second = Y)`}
              >
                <span className="sim-chart-plot-icon">{ct.icon}</span>
                <span>{ct.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Dim overlay when selecting */}
      {inSelectionMode && (
        <div
          className="sim-chart-builder-overlay"
          onClick={handleCancelSelection}
          aria-hidden="true"
        />
      )}

      {/* Cursor-following hint */}
      {cursorHint.visible && cursorHint.text && (
        <div
          className="sim-chart-builder-hint"
          style={{ left: cursorHint.x + 16, top: cursorHint.y + 12 }}
        >
          {cursorHint.text}
        </div>
      )}
    </div>
  );
}

export default SimulationChartBuilder;
