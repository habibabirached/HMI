import React from 'react';
import SchematicBreaker from './SchematicBreaker';
import SchematicCT from './SchematicCT';
import { getComponentVisualConfig } from '../../data/componentVisuals';

const STRETCHABLE_VERTICAL = ['bus-hv-vertical'];
const STRETCHABLE_HORIZONTAL = ['bus-hv'];

function secondaryLabelText(component, visualConfig) {
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

function primaryLabelText(component, visualConfig) {
  return visualConfig.canvasPrimaryLabel != null
    ? visualConfig.canvasPrimaryLabel
    : component.name;
}

function strokeForStatus(component, isSelected) {
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

/**
 * One schematic block on the canvas: body, labels, status, chart shortcuts, resize handles.
 */
export default function CanvasBlock({
  component,
  isSelected,
  isMultiSelected,
  isDragging,
  mode,
  simulationRunning,
  onMouseDown,
  onMouseUp,
  onContextMenu,
  onOpenChart,
  onUpdateComponent,
  onResizeStart,
}) {
  const visualConfig = getComponentVisualConfig(component.type);
  const width = component.visualOverrides?.width || visualConfig.width;
  const height = component.visualOverrides?.height || visualConfig.height;
  const rotation = component.visualOverrides?.rotation || 0;

  const centerX = width / 2;
  const centerY = height / 2;
  const { strokeColor, strokeWidthVal } = strokeForStatus(component, isSelected);

  const textureUrl = visualConfig.backgroundTexture
    ? `${process.env.PUBLIC_URL || ''}${visualConfig.backgroundTexture}`
    : null;
  const textureOpacity =
    visualConfig.backgroundTextureOpacity != null
      ? visualConfig.backgroundTextureOpacity
      : 0.88;

  const canvasSecondaryText = secondaryLabelText(component, visualConfig);
  const canvasPrimaryText = primaryLabelText(component, visualConfig);
  const isSchematicBreaker = visualConfig.shape === 'schematic-breaker';
  const isSchematicCT = visualConfig.shape === 'schematic-ct';

  return (
    <g
      transform={`translate(${component.position.x},${component.position.y})`}
      onMouseDown={(e) => onMouseDown(e, component)}
      onMouseUp={(e) => onMouseUp(e, component)}
      onContextMenu={(e) => onContextMenu(e, component)}
      className={`canvas-component ${isSelected ? 'selected' : ''} ${isMultiSelected ? 'multi-selected' : ''} ${isDragging ? 'dragging' : ''}`}
      style={{ cursor: mode === 'design' ? 'move' : 'pointer' }}
    >
      <g transform={`rotate(${rotation} ${centerX} ${centerY})`}>
        {textureUrl ? (
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
        ) : isSchematicBreaker ? (
          <SchematicBreaker
            width={width}
            height={height}
            strokeColor={strokeColor}
            strokeWidthVal={strokeWidthVal}
            primaryLabel={canvasPrimaryText}
            secondaryLabel={canvasSecondaryText}
          />
        ) : isSchematicCT ? (
          <SchematicCT
            width={width}
            height={height}
            strokeColor={strokeColor}
            zigzagColor={visualConfig.color}
            primaryLabel={canvasPrimaryText}
            secondaryLabel={canvasSecondaryText}
          />
        ) : (
          <rect
            width={width}
            height={height}
            fill="#1a1a1a"
            stroke={strokeColor}
            strokeWidth={strokeWidthVal}
            rx="4"
          />
        )}

        {!isSchematicBreaker && !isSchematicCT && (
          <>
            {!textureUrl && (
              <text
                x={centerX}
                y={height * 0.28}
                textAnchor="middle"
                fill={visualConfig.color}
                fontSize="24"
                fontWeight="400"
                pointerEvents="none"
                opacity="0.9"
              >
                {visualConfig.icon}
              </text>
            )}
            <text
              x={centerX}
              y={textureUrl ? 4 : height * 0.52}
              textAnchor="middle"
              dominantBaseline={textureUrl ? 'hanging' : 'auto'}
              fill="#e0e0e0"
              fontSize="11"
              fontWeight="600"
              pointerEvents="none"
            >
              {canvasPrimaryText}
            </text>
            <text
              x={centerX}
              y={textureUrl ? height - 4 : height * 0.68}
              textAnchor="middle"
              fill="#999"
              fontSize="10"
              pointerEvents="none"
            >
              {canvasSecondaryText}
            </text>
          </>
        )}

        {simulationRunning && (
          <circle
            cx={width - 10}
            cy="10"
            r="4"
            fill={
              component.status === 'idle'
                ? '#666'
                : component.status === 'offline' ||
                    component.status === 'tripped' ||
                    component.status === 'open'
                  ? '#f44336'
                  : '#4caf50'
            }
          />
        )}

        {isMultiSelected && (
          <g>
            <circle
              cx={width - 10}
              cy="10"
              r="8"
              fill="#0066ff"
              stroke="#0099ff"
              strokeWidth="2"
            />
            <text
              x={width - 10}
              y="14"
              textAnchor="middle"
              fill="white"
              fontSize="12"
              fontWeight="bold"
              pointerEvents="none"
            >
              ✓
            </text>
          </g>
        )}

        {component.charts && component.charts.length > 0 && (
          <g>
            {component.charts.map((chart, index) => {
              const buttonY = height - 12 - ((component.charts.length - 1 - index) * 12);
              const chartLabels = {
                '2d': '2D',
                histogram: 'Hist',
                pie: 'Pie',
                bar: 'Bar',
                '3d': '3D',
                heatmap: 'Heat',
                box: 'Box',
              };
              const label = chartLabels[chart.chartType] || chart.chartType;

              return (
                <g
                  key={chart.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onOpenChart) {
                      onOpenChart(component, chart);
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <rect
                    x="4"
                    y={buttonY}
                    width="28"
                    height="10"
                    fill="rgba(255, 152, 0, 0.2)"
                    stroke="#ff9800"
                    strokeWidth="1"
                    rx="2"
                    className="chart-button"
                  />
                  <text
                    x="18"
                    y={buttonY + 7}
                    textAnchor="middle"
                    fill="#ff9800"
                    fontSize="7"
                    fontWeight="700"
                    pointerEvents="none"
                  >
                    {label}
                  </text>
                </g>
              );
            })}
          </g>
        )}

        {mode === 'design' && isSelected && onUpdateComponent && (
          <>
            {STRETCHABLE_VERTICAL.includes(component.type) && (
              <>
                <rect
                  x={centerX - 6}
                  y={0}
                  width={12}
                  height={10}
                  fill="#005E60"
                  stroke="#00d4a8"
                  strokeWidth={1}
                  rx={2}
                  style={{ cursor: 'ns-resize' }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    onResizeStart({ id: component.id, handle: 'top' });
                  }}
                />
                <rect
                  x={centerX - 6}
                  y={height - 10}
                  width={12}
                  height={10}
                  fill="#005E60"
                  stroke="#00d4a8"
                  strokeWidth={1}
                  rx={2}
                  style={{ cursor: 'ns-resize' }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    onResizeStart({ id: component.id, handle: 'bottom' });
                  }}
                />
              </>
            )}
            {STRETCHABLE_HORIZONTAL.includes(component.type) && (
              <>
                <rect
                  x={0}
                  y={centerY - 6}
                  width={10}
                  height={12}
                  fill="#005E60"
                  stroke="#00d4a8"
                  strokeWidth={1}
                  rx={2}
                  style={{ cursor: 'ew-resize' }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    onResizeStart({ id: component.id, handle: 'left' });
                  }}
                />
                <rect
                  x={width - 10}
                  y={centerY - 6}
                  width={10}
                  height={12}
                  fill="#005E60"
                  stroke="#00d4a8"
                  strokeWidth={1}
                  rx={2}
                  style={{ cursor: 'ew-resize' }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    onResizeStart({ id: component.id, handle: 'right' });
                  }}
                />
              </>
            )}
          </>
        )}
      </g>
    </g>
  );
}
