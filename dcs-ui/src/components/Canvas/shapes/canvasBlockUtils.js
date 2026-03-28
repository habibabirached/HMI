/**
 * Shared label + stroke helpers for canvas equipment blocks.
 */

export function secondaryLabelText(component, visualConfig) {
  const secMode = visualConfig.canvasSecondaryLabel;
  if (
    secMode === 'voltageKv' &&
    component.properties?.voltage != null &&
    String(component.properties.voltage) !== ''
  ) {
    return `${component.properties.voltage}kV`;
  }
  if (secMode === 'ctRatio') {
    const u = component.properties?.unit;
    if (u != null && String(u).includes(':')) {
      return String(u).trim();
    }
    if (component.properties?.rating > 0) {
      return `${component.properties.rating}:1`;
    }
    return '';
  }
  if (component.properties?.rating > 0) {
    return `${component.properties.rating} ${component.properties.unit}`;
  }
  return '';
}

export function primaryLabelText(component, visualConfig) {
  return visualConfig.canvasPrimaryLabel != null
    ? visualConfig.canvasPrimaryLabel
    : component.name;
}

export function strokeForStatus(component, isSelected) {
  const strokeColor =
    component.status === 'idle'
      ? '#666'
      : component.status === 'offline'
        ? '#ff0000'
        : component.status === 'tripped'
          ? '#ff0000'
          : component.status === 'open'
            ? '#ff9800'
            : isSelected
              ? '#005E60'
              : '#444';
  const strokeWidthVal =
    component.status === 'offline' || component.status === 'tripped'
      ? 4
      : component.status === 'open'
        ? 3
        : isSelected
          ? 3
          : 2;
  return { strokeColor, strokeWidthVal };
}

export function resolveTextureUrl(visualConfig) {
  const href = visualConfig.backgroundTexture;
  if (href == null || href === '') return null;
  return `${process.env.PUBLIC_URL || ''}${href}`;
}

export function getTextureOpacity(visualConfig) {
  return visualConfig.backgroundTextureOpacity != null
    ? visualConfig.backgroundTextureOpacity
    : 0.88;
}
