/**
 * Build Plotly traces for ensemble charts where each axis/series may come from a different member scenario.
 * Rows are aligned by index (0..n-1) across members, like a virtual join on row number.
 */
import { parseEnsembleColumnSelections } from './simulationLazyApi';
import { cellFloat } from './csvRowAccess';

const CHART_COLORS = ['#005E60', '#FF6B35', '#4ECDC4', '#F7B731', '#5F27CD', '#00D2FF', '#C23616', '#0FB9B1'];
const SELECTION_HIGHLIGHT_COLOR = '#FFD700';
const SELECTION_MARKER_SIZE = 10;

export function getCrossMemberBindingsForChart(chart) {
  const parts = [chart.xColumn, chart.yColumn, ...(chart.yColumns || [])].filter(
    (x) => x != null && x !== '',
  );
  if (!parts.length) return null;
  return parseEnsembleColumnSelections(parts)?.items ?? null;
}

export function crossMemberDataReady(chart, ensembleMemberSimulationData) {
  if (!chart?.ensembleCrossMember || !ensembleMemberSimulationData) return false;
  const items = getCrossMemberBindingsForChart(chart);
  if (!items?.length) return false;
  for (const { simId } of items) {
    const rows = ensembleMemberSimulationData[simId];
    if (!rows?.length) return false;
  }
  return true;
}

/** X member’s row count for layout / uirevision when no single merged table exists. */
export function crossMemberReferenceLength(chart, ensembleMemberSimulationData) {
  const items = getCrossMemberBindingsForChart(chart);
  if (!items?.length) return 0;
  const { simId } = items[0];
  return ensembleMemberSimulationData?.[simId]?.length ?? 0;
}

/** For Plotly layout / uirevision: one member’s row array (X axis) when there is no merged table. */
export function layoutDataForEnsembleCrossChart(chart, memberData) {
  const items = getCrossMemberBindingsForChart(chart);
  if (!items?.length) return [];
  return memberData?.[items[0].simId] || [];
}

function buildSteppedRowIndices(nMin, items, memberData, simulationRunning, simulationTime, sampleStep) {
  let rowIdx = Array.from({ length: nMin }, (_, i) => i);
  if (simulationRunning && simulationTime !== undefined) {
    const x0 = items[0];
    const rows = memberData[x0.simId];
    rowIdx = rowIdx.filter((i) => {
      const v = cellFloat(rows[i], x0.column);
      return !Number.isNaN(v) && v <= simulationTime;
    });
  }
  const step = sampleStep > 1 ? sampleStep : 1;
  if (step > 1) {
    rowIdx = rowIdx.filter((_, j) => j % step === 0);
  }
  return rowIdx;
}

function mapYForIndices(rowIdx, simId, column, memberData) {
  const rows = memberData[simId];
  return rowIdx.map((i) => cellFloat(rows[i], column) || 0);
}

function mapXForIndices(rowIdx, simId, column, memberData) {
  const rows = memberData[simId];
  return rowIdx.map((i) => cellFloat(rows[i], column) || 0);
}

/**
 * @param {object} params
 * @param {object} params.chart
 * @param {Record<string, object[]>} params.memberData
 * @param {number} [params.sampleStep]
 * @param {boolean} [params.simulationRunning]
 * @param {number} [params.simulationTime]
 * @param {Set<number>|Set} [params.selectedRowIndices]
 * @param {string} [params.lineColor]
 */
