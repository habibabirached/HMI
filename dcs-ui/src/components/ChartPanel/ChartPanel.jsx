import React, { useState, useEffect, useRef, useMemo } from 'react';
import Plot from 'react-plotly.js';
import { API_BASE_URL } from '../../apiConfig';
import {
  CHART_PANEL_MIN_HEIGHT,
  getChartPanelMaxHeightPx,
  clampChartPanelOpacity,
  CHART_PANEL_OPACITY_DEFAULT,
} from '../../utils/chartPanelLimits';
import './ChartPanel.css';
import {
  buildCross2dTraces,
  buildCrossMultiLineTraces,
  buildCrossNdTraces,
  buildCrossStackedNdTraces,
  crossMemberDataReady,
  layoutDataForEnsembleCrossChart,
} from '../../utils/ensembleCrossMemberChart';
import { cellFloat } from '../../utils/csvRowAccess';

// Store native selection listeners per chart so we can clean up on unmount
const selectionListenersByChart = new Map();

/**
 * Chart Panel Component
 * 
 * Resizable bottom panel (like Chrome DevTools) that displays multiple charts side-by-side.
 * Uses Plotly.js for professional, scientific-grade visualizations.
 * 
 * Props:
 * - charts: Array of chart objects to display
 * - onClose: Function to close the entire panel
 * - onRemoveChart: Function to remove a specific chart
 * - height: Current panel height in pixels
 * - onHeightChange: Function to update panel height
 * - panelOpacity: Tray backdrop opacity (0.15–1)
 * - onPanelOpacityChange: (opacity) => void
 * - chartCardWidth / onChartCardWidthChange: tray chart column width (px), persisted from App
 * - onPerChartCardWidthChange(chartId, widthPx | null): this chart only; null = follow top bar (e.g. double-click resize edge)
 */
