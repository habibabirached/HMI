import React, { useState, useEffect, useRef } from 'react';
import Plot from 'react-plotly.js';
import './ChartPanel.css';

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
 */
const ChartPanel = ({ 
  charts, 
  chartStacks = [],
  onStackCharts,
  onUnstackCharts,
  onClose, 
  onRemoveChart, 
  height, 
  onHeightChange, 
  simulationTime, 
  simulationRunning, 
  selectedComponentId,
  simulationData,
  simulationMetadata,
  eventMarkers,
  globalSampleStep = 1,
  perChartSampleStep = {},
  onGlobalSampleStepChange,
  onPerChartSampleStepChange,
  currentConfigName,
  selectedRowIndices = null,
  onSelectionChange,
  onFocus,
  isFocused
}) => {
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartRef = useRef({ y: 0, height: 0 });
  const [chartWidth, setChartWidth] = useState(500); // Base width for chart cards (min/max derived)
  const [chartData, setChartData] = useState({}); // Store fetched CSV data by chart id
  const [loadingCharts, setLoadingCharts] = useState({}); // Track loading state per chart
  const [selectedChartIds, setSelectedChartIds] = useState(new Set()); // For stack/unstack

  const SAMPLE_OPTIONS = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048];
  const getSampleStep = (chartId) => perChartSampleStep[chartId] ?? globalSampleStep ?? 1;

  /**
   * Get data for a chart: prefer simulationData (from design dir) when available
   */
  const getChartData = (chart) => {
    if (simulationData && simulationData.length > 0) {
      return simulationData;
    }
    return chartData[chart.id];
  };

  /**
   * Fetch CSV data for all charts when they change
   * Skip fetch when simulationData is provided (design dir flow)
   */
  useEffect(() => {
    if (simulationData && simulationData.length > 0) return; // Use simulationData, no fetch
    charts.forEach(chart => {
      if (!chartData[chart.id]) {
        fetchChartData(chart);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charts]);

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
      if (currentConfigName && chart.csvName && chart.csvName.endsWith('.data.csv')) {
        const simName = chart.csvName.replace('.data.csv', '');
        const response = await fetch(
          `http://localhost:5000/api/designs/${encodeURIComponent(currentConfigName)}/simulations/${encodeURIComponent(simName)}`
        );
        if (response.ok) {
          const result = await response.json();
          dataRows = result.data || [];
        }
      }
      if (!dataRows && chart.csvName) {
        const response = await fetch(`http://localhost:5000/api/csv/${chart.csvName}`);
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
          name: yCol,
          xaxis: 'x',
          yaxis: yAxis,
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
        name: yCol,
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
        const xValue = parseFloat(row[chart.xColumn]);
        return !isNaN(xValue) && xValue <= simulationTime;
      });
    }
    const step = getSampleStep(chart.id);
    const sampled = step > 1 ? filtered.filter((_, i) => i % step === 0) : filtered;
    const sampledData = sampled.map(({ row }) => row);
    const sampledRowIndices = sampled.map(({ i }) => i);

    const xValues = sampledData.map(row => row[chart.xColumn]);
    const yValues = sampledData.map(row => row[chart.yColumn]);

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
            fillcolor: markerConfig.color || 'rgba(255, 0, 0, 0.15)',
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
            fillcolor: markerConfig.color || 'rgba(255, 0, 0, 0.15)',
            line: { width: 0 },
            layer: 'below'
          });
        }
      });
    });
    
    return shapes;
  };

  /**
   * Generate professional Plotly layout
   */
  const generatePlotlyLayout = (chart, data) => {
    const baseLayout = {
      // Professional dark theme
      paper_bgcolor: '#0d0d0d',
      plot_bgcolor: '#1a1a1a',
      
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
        bgcolor: 'rgba(0, 0, 0, 0.3)',
        bordercolor: '#444',
        borderwidth: 1
      },
      
      // Hover label
      hoverlabel: {
        bgcolor: '#1a1a1a',
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
      // Alternate pitch black and normal background for distinct groups
      const groupBgColors = ['#000000', '#1a1a1a'];
      const axisStyle = {
        gridcolor: '#2a2a2a',
        gridwidth: 1,
        showline: true,
        linecolor: '#444',
        linewidth: 2,
        tickfont: { family: 'Arial, sans-serif', size: 11, color: '#999' },
        zeroline: true,
        zerolinecolor: '#444',
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
          bgcolor: 'rgba(0, 0, 0, 0.6)',
          bordercolor: '#444',
          borderwidth: 2,
          traceorder: 'normal'
        },
        margin: { l: 50, r: 200, t: 50, b: 50 },
        shapes: [...(baseLayout.shapes || []), ...shapes],
        xaxis: {
          title: { text: chart.xColumn, font: { family: 'Arial, sans-serif', size: 13, color: '#999', weight: 600 } },
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
          gridcolor: '#2a2a2a',
          gridwidth: 1,
          showline: true,
          linecolor: '#444',
          linewidth: 2,
          tickfont: { family: 'Arial, sans-serif', size: 11, color: '#999' },
          zeroline: true,
          zerolinecolor: '#444',
          zerolinewidth: 2
        },
        yaxis: {
          title: {
            text: yLabelHTML,
            font: { family: 'Arial, sans-serif', size: 13, weight: 600 }
          },
          gridcolor: '#2a2a2a',
          gridwidth: 1,
          showline: true,
          linecolor: '#444',
          linewidth: 2,
          tickfont: { family: 'Arial, sans-serif', size: 11, color: '#999' },
          zeroline: true,
          zerolinecolor: '#444',
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
          bgcolor: 'rgba(0, 0, 0, 0.5)',
          bordercolor: 'rgba(0, 94, 96, 0.5)',
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
          gridcolor: '#2a2a2a',
          gridwidth: 1,
          showline: true,
          linecolor: '#444',
          linewidth: 2,
          tickfont: {
            family: 'Arial, sans-serif',
            size: 11,
            color: '#999'
          }
        },
        yaxis: {
          title: { text: '' },
          gridcolor: '#2a2a2a',
          gridwidth: 1,
          showline: true,
          linecolor: '#444',
          linewidth: 2,
          tickfont: {
            family: 'Arial, sans-serif',
            size: 11,
            color: '#999'
          },
          zeroline: true,
          zerolinecolor: '#444',
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
          bgcolor: 'rgba(0, 0, 0, 0.5)',
          bordercolor: 'rgba(0, 94, 96, 0.5)',
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
            text: chart.xColumn,
            font: {
              family: 'Arial, sans-serif',
              size: 13,
              color: '#999',
              weight: 600
            }
          },
          gridcolor: '#2a2a2a',
          gridwidth: 1,
          showline: true,
          linecolor: '#444',
          linewidth: 2,
          tickfont: {
            family: 'Arial, sans-serif',
            size: 11,
            color: '#999'
          },
          zeroline: true,
          zerolinecolor: '#444',
          zerolinewidth: 2
        },
        yaxis: {
          title: {
            text: chart.chartType === 'nd' ? 'Value' : chart.yColumn,
            font: {
              family: 'Arial, sans-serif',
              size: 13,
              color: '#999',
              weight: 600
            }
          },
          gridcolor: '#2a2a2a',
          gridwidth: 1,
          showline: true,
          linecolor: '#444',
          linewidth: 2,
          tickfont: {
            family: 'Arial, sans-serif',
            size: 11,
            color: '#999'
          },
          zeroline: true,
          zerolinecolor: '#444',
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
          gridcolor: '#2a2a2a',
          showline: true,
          linecolor: '#444',
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
          gridcolor: '#2a2a2a',
          showline: true,
          linecolor: '#444',
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
          gridcolor: '#2a2a2a',
          showline: true,
          linecolor: '#444',
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
  const plotlyConfig = {
    // Toolbar buttons (keep select2d for cross-chart linked selection)
    displayModeBar: true,
    modeBarButtonsToRemove: ['lasso2d'],
    modeBarButtonsToAdd: [],
    
    // Responsive
    responsive: true,
    
    // Display logo
    displaylogo: false,
    
    // Toolbar position
    modeBarPosition: 'top',
    
    // Enable scroll/mouse wheel zoom
    scrollZoom: true,
    
    // Toolbar styling
    modeBarStyle: {
      bgcolor: 'rgba(0, 0, 0, 0.5)',
      color: '#999',
      activecolor: '#005E60'
    }
  };

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
    const newHeight = Math.max(200, Math.min(800, startHeight + deltaY));
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
    if (onFocus && !e.target.closest('button, select, input, a, [role="button"]')) {
      onFocus(e);
    }
  };

  return (
    <div
      className={`chart-panel ${isResizing ? 'resizing' : ''}`}
      style={{ height: `${height}px`, zIndex: isFocused ? 1100 : 1000 }}
      onMouseDown={handlePanelMouseDown}
    >
      {/* Resize Handle */}
      <div 
        className="chart-panel-resize-handle"
        onMouseDown={handleResizeStart}
      >
        <div className="chart-panel-resize-bar"></div>
      </div>

      {/* Panel Header - also draggable for resize */}
      <div className="chart-panel-header" onMouseDown={handleResizeStart}>
        <div className="chart-panel-title">
          📊 Charts ({charts.length})
        </div>
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
          <button
            type="button"
            className="chart-panel-size-arrow"
            onClick={() => setChartWidth(w => Math.max(300, w - 50))}
            disabled={chartWidth <= 300}
            title="Narrower chart windows"
          >
            ◀
          </button>
          <button
            type="button"
            className="chart-panel-size-arrow"
            onClick={() => setChartWidth(w => Math.min(900, w + 50))}
            disabled={chartWidth >= 900}
            title="Wider chart windows"
          >
            ▶
          </button>
        </div>
        <button className="chart-panel-close" onClick={onClose} title="Close Chart Panel">
          ×
        </button>
      </div>

      {/* Charts Container */}
      <div
        className="chart-panel-content"
        style={{
          '--chart-min-width': `${Math.max(200, chartWidth - 150)}px`,
          '--chart-max-width': `${Math.min(1000, chartWidth + 150)}px`
        }}
      >
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
              </div>
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
              {!loadingCharts[chart.id] && getChartData(chart) && getChartData(chart).length > 0 && (() => {
                const data = getChartData(chart);
                const plotlyData = generatePlotlyData(chart, data);
                const layout = generatePlotlyLayout(chart, data);
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
              {!loadingCharts[chart.id] && getChartData(chart) && getChartData(chart).length === 0 && (
                <div className="chart-panel-chart-empty">
                  <div className="chart-panel-empty-icon">📊</div>
                  <div>No data available</div>
                </div>
              )}
            </div>
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
                    </div>
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
                    {!loadingCharts[chart.id] && getChartData(chart) && getChartData(chart).length > 0 && (() => {
                      const data = getChartData(chart);
                      const plotlyData = generatePlotlyData(chart, data);
                      const layout = generatePlotlyLayout(chart, data);
                      const supportsSelection = chart.chartType === '2d' || chart.chartType === 'nd' || chart.chartType === 'stacked-nd' || (chart.isMultiComponent && chart.chartType === 'multi-line-chart');
                      return (
                        <Plot data={plotlyData} layout={layout} config={plotlyConfig} style={{ width: '100%', height: '100%' }} useResizeHandler={true}
                          {...(chart.isMultiComponent ? plotlyTransition : {})}
                          {...(supportsSelection && onSelectionChange ? { onInitialized: (fig, gd) => attachSelectionListeners(chart.id, gd) } : {})}
                        />
                      );
                    })()}
                    {!loadingCharts[chart.id] && getChartData(chart) && getChartData(chart).length === 0 && (
                      <div className="chart-panel-chart-empty"><div className="chart-panel-empty-icon">📊</div><div>No data available</div></div>
                    )}
                  </div>
                </div>
              );
            })()
          )
        ))}
      </div>
    </div>
  );
};

export default ChartPanel;
