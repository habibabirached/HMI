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
      { id: 'gas-turbine-lm2500', name: 'LM2500', fullName: 'Gas Turbine LM2500', type: 'aeroderivative', properties: { rating: 25, voltage: 13.8, unit: 'MW' } },
      { id: 'gas-turbine-lm2500-andritz', name: 'LM2500 Andritz', fullName: 'LM2500 Andritz A03 33.3MW', type: 'aeroderivative', properties: { rating: 33.3, voltage: 13.8, unit: 'MW' } },
      { id: 'gas-turbine-lm2500-plus', name: 'LM2500+', fullName: 'Gas Turbine LM2500+ / Xpress', type: 'aeroderivative', properties: { rating: 30, voltage: 13.8, unit: 'MW' } },
      { id: 'gas-turbine-lm6000', name: 'LM6000', fullName: 'Gas Turbine LM6000', type: 'aeroderivative', properties: { rating: 45, voltage: 13.8, unit: 'MW' } },
      { id: 'gas-turbine-7h', name: '7H / 7HA', fullName: 'Gas Turbine 7H / 7HA', type: 'heavy-duty', properties: { rating: 300, voltage: 18, unit: 'MW' } },
      { id: 'gas-turbine-9ha', name: '9HA', fullName: 'Gas Turbine 9HA', type: 'heavy-duty', properties: { rating: 450, voltage: 22, unit: 'MW' } },
      { id: 'steam-turbine', name: 'Steam Turbine', fullName: 'Steam Turbine', type: 'steam', properties: { rating: 100, voltage: 13.8, unit: 'MW' } },
      { id: 'diesel-generator', name: 'Diesel Gen', fullName: 'Diesel Generator', type: 'diesel', properties: { rating: 2, voltage: 0.48, unit: 'MW' } },
      { id: 'gas-turbine-1mw', name: 'Gas Gen 1MW', fullName: 'Gas Turbine Generator 1MW', type: 'gas-gen-small', properties: { rating: 1, voltage: 0.48, unit: 'MW' } },
      { id: 'gas-turbine-5mw', name: 'Gas Gen 5MW', fullName: 'Gas Turbine Generator 5MW', type: 'gas-gen-medium', properties: { rating: 5, voltage: 4.16, unit: 'MW' } },
      { id: 'gas-turbine-10mw', name: 'Gas Gen 10MW', fullName: 'Gas Turbine Generator 10MW', type: 'gas-gen-large', properties: { rating: 10, voltage: 13.8, unit: 'MW' } },
      { id: 'recip-gas-engine', name: 'Gas Engine', fullName: 'Reciprocating Gas Engine', type: 'reciprocating', properties: { rating: 10, voltage: 0.48, unit: 'MW' } },
      { id: 'fuel-cell', name: 'Fuel Cell', fullName: 'Fuel Cell (Containerized)', type: 'fuel-cell', properties: { rating: 1, voltage: 0.48, unit: 'MW' } },
      { id: 'wind-turbine-type3', name: 'Wind Type III', fullName: 'Wind Turbine Type III', type: 'wind', properties: { rating: 3, voltage: 0.69, unit: 'MW' } },
      { id: 'wind-turbine-type4', name: 'Wind Type IV', fullName: 'Wind Turbine Type IV', type: 'wind', properties: { rating: 5, voltage: 0.69, unit: 'MW' } },
      { id: 'solar-pv', name: 'Solar PV', fullName: 'Solar PV Array', type: 'solar', properties: { rating: 2, voltage: 0.48, unit: 'MW' } },
      { id: 'microturbine', name: 'Microturbine', fullName: 'Microturbine', type: 'microturbine', properties: { rating: 0.2, voltage: 0.48, unit: 'MW' } }
    ]
  },
  
  // B) Electrical Machines
  {
    category: COMPONENT_CATEGORIES.ELECTRICAL_MACHINES,
    components: [
      { id: 'generator-sync', name: 'Generator', fullName: 'Synchronous Generator', type: 'generator', properties: { rating: 30, voltage: 13.8, unit: 'MVA' } },
      { id: 'motor-large', name: 'Motor', fullName: 'Motor (Large Auxiliary)', type: 'motor', properties: { rating: 5, voltage: 4.16, unit: 'MW' } },
      { id: 'shaft-coupling', name: 'Shaft', fullName: 'Generator Shaft / Coupling', type: 'shaft', properties: { rating: 0, voltage: 0, unit: '' } }
    ]
  },
  
  // C) Energy Storage
  {
    category: COMPONENT_CATEGORIES.ENERGY_STORAGE,
    components: [
      { id: 'bess', name: 'BESS', fullName: 'Battery Energy Storage System', type: 'battery', properties: { rating: 10, voltage: 0.48, unit: 'MWh' } },
      { id: 'bess-30mw', name: 'BESS 30MW', fullName: 'Battery Energy Storage System 30MW', type: 'battery', properties: { rating: 30, voltage: 34.5, unit: 'MW' } },
      { id: 'bess-50mw', name: 'BESS 50MW', fullName: 'Battery Energy Storage System 50MW', type: 'battery', properties: { rating: 50, voltage: 34.5, unit: 'MWh' } },
      { id: 'battery-rack', name: 'Battery Rack', fullName: 'Battery Rack', type: 'battery', properties: { rating: 1, voltage: 0.48, unit: 'MWh' } },
      { id: 'battery-container', name: 'Battery Container', fullName: 'Battery Container', type: 'battery', properties: { rating: 5, voltage: 0.48, unit: 'MWh' } },
      { id: 'flywheel', name: 'Flywheel', fullName: 'Flywheel Energy Storage', type: 'flywheel', properties: { rating: 0.5, voltage: 0.48, unit: 'MWh' } },
      { id: 'supercapacitor', name: 'Supercapacitor', fullName: 'Supercapacitor', type: 'capacitor', properties: { rating: 0.1, voltage: 0.48, unit: 'MWh' } },
      { id: 'hydrogen-storage', name: 'H2 Storage', fullName: 'Hydrogen Storage', type: 'hydrogen', properties: { rating: 50, voltage: 0, unit: 'MWh' } },
      { id: 'thermal-storage', name: 'Thermal Storage', fullName: 'Thermal Energy Storage', type: 'thermal', properties: { rating: 20, voltage: 0, unit: 'MWh' } }
    ]
  },
  
  // D) Power Electronics / Conversion
  {
    category: COMPONENT_CATEGORIES.POWER_ELECTRONICS,
    components: [
      { id: 'ups', name: 'UPS', fullName: 'Uninterruptible Power Supply', type: 'ups', properties: { rating: 1, voltage: 0.48, unit: 'MVA' } },
      { id: 'rectifier', name: 'Rectifier', fullName: 'AC-DC Rectifier', type: 'rectifier', properties: { rating: 2, voltage: 0.48, unit: 'MW' } },
      { id: 'inverter', name: 'Inverter', fullName: 'DC-AC Inverter', type: 'inverter', properties: { rating: 2, voltage: 0.48, unit: 'MW' } },
      { id: 'sst', name: 'SST', fullName: 'Solid-State Transformer', type: 'sst', properties: { rating: 10, voltage: 4.16, unit: 'MVA' } },
      { id: 'dcdc-converter', name: 'DC-DC Conv', fullName: 'DC-DC Converter', type: 'dcdc', properties: { rating: 1, voltage: 0, unit: 'MW' } },
      { id: 'acdc-converter', name: 'AC-DC Conv', fullName: 'AC-DC Converter', type: 'acdc', properties: { rating: 2, voltage: 0.48, unit: 'MW' } },
      { id: 'dcac-converter', name: 'DC-AC Conv', fullName: 'DC-AC Converter', type: 'dcac', properties: { rating: 2, voltage: 0.48, unit: 'MW' } }
    ]
  },
  
  // E) Transformers
  {
    category: COMPONENT_CATEGORIES.TRANSFORMERS,
    components: [
      { id: 'gsu-transformer', name: 'GSU Xfmr', fullName: 'Generator Step-Up Transformer', type: 'gsu', properties: { rating: 35, unit: 'MVA' }, primary: 13.8, secondary: 34.5 },
      { id: 'bess-transformer', name: 'BESS Xfmr', fullName: 'BESS Transformer', type: 'bess-xfmr', properties: { rating: 50, unit: 'MVA' }, primary: 34.5, secondary: 34.5 },
      { id: 'datacenter-transformer', name: 'DC Xfmr', fullName: 'Data Center Transformer', type: 'dc-xfmr', properties: { rating: 35, unit: 'MVA' }, primary: 34.5, secondary: 0.48 },
      { id: 'stepdown-transformer', name: 'Step-Down Xfmr', fullName: 'Step-Down Transformer', type: 'stepdown', properties: { rating: 25, unit: 'MVA' }, primary: 34.5, secondary: 4.16 },
      { id: 'isolation-transformer', name: 'Iso Xfmr', fullName: 'Isolation Transformer', type: 'isolation', properties: { rating: 10, unit: 'MVA' }, primary: 0.48, secondary: 0.48 },
      { id: 'auto-transformer', name: 'Auto Xfmr', fullName: 'Auto-Transformer', type: 'auto', properties: { rating: 20, unit: 'MVA' }, primary: 34.5, secondary: 13.8 },
      { id: 'distribution-transformer', name: 'Dist Xfmr', fullName: 'Distribution Transformer', type: 'distribution', properties: { rating: 2, unit: 'MVA' }, primary: 4.16, secondary: 0.48 }
    ]
  },
  
  // F) Switchgear & Protection
  {
    category: COMPONENT_CATEGORIES.SWITCHGEAR,
    components: [
      { id: 'breaker-hv', name: 'HV Breaker', fullName: 'High Voltage Circuit Breaker', type: 'breaker-hv', properties: { rating: 3000, voltage: 34.5, unit: 'A' } },
      { id: 'breaker-mv', name: 'MV Breaker', fullName: 'Medium Voltage Circuit Breaker', type: 'breaker-mv', properties: { rating: 2000, voltage: 4.16, unit: 'A' } },
      { id: 'breaker-lv', name: 'LV Breaker', fullName: 'Low Voltage Circuit Breaker', type: 'breaker-lv', properties: { rating: 4000, voltage: 0.48, unit: 'A' } },
      { id: 'breaker-dc', name: 'DC Breaker', fullName: 'DC Circuit Breaker', type: 'breaker-dc', properties: { rating: 3000, voltage: 0.48, unit: 'A' } },
      { id: 'breaker-bess', name: 'BESS CB', fullName: 'BESS Circuit Breaker', type: 'breaker-bess', properties: { rating: 2000, voltage: 34.5, unit: 'A' } },
      { id: 'breaker-gen-13.8', name: 'Gen CB 13.8kV', fullName: 'Generator Circuit Breaker 13.8kV', type: 'breaker-gen', properties: { rating: 2000, voltage: 13.8, unit: 'A' } },
      { id: 'disconnect-switch', name: 'Disconnect', fullName: 'Disconnect Switch', type: 'disconnect', properties: { rating: 1200, voltage: 13.8, unit: 'A' } },
      { id: 'bus-tie-breaker', name: 'Bus Tie Bkr', fullName: 'Bus Tie Breaker', type: 'bus-tie', properties: { rating: 2000, voltage: 4.16, unit: 'A' } },
      { id: 'tie-breaker-network', name: 'Tie Breaker Network', fullName: 'Tie Breaker Circuit Network', type: 'tie-breaker-network', properties: { rating: 0, voltage: 34.5, unit: '' } },
      { id: 'recloser', name: 'Recloser', fullName: 'Automatic Recloser', type: 'recloser', properties: { rating: 800, voltage: 13.8, unit: 'A' } },
      { id: 'protection-relay', name: 'Relay', fullName: 'Protection Relay', type: 'relay', properties: { rating: 0, voltage: 0, unit: '' } },
      { id: 'fuse', name: 'Fuse', fullName: 'Fuse', type: 'fuse', properties: { rating: 100, voltage: 0.48, unit: 'A' } }
    ]
  },
  
  // G) Measurement & Instrumentation
  {
    category: COMPONENT_CATEGORIES.MEASUREMENT,
    components: [
      { id: 'current-transformer', name: 'CT', fullName: 'Current Transformer', type: 'ct', properties: { rating: 0, voltage: 0, unit: '' } },
      { id: 'current-transformer-800', name: 'CT 800:1', fullName: 'Current Transformer 800:1', type: 'ct', properties: { rating: 800, voltage: 0, unit: '800:1' } },
      { id: 'current-transformer-1500', name: 'CT 1500:1', fullName: 'Current Transformer 1500:1', type: 'ct', properties: { rating: 1500, voltage: 0, unit: '1500:1' } },
      { id: 'current-transformer-2000', name: 'CT 2000:1', fullName: 'Current Transformer 2000:1', type: 'ct', properties: { rating: 2000, voltage: 0, unit: '2000:1' } },
      { id: 'voltage-transformer', name: 'VT / PT', fullName: 'Voltage / Potential Transformer', type: 'vt', properties: { rating: 0, voltage: 0, unit: '' } },
      { id: 'power-meter', name: 'Meter', fullName: 'Power / Energy Meter', type: 'meter', properties: { rating: 0, voltage: 0, unit: '' } },
      { id: 'frequency-meter', name: 'Freq Meter', fullName: 'Frequency Meter', type: 'freq-meter', properties: { rating: 0, voltage: 0, unit: '' } },
      { id: 'pmu', name: 'PMU', fullName: 'Phasor Measurement Unit', type: 'pmu', properties: { rating: 0, voltage: 0, unit: '' } }
    ]
  },
  
  // H) Buses & Electrical Nodes
  {
    category: COMPONENT_CATEGORIES.BUSES,
    components: [
      { id: 'bus-knot', name: '•', fullName: 'Connection Point (knot)', type: 'bus-knot', properties: { rating: 0, voltage: 0, unit: '' } },
      { id: 'bus-hv', name: 'HV Bus', fullName: 'High Voltage Bus', type: 'bus-hv', properties: { rating: 0, voltage: 34.5, unit: 'kV' } },
      { id: 'bus-hv-vertical', name: 'HV Bus (V)', fullName: 'High Voltage Bus (Vertical)', type: 'bus-hv-vertical', properties: { rating: 0, voltage: 34.5, unit: 'kV' } },
      { id: 'bus-mv', name: 'MV Bus', fullName: 'Medium Voltage Bus', type: 'bus-mv', properties: { rating: 0, voltage: 4.16, unit: 'kV' } },
      { id: 'bus-lv', name: 'LV Bus', fullName: 'Low Voltage Bus', type: 'bus-lv', properties: { rating: 0, voltage: 0.48, unit: 'kV' } },
      { id: 'bus-dc', name: 'DC Bus', fullName: 'DC Bus', type: 'bus-dc', properties: { rating: 0, voltage: 0.8, unit: 'kV' } },
      { id: 'bus-ring', name: 'Ring Bus', fullName: 'Ring Bus', type: 'bus-ring', properties: { rating: 0, voltage: 13.8, unit: 'kV' } },
      { id: 'bus-sectional', name: 'Sectional Bus', fullName: 'Sectionalized Bus', type: 'bus-sectional', properties: { rating: 0, voltage: 4.16, unit: 'kV' } }
    ]
  },
  
  // I) Grid / External Interfaces
  {
    category: COMPONENT_CATEGORIES.GRID,
    components: [
      { id: 'utility-grid', name: 'Utility Grid', fullName: 'Utility Grid Connection', type: 'utility', properties: { rating: 100, voltage: 34.5, unit: 'MW' } },
      { id: 'backup-grid', name: 'Backup Grid', fullName: 'Backup Grid', type: 'backup', properties: { rating: 50, voltage: 34.5, unit: 'MW' } },
      { id: 'islanding-point', name: 'Island Point', fullName: 'Islanding Point', type: 'island', properties: { rating: 0, voltage: 0, unit: '' } },
      { id: 'pcc', name: 'PCC', fullName: 'Point of Common Coupling', type: 'pcc', properties: { rating: 0, voltage: 34.5, unit: '' } },
      { id: 'microgrid-controller', name: 'µGrid Ctrl', fullName: 'Microgrid Controller', type: 'microgrid-ctrl', properties: { rating: 0, voltage: 0, unit: '' } }
    ]
  },
  
  // J) Loads
  {
    category: COMPONENT_CATEGORIES.LOADS,
    components: [
      { id: 'datacenter-load', name: 'DC Load', fullName: 'Data Center Load', type: 'datacenter', properties: { rating: 50, voltage: 0.48, unit: 'MW' } },
      { id: 'data-hall', name: 'Data Hall', fullName: 'Data Hall', type: 'data-hall', properties: { rating: 10, voltage: 0.48, unit: 'MW' } },
      { id: 'it-load', name: 'IT Load', fullName: 'IT Load', type: 'it-load', properties: { rating: 30, voltage: 0.48, unit: 'MW' } },
      { id: 'it-rack-load', name: 'IT Rack Load', fullName: 'IT Rack Load', type: 'it-rack', properties: { rating: 1, voltage: 0.8, unit: 'MW' } },
      { id: 'cooling-plant', name: 'Cooling', fullName: 'Cooling Plant', type: 'cooling', properties: { rating: 15, voltage: 0.48, unit: 'MW' } },
      { id: 'hvac-load', name: 'HVAC Load', fullName: 'HVAC / Cooling Load', type: 'hvac', properties: { rating: 5, voltage: 0.48, unit: 'MW' } },
      { id: 'auxiliary-loads', name: 'Aux Loads', fullName: 'Auxiliary Loads', type: 'auxiliary', properties: { rating: 5, voltage: 0.48, unit: 'MW' } },
      { id: 'critical-load', name: 'Critical Load', fullName: 'Critical Load Block', type: 'critical', properties: { rating: 20, voltage: 0.48, unit: 'MW' } },
      { id: 'noncritical-load', name: 'Non-Crit Load', fullName: 'Non-Critical Load Block', type: 'non-critical', properties: { rating: 10, voltage: 0.48, unit: 'MW' } }
    ]
  },
  
  // K) Control & Logic
  {
    category: COMPONENT_CATEGORIES.CONTROL,
    components: [
      { id: 'plant-controller', name: 'Plant Ctrl', fullName: 'Plant Controller', type: 'plant-ctrl', properties: { rating: 0, voltage: 0, unit: '' } },
      { id: 'ems', name: 'EMS', fullName: 'Energy Management System', type: 'ems', properties: { rating: 0, voltage: 0, unit: '' } },
      { id: 'load-shed-ctrl', name: 'Load Shed', fullName: 'Load Shedding Controller', type: 'load-shed', properties: { rating: 0, voltage: 0, unit: '' } },
      { id: 'black-start-ctrl', name: 'Black Start', fullName: 'Black Start Controller', type: 'black-start', properties: { rating: 0, voltage: 0, unit: '' } },
      { id: 'protection-logic', name: 'Protection', fullName: 'Protection Logic Block', type: 'protection', properties: { rating: 0, voltage: 0, unit: '' } }
    ]
  },
  
  // L) Structural / Grouping
  {
    category: COMPONENT_CATEGORIES.STRUCTURAL,
    components: [
      { id: 'power-block', name: 'Power Block', fullName: 'Power Block (Group)', type: 'power-block', properties: { rating: 0, voltage: 0, unit: '' } },
      { id: 'substation', name: 'Substation', fullName: 'Substation', type: 'substation', properties: { rating: 0, voltage: 0, unit: '' } },
      { id: 'plant-boundary', name: 'Plant Boundary', fullName: 'Plant Boundary', type: 'boundary', properties: { rating: 0, voltage: 0, unit: '' } },
      { id: 'datacenter-boundary', name: 'DC Boundary', fullName: 'Data Center Boundary', type: 'dc-boundary', properties: { rating: 0, voltage: 0, unit: '' } },
      { id: 'container-group', name: 'Container', fullName: 'Container (Visual Grouping)', type: 'container', properties: { rating: 0, voltage: 0, unit: '' } }
    ]
  }
];
