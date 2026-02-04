import React, { useState } from 'react';
import { COMPONENT_LIBRARY } from '../../data/componentLibrary';
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
                {categoryGroup.components.map((component) => (
                  <div
                    key={component.id}
                    className="component-item"
                    draggable={!disabled}
                    onDragStart={(e) => handleDragStart(e, component)}
                    title={component.fullName}
                  >
                    <div className="component-icon">
                      {getComponentIcon(component.type)}
                    </div>
                    <div className="component-info">
                      <div className="component-name">{component.name}</div>
                      <div className="component-specs">
                        {component.rating > 0 && `${component.rating} ${component.unit}`}
                        {component.voltage > 0 && ` @ ${component.voltage} kV`}
                      </div>
                    </div>
                  </div>
                ))}
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

// Simple icon representation for each component type
const getComponentIcon = (type) => {
  const iconMap = {
    'aeroderivative': '⚡',
    'heavy-duty': '⚡⚡',
    'steam': '♨',
    'diesel': '🔋',
    'reciprocating': '⚙',
    'fuel-cell': '🔬',
    'wind': '💨',
    'solar': '☀',
    'microturbine': '⚙',
    'generator': '⚙',
    'motor': '⚙',
    'shaft': '—',
    'battery': '🔋',
    'flywheel': '⭕',
    'capacitor': '⚡',
    'hydrogen': 'H₂',
    'thermal': '♨',
    'ups': '⚡',
    'rectifier': '➡',
    'inverter': '⬅',
    'sst': '⚡',
    'dcdc': '⟷',
    'acdc': '➡',
    'dcac': '⬅',
    'gsu': '🔺',
    'stepdown': '🔻',
    'isolation': '🔲',
    'auto': '🔲',
    'distribution': '🔻',
    'breaker-hv': '⊗',
    'breaker-mv': '⊗',
    'breaker-lv': '⊗',
    'disconnect': '⊘',
    'bus-tie': '⊗',
    'recloser': '↻',
    'relay': '⚡',
    'fuse': '╋',
    'ct': '⊙',
    'vt': '⊙',
    'meter': '📊',
    'freq-meter': '〜',
    'pmu': '📡',
    'bus-hv': '━',
    'bus-mv': '━',
    'bus-lv': '━',
    'bus-dc': '━',
    'bus-ring': '⭕',
    'bus-sectional': '━',
    'utility': '⚡',
    'backup': '⚡',
    'island': '🏝',
    'pcc': '⊕',
    'microgrid-ctrl': '🎛',
    'datacenter': '🖥',
    'data-hall': '🖥',
    'it-load': '💻',
    'cooling': '❄',
    'auxiliary': '⚙',
    'critical': '⚠',
    'non-critical': '○',
    'plant-ctrl': '🎛',
    'ems': '🎛',
    'load-shed': '🎛',
    'black-start': '🎛',
    'protection': '🛡',
    'power-block': '▭',
    'substation': '▭',
    'boundary': '┌─┐',
    'dc-boundary': '┌─┐',
    'container': '□'
  };
  
  return iconMap[type] || '◇';
};

export default ComponentLibrary;
