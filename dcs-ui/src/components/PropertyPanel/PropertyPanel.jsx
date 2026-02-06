import React, { useState, useEffect } from 'react';
import './PropertyPanel.css';

const PropertyPanel = ({
  selectedComponent,
  selectedConnection,
  onUpdateComponent,
  onDeleteComponent,
  onDeleteConnection,
  onClose,
  disabled
}) => {
  const [editedProps, setEditedProps] = useState({});

  useEffect(() => {
    if (selectedComponent) {
      setEditedProps({
        name: selectedComponent.name,
        rating: selectedComponent.properties?.rating,
        voltage: selectedComponent.properties?.voltage,
        unit: selectedComponent.properties?.unit,
        status: selectedComponent.status
      });
    }
  }, [selectedComponent]);

  if (!selectedComponent && !selectedConnection) {
    return (
      <div className="property-panel empty">
        <div className="empty-message">
          Select a component or connection to view properties
        </div>
      </div>
    );
  }

  const handleChange = (field, value) => {
    setEditedProps(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    if (selectedComponent) {
      // Update properties object for rating and voltage
      const updates = {
        name: editedProps.name,
        status: editedProps.status,
        properties: {
          ...selectedComponent.properties,
          rating: editedProps.rating,
          voltage: editedProps.voltage
        }
      };
      onUpdateComponent(selectedComponent.id, updates);
    }
  };

  const handleDelete = () => {
    if (selectedComponent) {
      if (window.confirm(`Delete ${selectedComponent.name}?`)) {
        onDeleteComponent(selectedComponent.id);
      }
    } else if (selectedConnection) {
      if (window.confirm('Delete this connection?')) {
        onDeleteConnection(selectedConnection.id);
      }
    }
  };

  if (selectedConnection) {
    return (
      <div className="property-panel">
        <div className="panel-header">
          <h3>Connection Properties</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="panel-body">
          <div className="prop-group">
            <label>Type</label>
            <select value={selectedConnection.type} disabled={disabled}>
              <option value="AC">AC</option>
              <option value="DC">DC</option>
            </select>
          </div>

          <div className="prop-group">
            <label>Voltage Level (kV)</label>
            <input
              type="number"
              value={selectedConnection.voltage}
              disabled={disabled}
            />
          </div>

          <div className="prop-group">
            <label>Status</label>
            <div className={`status-badge status-${selectedConnection.status}`}>
              {selectedConnection.status}
            </div>
          </div>
        </div>

        <div className="panel-footer">
          <button className="btn-delete" onClick={handleDelete} disabled={disabled}>
            Delete Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="property-panel">
      <div className="panel-header">
        <h3>Component Properties</h3>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>

      <div className="panel-body">
        <div className="prop-section">
          <h4>Identification</h4>
          
          <div className="prop-group">
            <label>Type</label>
            <div className="prop-value readonly">{selectedComponent.fullName}</div>
          </div>

          <div className="prop-group">
            <label>Instance ID</label>
            <div className="prop-value readonly">{selectedComponent.id}</div>
          </div>

          <div className="prop-group">
            <label>Display Name</label>
            <input
              type="text"
              value={editedProps.name || ''}
              onChange={(e) => handleChange('name', e.target.value)}
              disabled={disabled}
            />
          </div>
        </div>

        <div className="prop-section">
          <h4>Electrical Properties</h4>

          {selectedComponent.properties?.rating !== undefined && (
            <div className="prop-group">
              <label>Rating ({selectedComponent.properties.unit})</label>
              <input
                type="number"
                value={editedProps.rating || 0}
                onChange={(e) => handleChange('rating', parseFloat(e.target.value))}
                disabled={disabled}
                step="0.1"
              />
            </div>
          )}

          {selectedComponent.properties?.voltage !== undefined && (
            <div className="prop-group">
              <label>Voltage (kV)</label>
              <input
                type="number"
                value={editedProps.voltage || 0}
                onChange={(e) => handleChange('voltage', parseFloat(e.target.value))}
                disabled={disabled}
                step="0.1"
              />
            </div>
          )}

          {selectedComponent.primary !== undefined && (
            <>
              <div className="prop-group">
                <label>Primary Voltage (kV)</label>
                <input
                  type="number"
                  value={selectedComponent.primary}
                  disabled={disabled}
                />
              </div>
              <div className="prop-group">
                <label>Secondary Voltage (kV)</label>
                <input
                  type="number"
                  value={selectedComponent.secondary}
                  disabled={disabled}
                />
              </div>
            </>
          )}
        </div>

        <div className="prop-section">
          <h4>Operational State</h4>

          <div className="prop-group">
            <label>Initial Status</label>
            <select
              value={editedProps.status || 'normal'}
              onChange={(e) => handleChange('status', e.target.value)}
              disabled={disabled}
            >
              <option value="normal">Normal / Online</option>
              <option value="offline">Offline</option>
              <option value="standby">Standby</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>
        </div>

        {selectedComponent.state && (
          <div className="prop-section">
            <h4>Current State (Read-Only)</h4>
            
            <div className="prop-group">
              <label>Power</label>
              <div className="prop-value">{selectedComponent.state.power} MW</div>
            </div>

            <div className="prop-group">
              <label>Voltage</label>
              <div className="prop-value">{selectedComponent.state.voltage} kV</div>
            </div>

            <div className="prop-group">
              <label>Current</label>
              <div className="prop-value">{selectedComponent.state.current} A</div>
            </div>

            <div className="prop-group">
              <label>Frequency</label>
              <div className="prop-value">{selectedComponent.state.frequency} Hz</div>
            </div>
          </div>
        )}
      </div>

      <div className="panel-footer">
        <button 
          className="btn-save" 
          onClick={handleSave}
          disabled={disabled}
        >
          Apply Changes
        </button>
        <button 
          className="btn-delete" 
          onClick={handleDelete}
          disabled={disabled}
        >
          Delete Component
        </button>
      </div>
    </div>
  );
};

export default PropertyPanel;
