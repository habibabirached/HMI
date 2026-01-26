import React from 'react';
import { Box } from '@mui/material';
import SimulationCompareComponent from '../../components/SimulationCompareComponent';
import ScreenHeader from '../../components/ScreenHeader';
import Footer from '../../Footer';
import { useBroadcast } from '../../contexts/BroadcastContext';

const Screen3 = () => {
  const { 
    mainConfig, 
    compareConfig,
    showCompareConfig
  } = useBroadcast();

  // Show comparison data as soon as compare config is enabled
  const doShowComparisonData = showCompareConfig;

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#121212' }}>
      <ScreenHeader screenNumber={3} title="Comparison" />
      
      <Box sx={{ p: 2 }}>
        <SimulationCompareComponent 
          title='Compare Simulations'
          doShowComparisonData={doShowComparisonData}
          mainConfig={mainConfig}
          compareConfig={compareConfig} 
        />
      </Box>
      <Footer />
    </Box>
  );
};

export default Screen3;

