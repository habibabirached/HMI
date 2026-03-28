import React from 'react';

/**
 * Full-cell line-art card: black fill, image, status border.
 */
export default function FramedTextureCard({
  width,
  height,
  textureUrl,
  textureOpacity = 0.88,
  strokeColor,
  strokeWidthVal,
}) {
  if (!textureUrl) return null;
  return (
    <>
      <rect width={width} height={height} fill="#000000" rx="4" />
      <image
        href={textureUrl}
        x={0}
        y={0}
        width={width}
        height={height}
        preserveAspectRatio="xMidYMid meet"
        opacity={textureOpacity}
        pointerEvents="none"
      />
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