const ChartPanel = ({ 
  charts, 
  chartStacks = [],
  onStackCharts,
  onUnstackCharts,
  onClose, 
  onRemoveChart,
  onUpdateChart,
  height, 
  onHeightChange,
  panelOpacity = CHART_PANEL_OPACITY_DEFAULT,
  onPanelOpacityChange,
  chartCardWidth = 500,
  onChartCardWidthChange,
  onPerChartCardWidthChange,
  simulationTime, 
  simulationRunning, 
  selectedComponentId,
  simulationData,
  /** Per-member row tables when simulationMetadata.isEnsemble; charts use chart.ensembleSimId to pick one. */
  ensembleMemberSimulationData = null,
  /** Lazy ensemble: fetch subset columns for this chart’s member via App (avoids full GET …/simulations). */
  onEnsureEnsembleChartColumns,
  simulationMetadata,
  eventMarkers,
  globalSampleStep = 1,
  perChartSampleStep = {},
  onGlobalSampleStepChange,
  onPerChartSampleStepChange,
  currentConfigName,
  /** Prefer this for /api/designs/... paths when set (e.g. archive/leaf). */
  designCatalogPath = null,
  selectedRowIndices = null,
  onSelectionChange,
  onFocus,
  isFocused: _isFocused,
  /** Labels of saved UI presets in this scenario's .sim.json (Step 2: named snapshots). */
  namedSimulationConfigs = [],
  /** Which preset matches what is on screen after an explicit activate; cleared when the user edits charts. */
  activeNamedSimulationConfig = null,
  /** Last preset clicked; used for faded “draft” outline when the live draft no longer matches that snapshot. */
  lastNamedPresetForUi = null,
  onActivateNamedSimulationConfig,
  /** Copy a shareable URL that opens this design + scenario + this named preset on another machine. */
  onCopyNamedPresetLink,
  /** Paged scenario data: not all file rows are in memory yet. */
  onRequestMoreRows,
  /** Insets (px) so the fixed panel does not cover the left component library or right control rail. */
  insetLeft = 0,
  insetRight = 0,
}) => {
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartRef = useRef({ y: 0, height: 0 });
  /** Minimize to a thin bar; charts tray stays above the canvas (z-index) either way. */
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem('dcsChartPanelCollapsed') === '1';
    } catch {
      return false;
    }
  });
  const toggleChartCollapse = () => {
    setIsCollapsed((c) => {
      const n = !c;
      try {
        window.localStorage.setItem('dcsChartPanelCollapsed', n ? '1' : '0');
      } catch {
        /* ignore */
      }
      return n;
    });
  };
  const CHART_COLLAPSED_MIN_PX = 60;
  /** Inline label editor: { chartId, title, xLabel, yLabel } | null */
  const [editingLabels, setEditingLabels] = useState(null);

  const openLabelEditor = (chart, e) => {
    e.stopPropagation();
    const yKeys = chart.yColumns || (chart.yColumn ? [chart.yColumn] : []);
    setEditingLabels({
      chartId: chart.id,
      title: chart.title || chart.componentName || '',
      xLabel: chart.xLabel ?? chart.xColumn ?? '',
      yLabel: chart.yLabel ?? (chart.chartType === 'nd' ? 'Value' : (chart.yColumn ?? '')),
      legendLabels: yKeys.length > 1
        ? Object.fromEntries(yKeys.map((k) => [k, chart.legendLabels?.[k] ?? '']))
        : null,
    });
  };

  const commitLabelEdit = () => {
    if (!editingLabels) return;
    const legendLabels = editingLabels.legendLabels
      ? Object.fromEntries(
          Object.entries(editingLabels.legendLabels).filter(([, v]) => v.trim())
        )
      : undefined;
    onUpdateChart?.(editingLabels.chartId, {
      title: editingLabels.title,
      xLabel: editingLabels.xLabel || undefined,
      yLabel: editingLabels.yLabel || undefined,
      ...(legendLabels && Object.keys(legendLabels).length ? { legendLabels } : { legendLabels: undefined }),
    });
    setEditingLabels(null);
  };

  const renderLabelEditorForm = () => (
    <div className="chart-label-editor" onClick={(e) => e.stopPropagation()}>
      <label className="chart-label-editor-row">
        <span>Title</span>
        <input
          className="chart-label-editor-input"
          value={editingLabels.title}
          onChange={(e) => setEditingLabels((p) => ({ ...p, title: e.target.value }))}
          onKeyDown={(e) => { if (e.key === 'Enter') commitLabelEdit(); if (e.key === 'Escape') setEditingLabels(null); }}
          autoFocus
        />
      </label>
      <label className="chart-label-editor-row">
        <span>X label</span>
        <input
          className="chart-label-editor-input"
          value={editingLabels.xLabel}
          onChange={(e) => setEditingLabels((p) => ({ ...p, xLabel: e.target.value }))}
          onKeyDown={(e) => { if (e.key === 'Enter') commitLabelEdit(); if (e.key === 'Escape') setEditingLabels(null); }}
          placeholder="default (column name)"
        />
      </label>
      <label className="chart-label-editor-row">
        <span>Y label</span>
        <input
          className="chart-label-editor-input"
          value={editingLabels.yLabel}
          onChange={(e) => setEditingLabels((p) => ({ ...p, yLabel: e.target.value }))}
          onKeyDown={(e) => { if (e.key === 'Enter') commitLabelEdit(); if (e.key === 'Escape') setEditingLabels(null); }}
          placeholder="default (column name)"
        />
      </label>
      {editingLabels.legendLabels && (
        <>
          <div className="chart-label-editor-section-title">Legend labels</div>
          {Object.keys(editingLabels.legendLabels).map((colKey) => (
            <label key={colKey} className="chart-label-editor-row chart-label-editor-row--legend">
              <span className="chart-label-editor-legend-key" title={colKey}>{colKey.split(' \u2014 ').pop()}</span>
              <input
                className="chart-label-editor-input"
                value={editingLabels.legendLabels[colKey]}
                onChange={(e) => setEditingLabels((p) => ({
                  ...p,
                  legendLabels: { ...p.legendLabels, [colKey]: e.target.value },
                }))}
                onKeyDown={(e) => { if (e.key === 'Escape') setEditingLabels(null); }}
                placeholder={colKey.split(' \u2014 ').pop()}
              />
            </label>
          ))}
        </>
      )}
      <div className="chart-label-editor-actions">
        <button className="chart-label-editor-btn chart-label-editor-btn--save" onClick={commitLabelEdit}>Save</button>
        <button className="chart-label-editor-btn" onClick={() => setEditingLabels(null)}>Cancel</button>
      </div>
    </div>
  );
  /** Always above canvas / side panel stacking (10–1100); below modals (10k+). */
  const CHART_PANEL_Z_STACK = 5000;

  // Remember the browser width so “wider” can grow cards up to nearly the full screen and limits stay correct after resize.
  // During SSR we pick a neutral default; the first client paint and resize listener correct it.
  const [viewportInnerWidth, setViewportInnerWidth] = useState(
    () => (typeof window !== 'undefined' ? window.innerWidth : 1200),
  );
  useEffect(() => {
    const onResize = () => setViewportInnerWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // One chart column: tray width is viewport minus horizontal insets and panel padding.
  const chartCardMaxWidthPx = Math.max(
    320,
    viewportInnerWidth - insetLeft - insetRight - 32,
  );
  // Card CSS uses max-width ≈ chartCardWidth + 150px; clamp range so drag-resize stays sane when the window is tiny.
  const chartWidthStateMin = 200;
  const chartWidthStateMax = Math.max(chartWidthStateMin, chartCardMaxWidthPx - 150);

  useEffect(() => {
    if (!onChartCardWidthChange) return;
    const clamped = Math.min(chartCardWidth, chartWidthStateMax);
    if (clamped !== chartCardWidth) onChartCardWidthChange(clamped);
  }, [chartWidthStateMax, chartCardWidth, onChartCardWidthChange]);

  /** “How wide is THIS chart’s box?” — its own number, or if it has none, the big number from the top bar. */
  const effectiveCardWidthPx = (chart) => {
    const own = chart.chartCardWidth;
    const raw =
      own != null && Number.isFinite(Number(own)) ? Number(own) : chartCardWidth;
    const clamped = Math.min(4000, Math.max(200, Math.round(raw)));
    return Math.min(chartWidthStateMax, Math.max(chartWidthStateMin, clamped));
  };

  const cardWidthCssVars = (chart) => {
    const w = effectiveCardWidthPx(chart);
    return {
      '--chart-min-width': `${Math.max(200, w - 150)}px`,
      '--chart-max-width': `${Math.min(chartCardMaxWidthPx, w + 150)}px`,
    };
  };

  /** While you drag the right edge of one chart box: remember where the mouse started and how wide that box was. */
  const chartResizeDragRef = useRef(null);
  useEffect(() => {
    const onMove = (e) => {
      const t = chartResizeDragRef.current;
      if (!t) return;
      const next = Math.min(
        chartWidthStateMax,
        Math.max(chartWidthStateMin, Math.round(t.startW + (e.clientX - t.startX))),
      );
      if (next !== t.lastApplied) {
        t.lastApplied = next;
        onPerChartCardWidthChange?.(t.chartId, next);
      }
    };
    const endDrag = () => {
      chartResizeDragRef.current = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
    };
  }, [chartWidthStateMin, chartWidthStateMax, onPerChartCardWidthChange]);

  const chartResizeEdge = (chart) => (
    <div
      className="chart-panel-chart-resize-edge"
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        const startW = effectiveCardWidthPx(chart);
        chartResizeDragRef.current = {
          chartId: chart.id,
          startX: e.clientX,
          startW,
          lastApplied: startW,
        };
      }}
      onDoubleClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onPerChartCardWidthChange?.(chart.id, null);
      }}
      title="Drag right edge to resize · Double-click = use top-bar default width"
    />
  );

  const [chartData, setChartData] = useState({}); // Store fetched CSV data by chart id
  const [loadingCharts, setLoadingCharts] = useState({}); // Track loading state per chart
  const [selectedChartIds, setSelectedChartIds] = useState(new Set()); // For stack/unstack

  const SAMPLE_OPTIONS = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048];
  const getSampleStep = (chartId) => perChartSampleStep[chartId] ?? globalSampleStep ?? 1;

  /**
   * Get data for a chart: prefer simulationData (from design dir) when available
   */
  const getChartData = (chart) => {
    if (chart.ensembleCrossMember) {
      return null;
    }
    if (
      chart.ensembleSimId &&
      ensembleMemberSimulationData?.[chart.ensembleSimId]?.length
    ) {
      const rows = ensembleMemberSimulationData[chart.ensembleSimId];
      return rows;
    }
    if (simulationData && simulationData.length > 0) {
      return simulationData;
    }
    return chartData[chart.id];
  };

  const chartDataReadyToPlot = (chart) => {
    if (chart.ensembleCrossMember) {
      return crossMemberDataReady(chart, ensembleMemberSimulationData);
    }
    if (simulationData?.length) return getChartData(chart)?.length > 0;
    const d = getChartData(chart);
    return d && d.length > 0;
  };

  const dataForPlotlyLayout = (chart) => {
    if (chart.ensembleCrossMember && ensembleMemberSimulationData) {
      return layoutDataForEnsembleCrossChart(chart, ensembleMemberSimulationData);
    }
    return getChartData(chart);
  };

  /**
   * Fetch CSV data for all charts when they change
   * Skip fetch when simulationData is provided (design dir flow)
   */
  useEffect(() => {
    if (simulationData && simulationData.length > 0) return;
    charts.forEach((chart) => {
      if (simulationMetadata?.isEnsemble && chart.ensembleCrossMember) {
        if (!crossMemberDataReady(chart, ensembleMemberSimulationData)) {
          void onEnsureEnsembleChartColumns?.(chart);
        }
        return;
      }
      if (
        chart.ensembleSimId &&
        simulationMetadata?.isEnsemble &&
        !ensembleMemberSimulationData?.[chart.ensembleSimId]?.length
      ) {
        void onEnsureEnsembleChartColumns?.(chart);
        return;
      }
      if (
        chart.ensembleSimId &&
        ensembleMemberSimulationData?.[chart.ensembleSimId]?.length
      ) {
        return;
      }
      if (!chartData[chart.id]) {
        fetchChartData(chart);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charts, simulationData, ensembleMemberSimulationData, simulationMetadata?.isEnsemble, onEnsureEnsembleChartColumns]);

  // Clean up selection listeners when charts are removed
  useEffect(() => {
    const chartIds = new Set(charts.map(c => c.id));
    selectionListenersByChart.forEach((entry, chartId) => {
      if (!chartIds.has(chartId) && entry?.handler && entry.gd) {
        try {
          entry.gd.removeListener('plotly_selected', entry.handler);
          entry.gd.removeListener('plotly_selecting', entry.handler);
        } catch (e) { /* ignore */ }
        selectionListenersByChart.delete(chartId);
      }
    });
  }, [charts]);

  /**
   * Fetch CSV data for a specific chart
   * Uses design-dir endpoint when currentConfigName exists, else falls back to legacy /api/csv/
   */
  const fetchChartData = async (chart) => {
    setLoadingCharts(prev => ({ ...prev, [chart.id]: true }));

    try {
      let dataRows = null;
      const designPathSegment = designCatalogPath || currentConfigName;
      if (designPathSegment && chart.csvName && chart.csvName.endsWith('.data.csv')) {
        const simName = chart.csvName.replace('.data.csv', '');
        const response = await fetch(
          `${API_BASE_URL}/api/designs/${encodeURIComponent(designPathSegment)}/simulations/${encodeURIComponent(simName)}`
        );
        if (response.ok) {
          const result = await response.json();
          dataRows = result.data || [];
        }
      }
      if (!dataRows && chart.csvName) {
        const response = await fetch(`${API_BASE_URL}/api/csv/${chart.csvName}`);
        if (!response.ok) throw new Error('Failed to fetch CSV data');
        const data = await response.json();
        dataRows = data.data;
      }
      if (!dataRows) throw new Error('No data available');

      setChartData(prev => ({
        ...prev,
        [chart.id]: dataRows
      }));
      
      const chartDesc = chart.isMultiComponent 
        ? `Multi-component chart (${chart.components.length} components)` 
        : `${chart.componentName} - ${chart.chartType}`;
      console.log(`✅ Loaded data for chart: ${chartDesc}`);
    } catch (error) {
      console.error(`❌ Error loading chart data:`, error);
      setChartData(prev => ({
        ...prev,
        [chart.id]: null // Mark as error
      }));
    } finally {
      setLoadingCharts(prev => ({ ...prev, [chart.id]: false }));
    }
  };

  const CHART_COLORS = ['#005E60', '#FF6B35', '#4ECDC4', '#F7B731', '#5F27CD', '#00D2FF', '#C23616', '#0FB9B1'];
  const SELECTION_HIGHLIGHT_COLOR = '#FFD700'; // Bright gold – high contrast on dark background
  const SELECTION_MARKER_SIZE = 10;

  /**
   * Y-axis label for multi-component charts: use actual column names from CSV/Excel.
   * Plain text for bar charts; HTML with legend-like colors for multi-line.
   */
  const getMultiBarYAxisLabel = (chart) => {
    if (!chart.components || chart.components.length === 0) return 'Value';
    const columns = [...new Set(chart.components.map(c => c.columnName))];
    return columns.join(' / ');
  };

  /**
   * Y-axis label with legend colors: each column name in its trace color (P_load=teal, P_gen=orange)
   */
  const getMultiBarYAxisLabelHTML = (chart) => {
    if (!chart.components || chart.components.length === 0) return 'Value';
    return chart.components.map((c, i) =>
      `<span style="color:${CHART_COLORS[i % CHART_COLORS.length]}">${c.columnName}</span>`
    ).join(' / ');
  };

  /**
   * Compute fixed Y-axis range for multi-bar chart (so bars animate, not the scale)
   */
  const getMultiBarYRange = (chart, data) => {
    if (!data || data.length === 0) return null;
    let min = Infinity;
    let max = -Infinity;
    chart.components.forEach(comp => {
      data.forEach(row => {
        const v = parseFloat(row[comp.columnName]);
        if (!isNaN(v)) {
          min = Math.min(min, v);
          max = Math.max(max, v);
        }
      });
    });
    if (min === Infinity || max === -Infinity) return null;
    const padding = (max - min) * 0.1 || 1;
    return [min - padding, max + padding];
  };

  /**
   * Generate multi-line 2D chart – one trace per component, X = time, Y = column value
   * Adds customdata (row indices) for cross-chart selection; opacity highlights selected points
   */
  const generateMultiComponentLineChart = (chart, data) => {
    const colors = ['#005E60', '#FF6B35', '#4ECDC4', '#F7B731', '#5F27CD', '#00D2FF', '#C23616', '#0FB9B1'];
    const indexed = data.map((row, i) => ({ row, i }));
    let filtered = indexed;
    if (simulationRunning && simulationTime !== undefined) {
      filtered = indexed.filter(({ row }) => {
        const t = parseFloat(row[chart.timeColumn]);
        return !isNaN(t) && t <= simulationTime;
      });
    }
    const step = getSampleStep(chart.id);
    const sampled = step > 1 ? filtered.filter((_, i) => i % step === 0) : filtered;
    const sampledData = sampled.map(({ row }) => row);
    const sampledRowIndices = sampled.map(({ i }) => i);
    const hasSelection = selectedRowIndices && selectedRowIndices.size > 0;
    const selectedSet = selectedRowIndices instanceof Set ? selectedRowIndices : new Set(selectedRowIndices || []);

    return chart.components.map((comp, index) => {
      const lineColor = colors[index % colors.length];
      return {
        x: sampledData.map(row => parseFloat(row[chart.timeColumn]) || 0),
        y: sampledData.map(row => parseFloat(row[comp.columnName]) || 0),
        customdata: sampledRowIndices,
        type: 'scatter',
        mode: 'lines+markers',
        name: comp.name,
        line: { color: lineColor, width: 2 },
        marker: hasSelection
          ? {
              color: sampledRowIndices.map(ri => (selectedSet.has(ri) ? SELECTION_HIGHLIGHT_COLOR : lineColor)),
              size: sampledRowIndices.map(ri => (selectedSet.has(ri) ? SELECTION_MARKER_SIZE : 4)),
              opacity: sampledRowIndices.map(ri => (selectedSet.has(ri) ? 1 : 0.15))
            }
          : { color: lineColor, size: 4, opacity: 0.7 }
      };
    });
  };

  /**
   * Group Y columns by split type (phase, load, column)
   */
  const groupColumnsBySplit = (yColumns, splitBy, manualGroupBreaks) => {
    if (!yColumns?.length) return [];
    if (splitBy === 'manual') {
      if (!manualGroupBreaks?.length) return [{ key: 'Group 1', cols: yColumns }];
      const groups = [];
      let start = 0;
      for (const b of manualGroupBreaks) {
        const slice = yColumns.slice(start, b - 1);
        if (slice.length) groups.push({ key: `Group ${groups.length + 1}`, cols: slice });
        start = b - 1;
      }
      if (start < yColumns.length) {
        groups.push({ key: `Group ${groups.length + 1}`, cols: yColumns.slice(start) });
      }
      return groups.filter(g => g.cols.length > 0);
    }
    if (splitBy === 'column') {
      return yColumns.map(col => ({ key: col, cols: [col] }));
    }
    if (splitBy === 'phase') {
      const groups = {};
      yColumns.forEach(col => {
        const m = col.match(/[._-]([aAbBcC])[._-]|[._-]([aAbBcC])[\d.]|([aAbBcC])[._-]/i);
        const letter = m ? (m[1] || m[2] || m[3]).toUpperCase() : 'Other';
        if (!groups[letter]) groups[letter] = [];
        groups[letter].push(col);
      });
      const order = ['A', 'B', 'C'];
      const keys = [...order.filter(k => groups[k]?.length), ...(groups.Other?.length ? ['Other'] : [])];
      return keys.map(k => ({ key: `Phase ${k}`, cols: groups[k] }));
    }
    if (splitBy === 'load') {
      const groups = {};
      yColumns.forEach(col => {
        const m = col.match(/_(\d+)\b|\.(\d+)\b|load[_-]?(\d+)/i);
        const num = m ? (m[1] || m[2] || m[3]) : 'Other';
        if (!groups[num]) groups[num] = [];
        groups[num].push(col);
      });
      const sorted = Object.entries(groups).sort((a, b) => {
        if (a[0] === 'Other') return 1;
        if (b[0] === 'Other') return -1;
        return Number(a[0]) - Number(b[0]);
      });
      return sorted.map(([k, cols]) => ({ key: `Load ${k}`, cols: cols }));
    }
    return [{ key: 'All', cols: yColumns }];
  };

  /**
   * Generate stacked nD chart data – grouped subplots, one trace per Y column
   */
  const generateStackedNdChartData = (chart, data) => {
    const groups = groupColumnsBySplit(chart.yColumns, chart.splitBy || 'phase', chart.manualGroupBreaks);
    if (groups.length === 0) return [];

    const colors = ['#005E60', '#FF6B35', '#4ECDC4', '#F7B731', '#5F27CD', '#00D2FF', '#C23616', '#0FB9B1'];
    const indexed = data.map((row, i) => ({ row, i }));
    let filtered = indexed;
    if (simulationRunning && simulationTime !== undefined) {
      filtered = indexed.filter(({ row }) => {
        const xVal = parseFloat(row[chart.xColumn]);
        return !isNaN(xVal) && xVal <= simulationTime;
      });
    }
    const step = getSampleStep(chart.id);
    const sampled = step > 1 ? filtered.filter((_, i) => i % step === 0) : filtered;
    const sampledData = sampled.map(({ row }) => row);
    const sampledRowIndices = sampled.map(({ i }) => i);
    const xValues = sampledData.map(row => parseFloat(row[chart.xColumn]) || 0);
    const hasSelection = selectedRowIndices && selectedRowIndices.size > 0;
    const selectedSet = selectedRowIndices instanceof Set ? selectedRowIndices : new Set(selectedRowIndices || []);

    const traces = [];
    groups.forEach((grp, rowIdx) => {
      const yAxis = rowIdx === 0 ? 'y' : `y${rowIdx + 1}`;
      grp.cols.forEach((yCol, colIdx) => {
        const lineColor = colors[colIdx % colors.length];
        const yValues = sampledData.map(row => parseFloat(row[yCol]) || 0);
        traces.push({
          x: xValues,
          y: yValues,
          customdata: sampledRowIndices,
          type: 'scatter',
          mode: 'lines+markers',
          name: chart.legendLabels?.[yCol] ?? yCol,
          line: { color: lineColor, width: 2 },
          marker: hasSelection
            ? {
                color: sampledRowIndices.map(ri => (selectedSet.has(ri) ? SELECTION_HIGHLIGHT_COLOR : lineColor)),
                size: sampledRowIndices.map(ri => (selectedSet.has(ri) ? SELECTION_MARKER_SIZE : 4)),
                opacity: sampledRowIndices.map(ri => (selectedSet.has(ri) ? 1 : 0.15))
              }
            : { color: lineColor, size: 4, opacity: 0.7 }
        });
      });
    });
    return traces;
  };

  /**
   * Generate nD chart data – one trace per Y column, shared X axis
   */
  const generateNdChartData = (chart, data) => {
    const colors = ['#005E60', '#FF6B35', '#4ECDC4', '#F7B731', '#5F27CD', '#00D2FF', '#C23616', '#0FB9B1'];
    const indexed = data.map((row, i) => ({ row, i }));
    let filtered = indexed;
    if (simulationRunning && simulationTime !== undefined) {
      filtered = indexed.filter(({ row }) => {
        const xVal = parseFloat(row[chart.xColumn]);
        return !isNaN(xVal) && xVal <= simulationTime;
      });
    }
    const step = getSampleStep(chart.id);
    const sampled = step > 1 ? filtered.filter((_, i) => i % step === 0) : filtered;
    const sampledData = sampled.map(({ row }) => row);
    const sampledRowIndices = sampled.map(({ i }) => i);
    const xValues = sampledData.map(row => parseFloat(row[chart.xColumn]) || 0);
    const hasSelection = selectedRowIndices && selectedRowIndices.size > 0;
    const selectedSet = selectedRowIndices instanceof Set ? selectedRowIndices : new Set(selectedRowIndices || []);

    return chart.yColumns.map((yCol, index) => {
      const lineColor = colors[index % colors.length];
      const yValues = sampledData.map(row => parseFloat(row[yCol]) || 0);
      return {
        x: xValues,
        y: yValues,
        customdata: sampledRowIndices,
        type: 'scatter',
        mode: 'lines+markers',
        name: chart.legendLabels?.[yCol] ?? yCol,
        line: { color: lineColor, width: 2 },
        marker: hasSelection
          ? {
              color: sampledRowIndices.map(ri => (selectedSet.has(ri) ? SELECTION_HIGHLIGHT_COLOR : lineColor)),
              size: sampledRowIndices.map(ri => (selectedSet.has(ri) ? SELECTION_MARKER_SIZE : 4)),
              opacity: sampledRowIndices.map(ri => (selectedSet.has(ri) ? 1 : 0.15))
            }
          : { color: lineColor, size: 4, opacity: 0.7 }
      };
    });
  };

  /**
   * Generate multi-component bar chart data
   * Creates one bar trace per component, all sharing the same X-axis (time)
   */
  const generateMultiComponentBarChart = (chart, data) => {
    // Color palette for different components
    const colors = [
      '#005E60', // GE Vernova teal
      '#FF6B35', // Orange
      '#4ECDC4', // Turquoise
      '#F7B731', // Yellow
      '#5F27CD', // Purple
      '#00D2FF', // Cyan
      '#C23616', // Red
      '#0FB9B1'  // Green
    ];

    // Filter data based on simulation time
    let filteredData = data;
    if (simulationRunning && simulationTime !== undefined) {
      filteredData = data.filter(row => {
        const timeValue = parseFloat(row[chart.timeColumn]);
        return !isNaN(timeValue) && timeValue <= simulationTime;
      });
    }

    // Get the last data point for current time (for bar chart)
    const currentData = filteredData.length > 0 ? filteredData[filteredData.length - 1] : null;
    
    if (!currentData) return [];

    // Helper function to detect units from column name
    const detectUnits = (columnName) => {
      if (columnName.includes('_mw') || columnName.includes('power_mw')) return 'MW';
      if (columnName.includes('_kw') || columnName.includes('power_kw')) return 'kW';
      if (columnName.includes('_kv') || columnName.includes('voltage_kv')) return 'kV';
      if (columnName.includes('_v') || columnName.includes('voltage_v')) return 'V';
      if (columnName.includes('_a') || columnName.includes('current_a')) return 'A';
      if (columnName.includes('percent') || columnName.includes('_pct')) return '%';
      if (columnName.includes('temp') || columnName.includes('temperature')) return '°C';
      if (columnName.includes('_hz') || columnName.includes('freq')) return 'Hz';
      return ''; // No unit
    };

    // Create a bar trace for each component
    return chart.components.map((comp, index) => {
      const value = parseFloat(currentData[comp.columnName]) || 0;
      const units = detectUnits(comp.columnName);
      const displayValue = units ? `${value.toFixed(2)} ${units}` : value.toFixed(2);
      
      return {
        x: [comp.name], // Component name on X-axis
        y: [value], // Current value on Y-axis
        type: 'bar',
        name: comp.name,
        marker: {
          color: colors[index % colors.length],
          line: {
            color: '#000',
            width: 1
          },
          // Add gradient effect
          pattern: {
            shape: '',
            solidity: 0.5
          }
        },
        text: [displayValue],
        textposition: 'outside',
        textfont: {
          color: '#e0e0e0',
          size: 14,
          weight: 600
        },
        hovertemplate: 
          `<b>%{x}</b><br>` +
          `<b>Value:</b> ${displayValue}<br>` +
          `<b>Column:</b> ${comp.columnName}<br>` +
          `<b>Time:</b> ${currentData[chart.timeColumn]}<br>` +
          `<extra></extra>`,
        hoverlabel: {
          bgcolor: colors[index % colors.length],
          bordercolor: '#fff',
          font: {
            family: 'Arial, sans-serif',
            size: 13,
            color: '#fff'
          }
        }
      };
    });
  };

  /**
   * Generate Plotly configuration for professional scientific charts
   * Filters data based on simulation time if simulation is running
   */
  const generatePlotlyData = (chart, data) => {
    if (chart.ensembleCrossMember && simulationMetadata?.isEnsemble && ensembleMemberSimulationData) {
      const sampleStep = getSampleStep(chart.id);
      const base = {
        chart,
        memberData: ensembleMemberSimulationData,
        sampleStep,
        simulationRunning,
        simulationTime,
        selectedRowIndices,
      };
      if (chart.isMultiComponent && chart.chartType === 'multi-line-chart') {
        return buildCrossMultiLineTraces(base);
      }
      if (chart.chartType === 'nd' && chart.yColumns?.length) {
        return buildCrossNdTraces(base);
      }
      if (chart.chartType === 'stacked-nd' && chart.yColumns?.length) {
        return buildCrossStackedNdTraces({ ...base, groupFn: groupColumnsBySplit });
      }
      if (chart.chartType === '2d') {
        return buildCross2dTraces({ ...base, lineColor: '#005E60' });
      }
      if (chart.chartType === 'bar') {
        const t = buildCross2dTraces({ ...base, lineColor: '#4caf50' });
        if (!t?.[0]) return [];
        return [
          {
            type: 'bar',
            x: t[0].x?.slice(0, 50) || [],
            y: t[0].y?.slice(0, 50) || [],
            name: chart.componentName,
            customdata: t[0].customdata,
            marker: {
              color: '#4caf50',
              line: { color: '#000', width: 1 },
            },
          },
        ];
      }
    }

    if (!data || data.length === 0) return [];

    // Handle multi-component bar charts
    if (chart.isMultiComponent && chart.chartType === 'multi-bar-chart') {
      return generateMultiComponentBarChart(chart, data);
    }
    // Handle multi-line 2D charts
    if (chart.isMultiComponent && chart.chartType === 'multi-line-chart') {
      return generateMultiComponentLineChart(chart, data);
    }
    // Handle nD charts (X + multiple Y columns)
    if (chart.chartType === 'nd' && chart.yColumns?.length) {
      return generateNdChartData(chart, data);
    }
    // Handle stacked nD (subplots by phase/load/column)
    if (chart.chartType === 'stacked-nd' && chart.yColumns?.length) {
      return generateStackedNdChartData(chart, data);
    }

    // Filter data (keep row indices for cross-chart selection)
    const indexed = data.map((row, i) => ({ row, i }));
    let filtered = indexed;
    if (simulationRunning && simulationTime !== undefined) {
      filtered = indexed.filter(({ row }) => {
        const xValue = cellFloat(row, chart.xColumn);
        return !isNaN(xValue) && xValue <= simulationTime;
      });
    }
    const step = getSampleStep(chart.id);
    const sampled = step > 1 ? filtered.filter((_, i) => i % step === 0) : filtered;
    const sampledData = sampled.map(({ row }) => row);
    const sampledRowIndices = sampled.map(({ i }) => i);

    const xValues = sampledData.map((row) => cellFloat(row, chart.xColumn));
    const yValues = sampledData.map((row) => cellFloat(row, chart.yColumn));

    const hasSelection = selectedRowIndices && selectedRowIndices.size > 0;
    const selectedSet = selectedRowIndices instanceof Set ? selectedRowIndices : new Set(selectedRowIndices || []);

    switch (chart.chartType) {
      case '2d': {
        const lineColor = '#005E60';
        return [{
          x: xValues,
          y: yValues,
          customdata: sampledRowIndices,
          type: 'scatter',
          mode: 'lines+markers',
          name: chart.componentName,
          line: { color: lineColor, width: 2 },
          marker: hasSelection
            ? {
                color: sampledRowIndices.map(ri => (selectedSet.has(ri) ? SELECTION_HIGHLIGHT_COLOR : lineColor)),
                size: sampledRowIndices.map(ri => (selectedSet.has(ri) ? SELECTION_MARKER_SIZE : 4)),
                opacity: sampledRowIndices.map(ri => (selectedSet.has(ri) ? 1 : 0.15))
              }
            : { color: lineColor, size: 4, opacity: 0.7 }
        }];
      }

      case 'histogram':
        return [{
          x: yValues,
          type: 'histogram',
          name: chart.componentName,
          marker: {
            color: '#ff9800',
            line: {
              color: '#000',
              width: 1
            }
          },
          nbinsx: 30
        }];

      case 'bar':
        return [{
          x: xValues.slice(0, 50), // Limit for readability
          y: yValues.slice(0, 50),
          type: 'bar',
          name: chart.componentName,
          marker: {
            color: '#4caf50',
            line: {
              color: '#000',
              width: 1
            }
          }
        }];

      case 'pie':
        // For pie charts, aggregate data
        const aggregated = {};
        yValues.forEach(val => {
          const rounded = Math.round(val);
          aggregated[rounded] = (aggregated[rounded] || 0) + 1;
        });
        
        return [{
          labels: Object.keys(aggregated),
          values: Object.values(aggregated),
          type: 'pie',
          marker: {
            colors: ['#005E60', '#ff9800', '#4caf50', '#f44336', '#9c27b0', '#ffeb3b']
          },
          textinfo: 'label+percent',
          textfont: {
            color: '#fff',
            size: 12
          }
        }];

      case 'box':
        return [{
          y: yValues,
          type: 'box',
          name: chart.componentName,
          marker: {
            color: '#9c27b0'
          },
          line: {
            color: '#9c27b0',
            width: 2
          }
        }];

      default:
        return [{
          x: xValues,
          y: yValues,
          type: 'scatter',
          mode: 'lines',
          name: chart.componentName
        }];
    }
  };

  /**
   * Generate event marker shapes for Plotly charts
   * Creates colored background regions based on CSV event columns
   */
  const generateEventMarkerShapes = () => {
    if (!simulationData || simulationData.length === 0 || !eventMarkers) {
      return [];
    }

    const o = clampChartPanelOpacity(panelOpacity);
    const scaleEventFill = (c) => {
      const color = c || 'rgba(255, 0, 0, 0.15)';
      const m = String(color).match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/i);
      if (m) {
        const a = m[4] !== undefined ? parseFloat(m[4]) : 1;
        return `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${a * o})`;
      }
      return color;
    };

    const shapes = [];
    
    // Process each event marker definition
    Object.keys(eventMarkers).forEach(eventColumn => {
      const markerConfig = eventMarkers[eventColumn];
      let inEvent = false;
      let eventStartTime = null;
      
      // Scan through simulation data to find event regions
      // Note: CSV values are often strings ("1"/"0") from DictReader, not numbers
      simulationData.forEach((row, index) => {
        const val = row[eventColumn];
        const isActive = val === 1 || val === true || val === '1' ||
          (typeof val === 'string' && val.toLowerCase() === 'true');
        const timeValue = Number(row.time_sec) || 0;
        
        if (isActive && !inEvent) {
          // Event starts
          inEvent = true;
          eventStartTime = timeValue;
        } else if (!isActive && inEvent) {
          // Event ends - create shape
          shapes.push({
            type: 'rect',
            xref: 'x',
            yref: 'paper',
            x0: eventStartTime,
            x1: timeValue,
            y0: 0,
            y1: 1,
            fillcolor: scaleEventFill(markerConfig.color),
            line: { width: 0 },
            layer: 'below'
          });
          
          // Optional: Add vertical line at event start
          if (markerConfig.line_color) {
            shapes.push({
              type: 'line',
              xref: 'x',
              yref: 'paper',
              x0: eventStartTime,
              x1: eventStartTime,
              y0: 0,
              y1: 1,
              line: {
                color: markerConfig.line_color,
                width: 2,
                dash: 'dash'
              },
              layer: 'below'
            });
          }
          
          inEvent = false;
          eventStartTime = null;
        }
        
        // Handle event that extends to end of data
        if (inEvent && index === simulationData.length - 1) {
          shapes.push({
            type: 'rect',
            xref: 'x',
            yref: 'paper',
            x0: eventStartTime,
            x1: timeValue,
            y0: 0,
            y1: 1,
            fillcolor: scaleEventFill(markerConfig.color),
            line: { width: 0 },
            layer: 'below'
          });
        }
      });
    });
    
    return shapes;
  };

  /**
   * Token for Plotly’s layout.uirevision: hold it steady while only pane opacity or card width change so zoom/pan survive cosmetic relayouts.
   * We tie it to data identity and sample stride, but not simulationTime, so scrubbing during play does not reset the axes every tick.
   */
  const getPlotlyUiRevision = (chart, data) => {
    const step = getSampleStep(chart.id);
    const n = data?.length ?? 0;
    const sid = simulationMetadata?.id ?? '';
    const csv = chart.csvName ?? '';
    return `${chart.id}|${sid}|${csv}|${n}|${step}`;
  };

  /**
   * Generate professional Plotly layout
   */
  const generatePlotlyLayout = (chart, data) => {
    const o = clampChartPanelOpacity(panelOpacity);
    const rgba = (r, g, b, a = o) => `rgba(${r},${g},${b},${a})`;
    const paperRgba = rgba(13, 13, 13);
    const plotRgba = rgba(26, 26, 26);
    const gridRgba = rgba(42, 42, 42);
    const lineRgba = rgba(68, 68, 68);

    const baseLayout = {
      // When this string stays the same, Plotly keeps user zoom/pan across Plotly.react updates (e.g. new colors after opacity slider).
      uirevision: getPlotlyUiRevision(chart, data),
      paper_bgcolor: paperRgba,
      plot_bgcolor: plotRgba,
      
      // Title
      title: {
        text: chart.isMultiComponent ? chart.title : (chart.title || `${chart.componentName} - ${chart.chartType.toUpperCase()}`),
        font: {
          family: 'Arial, sans-serif',
          size: 16,
          color: '#e0e0e0',
          weight: 600
        },
        x: 0.5,
        xanchor: 'center'
      },
      
      // Margins
      margin: {
        l: 60,
        r: 40,
        t: 50,
        b: 60
      },
      
      // Legend
      legend: {
        font: {
          family: 'Arial, sans-serif',
          size: 11,
          color: '#999'
        },
        bgcolor: rgba(0, 0, 0, 0.35 * o),
        bordercolor: lineRgba,
        borderwidth: 1
      },
      
      // Hover label
      hoverlabel: {
        bgcolor: plotRgba,
        bordercolor: '#005E60',
        font: {
          family: 'Courier New, monospace',
          size: 12,
          color: '#e0e0e0'
        }
      },
      
      // Auto-size to fit container
      autosize: true
    };

    // Default to zoom mode; user can switch to select via toolbar
    const supportsSelection = chart.chartType === '2d' || chart.chartType === 'nd' || chart.chartType === 'stacked-nd' || (chart.isMultiComponent && chart.chartType === 'multi-line-chart');
    if (supportsSelection) {
      baseLayout.dragmode = 'zoom';
    }

    // Stacked nD layout – subplots with shared X, alternating backgrounds, Plotly legend (like nD)
    if (chart.chartType === 'stacked-nd' && chart.yColumns?.length) {
      const groups = groupColumnsBySplit(chart.yColumns, chart.splitBy || 'phase', chart.manualGroupBreaks);
      const n = groups.length;
      if (n === 0) return { ...baseLayout, xaxis: {}, yaxis: {} };

      const rowHeight = 1 / n;
      const groupBgColors = [rgba(0, 0, 0), rgba(26, 26, 26)];
      const axisStyle = {
        gridcolor: gridRgba,
        gridwidth: 1,
        showline: true,
        linecolor: lineRgba,
        linewidth: 2,
        tickfont: { family: 'Arial, sans-serif', size: 11, color: '#999' },
        zeroline: true,
        zerolinecolor: lineRgba,
        zerolinewidth: 2
      };

      const shapes = [];
      for (let i = 0; i < n; i++) {
        const top = 1 - i * rowHeight;
        const bottom = Math.max(0, 1 - (i + 1) * rowHeight);
        shapes.push({
          type: 'rect',
          xref: 'paper',
          yref: 'paper',
          x0: 0,
          y0: bottom,
          x1: 1,
          y1: top,
          fillcolor: groupBgColors[i % 2],
          line: { width: 0 },
          layer: 'below'
        });
      }

      const layout = {
        ...baseLayout,
        title: { ...baseLayout.title, text: chart.title || `${chart.componentName || ''} - Stacked nD` },
        showlegend: true,
        legend: {
          orientation: 'v',
          x: 1.02,
          xanchor: 'left',
          y: 1,
          yanchor: 'top',
          font: { family: 'Arial, sans-serif', size: 11, color: '#e0e0e0' },
          bgcolor: rgba(0, 0, 0, 0.6 * o),
          bordercolor: lineRgba,
          borderwidth: 2,
          traceorder: 'normal'
        },
        margin: { l: 50, r: 200, t: 50, b: 50 },
        shapes: [...(baseLayout.shapes || []), ...shapes],
        xaxis: {
          title: { text: chart.xLabel ?? chart.xColumn, font: { family: 'Arial, sans-serif', size: 13, color: '#999', weight: 600 } },
          domain: [0, 1],
          anchor: n === 1 ? 'y' : `y${n}`,
          ...axisStyle
        }
      };

      for (let i = 0; i < n; i++) {
        const top = 1 - i * rowHeight;
        const bottom = Math.max(0, 1 - (i + 1) * rowHeight);
        const yKey = i === 0 ? 'yaxis' : `yaxis${i + 1}`;
        layout[yKey] = {
          title: { text: groups[i].key, font: { family: 'Arial, sans-serif', size: 12, color: '#00d4a8', weight: 600 } },
          domain: [bottom, top],
          anchor: 'x',
          ...axisStyle
        };
      }
      return layout;
    }

    // Multi-line 2D chart layout – X = time, Y = values (Y-axis title in margin, legend colors)
    if (chart.isMultiComponent && chart.chartType === 'multi-line-chart') {
      const eventShapes = generateEventMarkerShapes();
      const yLabelHTML = getMultiBarYAxisLabelHTML(chart);
      return {
        ...baseLayout,
        shapes: eventShapes,
        xaxis: {
          title: {
            text: chart.timeColumn || 'Time',
            font: { family: 'Arial, sans-serif', size: 14, color: '#00d4a8', weight: 600 }
          },
          gridcolor: gridRgba,
          gridwidth: 1,
          showline: true,
          linecolor: lineRgba,
          linewidth: 2,
          tickfont: { family: 'Arial, sans-serif', size: 11, color: '#999' },
          zeroline: true,
          zerolinecolor: lineRgba,
          zerolinewidth: 2
        },
        yaxis: {
          title: {
            text: yLabelHTML,
            font: { family: 'Arial, sans-serif', size: 13, weight: 600 }
          },
          gridcolor: gridRgba,
          gridwidth: 1,
          showline: true,
          linecolor: lineRgba,
          linewidth: 2,
          tickfont: { family: 'Arial, sans-serif', size: 11, color: '#999' },
          zeroline: true,
          zerolinecolor: lineRgba,
          zerolinewidth: 2
        },
        showlegend: true,
        legend: {
          orientation: 'h',
          x: 0.5,
          xanchor: 'center',
          y: -0.15,
          yanchor: 'top',
          font: { family: 'Arial, sans-serif', size: 12, color: '#e0e0e0' },
          bgcolor: rgba(0, 0, 0, 0.5 * o),
          bordercolor: rgba(0, 94, 96, 0.5 * o),
          borderwidth: 2
        }
      };
    }

    // Multi-component bar chart layout (fixed Y range so bars animate, not scale; Y-axis label rotated 90°)
    if (chart.isMultiComponent && chart.chartType === 'multi-bar-chart') {
      const yRange = data && getMultiBarYRange(chart, data);
      const yLabel = getMultiBarYAxisLabel(chart);
      return {
        ...baseLayout,
        annotations: [
          {
            text: yLabel,
            xref: 'paper',
            yref: 'paper',
            x: 0.06,
            y: 0.5,
            xanchor: 'center',
            yanchor: 'middle',
            textangle: -90,
            showarrow: false,
            font: { family: 'Arial, sans-serif', size: 14, color: '#00d4a8', weight: 600 }
          }
        ],
        xaxis: {
          title: {
            text: 'Components',
            font: {
              family: 'Arial, sans-serif',
              size: 14,
              color: '#00d4a8',
              weight: 600
            }
          },
          gridcolor: gridRgba,
          gridwidth: 1,
          showline: true,
          linecolor: lineRgba,
          linewidth: 2,
          tickfont: {
            family: 'Arial, sans-serif',
            size: 11,
            color: '#999'
          }
        },
        yaxis: {
          title: { text: '' },
          gridcolor: gridRgba,
          gridwidth: 1,
          showline: true,
          linecolor: lineRgba,
          linewidth: 2,
          tickfont: {
            family: 'Arial, sans-serif',
            size: 11,
            color: '#999'
          },
          zeroline: true,
          zerolinecolor: lineRgba,
          zerolinewidth: 2,
          ...(yRange ? { range: yRange } : {})
        },
        barmode: 'group', // Grouped bars
        showlegend: true, // Show legend for multi-component
        legend: {
          orientation: 'h', // Horizontal legend at bottom
          x: 0.5,
          xanchor: 'center',
          y: -0.15,
          yanchor: 'top',
          font: {
            family: 'Arial, sans-serif',
            size: 12,
            color: '#e0e0e0'
          },
          bgcolor: rgba(0, 0, 0, 0.5 * o),
          bordercolor: rgba(0, 94, 96, 0.5 * o),
          borderwidth: 2
        },
        // Add annotations for component count
        annotations: [{
          text: `${chart.components.length} Components`,
          showarrow: false,
          xref: 'paper',
          yref: 'paper',
          x: 1,
          xanchor: 'right',
          y: 1.05,
          yanchor: 'bottom',
          font: {
            size: 11,
            color: '#666',
            family: 'Arial, sans-serif'
          }
        }]
      };
    }

    // Chart-specific layout
    if (chart.chartType === '2d' || chart.chartType === 'nd' || chart.chartType === 'bar') {
      const eventShapes = generateEventMarkerShapes();
      
      return {
        ...baseLayout,
        xaxis: {
          title: {
            text: chart.xLabel ?? chart.xColumn,
            font: {
              family: 'Arial, sans-serif',
              size: 13,
              color: '#999',
              weight: 600
            }
          },
          gridcolor: gridRgba,
          gridwidth: 1,
          showline: true,
          linecolor: lineRgba,
          linewidth: 2,
          tickfont: {
            family: 'Arial, sans-serif',
            size: 11,
            color: '#999'
          },
          zeroline: true,
          zerolinecolor: lineRgba,
          zerolinewidth: 2
        },
        yaxis: {
          title: {
            text: chart.yLabel ?? (chart.chartType === 'nd' ? 'Value' : chart.yColumn),
            font: {
              family: 'Arial, sans-serif',
              size: 13,
              color: '#999',
              weight: 600
            }
          },
          gridcolor: gridRgba,
          gridwidth: 1,
          showline: true,
          linecolor: lineRgba,
          linewidth: 2,
          tickfont: {
            family: 'Arial, sans-serif',
            size: 11,
            color: '#999'
          },
          zeroline: true,
          zerolinecolor: lineRgba,
          zerolinewidth: 2
        },
        shapes: eventShapes // Add event marker shapes
      };
    } else if (chart.chartType === 'histogram') {
      return {
        ...baseLayout,
        xaxis: {
          title: {
            text: chart.yColumn,
            font: {
              family: 'Arial, sans-serif',
              size: 13,
              color: '#999',
              weight: 600
            }
          },
          gridcolor: gridRgba,
          showline: true,
          linecolor: lineRgba,
          linewidth: 2,
          tickfont: {
            family: 'Arial, sans-serif',
            size: 11,
            color: '#999'
          }
        },
        yaxis: {
          title: {
            text: 'Count',
            font: {
              family: 'Arial, sans-serif',
              size: 13,
              color: '#999',
              weight: 600
            }
          },
          gridcolor: gridRgba,
          showline: true,
          linecolor: lineRgba,
          linewidth: 2,
          tickfont: {
            family: 'Arial, sans-serif',
            size: 11,
            color: '#999'
          }
        }
      };
    } else if (chart.chartType === 'box') {
      return {
        ...baseLayout,
        yaxis: {
          title: {
            text: chart.yColumn,
            font: {
              family: 'Arial, sans-serif',
              size: 13,
              color: '#999',
              weight: 600
            }
          },
          gridcolor: gridRgba,
          showline: true,
          linecolor: lineRgba,
          linewidth: 2,
          tickfont: {
            family: 'Arial, sans-serif',
            size: 11,
            color: '#999'
          }
        }
      };
    }

    return baseLayout;
  };

  /**
   * Plotly configuration for professional controls
   */
  const plotlyConfig = useMemo(() => {
    const o = clampChartPanelOpacity(panelOpacity);
    return {
      displayModeBar: true,
      modeBarButtonsToRemove: ['lasso2d'],
      modeBarButtonsToAdd: [],
      responsive: true,
      displaylogo: false,
      modeBarPosition: 'top',
      scrollZoom: true,
      modeBarStyle: {
        bgcolor: `rgba(0, 0, 0, ${0.5 * o})`,
        color: '#999',
        activecolor: '#005E60',
      },
    };
  }, [panelOpacity]);

  /**
   * Plotly transition config for smooth animations (multi-bar charts)
   */
  const plotlyTransition = {
    transition: {
      duration: 500,
      easing: 'cubic-in-out'
    },
    frame: {
      duration: 500,
      redraw: false
    }
  };

  /**
   * Handle Plotly box/lasso selection – extract row indices and sync across charts.
   * Attach native plotly_selected/plotly_selecting via onInitialized (more reliable than
   * react-plotly's onSelected/onSelecting which can fail to fire).
   */
  const attachSelectionListeners = (chartId, gd) => {
    const prev = selectionListenersByChart.get(chartId);
    if (prev?.handler && prev.gd) {
      try {
        prev.gd.removeListener('plotly_selected', prev.handler);
        prev.gd.removeListener('plotly_selecting', prev.handler);
      } catch (e) { /* ignore */ }
      selectionListenersByChart.delete(chartId);
    }
    if (!onSelectionChange) return;
    const handler = (event) => {
      if (!event?.points?.length) return;
      const indices = new Set();
      event.points.forEach((p) => {
        const trace = p.data;
        const cd = trace?.customdata;
        if (!cd) return;
        const pn = p.pointNumber ?? p.pointIndex;
        if (typeof pn !== 'number') return;
        const idx = Array.isArray(cd) ? cd[pn] : cd;
        if (typeof idx === 'number') indices.add(idx);
      });
      if (indices.size > 0) onSelectionChange(indices);
    };
    gd.on('plotly_selected', handler);
    gd.on('plotly_selecting', handler);
    selectionListenersByChart.set(chartId, { gd, handler });
  };

  /**
   * Start resizing - capture values in ref so they're available immediately
   * (avoids "duck down" where stale state caused panel to jump on first move)
   * Can be triggered from the resize handle or the header bar (except buttons/inputs).
   */
  const handleResizeStart = (e) => {
    if (isCollapsed) return;
    if (e.target.closest('button, select, input, label')) return;
    e.preventDefault();
    resizeStartRef.current = { y: e.clientY, height };
    setIsResizing(true);
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  };

  /**
   * Handle resize move - uses ref values so no jump on first move
   */
  const handleResizeMove = (e) => {
    const { y, height: startHeight } = resizeStartRef.current;
    const deltaY = y - e.clientY; // Inverted because panel grows upward
    const newHeight = Math.max(
      CHART_PANEL_MIN_HEIGHT,
      Math.min(getChartPanelMaxHeightPx(), startHeight + deltaY),
    );
    onHeightChange(newHeight);
  };

  /**
   * End resizing
   */
  const handleResizeEnd = () => {
    setIsResizing(false);
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
  };

  /**
   * Handle fullscreen toggle for a chart
   */
  const handleFullscreen = (chartId) => {
    const chartElement = document.getElementById(`chart-${chartId}`);
    if (!chartElement) return;

    if (!document.fullscreenElement) {
      // Enter fullscreen
      if (chartElement.requestFullscreen) {
        chartElement.requestFullscreen();
      } else if (chartElement.webkitRequestFullscreen) {
        chartElement.webkitRequestFullscreen(); // Safari
      } else if (chartElement.msRequestFullscreen) {
        chartElement.msRequestFullscreen(); // IE11
      }
    } else {
      // Exit fullscreen
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen(); // Safari
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen(); // IE11
      }
    }
  };

  if (!charts || charts.length === 0) {
    return null;
  }

  /** Build display structure: array of { type: 'stack'|'single', charts: Chart[], minIndex } */
  const emitted = new Set();
  const units = [];
  chartStacks.forEach(stack => {
    const stackCharts = stack.map(i => charts[i]).filter(Boolean);
    if (stackCharts.length >= 2) {
      const minIdx = Math.min(...stack);
      units.push({ type: 'stack', charts: stackCharts, minIndex: minIdx });
      stack.forEach(i => emitted.add(i));
    }
  });
  charts.forEach((chart, i) => {
    if (!emitted.has(i)) units.push({ type: 'single', charts: [chart], minIndex: i });
  });
  units.sort((a, b) => a.minIndex - b.minIndex);
  const displayUnits = units;

  const toggleChartSelection = (chartId) => {
    setSelectedChartIds(prev => {
      const next = new Set(prev);
      if (next.has(chartId)) next.delete(chartId);
      else next.add(chartId);
      return next;
    });
  };

  const handlePanelMouseDown = (e) => {
    if (
      onFocus &&
      !e.target.closest('button, select, input, a, [role="button"], .chart-panel-aot')
    ) {
      onFocus(e);
    }
  };

  const shellA = clampChartPanelOpacity(panelOpacity);

  return (
    <div
      className={`chart-panel ${isResizing ? 'resizing' : ''} chart-panel--on-top-canvas${
        isCollapsed ? ' chart-panel--collapsed' : ''
      }`}
      style={{
        left: typeof insetLeft === 'number' ? `${insetLeft}px` : undefined,
        right: typeof insetRight === 'number' ? `${insetRight}px` : undefined,
        height: isCollapsed ? 'auto' : `${height}px`,
        minHeight: isCollapsed ? CHART_COLLAPSED_MIN_PX : undefined,
        zIndex: CHART_PANEL_Z_STACK,
        '--chart-panel-shell-a': String(shellA),
        '--chart-panel-card-a': String(shellA),
        '--chart-panel-inset-left': typeof insetLeft === 'number' ? `${insetLeft}px` : '0px',
        '--chart-panel-inset-right': typeof insetRight === 'number' ? `${insetRight}px` : '0px',
      }}
      onMouseDown={handlePanelMouseDown}
    >
      {!isCollapsed && (
        <div
          className="chart-panel-resize-handle"
          onMouseDown={handleResizeStart}
        >
          <div className="chart-panel-resize-bar"></div>
        </div>
      )}

      {isCollapsed ? (
        <div
          className="chart-panel-collapsed-stack"
          onMouseDown={(e) => {
            if (e.target.closest('button:not(.chart-panel-close)')) return;
            onFocus?.(e);
          }}
        >
          <button
            type="button"
            className="chart-panel-hinge chart-panel-hinge--expand"
            onClick={(e) => {
              e.stopPropagation();
              toggleChartCollapse();
            }}
            onMouseDown={(e) => e.stopPropagation()}
            title="Click to show chart tray"
            aria-label="Expand chart tray"
          >
            <span className="chart-panel-hinge__glyph" aria-hidden>
              ▲
            </span>
            <span className="chart-panel-hinge__label">Click or tap to expand charts</span>
          </button>
          <div className="chart-panel-header chart-panel-header--collapsed">
            <div className="chart-panel-header-left">
              <div className="chart-panel-title">📊 Charts ({charts.length})</div>
            </div>
            <div className="chart-panel-header-right">
              <button
                type="button"
                className="chart-panel-close"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose?.();
                }}
                title="Close chart panel"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
      {/* Full-width hinge (like the right rail): click anywhere on the bar to minimize the tray. */}
      <button
        type="button"
        className="chart-panel-hinge chart-panel-hinge--collapse"
        onClick={(e) => {
          e.stopPropagation();
          toggleChartCollapse();
        }}
        onMouseDown={(e) => e.stopPropagation()}
        title="Click to minimize chart tray"
        aria-label="Minimize chart tray"
      >
        <span className="chart-panel-hinge__glyph" aria-hidden>
          ▼
        </span>
        <span className="chart-panel-hinge__label">Click or tap to minimize</span>
      </button>
      {/* Panel Header - also draggable for resize */}
      <div className="chart-panel-header" onMouseDown={handleResizeStart}>
        <div className="chart-panel-header-left">
          <div className="chart-panel-title">
            📊 Charts ({charts.length})
            {typeof simulationMetadata?.loadedRowCount === 'number' &&
              simulationMetadata.rowCount > simulationMetadata.loadedRowCount && (
                <span
                  className="chart-panel-paging-hint"
                  title="Initial load is a small window; more rows load as the playhead moves or you expand the time range. Use Load more to fetch the next chunk."
                >
                  · Rows in memory: {simulationMetadata.loadedRowCount} / {simulationMetadata.rowCount}
                  {onRequestMoreRows && (
                    <button
                      type="button"
                      className="chart-panel-paging-load-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRequestMoreRows();
                      }}
                    >
                      Load more
                    </button>
                  )}
                </span>
              )}
          </div>
          {/* One button per named preset; activating rewrites root + current_configuration on disk and reloads this scenario. */}
          {namedSimulationConfigs.length > 0 && onActivateNamedSimulationConfig && (
            <div className="chart-panel-named-configs" onMouseDown={(e) => e.stopPropagation()}>
              {namedSimulationConfigs.map((presetName) => {
                const isActivePreset = activeNamedSimulationConfig === presetName;
                const isDraftHint =
                  !isActivePreset &&
                  lastNamedPresetForUi === presetName &&
                  lastNamedPresetForUi != null;
                return (
                <div key={presetName} className="chart-panel-named-config-row">
                  <button
                    type="button"
                    className={`chart-panel-named-config-btn${
                      isActivePreset ? ' chart-panel-named-config-btn-active' : ''
                    }${isDraftHint ? ' chart-panel-named-config-btn-draft' : ''}`}
                    onClick={() => onActivateNamedSimulationConfig(presetName)}
                    title={
                      isActivePreset
                        ? `Loaded snapshot “${presetName}” (matches file)`
                        : isDraftHint
                          ? `Your chart draft diverged from “${presetName}”; click to reload that preset`
                          : `Load preset “${presetName}” from this scenario’s .sim.json`
                    }
                  >
                    {presetName}
                  </button>
                  {onCopyNamedPresetLink && (
                    <button
                      type="button"
                      className="chart-panel-named-config-copy-link"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCopyNamedPresetLink(presetName);
                      }}
                      title={`Copy a link that opens this design, scenario, and preset “${presetName}” (e.g. on another computer)`}
                    >
                      Copy link
                    </button>
                  )}
                </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="chart-panel-header-right">
          <div className="chart-panel-header-actions">
            {selectedChartIds.size > 0 && onStackCharts && (
              <>
                <button
                  className="chart-panel-stack-btn"
                  onClick={() => { onStackCharts(selectedChartIds); setSelectedChartIds(new Set()); }}
                  disabled={selectedChartIds.size < 2}
                  title="Stack selected charts vertically"
                >
                  Stack
                </button>
                <button
                  className="chart-panel-unstack-btn"
                  onClick={() => { onUnstackCharts?.(selectedChartIds); setSelectedChartIds(new Set()); }}
                  title="Unstack selected charts"
                >
                  Unstack
                </button>
              </>
            )}
            {selectedRowIndices && selectedRowIndices.size > 0 && (
              <button
                className="chart-panel-clear-selection"
                onClick={() => onSelectionChange?.(null)}
                title="Clear selection"
              >
                Clear selection
              </button>
            )}
            <label className="chart-panel-sample-label">
              Sample:
              <select
                className="chart-panel-sample-select"
                value={globalSampleStep}
                onChange={(e) => onGlobalSampleStepChange?.(Number(e.target.value))}
                title="Plot every Nth data point (all charts)"
              >
                {SAMPLE_OPTIONS.map((n) => (
                  <option key={n} value={n}>1 in {n}</option>
                ))}
              </select>
            </label>
            <span className="chart-panel-size-arrow-gap" />
            <div
              className="chart-panel-opacity-wrap"
              onMouseDown={(e) => e.stopPropagation()}
              title="Tray & plot opacity — 0% fully transparent; sharp (no blur)"
            >
              <span className="chart-panel-opacity-label">Pane</span>
              <input
                type="range"
                className="chart-panel-opacity-slider"
                min={0}
                max={100}
                value={Math.round(shellA * 100)}
                onChange={(e) =>
                  onPanelOpacityChange?.(Number(e.target.value) / 100)
                }
                aria-label="Chart panel opacity"
              />
            </div>
            {/* Step chart column width by 50px, clamped between chartWidthStateMin and chartWidthStateMax (viewport-based). */}
            <div
              className="chart-panel-width-controls"
              title="Chart column width — ◀ narrower, ▶ wider (all cards in the tray)"
            >
              <span className="chart-panel-width-label">Width</span>
              <button
                type="button"
                className="chart-panel-size-arrow"
                onClick={() =>
                  onChartCardWidthChange?.(
                    Math.min(
                      chartWidthStateMax,
                      Math.max(chartWidthStateMin, chartCardWidth - 50),
                    ),
                  )
                }
                disabled={chartCardWidth <= chartWidthStateMin}
                aria-label="Narrower chart windows"
              >
                ◀
              </button>
              <button
                type="button"
                className="chart-panel-size-arrow"
                onClick={() =>
                  onChartCardWidthChange?.(
                    Math.min(
                      chartWidthStateMax,
                      Math.max(chartWidthStateMin, chartCardWidth + 50),
                    ),
                  )
                }
                disabled={chartCardWidth >= chartWidthStateMax}
                aria-label="Wider chart windows"
              >
                ▶
              </button>
            </div>
          </div>
          <button className="chart-panel-close" onClick={onClose} title="Close Chart Panel">
            ×
          </button>
        </div>
      </div>

      {/* Each chart sets its own --chart-* vars (own width or top-bar default). */}
      <div className="chart-panel-content">
        {displayUnits.map((unit) => (
          unit.type === 'stack' ? (
            <div key={`stack-${unit.charts.map(c => c.id).join('-')}`} className="chart-panel-stack">
              {unit.charts.map((chart) => {
                const isHighlighted = selectedComponentId === chart.componentId;
                const isSelected = selectedChartIds.has(chart.id);
                return (
                  <div 
                    key={chart.id} 
                    id={`chart-${chart.id}`} 
                    className={`chart-panel-chart chart-in-stack ${isHighlighted ? 'highlighted' : ''} ${isSelected ? 'selected' : ''}`}
                    style={cardWidthCssVars(chart)}
                  >
                    <div className="chart-panel-chart-header">
                      <input
                        type="checkbox"
                        className="chart-panel-chart-checkbox"
                        checked={isSelected}
                        onChange={() => toggleChartSelection(chart.id)}
                        onClick={(e) => e.stopPropagation()}
                        title="Select for stack/unstack"
                      />
                      <div className="chart-panel-chart-title">
                <span className="chart-panel-chart-icon">
                  {chart.isMultiComponent && (chart.chartType === 'multi-line-chart' ? '📈' : '📊')}
                  {!chart.isMultiComponent && chart.chartType === '2d' && '📈'}
                  {!chart.isMultiComponent && chart.chartType === 'nd' && '📉'}
                  {!chart.isMultiComponent && chart.chartType === 'stacked-nd' && '📊'}
                  {!chart.isMultiComponent && chart.chartType === 'histogram' && '📊'}
                  {!chart.isMultiComponent && chart.chartType === 'pie' && '🥧'}
                  {!chart.isMultiComponent && chart.chartType === 'bar' && '📊'}
                  {!chart.isMultiComponent && chart.chartType === '3d' && '🗻'}
                  {!chart.isMultiComponent && chart.chartType === 'heatmap' && '🔥'}
                  {!chart.isMultiComponent && chart.chartType === 'box' && '📦'}
                </span>
                <span className="chart-panel-chart-name">
                  {chart.isMultiComponent ? chart.title : (chart.title || chart.componentName)}
                </span>
                {onUpdateChart && (
                  <button
                    className="chart-label-edit-btn"
                    onClick={(e) => openLabelEditor(chart, e)}
                    title="Edit title and axis labels"
                  >✎</button>
                )}
              </div>
              {editingLabels?.chartId === chart.id && renderLabelEditorForm()}
              <select
                className="chart-panel-chart-sample"
                value={getSampleStep(chart.id)}
                onChange={(e) => onPerChartSampleStepChange?.(chart.id, Number(e.target.value))}
                title="Plot every Nth point (this chart)"
              >
                {SAMPLE_OPTIONS.map((n) => (
                  <option key={n} value={n}>1 in {n}</option>
                ))}
              </select>
              <button 
                className="chart-panel-chart-close"
                onClick={() => onRemoveChart(chart.id)}
                title="Remove Chart"
              >
                ×
              </button>
            </div>
            <div className="chart-panel-chart-body">
              {/* Fullscreen Button */}
              <button
                className="chart-panel-fullscreen-btn"
                onClick={() => handleFullscreen(chart.id)}
                title="Fullscreen (F)"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M1.5 1a.5.5 0 0 0-.5.5v4a.5.5 0 0 1-1 0v-4A1.5 1.5 0 0 1 1.5 0h4a.5.5 0 0 1 0 1h-4zM10 .5a.5.5 0 0 1 .5-.5h4A1.5 1.5 0 0 1 16 1.5v4a.5.5 0 0 1-1 0v-4a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 1-.5-.5zM.5 10a.5.5 0 0 1 .5.5v4a.5.5 0 0 0 .5.5h4a.5.5 0 0 1 0 1h-4A1.5 1.5 0 0 1 0 14.5v-4a.5.5 0 0 1 .5-.5zm15 0a.5.5 0 0 1 .5.5v4a1.5 1.5 0 0 1-1.5 1.5h-4a.5.5 0 0 1 0-1h4a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 1 .5-.5z"/>
                </svg>
              </button>

              {/* Loading State (only when fetching CSV, not when using simulationData) */}
              {!simulationData?.length && loadingCharts[chart.id] && (
                <div className="chart-panel-chart-loading">
                  <div className="chart-panel-spinner"></div>
                  <div>Loading chart data...</div>
                </div>
              )}

              {/* Error State (fetch failed when not using simulationData) */}
              {!simulationData?.length && !loadingCharts[chart.id] && chartData[chart.id] === null && (
                <div className="chart-panel-chart-error">
                  <div className="chart-panel-error-icon">⚠️</div>
                  <div>Failed to load chart data</div>
                </div>
              )}

              {/* Render Plotly Chart */}
              {!loadingCharts[chart.id] && chartDataReadyToPlot(chart) && (() => {
                const data = getChartData(chart);
                const dataLayout = dataForPlotlyLayout(chart);
                const plotlyData = generatePlotlyData(chart, data);
                const layout = generatePlotlyLayout(chart, dataLayout);
                const supportsSelection = chart.chartType === '2d' || chart.chartType === 'nd' || chart.chartType === 'stacked-nd' || (chart.isMultiComponent && chart.chartType === 'multi-line-chart');
                return (
                  <Plot
                    data={plotlyData}
                    layout={layout}
                    config={plotlyConfig}
                    style={{ width: '100%', height: '100%' }}
                    useResizeHandler={true}
                    {...(chart.isMultiComponent ? plotlyTransition : {})}
                    {...(supportsSelection && onSelectionChange ? {
                      onInitialized: (fig, gd) => attachSelectionListeners(chart.id, gd)
                    } : {})}
                  />
                );
              })()}

              {/* Empty State */}
              {!loadingCharts[chart.id] && !chartDataReadyToPlot(chart) && (
                <div className="chart-panel-chart-empty">
                  <div className="chart-panel-empty-icon">📊</div>
                  <div>No data available</div>
                </div>
              )}
            </div>
            {chartResizeEdge(chart)}
          </div>
                );
              })}
            </div>
          ) : (
            (() => {
              const chart = unit.charts[0];
              const isHighlighted = selectedComponentId === chart.componentId;
              const isSelected = selectedChartIds.has(chart.id);
              return (
                <div
                  key={chart.id}
                  id={`chart-${chart.id}`}
                  className={`chart-panel-chart ${isHighlighted ? 'highlighted' : ''} ${isSelected ? 'selected' : ''}`}
                  style={cardWidthCssVars(chart)}
                >
                  <div className="chart-panel-chart-header">
                    <input
                      type="checkbox"
                      className="chart-panel-chart-checkbox"
                      checked={isSelected}
                      onChange={() => toggleChartSelection(chart.id)}
                      onClick={(e) => e.stopPropagation()}
                      title="Select for stack/unstack"
                    />
                    <div className="chart-panel-chart-title">
                      <span className="chart-panel-chart-icon">
                        {chart.isMultiComponent && (chart.chartType === 'multi-line-chart' ? '📈' : '📊')}
                        {!chart.isMultiComponent && chart.chartType === '2d' && '📈'}
                        {!chart.isMultiComponent && chart.chartType === 'nd' && '📉'}
                        {!chart.isMultiComponent && chart.chartType === 'histogram' && '📊'}
                        {!chart.isMultiComponent && chart.chartType === 'pie' && '🥧'}
                        {!chart.isMultiComponent && chart.chartType === 'bar' && '📊'}
                        {!chart.isMultiComponent && chart.chartType === '3d' && '🗻'}
                        {!chart.isMultiComponent && chart.chartType === 'heatmap' && '🔥'}
                        {!chart.isMultiComponent && chart.chartType === 'box' && '📦'}
                      </span>
                      <span className="chart-panel-chart-name">
                        {chart.isMultiComponent ? chart.title : (chart.title || chart.componentName)}
                      </span>
                      {onUpdateChart && (
                        <button
                          className="chart-label-edit-btn"
                          onClick={(e) => openLabelEditor(chart, e)}
                          title="Edit title and axis labels"
                        >✎</button>
                      )}
                    </div>
                    {editingLabels?.chartId === chart.id && renderLabelEditorForm()}
                    <select
                      className="chart-panel-chart-sample"
                      value={getSampleStep(chart.id)}
                      onChange={(e) => onPerChartSampleStepChange?.(chart.id, Number(e.target.value))}
                      title="Plot every Nth point (this chart)"
                    >
                      {SAMPLE_OPTIONS.map((n) => (
                        <option key={n} value={n}>1 in {n}</option>
                      ))}
                    </select>
                    <button className="chart-panel-chart-close" onClick={() => onRemoveChart(chart.id)} title="Remove Chart">×</button>
                  </div>
                  <div className="chart-panel-chart-body">
                    <button className="chart-panel-fullscreen-btn" onClick={() => handleFullscreen(chart.id)} title="Fullscreen (F)">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M1.5 1a.5.5 0 0 0-.5.5v4a.5.5 0 0 1-1 0v-4A1.5 1.5 0 0 1 1.5 0h4a.5.5 0 0 1 0 1h-4zM10 .5a.5.5 0 0 1 .5-.5h4A1.5 1.5 0 0 1 16 1.5v4a.5.5 0 0 1-1 0v-4a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 1-.5-.5zM.5 10a.5.5 0 0 1 .5.5v4a.5.5 0 0 0 .5.5h4a.5.5 0 0 1 0 1h-4A1.5 1.5 0 0 1 0 14.5v-4a.5.5 0 0 1 .5-.5zm15 0a.5.5 0 0 1 .5.5v4a1.5 1.5 0 0 1-1.5 1.5h-4a.5.5 0 0 1 0-1h4a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 1 .5-.5z"/>
                      </svg>
                    </button>
                    {!simulationData?.length && loadingCharts[chart.id] && (
                      <div className="chart-panel-chart-loading"><div className="chart-panel-spinner"></div><div>Loading chart data...</div></div>
                    )}
                    {!simulationData?.length && !loadingCharts[chart.id] && chartData[chart.id] === null && (
                      <div className="chart-panel-chart-error"><div className="chart-panel-error-icon">⚠️</div><div>Failed to load chart data</div></div>
                    )}
                    {!loadingCharts[chart.id] && chartDataReadyToPlot(chart) && (() => {
                      const data = getChartData(chart);
                      const dataLayout = dataForPlotlyLayout(chart);
                      const plotlyData = generatePlotlyData(chart, data);
                      const layout = generatePlotlyLayout(chart, dataLayout);
                      const supportsSelection = chart.chartType === '2d' || chart.chartType === 'nd' || chart.chartType === 'stacked-nd' || (chart.isMultiComponent && chart.chartType === 'multi-line-chart');
                      return (
                        <Plot data={plotlyData} layout={layout} config={plotlyConfig} style={{ width: '100%', height: '100%' }} useResizeHandler={true}
                          {...(chart.isMultiComponent ? plotlyTransition : {})}
                          {...(supportsSelection && onSelectionChange ? { onInitialized: (fig, gd) => attachSelectionListeners(chart.id, gd) } : {})}
                        />
                      );
                    })()}
                    {!loadingCharts[chart.id] && !chartDataReadyToPlot(chart) && (
                      <div className="chart-panel-chart-empty"><div className="chart-panel-empty-icon">📊</div><div>No data available</div></div>
                    )}
                  </div>
                  {chartResizeEdge(chart)}
                </div>
              );
            })()
          )
        ))}
      </div>
        </>
      )}
    </div>
  );
};

export default ChartPanel;
