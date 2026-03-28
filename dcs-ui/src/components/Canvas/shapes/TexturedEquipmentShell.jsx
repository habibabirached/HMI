import React from 'react';
import FramedTextureCard from './FramedTextureCard';
import StandardEquipmentLabels from './StandardEquipmentLabels';
import {
  primaryLabelText,
  secondaryLabelText,
  resolveTextureUrl,
  getTextureOpacity,
} from './canvasBlockUtils';

/**
 * For primitive equipment shapes: either full-cell textured card + labels,
 * or custom solid outline (childrenNoTexture) + standard labels.
 */
export default function TexturedEquipmentShell({
  component,
  visualConfig,
  width,
  height,
  strokeColor,
  strokeWidthVal,
  childrenNoTexture,
}) {
  const textureUrl = resolveTextureUrl(visualConfig);
  const textureOpacity = getTextureOpacity(visualConfig);
  const centerX = width / 2;
  const canvasPrimaryText = primaryLabelText(component, visualConfig);
  const canvasSecondaryText = secondaryLabelText(component, visualConfig);

  if (textureUrl) {
    return (
      <>
        <FramedTextureCard
          width={width}
          height={height}
          textureUrl={textureUrl}
          textureOpacity={textureOpacity}
          strokeColor={strokeColor}
          strokeWidthVal={strokeWidthVal}
        />
        <StandardEquipmentLabels
          width={width}
          height={height}
          centerX={centerX}
          visualConfig={visualConfig}
          canvasPrimaryText={canvasPrimaryText}
          canvasSecondaryText={canvasSecondaryText}
          framedTextureLayout
        />
      </>
    );
  }

  return (
    <>
      {childrenNoTexture}
      <StandardEquipmentLabels
        width={width}
        height={height}
        centerX={centerX}
        visualConfig={visualConfig}
        canvasPrimaryText={canvasPrimaryText}
        canvasSecondaryText={canvasSecondaryText}
        framedTextureLayout={false}
      />
    </>
  );
}
