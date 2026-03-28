import React from 'react';

const PAD_TOP = 4;
const PAD_BOT = 4;
const TITLE_BELOW_GAP = 4;

/**
 * LM2500 Andritz (and similar line-art turbines): dark card, title, centered texture, MW line, status stroke.
 * Mirrors the old framed-texture path in CanvasBlock, but lives under Schematics/ for consistency with GSU / BESS xfmr.
 */
function SchematicLm2500Andritz({
  width,
  height,
  primaryLabel,
  mwLabel,
  textureHref,
  textureOpacity = 0.88,
  strokeColor,
  strokeWidthVal,
}) {
  const cx = width / 2;
  const textureUrl =
    textureHref != null && textureHref !== ''
      ? `${process.env.PUBLIC_URL || ''}${textureHref}`
      : null;

  const titleRowH = 12;
  const artY = PAD_TOP + titleRowH + TITLE_BELOW_GAP;
  const bottomTextH = 12;
  const artH = Math.max(26, height - artY - bottomTextH - PAD_BOT);

  return (
    <>
      <rect width={width} height={height} fill="#000000" rx="4" />
      {textureUrl ? (
        <image
          href={textureUrl}
          x={0}
          y={artY}
          width={width}
          height={artH}
          preserveAspectRatio="xMidYMid meet"
          opacity={textureOpacity}
          pointerEvents="none"
        />
      ) : null}
      <text
        x={cx}
        y={PAD_TOP}
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
        y={height - PAD_BOT}
        textAnchor="middle"
        dominantBaseline="auto"
        fill="#999"
        fontSize="10"
        pointerEvents="none"
      >
        {mwLabel}
      </text>
      <rect
        width={width}
        height={height}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidthVal}
        rx="4"
      />
    </>
  );
}

export default SchematicLm2500Andritz;
