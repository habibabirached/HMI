import React, { useState, useEffect } from 'react';
import Plot from 'react-plotly.js';
import './ChartPanel.css';

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
const ChartPanel = ({ charts, onClose, onRemoveChart, height, onHeightChange, simulationTime, simulationRunning }) => {
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStartY, setResizeStartY] = useState(0);
  const [resizeStartHeight, setResizeStartHeight] = useState(0);
  const [chartData, setChartData] = useState({}); // Store fetched CSV data by chart id
  const [loadingCharts, setLoadingCharts] = useState({}); // Track loading state per chart

  /**
   * Fetch CSV data for all charts when they change
   */
  useEffect(() => {
    charts.forEach(chart => {
      if (!chartData[chart.id]) {
        fetchChartData(chart);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charts]);

  /**
   * Fetch CSV data for a specific chart
   */
  const fetchChartData = async (chart) => {
    setLoadingCharts(prev => ({ ...prev, [chart.id]: true }));

    try {
      const response = await fetch(`http://localhost:5000/api/csv/${chart.csvName}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch CSV data');
      }

      const data = await response.json();
      
      setChartData(prev => ({
        ...prev,
        [chart.id]: data.data // Store the full dataset
      }));
      
      console.log(`✅ Loaded data for chart: ${chart.componentName} - ${chart.chartType}`);
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

  /**
   * Generate Plotly configuration for professional scientific charts
   * Filters data based on simulation time if simulation is running
   */
  const generatePlotlyData = (chart, data) => {
    if (!data || data.length === 0) return [];

    // Filter data based on simulation time if simulation is running
    let filteredData = data;
    if (simulationRunning && simulationTime !== undefined) {
      // Assume X column is time in seconds
      // Only show data points where X <= simulationTime
      filteredData = data.filter(row => {
        const xValue = parseFloat(row[chart.xColumn]);
        return !isNaN(xValue) && xValue <= simulationTime;
      });
    }

    const xValues = filteredData.map(row => row[chart.xColumn]);
    const yValues = filteredData.map(row => row[chart.yColumn]);

    switch (chart.chartType) {
      case '2d':
        return [{
          x: xValues,
          y: yValues,
          type: 'scatter',
          mode: 'lines+markers',
          name: chart.componentName,
          line: {
            color: '#00bcd4',
            width: 2
          },
          marker: {
            color: '#00bcd4',
            size: 4,
            opacity: 0.7
          }
        }];

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
            colors: ['#00bcd4', '#ff9800', '#4caf50', '#f44336', '#9c27b0', '#ffeb3b']
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
   * Generate professional Plotly layout
   */
  const generatePlotlyLayout = (chart) => {
    const baseLayout = {
      // Professional dark theme
      paper_bgcolor: '#0d0d0d',
      plot_bgcolor: '#1a1a1a',
      
      // Title
      title: {
        text: `${chart.componentName} - ${chart.chartType.toUpperCase()}`,
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
        bordercolor: '#00bcd4',
        font: {
          family: 'Courier New, monospace',
          size: 12,
          color: '#e0e0e0'
        }
      },
      
      // Auto-size to fit container
      autosize: true
    };

    // Chart-specific layout
    if (chart.chartType === '2d' || chart.chartType === 'bar') {
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
            text: chart.yColumn,
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
        }
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
    // Toolbar buttons
    displayModeBar: true,
    modeBarButtonsToRemove: ['lasso2d', 'select2d'],
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
      activecolor: '#00bcd4'
    }
  };

  /**
   * Start resizing
   */
  const handleResizeStart = (e) => {
    e.preventDefault();
    setIsResizing(true);
    setResizeStartY(e.clientY);
    setResizeStartHeight(height);
    
    // Add global mouse listeners
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  };

  /**
   * Handle resize move
   */
  const handleResizeMove = (e) => {
    const deltaY = resizeStartY - e.clientY; // Inverted because panel grows upward
    const newHeight = Math.max(200, Math.min(800, resizeStartHeight + deltaY));
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

  return (
    <div 
      className={`chart-panel ${isResizing ? 'resizing' : ''}`}
      style={{ height: `${height}px` }}
    >
      {/* Resize Handle */}
      <div 
        className="chart-panel-resize-handle"
        onMouseDown={handleResizeStart}
      >
        <div className="chart-panel-resize-bar"></div>
      </div>

      {/* Panel Header */}
      <div className="chart-panel-header">
        <div className="chart-panel-title">
          📊 Charts ({charts.length})
        </div>
        <button className="chart-panel-close" onClick={onClose} title="Close Chart Panel">
          ×
        </button>
      </div>

      {/* Charts Container */}
      <div className="chart-panel-content">
        {charts.map((chart) => (
          <div key={chart.id} id={`chart-${chart.id}`} className="chart-panel-chart">
            <div className="chart-panel-chart-header">
              <div className="chart-panel-chart-title">
                <span className="chart-panel-chart-icon">
                  {chart.chartType === '2d' && '📈'}
                  {chart.chartType === 'histogram' && '📊'}
                  {chart.chartType === 'pie' && '🥧'}
                  {chart.chartType === 'bar' && '📊'}
                  {chart.chartType === '3d' && '🗻'}
                  {chart.chartType === 'heatmap' && '🔥'}
                  {chart.chartType === 'box' && '📦'}
                </span>
                <span className="chart-panel-chart-name">
                  {chart.componentName}
                </span>
                <span className="chart-panel-chart-type">
                  ({chart.chartType.toUpperCase()})
                </span>
              </div>
              <div className="chart-panel-chart-metadata">
                <span className="chart-panel-chart-csv">{chart.csvName}</span>
                <span className="chart-panel-chart-separator">•</span>
                <span className="chart-panel-chart-axes">
                  X: {chart.xColumn} / Y: {chart.yColumn}
                </span>
              </div>
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

              {/* Loading State */}
              {loadingCharts[chart.id] && (
                <div className="chart-panel-chart-loading">
                  <div className="chart-panel-spinner"></div>
                  <div>Loading chart data...</div>
                </div>
              )}

              {/* Error State */}
              {!loadingCharts[chart.id] && chartData[chart.id] === null && (
                <div className="chart-panel-chart-error">
                  <div className="chart-panel-error-icon">⚠️</div>
                  <div>Failed to load chart data</div>
                </div>
              )}

              {/* Render Plotly Chart */}
              {!loadingCharts[chart.id] && chartData[chart.id] && chartData[chart.id].length > 0 && (
                <Plot
                  data={generatePlotlyData(chart, chartData[chart.id])}
                  layout={generatePlotlyLayout(chart)}
                  config={plotlyConfig}
                  style={{ width: '100%', height: '100%' }}
                  useResizeHandler={true}
                />
              )}

              {/* Empty State */}
              {!loadingCharts[chart.id] && chartData[chart.id] && chartData[chart.id].length === 0 && (
                <div className="chart-panel-chart-empty">
                  <div className="chart-panel-empty-icon">📊</div>
                  <div>No data available</div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChartPanel;
