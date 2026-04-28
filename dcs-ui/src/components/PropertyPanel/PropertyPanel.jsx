import React, { useState, useEffect, useLayoutEffect } from 'react';
import './PropertyPanel.css';
import { isPerfDebugEnabled, logPerfLayout, logPerfAfterPaint } from '../../utils/perfDebug';
import SimulationChartBuilder from '../SimulationChartBuilder/SimulationChartBuilder';
import {
  formatVoltageRatioString,
  transformerVoltageRatioLabel,
} from '../Canvas/Schematics/schematicUtils';
import {
  CONNECTION_COLOR_PALETTE,
  DEFAULT_CONNECTION_SHADOW,
  snapshotStyleFromAutoRole
} from '../../utils/connectionLineStyle';

const PropertyPanel = ({
  selectedComponent,
  selectedConnection,
  simulationMetadata,
  simulationColumns = [],
  ensembleColumnGroups = [],
  derivedVariables = [],
  onAddDerivedVariable,
  canvasComponents = [],
  onUpdateComponent,
  onUpdateConnection = () => {},
  onDeleteComponent,
  onDeleteConnection,
  onAddChartFromBuilder,
  onClose,
  disabled
}) => {
  const [editedProps, setEditedProps] = useState({});

  useEffect(() => {
    if (selectedComponent) {
      const props = selectedComponent.properties || {};
      setEditedProps({
        name: selectedComponent.name,
        rating: props.rating,
        voltage: props.voltage,
        unit: props.unit,
        status: selectedComponent.status,
        primaryVoltageKv:
          props.primaryVoltageKv ?? selectedComponent.primary ?? '',
        secondaryVoltageKv:
          props.secondaryVoltageKv ?? selectedComponent.secondary ?? '',
        gsuBusOnComponentSide: props.gsuBusOnComponentSide ?? 'left',
      });
    }
  }, [selectedComponent]);

  useLayoutEffect(() => {
    if (!isPerfDebugEnabled()) return;
    logPerfLayout('PropertyPanel', {
      selectedComponentId: selectedComponent?.id ?? null,
      selectedConnectionId: selectedConnection?.id ?? null,
      simulationColumns: simulationColumns?.length ?? 0,
    });
    logPerfAfterPaint('PropertyPanel');
  }, [selectedComponent?.id, selectedConnection?.id, simulationColumns.length, ensembleColumnGroups?.length]);

  if (!selectedComponent && !selectedConnection) {
    const showChartBuilder =
      simulationMetadata &&
      (simulationColumns.length > 0 ||
        (simulationMetadata.isEnsemble && ensembleColumnGroups?.length > 0));
    if (showChartBuilder) {
      return (
        <div className="property-panel">
          <SimulationChartBuilder
            columns={simulationColumns}
            isEnsemble={!!simulationMetadata?.isEnsemble}
            ensembleColumnGroups={ensembleColumnGroups}
            derivedVariables={derivedVariables}
            onAddDerivedVariable={onAddDerivedVariable}
            displayName={simulationMetadata.displayName}
            onAddChart={onAddChartFromBuilder}
          />
        </div>
      );
    }
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
          voltage: editedProps.voltage,
        },
      };
      if (
        selectedComponent.type === 'gsu' ||
        selectedComponent.type === 'bess-xfmr'
      ) {
        const pk = parseFloat(editedProps.primaryVoltageKv);
        const sk = parseFloat(editedProps.secondaryVoltageKv);
        if (Number.isFinite(pk)) updates.properties.primaryVoltageKv = pk;
        if (Number.isFinite(sk)) updates.properties.secondaryVoltageKv = sk;
      }
      if (selectedComponent.type === 'gsu') {
        const side = editedProps.gsuBusOnComponentSide;
        updates.properties.gsuBusOnComponentSide =
          side === 'right' || side === 'left' ? side : 'left';
      }
      onUpdateComponent(selectedComponent.id, updates);
    }
  };

  const handleDelete = () => {
    if (selectedComponent) {
      if (window.confirm(`Delete ${selectedComponent.name}?`)) {
        onDeleteComponent(selectedComponent.id);
      }
    } else if (selectedConnection) {
      onDeleteConnection(selectedConnection.id);
    }
  };

  if (selectedConnection) {
    const connStyle = selectedConnection.style || { useAuto: true };
    const useAutoLine = connStyle.useAuto !== false;
    const fromComp = canvasComponents.find((c) => c.id === selectedConnection.from);
    const toComp = canvasComponents.find((c) => c.id === selectedConnection.to);

    const patchConnStyle = (partial) => {
      if (!onUpdateConnection) return;
      const next = { ...(selectedConnection.style || {}), ...partial };
      // eslint-disable-next-line no-console
      console.log('[ConnDebug] PropertyPanel patchConnStyle', {
        connectionId: selectedConnection.id,
        from: selectedConnection.from,
        to: selectedConnection.to,
        fromType: fromComp?.type,
        toType: toComp?.type,
        partial,
        next
      });
      onUpdateConnection(selectedConnection.id, { style: next });
    };

    const patchShadow = (partial) => {
      if (!onUpdateConnection) return;
      const sh = {
        ...DEFAULT_CONNECTION_SHADOW,
        ...(connStyle.shadow || {}),
        ...partial
      };
      patchConnStyle({ shadow: sh });
    };

    return (
      <div className="property-panel">
        <div className="panel-header">
          <h3>Connection Properties</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="panel-body">
          <div className="prop-group">
            <label>Type</label>
            <select
              value={selectedConnection.type}
              disabled={disabled}
              onChange={(e) =>
                onUpdateConnection?.(selectedConnection.id, { type: e.target.value })
              }
            >
              <option value="AC">AC</option>
              <option value="DC">DC</option>
              <option value="power">Power (one-line / saved)</option>
            </select>
          </div>

          <div className="prop-group">
            <label>Voltage Level (kV)</label>
            <input
              type="number"
              value={
                selectedConnection.voltage === undefined ||
                selectedConnection.voltage === null
                  ? ''
                  : String(selectedConnection.voltage)
              }
              disabled={disabled}
              onChange={(e) => {
                const raw = e.target.value;
                const v = parseFloat(raw, 10);
                onUpdateConnection?.(selectedConnection.id, {
                  voltage: raw === '' || !Number.isFinite(v) ? 0 : v
                });
              }}
            />
          </div>

          <div className="prop-group">
            <label>Status</label>
            <div className={`status-badge status-${selectedConnection.status}`}>
              {selectedConnection.status}
            </div>
          </div>

          <div className="prop-section connection-appearance-section">
            <h4>Line appearance</h4>
            <div className="prop-group prop-toggle-row">
              <label className="prop-toggle-label">
                <input
                  type="checkbox"
                  checked={useAutoLine}
                  disabled={disabled}
                  onChange={(e) => {
                    if (!onUpdateConnection) return;
                    if (e.target.checked) {
                      // eslint-disable-next-line no-console
                      console.log('[ConnDebug] PropertyPanel useAuto → ON', selectedConnection.id);
                      onUpdateConnection(selectedConnection.id, {
                        style: { ...connStyle, useAuto: true }
                      });
                    } else {
                      const snap = snapshotStyleFromAutoRole(
                        fromComp?.type,
                        toComp?.type
                      );
                      // eslint-disable-next-line no-console
                      console.log('[ConnDebug] PropertyPanel useAuto → OFF (snapshot)', {
                        id: selectedConnection.id,
                        fromType: fromComp?.type,
                        toType: toComp?.type,
                        snap
                      });
                      onUpdateConnection(selectedConnection.id, {
                        style: snap
                      });
                    }
                  }}
                />
                <span>Use automatic colors (equipment types)</span>
              </label>
            </div>

            {!useAutoLine && (
              <>
                <div className="prop-group">
                  <label>Color</label>
                  <div className="connection-color-palette">
                    {CONNECTION_COLOR_PALETTE.map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        className={`connection-swatch${connStyle.color === hex ? ' selected' : ''}`}
                        style={{ backgroundColor: hex }}
                        title={hex}
                        disabled={disabled}
                        onClick={() => patchConnStyle({ useAuto: false, color: hex })}
                      />
                    ))}
                  </div>
                  <input
                    type="color"
                    className="connection-color-native"
                    value={
                      /^#[0-9A-Fa-f]{6}$/.test(connStyle.color || '')
                        ? connStyle.color
                        : '#6d6d6d'
                    }
                    disabled={disabled}
                    onChange={(e) =>
                      patchConnStyle({ useAuto: false, color: e.target.value })
                    }
                  />
                </div>

                <div className="prop-group">
                  <label>Thickness (px)</label>
                  <input
                    type="number"
                    min="1"
                    max="40"
                    step="0.5"
                    value={Number.isFinite(connStyle.thickness) ? connStyle.thickness : 5}
                    disabled={disabled}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value, 10);
                      patchConnStyle({
                        useAuto: false,
                        thickness: Number.isFinite(v) ? v : 5
                      });
                    }}
                  />
                </div>

                <div className="prop-group">
                  <label>Flow Arrows</label>
                  <select
                    value={connStyle.flowArrows || 'none'}
                    onChange={(e) =>
                      onUpdateConnection(selectedConnection.id, {
                        style: {
                          ...(selectedConnection.style || {}),
                          flowArrows: e.target.value
                        }
                      })
                    }
                  >
                    <option value="none">None (hidden)</option>
                    <option value="forward">→ A to B (source → target)</option>
                    <option value="reverse">← B to A (target → source)</option>
                  </select>
                  <div className="prop-hint">Arrows circulate during Simulation</div>
                </div>

                <div className="prop-group">
                  <label>Animation</label>
                  <select
                    value={connStyle.animation || 'none'}
                    disabled={disabled}
                    onChange={(e) =>
                      patchConnStyle({
                        useAuto: false,
                        animation: e.target.value
                      })
                    }
                  >
                    <option value="none">None (static)</option>
                    <option value="forward">Flow — toward &quot;To&quot; end</option>
                    <option value="reverse">Flow — toward &quot;From&quot; end</option>
                  </select>
                </div>

                <div className="prop-group">
                  <label>3D depth ({Number.isFinite(connStyle.depth3d) ? connStyle.depth3d : 38}%)</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={Number.isFinite(connStyle.depth3d) ? connStyle.depth3d : 38}
                    disabled={disabled}
                    onChange={(e) =>
                      patchConnStyle({
                        useAuto: false,
                        depth3d: parseInt(e.target.value, 10)
                      })
                    }
                  />
                </div>

                <div className="prop-group">
                  <label>
                    Glossiness (
                    {Number.isFinite(connStyle.glossiness) ? connStyle.glossiness : 0}
                    %)
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={Number.isFinite(connStyle.glossiness) ? connStyle.glossiness : 0}
                    disabled={disabled}
                    onChange={(e) =>
                      patchConnStyle({
                        useAuto: false,
                        glossiness: parseInt(e.target.value, 10)
                      })
                    }
                  />
                </div>

                <div className="prop-subsection">
                  <h5>Shadow</h5>
                  <div className="prop-group">
                    <label>Blur ({connStyle.shadow?.blur ?? DEFAULT_CONNECTION_SHADOW.blur})</label>
                    <input
                      type="range"
                      min="0"
                      max="24"
                      step="0.5"
                      value={connStyle.shadow?.blur ?? DEFAULT_CONNECTION_SHADOW.blur}
                      disabled={disabled}
                      onChange={(e) =>
                        patchShadow({ blur: parseFloat(e.target.value, 10) })
                      }
                    />
                  </div>
                  <div className="prop-group prop-inline-two">
                    <div>
                      <label>Offset X</label>
                      <input
                        type="number"
                        step="1"
                        value={connStyle.shadow?.offsetX ?? DEFAULT_CONNECTION_SHADOW.offsetX}
                        disabled={disabled}
                        onChange={(e) =>
                          patchShadow({ offsetX: parseFloat(e.target.value, 10) || 0 })
                        }
                      />
                    </div>
                    <div>
                      <label>Offset Y</label>
                      <input
                        type="number"
                        step="1"
                        value={connStyle.shadow?.offsetY ?? DEFAULT_CONNECTION_SHADOW.offsetY}
                        disabled={disabled}
                        onChange={(e) =>
                          patchShadow({ offsetY: parseFloat(e.target.value, 10) || 0 })
                        }
                      />
                    </div>
                  </div>
                  <div className="prop-group">
                    <label>
                      Opacity (
                      {(
                        (connStyle.shadow?.opacity ?? DEFAULT_CONNECTION_SHADOW.opacity) * 100
                      ).toFixed(0)}
                      %)
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={Math.round(
                        (connStyle.shadow?.opacity ?? DEFAULT_CONNECTION_SHADOW.opacity) * 100
                      )}
                      disabled={disabled}
                      onChange={(e) =>
                        patchShadow({
                          opacity: parseInt(e.target.value, 10) / 100
                        })
                      }
                    />
                  </div>
                  <div className="prop-group">
                    <label>Shadow color</label>
                    <input
                      type="color"
                      className="connection-color-native"
                      value={
                        /^#[0-9A-Fa-f]{6}$/.test(connStyle.shadow?.color || '')
                          ? connStyle.shadow.color
                          : '#000000'
                      }
                      disabled={disabled}
                      onChange={(e) => patchShadow({ color: e.target.value })}
                    />
                  </div>
                </div>
              </>
            )}
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

          {(selectedComponent.type === 'gsu' ||
            selectedComponent.type === 'bess-xfmr') && (
            <>
              <div className="prop-group">
                <label>Primary voltage (kV)</label>
                <input
                  type="number"
                  value={editedProps.primaryVoltageKv ?? ''}
                  onChange={(e) =>
                    handleChange('primaryVoltageKv', e.target.value)
                  }
                  disabled={disabled}
                  step="0.01"
                />
              </div>
              <div className="prop-group">
                <label>Secondary voltage (kV)</label>
                <input
                  type="number"
                  value={editedProps.secondaryVoltageKv ?? ''}
                  onChange={(e) =>
                    handleChange('secondaryVoltageKv', e.target.value)
                  }
                  disabled={disabled}
                  step="0.01"
                />
              </div>
              {selectedComponent.type === 'gsu' && (
                <div className="prop-group">
                  <label>34.5 kV bus on symbol side</label>
                  <select
                    value={editedProps.gsuBusOnComponentSide ?? 'left'}
                    onChange={(e) =>
                      handleChange('gsuBusOnComponentSide', e.target.value)
                    }
                    disabled={disabled}
                  >
                    <option value="left">Left (ratio HV : LV, bus left of block)</option>
                    <option value="right">
                      Right (ratio LV : HV, bus right of block)
                    </option>
                  </select>
                </div>
              )}
              <div className="prop-group">
                <label>Voltage ratio</label>
                <div className="prop-value readonly">
                  {selectedComponent.type === 'gsu'
                    ? transformerVoltageRatioLabel({
                        type: 'gsu',
                        properties: {
                          primaryVoltageKv: editedProps.primaryVoltageKv,
                          secondaryVoltageKv: editedProps.secondaryVoltageKv,
                          gsuBusOnComponentSide:
                            editedProps.gsuBusOnComponentSide ??
                            selectedComponent.properties?.gsuBusOnComponentSide,
                        },
                      }) || '—'
                    : formatVoltageRatioString(
                        editedProps.primaryVoltageKv,
                        editedProps.secondaryVoltageKv
                      ) || '—'}
                </div>
              </div>
            </>
          )}

          {selectedComponent.primary !== undefined &&
            selectedComponent.type !== 'gsu' &&
            selectedComponent.type !== 'bess-xfmr' && (
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

        {selectedComponent.embeddedSparklines?.length > 0 && (
          <div className="prop-section">
            <h4>On-canvas sparklines</h4>
            <p className="prop-hint sparkline-hint">
              Mini plots on the schematic. Removing one does not change charts in the plot panel.
            </p>
            <ul className="sparkline-list">
              {selectedComponent.embeddedSparklines.map((sp) => (
                <li key={sp.id} className="sparkline-list-item">
                  <div className="sparkline-list-meta" title={`${sp.xColumn} vs ${sp.yColumn}`}>
                    <span className="sparkline-xy">
                      <span className="sparkline-x">{sp.xColumn}</span>
                      <span className="sparkline-arrow"> → </span>
                      <span className="sparkline-y">{sp.yColumn}</span>
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn-remove-sparkline"
                    disabled={disabled}
                    onClick={() => {
                      const next = selectedComponent.embeddedSparklines.filter(
                        (s) => s.id !== sp.id
                      );
                      onUpdateComponent(selectedComponent.id, {
                        embeddedSparklines: next,
                      });
                    }}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="btn-remove-all-sparklines"
              disabled={disabled}
              onClick={() => {
                if (
                  window.confirm(
                    'Remove all on-canvas sparklines from this component?'
                  )
                ) {
                  onUpdateComponent(selectedComponent.id, {
                    embeddedSparklines: [],
                  });
                }
              }}
            >
              Remove all sparklines
            </button>
          </div>
        )}

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