export function buildCross2dTraces({
  chart,
  memberData,
  sampleStep = 1,
  simulationRunning,
  simulationTime,
  selectedRowIndices,
  lineColor = '#005E60',
}) {
  const items = getCrossMemberBindingsForChart(chart);
  if (!items || items.length < 2) return [];
  const nMin = Math.min(...items.map(({ simId }) => memberData[simId]?.length ?? 0));
  if (nMin <= 0) return [];
  const rowIdx = buildSteppedRowIndices(nMin, items, memberData, simulationRunning, simulationTime, sampleStep);
  const [xb, yb] = [items[0], items[1]];
  const xValues = mapXForIndices(rowIdx, xb.simId, xb.column, memberData);
  const yValues = mapYForIndices(rowIdx, yb.simId, yb.column, memberData);
  const hasSelection = selectedRowIndices && selectedRowIndices.size > 0;
  const selectedSet = selectedRowIndices instanceof Set ? selectedRowIndices : new Set(selectedRowIndices || []);
  return [
    {
      x: xValues,
      y: yValues,
      customdata: rowIdx,
      type: 'scatter',
      mode: 'lines+markers',
      name: chart.componentName,
      line: { color: lineColor, width: 2 },
      marker: hasSelection
        ? {
            color: rowIdx.map((ri) => (selectedSet.has(ri) ? SELECTION_HIGHLIGHT_COLOR : lineColor)),
            size: rowIdx.map((ri) => (selectedSet.has(ri) ? SELECTION_MARKER_SIZE : 4)),
            opacity: rowIdx.map((ri) => (selectedSet.has(ri) ? 1 : 0.15)),
          }
        : { color: lineColor, size: 4, opacity: 0.7 },
    },
  ];
}

/**
 * nD: first binding = X, rest = Y traces.
 */
export function buildCrossNdTraces({
  chart,
  memberData,
  sampleStep = 1,
  simulationRunning,
  simulationTime,
  selectedRowIndices,
}) {
  const items = getCrossMemberBindingsForChart(chart);
  if (!items || items.length < 2) return [];
  const nMin = Math.min(...items.map(({ simId }) => memberData[simId]?.length ?? 0));
  if (nMin <= 0) return [];
  const rowIdx = buildSteppedRowIndices(nMin, items, memberData, simulationRunning, simulationTime, sampleStep);
  const [xItem, ...yItems] = items;
  const xValues = mapXForIndices(rowIdx, xItem.simId, xItem.column, memberData);
  const hasSelection = selectedRowIndices && selectedRowIndices.size > 0;
  const selectedSet = selectedRowIndices instanceof Set ? selectedRowIndices : new Set(selectedRowIndices || []);

  return yItems.map((yb, index) => {
    const lineColor = CHART_COLORS[index % CHART_COLORS.length];
    const yValues = mapYForIndices(rowIdx, yb.simId, yb.column, memberData);
    const yLabel = chart.yColumns?.[index] ?? yb.column;
    return {
      x: xValues,
      y: yValues,
      customdata: rowIdx,
      type: 'scatter',
      mode: 'lines+markers',
      name: yLabel,
      line: { color: lineColor, width: 2 },
      marker: hasSelection
        ? {
            color: rowIdx.map((ri) => (selectedSet.has(ri) ? SELECTION_HIGHLIGHT_COLOR : lineColor)),
            size: rowIdx.map((ri) => (selectedSet.has(ri) ? SELECTION_MARKER_SIZE : 4)),
            opacity: rowIdx.map((ri) => (selectedSet.has(ri) ? 1 : 0.15)),
          }
        : { color: lineColor, size: 4, opacity: 0.7 },
    };
  });
}

/**
 * Stacked nD: same as generateStackedNdChartData but Y columns may live on different members; X is row 0’s column.
 * `groupFn` = (yColumns, splitBy, manualGroupBreaks) => groups
 */
