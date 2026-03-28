import React, { useState, useEffect } from 'react';
import './SaveSimulationConfigDialog.css';

/**
 * Prompts for a preset name and whether to overwrite when that name already exists in the .sim.json file.
 * Saving writes a copy of current_configuration under the chosen top-level key (Step 2 of multi-config).
 */
function SaveSimulationConfigDialog({ open, existingNames, onClose, onSave }) {
  const [name, setName] = useState('');
  const [overwrite, setOverwrite] = useState(false);

  useEffect(() => {
    if (open) {
      setName('');
      setOverwrite(false);
    }
  }, [open]);

  if (!open) return null;

  const normalized = name.trim();
  const nameTaken = existingNames.includes(normalized);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!normalized) return;
    if (nameTaken && !overwrite) return;
    onSave({ name: normalized, overwrite: nameTaken ? overwrite : false });
  };

  return (
    <div className="save-sim-config-overlay" role="dialog" aria-modal="true" aria-labelledby="save-sim-config-title">
      <div className="save-sim-config-dialog">
        <h2 id="save-sim-config-title">Save configuration as</h2>
        <p className="save-sim-config-help">
          Stores the current charts and panel settings as a preset in this scenario&apos;s <code>.sim.json</code> file.
        </p>
        <form onSubmit={handleSubmit}>
          <label className="save-sim-config-label">
            Preset name
            <input
              className="save-sim-config-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. configuration01"
              autoFocus
              autoComplete="off"
            />
          </label>
          {nameTaken && (
            <label className="save-sim-config-overwrite">
              <input
                type="checkbox"
                checked={overwrite}
                onChange={(e) => setOverwrite(e.target.checked)}
              />
              Overwrite existing preset &quot;{normalized}&quot;
            </label>
          )}
          <div className="save-sim-config-actions">
            <button type="button" className="save-sim-config-btn cancel" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="save-sim-config-btn submit"
              disabled={!normalized || (nameTaken && !overwrite)}
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SaveSimulationConfigDialog;
