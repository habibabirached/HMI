import React, { useState } from 'react';
import { COMPONENT_LIBRARY } from '../../data/componentLibrary';
import { getComponentVisualConfig } from '../../data/componentVisuals';
import './ComponentLibrary.css';

const ComponentLibrary = ({ onAddComponent, disabled }) => {
  const [expandedCategories, setExpandedCategories] = useState({});
  const [searchTerm, setSearchTerm] = useState('');

  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const handleDragStart = (e, component) => {
    if (disabled) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('component', JSON.stringify(component));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const filteredLibrary = COMPONENT_LIBRARY.map(categoryGroup => ({
    ...categoryGroup,
    components: categoryGroup.components.filter(comp =>
      comp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      comp.fullName.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })).filter(categoryGroup => categoryGroup.components.length > 0);

  return (
    <div className={`component-library ${disabled ? 'disabled' : ''}`}>
      <div className="library-header">
        <h2>Component Arsenal</h2>
        <input
          type="text"
          className="library-search"
          placeholder="Search components..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          disabled={disabled}
        />
      </div>

      <div className="library-categories">
        {filteredLibrary.map((categoryGroup, idx) => (
          <div key={idx} className="category-group">
            <div
              className="category-header"
              onClick={() => toggleCategory(categoryGroup.category)}
            >
              <span className="category-icon">
                {expandedCategories[categoryGroup.category] ? '▼' : '▶'}
              </span>
              <span className="category-name">{categoryGroup.category}</span>
              <span className="category-count">({categoryGroup.components.length})</span>
            </div>

            {expandedCategories[categoryGroup.category] && (
              <div className="component-list">
                {categoryGroup.components.map((component) => {
                  const visualConfig = getComponentVisualConfig(component.type);
                  
                  return (
                    <div
                      key={component.id}
                      className="component-item"
                      draggable={!disabled}
                      onDragStart={(e) => handleDragStart(e, component)}
                      title={`${component.fullName}\nDimensions: ${visualConfig.width} × ${visualConfig.height}`}
                    >
                      <div className="component-icon" style={{ color: visualConfig.color }}>
                        {visualConfig.icon}
                      </div>
                      <div className="component-info">
                        <div className="component-name">{component.name}</div>
                        <div className="component-specs">
                          {component.properties?.rating > 0 && `${component.properties.rating} ${component.properties.unit}`}
                          {component.properties?.voltage > 0 && ` @ ${component.properties.voltage} kV`}
                        </div>
                        <div className="component-dimensions">
                          {visualConfig.width} × {visualConfig.height}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {disabled && (
        <div className="library-overlay">
          <div className="overlay-message">
            Library locked in simulation mode
          </div>
        </div>
      )}
    </div>
  );
};

export default ComponentLibrary;
