import React from 'react';
import './MultiComponentContextMenu.css';
import { BREAKER_TYPES } from '../../data/componentVisuals';

const MultiComponentContextMenu = ({ 
  position, 
  components, 
  onClose, 
  onSelectChartType,
  onSetInitialSimStatus,
  onConfigureVariablePresence,
  variableDrivenPresence = [],
}) => {
  const handleChartTypeClick = (chartType) => {
    console.log(`📊 ${chartType} selected for`, components.length, 'components');
    onSelectChartType(chartType);
    onClose();
  };

  const offCount = components.filter(c => c.initialSimStatus === 'open').length;
  const breakerCount = components.filter(c => BREAKER_TYPES.has(c.type)).length;
  const ids = new Set(components.map((c) => c.id));
  const presenceRuleOverlap = (variableDrivenPresence || []).filter((r) =>
    Array.isArray(r?.componentIds) && r.componentIds.some((id) => ids.has(id)),
  ).length;

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
      {/* Invisible overlay to close menu on outside click */}
      <div
        className="multi-component-context-overlay"
        onClick={onClose}
      />
      <div className="context-menu-content">
        <div className="context-menu-header">
          Multi-Component Actions
          <div className="context-menu-subtitle">
            {components.length} components selected
            {breakerCount > 0 ? ` · ${breakerCount} breaker${breakerCount > 1 ? 's' : ''}` : ''}
          </div>
        </div>
        <div className="context-menu-separator"></div>

        {onSetInitialSimStatus && (
          <>
            <button
              className="context-menu-item context-menu-item--open"
              onClick={() => {
                onSetInitialSimStatus('open');
                onClose();
              }}
            >
              <span className="context-menu-icon">🔴</span>
              <span className="context-menu-label">
                On Simulate: start OFF
                {offCount > 0 && offCount < components.length
                  ? ` (${components.length - offCount} will change)`
                  : ''}
              </span>
            </button>
            <button
              className="context-menu-item context-menu-item--close"
              onClick={() => {
                onSetInitialSimStatus(null);
                onClose();
              }}
            >
              <span className="context-menu-icon">🟢</span>
              <span className="context-menu-label">
                On Simulate: start ON
                {offCount > 0 ? ` (clears ${offCount})` : ''}
              </span>
            </button>
            <div className="context-menu-separator"></div>
          </>
        )}
        
        {onConfigureVariablePresence && (
          <>
            <button
              type="button"
              className="context-menu-item context-menu-item--accent"
              onClick={() => onConfigureVariablePresence()}
            >
              <span className="context-menu-icon">⛓</span>
              <span className="context-menu-label">
                Link offline to variable…
                {presenceRuleOverlap > 0
                  ? ` (${presenceRuleOverlap} rule${presenceRuleOverlap === 1 ? '' : 's'} touch selection)`
                  : ''}
              </span>
            </button>
            <div className="context-menu-separator"></div>
          </>
        )}
        
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
