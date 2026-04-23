import React, { useMemo } from 'react';
import { findColumnKey, cellFloat } from '../../utils/csvRowAccess';
import { parseEnsembleQualifiedColumn } from '../../utils/simulationLazyApi';

/** Match ChartPanel / large CSV: cap polyline points after decimation (Plotly uses sample step). */
const SPARK_MAX_POINTS = 800;
const GREEN = '#66bb6a';
const TEXT_FILL = '#c8e6c9';
const PAD = 3;

function formatYValue(v) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 10000) return n.toExponential(2);
  if (Math.abs(n) >= 100) return n.toFixed(2);
  if (Math.abs(n) >= 1) return n.toFixed(3);
  return n.toFixed(5);
}

/** Same rule as ChartPanel.generatePlotlyData: while running, keep rows with X <= simulationTime. */
function rowsForSparkline(rows, xColumn, simulationTime, simulationRunning) {
  if (!rows?.length || !xColumn) return [];
  if (!simulationRunning || simulationTime === undefined) {
    return rows;
  }
  return rows.filter((row) => {
    const t = cellFloat(row, xColumn);
    return !Number.isNaN(t) && t <= simulationTime;
  });
}

function pointsFromRows(rows, xColumn, yColumn) {
  const pts = [];
  for (let i = 0; i < rows.length; i++) {
    const x = cellFloat(rows[i], xColumn);
    const y = cellFloat(rows[i], yColumn);
    if (Number.isNaN(x) || Number.isNaN(y)) continue;
    pts.push({ x, y });
  }
  return pts;
}

/** X from member A row i, Y from member B row i (same index). */
function pointsEnsembleCross(memberData, xQual, yQual) {
  const xp = parseEnsembleQualifiedColumn(xQual);
  const yp = parseEnsembleQualifiedColumn(yQual);
  if (!xp || !yp) return [];
  const rx = memberData?.[xp.simId];
  const ry = memberData?.[yp.simId];
  if (!rx?.length || !ry?.length) return [];
  const n = Math.min(rx.length, ry.length);
  const pts = [];
  for (let i = 0; i < n; i += 1) {
    const x = cellFloat(rx[i], xp.column);
    const y = cellFloat(ry[i], yp.column);
    if (Number.isNaN(x) || Number.isNaN(y)) continue;
    pts.push({ x, y });
  }
  return pts;
}

