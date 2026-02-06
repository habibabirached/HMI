/**
 * SAVE/LOAD DIALOG COMPONENT
 * 
 * This component provides UI for saving and loading power system configurations.
 * It has two modes:
 * 1. SAVE mode: Shows a form to input name/description and save current config
 * 2. LOAD mode: Shows a list of saved configurations to choose from
 * 
 * Communication with Backend:
 * - POST /api/save - Save configuration
 * - GET /api/configs - List all saved configurations
 * - GET /api/load/{id} - Load a specific configuration
 */

import React, { useState, useEffect } from 'react';
import '../styles/SaveLoadDialog.css';

// Backend API URL (configured for Docker environment)
const API_BASE_URL = 'http://localhost:5000';

function SaveLoadDialog({ mode, onClose, onSave, onLoad, currentConfiguration }) {
  // State for save mode
  const [saveName, setSaveName] = useState('');
  const [saveDescription, setSaveDescription] = useState('');
  const [saving, setSaving] = useState(false);
  
  // State for load mode
  const [configurations, setConfigurations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [deleting, setDeleting] = useState(null); // ID of config being deleted
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null); // ID of config to confirm deletion
  
  // Message state (success/error)
  const [message, setMessage] = useState(null);

  // ============================================================================
  // LOAD MODE: Fetch list of saved configurations when dialog opens
  // ============================================================================
  useEffect(() => {
    if (mode === 'load') {
      fetchConfigurations();
    }
  }, [mode]);

  /**
   * Fetch all saved configurations from the backend
   */
  const fetchConfigurations = async () => {
    setLoading(true);
    setMessage(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/configs`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setConfigurations(data);
      
      console.log(`✅ Fetched ${data.length} configuration(s)`);
    } catch (error) {
      console.error('❌ Error fetching configurations:', error);
      setMessage({ type: 'error', text: `Failed to load configurations: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // SAVE MODE: Save current configuration
  // ============================================================================
  const handleSave = async () => {
    // Validate inputs
    if (!saveName.trim()) {
      setMessage({ type: 'error', text: 'Please enter a configuration name' });
      return;
    }
    
    setSaving(true);
    setMessage(null);
    
    try {
      // Prepare the configuration data to send to backend
      const configData = {
        name: saveName.trim(),
        description: saveDescription.trim() || null,
        data: currentConfiguration
      };
      
      console.log('💾 Saving configuration:', configData.name);
      
      // POST request to /api/save
      const response = await fetch(`${API_BASE_URL}/api/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(configData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }
      
      const savedConfig = await response.json();
      
      console.log(`✅ Configuration saved with ID: ${savedConfig.id}`);
      setMessage({ type: 'success', text: `Configuration "${savedConfig.name}" saved successfully!` });
      
      // Notify parent component with name
      if (onSave) {
        onSave(savedConfig);
      }
      
      // Close dialog after 1.5 seconds
      setTimeout(() => {
        onClose();
      }, 1500);
      
    } catch (error) {
      console.error('❌ Error saving configuration:', error);
      setMessage({ type: 'error', text: `Failed to save: ${error.message}` });
    } finally {
      setSaving(false);
    }
  };

  // ============================================================================
  // LOAD MODE: Load selected configuration
  // ============================================================================
  const handleLoad = async (configId) => {
    setLoading(true);
    setMessage(null);
    
    try {
      console.log(`📂 Loading configuration ID: ${configId}`);
      
      // GET request to /api/load/{id}
      const response = await fetch(`${API_BASE_URL}/api/load/${configId}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }
      
      const loadedConfig = await response.json();
      
      console.log(`✅ Configuration loaded: ${loadedConfig.name}`);
      setMessage({ type: 'success', text: `Configuration "${loadedConfig.name}" loaded!` });
      
      // Notify parent component to apply the loaded configuration
      if (onLoad) {
        onLoad(loadedConfig);
      }
      
      // Close dialog after a short delay
      setTimeout(() => {
        onClose();
      }, 1000);
      
    } catch (error) {
      console.error('❌ Error loading configuration:', error);
      setMessage({ type: 'error', text: `Failed to load: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // DELETE MODE: Delete a configuration
  // ============================================================================
  const handleDelete = async (configId, configName) => {
    setDeleting(configId);
    setMessage(null);
    
    try {
      console.log(`🗑️  Deleting configuration ID: ${configId}`);
      
      // DELETE request to /api/configs/{id}
      const response = await fetch(`${API_BASE_URL}/api/configs/${configId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }
      
      const result = await response.json();
      
      console.log(`✅ Configuration deleted: ${result.name}`);
      setMessage({ type: 'success', text: `Configuration "${result.name}" deleted successfully!` });
      
      // Remove from local state
      setConfigurations(prev => prev.filter(c => c.id !== configId));
      
      // Clear selection if deleted config was selected
      if (selectedConfig?.id === configId) {
        setSelectedConfig(null);
      }
      
      // Hide confirmation dialog
      setShowDeleteConfirm(null);
      
    } catch (error) {
      console.error('❌ Error deleting configuration:', error);
      setMessage({ type: 'error', text: `Failed to delete: ${error.message}` });
    } finally {
      setDeleting(null);
    }
  };

  // ============================================================================
  // CONFIRM DELETE DIALOG
  // ============================================================================
  const handleDeleteClick = (e, configId, configName) => {
    e.stopPropagation(); // Prevent selecting the config
    setShowDeleteConfirm({ id: configId, name: configName });
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(null);
  };

  const handleConfirmDelete = () => {
    if (showDeleteConfirm) {
      handleDelete(showDeleteConfirm.id, showDeleteConfirm.name);
    }
  };

  // ============================================================================
  // RENDER: Dialog UI
  // ============================================================================
  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
        {/* Dialog Header */}
        <div className="dialog-header">
          <h2>{mode === 'save' ? '💾 Save Configuration' : '📂 Load Configuration'}</h2>
          <button className="dialog-close" onClick={onClose}>×</button>
        </div>

        {/* Message Banner (success/error) */}
        {message && (
          <div className={`message ${message.type}`}>
            {message.text}
          </div>
        )}

        {/* Dialog Body */}
        <div className="dialog-body">
          {mode === 'save' ? (
            // ======== SAVE MODE ========
            <div className="save-form">
              <div className="form-group">
                <label htmlFor="config-name">Configuration Name *</label>
                <input
                  id="config-name"
                  type="text"
                  placeholder="e.g., Main Data Center Layout"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  disabled={saving}
                  maxLength={255}
                />
              </div>

              <div className="form-group">
                <label htmlFor="config-description">Description (Optional)</label>
                <textarea
                  id="config-description"
                  placeholder="e.g., Production configuration with redundant power supply"
                  value={saveDescription}
                  onChange={(e) => setSaveDescription(e.target.value)}
                  disabled={saving}
                  rows={3}
                />
              </div>

              <div className="form-info">
                <strong>What will be saved:</strong>
                <ul>
                  <li>{currentConfiguration.canvasComponents?.length || 0} component(s)</li>
                  <li>{currentConfiguration.connections?.length || 0} connection(s)</li>
                  <li>Current zoom and pan settings</li>
                  <li>Simulation state</li>
                  {currentConfiguration.chartPanelState?.openCharts?.length > 0 && (
                    <li>{currentConfiguration.chartPanelState.openCharts.length} open chart(s) and panel size</li>
                  )}
                </ul>
              </div>
            </div>
          ) : (
            // ======== LOAD MODE ========
            <div className="load-list">
              {loading && !configurations.length ? (
                <div className="loading">Loading configurations...</div>
              ) : configurations.length === 0 ? (
                <div className="empty-state">
                  <p>No saved configurations found.</p>
                  <p>Save your first configuration to get started!</p>
                </div>
              ) : (
                <div className="config-list">
                  {configurations.map((config) => (
                    <div
                      key={config.id}
                      className={`config-item ${selectedConfig?.id === config.id ? 'selected' : ''}`}
                      onClick={() => setSelectedConfig(config)}
                      onDoubleClick={() => handleLoad(config.id)}
                    >
                      <div className="config-item-header">
                        <h3>{config.name}</h3>
                        <div className="config-item-actions">
                          <span className="config-id">#{config.id}</span>
                          <button
                            className="btn-delete-config"
                            onClick={(e) => handleDeleteClick(e, config.id, config.name)}
                            disabled={deleting === config.id}
                            title="Delete configuration"
                          >
                            {deleting === config.id ? '⏳' : '🗑️'}
                          </button>
                        </div>
                      </div>
                      {config.description && (
                        <p className="config-description">{config.description}</p>
                      )}
                      <div className="config-meta">
                        <span>Created: {new Date(config.created_at).toLocaleString()}</span>
                        {config.updated_at !== config.created_at && (
                          <span>Updated: {new Date(config.updated_at).toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Dialog Footer (Action Buttons) */}
        <div className="dialog-footer">
          <button className="btn-cancel" onClick={onClose} disabled={saving || loading}>
            Cancel
          </button>
          {mode === 'save' ? (
            <button 
              className="btn-primary" 
              onClick={handleSave} 
              disabled={saving || !saveName.trim()}
            >
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          ) : (
            <button 
              className="btn-primary" 
              onClick={() => selectedConfig && handleLoad(selectedConfig.id)} 
              disabled={loading || !selectedConfig}
            >
              {loading ? 'Loading...' : 'Load Configuration'}
            </button>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="confirm-overlay" onClick={handleCancelDelete}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>⚠️ Confirm Delete</h3>
            <p>Are you sure you want to delete this configuration?</p>
            <p className="confirm-config-name">"{showDeleteConfirm.name}"</p>
            <p className="confirm-warning">This action cannot be undone.</p>
            <div className="confirm-actions">
              <button className="btn-cancel" onClick={handleCancelDelete}>
                Cancel
              </button>
              <button className="btn-delete" onClick={handleConfirmDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SaveLoadDialog;
