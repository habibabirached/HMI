import React from 'react';
import { Box } from '@mui/material';
import SimulationRunComponent from '../../components/SimulationRunComponent';
import ScreenHeader from '../../components/ScreenHeader';
import Footer from '../../Footer';
import { useBroadcast } from '../../contexts/BroadcastContext';
import { getDataFilePath, SIM_CONFIG_OPTIONS } from '../../state/state';
import { MAIN_COLOR, COMPARE_COLOR } from '../../config';

const Screen2 = () => {
  const { 
    mainConfig, 
    compareConfig,
    setMainSimulationIsDone, 
    setCompareSimulationIsDone,
    showCompareConfig 
  } = useBroadcast();

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#121212', display: 'flex', flexDirection: 'column' }}>
      <ScreenHeader screenNumber={2} title="Simulation" />
      
      <Box sx={{ flex: 1, p: 2, overflow: 'auto' }}>
        {/* Main Simulation */}
        <Box sx={{ mb: showCompareConfig ? 4 : 0, width: '100%' }}>
        {mainConfig === SIM_CONFIG_OPTIONS[0] && (
          <SimulationRunComponent 
            title='Using HD Generator without BESS'
            dataFilePath={getDataFilePath(mainConfig)}
            runningImagePath={'/HD_No_BESS_Running.gif'}
            notRunningImagePath={'/HD_No_BESS_Still.jpg'}
            config={mainConfig}
            setIsDone={setMainSimulationIsDone}
            simulationLineColor={MAIN_COLOR}
          />
        )}

        {mainConfig === SIM_CONFIG_OPTIONS[1] && (
          <SimulationRunComponent 
            title='Using HD Generator with BESS Supplying Data Center Load'
            dataFilePath={getDataFilePath(mainConfig)}
            runningImagePath={'/HD_BESS_Running.gif'}
            notRunningImagePath={'/HD_BESS_Still.jpg'}
            config={mainConfig}
            setIsDone={setMainSimulationIsDone}
            simulationLineColor={MAIN_COLOR}
          />
        )}

        {mainConfig === SIM_CONFIG_OPTIONS[2] && (
          <SimulationRunComponent 
            title='Using Aero Derivative Generator without BESS'
            dataFilePath={getDataFilePath(mainConfig)}
            runningImagePath={'/Aero_No_BESS_Running.gif'}
            notRunningImagePath={'/Aero_No_BESS_Still.jpg'}
            config={mainConfig}
            setIsDone={setMainSimulationIsDone}
            simulationLineColor={MAIN_COLOR}
          />
        )}

        {mainConfig === SIM_CONFIG_OPTIONS[3] && (
          <SimulationRunComponent 
            title='Using Aero Derivative Generator with BESS Supplying Data Center Load'
            dataFilePath={getDataFilePath(mainConfig)}
            runningImagePath={'/Aero_BESS_Running.gif'}
            notRunningImagePath={'/Aero_BESS_Still.jpg'}
            config={mainConfig}
            setIsDone={setMainSimulationIsDone}
            simulationLineColor={MAIN_COLOR}
          />
        )}
        </Box>

        {/* Compare Simulation (if enabled) */}
        {showCompareConfig && (
          <Box sx={{ mt: 4 }}>
          {compareConfig === SIM_CONFIG_OPTIONS[0] && (
            <SimulationRunComponent 
              title='Using HD Generator without BESS'
              dataFilePath={getDataFilePath(compareConfig)}
              runningImagePath={'/HD_No_BESS_Running.gif'}
              notRunningImagePath={'/HD_No_BESS_Still.jpg'}
              config={compareConfig}
              setIsDone={setCompareSimulationIsDone}
              simulationLineColor={COMPARE_COLOR}
            />
          )}

          {compareConfig === SIM_CONFIG_OPTIONS[1] && (
            <SimulationRunComponent 
              title='Using HD Generator with BESS Supplying Data Center Load'
              dataFilePath={getDataFilePath(compareConfig)}
              runningImagePath={'/HD_BESS_Running.gif'}
              notRunningImagePath={'/HD_BESS_Still.jpg'}
              config={compareConfig}
              setIsDone={setCompareSimulationIsDone}
              simulationLineColor={COMPARE_COLOR}
            />
          )}

          {compareConfig === SIM_CONFIG_OPTIONS[2] && (
            <SimulationRunComponent 
              title='Using Aero Derivative Generator without BESS'
              dataFilePath={getDataFilePath(compareConfig)}
              runningImagePath={'/Aero_No_BESS_Running.gif'}
              notRunningImagePath={'/Aero_No_BESS_Still.jpg'}
              config={compareConfig}
              setIsDone={setCompareSimulationIsDone}
              simulationLineColor={COMPARE_COLOR}
            />
          )}

          {compareConfig === SIM_CONFIG_OPTIONS[3] && (
            <SimulationRunComponent 
              title='Using Aero Derivative Generator with BESS Supplying Data Center Load'
              dataFilePath={getDataFilePath(compareConfig)}
              runningImagePath={'/Aero_BESS_Running.gif'}
              notRunningImagePath={'/Aero_BESS_Still.jpg'}
              config={compareConfig}
              setIsDone={setCompareSimulationIsDone}
              simulationLineColor={COMPARE_COLOR}
            />
          )}
          </Box>
        )}
      </Box>
      <Footer />
    </Box>
  );
};

export default Screen2;

