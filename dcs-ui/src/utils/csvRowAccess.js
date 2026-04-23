/** Match ChartPanel / sparklines: tolerate BOM/CR/header spacing mismatches from CSV parsers. */
export function findColumnKey(row, col) {
  if (col == null || row == null) return null;
  if (Object.prototype.hasOwnProperty.call(row, col)) {
    return col;
  }
  const target = String(col).trim();
  if (Object.prototype.hasOwnProperty.call(row, target)) return target;
  for (const k of Object.keys(row)) {
    const kNorm = k.replace(/\r$/, '').trim();
    if (kNorm === target) return k;
  }
  return null;
}

export function cellFloat(row, col) {
  const k = findColumnKey(row, col);
  if (k == null) return NaN;
  return parseFloat(row[k]);
}
