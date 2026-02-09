import React from 'react';
import './MultiComponentContextMenu.css';

const MultiComponentContextMenu = ({ 
  position, 
  components, 
  onClose, 
  onSelectChartType 
}) => {
  const handleChartTypeClick = (chartType) => {
    console.log(`📊 ${chartType} selected for`, components.length, 'components');
    onSelectChartType(chartType);
    onClose();
  };

  return (
    <div 
      className="multi-component-context-menu"
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 10000
      }}
    >
      <div className="context-menu-content">
        <div className="context-menu-header">
          📊 Multi-Component Charts
          <div className="context-menu-subtitle">
            {components.length} components selected
          </div>
        </div>
        <div className="context-menu-separator"></div>
        
        <button 
          className="context-menu-item"
          onClick={() => handleChartTypeClick('animated-bar-chart')}
        >
          <span className="context-menu-icon">📊</span>
          <span className="context-menu-label">Animated Bar Chart</span>
        </button>
        
        <button 
          className="context-menu-item"
          onClick={() => handleChartTypeClick('multi-line-plot')}
        >
          <span className="context-menu-icon">📈</span>
          <span className="context-menu-label">Multi-Line 2D Plot</span>
        </button>
        
        <button 
          className="context-menu-item"
          onClick={() => handleChartTypeClick('stacked-area-chart')}
        >
          <span className="context-menu-icon">📉</span>
          <span className="context-menu-label">Stacked Area Chart</span>
        </button>
      </div>
    </div>
  );
};

export default MultiComponentContextMenu;
