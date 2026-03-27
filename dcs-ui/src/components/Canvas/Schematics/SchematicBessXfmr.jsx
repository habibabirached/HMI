import React from 'react';
import { transformerVoltageRatioLabel } from './schematicUtils';

const LABEL_ART_GAP = 5;
const ART_MVA_GAP = 6;
const HUG_PAD_X = 6;
const HUG_PAD_TOP = 3;
const HUG_PAD_BOT = 4;
const BOLT_ROW_H = 15;

/**
 * BESS transformer: twin lightning row, name, kV ratio, line-art (GSU-style stack), MVA, hugging outline.
 */
function SchematicBessXfmr({
  component,
  width,
  height,
  primaryLabel,
  mvaLabel,
  lineColor,
  textureHref,
  textureOpacity = 1,
}) {
  const cx = width / 2;
  const voltageRatioLabel = transformerVoltageRatioLabel(component);
  const textureUrl =
    textureHref != null && textureHref !== ''
      ? `${process.env.PUBLIC_URL || ''}${textureHref}`
      : null;

  const boltY = Math.max(3, height * 0.02);
  const primaryY = boltY + BOLT_ROW_H;
  /** Extra gap below title so ratio line does not collide with descenders */
  const ratioY = primaryY + 15;
  const artH = Math.max(30, height * 0.32);
  const artY = ratioY + 10 + LABEL_ART_GAP;
  const artBottom = artY + artH;
  const mvaY = Math.min(height - 6, artBottom + ART_MVA_GAP + 8);

  const artW = width * 0.84;
  const outlineW = Math.min(width - 2, artW + 2 * HUG_PAD_X);
  const outlineX = (width - outlineW) / 2;
  const outlineY = boltY - HUG_PAD_TOP;
  const outlineH = mvaY + HUG_PAD_BOT - outlineY;
  const outlineRx = Math.min(4, outlineH / 2);

  return (
    <>
      <rect width={width} height={height} fill="transparent" stroke="none" rx="4" />
      <text
        x={cx - 9}
        y={boltY}
        textAnchor="middle"
        dominantBaseline="hanging"
        fill="#FFC107"
        fontSize="15"
        fontWeight="700"
        pointerEvents="none"
      >
        ⚡
      </text>
      <text
        x={cx + 9}
        y={boltY}
        textAnchor="middle"
        dominantBaseline="hanging"
        fill="#FF9800"
        fontSize="15"
        fontWeight="700"
        pointerEvents="none"
      >
        ⚡
      </text>
      <text
        x={cx}
        y={primaryY}
        textAnchor="middle"
        dominantBaseline="hanging"
        fill="#e0e0e0"
        fontSize="11"
        fontWeight="600"
        pointerEvents="none"
      >
        {primaryLabel}
      </text>
      <text
        x={cx}
        y={ratioY}
        textAnchor="middle"
        dominantBaseline="hanging"
        fill="#bdbdbd"
        fontSize="10"
        fontWeight="500"
        pointerEvents="none"
      >
        {voltageRatioLabel}
      </text>
      {textureUrl ? (
        <image
          href={textureUrl}
          x={cx - width * 0.42}
          y={artY}
          width={width * 0.84}
          height={artH}
          preserveAspectRatio="xMidYMid meet"
          opacity={textureOpacity}
          pointerEvents="none"
        />
      ) : (
        <g
          transform={`translate(${cx - width * 0.35}, ${artY}) scale(${(width * 0.7) / 120})`}
          pointerEvents="none"
        >
          <FallbackTransformerGraphic color={lineColor} />
        </g>
      )}
      <text
        x={cx}
        y={mvaY}
        textAnchor="middle"
        fill="#999"
        fontSize="10"
        pointerEvents="none"
      >
        {mvaLabel}
      </text>
      <rect
        x={outlineX + 0.5}
        y={outlineY + 0.5}
        width={Math.max(1, outlineW - 1)}
        height={Math.max(1, outlineH - 1)}
        rx={outlineRx}
        fill="none"
        stroke="rgba(200, 200, 200, 0.32)"
        strokeWidth={1}
        pointerEvents="none"
      />
    </>
  );
}

function FallbackTransformerGraphic({ color }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 120 100"
      width="120"
      height="100"
      fill="none"
      stroke={color}
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 88h104" />
      <rect x="28" y="52" width="64" height="36" rx="2" />
      <line x1="36" y1="60" x2="50" y2="60" />
      <line x1="36" y1="68" x2="50" y2="68" />
      <line x1="36" y1="76" x2="50" y2="76" />
      <line x1="70" y1="60" x2="84" y2="60" />
      <line x1="70" y1="68" x2="84" y2="68" />
      <line x1="70" y1="76" x2="84" y2="76" />
      <circle cx="60" cy="68" r="10" />
      <path d="M56 65 L58 70 L60 64 L62 70 L64 65" />
      <line x1="38" y1="52" x2="38" y2="28" />
      <line x1="60" y1="52" x2="60" y2="24" />
      <line x1="82" y1="52" x2="82" y2="28" />
      <circle cx="38" cy="22" r="3.5" />
      <circle cx="60" cy="18" r="3.5" />
      <circle cx="82" cy="22" r="3.5" />
      <path d="M38 22 Q50 10 60 18 T82 22" />
    </svg>
  );
}

export default SchematicBessXfmr;
