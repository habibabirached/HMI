import React, { useState, useRef, useCallback, useEffect, useMemo, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import './FormulaCalculator.css';

/**
 * FormulaCalculator – Scientific calculator modal for building Y-axis formulas.
 *
 * Variables are latched as chips; a draft field filters the list. Arrow keys move
 * highlight; Enter latches (replaces draft). Clicking a variable latches it.
 */
const OPERATORS = [
  { label: '+', insert: ' + ' },
  { label: '−', insert: ' - ' },
  { label: '×', insert: ' * ' },
  { label: '÷', insert: ' / ' },
  { label: '^', insert: ' ^ ' },
];
const FUNCTIONS = [
  { label: 'sqrt', insert: 'sqrt()' },
  { label: 'abs', insert: 'abs()' },
  { label: 'sin', insert: 'sin()' },
  { label: 'cos', insert: 'cos()' },
  { label: 'log', insert: 'log()' },
  { label: 'exp', insert: 'exp()' },
  { label: 'min', insert: 'min(,)' },
  { label: 'max', insert: 'max(,)' },
];

/**
 * @typedef {{ k: 'V', name: string, display?: string } | { k: 'R', t: string }} FormulaPart
 */

/**
 * Ensemble formula picker: grouped headers + short labels; `value` stays qualified for evaluation rows.
 * @param {string[] | Array<{ value?: string, qualified?: string, label?: string }>} variables
 * @param {null | Array<{ title?: string, simId?: string, items: unknown[] }>} variableGroups
 */
function buildPickItems(variables, variableGroups) {
  if (variableGroups != null && Array.isArray(variableGroups)) {
    if (variableGroups.length === 0) return [];
    return variableGroups.flatMap((g) => {
      const groupTitle = String(g.title ?? g.simId ?? '').trim() || 'Scenario';
      const rawItems = g.items || [];
      return rawItems.map((raw) => {
        if (typeof raw === 'string') {
          return { value: raw, label: raw, groupTitle };
        }
        const value = raw?.value ?? raw?.qualified ?? '';
        const label = raw?.label ?? value;
        return { value: String(value), label: String(label), groupTitle };
      });
    });
  }
  return (variables || []).map((v) =>
    typeof v === 'string'
      ? { value: v, label: v, groupTitle: null }
      : {
          value: String(v?.value ?? ''),
          label: String(v?.label ?? v?.value ?? ''),
          groupTitle: null,
        },
  );
}

function chipLabel(fullName) {
  const s = String(fullName);
  if (s.length <= 32) return s;
  return `${s.slice(0, 14)}…${s.slice(-12)}`;
}

const FormulaCalculator = ({
  open = false,
  onClose,
  variables = [],
  /** Ensemble: `{ title, simId?, items: [{ value, label }] }[]` — UI groups by scenario; formula keeps qualified `value`. */
  variableGroups = null,
  value: controlledValue,
  onChange,
  onDone,
  placeholder = 'Type to filter, Enter to latch a variable',
}) => {
  /** @type {FormulaPart[]} */
  const [chain, setChain] = useState([]);
  const [draft, setDraft] = useState('');
  const [varNavIndex, setVarNavIndex] = useState(-1);
  /** true = filter variables (teal draft); false = type freeform cos(, +, …) — toggled with Space. */
  const [varFilterMode, setVarFilterMode] = useState(true);
  const [namingPhase, setNamingPhase] = useState(false);
  const [pendingFormula, setPendingFormula] = useState('');
  const [variableName, setVariableName] = useState('');

  const draftInputRef = useRef(null);
  const nameInputRef = useRef(null);
  const draftRef = useRef('');
  const isControlled = controlledValue !== undefined;

  useLayoutEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const getFormulaString = useCallback(
    () => chain.map((p) => (p.k === 'V' ? p.name : p.t)).join('') + draft,
    [chain, draft],
  );

  const allPickItems = useMemo(
    () => buildPickItems(variables, variableGroups),
    [variables, variableGroups],
  );

  useEffect(() => {
    if (isControlled) return;
    onChange?.(getFormulaString());
  }, [chain, draft, getFormulaString, isControlled, onChange]);

  /** Commit current draft as raw text, then append `insert` (operators, parens, functions). */
  const insertKeypad = useCallback((insert) => {
    const chunk = (draftRef.current || '') + insert;
    if (!chunk) return;
    setChain((prev) => {
      const o = prev.slice();
      if (o.length > 0 && o[o.length - 1].k === 'R') {
        o[o.length - 1] = { k: 'R', t: (o[o.length - 1].t || '') + chunk };
      } else {
        o.push({ k: 'R', t: chunk });
      }
      return o;
    });
    setDraft('');
  }, []);

  const latch = useCallback((fullName, displayLabel) => {
    if (fullName == null || String(fullName) === '') return;
    const disp = displayLabel != null && String(displayLabel).trim() !== '' ? String(displayLabel) : undefined;
    setChain((c) => [...c, { k: 'V', name: String(fullName), ...(disp ? { display: disp } : {}) }]);
    setDraft('');
    setVarNavIndex(-1);
    requestAnimationFrame(() => draftInputRef.current?.focus());
  }, []);

  const filteredPickItems = useMemo(() => {
    if (!allPickItems.length) return [];
    if (!varFilterMode) return allPickItems;
    const q = draft.toLowerCase().trim();
    if (!q) return allPickItems;
    return allPickItems.filter(
      (it) =>
        it.label.toLowerCase().includes(q) || it.value.toLowerCase().includes(q),
    );
  }, [allPickItems, draft, varFilterMode]);

  useEffect(() => {
    const n = filteredPickItems.length;
    setVarNavIndex((i) => {
      if (n === 0) return -1;
      if (i < 0) return -1;
      return Math.min(i, n - 1);
    });
  }, [filteredPickItems.length]);

  const formulaStr = getFormulaString();
  const trimmedFormula = formulaStr.trim();
  const canDone = trimmedFormula.length > 0;

  const handleDone = useCallback(() => {
    if (!canDone) return;
    setPendingFormula(trimmedFormula);
    setVariableName('');
    setNamingPhase(true);
    requestAnimationFrame(() => nameInputRef.current?.focus());
  }, [canDone, trimmedFormula]);

  const handleAddVariable = useCallback(async () => {
    const trimmedName = variableName.trim();
    if (!trimmedName || !onDone) return;
    try {
      await Promise.resolve(onDone(pendingFormula, trimmedName));
      setNamingPhase(false);
      setPendingFormula('');
      setVariableName('');
    } catch (err) {
      console.error(err);
      alert(err?.message || String(err));
    }
  }, [variableName, pendingFormula, onDone]);

  const handleBackToFormula = useCallback(() => {
    setNamingPhase(false);
    setPendingFormula('');
    setVariableName('');
    requestAnimationFrame(() => draftInputRef.current?.focus());
  }, []);

  const popLastPart = useCallback(() => {
    setChain((prev) => (prev.length ? prev.slice(0, -1) : prev));
  }, []);

  const onDraftKeyDown = useCallback(
    (e) => {
      if (e.key === ' ' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        // Expression → variable: anything still in the draft (e.g. "+", "cos(") is formula text, not
        // a filter; merge it into a raw segment so the dashed "pick variable" box is empty.
        if (!varFilterMode) {
          const d = draftRef.current || '';
          if (d) {
            setChain((prev) => {
              const o = prev.slice();
              if (o.length > 0 && o[o.length - 1].k === 'R') {
                o[o.length - 1] = { k: 'R', t: (o[o.length - 1].t || '') + d };
              } else {
                o.push({ k: 'R', t: d });
              }
              return o;
            });
            setDraft('');
          }
        }
        setVarFilterMode((m) => !m);
        setVarNavIndex(-1);
        return;
      }
      if (e.key === 'ArrowRight' && varFilterMode && filteredPickItems.length > 0) {
        e.preventDefault();
        setVarNavIndex((i) => (i < 0 ? 0 : Math.min(i + 1, filteredPickItems.length - 1)));
        return;
      }
      if (e.key === 'ArrowLeft' && varFilterMode && filteredPickItems.length > 0) {
        e.preventDefault();
        setVarNavIndex((i) => (i <= 0 ? -1 : i - 1));
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault();
          if (canDone) handleDone();
          return;
        }
        if (varFilterMode) {
          e.preventDefault();
          if (filteredPickItems.length > 0) {
            const idx = varNavIndex >= 0 ? varNavIndex : 0;
            const it = filteredPickItems[idx];
            latch(it.value, it.label);
          }
        } else {
          e.preventDefault();
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
        return;
      }
      if (e.key === 'Backspace' && !draft) {
        e.preventDefault();
        if (chain.length) popLastPart();
        return;
      }
    },
    [
      varFilterMode,
      filteredPickItems,
      varNavIndex,
      latch,
      canDone,
      handleDone,
      onClose,
      draft,
      chain.length,
      popLastPart,
    ],
  );

  useEffect(() => {
    if (!open) return;
    if (!isControlled) {
      setChain([]);
      setDraft('');
    } else {
      setChain([{ k: 'R', t: controlledValue != null ? String(controlledValue) : '' }]);
      setDraft('');
    }
    setVarNavIndex(-1);
    setVarFilterMode(true);
    setNamingPhase(false);
    setPendingFormula('');
    setVariableName('');
    requestAnimationFrame(() => {
      draftInputRef.current?.focus();
    });
  }, [open, isControlled, controlledValue]);

  if (!open) return null;

  return createPortal(
    <div
      className="formula-calculator-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
      role="dialog"
      aria-modal="true"
      aria-label="Formula Builder"
    >
      <div className="formula-calculator-modal">
        <div className="formula-calculator-header">
          <h2 className="formula-calculator-title">
            <span className="formula-calculator-title-icon">ƒ</span>
            Formula Builder
          </h2>
          <button type="button" className="formula-calculator-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="formula-calculator-body">
          {namingPhase ? (
            <div className="formula-calculator-naming">
              <div className="formula-calculator-display-wrap formula-calculator-display-readonly">
                <div className="formula-calculator-display-label">Formula</div>
                <div className="formula-calculator-display-text">{pendingFormula}</div>
              </div>
              <div className="formula-calculator-naming-row">
                <label className="formula-calculator-naming-label">Name for this variable</label>
                <input
                  ref={nameInputRef}
                  type="text"
                  className="formula-calculator-naming-input"
                  value={variableName}
                  onChange={(e) => setVariableName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddVariable();
                    if (e.key === 'Escape') handleBackToFormula();
                  }}
                  placeholder="e.g. composite power"
                  aria-label="Variable name"
                />
              </div>
              <div className="formula-calculator-naming-actions">
                <button type="button" className="formula-calculator-btn formula-calculator-btn-back" onClick={handleBackToFormula}>
                  ← Back
                </button>
                <button
                  type="button"
                  className="formula-calculator-btn formula-calculator-btn-done"
                  onClick={handleAddVariable}
                  disabled={!variableName.trim()}
                  title={variableName.trim() ? 'Add variable' : 'Enter a name first'}
                >
                  Add variable
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="formula-calculator-help">
                <kbd>Space</kbd> toggles: <strong>variable</strong> (teal) = filter, <kbd>→</kbd> <kbd>←</kbd>,{' '}
                <kbd>Enter</kbd> latch · <strong>expression</strong> = type <code>cos(</code>, <code>+</code>, etc. ·{' '}
                <kbd>Shift+Space</kbd> inserts a space · <kbd>Ctrl+Enter</kbd> or Done to finish
              </p>
              <div className="formula-calculator-display-wrap">
                <div className="formula-calculator-display-label-row">
                  <span className="formula-calculator-display-label">Y =</span>
                  <span
                    className={`formula-calculator-mode-pill${
                      varFilterMode ? ' formula-calculator-mode-pill--var' : ' formula-calculator-mode-pill--expr'
                    }`}
                    aria-live="polite"
                  >
                    {varFilterMode ? 'Variable' : 'Expression'}
                  </span>
                </div>
                <div
                  className="formula-calculator-composer"
                  onMouseDown={(e) => {
                    if (
                      e.target === e.currentTarget ||
                      (e.target instanceof HTMLElement && e.target.closest('.formula-calculator-chips-wrap'))
                    ) {
                      e.preventDefault();
                      draftInputRef.current?.focus();
                    }
                  }}
                >
                  <div className="formula-calculator-chips-wrap" aria-label="Formula">
                    {chain.map((p, i) =>
                      p.k === 'V' ? (
                        <span key={`V-${i}-${p.name}`} className="formula-calculator-chip" title={p.name} tabIndex={-1}>
                          {chipLabel(p.display || p.name)}
                        </span>
                      ) : (
                        <span key={`R-${i}`} className="formula-calculator-raw" tabIndex={-1}>
                          {p.t}
                        </span>
                      ),
                    )}
                    <input
                      ref={draftInputRef}
                      type="text"
                      className={`formula-calculator-draft-input${
                        varFilterMode
                          ? ' formula-calculator-draft-input--var'
                          : ' formula-calculator-draft-input--raw'
                      }`}
                      value={draft}
                      onChange={(e) => {
                        setDraft(e.target.value);
                        setVarNavIndex(-1);
                      }}
                      onKeyDown={onDraftKeyDown}
                      placeholder={
                        varFilterMode
                          ? chain.length || draft
                            ? 'Filter or latch'
                            : placeholder
                          : 'Type operators, cos(, numbers…'
                      }
                      spellCheck={false}
                      autoComplete="off"
                      aria-label={
                        varFilterMode
                          ? 'Variable filter: type to filter, Enter to latch. Space for expression mode.'
                          : 'Expression: type raw formula text. Space to return to variable filter mode.'
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="formula-calculator-grid">
                <div className="formula-calculator-row">
                  {['7', '8', '9'].map((d) => (
                    <button
                      key={d}
                      type="button"
                      className="formula-calculator-btn formula-calculator-btn-digit"
                      onClick={() => setDraft((d0) => d0 + d)}
                    >
                      {d}
                    </button>
                  ))}
                  {OPERATORS.slice(0, 2).map((op) => (
                    <button key={op.label} type="button" className="formula-calculator-btn formula-calculator-btn-op" onClick={() => insertKeypad(op.insert)}>
                      {op.label}
                    </button>
                  ))}
                </div>
                <div className="formula-calculator-row">
                  {['4', '5', '6'].map((d) => (
                    <button key={d} type="button" className="formula-calculator-btn formula-calculator-btn-digit" onClick={() => setDraft((d0) => d0 + d)}>
                      {d}
                    </button>
                  ))}
                  {OPERATORS.slice(2, 4).map((op) => (
                    <button key={op.label} type="button" className="formula-calculator-btn formula-calculator-btn-op" onClick={() => insertKeypad(op.insert)}>
                      {op.label}
                    </button>
                  ))}
                </div>
                <div className="formula-calculator-row">
                  {['1', '2', '3'].map((d) => (
                    <button key={d} type="button" className="formula-calculator-btn formula-calculator-btn-digit" onClick={() => setDraft((d0) => d0 + d)}>
                      {d}
                    </button>
                  ))}
                  {OPERATORS.slice(4, 5).map((op) => (
                    <button key={op.label} type="button" className="formula-calculator-btn formula-calculator-btn-op" onClick={() => insertKeypad(op.insert)}>
                      {op.label}
                    </button>
                  ))}
                  <button type="button" className="formula-calculator-btn formula-calculator-btn-paren" onClick={() => insertKeypad('(')}>
                    (
                  </button>
                </div>
                <div className="formula-calculator-row">
                  <button type="button" className="formula-calculator-btn formula-calculator-btn-digit" onClick={() => setDraft((d0) => d0 + '0')}>
                    0
                  </button>
                  <button type="button" className="formula-calculator-btn formula-calculator-btn-paren" onClick={() => insertKeypad(')')}>
                    )
                  </button>
                  <button
                    type="button"
                    className="formula-calculator-btn formula-calculator-btn-clear"
                    onClick={() => {
                      setChain([]);
                      setDraft('');
                    }}
                  >
                    C
                  </button>
                  <button
                    type="button"
                    className="formula-calculator-btn formula-calculator-btn-done"
                    onClick={handleDone}
                    disabled={!canDone}
                    title={canDone ? 'Finish and name your variable' : 'Enter a formula first'}
                  >
                    Done
                  </button>
                </div>

                <div className="formula-calculator-row formula-calculator-row-fn">
                  {FUNCTIONS.map((fn) => (
                    <button key={fn.label} type="button" className="formula-calculator-btn formula-calculator-btn-fn" onClick={() => insertKeypad(fn.insert)}>
                      {fn.label}
                    </button>
                  ))}
                </div>

                {allPickItems.length > 0 && (
                  <div className="formula-calculator-vars">
                    <div className="formula-calculator-vars-label">Variables</div>
                    {draft && filteredPickItems.length === 0 ? (
                      <p className="formula-calculator-vars-hint" role="status">
                        No variable names include this filter. Change what you are typing, or clear it, to see the
                        full list.
                      </p>
                    ) : null}
                    {variableGroups != null && variableGroups.length > 0 ? (
                      <div className="formula-calculator-vars-groups">
                        {variableGroups.map((g) => {
                          const title = String(g.title ?? g.simId ?? '').trim() || 'Scenario';
                          const items = filteredPickItems.filter((it) => it.groupTitle === title);
                          if (!items.length) return null;
                          return (
                            <div key={g.simId || title} className="formula-calculator-var-group">
                              <div className="formula-calculator-var-group-title">{title}</div>
                              <div className="formula-calculator-vars-list" role="listbox" aria-label={`Variables · ${title}`}>
                                {items.map((it) => {
                                  const idx = filteredPickItems.indexOf(it);
                                  return (
                                    <button
                                      key={`${title}-${it.value}`}
                                      type="button"
                                      role="option"
                                      aria-selected={varNavIndex === idx}
                                      className={`formula-calculator-btn formula-calculator-btn-var${
                                        varNavIndex === idx ? ' formula-calculator-btn-var--nav' : ''
                                      }`}
                                      onClick={() => latch(it.value, it.label)}
                                      title={it.value}
                                    >
                                      {it.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="formula-calculator-vars-list" role="listbox" aria-label="Filtered variables">
                        {filteredPickItems.map((it, idx) => (
                          <button
                            key={it.value}
                            type="button"
                            role="option"
                            aria-selected={varNavIndex === idx}
                            className={`formula-calculator-btn formula-calculator-btn-var${
                              varNavIndex === idx ? ' formula-calculator-btn-var--nav' : ''
                            }`}
                            onClick={() => latch(it.value, it.label)}
                            title={it.value}
                          >
                            {it.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default FormulaCalculator;
