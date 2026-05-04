import React, { useMemo, useState, useEffect } from 'react';
import { qualifyEnsembleColumn } from '../../utils/simulationLazyApi';
import './VariablePresenceRuleDialog.css';

function buildColumnOptions(columns, ensembleColumnGroups, isEnsemble, derivedVariables) {
  const opts = [];
  if (!isEnsemble) {
    for (const c of columns || []) {
      opts.push({ value: c, label: c });
    }
  } else {
    for (const g of ensembleColumnGroups || []) {
      const sid = g.simId;
      for (const c of g.columns || []) {
        const q = qualifyEnsembleColumn(sid, c);
        opts.push({ value: q, label: q });
      }
    }
  }
  const seen = new Set(opts.map((o) => o.value));
  for (const d of derivedVariables || []) {
    if (!d?.name || seen.has(d.name)) continue;
    const primarySid = ensembleColumnGroups?.[0]?.simId;
    if (primarySid && isEnsemble) {
      const q = qualifyEnsembleColumn(primarySid, d.name);
      if (!seen.has(q)) {
        opts.push({ value: q, label: q });
        seen.add(q);
      }
    } else if (!isEnsemble) {
      opts.push({ value: d.name, label: d.name });
      seen.add(d.name);
    }
  }
  return opts.sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Create a rule: when the chosen column satisfies the predicate at the simulation playhead,
 * all selected components (and wires touching them) render offline / de-energized.
 */
export default function VariablePresenceRuleDialog({
  open,
  componentIds = [],
  componentSummary = '',
  connectionIds = [],
  connectionSummary = '',
  columns = [],
  isEnsemble = false,
  ensembleColumnGroups = [],
  derivedVariables = [],
  onConfirm,
  onClose,
}) {
  const options = useMemo(
    () => buildColumnOptions(columns, ensembleColumnGroups, isEnsemble, derivedVariables),
    [columns, ensembleColumnGroups, isEnsemble, derivedVariables]
  );

  const [column, setColumn] = useState('');
  const [when, setWhen] = useState('lte');
  const [threshold, setThreshold] = useState('0');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setColumn((prev) => (prev && options.some((o) => o.value === prev) ? prev : options[0]?.value || ''));
  }, [open, options]);

  if (!open) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);
    if (!column.trim()) {
      setError('Choose a variable (CSV column).');
      return;
    }
    if (!componentIds.length && !connectionIds.length) {
      setError('Nothing selected.');
      return;
    }
    const thr = parseFloat(threshold);
    if (!Number.isFinite(thr)) {
      setError('Threshold must be a number.');
      return;
    }
    onConfirm?.({
      column: column.trim(),
      componentIds: [...componentIds],
      connectionIds: [...connectionIds],
      when,
      threshold: thr,
    });
  };

  return (
    <div className="variable-presence-dialog-overlay" role="presentation" onMouseDown={onClose}>
      <div
        className="variable-presence-dialog"
        role="dialog"
        aria-labelledby="var-presence-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h3 id="var-presence-title">Link schematic to variable</h3>
        <p className="variable-presence-desc">
          When the variable matches the condition at the playback time, linked equipment renders offline with
          a red outline, and gray de-energized wires (flow arrows stopped). Linked lines-only rules affect only
          the selected conductors — no change to neighboring symbols unless they share a rule with components.
          Uses the same playhead as charts and sparklines.
        </p>
        <div className="variable-presence-meta">
          {componentIds.length > 0 && (
            <>
              <strong>{componentIds.length}</strong>
              {' component'}
              {componentIds.length === 1 ? '' : 's'}
              {componentSummary ? `: ${componentSummary}` : ''}
              {connectionIds.length > 0 ? <br /> : null}
            </>
          )}
          {connectionIds.length > 0 && (
            <>
              <strong>{connectionIds.length}</strong>
              {' line'}
              {connectionIds.length === 1 ? '' : 's'}
              {connectionSummary ? `: ${connectionSummary}` : ''}
            </>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="variable-presence-field">
            <label htmlFor="vp-col">Variable (CSV column)</label>
            <select
              id="vp-col"
              value={column}
              onChange={(e) => setColumn(e.target.value)}
              required
            >
              {options.length === 0 ? (
                <option value="">— Load a simulation first —</option>
              ) : (
                options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="variable-presence-row">
            <div className="variable-presence-field">
              <label htmlFor="vp-when">Condition</label>
              <select id="vp-when" value={when} onChange={(e) => setWhen(e.target.value)}>
                <option value="lte">≤ (less or equal)</option>
                <option value="lt">&lt; (strictly less)</option>
                <option value="eq">≈ equal (epsilon)</option>
                <option value="gte">≥</option>
                <option value="gt">&gt;</option>
              </select>
            </div>
            <div className="variable-presence-field">
              <label htmlFor="vp-thr">Threshold</label>
              <input
                id="vp-thr"
                type="text"
                inputMode="decimal"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <p className="variable-presence-hint">
            Example: terminal voltage in pu → Condition ≤ , Threshold 0 → branch drops when voltage hits zero.
          </p>

          {error && <div className="variable-presence-error">{error}</div>}

          <div className="variable-presence-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-confirm" disabled={!options.length}>
              Add rule
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
