/**
 * QUICK SCENARIOS MODULE
 * 
 * This module contains pre-built failure scenarios that can be triggered
 * with a single click from the Simulation Controls panel.
 * 
 * PURPOSE:
 * Instead of manually selecting and tripping components one-by-one,
 * these functions let users quickly test common "what-if" situations.
 * 
 * EACH FUNCTION RECEIVES:
 * - canvasComponents: Array of all components on the canvas
 * - handlers: Object containing the handler functions (handleTripComponent, etc.)
 * 
 * EACH FUNCTION RETURNS:
 * - An object with { success: boolean, message: string }
 * - This allows the caller to show feedback to the user
 */

// ============================================================================
// SCENARIO: Trip Random Turbine
// ============================================================================
// Randomly selects one turbine from the canvas and trips it.
// Useful for testing system response to unexpected turbine failures.
//
// WHAT IT DOES:
// 1. Finds all turbines on the canvas
// 2. Randomly picks one
// 3. Trips it using handleTripComponent
// 4. Returns the selected turbine so it can be highlighted
export const tripRandomTurbine = (canvasComponents, handlers) => {
  console.log('🎲 Trip Random Turbine scenario triggered');
  
  // Find all turbines on the canvas
  const turbines = canvasComponents.filter(comp => 
    comp.type.includes('turbine') || comp.type.includes('gas-turbine')
  );
  
  if (turbines.length === 0) {
    console.log('⚠️ No turbines found on canvas');
    return {
      success: false,
      message: 'No turbines on canvas to trip!',
      selectedComponent: null
    };
  }
  
  // Pick a random turbine
  const randomIndex = Math.floor(Math.random() * turbines.length);
  const randomTurbine = turbines[randomIndex];
  
  console.log('🎯 Selected random turbine:', randomTurbine.name, randomTurbine.id);
  
  // Trip it using the provided handler
  handlers.handleTripComponent(randomTurbine.id);
  
  return {
    success: true,
    message: `Tripped ${randomTurbine.name}`,
    selectedComponent: randomTurbine
  };
};

// ============================================================================
// SCENARIO: Trip All Turbines
// ============================================================================
// Trips every turbine on the canvas simultaneously.
// This simulates a total generation loss - worst case scenario!
//
// WHAT IT DOES:
// 1. Finds all turbines
// 2. Trips each one
// 3. Returns count of tripped turbines
export const tripAllTurbines = (canvasComponents, handlers) => {
  console.log('💥 Trip All Turbines scenario triggered');
  
  const turbines = canvasComponents.filter(comp => 
    comp.type.includes('turbine') || comp.type.includes('gas-turbine')
  );
  
  if (turbines.length === 0) {
    console.log('⚠️ No turbines found on canvas');
    return {
      success: false,
      message: 'No turbines on canvas to trip!'
    };
  }
  
  console.log(`🔴 Tripping ${turbines.length} turbines`);
  
  // Trip each turbine
  turbines.forEach(turbine => {
    handlers.handleTripComponent(turbine.id);
  });
  
  return {
    success: true,
    message: `Tripped ${turbines.length} turbines - total blackout!`
  };
};

// ============================================================================
// SCENARIO: Grid Loss
// ============================================================================
// Simulates losing the utility grid connection.
// Trips all components that represent grid/utility connections.
//
// WHAT IT DOES:
// 1. Finds all utility/grid components
// 2. Trips each one
// 3. Tests if the system can island (operate independently)
export const gridLoss = (canvasComponents, handlers) => {
  console.log('⚡ Grid Loss scenario triggered');
  
  // Find all grid/utility components
  const gridComponents = canvasComponents.filter(comp => 
    comp.type.includes('utility') || 
    comp.type.includes('grid') ||
    comp.type.includes('pcc')
  );
  
  if (gridComponents.length === 0) {
    console.log('⚠️ No grid components found on canvas');
    return {
      success: false,
      message: 'No grid connections on canvas!'
    };
  }
  
  console.log(`🔴 Tripping ${gridComponents.length} grid connections`);
  
  // Trip each grid connection
  gridComponents.forEach(grid => {
    handlers.handleTripComponent(grid.id);
  });
  
  return {
    success: true,
    message: `Lost ${gridComponents.length} grid connections - system islanded!`
  };
};

// ============================================================================
// SCENARIO: Open All Breakers
// ============================================================================
// Opens every breaker on the canvas.
// This simulates complete system sectioning/isolation.
//
// WHAT IT DOES:
// 1. Finds all breakers
// 2. Opens each one
// 3. Creates complete electrical isolation
export const openAllBreakers = (canvasComponents, handlers) => {
  console.log('🟠 Open All Breakers scenario triggered');
  
  // Find all breakers
  const breakers = canvasComponents.filter(comp => 
    comp.type.includes('breaker')
  );
  
  if (breakers.length === 0) {
    console.log('⚠️ No breakers found on canvas');
    return {
      success: false,
      message: 'No breakers on canvas to open!'
    };
  }
  
  console.log(`🟠 Opening ${breakers.length} breakers`);
  
  // Open each breaker
  breakers.forEach(breaker => {
    handlers.handleOpenBreaker(breaker.id);
  });
  
  return {
    success: true,
    message: `Opened ${breakers.length} breakers - complete isolation!`
  };
};

// ============================================================================
// EXPORT ALL SCENARIOS
// ============================================================================
// This allows importing all scenarios at once:
// import * as Scenarios from './scenarios/quickScenarios';
// Or importing specific ones:
// import { tripRandomTurbine, gridLoss } from './scenarios/quickScenarios';
export default {
  tripRandomTurbine,
  tripAllTurbines,
  gridLoss,
  openAllBreakers
};
