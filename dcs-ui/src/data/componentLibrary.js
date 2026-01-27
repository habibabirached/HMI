// Component Library Definition
// This is the complete arsenal of power system components

export const COMPONENT_CATEGORIES = {
  GENERATION: 'Generation - Prime Movers',
  ELECTRICAL_MACHINES: 'Electrical Machines',
  ENERGY_STORAGE: 'Energy Storage',
  POWER_ELECTRONICS: 'Power Electronics / Conversion',
  TRANSFORMERS: 'Transformers',
  SWITCHGEAR: 'Switchgear & Protection',
  MEASUREMENT: 'Measurement & Instrumentation',
  BUSES: 'Buses & Electrical Nodes',
  GRID: 'Grid / External Interfaces',
  LOADS: 'Loads',
  CONTROL: 'Control & Logic',
  STRUCTURAL: 'Structural / Grouping'
};

export const COMPONENT_LIBRARY = [
  // A) Generation - Prime Movers
  {
    category: COMPONENT_CATEGORIES.GENERATION,
    components: [
      { id: 'gas-turbine-lm2500', name: 'LM2500', fullName: 'Gas Turbine LM2500', type: 'aeroderivative', rating: 25, voltage: 13.8, unit: 'MW' },
      { id: 'gas-turbine-lm2500-plus', name: 'LM2500+', fullName: 'Gas Turbine LM2500+ / Xpress', type: 'aeroderivative', rating: 30, voltage: 13.8, unit: 'MW' },
      { id: 'gas-turbine-lm6000', name: 'LM6000', fullName: 'Gas Turbine LM6000', type: 'aeroderivative', rating: 45, voltage: 13.8, unit: 'MW' },
      { id: 'gas-turbine-7h', name: '7H / 7HA', fullName: 'Gas Turbine 7H / 7HA', type: 'heavy-duty', rating: 300, voltage: 18, unit: 'MW' },
      { id: 'gas-turbine-9ha', name: '9HA', fullName: 'Gas Turbine 9HA', type: 'heavy-duty', rating: 450, voltage: 22, unit: 'MW' },
      { id: 'steam-turbine', name: 'Steam Turbine', fullName: 'Steam Turbine', type: 'steam', rating: 100, voltage: 13.8, unit: 'MW' },
      { id: 'diesel-generator', name: 'Diesel Gen', fullName: 'Diesel Generator', type: 'diesel', rating: 2, voltage: 0.48, unit: 'MW' },
      { id: 'recip-gas-engine', name: 'Gas Engine', fullName: 'Reciprocating Gas Engine', type: 'reciprocating', rating: 10, voltage: 0.48, unit: 'MW' },
      { id: 'fuel-cell', name: 'Fuel Cell', fullName: 'Fuel Cell (Containerized)', type: 'fuel-cell', rating: 1, voltage: 0.48, unit: 'MW' },
      { id: 'wind-turbine-type3', name: 'Wind Type III', fullName: 'Wind Turbine Type III', type: 'wind', rating: 3, voltage: 0.69, unit: 'MW' },
      { id: 'wind-turbine-type4', name: 'Wind Type IV', fullName: 'Wind Turbine Type IV', type: 'wind', rating: 5, voltage: 0.69, unit: 'MW' },
      { id: 'solar-pv', name: 'Solar PV', fullName: 'Solar PV Array', type: 'solar', rating: 2, voltage: 0.48, unit: 'MW' },
      { id: 'microturbine', name: 'Microturbine', fullName: 'Microturbine', type: 'microturbine', rating: 0.2, voltage: 0.48, unit: 'MW' }
    ]
  },
  
  // B) Electrical Machines
  {
    category: COMPONENT_CATEGORIES.ELECTRICAL_MACHINES,
    components: [
      { id: 'generator-sync', name: 'Generator', fullName: 'Synchronous Generator', type: 'generator', rating: 30, voltage: 13.8, unit: 'MVA' },
      { id: 'motor-large', name: 'Motor', fullName: 'Motor (Large Auxiliary)', type: 'motor', rating: 5, voltage: 4.16, unit: 'MW' },
      { id: 'shaft-coupling', name: 'Shaft', fullName: 'Generator Shaft / Coupling', type: 'shaft', rating: 0, voltage: 0, unit: '' }
    ]
  },
  
  // C) Energy Storage
  {
    category: COMPONENT_CATEGORIES.ENERGY_STORAGE,
    components: [
      { id: 'bess', name: 'BESS', fullName: 'Battery Energy Storage System', type: 'battery', rating: 10, voltage: 0.48, unit: 'MWh' },
      { id: 'battery-rack', name: 'Battery Rack', fullName: 'Battery Rack', type: 'battery', rating: 1, voltage: 0.48, unit: 'MWh' },
      { id: 'battery-container', name: 'Battery Container', fullName: 'Battery Container', type: 'battery', rating: 5, voltage: 0.48, unit: 'MWh' },
      { id: 'flywheel', name: 'Flywheel', fullName: 'Flywheel Energy Storage', type: 'flywheel', rating: 0.5, voltage: 0.48, unit: 'MWh' },
      { id: 'supercapacitor', name: 'Supercapacitor', fullName: 'Supercapacitor', type: 'capacitor', rating: 0.1, voltage: 0.48, unit: 'MWh' },
      { id: 'hydrogen-storage', name: 'H2 Storage', fullName: 'Hydrogen Storage', type: 'hydrogen', rating: 50, voltage: 0, unit: 'MWh' },
      { id: 'thermal-storage', name: 'Thermal Storage', fullName: 'Thermal Energy Storage', type: 'thermal', rating: 20, voltage: 0, unit: 'MWh' }
    ]
  },
  
  // D) Power Electronics / Conversion
  {
    category: COMPONENT_CATEGORIES.POWER_ELECTRONICS,
    components: [
      { id: 'ups', name: 'UPS', fullName: 'Uninterruptible Power Supply', type: 'ups', rating: 1, voltage: 0.48, unit: 'MVA' },
      { id: 'rectifier', name: 'Rectifier', fullName: 'AC-DC Rectifier', type: 'rectifier', rating: 2, voltage: 0.48, unit: 'MW' },
      { id: 'inverter', name: 'Inverter', fullName: 'DC-AC Inverter', type: 'inverter', rating: 2, voltage: 0.48, unit: 'MW' },
      { id: 'sst', name: 'SST', fullName: 'Solid-State Transformer', type: 'sst', rating: 10, voltage: 4.16, unit: 'MVA' },
      { id: 'dcdc-converter', name: 'DC-DC Conv', fullName: 'DC-DC Converter', type: 'dcdc', rating: 1, voltage: 0, unit: 'MW' },
      { id: 'acdc-converter', name: 'AC-DC Conv', fullName: 'AC-DC Converter', type: 'acdc', rating: 2, voltage: 0.48, unit: 'MW' },
      { id: 'dcac-converter', name: 'DC-AC Conv', fullName: 'DC-AC Converter', type: 'dcac', rating: 2, voltage: 0.48, unit: 'MW' }
    ]
  },
  
  // E) Transformers
  {
    category: COMPONENT_CATEGORIES.TRANSFORMERS,
    components: [
      { id: 'gsu-transformer', name: 'GSU Xfmr', fullName: 'Generator Step-Up Transformer', type: 'gsu', rating: 35, primary: 13.8, secondary: 34.5, unit: 'MVA' },
      { id: 'stepdown-transformer', name: 'Step-Down Xfmr', fullName: 'Step-Down Transformer', type: 'stepdown', rating: 25, primary: 34.5, secondary: 4.16, unit: 'MVA' },
      { id: 'isolation-transformer', name: 'Iso Xfmr', fullName: 'Isolation Transformer', type: 'isolation', rating: 10, primary: 0.48, secondary: 0.48, unit: 'MVA' },
      { id: 'auto-transformer', name: 'Auto Xfmr', fullName: 'Auto-Transformer', type: 'auto', rating: 20, primary: 34.5, secondary: 13.8, unit: 'MVA' },
      { id: 'distribution-transformer', name: 'Dist Xfmr', fullName: 'Distribution Transformer', type: 'distribution', rating: 2, primary: 4.16, secondary: 0.48, unit: 'MVA' }
    ]
  },
  
  // F) Switchgear & Protection
  {
    category: COMPONENT_CATEGORIES.SWITCHGEAR,
    components: [
      { id: 'breaker-hv', name: 'HV Breaker', fullName: 'High Voltage Circuit Breaker', type: 'breaker-hv', rating: 3000, voltage: 34.5, unit: 'A' },
      { id: 'breaker-mv', name: 'MV Breaker', fullName: 'Medium Voltage Circuit Breaker', type: 'breaker-mv', rating: 2000, voltage: 4.16, unit: 'A' },
      { id: 'breaker-lv', name: 'LV Breaker', fullName: 'Low Voltage Circuit Breaker', type: 'breaker-lv', rating: 4000, voltage: 0.48, unit: 'A' },
      { id: 'disconnect-switch', name: 'Disconnect', fullName: 'Disconnect Switch', type: 'disconnect', rating: 1200, voltage: 13.8, unit: 'A' },
      { id: 'bus-tie-breaker', name: 'Bus Tie Bkr', fullName: 'Bus Tie Breaker', type: 'bus-tie', rating: 2000, voltage: 4.16, unit: 'A' },
      { id: 'recloser', name: 'Recloser', fullName: 'Automatic Recloser', type: 'recloser', rating: 800, voltage: 13.8, unit: 'A' },
      { id: 'protection-relay', name: 'Relay', fullName: 'Protection Relay', type: 'relay', rating: 0, voltage: 0, unit: '' },
      { id: 'fuse', name: 'Fuse', fullName: 'Fuse', type: 'fuse', rating: 100, voltage: 0.48, unit: 'A' }
    ]
  },
  
  // G) Measurement & Instrumentation
  {
    category: COMPONENT_CATEGORIES.MEASUREMENT,
    components: [
      { id: 'current-transformer', name: 'CT', fullName: 'Current Transformer', type: 'ct', rating: 0, voltage: 0, unit: '' },
      { id: 'voltage-transformer', name: 'VT / PT', fullName: 'Voltage / Potential Transformer', type: 'vt', rating: 0, voltage: 0, unit: '' },
      { id: 'power-meter', name: 'Meter', fullName: 'Power / Energy Meter', type: 'meter', rating: 0, voltage: 0, unit: '' },
      { id: 'frequency-meter', name: 'Freq Meter', fullName: 'Frequency Meter', type: 'freq-meter', rating: 0, voltage: 0, unit: '' },
      { id: 'pmu', name: 'PMU', fullName: 'Phasor Measurement Unit', type: 'pmu', rating: 0, voltage: 0, unit: '' }
    ]
  },
  
  // H) Buses & Electrical Nodes
  {
    category: COMPONENT_CATEGORIES.BUSES,
    components: [
      { id: 'bus-hv', name: 'HV Bus', fullName: 'High Voltage Bus', type: 'bus-hv', rating: 0, voltage: 34.5, unit: 'kV' },
      { id: 'bus-mv', name: 'MV Bus', fullName: 'Medium Voltage Bus', type: 'bus-mv', rating: 0, voltage: 4.16, unit: 'kV' },
      { id: 'bus-lv', name: 'LV Bus', fullName: 'Low Voltage Bus', type: 'bus-lv', rating: 0, voltage: 0.48, unit: 'kV' },
      { id: 'bus-dc', name: 'DC Bus', fullName: 'DC Bus', type: 'bus-dc', rating: 0, voltage: 0.8, unit: 'kV' },
      { id: 'bus-ring', name: 'Ring Bus', fullName: 'Ring Bus', type: 'bus-ring', rating: 0, voltage: 13.8, unit: 'kV' },
      { id: 'bus-sectional', name: 'Sectional Bus', fullName: 'Sectionalized Bus', type: 'bus-sectional', rating: 0, voltage: 4.16, unit: 'kV' }
    ]
  },
  
  // I) Grid / External Interfaces
  {
    category: COMPONENT_CATEGORIES.GRID,
    components: [
      { id: 'utility-grid', name: 'Utility Grid', fullName: 'Utility Grid Connection', type: 'utility', rating: 100, voltage: 34.5, unit: 'MW' },
      { id: 'backup-grid', name: 'Backup Grid', fullName: 'Backup Grid', type: 'backup', rating: 50, voltage: 34.5, unit: 'MW' },
      { id: 'islanding-point', name: 'Island Point', fullName: 'Islanding Point', type: 'island', rating: 0, voltage: 0, unit: '' },
      { id: 'pcc', name: 'PCC', fullName: 'Point of Common Coupling', type: 'pcc', rating: 0, voltage: 34.5, unit: '' },
      { id: 'microgrid-controller', name: 'µGrid Ctrl', fullName: 'Microgrid Controller', type: 'microgrid-ctrl', rating: 0, voltage: 0, unit: '' }
    ]
  },
  
  // J) Loads
  {
    category: COMPONENT_CATEGORIES.LOADS,
    components: [
      { id: 'datacenter-load', name: 'DC Load', fullName: 'Data Center Load', type: 'datacenter', rating: 50, voltage: 0.48, unit: 'MW' },
      { id: 'data-hall', name: 'Data Hall', fullName: 'Data Hall', type: 'data-hall', rating: 10, voltage: 0.48, unit: 'MW' },
      { id: 'it-load', name: 'IT Load', fullName: 'IT Load', type: 'it-load', rating: 30, voltage: 0.48, unit: 'MW' },
      { id: 'cooling-plant', name: 'Cooling', fullName: 'Cooling Plant', type: 'cooling', rating: 15, voltage: 0.48, unit: 'MW' },
      { id: 'auxiliary-loads', name: 'Aux Loads', fullName: 'Auxiliary Loads', type: 'auxiliary', rating: 5, voltage: 0.48, unit: 'MW' },
      { id: 'critical-load', name: 'Critical Load', fullName: 'Critical Load Block', type: 'critical', rating: 20, voltage: 0.48, unit: 'MW' },
      { id: 'noncritical-load', name: 'Non-Crit Load', fullName: 'Non-Critical Load Block', type: 'non-critical', rating: 10, voltage: 0.48, unit: 'MW' }
    ]
  },
  
  // K) Control & Logic
  {
    category: COMPONENT_CATEGORIES.CONTROL,
    components: [
      { id: 'plant-controller', name: 'Plant Ctrl', fullName: 'Plant Controller', type: 'plant-ctrl', rating: 0, voltage: 0, unit: '' },
      { id: 'ems', name: 'EMS', fullName: 'Energy Management System', type: 'ems', rating: 0, voltage: 0, unit: '' },
      { id: 'load-shed-ctrl', name: 'Load Shed', fullName: 'Load Shedding Controller', type: 'load-shed', rating: 0, voltage: 0, unit: '' },
      { id: 'black-start-ctrl', name: 'Black Start', fullName: 'Black Start Controller', type: 'black-start', rating: 0, voltage: 0, unit: '' },
      { id: 'protection-logic', name: 'Protection', fullName: 'Protection Logic Block', type: 'protection', rating: 0, voltage: 0, unit: '' }
    ]
  },
  
  // L) Structural / Grouping
  {
    category: COMPONENT_CATEGORIES.STRUCTURAL,
    components: [
      { id: 'power-block', name: 'Power Block', fullName: 'Power Block (Group)', type: 'power-block', rating: 0, voltage: 0, unit: '' },
      { id: 'substation', name: 'Substation', fullName: 'Substation', type: 'substation', rating: 0, voltage: 0, unit: '' },
      { id: 'plant-boundary', name: 'Plant Boundary', fullName: 'Plant Boundary', type: 'boundary', rating: 0, voltage: 0, unit: '' },
      { id: 'datacenter-boundary', name: 'DC Boundary', fullName: 'Data Center Boundary', type: 'dc-boundary', rating: 0, voltage: 0, unit: '' },
      { id: 'container-group', name: 'Container', fullName: 'Container (Visual Grouping)', type: 'container', rating: 0, voltage: 0, unit: '' }
    ]
  }
];