export function buildCrossStackedNdTraces({
  chart,
  memberData,
  sampleStep = 1,
  simulationRunning,
  simulationTime,
  selectedRowIndices,
  groupFn,
}) {
  const items = getCrossMemberBindingsForChart(chart);
  if (!items || items.length < 2) return [];
  const nMin = Math.min(...items.map(({ simId }) => memberData[simId]?.length ?? 0));
  if (nMin <= 0) return [];
  const rowIdx = buildSteppedRowIndices(nMin, items, memberData, simulationRunning, simulationTime, sampleStep);
  const [xItem, ...yItems] = items;
  const xValues = mapXForIndices(rowIdx, xItem.simId, xItem.column, memberData);
  const yColsQ = chart.yColumns || [];
  const yLabelToItem = new Map();
  for (let j = 0; j < yItems.length; j += 1) {
    yLabelToItem.set(yColsQ[j] || yItems[j].column, yItems[j]);
  }
  const groups = groupFn(yColsQ, chart.splitBy || 'phase', chart.manualGroupBreaks);
  if (!groups.length) return [];
  const hasSelection = selectedRowIndices && selectedRowIndices.size > 0;
  const selectedSet = selectedRowIndices instanceof Set ? selectedRowIndices : new Set(selectedRowIndices || []);
  const traces = [];
  groups.forEach((grp, gIdx) => {
    const yAxis = gIdx === 0 ? 'y' : `y${gIdx + 1}`;
    grp.cols.forEach((yLabel, colIdx) => {
      const yb = yLabelToItem.get(yLabel);
      if (!yb) return;
      const lineColor = CHART_COLORS[colIdx % CHART_COLORS.length];
      const yValues = mapYForIndices(rowIdx, yb.simId, yb.column, memberData);
      traces.push({
        x: xValues,
        y: yValues,
        customdata: rowIdx,
        type: 'scatter',
        mode: 'lines+markers',
        name: yLabel,
        xaxis: 'x',
        yaxis: yAxis,
        line: { color: lineColor, width: 2 },
        marker: hasSelection
          ? {
              color: rowIdx.map((ri) => (selectedSet.has(ri) ? SELECTION_HIGHLIGHT_COLOR : lineColor)),
              size: rowIdx.map((ri) => (selectedSet.has(ri) ? SELECTION_MARKER_SIZE : 4)),
              opacity: rowIdx.map((ri) => (selectedSet.has(ri) ? 1 : 0.15)),
            }
          : { color: lineColor, size: 4, opacity: 0.7 },
      });
      });
  });
  return traces;
}

/** Multi-line: timeColumn = items[0], one trace per component. X always from the time column at i. */
export function buildCrossMultiLineTraces({
  chart,
  memberData,
  sampleStep = 1,
  simulationRunning,
  simulationTime,
  selectedRowIndices,
}) {
  const tq = chart.timeColumn;
  const compCols = (chart.components || []).map((c) => c.columnName).filter(Boolean);
  if (!tq || !compCols.length) return [];
  const allStrings = [tq, ...compCols].filter(Boolean);
  const items = parseEnsembleColumnSelections(allStrings)?.items;
  if (!items || items.length < 2) return [];
  const nMin = Math.min(...items.map(({ simId }) => memberData[simId]?.length ?? 0));
  if (nMin <= 0) return [];
  const rowIdx = buildSteppedRowIndices(nMin, items, memberData, simulationRunning, simulationTime, sampleStep);
  const [tItem, ...yItems] = items;
  const xValues = mapXForIndices(rowIdx, tItem.simId, tItem.column, memberData);
  const hasSelection = selectedRowIndices && selectedRowIndices.size > 0;
  const selectedSet = selectedRowIndices instanceof Set ? selectedRowIndices : new Set(selectedRowIndices || []);
  return (chart.components || []).map((comp, index) => {
    const yb = yItems[index];
    if (!yb) return null;
    const lineColor = CHART_COLORS[index % CHART_COLORS.length];
    const yValues = mapYForIndices(rowIdx, yb.simId, yb.column, memberData);
    return {
      x: xValues,
      y: yValues,
      customdata: rowIdx,
      type: 'scatter',
      mode: 'lines+markers',
      name: comp.name,
      line: { color: lineColor, width: 2 },
      marker: hasSelection
        ? {
            color: rowIdx.map((ri) => (selectedSet.has(ri) ? SELECTION_HIGHLIGHT_COLOR : lineColor)),
            size: rowIdx.map((ri) => (selectedSet.has(ri) ? SELECTION_MARKER_SIZE : 4)),
            opacity: rowIdx.map((ri) => (selectedSet.has(ri) ? 1 : 0.15)),
          }
        : { color: lineColor, size: 4, opacity: 0.7 },
    };
  }).filter(Boolean);
}
