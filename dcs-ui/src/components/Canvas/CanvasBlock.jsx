import React from 'react';
import ComponentEmbeddedSparklines from './ComponentEmbeddedSparklines';
import ComponentConnectionReadout from './ComponentConnectionReadout';
import { getComponentVisualConfig } from '../../data/componentVisuals';
import { strokeForStatus } from './shapes/canvasBlockUtils';
import CanvasComponentBody from './shapes/CanvasComponentBody';

const STRETCHABLE_VERTICAL = ['bus-hv-vertical'];
const STRETCHABLE_HORIZONTAL = ['bus-hv'];

/**
 * One schematic block on the canvas: body, labels, status, chart shortcuts, resize handles.
 * Memoized so a200+ block diagram does not reconcile every block when only selection changes.
 */
function CanvasBlock({
  component,
  isSelected,
  isMultiSelected,
  isDragging,
  mode,
  simulationRunning,
  simulationData = [],
  ensembleMemberSimulationData = null,
  simulationTime = 0,
  simulationColumns = [],
  ensembleColumnGroups = [],
  presenceForcedOffline = false,
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
  const presentationOffline = presenceForcedOffline;
  const { strokeColor, strokeWidthVal } = strokeForStatus(component, isSelected, presentationOffline);

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
        {(isSelected || isMultiSelected) && (
          <rect
            x={-7}
            y={-7}
            width={width + 14}
            height={height + 14}
            rx={Math.min(12, height * 0.11)}
            ry={Math.min(12, height * 0.11)}
            fill={
              isMultiSelected
                ? 'rgba(0, 102, 255, 0.078)'
                : 'rgba(0, 94, 96, 0.086)'
            }
            stroke={
              isMultiSelected
                ? 'rgba(110, 185, 255, 0.7)'
                : 'rgba(0, 200, 188, 0.66)'
            }
            strokeWidth={1.65}
            pointerEvents="none"
          />
        )}

        <CanvasComponentBody
          component={component}
          visualConfig={visualConfig}
          width={width}
          height={height}
          strokeColor={strokeColor}
          strokeWidthVal={strokeWidthVal}
          presentationOffline={presenceForcedOffline}
        />

        {component.embeddedSparklines?.length > 0 &&
          (simulationData?.length > 0 ||
            (component.embeddedSparklines || []).some(
              (s) =>
                (s.ensembleSimId &&
                  ensembleMemberSimulationData?.[s.ensembleSimId]?.length) ||
                (s.ensembleCrossMember && ensembleMemberSimulationData),
            )) && (
          <ComponentEmbeddedSparklines
            embeddedSparklines={component.embeddedSparklines}
            simulationData={simulationData}
            ensembleMemberSimulationData={ensembleMemberSimulationData}
            simulationTime={simulationTime}
            simulationRunning={simulationRunning}
            width={width}
            height={height}
            bottomReservedPx={10 + (component.charts?.length || 0) * 12}
          />
        )}

        {simulationRunning && (
          <circle
            cx={width - 10}
            cy="10"
            r="4"
            fill={
              presentationOffline ||
              component.status === 'offline' ||
              component.status === 'tripped' ||
              component.status === 'open'
                ? '#f44336'
                : component.status === 'idle'
                  ? '#666'
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

      <ComponentConnectionReadout
        connectionReadout={component.connectionReadout}
        simulationData={simulationData}
        ensembleMemberSimulationData={ensembleMemberSimulationData}
        ensembleColumnGroups={ensembleColumnGroups}
        singleSimColumns={simulationColumns}
        simulationTime={simulationTime}
        width={width}
        height={height}
      />
    </g>
  );
}

export default React.memo(CanvasBlock);
