import React from 'react';
import { API_BASE_URL } from '../../apiConfig';
import './EnsembleEditorDialog.css';

const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

/**
 * Modal to create a new ensemble or edit an existing one's display name and member scenarios.
 */
function EnsembleEditorDialog({
  open,
  mode,
  ensemble,
  designApiPath,
  availableSimulations = [],
  simConfig,
  onClose,
  onSaved,
}) {
  const [ensembleId, setEnsembleId] = React.useState('');
  const [displayName, setDisplayName] = React.useState('');
  const [selected, setSelected] = React.useState(() => new Set());
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (ev) => {
      if (ev.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    if (mode === 'edit' && ensemble) {
      setEnsembleId(String(ensemble.id || '').trim());
      setDisplayName(String(ensemble.display_name || ensemble.id || '').trim());
      const members = ensemble.member_simulations || [];
      setSelected(new Set(members.map((m) => String(m).trim()).filter(Boolean)));
    } else {
      setEnsembleId('');
      setDisplayName('');
      setSelected(new Set());
    }
  }, [open, mode, ensemble]);

  const toggleMember = (simId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(simId)) next.delete(simId);
      else next.add(simId);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(availableSimulations));
  };

  const clearAll = () => {
    setSelected(new Set());
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const members = Array.from(selected);
    if (mode === 'create') {
      const id = ensembleId.trim();
      if (!id) {
        setError('Enter an ensemble id.');
        return;
      }
      if (!ID_PATTERN.test(id)) {
        setError('Id may only use letters, numbers, underscore, and hyphen.');
        return;
      }
    }
    if (members.length === 0) {
      setError('Select at least one scenario to include.');
      return;
    }

    const pathBase = `${API_BASE_URL}/api/designs/${encodeURIComponent(designApiPath)}`;
    setSaving(true);
    try {
      if (mode === 'create') {
        const r = await fetch(`${pathBase}/ensembles`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: ensembleId.trim(),
            display_name: displayName.trim(),
            member_simulations: members,
          }),
        });
        if (!r.ok) {
          const t = await r.text();
          let msg = t || r.statusText;
          try {
            const j = JSON.parse(t);
            if (j.detail != null) {
              msg = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail);
            }
          } catch (_) {
            /* keep msg */
          }
          throw new Error(msg);
        }
      } else {
        const r = await fetch(
          `${pathBase}/ensembles/${encodeURIComponent(ensemble.id)}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              display_name: displayName.trim(),
              member_simulations: members,
            }),
          },
        );
        if (!r.ok) {
          const t = await r.text();
          let msg = t || r.statusText;
          try {
            const j = JSON.parse(t);
            if (j.detail != null) {
              msg = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail);
            }
          } catch (_) {
            /* keep msg */
          }
          throw new Error(msg);
        }
      }
      await onSaved?.();
      onClose?.();
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="ensemble-editor-overlay"
      role="presentation"
      onMouseDown={(ev) => {
        if (ev.target === ev.currentTarget) onClose?.();
      }}
    >
      <div
        className="ensemble-editor-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ensemble-editor-title"
        onMouseDown={(ev) => ev.stopPropagation()}
      >
        <h3 id="ensemble-editor-title" className="ensemble-editor-title">
          {mode === 'create' ? 'New ensemble' : 'Edit ensemble'}
        </h3>
        <p className="ensemble-editor-hint">
          Ensembles group existing scenarios so you can compare them together. Pick which scenario tabs belong
          to this group.
        </p>
        <form onSubmit={handleSubmit}>
          {mode === 'create' && (
            <label className="ensemble-editor-field">
              <span>Id</span>
              <input
                type="text"
                className="ensemble-editor-input"
                value={ensembleId}
                onChange={(e) => setEnsembleId(e.target.value)}
                placeholder="e.g. my_comparison"
                autoComplete="off"
                disabled={saving}
              />
            </label>
          )}
          <label className="ensemble-editor-field">
            <span>Display name</span>
            <input
              type="text"
              className="ensemble-editor-input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={mode === 'create' ? 'Shown on the purple button' : ''}
              autoComplete="off"
              disabled={saving}
            />
          </label>

          <div className="ensemble-editor-members-header">
            <span>Member scenarios</span>
            <div className="ensemble-editor-members-actions">
              <button type="button" className="ensemble-editor-linkbtn" onClick={selectAll} disabled={saving}>
                Select all
              </button>
              <button type="button" className="ensemble-editor-linkbtn" onClick={clearAll} disabled={saving}>
                Clear
              </button>
            </div>
          </div>
          {availableSimulations.length === 0 ? (
            <p className="ensemble-editor-empty">No scenarios in this design yet. Add scenarios first.</p>
          ) : (
            <ul className="ensemble-editor-checklist">
              {availableSimulations.map((simId) => {
                const label =
                  simConfig?.simulations?.[simId]?.display_name || simId;
                return (
                  <li key={simId}>
                    <label className="ensemble-editor-check-row">
                      <input
                        type="checkbox"
                        checked={selected.has(simId)}
                        onChange={() => toggleMember(simId)}
                        disabled={saving}
                      />
                      <span className="ensemble-editor-check-label">{label}</span>
                      <span className="ensemble-editor-check-id">{simId}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}

          {error && <div className="ensemble-editor-error">{error}</div>}

          <div className="ensemble-editor-actions">
            <button type="button" className="ensemble-editor-cancel" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button
              type="submit"
              className="ensemble-editor-save"
              disabled={saving || availableSimulations.length === 0}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EnsembleEditorDialog;
