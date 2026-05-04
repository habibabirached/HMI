/**
 * SAVE/LOAD DIALOG COMPONENT
 *
 * This component provides UI for saving and loading power system configurations.
 * It has two modes:
 * 1. SAVE mode: Shows a form to input name/description and save current config
 * 2. LOAD mode: Shows a list of saved configurations to choose from
 *
 * Communication with Backend:
 * - POST /api/save - Save configuration (writes DB + designs/…/.conf.json)
 * - GET /api/designs/catalog - List designs on disk ({ active, archived })
 * - DELETE /api/designs/catalog/{path} - Remove design folder + matching DB row
 * - POST /api/designs/catalog/{path}/archive - Move design to designs/archive/
 * - GET /api/configs - List rows in the database (when toggle = Database)
 * - GET /api/designs/catalog/{dir}/load - Load canvas from file
 * - GET /api/load/{id}?source=database - Load canvas from DB row
 */

import React, { useState, useEffect } from 'react';
import '../styles/SaveLoadDialog.css';
import { API_BASE_URL } from '../apiConfig';

function SaveLoadDialog({
  mode,
  onClose,
  onSave,
  onLoad,
  currentConfiguration,
  /** If set, called at save click (and for preview) so payload always matches latest canvas state. */
  getCurrentConfiguration,
  currentConfigName,
}) {
  const [saveName, setSaveName] = useState('');
  const [saveDescription, setSaveDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const [configurations, setConfigurations] = useState([]);
  const [diskCatalog, setDiskCatalog] = useState({ active: [], archived: [] });
  const [diskListNonce, setDiskListNonce] = useState(0);
  const [archivedSectionOpen, setArchivedSectionOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [showDiskDeleteConfirm, setShowDiskDeleteConfirm] = useState(null);
  const [diskBusyDesignDir, setDiskBusyDesignDir] = useState(null);

  const [useDatabaseList, setUseDatabaseList] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (mode === 'load') {
      setUseDatabaseList(false);
    }
  }, [mode]);

  useEffect(() => {
    if (mode !== 'load') return;

    const fetchLoadList = async () => {
      const t0 = performance.now();
      setLoading(true);
      setMessage(null);
      try {
        if (useDatabaseList) {
          const response = await fetch(`${API_BASE_URL}/api/configs`);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          const data = await response.json();
          setConfigurations(Array.isArray(data) ? data : []);
          console.log(`✅ Fetched ${data.length} item(s) (database)`);
        } else {
          const response = await fetch(`${API_BASE_URL}/api/designs/catalog`);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          const data = await response.json();
          let active = [];
          let archived = [];
          if (Array.isArray(data)) {
            active = data;
          } else {
            active = data.active || [];
            archived = data.archived || [];
          }
          setDiskCatalog({ active, archived });
          console.log(
            `✅ Fetched disk catalog (${active.length} active, ${archived.length} archived)`,
          );
        }
        console.log(`[DCS:perf] SaveLoad list: done`, { ms: Math.round(performance.now() - t0), useDatabaseList });
      } catch (error) {
        console.error('❌ Error fetching load list:', error);
        setMessage({ type: 'error', text: `Failed to load list: ${error.message}` });
        if (!useDatabaseList) {
          setDiskCatalog({ active: [], archived: [] });
        }
      } finally {
        setLoading(false);
        console.log(`[DCS:perf] SaveLoad list: finally`, { ms: Math.round(performance.now() - t0) });
      }
    };

    fetchLoadList();
  }, [mode, useDatabaseList, diskListNonce]);

  const bumpDiskCatalog = () => setDiskListNonce((n) => n + 1);

  const snapshot =
    typeof getCurrentConfiguration === 'function'
      ? getCurrentConfiguration()
      : currentConfiguration;

  const handleSave = async () => {
    if (!saveName.trim()) {
      setMessage({ type: 'error', text: 'Please enter a configuration name' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const newName = saveName.trim();
      const dataPayload =
        typeof getCurrentConfiguration === 'function'
          ? getCurrentConfiguration()
          : currentConfiguration;
      const configData = {
        name: newName,
        description: saveDescription.trim() || null,
        data: dataPayload,
      };
      if (currentConfigName && currentConfigName !== newName) {
        configData.source_name = currentConfigName;
        console.log('[DEBUG] SaveLoadDialog: Save As detected', {
          currentConfigName,
          newName,
          source_name: currentConfigName,
        });
      }

      console.log(
        '💾 Saving configuration:',
        configData.name,
        configData.source_name ? `(Save As from ${configData.source_name})` : '',
      );

      const response = await fetch(`${API_BASE_URL}/api/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      const savedConfig = await response.json();

      console.log(`✅ Configuration saved with ID: ${savedConfig.id}`);
      setMessage({
        type: 'success',
        text: `Configuration "${savedConfig.name}" saved successfully!`,
      });

      if (onSave) {
        onSave(savedConfig);
      }

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

  const handleLoadFromDisk = async (designDir) => {
    const t0 = performance.now();
    setLoading(true);
    setMessage(null);
    try {
      console.log(`[DCS:perf] SaveLoad disk: start`, { designDir, t0 });
      const response = await fetch(
        `${API_BASE_URL}/api/designs/catalog/${encodeURIComponent(designDir)}/load`,
      );
      console.log(`[DCS:perf] SaveLoad disk: fetch done`, {
        ms: Math.round(performance.now() - t0),
        ok: response.ok,
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }
      const loadedConfig = await response.json();
      console.log(`[DCS:perf] SaveLoad disk: JSON parsed`, {
        ms: Math.round(performance.now() - t0),
        name: loadedConfig.name,
        canvasN: loadedConfig.data?.canvasComponents?.length,
        connN: loadedConfig.data?.connections?.length,
      });
      console.log(`✅ Configuration loaded: ${loadedConfig.name}`);
      const tOnLoad = performance.now();
      if (onLoad) onLoad(loadedConfig);
      console.log(`[DCS:perf] SaveLoad disk: onLoad() returned (sync work in parent)`, {
        onLoadMs: Math.round(performance.now() - tOnLoad),
        totalMs: Math.round(performance.now() - t0),
      });
      // Close immediately after apply — do NOT delay (e.g. 1s). Session restore runs
      // handleRunSimulation on the main thread (~multi‑second augmentRows); a timer would
      // starve behind that work and keep the modal up ~3s+ after load.
      console.log(`[DCS:perf] SaveLoad disk: onClose() now`, {
        totalMs: Math.round(performance.now() - t0),
      });
      onClose();
    } catch (error) {
      console.error('❌ Error loading configuration:', error);
      setMessage({ type: 'error', text: `Failed to load: ${error.message}` });
    } finally {
      setLoading(false);
      console.log(`[DCS:perf] SaveLoad disk: finally (dialog loading spinner off)`, {
        totalMs: Math.round(performance.now() - t0),
      });
    }
  };

  const handleLoadFromDatabase = async (configId) => {
    const t0 = performance.now();
    setLoading(true);
    setMessage(null);
    try {
      console.log(`[DCS:perf] SaveLoad DB: start`, { configId });
      const response = await fetch(
        `${API_BASE_URL}/api/load/${configId}?source=database`,
      );
      console.log(`[DCS:perf] SaveLoad DB: fetch done`, { ms: Math.round(performance.now() - t0), ok: response.ok });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }
      const loadedConfig = await response.json();
      console.log(`[DCS:perf] SaveLoad DB: JSON parsed`, { ms: Math.round(performance.now() - t0), name: loadedConfig.name });
      console.log(`✅ Configuration loaded: ${loadedConfig.name}`);
      if (onLoad) onLoad(loadedConfig);
      console.log(`[DCS:perf] SaveLoad DB: onClose() now`, { totalMs: Math.round(performance.now() - t0) });
      onClose();
    } catch (error) {
      console.error('❌ Error loading configuration:', error);
      setMessage({ type: 'error', text: `Failed to load: ${error.message}` });
    } finally {
      setLoading(false);
      console.log(`[DCS:perf] SaveLoad DB: finally`, { totalMs: Math.round(performance.now() - t0) });
    }
  };

  const handleDelete = async (configId, configName) => {
    setDeleting(configId);
    setMessage(null);

    try {
      console.log(`🗑️  Deleting configuration ID: ${configId}`);

      const response = await fetch(`${API_BASE_URL}/api/configs/${configId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      const result = await response.json();

      console.log(`✅ Configuration deleted: ${result.name}`);
      setMessage({
        type: 'success',
        text: `Configuration "${result.name}" deleted successfully!`,
      });

      setConfigurations((prev) => prev.filter((c) => c.id !== configId));

      if (selectedConfig?.id === configId) {
        setSelectedConfig(null);
      }

      setShowDeleteConfirm(null);
    } catch (error) {
      console.error('❌ Error deleting configuration:', error);
      setMessage({ type: 'error', text: `Failed to delete: ${error.message}` });
    } finally {
      setDeleting(null);
    }
  };

  const handleDeleteCatalogDesign = async (designDir, nameForMessage) => {
    setDiskBusyDesignDir(designDir);
    setMessage(null);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/designs/catalog/${encodeURIComponent(designDir)}`,
        { method: 'DELETE' },
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }
      setMessage({
        type: 'success',
        text: `Design "${nameForMessage}" removed from disk and database.`,
      });
      setShowDiskDeleteConfirm(null);
      if (selectedConfig?.design_dir === designDir) {
        setSelectedConfig(null);
      }
      bumpDiskCatalog();
    } catch (error) {
      console.error('❌ Error deleting design from catalog:', error);
      setMessage({ type: 'error', text: `Failed to delete design: ${error.message}` });
    } finally {
      setDiskBusyDesignDir(null);
    }
  };

  const handleArchiveCatalogDesign = async (e, designDir, nameForMessage) => {
    e.stopPropagation();
    if (loading || diskBusyDesignDir) return;
    setDiskBusyDesignDir(designDir);
    setMessage(null);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/designs/catalog/${encodeURIComponent(designDir)}/archive`,
        { method: 'POST' },
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }
      setMessage({ type: 'success', text: `Archived "${nameForMessage}" under designs/archive/.` });
      if (selectedConfig?.design_dir === designDir) {
        setSelectedConfig(null);
      }
      setArchivedSectionOpen(true);
      bumpDiskCatalog();
    } catch (error) {
      console.error('❌ Error archiving design:', error);
      setMessage({ type: 'error', text: `Failed to archive: ${error.message}` });
    } finally {
      setDiskBusyDesignDir(null);
    }
  };

  const handleDeleteClick = (e, configId, configName) => {
    e.stopPropagation();
    setShowDeleteConfirm({ id: configId, name: configName });
  };

  const handleDeleteDiskClick = (e, designDir, configName) => {
    e.stopPropagation();
    setShowDiskDeleteConfirm({ design_dir: designDir, name: configName });
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(null);
  };

  const handleConfirmDelete = () => {
    if (showDeleteConfirm) {
      handleDelete(showDeleteConfirm.id, showDeleteConfirm.name);
    }
  };

  const diskTotalCount = diskCatalog.active.length + diskCatalog.archived.length;

  const renderDiskCard = (config, isArchivedEntry) => {
    const rowKey = `disk-${config.design_dir}`;
    const selected = selectedConfig?.design_dir === config.design_dir;
    const busyHere = diskBusyDesignDir === config.design_dir;
    return (
      <div
        key={rowKey}
        className={`config-item ${selected ? 'selected' : ''} ${isArchivedEntry ? 'config-item-archived' : ''}`}
        onClick={() => {
          if (loading || busyHere) return;
          setSelectedConfig(config);
          handleLoadFromDisk(config.design_dir);
        }}
      >
        <div className="config-item-header">
          <h3>{config.name}</h3>
          <div className="config-item-actions">
            <span className="config-id" title="Design folder">
              {config.design_dir}
            </span>
            {!isArchivedEntry && (
              <button
                type="button"
                className="btn-disk-action"
                title="Archive (move to designs/archive/)"
                disabled={loading || busyHere}
                onClick={(e) => handleArchiveCatalogDesign(e, config.design_dir, config.name)}
              >
                {busyHere ? '⏳' : '📦'}
              </button>
            )}
            <button
              type="button"
              className="btn-disk-action btn-disk-action-danger"
              title="Delete design folder and matching database row"
              disabled={loading || busyHere}
              onClick={(e) => handleDeleteDiskClick(e, config.design_dir, config.name)}
            >
              {busyHere ? '⏳' : '🗑️'}
            </button>
          </div>
        </div>
        {config.description ? (
          <p className="config-description">{config.description}</p>
        ) : null}
        <div className="config-meta">
          {config.conf_updated_at && (
            <span>File: {new Date(config.conf_updated_at).toLocaleString()}</span>
          )}
          {config.db_id != null && (
            <span className="config-meta-db">Also in DB #{config.db_id}</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2>{mode === 'save' ? '💾 Save Design' : '📂 Load Configuration'}</h2>
          <button className="dialog-close" onClick={onClose}>
            ×
          </button>
        </div>

        {message && <div className={`message ${message.type}`}>{message.text}</div>}

        <div className="dialog-body">
          {mode === 'save' ? (
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
                  <li>{snapshot?.canvasComponents?.length || 0} component(s)</li>
                  <li>{snapshot?.connections?.length || 0} connection(s)</li>
                  <li>{snapshot?.variableDrivenPresence?.length ?? 0} variable-driven rule(s)</li>
                  <li>Current zoom and pan settings</li>
                  <li>Simulation state</li>
                  {snapshot?.chartPanelState?.openCharts?.length > 0 && (
                    <li>
                      {snapshot.chartPanelState.openCharts.length} open chart(s) and panel
                      size
                    </li>
                  )}
                  <li className="form-info-save-targets">
                    Stored in the <strong>design folder</strong>{' '}
                    <code className="load-source-code">.conf.json</code> and the{' '}
                    <strong>database</strong> (same save).
                  </li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="load-list">
              <div className="load-source-switch-row">
                <span className={`load-source-label ${!useDatabaseList ? 'active' : ''}`}>Disk</span>
                <button
                  type="button"
                  className={`load-source-switch ${useDatabaseList ? 'on' : ''}`}
                  role="switch"
                  aria-checked={useDatabaseList}
                  aria-label="Use database for the design list"
                  onClick={() => setUseDatabaseList((v) => !v)}
                  disabled={loading}
                >
                  <span className="load-source-switch-knob" />
                </button>
                <span className={`load-source-label ${useDatabaseList ? 'active' : ''}`}>
                  Database
                </span>
              </div>
              <p className="load-source-hint">
                {useDatabaseList
                  ? 'Listing saved rows from SQLite. Loading uses the database snapshot.'
                  : 'Designs on disk (designs/). Archived designs appear under the Archived section. Delete removes the folder and the matching database row.'}
              </p>
              {useDatabaseList ? (
                loading && !configurations.length ? (
                  <div className="loading">Loading…</div>
                ) : configurations.length === 0 ? (
                  <div className="empty-state">
                    <p>No configurations in the database.</p>
                    <p>Use Disk, or save a design from the app.</p>
                  </div>
                ) : (
                  <div className="config-list">
                    {configurations.map((config) => {
                      const diskRow = config.design_dir != null;
                      const rowKey = diskRow ? `disk-${config.design_dir}` : `db-${config.id}`;
                      const selected = diskRow
                        ? selectedConfig?.design_dir === config.design_dir
                        : selectedConfig?.id === config.id;
                      return (
                        <div
                          key={rowKey}
                          className={`config-item ${selected ? 'selected' : ''}`}
                          onClick={() => {
                            if (loading) return;
                            setSelectedConfig(config);
                            if (diskRow) handleLoadFromDisk(config.design_dir);
                            else handleLoadFromDatabase(config.id);
                          }}
                        >
                          <div className="config-item-header">
                            <h3>{config.name}</h3>
                            <div className="config-item-actions">
                              {diskRow ? (
                                <span className="config-id" title="Design folder">
                                  {config.design_dir}
                                </span>
                              ) : (
                                <>
                                  <span className="config-id">#{config.id}</span>
                                  <button
                                    type="button"
                                    className="btn-delete-config"
                                    onClick={(e) => handleDeleteClick(e, config.id, config.name)}
                                    disabled={deleting === config.id}
                                    title="Delete configuration"
                                  >
                                    {deleting === config.id ? '⏳' : '🗑️'}
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                          {config.description ? (
                            <p className="config-description">{config.description}</p>
                          ) : null}
                          <div className="config-meta">
                            {diskRow ? (
                              <>
                                {config.conf_updated_at && (
                                  <span>
                                    File: {new Date(config.conf_updated_at).toLocaleString()}
                                  </span>
                                )}
                                {config.db_id != null && (
                                  <span className="config-meta-db">Also in DB #{config.db_id}</span>
                                )}
                              </>
                            ) : (
                              <>
                                <span>Created: {new Date(config.created_at).toLocaleString()}</span>
                                {config.updated_at !== config.created_at && (
                                  <span>
                                    Updated: {new Date(config.updated_at).toLocaleString()}
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : loading && diskTotalCount === 0 ? (
                <div className="loading">Loading…</div>
              ) : diskTotalCount === 0 ? (
                <div className="empty-state">
                  <p>No designs found on disk.</p>
                  <p>Add a folder under designs/ with a matching .conf.json, or save from the app.</p>
                </div>
              ) : (
                <>
                  <div className="catalog-section">
                    <h4 className="catalog-section-title">Designs</h4>
                    {diskCatalog.active.length === 0 ? (
                      <p className="catalog-section-empty">No active designs (all archived).</p>
                    ) : (
                      <div className="config-list">
                        {diskCatalog.active.map((c) => renderDiskCard(c, false))}
                      </div>
                    )}
                  </div>
                  {diskCatalog.archived.length > 0 && (
                    <div className="catalog-section catalog-section-archived-wrap">
                      <button
                        type="button"
                        className="archived-toggle"
                        onClick={() => setArchivedSectionOpen((v) => !v)}
                      >
                        <span className="archived-toggle-chevron">
                          {archivedSectionOpen ? '▼' : '▶'}
                        </span>
                        Archived ({diskCatalog.archived.length})
                      </button>
                      {archivedSectionOpen && (
                        <div className="config-list catalog-archived-list">
                          {diskCatalog.archived.map((c) => renderDiskCard(c, true))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div className="dialog-footer">
          <button className="btn-cancel" onClick={onClose} disabled={saving || loading}>
            Cancel
          </button>
          {mode === 'save' && (
            <button
              className="btn-primary"
              onClick={handleSave}
              disabled={saving || !saveName.trim()}
            >
              {saving ? 'Saving...' : 'Save Design'}
            </button>
          )}
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="confirm-overlay" onClick={handleCancelDelete}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>⚠️ Confirm Delete</h3>
            <p>Are you sure you want to delete this configuration?</p>
            <p className="confirm-config-name">&ldquo;{showDeleteConfirm.name}&rdquo;</p>
            <p className="confirm-warning">This action cannot be undone.</p>
            <div className="confirm-actions">
              <button type="button" className="btn-cancel" onClick={handleCancelDelete}>
                Cancel
              </button>
              <button type="button" className="btn-delete" onClick={handleConfirmDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showDiskDeleteConfirm && (
        <div className="confirm-overlay" onClick={() => setShowDiskDeleteConfirm(null)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>⚠️ Delete design</h3>
            <p>
              Remove folder <code className="load-source-code">{showDiskDeleteConfirm.design_dir}</code>{' '}
              and all files inside, and delete the matching row in the database (if any)?
            </p>
            <p className="confirm-config-name">&ldquo;{showDiskDeleteConfirm.name}&rdquo;</p>
            <p className="confirm-warning">This cannot be undone.</p>
            <div className="confirm-actions">
              <button
                type="button"
                className="btn-cancel"
                onClick={() => setShowDiskDeleteConfirm(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-delete"
                disabled={!!diskBusyDesignDir}
                onClick={() =>
                  handleDeleteCatalogDesign(
                    showDiskDeleteConfirm.design_dir,
                    showDiskDeleteConfirm.name,
                  )
                }
              >
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
