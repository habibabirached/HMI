/**
 * COMPONENT VISUAL METADATA
 * 
 * Defines dimensions, icons, and visual properties for each component type
 * Used by Canvas.jsx to render components with proper sizing and symbols
 * 
 * Dimensions based on typical aspect ratios:
 * - Generators/Turbines: Wider than tall (horizontal equipment)
 * - Buses: Very wide, thin (electrical bars)
 * - Breakers: Square or slightly tall (compact devices)
 * - Transformers: Square (tank-like)
 * - Loads: Square or wide (rooms/equipment)
 * - Wind Turbines: Tall (vertical tower)
 * - Solar: Wide (panel arrays)
 */

export const COMPONENT_VISUAL_CONFIG = {
  // ============================================================================
  // GENERATION - Prime Movers (Wide, horizontal cylinders)
  // ============================================================================
  'gas-turbine-lm2500': {
    width: 140,
    height: 80,
    icon: '⚙️',
    color: '#ff9800',
    shape: 'rounded-rect'
  },
  'gas-turbine-lm2500-andritz': {
    width: 150,
    height: 85,
    icon: '⚙️',
    color: '#ff9800',
    shape: 'rounded-rect'
  },
  'gas-turbine-lm2500-plus': {
    width: 145,
    height: 80,
    icon: '⚙️',
    color: '#ff9800',
    shape: 'rounded-rect'
  },
  'gas-turbine-lm6000': {
    width: 160,
    height: 90,
    icon: '⚙️',
    color: '#ff5722',
    shape: 'rounded-rect'
  },
  'gas-turbine-7h': {
    width: 200,
    height: 110,
    icon: '⚙️',
    color: '#ff5722',
    shape: 'rounded-rect'
  },
  'gas-turbine-9ha': {
    width: 220,
    height: 120,
    icon: '⚙️',
    color: '#ff5722',
    shape: 'rounded-rect'
  },
  'steam-turbine': {
    width: 160,
    height: 90,
    icon: '♨️',
    color: '#9c27b0',
    shape: 'rounded-rect'
  },
  'diesel-generator': {
    width: 120,
    height: 70,
    icon: '🔧',
    color: '#795548',
    shape: 'rounded-rect'
  },
  'gas-turbine-1mw': {
    width: 100,
    height: 60,
    icon: '⚙️',
    color: '#ff9800',
    shape: 'rounded-rect'
  },
  'gas-turbine-5mw': {
    width: 120,
    height: 70,
    icon: '⚙️',
    color: '#ff9800',
    shape: 'rounded-rect'
  },
  'gas-turbine-10mw': {
    width: 140,
    height: 100,
    icon: '⚙️',
    color: '#ff9800',
    shape: 'rounded-rect'
  },
  'recip-gas-engine': {
    width: 120,
    height: 70,
    icon: '🔩',
    color: '#607d8b',
    shape: 'rounded-rect'
  },
  'fuel-cell': {
    width: 90,
    height: 70,
    icon: '⚡',
    color: '#005E60',
    shape: 'rounded-rect'
  },
  'microturbine': {
    width: 80,
    height: 60,
    icon: '⚙️',
    color: '#ff9800',
    shape: 'rounded-rect'
  },

  // ============================================================================
  // RENEWABLE GENERATION (Unique shapes)
  // ============================================================================
  'wind-turbine-type3': {
    width: 90,
    height: 140,  // TALL (vertical tower with blades)
    icon: '🌀',
    color: '#03a9f4',
    shape: 'tall-rect'
  },
  'wind-turbine-type4': {
    width: 100,
    height: 150,  // TALL
    icon: '🌀',
    color: '#03a9f4',
    shape: 'tall-rect'
  },
  'solar-pv': {
    width: 140,
    height: 70,  // WIDE (horizontal panel arrays)
    icon: '☀️',
    color: '#ffc107',
    shape: 'wide-rect'
  },

  // ============================================================================
  // ELECTRICAL MACHINES (Square)
  // ============================================================================
  'generator-sync': {
    width: 100,
    height: 100,
    icon: 'G',
    color: '#4caf50',
    shape: 'circle'
  },
  'motor-large': {
    width: 90,
    height: 90,
    icon: 'M',
    color: '#2196f3',
    shape: 'circle'
  },
  'shaft-coupling': {
    width: 60,
    height: 40,
    icon: '═',
    color: '#9e9e9e',
    shape: 'rect'
  },

  // ============================================================================
  // ENERGY STORAGE (Various sizes)
  // ============================================================================
  'bess': {
    width: 110,
    height: 80,
    icon: '🔋',
    color: '#4caf50',
    shape: 'rounded-rect'
  },
  'bess-30mw': {
    width: 130,
    height: 90,
    icon: '🔋',
    color: '#4caf50',
    shape: 'rounded-rect'
  },
  'bess-50mw': {
    width: 150,
    height: 100,
    icon: '🔋',
    color: '#4caf50',
    shape: 'rounded-rect'
  },
  'battery-rack': {
    width: 80,
    height: 100,  // Tall rack
    icon: '🔋',
    color: '#4caf50',
    shape: 'tall-rect'
  },
  'battery-container': {
    width: 120,
    height: 80,
    icon: '🔋',
    color: '#4caf50',
    shape: 'rounded-rect'
  },
  'flywheel': {
    width: 80,
    height: 80,
    icon: '⊚',
    color: '#673ab7',
    shape: 'circle'
  },
  'supercapacitor': {
    width: 70,
    height: 70,
    icon: '⊢⊣',
    color: '#005E60',
    shape: 'rect'
  },
  'hydrogen-storage': {
    width: 100,
    height: 120,  // Tall tank
    icon: 'H₂',
    color: '#03a9f4',
    shape: 'tall-rect'
  },
  'thermal-storage': {
    width: 100,
    height: 100,
    icon: '♨️',
    color: '#ff5722',
    shape: 'rounded-rect'
  },

  // ============================================================================
  // POWER ELECTRONICS (Square, compact)
  // ============================================================================
  'ups': {
    width: 90,
    height: 70,
    icon: '🔌',
    color: '#9c27b0',
    shape: 'rounded-rect'
  },
  'ups-large': {
    width: 110,
    height: 80,
    icon: '🔌',
    color: '#9c27b0',
    shape: 'rounded-rect'
  },
  'rectifier': {
    width: 80,
    height: 60,
    icon: '⏵',
    color: '#673ab7',
    shape: 'rect'
  },
  'inverter': {
    width: 80,
    height: 60,
    icon: '⏴',
    color: '#673ab7',
    shape: 'rect'
  },
  'sst': {
    width: 90,
    height: 70,
    icon: '⚡',
    color: '#005E60',
    shape: 'rounded-rect'
  },
  'dcdc-converter': {
    width: 70,
    height: 60,
    icon: '⇄',
    color: '#607d8b',
    shape: 'rect'
  },
  'acdc-converter': {
    width: 70,
    height: 60,
    icon: '→',
    color: '#607d8b',
    shape: 'rect'
  },
  'dcac-converter': {
    width: 70,
    height: 60,
    icon: '←',
    color: '#607d8b',
    shape: 'rect'
  },

  // ============================================================================
  // TRANSFORMERS (Square, tank-like)
  // ============================================================================
  'gsu-transformer': {
    width: 90,
    height: 90,
    icon: '⚡↑',
    color: '#795548',
    shape: 'rounded-rect'
  },
  // Palette / saved configs use short type `gsu` (matches componentLibrary)
  gsu: {
    width: 90,
    height: 90,
    icon: '⚡↑',
    color: '#795548',
    shape: 'rounded-rect'
  },
  'bess-transformer': {
    width: 95,
    height: 95,
    icon: '⚡⚡',
    color: '#795548',
    shape: 'rounded-rect'
  },
  'bess-xfmr': {
    width: 95,
    height: 95,
    icon: '⚡⚡',
    color: '#795548',
    shape: 'rounded-rect'
  },
  'datacenter-transformer': {
    width: 90,
    height: 90,
    icon: '⚡↓',
    color: '#795548',
    shape: 'rounded-rect'
  },
  'dc-xfmr': {
    width: 90,
    height: 90,
    icon: '⚡↓',
    color: '#795548',
    shape: 'rounded-rect'
  },
  'stepdown-transformer': {
    width: 85,
    height: 85,
    icon: '⚡↓',
    color: '#795548',
    shape: 'rounded-rect'
  },
  'isolation-transformer': {
    width: 80,
    height: 80,
    icon: '⚡║',
    color: '#795548',
    shape: 'rounded-rect'
  },
  'auto-transformer': {
    width: 85,
    height: 85,
    icon: '⚡⟲',
    color: '#795548',
    shape: 'rounded-rect'
  },
  'distribution-transformer': {
    width: 70,
    height: 70,
    icon: '⚡↓',
    color: '#795548',
    shape: 'rounded-rect'
  },

  // ============================================================================
  // SWITCHGEAR & PROTECTION (Small, compact)
  // ============================================================================
  'breaker-hv': {
    width: 60,
    height: 70,
    icon: '⏚',
    color: '#f44336',
    shape: 'rect'
  },
  'breaker-mv': {
    width: 55,
    height: 65,
    icon: '⏚',
    color: '#ff5722',
    shape: 'rect'
  },
  'breaker-lv': {
    width: 65,
    height: 60,
    icon: '⏚',
    color: '#ff9800',
    shape: 'rect'
  },
  'breaker-dc': {
    width: 50,
    height: 60,
    icon: '⏚',
    color: '#ff9800',
    shape: 'rect'
  },
  'breaker-bess': {
    width: 55,
    height: 65,
    icon: '⏚',
    color: '#f44336',
    shape: 'rect'
  },
  'breaker-gen-13.8': {
    width: 50,
    height: 60,
    icon: '⏚',
    color: '#ff9800',
    shape: 'rect'
  },
  'breaker-gen': {
    width: 50,
    height: 60,
    icon: '⏚',
    color: '#ff9800',
    shape: 'rect'
  },
  'line-resistor': {
    width: 56,
    height: 36,
    icon: '⌇',
    color: '#ffc107',
    shape: 'rounded-rect'
  },
  'disconnect-switch': {
    width: 45,
    height: 55,
    icon: '╱',
    color: '#9e9e9e',
    shape: 'rect'
  },
  'bus-tie-breaker': {
    width: 55,
    height: 65,
    icon: '⏚',
    color: '#ff5722',
    shape: 'rect'
  },
  'tie-breaker-network': {
    width: 140,
    height: 90,
    icon: '⟷',
    color: '#4caf50',
    shape: 'rounded-rect'
  },
  'recloser': {
    width: 50,
    height: 60,
    icon: '⟲',
    color: '#ff9800',
    shape: 'rect'
  },
  'protection-relay': {
    width: 40,
    height: 50,
    icon: '🛡️',
    color: '#607d8b',
    shape: 'rect'
  },
  'fuse': {
    width: 35,
    height: 45,
    icon: '╳',
    color: '#9e9e9e',
    shape: 'rect'
  },

  // ============================================================================
  // MEASUREMENT (Small, square)
  // ============================================================================
  'current-transformer': {
    width: 50,
    height: 50,
    icon: 'CT',
    color: '#005E60',
    shape: 'circle'
  },
  ct: {
    width: 50,
    height: 50,
    icon: 'CT',
    color: '#005E60',
    shape: 'circle'
  },
  'current-transformer-800': {
    width: 50,
    height: 50,
    icon: 'CT',
    color: '#005E60',
    shape: 'circle'
  },
  'current-transformer-1500': {
    width: 55,
    height: 55,
    icon: 'CT',
    color: '#005E60',
    shape: 'circle'
  },
  'current-transformer-2000': {
    width: 60,
    height: 60,
    icon: 'CT',
    color: '#005E60',
    shape: 'circle'
  },
  'voltage-transformer': {
    width: 50,
    height: 50,
    icon: 'VT',
    color: '#005E60',
    shape: 'circle'
  },
  'power-meter': {
    width: 55,
    height: 55,
    icon: '📊',
    color: '#4caf50',
    shape: 'rect'
  },
  'frequency-meter': {
    width: 50,
    height: 50,
    icon: 'Hz',
    color: '#4caf50',
    shape: 'rect'
  },
  'pmu': {
    width: 60,
    height: 60,
    icon: '📡',
    color: '#005E60',
    shape: 'rect'
  },

  // ============================================================================
  // BUSES (Very wide, thin bars)
  // ============================================================================
  'bus-knot': {
    width: 24,
    height: 24,
    icon: '',
    color: '#b0b0b0',
    shape: 'circle'
  },
  'bus-main': {
    width: 200,
    height: 40,  // WIDE, thin (electrical bar)
    icon: '═══',
    color: '#ffeb3b',
    shape: 'bus-bar'
  },
  'bus-hv': {
    width: 200,
    height: 40,
    icon: '═══',
    color: '#f44336',
    shape: 'bus-bar'
  },
  'bus-hv-vertical': {
    width: 40,
    height: 200,
    icon: '║',
    color: '#f44336',
    shape: 'bus-bar-vertical'
  },
  'bus-mv': {
    width: 180,
    height: 40,
    icon: '═══',
    color: '#ff9800',
    shape: 'bus-bar'
  },
  'bus-lv': {
    width: 160,
    height: 35,
    icon: '═══',
    color: '#ffc107',
    shape: 'bus-bar'
  },
  'bus-dc': {
    width: 160,
    height: 35,
    icon: '───',
    color: '#005E60',
    shape: 'bus-bar'
  },
  'bus-ring': {
    width: 120,
    height: 120,
    icon: '⭕',
    color: '#ff9800',
    shape: 'circle'
  },
  'bus-sectional': {
    width: 160,
    height: 40,
    icon: '═╪═',
    color: '#ff9800',
    shape: 'bus-bar'
  },

  // ============================================================================
  // GRID / EXTERNAL INTERFACES
  // ============================================================================
  'utility-grid': {
    width: 110,
    height: 90,
    icon: '⚡',
    color: '#4caf50',
    shape: 'hexagon'
  },
  'backup-grid': {
    width: 100,
    height: 85,
    icon: '⚡',
    color: '#ff9800',
    shape: 'hexagon'
  },
  'islanding-point': {
    width: 65,
    height: 65,
    icon: '⊗',
    color: '#9c27b0',
    shape: 'circle'
  },
  'pcc': {
    width: 70,
    height: 70,
    icon: '⊕',
    color: '#005E60',
    shape: 'circle'
  },
  'microgrid-controller': {
    width: 90,
    height: 70,
    icon: '⚙️',
    color: '#673ab7',
    shape: 'rounded-rect'
  },

  // ============================================================================
  // LOADS (Wide blocks - rooms/buildings)
  // ============================================================================
  'datacenter-load': {
    width: 140,
    height: 90,
    icon: '🖥️',
    color: '#2196f3',
    shape: 'rounded-rect'
  },
  'data-hall': {
    width: 130,
    height: 85,
    icon: '🖥️',
    color: '#2196f3',
    shape: 'rounded-rect'
  },
  'it-load': {
    width: 120,
    height: 80,
    icon: '💻',
    color: '#2196f3',
    shape: 'rounded-rect'
  },
  'it-rack-load': {
    width: 70,
    height: 100,  // Tall rack
    icon: '⫾',
    color: '#2196f3',
    shape: 'tall-rect'
  },
  'cooling-plant': {
    width: 130,
    height: 90,
    icon: '❄️',
    color: '#005E60',
    shape: 'rounded-rect'
  },
  'hvac-load': {
    width: 110,
    height: 80,
    icon: '❄️',
    color: '#005E60',
    shape: 'rounded-rect'
  },
  'auxiliary-loads': {
    width: 110,
    height: 70,
    icon: '⚙️',
    color: '#9e9e9e',
    shape: 'rounded-rect'
  },
  'critical-load': {
    width: 130,
    height: 85,
    icon: '⚠️',
    color: '#f44336',
    shape: 'rounded-rect'
  },
  'noncritical-load': {
    width: 120,
    height: 75,
    icon: '○',
    color: '#9e9e9e',
    shape: 'rounded-rect'
  },

  // ============================================================================
  // CONTROL & LOGIC (Small rectangles)
  // ============================================================================
  'plant-controller': {
    width: 90,
    height: 60,
    icon: '🎛️',
    color: '#673ab7',
    shape: 'rounded-rect'
  },
  'ems': {
    width: 95,
    height: 65,
    icon: '📊',
    color: '#673ab7',
    shape: 'rounded-rect'
  },
  'load-shed-ctrl': {
    width: 85,
    height: 60,
    icon: '⚡',
    color: '#ff5722',
    shape: 'rounded-rect'
  },
  'black-start-ctrl': {
    width: 85,
    height: 60,
    icon: '▶️',
    color: '#4caf50',
    shape: 'rounded-rect'
  },
  'protection-logic': {
    width: 80,
    height: 60,
    icon: '🛡️',
    color: '#607d8b',
    shape: 'rounded-rect'
  },

  // ============================================================================
  // STRUCTURAL (Large grouping boxes)
  // ============================================================================
  'power-block': {
    width: 180,
    height: 140,
    icon: '⚡',
    color: '#455a64',
    shape: 'dashed-rect'
  },
  'substation': {
    width: 200,
    height: 150,
    icon: '⚡',
    color: '#546e7a',
    shape: 'dashed-rect'
  },
  'plant-boundary': {
    width: 250,
    height: 180,
    icon: '◻',
    color: '#607d8b',
    shape: 'dashed-rect'
  },
  'datacenter-boundary': {
    width: 220,
    height: 160,
    icon: '🏢',
    color: '#455a64',
    shape: 'dashed-rect'
  },
  'container-group': {
    width: 160,
    height: 120,
    icon: '◻',
    color: '#546e7a',
    shape: 'dashed-rect'
  }
};

