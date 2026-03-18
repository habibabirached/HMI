import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './FormulaCalculator.css';

/**
 * FormulaCalculator – Scientific calculator modal for building Y-axis formulas.
 *
 * Renders as a centered modal overlay. Scientific instrument aesthetic:
 * - LCD-style display
 * - Tactile button grid
 * - Professional typography
 *
 * Props:
 * - open, onClose: modal visibility
 * - variables: column names to insert as variables
 * - onDone: (formula: string, variableName: string) => void – called after user names the variable
 */
const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const OPERATORS = [
  { label: '+', insert: ' + ' },
  { label: '−', insert: ' - ' },
  { label: '×', insert: ' * ' },
  { label: '÷', insert: ' / ' },
  { label: '^', insert: ' ^ ' }
];
const FUNCTIONS = [
  { label: 'sqrt', insert: 'sqrt()' },
  { label: 'abs', insert: 'abs()' },
  { label: 'sin', insert: 'sin()' },
  { label: 'cos', insert: 'cos()' },
  { label: 'log', insert: 'log()' },
  { label: 'exp', insert: 'exp()' },
  { label: 'min', insert: 'min(,)' },
  { label: 'max', insert: 'max(,)' }
];
const PARENS = [
  { label: '(', insert: '(' },
  { label: ')', insert: ')' }
];

