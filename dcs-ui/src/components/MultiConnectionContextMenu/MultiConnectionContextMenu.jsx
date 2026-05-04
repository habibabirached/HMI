import React from 'react';
import '../MultiComponentContextMenu/MultiComponentContextMenu.css';

/**
 * Context menu when multiple schematic connections are shift-selected (right-click).
 */
const MultiConnectionContextMenu = ({
  position,
  connections,
  variableDrivenPresence = [],
  onClose,
  onConfigureVariablePresence,
}) => {
  const ids = new Set((connections || []).map((c) => c?.id).filter(Boolean));
  const overlapCount = (variableDrivenPresence || []).filter(
    (r) => Array.isArray(r?.connectionIds) && r.connectionIds.some((id) => ids.has(id)),
  ).length;

  return (
    <div
      className="multi-component-context-menu"
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 10000,
      }}
    >
      <div className="multi-component-context-overlay" onClick={onClose} aria-hidden />
      <div className="context-menu-content">
        <div className="context-menu-header">
          Line actions
          <div className="context-menu-subtitle">
            {connections.length === 1 ? '1 line selected' : `${connections.length} lines selected`}
          </div>
        </div>
        <div className="context-menu-separator" />

        {onConfigureVariablePresence && (
          <>
            <button
              type="button"
              className="context-menu-item context-menu-item--accent"
              onClick={() => onConfigureVariablePresence()}
            >
              <span className="context-menu-icon">⛓</span>
              <span className="context-menu-label">
                Link de-energized to variable…
                {overlapCount > 0
                  ? ` (${overlapCount} rule${overlapCount === 1 ? '' : 's'} touch selection)`
                  : ''}
              </span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default MultiConnectionContextMenu;