/**
 * Get visual configuration for a component type
 * Returns default if type not found
 */
export const getComponentVisualConfig = (componentType) => {
  return COMPONENT_VISUAL_CONFIG[componentType] || {
    width: 100,
    height: 80,
    icon: '?',
    color: '#9e9e9e',
    shape: 'rounded-rect'
  };
};

/**
 * SVG Icon Paths for Professional Electrical Symbols
 * Based on IEEE/IEC standards for one-line diagrams
 */
export const COMPONENT_SVG_ICONS = {
  // Generator symbol (circle with sine wave)
  generator: `
    <circle cx="50" cy="50" r="35" fill="none" stroke="currentColor" stroke-width="2"/>
    <path d="M 25 50 Q 35 35, 45 50 T 65 50 T 85 50" fill="none" stroke="currentColor" stroke-width="2"/>
  `,
  
  // Motor symbol (circle with M)
  motor: `
    <circle cx="50" cy="50" r="35" fill="none" stroke="currentColor" stroke-width="2"/>
    <text x="50" y="62" text-anchor="middle" font-size="32" font-weight="bold" fill="currentColor">M</text>
  `,
  
  // Transformer symbol (two circles with line)
  transformer: `
    <circle cx="35" cy="50" r="20" fill="none" stroke="currentColor" stroke-width="2"/>
    <circle cx="65" cy="50" r="20" fill="none" stroke="currentColor" stroke-width="2"/>
    <line x1="50" y1="25" x2="50" y2="75" stroke="currentColor" stroke-width="2"/>
  `,
  
  // Circuit breaker symbol (square with break)
  breaker: `
    <rect x="20" y="20" width="60" height="60" fill="none" stroke="currentColor" stroke-width="2" rx="5"/>
    <line x1="35" y1="50" x2="45" y2="50" stroke="currentColor" stroke-width="3"/>
    <line x1="55" y1="50" x2="65" y2="50" stroke="currentColor" stroke-width="3"/>
    <circle cx="50" cy="50" r="4" fill="currentColor"/>
  `,
  
  // Bus symbol (thick horizontal bar)
  bus: `
    <rect x="10" y="40" width="80" height="20" fill="currentColor" stroke="currentColor" stroke-width="2" rx="3"/>
  `,
  
  // Battery symbol (+ -)
  battery: `
    <rect x="25" y="15" width="50" height="70" fill="none" stroke="currentColor" stroke-width="2" rx="8"/>
    <line x1="30" y1="25" x2="45" y2="25" stroke="currentColor" stroke-width="3"/>
    <line x1="37.5" y1="17.5" x2="37.5" y2="32.5" stroke="currentColor" stroke-width="3"/>
    <line x1="55" y1="70" x2="70" y2="70" stroke="currentColor" stroke-width="3"/>
  `,
  
  // Solar panel symbol (grid)
  solar: `
    <rect x="15" y="25" width="70" height="50" fill="none" stroke="currentColor" stroke-width="2" rx="3"/>
    <line x1="15" y1="50" x2="85" y2="50" stroke="currentColor" stroke-width="1"/>
    <line x1="50" y1="25" x2="50" y2="75" stroke="currentColor" stroke-width="1"/>
    <path d="M 30 10 L 50 25 L 70 10" fill="none" stroke="currentColor" stroke-width="2"/>
  `,
  
  // Wind turbine symbol (tower with blades)
  wind: `
    <rect x="45" y="30" width="10" height="55" fill="currentColor" stroke="currentColor" stroke-width="1"/>
    <polygon points="50,25 30,15 50,20" fill="currentColor"/>
    <polygon points="50,25 60,5 55,20" fill="currentColor"/>
    <polygon points="50,25 70,20 55,22" fill="currentColor"/>
    <circle cx="50" cy="25" r="5" fill="currentColor"/>
  `,
  
  // Grid/utility symbol (hexagon with lightning)
  grid: `
    <polygon points="50,15 75,30 75,60 50,75 25,60 25,30" fill="none" stroke="currentColor" stroke-width="2"/>
    <path d="M 50 35 L 45 50 L 55 50 L 50 65" fill="currentColor" stroke="currentColor" stroke-width="1"/>
  `,
  
  // UPS symbol (rectangle with wave)
  ups: `
    <rect x="20" y="25" width="60" height="50" fill="none" stroke="currentColor" stroke-width="2" rx="5"/>
    <path d="M 30 50 Q 40 40, 50 50 T 70 50" fill="none" stroke="currentColor" stroke-width="2"/>
    <circle cx="50" cy="35" r="3" fill="currentColor"/>
  `,
  
  // Load symbol (zigzag resistor)
  load: `
    <path d="M 20 50 L 30 35 L 40 65 L 50 35 L 60 65 L 70 35 L 80 50" fill="none" stroke="currentColor" stroke-width="2.5"/>
  `
};

/**
 * Helper function to get component dimensions
 */
export const getComponentDimensions = (componentType) => {
  const config = getComponentVisualConfig(componentType);
  return {
    width: config.width,
    height: config.height
  };
};

/**
 * Helper function to get component center offset
 * Used for positioning text and connections
 */
export const getComponentCenter = (componentType) => {
  const dims = getComponentDimensions(componentType);
  return {
    x: dims.width / 2,
    y: dims.height / 2
  };
};
