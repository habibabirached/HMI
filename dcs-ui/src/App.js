import React, { useState, useRef, useCallback, useMemo, useEffect, useLayoutEffect, startTransition } from 'react';
import ComponentLibrary from './components/ComponentLibrary';
import Canvas from './components/Canvas';
import PropertyPanel from './components/PropertyPanel';
import SimulationControls from './components/SimulationControls';
import Toolbar from './components/Toolbar';
import SimulationFetchStatusBar from './components/SimulationFetchStatusBar/SimulationFetchStatusBar';
import SaveLoadDialog from './components/SaveLoadDialog';
import ChartPanel from './components/ChartPanel/ChartPanel';
import ColumnPickerDialog from './components/ColumnPickerDialog/ColumnPickerDialog';
import ConnectionReadoutDialog from './components/ConnectionReadoutDialog/ConnectionReadoutDialog';
import ViewDataModal from './components/ViewDataModal/ViewDataModal';
import SaveSimulationConfigDialog from './components/SaveSimulationConfigDialog/SaveSimulationConfigDialog';
import * as Scenarios from './scenarios/quickScenarios';
import { BREAKER_TYPES } from './data/componentVisuals';
import {
  API_BASE_URL,
  useLazySimulationData,
  SIMULATION_CACHE_FULL_PAYLOAD,
  SIMULATION_LAZY_ALSO_CACHE_FULL_PAYLOAD,
  SIMULATION_LAZY_PAGE_SIZE,
} from './apiConfig';
import {
  pickTimeColumn,
  collectColumnsFromChartsToDisplay,
  columnsNeededForDerived,
  mergeSimulationDataByRowIndex,
  fetchSimulationMetadata,
  fetchSimulationDataSubset,
  qualifyEnsembleColumn,
  parseEnsembleQualifiedColumn,
  singleMemberFromQualifiedSelections,
  parseEnsembleColumnSelections,
  isEnsembleCrossMemberSelection,
  groupColumnsByEnsembleMember,
  ENSEMBLE_COLUMN_SEP,
} from './utils/simulationLazyApi';
import {
  CHART_PANEL_MIN_HEIGHT,
  getChartPanelMaxHeightPx,
  clampChartPanelOpacity,
  CHART_PANEL_OPACITY_DEFAULT,
} from './utils/chartPanelLimits';
import { parseSimulationDeepLink, buildSimulationDeepLinkQuery, lastScenarioSessionStorageKey } from './utils/simDeepLink';
import { downsampleRowsForSparklines, arrayFiniteMinMax } from './utils/simulationSparklineData';
import { copyTextToClipboard } from './utils/clipboard';
import {
  getCachedSimulationPayload,
  setCachedSimulationPayload,
  deleteCachedSimulationPayload,
  mergeCachedSimulationAfterActivate,
  simulationPayloadStoreKey,
} from './utils/simulationDataCache';
import {
  isPerfDebugEnabled,
  logPerfLayout,
  logPerfAfterPaint,
  logPerfBootOnce,
  logPerfNote,
} from './utils/perfDebug';
import './styles/App.css';

/** Verbose trace for deep links / session restore / copy-link debugging — filter console by `[DCS:` */
function dcsSimDbg(phase, payload) {
  console.log(`[DCS:sim] ${phase}`, payload ?? '');
}

/**
 * One line in the saved chart list can carry chart_card_width = “how wide only THIS box is.”
 * When the file leaves it out, that chart follows the big default width (the top toolbar).
 */
function chartCardWidthFromDef(chartDef) {
  if (!chartDef || chartDef.chart_card_width == null) return undefined;
  const n = Number(chartDef.chart_card_width);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(4000, Math.max(200, Math.round(n)));
}

/**
 * Build openCharts + per-chart sample map from backend charts_to_display (green scenario or ensemble).
 * resolveCsvName(chartDef) returns the tray csvName e.g. "LM2500_1.data.csv".
 */
function buildOpenChartsFromChartsToDisplay(chartsToDisplay, canvasComponents, resolveCsvName) {
  const initialPerChart = {};
  const newCharts = (chartsToDisplay || []).map((chartDef, index) => {
    const chartId = `sim-chart-${Date.now()}-${index}`;
    if (chartDef.sample_step != null) initialPerChart[chartId] = chartDef.sample_step;
    const csvName = resolveCsvName(chartDef);
    if (chartDef.type === 'multi') {
      const multi = {
        id: chartId,
        type: 'multi-component',
        chartType: chartDef.chart_type || 'multi-bar-chart',
        title: chartDef.title || 'Multi-Component Chart',
        csvName,
        timeColumn: chartDef.x_column,
        components: chartDef.components || [],
        isMultiComponent: true,
        ...(chartDef.ensemble_sim_id && !chartDef.ensemble_cross_member && { ensembleSimId: chartDef.ensemble_sim_id }),
        ...(chartDef.ensemble_cross_member && { ensembleCrossMember: true }),
      };
      const pcw = chartCardWidthFromDef(chartDef);
      return pcw != null ? { ...multi, chartCardWidth: pcw } : multi;
    }
    const component = canvasComponents.find((c) => c.id === chartDef.component_id);
    if (!component) return null;
    const isNd = chartDef.chart_type === 'nd' && chartDef.y_columns?.length;
    const isPie = chartDef.chart_type === 'pie' && chartDef.y_columns?.length;
    const isStackedNd = chartDef.chart_type === 'stacked-nd' && chartDef.y_columns?.length;
    const single = {
      id: chartId,
      componentId: component.id,
      componentName: component.name,
      chartType: chartDef.chart_type || '2d',
      csvName,
      xColumn: chartDef.x_column,
      ...(isNd || isPie ? { yColumns: chartDef.y_columns } : isStackedNd ? {} : { yColumn: chartDef.y_column }),
      ...(isStackedNd
        ? {
            yColumns: chartDef.y_columns,
            splitBy: chartDef.split_by || 'phase',
            ...(chartDef.split_by === 'manual' &&
              chartDef.manual_group_breaks?.length && { manualGroupBreaks: chartDef.manual_group_breaks }),
          }
        : {}),
      title:
        chartDef.title ||
        (isNd
          ? `${component.name} - nD`
          : isPie
            ? `${component.name} - Pie`
            : isStackedNd
              ? `${component.name} - Stacked nD`
              : `${component.name} - ${chartDef.y_column}`),
      ...(chartDef.x_label != null && { xLabel: chartDef.x_label }),
      ...(chartDef.y_label != null && { yLabel: chartDef.y_label }),
      ...(chartDef.legend_labels != null && typeof chartDef.legend_labels === 'object' && { legendLabels: chartDef.legend_labels }),
      ...(chartDef.axis_range != null
        ? (() => {
            const a = chartDef.axis_range;
            const xL = a.x_locked ?? false;
            const yL = a.y_locked ?? false;
            return {
              axisRange: {
                xLocked: xL,
                yLocked: yL,
                ...(xL
                  ? {
                      ...(a.x_min != null && { xMin: a.x_min }),
                      ...(a.x_max != null && { xMax: a.x_max }),
                    }
                  : {}),
                ...(yL
                  ? {
                      ...(a.y_min != null && { yMin: a.y_min }),
                      ...(a.y_max != null && { yMax: a.y_max }),
                    }
                  : {}),
              },
            };
          })()
        : {}),
      ...(chartDef.ensemble_sim_id && !chartDef.ensemble_cross_member && { ensembleSimId: chartDef.ensemble_sim_id }),
      ...(chartDef.ensemble_cross_member && { ensembleCrossMember: true }),
    };
    const pcw = chartCardWidthFromDef(chartDef);
    return pcw != null ? { ...single, chartCardWidth: pcw } : single;
  }).filter(Boolean);
  return { newCharts, initialPerChart };
}

