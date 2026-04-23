import React, { useMemo, useState, useEffect } from 'react';
import '../ColumnPickerDialog/ColumnPickerDialog.css';
import './ConnectionReadoutDialog.css';
import {
  guessConnectionReadoutDefaultEnsembleSimId,
  formatEnsembleMemberTabLabel,
} from '../../utils/connectionReadoutSampling';

const EMPTY_SLOT = { ensembleSimId: '', column: '', unit: '', decimals: 2 };

const SPARKLE_HINTS = [
  'Top row, first value (e.g. P)',
  'Top row, second value (e.g. Q)',
  'Bottom row, first value (e.g. f)',
  'Bottom row, second value (e.g. V)',
];

function normalizeSlots(saved) {
  const s = [...(saved?.slots || [])];
  while (s.length < 4) s.push({ ...EMPTY_SLOT });
  return s.slice(0, 4).map((x) => ({
    ensembleSimId: x.ensembleSimId || '',
    column: x.column || '',
    unit: x.unit ?? '',
    decimals: x.decimals ?? 2,
  }));
}

/**
 * Configure up to four live “sparkle” values on a component connection side (LM2500 first; schema is generic).
 */
export default function ConnectionReadoutDialog({
  component,
  simulationMetadata,
  ensembleColumnGroups = [],
  onClose,
  onSave,
  onRemove,
}) {
  const isEnsemble = !!simulationMetadata?.isEnsemble;
  const memberSimulations = simulationMetadata?.memberSimulations || [];
  const guessedDefaultEnsembleTabId = useMemo(
    () => guessConnectionReadoutDefaultEnsembleSimId(component, memberSimulations),
    [component, memberSimulations],
  );
  const [side, setSide] = useState(component?.connectionReadout?.side || 'left');
  const [swatchColor, setSwatchColor] = useState(
    component?.connectionReadout?.swatchColor || '#cddc39',
  );
  const [slots, setSlots] = useState(() => normalizeSlots(component?.connectionReadout));
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSide(component?.connectionReadout?.side || 'left');
    setSwatchColor(component?.connectionReadout?.swatchColor || '#cddc39');
    setSlots(normalizeSlots(component?.connectionReadout));
  }, [component]);

  /* Default empty sparkle tabs from name: Aux Loads #N → Load_N, BESS #N → BESS_N (user can change). */
  useEffect(() => {
    if (!guessedDefaultEnsembleTabId) return;
    setSlots((prev) =>
      prev.map((s) =>
        String(s.ensembleSimId || '').trim()
          ? s
          : { ...s, ensembleSimId: guessedDefaultEnsembleTabId },
      ),
    );
  }, [component?.id, guessedDefaultEnsembleTabId]);

  const tabOptions = useMemo(() => {
    if (isEnsemble && ensembleColumnGroups?.length) {
      return ensembleColumnGroups.map((g) => ({
        id: g.simId,
        label: formatEnsembleMemberTabLabel(g.simId),
      }));
    }
    return [{ id: '', label: 'Current scenario' }];
  }, [isEnsemble, ensembleColumnGroups]);

  const defaultTabId = guessedDefaultEnsembleTabId || tabOptions[0]?.id || '';

  const columnsForTab = (ensembleSimId) => {
    if (isEnsemble && ensembleSimId) {
      const g = ensembleColumnGroups.find((x) => x.simId === ensembleSimId);
      return g?.columns || [];
    }
    return simulationMetadata?.columns || [];
  };

  const updateSlot = (idx, patch) => {
    setSlots((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const handleOverlayClick = (e) => {
    if (e.target.classList.contains('dialog-overlay')) onClose();
  };

  const handleSubmit = async () => {
    setError(null);
    const cleaned = slots.map((s) => {
      const tabId = isEnsemble ? (s.ensembleSimId || defaultTabId) : '';
      return {
        ...(isEnsemble && tabId ? { ensembleSimId: tabId } : {}),
        column: String(s.column || '').trim(),
        unit: String(s.unit || '').trim(),
        decimals: Math.max(0, Math.min(8, Number(s.decimals) || 2)),
      };
    });
    const hasAny = cleaned.some((s) => s.column);
    if (!hasAny) {
      setError('Select at least one variable, or use Remove readout.');
      return;
    }
    setBusy(true);
    try {
      await onSave({ side, swatchColor, slots: cleaned }, component.id);
      onClose();
    } catch (e) {
      setError(e?.message ? String(e.message) : 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveClick = () => {
    onRemove?.(component.id);
    onClose();
  };

  return (
    <div
      className="column-picker-overlay dialog-overlay connection-readout-overlay"
      onClick={handleOverlayClick}
      role="presentation"
    >
      <div
        className="connection-readout-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="connection-readout-title"
      >
        <div className="dialog-header">
          <h2 id="connection-readout-title">Connection readout — {component?.name}</h2>
          <button type="button" className="dialog-close-btn" onClick={onClose}>
            {'\u2715'}
          </button>
        </div>

        <p className="connection-readout-lead">
          Map up to four values (sparkle #1–#4) to the 2×2 layout next to the block. Each slot uses one
          scenario tab and one CSV column; add the unit label to show after the number (e.g. MVAR).
          {guessedDefaultEnsembleTabId && (
            <>
              {' '}
              Tab defaults to <strong>{formatEnsembleMemberTabLabel(guessedDefaultEnsembleTabId)}</strong>;
              change the dropdown if needed.
            </>
          )}
        </p>

        <div className="connection-readout-field-row">
          <span className="connection-readout-field-label">Side</span>
          <label className="connection-readout-radio">
            <input
              type="radio"
              name="readoutSide"
              checked={side === 'left'}
              onChange={() => setSide('left')}
            />
            Left (toward incoming line)
          </label>
          <label className="connection-readout-radio">
            <input
              type="radio"
              name="readoutSide"
              checked={side === 'right'}
              onChange={() => setSide('right')}
            />
            Right
          </label>
        </div>

        <div className="connection-readout-field-row connection-readout-color-row">
          <span className="connection-readout-field-label">Swatch</span>
          <input
            type="color"
            value={swatchColor}
            onChange={(e) => setSwatchColor(e.target.value)}
            className="connection-readout-color-input"
            title="Color bar beside values"
          />
        </div>

        <div className="connection-readout-slots">
          {slots.map((slot, idx) => {
            const tabId = isEnsemble ? (slot.ensembleSimId || defaultTabId) : '';
            const colOpts = columnsForTab(tabId);
            return (
              <div key={idx} className="connection-readout-slot">
                <div className="connection-readout-slot-title">
                  Sparkle #{idx + 1}
                  <span className="connection-readout-slot-hint">{SPARKLE_HINTS[idx]}</span>
                </div>
                {isEnsemble && (
                  <label className="connection-readout-label">
                    Tab
                    <select
                      value={slot.ensembleSimId || defaultTabId}
                      onChange={(e) =>
                        updateSlot(idx, { ensembleSimId: e.target.value, column: '' })
                      }
                    >
                      {tabOptions.map((t) => (
                        <option key={t.id || '__'} value={t.id}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="connection-readout-label">
                  Variable
                  <select
                    value={slot.column}
                    onChange={(e) => updateSlot(idx, { column: e.target.value })}
                  >
                    <option value="">— None —</option>
                    {colOpts.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="connection-readout-unit-decimals">
                  <label className="connection-readout-label">
                    Unit
                    <input
                      type="text"
                      value={slot.unit}
                      onChange={(e) => updateSlot(idx, { unit: e.target.value })}
                      placeholder="MW, MVAR, Hz, V…"
                    />
                  </label>
                  <label className="connection-readout-label">
                    Decimals
                    <input
                      type="number"
                      min={0}
                      max={8}
                      value={slot.decimals}
                      onChange={(e) =>
                        updateSlot(idx, { decimals: parseInt(e.target.value, 10) || 0 })
                      }
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>

        {error && <div className="connection-readout-error">{error}</div>}

        <div className="connection-readout-actions">
          <button
            type="button"
            className="connection-readout-btn connection-readout-btn-primary"
            onClick={handleSubmit}
            disabled={busy}
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            className="connection-readout-btn"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          {component?.connectionReadout && (
            <button
              type="button"
              className="connection-readout-btn connection-readout-btn-danger"
              onClick={handleRemoveClick}
              disabled={busy}
            >
              Remove readout
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
