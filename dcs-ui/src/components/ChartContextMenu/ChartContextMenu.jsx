import React from 'react';
import './ChartContextMenu.css';

/**
 * Chart Context Menu Component
 * 
 * Shows when user right-clicks a component on the canvas.
 * Allows associating different types of charts with the component.
 * 
 * Props:
 * - position: { x, y } - Where to display the menu
 * - onClose: Function to close the menu
 * - onSelectChartType: Function called with chart type (e.g., '2d', 'histogram')
 * - componentName: Name of the component (for display)
 */
const ChartContextMenu = ({ position, onClose, onSelectChartType, componentName }) => {
  
  /**
   * Chart types available in Plotly
   * Based on Plotly.js chart types
   */
  const chartTypes = [
    { id: '2d', label: '2D Plot', icon: '📈', description: 'Line/scatter plot (X vs Y)' },
    { id: 'histogram', label: 'Histogram', icon: '📊', description: 'Distribution of values' },
    { id: 'pie', label: 'Pie Chart', icon: '🥧', description: 'Proportional slices' },
    { id: 'bar', label: 'Bar Chart', icon: '📊', description: 'Categorical comparison' },
    { id: '3d', label: '3D Surface', icon: '🗻', description: '3D surface plot' },
    { id: 'heatmap', label: 'Heatmap', icon: '🔥', description: 'Color-coded matrix' },
    { id: 'box', label: 'Box Plot', icon: '📦', description: 'Statistical distribution' },
  ];

  /**
   * Handle chart type selection
   */
  const handleSelect = (chartType) => {
    onSelectChartType(chartType);
    onClose();
  };

  /**
   * Handle click outside menu
   */
  const handleOverlayClick = (e) => {
    if (e.target.className === 'chart-context-overlay') {
      onClose();
    }
  };

  return (
    <div className="chart-context-overlay" onClick={handleOverlayClick}>
      <div 
        className="chart-context-menu"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`
        }}
      >
        <div className="chart-context-header">
          <div className="chart-context-title">
            Associate Chart
          </div>
          <div className="chart-context-component">
            {componentName}
          </div>
        </div>

        <div className="chart-context-items">
          {chartTypes.map((chart) => (
            <div
              key={chart.id}
              className="chart-context-item"
              onClick={() => handleSelect(chart.id)}
            >
              <div className="chart-context-icon">{chart.icon}</div>
              <div className="chart-context-info">
                <div className="chart-context-label">{chart.label}</div>
                <div className="chart-context-desc">{chart.description}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="chart-context-footer">
          <button className="chart-context-cancel" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChartContextMenu;
