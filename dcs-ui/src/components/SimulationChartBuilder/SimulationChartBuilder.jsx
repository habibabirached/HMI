/**
 * SimulationChartBuilder - Shows when a simulation is loaded.
 * Two columns: CSV titles | Plot types.
 * When user picks a plot type, dims everything except titles, cursor hint guides selection.
 */
import React, { useState, useEffect } from 'react';
import './SimulationChartBuilder.css';

/** Excel-style column letter: 0->a, 1->b, ..., 26->aa, 27->ab, ... */
function getExcelColumnLetter(index) {
  let result = '';
  let n = index;
  while (n >= 0) {
    result = String.fromCharCode(97 + (n % 26)) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
}

const CHART_TYPES = [
  { id: '2d', label: '2D Plot', icon: '📈', selections: [{ hint: 'Pick X axis' }, { hint: 'Pick Y axis' }] },
  { id: 'nd', label: 'nD Plot', icon: '📉', selections: null }, // Variable: X + Y1, Y2, ... Yn; user clicks "Done" when finished
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
  const isNdChart = currentChart?.id === 'nd';
  const needed = isNdChart ? null : (currentChart?.selections?.length ?? 0);
  const step = selections.length;
  const inSelectionMode = isNdChart
    ? !!selectedChartType && (step < 1 || true) // nd: stay in mode until Done; need at least X
    : !!(selectedChartType && needed > 0 && step < needed);

  const ndHint = step === 0 ? 'Pick X axis' : step === 1 ? 'Pick Y1' : `Pick Y${step} (or click Done)`;

  useEffect(() => {
    if (inSelectionMode) {
      const hintText = isNdChart ? ndHint : currentChart?.selections?.[step]?.hint ?? '';
      setCursorHint(prev => ({ ...prev, text: hintText, visible: true }));
    } else {
      setCursorHint(prev => ({ ...prev, visible: false }));
    }
  }, [inSelectionMode, step, currentChart, isNdChart, ndHint]);

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
    if (!currentChart) return;
    if (!isNdChart && step >= needed) return;
    if (selections.includes(col)) return; // No duplicate columns
    const next = [...selections, col];
    setSelections(next);
    if (!isNdChart && next.length >= needed) {
      const chart = { chartType: selectedChartType, selections: next };
      onAddChart(chart);
      setSelectedChartType(null);
      setSelections([]);
    }
  };

  const handleNdDone = () => {
    if (!isNdChart || selections.length < 2) return; // Need X + at least 1 Y
    const chart = { chartType: 'nd', selections };
    onAddChart(chart);
    setSelectedChartType(null);
    setSelections([]);
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
        <div className="sim-chart-builder-header-actions">
          {isNdChart && inSelectionMode && selections.length >= 2 && (
            <button className="sim-chart-builder-done" onClick={handleNdDone} title="Create chart with selected columns">
              ✓ Done
            </button>
          )}
          {inSelectionMode && (
            <button className="sim-chart-builder-cancel" onClick={handleCancelSelection} title="Cancel">
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="sim-chart-builder-columns">
        {/* Titles column */}
        <div className={`sim-chart-builder-col sim-chart-builder-titles ${inSelectionMode ? 'sim-chart-builder-lit' : ''}`}>
          <div className="sim-chart-builder-col-header-row">
            <h4>Columns</h4>
            {isNdChart && inSelectionMode && selections.length >= 2 && (
              <button
                type="button"
                className="sim-chart-builder-done sim-chart-builder-done-top"
                onClick={handleNdDone}
                title="Create chart with selected columns"
              >
                ✓ Done
              </button>
            )}
          </div>
          <div className="sim-chart-builder-list">
            {columns.map((col, colIndex) => {
              const idx = selections.indexOf(col);
              const isSelected = idx >= 0;
              const roleLabel = isNdChart
                ? (idx === 0 ? 'X ✓' : `Y${idx} ✓`)
                : (currentChart?.selections?.[idx]?.hint?.replace('Pick ', '') + ' ✓');
              const label = isSelected ? roleLabel : col;
              return (
                <div key={col} className="sim-chart-builder-item-row">
                  {inSelectionMode && (
                    <span className="sim-chart-builder-item-letter" title={`Column ${getExcelColumnLetter(colIndex)}`}>
                      {getExcelColumnLetter(colIndex)}
                    </span>
                  )}
                  <button
                    type="button"
                    className={`sim-chart-builder-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleTitleClick(col)}
                    disabled={!inSelectionMode}
                    title={col}
                  >
                    {label}
                  </button>
                </div>
              );
            })}
            {isNdChart && inSelectionMode && selections.length >= 2 && (
              <div className="sim-chart-builder-done-footer">
                <button
                  type="button"
                  className="sim-chart-builder-done sim-chart-builder-done-inline"
                  onClick={handleNdDone}
                  title="Create chart with selected columns"
                >
                  ✓ Done
                </button>
              </div>
            )}
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
                title={ct.id === 'nd' ? 'Pick X, then Y1, Y2... click Done when finished' : (ct.selections?.length === 1 ? 'Pick 1 column' : `Pick ${ct.selections?.length} columns (first = X, second = Y)`)}
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