/** Evenly subsample so the shape matches Plotly’s long traces without huge SVG paths. */
function decimatePts(pts, maxCount) {
  if (pts.length <= maxCount) return pts;
  const out = [];
  const n = maxCount;
  for (let j = 0; j < n - 1; j++) {
    const idx = Math.floor((j / (n - 1)) * (pts.length - 1));
    out.push(pts[idx]);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/** Full-run X/Y bounds (like Plotly autorange on the whole series) so the mini-trace doesn’t “finish” early. */
function computeFullRunDomain(rows, xColumn, yColumn) {
  let xMin = Infinity;
  let xMax = -Infinity;
  let yMin = Infinity;
  let yMax = -Infinity;
  for (let i = 0; i < rows.length; i++) {
    const x = cellFloat(rows[i], xColumn);
    const y = cellFloat(rows[i], yColumn);
    if (Number.isNaN(x) || Number.isNaN(y)) continue;
    xMin = Math.min(xMin, x);
    xMax = Math.max(xMax, x);
    yMin = Math.min(yMin, y);
    yMax = Math.max(yMax, y);
  }
  if (xMin === Infinity) {
    return { xMin: 0, xMax: 1, yMin: 0, yMax: 1 };
  }
  return {
    xMin,
    xMax: xMax === xMin ? xMin + 1 : xMax,
    yMin,
    yMax: yMax === yMin ? yMin + 1 : yMax,
  };
}

function computeFullRunDomainFromPts(pts) {
  let xMin = Infinity;
  let xMax = -Infinity;
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const p of pts) {
    if (Number.isNaN(p.x) || Number.isNaN(p.y)) continue;
    xMin = Math.min(xMin, p.x);
    xMax = Math.max(xMax, p.x);
    yMin = Math.min(yMin, p.y);
    yMax = Math.max(yMax, p.y);
  }
  if (xMin === Infinity) {
    return { xMin: 0, xMax: 1, yMin: 0, yMax: 1 };
  }
  return {
    xMin,
    xMax: xMax === xMin ? xMin + 1 : xMax,
    yMin,
    yMax: yMax === yMin ? yMin + 1 : yMax,
  };
}

function pathDForPoints(pts, w, h, domain) {
  if (pts.length === 0) return '';
  const { xMin, xMax, yMin, yMax } = domain;
  const dx = xMax - xMin || 1;
  const dy = yMax - yMin || 1;
  const parts = [];
  for (let i = 0; i < pts.length; i++) {
    const px = PAD + ((pts[i].x - xMin) / dx) * (w - 2 * PAD);
    const py = PAD + (1 - (pts[i].y - yMin) / dy) * (h - 2 * PAD);
    parts.push(`${i === 0 ? 'M' : 'L'} ${px.toFixed(2)} ${py.toFixed(2)}`);
  }
  return parts.join(' ');
}

function lastPixel(pts, w, h, domain) {
  if (pts.length === 0) return null;
  const { xMin, xMax, yMin, yMax } = domain;
  const dx = xMax - xMin || 1;
  const dy = yMax - yMin || 1;
  const last = pts[pts.length - 1];
  const px = PAD + ((last.x - xMin) / dx) * (w - 2 * PAD);
  const py = PAD + (1 - (last.y - yMin) / dy) * (h - 2 * PAD);
  return { px, py, y: last.y };
}

function SparkBand({
  spark,
  bandW,
  bandH,
  simulationData,
  ensembleMemberSimulationData,
  simulationTime,
  simulationRunning,
}) {
  const rowsForSpark = useMemo(() => {
    if (spark.ensembleCrossMember) {
      return [];
    }
    if (
      spark.ensembleSimId &&
      ensembleMemberSimulationData?.[spark.ensembleSimId]?.length
    ) {
      return ensembleMemberSimulationData[spark.ensembleSimId];
    }
    return simulationData;
  }, [spark.ensembleCrossMember, spark.ensembleSimId, ensembleMemberSimulationData, simulationData]);

  const fullCrossPts = useMemo(() => {
    if (!spark.ensembleCrossMember || !ensembleMemberSimulationData) return null;
    return pointsEnsembleCross(
      ensembleMemberSimulationData,
      spark.xColumn,
      spark.yColumn
    );
  }, [spark.ensembleCrossMember, ensembleMemberSimulationData, spark.xColumn, spark.yColumn]);

  const domain = useMemo(() => {
    if (fullCrossPts?.length) {
      return computeFullRunDomainFromPts(fullCrossPts);
    }
    return computeFullRunDomain(rowsForSpark, spark.xColumn, spark.yColumn);
  }, [fullCrossPts, rowsForSpark, spark.xColumn, spark.yColumn]);

  const { pathD, labelPos, lastY } = useMemo(() => {
    if (fullCrossPts) {
      let rawPts = fullCrossPts;
      if (simulationRunning && simulationTime !== undefined) {
        rawPts = fullCrossPts.filter((p) => !Number.isNaN(p.x) && p.x <= simulationTime);
      }
      const pts = decimatePts(rawPts, SPARK_MAX_POINTS);
      const d = pathDForPoints(pts, bandW, bandH, domain);
      const pix = lastPixel(pts, bandW, bandH, domain);
      return {
        pathD: d,
        labelPos: pix,
        lastY: pts.length ? pts[pts.length - 1].y : null,
      };
    }
    const rows = rowsForSparkline(
      rowsForSpark,
      spark.xColumn,
      simulationTime,
      simulationRunning
    );
    const rawPts = pointsFromRows(rows, spark.xColumn, spark.yColumn);
    const pts = decimatePts(rawPts, SPARK_MAX_POINTS);
    const d = pathDForPoints(pts, bandW, bandH, domain);
    const pix = lastPixel(pts, bandW, bandH, domain);
    return {
      pathD: d,
      labelPos: pix,
      lastY: pts.length ? pts[pts.length - 1].y : null,
    };
  }, [
    fullCrossPts,
    rowsForSpark,
    spark.xColumn,
    spark.yColumn,
    simulationTime,
    simulationRunning,
    domain,
    bandW,
    bandH,
  ]);

  if (!pathD) {
    return null;
  }

  const tx = Math.min(bandW - 2, Math.max(2, (labelPos?.px ?? bandW * 0.5) + 5));
  const ty = Math.max(10, (labelPos?.py ?? bandH * 0.5) - 8);

  return (
    <g pointerEvents="none">
      <path
        d={pathD}
        fill="none"
        stroke={GREEN}
        strokeWidth={1.35}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <text
        x={tx}
        y={ty}
        textAnchor="start"
        dominantBaseline="middle"
        fill={TEXT_FILL}
        fontSize="9"
        fontWeight="600"
        stroke="rgba(0,0,0,0.45)"
        strokeWidth="0.35"
        paintOrder="stroke fill"
      >
        {formatYValue(lastY)}
      </text>
    </g>
  );
}

/**
 * Minimal transparent sparkline(s): green polyline + latest Y label, no axes.
 */
export default function ComponentEmbeddedSparklines({
  embeddedSparklines = [],
  simulationData = [],
  ensembleMemberSimulationData = null,
  simulationTime,
  simulationRunning,
  width,
  height,
  bottomReservedPx = 8,
}) {
  if (!embeddedSparklines.length) return null;

  const topY = Math.max(8, height * 0.34);
  const bottomY = height - bottomReservedPx;
  const stackH = Math.max(24, bottomY - topY);
  const n = embeddedSparklines.length;
  const bandH = Math.max(20, (stackH - (n - 1) * 2) / n);
  const bandW = width - 8;

  return (
    <g transform="translate(4, 0)" pointerEvents="none">
      {embeddedSparklines.map((spark, i) => (
        <g key={spark.id} transform={`translate(0, ${topY + i * (bandH + 2)})`}>
          <SparkBand
            spark={spark}
            bandW={bandW}
            bandH={bandH}
            simulationData={simulationData}
            ensembleMemberSimulationData={ensembleMemberSimulationData}
            simulationTime={simulationTime}
            simulationRunning={simulationRunning}
          />
        </g>
      ))}
    </g>
  );
}
