import { qualifyEnsembleColumn } from './simulationLazyApi';

/**
 * Evaluate a formula against a row of data.
 * No external deps – uses safe string replacement + eval of numeric expression.
 * Column names in the formula must match the row keys (exact or trimmed).
 */
export function evaluateFormula(formula, row) {
  if (!formula || typeof formula !== 'string') return NaN;
  let expr = formula.trim();
  if (!expr) return NaN;

  const scope = {};
  for (const [key, val] of Object.entries(row)) {
    const num = parseFloat(val);
    const v = Number.isNaN(num) ? 0 : num;
    scope[key] = v;
    const trimmed = key.trim();
    if (trimmed !== key) scope[trimmed] = v;
  }

  const names = Object.keys(scope).sort((a, b) => b.length - a.length);
  for (const name of names) {
    const val = scope[name];
    const safeVal = Number.isFinite(val) ? String(val) : '0';
    expr = expr.split(name).join(`(${safeVal})`);
  }

  const stripFns = /\b(Math\.)?(sqrt|abs|sin|cos|log|exp|min|max)\b/g;
  const stripped = expr
    .replace(stripFns, '')
    .replace(/[\d\s+\-*/().^,eE]+/g, '');
  if (stripped.length > 0) return NaN;
  expr = expr
    .replace(/\^/g, '**')
    .replace(/\bsqrt\s*\(/g, 'Math.sqrt(')
    .replace(/\babs\s*\(/g, 'Math.abs(')
    .replace(/\bsin\s*\(/g, 'Math.sin(')
    .replace(/\bcos\s*\(/g, 'Math.cos(')
    .replace(/\blog\s*\(/g, 'Math.log(')
    .replace(/\bexp\s*\(/g, 'Math.exp(')
    .replace(/\bmin\s*\(/g, 'Math.min(')
    .replace(/\bmax\s*\(/g, 'Math.max(');

  try {
    const result = Function(`"use strict"; return (${expr})`)();
    return typeof result === 'number' && Number.isFinite(result) ? result : NaN;
  } catch {
    return NaN;
  }
}

export function augmentRowsWithDerived(rows, derivedVariables) {
  if (!rows?.length || !derivedVariables?.length) return rows;
  return rows.map((row) => {
    const out = { ...row };
    for (const { name, formula } of derivedVariables) {
      const val = evaluateFormula(formula, row);
      out[name] = Number.isNaN(val) ? '' : val;
    }
    return out;
  });
}

/**
 * One synthetic row for formula evaluation: keys are qualified (`SimId — col`) across all members at rowIndex.
 */
export function buildMergedEvaluationRow(rowIndex, memberSimulations, dataMap) {
  const row = {};
  for (const sid of memberSimulations || []) {
    const r = dataMap?.[sid]?.[rowIndex];
    if (!r) continue;
    for (const [k, val] of Object.entries(r)) {
      row[qualifyEnsembleColumn(sid, k)] = val;
    }
  }
  return row;
}

/**
 * Append ensemble-level formula columns onto the primary member’s rows (same row index across members).
 */
export function augmentEnsemblePrimaryWithCrossMemberDerived(
  memberSimulations,
  dataMap,
  derivedVariables,
  primarySimId,
) {
  if (!derivedVariables?.length || !dataMap || !primarySimId) return dataMap;
  const primaryRows = dataMap[primarySimId];
  if (!primaryRows?.length) return dataMap;

  const newPrimary = primaryRows.map((row, rowIndex) => {
    const evalRow = buildMergedEvaluationRow(rowIndex, memberSimulations, dataMap);
    const out = { ...row };
    for (const { name, formula } of derivedVariables) {
      const val = evaluateFormula(formula, evalRow);
      out[name] = Number.isNaN(val) ? '' : val;
    }
    return out;
  });
  return { ...dataMap, [primarySimId]: newPrimary };
}
