import React from 'react';
import { Box } from '@mui/material';
import { useAtom } from 'jotai';
import Header from '../../Header';
import Footer from '../../Footer';
import SimulationConfigComponent from '../../components/SimulationConfigComponent';
import SimulationRunComponent from '../../components/SimulationRunComponent';
import SimulationCompareComponent from '../../components/SimulationCompareComponent';
import StaticDataCenterLoadChartComponent from '../../components/charts/StaticDataCenterLoadChartComponent';
import { FullscreenProvider } from '../../contexts/FullscreenContext';
import { 
  mainConfigAtom, 
  compareConfigAtom, 
  mainSimulationIsDoneAtom, 
  compareSimulationIsDoneAtom,
  getDataFilePath,
  SIM_CONFIG_OPTIONS
} from '../../state/state';
import { MAIN_COLOR, COMPARE_COLOR } from '../../config';

const SinglePageLayout = () => {
  const [mainConfig, setMainConfig] = useAtom(mainConfigAtom);
  const [compareConfig, setCompareConfig] = useAtom(compareConfigAtom);
  const [mainSimulationIsDone, setMainSimulationIsDone] = useAtom(mainSimulationIsDoneAtom);
  const [compareSimulationIsDone, setCompareSimulationIsDone] = useAtom(compareSimulationIsDoneAtom);
  const [showCompareConfig, setShowCompareConfig] = React.useState(false);
  const baseConfigRef = React.useRef(null);
  const compareSimRef = React.useRef(null);
  const [dividerTop, setDividerTop] = React.useState('50%');

  // Only show comparison data when both simulations are done AND compare config is shown
  const doShowComparisonData = showCompareConfig && mainSimulationIsDone && compareSimulationIsDone;

  // Helper function to format configuration title
  const getConfigTitle = (baseTitle, config) => {
    if (!config) return baseTitle;
    
    const turbineType = config.includes('AERO') ? 'Aero' : 'HD';
    const bessStatus = config.includes('BESS') ? 'with BESS' : 'without BESS';
    
    return `${baseTitle}: ${turbineType} ${bessStatus}`;
  };

  const toggleShowCompareConfig = () => {
    setShowCompareConfig(!showCompareConfig);
  };

  // Update divider position based on compare simulation position in column 2
  const updateDividerPosition = React.useCallback(() => {
    if (compareSimRef.current && showCompareConfig) {
      const compareRect = compareSimRef.current.getBoundingClientRect();
      const containerRect = compareSimRef.current.closest('.columns-wrapper')?.getBoundingClientRect();
      if (containerRect) {
        const relativeTop = compareRect.top - containerRect.top;
        setDividerTop(`${relativeTop}px`);
      }
    }
  }, [showCompareConfig]);

  // Update divider position when config changes or when component mounts
  React.useEffect(() => {
    updateDividerPosition();
    
    // Use ResizeObserver to update when base config size changes
    if (baseConfigRef.current && showCompareConfig) {
      const resizeObserver = new ResizeObserver(() => {
        // Delay to ensure DOM has updated
        setTimeout(() => {
          updateDividerPosition();
        }, 50);
      });
      resizeObserver.observe(baseConfigRef.current);
      
      return () => {
        resizeObserver.disconnect();
      };
    }
  }, [showCompareConfig, mainConfig, compareConfig, updateDividerPosition]);

  // Also update after a short delay to account for rendering
  React.useEffect(() => {
    if (showCompareConfig) {
      const timer = setTimeout(() => {
        updateDividerPosition();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [showCompareConfig, mainConfig, compareConfig, updateDividerPosition]);

  return (
    <FullscreenProvider>
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        minHeight: '100vh',
        backgroundColor: '#121212' 
      }}>
        {/* Unified Header */}
        <Header />

        {/* 3 Column Layout */}
        <Box sx={{ 
          display: 'flex', 
          flex: 1,
          overflow: 'hidden',
          position: 'relative'
        }}>
        {/* Columns 1 and 2 Wrapper (for horizontal divider) */}
        <Box className="columns-wrapper" sx={{ 
          width: '75%',
          display: 'flex',
          position: 'relative'
        }}>
          {/* Column 1: Configuration (25% of total, 33.33% of wrapper) */}
          <Box sx={{ 
            width: '33.33%',
            overflowY: 'auto',
            overflowX: 'hidden',
            borderRight: '1px solid rgba(128, 128, 128, 0.2)',
            p: 2,
            position: 'relative'
          }}>
            {/* Base Configuration */}
            <Box ref={baseConfigRef}>
              <SimulationConfigComponent setConfig={setMainConfig} title={getConfigTitle("Base Configuration", mainConfig)} />
            </Box>
            
            {/* Static Data Center Load Chart - above button when not showing compare */}
            {!showCompareConfig && (
              <Box sx={{ mt: 3, mb: 2 }}>
                <StaticDataCenterLoadChartComponent config={mainConfig} lineColor={MAIN_COLOR} />
              </Box>
            )}
            
            {/* Show/Hide Compare Config Button - styled as divider, positioned at line */}
            {showCompareConfig && (
              <Box sx={{ 
                position: 'absolute',
                left: '16px',
                right: '16px',
                top: `calc(${dividerTop} - 21px)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10
              }}>
                <button 
                  onClick={toggleShowCompareConfig}
                  style={{
                    width: '100%',
                    padding: '8px 20px',
                    backgroundColor: 'rgba(128, 128, 128, 0.15)',
                    color: '#cccccc',
                    border: '1px solid rgba(128, 128, 128, 0.3)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    position: 'relative',
                    fontWeight: '500'
                  }}
                >
                  {showCompareConfig ? "Hide Compare Config" : "Show Compare Config"}
                </button>
              </Box>
            )}

            {!showCompareConfig && (
              <Box sx={{ 
                mt: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <button 
                  onClick={toggleShowCompareConfig}
                  style={{
                    width: '100%',
                    padding: '8px 20px',
                    backgroundColor: 'rgba(128, 128, 128, 0.15)',
                    color: '#cccccc',
                    border: '1px solid rgba(128, 128, 128, 0.3)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    position: 'relative',
                    fontWeight: '500'
                  }}
                >
                  Show Compare Config
                </button>
              </Box>
            )}

            {/* Alternative Configuration - below divider */}
            {showCompareConfig && (
              <Box sx={{ 
                position: 'absolute',
                top: `calc(${dividerTop} + 25px)`,
                left: 0,
                right: 0,
                px: 2
              }}>
                <SimulationConfigComponent setConfig={setCompareConfig} isCompare={true} title={getConfigTitle("Alternative Configuration", compareConfig)} />
                
                {/* Static Data Center Load Chart - at bottom when showing compare */}
                <Box sx={{ mt: 3 }}>
                  <StaticDataCenterLoadChartComponent config={mainConfig} lineColor={MAIN_COLOR} />
                </Box>
              </Box>
            )}
          </Box>

          {/* Horizontal Divider Line - spans across columns 1 and 2 */}
          {showCompareConfig && (
            <Box sx={{
              position: 'absolute',
              left: 0,
              right: 0,
              height: '2px',
              backgroundColor: 'rgba(128, 128, 128, 0.3)',
              zIndex: 5,
              top: dividerTop,
              pointerEvents: 'none'
            }} />
          )}

          {/* Column 2: Simulation (50% of total, 66.66% of wrapper) */}
          <Box sx={{ 
            width: '66.66%',
            overflowY: 'auto',
            overflowX: 'hidden',
            borderRight: '1px solid rgba(128, 128, 128, 0.2)',
            p: 2
          }}>
            {/* Main Simulation */}
            <Box sx={{ mb: showCompareConfig ? 4 : 0 }}>
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
              <Box ref={compareSimRef} sx={{ mt: 4 }}>
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
        </Box>

        {/* Column 3: Comparison (25%) */}
        <Box sx={{ 
          width: '25%',
          overflowY: 'auto',
          overflowX: 'hidden',
          p: 2
        }}>
          <SimulationCompareComponent 
            title='Compare Simulations'
            doShowComparisonData={doShowComparisonData}
            mainConfig={mainConfig}
            compareConfig={compareConfig} 
          />
        </Box>
      </Box>

      {/* Unified Footer */}
      <Footer />
    </Box>
    </FullscreenProvider>
  );
};

export default SinglePageLayout;