const FormulaCalculator = ({
  open = false,
  onClose,
  variables = [],
  value: controlledValue,
  onChange,
  onDone,
  placeholder = 'Enter formula...'
}) => {
  const [internalValue, setInternalValue] = useState('');
  const [namingPhase, setNamingPhase] = useState(false);
  const [pendingFormula, setPendingFormula] = useState('');
  const [variableName, setVariableName] = useState('');
  const inputRef = useRef(null);
  const nameInputRef = useRef(null);

  const isControlled = controlledValue !== undefined;
  const formula = isControlled ? controlledValue : internalValue;

  const setFormula = useCallback(
    (next) => {
      if (!isControlled) setInternalValue(next);
      onChange?.(next);
    },
    [isControlled, onChange]
  );

  const insertAtCursor = useCallback(
    (text) => {
      const input = inputRef.current;
      if (!input) {
        setFormula(formula + text);
        return;
      }
      const start = input.selectionStart ?? formula.length;
      const end = input.selectionEnd ?? formula.length;
      const before = formula.slice(0, start);
      const after = formula.slice(end);
      const next = before + text + after;
      setFormula(next);
      requestAnimationFrame(() => {
        input.focus();
        const newPos = start + text.length;
        input.setSelectionRange(newPos, newPos);
      });
    },
    [formula, setFormula]
  );

  // Step 2: Only allow Done when there's a real formula (no empty or whitespace-only).
  // TODO: Validate formula by evaluating against sample CSV rows – if it throws or yields NaN, reject.
  const trimmedFormula = formula.trim();
  const canDone = trimmedFormula.length > 0;

  // Step 2: Done moves to Step 3 naming phase (user must name the variable).
  const handleDone = useCallback(() => {
    if (!canDone) return;
    setPendingFormula(trimmedFormula);
    setVariableName('');
    setNamingPhase(true);
    requestAnimationFrame(() => nameInputRef.current?.focus());
  }, [canDone, trimmedFormula]);

  // Step 3: Add variable – pass formula + name to parent (parent closes modal).
  const handleAddVariable = useCallback(() => {
    const trimmedName = variableName.trim();
    if (!trimmedName || !onDone) return;
    onDone(pendingFormula, trimmedName);
    setNamingPhase(false);
    setPendingFormula('');
    setVariableName('');
  }, [variableName, pendingFormula, onDone]);

  const handleBackToFormula = useCallback(() => {
    setNamingPhase(false);
    setPendingFormula('');
    setVariableName('');
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (canDone) handleDone(); // Step 2: Enter submits only when formula is valid.
      }
    },
    [canDone, handleDone, onClose]
  );

  useEffect(() => {
    if (open) {
      setInternalValue('');
      setNamingPhase(false);
      setPendingFormula('');
      setVariableName('');
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  if (!open) return null;

  const content = (
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
          <button
            type="button"
            className="formula-calculator-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="formula-calculator-body">
          {namingPhase ? (
            /* Step 3: Naming phase – show formula (read-only) and ask for variable name */
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
                <button
                  type="button"
                  className="formula-calculator-btn formula-calculator-btn-back"
                  onClick={handleBackToFormula}
                >
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
          {/* LCD-style display */}
          <div className="formula-calculator-display-wrap">
            <div className="formula-calculator-display-label">Y =</div>
            <textarea
              ref={inputRef}
              className="formula-calculator-display"
              value={formula}
              onChange={(e) => setFormula(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              rows={2}
              spellCheck={false}
              aria-label="Formula input"
            />
          </div>

          {/* Button grid – scientific layout */}
          <div className="formula-calculator-grid">
            {/* Row 1: Digits 7–9, operators */}
            <div className="formula-calculator-row">
              {['7', '8', '9'].map((d) => (
                <button key={d} type="button" className="formula-calculator-btn formula-calculator-btn-digit" onClick={() => insertAtCursor(d)}>
                  {d}
                </button>
              ))}
              {OPERATORS.slice(0, 2).map((op) => (
                <button key={op.label} type="button" className="formula-calculator-btn formula-calculator-btn-op" onClick={() => insertAtCursor(op.insert)}>
                  {op.label}
                </button>
              ))}
            </div>
            <div className="formula-calculator-row">
              {['4', '5', '6'].map((d) => (
                <button key={d} type="button" className="formula-calculator-btn formula-calculator-btn-digit" onClick={() => insertAtCursor(d)}>
                  {d}
                </button>
              ))}
              {OPERATORS.slice(2, 4).map((op) => (
                <button key={op.label} type="button" className="formula-calculator-btn formula-calculator-btn-op" onClick={() => insertAtCursor(op.insert)}>
                  {op.label}
                </button>
              ))}
            </div>
            <div className="formula-calculator-row">
              {['1', '2', '3'].map((d) => (
                <button key={d} type="button" className="formula-calculator-btn formula-calculator-btn-digit" onClick={() => insertAtCursor(d)}>
                  {d}
                </button>
              ))}
              {OPERATORS.slice(4, 5).map((op) => (
                <button key={op.label} type="button" className="formula-calculator-btn formula-calculator-btn-op" onClick={() => insertAtCursor(op.insert)}>
                  {op.label}
                </button>
              ))}
              <button type="button" className="formula-calculator-btn formula-calculator-btn-paren" onClick={() => insertAtCursor('(')}>
                (
              </button>
            </div>
            <div className="formula-calculator-row">
              <button type="button" className="formula-calculator-btn formula-calculator-btn-digit" onClick={() => insertAtCursor('0')}>
                0
              </button>
              <button type="button" className="formula-calculator-btn formula-calculator-btn-paren" onClick={() => insertAtCursor(')')}>
                )
              </button>
              <button type="button" className="formula-calculator-btn formula-calculator-btn-clear" onClick={() => setFormula('')}>
                C
              </button>
              {/* Step 2: Done is disabled until user types something; tooltip explains why. */}
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

            {/* Functions row */}
            <div className="formula-calculator-row formula-calculator-row-fn">
              {FUNCTIONS.map((fn) => (
                <button key={fn.label} type="button" className="formula-calculator-btn formula-calculator-btn-fn" onClick={() => insertAtCursor(fn.insert)}>
                  {fn.label}
                </button>
              ))}
            </div>

            {/* Variables */}
            {variables.length > 0 && (
              <div className="formula-calculator-vars">
                <div className="formula-calculator-vars-label">Variables</div>
                <div className="formula-calculator-vars-list">
                  {variables.map((v) => (
                    <button
                      key={v}
                      type="button"
                      className="formula-calculator-btn formula-calculator-btn-var"
                      onClick={() => insertAtCursor(v)}
                      title={v}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default FormulaCalculator;
