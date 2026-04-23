/**
 * SimulationChartBuilder - Shows when a simulation is loaded.
 * Two columns: CSV titles | Plot types.
 * When user picks a plot type, dims everything except titles, cursor hint guides selection.
 * Ensemble mode: left column shows variables grouped by member scenario (same click behavior as flat list).
 */
import React, { useState, useEffect, useMemo } from 'react';
import './SimulationChartBuilder.css';
import FormulaCalculator from '../FormulaCalculator/FormulaCalculator';
import { qualifyEnsembleColumn } from '../../utils/simulationLazyApi';

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
  { id: 'stacked-nd', label: 'Stacked nD', icon: '📊', selections: null }, // X + Y columns + split by (phase/load/column)
  { id: 'histogram', label: 'Histogram', icon: '📊', selections: [{ hint: 'Pick column to bin' }] },
  { id: 'bar', label: 'Bar Chart', icon: '📊', selections: [{ hint: 'Pick X axis' }, { hint: 'Pick Y axis' }] },
  { id: 'pie', label: 'Pie Chart', icon: '🥧', selections: [{ hint: 'Pick values' }] },
  { id: 'box', label: 'Box Plot', icon: '📦', selections: [{ hint: 'Pick column' }] },
];

const SPLIT_BY_OPTIONS = [
  { id: 'phase', label: 'By phase (A/B/C)', desc: 'Groups columns containing _a_, _b_, _c_' },
  { id: 'load', label: 'By load (_1/_2/...)', desc: 'Groups columns containing _1, _2, _3' },
  { id: 'column', label: 'By column', desc: 'One subplot per Y column' },
  { id: 'manual', label: 'Manual grouping', desc: 'Click Next group after each group of Y columns' },
];