function App() {
  // Application mode: 'design' or 'simulation'
  const [mode, setMode] = useState('design');
  
  // View mode: 'designer' or 'customer'
  const [viewMode, setViewMode] = useState('customer');

  /** Match ComponentLibrary.css width so the bottom chart strip does not sit under the library. */
  const COMPONENT_LIBRARY_WIDTH_PX = 300;
  /** Property + simulation columns: one edge control collapses the whole right rail. */
  const [rightRailCollapsed, setRightRailCollapsed] = useState(() => {
    try {
      return window.localStorage?.getItem('dcsRightRailCollapsed') === '1';
    } catch {
      return false;
    }
  });
  const rightRailRef = useRef(null);
  const [rightRailWidthPx, setRightRailWidthPx] = useState(640);
  const toggleRightRail = useCallback(() => {
    setRightRailCollapsed((c) => {
      const next = !c;
      try {
        window.localStorage.setItem('dcsRightRailCollapsed', next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);
  useLayoutEffect(() => {
    const el = rightRailRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => {
      setRightRailWidthPx(el.offsetWidth);
    });
    ro.observe(el);
    setRightRailWidthPx(el.offsetWidth);
    return () => ro.disconnect();
  }, [rightRailCollapsed, viewMode]);
  const chartPanelLeftInset = viewMode === 'designer' ? COMPONENT_LIBRARY_WIDTH_PX : 0;
  const chartPanelRightInset = rightRailWidthPx;

  // Canvas state
  const [canvasComponents, setCanvasComponents] = useState([]);
  /** Always use for chart-to-component resolution inside async loaders (state can lag one beat behind Load Design). */
  const canvasComponentsRef = useRef([]);
  useLayoutEffect(() => {
    canvasComponentsRef.current = canvasComponents;
  }, [canvasComponents]);

  /** Latest reset logic for playback loop + Start simulation — avoids stale interval closures. */
  const resetPlaybackVisualsRef = useRef(() => {});
  resetPlaybackVisualsRef.current = () => {
    const prev = canvasComponentsRef.current;
    const initialState = {};
    const next = prev.map((comp) => {
      let startStatus = 'online';
      if (comp.initialSimStatus === 'open') {
        startStatus = BREAKER_TYPES.has(comp.type) ? 'open' : 'offline';
      }
      initialState[comp.id] = {
        ...comp.state,
        status: startStatus,
      };
      return { ...comp, status: startStatus, isTripped: false };
    });
    setCanvasComponents(next);
    setSystemState(initialState);
  };

  const [connections, setConnections] = useState([]);
  const [selectedComponent, setSelectedComponent] = useState(null);
  const [selectedConnection, setSelectedConnection] = useState(null);
  
  // Multi-selection state
  const [selectedComponents, setSelectedComponents] = useState([]); // Array of component IDs for multi-select
  
  // Canvas viewport
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  
  // Simulation state
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [systemState, setSystemState] = useState({});
  const [simulationTime, setSimulationTime] = useState(0); // Current simulation time in seconds
  const [simulationSpeed, setSimulationSpeed] = useState(1); // Speed multiplier: 1x, 10x, 100x, 1000x
  const simulationSpeedRef = useRef(1);
  useLayoutEffect(() => {
    simulationSpeedRef.current = simulationSpeed;
  }, [simulationSpeed]);

  /** Last simulation time (seconds) from metadata / loaded CSV — drives playback loop when reached. */
  const playbackMaxTimeRef = useRef(null);

  const simulationIntervalRef = useRef(null); // Interval for advancing simulation time
  
  // Save/Load dialog state
  const [showDialog, setShowDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState(null); // 'save' or 'load'
  
  // Save state
  const [currentConfigName, setCurrentConfigName] = useState(null); // Track current config name for "Save"
  const [isSaving, setIsSaving] = useState(false); // Saving spinner state
  const [isUploading, setIsUploading] = useState(false); // Upload spinner state
  /** Full-screen wait until derived formula is persisted (ensemble: Parquet + DB). */
  const [derivedVariableCommitMessage, setDerivedVariableCommitMessage] = useState(null);
  const [csvStatus, setCsvStatus] = useState(null); // CSV status for current configuration
  const [availableSimulations, setAvailableSimulations] = useState([]); // Unique simulations from CSV
  const [simConfig, setSimConfig] = useState(null); // Simulation configuration JSON (from backend)
  /*
   * designEnsembles holds what the backend returned from GET …/ensembles (after you load a design that
   * has a {folder}.ensemble.json file). Each item is one “ensemble tab”: a display name plus the list of
   * ordinary scenario ids that belong to that group. Nothing here is a real .sim.json on disk by itself.
   */
  const [designEnsembles, setDesignEnsembles] = useState([]);
  /*
   * When the user picks an ensemble, we fetch metadata (column headers) for every member scenario and
   * store the per-scenario column lists here so SimulationControls can show the “Variables (ensemble)”
   * pane beside the scenario buttons without loading full CSV data yet.
   */
  const [ensembleColumnGroups, setEnsembleColumnGroups] = useState([]);
  /*
   * Phase 2 ensemble playback: after you pick a purple ensemble tab, we download each member’s CSV and keep
   * the augmented row arrays here (keyed by real scenario id). Charts and sparklines read the member they
   * need via ensembleSimId; the shared playhead (simulationTime) still filters by each trace’s X column.
   */
  const [ensembleMemberSimulationData, setEnsembleMemberSimulationData] = useState(null);
  const [simulationData, setSimulationData] = useState([]); // Filtered CSV data for current simulation
  const [simulationMetadata, setSimulationMetadata] = useState(null); // Metadata about current simulation
  const simulationMetadataRef = useRef(null);
  const simulationDataRef = useRef([]);
  useLayoutEffect(() => {
    simulationMetadataRef.current = simulationMetadata;
  }, [simulationMetadata]);
  useLayoutEffect(() => {
    simulationDataRef.current = simulationData;
  }, [simulationData]);

  /** Green scenario + lazy mode: column list for `GET …/data?columns=…` paging (append rows / extra columns). */
  const lazyColumnNeedRef = useRef(null);
  const lazyPageLoadLockRef = useRef(false);

  const ensembleColumnGroupsRef = useRef([]);
  useLayoutEffect(() => {
    ensembleColumnGroupsRef.current = ensembleColumnGroups;
  }, [ensembleColumnGroups]);

  /** sim_config.derived_variables per member, filled when an ensemble tab is selected (metadata pass). */
  const ensembleMemberDerivedBySimIdRef = useRef({});

  /**
   * Full metadata response keyed by simId, cached when an ensemble is loaded (Promise.all metadata
   * pass). Re-used by handleRunSimulation to skip the redundant first network round-trip when the
   * user clicks a scenario that was just an ensemble member.
   */
  const ensembleMemberMetaCacheRef = useRef({});

  const ensembleMemberSimulationDataRef = useRef(null);
  useLayoutEffect(() => {
    ensembleMemberSimulationDataRef.current = ensembleMemberSimulationData;
  }, [ensembleMemberSimulationData]);

  /** Playback span end time (seconds) — when reached, simulation loops from t = 0. */
  useEffect(() => {
    const meta = simulationMetadata;
    const trMax = meta?.timeRange?.max;
    if (Number.isFinite(trMax) && trMax > 0) {
      playbackMaxTimeRef.current = trMax;
      return;
    }
    const rows = simulationDataRef.current?.length ? simulationDataRef.current : simulationData;
    if (rows?.length) {
      const tc = pickTimeColumn(Object.keys(rows[0]));
      if (tc) {
        const v = parseFloat(rows[rows.length - 1][tc]);
        if (Number.isFinite(v) && v > 0) {
          playbackMaxTimeRef.current = v;
          return;
        }
      }
    }
    if (meta?.isEnsemble) {
      const ens = ensembleMemberSimulationDataRef.current;
      const members = meta.memberSimulations || [];
      let maxLast = -Infinity;
      for (const id of members) {
        const mrows = ens?.[id];
        if (!mrows?.length) continue;
        const tc = pickTimeColumn(Object.keys(mrows[0]));
        if (!tc) continue;
        const nv = parseFloat(mrows[mrows.length - 1][tc]);
        if (Number.isFinite(nv)) maxLast = Math.max(maxLast, nv);
      }
      if (Number.isFinite(maxLast) && maxLast >= 0) {
        playbackMaxTimeRef.current = maxLast;
        return;
      }
    }
    playbackMaxTimeRef.current = null;
  }, [
    simulationMetadata?.timeRange?.max,
    simulationMetadata?.id,
    simulationMetadata?.isEnsemble,
    simulationMetadata?.memberSimulations,
    simulationData,
    ensembleMemberSimulationData,
  ]);

  /** Serialize per-member lazy merges so concurrent subset fetches do not clobber each other. */
  const ensembleLoadChainsRef = useRef({});

  /** Assigned after `ensureEnsemblePlaybackPrimed` is defined (see useLayoutEffect below). */
  const ensureEnsemblePlaybackPrimedRef = useRef(() => Promise.resolve());

  // While a scenario is loading (network + parsing + derived columns + charts), we show a linear progress bar
  // in Simulation Controls. This state holds the percent (0–100), a short status line, and which sim id
  // is loading so the UI can highlight the right row.
  const [simulationLoadProgress, setSimulationLoadProgress] = useState(null);
  // Bump this counter each time the user starts a new scenario load. Older in-flight requests use it to
  // stop updating the bar (avoids a slow response from overwriting UI after you already picked another scenario).
  const simulationLoadGenRef = useRef(0);
  // The browser cannot always report true download % for fetch(), so we use a gentle timer that nudges the
  // bar forward until the server responds; we clear this interval whenever the real steps advance or finish.
  const simulationLoadFakeIntervalRef = useRef(null);

  // Chart Panel state
  const [openCharts, setOpenCharts] = useState([]); // Charts currently displayed in bottom panel
  const [chartStacks, setChartStacks] = useState([]); // Array of stacks; each stack = array of chart indices
  // Step 2: named UI presets live as extra keys inside each scenario’s *.sim.json (parallel to current_configuration).
  const [namedSimulationConfigs, setNamedSimulationConfigs] = useState([]);
  const [activeNamedSimulationConfig, setActiveNamedSimulationConfig] = useState(null);
  const activeNamedSimulationConfigRef = useRef(null);
  /** Last preset the user chose (for draft styling when disk draft diverges after edits). */
  const [lastNamedPresetForUi, setLastNamedPresetForUi] = useState(null);
  /** Raw API `data` rows from the last successful load (before derived columns); same-scenario preset switches reuse this to avoid clearing the chart panel. */
  const simulationRawRowsRef = useRef(null);
  const simulationRawRowsSimIdRef = useRef(null);
  /** Deep link calls the same loader as the dialog but must not also run localStorage session-restore for the same navigation. */
  const loadSkipSessionRestoreRef = useRef(false);
  const [saveSimConfigDialogOpen, setSaveSimConfigDialogOpen] = useState(false);
  // After ?design=&sim= opens the catalog design, we run the scenario (and optional named preset) in a second effect.
  const [simDeepLinkFollowup, setSimDeepLinkFollowup] = useState(null);
  /** Incremented on this effect’s cleanup so in-flight async from a Strict Mode “aborted” run does not clear follow-up or apply stale results. */
  const deepLinkFollowupEpochRef = useRef(0);
  // Bumped when Load Design finishes so we can read localStorage and queue the same follow-up as a URL deep link.
  const [sessionRestoreTrigger, setSessionRestoreTrigger] = useState(0);
  const [chartPanelHeight, setChartPanelHeight] = useState(300);
  const [chartPanelOpacity, setChartPanelOpacity] = useState(CHART_PANEL_OPACITY_DEFAULT);
  const [chartCardWidth, setChartCardWidth] = useState(500);
  const persistChartCardWidthRef = useRef(null);
  const persistPerChartCardWidthRef = useRef(null);
  const [globalSampleStep, setGlobalSampleStep] = useState(128); // Chart sampling: 1=every row, 2=every 2nd, etc.
  const [perChartSampleStep, setPerChartSampleStep] = useState({}); // Per-chart override: { chartId: step }
  const [selectedRowIndices, setSelectedRowIndices] = useState(null); // Set<number> for cross-chart selection, null = none

  // STEP 4: Column picker – when user picks a chart type, we show this dialog to choose X/Y columns
  const [columnPickerContext, setColumnPickerContext] = useState(null); // { component, chartType } | null
  const [connectionReadoutContext, setConnectionReadoutContext] = useState(null); // component | null

  // View data modal – show first 200 rows of simulation CSV
  const [viewModal, setViewModal] = useState(null); // { simName, displayName, data } | null
  
  // Panel focus for z-index (click-to-bring-forward)
  const [focusedPanel, setFocusedPanel] = useState(null); // 'canvas' | 'property' | 'simulation' | 'charts' | null
  
  // Design view: canvas (interactive), image (PNG only), split (both side by side)
  const [designViewMode, setDesignViewMode] = useState('canvas'); // 'canvas' | 'image' | 'split'
  
  const canvasRef = useRef(null);

  useLayoutEffect(() => {
    if (!isPerfDebugEnabled()) return;
    logPerfLayout('App', {
      selectedComponentId: selectedComponent?.id ?? null,
      canvasBlocks: canvasComponents.length,
      isEnsemble: simulationMetadata?.isEnsemble ?? false,
      qualifiedColumnCount: simulationMetadata?.columns?.length ?? 0,
      openCharts: openCharts.length,
    });
    logPerfAfterPaint('App');
  }, [selectedComponent?.id, canvasComponents.length, simulationMetadata?.isEnsemble, simulationMetadata?.columns?.length, openCharts.length]);

  useEffect(() => {
    logPerfBootOnce();
  }, []);

  /** URL path segment for /api/designs/... when using on-disk layouts (includes archive/foo when archived). */
  const designApiPath = useMemo(() => {
    if (!currentConfigName) return null;
    if (csvStatus?.use_design_dir) {
      return csvStatus.design_catalog_rel || currentConfigName;
    }
    return currentConfigName;
  }, [currentConfigName, csvStatus?.use_design_dir, csvStatus?.design_catalog_rel]);

  const designImageUrl = currentConfigName && csvStatus?.use_design_dir && designApiPath
    ? `${API_BASE_URL}/api/designs/${encodeURIComponent(designApiPath)}/image`
    : null;

  /*
   * Whenever the active design path is known and we are using on-disk layouts, ask the server for
   * {design}.ensemble.json. If the file is missing, the API returns an empty list; Simulation Controls
   * still offers “Add ensemble” to create the sidecar file. We clear ensemble-related state when switching
   * designs so you never see stale groups from a previous project.
   */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!designApiPath || !csvStatus?.use_design_dir) {
        if (!cancelled) {
          setDesignEnsembles([]);
          setEnsembleColumnGroups([]);
          setEnsembleMemberSimulationData(null);
        }
        return;
      }
      try {
        const r = await fetch(
          `${API_BASE_URL}/api/designs/${encodeURIComponent(designApiPath)}/ensembles`,
        );
        if (!r.ok) throw new Error(String(r.status));
        const data = await r.json();
        if (!cancelled) {
          setDesignEnsembles(Array.isArray(data.ensembles) ? data.ensembles : []);
        }
      } catch {
        if (!cancelled) setDesignEnsembles([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [designApiPath, csvStatus?.use_design_dir]);

  /** Fewer rows on Canvas limits work when ~200 blocks re-render; charts still use full simulationData. */
  const simulationDataForCanvas = useMemo(
    () => downsampleRowsForSparklines(simulationData),
    [simulationData],
  );

  /*
   * Canvas “add chart” actions need metadata (and for non-ensemble lazy mode, rowCount) so pickers work.
   * Ensemble purple tab loads only metadata first; per-member CSV rows load on demand (charts, Play, etc.).
   */
  const simulationReadyForCharts = useMemo(() => {
    if (!simulationMetadata) return false;
    if (simulationMetadata.isEnsemble) {
      const members = simulationMetadata.memberSimulations || [];
      return members.length > 0 && (simulationMetadata.rowCount ?? 0) > 0;
    }
    return (
      (simulationData?.length ?? 0) > 0 ||
      (useLazySimulationData && (simulationMetadata.rowCount ?? 0) > 0)
    );
  }, [simulationMetadata, simulationData, useLazySimulationData]);

  const handlePanelFocus = (panel, e) => {
    if (e.target.closest('button, select, input, a, [role="button"]')) return;
    setFocusedPanel(panel);
  };

  // Add component to canvas
  const handleAddComponent = useCallback((componentDef, position) => {
    const newComponent = {
      ...componentDef,
      id: `${componentDef.id}-${Date.now()}`,
      type: componentDef.id,
      position: position || { x: 100, y: 100 },
      status: 'idle', // Start components as idle (gray) until simulation starts
      state: {
        power: 0,
        voltage: componentDef.properties?.voltage || 0,
        current: 0,
        frequency: 60
      }
    };
    
    setCanvasComponents(prev => [...prev, newComponent]);
  }, []);

  // Update component position
  const handleMoveComponent = useCallback((componentId, newPosition) => {
    setCanvasComponents(prev =>
      prev.map(comp =>
        comp.id === componentId ? { ...comp, position: newPosition } : comp
      )
    );
  }, []);

  // Update component properties
  const handleUpdateComponent = useCallback((componentId, updates) => {
    setCanvasComponents(prev =>
      prev.map(comp =>
        comp.id === componentId ? { ...comp, ...updates } : comp
      )
    );
    setSelectedComponent(prev =>
      prev?.id === componentId ? { ...prev, ...updates } : prev
    );
  }, []);

  // Delete component
  const handleDeleteComponent = useCallback((componentId) => {
    setCanvasComponents(prev => prev.filter(comp => comp.id !== componentId));
    setConnections(prev => prev.filter(conn => 
      conn.from !== componentId && conn.to !== componentId
    ));
    if (selectedComponent?.id === componentId) {
      setSelectedComponent(null);
    }
  }, [selectedComponent]);

  // Add connection
  const handleAddConnection = useCallback((fromId, toId) => {
    const newConnection = {
      id: `conn-${Date.now()}`,
      from: fromId,
      to: toId,
      voltage: 0,
      type: 'AC',
      status: 'normal',
      style: { useAuto: true }
    };
    setConnections(prev => [...prev, newConnection]);
  }, []);

  const handleUpdateConnection = useCallback((connectionId, patch) => {
    const mergeStyle = (prev, stylePatch) => {
      if (stylePatch == null) return prev;
      const base = { ...(prev || {}) };
      const next = { ...base, ...stylePatch };
      if (stylePatch.shadow != null) {
        next.shadow = {
          blur: 4,
          offsetX: 2,
          offsetY: 2,
          opacity: 0.35,
          color: '#000000',
          ...(base.shadow || {}),
          ...stylePatch.shadow
        };
      }
      return next;
    };
    setConnections(prev => {
      const mapped = prev.map(c => {
        if (c.id !== connectionId) return c;
        const next = { ...c, ...patch };
        if (patch.style != null) {
          next.style = mergeStyle(c.style, patch.style);
        }
        return next;
      });
      return mapped;
    });
    setSelectedConnection(prev => {
      if (!prev || prev.id !== connectionId) return prev;
      const next = { ...prev, ...patch };
      if (patch.style != null) {
        next.style = mergeStyle(prev.style, patch.style);
      }
      return next;
    });
  }, []);

  // Delete connection
  const handleDeleteConnection = useCallback((connectionId) => {
    setConnections(prev => prev.filter(conn => conn.id !== connectionId));
    if (selectedConnection?.id === connectionId) {
      setSelectedConnection(null);
    }
  }, [selectedConnection]);

  // ============================================================================
  // MULTI-SELECTION HANDLERS
  // ============================================================================
  
  /**
   * Toggle a component in multi-selection
   * @param {string} componentId - ID of component to toggle
   * @param {boolean} shiftKey - Whether Shift key is pressed
   */
  const handleMultiSelect = useCallback((componentId, shiftKey) => {
    if (!shiftKey) {
      // No shift key - clear multi-selection, use single selection
      setSelectedComponents([]);
      return;
    }
    
    // Shift key pressed - toggle this component in multi-selection
    setSelectedComponents(prev => {
      if (prev.includes(componentId)) {
        // Already selected - remove it
        return prev.filter(id => id !== componentId);
      } else {
        // Not selected - add it
        return [...prev, componentId];
      }
    });
    
    // Clear single selection when using multi-select
    setSelectedComponent(null);
  }, []);
  
  /**
   * Clear all multi-selections
   */
  const handleClearMultiSelection = useCallback(() => {
    setSelectedComponents([]);
  }, []);
  
  /**
   * Check if a component is multi-selected
   * @param {string} componentId
   * @returns {boolean}
   */
  const isComponentMultiSelected = useCallback((componentId) => {
    return selectedComponents.includes(componentId);
  }, [selectedComponents]);

  // Toggle mode
  const handleToggleMode = () => {
    if (mode === 'design') {
      // Validate before entering simulation
      if (canvasComponents.length === 0) {
        alert('Add components to the canvas before starting simulation');
        return;
      }
      setMode('simulation');
    } else {
      setMode('design');
      setSimulationRunning(false);
    }
  };

  // Start simulation
  const handleStartSimulation = () => {
    const start = () => {
      setSimulationRunning(true);
      setSimulationTime(0); // Reset simulation time to 0

      resetPlaybackVisualsRef.current();

      startSimulationClock();
    };

    /*
     * Ensemble lazy mode: metadata-only until Play — then fetch each member’s time column (small request)
     * so the shared playhead can align with loaded traces.
     */
    if (simulationMetadata?.isEnsemble) {
      void (async () => {
        try {
          await ensureEnsemblePlaybackPrimedRef.current?.();
          const members = simulationMetadata.memberSimulations || [];
          const ok =
            members.length > 0 &&
            members.every((id) => (ensembleMemberSimulationDataRef.current?.[id]?.length ?? 0) > 0);
          if (!ok) {
            alert(
              'Could not load ensemble time columns for playback.\n\nCheck the network connection and try Play again.',
            );
            return;
          }
          start();
        } catch (e) {
          console.warn('ensemble playback prime failed', e);
          alert(`Could not start ensemble playback:\n\n${e.message || e}`);
        }
      })();
      return;
    }

    start();
  };

  // Stop simulation
  const handleStopSimulation = () => {
    setSimulationRunning(false);
    stopSimulationClock();
  };

  /*
   * Purple ensemble tab: clear charts/clock, fetch metadata only for every member (headers + row counts).
   * Per-member CSV rows load lazily when you add charts, sparks, or press Play (time column priming).
   */
  const handleSelectEnsemble = useCallback(
    async (ensemble) => {
      if (!ensemble?.id || !designApiPath) return;
      logPerfNote('ensemble button → handleSelectEnsemble start', {
        ensembleId: ensemble.id,
        members: (ensemble.member_simulations || []).length,
      });
      stopSimulationClock();
      setSimulationRunning(false);
      setSimulationTime(0);
      setOpenCharts([]);
      setChartStacks([]);
      setPerChartSampleStep({});
      setActiveNamedSimulationConfig(null);
      setLastNamedPresetForUi(null);
      simulationRawRowsRef.current = null;
      simulationRawRowsSimIdRef.current = null;
      setSelectedComponent(null);
      setSelectedConnection(null);
      setEnsembleMemberSimulationData(null);
      setSimulationData([]);

      const members = ensemble.member_simulations || [];
      if (!members.length) {
        alert('This ensemble has no member scenarios.');
        return;
      }

      const progressId = `__ensemble:${ensemble.id}`;
      const loadGen = ++simulationLoadGenRef.current;
      const isStale = () => simulationLoadGenRef.current !== loadGen;

      try {
        setSimulationLoadProgress({
          simulationId: progressId,
          percent: 8,
          status: 'Loading ensemble metadata…',
          loadSource: 'server',
        });

        const metas = await Promise.all(
          members.map((simId) => fetchSimulationMetadata(designApiPath, simId)),
        );
        if (isStale()) return;

        ensembleMemberDerivedBySimIdRef.current = Object.fromEntries(
          members.map((sid, i) => [sid, metas[i]?.sim_config?.derived_variables || []]),
        );

        // Cache each member's full metadata so handleRunSimulation can skip the redundant
        // re-fetch when the user clicks a scenario that was just an ensemble member.
        ensembleMemberMetaCacheRef.current = Object.fromEntries(
          members.map((sid, i) => [sid, metas[i]]),
        );

        const ensDerived = Array.isArray(ensemble.chart_panel?.derived_variables)
          ? ensemble.chart_panel.derived_variables
          : [];
        const columnsOrdered = [];
        for (let i = 0; i < members.length; i++) {
          const sid = members[i];
          for (const c of metas[i]?.columns || []) {
            columnsOrdered.push(qualifyEnsembleColumn(sid, c));
          }
        }
        const primarySid = members[0];
        for (const d of ensDerived) {
          const q = qualifyEnsembleColumn(primarySid, d.name);
          if (!columnsOrdered.includes(q)) columnsOrdered.push(q);
        }
        const groups = members.map((simId, i) => ({
          simId,
          columns: metas[i]?.columns || [],
        }));
        let formulaMeta = null;
        if (!members.includes('formula')) {
          try {
            formulaMeta = await fetchSimulationMetadata(designApiPath, 'formula');
            if (isStale()) return;
            if (formulaMeta?.columns?.length) {
              groups.push({ simId: 'formula', columns: formulaMeta.columns });
              for (const c of formulaMeta.columns) {
                const q = qualifyEnsembleColumn('formula', c);
                if (!columnsOrdered.includes(q)) columnsOrdered.push(q);
              }
            }
          } catch (e) {
            /* optional formula.data.csv; ignore */
          }
        }
        setEnsembleColumnGroups(groups);

        let maxRows = 0;
        for (const m of metas) {
          maxRows = Math.max(maxRows, m?.row_count ?? 0);
        }

        ensembleMemberSimulationDataRef.current = {};
        ensembleLoadChainsRef.current = {};
        setEnsembleMemberSimulationData({});

        setSimulationMetadata({
          id: `__ensemble:${ensemble.id}`,
          displayName: ensemble.display_name || ensemble.id,
          description: '',
          rowCount: maxRows,
          timeRange: { min: 0, max: 0 },
          columns: columnsOrdered,
          derivedVariables: ensDerived,
          isEnsemble: true,
          ensembleId: ensemble.id,
          memberSimulations: [...members],
        });

        const cp = ensemble.chart_panel;
        const primary = members[0];
        if (cp && typeof cp === 'object') {
          setChartStacks(Array.isArray(cp.chart_stacks) ? cp.chart_stacks : []);
          setGlobalSampleStep(cp.chart_sample_default > 1 ? cp.chart_sample_default : 128);
          const panelMax = getChartPanelMaxHeightPx();
          if (
            cp.chart_panel_height != null &&
            cp.chart_panel_height >= CHART_PANEL_MIN_HEIGHT
          ) {
            setChartPanelHeight(Math.min(cp.chart_panel_height, panelMax));
          }
          if (cp.chart_panel_opacity != null) {
            setChartPanelOpacity(clampChartPanelOpacity(cp.chart_panel_opacity));
          } else {
            setChartPanelOpacity(CHART_PANEL_OPACITY_DEFAULT);
          }
          const wRaw = cp.chart_card_width;
          if (wRaw != null && Number.isFinite(Number(wRaw))) {
            setChartCardWidth(Math.min(4000, Math.max(200, Math.round(Number(wRaw)))));
          } else {
            setChartCardWidth(500);
          }
          if (cp.view_mode === 'designer' || cp.view_mode === 'customer') {
            setViewMode(cp.view_mode);
          }
          const chartsToDisplay = cp.charts_to_display || [];
          const canvas = canvasComponentsRef.current;
          const { newCharts, initialPerChart } = buildOpenChartsFromChartsToDisplay(
            chartsToDisplay,
            canvas,
            (def) =>
              def.ensemble_sim_id ? `${def.ensemble_sim_id}.data.csv` : `${primary}.data.csv`,
          );
          setOpenCharts(newCharts);
          setPerChartSampleStep(initialPerChart);
        }

        setSimulationLoadProgress({
          simulationId: progressId,
          percent: 100,
          status: 'Ensemble ready (metadata)',
          loadSource: 'server',
        });
        logPerfNote('ensemble metadata ready (rows load on demand)', {
          ensembleId: ensemble.id,
          members: members.length,
          rowCount: maxRows,
        });
        setTimeout(() => {
          if (simulationLoadGenRef.current === loadGen) {
            setSimulationLoadProgress(null);
          }
        }, 400);
      } catch (e) {
        console.warn('handleSelectEnsemble failed', e);
        ensembleMemberDerivedBySimIdRef.current = {};
        ensembleMemberMetaCacheRef.current = {};
        setEnsembleColumnGroups([]);
        setEnsembleMemberSimulationData(null);
        setSimulationData([]);
        setSimulationLoadProgress(null);
        alert(`Could not load ensemble:\n\n${e.message || e}`);
      }
    },
    [designApiPath],
  );

  const handleDeleteEnsemble = useCallback(
    async (ensemble) => {
      if (!ensemble?.id || !designApiPath) return;
      const label = ensemble.display_name || ensemble.id;
      if (
        !window.confirm(
          `Delete ensemble "${label}"?\n\nThis removes its entry from the design’s .ensemble.json file. Scenario files (.sim.json / .data.csv) are not deleted.`,
        )
      ) {
        return;
      }
      try {
        const r = await fetch(
          `${API_BASE_URL}/api/designs/${encodeURIComponent(designApiPath)}/ensembles/${encodeURIComponent(ensemble.id)}`,
          { method: 'DELETE' },
        );
        if (!r.ok) {
          const t = await r.text();
          throw new Error(t || r.statusText);
        }
        const listRes = await fetch(
          `${API_BASE_URL}/api/designs/${encodeURIComponent(designApiPath)}/ensembles`,
        );
        if (listRes.ok) {
          const data = await listRes.json();
          setDesignEnsembles(Array.isArray(data.ensembles) ? data.ensembles : []);
        }
        const wasActive =
          simulationMetadata?.isEnsemble &&
          simulationMetadata?.ensembleId === ensemble.id;
        if (wasActive) {
          stopSimulationClock();
          setSimulationRunning(false);
          setSimulationTime(0);
          setOpenCharts([]);
          setChartStacks([]);
          setPerChartSampleStep({});
          setActiveNamedSimulationConfig(null);
          setLastNamedPresetForUi(null);
          simulationRawRowsRef.current = null;
          simulationRawRowsSimIdRef.current = null;
          setSimulationMetadata(null);
          setSimulationData([]);
          setEnsembleColumnGroups([]);
          ensembleMemberDerivedBySimIdRef.current = {};
          ensembleMemberMetaCacheRef.current = {};
          ensembleMemberSimulationDataRef.current = {};
          setEnsembleMemberSimulationData(null);
          setSimulationLoadProgress(null);
        }
      } catch (e) {
        alert(`Could not delete ensemble:\n\n${e?.message || e}`);
      }
    },
    [designApiPath, simulationMetadata?.isEnsemble, simulationMetadata?.ensembleId],
  );

  /** Refetch ensemble definitions after create/edit in SimulationControls (writes {leaf}.ensemble.json). */
  const refreshDesignEnsembles = useCallback(async () => {
    if (!designApiPath || !csvStatus?.use_design_dir) return;
    try {
      const r = await fetch(
        `${API_BASE_URL}/api/designs/${encodeURIComponent(designApiPath)}/ensembles`,
      );
      if (!r.ok) return;
      const data = await r.json();
      setDesignEnsembles(Array.isArray(data.ensembles) ? data.ensembles : []);
    } catch {
      /* ignore */
    }
  }, [designApiPath, csvStatus?.use_design_dir]);

  // Simulation clock advancement — loops to t = 0 when playback reaches CSV/metadata max time.
  const startSimulationClock = (speed) => {
    if (speed !== undefined) {
      simulationSpeedRef.current = speed;
    }

    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
    }

    simulationIntervalRef.current = setInterval(() => {
      setSimulationTime((prev) => {
        const spd = simulationSpeedRef.current;
        const dt = 0.1 * spd;
        const next = prev + dt;
        const tMax = playbackMaxTimeRef.current;
        if (Number.isFinite(tMax) && tMax > 0 && next >= tMax) {
          queueMicrotask(() => resetPlaybackVisualsRef.current());
          return 0;
        }
        return next;
      });
    }, 100);
  };
  
  const stopSimulationClock = () => {
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }
  };
  
  // Update simulation speed
  const handleSetSimulationSpeed = (speed) => {
    setSimulationSpeed(speed);
    simulationSpeedRef.current = speed;
    if (simulationRunning) {
      startSimulationClock(speed);
    }
  };
  
  // Clean up interval on unmount
  React.useEffect(() => {
    return () => {
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
      }
    };
  }, []);

  // ========================================================================
  // FUNCTION: handleTripComponent
  // ========================================================================
  // This function makes a component "trip" or "fail" - like when a turbine
  // breaks down or goes offline.
  //
  // HOW IT WORKS (Step by step):
  // 1. Find the component with the matching ID
  // 2. Change its status from 'normal' to 'offline'
  // 3. Set its power output to 0 (because it's not working anymore)
  //
  // REACT CONCEPT - useCallback:
  // We wrap this function in useCallback() which tells React:
  // "Don't recreate this function every time the component re-renders,
  //  keep using the same function." This makes the app faster.
  //
  // REACT CONCEPT - setCanvasComponents:
  // This is a "state setter" function from useState(). When we call it,
  // React updates the state AND automatically re-renders the screen.
  //
  // REACT CONCEPT - Immutability:
  // We don't change the existing array directly (that would be mutation).
  // Instead, we create a NEW array with .map() where one component is changed.
  // This is how React knows something changed and needs to update the screen.
  const handleTripComponent = useCallback((componentId) => {
    // DEBUG: Log to console so we can see this function was called
    console.log('🔴 handleTripComponent called with ID:', componentId);
    
    // Update the canvasComponents state
    setCanvasComponents(prev => {
      // DEBUG: Log the current components before the change
      console.log('📋 Current components:', prev);
      
      // 'prev' is the current state (the old array of components)
      // We use .map() to create a new array with one component modified
      const updated = prev.map(comp => {
        // Check: Is this the component we want to trip?
        if (comp.id === componentId) {
          // DEBUG: Found the component we're tripping
          console.log('✅ Found component to trip:', comp.name, comp.id);
          
          return { 
            // YES - This is the one! Create a new object with changes
            ...comp,                          // Copy all existing properties
            status: 'offline',                // Change status to offline
            state: { 
              ...comp.state,                  // Copy existing state properties
              power: 0                        // Set power to zero (not producing)
            }
          };
        }
        return comp;  // NO - Not this one, keep it unchanged
      });
      
      // DEBUG: Log the updated components after the change
      console.log('📋 Updated components:', updated);
      
      return updated;
    });
  }, []); // Empty array means: never recreate this function

  // ========================================================================
  // FUNCTION: handleRestartComponent
  // ========================================================================
  // This function brings a component back online after it was tripped/failed.
  //
  // HOW IT WORKS (Step by step):
  // 1. Find the component with the matching ID
  // 2. Change its status from 'offline' back to 'normal'
  // 3. Restore its power output (for generators, use their rating)
  //
  // This is essentially the OPPOSITE of handleTripComponent.
  //
  // REACT CONCEPT - Same patterns as handleTripComponent:
  // - useCallback for performance
  // - Immutability (create new array with .map())
  // - State setter triggers re-render
  const handleRestartComponent = useCallback((componentId) => {
    // DEBUG: Log to console so we can see this function was called
    console.log('🟢 handleRestartComponent called with ID:', componentId);
    
    // Update the canvasComponents state
    setCanvasComponents(prev => {
      // DEBUG: Log the current components before the change
      console.log('📋 Current components:', prev);
      
      const updated = prev.map(comp => {
        // Check: Is this the component we want to restart?
        if (comp.id === componentId) {
          // DEBUG: Found the component we're restarting
          console.log('✅ Found component to restart:', comp.name, comp.id);
          
          // For generators/turbines, restore power to their rating
          // For other components, just set to 0 (they don't generate power)
          const restoredPower = comp.rating && comp.type.includes('turbine') 
            ? comp.rating 
            : 0;
          
          return { 
            ...comp,                          // Copy all existing properties
            status: 'normal',                 // Change status back to normal
            state: { 
              ...comp.state,                  // Copy existing state properties
              power: restoredPower            // Restore power output
            }
          };
        }
        return comp;  // Not this one, keep unchanged
      });
      
      // DEBUG: Log the updated components after the change
      console.log('📋 Updated components:', updated);
      
      return updated;
    });
  }, []);

  // ========================================================================
  // FUNCTION: handleOpenBreaker
  // ========================================================================
  // This opens a breaker, which disconnects the electrical circuit.
  // Think of it like flipping a light switch to OFF - no power flows through.
  //
  // This is a NORMAL operation (not a failure), so we use status 'open'
  // instead of 'offline'. Operators manually open breakers to isolate
  // sections of the power system for maintenance or reconfiguration.
  const handleOpenBreaker = useCallback((componentId) => {
    console.log('🟠 handleOpenBreaker called with ID:', componentId);
    
    setCanvasComponents(prev => {
      const updated = prev.map(comp => {
        if (comp.id === componentId) {
          console.log('✅ Opening breaker:', comp.name, comp.id);
          return { 
            ...comp,
            status: 'open',              // Status: open (manually opened)
            state: { 
              ...comp.state,
              current: 0                 // No current flows through open breaker
            }
          };
        }
        return comp;
      });
      return updated;
    });
  }, []);

  // ========================================================================
  // FUNCTION: handleCloseBreaker
  // ========================================================================
  // This closes a breaker, which reconnects the electrical circuit.
  // Think of it like flipping a light switch to ON - power can flow through.
  //
  // This restores normal operation after a breaker was manually opened.
  const handleCloseBreaker = useCallback((componentId) => {
    console.log('🟢 handleCloseBreaker called with ID:', componentId);
    
    setCanvasComponents(prev => {
      const updated = prev.map(comp => {
        if (comp.id === componentId) {
          console.log('✅ Closing breaker:', comp.name, comp.id);
          return { 
            ...comp,
            status: 'normal',            // Status: normal (closed and operational)
            state: { 
              ...comp.state,
              // Current will be determined by power flow calculation later
            }
          };
        }
        return comp;
      });
      return updated;
    });
  }, []);

  // ========================================================================
  // FUNCTION: handleTripBreaker
  // ========================================================================
  // This trips a breaker due to a protection fault (overcurrent, short circuit, etc.)
  // This is DIFFERENT from manually opening - it's an automatic safety response.
  //
  // When a breaker trips, it's like a circuit breaker in your home tripping
  // due to overload. It needs to be reset/closed before it can work again.
  const handleTripBreaker = useCallback((componentId) => {
    console.log('🔴 handleTripBreaker called with ID:', componentId);
    
    setCanvasComponents(prev => {
      const updated = prev.map(comp => {
        if (comp.id === componentId) {
          console.log('✅ Tripping breaker:', comp.name, comp.id);
          return { 
            ...comp,
            status: 'tripped',           // Status: tripped (fault condition)
            state: { 
              ...comp.state,
              current: 0                 // No current flows through tripped breaker
            }
          };
        }
        return comp;
      });
      return updated;
    });
  }, []);

  // ========================================================================
  // QUICK SCENARIO WRAPPER FUNCTIONS
  // ========================================================================
  // These functions wrap the scenario module functions, providing them
  // with the current canvas state and handler functions they need.
  // 
  // ARCHITECTURE NOTE:
  // The actual scenario logic lives in ./scenarios/quickScenarios.js
  // These wrapper functions just connect the scenarios to our App state.
  // This keeps the code organized and modular!
  // ========================================================================

  const handleTripRandomTurbine = useCallback(() => {
    const result = Scenarios.tripRandomTurbine(canvasComponents, {
      handleTripComponent
    });
    
    if (result.success && result.selectedComponent) {
      setSelectedComponent(result.selectedComponent);
    } else if (!result.success) {
      alert(result.message);
    }
  }, [canvasComponents, handleTripComponent]);

  const handleTripAllTurbines = useCallback(() => {
    const result = Scenarios.tripAllTurbines(canvasComponents, {
      handleTripComponent
    });
    
    if (!result.success) {
      alert(result.message);
    }
  }, [canvasComponents, handleTripComponent]);

  const handleGridLoss = useCallback(() => {
    const result = Scenarios.gridLoss(canvasComponents, {
      handleTripComponent
    });
    
    if (!result.success) {
      alert(result.message);
    }
  }, [canvasComponents, handleTripComponent]);

  const handleOpenAllBreakers = useCallback(() => {
    const result = Scenarios.openAllBreakers(canvasComponents, {
      handleOpenBreaker
    });
    
    if (!result.success) {
      alert(result.message);
    }
  }, [canvasComponents, handleOpenBreaker]);

  // ========================================================================
  // FUNCTION: handleResetSystem
  // ========================================================================
  // This function resets the entire simulation back to the initial state.
  // All components are returned to 'normal' status, clearing any failures,
  // trips, or manual operations.
  //
  // WHAT IT DOES:
  // 1. Loops through every component on the canvas
  // 2. Changes status to 'normal' (operational)
  // 3. Restores default power outputs for generators
  // 4. Essentially a "start over" button
  //
  // USE CASE:
  // After running several failure scenarios, you want to return to a
  // clean slate without having to manually restart each component.
  const handleResetSystem = useCallback(() => {
    console.log('🔄 Reset System triggered');
    
    // Count how many components are currently not normal
    const abnormalComponents = canvasComponents.filter(comp => 
      comp.status !== 'normal'
    );
    
    if (abnormalComponents.length === 0) {
      console.log('✅ System already in normal state');
      alert('System is already in normal state - nothing to reset!');
      return;
    }
    
    // Ask for confirmation before resetting
    const confirmed = window.confirm(
      `Reset ${abnormalComponents.length} component(s) back to normal state?\n\n` +
      'This will clear all failures, trips, and open breakers.'
    );
    
    if (!confirmed) {
      console.log('❌ Reset cancelled by user');
      return;
    }
    
    console.log(`🔄 Resetting ${abnormalComponents.length} components to normal`);
    
    // Reset all components to normal state
    setCanvasComponents(prev => 
      prev.map(comp => {
        // Only change components that aren't already normal
        if (comp.status !== 'normal') {
          console.log('  ↻ Resetting:', comp.name, comp.id, 'from', comp.status, 'to normal');
          
          // For generators/turbines, restore power to their rating
          const restoredPower = comp.rating && comp.type.includes('turbine') 
            ? comp.rating 
            : 0;
          
          return {
            ...comp,
            status: 'normal',
            state: {
              ...comp.state,
              power: restoredPower
            }
          };
        }
        return comp;
      })
    );
    
    console.log('✅ System reset complete');
  }, [canvasComponents]);

  /**
   * Handle simulation scenario button click
   * This will be expanded in later steps to:
   * 1. Clear existing charts
   * 2. Load charts for this simulation (from JSON config)
   * 3. Filter CSV data to only this simulation
   * 4. Start playback
   */
  /**
   * @param {string} simulationId
   * @param {{ presetResult?: object, cachePresetName?: string } | undefined} options
   *        presetResult — full API-shaped payload (used by deep links when a preset slot is already in IndexedDB).
   *        cachePresetName — after a successful load, duplicate `result` under design::sim#preset for future links.
   */
  const handleRunSimulation = async (simulationId, options = {}) => {
    const perfT0 = performance.now();
    const perfMark = (label, extra = undefined) => {
      const ms = (performance.now() - perfT0).toFixed(1);
      if (extra !== undefined) {
        console.log(`[DCS:perf] handleRunSimulation +${ms}ms`, label, extra);
      } else {
        console.log(`[DCS:perf] handleRunSimulation +${ms}ms`, label);
      }
    };
    console.log('🎬 Run simulation clicked:', simulationId);
    console.log('📊 Current configuration:', currentConfigName);
    console.log('📊 CSV status:', csvStatus);
    dcsSimDbg('handleRunSimulation ▶ start', {
      simulationId,
      optionsKeys: options ? Object.keys(options) : [],
      options,
      currentConfigName,
      designApiPath,
      canvasLen_state: canvasComponents.length,
      canvasLen_ref: canvasComponentsRef.current.length,
      canvasIds_sample: canvasComponentsRef.current.slice(0, 8).map((c) => c.id),
      availableSimulationsCount: availableSimulations.length,
      loadGen: simulationLoadGenRef.current,
    });

    if (!currentConfigName) {
      alert('⚠️ No configuration loaded. Please load a design first.');
      return;
    }
    
    if (!availableSimulations.includes(simulationId)) {
      alert(`⚠️ Simulation "${simulationId}" not found.`);
      return;
    }
    
    if (!csvStatus?.use_design_dir) {
      alert('⚠️ No design directory for this configuration.');
      return;
    }
    if (!designApiPath) {
      alert('⚠️ Design path not available. Try reloading the configuration.');
      return;
    }

    perfMark('passed guards, showing progress bar', {
      simulationId,
      optionsKeys: Object.keys(options || {}),
    });

    // --- Scenario load progress (linear bar in Simulation Controls) -----------------------------
    // From here until the fetch completes, the user sees “Loading data” plus a moving %.
    // loadGen ties all async steps to this click so overlapping runs cannot corrupt the bar.
    const loadGen = ++simulationLoadGenRef.current;
    const isStale = () => simulationLoadGenRef.current !== loadGen;
    const setLoad = (patch) => {
      if (isStale()) return;
      setSimulationLoadProgress((prev) => (prev ? { ...prev, ...patch } : prev));
    };
    const stopFakeProgress = () => {
      if (simulationLoadFakeIntervalRef.current != null) {
        clearInterval(simulationLoadFakeIntervalRef.current);
        simulationLoadFakeIntervalRef.current = null;
      }
    };

    setSimulationLoadProgress({
      simulationId,
      percent: 4,
      status: 'Checking for saved copy in this browser…',
      loadSource: 'pending',
    });

    console.log('🧹 Clearing existing charts...');
    /*
     * Leaving ensemble mode: user chose a real scenario tab, so discard the grouped column snapshot used
     * only for the ensemble variables pane. The next successful load will be a normal simulation again.
     */
    setEnsembleColumnGroups([]);
    setEnsembleMemberSimulationData(null);
    // Switching to a different scenario’s CSV clears which preset button should look “active”; same scenario reload (e.g. activate preset) keeps the highlight until we replace it.
    if (simulationMetadata?.id !== simulationId) {
      setActiveNamedSimulationConfig(null);
      setLastNamedPresetForUi(null);
      simulationRawRowsRef.current = null;
      simulationRawRowsSimIdRef.current = null;
    }
    setOpenCharts([]);
    setSelectedComponent(null);
    setSelectedConnection(null);
    stopSimulationClock();
    setSimulationRunning(false);
    setSimulationTime(0);

    stopFakeProgress();

    try {
      lazyColumnNeedRef.current = null;
      let filteredRows;
      let scenarioConfig;
      let csvNameForCharts;
      let result;

      const presetResult = options.presetResult;
      const canUsePresetFull =
        presetResult &&
        Array.isArray(presetResult.data) &&
        presetResult.data.length > 0;

      if (useLazySimulationData && !canUsePresetFull) {
        dcsSimDbg('handleRunSimulation ◆ data source = LAZY (metadata + column subset)', {
          simulationId,
        });

        // Check if we have a fresh metadata response cached from the ensemble load.
        // This avoids a redundant round-trip when the user clicks an ensemble member scenario.
        const cachedMeta = ensembleMemberMetaCacheRef.current?.[simulationId];
        if (!cachedMeta) {
          setLoad({
            percent: 8,
            status: 'Loading simulation metadata…',
            loadSource: 'server',
          });
          simulationLoadFakeIntervalRef.current = setInterval(() => {
            setSimulationLoadProgress((prev) => {
              if (!prev || prev.simulationId !== simulationId || isStale()) return prev;
              if (prev.loadSource !== 'server') return prev;
              if (prev.percent >= 78) return prev;
              return { ...prev, percent: Math.min(78, prev.percent + 1.4) };
            });
          }, 90);
        } else {
          setLoad({
            percent: 40,
            status: 'Loading column data…',
            loadSource: 'server',
          });
        }

        const meta = cachedMeta ?? await fetchSimulationMetadata(designApiPath, simulationId);
        // Once we consume the cached metadata, evict it so a forced reload gets a fresh copy.
        if (cachedMeta) {
          delete ensembleMemberMetaCacheRef.current[simulationId];
        }
        perfMark('lazy metadata received', {
          columns: meta?.columns?.length,
          rows: meta?.row_count,
          fromCache: !!cachedMeta,
        });
        if (isStale()) {
          stopFakeProgress();
          return;
        }

        const rowCount = meta.row_count ?? 0;
        if (rowCount === 0) {
          stopFakeProgress();
          setSimulationLoadProgress(null);
          alert(`⚠️ No data found for simulation "${simulationId}".`);
          return;
        }

        const csvCols = meta.columns || [];
        const scenarioEarly = meta.sim_config || {};
        const timeCol = pickTimeColumn(csvCols);
        const chartCols = collectColumnsFromChartsToDisplay(
          scenarioEarly.charts_to_display || [],
        );
        const derivedDeps = columnsNeededForDerived(
          scenarioEarly.derived_variables || [],
          csvCols,
        );
        const need = [...new Set([timeCol, ...chartCols, ...derivedDeps].filter(Boolean))];
        lazyColumnNeedRef.current = need;

        stopFakeProgress();
        setLoad({ percent: 48, status: 'Loading column data…', loadSource: 'server' });
        simulationLoadFakeIntervalRef.current = setInterval(() => {
          setSimulationLoadProgress((prev) => {
            if (!prev || prev.simulationId !== simulationId || isStale()) return prev;
            if (prev.loadSource !== 'server') return prev;
            if (prev.percent >= 82) return prev;
            return { ...prev, percent: Math.min(82, prev.percent + 2) };
          });
        }, 90);

        const dataPayload = await fetchSimulationDataSubset(
          designApiPath,
          simulationId,
          need,
          { offset: 0, limit: SIMULATION_LAZY_PAGE_SIZE },
        );
        perfMark('lazy column data received', { rows: dataPayload?.data?.length });
        if (isStale()) {
          stopFakeProgress();
          return;
        }
        stopFakeProgress();

        const subsetRows = dataPayload.data || [];
        if (!subsetRows.length) {
          setSimulationLoadProgress(null);
          alert(`⚠️ No data rows returned for simulation "${simulationId}".`);
          return;
        }

        result = {
          design_name: meta.design_name,
          sim_name: meta.sim_name,
          sim_config: meta.sim_config,
          data: subsetRows,
          row_count: subsetRows.length,
          named_configuration_keys: meta.named_configuration_keys || [],
          /** Full CSV header order for the columns pane; row objects only hold a subset until lazy fetch. */
          csv_columns: Array.isArray(meta.columns) ? meta.columns : [],
          row_count_total: meta.row_count,
          time_column_min: meta.time_column_min,
          time_column_max: meta.time_column_max,
        };

        if (SIMULATION_LAZY_ALSO_CACHE_FULL_PAYLOAD && !isStale()) {
          const fullUrl = `${API_BASE_URL}/api/designs/${encodeURIComponent(designApiPath)}/simulations/${encodeURIComponent(simulationId)}`;
          fetch(fullUrl)
            .then((r) => (r.ok ? r.json() : null))
            .then((payload) => {
              if (payload && designApiPath && simulationId) {
                setCachedSimulationPayload(designApiPath, simulationId, payload, null).catch(
                  () => {},
                );
              }
            })
            .catch(() => {});
        }
        perfMark('lazy path assembled result', { dataRows: result.data?.length });
      } else if (canUsePresetFull) {
        dcsSimDbg('handleRunSimulation ◆ data source = presetResult (IndexedDB preset slot)', {
          dataRows: presetResult.data.length,
          hasSimConfig: !!presetResult.sim_config,
          chartsToDisplayPreset: presetResult.sim_config?.charts_to_display?.length ?? 0,
        });
        stopFakeProgress();
        setLoad({
          percent: 35,
          status: 'Loading data from cache…',
          loadSource: 'cache',
        });
        result = presetResult;
        perfMark('using presetResult (IndexedDB)', { rows: presetResult.data?.length });
      } else {
        const defaultKey = simulationPayloadStoreKey(designApiPath, simulationId, null);
        const cached = await getCachedSimulationPayload(designApiPath, simulationId, null);
        perfMark('IndexedDB default slot read complete', {
          hit: !!(cached?.data?.length),
          rows: cached?.data?.length ?? 0,
        });
        if (isStale()) {
          stopFakeProgress();
          dcsSimDbg('handleRunSimulation ✖ stale after default IDB read', { simulationId });
          return;
        }

        if (cached && Array.isArray(cached.data) && cached.data.length > 0) {
          dcsSimDbg('handleRunSimulation ◆ data source = default IDB cache', {
            key: defaultKey,
            dataRows: cached.data.length,
            chartsToDisplayCached: cached.sim_config?.charts_to_display?.length ?? 0,
          });
          stopFakeProgress();
          setLoad({
            percent: 35,
            status: 'Loading data from cache…',
            loadSource: 'cache',
          });
          result = cached;
          perfMark('using default IDB cache');
        } else {
          dcsSimDbg('handleRunSimulation ◆ data source = SERVER (no default cache hit)', {
            keyChecked: defaultKey,
            cachedWasNull: cached == null,
            cachedDataLen: cached?.data?.length ?? 0,
            fetchUrl: `${API_BASE_URL}/api/designs/${encodeURIComponent(designApiPath)}/simulations/${encodeURIComponent(simulationId)}`,
          });
          setLoad({
            percent: 8,
            status: 'Loading data from server…',
            loadSource: 'server',
          });
          // Creep the bar while we wait on the network (server loads only).
          simulationLoadFakeIntervalRef.current = setInterval(() => {
            setSimulationLoadProgress((prev) => {
              if (!prev || prev.simulationId !== simulationId || isStale()) return prev;
              if (prev.loadSource !== 'server') return prev;
              if (prev.percent >= 82) return prev;
              return { ...prev, percent: Math.min(82, prev.percent + 1.4) };
            });
          }, 90);

          const response = await fetch(
            `${API_BASE_URL}/api/designs/${encodeURIComponent(designApiPath)}/simulations/${encodeURIComponent(simulationId)}`
          );
          perfMark('GET simulation HTTP response received', { ok: response.ok, status: response.status });
          if (isStale()) {
            stopFakeProgress();
            return;
          }
          stopFakeProgress();
          setLoad({ percent: 62, status: 'Downloading simulation data…' });

          if (!response.ok) throw new Error(`Failed to load simulation: ${response.statusText}`);
          setLoad({ percent: 74, status: 'Reading response…' });
          result = await response.json();
          perfMark('response.json() parsed', { dataRows: result?.data?.length });
          if (isStale()) {
            stopFakeProgress();
            return;
          }
          try {
            if (SIMULATION_CACHE_FULL_PAYLOAD) {
              await setCachedSimulationPayload(designApiPath, simulationId, result, null);
            }
          } catch (_) {
            /* ignore IDB write errors */
          }
        }
      }

      filteredRows = result.data || [];
      scenarioConfig = result.sim_config || {};
      csvNameForCharts = `${simulationId}.data.csv`;

      const chartsToDisplay = scenarioConfig.charts_to_display || [];
      dcsSimDbg('handleRunSimulation ◈ after result parse', {
        filteredRows: filteredRows.length,
        chartsToDisplayCount: chartsToDisplay.length,
        chartStacksCount: (scenarioConfig.chart_stacks || []).length,
        chartDefSample: chartsToDisplay.slice(0, 3),
        canvasRefLen: canvasComponentsRef.current.length,
        canvasRefIds: canvasComponentsRef.current.slice(0, 12).map((c) => c.id),
      });

      if (!filteredRows || filteredRows.length === 0) {
        stopFakeProgress();
        setSimulationLoadProgress(null);
        alert(`⚠️ No data found for simulation "${simulationId}".`);
        return;
      }

      simulationRawRowsRef.current = filteredRows;
      simulationRawRowsSimIdRef.current = simulationId;

      setLoad({ percent: 82, status: 'Processing rows…' });
      const derivedVariables = scenarioConfig.derived_variables || [];
      perfMark('before augmentRowsWithDerived', {
        rows: filteredRows.length,
        derivedVars: derivedVariables.length,
      });
      const augmentedRows = (await import('./utils/formulaEvaluator')).augmentRowsWithDerived(filteredRows, derivedVariables);
      perfMark('after augmentRowsWithDerived', { rows: augmentedRows.length });
      if (isStale()) {
        stopFakeProgress();
        return;
      }
      setLoad({ percent: 90, status: 'Applying chart layout…' });

      // Do not change designer/customer toggle when switching green tabs — that comes from each
      // scenario’s .sim.json current_configuration and surprises users. View mode stays as-is until
      // they use the header toggle (still persisted per scenario when they toggle).
      const cc = scenarioConfig.current_configuration;

      const timeFromRowKeys = (r) => {
        if (!r || typeof r !== 'object') return NaN;
        const tc = pickTimeColumn(Object.keys(r));
        return tc != null ? Number(r[tc]) : NaN;
      };
      const timeValues = augmentedRows.map((r) => timeFromRowKeys(r));
      const rowTimeBounds = arrayFiniteMinMax(timeValues);
      const tMetaMin = result?.time_column_min;
      const tMetaMax = result?.time_column_max;
      const tMin =
        Number.isFinite(tMetaMin) && Number.isFinite(tMetaMax) ? tMetaMin : rowTimeBounds.min;
      const tMax =
        Number.isFinite(tMetaMin) && Number.isFinite(tMetaMax) ? tMetaMax : rowTimeBounds.max;
      const row0Keys = Object.keys(augmentedRows[0] || {});
      let columnsForUi;
      if (Array.isArray(result.csv_columns) && result.csv_columns.length > 0) {
        columnsForUi = [...result.csv_columns];
        const colSet = new Set(columnsForUi);
        for (const { name } of derivedVariables || []) {
          if (name && !colSet.has(name)) {
            columnsForUi.push(name);
            colSet.add(name);
          }
        }
      } else {
        columnsForUi = row0Keys;
      }
      const fullRowCount =
        result?.row_count_total != null ? result.row_count_total : augmentedRows.length;
      const simulationMetadata = {
        id: simulationId,
        displayName: scenarioConfig.display_name || simConfig?.simulations?.[simulationId]?.display_name || simulationId,
        description: scenarioConfig.description || '',
        rowCount: fullRowCount,
        ...(useLazySimulationData &&
          fullRowCount > augmentedRows.length && { loadedRowCount: augmentedRows.length }),
        timeRange: { min: tMin, max: tMax },
        columns: columnsForUi,
        derivedVariables,
      };

      startTransition(() => {
        setSimulationData(augmentedRows);
        setSimulationMetadata(simulationMetadata);

        setSimConfig(prev => {
          const sims = prev?.simulations ? { ...prev.simulations } : {};
          const existing = sims[simulationId] || {};
          sims[simulationId] = {
            ...existing,
            display_name: scenarioConfig.display_name ?? existing.display_name,
            description: scenarioConfig.description ?? existing.description,
            has_data: true,
            event_markers: scenarioConfig.event_markers
          };
          return { simulations: sims };
        });

        setChartStacks(scenarioConfig.chart_stacks || []);
        setGlobalSampleStep(scenarioConfig.chart_sample_default > 1 ? scenarioConfig.chart_sample_default : 128);
        const panelMax = getChartPanelMaxHeightPx();
        if (
          scenarioConfig.chart_panel_height != null &&
          scenarioConfig.chart_panel_height >= CHART_PANEL_MIN_HEIGHT
        ) {
          setChartPanelHeight(Math.min(scenarioConfig.chart_panel_height, panelMax));
        }
        if (scenarioConfig.chart_panel_opacity != null) {
          setChartPanelOpacity(clampChartPanelOpacity(scenarioConfig.chart_panel_opacity));
        } else {
          setChartPanelOpacity(CHART_PANEL_OPACITY_DEFAULT);
        }
        {
          const wRaw = scenarioConfig.chart_card_width ?? cc?.chart_card_width;
          if (wRaw != null && Number.isFinite(Number(wRaw))) {
            setChartCardWidth(Math.min(4000, Math.max(200, Math.round(Number(wRaw)))));
          } else {
            setChartCardWidth(500);
          }
        }
        const initialPerChart = {};
        if (chartsToDisplay.length > 0) {
          const newCharts = chartsToDisplay.map((chartDef, index) => {
            const chartId = `sim-chart-${Date.now()}-${index}`;
            if (chartDef.sample_step != null) initialPerChart[chartId] = chartDef.sample_step;
            if (chartDef.type === 'multi') {
              const multi = {
                id: chartId,
                type: 'multi-component',
                chartType: chartDef.chart_type || 'multi-bar-chart',
                title: chartDef.title || 'Multi-Component Chart',
                csvName: csvNameForCharts,
                timeColumn: chartDef.x_column,
                components: chartDef.components || [],
                isMultiComponent: true,
                ...(chartDef.ensemble_sim_id && !chartDef.ensemble_cross_member && { ensembleSimId: chartDef.ensemble_sim_id }),
                ...(chartDef.ensemble_cross_member && { ensembleCrossMember: true }),
              };
              const pcw = chartCardWidthFromDef(chartDef);
              return pcw != null ? { ...multi, chartCardWidth: pcw } : multi;
            }
            const component = canvasComponentsRef.current.find((c) => c.id === chartDef.component_id);
            if (!component) {
              dcsSimDbg('handleRunSimulation ⚠ chart dropped — no canvas component for chartDef.component_id', {
                wantedId: chartDef.component_id,
                chartTitle: chartDef.title,
                chartType: chartDef.chart_type,
              });
              return null;
            }
            const isNd = chartDef.chart_type === 'nd' && chartDef.y_columns?.length;
            const isPie = chartDef.chart_type === 'pie' && chartDef.y_columns?.length;
            const isStackedNd = chartDef.chart_type === 'stacked-nd' && chartDef.y_columns?.length;
            const single = {
              id: chartId,
              componentId: component.id,
              componentName: component.name,
              chartType: chartDef.chart_type || '2d',
              csvName: csvNameForCharts,
              xColumn: chartDef.x_column,
              ...(isNd || isPie ? { yColumns: chartDef.y_columns } : isStackedNd ? {} : { yColumn: chartDef.y_column }),
              ...(isStackedNd ?  {
                yColumns: chartDef.y_columns,
                splitBy: chartDef.split_by || 'phase',
                ...(chartDef.split_by === 'manual' && chartDef.manual_group_breaks?.length && { manualGroupBreaks: chartDef.manual_group_breaks })
              } : {}),
              title: chartDef.title || (isNd ? `${component.name} - nD` : isPie ? `${component.name} - Pie` : isStackedNd ? `${component.name} - Stacked nD` : `${component.name} - ${chartDef.y_column}`),
              ...(chartDef.ensemble_sim_id && !chartDef.ensemble_cross_member && { ensembleSimId: chartDef.ensemble_sim_id }),
              ...(chartDef.ensemble_cross_member && { ensembleCrossMember: true }),
            };
            const pcw = chartCardWidthFromDef(chartDef);
            return pcw != null ? { ...single, chartCardWidth: pcw } : single;
          }).filter(Boolean);
          dcsSimDbg('handleRunSimulation ◈ openCharts build', {
            requestedCharts: chartsToDisplay.length,
            builtCharts: newCharts.length,
            dropped: chartsToDisplay.length - newCharts.length,
          });
          if (chartsToDisplay.length > 0 && newCharts.length === 0) {
            dcsSimDbg('handleRunSimulation ⚠⚠ ALL charts dropped — check component_id vs canvas ids', {
              chartComponentIds: chartsToDisplay.map((d) => d.component_id).filter(Boolean),
              canvasIds: canvasComponentsRef.current.map((c) => c.id),
            });
          }
          setOpenCharts(newCharts);
          setPerChartSampleStep(initialPerChart);
        } else {
          dcsSimDbg('handleRunSimulation ◈ no charts_to_display in sim_config — chart panel stays empty', {
            simKeys: Object.keys(scenarioConfig),
          });
          setChartStacks([]);
          setPerChartSampleStep({});
        }

        setNamedSimulationConfigs(result.named_configuration_keys || []);
      });

      if (isStale()) {
        stopFakeProgress();
        return;
      }
      stopFakeProgress();
      const cachePresetName = options.cachePresetName;
      if (cachePresetName && result && !useLazySimulationData && SIMULATION_CACHE_FULL_PAYLOAD) {
        try {
          await setCachedSimulationPayload(designApiPath, simulationId, result, cachePresetName);
        } catch (_) {
          /* ignore IDB write errors */
        }
      }
      try {
        if (csvStatus?.use_design_dir && designApiPath) {
          localStorage.setItem(
            lastScenarioSessionStorageKey(designApiPath),
            JSON.stringify({
              simId: simulationId,
              namedConfig: activeNamedSimulationConfigRef.current || null,
            }),
          );
        }
      } catch (_) {
        /* ignore quota / private mode */
      }
      setLoad({ percent: 100, status: 'Complete' });
      perfMark('✓ complete (progress bar will hide in 450ms)', {
        simulationId,
        charts: chartsToDisplay.length,
        totalMs: Math.round(performance.now() - perfT0),
      });
      dcsSimDbg('handleRunSimulation ✓ complete', {
        simulationId,
        chartsToDisplayFromConfig: chartsToDisplay.length,
        cachePresetWritten: !!options.cachePresetName,
        cachePresetName: options.cachePresetName ?? null,
      });
      // Brief moment at 100% so the user sees completion; then hide the meter entirely.
      setTimeout(() => {
        if (simulationLoadGenRef.current === loadGen) {
          setSimulationLoadProgress(null);
        }
      }, 450);
    } catch (error) {
      stopFakeProgress();
      if (simulationLoadGenRef.current === loadGen) {
        setSimulationLoadProgress(null);
      }
      console.log('[DCS:perf] handleRunSimulation FAILED', {
        ms: Math.round(performance.now() - perfT0),
        message: error?.message,
      });
      console.error('❌ Error loading simulation:', error);
      dcsSimDbg('handleRunSimulation ✖ ERROR', { message: error?.message, stack: error?.stack });
      alert(`❌ Failed to load simulation:\n\n${error.message}`);
    }
  };

  /**
   * Apply activate-preset API response in-place: same CSV rows (from simulationRawRowsRef), new sim_config.
   * Avoids setOpenCharts([]) + full reload so the chart panel stays mounted and updates smoothly.
   * @returns {Promise<boolean>} true if applied, false if raw rows are missing (caller should full load).
   */
  const applyActivatedNamedPresetInPlace = useCallback(async (simulationId, activated) => {
    const t0 = performance.now();
    const scenarioConfig = activated.sim_config || {};
    const raw = simulationRawRowsRef.current;
    const rawFor = simulationRawRowsSimIdRef.current;
    if (!raw?.length || rawFor !== simulationId) {
      console.log('[DCS:perf] applyActivatedNamedPresetInPlace ⏭ skip', {
        ms: Math.round(performance.now() - t0),
        rawLen: raw?.length ?? 0,
        rawFor,
        simulationId,
      });
      return false;
    }

    const derivedVariables = scenarioConfig.derived_variables || [];
    console.log('[DCS:perf] applyActivatedNamedPresetInPlace ▶ augmentRows', {
      rows: raw.length,
      derivedVars: derivedVariables.length,
    });
    const augmentedRows = (await import('./utils/formulaEvaluator')).augmentRowsWithDerived(
      raw,
      derivedVariables,
    );
    console.log('[DCS:perf] applyActivatedNamedPresetInPlace after augmentRows', {
      augmentMs: Math.round(performance.now() - t0),
      outRows: augmentedRows.length,
    });

    const cc = scenarioConfig.current_configuration;

    const timeValues = augmentedRows.map((r) => Number(r['Time (s)'] ?? r.time_sec) ?? 0);
    const { min: tMin, max: tMax } = arrayFiniteMinMax(timeValues);
    startTransition(() => {
      setSimulationData(augmentedRows);
      setSimulationMetadata((prev) => {
        const row0Keys = Object.keys(augmentedRows[0] || {});
        const base =
          useLazySimulationData && Array.isArray(prev?.columns) && prev.columns.length
            ? [...prev.columns]
            : [...row0Keys];
        const colSet = new Set(base);
        for (const k of row0Keys) {
          if (!colSet.has(k)) {
            base.push(k);
            colSet.add(k);
          }
        }
        for (const { name } of derivedVariables || []) {
          if (name && !colSet.has(name)) {
            base.push(name);
            colSet.add(name);
          }
        }
        return {
          id: simulationId,
          displayName:
            scenarioConfig.display_name ||
            simConfig?.simulations?.[simulationId]?.display_name ||
            simulationId,
          description: scenarioConfig.description || '',
          rowCount: prev?.rowCount ?? augmentedRows.length,
          ...(typeof prev?.loadedRowCount === 'number' ? { loadedRowCount: prev.loadedRowCount } : {}),
          timeRange: { min: tMin, max: tMax },
          columns: base,
          derivedVariables,
        };
      });

      setSimConfig((prev) => {
        const sims = prev?.simulations ? { ...prev.simulations } : {};
        const existing = sims[simulationId] || {};
        sims[simulationId] = {
          ...existing,
          display_name: scenarioConfig.display_name ?? existing.display_name,
          description: scenarioConfig.description ?? existing.description,
          has_data: true,
          event_markers: scenarioConfig.event_markers,
        };
        return { simulations: sims };
      });

      const chartsToDisplay = scenarioConfig.charts_to_display || [];
      const csvNameForCharts = `${simulationId}.data.csv`;
      setChartStacks(scenarioConfig.chart_stacks || []);
      setGlobalSampleStep(scenarioConfig.chart_sample_default > 1 ? scenarioConfig.chart_sample_default : 128);
      const panelMax = getChartPanelMaxHeightPx();
      if (
        scenarioConfig.chart_panel_height != null &&
        scenarioConfig.chart_panel_height >= CHART_PANEL_MIN_HEIGHT
      ) {
        setChartPanelHeight(Math.min(scenarioConfig.chart_panel_height, panelMax));
      }
      if (scenarioConfig.chart_panel_opacity != null) {
        setChartPanelOpacity(clampChartPanelOpacity(scenarioConfig.chart_panel_opacity));
      } else {
        setChartPanelOpacity(CHART_PANEL_OPACITY_DEFAULT);
      }
      {
        const wRaw = scenarioConfig.chart_card_width ?? cc?.chart_card_width;
        if (wRaw != null && Number.isFinite(Number(wRaw))) {
          setChartCardWidth(Math.min(4000, Math.max(200, Math.round(Number(wRaw)))));
        } else {
          setChartCardWidth(500);
        }
      }

      const initialPerChart = {};
      if (chartsToDisplay.length > 0) {
        const newCharts = chartsToDisplay
          .map((chartDef, index) => {
            const chartId = `sim-chart-${Date.now()}-${index}`;
            if (chartDef.sample_step != null) initialPerChart[chartId] = chartDef.sample_step;
            if (chartDef.type === 'multi') {
              const multi = {
                id: chartId,
                type: 'multi-component',
                chartType: chartDef.chart_type || 'multi-bar-chart',
                title: chartDef.title || 'Multi-Component Chart',
                csvName: csvNameForCharts,
                timeColumn: chartDef.x_column,
                components: chartDef.components || [],
                isMultiComponent: true,
                ...(chartDef.ensemble_sim_id && !chartDef.ensemble_cross_member && { ensembleSimId: chartDef.ensemble_sim_id }),
                ...(chartDef.ensemble_cross_member && { ensembleCrossMember: true }),
              };
              const pcw = chartCardWidthFromDef(chartDef);
              return pcw != null ? { ...multi, chartCardWidth: pcw } : multi;
            }
            const component = canvasComponentsRef.current.find((c) => c.id === chartDef.component_id);
            if (!component) return null;
            const isNd = chartDef.chart_type === 'nd' && chartDef.y_columns?.length;
            const isPie = chartDef.chart_type === 'pie' && chartDef.y_columns?.length;
            const isStackedNd = chartDef.chart_type === 'stacked-nd' && chartDef.y_columns?.length;
            const single = {
              id: chartId,
              componentId: component.id,
              componentName: component.name,
              chartType: chartDef.chart_type || '2d',
              csvName: csvNameForCharts,
              xColumn: chartDef.x_column,
              ...(isNd || isPie ? { yColumns: chartDef.y_columns } : isStackedNd ? {} : { yColumn: chartDef.y_column }),
              ...(isStackedNd
                ? {
                    yColumns: chartDef.y_columns,
                    splitBy: chartDef.split_by || 'phase',
                    ...(chartDef.split_by === 'manual' &&
                      chartDef.manual_group_breaks?.length && {
                        manualGroupBreaks: chartDef.manual_group_breaks,
                      }),
                  }
                : {}),
              title:
                chartDef.title ||
                (isNd
                  ? `${component.name} - nD`
                  : isPie
                    ? `${component.name} - Pie`
                    : isStackedNd
                      ? `${component.name} - Stacked nD`
                      : `${component.name} - ${chartDef.y_column}`),
              ...(chartDef.ensemble_sim_id && !chartDef.ensemble_cross_member && { ensembleSimId: chartDef.ensemble_sim_id }),
              ...(chartDef.ensemble_cross_member && { ensembleCrossMember: true }),
            };
            const pcw = chartCardWidthFromDef(chartDef);
            return pcw != null ? { ...single, chartCardWidth: pcw } : single;
          })
          .filter(Boolean);
        setOpenCharts(newCharts);
        setPerChartSampleStep(initialPerChart);
      } else {
        setOpenCharts([]);
        setChartStacks([]);
        setPerChartSampleStep({});
      }

      setNamedSimulationConfigs(activated.named_configuration_keys || []);
    });
    console.log('[DCS:perf] applyActivatedNamedPresetInPlace ✓ done', {
      totalMs: Math.round(performance.now() - t0),
    });
    return true;
  }, [simConfig, useLazySimulationData]);

  /**
   * Copies a named snapshot onto disk, then updates the UI from the response when possible
   * (no chart-panel teardown); otherwise falls back to a full scenario load.
   */
  const handleActivateNamedSimulationConfig = async (presetName) => {
    if (!simulationMetadata?.id || !designApiPath) return;
    const t0 = performance.now();
    console.log('[DCS:perf] activateNamedPreset ▶ START', {
      presetName,
      simId: simulationMetadata.id,
      note: 'Progress bar is NOT shown for in-place preset apply — only handleRunSimulation sets simulationLoadProgress',
    });
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/designs/${encodeURIComponent(designApiPath)}/simulations/${encodeURIComponent(simulationMetadata.id)}/named-configurations/${encodeURIComponent(presetName)}/activate`,
        { method: 'POST' },
      );
      console.log('[DCS:perf] activateNamedPreset POST /activate done', {
        ms: Math.round(performance.now() - t0),
        ok: res.ok,
      });
      if (!res.ok) {
        const msg = await res.text();
        alert(msg || `Failed to activate preset (${res.status})`);
        return;
      }
      const activated = await res.json();
      await mergeCachedSimulationAfterActivate(designApiPath, simulationMetadata.id, activated);
      console.log('[DCS:perf] activateNamedPreset after mergeCachedSimulationAfterActivate', {
        ms: Math.round(performance.now() - t0),
      });
      const tApply = performance.now();
      const applied = await applyActivatedNamedPresetInPlace(simulationMetadata.id, activated);
      console.log('[DCS:perf] activateNamedPreset applyActivatedNamedPresetInPlace', {
        applied,
        applyMs: Math.round(performance.now() - tApply),
        totalMs: Math.round(performance.now() - t0),
      });
      if (applied) {
        const snap = simulationRawRowsRef.current;
        if (snap?.length && !useLazySimulationData && SIMULATION_CACHE_FULL_PAYLOAD) {
          try {
            await setCachedSimulationPayload(
              designApiPath,
              simulationMetadata.id,
              {
                data: snap,
                sim_config: activated.sim_config,
                named_configuration_keys: activated.named_configuration_keys || [],
                design_name: activated.design_name,
                sim_name: activated.sim_name,
                row_count: snap.length,
              },
              presetName,
            );
          } catch (_) {
            /* ignore IDB */
          }
        }
        console.log('[DCS:perf] activateNamedPreset ✓ in-place path (no full handleRunSimulation)', {
          totalMs: Math.round(performance.now() - t0),
        });
      } else {
        console.log('[DCS:perf] activateNamedPreset → fallback handleRunSimulation (no raw rows for in-place)', {
          ms: Math.round(performance.now() - t0),
        });
        await handleRunSimulation(simulationMetadata.id, { cachePresetName: presetName });
        console.log('[DCS:perf] activateNamedPreset ✓ after fallback handleRunSimulation', {
          totalMs: Math.round(performance.now() - t0),
        });
      }
      setActiveNamedSimulationConfig(presetName);
      setLastNamedPresetForUi(presetName);
      try {
        if (designApiPath) {
          localStorage.setItem(
            lastScenarioSessionStorageKey(designApiPath),
            JSON.stringify({ simId: simulationMetadata.id, namedConfig: presetName }),
          );
        }
      } catch (_) {
        /* ignore */
      }
    } catch (e) {
      console.warn(e);
      alert('Failed to activate preset');
    }
  };

  /**
   * Flush the live draft to current_configuration on disk, then duplicate that subtree under a user-chosen top-level key.
   */
  const handleConfirmSaveSimulationConfig = async ({ name, overwrite }) => {
    if (!simulationMetadata?.id || !designApiPath) return;
    try {
      if (persistChartCardWidthRef.current) {
        clearTimeout(persistChartCardWidthRef.current);
        persistChartCardWidthRef.current = null;
      }
      if (persistPerChartCardWidthRef.current) {
        clearTimeout(persistPerChartCardWidthRef.current);
        persistPerChartCardWidthRef.current = null;
      }
      await persistChartsToSimJson(openCharts, { chart_card_width: chartCardWidth });
      const res = await fetch(
        `${API_BASE_URL}/api/designs/${encodeURIComponent(designApiPath)}/simulations/${encodeURIComponent(simulationMetadata.id)}/named-configurations`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, overwrite }),
        },
      );
      if (!res.ok) {
        const msg = await res.text();
        alert(msg || `Save failed (${res.status})`);
        return;
      }
      const data = await res.json();
      setNamedSimulationConfigs(data.named_configuration_keys || []);
      setActiveNamedSimulationConfig(name);
      setLastNamedPresetForUi(name);
      setSaveSimConfigDialogOpen(false);
    } catch (e) {
      console.warn(e);
      alert('Failed to save named configuration');
    }
  };

  /**
   * Refresh simulations list from backend (after add or upload)
   */
  const refreshSimulationsList = useCallback(async () => {
    if (!currentConfigName || !designApiPath) return;
    try {
      const listRes = await fetch(`${API_BASE_URL}/api/designs/${encodeURIComponent(designApiPath)}/simulations`);
      if (listRes.ok) {
        const list = await listRes.json();
        const sims = list.simulations || [];
        setAvailableSimulations(sims.map(s => s.id));
        const simMap = {};
        sims.forEach(s => {
          simMap[s.id] = {
            display_name: s.display_name,
            description: s.description || '',
            has_data: !!s.has_data,
            ...(s.data_row_count != null && s.data_column_count != null
              ? { data_row_count: s.data_row_count, data_column_count: s.data_column_count }
              : {}),
          };
        });
        setSimConfig(sims.length > 0 ? { simulations: simMap } : null);
      }
    } catch (e) {
      console.error('Failed to refresh simulations:', e);
    }
  }, [currentConfigName, designApiPath]);

  /**
   * Add a new simulation scenario (creates .sim.json, then user can upload CSV)
   */
  const handleAddSimulation = async (simName) => {
    if (!currentConfigName || !designApiPath || !simName?.trim()) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/designs/${encodeURIComponent(designApiPath)}/simulations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: simName.trim() })
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || response.statusText || `HTTP ${response.status}`);
      }
      const result = await response.json();
      await refreshSimulationsList();
      // Activate the new scenario so it's highlighted; upload button next to it targets this sim
      const newSimId = result.sim_name;
      const displayName = (result.sim_name || '').replace(/_/g, ' ').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      setSimulationMetadata({
        id: newSimId,
        displayName: displayName || newSimId,
        description: '',
        rowCount: 0,
        columns: [],
        timeRange: { min: 0, max: 0 }
      });
      setSimulationData([]);
      setOpenCharts([]);
    } catch (e) {
      alert(`❌ Failed to add simulation: ${e.message}`);
    }
  };

  /**
   * Upload CSV data for a simulation (design dir flow only)
   */
  const handleUploadSimData = async (simId, file) => {
    if (!currentConfigName || !designApiPath || !file) return;
    setIsUploading(true);
    const uploadStartTime = Date.now();
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(
        `${API_BASE_URL}/api/designs/${encodeURIComponent(designApiPath)}/simulations/${encodeURIComponent(simId)}/data`,
        { method: 'POST', body: formData }
      );
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || response.statusText || `HTTP ${response.status}`);
      }
      await response.json().catch(() => ({}));
      await refreshSimulationsList();
      await deleteCachedSimulationPayload(designApiPath, simId);
      // Minimum 2 seconds spinner display
      const elapsed = Date.now() - uploadStartTime;
      const remainingTime = Math.max(0, 2000 - elapsed);
      await new Promise((resolve) => setTimeout(resolve, remainingTime));
      // Virtually "run" the simulation so user can create charts without clicking the button
      await handleRunSimulation(simId);
    } catch (e) {
      alert(`❌ Upload failed: ${e.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * Add simulation scenarios from an xlsx file. Each sheet becomes a simulation:
   * - Sheet name → button name and {SheetName}.data.csv
   * - Sheet data → CSV content saved to design dir (handled by backend)
   */
  const handleAddSimulationsFromXlsx = async (file, sampleStep = 1) => {
    if (!currentConfigName || !designApiPath || !file) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (sampleStep > 1) formData.append('sample_step', String(sampleStep));
      const response = await fetch(
        `${API_BASE_URL}/api/designs/${encodeURIComponent(designApiPath)}/simulations/from-xlsx`,
        { method: 'POST', body: formData }
      );
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || response.statusText || `HTTP ${response.status}`);
      }
      const result = await response.json();
      await refreshSimulationsList();
      const count = result.created?.length ?? 0;
      alert(`✅ Created ${count} simulation scenario(s) from xlsx.`);
    } catch (e) {
      alert(`❌ Failed to load xlsx: ${e.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * Add simulation scenarios from a pandas pickle (.pkl). MultiIndex level-1 groups become
   * separate scenarios (same idea as xlsx sheets); backend writes .data.csv + .sim.json.
   */
  const handleAddSimulationsFromPkl = async (file, prefix = '', sampleStep = 1) => {
    if (!currentConfigName || !designApiPath || !file) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (prefix) formData.append('prefix', prefix);
      if (sampleStep > 1) formData.append('sample_step', String(sampleStep));
      const response = await fetch(
        `${API_BASE_URL}/api/designs/${encodeURIComponent(designApiPath)}/simulations/from-pkl`,
        { method: 'POST', body: formData }
      );
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || response.statusText || `HTTP ${response.status}`);
      }
      const result = await response.json();
      await refreshSimulationsList();
      const count = result.created?.length ?? 0;
      alert(`✅ Created ${count} simulation scenario(s) from pkl.`);
    } catch (e) {
      alert(`❌ Failed to load pkl: ${e.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * Import a single simulation from a PKL2 file (dict-of-Series format).
   * Prompts for a simulation name, then posts to the from-pkl2 endpoint.
   */
  const handleAddSimulationFromPkl2 = async (file, simName = '', sampleStep = 1) => {
    if (!currentConfigName || !designApiPath || !file) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (simName) formData.append('sim_name', simName);
      if (sampleStep > 1) formData.append('sample_step', String(sampleStep));
      const response = await fetch(
        `${API_BASE_URL}/api/designs/${encodeURIComponent(designApiPath)}/simulations/from-pkl2`,
        { method: 'POST', body: formData }
      );
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || response.statusText || `HTTP ${response.status}`);
      }
      const result = await response.json();
      await refreshSimulationsList();
      const created = result.created?.[0];
      alert(`✅ Created simulation "${created?.name}" (${created?.rows} rows, ${created?.columns?.length} columns) from pkl2.`);
    } catch (e) {
      alert(`❌ Failed to load pkl2: ${e.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * Delete a simulation (removes .sim.json and .data.csv)
   */
  const handleDeleteSimulation = async (simId) => {
    if (!currentConfigName || !designApiPath || !simId) return;
    if (!window.confirm(`Delete simulation "${simId}" and its data? This cannot be undone.`)) return;
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/designs/${encodeURIComponent(designApiPath)}/simulations/${encodeURIComponent(simId)}`,
        { method: 'DELETE' }
      );
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || response.statusText || `HTTP ${response.status}`);
      }
      await refreshSimulationsList();
      if (csvStatus?.use_design_dir) await refreshDesignEnsembles();
      await deleteCachedSimulationPayload(designApiPath, simId);
      if (simulationMetadata?.id === simId) {
        simulationRawRowsRef.current = null;
        simulationRawRowsSimIdRef.current = null;
        setLastNamedPresetForUi(null);
        setSimulationMetadata(null);
        setSimulationData([]);
        setOpenCharts([]);
      }
    } catch (e) {
      alert(`❌ Delete failed: ${e.message}`);
    }
  };

  /**
   * Remove every scenario in the current design in one pass (each DELETE like single-scenario).
   */
  const handleDeleteAllSimulations = async () => {
    if (!currentConfigName || !designApiPath) return;
    const ids = [...availableSimulations];
    if (ids.length === 0) return;
    if (
      !window.confirm(
        `Delete all ${ids.length} simulation scenario(s) and their data? This cannot be undone.`,
      )
    )
      return;
    try {
      for (const simId of ids) {
        const response = await fetch(
          `${API_BASE_URL}/api/designs/${encodeURIComponent(designApiPath)}/simulations/${encodeURIComponent(simId)}`,
          { method: 'DELETE' },
        );
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(
            errData.detail || response.statusText || `HTTP ${response.status} (${simId})`,
          );
        }
      }
      for (const simId of ids) {
        await deleteCachedSimulationPayload(designApiPath, simId);
      }
      await refreshSimulationsList();
      if (csvStatus?.use_design_dir) await refreshDesignEnsembles();
      const meta = simulationMetadata;
      if (
        meta &&
        (meta.isEnsemble || (meta.id && ids.includes(meta.id)))
      ) {
        simulationRawRowsRef.current = null;
        simulationRawRowsSimIdRef.current = null;
        setLastNamedPresetForUi(null);
        setSimulationMetadata(null);
        setSimulationData([]);
        setOpenCharts([]);
      }
    } catch (e) {
      alert(`❌ Delete all failed: ${e.message}`);
      await refreshSimulationsList();
      if (csvStatus?.use_design_dir) await refreshDesignEnsembles();
    }
  };

  /**
   * Clear IndexedDB cache for one scenario’s load-simulation payload (this browser only).
   * The next open of that scenario downloads from the server again.
   */
  const handleClearSimulationCache = async (simId) => {
    if (!designApiPath || !simId) return;
    try {
      await deleteCachedSimulationPayload(designApiPath, simId);
      alert(
        `Cache cleared for “${simId}”. The next time you open this scenario, data will be loaded from the server again.`,
      );
    } catch (e) {
      console.warn(e);
      alert('Could not clear simulation cache.');
    }
  };

  /**
   * View simulation data (first 200 rows in popup)
   */
  const handleViewSimData = async (simId) => {
    if (!currentConfigName || !designApiPath || !simId) return;
    const displayName = simConfig?.simulations?.[simId]?.display_name || simId;
    setViewModal({ simName: simId, displayName, data: null, loading: true });
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/designs/${encodeURIComponent(designApiPath)}/simulations/${encodeURIComponent(simId)}`
      );
      if (!response.ok) throw new Error('Failed to load simulation data');
      const result = await response.json();
      setViewModal({ simName: simId, displayName, data: result.data || [], loading: false });
    } catch (e) {
      setViewModal(null);
      alert(`❌ Failed to load data: ${e.message}`);
    }
  };

  /**
   * Toggle view mode (designer vs customer)
   */
  const handleToggleViewMode = () => {
    const newViewMode = viewMode === 'designer' ? 'customer' : 'designer';
    setViewMode(newViewMode);

    // When switching to designer view, stop simulation
    if (newViewMode === 'designer') {
      setSimulationRunning(false);
    }

    // Persist view_mode into .sim.current_configuration alongside charts so reload restores the same mode for this CSV tab.
    if (simulationMetadata?.id && currentConfigName && designApiPath) {
      persistChartsToSimJson(openCharts, { view_mode: newViewMode });
    }
  };

  // ============================================================================
  // SAVE/LOAD CONFIGURATION HANDLERS
  // ============================================================================
  
  /**
   * Open Save Dialog (Save As - always ask for name)
   */
  const handleOpenSaveDialog = () => {
    setDialogMode('save');
    setShowDialog(true);
  };

  /**
   * Quick Save (if config name exists, save without dialog)
   */
  const handleQuickSave = async () => {
    if (!currentConfigName) {
      // No config name, open Save As dialog
      handleOpenSaveDialog();
      return;
    }

    // Quick save to existing config
    setIsSaving(true);
    const saveStartTime = Date.now();

    try {
      const configData = {
        name: currentConfigName,
        description: null, // Keep existing description
        data: getCurrentConfiguration()
      };

      console.log('💾 Quick saving configuration:', currentConfigName);

      const response = await fetch(`${API_BASE_URL}/api/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(configData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      const savedConfig = await response.json();

      // Ensure minimum 3-second spinner display
      const elapsed = Date.now() - saveStartTime;
      const remainingTime = Math.max(0, 3000 - elapsed);

      await new Promise(resolve => setTimeout(resolve, remainingTime));

      console.log(`✅ Configuration saved: ${savedConfig.name}`);
      alert(`✅ Configuration "${savedConfig.name}" saved successfully!`);

      // Persist current simulation's charts + sample rates to .sim.json
      if (simulationMetadata?.id && openCharts.length >= 0) {
        persistChartsToSimJson(openCharts);
      }
    } catch (error) {
      console.error('❌ Error saving configuration:', error);
      alert(`❌ Failed to save: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Open Load Dialog
   */
  const handleOpenLoadDialog = () => {
    setDialogMode('load');
    setShowDialog(true);
  };

  /**
   * Close Dialog
   */
  const handleCloseDialog = () => {
    setShowDialog(false);
    setDialogMode(null);
  };

  /**
   * STEP 3: Persist chart tray — *.sim.json for a green scenario, or {leaf}.ensemble.json chart_panel for purple.
   */
  const persistChartsToSimJson = useCallback(async (charts, overrides = {}) => {
    if (!simulationMetadata?.id || !currentConfigName || !designApiPath) return;
    const effectiveGlobal = overrides.chart_sample_default ?? globalSampleStep;
    const effectivePerChart = overrides.perChartSampleStep ?? perChartSampleStep;
    const effectiveHeight = overrides.chart_panel_height ?? chartPanelHeight;
    const effectiveOpacity = overrides.chart_panel_opacity ?? chartPanelOpacity;
    const effectiveCardWidth = overrides.chart_card_width ?? chartCardWidth;
    const effectiveStacks = overrides.chart_stacks ?? chartStacks;
    const effectiveDerived = overrides.derived_variables ?? simulationMetadata?.derivedVariables;
    const effectiveViewMode = overrides.view_mode ?? viewMode;
    const isEnsembleTab = Boolean(
      simulationMetadata?.isEnsemble && simulationMetadata?.ensembleId,
    );
    try {
      const charts_to_display = charts.map((c) => {
        let base;
        if (c.isMultiComponent) {
          base = {
            type: 'multi',
            chart_type: c.chartType,
            x_column: c.timeColumn,
            components: c.components || [],
            title: c.title || '',
            ...(c.ensembleSimId && !c.ensembleCrossMember && { ensemble_sim_id: c.ensembleSimId }),
            ...(c.ensembleCrossMember && { ensemble_cross_member: true }),
          };
        } else if ((c.chartType === 'nd' || c.chartType === 'pie') && c.yColumns?.length) {
          base = {
            type: 'single',
            component_id: c.componentId,
            chart_type: c.chartType,
            x_column: c.xColumn,
            y_columns: c.yColumns,
            title:
              c.title ||
              (c.chartType === 'pie' ? `${c.componentName || ''} - Pie` : `${c.componentName || ''} - nD`),
            ...(c.ensembleSimId && !c.ensembleCrossMember && { ensemble_sim_id: c.ensembleSimId }),
            ...(c.ensembleCrossMember && { ensemble_cross_member: true }),
          };
        } else if (c.chartType === 'stacked-nd' && c.yColumns?.length) {
          base = {
            type: 'single',
            component_id: c.componentId,
            chart_type: 'stacked-nd',
            x_column: c.xColumn,
            y_columns: c.yColumns,
            split_by: c.splitBy || 'phase',
            ...(c.splitBy === 'manual' && c.manualGroupBreaks?.length && { manual_group_breaks: c.manualGroupBreaks }),
            title: c.title || `${c.componentName || ''} - Stacked nD`,
            ...(c.ensembleSimId && !c.ensembleCrossMember && { ensemble_sim_id: c.ensembleSimId }),
            ...(c.ensembleCrossMember && { ensemble_cross_member: true }),
          };
        } else {
          base = {
            type: 'single',
            component_id: c.componentId,
            chart_type: c.chartType || '2d',
            x_column: c.xColumn,
            y_column: c.yColumn,
            title: c.title || `${c.componentName || ''} - ${c.yColumn || 'chart'}`,
            ...(c.ensembleSimId && !c.ensembleCrossMember && { ensemble_sim_id: c.ensembleSimId }),
            ...(c.ensembleCrossMember && { ensemble_cross_member: true }),
          };
        }
        if (effectivePerChart[c.id] != null) base.sample_step = effectivePerChart[c.id];
        if (c.chartCardWidth != null && Number.isFinite(Number(c.chartCardWidth))) {
          base.chart_card_width = Math.min(4000, Math.max(200, Math.round(Number(c.chartCardWidth))));
        }
        if (c.xLabel != null) base.x_label = c.xLabel;
        if (c.yLabel != null) base.y_label = c.yLabel;
        if (c.legendLabels != null && typeof c.legendLabels === 'object' && Object.keys(c.legendLabels).length) {
          base.legend_labels = c.legendLabels;
        }
        if (c.axisRange != null) {
          const { xMin, xMax, yMin, yMax, xLocked, yLocked } = c.axisRange;
          const rangeObj = {};
          if (xLocked) {
            if (xMin != null && !Number.isNaN(xMin)) rangeObj.x_min = xMin;
            if (xMax != null && !Number.isNaN(xMax)) rangeObj.x_max = xMax;
            rangeObj.x_locked = true;
          }
          if (yLocked) {
            if (yMin != null && !Number.isNaN(yMin)) rangeObj.y_min = yMin;
            if (yMax != null && !Number.isNaN(yMax)) rangeObj.y_max = yMax;
            rangeObj.y_locked = true;
          }
          if (Object.keys(rangeObj).length) base.axis_range = rangeObj;
        }
        return base;
      });
      const body = {
        charts_to_display,
        chart_stacks: effectiveStacks,
        chart_sample_default: effectiveGlobal,
        chart_panel_height: effectiveHeight,
        chart_panel_opacity: effectiveOpacity,
        chart_card_width: effectiveCardWidth,
        view_mode: effectiveViewMode,
        ...(effectiveDerived != null && { derived_variables: effectiveDerived }),
      };
      const url = isEnsembleTab
        ? `${API_BASE_URL}/api/designs/${encodeURIComponent(designApiPath)}/ensembles/${encodeURIComponent(simulationMetadata.ensembleId)}/chart-panel`
        : `${API_BASE_URL}/api/designs/${encodeURIComponent(designApiPath)}/simulations/${encodeURIComponent(simulationMetadata.id)}/config`;
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        console.warn('Failed to persist charts:', await res.text());
      } else {
        setActiveNamedSimulationConfig(null);
        if (isEnsembleTab) {
          const eid = simulationMetadata.ensembleId;
          setDesignEnsembles((prev) =>
            prev.map((ent) =>
              ent.id === eid
                ? {
                    ...ent,
                    chart_panel: {
                      charts_to_display,
                      chart_stacks: effectiveStacks,
                      chart_sample_default: effectiveGlobal,
                      chart_panel_height: effectiveHeight,
                      chart_panel_opacity: effectiveOpacity,
                      chart_card_width: effectiveCardWidth,
                      view_mode: effectiveViewMode,
                      ...(effectiveDerived != null && { derived_variables: effectiveDerived }),
                    },
                  }
                : ent,
            ),
          );
          /* materialize is triggered explicitly by handleAddDerivedVariable */
        }
      }
    } catch (e) {
      console.warn('persistChartsToSimJson error:', e);
    }
  }, [
    simulationMetadata?.id,
    simulationMetadata?.isEnsemble,
    simulationMetadata?.ensembleId,
    simulationMetadata?.derivedVariables,
    designApiPath,
    globalSampleStep,
    perChartSampleStep,
    chartPanelHeight,
    chartPanelOpacity,
    chartCardWidth,
    chartStacks,
    viewMode,
    refreshSimulationsList,
  ]);

  const handleChartCardWidthChange = useCallback(
    (nextWidth) => {
      const w = Number(nextWidth);
      if (!Number.isFinite(w)) return;
      const clamped = Math.min(4000, Math.max(200, Math.round(w)));
      setChartCardWidth(clamped);
      if (persistChartCardWidthRef.current) clearTimeout(persistChartCardWidthRef.current);
      persistChartCardWidthRef.current = setTimeout(() => {
        if (simulationMetadata?.id) {
          persistChartsToSimJson(openCharts, { chart_card_width: clamped });
        }
        persistChartCardWidthRef.current = null;
      }, 400);
    },
    [simulationMetadata?.id, openCharts, persistChartsToSimJson],
  );

  /**
   * chartId = which graph box. nextWidth = narrower/wider number, or null = “forget special width, use top toolbar default.”
   */
  const handlePerChartCardWidthChange = useCallback(
    (chartId, nextWidth) => {
      setOpenCharts((prev) => {
        const next = prev.map((c) => {
          if (c.id !== chartId) return c;
          if (nextWidth == null) {
            const { chartCardWidth: _omit, ...rest } = c;
            return rest;
          }
          const clamped = Math.min(4000, Math.max(200, Math.round(Number(nextWidth))));
          return { ...c, chartCardWidth: clamped };
        });
        if (persistPerChartCardWidthRef.current) clearTimeout(persistPerChartCardWidthRef.current);
        persistPerChartCardWidthRef.current = setTimeout(() => {
          if (simulationMetadata?.id) persistChartsToSimJson(next);
          persistPerChartCardWidthRef.current = null;
        }, 400);
        return next;
      });
    },
    [simulationMetadata?.id, persistChartsToSimJson],
  );

  const persistChartPanelHeightRef = useRef(null);
  const handleChartPanelHeightChange = useCallback((newHeight) => {
    setChartPanelHeight(newHeight);
    if (persistChartPanelHeightRef.current) clearTimeout(persistChartPanelHeightRef.current);
    persistChartPanelHeightRef.current = setTimeout(() => {
      if (simulationMetadata?.id && openCharts.length >= 0) {
        persistChartsToSimJson(openCharts, { chart_panel_height: newHeight });
      }
      persistChartPanelHeightRef.current = null;
    }, 400);
  }, [simulationMetadata?.id, openCharts, persistChartsToSimJson]);

  const persistChartPanelOpacityRef = useRef(null);
  const handleChartPanelOpacityChange = useCallback((nextOpacity) => {
    const clamped = clampChartPanelOpacity(nextOpacity);
    setChartPanelOpacity(clamped);
    if (persistChartPanelOpacityRef.current) clearTimeout(persistChartPanelOpacityRef.current);
    persistChartPanelOpacityRef.current = setTimeout(() => {
      if (simulationMetadata?.id && openCharts.length > 0) {
        persistChartsToSimJson(openCharts, { chart_panel_opacity: clamped });
      }
      persistChartPanelOpacityRef.current = null;
    }, 400);
  }, [simulationMetadata?.id, openCharts, persistChartsToSimJson]);

  /**
   * Lazy mode: merge additional CSV columns into in-memory rows (and derived recompute).
   * Full mode: no-op — rows already contain every column.
   */
  const ensureSimulationColumnsLoaded = useCallback(
    async (columnNames) => {
      if (!useLazySimulationData) return;
      /* Ensemble uses `ensureEnsembleMemberColumnsLoaded` per real scenario id, not the synthetic __ensemble id. */
      if (simulationMetadataRef.current?.isEnsemble) return;
      if (!designApiPath || !simulationMetadataRef.current?.id || !columnNames?.length) {
        return;
      }
      const simId = simulationMetadataRef.current.id;
      const existingKeys = simulationDataRef.current?.length
        ? new Set(Object.keys(simulationDataRef.current[0]))
        : new Set();
      const missing = [...new Set(columnNames.filter(Boolean))].filter((c) => !existingKeys.has(c));
      if (!missing.length) return;
      const nRows = simulationDataRef.current?.length ?? 0;
      if (!nRows) return;
      try {
        const dataPayload = await fetchSimulationDataSubset(designApiPath, simId, missing, {
          offset: 0,
          limit: nRows,
        });
        const incoming = dataPayload.data || [];
        const { augmentRowsWithDerived } = await import('./utils/formulaEvaluator');
        const derived = simulationMetadataRef.current?.derivedVariables || [];
        const merged = mergeSimulationDataByRowIndex(simulationDataRef.current, incoming);
        const augmented = augmentRowsWithDerived(merged, derived);
        simulationRawRowsRef.current = augmented;
        setSimulationData(augmented);
        lazyColumnNeedRef.current = [...new Set([...(lazyColumnNeedRef.current || []), ...missing])];
        setSimulationMetadata((m) => {
          if (!m) return m;
          const augKeys = Object.keys(augmented[0] || {});
          const base = Array.isArray(m.columns) && m.columns.length ? [...m.columns] : [...augKeys];
          const set = new Set(base);
          for (const k of augKeys) {
            if (!set.has(k)) {
              base.push(k);
              set.add(k);
            }
          }
          return { ...m, columns: base };
        });
      } catch (e) {
        console.warn('[DCS:lazy] ensureSimulationColumnsLoaded failed', e);
        alert(`Could not load columns: ${missing.join(', ')}\n\n${e.message || e}`);
        throw e;
      }
    },
    [designApiPath],
  );

  const requestMoreSimulationRows = useCallback(async () => {
    if (!useLazySimulationData) return;
    if (simulationMetadataRef.current?.isEnsemble) return;
    if (lazyPageLoadLockRef.current) return;
    const simId = simulationMetadataRef.current?.id;
    const need = lazyColumnNeedRef.current;
    if (!designApiPath || !simId || !need?.length) return;
    const total = simulationMetadataRef.current?.rowCount ?? 0;
    const cur = simulationDataRef.current?.length ?? 0;
    if (!total || cur >= total) return;
    lazyPageLoadLockRef.current = true;
    try {
      const dataPayload = await fetchSimulationDataSubset(designApiPath, simId, need, {
        offset: cur,
        limit: SIMULATION_LAZY_PAGE_SIZE,
      });
      const incoming = dataPayload.data || [];
      if (!incoming.length) return;
      const derived = simulationMetadataRef.current?.derivedVariables || [];
      const { augmentRowsWithDerived } = await import('./utils/formulaEvaluator');
      const aug = augmentRowsWithDerived(incoming, derived);
      const next = [...(simulationDataRef.current || []), ...aug];
      simulationRawRowsRef.current = next;
      setSimulationData(next);
      setSimulationMetadata((m) =>
        m && m.id === simId
          ? { ...m, loadedRowCount: next.length }
          : m,
      );
    } catch (e) {
      console.warn('[DCS:lazy] requestMoreSimulationRows', e);
    } finally {
      lazyPageLoadLockRef.current = false;
    }
  }, [designApiPath, useLazySimulationData]);

  /** Paged lazy load: fetch the next chunk when play passes loaded data or charts need the full time span. */
  useEffect(() => {
    if (!useLazySimulationData) return;
    if (simulationMetadata?.isEnsemble) return;
    if (!simulationMetadata?.id) return;
    if (lazyColumnNeedRef.current == null) return;
    const total = simulationMetadata.rowCount;
    const loaded = simulationData?.length ?? 0;
    if (!total || loaded >= total) return;
    const rows = simulationData;
    if (!rows?.length) return;
    const tc = pickTimeColumn(Object.keys(rows[0]));
    if (!tc) return;
    const lastT = parseFloat(rows[rows.length - 1][tc]);
    if (!Number.isFinite(lastT)) return;
    const trMax = simulationMetadata.timeRange?.max;
    const needByPlay =
      simulationRunning && Number.isFinite(simulationTime) && simulationTime > lastT;
    const needByAxis = Number.isFinite(trMax) && trMax > lastT + 1e-6;
    if (!needByPlay && !needByAxis) return;
    const id = setTimeout(() => {
      void requestMoreSimulationRows();
    }, 350);
    return () => clearTimeout(id);
  }, [
    useLazySimulationData,
    simulationMetadata?.id,
    simulationMetadata?.isEnsemble,
    simulationMetadata?.rowCount,
    simulationMetadata?.timeRange?.max,
    simulationData?.length,
    simulationRunning,
    simulationTime,
    requestMoreSimulationRows,
  ]);

  /**
   * Lazy-load a subset of one ensemble member’s CSV, merge into that member’s row table, and recompute deriveds.
   * Serialized per `memberSimId` so parallel chart loads cannot clobber merges.
   */
  const ensureEnsembleMemberColumnsLoaded = useCallback(async (memberSimId, columnNames) => {
    if (!designApiPath || !memberSimId || !columnNames?.length) {
      return;
    }
    if (!simulationMetadataRef.current?.isEnsemble) {
      return;
    }

    const run = async () => {
      const g = ensembleColumnGroupsRef.current.find((x) => x.simId === memberSimId);
      const csvCols = g?.columns || [];
      if (!g) {
        console.warn('[DCS:ensemble-plot] ensureEnsembleMemberColumnsLoaded: no group for', memberSimId, {
          knownIds: (ensembleColumnGroupsRef.current || []).map((x) => x.simId),
        });
      }
      const derived = ensembleMemberDerivedBySimIdRef.current[memberSimId] || [];
      const needCsv = new Set(columnsNeededForDerived(derived, csvCols));
      for (const r of columnNames.filter(Boolean)) {
        if (csvCols.includes(r)) needCsv.add(r);
      }
      const need = [...needCsv];
      if (!need.length) {
        return;
      }

      const existingRows = ensembleMemberSimulationDataRef.current?.[memberSimId];
      const existingKeys = existingRows?.length ? new Set(Object.keys(existingRows[0])) : new Set();
      const missing = need.filter((c) => !existingKeys.has(c));
      if (!missing.length) {
        return;
      }
      let dataPayload;
      try {
        dataPayload = await fetchSimulationDataSubset(designApiPath, memberSimId, missing);
      } catch (e) {
        console.error('[DCS:ensemble-plot] fetchSimulationDataSubset failed', { memberSimId, missing, err: e });
        throw e;
      }
      const incoming = dataPayload.data || [];
      const { augmentRowsWithDerived, augmentEnsemblePrimaryWithCrossMemberDerived } = await import(
        './utils/formulaEvaluator',
      );
      const merged = mergeSimulationDataByRowIndex(existingRows || [], incoming);
      const augmented = augmentRowsWithDerived(merged, derived);

      const members = simulationMetadataRef.current?.memberSimulations || [];
      const primary = members[0];

      let nextMap = { ...(ensembleMemberSimulationDataRef.current || {}), [memberSimId]: augmented };
      const ensCross = simulationMetadataRef.current?.derivedVariables || [];
      if (ensCross.length && primary) {
        nextMap = augmentEnsemblePrimaryWithCrossMemberDerived(members, nextMap, ensCross, primary);
      }
      ensembleMemberSimulationDataRef.current = nextMap;
      setEnsembleMemberSimulationData(nextMap);

      if (memberSimId === primary) {
        simulationRawRowsRef.current = augmented;
        simulationRawRowsSimIdRef.current = primary;
        setSimulationData(augmented);
      }

      setSimulationMetadata((m) => {
        if (!m?.isEnsemble) return m;
        const loaded = ensembleMemberSimulationDataRef.current || {};
        let gMin = Infinity;
        let gMax = -Infinity;
        for (const sid of Object.keys(loaded)) {
          const rows = loaded[sid];
          if (!rows?.length) continue;
          const gg = ensembleColumnGroupsRef.current.find((x) => x.simId === sid);
          const tcol = pickTimeColumn(gg?.columns?.length ? gg.columns : Object.keys(rows[0]));
          if (!tcol) continue;
          for (const row of rows) {
            const v = parseFloat(row[tcol]);
            if (!Number.isNaN(v)) {
              gMin = Math.min(gMin, v);
              gMax = Math.max(gMax, v);
            }
          }
        }
        const tR =
          Number.isFinite(gMin) && Number.isFinite(gMax) ? { min: gMin, max: gMax } : m.timeRange;
        return { ...m, timeRange: tR };
      });
    };

    const prev = ensembleLoadChainsRef.current[memberSimId] || Promise.resolve();
    const next = prev.then(run, run);
    ensembleLoadChainsRef.current[memberSimId] = next.catch((err) => {
      console.error('[DCS:ensemble-plot] ensureEnsembleMemberColumnsLoaded chain rejected', memberSimId, err);
    });
    return next;
  }, [designApiPath]);

  const ensureEnsemblePlaybackPrimed = useCallback(async () => {
    const members = simulationMetadataRef.current?.memberSimulations || [];
    await Promise.all(
      members.map((sid) => {
        const g = ensembleColumnGroupsRef.current.find((x) => x.simId === sid);
        const cols = g?.columns || [];
        const tc = pickTimeColumn(cols);
        if (!tc) return Promise.resolve();
        return ensureEnsembleMemberColumnsLoaded(sid, [tc]);
      }),
    );
  }, [ensureEnsembleMemberColumnsLoaded]);

  /*
   * Prefetch CSV columns for canvas connection readouts (sparkles) only while simulation is running.
   * Selecting an ensemble stays metadata-only; bulk row fetch starts after Play so tab switches stay fast.
   */
  useEffect(() => {
    if (!simulationMetadata?.isEnsemble || !designApiPath || !simulationRunning) return;
    const memberSims = simulationMetadata.memberSimulations || [];
    if (!memberSims.length) return;
    const memberSet = new Set(memberSims);
    const bySid = new Map();
    for (const comp of canvasComponentsRef.current || []) {
      const slots = comp?.connectionReadout?.slots;
      if (!Array.isArray(slots)) continue;
      for (const slot of slots) {
        const sid = slot?.ensembleSimId;
        const col = slot?.column && String(slot.column).trim();
        if (!sid || !col || !memberSet.has(sid)) continue;
        if (!bySid.has(sid)) bySid.set(sid, new Set());
        bySid.get(sid).add(col);
      }
    }
    if (bySid.size === 0) return;

    let cancelled = false;
    (async () => {
      for (const sid of bySid.keys()) {
        if (cancelled) return;
        const g = ensembleColumnGroupsRef.current.find((x) => x.simId === sid);
        const csvCols = g?.columns || [];
        const tc = pickTimeColumn(csvCols);
        const need = new Set(bySid.get(sid));
        if (tc) need.add(tc);
        const cols = [...need];
        if (!cols.length) continue;
        try {
          await ensureEnsembleMemberColumnsLoaded(sid, cols);
        } catch {
          /* ensureEnsembleMemberColumnsLoaded may have alerted */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    simulationMetadata?.isEnsemble,
    simulationMetadata?.ensembleId,
    simulationMetadata?.memberSimulations,
    designApiPath,
    simulationRunning,
    ensureEnsembleMemberColumnsLoaded,
  ]);

  useLayoutEffect(() => {
    ensureEnsemblePlaybackPrimedRef.current = ensureEnsemblePlaybackPrimed;
  }, [ensureEnsemblePlaybackPrimed]);

  const collectEnsembleChartRawColumns = useCallback((chart) => {
    const s = new Set(
      [chart.xColumn, chart.yColumn, chart.timeColumn, ...(chart.yColumns || [])].filter(Boolean),
    );
    if (chart.isMultiComponent && chart.components?.length) {
      for (const c of chart.components) {
        if (c.columnName) s.add(c.columnName);
      }
    }
    return [...s];
  }, []);

  /** memberSimId -> raw column names to fetch (excludes ensemble derived names in base CSV). */
  const collectEnsembleChartLoadPlan = useCallback(
    (chart) => {
      const ensSet = new Set(
        (simulationMetadataRef.current?.derivedVariables || []).map((d) => d.name),
      );
      if (chart.ensembleCrossMember) {
        const parts = [chart.xColumn, chart.yColumn, chart.timeColumn, ...(chart.yColumns || [])].filter(
          (x) => x != null && x !== '',
        );
        if (chart.isMultiComponent && chart.components?.length) {
          for (const c of chart.components) {
            if (c.columnName) parts.push(c.columnName);
          }
        }
        const parsed = parseEnsembleColumnSelections(parts);
        if (!parsed) return {};
        const byM = groupColumnsByEnsembleMember(parsed.items);
        const out = {};
        for (const [sid, cols] of Object.entries(byM)) {
          out[sid] = cols.filter(
            (c) => c && (sid === 'formula' || !ensSet.has(c)),
          );
        }
        return out;
      }
      if (chart.ensembleSimId) {
        const raw = collectEnsembleChartRawColumns(chart);
        const out = {
          [chart.ensembleSimId]: raw.filter(
            (c) => c && (chart.ensembleSimId === 'formula' || !ensSet.has(c)),
          ),
        };
        return out;
      }
      return {};
    },
    [collectEnsembleChartRawColumns],
  );

  const onEnsureEnsembleChartColumns = useCallback(
    async (chart) => {
      if (!simulationMetadataRef.current?.isEnsemble) return;
      const plan = collectEnsembleChartLoadPlan(chart);
      for (const memberSimId of Object.keys(plan)) {
        const toLoad = plan[memberSimId];
        if (!memberSimId || !toLoad?.length) continue;
        try {
          await ensureEnsembleMemberColumnsLoaded(memberSimId, toLoad);
        } catch (e) {
          console.error('[DCS:ensemble-plot] onEnsureEnsembleChartColumns error', memberSimId, e);
        }
      }
    },
    [collectEnsembleChartLoadPlan, ensureEnsembleMemberColumnsLoaded],
  );

  /**
   * STEP 1 + STEP 4: Gate and column picker flow
   *
   * When the user right-clicks a component and chooses "Associate Chart", we first check
   * whether a simulation is loaded. If not, we show an instructive message. If yes,
   * we open the column picker dialog (Step 4) so the user can pick X and Y columns from
   * the current simulation's CSV. On confirm, we add the chart and persist to .sim.json.
   */
  const handleAssociateChart = (component, chartType) => {
    if (!simulationReadyForCharts) {
      alert('Run a simulation first to add or modify charts.\n\nClick a scenario button in the Simulation Controls panel.');
      return;
    }
    setColumnPickerContext({ component, chartType });
  };

  /**
   * STEP 4: Callback when user confirms column selection in the column picker dialog.
   * We create the chart object, add it to openCharts, persist to .sim.json, and close the dialog.
   */
  const handleColumnPickerConfirm = async ({ xColumn, yColumn, title, alsoOpenInPanel }) => {
    if (!columnPickerContext) return;
    let rawX = xColumn;
    let rawY = yColumn;
    let ensembleSimIdPick;
    let ensembleCrossPick = false;
    if (simulationMetadata?.isEnsemble) {
      const xp = parseEnsembleQualifiedColumn(xColumn);
      const yp = parseEnsembleQualifiedColumn(yColumn);
      if (!xp || !yp) {
        alert('Pick columns using the full member label, e.g. BESS_1 — Time (s).');
        return;
      }
      if (xp.simId === yp.simId) {
        ensembleSimIdPick = xp.simId;
        rawX = xp.column;
        rawY = yp.column;
        try {
          await ensureEnsembleMemberColumnsLoaded(ensembleSimIdPick, [rawX, rawY].filter(Boolean));
        } catch {
          return;
        }
      } else {
        ensembleCrossPick = true;
        try {
          await ensureEnsembleMemberColumnsLoaded(xp.simId, [xp.column].filter(Boolean));
          await ensureEnsembleMemberColumnsLoaded(yp.simId, [yp.column].filter(Boolean));
        } catch {
          return;
        }
      }
    } else {
      await ensureSimulationColumnsLoaded([xColumn, yColumn].filter(Boolean));
    }
    const { component, chartType } = columnPickerContext;
    const mem = simulationMetadata?.memberSimulations || [];
    const primaryMember = mem[0] || 'ensemble';
    const csvName = ensembleCrossPick
      ? `${primaryMember}.data.csv`
      : ensembleSimIdPick
        ? `${ensembleSimIdPick}.data.csv`
        : simulationMetadata?.id
          ? `${simulationMetadata.id}.data.csv`
          : '';

    if (chartType === '2d') {
      const spark = {
        id: `spark-${Date.now()}`,
        xColumn: ensembleCrossPick ? xColumn : rawX,
        yColumn: ensembleCrossPick ? yColumn : rawY,
        ...(ensembleSimIdPick && { ensembleSimId: ensembleSimIdPick }),
        ...(ensembleCrossPick && { ensembleCrossMember: true }),
      };
      setCanvasComponents((prev) =>
        prev.map((c) =>
          c.id === component.id
            ? { ...c, embeddedSparklines: [...(c.embeddedSparklines || []), spark] }
            : c
        )
      );
      setSelectedComponent((prev) =>
        prev?.id === component.id
          ? {
              ...prev,
              embeddedSparklines: [...(prev.embeddedSparklines || []), spark],
            }
          : prev
      );
      if (alsoOpenInPanel) {
        const openChart = {
          id: `open-${Date.now()}`,
          componentId: component.id,
          componentName: component.name,
          chartType,
          csvName,
          xColumn: ensembleCrossPick ? xColumn : rawX,
          yColumn: ensembleCrossPick ? yColumn : rawY,
          title: title || `${component.name} - ${ensembleCrossPick ? (yColumn || '').split(ENSEMBLE_COLUMN_SEP).pop() : rawY}`,
          ...(ensembleSimIdPick && { ensembleSimId: ensembleSimIdPick }),
          ...(ensembleCrossPick && { ensembleCrossMember: true }),
        };
        setOpenCharts((prev) => {
          const next = [...prev, openChart];
          persistChartsToSimJson(next);
          return next;
        });
      }
      setColumnPickerContext(null);
      return;
    }

    const openChart = {
      id: `open-${Date.now()}`,
      componentId: component.id,
      componentName: component.name,
      chartType,
      csvName,
      xColumn: ensembleCrossPick ? xColumn : rawX,
      yColumn: ensembleCrossPick ? yColumn : rawY,
      title: title || `${component.name} - ${ensembleCrossPick ? (yColumn || '').split(ENSEMBLE_COLUMN_SEP).pop() : rawY}`,
      ...(ensembleSimIdPick && { ensembleSimId: ensembleSimIdPick }),
      ...(ensembleCrossPick && { ensembleCrossMember: true }),
    };
    setOpenCharts(prev => {
      const next = [...prev, openChart];
      persistChartsToSimJson(next);
      return next;
    });
    setColumnPickerContext(null);
  };

  const handleConnectionReadoutSave = useCallback(
    async (config, componentId) => {
      // Apply readout to canvas state first so “Save Design” always serializes it even if the user
      // saves while column prefetch is still running (previously we updated only after awaits).
      handleUpdateComponent(componentId, { connectionReadout: config });
      try {
        for (const s of config.slots) {
          if (!s.column) continue;
          if (simulationMetadataRef.current?.isEnsemble && s.ensembleSimId) {
            await ensureEnsembleMemberColumnsLoaded(s.ensembleSimId, [s.column]);
          }
        }
        const singleCols = config.slots
          .filter((s) => s.column && !s.ensembleSimId)
          .map((s) => s.column);
        if (singleCols.length) {
          await ensureSimulationColumnsLoaded(singleCols);
        }
      } catch (e) {
        console.warn('connection readout column prefetch failed', e);
      }
    },
    [ensureEnsembleMemberColumnsLoaded, ensureSimulationColumnsLoaded, handleUpdateComponent],
  );

  const handleConnectionReadoutRemove = useCallback((componentId) => {
    handleUpdateComponent(componentId, { connectionReadout: null });
    setConnectionReadoutContext(null);
  }, [handleUpdateComponent]);

  /**
   * Handle opening a chart in the bottom panel (from a component's predefined charts).
   * After adding, we persist to .sim.json so the chart list is saved.
   */
  const handleOpenChart = async (component, chart) => {
    console.log('📊 Opening chart:', chart.chartType, 'for', component.name);
    
    const isAlreadyOpen = openCharts.some(c => 
      c.componentId === component.id && c.chartId === chart.id
    );
    if (isAlreadyOpen) {
      console.log('⚠️  Chart already open');
      return;
    }

    const ensembleSimFromCsv =
      simulationMetadata?.isEnsemble && chart.csvName?.endsWith('.data.csv')
        ? chart.csvName.replace(/\.data\.csv$/, '')
        : undefined;

    try {
      if (simulationMetadata?.isEnsemble && ensembleSimFromCsv) {
        await ensureEnsembleMemberColumnsLoaded(ensembleSimFromCsv, [
          chart.xColumn,
          chart.yColumn,
          ...(chart.yColumns || []),
        ].filter(Boolean));
      } else if (!simulationMetadata?.isEnsemble) {
        await ensureSimulationColumnsLoaded(
          [chart.xColumn, chart.yColumn, ...(chart.yColumns || [])].filter(Boolean),
        );
      }
    } catch {
      return;
    }

    const openChart = {
      id: `open-${Date.now()}`,
      componentId: component.id,
      componentName: component.name,
      chartId: chart.id,
      chartType: chart.chartType,
      csvName: chart.csvName,
      xColumn: chart.xColumn,
      ...(chart.yColumn != null && { yColumn: chart.yColumn }),
      ...(chart.yColumns != null && { yColumns: chart.yColumns }),
      ...(chart.splitBy && { splitBy: chart.splitBy }),
      ...(chart.manualGroupBreaks?.length && { manualGroupBreaks: chart.manualGroupBreaks }),
      ...(ensembleSimFromCsv && { ensembleSimId: ensembleSimFromCsv }),
    };

    setOpenCharts(prev => {
      const next = [...prev, openChart];
      persistChartsToSimJson(next);
      return next;
    });
  };

  /**
   * Handle creating a multi-component chart (animated bar chart, etc.).
   * After adding the chart to state, we persist the full chart list to .sim.json
   * so the new chart survives a reload.
   */
  const handleCreateMultiComponentChart = async (chartConfig) => {
    console.log('📊 Creating multi-component chart:', chartConfig);

    const cols = [
      chartConfig.timeColumn,
      ...(chartConfig.components || []).map((c) => c.columnName),
    ].filter(Boolean);

    let ensembleSimMulti;
    let normalizedConfig = chartConfig;
    let ensembleCrossMulti = false;
    if (simulationMetadata?.isEnsemble) {
      const parsed = parseEnsembleColumnSelections(cols);
      if (!parsed) {
        alert(
          'Each block must use a qualified name (e.g. LM2500_1 — Time (s)) — text before the — must be the member scenario for that column.',
        );
        return;
      }
      const byMem = groupColumnsByEnsembleMember(parsed.items);
      const ensSet = new Set(
        (simulationMetadata.derivedVariables || []).map((d) => d.name),
      );
      for (const [memberSimId, rawCols] of Object.entries(byMem)) {
        const toLoad = rawCols.filter(
          (c) => c && (memberSimId === 'formula' || !ensSet.has(c)),
        );
        if (!toLoad.length) continue;
        try {
          await ensureEnsembleMemberColumnsLoaded(memberSimId, toLoad);
        } catch {
          return;
        }
      }
      if (isEnsembleCrossMemberSelection(parsed.items)) {
        if (chartConfig.type === 'multi-bar-chart') {
          alert(
            'Multi-block bar chart currently requires all columns to come from the same scenario. Use a multi-line chart to compare different member scenarios, or keep every block in one tab.',
          );
          return;
        }
        ensembleCrossMulti = true;
        normalizedConfig = { ...chartConfig };
      } else {
        const sim0 = parsed.items[0].simId;
        if (!parsed.items.every((it) => it.simId === sim0)) {
          alert('Inconsistent member ids in column picks.');
          return;
        }
        ensembleSimMulti = sim0;
        const rawTime = parsed.items[0].column;
        normalizedConfig = {
          ...chartConfig,
          timeColumn: rawTime,
          components: chartConfig.components.map((c, i) => ({
            ...c,
            columnName: parsed.items[i + 1].column,
          })),
        };
      }
    } else {
      try {
        await ensureSimulationColumnsLoaded(cols);
      } catch {
        return;
      }
    }

    const members = simulationMetadata?.memberSimulations || [];
    const primary = members[0] || 'ensemble';
    const multiChart = {
      id: `multi-${Date.now()}`,
      type: 'multi-component',
      chartType: normalizedConfig.type,
      title: normalizedConfig.title,
      csvName: ensembleSimMulti
        ? `${ensembleSimMulti}.data.csv`
        : ensembleCrossMulti
          ? `${primary}.data.csv`
          : normalizedConfig.csvFile,
      timeColumn: normalizedConfig.timeColumn,
      components: normalizedConfig.components || [],
      isMultiComponent: true,
      ...(ensembleSimMulti && { ensembleSimId: ensembleSimMulti }),
      ...(ensembleCrossMulti && { ensembleCrossMember: true }),
    };

    setOpenCharts(prev => {
      const next = [...prev, multiChart];
      persistChartsToSimJson(next);
      return next;
    });
  };

  /**
   * Add chart from SimulationChartBuilder (Property Panel when sim loaded).
   * Receives { chartType, selections } - maps to xColumn/yColumn based on chart type.
   */
  const handleAddChartFromBuilder = useCallback(async ({ chartType, selections, splitBy, manualGroupBreaks }) => {
    if (!simulationMetadata || !selections?.length) return;

    const lazyCols =
      chartType === 'nd' || chartType === 'stacked-nd'
        ? [...selections]
        : chartType === 'pie'
          ? (() => {
              const mc = (simulationMetadata?.columns || []).filter(Boolean);
              const tc = pickTimeColumn(mc);
              const s = [...selections];
              if (tc && !s.includes(tc)) return [tc, ...s];
              return s;
            })()
        : chartType === '2d' || chartType === 'bar'
          ? selections.slice(0, 2)
          : [...selections];

    let ensembleSimId;
    let rawSelections;
    let ensembleCrossMember = false;
    if (simulationMetadata.isEnsemble) {
      const qList = lazyCols.filter(Boolean);
      const parsed = parseEnsembleColumnSelections(qList);
      if (!parsed) {
        alert(
          'Each column must include its scenario prefix (e.g. LM2500_1 — Time (s)).',
        );
        return;
      }
      const byMem = groupColumnsByEnsembleMember(parsed.items);
      const ensDerivedNames = new Set(
        (simulationMetadata.derivedVariables || []).map((d) => d.name),
      );
      const members = simulationMetadata.memberSimulations || [];
      const primarySim = members[0] || null;
      const ensDerived = simulationMetadata.derivedVariables || [];
      for (const [memberSimId, rawColList] of Object.entries(byMem)) {
        let toLoad = rawColList.filter(
          (c) => c && (memberSimId === 'formula' || !ensDerivedNames.has(c)),
        );
        if (
          !toLoad.length &&
          memberSimId === primarySim &&
          rawColList.some((c) => c && ensDerivedNames.has(c)) &&
          ensDerived.length
        ) {
          const g = ensembleColumnGroupsRef.current.find((x) => x.simId === memberSimId);
          const csvCols = g?.columns || [];
          const tc = pickTimeColumn(csvCols);
          const needD = columnsNeededForDerived(ensDerived, csvCols);
          toLoad = [...new Set([tc, ...needD].filter(Boolean))];
        }
        if (!toLoad.length) {
          console.warn('[DCS:ensemble-plot] addChart: toLoad empty after rules — skipping member', {
            memberSimId,
            rawColList,
            primarySim,
            ensDerivedNames: [...ensDerivedNames],
          });
          continue;
        }
        try {
          await ensureEnsembleMemberColumnsLoaded(memberSimId, toLoad);
        } catch (e) {
          console.error('[DCS:ensemble-plot] addChart: ensureEnsembleMemberColumnsLoaded failed', memberSimId, e);
          return;
        }
      }
      ensembleCrossMember = isEnsembleCrossMemberSelection(parsed.items);
      if (ensembleCrossMember) {
        rawSelections = null;
        ensembleSimId = null;
      } else {
        ensembleSimId = parsed.items[0].simId;
        rawSelections = parsed.items.map((it) => it.column);
      }
    } else {
      try {
        await ensureSimulationColumnsLoaded(lazyCols.filter(Boolean));
      } catch {
        return;
      }
    }

    const members = simulationMetadata.memberSimulations || [];
    const primary = members[0] || 'ensemble';
    const cols = simulationMetadataRef.current?.columns || simulationMetadata.columns || [];
    const csvName = simulationMetadata.isEnsemble
      ? ensembleCrossMember
        ? `${primary}.data.csv`
        : `${ensembleSimId}.data.csv`
      : `${simulationMetadata.id}.data.csv`;
    const comp = canvasComponents[0];
    const componentId = comp?.id || 'sim-data';
    const componentName = comp?.name || simulationMetadata.displayName || 'Simulation';

    let xColumn, yColumn, yColumns, title;
    const sel =
      simulationMetadata.isEnsemble && !ensembleCrossMember
        ? rawSelections
        : !simulationMetadata.isEnsemble
          ? selections
          : null;
    if (ensembleCrossMember) {
      const quals = lazyCols.filter(Boolean);
      if (chartType === 'nd') {
        xColumn = quals[0];
        yColumns = quals.slice(1);
        title = `${componentName} - nD`;
      } else if (chartType === 'pie' && selections?.length >= 2) {
        xColumn = pickTimeColumn(cols.filter(Boolean)) || '';
        yColumns = [...selections];
        title = `${componentName} - Pie`;
      } else if (chartType === 'stacked-nd') {
        xColumn = quals[0];
        yColumns = quals.slice(1);
        title = `${componentName} - Stacked nD`;
      } else if (chartType === '2d' || chartType === 'bar') {
        xColumn = quals[0];
        yColumn = quals[1];
        const shortY = (quals[1] || '').split(ENSEMBLE_COLUMN_SEP).pop() || yColumn;
        title = `${componentName} - ${shortY}`;
      } else {
        xColumn = cols[0] || quals[0];
        yColumn = quals[0];
        title = `${componentName} - ${yColumn}`;
      }
    } else if (chartType === 'nd') {
      xColumn = sel[0];
      yColumns = sel.slice(1);
      title = `${componentName} - nD`;
    } else if (chartType === 'pie') {
      xColumn = pickTimeColumn(cols.filter(Boolean)) || '';
      yColumns = [...selections];
      title = `${componentName} - Pie`;
    } else if (chartType === 'stacked-nd') {
      xColumn = sel[0];
      yColumns = sel.slice(1);
      title = `${componentName} - Stacked nD`;
    } else if (chartType === '2d' || chartType === 'bar') {
      xColumn = sel[0];
      yColumn = sel[1];
      title = `${componentName} - ${yColumn}`;
    } else {
      xColumn = cols[0] || sel[0];
      yColumn = sel[0];
      title = `${componentName} - ${sel[0]}`;
    }

    const openChart = {
      id: `open-${Date.now()}`,
      componentId,
      componentName,
      chartType,
      csvName,
      xColumn,
      ...(yColumn != null && { yColumn }),
      ...(yColumns != null && { yColumns }),
      ...(chartType === 'stacked-nd' && splitBy && { splitBy }),
      ...(chartType === 'stacked-nd' && splitBy === 'manual' && manualGroupBreaks?.length && { manualGroupBreaks }),
      title,
      ...(ensembleSimId && { ensembleSimId }),
      ...(ensembleCrossMember && { ensembleCrossMember: true }),
    };
    setOpenCharts(prev => {
      const next = [...prev, openChart];
      persistChartsToSimJson(next);
      return next;
    });
  }, [
    simulationMetadata,
    ensureSimulationColumnsLoaded,
    ensureEnsembleMemberColumnsLoaded,
    canvasComponents,
    persistChartsToSimJson,
  ]);

  /**
   * Add a derived variable (formula-based column).
   * Ensemble mode: saves formula to .ensemble.json, materializes to formula.data.csv on disk,
   * then refreshes the formula group in the Variables panel — nothing is added to ƒ (live).
   * Single-scenario mode: augments in-memory simulationData and persists.
   */
  const handleAddDerivedVariable = useCallback(async (formula, variableName) => {
    if (!currentConfigName) return;
    const meta = simulationMetadataRef.current;
    if (!meta?.id) return;
    if (meta.isEnsemble && !meta.ensembleId) return;

    if (!meta.isEnsemble) {
      const rows = simulationDataRef.current;
      if (!rows?.length) {
        alert('No simulation rows loaded — load scenario data before adding a derived variable.');
        return;
      }
    }

    const isEns = !!meta.isEnsemble;
    setDerivedVariableCommitMessage(
      isEns
        ? 'Please wait until this derived variable is written to disk (Parquet) and to the database.'
        : 'Please wait until this derived variable is saved to your scenario configuration.',
    );

    try {
      if (isEns) {
        const eid = meta.ensembleId;
        const prevDv = meta.derivedVariables ?? [];
        const newDerived = [...prevDv, { name: variableName, formula }];

        await persistChartsToSimJson(openCharts, { derived_variables: newDerived });

        const matUrl = `${API_BASE_URL}/api/designs/${encodeURIComponent(
          designApiPath,
        )}/ensembles/${encodeURIComponent(eid)}/materialize-formula-csv`;
        const matRes = await fetch(matUrl, { method: 'POST' });
        if (!matRes.ok) {
          const errText = await matRes.text();
          throw new Error(errText || `Materialize failed (${matRes.status})`);
        }

        const formulaMeta = await fetchSimulationMetadata(designApiPath, 'formula');
        if (formulaMeta?.columns?.length) {
          setEnsembleColumnGroups((prev) => {
            const withoutFormula = prev.filter((g) => g.simId !== 'formula');
            return [...withoutFormula, { simId: 'formula', columns: formulaMeta.columns }];
          });
          setSimulationMetadata((prev) => {
            const existing = new Set(prev.columns || []);
            const next = [...(prev.columns || [])];
            for (const c of formulaMeta.columns) {
              const q = qualifyEnsembleColumn('formula', c);
              if (!existing.has(q)) next.push(q);
            }
            return { ...prev, derivedVariables: newDerived, columns: next };
          });
        } else {
          setSimulationMetadata((prev) => ({ ...prev, derivedVariables: newDerived }));
        }
        return;
      }

      const rows = simulationDataRef.current;
      const prevDvSingle = meta.derivedVariables || [];
      const newDerived = [...prevDvSingle, { name: variableName, formula }];
      const { augmentRowsWithDerived } = await import('./utils/formulaEvaluator');
      const augmented = augmentRowsWithDerived(rows, [{ name: variableName, formula }]);
      setSimulationMetadata((prev) => {
        const augKeys = Object.keys(augmented[0] || {});
        const base = Array.isArray(prev.columns) && prev.columns.length ? [...prev.columns] : [...augKeys];
        const colSet = new Set(base);
        for (const k of augKeys) {
          if (!colSet.has(k)) {
            base.push(k);
            colSet.add(k);
          }
        }
        return { ...prev, derivedVariables: newDerived, columns: base };
      });
      setSimulationData(augmented);
      await persistChartsToSimJson(openCharts, { derived_variables: newDerived });
    } catch (e) {
      console.error('handleAddDerivedVariable', e);
      alert(e?.message || String(e));
    } finally {
      setDerivedVariableCommitMessage(null);
    }
  }, [currentConfigName, openCharts, persistChartsToSimJson, designApiPath]);

  /**
   * Delete one CSV column from disk (Parquet bundle + manifest + SQLite mirror + derived prune),
   * then refresh metadata and in-memory rows.
   */
  const handleRemoveScenarioColumn = useCallback(
    async ({ simId: memberSimId, rawColumn }) => {
      const col = (rawColumn ?? '').trim();
      if (!col || !designApiPath || !currentConfigName) return;

      const snap = simulationMetadataRef.current;
      const targetSimId = snap?.isEnsemble ? memberSimId : snap?.id;
      if (!targetSimId) return;
      if (snap?.isEnsemble && !memberSimId) {
        alert('Missing member scenario id.');
        return;
      }

      if (
        !window.confirm(
          `Remove "${col}" from scenario "${targetSimId}"?\nThis deletes stored column data (Parquet / manifest), matching derived-variable definitions, and the SQLite mirror.`,
        )
      ) {
        return;
      }

      const url = `${API_BASE_URL}/api/designs/${encodeURIComponent(designApiPath)}/simulations/${encodeURIComponent(targetSimId)}/column?name=${encodeURIComponent(col)}`;
      let res;
      try {
        res = await fetch(url, { method: 'DELETE' });
      } catch (e) {
        alert(`Network error: ${e.message || e}`);
        return;
      }
      if (!res.ok) {
        try {
          const t = await res.text();
          alert(t || `Remove failed (${res.status})`);
        } catch (_) {
          alert(`Remove failed (${res.status})`);
        }
        return;
      }

      try {
        await deleteCachedSimulationPayload(designApiPath, targetSimId);
      } catch (_) {
        /* ignore IDB */
      }

      let meta;
      try {
        meta = await fetchSimulationMetadata(designApiPath, targetSimId);
      } catch (e) {
        alert(`Removed on server but metadata refresh failed: ${e.message || e}`);
        return;
      }

      const derivedNow = meta.sim_config?.derived_variables || [];
      ensembleMemberDerivedBySimIdRef.current = {
        ...ensembleMemberDerivedBySimIdRef.current,
        [targetSimId]: derivedNow,
      };
      ensembleMemberMetaCacheRef.current = {
        ...ensembleMemberMetaCacheRef.current,
        [targetSimId]: meta,
      };

      const snapAfter = simulationMetadataRef.current;
      const qRemoved = qualifyEnsembleColumn(targetSimId, col);
      const filteredEnsDerived =
        snapAfter?.isEnsemble && targetSimId === 'formula'
          ? (snapAfter.derivedVariables || []).filter(
              (d) => String(d?.name ?? '').trim() !== col.trim(),
            )
          : snapAfter?.derivedVariables || [];

      if (snapAfter?.isEnsemble) {
        setEnsembleColumnGroups((prev) =>
          prev.map((g) =>
            g.simId === targetSimId ? { ...g, columns: meta.columns || [] } : g,
          ),
        );
        setSimulationMetadata((prev) => {
          if (!prev?.isEnsemble) return prev;
          return {
            ...prev,
            columns: (prev.columns || []).filter((c) => c !== qRemoved),
            rowCount: Math.max(prev.rowCount ?? 0, meta.row_count ?? 0),
            ...(targetSimId === 'formula' ? { derivedVariables: filteredEnsDerived } : {}),
          };
        });
        const eid = snapAfter?.ensembleId;
        if (eid && targetSimId === 'formula') {
          setDesignEnsembles((prev) =>
            prev.map((ent) =>
              ent.id === eid
                ? {
                    ...ent,
                    chart_panel: {
                      ...(ent.chart_panel || {}),
                      derived_variables: filteredEnsDerived,
                    },
                  }
                : ent,
            ),
          );
        }

        const loadedMap = ensembleMemberSimulationDataRef.current || {};
        const existingRows = loadedMap[targetSimId];
        const members = snapAfter.memberSimulations || [];
        const primary = members[0];

        const stripRows = (rows) =>
          rows?.length
            ? rows.map((row) => {
                const o = { ...row };
                const hit =
                  Object.keys(o).find((k) => k === col || String(k).trim() === col.trim()) ?? null;
                if (hit) delete o[hit];
                return o;
              })
            : rows;

        if (existingRows?.length) {
          let stripped = stripRows(existingRows);
          const { augmentRowsWithDerived, augmentEnsemblePrimaryWithCrossMemberDerived } = await import(
            './utils/formulaEvaluator',
          );
          stripped = augmentRowsWithDerived(stripped, derivedNow);
          let nextMap = { ...loadedMap, [targetSimId]: stripped };
          const ensCross = filteredEnsDerived;
          if (ensCross.length && primary) {
            nextMap = augmentEnsemblePrimaryWithCrossMemberDerived(members, nextMap, ensCross, primary);
          }
          ensembleMemberSimulationDataRef.current = nextMap;
          setEnsembleMemberSimulationData(nextMap);
          if (primary && targetSimId === primary) {
            simulationRawRowsRef.current = nextMap[primary];
            setSimulationData(nextMap[primary]);
          }
        }
        return;
      }

      let columnsForUi = [...(meta.columns || [])];
      const colSet = new Set(columnsForUi);
      for (const { name } of derivedNow) {
        if (name && !colSet.has(name)) {
          columnsForUi.push(name);
          colSet.add(name);
        }
      }

      const raw = simulationRawRowsRef.current;
      const rawFor = simulationRawRowsSimIdRef.current;
      if (raw?.length && rawFor === targetSimId) {
        const stripped = raw.map((row) => {
          const o = { ...row };
          const hit =
            Object.keys(o).find((k) => k === col || String(k).trim() === col.trim()) ?? null;
          if (hit) delete o[hit];
          return o;
        });
        simulationRawRowsRef.current = stripped;
        const { augmentRowsWithDerived } = await import('./utils/formulaEvaluator');
        setSimulationData(augmentRowsWithDerived(stripped, derivedNow));
      } else {
        setSimulationData((prev) => {
          if (!prev?.length) return prev;
          return prev.map((row) => {
            const o = { ...row };
            const hit =
              Object.keys(o).find((k) => k === col || String(k).trim() === col.trim()) ?? null;
            if (hit) delete o[hit];
            return o;
          });
        });
      }

      if (useLazySimulationData && lazyColumnNeedRef.current?.length) {
        lazyColumnNeedRef.current = lazyColumnNeedRef.current.filter(
          (k) => k !== col && String(k).trim() !== col.trim(),
        );
      }

      setSimulationMetadata((prev) => ({
        ...prev,
        rowCount: meta.row_count ?? prev.rowCount,
        columns: columnsForUi,
        derivedVariables: derivedNow,
        timeRange:
          meta.time_column_min != null && meta.time_column_max != null
            ? { min: meta.time_column_min, max: meta.time_column_max }
            : prev.timeRange,
      }));
    },
    [designApiPath, currentConfigName, useLazySimulationData],
  );

  const handleRemoveEnsembleLiveDerived = useCallback(
    async (variableName) => {
      const vn = (variableName ?? '').trim();
      const metaInst = simulationMetadataRef.current;
      const eid = metaInst?.ensembleId;
      if (!vn || !designApiPath || !currentConfigName || !metaInst?.isEnsemble || !eid) return;

      if (
        !window.confirm(
          `Remove live formula "${vn}" from this ensemble?\nThis removes it from chart_panel (not member Parquet files).`,
        )
      ) {
        return;
      }

      const url = `${API_BASE_URL}/api/designs/${encodeURIComponent(designApiPath)}/ensembles/${encodeURIComponent(eid)}/derived-variables?name=${encodeURIComponent(vn)}`;
      let res;
      try {
        res = await fetch(url, { method: 'DELETE' });
      } catch (e) {
        alert(`Network error: ${e.message || e}`);
        return;
      }
      if (!res.ok) {
        try {
          const t = await res.text();
          alert(t || `Remove failed (${res.status})`);
        } catch (_) {
          alert(`Remove failed (${res.status})`);
        }
        return;
      }

      const members = metaInst.memberSimulations || [];
      const primary = members[0];
      const q = qualifyEnsembleColumn(primary, vn);
      const newDerived = (metaInst.derivedVariables || []).filter((d) => d.name !== vn);

      setSimulationMetadata((prev) => ({
        ...prev,
        derivedVariables: newDerived,
        columns: (prev.columns || []).filter((c) => c !== q),
      }));

      const loaded = ensembleMemberSimulationDataRef.current || {};
      if (primary && loaded[primary]?.length) {
        const { augmentEnsemblePrimaryWithCrossMemberDerived } = await import('./utils/formulaEvaluator');
        const stripped = loaded[primary].map((row) => {
          const o = { ...row };
          delete o[vn];
          delete o[q];
          return o;
        });
        let nextMap = { ...loaded, [primary]: stripped };
        nextMap = augmentEnsemblePrimaryWithCrossMemberDerived(members, nextMap, newDerived, primary);
        ensembleMemberSimulationDataRef.current = nextMap;
        setEnsembleMemberSimulationData(nextMap);
        simulationRawRowsRef.current = nextMap[primary];
        setSimulationData(nextMap[primary]);
      }
    },
    [designApiPath, currentConfigName],
  );

  /** Reindex chartStacks when a chart at removedIdx is removed */
  const reindexChartStacksAfterRemove = (stacks, removedIdx) => {
    return stacks
      .map(stack => stack
        .filter(i => i !== removedIdx)
        .map(i => i > removedIdx ? i - 1 : i)
      )
      .filter(stack => stack.length >= 2);
  };

  /**
   * Handle removing a chart from the bottom panel.
   * We compute the next chart list, update state, and persist to .sim.json so the
   * removal is saved and will persist across reloads.
   */
  const handleRemoveChart = (openChartId) => {
    console.log('🗑️  Removing chart:', openChartId);
    const removedIdx = openCharts.findIndex(c => c.id === openChartId);
    const nextCharts = openCharts.filter(c => c.id !== openChartId);
    const nextStacks = removedIdx >= 0 ? reindexChartStacksAfterRemove(chartStacks, removedIdx) : chartStacks;
    setOpenCharts(nextCharts);
    setChartStacks(nextStacks);
    setPerChartSampleStep(prev => {
      const next = { ...prev };
      delete next[openChartId];
      return next;
    });
    persistChartsToSimJson(nextCharts, { chart_stacks: nextStacks });
  };

  /** Update chart labels/title — persists to .sim.json. */
  const handleUpdateChart = useCallback((chartId, overrides) => {
    setOpenCharts(prev => {
      const next = prev.map(c => c.id === chartId ? { ...c, ...overrides } : c);
      persistChartsToSimJson(next);
      return next;
    });
  }, [persistChartsToSimJson]);

  /**
   * Handle closing the entire chart panel.
   * We clear charts and persist the empty list to .sim.json so reopening the design
   * will start with no charts.
   */
  const handleCloseChartPanel = () => {
    console.log('❌ Closing chart panel');
    setOpenCharts([]);
    setChartStacks([]);
    setPerChartSampleStep({});
    persistChartsToSimJson([], { chart_stacks: [] });
  };

  const handleStackCharts = (selectedChartIds) => {
    if (!selectedChartIds || selectedChartIds.size < 2) return;
    const indices = openCharts
      .map((c, i) => (selectedChartIds.has(c.id) ? i : -1))
      .filter(i => i >= 0)
      .sort((a, b) => a - b);
    if (indices.length < 2) return;
    const selectedSet = new Set(indices);
    const nextStacks = chartStacks
      .map(stack => stack.filter(i => !selectedSet.has(i)))
      .filter(stack => stack.length >= 2);
    nextStacks.push(indices);
    setChartStacks(nextStacks);
    persistChartsToSimJson(openCharts, { chart_stacks: nextStacks });
  };

  const handleUnstackCharts = (selectedChartIds) => {
    if (!selectedChartIds || selectedChartIds.size === 0) return;
    const selectedIndices = new Set(
      openCharts.map((c, i) => (selectedChartIds.has(c.id) ? i : -1)).filter(i => i >= 0)
    );
    const nextStacks = chartStacks
      .map(stack => stack.filter(i => !selectedIndices.has(i)))
      .filter(stack => stack.length >= 2);
    setChartStacks(nextStacks);
    persistChartsToSimJson(openCharts, { chart_stacks: nextStacks });
  };

  /**
   * Handle Load - Apply loaded configuration to the app
   */
  const handleConfigurationLoaded = (loadedConfig) => {
    const perfT0 = performance.now();
    console.log('[DCS:perf] handleConfigurationLoaded ▶ START', {
      name: loadedConfig.name,
      t: perfT0,
    });
    const skipSessionRestore = loadSkipSessionRestoreRef.current;
    loadSkipSessionRestoreRef.current = false;

    dcsSimDbg('handleConfigurationLoaded ▶', {
      configName: loadedConfig.name,
      skipSessionRestore,
      use_design_dir: loadedConfig.csv_status?.use_design_dir,
      design_catalog_rel: loadedConfig.csv_status?.design_catalog_rel,
      canvasComponentCount: loadedConfig.data?.canvasComponents?.length ?? 0,
      availableSimIds: (loadedConfig.csv_status?.available_simulations || []).map((s) => s.id),
    });

    console.log('✅ Loading configuration:', loadedConfig.name);
    console.log('🔍 Full loadedConfig:', loadedConfig); // DEBUG: See entire response
    console.log('🔍 csv_status:', loadedConfig.csv_status); // DEBUG: Check csv_status
    console.log('🔍 sim_config:', loadedConfig.sim_config); // DEBUG: Check sim_config
    
    // Save the configuration name for future quick saves
    setCurrentConfigName(loadedConfig.name);
    
    // Store CSV status and fetch available simulations
    if (loadedConfig.csv_status) {
      setCsvStatus(loadedConfig.csv_status);
      const sims = loadedConfig.csv_status.available_simulations || [];
      setAvailableSimulations(sims.map(s => s.id));
      const simMap = {};
      sims.forEach(s => {
        simMap[s.id] = {
          display_name: s.display_name,
          description: s.description || '',
          has_data: !!s.has_data,
          ...(s.data_row_count != null && s.data_column_count != null
            ? { data_row_count: s.data_row_count, data_column_count: s.data_column_count }
            : {}),
        };
      });
      setSimConfig(sims.length > 0 ? { simulations: simMap } : null);
    } else {
      console.warn('⚠️ csv_status is missing from backend response!');
      setAvailableSimulations([]);
      setSimConfig(null);
    }
    
    // Extract data from the loaded configuration
    const { data } = loadedConfig;
    
    // Apply the loaded state to the application
    if (data.canvasComponents) {
      // Set all components to 'idle' status initially when loaded
      // They will turn 'online' when user presses "Start Simulation"
      const componentsWithIdleStatus = data.canvasComponents.map(comp => ({
        ...comp,
        status: 'idle',
        isTripped: false
      }));
      setCanvasComponents(componentsWithIdleStatus);
    }
    
    if (data.connections) {
      setConnections(data.connections);
    }
    
    if (data.systemState) {
      setSystemState(data.systemState);
      
      // Apply zoom and pan if they exist
      if (data.systemState.zoom !== undefined) {
        setZoom(data.systemState.zoom);
      }
      if (data.systemState.pan) {
        setPan(data.systemState.pan);
      }
      if (data.systemState.simulationRunning !== undefined) {
        setSimulationRunning(data.systemState.simulationRunning);
      }
    }
    
    // Never restore charts on load: design only. Charts appear when user clicks a simulation.
    setOpenCharts([]);
    setDesignViewMode('canvas');
    
    // Reset selection
    setSelectedComponent(null);
    setSelectedConnection(null);

    // Step 4: after Load Design (not URL bootstrap), re-open the last scenario tab for this folder via localStorage.
    if (!skipSessionRestore && loadedConfig.csv_status?.use_design_dir) {
      setSessionRestoreTrigger((n) => n + 1);
    }

    setLastNamedPresetForUi(null);

    console.log('✅ Configuration loaded and applied');
    console.log('[DCS:perf] handleConfigurationLoaded ✓ END (sync React state queued)', {
      totalMs: Math.round(performance.now() - perfT0),
      sessionRestoreWillRun: !skipSessionRestore && !!loadedConfig.csv_status?.use_design_dir,
      note: 'Session restore may start handleRunSimulation async next — watch [DCS:perf] handleRunSimulation',
    });
    dcsSimDbg('handleConfigurationLoaded ✓ applied (session restore will bump unless skipSessionRestore)', {
      skipSessionRestore,
      willTriggerSessionRestore: !skipSessionRestore && !!loadedConfig.csv_status?.use_design_dir,
    });
  };

  /**
   * Handle Save - Update current config name after save
   */
  const handleConfigurationSaved = (savedConfig) => {
    console.log('✅ Configuration saved:', savedConfig.name);
    
    // Update current config name for future quick saves
    setCurrentConfigName(savedConfig.name);

    // Persist current simulation's charts + sample rates to .sim.json
    if (simulationMetadata?.id) {
      persistChartsToSimJson(openCharts);
    }
  };

  /**
   * Get current configuration for saving
   */
  const getCurrentConfiguration = () => {
    return {
      canvasComponents,
      connections,
      systemState: {
        simulationRunning,
        zoom,
        pan,
        mode
      }
    };
  };

  // Keep latest handlers in refs so one-shot URL bootstrap effects do not capture stale closures or re-run on every render.
  const handleConfigurationLoadedRef = useRef(null);
  const handleRunSimulationRef = useRef(null);
  const deepLinkBootstrapStartedRef = useRef(false);

  useEffect(() => {
    activeNamedSimulationConfigRef.current = activeNamedSimulationConfig;
  });

  useEffect(() => {
    handleConfigurationLoadedRef.current = handleConfigurationLoaded;
    handleRunSimulationRef.current = handleRunSimulation;
  });

  // Step 3: optional startup URL ?design=catalogPath&sim=ScenarioId&config=NamedPreset — load canvas from disk, then hydrate charts like a manual scenario click.
  // React Strict Mode runs mount → cleanup → mount again; we must reset deepLinkBootstrapStartedRef in cleanup or the remount exits early and never fetches.
  useEffect(() => {
    if (deepLinkBootstrapStartedRef.current) return;
    const parsed = parseSimulationDeepLink(window.location.search);
    if (!parsed) return;
    deepLinkBootstrapStartedRef.current = true;
    dcsSimDbg('URL bootstrap parsed', {
      design: parsed.design,
      sim: parsed.sim,
      config: parsed.config ?? '(current draft)',
      rawSearch: window.location.search,
    });
    console.log('[Deep link] Parsed URL → design=%s sim=%s config=%s', parsed.design, parsed.sim, parsed.config ?? '(current draft)');
    let cancelled = false;
    (async () => {
      try {
        const url = `${API_BASE_URL}/api/designs/catalog/${encodeURIComponent(parsed.design)}/load`;
        const res = await fetch(url);
        if (!res.ok) {
          if (!cancelled) console.warn('[Deep link] Design load failed', res.status, await res.text());
          return;
        }
        const loadedConfig = await res.json();
        if (cancelled) {
          console.log('[Deep link] Ignored design response (superseded remount)');
          return;
        }
        console.log('[Deep link] Design loaded, applying canvas…');
        loadSkipSessionRestoreRef.current = true;
        handleConfigurationLoadedRef.current?.(loadedConfig);
        setSimDeepLinkFollowup({ sim: parsed.sim, config: parsed.config });
      } catch (e) {
        if (!cancelled) console.warn('[Deep link] Error', e);
      }
    })();
    return () => {
      cancelled = true;
      deepLinkBootstrapStartedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!simDeepLinkFollowup) return;
    if (!designApiPath || !csvStatus?.use_design_dir) {
      dcsSimDbg('deepLink follow-up ⏸ wait designApiPath / use_design_dir', {
        simDeepLinkFollowup,
        designApiPath,
        use_design_dir: csvStatus?.use_design_dir,
      });
      return;
    }
    const { sim, config } = simDeepLinkFollowup;
    if (availableSimulations.length === 0) {
      dcsSimDbg('deepLink follow-up ⏸ wait availableSimulations', { sim, config, designApiPath });
      return;
    }
    if (!availableSimulations.includes(sim)) {
      console.warn(
        `[Deep link] Simulation id "${sim}" not in this design. Available:`,
        availableSimulations,
      );
      dcsSimDbg('deepLink follow-up ✖ sim not in design list', { sim, availableSimulations });
      setSimDeepLinkFollowup(null);
      return;
    }
    // Do not clear simDeepLinkFollowup before awaits: Strict Mode cleanup used to run mid-IDB, then we skipped handleRunSimulation
    // while follow-up was already null — graphs never loaded. Epoch lets the latest effect run clear state in finally.
    const epochAtStart = deepLinkFollowupEpochRef.current;
    const followupStillCurrent = () => deepLinkFollowupEpochRef.current === epochAtStart;
    const presetKey = config ? simulationPayloadStoreKey(designApiPath, sim, config) : null;
    dcsSimDbg('deepLink follow-up ▶ RUN', {
      sim,
      config,
      designApiPath,
      presetIdbKey: presetKey,
      canvasRefLenNow: canvasComponentsRef.current.length,
    });
    console.log('[Deep link] Running scenario', sim, config ? `+ preset "${config}"` : '');
    const deepLinkT0 = performance.now();
    console.log('[DCS:perf] simDeepLinkFollowup ▶ async start', { sim, config: config || null });
    (async () => {
      try {
        if (config) {
          activeNamedSimulationConfigRef.current = config;
          const presetCached = await getCachedSimulationPayload(designApiPath, sim, config);
          console.log('[DCS:perf] simDeepLinkFollowup preset IDB lookup', {
            ms: Math.round(performance.now() - deepLinkT0),
            hit: !!(presetCached?.data?.length),
            rows: presetCached?.data?.length ?? 0,
          });
          dcsSimDbg('deepLink preset IDB lookup', {
            key: presetKey,
            hit: !!(presetCached?.data?.length),
            rows: presetCached?.data?.length ?? 0,
          });
          if (presetCached?.data?.length) {
            if (!followupStillCurrent()) {
              dcsSimDbg('deepLink preset path aborted (superseded remount) before handleRunSimulation');
              return;
            }
            dcsSimDbg('deepLink → handleRunSimulation (preset cache hit, no activate POST)', { sim });
            await handleRunSimulationRef.current?.(sim, { presetResult: presetCached });
          } else {
            dcsSimDbg('deepLink → activate POST then handleRunSimulation with cachePresetName', {
              sim,
              config,
            });
            const actRes = await fetch(
              `${API_BASE_URL}/api/designs/${encodeURIComponent(designApiPath)}/simulations/${encodeURIComponent(sim)}/named-configurations/${encodeURIComponent(config)}/activate`,
              { method: 'POST' },
            );
            if (!actRes.ok) {
              if (followupStillCurrent()) {
                alert((await actRes.text()) || `Failed to activate preset (${actRes.status})`);
              }
              return;
            }
            const activated = await actRes.json().catch(() => ({}));
            await mergeCachedSimulationAfterActivate(designApiPath, sim, activated);
            if (!followupStillCurrent()) {
              dcsSimDbg('deepLink activate path aborted (superseded remount) before handleRunSimulation');
              return;
            }
            await handleRunSimulationRef.current?.(sim, { cachePresetName: config });
          }
        } else if (followupStillCurrent()) {
          dcsSimDbg('deepLink → handleRunSimulation (no named preset)', { sim });
          console.log('[DCS:perf] simDeepLinkFollowup → handleRunSimulation (draft)', {
            ms: Math.round(performance.now() - deepLinkT0),
          });
          await handleRunSimulationRef.current?.(sim);
        }
        if (!followupStillCurrent()) return;
        if (config) {
          setActiveNamedSimulationConfig(config);
          setLastNamedPresetForUi(config);
        }
        dcsSimDbg('deepLink follow-up ✓ finished UI flags; stripping URL query if present', {
          hadDesignQuery: typeof window !== 'undefined' && window.location.search.includes('design='),
        });
        if (typeof window !== 'undefined' && window.location.search.includes('design=')) {
          window.history.replaceState(null, '', `${window.location.pathname}${window.location.hash || ''}`);
        }
      } catch (e) {
        if (followupStillCurrent()) console.warn('Deep link follow-up failed', e);
        if (followupStillCurrent()) dcsSimDbg('deepLink follow-up ✖ exception', { message: e?.message, stack: e?.stack });
      } finally {
        console.log('[DCS:perf] simDeepLinkFollowup finally', {
          totalMs: Math.round(performance.now() - deepLinkT0),
          sim,
          config: config || null,
        });
        if (followupStillCurrent()) {
          setSimDeepLinkFollowup(null);
        }
      }
    })();
    return () => {
      deepLinkFollowupEpochRef.current += 1;
    };
  }, [simDeepLinkFollowup, designApiPath, csvStatus?.use_design_dir, availableSimulations]);

  useEffect(() => {
    if (sessionRestoreTrigger === 0) return;
    if (!designApiPath || !csvStatus?.use_design_dir) {
      dcsSimDbg('session restore ⏸ gated', { sessionRestoreTrigger, designApiPath, use_design_dir: csvStatus?.use_design_dir });
      return;
    }
    if (availableSimulations.length === 0) {
      dcsSimDbg('session restore ⏸ wait simulations list', { designApiPath });
      return;
    }
    let stored;
    const lsKey = lastScenarioSessionStorageKey(designApiPath);
    try {
      const raw = localStorage.getItem(lsKey);
      if (!raw) {
        dcsSimDbg('session restore ⏹ no localStorage entry', { lsKey });
        setSessionRestoreTrigger(0);
        return;
      }
      stored = JSON.parse(raw);
    } catch (e) {
      dcsSimDbg('session restore ✖ parse localStorage failed', { lsKey, message: e?.message });
      setSessionRestoreTrigger(0);
      return;
    }
    const simId = stored?.simId;
    const namedConfig = stored?.namedConfig ?? null;
    if (!simId || !availableSimulations.includes(simId)) {
      dcsSimDbg('session restore ⏹ sim not available', { simId, namedConfig, availableSimulations });
      setSessionRestoreTrigger(0);
      return;
    }
    setSessionRestoreTrigger(0);
    dcsSimDbg('session restore → queue same as deep link', {
      simId,
      namedConfig: namedConfig || '(current draft / null)',
      designApiPath,
      lsKey: lastScenarioSessionStorageKey(designApiPath),
    });
    console.log('[Session restore] Resuming', simId, namedConfig || 'current draft');
    console.log('[DCS:perf] sessionRestore → setSimDeepLinkFollowup (will run handleRunSimulation async)', {
      simId,
      namedConfig: namedConfig || null,
      note: 'This runs after Load Design; can overlap with SaveLoad 1s dialog close',
    });
    setSimDeepLinkFollowup({ sim: simId, config: namedConfig });
  }, [sessionRestoreTrigger, designApiPath, csvStatus?.use_design_dir, availableSimulations]);

  const handleCopyScenarioLink = useCallback(async () => {
    if (!designApiPath || !simulationMetadata?.id) return;
    const query = buildSimulationDeepLinkQuery({
      designApiPath,
      simulationId: simulationMetadata.id,
      namedConfig: activeNamedSimulationConfig || null,
    });
    const fullUrl = `${window.location.origin}${window.location.pathname}${query}`;
    dcsSimDbg('═══ COPY SCENARIO LINK ═══ paste into address bar in this or another tab', {
      fullUrl,
      query,
      parts: { designApiPath, simulationId: simulationMetadata.id, namedConfig: activeNamedSimulationConfig || null },
      filterConsole: 'Copy all lines starting with [DCS:',
    });
    if (await copyTextToClipboard(fullUrl)) {
      dcsSimDbg('clipboard: scenario link copy OK');
      return;
    }
    dcsSimDbg('clipboard: scenario link fell back to prompt');
    window.prompt('Copy this scenario link (select, then Ctrl+C / ⌘C):', fullUrl);
  }, [designApiPath, simulationMetadata?.id, activeNamedSimulationConfig]);

  /** Deep link with a specific named preset (conf01, …) for sharing to another browser. */
  const handleCopyNamedPresetLink = useCallback(async (presetName) => {
    if (!designApiPath || !simulationMetadata?.id || !presetName) return;
    const query = buildSimulationDeepLinkQuery({
      designApiPath,
      simulationId: simulationMetadata.id,
      namedConfig: presetName,
    });
    const fullUrl = `${window.location.origin}${window.location.pathname}${query}`;
    dcsSimDbg('═══ COPY NAMED PRESET LINK ═══', {
      fullUrl,
      presetName,
      parts: { designApiPath, simulationId: simulationMetadata.id, namedConfig: presetName },
    });
    if (await copyTextToClipboard(fullUrl)) {
      dcsSimDbg('clipboard: preset link copy OK', { presetName });
      return;
    }
    dcsSimDbg('clipboard: preset link fell back to prompt', { presetName });
    window.prompt('Copy this preset link (select, then Ctrl+C / ⌘C):', fullUrl);
  }, [designApiPath, simulationMetadata?.id]);

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-left">
          <img 
            src="/ge-vernova-logo.svg" 
            alt="GE Vernova" 
            className="ge-vernova-logo"
          />
          <h1>Datacenter &ldquo;Power to Rack&rdquo; Experience Center</h1>
          {currentConfigName && (
            <div className="config-status-badge">
              <span className="config-name">{currentConfigName}</span>
              {csvStatus && (
                csvStatus.use_design_dir ? (
                  <div className="design-view-tri-state" role="group" aria-label="Design view mode">
                    {[
                      { id: 'canvas', icon: '◉', label: 'Interactive' },
                      { id: 'image', icon: '▣', label: 'Diagram' },
                      { id: 'split', icon: '⊞', label: 'Split' }
                    ].map(({ id, icon, label }) => (
                      <button
                        key={id}
                        type="button"
                        className={`tri-state-btn ${designViewMode === id ? 'active' : ''}`}
                        onClick={() => setDesignViewMode(id)}
                        title={label}
                      >
                        <span className="tri-state-icon">{icon}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <span className={`csv-status ${csvStatus.exists ? 'csv-loaded' : 'csv-missing'}`}>
                    {csvStatus.exists ? '✅ Data loaded' : '⚠️ No CSV data'}
                  </span>
                )
              )}
            </div>
          )}
          <div className="view-mode-toggle">
            <span className={`view-badge view-${viewMode}`}>
              {viewMode === 'designer' ? '🔧 DESIGNER' : '👤 CUSTOMER'}
            </span>
            <label className="toggle-switch" title={viewMode === 'designer' ? 'Switch to Customer View' : 'Switch to Designer View'}>
              <input 
                type="checkbox" 
                checked={viewMode === 'customer'} 
                onChange={handleToggleViewMode}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>
        <div className="header-fetch-status" aria-label="Simulation data load status">
          <SimulationFetchStatusBar />
        </div>
        <Toolbar
          mode={mode}
          onToggleMode={handleToggleMode}
          viewMode={viewMode}
          simulationRunning={simulationRunning}
          onStartSimulation={handleStartSimulation}
          onStopSimulation={handleStopSimulation}
          zoom={zoom}
          onZoomIn={() => setZoom(prev => Math.min(prev + 0.1, 2))}
          onZoomOut={() => setZoom(prev => Math.max(prev - 0.1, 0.5))}
          onResetView={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
          onSave={handleQuickSave}
          onSaveAs={handleOpenSaveDialog}
          onSaveSimulationConfig={() => setSaveSimConfigDialogOpen(true)}
          onLoad={handleOpenLoadDialog}
          hasComponents={canvasComponents.length > 0}
          canSave={currentConfigName !== null}
          canSaveSimulationConfig={Boolean(csvStatus?.use_design_dir && simulationMetadata?.id && designApiPath)}
          onCopyScenarioLink={handleCopyScenarioLink}
          canCopyScenarioLink={Boolean(csvStatus?.use_design_dir && simulationMetadata?.id && designApiPath)}
        />
      </header>

      <div className="app-main">
        {viewMode === 'designer' && (
          <ComponentLibrary
            onAddComponent={handleAddComponent}
            disabled={mode === 'simulation'}
          />
        )}

        <div
          className={`panel-focus-wrapper design-view-wrapper ${designImageUrl ? `mode-${designViewMode}` : ''}`}
          style={{ position: 'relative', zIndex: focusedPanel === 'canvas' ? 1100 : 10 }}
          onMouseDown={(e) => handlePanelFocus('canvas', e)}
        >
          {designImageUrl && (designViewMode === 'image' || designViewMode === 'split') && (
            <div className="design-view-image-panel">
              <img src={designImageUrl} alt={`${currentConfigName} design diagram`} />
            </div>
          )}
          {(designViewMode === 'canvas' || designViewMode === 'split') && (
            <Canvas
              ref={canvasRef}
              components={canvasComponents}
              connections={connections}
              selectedComponent={selectedComponent}
              selectedConnection={selectedConnection}
              onSelectComponent={setSelectedComponent}
              onSelectConnection={setSelectedConnection}
              selectedComponents={selectedComponents}
              onMultiSelect={handleMultiSelect}
              onClearMultiSelection={handleClearMultiSelection}
              isComponentMultiSelected={isComponentMultiSelected}
              onMoveComponent={handleMoveComponent}
              onAddComponent={handleAddComponent}
              onAddConnection={handleAddConnection}
              onUpdateComponent={handleUpdateComponent}
              onAssociateChart={handleAssociateChart}
              onOpenChart={handleOpenChart}
              onCreateMultiComponentChart={handleCreateMultiComponentChart}
              canAddCharts={simulationReadyForCharts}
              simulationColumns={simulationMetadata?.columns || []}
              simulationCsvName={simulationMetadata?.id ? `${simulationMetadata.id}.data.csv` : ''}
              ensembleColumnGroups={ensembleColumnGroups}
              onConfigureConnectionReadout={(comp) => setConnectionReadoutContext(comp)}
              zoom={zoom}
              onZoomIn={() => setZoom((prev) => Math.min(prev + 0.1, 2))}
              onZoomOut={() => setZoom((prev) => Math.max(prev - 0.1, 0.5))}
              pan={pan}
              onPan={setPan}
              mode={mode}
              viewMode={viewMode}
              simulationRunning={simulationRunning}
              simulationData={simulationDataForCanvas}
              ensembleMemberSimulationData={ensembleMemberSimulationData}
              simulationTime={simulationTime}
              systemState={systemState}
            />
          )}
        </div>

        <div
          className={`app-right-rail ${rightRailCollapsed ? 'app-right-rail--collapsed' : ''}`}
          ref={rightRailRef}
        >
          <button
            type="button"
            className={`app-right-rail__hinge ${rightRailCollapsed ? 'app-right-rail__hinge--collapsed' : ''}`}
            onClick={toggleRightRail}
            title={rightRailCollapsed ? 'Show property & simulation panels' : 'Hide property & simulation panels'}
            aria-expanded={!rightRailCollapsed}
            aria-label={
              rightRailCollapsed ? 'Expand right panels' : 'Collapse right panels'
            }
          >
            <span className="app-right-rail__hinge-chev" aria-hidden>
              {rightRailCollapsed ? '»' : '«'}
            </span>
            {rightRailCollapsed && (
              <span className="app-right-rail__hinge-vlabel">Controls</span>
            )}
          </button>
          <div className="app-right-rail__panels">
        <div
          className="panel-focus-wrapper"
          style={{ position: 'relative', zIndex: focusedPanel === 'property' ? 1100 : 10 }}
          onMouseDown={(e) => handlePanelFocus('property', e)}
        >
          <PropertyPanel
            selectedComponent={selectedComponent}
            selectedConnection={selectedConnection}
            simulationMetadata={simulationMetadata}
            simulationColumns={simulationMetadata?.columns || []}
            ensembleColumnGroups={ensembleColumnGroups}
            derivedVariables={simulationMetadata?.derivedVariables || []}
            onAddDerivedVariable={handleAddDerivedVariable}
            onRemoveScenarioColumn={handleRemoveScenarioColumn}
            onRemoveEnsembleLiveDerived={handleRemoveEnsembleLiveDerived}
            canvasComponents={canvasComponents}
            onUpdateComponent={handleUpdateComponent}
            onUpdateConnection={handleUpdateConnection}
            onDeleteComponent={handleDeleteComponent}
            onDeleteConnection={handleDeleteConnection}
            onAddChartFromBuilder={handleAddChartFromBuilder}
            onClose={() => {
              setSelectedComponent(null);
              setSelectedConnection(null);
            }}
            disabled={mode === 'simulation'}
          />
        </div>

        {/* ================================================================
            SIMULATION CONTROLS PANEL
            ================================================================
            This is the control panel on the right side that shows buttons
            for triggering failures (like "Trip Turbine").
            
            PROPS WE'RE PASSING:
            - mode: Tells it if we're in 'design' or 'simulation' mode
            - selectedComponent: Which component the user clicked on
            - onTripComponent: A FUNCTION we're passing down (called a callback)
            - onRestartComponent: NEW! Function to bring components back online
            
            REACT CONCEPT - Passing Functions as Props:
            We pass handleTripComponent as a prop called "onTripComponent".
            This lets the child component (SimulationControls) call our
            function when the user clicks a button. It's like giving the
            child a phone number to call back to the parent.
            
            When the user clicks "Trip Turbine", this chain happens:
            1. SimulationControls calls onTripComponent(turbineId)
            2. That calls our handleTripComponent function here in App.js
            3. handleTripComponent updates the state
            4. React re-renders everything with the new state
            5. The turbine appears red on screen!
            
            When the user clicks "Restart Turbine", similar chain happens:
            1. SimulationControls calls onRestartComponent(turbineId)
            2. That calls our handleRestartComponent function here in App.js
            3. handleRestartComponent updates the state (offline → normal)
            4. React re-renders everything
            5. The turbine appears grey/normal on screen!
            When you click a simulation scenario (e.g. "Low-Voltage Ride-Through"), that scenario’s data and config are loaded. 
            To show clearly which scenario is active, the matching button in the Simulation Controls panel gets a bright “active” style (brighter gradient, glow). 
            The activeSimulationId prop is the ID of the loaded simulation and is passed from App to SimulationControls so the correct button can be styled.

        ================================================================ */}
        {/* STEP 2: Pass which simulation  (simulationMetadata?.id ) is currently loaded so the Controls panel can highlight that button.
            When the user clicks a scenario (e.g. "Low-Voltage Ride-Through"), simulationMetadata is set with its id.
            Passing activeSimulationId lets SimulationControls show a bright, glowing style on the active button
            so the user always knows which simulation they're viewing and editing charts for. */}
        <div
          className="panel-focus-wrapper"
          style={{ position: 'relative', zIndex: focusedPanel === 'simulation' ? 1100 : 10 }}
          onMouseDown={(e) => handlePanelFocus('simulation', e)}
        >
          {/*
            Ensemble: activeEnsembleId outlines member scenarios. Variable lists for charts are in PropertyPanel.
          */}
          <SimulationControls
            mode={mode}
            viewMode={viewMode}
            simulationRunning={simulationRunning}
            activeSimulationId={
              simulationMetadata?.isEnsemble ? null : (simulationMetadata?.id ?? null)
            }
            activeEnsembleId={simulationMetadata?.isEnsemble ? simulationMetadata.ensembleId : null}
            designEnsembles={designEnsembles}
            onSelectEnsemble={handleSelectEnsemble}
            onDeleteEnsemble={handleDeleteEnsemble}
            designApiPath={designApiPath}
            onRefreshDesignEnsembles={refreshDesignEnsembles}
            selectedComponent={selectedComponent}
            onTripComponent={handleTripComponent}
            onRestartComponent={handleRestartComponent}
            onOpenBreaker={handleOpenBreaker}
            onCloseBreaker={handleCloseBreaker}
            onTripBreaker={handleTripBreaker}
            onTripRandomTurbine={handleTripRandomTurbine}
            onTripAllTurbines={handleTripAllTurbines}
            onGridLoss={handleGridLoss}
            onOpenAllBreakers={handleOpenAllBreakers}
            onResetSystem={handleResetSystem}
            simulationTime={simulationTime}
            simulationSpeed={simulationSpeed}
            onSetSimulationSpeed={handleSetSimulationSpeed}
            availableSimulations={availableSimulations}
            simConfig={simConfig}
            onRunSimulation={handleRunSimulation}
            useDesignDir={!!csvStatus?.use_design_dir}
            currentConfigName={currentConfigName}
            onUploadSimData={handleUploadSimData}
            onDeleteSimulation={handleDeleteSimulation}
            onDeleteAllSimulations={handleDeleteAllSimulations}
            onClearSimulationCache={handleClearSimulationCache}
            onViewSimData={handleViewSimData}
            onAddSimulation={handleAddSimulation}
            onAddSimulationsFromXlsx={handleAddSimulationsFromXlsx}
            onAddSimulationsFromPkl={handleAddSimulationsFromPkl}
            onAddSimulationFromPkl2={handleAddSimulationFromPkl2}
            /* Drives the “Loading data” linear bar under the scenario list while handleRunSimulation runs. */
            simulationLoadProgress={simulationLoadProgress}
          />
        </div>
          </div>
        </div>
      </div>

      {/* Save/Load Dialog */}
      {showDialog && (
        <SaveLoadDialog
          mode={dialogMode}
          onClose={handleCloseDialog}
          onSave={handleConfigurationSaved}
          onLoad={handleConfigurationLoaded}
          getCurrentConfiguration={getCurrentConfiguration}
          currentConfiguration={getCurrentConfiguration()}
          currentConfigName={currentConfigName}
        />
      )}

      {/* STEP 4: Column picker – when user picks a chart type, choose X/Y from simulation CSV */}
      {columnPickerContext && (
        <ColumnPickerDialog
          key={`${columnPickerContext.component?.id}-${columnPickerContext.chartType}`}
          component={columnPickerContext.component}
          chartType={columnPickerContext.chartType}
          columns={simulationMetadata?.columns || []}
          csvName={simulationMetadata?.id ? `${simulationMetadata.id}.data.csv` : ''}
          onConfirm={handleColumnPickerConfirm}
          onClose={() => setColumnPickerContext(null)}
        />
      )}

      {connectionReadoutContext && (
        <ConnectionReadoutDialog
          key={connectionReadoutContext.id}
          component={connectionReadoutContext}
          simulationMetadata={simulationMetadata}
          ensembleColumnGroups={ensembleColumnGroups}
          onClose={() => setConnectionReadoutContext(null)}
          onSave={handleConnectionReadoutSave}
          onRemove={handleConnectionReadoutRemove}
        />
      )}

      {/* Chart Panel */}
      {openCharts.length > 0 && (
        <ChartPanel
          charts={openCharts}
          chartStacks={chartStacks}
          onStackCharts={handleStackCharts}
          onUnstackCharts={handleUnstackCharts}
          onClose={handleCloseChartPanel}
          onRemoveChart={handleRemoveChart}
          onUpdateChart={handleUpdateChart}
          height={chartPanelHeight}
          onHeightChange={handleChartPanelHeightChange}
          panelOpacity={chartPanelOpacity}
          onPanelOpacityChange={handleChartPanelOpacityChange}
          chartCardWidth={chartCardWidth}
          onChartCardWidthChange={handleChartCardWidthChange}
          onPerChartCardWidthChange={handlePerChartCardWidthChange}
          simulationTime={simulationTime}
          simulationRunning={simulationRunning}
          selectedComponentId={selectedComponent?.id}
          simulationData={simulationData}
          ensembleMemberSimulationData={ensembleMemberSimulationData}
          onEnsureEnsembleChartColumns={
            simulationMetadata?.isEnsemble ? onEnsureEnsembleChartColumns : undefined
          }
          simulationMetadata={simulationMetadata}
          eventMarkers={simConfig?.simulations?.[simulationMetadata?.id]?.event_markers}
          globalSampleStep={globalSampleStep}
          perChartSampleStep={perChartSampleStep}
          onGlobalSampleStepChange={(step) => {
            setGlobalSampleStep(step);
            if (simulationMetadata?.id && openCharts.length > 0) {
              persistChartsToSimJson(openCharts, { chart_sample_default: step });
            }
          }}
          onPerChartSampleStepChange={(chartId, step) => {
            setPerChartSampleStep(prev => {
              const next = { ...prev, [chartId]: step };
              if (simulationMetadata?.id && openCharts.length > 0) {
                persistChartsToSimJson(openCharts, { perChartSampleStep: next });
              }
              return next;
            });
          }}
          currentConfigName={currentConfigName}
          designCatalogPath={designApiPath}
          selectedRowIndices={selectedRowIndices}
          onSelectionChange={setSelectedRowIndices}
          onFocus={(e) => handlePanelFocus('charts', e)}
          isFocused={focusedPanel === 'charts'}
          namedSimulationConfigs={namedSimulationConfigs}
          activeNamedSimulationConfig={activeNamedSimulationConfig}
          lastNamedPresetForUi={lastNamedPresetForUi}
          onActivateNamedSimulationConfig={
            csvStatus?.use_design_dir && designApiPath ? handleActivateNamedSimulationConfig : undefined
          }
          onCopyNamedPresetLink={
            csvStatus?.use_design_dir && designApiPath ? handleCopyNamedPresetLink : undefined
          }
          onRequestMoreRows={
            useLazySimulationData && !simulationMetadata?.isEnsemble
              ? requestMoreSimulationRows
              : undefined
          }
          insetLeft={chartPanelLeftInset}
          insetRight={chartPanelRightInset}
        />
      )}

      <SaveSimulationConfigDialog
        open={saveSimConfigDialogOpen}
        existingNames={namedSimulationConfigs}
        onClose={() => setSaveSimConfigDialogOpen(false)}
        onSave={handleConfirmSaveSimulationConfig}
      />

      {/* Saving Spinner Overlay */}
      {isSaving && (
        <div className="saving-overlay">
          <div className="saving-spinner-container">
            <div className="saving-spinner"></div>
            <div className="saving-text">Saving Configuration...</div>
            <div className="saving-subtext">Please wait</div>
          </div>
        </div>
      )}

      {/* Derived variable commit — blocks until ensemble Parquet + DB import complete */}
      {derivedVariableCommitMessage && (
        <div
          className="saving-overlay derived-variable-commit-overlay"
          role="alertdialog"
          aria-busy="true"
          aria-live="polite"
        >
          <div className="saving-spinner-container">
            <div className="saving-spinner" />
            <div className="saving-text">{derivedVariableCommitMessage}</div>
            <div className="saving-subtext derived-variable-commit-hint">
              Wait until this finishes before building another formula that depends on this column — otherwise the prior variable may not exist on disk yet.
            </div>
          </div>
        </div>
      )}

      {/* Upload Spinner Overlay */}
      {isUploading && (
        <div className="saving-overlay">
          <div className="saving-spinner-container">
            <div className="saving-spinner"></div>
            <div className="saving-text">Uploading...</div>
            <div className="saving-subtext">Please wait</div>
          </div>
        </div>
      )}

      {/* View Data Modal */}
      {viewModal && (
        <ViewDataModal
          simName={viewModal.simName}
          displayName={viewModal.displayName}
          data={viewModal.data}
          loading={viewModal.loading}
          onClose={() => setViewModal(null)}
        />
      )}
    </div>
  );
}

export default App;