function SimulationChartBuilder({
  columns = [],
  isEnsemble = false,
  ensembleColumnGroups = [],
  derivedVariables = [],
  onAddDerivedVariable,
  displayName,
  onAddChart,
  onCancel,
}) {
  const [selectedChartType, setSelectedChartType] = useState(null);
  const [selections, setSelections] = useState([]);
  const [splitBy, setSplitBy] = useState('phase');
  const [manualGroupBreaks, setManualGroupBreaks] = useState([]); // indices where each group ends (Y columns only)
  const [cursorHint, setCursorHint] = useState({ x: 0, y: 0, text: '', visible: false });
  const [formulaCalculatorOpen, setFormulaCalculatorOpen] = useState(false);

  const currentChart = selectedChartType ? CHART_TYPES.find(c => c.id === selectedChartType) : null;
  const isNdChart = currentChart?.id === 'nd';
  const isStackedNdChart = currentChart?.id === 'stacked-nd';
  const needed = isNdChart || isStackedNdChart ? null : (currentChart?.selections?.length ?? 0);
  const step = selections.length;
  const showSplitBy = isStackedNdChart && selections.length >= 2;
  const inSelectionMode = isNdChart
    ? !!selectedChartType && (step < 1 || true) // nd: stay in mode until Done; need at least X
    : isStackedNdChart
      ? !!selectedChartType // stacked-nd: stay in mode until Done (can add columns or pick split-by)
      : !!(selectedChartType && needed > 0 && step < needed);

  const ndHint = step === 0 ? 'Pick X axis' : step === 1 ? 'Pick Y1' : `Pick Y${step} (or click Done)`;
  const stackedNdHint = step === 0 ? 'Pick X axis' : step === 1 ? 'Pick Y columns' : 'Pick more Y columns';

  useEffect(() => {
    if (inSelectionMode) {
      const hintText = isNdChart ? ndHint : isStackedNdChart ? stackedNdHint : currentChart?.selections?.[step]?.hint ?? '';
      setCursorHint(prev => ({ ...prev, text: hintText, visible: true }));
    } else {
      setCursorHint(prev => ({ ...prev, visible: false }));
    }
  }, [inSelectionMode, step, currentChart, isNdChart, isStackedNdChart, ndHint, stackedNdHint]);

  useEffect(() => {
    if (!cursorHint.visible) return;
    const onMove = (e) => setCursorHint(prev => ({ ...prev, x: e.clientX, y: e.clientY }));
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [cursorHint.visible]);

  const handleChartTypeClick = (typeId) => {
    setSelectedChartType(typeId);
    setSelections([]);
    setSplitBy('phase');
    setManualGroupBreaks([]);
  };

  const handleTitleClick = (col) => {
    if (!currentChart) return;
    if (!isNdChart && !isStackedNdChart && step >= needed) return;
    if (selections.includes(col)) return; // No duplicate columns
    const next = [...selections, col];
    setSelections(next);
    if (!isNdChart && !isStackedNdChart && next.length >= needed) {
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

  const handleStackedNdDone = () => {
    if (!isStackedNdChart || selections.length < 2) return; // Need X + at least 1 Y
    const chart = {
      chartType: 'stacked-nd',
      selections,
      splitBy,
      ...(splitBy === 'manual' ? { manualGroupBreaks: [...manualGroupBreaks] } : {})
    };
    onAddChart(chart);
    setSelectedChartType(null);
    setSelections([]);
    setSplitBy('phase');
    setManualGroupBreaks([]);
  };

  const handleNextGroup = () => {
    if (splitBy !== 'manual' || selections.length < 3) return; // Need X + at least 2 Y for first group
    setManualGroupBreaks(prev => [...prev, selections.length]);
  };

  const handleCancelSelection = () => {
    setSelectedChartType(null);
    setSelections([]);
    onCancel?.();
  };

  // Step 4: Merge CSV columns + derived variables. Derived vars: ƒ badge, formula in tooltip on hover.
  const allColumns = columns;
  const primarySimForFormula = ensembleColumnGroups?.[0]?.simId;
  const formulaByColumn = useMemo(() => {
    const m = {};
    for (const d of derivedVariables || []) {
      m[d.name] = d.formula;
      if (primarySimForFormula) {
        m[qualifyEnsembleColumn(primarySimForFormula, d.name)] = d.formula;
      }
    }
    return m;
  }, [derivedVariables, primarySimForFormula]);

  const useEnsembleColumnLayout = Boolean(isEnsemble && ensembleColumnGroups?.length > 0);

  const ensembleColumnIndex = useMemo(() => {
    const m = new Map();
    let i = 0;
    for (const g of ensembleColumnGroups || []) {
      for (const rawCol of g.columns || []) {
        m.set(`${g.simId}\0${rawCol}`, i);
        i += 1;
      }
    }
    return m;
  }, [ensembleColumnGroups]);

  const handleFormulaDone = (formula, variableName) => {
    onAddDerivedVariable?.(formula, variableName);
    setFormulaCalculatorOpen(false);
  };

  if (!useEnsembleColumnLayout && columns.length === 0) {
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

  if (useEnsembleColumnLayout && ensembleColumnIndex.size === 0) {
    return (
      <div className="sim-chart-builder">
        <div className="sim-chart-builder-header">
          <h3>{`${String.fromCodePoint(0x1f4ca)} ${displayName || 'Simulation'}`}</h3>
        </div>
        <div className="sim-chart-builder-empty">
          No columns available for this ensemble yet.
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
          {showSplitBy && (
            <button className="sim-chart-builder-done" onClick={handleStackedNdDone} title="Create stacked chart">
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
            {showSplitBy && (
              <button
                type="button"
                className="sim-chart-builder-done sim-chart-builder-done-top"
                onClick={handleStackedNdDone}
                title="Create stacked chart"
              >
                ✓ Done
              </button>
            )}
          </div>
          {/* Formula Builder button – opens calculator modal */}
          {(isNdChart || isStackedNdChart || currentChart?.id === '2d') && (
            <div className="sim-chart-builder-formula-trigger">
              <button
                type="button"
                className="sim-chart-builder-formula-btn"
                onClick={() => setFormulaCalculatorOpen(true)}
                title="Build a formula from variables"
              >
                <span className="sim-chart-builder-formula-btn-icon">ƒ</span>
                Formula Builder
              </button>
            </div>
          )}
          {showSplitBy && (
            <div className="sim-chart-builder-split-by-row">
              <span className="sim-chart-builder-split-label">Split by:</span>
              {SPLIT_BY_OPTIONS.map((opt) => (
                <label key={opt.id} className="sim-chart-builder-split-option">
                  <input
                    type="radio"
                    name="splitBy"
                    value={opt.id}
                    checked={splitBy === opt.id}
                    onChange={() => {
                      setSplitBy(opt.id);
                      if (opt.id !== 'manual') setManualGroupBreaks([]);
                    }}
                  />
                  {opt.label}
                </label>
              ))}
              {splitBy === 'manual' && (
                <button
                  type="button"
                  className="sim-chart-builder-next-group"
                  onClick={handleNextGroup}
                  disabled={selections.length < 3}
                  title="Start next group (select Y columns, then click to begin next group)"
                >
                  Next group
                </button>
              )}
            </div>
          )}
          <div className={`sim-chart-builder-list${useEnsembleColumnLayout ? ' sim-chart-builder-list--ensemble' : ''}`}>
            {useEnsembleColumnLayout ? (
              <>
                <div className="sim-chart-builder-ensemble-banner-title">Variables (ensemble)</div>
                <p className="sim-chart-builder-ensemble-hint">
                  Columns from all member scenarios. Choose a plot type, then click variables here — same
                  behavior as a single scenario tab.
                </p>
                {ensembleColumnGroups.map((g) => (
                  <div key={g.simId} className="sim-chart-builder-ensemble-group">
                    <div className="sim-chart-builder-ensemble-group-label">{g.simId}</div>
                    <div className="sim-chart-builder-ensemble-group-items">
                      {(g.columns || []).map((rawCol) => {
                        const qualified = qualifyEnsembleColumn(g.simId, rawCol);
                        const colIndex = ensembleColumnIndex.get(`${g.simId}\0${rawCol}`) ?? 0;
                        const idx = selections.indexOf(qualified);
                        const isSelected = idx >= 0;
                        const isDerived = formulaByColumn[qualified] != null;
                        const label = isSelected ? `${rawCol} \u2713` : rawCol;
                        const tooltip = isDerived ? formulaByColumn[qualified] : qualified;
                        return (
                          <div key={`${g.simId}-${rawCol}`} className="sim-chart-builder-item-row">
                            {inSelectionMode && (
                              <span
                                className={`sim-chart-builder-item-letter ${isDerived ? 'sim-chart-builder-item-derived' : ''}`}
                                title={isDerived ? 'Formula variable' : `Column ${getExcelColumnLetter(colIndex)}`}
                              >
                                {isDerived ? String.fromCharCode(402) : getExcelColumnLetter(colIndex)}
                              </span>
                            )}
                            <button
                              type="button"
                              className={`sim-chart-builder-item sim-chart-builder-item--ensemble ${isSelected ? 'selected' : ''} ${isDerived ? 'sim-chart-builder-item-derived' : ''}`}
                              onClick={() => handleTitleClick(qualified)}
                              disabled={!inSelectionMode}
                              title={tooltip}
                            >
                              {label}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {derivedVariables?.length > 0 && primarySimForFormula && (
                  <div className="sim-chart-builder-ensemble-group sim-chart-builder-ensemble-group--formula">
                    <div className="sim-chart-builder-ensemble-group-label">formula</div>
                    <div className="sim-chart-builder-ensemble-group-items">
                      {derivedVariables.map((d, di) => {
                        const qualified = qualifyEnsembleColumn(primarySimForFormula, d.name);
                        const colIndex = ensembleColumnIndex.size + di;
                        const idx = selections.indexOf(qualified);
                        const isSelected = idx >= 0;
                        const label = isSelected ? `${d.name} \u2713` : d.name;
                        return (
                          <div key={`formula-${d.name}`} className="sim-chart-builder-item-row">
                            {inSelectionMode && (
                              <span
                                className="sim-chart-builder-item-letter sim-chart-builder-item-derived"
                                title={`Formula variable · ${d.formula}`}
                              >
                                {String.fromCharCode(402)}
                              </span>
                            )}
                            <button
                              type="button"
                              className={`sim-chart-builder-item sim-chart-builder-item--ensemble ${isSelected ? 'selected' : ''} sim-chart-builder-item-derived`}
                              onClick={() => handleTitleClick(qualified)}
                              disabled={!inSelectionMode}
                              title={d.formula}
                            >
                              {label}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            ) : (
              allColumns.map((col, colIndex) => {
              const idx = selections.indexOf(col);
              const isSelected = idx >= 0;
              const isDerived = formulaByColumn[col] != null;
              const label = isSelected ? `${col} ✓` : col;
              const tooltip = isDerived ? formulaByColumn[col] : col;
              return (
                <div key={col} className="sim-chart-builder-item-row">
                  {inSelectionMode && (
                    <span
                      className={`sim-chart-builder-item-letter ${isDerived ? 'sim-chart-builder-item-derived' : ''}`}
                      title={isDerived ? 'Formula variable' : `Column ${getExcelColumnLetter(colIndex)}`}
                    >
                      {isDerived ? 'ƒ' : getExcelColumnLetter(colIndex)}
                    </span>
                  )}
                  <button
                    type="button"
                    className={`sim-chart-builder-item ${isSelected ? 'selected' : ''} ${isDerived ? 'sim-chart-builder-item-derived' : ''}`}
                    onClick={() => handleTitleClick(col)}
                    disabled={!inSelectionMode}
                    title={tooltip}
                  >
                    {label}
                  </button>
                </div>
              );
            })
            )}
            {(isNdChart && inSelectionMode && selections.length >= 2) && (
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
            {showSplitBy && (
              <div className="sim-chart-builder-done-footer">
                <button
                  type="button"
                  className="sim-chart-builder-done sim-chart-builder-done-inline"
                  onClick={handleStackedNdDone}
                  title="Create stacked chart"
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
                title={ct.id === 'nd' ? 'Pick X, then Y1, Y2... click Done when finished' : ct.id === 'stacked-nd' ? 'Pick X, Y columns, choose split (phase/load/column)' : (ct.selections?.length === 1 ? 'Pick 1 column' : `Pick ${ct.selections?.length} columns (first = X, second = Y)`)}
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

      {/* Formula Calculator modal */}
      <FormulaCalculator
        open={formulaCalculatorOpen}
        onClose={() => setFormulaCalculatorOpen(false)}
        variables={allColumns}
        onChange={(formula) => console.log('Formula:', formula)}
        onDone={handleFormulaDone}
      />
    </div>
  );
}

export default React.memo(SimulationChartBuilder);
